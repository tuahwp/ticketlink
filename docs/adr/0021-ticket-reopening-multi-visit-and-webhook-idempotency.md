# ADR 0021: Ticket Reopening Lifecycle, Multi-Visit History Preservation, and Webhook Idempotency

## Status
Accepted

## Context
Partner ITS integrated with TicketLink and submitted operational inquiries regarding post-resolution lifecycle workflows and webhook event guarantees:
1. When a ticket marked `RESOLVED` requires further action (e.g., recurrence, QA rejection, or customer callback), whether TicketLink moves the ticket back to `FOLLOW_UP` or `IN_PROGRESS` on the exact same ticket ID or generates a new ticket number.
2. The exact webhook payload schema (`previousStatus`, `newStatus`, `subStatus`) dispatched upon ticket reopening.
3. Whether ITS can submit subsequent `IN_PROGRESS` / `CHECKED_IN` updates and subsequent `POST /resolve` calls referencing the same ticket ID.
4. How previous visit details (resolution notes and signed Service Report PDFs) are preserved when a secondary visit is conducted.
5. Whether partner-originated API actions trigger echo webhooks back to the partner, creating circular sync loops.
6. Whether idempotency keys, delivery IDs, and versioning exist to guard against duplicate and out-of-order webhook delivery.

## Decisions

### 1. Unified Ticket Lifecycle Without ID Fragmentation
- When a `RESOLVED` ticket is reopened (via TicketLink UI or Partner API `PATCH /status`), TicketLink updates the status on the **exact same ticket ID** (`ticket.id` and `ticket.ticketRefNo`). No duplicate or secondary ticket records are created.
- On reopening:
  - Event name: `ticket.status_changed` (canonical). For partner subscription filters, `ticket.status_updated` is also accepted interchangeably as an alias.
  - `previousStatus`: `"RESOLVED"`
  - `newStatus`: `"FOLLOW_UP"` (or `"IN_PROGRESS"`)
  - `subStatus`: Selected operational sub-status (e.g. `"SECOND_VISIT"`, `"PENDING_PARTS"`, or `null`).

### 2. Multi-Visit Execution & Chronological Preservation
- ITS can execute repeated operational cycles on the same ticket ID (`PATCH /status` with `CHECKED_IN`, followed by `POST /resolve`).
- **Data Preservation Architecture**:
  - Top-level `Ticket.resolutionDetails`, `Ticket.serviceReportUrl`, and `Ticket.resolvedAt` are updated to reflect the latest/most recent visit for immediate dashboard and client portal display.
  - **Zero Data Loss**: Every historical resolution, previous signed service report, status change, and engineer note is permanently preserved as an immutable entry in `TicketActivity` (with `type: "STATUS_CHANGE"`, attachment URL, and full timestamped notes).

### 3. Partner Webhook Echo Suppression
- To prevent circular event loops, outbound webhooks are **suppressed** for API calls initiated by the same partner (`excludePartnerId: auth.partnerId`).
- Webhooks continue to be dispatched when actions are performed by TicketLink internal staff, Field Engineers, or background automations (`source: "TICKETLINK_UI"` or `"SYSTEM"`).

### 4. Webhook Idempotency & Delivery Guarantees
- Every outbound webhook dispatch now includes:
  - `eventId`: Unique UUIDv4 in the JSON payload body.
  - `X-TicketLink-Delivery-ID`: HTTP Header carrying the same UUIDv4.
  - `source`: Attribution string (`"TICKETLINK_UI"`, `"PARTNER_API"`, or `"SYSTEM"`).
  - `timestamp`: ISO-8601 millisecond timestamp.
  - `X-TicketLink-Signature`: `sha256=...` HMAC-SHA256 signature calculated over the raw payload string.
- Partners can safely deduplicate retried deliveries using `eventId` / `X-TicketLink-Delivery-ID` and sequence events using `timestamp`.

## Consequences
- **Positive**: Clean system boundary with partner ITS; eliminates infinite event echo loops; guarantees full audit history across multiple site visits on a single ticket reference.
- **Negative / Operational Requirement**: Consuming partners must record `X-TicketLink-Delivery-ID` in their ingestion cache to leverage the idempotency guarantee.
