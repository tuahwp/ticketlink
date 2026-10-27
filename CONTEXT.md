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
- **De-allocation & Wrong Allocation Recovery**:
  - **Unlink Stock / De-allocate**: When staff inadvertently allocate or dispatch the wrong physical serial or warehouse item, Superadmins and Moderators can unlink the stock. The linked `InventoryItem` is restored to `AVAILABLE` in its originating warehouse with an `ALLOCATION_REMOVED` audit log, courier/tracking fields are cleared, and the part request is reverted to `APPROVED` for prompt re-allocation.
  - **Permanent Deletion**: Superadmins and Moderators can permanently delete an erroneous part request. Any linked physical inventory is automatically restored to `AVAILABLE`, and an audit event is logged on the ticket activity timeline. Permitted for requests in `PENDING_APPROVAL`, `APPROVED`, `ALLOCATED`, and `DISPATCHED` states prior to `INSTALLED`.


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
  - De-allocate (unlink stock) and permanently delete spare part requests on tickets (with automatic warehouse stock restitution).
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
- **FE Mobile 3-Tab Architecture & Queue Categorization (ADR 0026)**:
  - Mobile view standardized to three high-efficiency views (`Home` with attendance & metric cards, `Service Orders` with full-text search & status filters, and `Profile & Settings`).
  - **`NEW` Queue Bucket**: Dispatched tickets awaiting engineer acceptance (`feAcknowledgeStatus: PENDING`).
  - **`WIP` (Work In Progress) Queue Bucket**: Commences immediately upon FE job acceptance (`FE_ACK` / `ACCEPTED`), encompassing `ENROUTE`, `CHECKED_IN`, `IN_PROGRESS`, and paused states (`ON_HOLD`, `FOLLOW_UP`). This ensures immediate reactivity when tapping `ACCEPT JOB`.
  - **`RESOLVED` Queue Bucket**: Completed tickets (`RESOLVED`, `CLOSED`, `COMPLETE`).
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

### 17. Ticket Reopening, Multi-Visit History & Webhook Idempotency

- **Same Ticket ID Persistence**: Reopening a `RESOLVED` ticket transitions the ticket back to `FOLLOW_UP` or `IN_PROGRESS` on the exact same ticket reference (`ticket.id` and `ticket.ticketRefNo`). No duplicate ticket records or split histories are created.
- **Multi-Visit Audit Trail**: Top-level `Ticket` fields (`serviceReportUrl`, `resolutionDetails`, `resolvedAt`) reflect the latest site visit. All historical visits, prior signed service reports, defective serials, and engineer notes are permanently preserved in chronological `TicketActivity` audit records.
- **Partner Echo Webhook Suppression**: Outbound webhook calls are suppressed for actions originated via Partner API by the calling partner (`excludePartnerId: auth.partnerId`), avoiding infinite event bounce loops.
- **Webhook Delivery Idempotency**: All outbound webhook payloads carry `eventId` (UUIDv4), `source` (`"TICKETLINK_UI" | "PARTNER_API" | "SYSTEM"`), `timestamp`, and the HTTP header `X-TicketLink-Delivery-ID` alongside HMAC signature `X-TicketLink-Signature` to protect against duplicate and out-of-order deliveries.

### 18. Field Engineer Portal (Mobile) Canonical UI Terminology & BM Mapping

Standardized terminology and Bahasa Melayu (BM) localization mapping for the Field Engineer mobile experience (`/fe-v2`) managed centrally via `src/app/components/fe-v2/i18n.ts`:
- **Navigation Tabs**:
  - `Utama` (`Home`): Overview of active tickets, attendance clock-in, and quick action queues.
  - `Pesanan` (`Service Orders`): Filterable list of all assigned tickets (shortened to `Pesanan` on mobile bottom navigation).
  - `Profil` (`Profile`): Engineer identity, attendance history, credential updates, and classic UI switcher.
- **Attendance & Duty Management**:
  - `Masuk Kerja` (`Clock In`): Commencing work shift.
  - `Tamat Kerja` (`Clock Out`): Concluding work shift.
  - `Sedang Bertugas` (`On Duty`): Active field work shift.
  - `Rehat` (`On Break`): Temporary pause during shift.
