# ADR 0003: Hybrid Partner Warehouse Registration, Superadmin Linking & Multi-Depot Support

## Status
Accepted

## Context
Regional Service Partners need to maintain physical depots and repair hubs across various Malaysian states (e.g., Penang Hub, Alor Setar Branch, Johor Depot). 
Questions arose regarding whether:
1. Warehouses must be strictly created and pre-assigned by Superadmin/HQ.
2. Agents can self-register their local depots.
3. Existing warehouses in the database can be linked or reassigned to partners.
4. Partners can operate multiple warehouses or strictly one.

## Decision
1. **Hybrid Registration Model**:
   - **Superadmin & Moderator**: Have global warehouse provisioning rights. They can create warehouses, edit existing warehouses in the database, and assign/link any warehouse to any `ServicePartner` (or leave it unassigned as an `HQ Central Warehouse`).
   - **Agent**: Can directly register new local warehouses via the `+ Register Local Depot` button. The backend automatically locks the warehouse's `partnerId` to the Agent's company (`sessionUser.partnerId`), preventing accidental or unauthorized assignment to other partners.
2. **Existing Warehouse Migration & Linking**:
   - Superadmins and Moderators can click the **Edit (✏️)** button on any existing warehouse in the Warehouses subtab and select a `ServicePartner` from the dropdown. This immediately grants the linked partner access to that warehouse and its inventory.
3. **Multi-Depot Scoping**:
   - Service Partners are permitted to operate multiple regional warehouses (e.g., primary state depot and transit hub).
   - Agents see all warehouses belonging to their partner company.
4. **Tenant-Safe Modification & Deletion**:
   - Agents can update contact details or addresses of warehouses owned by their company, and can delete empty warehouses that contain 0 inventory items.
   - Deletion of non-empty warehouses is blocked across all roles until inventory items are reassigned or deleted.

## Consequences
- **Positive**: Eliminates bottlenecks for HQ while guaranteeing complete multi-tenant safety and allowing existing legacy warehouses to be seamlessly linked.
- **Auditing**: All creation and modification actions are tracked and scoped by session role.
