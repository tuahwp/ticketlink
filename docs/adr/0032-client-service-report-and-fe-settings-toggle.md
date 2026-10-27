# ADR 0032: Client Service Report Forms, Signature Pad Toggle, and FE System Settings

## Status
Accepted

## Context
1. **Physical Client Service Reports vs. System-Generated Print Preview**:
   - Field Engineers in the field operate across various client contracts (e.g. JPJ, POS, government agencies). Each client or main contractor possesses their own official printed or PDF service report template (`serviceReportTemplateUrl` and `serviceReportTemplateName`).
   - Previously, the FE mobile dashboard defaulted to showing a "Print Form" / "View Standard Service Report Form" button that opened a generic HTML-generated printable sheet.
   - For real operations, engineers must download or view the authentic client-provided blank form, print or carry it on-site, get physical client customer sign-off with company stamp, and scan/upload the completed signed sheet.
   - The generated HTML report was creating confusion for engineers who mistook it for the client's official form.

2. **Digital On-Screen Signature Pad vs. Mandatory Signed Physical Upload**:
   - In FE v2, an experimental HTML canvas signature pad allowed engineers or clients to sign directly on the mobile screen during the Resolve workflow.
   - Certain client enterprise contracts reject digital screen signatures and strictly require physical signed & stamped hardcopy service sheets.
   - Having the signature pad enabled unconditionally caused tickets to be resolved without the mandatory stamped client sheet.

3. **Dynamic Operational Controls via Superadmin System Settings**:
   - Operations teams required a centralized mechanism to toggle the generated report preview (`feGeneratedServiceReport`) and the experimental digital signature pad (`feSignaturePad`) on or off dynamically without redeploying code.
   - Future configurations (such as user-level FE v2 rollouts to replace environment variables like `FE_V2_USERS`) also require a scalable, key-value configuration model.

---

## Decisions

### 1. Key-Value `SystemSetting` Architecture & Idempotent Migration
- A generalized `SystemSetting` key-value model is added to `prisma/schema.prisma`:
  ```prisma
  model SystemSetting {
    id          Int      @id @default(autoincrement())
    key         String   @unique
    value       String
    description String?
    createdAt   DateTime @default(now())
    updatedAt   DateTime @updatedAt
  }
  ```
- Startup DDL in `src/lib/db.ts` and container boot script `migrate.js` (`MIGRATION_STATEMENTS`) creates the table and unique index idempotently (`CREATE TABLE IF NOT EXISTS`, `DO $$ BEGIN ALTER TABLE ... ADD CONSTRAINT ... EXCEPTION ... END $$;`).
- No hardcoded seed rows are required; if a setting key does not exist in the database, server actions assume `false` (OFF by default).
- Value is stored as `TEXT` to accommodate future non-boolean configurations (e.g., JSON lists or comma-delimited user IDs).

### 2. Scoped Public Read & Superadmin-Guarded Write Server Actions
- In `src/app/actions.ts`:
  - `getSystemSettingsAction()`: Requires an active authenticated session. Strictly scopes database queries to an allowlist of FE operational keys (`feGeneratedServiceReport`, `feSignaturePad`). Never exposes arbitrary system settings to client dashboards. Defaults to `{ feGeneratedServiceReport: false, feSignaturePad: false }` gracefully on read errors or missing keys without throwing.
  - `updateSystemSettingsAction(settings)`:
    - Strictly enforced on the server for `SUPERADMIN` role.
    - Server-side key allowlist (`ALLOWED_SYSTEM_SETTINGS`): only permitted operational keys (`feGeneratedServiceReport`, `feSignaturePad`) are accepted, designed as a clean extensible registry for future FE v2 rollout keys.
    - Value validation: operational toggles strictly enforce `"true"` or `"false"` string/boolean representations, rejecting unknown values.
    - Robust error masking: failures log real errors to server console (`console.error`) and return a friendly, localized BM error message (*"Tak dapat simpan tetapan. Cuba lagi."*) instead of raw internal database exceptions.
    - Logs updates to server console audit trails (`[SYSTEM_SETTING_UPDATED]`).

