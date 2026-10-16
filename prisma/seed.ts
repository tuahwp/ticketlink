import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import pg from "pg";
import "dotenv/config";

function getPrisma() {
  const url = process.env.DATABASE_URL || "";
  if (url.startsWith("postgresql:") || url.startsWith("postgres:")) {
    const pool = new pg.Pool({ connectionString: url });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
  } else {
    const adapter = new PrismaBetterSqlite3({ url: "dev.db" });
    return new PrismaClient({ adapter });
  }
}

const prisma = getPrisma();

async function main() {
  console.log("Seeding database safely (non-destructive)...");

  // 1. Malaysia States
  const states = [
    "Johor",
    "Kedah",
    "Kelantan",
    "Melaka",
    "Negeri Sembilan",
    "Pahang",
    "Penang",
    "Perak",
    "Perlis",
    "Sabah",
    "Sarawak",
    "Selangor",
    "Terengganu",
    "Kuala Lumpur",
    "Labuan",
    "Putrajaya",
  ];

  for (const state of states) {
    await prisma.state.upsert({
      where: { name: state },
      update: {},
      create: { name: state },
    });
  }
  console.log("Seeded/verified states.");

  // Seeding SLA Configurations
  console.log("Seeding/updating SLA Configurations...");
  const slas = [
    // DEFAULT rules
    { customer: "DEFAULT", severity: "P1", region: "Semenanjung", slaHours: 24 },
    { customer: "DEFAULT", severity: "P1", region: "Sabah/Sarawak", slaHours: 72 },
    { customer: "DEFAULT", severity: "P2", region: "Semenanjung", slaHours: 48 },
    { customer: "DEFAULT", severity: "P2", region: "Sabah/Sarawak", slaHours: 96 },
    { customer: "DEFAULT", severity: "P3", region: "Semenanjung", slaHours: 72 },
    { customer: "DEFAULT", severity: "P3", region: "Sabah/Sarawak", slaHours: 120 },
    { customer: "DEFAULT", severity: "P4", region: "Semenanjung", slaHours: 120 },
    { customer: "DEFAULT", severity: "P4", region: "Sabah/Sarawak", slaHours: 168 },

    // JPJ rules
    { customer: "JPJ", severity: "P1", region: "Semenanjung", slaHours: 24 },
    { customer: "JPJ", severity: "P1", region: "Sabah/Sarawak", slaHours: 72 },
    { customer: "JPJ", severity: "P2", region: "Semenanjung", slaHours: 48 },
    { customer: "JPJ", severity: "P2", region: "Sabah/Sarawak", slaHours: 96 },

    // RELA rules
    { customer: "RELA", severity: "P1", region: "Semenanjung", slaHours: 24 },
    { customer: "RELA", severity: "P1", region: "Sabah/Sarawak", slaHours: 72 },
    { customer: "RELA", severity: "P2", region: "Semenanjung", slaHours: 48 },
    { customer: "RELA", severity: "P2", region: "Sabah/Sarawak", slaHours: 96 },
  ];

  for (const sla of slas) {
    await prisma.customerSla.upsert({
      where: {
        customer_severity_region: {
          customer: sla.customer,
          severity: sla.severity as any,
          region: sla.region,
        },
      },
      update: {
        slaHours: sla.slaHours,
      },
      create: {
        customer: sla.customer,
        severity: sla.severity as any,
        region: sla.region,
        slaHours: sla.slaHours,
      },
    });
  }
  console.log("Seeded SLA Configurations.");

  // 2. Service Partners and Field Engineers (only create if empty to avoid duplication)
  const servicePartnersCount = await prisma.servicePartner.count();
  if (servicePartnersCount === 0) {
    const partner1 = await prisma.servicePartner.create({
      data: {
        name: "Apex Tech Services",
        statesCovered: ["Selangor", "Kuala Lumpur", "Putrajaya"],
        engineers: {
          create: [
            { name: "Ahmad Zaki", phone: "+60 12-345 6789" },
            { name: "Sarah Lim", phone: "+60 13-987 6543" },
          ],
        },
      },
    });

    const partner2 = await prisma.servicePartner.create({
      data: {
        name: "Nusantara Support Ltd",
        statesCovered: ["Penang", "Johor", "Kedah", "Perak"],
        engineers: {
          create: [
            { name: "Suresh Kumar", phone: "+60 17-654 3210" },
            { name: "Mohd Ali", phone: "+60 19-333 4444" },
          ],
        },
      },
    });
    console.log("Seeded Service Partners & Engineers.");
  } else {
    console.log("Service Partners already exist. Skipping seed.");
  }

  // 3. Device Catalog (only create standard devices if catalog is empty)
  const deviceCount = await prisma.deviceCatalog.count();
  if (deviceCount === 0) {
    const devices = [
      { category: "Desktop", brand: "Dell", model: "OptiPlex 7090", isStandard: true },
      { category: "Laptop", brand: "Lenovo", model: "ThinkPad T14", isStandard: true },
      { category: "Printer", brand: "HP", model: "LaserJet Pro M404dn", isStandard: true },
      { category: "Router", brand: "Cisco", model: "ISR 1100", isStandard: true },
      { category: "POS", brand: "Epson", model: "TM-T88VI", isStandard: true },
    ];

    for (const device of devices) {
      await prisma.deviceCatalog.create({
        data: device,
      });
    }

    await prisma.deviceCatalog.create({
      data: {
        category: "Other",
        brand: "Generic",
        model: "Other / On Request",
        isStandard: false,
      },
    });
    console.log("Seeded standard and fallback devices.");
  } else {
    console.log("Device Catalog already populated. Skipping seed.");
  }

  // 4. Maincons, sites, and mock tickets (only seed if Maincon table is empty)
  const mainconCount = await prisma.maincon.count();
  if (mainconCount === 0) {
    // Seed Maincons
    const maincon1 = await prisma.maincon.create({
      data: {
        name: "Telekom Malaysia (TM)",
        sheetName: "TM_Tickets_F2F",
        customFieldsSchema: ["Circuit ID", "VLAN ID", "Router IP"],
        siteCustomers: ["JPJ", "RELA"],
      },
    });

    const maincon2 = await prisma.maincon.create({
      data: {
        name: "Maybank Retail Support",
        sheetName: "MAY_ATM_POS",
        customFieldsSchema: ["Merchant ID", "Terminal Serial"],
        siteCustomers: [],
      },
    });
    console.log("Seeded Maincons.");

    // Seed EndCustomerSites under maincon1 (TM)
    const sitesToSeed = [
      { name: "JPJ Johor Bahru", group: "JPJ", state: "Johor" },
      { name: "JPJ Muar", group: "JPJ", state: "Johor" },
      { name: "RELA Johor Bahru", group: "RELA", state: "Johor" },
      { name: "JPJ Alor Setar", group: "JPJ", state: "Kedah" },
      { name: "JPJ Sungai Petani", group: "JPJ", state: "Kedah" },
      { name: "RELA Alor Setar", group: "RELA", state: "Kedah" },
      { name: "JPJ Kota Bharu", group: "JPJ", state: "Kelantan" },
      { name: "RELA Kota Bharu", group: "RELA", state: "Kelantan" },
      { name: "JPJ Melaka Tengah", group: "JPJ", state: "Melaka" },
      { name: "RELA Melaka Central", group: "RELA", state: "Melaka" },
      { name: "JPJ Seremban", group: "JPJ", state: "Negeri Sembilan" },
      { name: "RELA Seremban", group: "RELA", state: "Negeri Sembilan" },
      { name: "JPJ Kuantan", group: "JPJ", state: "Pahang" },
      { name: "JPJ Temerloh", group: "JPJ", state: "Pahang" },
      { name: "RELA Kuantan", group: "RELA", state: "Pahang" },
      { name: "JPJ Penang (Batu Uban)", group: "JPJ", state: "Penang" },
      { name: "JPJ Seberang Jaya", group: "JPJ", state: "Penang" },
      { name: "RELA Penang HQ", group: "RELA", state: "Penang" },
      { name: "JPJ Ipoh", group: "JPJ", state: "Perak" },
      { name: "JPJ Taiping", group: "JPJ", state: "Perak" },
      { name: "RELA Ipoh Central", group: "RELA", state: "Perak" },
      { name: "JPJ Kangar", group: "JPJ", state: "Perlis" },
      { name: "RELA Kangar HQ", group: "RELA", state: "Perlis" },
      { name: "JPJ Kota Kinabalu", group: "JPJ", state: "Sabah" },
      { name: "JPJ Sandakan", group: "JPJ", state: "Sabah" },
      { name: "RELA Kota Kinabalu", group: "RELA", state: "Sabah" },
      { name: "JPJ Kuching", group: "JPJ", state: "Sarawak" },
      { name: "JPJ Miri", group: "JPJ", state: "Sarawak" },
      { name: "RELA Kuching Central", group: "RELA", state: "Sarawak" },
      { name: "JPJ Shah Alam HQ", group: "JPJ", state: "Selangor" },
      { name: "JPJ Petaling Jaya", group: "JPJ", state: "Selangor" },
      { name: "JPJ Bangi", group: "JPJ", state: "Selangor" },
      { name: "RELA Kajang", group: "RELA", state: "Selangor" },
      { name: "RELA Gombak Office", group: "RELA", state: "Selangor" },
      { name: "RELA Shah Alam HQ", group: "RELA", state: "Selangor" },
      { name: "JPJ Kuala Terengganu", group: "JPJ", state: "Terengganu" },
      { name: "RELA Kuala Terengganu", group: "RELA", state: "Terengganu" },
      { name: "JPJ Kuala Lumpur (Wangsa Maju)", group: "JPJ", state: "Kuala Lumpur" },
      { name: "JPJ Cheras", group: "JPJ", state: "Kuala Lumpur" },
      { name: "RELA Kuala Lumpur HQ", group: "RELA", state: "Kuala Lumpur" },
      { name: "JPJ Labuan HQ", group: "JPJ", state: "Labuan" },
      { name: "RELA Labuan Office", group: "RELA", state: "Labuan" },
      { name: "JPJ Putrajaya HQ", group: "JPJ", state: "Putrajaya" },
      { name: "RELA Putrajaya HQ", group: "RELA", state: "Putrajaya" },
    ];

    for (const site of sitesToSeed) {
      await prisma.endCustomerSite.create({
        data: {
          name: site.name,
          group: site.group,
          state: site.state,
          mainconId: maincon1.id,
        },
      });
    }
    console.log(`Seeded ${sitesToSeed.length} End-Customer Sites.`);

    // Seed mock tickets
    const standardDell = await prisma.deviceCatalog.findFirst({
      where: { brand: "Dell", model: "OptiPlex 7090" },
    });
    const fallback = await prisma.deviceCatalog.findFirst({
      where: { brand: "Generic", category: "Other" },
    });
    const partner1 = await prisma.servicePartner.findFirst({
      where: { name: "Apex Tech Services" },
    });
    const fe1 = await prisma.fieldEngineer.findFirst({
      where: { name: "Ahmad Zaki" },
    });

    await prisma.ticket.create({
      data: {
        ticketRefNo: "TKT-2026-0001",
        clientSiteName: "Maybank KLCC Branch",
        state: "Kuala Lumpur",
        issueDescription: "POS terminal display is flickering and card reader failing.",
        status: "NEW",
        severity: "P2",
        slaDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48h from now
        mainconId: maincon2.id,
        customValues: {
          "Merchant ID": "MICH-8827-KLCC",
          "Terminal Serial": "EPSON-TM-882991",
        },
        deviceId: fallback?.id || null,
        deviceStatus: "ON_REQUEST",
        customDeviceDetails: "Epson TM-T88VI-002 High Speed POS Terminal",
      },
    });

    await prisma.ticket.create({
      data: {
        ticketRefNo: "TKT-2026-0002",
        clientSiteName: "TM Point Petaling Jaya",
        state: "Selangor",
        issueDescription: "Core router interface flapping causing intermittent connectivity.",
        status: "IN_PROGRESS",
        severity: "P1",
        slaDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h from now
        mainconId: maincon1.id,
        customValues: {
          "Circuit ID": "CKT-TM-PJ-009",
          "VLAN ID": "100",
          "Router IP": "10.200.12.1",
        },
        partnerId: partner1?.id,
        assignedFeId: fe1?.id || null,
        deviceId: standardDell?.id || null,
        deviceStatus: "STANDARD",
      },
    });
    console.log("Seeded initial tickets.");
  } else {
    console.log("Maincons/Tickets already populated. Skipping mock ticket seed.");
  }

  // 6. Default Email Templates
  console.log("Seeding/updating default Email Templates...");
  const defaultTemplates = [
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
      bodyHtml: `<p>Hello <strong>{{partnerName}} Team</strong>,</p><p>A new service ticket has been dispatched to your agency:</p><div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #0d9488; padding: 16px; margin: 16px 0; border-radius: 6px;"><div style="font-size: 16px; font-weight: bold; color: #0f172a; margin-bottom: 10px;">#{{ticketRefNo}}: {{subject}}</div><table style="width: 100%; font-size: 13px; line-height: 1.6; border-collapse: collapse;"><tr><td style="width: 130px; color: #64748b; padding: 3px 0;"><strong>Client:</strong></td><td style="color: #1e293b;">{{mainconName}}</td></tr><tr><td style="color: #64748b; padding: 3px 0;"><strong>End Customer:</strong></td><td style="color: #1e293b; font-weight: 600;">{{endCustomer}}</td></tr><tr><td style="color: #64748b; padding: 3px 0;"><strong>Site Premises:</strong></td><td style="color: #1e293b;"><strong>{{siteName}}</strong> ({{state}})</td></tr><tr><td style="color: #64748b; padding: 3px 0;"><strong>Address:</strong></td><td style="color: #1e293b;">{{address}}</td></tr><tr><td style="color: #64748b; padding: 3px 0;"><strong>Severity:</strong></td><td style="color: #dc2626; font-weight: bold;">{{severity}}</td></tr><tr><td style="color: #64748b; padding: 3px 0;"><strong>SLA Target:</strong></td><td style="color: #d97706; font-weight: bold;">{{slaDeadline}}</td></tr><tr><td style="color: #64748b; padding: 3px 0;"><strong>Represent As:</strong></td><td style="color: #0369a1; font-weight: 600;">{{representAs}}</td></tr></table><div style="margin-top: 12px; padding-top: 10px; border-top: 1px dashed #cbd5e1;"><p style="margin: 0 0 4px 0; font-size: 12px; color: #64748b;"><strong>Issue Details:</strong></p><p style="margin: 0; font-size: 13px; color: #334155; white-space: pre-wrap;">{{issueDescription}}</p></div></div><p style="font-size: 13px; color: #475569;">Please log in to your partner portal to assign a qualified Field Engineer promptly.</p><div style="text-align: center; margin: 24px 0;"><a href="{{ticketLink}}" style="background-color: #0d9488; color: #ffffff; padding: 11px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 14px;">Assign Field Engineer</a></div>`,
    },
    {
      eventKey: "TICKET_ASSIGNED",
      title: "Field Engineer Assignment Notification",
      description: "Sent directly to a Field Engineer when they are assigned to a ticket.",
      subject: "Job Assignment: #{{ticketRefNo}} - {{subject}} ({{siteName}})",
      placeholders: ["{{engineerName}}", "{{ticketRefNo}}", "{{subject}}", "{{siteName}}", "{{state}}", "{{endCustomer}}", "{{address}}", "{{mapsUrl}}", "{{severity}}", "{{slaDeadline}}", "{{representAs}}", "{{onSiteSop}}", "{{issueDescription}}", "{{serviceReportBlankUrl}}", "{{ticketLink}}"],
      bodyHtml: `<p>Hello <strong>{{engineerName}}</strong>,</p><p>You have been assigned to a service order. Please review the details below:</p><div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #2563eb; padding: 16px; margin: 16px 0; border-radius: 6px;"><div style="font-size: 16px; font-weight: bold; color: #0f172a; margin-bottom: 10px;">#{{ticketRefNo}}: {{subject}}</div><table style="width: 100%; font-size: 13px; line-height: 1.6; border-collapse: collapse;"><tr><td style="width: 130px; color: #64748b; padding: 3px 0;"><strong>End Customer:</strong></td><td style="color: #1e293b; font-weight: 600;">{{endCustomer}}</td></tr><tr><td style="color: #64748b; padding: 3px 0;"><strong>Client Site:</strong></td><td style="color: #1e293b;"><strong>{{siteName}}</strong> ({{state}})</td></tr><tr><td style="color: #64748b; padding: 3px 0;"><strong>Location Address:</strong></td><td style="color: #1e293b;">{{address}}</td></tr><tr><td style="color: #64748b; padding: 3px 0;"><strong>Severity:</strong></td><td style="color: #dc2626; font-weight: bold;">{{severity}}</td></tr><tr><td style="color: #64748b; padding: 3px 0;"><strong>SLA Target:</strong></td><td style="color: #d97706; font-weight: bold;">{{slaDeadline}}</td></tr><tr><td style="color: #64748b; padding: 3px 0;"><strong>Representing:</strong></td><td style="color: #0284c7; font-weight: 600;">{{representAs}}</td></tr></table><div style="margin: 14px 0; background-color: #eff6ff; border: 1px solid #bfdbfe; border-left: 4px solid #3b82f6; border-radius: 6px; padding: 12px 14px;"><div style="font-size: 13px; font-weight: bold; color: #1e40af; margin-bottom: 4px;">🧰 Required Equipment & On-Site Protocol:</div><div style="font-size: 13px; color: #1e3a8a; line-height: 1.5; white-space: pre-wrap;">{{onSiteSop}}</div></div><div style="margin-top: 12px; padding-top: 10px; border-top: 1px dashed #cbd5e1;"><p style="margin: 0 0 4px 0; font-size: 12px; color: #64748b;"><strong>Issue Description:</strong></p><p style="margin: 0; font-size: 13px; color: #334155; white-space: pre-wrap;">{{issueDescription}}</p></div></div><div style="text-align: center; margin: 24px 0;"><a href="{{ticketLink}}" style="background-color: #2563eb; color: #ffffff; padding: 11px 22px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 13px; margin: 4px;">Open Mobile Dashboard</a><a href="{{mapsUrl}}" style="background-color: #0f172a; color: #ffffff; padding: 11px 22px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 13px; margin: 4px;">Navigate (Google Maps)</a></div>`,
    },
    {
      eventKey: "TICKET_RESOLVED",
      title: "Ticket Resolved & Service Report Available",
      description: "Sent to the Partner agency dispatch desk and Main Contractor client when a ticket is resolved with signed service report.",
      subject: "✅ Ticket Resolved: #{{ticketRefNo}} - {{siteName}} ({{state}})",
      placeholders: ["{{recipientName}}", "{{ticketRefNo}}", "{{subject}}", "{{siteName}}", "{{state}}", "{{engineerName}}", "{{resolvedAt}}", "{{turnaroundTime}}", "{{resolutionNotes}}", "{{serviceReportUrl}}", "{{ticketLink}}"],
      bodyHtml: `<p>Hello <strong>{{recipientName}}</strong>,</p><p style="color: #059669; font-weight: bold; font-size: 16px; margin: 8px 0;">✅ Service Ticket Successfully Resolved</p><p>Ticket <strong>#{{ticketRefNo}}</strong> at <strong>{{siteName}}</strong> has been resolved and verified on-site.</p><div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-left: 4px solid #10b981; padding: 16px; margin: 16px 0; border-radius: 6px;"><div style="font-size: 15px; font-weight: bold; color: #065f46; margin-bottom: 8px;">#{{ticketRefNo}}: {{subject}}</div><table style="width: 100%; font-size: 13px; line-height: 1.6; border-collapse: collapse;"><tr><td style="width: 140px; color: #047857; padding: 3px 0;"><strong>Site / Branch:</strong></td><td style="color: #1e293b;">{{siteName}} ({{state}})</td></tr><tr><td style="color: #047857; padding: 3px 0;"><strong>Resolved By:</strong></td><td style="color: #1e293b;">{{engineerName}}</td></tr><tr><td style="color: #047857; padding: 3px 0;"><strong>Completion Time:</strong></td><td style="color: #1e293b;">{{resolvedAt}}</td></tr><tr><td style="color: #047857; padding: 3px 0;"><strong>Turnaround Time:</strong></td><td style="color: #1e293b; font-weight: bold;">{{turnaroundTime}}</td></tr></table><div style="margin-top: 12px; padding-top: 10px; border-top: 1px dashed #86efac;"><p style="margin: 0 0 4px 0; font-size: 12px; color: #047857;"><strong>Resolution Summary / Notes:</strong></p><p style="margin: 0; font-size: 13px; color: #1e293b; white-space: pre-wrap;">{{resolutionNotes}}</p></div></div><div style="text-align: center; margin: 24px 0;"><a href="{{serviceReportUrl}}" style="background-color: #059669; color: #ffffff; padding: 11px 22px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 13px; margin: 4px;">Download Signed Service Report</a><a href="{{ticketLink}}" style="background-color: #0f172a; color: #ffffff; padding: 11px 22px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 13px; margin: 4px;">View Full Ticket</a></div>`,
    },
    {
      eventKey: "TICKET_STATUS_CHANGED",
      title: "Ticket Status Update",
      description: "Sent when a ticket status changes (e.g. In Progress, On Hold, Follow Up, Cancelled).",
      subject: "Ticket #{{ticketRefNo}} Status Updated: {{newStatus}}",
      placeholders: ["{{recipientName}}", "{{ticketRefNo}}", "{{subject}}", "{{oldStatus}}", "{{newStatus}}", "{{notes}}", "{{ticketLink}}"],
      bodyHtml: `<p>Hello <strong>{{recipientName}}</strong>,</p><p>The status of ticket <strong>#{{ticketRefNo}}</strong> has been updated:</p><div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #3b82f6; padding: 16px; margin: 16px 0; border-radius: 6px;"><p style="margin: 0 0 6px 0; font-size: 14px; font-weight: bold; color: #0f172a;">{{subject}}</p><table style="width: 100%; font-size: 13px; line-height: 1.6; border-collapse: collapse;"><tr><td style="width: 130px; color: #64748b; padding: 3px 0;"><strong>Previous Status:</strong></td><td style="color: #64748b;">{{oldStatus}}</td></tr><tr><td style="width: 130px; color: #64748b; padding: 3px 0;"><strong>New Status:</strong></td><td style="color: #2563eb; font-weight: bold;">{{newStatus}}</td></tr><tr><td style="width: 130px; color: #64748b; padding: 3px 0;"><strong>Notes:</strong></td><td style="color: #334155;">{{notes}}</td></tr></table></div><div style="text-align: center; margin: 24px 0;"><a href="{{ticketLink}}" style="background-color: #2563eb; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 13px;">View Ticket</a></div>`,
    },
    {
      eventKey: "TICKET_SLA_ALERT",
      title: "SLA Warning / Alert",
      description: "Sent when a ticket is approaching or has exceeded its SLA deadline.",
      subject: "⚠️ SLA Alert: Ticket #{{ticketRefNo}} - {{timeRemaining}} remaining ({{siteName}})",
      placeholders: ["{{recipientName}}", "{{ticketRefNo}}", "{{subject}}", "{{siteName}}", "{{state}}", "{{severity}}", "{{timeRemaining}}", "{{slaDeadline}}", "{{ticketLink}}"],
      bodyHtml: `<p>Hello <strong>{{recipientName}}</strong>,</p><div style="background-color: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #ef4444; padding: 16px; margin: 16px 0; border-radius: 6px;"><div style="font-size: 16px; font-weight: bold; color: #dc2626; margin-bottom: 8px;">⚠️ Urgent: SLA Target Expiration Imminent</div><p style="margin: 0 0 10px 0; font-size: 13px; color: #7f1d1d;">Ticket <strong>#{{ticketRefNo}}</strong> is within <strong>{{timeRemaining}}</strong> of breaching its contractual SLA deadline.</p><table style="width: 100%; font-size: 13px; line-height: 1.6; border-collapse: collapse;"><tr><td style="width: 130px; color: #991b1b; padding: 3px 0;"><strong>Site Name:</strong></td><td style="color: #1e293b;"><strong>{{siteName}}</strong> ({{state}})</td></tr><tr><td style="width: 130px; color: #991b1b; padding: 3px 0;"><strong>Severity:</strong></td><td style="color: #dc2626; font-weight: bold;">{{severity}}</td></tr><tr><td style="width: 130px; color: #991b1b; padding: 3px 0;"><strong>Target Deadline:</strong></td><td style="color: #dc2626; font-weight: bold;">{{slaDeadline}}</td></tr><tr><td style="width: 130px; color: #991b1b; padding: 3px 0;"><strong>Time Left:</strong></td><td style="color: #b91c1c; font-weight: 800; font-size: 14px;">{{timeRemaining}}</td></tr></table></div><div style="text-align: center; margin: 24px 0;"><a href="{{ticketLink}}" style="background-color: #dc2626; color: #ffffff; padding: 11px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 14px;">Action Ticket Now</a></div>`,
    },
    {
      eventKey: "SPARE_PART_DISPATCHED",
      title: "Spare Part Courier Dispatch Notification",
      description: "Sent to the Field Engineer and Partner depot when warehouse hardware is shipped via courier.",
      subject: "📦 Spare Part Dispatched: #{{ticketRefNo}} - {{partName}} ({{courierName}})",
      placeholders: ["{{recipientName}}", "{{ticketRefNo}}", "{{siteName}}", "{{partName}}", "{{serialNumber}}", "{{quantity}}", "{{courierName}}", "{{trackingNumber}}", "{{trackingLink}}", "{{warehouseName}}", "{{dispatchedBy}}", "{{ticketLink}}"],
      bodyHtml: `<p>Hello <strong>{{recipientName}}</strong>,</p><p>A replacement spare part has been allocated and dispatched via courier for ticket <strong>#{{ticketRefNo}}</strong>:</p><div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #f59e0b; padding: 16px; margin: 16px 0; border-radius: 6px;"><div style="font-size: 16px; font-weight: bold; color: #0f172a; margin-bottom: 8px;">📦 Shipment: {{partName}}</div><table style="width: 100%; font-size: 13px; line-height: 1.6; border-collapse: collapse;"><tr><td style="width: 140px; color: #64748b; padding: 3px 0;"><strong>Courier Service:</strong></td><td style="color: #1e293b; font-weight: 600;">{{courierName}}</td></tr><tr><td style="color: #64748b; padding: 3px 0;"><strong>Tracking Number:</strong></td><td style="color: #0284c7; font-weight: bold; font-family: monospace; font-size: 14px;">{{trackingNumber}}</td></tr><tr><td style="color: #64748b; padding: 3px 0;"><strong>Serial Number:</strong></td><td style="color: #1e293b; font-family: monospace;">{{serialNumber}}</td></tr><tr><td style="color: #64748b; padding: 3px 0;"><strong>Quantity:</strong></td><td style="color: #1e293b;">{{quantity}} unit(s)</td></tr><tr><td style="color: #64748b; padding: 3px 0;"><strong>Destination Site:</strong></td><td style="color: #1e293b;">{{siteName}}</td></tr><tr><td style="color: #64748b; padding: 3px 0;"><strong>Origin Warehouse:</strong></td><td style="color: #1e293b;">{{warehouseName}}</td></tr></table></div><div style="text-align: center; margin: 24px 0;"><a href="{{trackingLink}}" style="background-color: #f59e0b; color: #0f172a; padding: 11px 22px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 13px; margin: 4px;">Track Courier Shipment</a><a href="{{ticketLink}}" style="background-color: #0f172a; color: #ffffff; padding: 11px 22px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 13px; margin: 4px;">View Ticket Workspace</a></div>`,
    },
  ];

  for (const tmpl of defaultTemplates) {
    await prisma.emailTemplate.upsert({
      where: { eventKey: tmpl.eventKey },
      update: {
        title: tmpl.title,
        description: tmpl.description,
        subject: tmpl.subject,
        bodyHtml: tmpl.bodyHtml,
        placeholders: tmpl.placeholders,
      },
      create: tmpl,
    });
  }
  console.log("Seeded/verified Email Templates.");

  console.log("Database seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
