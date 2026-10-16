# Domain Context & Glossary: Inventory & Spare Parts Hub

## Core Concepts

### 1. Warehouses & Dual-Tier Storage (`Warehouse`)
Physical storage facilities where spare parts and hardware are held.
- **Central HQ Warehouse (`partnerId: null`)**: Managed and owned by central operations/main contractor. Acts as the primary procurement and replenishment hub.
- **Partner Local Warehouse (`partnerId: <id>`)**: Local buffer warehouse located at a Service Partner's agency office or regional depot. Holds both consigned HQ buffer stock and partner-owned stock.

### 2. Stock Ownership Types (`StockOwnership`)
Explicit financial and legal ownership attribution for physical hardware items:
- **`HQ_CONSIGNED`**: Procured and owned by HQ/Maincon, stored at Central or transferred to Partner warehouses as consignment buffer stock.
- **`PARTNER_OWNED`**: Procured or registered directly by the Service Partner agency for use by their field engineering team.

### 3. Inventory Item (`InventoryItem`)
A physical asset or component stocked in a warehouse.
- **Serialized**: Unique item identified by a specific `serialNumber` (e.g., Motherboard, Router, Switch, POS Terminal).
- **Bulk**: Quantity-tracked consumable item without unique serials (e.g., Patch cords, Power cables, RAM sticks).
- **Loaner Unit**: An inventory item provided on a temporary standby basis that must be returned once the primary unit is serviced.

### 4. Inter-Warehouse Stock Transfer (`WarehouseTransfer`)
Movement of inventory items from Central HQ Warehouses to Partner Warehouses (or vice-versa) to maintain healthy local buffer levels without direct ticket consumption.

### 5. Spare Part Request & Allocation (`TicketSparePart`)
A request for physical components needed to resolve a specific `Ticket`.
- **Single or Multi-Part**: Multiple spare part items can be requested and allocated to a single ticket.
- **Dual-Path Allocation**:
  - **HQ Dispatch Path**: Central warehouse allocates and dispatches via courier (PosLaju, GDEX, J&T, etc.) to the site or FE.
  - **Partner Buffer Path**: Allocated directly from the assigned Partner's local warehouse buffer for immediate on-site deployment.
- **Batch Dispatch Consignment**: A grouped shipment of one or more allocated parts dispatched under a shared consignment/tracking number.

### 6. Part Replacement & Cost Claim (`PartReplacementClaim`)
When a partner agency deploys their own local stock (`PARTNER_OWNED`) or consumes consigned buffer to resolve a client ticket, a claim is generated to close the loop:
- **`PENDING`**: Claim submitted with replaced defective serial number and site visit slip.
- **`APPROVED_REPLENISH`**: HQ approves claim and transfers a replacement unit from Central Warehouse to replenish the Partner's Warehouse.
- **`APPROVED_REIMBURSE`**: HQ approves monetary reimbursement for the partner.
- **`REJECTED`**: Claim declined with an audit note.

### 7. Request Lifecycle & States (`SparePartRequestStatus`)
- `PENDING_APPROVAL`: Initial state when requested by an Agent or Field Engineer.
- `APPROVED`: Reviewed and approved by a Superadmin or Moderator.
- `REJECTED`: Declined by Superadmin/Moderator with a specified reason.
- `CANCELLED`: Voided by requester or admin prior to dispatch.
- `ALLOCATED`: Tied to a specific warehouse stock item (stock state changes to `RESERVED`).
- `DISPATCHED`: Shipped via courier or transferred (state changes to `IN_TRANSIT`, tracking number attached).
- `INSTALLED`: Received and installed on-site by Field Engineer (replaces defective component).
- `ON_LOAN`: Active loaner unit deployed on site.
- `RETURN_IN_TRANSIT`: Defective or loaner part returning to warehouse.
- `RETURNED`: Defective or loaner part received at warehouse and restocked or marked for RMA.

### 8. End-Customer Sites & Branches (`EndCustomerSite`)
Pre-seeded directory of physical client offices and branch locations grouped by agency/customer and assigned to a Main Contractor:
- **`name`**: Full physical branch title (e.g., `JPJ Cawangan Putrajaya (Galeria)`).
- **`group`**: Agency or customer group identifier (e.g., `JPJ`, `RELA`, `KWSP`). In site creation/editing modals, this dynamically options from the configured `siteCustomers` defined under the selected Main Contractor.
- **`state`**: Malaysian state where the branch is located (e.g., `Selangor`, `W.P. Putrajaya`).
- **`address`**: Optional full physical street address / premises location for navigation and field engineer dispatch.
- **`mainconId`**: The associated Main Contractor for this project/contract.
- **Bulk CSV Upsert**: Managed via batch CSV upload with upsert semantics (`name` + `mainconId`) and inline editing capabilities, supporting `Site Name, Agency Group, State, Address`.
- **Ticket Auto-Population & Dispatch Integration**:
  - Selecting a pre-seeded site during ticket creation automatically resolves `clientSiteName`, `state`, `endCustomer`, and auto-fills `address`.
  - The resolved physical address is passed to Field Engineer navigation in Google Maps and formatted directly in WhatsApp dispatch notices.

