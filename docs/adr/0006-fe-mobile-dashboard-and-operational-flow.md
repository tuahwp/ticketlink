# ADR 0006: Field Engineer Mobile Dashboard Redesign and Operational Flow

## Status
Accepted

## Context
The Field Engineer (FE) mobile experience previously relied on an "Acknowledge" concept with a dense multi-tab layout. Field engineers operating on mobile devices need a clean, high-contrast, uncluttered UI optimized for one-hand operation on-site. The dispatch lifecycle needed to be simplified and aligned with real-world field service operations: from receiving a job, traveling, arriving at the branch, to completing work.

## Decision

### 1. Operational Flow Lifecycle
Deprecate the legacy `feAcknowledgeStatus` and replace it with a sequential, single-action operational flow:
- **`NEW` (Dispatched)**: Ticket assigned to FE. Action button: **`ACCEPT`**.
- **`ACCEPTED`**: Job confirmed by FE. Action button: **`ENROUTE`** (traveling to site).
- **`ENROUTE`**: Engineer in transit. Action button: **`CHECK IN`** (arrived on-site, timestamps arrival, updates status to `IN_PROGRESS`).
- **`IN_PROGRESS` (Checked In)**: FE working on-site. Dual action choices:
  - 🟩 **`CHECK OUT & RESOLVE`**: Work complete on-site. Uploads signed service report photo, records resolution details, and logs replaced defective component serials.
  - 🟧 **`CHECK OUT & FOLLOW-UP`**: Work incomplete/paused on-site. Selects follow-up reason (`Pending Spare Parts`, `Pending Site Access`, `Equipment Monitoring`, `Secondary Revisit`), submits spare part request directly to central warehouse, records visit notes, and checks out from current visit.
- **`FOLLOW_UP` / `ON_HOLD`**: Ticket categorized in WIP with `📦 Pending Parts` badge. Single CTA button: **`RESUME WORK / REVISIT`** to begin subsequent visit.
- **`RESOLVED`**: Work completed and signed off.

### 2. Mobile Home Dashboard (Screen 1)
- **Top Bar**: TicketLink brand logo (`/logo.jpg`), engineer greeting (`Hi <Name>`), subtext (`TicketLink Field Operations`), Help (`?`) and Notification Bell.
- **Attendance Card**: Interactive `Your current status: Clock In / Clock Out / On Duty / On Break` with quick status switcher.
- **Queue KPI Cards**:
  - 🟦 **New** (`No. of Service Order` + counter)
  - 🟧 **WIP / In Progress** (`No. of Service Order` + counter)
  - 🟩 **Resolved** (`No. of Service Order` + counter)
- Tapping any metric card immediately routes to the Service Order list filtered by that status.
- **Bottom Navigation**: `Home` | `Service Order` | `Timeline` | `Schedule` | `Setting`.

### 3. Service Order Listing (Screen 2)
- Unified search bar (`SO Number, Site, Summary, Status`).
- Quick filter tabs (`All`, `New`, `WIP`, `Resolved`).
- Streamlined Ticket Cards:
  - Header: Left logo icon, Ticket Reference (`SO-0045566`).
  - Body: Issue summary, Site name (`AFFINBANK Alor Setar`).
  - Footer Badges: Status pill (`New`, `Enroute`, `Checked-In`), SLA Countdown pill (`⏰ 1D 2H 46M`), Severity badge (`P1`, `P2`, `P3`, `P4`).

### 4. Ticket Detail & Action View (Screen 3)
- **Top Stats Grid**: Status badge, Time left (live SLA timer countdown), Severity level.
- **Issue Summary Card**: Clear clipboard icon with formatted issue summary.
- **Location Card**: Site name, full address, and one-tap **Navigate (Google Maps / Waze)** button.
- **Description Card**: Full problem description with quick copy action.
- **Sticky Bottom Action Bar**: Single prominent full-width CTA matching the current operational state (`ACCEPT` ➔ `ENROUTE` ➔ `CHECK IN` ➔ `CHECK OUT & RESOLVE`).

### 5. Platform-wide "Acknowledge" Removal
- Remove legacy "Acknowledge" and "Pending Ack" terminology from Admin Ticket Workspace, filters, table headers, and activity logs.
- Replace with modern operational statuses (`Accepted`, `Enroute`, `Checked-In`, `In Progress`, `Resolved`).

## Consequences
- **Positive**:
  - High-clarity, intuitive UI tailored for on-site mobile usage.
  - Zero cognitive friction for engineers: one clear primary action at each lifecycle stage.
  - Real-time milestone visibility (travel time, arrival time, resolution time) for dispatchers and clients.
- **Negative**:
  - Requires updating legacy ticket records to default to modern flow status representations.
