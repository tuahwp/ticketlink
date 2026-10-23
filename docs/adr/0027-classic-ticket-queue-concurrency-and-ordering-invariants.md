# ADR 0027: Classic Ticket Queue Concurrency Guard and Stable Ordering Invariants

## Status
Accepted

## Context
1. **Queue Jitter & Disappearing Rows**: Users observing the Active Queue on the classic dashboard (`Dashboard.tsx`) experienced sudden row jumping and ticket disappearance from Page 1 without interacting with the screen. Performing a search still located the ticket.
2. **Root Cause - Uncoordinated Race Conditions**: `fetchTickets()` (triggered by pagination, filter, or preset changes) and `refreshData()` (triggered by 20-second interval polling, `window.focus`, and `document.visibilitychange`) both dispatched asynchronous calls to `getTickets` and unconditionally invoked `setTickets()`, `setTotalTickets()`, and `setPresetCounts()`. If an earlier request experienced higher network latency, its stale response resolved *after* a newer request, overwriting state with stale data.
3. **Dual Trigger on Tab Switch**: Switching back to the browser tab fired `visibilitychange` and `window.focus` almost simultaneously, creating two overlapping, in-flight background sync calls.
4. **Ordering Divergence**: `buildTicketOrderBy` in `src/app/actions.ts` lacked deterministic tie-breakers, and defaulted to `createdAt: desc` instead of `reportedAt: desc`. On initial page load (`page.tsx`), no `sortBy` was passed, resulting in initial server rendering sorted by `createdAt`, which clashed with the client's default `sortField === "reportedAt"` upon subsequent refreshes. Tickets with overridden `reportedAt` (e.g. reported earlier in the day but entered later) jumped above newer tickets.

---

## Decisions

### 1. Monotonic Request Invalidation (`latestRequestIdRef`)
- Added a mutable `latestRequestIdRef = useRef(0)` in `Dashboard.tsx`.
- Every dispatch from `fetchTickets` and `refreshData` increments `latestRequestIdRef.current` to acquire a unique request sequence number.
- Upon Promise resolution, if the captured sequence number does not match `latestRequestIdRef.current`, the entire payload is rejected. No partial or stale state updates (`setTickets`, `setTotalTickets`, `setPresetCounts`, or master lookups) are committed.

### 2. In-Flight Execution Guard & Debounced Event Coalescing (`inFlightRef`)
- Added `inFlightRef = useRef(false)` to prevent overlapping background sync calls. Polling intervals and window events skip execution if a sync operation is already underway.
- Implemented a 300ms coalescing debounce (`focusDebounceRef`) for `window.focus` and `document.visibilitychange`. Overlapping tab activations within 300ms coalesce into a single background fetch.

### 3. Stable 3-Tier Ordering & Standardized Default (`buildTicketOrderBy`)
- Every sort clause in `buildTicketOrderBy` enforces a deterministic 3-level order specification:
  `[{ <field>: dir }, { createdAt: "desc" }, { id: "desc" }]`.
- Default sort order (when `sortBy` is absent or unassigned) is standardized to `[{ reportedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }]`.
- `src/app/page.tsx` explicitly passes `sortBy: "reportedAt", sortOrder: "desc"` on initial SSR to guarantee 100% parity with client queue state.

### 4. Backfill Utility for Null `reportedAt`
- Provided `scripts/backfill_reported_at.js` (with dry-run default and production guards) to backfill legacy records where `reportedAt IS NULL` with `createdAt`.

---

## Consequences
- **Stable Active Queue**: Tickets on page 1 remain visually pinned without jumping or disappearing during silent polling or tab switching.
- **Zero Race Conditions**: Slower server responses from previous filter states or background polls can never overwrite fresh user queries.
- **Predictable Ordering**: The Tickets Queue deterministically orders by `reportedAt` descending, with `createdAt` and `id` tie-breakers preventing any non-deterministic Postgres row shuffling.
