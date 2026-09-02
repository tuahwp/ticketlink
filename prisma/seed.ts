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
      eventKey: "AUTH_RESET_PASSWORD",
      title: "Password Reset Request",
      description: "Sent when a user requests a password reset link.",
      subject: "Reset your TicketLink password",
      placeholders: ["{{userName}}", "{{resetLink}}", "{{expiryMinutes}}"],
      bodyHtml: `<p>Hello <strong>{{userName}}</strong>,</p><p>We received a request to reset your password for your TicketLink account.</p><p style="text-align: center; margin: 24px 0;"><a href="{{resetLink}}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a></p><p>This password reset link will expire in <strong>{{expiryMinutes}} minutes</strong>.</p><p>If you did not request this, please ignore this email.</p>`,
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
      subject: "New Dispatch: #{{ticketRefNo}} - {{siteName}} ({{state}})",
      placeholders: ["{{partnerName}}", "{{ticketRefNo}}", "{{siteName}}", "{{state}}", "{{severity}}", "{{mainconName}}", "{{issueDescription}}", "{{ticketLink}}"],
      bodyHtml: `<p>Hello <strong>{{partnerName}} Team</strong>,</p><p>A new service ticket has been dispatched to your agency:</p><div style="background-color: #f8fafc; border-left: 4px solid #0d9488; padding: 12px 16px; margin: 16px 0; border-radius: 4px;"><p style="margin: 4px 0;"><strong>Ticket Ref:</strong> {{ticketRefNo}}</p><p style="margin: 4px 0;"><strong>Client:</strong> {{mainconName}}</p><p style="margin: 4px 0;"><strong>Site Name:</strong> {{siteName}} ({{state}})</p><p style="margin: 4px 0;"><strong>Severity:</strong> <span style="color: #dc2626; font-weight: bold;">{{severity}}</span></p><p style="margin: 4px 0;"><strong>Issue Description:</strong> {{issueDescription}}</p></div><p>Please log in to your dashboard to assign a qualified Field Engineer to this ticket promptly.</p><p style="text-align: center; margin: 24px 0;"><a href="{{ticketLink}}" style="background-color: #0d9488; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Assign Field Engineer</a></p>`,
    },
    {
      eventKey: "TICKET_ASSIGNED",
      title: "Field Engineer Assignment Notification",
      description: "Sent directly to a Field Engineer when they are assigned to a ticket.",
      subject: "Ticket Assigned to You: #{{ticketRefNo}} - {{siteName}}",
      placeholders: ["{{engineerName}}", "{{ticketRefNo}}", "{{siteName}}", "{{state}}", "{{severity}}", "{{issueDescription}}", "{{ticketLink}}"],
      bodyHtml: `<p>Hello <strong>{{engineerName}}</strong>,</p><p>You have been assigned to a service ticket:</p><div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 12px 16px; margin: 16px 0; border-radius: 4px;"><p style="margin: 4px 0;"><strong>Ticket Ref:</strong> {{ticketRefNo}}</p><p style="margin: 4px 0;"><strong>Client Site:</strong> {{siteName}} ({{state}})</p><p style="margin: 4px 0;"><strong>Severity:</strong> <span style="color: #dc2626; font-weight: bold;">{{severity}}</span></p><p style="margin: 4px 0;"><strong>Issue:</strong> {{issueDescription}}</p></div><p style="text-align: center; margin: 24px 0;"><a href="{{ticketLink}}" style="background-color: #2563eb; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Ticket Details</a></p>`,
    },
    {
      eventKey: "TICKET_STATUS_CHANGED",
      title: "Ticket Status Update",
      description: "Sent when a ticket status changes (e.g. In Progress, Resolved, Closed).",
      subject: "Ticket #{{ticketRefNo}} Status Updated: {{newStatus}}",
      placeholders: ["{{recipientName}}", "{{ticketRefNo}}", "{{oldStatus}}", "{{newStatus}}", "{{notes}}", "{{ticketLink}}"],
      bodyHtml: `<p>Hello <strong>{{recipientName}}</strong>,</p><p>The status of ticket <strong>#{{ticketRefNo}}</strong> has been updated:</p><div style="background-color: #f8fafc; border-left: 4px solid #10b981; padding: 12px 16px; margin: 16px 0; border-radius: 4px;"><p style="margin: 4px 0;"><strong>Previous Status:</strong> {{oldStatus}}</p><p style="margin: 4px 0;"><strong>New Status:</strong> <span style="font-weight: bold; color: #059669;">{{newStatus}}</span></p><p style="margin: 4px 0;"><strong>Notes / Details:</strong> {{notes}}</p></div><p style="text-align: center; margin: 24px 0;"><a href="{{ticketLink}}" style="background-color: #059669; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Open Ticket</a></p>`,
    },
    {
      eventKey: "TICKET_SLA_ALERT",
      title: "SLA Warning / Alert",
      description: "Sent when a ticket is approaching or has exceeded its SLA deadline.",
      subject: "⚠️ SLA Alert: Ticket #{{ticketRefNo}} - {{timeRemaining}} remaining",
      placeholders: ["{{recipientName}}", "{{ticketRefNo}}", "{{siteName}}", "{{timeRemaining}}", "{{slaDeadline}}", "{{ticketLink}}"],
      bodyHtml: `<p>Hello <strong>{{recipientName}}</strong>,</p><p style="color: #dc2626; font-weight: bold;">⚠️ SLA Warning Alert</p><p>Ticket <strong>#{{ticketRefNo}}</strong> at <strong>{{siteName}}</strong> is nearing its SLA resolution target.</p><div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; margin: 16px 0; border-radius: 4px;"><p style="margin: 4px 0;"><strong>Time Remaining:</strong> <span style="color: #dc2626; font-weight: bold;">{{timeRemaining}}</span></p><p style="margin: 4px 0;"><strong>Target Deadline:</strong> {{slaDeadline}}</p></div><p style="text-align: center; margin: 24px 0;"><a href="{{ticketLink}}" style="background-color: #dc2626; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Action Ticket Immediately</a></p>`,
    },
  ];

  for (const tmpl of defaultTemplates) {
    await prisma.emailTemplate.upsert({
      where: { eventKey: tmpl.eventKey },
      update: {},
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
