# ADR 0010: Ticket Subject Field and Precise Reported At Timezone Handling

## Status
Accepted

## Context
1. **Reported Date & Time Override**:
   - When tickets are received via external emails or client calls, dispatchers override the `reportedAt` timestamp so SLA timers reflect the actual customer request time rather than system ticket logging time.
   - Previously, `<input type="datetime-local">` strings without explicit timezone offsets were parsed in UTC by server-side runtimes, causing an 8-hour time shift in Malaysia (UTC+8).
2. **Ticket Subject vs Description**:
   - Tickets previously only possessed `issueDescription`, forcing users to combine brief summaries, contact details, hardware models, and issue descriptions into one large text block.
   - When displayed on Field Engineer mobile cards and detail banners, the entire multiline description rendered inside bold header titles.
3. **Removal of Legacy Incident Prefixes**:
   - The FE detail screen displayed an artificial incident identifier (`I-0000010 >`), which did not correspond to business domain entities.

## Decision
1. **Add `subject` Field to Ticket Model**:
   - Add a `subject` column (`TEXT`, optional for legacy tickets, required on new creation) to store concise headlines (e.g. *"Dismantle network equipment at SDG Ara Damansara"*).
   - Retain `issueDescription` for the full detailed body (contacts, serials, logs, etc.).
2. **Display Split in FE Mobile Interface**:
   - Card headline and Top summary banner display `${ticketRefNo} | ${subject || issueDescription}`.
   - Full body text renders cleanly in the dedicated **Description** card.
3. **Clean Reference Number Display**:
   - Remove the `I-0000010 >` prefix from `FEDashboard.tsx`, displaying only the clean ticket reference number (`TKL-YYYYMMDD-XXXX` or `SO-XXXXXXX`).
4. **Client-Side Timezone Normalization for `reportedAt`**:
   - When initializing `<input type="datetime-local">`, convert UTC dates using client timezone offsets:
     `new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)`.
   - Before submitting to server actions, serialize to a standard ISO-8601 string (`new Date(reportedAt).toISOString()`) so server parsing is exact regardless of server container timezone (`TZ=UTC`).

## Consequences
- **Positive**: Clean mobile interface with clear headlines and uncluttered description sections.
- **Positive**: Exact SLA tracking matching customer incoming email timestamps down to the minute without UTC drift.
- **Positive**: Consistent identifier format across Admin, Partner, and Field Engineer dashboards.