### 3. Superadmin Configuration UI ("Tetapan FE" Subtab)
- In `src/app/components/SystemSettingsTab.tsx`, a 4th subtab *"Tetapan FE"* (`value="fe"`) is added alongside SMTP, System, and AI Copilot:
  - Toggle 1: *"Borang Generated / Print Preview"* (`feGeneratedServiceReport`) — Benarkan jurutera lapangan menjana dan mencetak borang laporan servis standard sistem (HTML print preview). Default: OFF.
  - Toggle 2: *"Pad Tandatangan Digital"* (`feSignaturePad`) — *"Benarkan tandatangan digital di skrin peranti FE semasa Resolve (eksperimen)."* Default: OFF.
  - Interactive controls use accessible, animated `Switch` components (`src/components/ui/switch.tsx`).
  - Accompanied by a dedicated explanation card detailing client template behaviors.

### 4. Decoupled Settings Lifecycle (Mount & Focus only)
- In `FEDashboard.tsx` and `FEV2Dashboard.tsx`:
  - Reading `getSystemSettingsAction()` is removed from the high-frequency 45-second ticket polling loop (`syncFETickets`).
  - Settings are fetched once during component mount and refreshed on tab focus (`visibilitychange` / `window.focus`), eliminating redundant server action round-trips during background polling.

### 5. Client Form Template Priority in FE Dashboards (Classic & FE v2)
- In `FEDashboard.tsx` (lines ~1417–1440 & ~1720–1770) and `FEV2Dashboard.tsx` (lines ~2495–2540):
  - **With Client Template (`serviceReportTemplateUrl`)**: Displays *"Buka Borang Client"* linking directly to the uploaded template in a new tab (`target="_blank" rel="noopener noreferrer"`). Displays template subtitle: `Templat: {serviceReportTemplateName || "Borang Client"}`.
  - **Without Client Template**: Displays the informative note *"Tiada borang client ditetapkan. Sila hubungi admin."*
  - **Backup Generated Form**: If `feGeneratedServiceReport` is toggled ON, a secondary button to view the official generated form is displayed as an operational fallback.
  - **Signed Report Link**: Displays standardized *"Lihat Service Report Bertandatangan"* when `serviceReportUrl` is present.
  - **Modal Preview Guard**: Generated print preview modal is guarded by `{isReportTemplatePreviewOpen && feSettings.feGeneratedServiceReport && (...)}`.

### 6. Signature Pad Toggle & Server-Safe Validation
- In `FEV2Dashboard.tsx`:
  - When `feSignaturePad` is OFF (default): The mode toggle tab bar (`Muat Naik / Imbas` | `Pad Tandatangan`) is completely hidden from the Resolve modal. The interface defaults directly to the file upload/camera scan box.
  - When `feSignaturePad` is ON: The 2-option mode toggle bar is available.
  - **Validation & State Guardrails**:
    - An effect ensures `resolveDocMode` resets to `"upload"` whenever `feSignaturePad` becomes `false`.
    - During `handleConfirmResolve`, if `feSignaturePad` is OFF, the mode is forced to `"upload"`. Any canvas-generated signature file (`tandatangan_servis_*`) is rejected with a user-friendly toast prompt requiring a real scanned/uploaded document.
- In `FEDashboard.tsx` (Classic):
  - Resolve modal upload labels are standardized in professional Malay: *"Service Report Bertandatangan \*"*, *"Dilampirkan ✓ / Wajib"*, *"Lampirkan Service Report Bertandatangan"*, *"PDF, JPG atau PNG (Kamera disokong)"*.

---

## Consequences
- **Operational Clarity**: Field engineers download authentic client-branded sheets instead of mistakenly presenting generic system-generated mockups to clients.
- **Contract Compliance**: Superadmins can strictly enforce physical hardcopy signed reports by keeping the digital signature pad disabled.
- **Enterprise Security**: Public FE dashboards cannot view unauthorized settings keys; settings updates are validated server-side and restricted strictly to Superadmins.
- **Zero Disruption**: Existing database columns, generated print preview code, and signature pad logic remain intact for testing and client contracts that permit them.
