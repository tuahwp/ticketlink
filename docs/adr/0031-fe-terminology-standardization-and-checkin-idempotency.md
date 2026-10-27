# ADR 0031: Field Engineer Terminology Standardization and Check-In Idempotency

## Status
Accepted

## Context
1. **Terminology Fragmentation & Mobile Layout Clipping**:
   - The Field Engineer interfaces (`FEDashboard.tsx` and `fe-v2/FEV2Dashboard.tsx`) featured mixed, overly verbose terminology (e.g. *"Daftar Masuk Tapak (Check-In)"*, *"Selesaikan & Daftar Keluar (Resolve)"*, *"Ditangguhkan (Menunggu Alat Ganti)"*, *"Sambung Semula Kerja di Tapak?"*).
   - Verbose labels caused horizontal overflow and button text wrapping on compact mobile displays (such as 360x740 Samsung Galaxy and 375x667 iPhone SE).
   - Confirmation dialogs and toast alerts varied between dashboards, causing inconsistent field user experience.
2. **Check-In Duplicate Ingestion (Non-Idempotency)**:
   - When an engineer triggered `checkInTicket` on a ticket that was already `CHECKED_IN` (e.g., from network retries, double taps, or detail modal re-submissions), the server unconditionally appended redundant `ticketActivity` entries ("Field Engineer arrived on-site and checked in...").
   - This cluttered audit histories and distorted multiple check-in counters `(xN)`.

---

## Decisions

### 1. Standardized Field Operational Terminology
All FE mobile interfaces, ticket cards, status chips, bottom sticky action docks, and transition definitions (`src/lib/ticket-transitions.ts`) adopt concise, universally recognized English terms for action buttons and status badges, paired with natural, professional Bahasa Melayu for descriptive content, dialogs, and toast messages:

| Domain / Concept | Standard English Term (Buttons / Badges) | Contextual Malay (Toasts / Dialogs) |
| :--- | :--- | :--- |
| On-site arrival | **Check-In** | *"Check-In berjaya! Status tiket kini In Progress."* / *"Masa Check-In:"* |
| Secondary / paused visit | **Follow-Up** | *"Check-Out berjaya, tiket kini Follow-Up."* / Form: *"Check-Out & Follow-Up"* |
| Ticket paused / parts wait | **On Hold** / **On Hold (Tunggu Spare Part)** | *"Tiket diletakkan dalam status On Hold."* |
| Work active on-site | **In Progress** | *"Status tiket kini In Progress."* |
| Dispatched work item | **Service Order** (SO) | *"Service Order diterima!"* / *"Cari Service Order"* |
| Replacement components | **Spare Part** | *"Spare Part Diperuntukkan"* / *"Nombor Siri (S/N) Spare Part Rosak"* |
| Formal sign-off sheet | **Service Report** | *"Service Report Bertandatangan \*"* / *"Lihat Service Report Bertandatangan"* |
| Return to site | **Resume** / **Sahkan & Resume** | Modal: *"Adakah anda telah kembali ke tapak di {site}? Status tiket akan kembali ke IN PROGRESS dan SLA disambung semula."* |
| Acknowledge job | **Terima Tugasan** | *"Service Order diterima!"* |

### 2. Sticky Action Dock Geometry (360px Mobile-First)
- Dual-button sticky action docks (`Resolve` + `Follow-Up`, `Check-In` + `Set ETA`, `Check-In` + `Kemas Kini ETA`, `Resume`) use concise uppercase or title-cased English action verbs.
- Guarantees minimum 48px touch targets without horizontal clipping or ugly hyphenation on 360px viewport widths.

### 3. Server-Side Check-In Idempotency (`checkInTicket`)
- In `src/app/actions.ts`, before applying database mutations, `checkInTicket` inspects `subStatus` and `status`:
  ```typescript
  const sub = ticketBefore?.subStatus?.toUpperCase();
  const isAlreadyCheckedIn =
    sub === "CHECKED_IN" && stat !== "ON_HOLD" && stat !== "FOLLOW_UP";
  if (isAlreadyCheckedIn) {
    return JSON.parse(
      JSON.stringify({
        ok: true,
        alreadyCheckedIn: true,
        ...ticketBefore,
      })
    );
  }
  ```
- **Guaranteed Invariants**:
  1. If a ticket is already in active `CHECKED_IN` status (and not resuming from `ON_HOLD` / `FOLLOW_UP`), no duplicate `ticketActivity` is inserted, no DB write is performed, and `{ ok: true, alreadyCheckedIn: true, ...ticket }` is returned.
  2. Resuming from `ON_HOLD` or `FOLLOW_UP` explicitly creates a new arrival check-in activity record to document multiple site visits accurately.
  3. Single serialization: returns are wrapped in `JSON.parse(JSON.stringify(...))` once to avoid redundant serialization overhead.
  4. Client dashboards detect `res.alreadyCheckedIn` to display an informative toast (`"Tiket sudah Check-In."`), close modals safely, and resynchronize ticket state.

---

## Consequences
- **Responsive Simplicity**: Action buttons and badge chips render cleanly on small smartphone screens (360px–390px) without horizontal scrolling or text overflow.
- **Timeline Integrity**: Duplicate check-in actions no longer generate redundant timeline noise or inaccurate multi-visit counts.
- **Consistent UX**: FE Classic and FE v2 share identical modal prompts, toast notifications, and action wording.
- **Backward Compatibility**: Returning the full ticket spread alongside `{ ok: true, alreadyCheckedIn }` preserves compatibility with all existing callers.