- **4-Step Field Lifecycle Stepper**:
  - `Terima` (`Accept`): Ticket acknowledged by technician.
  - `Dalam Perjalanan` (`Enroute`): Enroute to customer premises with ETA.
  - `Di Tapak` (`On Site / Checked In`): On-site arrival and check-in logged.
  - `Selesai` (`Resolved`): Work completed with signed service report.
- **Extra Asset & Ticket Information Labels**:
  - `Nama Tapak`: Customer premises name.
  - `No. Telefon`: Contact telephone number.
  - `Lokasi Aset`: Physical room, floor, or booth placement of equipment.
  - `Status Waranti`: Warranty eligibility of the device.
  - `No. Siri Aset`: Hardware serial number.
  - `Kategori Perkakasan`: Hardware category (POS, Laptop, Desktop, Printer, etc.).
  - `Simptom Masalah`: Problem description reported by site.
  - `SOP Di Tapak`: Step-by-step procedures mandated by principal brand.
- **SLA Countdown & Format**:
  - Time format: `{hours}h {mins}m {secs}s` (countdown) / `{hours}j {mins}m {secs}s`.
  - Standardized English SLA Badges: `SLA Met`, `SLA Breached`, `SLA PAUSED`, `SLA BREACHED (PAUSED)`, `SLA Level: P3`.
  - Ticket Detail SLA Banner: Titled `SLA TIMER` (aligned with English SLA terminology).
  - Single Clean Pill: Removed nested inner square boxes around pause icons in favor of a clean single pill with `pause_circle` icon and English label.
- **Engineer Profile & Attendance Layout (Home & Profil)**:
  - Header row: Displays engineer avatar, name, and the FE's Service Partner (`ServicePartner.name`) with `companyPhotoUrl` logo (fallback to initials) on a clean, single line (`truncate`). Resolves partner from either direct user profile or linked field engineer record (`user.partner || user.engineer.partner`), falling back to `"Rakan Servis Bebas"` only when unassigned.
  - Direct Action Controls: Removed redundant status card (`Status: Sedang Bertugas / Syif aktif & bersedia dispatch / Segerak Sistem`); retained quick toggle buttons (`Rehat` / `Kembali Bertugas` & `Tamat Kerja` / `Masuk Kerja`) placed directly beneath profile information.
  - Profil Tab Attendance Management: Streamlined to title (`Pengurusan Kehadiran`) and action button (`Kemas Kini`) without redundant `Status: Sedang Bertugas` subtext.
- **Urgent Job & Schedule Highlights**:
  - Urgent Task Title: Responsive layout rendering `"Tugasan Seterusnya"` on <=375px and `"Tugasan Keutamaan Seterusnya"` on wider viewports to guarantee single-line fit without wrapping.
  - Schedule Card State Deduplication: Suppresses the duplicate state label on the right when the site name or premises address already includes the Malaysian state.
- **Portal Version Switcher Card**:
  - Cleaned text notice without `(Google Stitch)` reference: *"Anda sedang menggunakan Portal Jurutera Lapangan v2. Anda boleh kembali ke paparan klasik bila-bila masa."*
- **Operational Queue & Sub-Status Badges**:
  - `Semua` (`ALL`): All assigned orders.
  - `Baru` (`NEW`): Newly assigned tickets awaiting acceptance (`feAcknowledgeStatus: PENDING`).
  - `WIP` (`IN_PROGRESS`): Active tickets (`FE_ACK`, `ENROUTE`, `CHECKED_IN`).
  - `Selesai` (`RESOLVED` / `CLOSED`): Resolved tickets with verified service reports.
  - `SEGERA`: Alert badge displayed exclusively for priority P1 and P2 tickets.
