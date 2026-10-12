import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPartnerApiKey, dispatchPartnerWebhook } from "@/lib/partnerAuth";
import { saveFileToCloud } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/partner/tickets/[id]/evidence
 * Upload photos, completion evidence, service slips, and reports.
 * Supports multipart/form-data (binary upload) and application/json (remote file URL).
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
    let fileUrl = "";
    let fileName = "";
    let fileType = "";
    let fileSize = 0;
    let tag = "EVIDENCE"; // "PHOTO", "SERVICE_REPORT", "EVIDENCE", "COMPLETION"
    let notes = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      tag = (formData.get("tag") as string) || "EVIDENCE";
      notes = (formData.get("notes") as string) || "";

      if (!file) {
        return NextResponse.json(
          { success: false, error: "No file found in multipart form-data. Key must be 'file'." },
          { status: 400 }
        );
      }

      // 25MB file size limit check
      if (file.size > 25 * 1024 * 1024) {
        return NextResponse.json(
          { success: false, error: "File exceeds maximum size limit of 25MB." },
          { status: 400 }
        );
      }

      fileUrl = await saveFileToCloud(file);
      fileName = file.name;
      fileType = file.type;
      fileSize = file.size;
    } else {
      const jsonBody = await req.json();
      fileUrl = jsonBody.fileUrl;
      fileName = jsonBody.fileName || "Partner-Attachment";
      fileType = jsonBody.fileType || "application/octet-stream";
      fileSize = jsonBody.fileSize || 0;
      tag = jsonBody.tag || "EVIDENCE";
      notes = jsonBody.notes || "";

      if (!fileUrl) {
        return NextResponse.json(
          { success: false, error: "Missing 'fileUrl' in JSON payload." },
          { status: 400 }
        );
      }
    }

    // Prepare attachment object
    const newAttachment = {
      id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: fileName,
      url: fileUrl,
      type: fileType,
      size: fileSize,
      tag: tag.toUpperCase(),
      notes: notes || null,
      uploadedAt: new Date().toISOString(),
      uploadedBy: `${auth.partnerName} (API)`,
    };

    // Existing attachments
    const existingAttachments: any[] = Array.isArray(ticket.referenceAttachments)
      ? (ticket.referenceAttachments as any[])
      : [];

    const updatedAttachments = [...existingAttachments, newAttachment];

    // If tag is SERVICE_REPORT, also set ticket.serviceReportUrl
    const updateData: any = {
      referenceAttachments: updatedAttachments,
    };

    if (tag.toUpperCase() === "SERVICE_REPORT" || tag.toUpperCase() === "SERVICE_FORM") {
      updateData.serviceReportUrl = fileUrl;
      updateData.serviceReportSignedAt = new Date();
    }

    const updatedTicket = await db.ticket.update({
      where: { id: ticket.id },
      data: updateData,
    });

    // Record activity
    await db.ticketActivity.create({
      data: {
        ticketId: ticket.id,
        type: "REPORT_UPLOAD",
        status: updatedTicket.status,
        subStatus: updatedTicket.subStatus,
        notes: `Uploaded evidence/document: "${fileName}" [Tag: ${tag}]. ${notes}`,
        attachmentUrl: fileUrl,
        author: `${auth.partnerName} (API)`,
      },
    });

    dispatchPartnerWebhook(auth.partnerId, "ticket.evidence_uploaded", ticket.id, {
      ticketId: ticket.id,
      ticketRefNo: ticket.ticketRefNo,
      externalTicketRef: updatedTicket.externalTicketRef,
      attachment: newAttachment,
    }).catch(() => {});

    const durationMs = Date.now() - startTime;

    (db as any).partnerSyncLog.create({
      data: {
        partnerId: auth.partnerId,
        ticketId: ticket.id,
        direction: "INBOUND_API",
        endpoint: `/api/v1/partner/tickets/${id}/evidence`,
        action: "POST /evidence",
        requestPayload: { fileName, tag, notes, fileUrl },
        responseStatus: 200,
        responseBody: `Attached file ${fileName}`,
        durationMs,
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: "Evidence successfully uploaded and linked to ticket.",
      attachment: newAttachment,
      ticket: {
        id: updatedTicket.id,
        ticketRefNo: updatedTicket.ticketRefNo,
        serviceReportUrl: updatedTicket.serviceReportUrl,
        attachmentsCount: updatedAttachments.length,
      },
    });
  } catch (error: any) {
    console.error("POST /api/v1/partner/tickets/[id]/evidence error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
