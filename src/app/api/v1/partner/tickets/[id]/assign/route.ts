import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPartnerApiKey, dispatchPartnerWebhook } from "@/lib/partnerAuth";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/v1/partner/tickets/[id]/assign
 * Assign an internal field engineer to the ticket and optionally save external ticket ID.
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
    const { engineerName, engineerPhone, engineerEmail, externalTicketRef, notes } = body;

    if (!engineerName || !engineerPhone) {
      return NextResponse.json(
        { success: false, error: "Both engineerName and engineerPhone are required." },
        { status: 400 }
      );
    }

    // Match existing engineer under this partner or create a new one
    let fe = await db.fieldEngineer.findFirst({
      where: {
        partnerId: auth.partnerId,
        OR: [
          { phone: engineerPhone.trim() },
          ...(engineerEmail ? [{ email: engineerEmail.trim() }] : []),
          { name: engineerName.trim() },
        ],
      },
    });

    if (!fe) {
      fe = await db.fieldEngineer.create({
        data: {
          name: engineerName.trim(),
          phone: engineerPhone.trim(),
          email: engineerEmail ? engineerEmail.trim() : null,
          partnerId: auth.partnerId,
        },
      });
    }

    // Update ticket
    const updateData: any = {
      assignedFeId: fe.id,
      feAcknowledgeStatus: "ACKNOWLEDGED",
      feAcknowledgedAt: ticket.feAcknowledgedAt || new Date(),
      ...(externalTicketRef ? { externalTicketRef: externalTicketRef.trim() } : {}),
    };

    // If ticket is still NEW and hasn't started travel/on-site, auto-set subStatus to FE_ACK
    if (ticket.status === "NEW" && (!ticket.subStatus || ticket.subStatus === "ACCEPTED")) {
      updateData.subStatus = "FE_ACK";
    }

    const updatedTicket = await db.ticket.update({
      where: { id: ticket.id },
      data: updateData,
      include: {
        assignedFe: true,
      },
    });

    // Record activity
    const activityNote = notes
      ? `Assigned to ${fe.name} (${fe.phone}) via Partner API. Note: ${notes}`
      : `Assigned to ${fe.name} (${fe.phone}) via Partner API.`;

    await db.ticketActivity.create({
      data: {
        ticketId: ticket.id,
        type: "ASSIGNMENT",
        status: updatedTicket.status,
        subStatus: updatedTicket.subStatus,
        notes: activityNote,
        author: `${auth.partnerName} (API)`,
      },
    });

    // Fire webhook notification
    dispatchPartnerWebhook(auth.partnerId, "ticket.assigned", ticket.id, {
      ticketId: ticket.id,
      ticketRefNo: ticket.ticketRefNo,
      externalTicketRef: updatedTicket.externalTicketRef,
      assignedEngineer: {
        id: fe.id,
        name: fe.name,
        phone: fe.phone,
        email: fe.email,
      },
    }, {
      excludePartnerId: auth.partnerId,
      source: "PARTNER_API",
    }).catch(() => {});

    const durationMs = Date.now() - startTime;

    (db as any).partnerSyncLog.create({
      data: {
        partnerId: auth.partnerId,
        ticketId: ticket.id,
        direction: "INBOUND_API",
        endpoint: `/api/v1/partner/tickets/${id}/assign`,
        action: "PATCH /assign",
        requestPayload: body,
        responseStatus: 200,
        responseBody: `Assigned engineer #${fe.id} (${fe.name})`,
        durationMs,
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Engineer successfully assigned to ticket #${ticket.id}`,
      ticket: {
        id: updatedTicket.id,
        ticketRefNo: updatedTicket.ticketRefNo,
        externalTicketRef: updatedTicket.externalTicketRef,
        status: updatedTicket.status,
        feAcknowledgeStatus: updatedTicket.feAcknowledgeStatus,
        assignedEngineer: {
          id: fe.id,
          name: fe.name,
          phone: fe.phone,
          email: fe.email,
        },
      },
    });
  } catch (error: any) {
    console.error("PATCH /api/v1/partner/tickets/[id]/assign error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
