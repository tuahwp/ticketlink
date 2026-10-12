# ADR 0012: Partner System-to-System API and Webhook Synchronization

## Context
TicketLink dispatches tickets to external Service Partners (such as ITS, Apex Tech, etc.) who operate their own internal IT ticketing systems. Rather than being restricted to a single agency (e.g. JPJ), this system-to-system bridge is designed as a universal, multi-client integration covering all Main Contractors (e.g. TM, HeiTech, Maybank, Brocent) and all End-Customer agencies (JPJ, RELA, KWSP, Bank Retail, etc.).

The integration fulfills the following core needs:
1. Automatically receive dispatched tickets across all client contracts into the partner's internal ticketing system.
2. Manage and assign partner field engineers within their internal system.
3. Synchronize status updates, arrival ETAs, on-site check-in, remarks, evidence photos, and signed service reports back to TicketLink without duplicate manual data entry.

## Decision
We establish a hybrid synchronization architecture, partner isolation security model, and dedicated dashboard management interface:

1. **Hybrid Synchronization Architecture**:
   - **Outbound Webhooks**: TicketLink dispatches real-time HTTPS webhooks to the partner's configured endpoint on lifecycle events (`ticket.dispatched`, `ticket.status_changed`, `ticket.resolved`, `ticket.closed`, `ticket.cancelled`).
   - **Inbound REST API**: Scoped REST endpoints allow the partner system to pull tickets (`GET /api/v1/tickets`) for reconciliation and push status updates (`PATCH /api/v1/tickets/:id/status`, `PATCH /api/v1/tickets/:id/assign`, `PATCH /api/v1/tickets/:id/eta`, `POST /api/v1/tickets/:id/evidence`, `POST /api/v1/tickets/:id/resolve`).

2. **Source of Truth Division**:
   - **Ticket Creation & Dispatch**: TicketLink HQ is authoritative.
   - **Engineer Assignment, ETA & On-Site Arrival (`CHECKED_IN`)**: Partner ITS system is authoritative; pushes to TicketLink.
   - **SLA Calculation**: TicketLink is authoritative and read-only to partner.
   - **Final Ticket Closure (`CLOSED`)**: TicketLink Moderator/Superadmin retains final authority upon reviewing the uploaded signed service report.

3. **Field Engineer Identity Mapping**:
   - Inbound assignments from the partner match or dynamically upsert the field engineer in TicketLink under that partner's `ServicePartner` tenant.

4. **Authentication & Tenant Isolation**:
   - **Inbound**: Partner API Keys with Bearer token (`tl_live_...` / `tl_test_...`) tied strictly to the partner's `ServicePartner.id`. Partner requests cannot read or update tickets outside their agency.
   - **Outbound**: Webhook payloads signed with HMAC-SHA256 in the `X-TicketLink-Signature` header using a shared secret.

5. **"Integrations" Tab in TicketLink Dashboard**:
   - A dedicated tab accessible by Superadmins/Moderators to generate/revoke partner API keys, configure webhook endpoints and secret tokens, inspect event delivery logs with payloads and latency, and view interactive API documentation.

## Consequences
- **Positive**:
  - Eliminates duplicate manual ticket updates between TicketLink and partner dispatchers.
  - Zero-latency dispatch notifications via webhooks combined with fallback resilience via REST pull.
  - Granular security isolation ensuring partner systems cannot view tickets belonging to other contractors.
- **Negative / Operational Needs**:
  - Requires persistent logging for webhook delivery attempts, retries, and failure alerts.
