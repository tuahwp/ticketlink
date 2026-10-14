# ADR 0015: Partner Webhook Auth Header and Area Coverage API

## Context
TicketLink dispatches tickets to external Service Partners (such as ITS, Apex Support, etc.) who operate their own internal ticketing systems.

Two operational challenges arose during live partner onboarding:
1. **Webhook 401 Unauthorized Error**: When testing the partner webhook endpoint (`sendTestPartnerWebhookAction`), the partner's server returned `HTTP 401 Unauthorized`. TicketLink originally authenticated outbound webhooks exclusively via HMAC-SHA256 signature in the `X-TicketLink-Signature` header. However, enterprise partner endpoints are often hosted behind API Gateways (e.g. Kong, AWS API Gateway, Cloudflare, or framework middleware) requiring an `Authorization: Bearer <token>` header on all incoming requests.
2. **Area & Coverage Querying**: Service partners dispatch field engineers based on geographic clusters and states. Previously, there was no dedicated API for partners to discover which states and sites their contract covers, or to filter tickets by state during pull synchronization.

## Decision
We implemented a two-part architectural enhancement:

1. **Dual-Mode Webhook Authentication**:
   - Added an optional `authHeader` field to `PartnerWebhook`.
   - When configured, TicketLink transmits the partner's required token as `Authorization: Bearer <token>` alongside the HMAC-SHA256 signature in `X-TicketLink-Signature`.
   - Updated `dispatchPartnerWebhook`, `sendTestPartnerWebhookAction`, and `retryPartnerWebhookAction` to include this header.
   - Enhanced the "Integrations" tab UI with a dedicated input field and actionable diagnostics explaining 401 error resolutions.

2. **Area & Coverage Discovery API**:
   - Created `GET /api/v1/partner/areas` for authenticated partner systems to query:
     - Covered Malaysian states with active and total ticket counts.
     - Registered field engineers with designated region coverage.
     - Client branch sites (`name`, `group`, `state`, `address`) linked to their contracts.
   - Added `?state=` / `?area=` query filtering to `GET /api/v1/partner/tickets` so partners can fetch tickets targeted to specific regions.
   - Updated the interactive API documentation and downloadable integration pack.

## Consequences
- **Positive**:
  - Resolves webhook delivery failures (HTTP 401) for partners with token-protected webhook gateways without compromising HMAC security.
  - Allows partner systems to programmatically inspect serviceable regions and filter dispatch queues by state.
  - Full backward compatibility with existing HMAC-only webhook listeners.
- **Operational / Security**:
  - Webhook auth tokens are stored securely in PostgreSQL and editable only by Superadmins and Moderators.
