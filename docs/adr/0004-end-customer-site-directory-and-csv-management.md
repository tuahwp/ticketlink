# ADR 0004: End-Customer Site Directory Management and CSV Import

## Status
Accepted

## Context
Tickets in the system are dispatched to physical client branches (e.g., JPJ branches, RELA centers, KWSP offices). Previously, site names and states were typed manually or partially selected, leading to typos, inconsistencies across reporting, and manual data-entry overhead.
The database schema already includes the `EndCustomerSite` model linked to `Maincon` and `Ticket.siteId`:
```prisma
model EndCustomerSite {
  id        Int      @id @default(autoincrement())
  name      String   // e.g. "JPJ Cawangan Putrajaya (Galeria)"
  group     String   // e.g. "JPJ", "RELA"
  state     String   // e.g. "Selangor", "W.P. Putrajaya"
  mainconId Int
  maincon   Maincon  @relation(fields: [mainconId], references: [id], onDelete: Cascade)
  tickets   Ticket[]
}
```
We need an intuitive management interface for Superadmins and Moderators to bulk import branch listings via CSV, perform single-record editing to fix typos or adjust wording, and allow seamless auto-completion during ticket creation.

## Decision
1. **Management Placement**:
   - Add a dedicated **"Customer Sites" (Branch Directory)** sub-tab/view within the Master Data configuration navigation (accessible alongside Maincon, Service Partners, Devices, and SLAs).
   - Provide multi-dimensional filtering by Main Contractor, Agency Group (e.g., JPJ), and State, plus full-text search.
2. **CSV Bulk Import with Upsert**:
   - Provide a CSV template download and drag-and-drop / file upload modal.
   - Upsert semantics by `(name, mainconId)`: if a site with the same name already exists under the chosen Main Contractor, update its `state` and `group`; otherwise insert a new record.
   - Support CSV columns: `Site Name, Agency Group, State` (with target Main Contractor selected prior to or inside the upload modal).
3. **Single Site Editing & Deletion**:
   - Provide row-level Edit and Delete actions in the table with modal validation.
4. **Ticket Auto-Complete Integration**:
   - When creating or editing a ticket, typing in the Client Site Name field shows matching pre-seeded sites from `EndCustomerSite`.
   - Selecting a site automatically populates `state` and `endCustomer` while preserving manual entry capability for new or unlisted emergency sites.

## Consequences
- **Positive**:
  - Consistent branch naming across tickets and SLA tracking.
  - Quick onboarding of hundreds of branches per agency via single CSV upload.
  - Zero disruption if an unlisted site needs to be typed manually.
- **Negative**:
  - Requires maintaining the site directory as new branches open or change names.