### 9. Device Catalog & Hardware Models (`DeviceCatalog`)
Pre-approved hardware repository cataloging supported client equipment models:
- **`category`**: Hardware classification (e.g. `Desktop`, `Laptop`, `Printer`, `Router`, `Switch`, `Firewall`, `POS Terminal`, `Server`, `Scanner`, `UPS`, `Access Point`).
- **`brand`**: OEM / Manufacturer (e.g. `Dell`, `HP`, `Lenovo`, `Cisco`, `Zebra`, `Epson`).
- **`model`**: Exact hardware model number/name (e.g. `OptiPlex 7090`, `LaserJet Pro M404`).
- **`isStandard`**: `true` = Standard contract model with fast SLA; `false` = Non-standard / On-Request model.
- **`restrictedTo`**: Optional agency scoping (e.g. restricted specifically to `"JPJ"` or `"RELA"`, or `null` for General pool).
- **Bulk CSV Upsert**: Managed via batch CSV import with `(category + brand + model)` uniqueness and CSV export.
- **Ticket & Agency Linkage**: During ticket creation, filtering by End-Customer automatically scopes device catalog suggestions to match contract restrictions.

### 10. Role Permissions Matrix
- **Superadmin & Moderator**:
  - Full CRUD on Central and Partner Warehouses, master stock, and inter-warehouse transfers.
  - Approve, Reject, Cancel, Allocate, and Dispatch spare parts.
  - Review, approve, and settle Part Replacement Claims (hardware replenishment or reimbursement).
  - Manage, import (CSV), and edit End-Customer Sites, Device Catalog, and Master Data.
- **Agent**:
  - Scoped visibility: Can view and manage items within their assigned Partner Warehouse (`warehouse.partnerId == user.partnerId`).
  - Can register local `PARTNER_OWNED` stock into their company's warehouse.
  - Can allocate local partner stock to tickets dispatched to their company (`ticket.partnerId == user.partnerId`).
  - Can view and track status of Part Replacement Claims submitted by their agency.
  - Can view and select pre-seeded sites and device models during ticket creation/editing.
- **Field Engineer**:
  - Scoped visibility: Can view parts allocated to tickets assigned to them.
  - Can submit part requests and mark parts as `INSTALLED` or initiate loaner return.

### 11. Field Engineer Operational Lifecycle (`feLifecycleStatus` & `subStatus`)
- **`NEW`**: Ticket dispatched to Field Engineer. Pending FE acceptance (`feAcknowledgeStatus: PENDING`).
- **`FE_ACK` (Legacy `ACCEPTED`)**: Field Engineer accepted the job and acknowledged assignment (`feAcknowledgeStatus: ACKNOWLEDGED`, `subStatus: FE_ACK`).
- **`ENROUTE`**: Field Engineer is traveling to the customer site location (`subStatus: ENROUTE`, `eta` recorded).
- **`CHECKED_IN` / `IN_PROGRESS`**: Field Engineer arrived on-site, logged arrival time, and is actively troubleshooting/repairing (`status: IN_PROGRESS`, `subStatus: CHECKED_IN`).
- **`FOLLOW_UP` / `ON_HOLD`**: Work paused pending spare parts dispatch, access approval, or secondary visit (`status: FOLLOW_UP`, `subStatus: PENDING_PARTS` / `SECOND_VISIT` / etc.). Resuming work requires an explicit confirmation modal before transitioning status back to `IN_PROGRESS` to prevent accidental pocket clicks.
- **`CHECKED_OUT` / `RESOLVED`**: Field Engineer completed physical repair, uploaded mandatory signed service report (`serviceReportUrl`), attached optional field photos, and checked out (`status: RESOLVED`, `subStatus: CHECKED_OUT`).
- **`Engineer Ack` Queue Column**: Column tracking technician dispatch response (`✓ Ack`, `⏳ Pending`, `✕ Declined`), while `Sub-Status` tracks granular operational progress (`FE Ack` → `Enroute` → `Checked In` → `Checked Out`).
- **Attendance States**: `CLOCK_IN`, `ON_DUTY`, `ON_BREAK`, `CLOCK_OUT`.
- **FE Mobile 3-Tab Architecture**: Mobile view standardized to three high-efficiency views (`Home` with attendance & metric cards, `Service Orders` with full-text search & status filters, and `Profile & Settings`).
- **Field Upload Separation**:
  - **Signed Service Report**: Mandatory on final resolution; official legal sign-off document stored in `ticket.serviceReportUrl`.
  - **Field Photos & Evidence**: Optional multi-upload pictures (before/after, diagnostic error screens, defective serial tags) preserved in ticket activity timeline and gallery.

