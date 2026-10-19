# ADR 0022: Erroneous Spare Part Allocation Recovery, Stock De-allocation, and Request Deletion

## Status
Accepted

## Context
In field service operations, warehouse personnel or dispatch staff occasionally link or allocate the incorrect physical inventory serial number or part model to a ticket (e.g. allocating an OKI B412 Drum with S/N `225C002948B1KA` when a different unit or part was needed). 

Previously:
1. The ticket UI only exposed a "Cancel" button for requests in `PENDING_APPROVAL`, `REQUESTED`, or `APPROVED` status.
2. Once a part transitioned to `ALLOCATED` or `DISPATCHED` (with courier tracking details attached), no delete, cancel, or unlink controls existed in the UI.
3. If an incorrect allocation was dispatched, operators were blocked and could not correct the assignment, leaving warehouse stock trapped in `IN_TRANSIT` or `RESERVED` states and preventing proper re-allocation.
4. Organizations require strict role-based controls so only `SUPERADMIN` and `MODERATOR` roles can perform removals, while preserving complete audit logs of physical stock adjustments.

## Decisions

### 1. Two-Tiered Recovery: De-allocate vs. Permanent Deletion
Superadmins and Moderators have two distinct corrective capabilities when viewing tickets under the **Spare Parts & Loaners** tab:
1. **De-allocate (Unlink Stock)**:
   - Preserves the requester's need for the part.
   - Clears `inventoryItemId`, courier name, dispatch tracking number, and dispatched timestamp from the `TicketSparePart` record.
   - Reverts request status back to `APPROVED` so warehouse staff can promptly allocate the correct serial number.
   - Automatically returns the physical `InventoryItem` back to `AVAILABLE` status in its originating warehouse.
2. **Permanent Deletion**:
   - Completely removes the `TicketSparePart` record from the ticket when a request was submitted mistakenly or is no longer required.
   - Automatically releases any linked `InventoryItem` back to `AVAILABLE` stock (or replenishes available quantity for bulk consumables).
   - Clears any downstream purchase order item associations (`partOrderItem.ticketSparePartId`).

### 2. Physical Inventory Re-stocking & Audit Traceability
- Whenever an allocation is removed or deleted:
  - Serialized items: `status` is set to `AVAILABLE`, and `availableQuantity` is set to `1`.
  - Bulk items: `availableQuantity` is incremented by the allocated amount, and status is set to `AVAILABLE`.
  - An immutable entry is written to `InventoryLog` (`action: "ALLOCATION_REMOVED"` or `"ALLOCATION_CANCELLED"`) noting the ticket reference number, serial number, originating warehouse, and the actor responsible.
  - A corresponding comment is created on `TicketActivity` documenting who performed the action, which serial number was unlinked, and that warehouse stock was restored.

### 3. Role-Based Access Control (RBAC) & State Guardrails
- **Restricted Roles**: Only users with `role: "SUPERADMIN"` or `"MODERATOR"` can trigger de-allocation or deletion. Agents and Field Engineers have read-only access to allocated/dispatched parts.
- **Permitted States**: De-allocation and deletion are available while parts are in `PENDING_APPROVAL`, `REQUESTED`, `APPROVED`, `ALLOCATED`, and `DISPATCHED` states.
- **Terminal Protection**: Parts already marked `INSTALLED` cannot be unlinked or deleted through this mechanism; installed hardware requires formal warranty RMA or replacement claim workflows.

## Consequences
- **Positive**: Eliminates deadlocked tickets caused by human data-entry or allocation mistakes; guarantees zero orphaned warehouse inventory; provides full timeline auditability.
- **Negative / Operational Requirement**: Requires field engineers or couriers to be notified out-of-band if a physical package was already handed over to a courier before the system de-allocation occurred.
