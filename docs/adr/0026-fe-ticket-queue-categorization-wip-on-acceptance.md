# ADR 0026: Field Engineer Queue Categorization - Moving Accepted and Enroute Tickets to WIP

## Status
Accepted (Supersedes ADR 0009)

## Context
1. **Queue Reactivity & Counter Desynchronization**: Under ADR 0009, newly dispatched tickets that were acknowledged (`feAcknowledgeStatus === "ACKNOWLEDGED"`, `subStatus === "FE_ACK"` or `"ACCEPTED"`) or enroute (`subStatus === "ENROUTE"`) remained categorized under the **NEW** queue tab and Home counter until physical on-site check-in (`status === "IN_PROGRESS"`).
2. **Operational Ambiguity**: Field engineers reported that clicking **ACCEPT JOB** produced no visible change on the Home dashboard counters (New vs WIP). The ticket remained counted as "New", leading technicians to believe their action was not recorded or that additional dispatch action was required.
3. **Cross-Portal Alignment**: Both the classic FE dashboard (`/`) and the next-generation portal foundation (`/fe-v2`) require an identical, shared categorization model to avoid behavioral drift.

---

## Decisions

### 1. Shared Ticket Bucket Classification (`src/lib/feTicketBuckets.ts`)
Created a centralized categorization utility shared by all FE portal UIs:
- **`NEW` (Unacknowledged Jobs)**:
  - Dispatched tickets strictly requiring first response from the technician (`status === "NEW"` AND `feAcknowledgeStatus !== "ACKNOWLEDGED"` AND `subStatus` is NOT `"FE_ACK"`, `"ACCEPTED"`, `"ENROUTE"`, or `"CHECKED_IN"`).
  - Badge: `⚡ Action Needed: Accept`.
- **`WIP` (Work In Progress)**:
  - Begins the moment the technician acknowledges the assignment.
  - Includes:
    - Accepted jobs (`feAcknowledgeStatus === "ACKNOWLEDGED"`, `subStatus === "FE_ACK"` or `"ACCEPTED"`).
    - Enroute journeys (`subStatus === "ENROUTE"` with ETA).
    - Active on-site servicing (`status === "IN_PROGRESS"` or `subStatus === "CHECKED_IN"`).
    - Paused & follow-up orders (`status === "ON_HOLD"` or `"FOLLOW_UP"`).
- **`RESOLVED`**:
  - Closed and completed service orders (`status === "RESOLVED"`, `"CLOSED"`, `"COMPLETE"`).
- **`OTHER`**:
  - Cancelled service orders (`status === "CANCELLED"`), excluded from active operational queues.

### 2. Synchronization of Counters and Service Order Filter Chips
- The Home metrics cards (`New`, `WIP`, `Resolved`) and the Service Orders filter chips (`NEW`, `WIP`, `RESOLVED`) consume the exact same `categorizeFeTickets(tickets)` memoized result.
- Selecting the `WIP` filter chip displays all Accepted, Enroute, In-Progress, and On-Hold jobs, perfectly matching the WIP counter on the Home tab.

---

## Consequences
- **Immediate Feedback**: Tapping `ACCEPT JOB` immediately decrements the `NEW` counter and increments the `WIP` counter, confirming receipt without waiting for physical on-site arrival.
- **Unified Logic**: Eliminates divergence between `/` (`FEDashboard.tsx`) and `/fe-v2` (`FEV2Dashboard.tsx`).
