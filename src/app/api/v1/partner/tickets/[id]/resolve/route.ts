import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPartnerApiKey, dispatchPartnerWebhook } from "@/lib/partnerAuth";
import { saveFileToCloud, saveRemoteUrlToFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/partner/tickets/[id]/resolve
 * Mark ticket as resolved, attaching resolution details, defective serial, and service report.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const auth = await verifyPartnerApiKey(req);

  if (!auth) {
    return NextResponse.json(
      { success: false, error: "Unauthorized. Missing or invalid Bearer API key." },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const numericId = parseInt(id, 10);

    const ticket = await db.ticket.findFirst({
      where: {
        partnerId: auth.partnerId,
        OR: [
          ...(isNaN(numericId) ? [] : [{ id: numericId }]),
          { externalTicketRef: id },
          { ticketRefNo: id },
        ],
      },
    });

    if (!ticket) {
      return NextResponse.json(
        { success: false, error: "Ticket not found or not assigned to your partner agency." },
        { status: 404 }
      );
    }

    const contentType = req.headers.get("content-type") || "";
    let resolutionDetails = "";
    let defectiveSerial = "";
    let serviceReportUrl = ticket.serviceReportUrl;
    let notes = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      resolutionDetails = (formData.get("resolutionDetails") as string) || "";
      defectiveSerial = (formData.get("defectiveSerial") as string) || "";
      notes = (formData.get("notes") as string) || "";

      const file = formData.get("serviceReport") as File | null;
      if (file) {
        serviceReportUrl = await saveFileToCloud(file);
      }
    } else {
      const jsonBody = await req.json();
      resolutionDetails = jsonBody.resolutionDetails || "";
      defectiveSerial = jsonBody.defectiveSerial || "";
      if (jsonBody.serviceReportUrl) {
        const rawUrl = jsonBody.serviceReportUrl;
        try {
          const saved = await saveRemoteUrlToFile(rawUrl, "Service-Report.pdf");
          serviceReportUrl = saved.url;
        } catch (dlErr: any) {
          console.warn(`[Resolve API] Could not ingest remote service report URL, using original link: ${dlErr.message}`);
          serviceReportUrl = rawUrl;
        }
      }
      notes = jsonBody.notes || "";
    }

    if (!resolutionDetails.trim()) {
      return NextResponse.json(
        { success: false, error: "Field 'resolutionDetails' is required when resolving a ticket." },
        { status: 400 }
      );
    }

    const updatedTicket = await db.ticket.update({
      where: { id: ticket.id },
      data: {
        status: "RESOLVED",
        subStatus: "RESOLVED",
        resolvedAt: new Date(),
        resolutionDetails: resolutionDetails.trim(),
        defectiveSerial: defectiveSerial.trim() || ticket.defectiveSerial,
        serviceReportUrl,
        serviceReportSignedAt: serviceReportUrl ? new Date() : ticket.serviceReportSignedAt,
      },
    });

    const activityNote = `Ticket marked RESOLVED via Partner API.\nDetails: ${resolutionDetails}${
      defectiveSerial ? `\nDefective Part S/N: ${defectiveSerial}` : ""
    }${notes ? `\nNote: ${notes}` : ""}`;

    await db.ticketActivity.create({
      data: {
        ticketId: ticket.id,
        type: "STATUS_CHANGE",
        status: "RESOLVED",
        subStatus: "RESOLVED",
        notes: activityNote,
        attachmentUrl: serviceReportUrl || undefined,
        author: `${auth.partnerName} (API)`,
      },
    });

    dispatchPartnerWebhook(auth.partnerId, "ticket.resolved", ticket.id, {
      ticketId: ticket.id,
      ticketRefNo: ticket.ticketRefNo,
      externalTicketRef: updatedTicket.externalTicketRef,
      resolvedAt: updatedTicket.resolvedAt,
      resolutionDetails: updatedTicket.resolutionDetails,
      serviceReportUrl: updatedTicket.serviceReportUrl,
      defectiveSerial: updatedTicket.defectiveSerial,
    }).catch(() => {});

    const durationMs = Date.now() - startTime;

    (db as any).partnerSyncLog.create({
      data: {
        partnerId: auth.partnerId,
        ticketId: ticket.id,
        direction: "INBOUND_API",
        endpoint: `/api/v1/partner/tickets/${id}/resolve`,
        action: "POST /resolve",
        requestPayload: { resolutionDetails, defectiveSerial, serviceReportUrl },
        responseStatus: 200,
        responseBody: `Resolved ticket #${ticket.id}`,
        durationMs,
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Ticket #${ticket.id} marked RESOLVED. Awaiting final closure by TicketLink Moderator.`,
      ticket: {
        id: updatedTicket.id,
        ticketRefNo: updatedTicket.ticketRefNo,
        externalTicketRef: updatedTicket.externalTicketRef,
        status: updatedTicket.status,
        subStatus: updatedTicket.subStatus,
        resolvedAt: updatedTicket.resolvedAt,
        serviceReportUrl: updatedTicket.serviceReportUrl,
      },
    });
  } catch (error: any) {
    console.error("POST /api/v1/partner/tickets/[id]/resolve error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
