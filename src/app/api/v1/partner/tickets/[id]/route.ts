import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPartnerApiKey } from "@/lib/partnerAuth";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/partner/tickets/[id]
 * Retrieve details of a specific ticket by TicketLink ID or externalTicketRef.
 */
export async function GET(
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
      include: {
        maincon: {
          select: { id: true, name: true },
        },
        assignedFe: {
          select: { id: true, name: true, phone: true, email: true },
        },
        device: {
          select: { id: true, category: true, brand: true, model: true, isStandard: true },
        },
        site: {
          select: { id: true, name: true, group: true, state: true, address: true },
        },
        activities: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!ticket) {
      return NextResponse.json(
        { success: false, error: "Ticket not found or does not belong to your partner agency." },
        { status: 404 }
      );
    }

    const durationMs = Date.now() - startTime;

    (db as any).partnerSyncLog.create({
      data: {
        partnerId: auth.partnerId,
        ticketId: ticket.id,
        direction: "INBOUND_API",
        endpoint: `/api/v1/partner/tickets/${id}`,
        action: "GET /tickets/:id",
        responseStatus: 200,
        responseBody: `Retrieved ticket #${ticket.id}`,
        durationMs,
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      ticket: {
        id: ticket.id,
        ticketRefNo: ticket.ticketRefNo,
        externalTicketRef: ticket.externalTicketRef,
        subject: ticket.subject,
        issueDescription: ticket.issueDescription,
        status: ticket.status,
        subStatus: ticket.subStatus,
        severity: ticket.severity,
        slaDeadline: ticket.slaDeadline,
        slaPaused: ticket.slaPaused,
        slaPausedAt: ticket.slaPausedAt,
        eta: ticket.eta,
        feAcknowledgeStatus: ticket.feAcknowledgeStatus,
        feAcknowledgedAt: ticket.feAcknowledgedAt,
        clientSiteName: ticket.clientSiteName,
        state: ticket.state,
        address: ticket.address || ticket.site?.address || null,
        endCustomer: ticket.endCustomer,
        representAs: ticket.representAs,
        onSiteSop: ticket.onSiteSop,
        reportedAt: ticket.reportedAt,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        resolvedAt: ticket.resolvedAt,
        resolutionDetails: ticket.resolutionDetails,
        defectiveSerial: ticket.defectiveSerial,
        serviceReportUrl: ticket.serviceReportUrl,
        referenceAttachments: ticket.referenceAttachments,
        maincon: ticket.maincon,
        assignedEngineer: ticket.assignedFe,
        device: ticket.device,
        customValues: ticket.customValues,
        recentActivities: ticket.activities,
      },
    });
  } catch (error: any) {
    console.error("GET /api/v1/partner/tickets/[id] error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
