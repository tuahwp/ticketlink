const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const templates = [
  {
    eventKey: "AUTH_EMAIL_VERIFICATION",
    title: "Email Verification & OTP",
    description: "Sent to newly registering users with a 6-digit verification code and activation link.",
    subject: "Verify your email address - TicketLink Verification Code: {{verifyOtp}}",
    placeholders: ["{{userName}}", "{{userEmail}}", "{{verifyOtp}}", "{{verifyLink}}", "{{expiryMinutes}}"],
    bodyHtml: `<p>Hello <strong>{{userName}}</strong>,</p><p>Thank you for signing up for <strong>TicketLink</strong>. Please use the verification code below to verify your email address and activate your account:</p><div style="text-align: center; margin: 28px 0;"><div style="display: inline-block; background-color: #f1f5f9; border: 2px dashed #0284c7; padding: 14px 32px; border-radius: 8px; font-size: 28px; font-weight: 800; letter-spacing: 6px; color: #0369a1; font-family: monospace;">{{verifyOtp}}</div></div><p style="text-align: center; margin: 16px 0;"><a href="{{verifyLink}}" style="background-color: #0284c7; color: #ffffff; padding: 10px 22px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 13px;">Or Click Here to Verify Instantly</a></p><p style="color: #64748b; font-size: 12px; text-align: center;">This code will expire in <strong>{{expiryMinutes}} minutes</strong>.</p><p>If you did not sign up for TicketLink, you can safely disregard this message.</p>`,
  },
  {
    eventKey: "AUTH_RESET_PASSWORD",
    title: "Password Reset Request",
    description: "Sent when a user requests a password reset link.",
    subject: "Reset your TicketLink password",
    placeholders: ["{{userName}}", "{{resetLink}}", "{{expiryMinutes}}"],
    bodyHtml: `<p>Hello <strong>{{userName}}</strong>,</p><p>We received a request to reset your password for your TicketLink account.</p><p style="text-align: center; margin: 24px 0;"><a href="{{resetLink}}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a></p><p style="color: #64748b; font-size: 12px; margin-top: 16px;">This password reset link will expire in <strong>{{expiryMinutes}} minutes</strong>.</p><p style="color: #64748b; font-size: 12px;">If you did not request this, please ignore this email.</p>`,
  },
  {
    eventKey: "AUTH_WELCOME_USER",
    title: "Welcome & Account Activation",
    description: "Sent when a new user registers or is added to the system.",
    subject: "Welcome to TicketLink - Your Account is Ready",
    placeholders: ["{{userName}}", "{{userEmail}}", "{{userRole}}", "{{loginLink}}"],
    bodyHtml: `<p>Hello <strong>{{userName}}</strong>,</p><p>Welcome to <strong>TicketLink</strong>! Your account has been successfully created with the role of <strong>{{userRole}}</strong>.</p><p>You can access the platform at any time using the link below:</p><p style="text-align: center; margin: 24px 0;"><a href="{{loginLink}}" style="background-color: #059669; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Login to TicketLink</a></p><p>If you need any assistance, please reach out to your administrator.</p>`,
  },
  {
    eventKey: "TICKET_CREATED",
    title: "New Ticket Dispatched to Agency",
    description: "Sent to the Service Partner dispatch inbox and CC'd to Agent staff when a new ticket is dispatched.",
    subject: "New Dispatch: #{{ticketRefNo}} - {{subject}} ({{siteName}}, {{state}})",
    placeholders: ["{{partnerName}}", "{{ticketRefNo}}", "{{subject}}", "{{siteName}}", "{{state}}", "{{endCustomer}}", "{{address}}", "{{mapsUrl}}", "{{severity}}", "{{slaDeadline}}", "{{mainconName}}", "{{representAs}}", "{{onSiteSop}}", "{{issueDescription}}", "{{ticketLink}}"],
    bodyHtml: `<p>Hello <strong>{{partnerName}} Team</strong>,</p>
<p>A new service ticket has been dispatched to your agency:</p>
<div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #0d9488; padding: 16px; margin: 16px 0; border-radius: 6px;">
  <div style="font-size: 16px; font-weight: bold; color: #0f172a; margin-bottom: 10px;">
    #{{ticketRefNo}}: {{subject}}
  </div>
  <table style="width: 100%; font-size: 13px; line-height: 1.6; border-collapse: collapse;">
    <tr>
      <td style="width: 130px; color: #64748b; padding: 3px 0;"><strong>Client:</strong></td>
      <td style="color: #1e293b;">{{mainconName}}</td>
    </tr>
    <tr>
      <td style="color: #64748b; padding: 3px 0;"><strong>End Customer:</strong></td>
      <td style="color: #1e293b; font-weight: 600;">{{endCustomer}}</td>
    </tr>
    <tr>
      <td style="color: #64748b; padding: 3px 0;"><strong>Site Premises:</strong></td>
      <td style="color: #1e293b;"><strong>{{siteName}}</strong> ({{state}})</td>
    </tr>
    <tr>
      <td style="color: #64748b; padding: 3px 0;"><strong>Address:</strong></td>
      <td style="color: #1e293b;">{{address}}</td>
    </tr>
    <tr>
      <td style="color: #64748b; padding: 3px 0;"><strong>Severity:</strong></td>
      <td style="color: #dc2626; font-weight: bold;">{{severity}}</td>
    </tr>
    <tr>
      <td style="color: #64748b; padding: 3px 0;"><strong>SLA Target:</strong></td>
      <td style="color: #d97706; font-weight: bold;">{{slaDeadline}}</td>
    </tr>
    <tr>
      <td style="color: #64748b; padding: 3px 0;"><strong>Represent As:</strong></td>
      <td style="color: #0369a1; font-weight: 600;">{{representAs}}</td>
    </tr>
  </table>
  <div style="margin-top: 12px; padding-top: 10px; border-top: 1px dashed #cbd5e1;">
    <p style="margin: 0 0 4px 0; font-size: 12px; color: #64748b;"><strong>Issue Details:</strong></p>
    <p style="margin: 0; font-size: 13px; color: #334155; white-space: pre-wrap;">{{issueDescription}}</p>
  </div>
</div>
<p style="font-size: 13px; color: #475569;">Please log in to your partner portal to assign a qualified Field Engineer promptly.</p>
<div style="text-align: center; margin: 24px 0;">
  <a href="{{ticketLink}}" style="background-color: #0d9488; color: #ffffff; padding: 11px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 14px;">Assign Field Engineer</a>
</div>`,
  },
  {
    eventKey: "TICKET_ASSIGNED",
    title: "Field Engineer Assignment Notification",
    description: "Sent directly to a Field Engineer when they are assigned to a ticket.",
    subject: "Job Assignment: #{{ticketRefNo}} - {{subject}} ({{siteName}})",
    placeholders: ["{{engineerName}}", "{{ticketRefNo}}", "{{subject}}", "{{siteName}}", "{{state}}", "{{endCustomer}}", "{{address}}", "{{mapsUrl}}", "{{severity}}", "{{slaDeadline}}", "{{representAs}}", "{{onSiteSop}}", "{{issueDescription}}", "{{serviceReportBlankUrl}}", "{{ticketLink}}"],
    bodyHtml: `<p>Hello <strong>{{engineerName}}</strong>,</p>
<p>You have been assigned to a service order. Please review the details below:</p>
<div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #2563eb; padding: 16px; margin: 16px 0; border-radius: 6px;">
  <div style="font-size: 16px; font-weight: bold; color: #0f172a; margin-bottom: 10px;">
    #{{ticketRefNo}}: {{subject}}
  </div>
  <table style="width: 100%; font-size: 13px; line-height: 1.6; border-collapse: collapse;">
    <tr>
      <td style="width: 130px; color: #64748b; padding: 3px 0;"><strong>End Customer:</strong></td>
      <td style="color: #1e293b; font-weight: 600;">{{endCustomer}}</td>
    </tr>
    <tr>
      <td style="width: 130px; color: #64748b; padding: 3px 0;"><strong>Client Site:</strong></td>
      <td style="color: #1e293b;"><strong>{{siteName}}</strong> ({{state}})</td>
    </tr>
    <tr>
      <td style="color: #64748b; padding: 3px 0;"><strong>Location Address:</strong></td>
      <td style="color: #1e293b;">{{address}}</td>
    </tr>
    <tr>
      <td style="color: #64748b; padding: 3px 0;"><strong>Severity:</strong></td>
      <td style="color: #dc2626; font-weight: bold;">{{severity}}</td>
    </tr>
    <tr>
      <td style="color: #64748b; padding: 3px 0;"><strong>SLA Target:</strong></td>
      <td style="color: #d97706; font-weight: bold;">{{slaDeadline}}</td>
    </tr>
    <tr>
      <td style="color: #64748b; padding: 3px 0;"><strong>Representing:</strong></td>
      <td style="color: #0284c7; font-weight: 600;">{{representAs}}</td>
    </tr>
  </table>

  <!-- Dedicated Highlighted Equipment & SOP Protocol Callout -->
  <div style="margin: 14px 0; background-color: #eff6ff; border: 1px solid #bfdbfe; border-left: 4px solid #3b82f6; border-radius: 6px; padding: 12px 14px;">
    <div style="font-size: 13px; font-weight: bold; color: #1e40af; margin-bottom: 4px;">
      🧰 Required Equipment & On-Site Protocol:
    </div>
    <div style="font-size: 13px; color: #1e3a8a; line-height: 1.5; white-space: pre-wrap;">{{onSiteSop}}</div>
  </div>

  <div style="margin-top: 12px; padding-top: 10px; border-top: 1px dashed #cbd5e1;">
    <p style="margin: 0 0 4px 0; font-size: 12px; color: #64748b;"><strong>Issue Description:</strong></p>
    <p style="margin: 0; font-size: 13px; color: #334155; white-space: pre-wrap;">{{issueDescription}}</p>
  </div>
</div>
<div style="text-align: center; margin: 24px 0;">
  <a href="{{ticketLink}}" style="background-color: #2563eb; color: #ffffff; padding: 11px 22px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 13px; margin: 4px;">Open Mobile Dashboard</a>
  <a href="{{mapsUrl}}" style="background-color: #0f172a; color: #ffffff; padding: 11px 22px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 13px; margin: 4px;">Navigate (Google Maps)</a>
</div>`,
  },
  {
    eventKey: "TICKET_RESOLVED",
    title: "Ticket Resolved & Service Report Available",
    description: "Sent to the Partner agency dispatch desk and Main Contractor client when a ticket is resolved with signed service report.",
    subject: "✅ Ticket Resolved: #{{ticketRefNo}} - {{siteName}} ({{state}})",
    placeholders: ["{{recipientName}}", "{{ticketRefNo}}", "{{subject}}", "{{siteName}}", "{{state}}", "{{engineerName}}", "{{resolvedAt}}", "{{turnaroundTime}}", "{{resolutionNotes}}", "{{serviceReportUrl}}", "{{ticketLink}}"],
    bodyHtml: `<p>Hello <strong>{{recipientName}}</strong>,</p>
<p style="color: #059669; font-weight: bold; font-size: 16px; margin: 8px 0;">✅ Service Ticket Successfully Resolved</p>
<p>Ticket <strong>#{{ticketRefNo}}</strong> at <strong>{{siteName}}</strong> has been resolved and verified on-site.</p>
<div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-left: 4px solid #10b981; padding: 16px; margin: 16px 0; border-radius: 6px;">
  <div style="font-size: 15px; font-weight: bold; color: #065f46; margin-bottom: 8px;">
    #{{ticketRefNo}}: {{subject}}
  </div>
  <table style="width: 100%; font-size: 13px; line-height: 1.6; border-collapse: collapse;">
    <tr>
      <td style="width: 140px; color: #047857; padding: 3px 0;"><strong>Site / Branch:</strong></td>
      <td style="color: #1e293b;">{{siteName}} ({{state}})</td>
    </tr>
    <tr>
      <td style="color: #047857; padding: 3px 0;"><strong>Resolved By:</strong></td>
      <td style="color: #1e293b;">{{engineerName}}</td>
    </tr>
    <tr>
      <td style="color: #047857; padding: 3px 0;"><strong>Completion Time:</strong></td>
      <td style="color: #1e293b;">{{resolvedAt}}</td>
    </tr>
    <tr>
      <td style="color: #047857; padding: 3px 0;"><strong>Turnaround Time:</strong></td>
      <td style="color: #1e293b; font-weight: bold;">{{turnaroundTime}}</td>
    </tr>
  </table>
  <div style="margin-top: 12px; padding-top: 10px; border-top: 1px dashed #86efac;">
    <p style="margin: 0 0 4px 0; font-size: 12px; color: #047857;"><strong>Resolution Summary / Notes:</strong></p>
    <p style="margin: 0; font-size: 13px; color: #1e293b; white-space: pre-wrap;">{{resolutionNotes}}</p>
  </div>
</div>
<div style="text-align: center; margin: 24px 0;">
  <a href="{{serviceReportUrl}}" style="background-color: #059669; color: #ffffff; padding: 11px 22px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 13px; margin: 4px;">Download Signed Service Report</a>
  <a href="{{ticketLink}}" style="background-color: #0f172a; color: #ffffff; padding: 11px 22px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 13px; margin: 4px;">View Full Ticket</a>
</div>`,
  },
  {
    eventKey: "TICKET_STATUS_CHANGED",
    title: "Ticket Status Update",
    description: "Sent when a ticket status changes (e.g. In Progress, On Hold, Follow Up, Cancelled).",
    subject: "Ticket #{{ticketRefNo}} Status Updated: {{newStatus}}",
    placeholders: ["{{recipientName}}", "{{ticketRefNo}}", "{{subject}}", "{{oldStatus}}", "{{newStatus}}", "{{notes}}", "{{ticketLink}}"],
    bodyHtml: `<p>Hello <strong>{{recipientName}}</strong>,</p>
<p>The status of ticket <strong>#{{ticketRefNo}}</strong> has been updated:</p>
<div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #3b82f6; padding: 16px; margin: 16px 0; border-radius: 6px;">
  <p style="margin: 0 0 6px 0; font-size: 14px; font-weight: bold; color: #0f172a;">{{subject}}</p>
  <table style="width: 100%; font-size: 13px; line-height: 1.6; border-collapse: collapse;">
    <tr>
      <td style="width: 130px; color: #64748b; padding: 3px 0;"><strong>Previous Status:</strong></td>
      <td style="color: #64748b;">{{oldStatus}}</td>
    </tr>
    <tr>
      <td style="width: 130px; color: #64748b; padding: 3px 0;"><strong>New Status:</strong></td>
      <td style="color: #2563eb; font-weight: bold;">{{newStatus}}</td>
    </tr>
    <tr>
      <td style="width: 130px; color: #64748b; padding: 3px 0;"><strong>Notes:</strong></td>
      <td style="color: #334155;">{{notes}}</td>
    </tr>
  </table>
</div>
<div style="text-align: center; margin: 24px 0;">
  <a href="{{ticketLink}}" style="background-color: #2563eb; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 13px;">View Ticket</a>
</div>`,
  },
  {
    eventKey: "TICKET_SLA_ALERT",
    title: "SLA Warning / Alert",
    description: "Sent when a ticket is approaching or has exceeded its SLA deadline.",
    subject: "⚠️ SLA Alert: Ticket #{{ticketRefNo}} - {{timeRemaining}} remaining ({{siteName}})",
    placeholders: ["{{recipientName}}", "{{ticketRefNo}}", "{{subject}}", "{{siteName}}", "{{state}}", "{{severity}}", "{{timeRemaining}}", "{{slaDeadline}}", "{{ticketLink}}"],
    bodyHtml: `<p>Hello <strong>{{recipientName}}</strong>,</p>
<div style="background-color: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #ef4444; padding: 16px; margin: 16px 0; border-radius: 6px;">
  <div style="font-size: 16px; font-weight: bold; color: #dc2626; margin-bottom: 8px;">
    ⚠️ Urgent: SLA Target Expiration Imminent
  </div>
  <p style="margin: 0 0 10px 0; font-size: 13px; color: #7f1d1d;">
    Ticket <strong>#{{ticketRefNo}}</strong> is within <strong>{{timeRemaining}}</strong> of breaching its contractual SLA deadline.
  </p>
  <table style="width: 100%; font-size: 13px; line-height: 1.6; border-collapse: collapse;">
    <tr>
      <td style="width: 130px; color: #991b1b; padding: 3px 0;"><strong>Site Name:</strong></td>
      <td style="color: #1e293b;"><strong>{{siteName}}</strong> ({{state}})</td>
    </tr>
    <tr>
      <td style="width: 130px; color: #991b1b; padding: 3px 0;"><strong>Severity:</strong></td>
      <td style="color: #dc2626; font-weight: bold;">{{severity}}</td>
    </tr>
    <tr>
      <td style="width: 130px; color: #991b1b; padding: 3px 0;"><strong>Target Deadline:</strong></td>
      <td style="color: #dc2626; font-weight: bold;">{{slaDeadline}}</td>
    </tr>
    <tr>
      <td style="width: 130px; color: #991b1b; padding: 3px 0;"><strong>Time Left:</strong></td>
      <td style="color: #b91c1c; font-weight: 800; font-size: 14px;">{{timeRemaining}}</td>
    </tr>
  </table>
</div>
<div style="text-align: center; margin: 24px 0;">
  <a href="{{ticketLink}}" style="background-color: #dc2626; color: #ffffff; padding: 11px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 14px;">Action Ticket Now</a>
</div>`,
  },
  {
    eventKey: "SPARE_PART_DISPATCHED",
    title: "Spare Part Courier Dispatch Notification",
    description: "Sent to the Field Engineer and Partner depot when warehouse hardware is shipped via courier.",
    subject: "📦 Spare Part Dispatched: #{{ticketRefNo}} - {{partName}} ({{courierName}})",
    placeholders: ["{{recipientName}}", "{{ticketRefNo}}", "{{siteName}}", "{{partName}}", "{{serialNumber}}", "{{quantity}}", "{{courierName}}", "{{trackingNumber}}", "{{trackingLink}}", "{{warehouseName}}", "{{dispatchedBy}}", "{{ticketLink}}"],
    bodyHtml: `<p>Hello <strong>{{recipientName}}</strong>,</p>
<p>A replacement spare part has been allocated and dispatched via courier for ticket <strong>#{{ticketRefNo}}</strong>:</p>
<div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #f59e0b; padding: 16px; margin: 16px 0; border-radius: 6px;">
  <div style="font-size: 16px; font-weight: bold; color: #0f172a; margin-bottom: 8px;">
    📦 Shipment: {{partName}}
  </div>
  <table style="width: 100%; font-size: 13px; line-height: 1.6; border-collapse: collapse;">
    <tr>
      <td style="width: 140px; color: #64748b; padding: 3px 0;"><strong>Courier Service:</strong></td>
      <td style="color: #1e293b; font-weight: 600;">{{courierName}}</td>
    </tr>
    <tr>
      <td style="width: 140px; color: #64748b; padding: 3px 0;"><strong>Tracking Number:</strong></td>
      <td style="color: #0284c7; font-weight: bold; font-family: monospace; font-size: 14px;">{{trackingNumber}}</td>
    </tr>
    <tr>
      <td style="width: 140px; color: #64748b; padding: 3px 0;"><strong>Serial Number:</strong></td>
      <td style="color: #1e293b; font-family: monospace;">{{serialNumber}}</td>
    </tr>
    <tr>
      <td style="width: 140px; color: #64748b; padding: 3px 0;"><strong>Quantity:</strong></td>
      <td style="color: #1e293b;">{{quantity}} unit(s)</td>
    </tr>
    <tr>
      <td style="width: 140px; color: #64748b; padding: 3px 0;"><strong>Destination Site:</strong></td>
      <td style="color: #1e293b;">{{siteName}}</td>
    </tr>
    <tr>
      <td style="width: 140px; color: #64748b; padding: 3px 0;"><strong>Origin Warehouse:</strong></td>
      <td style="color: #1e293b;">{{warehouseName}}</td>
    </tr>
  </table>
</div>
<div style="text-align: center; margin: 24px 0;">
  <a href="{{trackingLink}}" style="background-color: #f59e0b; color: #0f172a; padding: 11px 22px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 13px; margin: 4px;">Track Courier Shipment</a>
  <a href="{{ticketLink}}" style="background-color: #0f172a; color: #ffffff; padding: 11px 22px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 13px; margin: 4px;">View Ticket Workspace</a>
</div>`,
  },
];

async function run() {
  console.log("Migrating email templates in PostgreSQL database...");
  for (const tmpl of templates) {
    const res = await pool.query(
      `INSERT INTO "EmailTemplate" ("eventKey", "title", "description", "subject", "placeholders", "bodyHtml", "isEnabled", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, true, NOW(), NOW())
       ON CONFLICT ("eventKey") DO UPDATE
       SET "title" = EXCLUDED."title",
           "description" = EXCLUDED."description",
           "subject" = EXCLUDED."subject",
           "placeholders" = EXCLUDED."placeholders",
           "bodyHtml" = EXCLUDED."bodyHtml",
           "updatedAt" = NOW()
       RETURNING "id", "eventKey"`,
      [tmpl.eventKey, tmpl.title, tmpl.description, tmpl.subject, JSON.stringify(tmpl.placeholders), tmpl.bodyHtml]
    );
    console.log(`Synced template: ${tmpl.eventKey} (ID: ${res.rows[0].id})`);
  }
  console.log("All templates successfully migrated to v19 structure!");
  await pool.end();
}

run().catch((e) => {
  console.error(e);
  pool.end();
  process.exit(1);
});
