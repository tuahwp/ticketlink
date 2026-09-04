# Domain Context & Glossary: Inventory & Spare Parts Hub

## Core Concepts

### 1. Warehouses & Dual-Tier Storage (`Warehouse`)
Physical storage facilities where spare parts and hardware are held.
- **Central HQ Warehouse (`partnerId: null`)**: Managed and owned by central operations/main contractor. Acts as the primary procurement and replenishment hub.
- **Partner Local Warehouse (`partnerId: <id>`)**: Local buffer warehouse located at a Service Partner's agency office or regional depot. Holds both consigned HQ buffer stock and partner-owned stock.

### 2. Stock Ownership Types (`StockOwnership`)
Explicit financial and legal ownership attribution for physical hardware items:
- **`HQ_CONSIGNED`**: Procured and owned by HQ/Maincon, stored at Central or transferred to Partner warehouses as consignment buffer stock.
- **`PARTNER_OWNED`**: Procured or registered directly by the Service Partner agency for use by their field engineering team.

### 3. Inventory Item (`InventoryItem`)
A physical asset or component stocked in a warehouse.
- **Serialized**: Unique item identified by a specific `serialNumber` (e.g., Motherboard, Router, Switch, POS Terminal).
- **Bulk**: Quantity-tracked consumable item without unique serials (e.g., Patch cords, Power cables, RAM sticks).
- **Loaner Unit**: An inventory item provided on a temporary standby basis that must be returned once the primary unit is serviced.

### 4. Inter-Warehouse Stock Transfer (`WarehouseTransfer`)
Movement of inventory items from Central HQ Warehouses to Partner Warehouses (or vice-versa) to maintain healthy local buffer levels without direct ticket consumption.

### 5. Spare Part Request & Allocation (`TicketSparePart`)
A request for physical components needed to resolve a specific `Ticket`.
- **Single or Multi-Part**: Multiple spare part items can be requested and allocated to a single ticket.
- **Dual-Path Allocation**:
  - **HQ Dispatch Path**: Central warehouse allocates and dispatches via courier (PosLaju, GDEX, J&T, etc.) to the site or FE.
  - **Partner Buffer Path**: Allocated directly from the assigned Partner's local warehouse buffer for immediate on-site deployment.
- **Batch Dispatch Consignment**: A grouped shipment of one or more allocated parts dispatched under a shared consignment/tracking number.

### 6. Part Replacement & Cost Claim (`PartReplacementClaim`)
When a partner agency deploys their own local stock (`PARTNER_OWNED`) or consumes consigned buffer to resolve a client ticket, a claim is generated to close the loop:
- **`PENDING`**: Claim submitted with replaced defective serial number and site visit slip.
- **`APPROVED_REPLENISH`**: HQ approves claim and transfers a replacement unit from Central Warehouse to replenish the Partner's Warehouse.
- **`APPROVED_REIMBURSE`**: HQ approves monetary reimbursement for the partner.
- **`REJECTED`**: Claim declined with an audit note.

### 7. Request Lifecycle & States (`SparePartRequestStatus`)
- `PENDING_APPROVAL`: Initial state when requested by an Agent or Field Engineer.
- `APPROVED`: Reviewed and approved by a Superadmin or Moderator.
- `REJECTED`: Declined by Superadmin/Moderator with a specified reason.
- `CANCELLED`: Voided by requester or admin prior to dispatch.
- `ALLOCATED`: Tied to a specific warehouse stock item (stock state changes to `RESERVED`).
- `DISPATCHED`: Shipped via courier or transferred (state changes to `IN_TRANSIT`, tracking number attached).
- `INSTALLED`: Received and installed on-site by Field Engineer (replaces defective component).
- `ON_LOAN`: Active loaner unit deployed on site.
- `RETURN_IN_TRANSIT`: Defective or loaner part returning to warehouse.
- `RETURNED`: Defective or loaner part received at warehouse and restocked or marked for RMA.

### 8. End-Customer Sites & Branches (`EndCustomerSite`)
Pre-seeded directory of physical client offices and branch locations grouped by agency/customer and assigned to a Main Contractor:
- **`name`**: Full physical branch title (e.g., `JPJ Cawangan Putrajaya (Galeria)`).
- **`group`**: Agency or customer group identifier (e.g., `JPJ`, `RELA`, `KWSP`).
- **`state`**: Malaysian state where the branch is located (e.g., `Selangor`, `W.P. Putrajaya`).
- **`mainconId`**: The associated Main Contractor for this project/contract.
- **Bulk CSV Upsert**: Managed via batch CSV upload with upsert semantics (`name` + `mainconId`) and inline editing capabilities.
- **Ticket Auto-Population**: Selecting a pre-seeded site during ticket creation automatically resolves `clientSiteName`, `state`, and `endCustomer`.

### 9. Device Catalog & Hardware Models (`DeviceCatalog`)
Pre-approved hardware repository cataloging supported client equipment models:
- **`category`**: Hardware classification (e.g. `Desktop`, `Laptop`, `Printer`, `Router`, `Switch`, `Firewall`, `POS Terminal`, `Server`, `Scanner`, `UPS`, `Access Point`).
- **`brand`**: OEM / Manufacturer (e.g. `Dell`, `HP`, `Lenovo`, `Cisco`, `Zebra`, `Epson`).
- **`model`**: Exact hardware model number/name (e.g. `OptiPlex 7090`, `LaserJet Pro M404`).
- **`isStandard`**: `true` = Standard contract model with fast SLA; `false` = Non-standard / On-Request model.
- **`restrictedTo`**: Optional agency scoping (e.g. restricted specifically to `"JPJ"` or `"RELA"`, or `null` for General pool).
- **Bulk CSV Upsert**: Managed via batch CSV import with `(category + brand + model)` uniqueness and CSV export.
- **Ticket & Agency Linkage**: During ticket creation, filtering by End-Customer automatically scopes device catalog suggestions to match contract restrictions.

### 10. Role Permissions Matrix
- **Superadmin & Moderator**:
  - Full CRUD on Central and Partner Warehouses, master stock, and inter-warehouse transfers.
  - Approve, Reject, Cancel, Allocate, and Dispatch spare parts.
  - Review, approve, and settle Part Replacement Claims (hardware replenishment or reimbursement).
  - Manage, import (CSV), and edit End-Customer Sites, Device Catalog, and Master Data.
- **Agent**:
  - Scoped visibility: Can view and manage items within their assigned Partner Warehouse (`warehouse.partnerId == user.partnerId`).
  - Can register local `PARTNER_OWNED` stock into their company's warehouse.
  - Can allocate local partner stock to tickets dispatched to their company (`ticket.partnerId == user.partnerId`).
  - Can view and track status of Part Replacement Claims submitted by their agency.
  - Can view and select pre-seeded sites and device models during ticket creation/editing.
- **Field Engineer**:
  - Scoped visibility: Can view parts allocated to tickets assigned to them.
  - Can submit part requests and mark parts as `INSTALLED` or initiate loaner return.

