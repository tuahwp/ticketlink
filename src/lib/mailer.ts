import nodemailer from "nodemailer";
import { db } from "./db";

export interface DefaultTemplateConfig {
  eventKey: string;
  title: string;
  description: string;
  subject: string;
  placeholders: string[];
  bodyHtml: string;
}

export const DEFAULT_EMAIL_TEMPLATES: DefaultTemplateConfig[] = [
  {
    eventKey: "AUTH_EMAIL_VERIFICATION",
    title: "Email Verification & OTP",
    description: "Sent to newly registering users with a 6-digit verification code and activation link.",
    subject: "Verify your email address - TicketLink Verification Code: {{verifyOtp}}",
    placeholders: ["{{userName}}", "{{userEmail}}", "{{verifyOtp}}", "{{verifyLink}}", "{{expiryMinutes}}"],
    bodyHtml: `
<p>Hello <strong>{{userName}}</strong>,</p>
<p>Thank you for signing up for <strong>TicketLink</strong>. Please use the verification code below to verify your email address and activate your account:</p>
<div style="text-align: center; margin: 28px 0;">
  <div style="display: inline-block; background-color: #f1f5f9; border: 2px dashed #0284c7; padding: 14px 32px; border-radius: 8px; font-size: 28px; font-weight: 800; letter-spacing: 6px; color: #0369a1; font-family: monospace;">
    {{verifyOtp}}
  </div>
</div>
<p style="text-align: center; margin: 16px 0;">
  <a href="{{verifyLink}}" style="background-color: #0284c7; color: #ffffff; padding: 10px 22px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 13px;">Or Click Here to Verify Instantly</a>
</p>
<p style="color: #64748b; font-size: 12px; text-align: center;">This code will expire in <strong>{{expiryMinutes}} minutes</strong>.</p>
<p>If you did not sign up for TicketLink, you can safely disregard this message.</p>
`,
  },
  {
    eventKey: "AUTH_RESET_PASSWORD",
    title: "Password Reset Request",
    description: "Sent when a user requests a password reset link.",
    subject: "Reset your TicketLink password",
    placeholders: ["{{userName}}", "{{resetLink}}", "{{expiryMinutes}}"],
    bodyHtml: `
<p>Hello <strong>{{userName}}</strong>,</p>
<p>We received a request to reset your password for your TicketLink account.</p>
<p style="text-align: center; margin: 24px 0;">
  <a href="{{resetLink}}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
</p>
<p>This password reset link will expire in <strong>{{expiryMinutes}} minutes</strong>.</p>
<p>If you did not request this, please ignore this email.</p>
`,
  },
  {
    eventKey: "AUTH_WELCOME_USER",
    title: "Welcome & Account Activation",
    description: "Sent when a new user registers or is added to the system.",
    subject: "Welcome to TicketLink - Your Account is Ready",
    placeholders: ["{{userName}}", "{{userEmail}}", "{{userRole}}", "{{loginLink}}"],
    bodyHtml: `
<p>Hello <strong>{{userName}}</strong>,</p>
<p>Welcome to <strong>TicketLink</strong>! Your account has been successfully created with the role of <strong>{{userRole}}</strong>.</p>
<p>You can access the platform at any time using the link below:</p>
<p style="text-align: center; margin: 24px 0;">
  <a href="{{loginLink}}" style="background-color: #059669; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Login to TicketLink</a>
</p>
<p>If you need any assistance, please reach out to your administrator.</p>
`,
  },
  {
    eventKey: "TICKET_CREATED",
    title: "New Ticket Dispatched to Agency",
    description: "Sent to the Service Partner dispatch inbox and CC'd to Agent staff when a new ticket is dispatched.",
    subject: "New Dispatch: #{{ticketRefNo}} - {{siteName}} ({{state}})",
    placeholders: ["{{partnerName}}", "{{ticketRefNo}}", "{{siteName}}", "{{state}}", "{{severity}}", "{{mainconName}}", "{{issueDescription}}", "{{ticketLink}}"],
    bodyHtml: `
<p>Hello <strong>{{partnerName}} Team</strong>,</p>
<p>A new service ticket has been dispatched to your agency:</p>
<div style="background-color: #f8fafc; border-left: 4px solid #0d9488; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
  <p style="margin: 4px 0;"><strong>Ticket Ref:</strong> {{ticketRefNo}}</p>
  <p style="margin: 4px 0;"><strong>Client:</strong> {{mainconName}}</p>
  <p style="margin: 4px 0;"><strong>Site Name:</strong> {{siteName}} ({{state}})</p>
  <p style="margin: 4px 0;"><strong>Severity:</strong> <span style="color: #dc2626; font-weight: bold;">{{severity}}</span></p>
  <p style="margin: 4px 0;"><strong>Issue Description:</strong> {{issueDescription}}</p>
</div>
<p>Please log in to your dashboard to assign a qualified Field Engineer to this ticket promptly.</p>
<p style="text-align: center; margin: 24px 0;">
  <a href="{{ticketLink}}" style="background-color: #0d9488; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Assign Field Engineer</a>
</p>
`,
  },
  {
    eventKey: "TICKET_ASSIGNED",
    title: "Field Engineer Assignment Notification",
    description: "Sent directly to a Field Engineer when they are assigned to a ticket.",
    subject: "Ticket Assigned to You: #{{ticketRefNo}} - {{siteName}}",
    placeholders: ["{{engineerName}}", "{{ticketRefNo}}", "{{siteName}}", "{{state}}", "{{severity}}", "{{issueDescription}}", "{{ticketLink}}"],
    bodyHtml: `
<p>Hello <strong>{{engineerName}}</strong>,</p>
<p>You have been assigned to a service ticket:</p>
<div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
  <p style="margin: 4px 0;"><strong>Ticket Ref:</strong> {{ticketRefNo}}</p>
  <p style="margin: 4px 0;"><strong>Client Site:</strong> {{siteName}} ({{state}})</p>
  <p style="margin: 4px 0;"><strong>Severity:</strong> <span style="color: #dc2626; font-weight: bold;">{{severity}}</span></p>
  <p style="margin: 4px 0;"><strong>Issue:</strong> {{issueDescription}}</p>
</div>
<p style="text-align: center; margin: 24px 0;">
  <a href="{{ticketLink}}" style="background-color: #2563eb; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Ticket Details</a>
</p>
`,
  },
  {
    eventKey: "TICKET_STATUS_CHANGED",
    title: "Ticket Status Update",
    description: "Sent when a ticket status changes (e.g. In Progress, Resolved, Closed).",
    subject: "Ticket #{{ticketRefNo}} Status Updated: {{newStatus}}",
    placeholders: ["{{recipientName}}", "{{ticketRefNo}}", "{{oldStatus}}", "{{newStatus}}", "{{notes}}", "{{ticketLink}}"],
    bodyHtml: `
<p>Hello <strong>{{recipientName}}</strong>,</p>
<p>The status of ticket <strong>#{{ticketRefNo}}</strong> has been updated:</p>
<div style="background-color: #f8fafc; border-left: 4px solid #10b981; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
  <p style="margin: 4px 0;"><strong>Previous Status:</strong> {{oldStatus}}</p>
  <p style="margin: 4px 0;"><strong>New Status:</strong> <span style="font-weight: bold; color: #059669;">{{newStatus}}</span></p>
  <p style="margin: 4px 0;"><strong>Notes / Details:</strong> {{notes}}</p>
</div>
<p style="text-align: center; margin: 24px 0;">
  <a href="{{ticketLink}}" style="background-color: #059669; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Open Ticket</a>
</p>
`,
  },
  {
    eventKey: "TICKET_SLA_ALERT",
    title: "SLA Warning / Alert",
    description: "Sent when a ticket is approaching or has exceeded its SLA deadline.",
    subject: "⚠️ SLA Alert: Ticket #{{ticketRefNo}} - {{timeRemaining}} remaining",
    placeholders: ["{{recipientName}}", "{{ticketRefNo}}", "{{siteName}}", "{{timeRemaining}}", "{{slaDeadline}}", "{{ticketLink}}"],
    bodyHtml: `
<p>Hello <strong>{{recipientName}}</strong>,</p>
<p style="color: #dc2626; font-weight: bold;">⚠️ SLA Warning Alert</p>
<p>Ticket <strong>#{{ticketRefNo}}</strong> at <strong>{{siteName}}</strong> is nearing its SLA resolution target.</p>
<div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
  <p style="margin: 4px 0;"><strong>Time Remaining:</strong> <span style="color: #dc2626; font-weight: bold;">{{timeRemaining}}</span></p>
  <p style="margin: 4px 0;"><strong>Target Deadline:</strong> {{slaDeadline}}</p>
</div>
<p style="text-align: center; margin: 24px 0;">
  <a href="{{ticketLink}}" style="background-color: #dc2626; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Action Ticket Immediately</a>
</p>
`,
  },
];