- **Header & Mobile Breakpoints (<= 390px)**:
  - Technical badge: `LIVE SYNC` remains standard technical terminology.
  - Attendance sync label: `Segerak Sistem · Sebentar tadi` (100% BM).
  - Compact header (<= 390px): Teks `TicketLink` disorokkan (kekal logo sahaja), `FE v2` sebagai lencana padat sebaris, `← Classic UI` menjadi butang ikon tunggal (`swap_horiz`, `aria-label="Kembali ke UI Klasik"`), semua elemen `whitespace-nowrap` tanpa *line wrap*.
- **Sticky Bottom Action Bar (Ticket Details)**:
  - Format satu baris padat tanpa teks tergantung atau truncate pada skrin 360px.
  - Butang utama penuh lebar: `Check-Out & Selesai` (ketika di tapak), `Check-In Tapak` (ketika enroute), `Terima & Set ETA` (ketika baru diserahkan).
  - Butang sekunder: `Alat Ganti / Follow-Up` (ketika di tapak untuk pesanan alat ganti atau penukaran status menunggu alat).
- **Site Navigation & Contact Actions**:
  - `Waze`: Deep link direct navigation based on text premises/address query (`https://waze.com/ul?q=...`).
  - `Google Maps`: Direct directions based on cleaned address query (`https://www.google.com/maps/search/?api=1&query=...`).
  - `Hubungi PIC`: Direct telephonic dialing (`tel:...`) using real registered phone numbers only. Hidden if no telephone number exists, replaced by `Salin Alamat`.
  - Address sanitization: Case-insensitive deduplication of states including variations such as "Selangor", "Selangor Darul Ehsan", "Kuala Lumpur", "W.P. Kuala Lumpur", and pipe "|" removal without altering database records.
- **AI Assistant Transparency & Language**:
  - Titled `Pembantu Teknikal AI` across both Home tools grid and Ticket Details (all mentions of "Gemini" strictly removed across the FE interface).
  - 100% Bahasa Melayu structured response including opening and closing sentences.
  - Underlying AI model identifier (e.g. `gemini-3.8-flash`) is suppressed from the FE client view.
- **Typography & Font Inheritance**:
  - Scoped `.fe-v2-root` enforces `Space Grotesk` on headings/st-headline and `Atkinson Hyperlegible Next` on body/controls/buttons/inputs without leaking to Classic UI (`/`).
- **Service Report & Sign-Off Governance (ADR 0008)**:
  - Mandatory signed service report via file upload (PDF/JPG/PNG <= 10MB) OR on-screen digital signature pad canvas.
  - Accidental close prevention: Form state preserved with discard confirmation if user attempts to dismiss modal with unsaved inputs.
- **Engineer Linkage Status**:
  - `Akaun Belum Dipautkan` (`Account Not Linked`): Banner shown to FE users whose login has not yet been linked to an engineer profile in system settings. Action controls: `Kemas Kini Status` and `Log Keluar`.


### 19. Field Engineer Portal v2 Parallel Architecture (`/fe-v2`)

A dedicated next-generation portal route (`/fe-v2`) hosted concurrently alongside the classic dashboard (`/`):
- **Access Guardrails**:
  - Gated server-side via `isUserInFeV2Allowlist`.
  - Authorized for `SUPERADMIN` and accounts listed in `FE_V2_USERS` environment variable.
  - Strict matching against `user.email` (case-insensitive) or normalized telephone number (`0...` or `60...`). Substring matching on username or email prefixes is strictly rejected.
  - Unauthenticated access redirects to `/login?redirect=/fe-v2`. Authenticated non-allowlist access silently redirects to the classic dashboard (`/`).
- **Shared Backend Invariants**: Zero duplication of backend logic; reuses identical server actions, `assertTicketAccess`, role-scoped filters, Prisma models, and transactional webhooks.
- **Portal Switcher**: Provides seamless bidirectional navigation between `/` and `/fe-v2` for eligible accounts via header and settings controls.


### 20. FE Portal v2 Data Representation & Field Operational Semantics

