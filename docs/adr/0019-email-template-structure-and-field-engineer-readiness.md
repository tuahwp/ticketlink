# ADR 0019: Email Notification Architecture, Information Scope & Field Engineer Operational Readiness

## Status
Accepted

## Context
Following real-world dispatch verification on mobile mail clients (e.g. Brocent / Citic dispatch to partner agencies), several architectural gaps and UI omissions in transactional email notifications surfaced:

1. **Omission of Ticket Subject in Body Card**:
   - The primary ticket headline (`subject`, e.g., "Replace Cisco Switch 2960 / Access Point") was rendered only in the envelope subject line, but was entirely absent from the email card body.
   - On mobile devices where mail clients truncate subject lines, technicians and dispatch managers had to infer the issue solely from the verbose description.
2. **Missing Operational Context on the Road**:
   - Technicians on mobile frequently depart without required equipment or cables (e.g. console cables, label printers, laptop tools) when tool requirements are buried in long description text blocks.
   - Street premises addresses and 1-tap navigation were missing from database templates.
3. **Multi-Party Client Disambiguation**:
   - Tickets often involve a Main Contractor (e.g. Brocent International) subcontracting to an Agency, while servicing a distinct End Customer (e.g. GKN Aerospace). Without explicit `endCustomer` tags, subcontracting clarity suffered.
4. **Database Template Drift & Desynchronization**:
   - `DEFAULT_EMAIL_TEMPLATES` in code had evolved, but existing PostgreSQL databases maintained old seed copies because `getEmailTemplatesAction()` deliberately avoided updating existing `bodyHtml` to prevent overwriting admin edits.
   - Administrators lacked a mechanism to restore templates to system standards when upstream updates occurred.

## Decision

1. **Role-Tailored Information Architecture**:
   - **Agency Dispatch (`TICKET_CREATED`)**: Tailored for triage and assignment. Displays Ticket Ref & Subject headline banner, Client (Main Contractor), End Customer, Site Premises with State, Physical Street Address, Severity, SLA Target, White-Label Representation, and Issue Details, culminating in a primary **"Assign Field Engineer"** action.
   - **Field Engineer Assignment (`TICKET_ASSIGNED`)**: Tailored for on-the-road execution. Highlights End Customer & Client Site, Location Address, Severity, SLA Deadline, Represented Brand, and features dual actions: **"Open Mobile Dashboard"** and **"Navigate (Google Maps)"**.

2. **Dedicated Equipment & On-Site SOP Callout Banner**:
   - Added a distinct, highlighted protocol box (`🧰 Required Equipment & On-Site Protocol`) positioned directly above the issue description in `TICKET_ASSIGNED`.
   - Ensures engineers immediately see mandatory tool requirements (laptops, console cables, label printers, badges) before departing.

3. **Prominent Subject Header Banner**:
   - In both templates, `#{{ticketRefNo}}: {{subject}}` is rendered as a bold 16px header directly within the white card container, ensuring clear scannability on all screen widths.

4. **"Reset to Default" Administration Controls**:
   - Added `resetEmailTemplateAction(eventKey)` and `resetAllEmailTemplatesAction()` in `src/app/actions.ts`.
   - Updated `SystemSettingsTab.tsx` with:
     - A per-template **"Reset to Default"** action inside the edit modal to restore standard HTML without touching other templates.
     - A global **"Restore All Defaults"** button in the header for system-wide synchronization.

5. **PostgreSQL Database Migration**:
   - Executed `scripts/migrate_email_templates_to_v19.js` and updated `prisma/seed.ts` to immediately update all production database rows to the modern structure.

## Consequences

- **Positive**:
  - Full clarity on mobile email clients: ticket subjects, end customers, and site addresses are visible at a glance without truncation.
  - Significantly reduces technician return trips caused by forgotten console cables or diagnostic tools.
  - Administrators have a safe, 1-click fallback to restore standard templates anytime without manual SQL editing.
- **Negative / Considerations**:
  - Restoring templates will overwrite custom HTML styling if an agency has customized their own templates; the UI includes confirmation dialogs to prevent accidental resets.
