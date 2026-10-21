import { db } from "./db";

export const FORBIDDEN_TICKET_MESSAGE = "Forbidden: Ticket not found or access denied";

/**
 * Asserts that the caller session has permission to read or modify a ticket.
 * Returns the loaded ticket object on success.
 * Throws identical generic error on not found or forbidden to prevent ticket ID enumeration.
 * Located in src/lib/ticketAccess.ts (non-use-server) so it cannot be invoked as a client-callable server action.
 */
export async function assertTicketAccess(session: any, ticketId: number) {
  if (!session) {
    throw new Error(FORBIDDEN_TICKET_MESSAGE);
  }

  const tid = Number(ticketId);
  if (isNaN(tid) || tid <= 0) {
    throw new Error(FORBIDDEN_TICKET_MESSAGE);
  }

  const ticket = await db.ticket.findUnique({
    where: { id: tid },
    include: { assignedFe: true },
  });

  if (!ticket) {
    throw new Error(FORBIDDEN_TICKET_MESSAGE);
  }

  if (session.role === "SUPERADMIN") {
    return ticket;
  }

  if (session.role === "MODERATOR") {
    // HQ Moderator has full access
    if (!session.partnerId) {
      return ticket;
    }
    // Partner-level Moderator only has access to own partner tickets
    if (ticket.partnerId && ticket.partnerId === session.partnerId) {
      return ticket;
    }
    throw new Error(FORBIDDEN_TICKET_MESSAGE);
  }

  if (session.role === "FIELD_ENGINEER") {
    if (session.engineerId && ticket.assignedFeId === session.engineerId) {
      return ticket;
    }
    throw new Error(FORBIDDEN_TICKET_MESSAGE);
  }

  if (session.role === "AGENT") {
    if (session.partnerId && ticket.partnerId === session.partnerId) {
      return ticket;
    }
    throw new Error(FORBIDDEN_TICKET_MESSAGE);
  }

  throw new Error(FORBIDDEN_TICKET_MESSAGE);
}
