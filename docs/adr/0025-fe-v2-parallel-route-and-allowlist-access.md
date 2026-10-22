# ADR 0025: Parallel Route (/fe-v2) Architecture and Strict Allowlist Authorization

## Status
Accepted

## Context
1. **Parallel Frontend Evolution**: Operations require modernizing the Field Engineer (FE) portal while preventing disruptions to ongoing field technician workflows on the classic dashboard (`/`).
2. **Zero Backend Duplication**: All core business logic—including `assertTicketAccess`, role-scoped queries (`buildTicketWhereClause`), ticket status transitions, SLA calculations, attendance logging, and spare part workflows—must be reused without duplicating server actions, API routes, or database schemas.
3. **Restricted Early Access**: Access to the `/fe-v2` route must be strictly limited to users defined in an allowlist environment variable (`FE_V2_USERS`) and system administrators (`SUPERADMIN`).
4. **Discreet Redirection**: Unauthenticated visitors must be redirected to `/login?redirect=/fe-v2`. Authenticated users not present in the allowlist must be redirected back to the classic dashboard (`/`) without exposing unauthorized route errors.

---

## Decisions

### 1. Dedicated App Router Segment (`/fe-v2`)
- Created `src/app/fe-v2/page.tsx` as a dynamic server component (`export const dynamic = "force-dynamic"`).
- Server-side guard validates session identity (`getSessionUser()`) and allowlist eligibility (`isUserInFeV2Allowlist(sessionUser)`) before rendering any UI components.

### 2. Strict Allowlist Matching Rule (`src/lib/feV2Access.ts`)
- Allowlist configuration is defined in `process.env.FE_V2_USERS` as a comma-separated list of items (e.g. `FE_V2_USERS="0165049373,raphflazz96@gmail.com"`).
- **Matching Criteria**:
  - `SUPERADMIN` role is always granted access.
  - **Email**: Exact, case-insensitive, trimmed match against `user.email` or `user.engineer.email`.
  - **Phone Number**: Normalized exact matching using `normalizePhoneNumber(raw)` (stripping non-digits and mapping international prefix `60...` to standard Malaysian mobile format `0...`) against `user.phone` or `user.engineer.phone` (`entryPhone === userPhone`).
  - **Explicit Non-Matches**: Strictly rejects substring, `endsWith`, username, or email prefix matching.

### 3. Shared Foundation Component (`src/app/components/fe-v2/FEV2Dashboard.tsx`)
- Established a dedicated foundation component for the v2 portal architecture while preserving 100% of existing operational capabilities:
  - Ticket lifecycle transitions (`acceptTicket`, `enrouteTicket`, `checkInTicket`, `updateTicketEta`, `updateTicketResolution`, `uploadServiceReport`, `requestTicketSparePart`, `markSparePartInstalled`).
  - Requestor & Asset info dynamically driven by Maincon Client schema (`getEffectiveCustomFields`).
  - Represented brand identity (`representAs`, `onSiteSop`) and printable Official Service Report preview modal.
  - Multi-image and service report upload with browser-side compression.
  - AI Resolution Copilot integration (`FeAiCopilotCard`).
- Standardized canonical English action terminology (`ACCEPT JOB`, `SET ETA / EN ROUTE`, `CHECK IN ON SITE`, `CHECK OUT & RESOLVE`, `CHECK OUT & FOLLOW-UP`, `RESUME WORK`).

### 4. Seamless Portal Switcher
- Enabled bidirectional switching for eligible accounts:
  - In classic UI (`FEDashboard.tsx`): Header and Settings tab render an active `FE v2 (Beta)` switch button when `user.canAccessFeV2 || user.role === "SUPERADMIN"`.
  - In `/fe-v2` (`FEV2Dashboard.tsx`): Header and Settings tab render a `← Classic UI` button linking back to `/`.

---

## Consequences
- **Zero Disruption**: Existing field engineers continue logging in and operating on `/` without any behavioral change.
- **Controlled Rollout**: Development and testing of next-generation Google Stitch designs can proceed iteratively within `/fe-v2`.
- **Maintainability**: Shared backend server actions eliminate divergence in security, authorization, and SLA enforcement.