- **White-Label Principal & Brand Hierarchy (`representAs`)**:
  - The primary customer displayed on ticket headers, list cards, and search filters is always the actual client or end-customer entity (`endCustomer` or `maincon.name`, e.g., "Sephora", "Brocent", "JPJ").
  - When a ticket is dispatched under white-label agency terms (`representAs`, e.g., "Exands Pte Ltd", "Citic"), it is displayed strictly as a secondary badge: `[Wakil: <representAs>]`.
  - Filter chips on the *Pesanan* view group tickets exclusively by the true client/end-customer, never by the principal.
  - Branding Logo Fallback Cascade: End-Customer Group Logo (`customerLogos`) ➔ Main Contractor Client Logo (`maincon.logoUrl` / `mainconLogos`) ➔ Stylized Monogram Initials.
- **Custom Fields Mapping & PIC Contact Resolution**:
  - Main contractor schemas (`Maincon.customFieldsSchema`, supporting both flat arrays and `{ default, endCustomers }` structures) are translated into human-friendly Bahasa Melayu via a standardized dictionary:
    - `Name` / `Nama` ➔ `Nama PIC`
    - `SPOC Name` / `SPOC` ➔ `Nama SPOC`
    - `POC` / `POC Name` ➔ `Nama POC`
    - `Infomina Person Name` ➔ `Nama Pegawai Infomina`
    - `Intervention Date` / `Tarikh Intervensi` ➔ `Tarikh Intervensi` (value rendered in standardized BM date format matching card badges)
    - `Contact` / `Phone` / `Tel` ➔ `No. Telefon` (or `No. Telefon SPOC/POC` if prefixed)
    - `Site Name` ➔ `Nama Tapak`
    - `IP Address` ➔ `Alamat IP`
    - `Coordinate` / `Coordinates` ➔ `Koordinat`
    - Unrecognized custom field keys retain their raw schema naming.
  - PIC Name Resolution Safeguard: Keys referencing premises or infrastructure (`site`, `tapak`, `location`, `asset`, `host`) are strictly disqualified from being mapped as personal PIC names.
  - Telephonic Dialing Action (`Hubungi PIC`): Dynamically binds to the first valid phone number extracted across contact fields.
- **Coordinate Address Guard & Precision Navigation**:
  - If a ticket address matches geographic coordinates (`lat, lng` with latitude in `[-90, 90]` and longitude in `[-180, 180]`), coordinates are stripped from premise address display.
  - Fallback hierarchy for physical address: `EndCustomerSite.address` ➔ `${ticket.clientSiteName}, ${ticket.state}, Malaysia` ➔ `${ticket.state}, Malaysia`.
  - Navigation Actions (`Waze` / `Google Maps`): Prioritize explicit coordinates (`Coordinate` field or parsed coordinates) to trigger direct pinpoint routing (`ll=${lat},${lng}`), falling back to premise address queries when coordinates are absent.
- **Intervention Date (`Tarikh Intervensi`)**:
  - Scheduled intervention timestamps from custom fields are highlighted on ticket cards, details, and custom field values with an event calendar badge in Bahasa Melayu: `"Hari ini, 10:00 pagi"`, `"Esok, 10:00 pagi"`, or `"24 Okt 2026, 09:00 pagi"`. Unparseable free-form strings are displayed verbatim without relative prefixes.
  - Intervention dates do not alter contractual SLA sorting priorities.
