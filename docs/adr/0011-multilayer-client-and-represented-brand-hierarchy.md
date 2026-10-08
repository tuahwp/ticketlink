# ADR 0011: Multi-Layer Client & Represented Brand (On-Site Identity) Hierarchy

## Context
In enterprise IT field services, contracts often follow a multi-tier B2B2B delivery model:
1. **Host Operator (Total Neutron)**: Owns and operates TicketLink dispatching platform.
2. **Direct Client / Main Contractor (`Maincon`)**: e.g., `Brocent` (APAC contractor holding master vendor agreement, SLA, and billing).
3. **Represented Brand / White-Label Principal (`representAs`)**: e.g., `CITIC`, `Orange Business` (the enterprise partner who ordered the service from Brocent). The Field Engineer on site **must represent this brand**, wear neutral/branded attire, and present official service reports branded for this principal.
4. **End-Customer Premise (`EndCustomerSite` / `endCustomer`)**: The physical facility where hardware is serviced (e.g., `Bank ABC - KLCC Branch`).

Previously, TicketLink only had a 2-tier client structure (`Maincon` -> `siteCustomers` / `EndCustomerSite`). When a ticket was dispatched, FEs lacked an explicit instruction on which brand identity to present on-site, risking confidentiality breaches or client complaints if they named Total Neutron or Brocent in front of end-customer staff.

## Decision
1. **Extend Schema with `representAs` & `onSiteSop`**:
   - `Ticket.representAs`: (String, nullable) Identifies the official principal brand (e.g., `"CITIC"`).
   - `Ticket.onSiteSop`: (String, nullable) Specific on-site briefing instruction/script for the FE.
   - `Maincon.principalsConfig`: (JSONB, nullable) Array of registered represented brands under the client with default SOP instructions, logo associations, and blank form templates.

2. **Enhance "Clients" (`Maincon`) Management**:
   - Allow configuration of Sub-Brands / Principals per Client with optional on-site briefing rules.
   - If SOP is left blank, it strictly remains empty without generating boilerplate text.

3. **Seamless Ticket Creation & Form Auto-Population**:
   - On selecting a Client (`Maincon`), the `Represent As` dropdown defaults to Direct client representation.
   - Dispatchers can optionally pick a White-Label Principal if applicable.
   - Blank Service Report Form Template auto-selects by matching `representAs` first, then `endCustomer`, falling back to `Maincon` default.

4. **FE Mobile View & Dispatch Integration**:
   - **Ticket View**: Clean and uncluttered display without unnecessary large banners.
   - **FE Mobile View**: Displays clear `Represent As` indicator and on-site SOP only when explicitly provided.
   - **WhatsApp Dispatch Notice**: Clean text format (without `🛡️` or `⚠️` emoji clutter). If no SOP is defined, the SOP section is omitted entirely.

## Consequences
- **Positive**:
  - Eliminates on-site identity confusion while keeping forms clean and optional.
  - No forced boilerplate text when SOP is omitted.
  - Clean and professional WhatsApp dispatch format.
- **Backwards Compatibility**:
  - For single-layer clients (e.g. HeiTech -> JPJ), `representAs` defaults seamlessly to the group / client name without imposing extra clicks.
