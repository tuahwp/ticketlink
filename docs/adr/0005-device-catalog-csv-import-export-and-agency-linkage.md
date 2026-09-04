# ADR 0005: Device Catalog CSV Import, Export, and Agency Linkage

## Status
Accepted

## Context
Equipment maintained in the field includes specific makes and models across categories (Desktops, Laptops, Printers, Routers, Switches, POS Terminals, Servers). Previously, adding devices required manual individual form entry without batch CSV upload, export, or inline editing. Additionally, device models can be standard vs on-request, and some models are contractually restricted to specific government agencies (e.g. JPJ-specific thermal printers vs RELA desktops).

## Decision
1. **Bulk CSV Import with Upsert**:
   - Provide a downloadable sample `.csv` template with headers: `Category, Brand, Model, Type (Standard/On-Request), Restricted To (Agency / All)`.
   - Upsert semantics based on natural composite key `(category, brand, model)`: if an entry exists with the exact same category, brand, and model, update its `isStandard` flag and `restrictedTo` agency; otherwise insert as a new device model.
2. **Device Catalog UI Modernization**:
   - Add full-text search (across category, brand, model, agency).
   - Add filters by Category (Desktop, Laptop, Printer, Router, etc.), Standard Type, and Agency Restriction.
   - Add KPI summary cards (Total Models, Categories Count, Standard SLA models, Agency Restricted models).
   - Add row-level **Edit (Pencil)** modal to allow quick adjustment of brand names, model spelling, or standard flags.
   - Add row-level **Delete** with confirmation and ticket linkage check.
   - Add **Export CSV** button to download the catalog as a `.csv` file.
3. **Agency-Aware Filtering during Ticket Creation**:
   - When creating or editing tickets, selecting an End-Customer Agency (e.g. JPJ) dynamically filters the Device dropdown to show standard devices available for all groups plus devices specifically restricted to JPJ, hiding devices restricted to other agencies.

## Consequences
- **Positive**:
  - Bulk setup and updates of hundreds of hardware models in seconds via CSV.
  - Consistent hardware naming across tickets, reports, and SLA tracking.
  - Clear visibility into standard contract devices vs custom on-request devices.
- **Negative**:
  - Requires maintaining catalog accuracy when new OEM hardware models are deployed.