- **Lifecycle Transition Guardrails & Action Dock Semantics**:
  - Shared valid transition matrix between UI (`getNextAction`, `getTicketStageInfo` in `src/lib/ticket-transitions.ts`) and server actions (`acceptTicket`, `enrouteTicket`, `checkInTicket`, `updateTicketStatus`, `updateTicketResolution` in `src/app/actions.ts`).
  - Mandatory Check-In Before Resolve: The Resolve action (`Selesaikan & Daftar Keluar (Resolve)`) is strictly hidden until the ticket achieves verified `CHECKED_IN` status (via `subStatus === "CHECKED_IN"` or recorded check-in activity).
  - Accepted Tickets: Display `Daftar Masuk Tapak (Check-In)` as the primary operational action, with `Gerak ke Tapak (Set ETA)` as the secondary action. Enroute tickets display `Daftar Masuk Tapak (Check-In)` as primary and `Kemas Kini ETA` as secondary.
  - Server Rejection Guardrails & Logging: Invalid FE transitions (e.g., resolving before checking in, checking in before accepting, acting on closed tickets) are rejected at the server level with structured `[FE_TRANSITION_REJECTED]` logs containing `ticketId`, `ticketRefNo`, `userId`, `userRole`, `status`, `subStatus`, and `feAcknowledgeStatus`.
  - Client Resilience & Anti-Spam: Upon server rejection, the FE client immediately closes the modal, displays a localized Bahasa Melayu toast, and triggers `syncFETickets(true)` to re-align the UI with the authoritative server state. Action buttons are disabled during network requests to prevent double-tap submissions.
  - Role Override: `SUPERADMIN` and `MODERATOR` retain full override authority across all lifecycle transitions.
  - Resolved & Closed Tickets: The fixed bottom sticky action dock on ticket details is suppressed or rendered as non-actionable, preserving document and log readability. In-page service report preview/print and navigation buttons remain active.
  - Resumed Follow-Up Jobs: Action button explicitly labeled `"Sambung Semula"`.
  - Classic FE Dashboard Sticky Dock Responsive Layout:
    - Dual-button action docks (`CHECKED_IN`, `ACCEPTED`, `ENROUTE`) utilize `flex items-center gap-2 w-full min-w-0` with primary CTA `flex-[1.2]` and secondary CTA `flex-1`, both with `min-w-0` and outer container `overflow-x-hidden` to strictly eliminate horizontal body overflow across small mobile viewports (360px and 390px).
    - Compact button labels on `<640px` use familiar FE operational terms with full labels on `sm:` and up:
      - `CHECKED_IN`: `"Resolve"` (<640px) | `"Selesaikan & Daftar Keluar (Resolve)"` (sm+); `"Susulan"` (<640px) | `"Susulan (Follow-Up)"` (sm+) with icons `✓` and `📦`. Never uses `"Selesai"` on the button.
      - `ACCEPTED`: `"Check-In"` (<640px) | `"Daftar Masuk Tapak (Check-In)"` (sm+); `"Set ETA"` (<640px) | `"Gerak ke Tapak (Set ETA)"` (sm+) with icons `📍` and `🚗`.
      - `ENROUTE`: `"Check-In"` (<640px) | `"Daftar Masuk Tapak (Check-In)"` (sm+); `"Kemas Kini ETA"` with icons `📍` and `🚗`.
  - Classic FE Dashboard Timestamps Section:
    - Synchronized all 4 timestamp labels to Bahasa Melayu with English terms in parentheses:
      1. `Masa Dihantar (Dispatched)`: `selectedTicket.createdAt`
      2. `Anggaran Tiba (ETA)`: `selectedTicket.eta`
      3. `Masa Daftar Masuk (Check-In)`: Latest `CHECKED_IN` activity timestamp in `DD MMM, hh:mm a` format matching Resolved. Appends note ` (xN)` (e.g. ` (x2)`) if multiple check-ins occurred.
      4. `Masa Selesai (Resolved)`: `selectedTicket.resolvedAt`
- **Card Action Bar & Single Stage Architecture (`getTicketStageInfo`)**:
  - The Service Orders list cards and Ticket Details page share `getTicketStageInfo(ticket).stage` (`src/lib/ticket-transitions.ts`) as the single source of truth for action buttons and badge statuses, eliminating overlapping legacy booleans (`isAccepted`, `isEnroute`, `isCheckedIn`).
  - Completed Tickets (`stage === "RESOLVED"`): All primary operational action buttons (such as "Gerak ke Tapak (Set ETA)") are completely suppressed. If a signed report (`serviceReportUrl`) exists, only a clean secondary action button `"Lihat Laporan Servis Bertandatangan"` is displayed.
