# ADR 0008: Configurable Service Report Form Templates & Multi-Photo Reference Attachments

## Status
Accepted

## Context
Our platform supports multiple **Clients (Maincons)** who manage operations across multiple **End-Customers / Agency Groups** (e.g., JPJ, RELA, JPN, etc.). Each client and end-customer has distinct operational requirements, including:
1. **Specific Service Report Form Templates**: Government agencies and corporate clients require their specific blank physical/PDF service report forms to be printed and physically signed on-site by station officers.
2. **Pre-Dispatch Reference Attachments**: Moderators and ticket creators frequently have reference photos (e.g., error screen photos, physical damage pictures, site access permits, work order slips) that Field Engineers (FEs) must inspect before arriving on-site.
3. **Field Engineer Execution Flow**: FEs need a one-touch workflow on mobile/desktop to view reference photos, download/print the mandated blank service report form, and upload the signed completion report upon finishing the job.

---

## Architecture & Design Decisions

### 1. Database Schema Design

#### 1.1 `ServiceReportTemplate` Model
Stores reusable blank form templates linked hierarchically to Clients and End-Customer Groups.
```prisma
model ServiceReportTemplate {
  id          Int      @id @default(autoincrement())
  mainconId   Int
  maincon     Maincon  @relation(fields: [mainconId], references: [id], onDelete: Cascade)
  group       String?  // NULL = Default template for this Maincon; "JPJ" = Specific override for JPJ
  name        String   // e.g. "JPJ Official Service Slip v2.4"
  fileUrl     String   // Uploaded PDF/DOCX URL in storage
  fileType    String   // e.g. "application/pdf"
  fileSize    Int?     // In bytes
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([mainconId, group])
}
```

#### 1.2 `Ticket` Model Enhancements
```prisma
model Ticket {
  // Existing fields...
  
  // Reference Attachments uploaded at creation / editing
  referenceAttachments Json? // Array of { id, name, url, type, size, tag, uploadedAt, uploadedBy }
  
  // Service Report Template Linkage
  serviceReportTemplateId   Int?
  serviceReportTemplateUrl  String? // Snapshot URL to the assigned blank form template
  serviceReportTemplateName String? // Display name of the form
  
  // Completed Signed Service Report
  serviceReportUrl          String? // Existing: Signed document uploaded upon resolution
  serviceReportSignedAt     DateTime?
}
```

---

### 2. Client Settings & Template Configuration Workflow
In **System Settings ➔ Client (Maincon) Configuration**:
1. **Default Template**: Upload a single standard service report PDF/Word template used by default across all sites for this client.
2. **Group Overrides Table**: Add specific form overrides per End-Customer Group (e.g., select Group `JPJ` ➔ upload `JPJ_Service_Form.pdf`).
3. **Full CRUD**: View, download test copy, replace, or delete templates with real-time UI feedback.

---

### 3. Ticket Creation & Moderator Experience
In **Create Ticket Form** and **Edit Ticket Form**:
1. **Reference Attachments Dropzone**:
   - Multi-file drag-and-drop supporting images (PNG, JPG, WEBP) and documents (PDF).
   - Quick-tag assignment per file: `Error / Damage Photo`, `Site Pass / Permit`, `Customer WO / PO`, `Other`.
   - Live thumbnail gallery with zoom preview and one-click remove.
2. **Service Report Form Auto-Linkage**:
   - Automatically detects and displays the matched form based on selected `Client` + `End-Customer`.
   - Displays source indicator: `[Auto-Linked: JPJ Agency Form]` or `[Auto-Linked: Client Default]`.
   - Moderator controls: `[Preview / Download Blank]`, `[Switch Template]`, or `[Upload One-Off Custom Form]`.

---

### 4. Bulk CSV Import Integration
When tickets are imported via CSV/Excel:
- The system automatically evaluates `Maincon` and `EndCustomer` fields and links the corresponding `ServiceReportTemplate` automatically.
- No manual per-ticket intervention is required.

---

### 5. Field Engineer (FE) Mobile & Desktop Workflow
In **FE Job Details**:
1. **Job Reference Assets Card**:
   - **Photo Gallery**: Tap-to-zoom / lightbox inspection of all reference photos and error screenshots.
   - **Tag Badges**: Clearly shows which files are error photos vs site access documents.
2. **Service Report Actions**:
   - Prominent button: `[ 📄 Open / Print Service Report ]` ➔ Opens clean template in new tab for direct printing (mobile AirPrint / Bluetooth printer / local save).
3. **Resolution & Sign-Off**:
   - Dedicated camera capture button `[ 📷 Capture Signed Form ]` and file upload `[ 📁 Upload Signed PDF ]`.
   - Quality check preview before marking the ticket as `RESOLVED`.

---

## Consequences & Verification Plan
- **Verification**:
  1. Test template upload in Client settings (default and group override).
  2. Create tickets for different clients/groups and verify correct template auto-selection and attachment storage.
  3. Verify FE mobile interface displays reference photos clearly and allows downloading the blank form.
  4. Test CSV bulk import to verify automatic form association.
