# ADR 0024: Tenant Isolation, Role-Scoped Ticket Authorization, and Strict Phone Identity

## Status
Accepted

## Context
A security and authorization audit revealed vulnerability vectors across server actions in `src/app/actions.ts`:
1. **Role Scope Overwrites in Filtering**: In `buildTicketWhereClause`, secondary filters (such as `options.feAck`, `viewPreset: "needs_fe"`, and `viewPreset: "awaiting_ack"`) directly mutated top-level `where` properties (`assignedFeId`, `partnerId`), allowing crafted requests or preset navigation to bypass user role boundaries. Furthermore, field engineers without an associated `engineerId` or agents without a `partnerId` inadvertently had unassigned records exposed.
2. **Missing Record-Level Authorization**: Server actions modifying or fetching individual ticket records (`getTicketById`, `acceptTicket`, `enrouteTicket`, `checkInTicket`, `acknowledgeTicket`, `updateTicketEta`, `addTicketComment`, `uploadServiceReport`, `updateTicketResolution`, `updateTicketStatus`, `reassignTicketByFe`, `markSparePartInstalled`, `getTicketSpareParts`) verified session presence (`requireAuth`) but lacked strict tenant and ownership checks.
3. **Information Disclosure & ID Enumeration**: Differentiating error messages between missing tickets ("Not found") and forbidden tickets ("Forbidden") allowed malicious actors to probe and enumerate valid ticket IDs.
4. **Client-Supplied Identity & Ownership Hijacking**: Certain operations blindly trusted caller-supplied user IDs (e.g. `addTicketComment` author strings, `feUserId` in ticket reassignment, and profile updates in `updateSelfEngineerProfile` and `updateUserProfile`).
5. **State Transition Integrity & Premature Resolutions**: Field engineers were technically capable of marking tickets as `RESOLVED` without ever checking in on-site (`CHECKED_IN`), and non-HQ personnel could arbitrarily cancel or close service orders.
6. **Insecure Substring Phone Login**: Phone logins used loose `contains` matching (`phone: { contains: cleanDigits }`), allowing ambiguous matches on partial digit sequences.

---

## Decisions

### 1. Strict `AND` Role Scoping in `buildTicketWhereClause`
- Role scoping is partitioned into an immutable `roleScope` condition:
  - `FIELD_ENGINEER`: strictly scoped to `{ assignedFeId: session.engineerId }`. If `session.engineerId` is missing/null, returns `{ id: -1 }` immediately.
  - `AGENT`: strictly scoped to `{ partnerId: session.partnerId }`. If `session.partnerId` is missing/null, returns `{ id: -1 }` immediately.
  - `MODERATOR`: if partner-linked (`session.partnerId`), strictly scoped to `{ partnerId: session.partnerId }`. Only HQ moderators (`!session.partnerId`) possess cross-partner visibility.
- Secondary filters and presets are combined into an explicit `{ AND: [roleScope, ...filterConditions] }` structure, ensuring that no secondary filter can ever overwrite or widen the caller's role boundary.
- Matching scoping is enforced across `getTickets`, `getTicketsForExport`, and `getTicketsAnalytics`.

### 2. Unified Anti-Enumeration Access Guard (`assertTicketAccess`)
- Created `assertTicketAccess(session, ticketId)`:
  - `SUPERADMIN`: full access.
  - `MODERATOR`: full access if HQ (`!session.partnerId`); restricted to `ticket.partnerId === session.partnerId` if partner-linked.
  - `AGENT`: verified against `ticket.partnerId === session.partnerId`.
  - `FIELD_ENGINEER`: verified against `ticket.assignedFeId === session.engineerId`.
  - **Anti-Enumeration Uniformity**: Both non-existent tickets and forbidden tickets throw the exact same generic error: `"Forbidden: Ticket not found or access denied"`.
  - Returns the loaded ticket object to eliminate duplicate database lookups in mutation actions.
- Mandatory invocation at the start of: `getTicketById`, `acceptTicket`, `enrouteTicket`, `checkInTicket`, `acknowledgeTicket`, `updateTicketEta`, `addTicketComment`, `uploadServiceReport`, `updateTicketResolution`, `updateTicketStatus`, `reassignTicketByFe`, `markSparePartInstalled`, and `getTicketSpareParts`.

