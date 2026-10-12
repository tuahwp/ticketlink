# ADR 0013: Server-Persisted Saved Views and No SLA Severity Normalization

## Status
Accepted

## Context
1. **Ticket Queue customization lived only in the browser**:
   - Visible columns were stored in `localStorage` (`ticketlink_visible_columns`). Filters and sort were held in React state and lost on reload.
   - Operators work from multiple machines (office desktop, laptop, phone) and could not carry a curated queue (e.g. "My P1s in Selangor") between them.
2. **Two representations of "no SLA"**:
   - Creating a ticket with "NA - No SLA" stores `severity = 'NA'`.
   - The edit form's empty option stores `severity = NULL`, which rendered an empty Severity cell and was invisible to filters and analytics.
   - Some legacy `NULL`-severity tickets still carry an `slaDeadline` computed before the edit.

## Decision
1. **Saved Views are persisted server-side, per user**:
   - A new `SavedView` table owned by `User` stores: name, base Quick View, filter set, sort field/direction, visible columns, `isPinned`, `isDefault`.
   - Pinned Saved Views render as tabs after the built-in Quick Views; one view per user may be the default on load. Soft cap of ~10 per user.
   - Scope is personal only. The schema leaves room for a later `sharedWithRole` / `partnerId` scope without migration of existing rows.
   - Column Presets (Compact / Standard / Full Detail) remain built-in and filter-free.
   - Active filters are also mirrored into the URL query string so any queue state is linkable without saving a view.
2. **Severity is never blank**:
   - "No SLA" (`NA`) is the single representation for tickets without an SLA target. The edit form loses its empty option.
   - One-off normalization: `NULL` severity **with no** `slaDeadline` → `NA`. `NULL` severity **with** an `slaDeadline` is not guessed; it is listed for an admin to classify manually.
3. **SLA means resolution SLA**:
   - SLA compliance compares `slaDeadline` (already extended by paused time on resume) with `resolvedAt`.
   - "Average time to check-in" is reported as an informational metric only; a separate Response SLA is not introduced until contracts require it.

## Alternatives Considered
- **Keep Saved Views in `localStorage`**: zero schema change, but views don't follow the user across devices and can't later be shared with a team.
- **Map all `NULL` severities to `NA` (or `P3`)**: simpler, but would silently drop or invent SLA commitments on legacy tickets.

## Consequences
- **Positive**: Queue setups follow the user across devices; shareable links via URL filters.
- **Positive**: Severity column, filters and analytics have one consistent "No SLA" bucket.
- **Negative**: New table + CRUD actions to maintain; view payloads must tolerate columns/filters that are renamed or removed later (unknown keys are ignored on load).
- **Negative**: A small set of legacy tickets requires manual admin review before normalization completes.
