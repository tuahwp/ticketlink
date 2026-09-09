# ADR 0007: Site Branch Address Integration and Dynamic Agency Group Linkage

## Status
Accepted

## Context
1. **Physical Branch Addresses**: Previously, `EndCustomerSite` and `Ticket` only stored `clientSiteName` and `state`. When Field Engineers were dispatched to branch sites, or when WhatsApp dispatch notices were copied, only the general site name and state were available. Accurate physical street addresses were missing, requiring manual lookups or imprecise navigation.
2. **Agency / Customer Group Entry in Site Management**: When adding branch sites in the Customer Sites directory, the `Agency / Customer Group` field was an unguided free-text input, which led to inconsistent casing or mismatch with the `siteCustomers` already configured on the Main Contractor in the "Clients / End Customers" settings tab.

## Decision
1. **Schema Enhancements**:
   - Add `address String?` to `EndCustomerSite`.
   - Add `address String?` to `Ticket`.
   - Update `db.ts` auto-migrations with `ALTER TABLE ... ADD COLUMN IF NOT EXISTS "address" TEXT`.
2. **Customer Sites Directory Tab**:
   - Add an `Address` column to the customer sites table view.
   - Add an Address input field in the Single Add / Edit Site modal.
   - Update CSV Bulk Import and CSV Export to support the optional 4th column `Address` (`Site Name, Agency Group, State, Address`).
3. **Dynamic Customer Group Dropdown in Site Modal**:
   - In the Customer Sites Add/Edit modal, when a Main Contractor is selected, dynamically load its configured `siteCustomers` from the database.
   - Render a `<select>` dropdown populated with those configured groups, along with a `+ Custom Group` fallback input if an unconfigured group is needed.
4. **Ticket Creation & Editing Workflow**:
   - When selecting a pre-registered site in `CreateTicketForm` and `EditTicketForm`, auto-populate `clientSiteName`, `state`, `endCustomer`, and the new `address` field.
   - Allow manual address entry and editing even if no pre-registered site is chosen.
5. **WhatsApp Notice & Field Engineer Linkage**:
   - **WhatsApp Template**: Add a dedicated `*Site Address:* ${address || "N/A"}` line directly below `*Site Name:*`.
   - **FE Mobile Dashboard**: Use the physical `address` (fallback to `${clientSiteName}, ${state}`) for the location card display, "📋 Copy Site Address" button, and Google Maps turn-by-turn navigation.

## Consequences
- **Positive**:
  - Streamlined Field Engineer on-site navigation with accurate street addresses.
  - Comprehensive WhatsApp dispatches containing physical address details.
  - Consistent agency grouping aligning with Maincon contract definitions.
  - Full backwards compatibility with existing tickets and CSV import files.
- **Negative**:
  - Existing pre-seeded sites without addresses will show empty/default address until updated.