### 12. Multi-Layer Client & Represented Brand Hierarchy (`representAs`)
In enterprise subcontracting and white-label IT operations, tickets may have multiple layers of corporate identity:
- **Host System Operator**: `Total Neutron` (internal platform & dispatch operator).
- **Direct Contractor / Invoicing Client (`Maincon`)**: e.g., `Brocent` (the entity holding the master SLA contract, billing, and system integration).
- **Represented Brand / White-Label Principal (`representAs` / `principalsConfig`)**: e.g., `CITIC`, `Orange Business`. The Field Engineer on site represents this brand identity and must not disclose subcontracting intermediaries to end-customer site personnel.
- **End-Customer Premise (`endCustomer` / `EndCustomerSite`)**: The physical facility where hardware is serviced (e.g., `Bank ABC - KLCC Branch`).
- **On-Site Briefing SOP**: Prescribed behavioural protocol and script for Field Engineers (e.g. badge/vest instructions, strict prohibition on mentioning intermediary contractor names).
- **Service Report Blank Forms**: Official hardcopy form templates associated with the represented brand (`CITIC`) or direct client for FE to download and print prior to site dispatch.

### 13. Partner API Integration & System-to-System Synchronization (`PartnerIntegration`)

Direct automated synchronization linking TicketLink to external service partner IT ticketing systems across all client contracts (e.g. TM, HeiTech, Maybank, Brocent) and end-customers (JPJ, RELA, KWSP, Bank Retail):
- **`PartnerApiKey`**: Bearer token authentication scoped strictly to a single `ServicePartner` (`tl_live_...` / `tl_test_...`), enforcing tenant isolation so partner systems can only read or mutate tickets dispatched to their agency.
- **`PartnerWebhookSubscription`**: Outbound event subscription endpoint configured per partner with shared secret signing (`X-TicketLink-Signature: sha256=...`), delivering real-time lifecycle events (`ticket.dispatched`, `ticket.status_changed`, `ticket.resolved`).
- **Webhook Dual-Mode Authentication**: In addition to HMAC-SHA256 payload signing, TicketLink supports an optional partner-provided `Authorization: Bearer <token>` header (`authHeader`) on all outbound webhook deliveries and test pings. This eliminates HTTP 401 Unauthorized errors caused by partner API gateways, middleware routers, or reverse proxies requiring inbound credentials.
- **Area & Coverage API (`/api/v1/partner/areas`)**: Scoped endpoint allowing partner systems to inspect serviceable Malaysian states, active ticket volume per state, customer branch site directories, and registered field engineers with designated region coverage.
- **Geographic Queue Filtering (`?state=` / `?area=`)**: Partner ticketing systems can query tickets scoped strictly to specific regional dispatch hubs (e.g. `GET /api/v1/partner/tickets?state=Selangor`).
- **`PartnerSyncLog`**: Audit record of inbound API requests and outbound webhook dispatch attempts, HTTP status codes, latencies, payloads, and retry history.
- **Source of Truth Division**:
  - **Ticket Creation & Dispatch**: TicketLink HQ is authoritative.
  - **Engineer Assignment, ETA & On-Site Arrival (`CHECKED_IN`)**: Partner ITS system is authoritative; pushes updates to TicketLink.
  - **SLA Calculation & Enforcement**: TicketLink is authoritative and read-only to partner.
  - **Ticket Closure (`CLOSED`)**: TicketLink Superadmin/Moderator retains final authority following review of the signed service report.

### 14. SLA Classification, Ticket Queue & Views

- **Severity**: The priority class of a ticket (`P1`–`P4`) that, together with region and customer, determines its SLA target. Every ticket has exactly one severity or is **No SLA**; there is no "blank" severity.
- **SLA (Resolution SLA)**: The contractual deadline by which a ticket must be resolved, measured from its reported time and extended by any time the ticket spent paused.
- **Response SLA**: _Not yet adopted._ A potential separate target for FE on-site arrival (`CHECKED_IN`); until contracts require it, time-to-check-in is informational only.
- **No SLA (`NA`)**: A deliberate classification for ad-hoc / non-contract work that carries no SLA target and is excluded from SLA compliance metrics, but still counted in volume and workload metrics.
  _Avoid_: blank severity, "Standard", unclassified
- **Ticket Subject**: The short one-line headline of a ticket; the primary text by which a ticket is identified in the queue.
- **Issue Description**: The full free-form problem narrative; secondary to the Subject.
  _Avoid_: Issue Summary (for the description)
