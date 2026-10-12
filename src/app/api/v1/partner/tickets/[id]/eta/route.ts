import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPartnerApiKey, dispatchPartnerWebhook } from "@/lib/partnerAuth";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/v1/partner/tickets/[id]/eta
 * Update the engineer's arrival ETA.
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
    const { eta, notes } = body;

    if (!eta) {
      return NextResponse.json(
        { success: false, error: "ETA timestamp is required (ISO 8601 format)." },
        { status: 400 }
      );
    }

    const parsedEta = new Date(eta);
    if (isNaN(parsedEta.getTime())) {
      return NextResponse.json(
        { success: false, error: "Invalid date format for ETA." },
        { status: 400 }
      );
    }

    const updatedTicket = await db.ticket.update({
      where: { id: ticket.id },
      data: {
        eta: parsedEta,
      },
    });

    // Record activity
    const activityNote = notes
      ? `Arrival ETA set to ${parsedEta.toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" })} via Partner API. Note: ${notes}`
      : `Arrival ETA set to ${parsedEta.toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" })} via Partner API.`;

    await db.ticketActivity.create({
      data: {
        ticketId: ticket.id,
        type: "ETA_UPDATE",
        status: updatedTicket.status,
        subStatus: updatedTicket.subStatus,
        notes: activityNote,
        author: `${auth.partnerName} (API)`,
      },
    });

    dispatchPartnerWebhook(auth.partnerId, "ticket.eta_updated", ticket.id, {
      ticketId: ticket.id,
      ticketRefNo: ticket.ticketRefNo,
      externalTicketRef: updatedTicket.externalTicketRef,
      eta: updatedTicket.eta,
      notes,
    }).catch(() => {});

    const durationMs = Date.now() - startTime;

    (db as any).partnerSyncLog.create({
      data: {
        partnerId: auth.partnerId,
        ticketId: ticket.id,
        direction: "INBOUND_API",
        endpoint: `/api/v1/partner/tickets/${id}/eta`,
        action: "PATCH /eta",
        requestPayload: body,
        responseStatus: 200,
        responseBody: `Updated ETA to ${parsedEta.toISOString()}`,
        durationMs,
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Arrival ETA updated for ticket #${ticket.id}`,
      ticket: {
        id: updatedTicket.id,
        ticketRefNo: updatedTicket.ticketRefNo,
        externalTicketRef: updatedTicket.externalTicketRef,
        eta: updatedTicket.eta,
      },
    });
  } catch (error: any) {
    console.error("PATCH /api/v1/partner/tickets/[id]/eta error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