/**
 * Retrieves the active SMTP Transporter from DB or fallback .env
 */
export async function getSmtpTransporter() {
  try {
    const config = await db.smtpConfig.findFirst({
      orderBy: { id: "desc" },
    });

    const host = config?.host || process.env.SMTP_HOST || "smtp.gmail.com";
    const port = config?.port || Number(process.env.SMTP_PORT) || 465;
    const secure = config?.secure !== undefined ? config.secure : port === 465;
    const user = config?.user || process.env.SMTP_USER || "";
    const pass = config?.password || process.env.SMTP_PASSWORD || "";
    const fromName = config?.fromName || process.env.SMTP_FROM_NAME || "TicketLink Support";
    const fromEmail = config?.fromEmail || process.env.SMTP_FROM_EMAIL || user;

    if (!user || !pass) {
      return null;
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });

    return {
      transporter,
      from: `"${fromName}" <${fromEmail}>`,
    };
  } catch (error) {
    console.error("Error creating SMTP transporter:", error);
    return null;
  }
}

/**
 * Wraps HTML content in a consistent, responsive TicketLink template
 */
function wrapEmailHtml(contentHtml: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TicketLink</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 10px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #0f172a; padding: 24px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: bold; letter-spacing: 0.5px;">TicketLink</h1>
              <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Service Management Portal</p>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 28px; line-height: 1.6; font-size: 15px;">
              ${contentHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center; font-size: 12px; color: #64748b;">
              <p style="margin: 0;">This is an automated system notification from TicketLink.</p>
              <p style="margin: 4px 0 0 0;">© ${new Date().getFullYear()} TicketLink. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

/**
 * Dispatches an email based on a registered template key.
 * If the template is toggled OFF in DB, sending is skipped gracefully.
 */
export async function sendTemplatedEmail(
  eventKey: string,
  recipientEmail: string,
  placeholders: Record<string, string | number | undefined | null>,
  options?: {
    cc?: string | string[];
    includeAdminCc?: boolean;
  }
): Promise<{ success: boolean; reason?: string }> {
  try {
    const smtp = await getSmtpTransporter();
    if (!smtp) {
      console.warn(`[Mailer] SMTP not configured. Skipping email for event: ${eventKey}`);
      return { success: false, reason: "SMTP not configured" };
    }

    // Lookup template in DB
    let template = await db.emailTemplate.findUnique({
      where: { eventKey },
    });

    // If template doesn't exist in DB, fallback to DEFAULT_EMAIL_TEMPLATES
    if (!template) {
      const defaultTmpl = DEFAULT_EMAIL_TEMPLATES.find((t) => t.eventKey === eventKey);
      if (defaultTmpl) {
        template = await db.emailTemplate.create({
          data: {
            eventKey: defaultTmpl.eventKey,
            title: defaultTmpl.title,
            description: defaultTmpl.description,
            subject: defaultTmpl.subject,
            bodyHtml: defaultTmpl.bodyHtml,
            isEnabled: true,
            placeholders: defaultTmpl.placeholders,
          },
        });
      }
    }

    if (!template || !template.isEnabled) {
      return { success: false, reason: "Template disabled or not found" };
    }

    // Replace dynamic placeholders
    let subject = template.subject;
    let body = template.bodyHtml;

    for (const [key, val] of Object.entries(placeholders)) {
      const strVal = val !== undefined && val !== null ? String(val) : "";
      const regex = new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
      subject = subject.replace(regex, strVal);
      body = body.replace(regex, strVal);
    }

    const html = wrapEmailHtml(body);

    // Build unique CC list
    const ccSet = new Set<string>();
    if (options?.cc) {
      const list = Array.isArray(options.cc) ? options.cc : [options.cc];
      list.forEach((e) => {
        const clean = e?.trim();
        if (clean && clean.toLowerCase() !== recipientEmail.toLowerCase()) {
          ccSet.add(clean);
        }
      });
    }

    // Include Admin CC unless explicitly disabled
    if (options?.includeAdminCc !== false) {
      try {
        const smtpRow = await db.smtpConfig.findFirst({ orderBy: { id: "desc" } });
        if (smtpRow?.adminCc) {
          const admins = smtpRow.adminCc.split(/[,;]/).map((e) => e.trim()).filter(Boolean);
          admins.forEach((e) => {
            if (e.toLowerCase() !== recipientEmail.toLowerCase()) {
              ccSet.add(e);
            }
          });
        }
      } catch (err: any) {
        console.warn("[Mailer] Could not query adminCc:", err.message);
      }
    }

    const ccList = Array.from(ccSet);

    await smtp.transporter.sendMail({
      from: smtp.from,
      to: recipientEmail,
      ...(ccList.length > 0 ? { cc: ccList.join(", ") } : {}),
      subject,
      html,
    });

    return { success: true };
  } catch (error: any) {
    console.error(`[Mailer Error] Failed to send ${eventKey} email to ${recipientEmail}:`, error.message);
    return { success: false, reason: error.message };
  }
}

/**
 * Send a test email using specific or saved credentials
 */
export async function sendTestEmail(
  toEmail: string,
  customConfig?: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
    fromName: string;
    fromEmail: string;
  }
): Promise<{ success: boolean; message: string }> {
  try {
    let transporter: any;
    let from: string;

    if (customConfig) {
      transporter = nodemailer.createTransport({
        host: customConfig.host,
        port: customConfig.port,
        secure: customConfig.secure,
        auth: {
          user: customConfig.user,
          pass: customConfig.password,
        },
      });
      from = `"${customConfig.fromName}" <${customConfig.fromEmail || customConfig.user}>`;
    } else {
      const smtp = await getSmtpTransporter();
      if (!smtp) {
        return { success: false, message: "SMTP configuration is incomplete. Please fill in all fields." };
      }
      transporter = smtp.transporter;
      from = smtp.from;
    }

    // Verify SMTP connection
    await transporter.verify();

    // Dispatch test email
    await transporter.sendMail({
      from,
      to: toEmail,
      subject: "TicketLink - SMTP Connection Test",
      html: wrapEmailHtml(`
<p>Hello,</p>
<p style="color: #059669; font-weight: bold;">✅ SMTP Connection Successful!</p>
<p>This is a test email confirming that your Google Workspace SMTP integration is configured properly and ready to dispatch notifications.</p>
<p style="margin-top: 20px; font-size: 13px; color: #64748b;">Timestamp: ${new Date().toLocaleString()}</p>
`),
    });

    return { success: true, message: `Test email successfully sent to ${toEmail}` };
  } catch (error: any) {
    console.error("Test email failed:", error);
    return {
      success: false,
      message: `SMTP Error: ${error.message || "Failed to connect to SMTP server."}`,
    };
  }
}
