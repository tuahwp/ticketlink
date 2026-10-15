# ADR 0017: Email Notification Lifecycle, Dedicated Resolution Event & Brand Dispatch

## Status
Accepted

## Context
TicketLink previously supported a minimal baseline of email templates (`TICKET_CREATED`, `TICKET_ASSIGNED`, `TICKET_STATUS_CHANGED`, `TICKET_SLA_ALERT`, and Auth emails). Following extensive architectural enhancements across ADR-0001 through ADR-0016, several critical gaps and inconsistencies emerged:

1. **Stale Template Schemas**:
   - `TICKET_CREATED` and `TICKET_ASSIGNED` templates lacked recent core domain fields: ticket headline (`Subject`), physical street premises (`address`), Google Maps direction links, SLA resolution deadlines (`slaDeadline`), and multi-layer represented brand context (`representAs`, `onSiteSop`).
2. **Deficient Ticket Resolution Notice**:
   - When a ticket was marked `RESOLVED`, the generic `TICKET_STATUS_CHANGED` notification only targeted the `assignedFe` (who was typically the person submitting the resolution), while the Service Partner dispatch inbox and Main Contractor client received no automated notification or link to the signed service report (`serviceReportUrl`).
3. **Dormant SLA Alert (`TICKET_SLA_ALERT`)**:
   - The SLA warning template existed in configuration and database schemas, but had zero automated triggers in the codebase, leaving SLA breaches un-alerted.
4. **Logistics & Spare Parts Blind Spot**:
   - When central HQ dispatched spare parts via courier (PosLaju, GDEX, J&T) with tracking numbers, Field Engineers and local partner depots received no email dispatch notification.
5. **Brand Representation & White-Label Delivery**:
   - Outbound transactional emails featured an inflexible universal header, lacking explicit subcontracting brand guidance for white-label customer contracts.

## Decision

1. **Modernized Core Dispatch Templates (`TICKET_CREATED` & `TICKET_ASSIGNED`)**:
   - Upgraded default schemas and placeholders with `{{subject}}`, `{{address}}`, `{{mapsUrl}}`, `{{representAs}}`, `{{onSiteSop}}`, and `{{slaDeadline}}`.
   - Updated `notifyPartnerTicketCreated` and `notifyFeTicketAssigned` to resolve and inject these parameters with graceful fallbacks.
   - Embedded Google Maps navigation links directly into email dispatch cards for immediate technician routing.

2. **Dedicated `TICKET_RESOLVED` Template & Recipient Matrix**:
   - Introduced a first-class `TICKET_RESOLVED` template dispatched immediately upon ticket status transition to `RESOLVED` or `COMPLETE`.
   - Dispatches to:
     - Primary: Partner agency dispatch email (`partner.dispatchEmail` or primary agent).
     - CC: Agency agents and assigned Field Engineer.
     - External: Main Contractor notification email (when configured).
   - Email payload includes: Turnaround Time (TAT), resolution summary notes, technician name, and a prominent secure button linking to the uploaded completed signed Service Report (`serviceReportUrl`).

3. **Active Automated SLA Warning Scanner (`TICKET_SLA_ALERT`)**:
   - Added `slaAlertSentAt` timestamp tracking to the `Ticket` data model.
   - Built an automated scanner (`scanAndDispatchSlaAlertsAction`) that identifies active, unpaused tickets nearing their `slaDeadline` (within 2 hours of breach, excluding `NA` / No SLA severity).
   - Dispatches `TICKET_SLA_ALERT` with remaining time, site details, and an immediate action link, stamping `slaAlertSentAt` to prevent duplicate alerts.

4. **Logistics & Spare Part Dispatch Notification (`SPARE_PART_DISPATCHED`)**:
   - Added a dedicated template for warehouse courier dispatches.
   - Automatically triggered during warehouse part allocation (`allocateAndDispatchSparePart` and batch dispatch).
   - Informs the assigned Field Engineer and partner buffer depot with the courier provider (`courierName`), tracking number (`trackingNumber`), clickable consignment tracker, and destination site.

5. **White-Label Contextual Sub-Banner**:
   - Enhanced the responsive email wrapper to render a clear, branded callout: *"Dispatched on behalf of [Represented Brand]"* whenever `representAs` is populated.
   - Maintains high deliverability and SPF/DKIM alignment with the host SMTP server while ensuring on-site brand compliance.

## Consequences

- **Positive**:
  - Field technicians and partner dispatchers receive actionable emails with complete physical site addresses and one-tap navigation.
  - Clients and partner agencies get instantaneous confirmation of job completion with the signed service report attached/linked.
  - Contractual SLA breaches are proactively warned against before deadlines elapse.
  - Full logistics visibility for courier shipments to site.
- **Negative / Considerations**:
  - System administrators can customize or toggle off any template in the System Settings tab if email volume is too high for specific event keys.
