# ADR 0020: Partner Operational Status Webhook Synchronization & Field Engineer Acceptance (FE_ACK) Contract

## Status
Accepted

## Context
External partner IT Service (ITS) systems integrate with TicketLink via a system-to-system bridge defined in ADR 0012 and ADR 0014. During integration testing, partner ITS reported two critical synchronization discrepancies:

1. **Missing Outbound Webhooks on TicketLink UI Status Transitions**:
   - TicketLink only dispatched webhooks on initial ticket creation (`ticket.dispatched`) and inbound partner API calls.
   - When operators, supervisors, or field technicians changed a ticket status within TicketLink (e.g. transitioning to `FOLLOW_UP`, `IN_PROGRESS`, `ON_HOLD`, `RESOLVED`, or `CLOSED`), **zero webhooks were dispatched**.
   - As an observed consequence, test ticket `TEST02` (ID 1709) transitioned to `Follow Up` in TicketLink, but remained permanently stuck as `Assigned` in Partner ITS.
2. **Ambiguity Regarding Field Engineer Acceptance (`FE_ACK`)**:
   - Partner ITS requested exact specification on how their system should notify TicketLink that a field engineer has acknowledged and accepted a dispatched job.
   - Clarification was required on whether `FE_ACK` should leave the ticket's primary status as `NEW` to prevent premature on-site SLA countdown activation prior to physical arrival.

## Decision

1. **Universal Real-Time Webhook Dispatch from TicketLink UI & Internal Actions**:
   - Updated `updateTicketStatus` and `updateTicketResolution` in `src/app/actions.ts` to automatically call `dispatchPartnerWebhook` whenever a ticket assigned to a partner agency transitions status:
     - **`ticket.status_changed`**: Fired on all status updates (`IN_PROGRESS`, `FOLLOW_UP`, `ON_HOLD`, `RESOLVED`, `CLOSED`, `CANCELLED`).
       Payload includes: `ticketId`, `ticketRefNo`, `externalTicketRef`, `previousStatus`, `newStatus`, `subStatus`, `holdReason`, `notes`.
     - **`ticket.resolved`**: Fired when a ticket is resolved or completed.
       Payload includes: `ticketId`, `ticketRefNo`, `externalTicketRef`, `status`, `subStatus`, `resolvedAt`, `resolutionNotes`, `serviceReportUrl`, `defectiveSerial`, `defectiveReturnStatus`.

2. **Field Engineer Acceptance (`FE_ACK`) Contract**:
   - **HTTP Endpoint**: `PATCH /api/v1/partner/tickets/:id/status`
   - **Payload**:
     ```json
     {
       "status": "NEW",
       "subStatus": "FE_ACK",
       "notes": "Field engineer accepted assignment in ITS."
     }
     ```
   - **Primary Status Rule**: `status` **MUST remain `NEW`** upon acceptance. The primary status only transitions to `IN_PROGRESS` when the technician arrives on-site and checks in (`status: "IN_PROGRESS", subStatus: "CHECKED_IN"`). This prevents premature on-site SLA countdown triggering.
   - **Automatic Acknowledgement Stamping**: Sending `subStatus: "FE_ACK"` automatically stamps `feAcknowledgeStatus = "ACKNOWLEDGED"` and `feAcknowledgedAt = new Date()`.
   - **Dual-Support Assignment Shortcut**: Calling `PATCH /api/v1/partner/tickets/:id/assign` while a ticket is `NEW` automatically advances `subStatus` to `FE_ACK`, eliminating the need for two separate API calls if the partner assigns and acknowledges in one step.

3. **In-App Interactive Documentation Update**:
   - Updated the **Integrations** tab in the TicketLink dashboard (`src/app/components/IntegrationsTab.tsx`) with explicit code examples and payload schemas for `ticket.status_changed`, `ticket.resolved`, and `FE_ACK`.

## Consequences

- **Positive**:
  - Full bidirectional parity: changes made in TicketLink UI immediately reflect in Partner ITS via webhooks with zero polling delay.
  - Fixes the desynchronization observed on `TEST02` (ID 1709) and prevents tickets from being orphaned in external ITS systems.
  - Provides Partner ITS with an unambiguous API contract for pre-arrival acceptance without compromising on-site SLA tracking integrity.