- **Work-In-Progress-First Feed Sorting Hierarchy**:
  - Dispatched tickets sort deterministically across three distinct buckets:
    1. **WIP Tier First**: Tickets currently committed or in progress (`isFeWipTicket`: `ACCEPTED`, `ENROUTE`, `CHECKED_IN`, `IN_PROGRESS`, `ON_HOLD`, `FOLLOW_UP`) strictly precede newly dispatched tickets, ensuring active fieldwork (e.g. `TKL-20261022-1039`) remains at the very top.
    2. **NEW Tier**: Newly dispatched tickets awaiting FE acceptance.
    3. **Completed Tier Last**: Finished tickets (`isFeResolvedTicket`: `RESOLVED`, `CLOSED`, `COMPLETE`) placed at the absolute bottom.
  - **Intra-Bucket Prioritization**: Within each tier (WIP among WIP, NEW among NEW):
    1. Critical severity (`P1`) first.
    2. `SLA BREACHED` tickets first.
    3. Closest contractual SLA target deadline (`slaDeadline` ascending).
    4. Most recently created ticket (`createdAt` descending).
- **Queue Counting Semantics & Interface Consistency**:
  - Home Schedule Counter: Explicitly labeled `{activeJobs.length} Tugasan Aktif` (encompassing both `NEW` unaccepted and `WIP` in-progress orders).
  - Bottom Navigation Badge: Displays `{activeJobs.length}` to reflect total actionable active workload assigned to the engineer.
- **On-Site SOP & Service Report Template Attachment**:
  - On-site SOP header displays `Protokol & SOP Di Tapak` (with `(Wakil: <representAs>)` when relevant). Admin notes are rendered verbatim with whitespace preserved; fallback instructions are provided in standard BM.
  - Long device model and serial designations wrap gracefully up to 2 lines (`line-clamp-2 break-all`) without single-line ellipsis truncation.
  - Blank official service report template indicator (`serviceReportTemplateName`) is displayed directly beneath the *Buka & Cetak Borang Servis Rasmi* action button, and hidden if no template is designated.


### 21. Classic Ticket Queue Concurrency & Deterministic Ordering (ADR 0027)

- **Monotonic Request Invalidation (`latestRequestIdRef`)**:
  - To prevent background sync (`refreshData`) and user interaction (`fetchTickets`) from committing out-of-order responses, all asynchronous `getTickets` calls capture a monotonic request sequence number (`++latestRequestIdRef.current`).
  - Responses returning after a newer request has been dispatched are discarded completely, preventing stale ticket lists or mismatched preset counters from overwriting the UI state.
- **Background Sync In-Flight Guard & Coalescing Debounce (`inFlightRef`)**:
  - Background polling (20-second interval), `window.focus`, and `document.visibilitychange` check `inFlightRef.current` to strictly suppress concurrent executions while a prior refresh is pending.
  - Browser tab activation events (`visibilitychange` and `focus`) are coalesced via a 300ms debounce timer to prevent dual simultaneous invocations upon tab switching.
- **Deterministic 3-Tier Sort Order (`buildTicketOrderBy`)**:
  - All sorting clauses enforce deterministic tie-breakers: `[{ <field>: dir }, { createdAt: "desc" }, { id: "desc" }]`.
  - Default sort order (when `sortBy` is omitted or unassigned) is `[{ reportedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }]`.
  - `src/app/page.tsx` explicitly initializes SSR with `sortBy: "reportedAt", sortOrder: "desc"` to ensure perfect parity between initial server HTML and subsequent client sync.
- **Reported Date Column (`REPORTED DATE`)**:
  - The `REPORTED DATE` column renders `t.reportedAt || t.createdAt`, prioritizing the true on-site/operational incident report timestamp while safely falling back to creation time for legacy tickets without an explicit override.


### 22. User-Facing Error Architecture & Production Server Action Digest Safe Returns (ADR 0028)

- **Next.js Production Error Masking Problem**:
  - In Next.js App Router production builds (`next build && next start`), any `Error` thrown from a Server Action is intentionally masked into a generic message with an opaque digest (e.g. `An error occurred in the Server Components render...`).
  - To ensure business rule rejections (e.g. invalid status transitions, check-in requirements) reach the user with readable BM guidance, Server Actions must return `{ ok: false, error: string, code?: string }` rather than throwing.
