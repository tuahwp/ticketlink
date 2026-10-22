import "dotenv/config";

// ── STRICT SECURITY GUARD ──
// Skrip ini memanipulasi ID Maincon dan ID Tiket spesifik untuk ujian tempatan.
// DILARANG SAMA SEKALI dijalankan dalam persekitaran production.
if (process.env.NODE_ENV === "production") {
  throw new Error("SECURITY GUARD: Skrip seed ujian local DILARANG sama sekali dijalankan dalam persekitaran PRODUCTION!");
}
const dbUrl = process.env.DATABASE_URL || "";
if (!dbUrl.includes("localhost") && !dbUrl.includes("127.0.0.1")) {
  throw new Error(
    `SECURITY GUARD: Skrip seed ujian local hanya dibenarkan pada DATABASE_URL localhost / 127.0.0.1. URL dikesan bukan local: ${dbUrl.replace(/:[^:@]+@/, ":***@")}`
  );
}

import { db } from "../src/lib/db";

async function main() {
  console.log("Seeding local test tickets for FE v2 (1811 - 1820)...");

  // 1. Identify FE user Ezat Sazrul
  const fe = await db.fieldEngineer.findFirst({
    where: {
      OR: [
        { name: { contains: "Ezat", mode: "insensitive" } },
        { id: 4 }
      ]
    },
    include: { partner: true }
  });

  if (!fe) {
    throw new Error("Local Field Engineer 'Ezat' (FE-4) not found!");
  }
  console.log(`Using FE: ${fe.id} - ${fe.name}`);

  // 2. Ensure Maincons have required configurations & schemas
  // Infomina (id 9)
  const infomina = await db.maincon.upsert({
    where: { id: 9 },
    update: {
      name: "Infomina",
      customFieldsSchema: {
        default: ["Name", "Contact", "Asset Location", "Warranty", "Asset Serial Number"],
        endCustomers: {
          "JPJ": ["Name", "Contact", "Asset Location", "Warranty", "Asset Serial Number"],
          "JPJ AES": ["Coordinate", "IP Address", "Infomina Person Name", "Contact Number", "Asset Serial Number"]
        }
      }
    },
    create: {
      id: 9,
      name: "Infomina",
      sheetName: "Infomina",
      customFieldsSchema: {
        default: ["Name", "Contact", "Asset Location", "Warranty", "Asset Serial Number"],
        endCustomers: {
          "JPJ": ["Name", "Contact", "Asset Location", "Warranty", "Asset Serial Number"],
          "JPJ AES": ["Coordinate", "IP Address", "Infomina Person Name", "Contact Number", "Asset Serial Number"]
        }
      }
    }
  });

  // Simplexity (id 2)
  const simplexity = await db.maincon.upsert({
    where: { id: 2 },
    update: {
      name: "Simplexity MY",
      principalsConfig: [
        {
          name: "Exands Pte Ltd",
          onSiteSop: "Check in at Sephora Back Office. Wear security lanyard. Contact store manager before opening register.",
          logoUrl: null
        }
      ]
    },
    create: {
      id: 2,
      name: "Simplexity MY",
      sheetName: "Simplexity",
      customFieldsSchema: ["Store PIC", "PIC Contact", "Terminal ID"],
      principalsConfig: [
        {
          name: "Exands Pte Ltd",
          onSiteSop: "Check in at Sephora Back Office. Wear security lanyard. Contact store manager before opening register.",
          logoUrl: null
        }
      ]
    }
  });

  // Brocent (id 1)
  const brocent = await db.maincon.upsert({
    where: { id: 1 },
    update: {
      name: "Brocent International",
      customFieldsSchema: ["Site Name", "Intervention Date", "POC", "POC Contact"],
      principalsConfig: [
        {
          name: "Citic",
          onSiteSop: "Strict White-Label Protocol: Represent as Citic Telecom Engineer. Do not mention Brocent or third party.",
          logoUrl: null
        }
      ]
    },
    create: {
      id: 1,
      name: "Brocent International",
      sheetName: "Brocent",
      customFieldsSchema: ["Site Name", "Intervention Date", "POC", "POC Contact"],
      principalsConfig: [
        {
          name: "Citic",
          onSiteSop: "Strict White-Label Protocol: Represent as Citic Telecom Engineer. Do not mention Brocent or third party.",
          logoUrl: null
        }
      ]
    }
  });

  // Rex Technologies (id 4)
  const rex = await db.maincon.upsert({
    where: { id: 4 },
    update: {
      name: "Rex Technologies",
      customFieldsSchema: ["Intervention Date", "SPOC Name", "SPOC Contact", "Gate Pass"]
    },
    create: {
      id: 4,
      name: "Rex Technologies",
      sheetName: "Rex",
      customFieldsSchema: ["Intervention Date", "SPOC Name", "SPOC Contact", "Gate Pass"]
    }
  });

  // 3. Ensure Customer Group Logos exist
  await db.customerGroupLogo.upsert({
    where: { group_mainconId: { group: "Sephora", mainconId: simplexity.id } },
    update: { logoUrl: "https://upload.wikimedia.org/wikipedia/commons/2/25/Sephora_logo.svg" },
    create: { group: "Sephora", mainconId: simplexity.id, logoUrl: "https://upload.wikimedia.org/wikipedia/commons/2/25/Sephora_logo.svg" }
  });

  await db.customerGroupLogo.upsert({
    where: { group_mainconId: { group: "NIKE", mainconId: rex.id } },
    update: { logoUrl: "https://upload.wikimedia.org/wikipedia/commons/a/a6/Logo_NIKE.svg" },
    create: { group: "NIKE", mainconId: rex.id, logoUrl: "https://upload.wikimedia.org/wikipedia/commons/a/a6/Logo_NIKE.svg" }
  });

  // 4. Create or update the 10 test tickets (1811 - 1820)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);

  const testTickets = [
    // 1811: Infomina / JPJ standard
    {
      id: 1811,
      ticketRefNo: "IT261022011",
      clientSiteName: "JPJ Cawangan Padang Jawa",
      state: "Selangor",
      subject: "Penggantian Pencetak Kaunter 4",
      issueDescription: "Pencetak lesen memandu mengeluarkan kod ralat E-04 paper feed jam secara berulang.",
      status: "IN_PROGRESS" as const,
      subStatus: "CHECKED_IN",
      severity: "P2" as const,
      slaDeadline: new Date(Date.now() + 4 * 3600 * 1000),
      endCustomer: "JPJ",
      representAs: null,
      onSiteSop: "Daftar di kaunter penyelia JPJ Padang Jawa tingkat 1 sebelum memulakan servis.",
      mainconId: infomina.id,
      assignedFeId: fe.id,
      partnerId: fe.partnerId,
      address: "Jalan Padang Jawa, Seksyen 16, 40200 Shah Alam, Selangor",
      customDeviceDetails: "Epson TM-C3500 Color Label Printer / SN: G34K9021884",
      serviceReportTemplateName: "Borang Servis Rasmi JPJ v3.2",
      customValues: {
        "Name": "En. Kamarul Azman (Penyelia Kaunter)",
        "Contact": "019-3324155",
        "Asset Location": "Blok B, Kaunter No. 4",
        "Warranty": "Aktif sehingga Dis 2027",
        "Asset Serial Number": "EPS-TM35-99214"
      }
    },
    // 1812: Infomina / JPJ AES with coordinate in address & custom field
    {
      id: 1812,
      ticketRefNo: "IT261022012",
      clientSiteName: "Kamera AES KM 375.4 Lebuhraya PLUS",
      state: "Perak",
      subject: "Pemeriksaan Modul Komunikasi Kamera Kelajuan AES",
      issueDescription: "Modul 4G router hilang sambungan telemetri ke pusat kawalan sejak jam 04:00 pagi.",
      status: "IN_PROGRESS" as const,
      subStatus: "ENROUTE",
      eta: new Date(Date.now() + 45 * 60 * 1000),
      severity: "P1" as const,
      slaDeadline: new Date(Date.now() + 2 * 3600 * 1000),
      endCustomer: "JPJ AES",
      representAs: null,
      onSiteSop: "Pakai jaket keselamatan pantulan cahaya, letak kon keselamatan 50 meter sebelum gantry.",
      mainconId: infomina.id,
      assignedFeId: fe.id,
      partnerId: fe.partnerId,
      address: "4.2967451, 100.7547865, Perak, Malaysia",
      customDeviceDetails: "Cisco Industrial Router IR1101 Ruggedized / SN: FOC24190XY1",
      serviceReportTemplateName: "Laporan Pemeriksaan Luar Tapak AES",
      customValues: {
        "Coordinate": "4.2967451, 100.7547865",
        "IP Address": "10.240.118.42",
        "Infomina Person Name": "Ir. Hafizul Syukri (Jurutera Rangkaian)",
        "Contact Number": "012-9844201",
        "Asset Serial Number": "AES-CSCO-IR1101"
      }
    },
    // 1813: Simplexity / Sephora with representAs "Exands Pte Ltd"
    {
      id: 1813,
      ticketRefNo: "IT261022013",
      clientSiteName: "Sephora Suria KLCC",
      state: "Kuala Lumpur",
      subject: "Penyelenggaraan POS Terminal & Barcode Scanner",
      issueDescription: "Barcode scanner Datalogic tidak membaca kod bar pelanggan di kaunter pembayaran 2.",
      status: "NEW" as const,
      subStatus: null,
      severity: "P3" as const,
      slaDeadline: new Date(Date.now() + 8 * 3600 * 1000),
      endCustomer: "Sephora",
      representAs: "Exands Pte Ltd",
      onSiteSop: "Patuhi etika pakaian hitam Exands, laporkan diri kepada Penolong Pengurus Kedai Sephora.",
      mainconId: simplexity.id,
      assignedFeId: fe.id,
      partnerId: fe.partnerId,
      address: "Lot C22, Concourse Floor, Suria KLCC, 50088 Kuala Lumpur",
      customDeviceDetails: "Datalogic QuickScan QD2430 2D Scanner / Model: QD2430-BK-K1",
      serviceReportTemplateName: "Exands Global Retail Service Sheet",
      customValues: {
        "Store PIC": "Cik Natasha Lee",
        "PIC Contact": "017-8899120",
        "Terminal ID": "SEPH-KLCC-POS02"
      }
    },
    // 1814: Brocent (no endCustomer) with representAs "Citic"
    {
      id: 1814,
      ticketRefNo: "IT261022014",
      clientSiteName: "Brocent POP Cyberjaya Hub",
      state: "Selangor",
      subject: "Pemeriksaan Suis Tulang Belakang Aras 2",
      issueDescription: "SFP port 24 flapping link error pada suis pengagihan.",
      status: "IN_PROGRESS" as const,
      subStatus: "CHECKED_IN",
      severity: "P2" as const,
      slaDeadline: new Date(Date.now() + 5 * 3600 * 1000),
      endCustomer: null,
      representAs: "Citic",
      onSiteSop: "Pamerkan lencana Citic Telecom. Dilarang mendedahkan nama Brocent di premis klien.",
      mainconId: brocent.id,
      assignedFeId: fe.id,
      partnerId: fe.partnerId,
      address: "Persiaran Multimedia, Cyber 6, 63000 Cyberjaya, Selangor",
      customDeviceDetails: "Juniper EX4300-48T 48-Port Gigabit Switch / EX430048T-2024",
      serviceReportTemplateName: "Citic Telecom Onsite Intervention Report",
      customValues: {
        "Site Name": "Citic / Brocent Cyberjaya Datacenter",
        "Intervention Date": "23 Okt 2026, 11:30 pagi",
        "POC": "Ts. Farhan Radzi",
        "POC Contact": "013-4455890"
      }
    },
    // 1815: Rex / NIKE with Intervention Date (Tomorrow), SPOC Name, SPOC Contact
    {
      id: 1815,
      ticketRefNo: "IT261022015",
      clientSiteName: "NIKE Factory Store Mitsui Outlet",
      state: "Selangor",
      subject: "Pemasangan Access Point Wi-Fi Tambahan",
      issueDescription: "Kawasan gudang belakang tiada liputan rangkaian untuk terminal stok PDA.",
      status: "NEW" as const,
      subStatus: null,
      severity: "P3" as const,
      slaDeadline: new Date(Date.now() + 24 * 3600 * 1000),
      endCustomer: "NIKE",
      representAs: null,
      onSiteSop: "SOP Rex-Nike: Kerja kabel mesti disiapkan sebelum waktu pembukaan premis jam 10:00 pagi.",
      mainconId: rex.id,
      assignedFeId: fe.id,
      partnerId: fe.partnerId,
      address: "Lot F60, Mitsui Outlet Park KLIA, 64000 Sepang, Selangor",
      customDeviceDetails: "Cisco Catalyst 9115AX Series Wi-Fi 6 Access Point / C9115AXI-E",
      serviceReportTemplateName: "Rex Technical Handover Form",
      customValues: {
        "Intervention Date": tomorrow.toISOString(),
        "SPOC Name": "Mr. Bernard Khoo",
        "SPOC Contact": "018-2233901",
        "Gate Pass": "MITSUI-STORE-PASS-904"
      }
    },
    // 1816: FOLLOW_UP (SLA paused / Ditangguhkan)
    {
      id: 1816,
      ticketRefNo: "IT261022016",
      clientSiteName: "JPJ Cawangan Petaling Jaya",
      state: "Selangor",
      subject: "Kerosakan Motherboard Kiosk Pembaharuan Lesen",
      issueDescription: "Kiosk No. 2 mati secara tiba-tiba akibat voltan lonjakan.",
      status: "ON_HOLD" as const,
      subStatus: "PENDING_PARTS",
      severity: "P2" as const,
      slaDeadline: new Date(Date.now() + 6 * 3600 * 1000),
      slaPaused: true,
      slaPausedAt: new Date(Date.now() - 3600 * 1000),
      endCustomer: "JPJ",
      representAs: null,
      onSiteSop: "Tutup suis kuasa kiosk dan letak papan tanda 'Dalam Penyelenggaraan'.",
      mainconId: infomina.id,
      assignedFeId: fe.id,
      partnerId: fe.partnerId,
      address: "Jalan Sultan, Seksyen 52, 46200 Petaling Jaya, Selangor",
      customDeviceDetails: "Advantech AIMB-586 Industrial Micro-ATX Motherboard / SN: ADV9912048",
      serviceReportTemplateName: "Borang Servis Rasmi JPJ v3.2",
      customValues: {
        "Name": "Pn. Rosnah Md Din",
        "Contact": "012-3344911",
        "Asset Location": "Lobi Utama Kiosk 2",
        "Warranty": "Aktif",
        "Asset Serial Number": "KIOSK-MB-586"
      }
    },
    // 1817: RESOLVED (Tiket Selesai)
    {
      id: 1817,
      ticketRefNo: "IT261022017",
      clientSiteName: "Sephora Mid Valley Megamall",
      state: "Kuala Lumpur",
      subject: "Pertukaran Unit Bekalan Kuasa (PSU) Kaunter 1",
      issueDescription: "PSU mengeluarkan bau hangit dan tidak membekalkan voltan 12V stabil.",
      status: "RESOLVED" as const,
      subStatus: "COMPLETED",
      severity: "P3" as const,
      slaDeadline: new Date(Date.now() - 2 * 3600 * 1000),
      resolvedAt: new Date(Date.now() - 3600 * 1000),
      endCustomer: "Sephora",
      representAs: "Exands Pte Ltd",
      onSiteSop: "Patuhi etika pakaian hitam Exands.",
      mainconId: simplexity.id,
      assignedFeId: fe.id,
      partnerId: fe.partnerId,
      address: "Lot F-035, First Floor, Mid Valley Megamall, Lingkaran Syed Putra, 59200 Kuala Lumpur",
      customDeviceDetails: "Seasonic SSP-300SUB 300W 1U Flex ATX Power Supply / SS300SUB-9941",
      serviceReportTemplateName: "Exands Global Retail Service Sheet",
      serviceReportUrl: "https://example.com/reports/sr-1817-signed.pdf",
      customValues: {
        "Store PIC": "Puan Michelle Tan",
        "PIC Contact": "016-5544321",
        "Terminal ID": "SEPH-MV-POS01"
      }
    },
    // 1818: Rex / NIKE with long Model/Serial (wrap 2 lines test)
    {
      id: 1818,
      ticketRefNo: "IT261022018",
      clientSiteName: "NIKE Pavillion Bukit Jalil",
      state: "Kuala Lumpur",
      subject: "Konfigurasi Firewall & SD-WAN Gateway",
      issueDescription: "Gagal berhubung dengan gateway pusat kerana port WAN DHCP drop.",
      status: "IN_PROGRESS" as const,
      subStatus: "CHECKED_IN",
      severity: "P2" as const,
      slaDeadline: new Date(Date.now() + 3 * 3600 * 1000),
      endCustomer: "NIKE",
      representAs: null,
      onSiteSop: "Pastikan sandaran konfigurasi dibuat sebelum memuat semula firmware.",
      mainconId: rex.id,
      assignedFeId: fe.id,
      partnerId: fe.partnerId,
      address: "Lot 2.45.00, Level 2, Pavilion Bukit Jalil, 57000 Kuala Lumpur",
      customDeviceDetails: "Fortinet FortiGate 100F Enterprise Next-Generation Security Gateway / FG100FTK21009842X-MY01",
      serviceReportTemplateName: "Rex Technical Handover Form",
      customValues: {
        "Intervention Date": "24 Okt 2026, 09:00 pagi",
        "SPOC Name": "Encik Danial Hakim",
        "SPOC Contact": "017-3322119",
        "Gate Pass": "PAV-BJ-SECURITY-2026"
      }
    },
    // 1819: Brocent without template name (test hide "Templat:" line)
    {
      id: 1819,
      ticketRefNo: "IT261022019",
      clientSiteName: "Brocent Regional Logistics Point",
      state: "Selangor",
      subject: "Pemeriksaan Berkala Kabel Struktur Aras 1",
      issueDescription: "Ujian flukemeter kabel patch panel cat6.",
      status: "NEW" as const,
      subStatus: null,
      severity: "P4" as const,
      slaDeadline: new Date(Date.now() + 48 * 3600 * 1000),
      endCustomer: null,
      representAs: "Citic",
      onSiteSop: null, // Test default system BM SOP fallback
      mainconId: brocent.id,
      assignedFeId: fe.id,
      partnerId: fe.partnerId,
      address: "Jalan 222, Seksyen 51A, 46100 Petaling Jaya, Selangor",
      customDeviceDetails: "Schneider Actassi Patch Panel 24-Port Cat6 / ACT-PP24C6",
      serviceReportTemplateName: null, // null template name
      customValues: {
        "Site Name": "Brocent PJ Logistics Store",
        "Intervention Date": "Tarikh akan ditetapkan oleh NOC", // unparseable string
        "POC": "Ts. Azizi Rahman",
        "POC Contact": "019-9944112"
      }
    },
    // 1820: Infomina / JPJ AES with coordinate in address only (starts with lat,lng)
    {
      id: 1820,
      ticketRefNo: "IT261022020",
      clientSiteName: "Gantry AES KM 214 Lebuhraya Utara Selatan",
      state: "Negeri Sembilan",
      subject: "Gantian Sensor Induksi Gelung Jalan (Inductive Loop)",
      issueDescription: "Sensor laluan lorong kiri tidak mengesan kenderaan melebihi 110km/j.",
      status: "IN_PROGRESS" as const,
      subStatus: "ENROUTE",
      eta: new Date(Date.now() + 20 * 60 * 1000),
      severity: "P2" as const,
      slaDeadline: new Date(Date.now() + 4 * 3600 * 1000),
      endCustomer: "JPJ AES",
      representAs: null,
      onSiteSop: "Dapatkan bantuan peronda PLUS sebelum menutup lorong paling kanan.",
      mainconId: infomina.id,
      assignedFeId: fe.id,
      partnerId: fe.partnerId,
      address: "2.514210, 102.041280, Negeri Sembilan, Malaysia",
      customDeviceDetails: "Traficon TrafiCam Thermal Sensor / TC-TH2020",
      serviceReportTemplateName: "Laporan Pemeriksaan Luar Tapak AES",
      customValues: {
        "IP Address": "10.240.210.15",
        "Infomina Person Name": "En. Shahrul Nizam",
        "Contact Number": "013-8822410",
        "Asset Serial Number": "AES-SENSOR-LOOP-02"
      }
    }
  ];

  for (const t of testTickets) {
    await db.ticket.upsert({
      where: { id: t.id },
      update: {
        ticketRefNo: t.ticketRefNo,
        clientSiteName: t.clientSiteName,
        state: t.state,
        subject: t.subject,
        issueDescription: t.issueDescription,
        status: t.status,
        subStatus: t.subStatus,
        severity: t.severity,
        slaDeadline: t.slaDeadline,
        slaPaused: (t as any).slaPaused || false,
        slaPausedAt: (t as any).slaPausedAt || null,
        resolvedAt: (t as any).resolvedAt || null,
        eta: (t as any).eta || null,
        endCustomer: t.endCustomer,
        representAs: t.representAs,
        onSiteSop: t.onSiteSop,
        mainconId: t.mainconId,
        assignedFeId: t.assignedFeId,
        partnerId: t.partnerId,
        address: t.address,
        customDeviceDetails: t.customDeviceDetails,
        serviceReportTemplateName: t.serviceReportTemplateName,
        serviceReportUrl: (t as any).serviceReportUrl || null,
        customValues: t.customValues
      },
      create: {
        id: t.id,
        ticketRefNo: t.ticketRefNo,
        clientSiteName: t.clientSiteName,
        state: t.state,
        subject: t.subject,
        issueDescription: t.issueDescription,
        status: t.status,
        subStatus: t.subStatus,
        severity: t.severity,
        slaDeadline: t.slaDeadline,
        slaPaused: (t as any).slaPaused || false,
        slaPausedAt: (t as any).slaPausedAt || null,
        resolvedAt: (t as any).resolvedAt || null,
        eta: (t as any).eta || null,
        endCustomer: t.endCustomer,
        representAs: t.representAs,
        onSiteSop: t.onSiteSop,
        mainconId: t.mainconId,
        assignedFeId: t.assignedFeId,
        partnerId: t.partnerId,
        address: t.address,
        customDeviceDetails: t.customDeviceDetails,
        serviceReportTemplateName: t.serviceReportTemplateName,
        serviceReportUrl: (t as any).serviceReportUrl || null,
        customValues: t.customValues
      }
    });
    console.log(`Seeded Ticket ${t.id}: ${t.clientSiteName} (${t.endCustomer || "No EndCustomer"} / ${t.representAs || "No Rep"})`);
  }

  console.log("Seeding complete! 10 test tickets ready.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
