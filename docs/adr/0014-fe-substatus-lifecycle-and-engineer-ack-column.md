# ADR 0014: FE Operational Lifecycle Sub-Status (FE_ACK, CHECKED_OUT) and Engineer Ack Column Renaming

## Status
Accepted

## Context
1. In the Field Engineer (FE) operational dispatch workflow, tickets transition across pre-service and on-site stages:
   - Initial dispatch (`status: NEW`, `feAcknowledgeStatus: PENDING`).
   - FE acceptance/acknowledgement (`feAcknowledgeStatus: ACKNOWLEDGED`).
   - Travel (`eta` provided, `subStatus: ENROUTE`).
   - Arrival & Check-In (`status: IN_PROGRESS`, `subStatus: CHECKED_IN`).
   - Resolution Check-Out (`status: RESOLVED`).
   - Follow-Up Check-Out (`status: FOLLOW_UP`, with follow-up reason).
2. Previously:
   - When an FE accepted a ticket, `subStatus` was assigned `"ACCEPTED"`. However, operators and dispatchers expect the sub-status in ticket lists to explicitly indicate `"FE Ack"` / `"FE_ACK"` to verify that dispatch acknowledgement has occurred.
   - When an FE checked out and resolved the ticket (`status: RESOLVED`), `subStatus` was left unchanged (lingering as `"CHECKED_IN"`), creating ambiguity regarding whether the technician was still physically on site.
   - The ticket queue column was named `"FE Ack"`, creating confusion alongside the Sub-Status column.

## Decision
1. **Explicit Operational Sub-Statuses**:
   - **FE Acceptance**: Standardize the sub-status value to `FE_ACK`. When an FE accepts a job via the mobile dashboard, `subStatus` is set to `FE_ACK` (while supporting legacy `ACCEPTED` transparently as alias).
   - **Resolution Check-Out**: When an FE completes work and checks out (`updateTicketResolution`), `subStatus` is set to `CHECKED_OUT`. This pairs symmetrically with `CHECKED_IN`.
   - **Follow-Up Check-Out**: Remains granular (e.g. `PENDING_PARTS`, `WAITING_ACCESS`, `SECOND_VISIT`) under `status: FOLLOW_UP`.
2. **Column Renaming in Ticket Queue**:
   - Rename the column header from `FE Ack` to **`Engineer Ack`** (`label: "Engineer Ack"`).
   - The `Engineer Ack` column continues to display the technician's response state (`✓ Ack`, `⏳ Pending`, `✕ Declined`).
   - The `Sub-Status` column displays the full operational progression (`FE Ack`, `Enroute`, `Checked In`, `Checked Out`, `Pending Parts`).
3. **Badge Differentiation**:
   - In the Ticket Queue and Ticket Workspace, render distinct semantic badges for `FE_ACK` (Sky/Indigo), `ENROUTE` (Purple), `CHECKED_IN` (Blue), and `CHECKED_OUT` (Emerald).

## Consequences
- **Positive**: Complete clarity for dispatchers and supervisors on whether an engineer has acknowledged (`FE Ack`), is traveling (`Enroute`), is on site (`Checked In`), or has completed departure (`Checked Out`).
- **Positive**: Eliminates confusion between the acknowledgement status column (`Engineer Ack`) and the physical workflow step (`Sub-Status`).
- **Backward Compatibility**: Any tickets in the database with `subStatus = "ACCEPTED"` are displayed as `FE Ack` and safely migrated to `FE_ACK`.
