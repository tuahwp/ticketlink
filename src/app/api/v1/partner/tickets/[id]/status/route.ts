import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPartnerApiKey, dispatchPartnerWebhook } from "@/lib/partnerAuth";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/v1/partner/tickets/[id]/status
 * Update the ticket status and subStatus (e.g., Dispatched, Enroute, Checked-in, On-site, On-hold).
 */
export async function PATCH(
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

    const body = await req.json();
    const { status, subStatus, notes, holdReason } = body;

    // Normalization mapping from partner terms to TicketLink terms:
    // Partner might send "Arrived" / "Onsite" / "Checked In" -> map to status: "IN_PROGRESS", subStatus: "CHECKED_IN"
    // Partner might send "Dispatched" / "Enroute" -> map to subStatus: "ENROUTE"
    let mappedStatus = ticket.status;
    let mappedSubStatus = ticket.subStatus;

    if (status) {
      const upperStatus = status.toUpperCase().trim();
      if (["NEW", "IN_PROGRESS", "ON_HOLD", "FOLLOW_UP", "RESOLVED"].includes(upperStatus)) {
        mappedStatus = upperStatus as any;
      } else if (upperStatus === "DISPATCHED") {
        mappedStatus = "NEW" as any;
      } else if (["ARRIVED", "ONSITE", "IN PROGRESS"].includes(upperStatus)) {
        mappedStatus = "IN_PROGRESS" as any;
        mappedSubStatus = "CHECKED_IN";
      } else if (["PENDING", "ON HOLD"].includes(upperStatus)) {
        mappedStatus = "ON_HOLD" as any;
      }
    }

    if (subStatus) {
      const upperSub = subStatus.toUpperCase().trim();
      if (["CHECKED_IN", "ARRIVED", "ONSITE"].includes(upperSub)) {
        mappedSubStatus = "CHECKED_IN";
        mappedStatus = "IN_PROGRESS" as any;
      } else if (["ENROUTE", "TRAVELLING"].includes(upperSub)) {
        mappedSubStatus = "ENROUTE";
      } else if (["PENDING_PARTS", "PARTS"].includes(upperSub)) {
        mappedSubStatus = "PENDING_PARTS";
        mappedStatus = "ON_HOLD" as any;
      } else {
        mappedSubStatus = upperSub;
      }
    }

    const updateData: any = {
      status: mappedStatus,
      subStatus: mappedSubStatus,
    };

    if (mappedSubStatus === "CHECKED_IN" && !ticket.feAcknowledgedAt) {
      updateData.feAcknowledgeStatus = "ACKNOWLEDGED";
      updateData.feAcknowledgedAt = new Date();
    }

    if (mappedStatus === "ON_HOLD") {
      updateData.holdReason = holdReason || notes || "Pending further action";
    }

    const updatedTicket = await db.ticket.update({
      where: { id: ticket.id },
      data: updateData,
    });

    // Record activity
    const activityNote = notes || `Status updated to ${mappedStatus}${mappedSubStatus ? ` (${mappedSubStatus})` : ""} via Partner API.`;

    await db.ticketActivity.create({
      data: {
        ticketId: ticket.id,
        type: "STATUS_CHANGE",
        status: mappedStatus,
        subStatus: mappedSubStatus,
        notes: activityNote,
        author: `${auth.partnerName} (API)`,
      },
    });

    dispatchPartnerWebhook(auth.partnerId, "ticket.status_changed", ticket.id, {
      ticketId: ticket.id,
      ticketRefNo: ticket.ticketRefNo,
      externalTicketRef: updatedTicket.externalTicketRef,
      previousStatus: ticket.status,
      newStatus: mappedStatus,
      subStatus: mappedSubStatus,
      notes,
    }).catch(() => {});

    const durationMs = Date.now() - startTime;

    (db as any).partnerSyncLog.create({
      data: {
        partnerId: auth.partnerId,
        ticketId: ticket.id,
        direction: "INBOUND_API",
        endpoint: `/api/v1/partner/tickets/${id}/status`,
        action: "PATCH /status",
        requestPayload: body,
        responseStatus: 200,
        responseBody: `Status updated to ${mappedStatus} / ${mappedSubStatus}`,
        durationMs,
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Status updated successfully for ticket #${ticket.id}`,
      ticket: {
        id: updatedTicket.id,
        ticketRefNo: updatedTicket.ticketRefNo,
        externalTicketRef: updatedTicket.externalTicketRef,
        status: updatedTicket.status,
        subStatus: updatedTicket.subStatus,
        holdReason: updatedTicket.holdReason,
      },
    });
  } catch (error: any) {
    console.error("PATCH /api/v1/partner/tickets/[id]/status error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
