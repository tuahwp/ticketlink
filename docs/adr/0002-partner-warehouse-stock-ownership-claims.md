# ADR 0002: Dual-Ownership Partner Warehouses, Stock Transfers & Replacement Claims

## Status
Accepted

## Context
TicketLink coordinates warranty and on-site hardware maintenance across central operations and regional Service Partner agencies. Previously:
1. Inventory items were treated as a single homogenous pool located in warehouses without explicit ownership distinction.
2. In the Dispatch Queue, tickets with parts already installed continued to appear or show misleading "Allocate Part Now" buttons.
3. Central HQ transfers buffer spare parts to partners to hold as local consignment stock, and partners also procure/register their own parts to resolve tickets on the spot.
4. Partners needed a transparent way to register their local inventory, allocate parts to their dispatched tickets, and submit replacement claims (for physical hardware replenishment or financial reimbursement) after replacing client parts.

## Decision
1. **Clean Dispatch Queue Filtering**:
   - The Pending Dispatch Queue strictly filters tickets that have parts in actionable states (`PENDING_APPROVAL`, `APPROVED`, `DISPATCHED`).
   - Tickets where all parts are `INSTALLED`, `RETURNED`, or `CANCELLED` are cleanly archived from the pending dispatch queue.

2. **Stock Ownership Tracking (`StockOwnership`)**:
   - Introduce `StockOwnership` enum with `HQ_CONSIGNED` and `PARTNER_OWNED`.
   - Every `InventoryItem` records its `ownership` type.
   - Warehouses are categorized as Central HQ (`partnerId: null`) or Partner Warehouses (`partnerId: <id>`).

3. **Inter-Warehouse Stock Transfers (`WarehouseTransfer`)**:
   - Enable HQ admins to transfer stock batches from Central Warehouses to Partner Warehouses as consignment buffer stock.
   - Maintains a full audit log of item location history and custody transitions.

4. **Part Replacement Claims (`PartReplacementClaim`)**:
   - When a partner deploys `PARTNER_OWNED` stock or replaces hardware on a ticket, a claim is recorded.
   - Superadmins and Moderators can review claims, inspect the defective serial number and site visit slip, and either approve replenishment (dispatch replacement hardware from Central) or approve reimbursement.

5. **Governed Partner Autonomy**:
   - `AGENT` users can view and register `PARTNER_OWNED` items in their company's warehouse (`partnerId`).
   - `SUPERADMIN` and `MODERATOR` retain full governance over central inventory, approvals, inter-warehouse transfers, and claim settlements.

## Consequences
- **Positive**: Complete financial clarity on hardware custody, zero ambiguity during audits, faster SLA response time by utilizing local partner buffer stock, and automated claim settlement tracking.
- **Maintenance**: Requires database schema migrations and validation logic to prevent cross-partner inventory leaks.