- **Explicit Allowlist Error Model (`src/lib/errors.ts`)**:
  - `UserFacingError`: Explicit class (`isUserFacing = true`) for expected domain errors.
  - `sanitizeErrorMessage(err)`: Applies a strict allowlist. It accepts `UserFacingError`, `{ ok: false, error }`, or Server Action deploy hash mismatches. All other uncaught exceptions or internal technical stack traces are sanitized to `"Ralat sistem berlaku. Sila cuba sebentar lagi atau muat semula halaman."` with the full error logged via `console.error`.
- **Global ErrorDialog System (`src/app/components/ErrorDialogProvider.tsx`)**:
  - Registered in root `layout.tsx` via `ErrorDialogProvider` and consumed through `useErrorDialog()`.
  - Displays a centered, high-contrast modal dialog (z-index 100) with backdrop blur.
  - **Two-Button Interaction**:
    - `"OK"`: Dismisses the dialog and executes registered background refresh handlers (`syncFETickets(true)` or `refreshData()`) to immediately resynchronize client state with the server without full page reloads.
    - `"Muat Semula"`: Calls `window.location.reload()`.
- **Server Action Deploy Hash Mismatch ("Failed to find Server Action")**:
  - Detected when a client invokes an outdated Server Action ID after a new deployment.
  - Displays a dedicated `"Versi Baharu Tersedia"` banner with `"Versi baharu tersedia, sila muat semula."` and a single `"Muat Semula"` action button.
- **Route Segment & Global Error Boundaries (`error.tsx`, `global-error.tsx`)**:
  - `src/app/error.tsx` and `src/app/global-error.tsx` provide catch-all boundary protection formatted in consistent BM design with `"Cuba Lagi"` (`reset()`) and `"Muat Semula Halaman"` (`window.location.reload()`).


### 23. Zero-SLA Severity ('NA') Enum Migration Architecture (ADR 0029)

- **PostgreSQL Enum DDL Isolation**:
  - In PostgreSQL, adding values to existing enumerated types (`ALTER TYPE "Severity" ADD VALUE IF NOT EXISTS 'NA';`) cannot execute inside a transactional block or multi-statement DO block alongside queries referencing that new value.
  - `MIGRATION_STATEMENTS` in `src/lib/db.ts` defines `ALTER TYPE "Severity" ADD VALUE IF NOT EXISTS 'NA';` as a standalone isolated statement executed immediately prior to `UPDATE "Ticket" SET "slaDeadline" = NULL WHERE "severity" IS NULL OR "severity" = 'NA';`.
  - Prevents runtime startup log warnings: `Migration statement note: invalid input value for enum "Severity": "NA"`.


### 24. Shared Modal Lifecycle & Detail View Operational Transition Integrity (ADR 0030)

- **Early-Returning Detail View vs. Root Modal Tree**:
  - In Field Engineer dashboard architectures (`FEDashboard.tsx` and `FEV2Dashboard.tsx`) where viewing a selected ticket executes an early return (`if (selectedTicket)`), modal components defined solely in the root list view tree are unmounted while inside detail mode.
  - All operational confirmation modals (e.g., `isResumeModalOpen`) must be structured through shared component helper functions (`renderResumeModal()`) invoked across both the detail view JSX tree and the root queue JSX tree.
- **Immediate State Realignment & Dock Synchronization**:
  - When transitioning tickets from detail view (e.g., resuming on-site work via `checkInTicket` on an `ON_HOLD` / `FOLLOW_UP` order):
    1. **Rejection Guardrail**: If `checkInTicket` returns `{ ok: false, error }` or throws, `selectedTicket` is preserved, the view does not dismiss, and the error surfaces via `useErrorDialog()`.
    2. **Immediate Detail Realignment**: Upon success, `getTicketById(ticketId)` directly fetches and commits the fresh ticket object to `selectedTicketRef.current` and state before `syncFETickets(true)` completes, ensuring the bottom dock immediately transitions from `"Sambung Semula"` to the active work dock (`CHECKED_IN`: `"Resolve"` and `"Susulan"`) with zero layout flicker or page exit.
    3. **Double Submission Guard**: Modal submit buttons bind `disabled={isPending}` to prevent duplicate invocations during network flights.




