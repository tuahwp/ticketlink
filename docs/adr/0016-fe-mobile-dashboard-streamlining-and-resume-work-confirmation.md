# ADR 0016: FE Mobile Dashboard Streamlining & Resume Work Confirmation

## Status
Accepted

## Context
Based on field feedback from Field Engineers (FEs) using the mobile portal on-site:
1. **Accidental Work Resumption**: When reviewing a ticket in `FOLLOW_UP` or `ON_HOLD`, tapping the `"RESUME WORK"` button would instantly change ticket status back to `IN_PROGRESS` without confirmation. Engineers occasionally triggered this accidentally while scrolling or viewing details, causing premature SLA tracking.
2. **Navigation Clutter**: The bottom navigation had 5 tabs (`Home`, `Service Order`, `Timeline`, `Working Schedule`, `Setting`). The `Timeline` and `Schedule` tabs duplicated the main service order feed and added cognitive overhead and cramped touch targets on mobile.
3. **Redundant Header Labels & Action Buttons**:
   - The top header displayed a redundant text pill (`Home`, `Service Order`, etc.) that repeated the active view name.
   - The greeting row featured a static `?` button that only produced a generic support toast and a notification bell that actually performed a manual refresh.
4. **Ticket Detail Exit Bug**: Tapping the Home icon in ticket detail caused the view to briefly flash the order list and then bounce back into the ticket because `syncFETickets` closed over the stale `selectedTicket` state.

## Decision

1. **Resume Work Confirmation Dialog**:
   - Tapping `"RESUME WORK"` now opens a dedicated bottom sheet modal displaying the ticket reference, site name, and an explicit prompt: *"Resume On-Site Work? Are you back on-site at [Site]? This will change ticket status back to IN PROGRESS and resume operational SLA tracking."*
   - Requires explicit confirmation via `[Confirm & Resume]`, completely preventing accidental single-tap status regressions.

2. **Streamlined 3-Tab Mobile Navigation**:
   - Deprecated and removed the redundant `Timeline` (Tab 3) and `Working Schedule` (Tab 4) views.
   - Standardized the bottom navigation to a clean 3-tab layout:
     - 🏠 **Home**: Quick metrics (New, WIP, Resolved), attendance switcher (`Clock In`, `On Duty`, `On Break`, `Clock Out`), and dispatch quick actions.
     - 📋 **Service Orders**: Comprehensive search, status filters (`ALL`, `NEW`, `WIP`, `RESOLVED`), and ticket cards with real-time badge counters.
     - ⚙️ **Profile & Settings**: Photo upload, contact details, and account security.

3. **Header Clean-Up**:
   - Removed the top view name pill badge; replaced it with a discreet `ThemeToggle` for instant light/dark mode switching on-site.
   - Removed the unnecessary `?` button.
   - Replaced the misleading bell icon with a dedicated, clean **Sync Orders** button that visually spins during real-time synchronization.

4. **Single Back Navigation & Closure Bug Fix**:
   - Replaced the dual `[←]` + `[🏠]` buttons in ticket detail with a single prominent Back arrow (`←`).
   - Replaced direct state closure in `syncFETickets` with a synchronous ref (`selectedTicketRef`). When an engineer taps Back, `selectedTicketRef.current` is immediately cleared to `null`, ensuring background syncs never resurrect the closed ticket view.

## Consequences
- **Positive**:
  - Dramatically cleaner, spacious mobile experience with larger touch targets and no horizontal tab crowding.
  - Zero accidental transitions to `IN_PROGRESS` from follow-up states.
  - Smooth, predictable back navigation without state flicker or bounce-backs.
- **Negative / Considerations**:
  - Engineers who previously looked for activity feeds can view ticket-specific activities directly inside the Ticket Detail timeline modal (`💬`).
