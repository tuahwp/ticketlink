export interface FeCategorizableTicket {
  id: number;
  status: string;
  subStatus?: string | null;
  feAcknowledgeStatus?: string | null;
}

export type FeTicketBucket = "NEW" | "WIP" | "RESOLVED" | "OTHER";

/**
 * Determines which queue bucket a ticket belongs to in the Field Engineer portal.
 *
 * Rules (per ADR 0026, superseding ADR 0009):
 * 1. RESOLVED: status is RESOLVED, CLOSED, or COMPLETE.
 * 2. OTHER: status is CANCELLED.
 * 3. WIP (Work In Progress):
 *    - Ticket has been accepted by FE (feAcknowledgeStatus === "ACKNOWLEDGED", subStatus === "FE_ACK" or "ACCEPTED")
 *    - OR ticket is Enroute (subStatus === "ENROUTE")
 *    - OR ticket is On-Site / In Progress (status === "IN_PROGRESS" or subStatus === "CHECKED_IN")
 *    - OR ticket is On Hold / Follow Up (status === "ON_HOLD" or status === "FOLLOW_UP")
 * 4. NEW:
 *    - Newly dispatched tickets where status === "NEW" and the FE has NOT yet accepted/acknowledged.
 */
export function getFeTicketBucket(ticket: FeCategorizableTicket): FeTicketBucket {
  const stat = ticket.status?.toUpperCase();
  const sub = ticket.subStatus?.toUpperCase();
  const ack = ticket.feAcknowledgeStatus?.toUpperCase();

  // 1. Resolved / Closed / Complete
  if (stat === "RESOLVED" || stat === "CLOSED" || stat === "COMPLETE") {
    return "RESOLVED";
  }

  // 2. Cancelled
  if (stat === "CANCELLED") {
    return "OTHER";
  }

  // 3. Work In Progress (WIP):
  // Commences immediately upon FE job acceptance (FE_ACK/ACCEPTED), enroute, check-in, in-progress, or on-hold/follow-up
  const isAccepted = ack === "ACKNOWLEDGED" || sub === "FE_ACK" || sub === "ACCEPTED";
  const isEnroute = sub === "ENROUTE";
  const isOnSiteOrInProgress = stat === "IN_PROGRESS" || sub === "CHECKED_IN";
  const isOnHoldOrFollowUp = stat === "ON_HOLD" || stat === "FOLLOW_UP";

  if (isAccepted || isEnroute || isOnSiteOrInProgress || isOnHoldOrFollowUp) {
    return "WIP";
  }

  // 4. Truly NEW: Unacknowledged dispatched service orders awaiting engineer acceptance
  return "NEW";
}

export function isFeNewTicket(ticket: FeCategorizableTicket): boolean {
  return getFeTicketBucket(ticket) === "NEW";
}

export function isFeWipTicket(ticket: FeCategorizableTicket): boolean {
  return getFeTicketBucket(ticket) === "WIP";
}

export function isFeResolvedTicket(ticket: FeCategorizableTicket): boolean {
  return getFeTicketBucket(ticket) === "RESOLVED";
}

/**
 * Categorizes a list of tickets into mutually exclusive FE queue buckets.
 */
export function categorizeFeTickets<T extends FeCategorizableTicket>(tickets: T[]) {
  const newTickets: T[] = [];
  const wipTickets: T[] = [];
  const resolvedTickets: T[] = [];

  for (const t of tickets) {
    const bucket = getFeTicketBucket(t);
    if (bucket === "NEW") {
      newTickets.push(t);
    } else if (bucket === "WIP") {
      wipTickets.push(t);
    } else if (bucket === "RESOLVED") {
      resolvedTickets.push(t);
    }
  }

  // Active jobs for agenda / schedule: all NEW and WIP tickets deduplicated
  const activeJobsMap = new Map<number, T>();
  [...newTickets, ...wipTickets].forEach((t) => activeJobsMap.set(t.id, t));
  const activeJobs = Array.from(activeJobsMap.values());

  return {
    newTickets,
    wipTickets,
    resolvedTickets,
    activeJobs,
  };
}