### 3. Zero-Trust Identity Enforcement
- **Comment Attribution**: `addTicketComment` enforces author attribution from `session.name || session.email`, ignoring client-submitted author overrides.
- **Team Discovery**: `getFeTeamMembersByUserId` resolves team members using `session.id` (overridable only by `SUPERADMIN`).
- **Profile Updates**: `updateSelfEngineerProfile` and `updateUserProfile` enforce `session.id === userId` and `session.engineerId === engineerId` unless called by `SUPERADMIN`.
- **Peer Reassignments**: `reassignTicketByFe` requires the ticket to be currently assigned to the calling FE, validates that the target engineer exists, is active (`isActive !== false`), and belongs to the exact same partner organization.

### 4. Status Transition Guardrails
- In `updateTicketStatus` and `updateTicketResolution`:
  - `CLOSED` and `CANCELLED` statuses are restricted exclusively to `SUPERADMIN` and HQ `MODERATOR`.
  - `FIELD_ENGINEER` is restricted to status whitelist: `["IN_PROGRESS", "ON_HOLD", "FOLLOW_UP", "RESOLVED"]`.
  - **Check-In Integrity**: An engineer cannot transition a ticket to `RESOLVED` unless the ticket has a recorded on-site check-in (`subStatus === "CHECKED_IN"`, `status === "IN_PROGRESS"` with ack, or an existing `CHECKED_IN` activity log).
  - `AGENT` and partner `MODERATOR` are restricted to: `["NEW", "IN_PROGRESS", "ON_HOLD", "FOLLOW_UP", "RESOLVED"]` for their own partner only.

### 5. Exact Phone Login Normalization & Conflict Rejection
- Replaced `contains` matching with exact matching on normalized Malaysian phone numbers via `normalizePhoneNumber(raw)`:
  - Strips all non-digit characters (`\D`).
  - Converts leading country code `60...` to standard local prefix `0...`.
- Database Auto-Migration added to `MIGRATION_STATEMENTS` (`src/lib/db.ts` & `migrate.js`) to standardize all existing `FieldEngineer.phone` entries.
### 6. Decoupled Non-RPC Access Guard (`src/lib/ticketAccess.ts`)
- To prevent Next.js from exposing `assertTicketAccess` as a client-callable Server Action RPC endpoint (which could allow arbitrary client-supplied session spoofing), `assertTicketAccess` and `FORBIDDEN_TICKET_MESSAGE` are relocated to `src/lib/ticketAccess.ts` (outside any `"use server"` module).
- Ensured zero server actions in `src/app/actions.ts` accept `session` as an argument from the client.

### 7. Spare Part Request Lifecycle & Status Guardrails (`requestTicketSparePart`)
- `requestTicketSparePart` enforces `requireAuth()` and `assertTicketAccess(session, data.ticketId)`.
- Client-supplied `data.author` is completely ignored; author attribution is strictly resolved from `session.name || session.email`.
- **Lifecycle Status Check**: Requests are rejected if ticket status is terminal/closed (`RESOLVED`, `COMPLETE`, `CLOSED`, or `CANCELLED`).
- Requests remain fully permitted during active statuses, specifically including `FOLLOW_UP` / "Check Out & Follow-Up", where field engineers routinely diagnose issues and request replacement parts.

### 8. Upload API Route Hardening (`/api/upload` & `src/lib/storage.ts`)
- **Authentication Guard**: `/api/upload` validates `getSessionUser()`, immediately terminating with `401 Unauthorized` if unauthenticated or deactivated.
- **Size Limitation**: File upload size is strictly capped at **10 MB** (`10 * 1024 * 1024` bytes). Exceeding uploads are rejected with HTTP 400.
- **Content-Based Magic Byte Inspection**: File type validation checks real binary content headers instead of client-supplied names or MIME headers. Allowed formats:
  - JPEG (`0xFF 0xD8 0xFF`)
  - PNG (`0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A`)
  - WebP (`RIFF` ... `WEBP`)
  - HEIC / HEIF (`ftyp` box with `heic`/`heix`/`mif1`/`msf1`/etc.)
  - PDF (`%PDF-`)
- Any unrecognized binary or disallowed extension is rejected with HTTP 400.
- **Server-Side Filename Regeneration**: Client-provided filenames are completely discarded. The server generates randomized, collision-free filenames (`upload_<timestamp>_<randomHex>.<ext>`), neutralizing path-traversal attacks and malicious file name injection.

---

## Consequences
- **Positive**: Complete tenant isolation between service partners and field engineers; zero unauthorized ticket mutations; robust prevention of ticket enumeration; bulletproof phone authentication without substring collision; enforced operational field workflow integrity; protected file upload endpoints with binary sniffing and sanitized server-controlled storage.
- **Negative / Trade-off**: Minor processing overhead on mutation actions from ownership verification, offset by reusing the fetched ticket instance returned by `assertTicketAccess`.
