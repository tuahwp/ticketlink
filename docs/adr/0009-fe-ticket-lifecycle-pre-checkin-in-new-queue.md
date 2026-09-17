# ADR 0009: FE Ticket Lifecycle - Retaining Accepted & Enroute Tickets in NEW Queue until On-Site Check-In

## Status
Accepted

## Context
In the Field Engineer (FE) mobile workflow, tickets undergo several pre-service dispatch phases:
1. **Dispatched / Assigned**: Ticket is newly assigned to an FE (`status: NEW`, `feAcknowledgeStatus: PENDING`).
2. **Accepted**: FE acknowledges and accepts the job (`status: NEW`, `subStatus: ACCEPTED`, `feAcknowledgeStatus: ACKNOWLEDGED`).
3. **Enroute**: FE departs for customer site and provides an estimated time of arrival (`status: NEW`, `subStatus: ENROUTE`, `eta`).
4. **Checked In (WIP)**: FE physically arrives at the customer branch and checks in (`status: IN_PROGRESS`, `subStatus: CHECKED_IN`).

Previously, the FE mobile dashboard placed any ticket with `subStatus === "ACCEPTED"` directly into the **WIP (Work In Progress)** tab. This caused ambiguity because WIP implied that physical repair/troubleshooting was already occurring on-site, whereas the FE was only acknowledging the assignment.

## Decision
1. **Refine FE Queue Categorization**:
   - **NEW Queue Tab**: Holds all tickets where `status === "NEW"`. This includes:
     - `Awaiting Acknowledgment` (`feAcknowledgeStatus === "PENDING"`)
     - `Accepted / Ready to Dispatch` (`subStatus === "ACCEPTED"`)
     - `Enroute` (`subStatus === "ENROUTE"`)
   - **WIP Queue Tab**: Holds only tickets where active physical intervention has commenced on-site (`status === "IN_PROGRESS"` via Check-In, `ON_HOLD`, or `FOLLOW_UP`).
   - **RESOLVED Queue Tab**: Holds tickets with `status === "RESOLVED"`, `"CLOSED"`, or `"COMPLETE"`.

2. **Visual Differentiation in NEW Tab**:
   - Tickets awaiting acceptance show an amber badge: `⚡ Action Needed: Accept`.
   - Accepted tickets show a blue badge: `✓ Accepted - Ready for Check-in`.
   - Enroute tickets show an indigo badge with ETA: `🚗 Enroute (ETA: HH:MM)`.

3. **Progressive Action Flow**:
   - Unacknowledged: `[ Accept Job ]` button.
   - Accepted / Enroute: `[ Set ETA / Enroute ]` and `[ Check In on Site ]` buttons.
   - Checked In (WIP): `[ Resolve / Service Report ]`, `[ Follow Up / Request Parts ]`, and `[ Hold ]` actions.

4. **Consistency Across Admin & Partner Views**:
   - The database state machine remains consistent: `status` remains `"NEW"` during Accept and Enroute phases, and transitions to `"IN_PROGRESS"` when `checkInTicket()` is executed.

## Consequences
- **Positive**: Clear separation between dispatch/transit phases and active on-site work. Field engineers and dispatchers have full visibility into which jobs are accepted versus actively being worked on.
- **Positive**: Clean 3-tab layout on mobile without cluttering the interface with unnecessary additional tabs.
