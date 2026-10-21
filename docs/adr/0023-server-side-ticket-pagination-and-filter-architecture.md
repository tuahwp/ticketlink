# ADR 0023: Server-Side Ticket Pagination, Dynamic Filtering, and Preset Counts

## Status
Accepted

## Context
As the TicketLink database scaled beyond 1,000 tickets, client-side data management presented two critical bottlenecks:
1. **Security & Bandwidth**: Initial SSR rendering of `/` previously queried all tickets and nested relations into raw HTML, producing a ~4.8 MB unauthenticated payload and leaking sensitive data.
2. **Client-Side Slicing Bug**: After moving to server pagination, `Dashboard.tsx` previously held only the initial 50 tickets in memory and attempted to paginate, filter, and count locally on that 50-item slice (`visibleTickets.length`). Consequently:
   - The "All Tickets" tab badge showed 50 instead of the real total (1,002 in production; 489 in local staging).
   - Universal search only searched within the 50 loaded tickets, failing to retrieve older archived tickets (e.g. from August 2026).
   - Navigating to subsequent pages beyond page 1 did not retrieve data from the server.
   - Background refresh called `getTickets()` with no arguments, clobbering active filters and page positions.

## Decisions

### 1. Unified Server-Side Query Execution (`getTickets`)
- All pagination (page, pageSize), preset tab switching (`viewPreset`), universal searching (`search`), multidimensional filtering (`status`, `severity`, `mainconId`, `state`, `partnerId`, `endCustomer`, `assignedFeId`, `slaHealth`, `reportFilter`, `subStatus`, `feAck`, `createdBy`, `dateRange`), and column sorting (`sortBy`, `sortOrder`) are executed as indexed PostgreSQL queries in `src/app/actions.ts`.
- **Page Size Limits**: Hard-capped on the server between 10 and 250 records (`Math.min(250, Math.max(10, options?.pageSize || 15))`).
- **Initial SSR Default**: Aligned with the initial UI view preset (`viewPreset: "all_active"`, `pageSize: 15`), ensuring zero count jumping on initial load.

### 2. Dual-Scope Counts: Global Tab Badges vs. Filtered Footer
- **Preset Tab Badges**: Reflect global queue volumes for the user's role (Superadmin/Moderator: all database tickets; Agent: all tickets belonging to their partner; Field Engineer: assigned tickets). This preserves permanent situational awareness of overall queue health.
- **Table Footer**: Accurately reports the filtered dataset count (`Showing X to Y of Z tickets`) matching the exact criteria currently applied.
- **Empty Preset Search Suggestion**: If universal search yields 0 results within an active preset tab (e.g. *Active Queue*), the UI provides a 1-click helper action prompting the user to search in *All Tickets*.

### 3. Search Debounce & Pagination Reset
- Universal search input is debounced by 300ms to eliminate redundant database roundtrips during continuous keystrokes.
- Initiating a search or altering any filter automatically resets `currentPage` back to `1`.

### 4. Background Sync & Polling Guardrails (`refreshData`)
- Background polling runs every 20 seconds using the active page and active filter parameters, preventing view clobbering.
- Polling is paused immediately when the browser tab is hidden (`document.hidden`), resuming on `visibilitychange` or window focus.

### 5. On-Demand Full Exports & Analytics
- CSV export invokes `getTicketsForExport` with all current active filters, streaming the complete matching dataset rather than the current page slice.
- Analytics tab consumes `getTicketsAnalytics` on demand, loading the lightweight analytics dataset across the user's scoped queue.

### 6. Field Engineer Dashboard (`FEDashboard`)
- Mobile field engineers are allocated up to `pageSize: 250` per fetch, ensuring immediate, smooth card-based access to all assigned active orders and recent history without multi-page button friction.

## Consequences
- **Positive**: Blazing fast page loads (< 200 KB); accurate global counts (e.g. 1,002 in All Tickets); full historical search accessibility; clean separation between global preset metrics and active table filters.
- **Negative / Trade-off**: Page navigation and filter changes require lightweight asynchronous server roundtrips (~30-60ms) instead of instant in-memory DOM swapping.