- **Ticket Queue**: The tabular list of tickets on the main dashboard that operators triage and act on.
- **Quick View**: A built-in, system-defined slice of the queue (e.g. Active Queue, SLA At Risk, Needs Dispatch).
- **Column Preset**: A built-in arrangement of visible queue columns (Compact, Standard, Full Detail). Carries no filters.
- **Saved View**: A user-owned, named combination of filters, sort order and visible columns that can be re-applied to the Ticket Queue from any device.
  _Avoid_: custom view, saved filter
- **Turnaround Time**: Elapsed time from a ticket's reported time to its resolution.

### 15. Email Notification System & Dispatch Lifecycle (`EmailTemplate`)

Automated email notifications dispatched via Google Workspace SMTP across critical lifecycle milestones:
- **`TICKET_CREATED`**: Dispatched to the Service Partner primary agency email and CC'd to agency agents upon new ticket assignment. Formatted with a prominent `#{{ticketRefNo}}: {{subject}}` headline card, Client (Maincon), End Customer, physical site address with navigation link, represented brand identity (`representAs`), SLA deadline, and high-level issue narrative.
- **`TICKET_ASSIGNED`**: Dispatched directly to the assigned Field Engineer (with Partner CC). Formatted for mobile execution with End Customer & site premises, location address, Google Maps link, a dedicated highlighted **🧰 Required Equipment & On-Site Protocol** checklist (`onSiteSop`), target resolution SLA, and blank service report template link.
- **`TICKET_RESOLVED`**: Dedicated completion notification dispatched to Partner Agency Dispatch and Main Contractor client upon issue resolution (`RESOLVED` / `CLOSED`). Highlights turnaround time (TAT), resolution notes, and direct link to the uploaded signed service report (`serviceReportUrl`).
- **`TICKET_STATUS_CHANGED`**: General status transition notification for operational updates (`IN_PROGRESS`, `ON_HOLD`, `CANCELLED`).
- **`TICKET_SLA_ALERT`**: Automated proactive warning dispatched when an active ticket approaches its resolution SLA deadline (within 2 hours of breach), targeted to both the assigned engineer and partner dispatch desk. Tracked via `ticket.slaAlertSentAt` to prevent duplicate alerts.
- **`SPARE_PART_DISPATCHED`**: Logistics notification triggered when HQ warehouse allocates and ships hardware components. Delivers courier name, tracking number, shipment tracking link, serial numbers, and target site details to the field technician and partner depot.
- **White-Label Email Banner**: Contextual sub-banner in transactional emails stating *"Dispatched on behalf of [Represented Brand]"* to maintain strict client subcontracting compliance without risking SMTP domain sender reputation.
- **Template Synchronization & "Reset to Default" Controls**: System settings allows administrators to customize notification wording or instantly revert single or all templates back to system standard defaults (`resetEmailTemplateAction`, `resetAllEmailTemplatesAction`).

### 16. Timezone Conventions & Remote Evidence Archival

Standardized handling of temporal timestamps and external partner digital media:
- **Canonical Timezone (`UTC` in Storage, `Asia/Kuala_Lumpur` in Display)**:
  - All database columns (`eta`, `reportedAt`, `slaDeadline`, `createdAt`) store ISO 8601 UTC timestamps (`YYYY-MM-DDTHH:mm:ss.sssZ`).
  - Partner APIs receive and return UTC timestamps (e.g. `2026-10-16T02:00:00.000Z` represents 10:00 AM MYT, UTC+8).
  - All web forms and `<input type="datetime-local">` inputs convert UTC timestamps to browser local time (`toLocalInputString`) before rendering and convert local input back to UTC on mutation, preventing 8-hour timezone regressions.
- **Evidence & Service Report Ingestion (`saveRemoteUrlToFile`)**:
  - The partner Evidence API (`POST /api/v1/partner/tickets/[id]/evidence`) and Resolve API (`POST /api/v1/partner/tickets/[id]/resolve`) accept both binary uploads (`multipart/form-data`) and remote file pointers (`application/json` with `fileUrl`).
  - Remote URLs (including temporary signed S3/R2 links valid for 15+ minutes) are automatically ingested server-side, downloaded, and archived permanently into TicketLink's persistent uploads volume, returning an immutable internal path (`/api/uploads/...`).
  - Graceful fallback: If an external network or firewall prevents immediate download, the original `fileUrl` is retained to ensure zero data loss.
- **Coolify Deployment Storage Architecture**:
  - Storage is held within a Coolify Persistent Volume mounted at `/app/public/uploads` inside the Next.js container, with automated entrypoint permission enforcement (`start.sh`) for non-root execution (`nextjs` uid 1001).
