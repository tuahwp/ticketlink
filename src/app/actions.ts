"use server";

import { db } from "@/lib/db";
import { hashPassword, verifyPassword, createSessionCookie, destroySessionCookie, getSessionUser } from "@/lib/auth";
import { sendTemplatedEmail, sendTestEmail, DEFAULT_EMAIL_TEMPLATES } from "@/lib/mailer";
import crypto from "crypto";
// revalidatePath removed - caused React #441 in production
import { Severity, UserRole, InventoryStatus, SparePartRequestStatus, InventoryTrackingType } from "../generated/prisma/client";

export async function getStates() {
  try {
    // One-time auto-migration: ensure Malacca is updated to Melaka
    await db.state.updateMany({
      where: { name: "Malacca" },
      data: { name: "Melaka" },
    }).catch(() => {});

    await db.ticket.updateMany({
      where: { state: "Malacca" },
      data: { state: "Melaka" },
    }).catch(() => {});

    await db.endCustomerSite.updateMany({
      where: { state: "Malacca" },
      data: { state: "Melaka" },
    }).catch(() => {});

    const dbStates = await db.state.findMany({
      orderBy: { name: "asc" }
    });
    if (dbStates && dbStates.length > 0) {
      return dbStates;
    }
  } catch (error) {
    console.error("Failed to fetch states from DB:", error);
  }

  // Fallback static list of Malaysian states if DB has none or query fails
  const fallbackStates = [
    "Johor",
    "Kedah",
    "Kelantan",
    "Kuala Lumpur",
    "Labuan",
    "Melaka",
    "Negeri Sembilan",
    "Pahang",
    "Penang",
    "Perak",
    "Perlis",
    "Putrajaya",
    "Sabah",
    "Sarawak",
    "Selangor",
    "Terengganu",
  ];

  return fallbackStates.map((name, index) => ({
    id: index + 1,
    name,
  }));
}

export async function getMaincons() {
  return await db.maincon.findMany({
    orderBy: { name: "asc" },
  });
}

export async function getServicePartners() {
  return await db.servicePartner.findMany({
    include: {
      engineers: {
        include: {
          user: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function getFieldEngineers(partnerId?: number) {
  return await db.fieldEngineer.findMany({
    where: partnerId ? { partnerId } : undefined,
    include: {
      partner: true,
    },
    orderBy: { name: "asc" },
  });
}

export async function getDevices() {
  return await db.deviceCatalog.findMany({
    orderBy: [
      { isStandard: "desc" },
      { category: "asc" },
      { brand: "asc" },
    ],
  });
}

export async function getTickets() {
  try {
    return await db.ticket.findMany({
      include: {
        maincon: true,
        partner: true,
        assignedFe: {
          include: {
            user: true,
          },
        },
        device: true,
        site: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        spareParts: {
          include: {
            inventoryItem: {
              include: {
                warehouse: true,
              },
            },
          },
        },
      },
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" }
      ],
    });
  } catch (err: any) {
    console.warn("Primary getTickets query notice, falling back to core query:", err.message);
    try {
      return await db.ticket.findMany({
        include: {
          maincon: true,
          partner: true,
          assignedFe: {
            include: {
              user: true,
            },
          },
          device: true,
          site: true,
        },
        orderBy: [
          { createdAt: "desc" },
          { id: "desc" }
        ],
      });
    } catch (innerErr: any) {
      console.warn("Secondary getTickets query notice, falling back to basic query:", innerErr.message);
      return await db.ticket.findMany({
        include: {
          maincon: true,
          partner: true,
          assignedFe: true,
        },
        orderBy: [
          { createdAt: "desc" },
          { id: "desc" }
        ],
      });
    }
  }
}

export async function createMaincon(data: {
  name: string;
  sheetName: string;
  customFieldsSchema: any;
  siteCustomers?: string[];
}) {
  const maincon = await db.maincon.create({
    data: {
      name: data.name,
      sheetName: data.sheetName,
      customFieldsSchema: data.customFieldsSchema,
      siteCustomers: data.siteCustomers || [],
    },
  });
  return maincon;
}

export async function updateMaincon(id: number, data: {
  name: string;
  sheetName: string;
  customFieldsSchema: any;
  siteCustomers?: string[];
}) {
  const maincon = await db.maincon.update({
    where: { id },
    data: {
      name: data.name,
      sheetName: data.sheetName,
      customFieldsSchema: data.customFieldsSchema,
      siteCustomers: data.siteCustomers || [],
    },
  });
  return maincon;
}

export async function deleteMaincon(id: number) {
  // Check if there are tickets referencing this maincon
  const ticketCount = await db.ticket.count({
    where: { mainconId: id },
  });

  if (ticketCount > 0) {
    throw new Error(
      `Cannot delete Main Contractor because there are ${ticketCount} ticket(s) associated with it.`
    );
  }

  const deleted = await db.maincon.delete({
    where: { id },
  });
  return deleted;
}

export async function createServicePartner(data: {
  name: string;
  statesCovered: string[];
  dispatchEmail?: string | null;
}) {
  const partner = await db.servicePartner.create({
    data: {
      name: data.name,
      statesCovered: data.statesCovered,
      dispatchEmail: data.dispatchEmail?.trim() || null,
    },
  });
  return partner;
}

export async function createFieldEngineer(data: {
  name: string;
  phone: string;
  partnerId: number;
  country?: string | null;
  region?: string | null;
  email?: string | null;
}) {
  const fe = await db.fieldEngineer.create({
    data: {
      name: data.name,
      phone: data.phone,
      partnerId: data.partnerId,
      country: data.country || null,
      region: data.region || null,
      email: data.email || null,
    },
  });

  // Auto-link to user if a User with this email already registered
  if (data.email) {
    const matchedUser = await db.user.findUnique({
      where: { email: data.email },
    });
    if (matchedUser && matchedUser.role === "FIELD_ENGINEER") {
      await db.user.update({
        where: { id: matchedUser.id },
        data: { engineerId: fe.id },
      });
    }
  }

  return fe;
}

export async function updateServicePartner(
  id: number,
  data: {
    name: string;
    statesCovered: string[];
    dispatchEmail?: string | null;
  }
) {
  const partner = await db.servicePartner.update({
    where: { id },
    data: {
      name: data.name,
      statesCovered: data.statesCovered,
      dispatchEmail: data.dispatchEmail !== undefined ? (data.dispatchEmail?.trim() || null) : undefined,
    },
  });
  return partner;
}

export async function deleteServicePartner(id: number) {
  // Check if there are tickets referencing this partner
  const ticketCount = await db.ticket.count({
    where: { partnerId: id },
  });

  if (ticketCount > 0) {
    throw new Error(
      `Cannot delete Service Partner because there are ${ticketCount} ticket(s) associated with it.`
    );
  }

  // Check if any of this partner's field engineers are assigned to tickets
  const feTicketCount = await db.ticket.count({
    where: {
      assignedFe: {
        partnerId: id,
      },
    },
  });

  if (feTicketCount > 0) {
    throw new Error(
      `Cannot delete Service Partner because one or more of its Field Engineers are assigned to existing tickets.`
    );
  }

  // Delete all field engineers for this partner
  await db.fieldEngineer.deleteMany({
    where: { partnerId: id },
  });

  const deleted = await db.servicePartner.delete({
    where: { id },
  });
  return deleted;
}

export async function updateFieldEngineer(
  id: number,
  data: {
    name: string;
    phone: string;
    partnerId: number;
    country?: string | null;
    region?: string | null;
    email?: string | null;
  }
) {
  const fe = await db.fieldEngineer.update({
    where: { id },
    data: {
      name: data.name,
      phone: data.phone,
      partnerId: data.partnerId,
      country: data.country !== undefined ? data.country : undefined,
      region: data.region !== undefined ? data.region : undefined,
      email: data.email !== undefined ? data.email : undefined,
    },
  });

  // Re-sync user linkage if email changed
  if (data.email) {
    const matchedUser = await db.user.findUnique({
      where: { email: data.email },
    });
    if (matchedUser && matchedUser.role === "FIELD_ENGINEER" && matchedUser.engineerId !== id) {
      await db.user.update({
        where: { id: matchedUser.id },
        data: { engineerId: id },
      });
    }
  }

  return fe;
}

export async function deleteFieldEngineer(id: number) {
  // Check if this field engineer is assigned to any tickets
  const ticketCount = await db.ticket.count({
    where: { assignedFeId: id },
  });

  if (ticketCount > 0) {
    throw new Error(
      `Cannot delete Field Engineer because they are assigned to ${ticketCount} ticket(s).`
    );
  }

  const deleted = await db.fieldEngineer.delete({
    where: { id },
  });
  return deleted;
}

export async function createDeviceCatalogItem(data: {
  category: string;
  brand: string;
  model: string;
  isStandard: boolean;
  restrictedTo?: string;
}) {
  const item = await db.deviceCatalog.create({
    data: {
      category: data.category,
      brand: data.brand,
      model: data.model,
      isStandard: data.isStandard,
      restrictedTo: data.restrictedTo || null,
    },
  });
  return item;
}

async function generateUniqueRefNo(): Promise<string> {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD
  let finalRef = "";
  let attempts = 0;
  while (attempts < 10) {
    const suffix = String((await db.ticket.count()) + 1 + attempts).padStart(4, "0");
    const candidateRef = `TKL-${dateStr}-${suffix}`;
    const existing = await db.ticket.findFirst({
      where: { ticketRefNo: candidateRef }
    });
    if (!existing) {
      finalRef = candidateRef;
      break;
    }
    attempts++;
  }
  if (!finalRef) {
    finalRef = `TKL-${dateStr}-${Math.floor(1000 + Math.random() * 9000)}`;
  }
  return finalRef;
}

export async function checkDuplicateTicketRef(ticketRefNo: string, excludeTicketId?: number): Promise<boolean> {
  if (!ticketRefNo || !ticketRefNo.trim()) return false;
  const existing = await db.ticket.findFirst({
    where: {
      ticketRefNo: {
        equals: ticketRefNo.trim(),
        mode: "insensitive",
      },
      ...(excludeTicketId ? { id: { not: excludeTicketId } } : {}),
    },
    select: { id: true },
  });
  return !!existing;
}

export async function notifyPartnerTicketDispatched(ticketId: number) {
  try {
    const ticket = await db.ticket.findUnique({
      where: { id: ticketId },
      include: {
        partner: {
          include: {
            users: { where: { role: "AGENT" } },
          },
        },
        maincon: true,
      },
    });

    if (!ticket || !ticket.partner) return;

    const partner = ticket.partner;
    const primaryEmail = partner.dispatchEmail || partner.users[0]?.email;
    if (!primaryEmail) return;

    // CC all other agent user emails
    const ccEmails = partner.users
      .map((u) => u.email?.trim())
      .filter((e): e is string => Boolean(e) && e.toLowerCase() !== primaryEmail.toLowerCase());

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    await sendTemplatedEmail(
      "TICKET_CREATED",
      primaryEmail,
      {
        "{{partnerName}}": partner.name,
        "{{ticketRefNo}}": ticket.ticketRefNo || `#${ticket.id}`,
        "{{siteName}}": ticket.clientSiteName,
        "{{state}}": ticket.state,
        "{{severity}}": ticket.severity || "Standard",
        "{{mainconName}}": ticket.maincon?.name || "Client",
        "{{issueDescription}}": ticket.issueDescription,
        "{{ticketLink}}": `${appUrl}/tickets/${ticket.id}`,
      },
      { cc: ccEmails }
    );
  } catch (error: any) {
    console.warn(`[Notification] Failed to notify partner for ticket #${ticketId}:`, error.message);
  }
}

export async function notifyFeTicketAssigned(ticketId: number) {
  try {
    const ticket = await db.ticket.findUnique({
      where: { id: ticketId },
      include: {
        assignedFe: {
          include: { user: true },
        },
        partner: true,
      },
    });

    if (!ticket || !ticket.assignedFe) return;

    const fe = ticket.assignedFe;
    const feEmail = fe.email || fe.user?.email;
    if (!feEmail) return;

    const partnerCc = ticket.partner?.dispatchEmail || undefined;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    await sendTemplatedEmail(
      "TICKET_ASSIGNED",
      feEmail,
      {
        "{{engineerName}}": fe.name,
        "{{ticketRefNo}}": ticket.ticketRefNo || `#${ticket.id}`,
        "{{siteName}}": ticket.clientSiteName,
        "{{state}}": ticket.state,
        "{{severity}}": ticket.severity || "Standard",
        "{{issueDescription}}": ticket.issueDescription,
        "{{ticketLink}}": `${appUrl}/tickets/${ticket.id}`,
      },
      { cc: partnerCc }
    );
  } catch (error: any) {
    console.warn(`[Notification] Failed to notify FE for ticket #${ticketId}:`, error.message);
  }
}

export async function createTicket(data: {
  ticketRefNo?: string;
  clientSiteName: string;
  state: string;
  issueDescription: string;
  mainconId: number;
  customValues: Record<string, string>;
  partnerId?: number;
  assignedFeId?: number;
  deviceId?: number;
  deviceStatus?: "STANDARD" | "ON_REQUEST";
  customDeviceDetails?: string;
  slaDeadline?: Date;
  endCustomer?: string;
  reportedAt?: Date;
  siteId?: number | null;
  severity?: "P1" | "P2" | "P3" | "P4" | "NA" | null;
  createdById?: string | null;
  createdByName?: string | null;
}) {
  const sessionUser = await getSessionUser();
  const creatorId = data.createdById || sessionUser?.id || null;
  const creatorName = data.createdByName || sessionUser?.name || sessionUser?.email || "System";

  let refNo = data.ticketRefNo ? data.ticketRefNo.trim() : "";

  if (refNo) {
    const isDuplicate = await checkDuplicateTicketRef(refNo);
    if (isDuplicate) {
      throw new Error(`Ticket Number "${refNo}" already exists in the system. Duplicate ticket numbers cannot be logged.`);
    }
  } else {
    refNo = await generateUniqueRefNo();
  }

  const ticket = await db.ticket.create({
    data: {
      ticketRefNo: refNo,
      clientSiteName: data.clientSiteName,
      state: data.state,
      issueDescription: data.issueDescription,
      status: "NEW",
      mainconId: data.mainconId,
      customValues: data.customValues,
      partnerId: data.partnerId || null,
      assignedFeId: data.assignedFeId || null,
      deviceId: data.deviceId || null,
      deviceStatus: data.deviceStatus || null,
      customDeviceDetails: data.customDeviceDetails || null,
      slaDeadline: data.slaDeadline || null,
      endCustomer: data.endCustomer || null,
      reportedAt: data.reportedAt || new Date(),
      siteId: data.siteId || null,
      severity: (data.severity as Severity) || null,
      feAcknowledgeStatus: data.assignedFeId ? "PENDING" : null,
      createdById: creatorId,
      createdByName: creatorName,
    },
  });

  // Log creation in activities
  await db.ticketActivity.create({
    data: {
      ticketId: ticket.id,
      type: "STATUS_CHANGE",
      status: "NEW",
      notes: "Ticket created in system.",
      author: creatorName,
    }
  });

  if (data.assignedFeId) {
    await db.ticketActivity.create({
      data: {
        ticketId: ticket.id,
        type: "ASSIGNMENT",
        notes: "Field Engineer assigned. Awaiting acknowledgment.",
        author: "System"
      }
    });
  }

  // Dispatch Email Notifications Asynchronously
  if (data.partnerId) {
    notifyPartnerTicketDispatched(ticket.id).catch((err) =>
      console.warn("createTicket partner notify err:", err)
    );
  }
  if (data.assignedFeId) {
    notifyFeTicketAssigned(ticket.id).catch((err) =>
      console.warn("createTicket fe notify err:", err)
    );
  }

  return JSON.parse(JSON.stringify(ticket));
}

export async function updateTicket(
  id: number,
  data: {
    ticketRefNo?: string | null;
    clientSiteName: string;
    state: string;
    issueDescription: string;
    mainconId: number;
    customValues: Record<string, string>;
    partnerId?: number | null;
    assignedFeId?: number | null;
    deviceId?: number | null;
    deviceStatus?: "STANDARD" | "ON_REQUEST" | null;
    customDeviceDetails?: string | null;
    status?: "NEW" | "IN_PROGRESS" | "ON_HOLD" | "RESOLVED" | "FOLLOW_UP" | "COMPLETE" | "CLOSED" | "CANCELLED";
    subStatus?: string | null;
    slaDeadline?: Date | null;
    resolutionDetails?: string | null;
    resolvedAt?: Date | null;
    endCustomer?: string | null;
    reportedAt?: Date | null;
    siteId?: number | null;
    severity?: "P1" | "P2" | "P3" | "P4" | "NA" | null;
    eta?: Date | null;
    holdReason?: string | null;
    defectiveSerial?: string | null;
    defectiveReturnStatus?: string | null;
  }
) {
  let refNo = data.ticketRefNo ? data.ticketRefNo.trim() : null;

  if (refNo) {
    const duplicate = await db.ticket.findFirst({
      where: {
        ticketRefNo: refNo,
        NOT: { id }
      }
    });
    if (duplicate) {
      throw new Error(`Ticket Reference Number "${refNo}" already exists and cannot be duplicated.`);
    }
  } else if (data.ticketRefNo === "") {
    refNo = await generateUniqueRefNo();
  }

  const ticketBefore = await db.ticket.findUnique({
    where: { id }
  });
  if (!ticketBefore) {
    throw new Error("Ticket not found");
  }

  let slaPaused = ticketBefore.slaPaused;
  let slaPausedAt = ticketBefore.slaPausedAt;
  let totalPausedMs = ticketBefore.totalPausedMs;
  let slaDeadline = data.slaDeadline !== undefined ? data.slaDeadline : ticketBefore.slaDeadline;

  const targetStatus = data.status || ticketBefore.status;
  const targetSubStatus = data.status === "FOLLOW_UP" ? (data.subStatus || ticketBefore.subStatus) : null;

  const wasPaused = ticketBefore.slaPaused;
  const isPausingStatus = (targetStatus === "ON_HOLD" || (targetStatus === "FOLLOW_UP" && targetSubStatus === "PENDING_PARTS"));

  let slaActionType: string | null = null;
  if (!wasPaused && isPausingStatus) {
    slaPaused = true;
    slaPausedAt = new Date();
    slaActionType = "SLA_PAUSE";
  } else if (wasPaused && !isPausingStatus) {
    slaPaused = false;
    slaPausedAt = null;
    if (ticketBefore.slaPausedAt) {
      const pausedMs = new Date().getTime() - new Date(ticketBefore.slaPausedAt).getTime();
      totalPausedMs += pausedMs;
      if (slaDeadline) {
        slaDeadline = new Date(new Date(slaDeadline).getTime() + pausedMs);
      }
    }
    slaActionType = "SLA_RESUME";
  }

  // Handle FE Assignment details
  let feAcknowledgeStatus = ticketBefore.feAcknowledgeStatus;
  let feAcknowledgedAt = ticketBefore.feAcknowledgedAt;

  if (data.assignedFeId !== undefined) {
    if (data.assignedFeId !== ticketBefore.assignedFeId) {
      feAcknowledgeStatus = data.assignedFeId ? "PENDING" : null;
      feAcknowledgedAt = null;
    }
  }

  const ticket = await db.ticket.update({
    where: { id },
    data: {
      ticketRefNo: refNo !== undefined ? refNo : undefined,
      clientSiteName: data.clientSiteName,
      state: data.state,
      issueDescription: data.issueDescription,
      mainconId: data.mainconId,
      customValues: data.customValues,
      partnerId: data.partnerId !== undefined ? data.partnerId : undefined,
      assignedFeId: data.assignedFeId !== undefined ? data.assignedFeId : undefined,
      deviceId: data.deviceId !== undefined ? data.deviceId : undefined,
      deviceStatus: data.deviceStatus !== undefined ? data.deviceStatus : undefined,
      customDeviceDetails: data.customDeviceDetails !== undefined ? data.customDeviceDetails : undefined,
      status: data.status,
      subStatus: (data.status === "FOLLOW_UP" || data.status === "ON_HOLD") ? data.subStatus : null,
      slaDeadline: slaDeadline !== undefined ? slaDeadline : undefined,
      resolutionDetails: data.resolutionDetails !== undefined ? data.resolutionDetails : undefined,
      resolvedAt: data.resolvedAt !== undefined ? data.resolvedAt : undefined,
      endCustomer: data.endCustomer !== undefined ? data.endCustomer : undefined,
      reportedAt: data.reportedAt ? data.reportedAt : undefined,
      siteId: data.siteId !== undefined ? data.siteId : undefined,
      severity: data.severity !== undefined ? (data.severity as Severity) : undefined,
      eta: data.eta !== undefined ? data.eta : ((data.status === "RESOLVED" || data.status === "COMPLETE" || data.status === "ON_HOLD" || data.status === "FOLLOW_UP" || data.status === "CLOSED") ? null : undefined),
      defectiveSerial: data.defectiveSerial !== undefined ? data.defectiveSerial : undefined,
      defectiveReturnStatus: data.defectiveReturnStatus !== undefined ? data.defectiveReturnStatus : undefined,
      slaPaused,
      slaPausedAt,
      totalPausedMs,
      feAcknowledgeStatus,
      feAcknowledgedAt,
      holdReason: data.status === "ON_HOLD" ? (data.holdReason || data.subStatus || "On Hold") : null,
    },
    include: {
      partner: true,
      assignedFe: true,
    }
  });

  // Log activity events
  if (data.status && data.status !== ticketBefore.status) {
    await db.ticketActivity.create({
      data: {
        ticketId: id,
        type: "STATUS_CHANGE",
        status: data.status,
        subStatus: data.subStatus,
        notes: data.status === "ON_HOLD" ? data.holdReason : "Ticket updated from edit page.",
        author: "Admin"
      }
    });
  }

  if (data.partnerId !== undefined && data.partnerId !== ticketBefore.partnerId && data.partnerId) {
    notifyPartnerTicketDispatched(id).catch((err) =>
      console.warn("updateTicket partner notify err:", err)
    );
  }

  if (data.assignedFeId !== undefined && data.assignedFeId !== ticketBefore.assignedFeId) {
    await db.ticketActivity.create({
      data: {
        ticketId: id,
        type: "ASSIGNMENT",
        notes: data.assignedFeId 
          ? `Reassigned to Partner: ${ticket.partner?.name || "Unknown"} and Engineer: ${ticket.assignedFe?.name || "Unknown"}. Awaiting acknowledgment.`
          : "Field Engineer unassigned.",
        author: "Admin"
      }
    });

    if (data.assignedFeId) {
      notifyFeTicketAssigned(id).catch((err) =>
        console.warn("updateTicket FE notify err:", err)
      );
    }
  }

  if (data.status && data.status !== ticketBefore.status && ticket.assignedFe?.email) {
    sendTemplatedEmail("TICKET_STATUS_CHANGED", ticket.assignedFe.email, {
      "{{recipientName}}": ticket.assignedFe.name,
      "{{ticketRefNo}}": ticket.ticketRefNo || String(ticket.id),
      "{{oldStatus}}": ticketBefore.status,
      "{{newStatus}}": ticket.status,
      "{{notes}}": data.resolutionDetails || data.holdReason || `Status updated to ${ticket.status}`,
      "{{ticketLink}}": `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/tickets/${ticket.id}`,
    }).catch((err) => console.warn("Ticket status email notice:", err));
  }

  if (data.eta && (!ticketBefore.eta || new Date(data.eta).getTime() !== new Date(ticketBefore.eta).getTime())) {
    await db.ticketActivity.create({
      data: {
        ticketId: id,
        type: "ETA_UPDATE",
        notes: `ETA set/updated to ${new Date(data.eta).toLocaleString("en-MY")}`,
        author: "Admin"
      }
    });
  }

  if (slaActionType) {
    await db.ticketActivity.create({
      data: {
        ticketId: id,
        type: slaActionType,
        notes: slaActionType === "SLA_PAUSE" 
          ? "SLA count paused from edit page."
          : "SLA count resumed from edit page. Target deadline extended.",
        author: "System"
      }
    });
  }

  return JSON.parse(JSON.stringify(ticket));
}

export async function deleteTicket(id: number) {
  const deleted = await db.ticket.delete({
    where: { id },
  });
  return JSON.parse(JSON.stringify(deleted));
}

export async function updateTicketStatus(
  ticketId: number,
  status: "NEW" | "IN_PROGRESS" | "ON_HOLD" | "RESOLVED" | "FOLLOW_UP" | "COMPLETE" | "CLOSED" | "CANCELLED",
  subStatus?: string | null,
  notes?: string | null,
  author: string = "System",
  serviceReportUrl?: string | null
) {
  const ticketBefore = await db.ticket.findUnique({
    where: { id: ticketId }
  });
  if (!ticketBefore) {
    throw new Error("Ticket not found");
  }

  const wasPaused = ticketBefore.slaPaused;
  const isPausingStatus = (status === "ON_HOLD" || (status === "FOLLOW_UP" && subStatus === "PENDING_PARTS") || status === "CANCELLED");

  let slaPaused = wasPaused;
  let slaPausedAt = ticketBefore.slaPausedAt;
  let totalPausedMs = ticketBefore.totalPausedMs;
  let slaDeadline = ticketBefore.slaDeadline;

  // Track transitions
  let slaActionType: string | null = null;
  if (!wasPaused && isPausingStatus) {
    // Transitioning to Paused / Cancelled
    slaPaused = true;
    slaPausedAt = new Date();
    slaActionType = status === "CANCELLED" ? null : "SLA_PAUSE";
  } else if (wasPaused && !isPausingStatus) {
    // Transitioning from Paused to Active
    slaPaused = false;
    slaPausedAt = null;
    if (ticketBefore.slaPausedAt) {
      const pausedMs = new Date().getTime() - new Date(ticketBefore.slaPausedAt).getTime();
      totalPausedMs += pausedMs;
      if (slaDeadline) {
        slaDeadline = new Date(new Date(slaDeadline).getTime() + pausedMs);
      }
    }
    slaActionType = "SLA_RESUME";
  }

  const updatedTicket = await db.ticket.update({
    where: { id: ticketId },
    data: {
      status,
      subStatus: (status === "FOLLOW_UP" || status === "ON_HOLD") ? subStatus : null,
      resolvedAt: (status === "RESOLVED" || status === "COMPLETE") ? new Date() : undefined,
      eta: (status === "RESOLVED" || status === "COMPLETE" || status === "ON_HOLD" || status === "FOLLOW_UP" || status === "CLOSED" || status === "CANCELLED") ? null : undefined,
      slaPaused,
      slaPausedAt,
      totalPausedMs,
      slaDeadline,
      holdReason: status === "ON_HOLD" ? (notes || subStatus || "On Hold") : status === "CANCELLED" ? (notes || "Cancelled") : null,
      ...(serviceReportUrl !== undefined ? { serviceReportUrl } : {})
    },
  });

  // Log status change activity
  await db.ticketActivity.create({
    data: {
      ticketId,
      type: "STATUS_CHANGE",
      status,
      subStatus,
      notes: notes || null,
      attachmentUrl: serviceReportUrl || undefined,
      author,
    }
  });

  // Log SLA changes if any
  if (slaActionType) {
    await db.ticketActivity.create({
      data: {
        ticketId,
        type: slaActionType,
        notes: slaActionType === "SLA_PAUSE" 
          ? `SLA count paused because status changed to ${status}${subStatus ? ` (${subStatus})` : ""}.`
          : `SLA count resumed. Target deadline extended.`,
        author: "System",
      }
    });
  }

  return JSON.parse(JSON.stringify(updatedTicket));
}

export async function uploadServiceReport(
  ticketId: number,
  serviceReportUrl: string,
  author: string = "System",
  notes?: string,
  stage?: string
) {
  const ticket = await db.ticket.update({
    where: { id: ticketId },
    data: { serviceReportUrl },
  });

  const activityNotes = notes 
    ? notes 
    : stage 
    ? `Service Report attached (${stage.replace(/_/g, " ")}).`
    : "Signed Service Report uploaded/updated.";

  await db.ticketActivity.create({
    data: {
      ticketId,
      type: "REPORT_UPLOAD",
      notes: activityNotes,
      attachmentUrl: serviceReportUrl,
      author,
    },
  });

  return JSON.parse(JSON.stringify(ticket));
}

export async function updateTicketResolution(
  ticketId: number, 
  resolutionDetails: string, 
  resolvedAt: Date,
  author: string = "System",
  serviceReportUrl?: string | null,
  defectiveSerial?: string | null,
  defectiveReturnStatus?: string | null
) {
  const ticketBefore = await db.ticket.findUnique({
    where: { id: ticketId }
  });

  let slaPaused = false;
  let slaPausedAt = null;
  let totalPausedMs = ticketBefore?.totalPausedMs || 0;
  let slaDeadline = ticketBefore?.slaDeadline;

  // If resolving from a paused state, calculate the final duration
  if (ticketBefore?.slaPaused && ticketBefore.slaPausedAt) {
    const pausedMs = new Date().getTime() - new Date(ticketBefore.slaPausedAt).getTime();
    totalPausedMs += pausedMs;
    if (slaDeadline) {
      slaDeadline = new Date(new Date(slaDeadline).getTime() + pausedMs);
    }
  }

  const ticket = await db.ticket.update({
    where: { id: ticketId },
    data: {
      resolutionDetails,
      resolvedAt,
      status: "RESOLVED",
      eta: null,
      slaPaused,
      slaPausedAt,
      totalPausedMs,
      slaDeadline,
      serviceReportUrl: serviceReportUrl || undefined,
      defectiveSerial: defectiveSerial || null,
      defectiveReturnStatus: defectiveReturnStatus || null,
    },
  });

  await db.ticketActivity.create({
    data: {
      ticketId,
      type: "STATUS_CHANGE",
      status: "RESOLVED",
      notes: `Ticket resolved. Action: ${resolutionDetails}${defectiveSerial ? ` (Defective Serial: ${defectiveSerial}, Return Status: ${defectiveReturnStatus})` : ""}`,
      author,
    }
  });

  return JSON.parse(JSON.stringify(ticket));
}

export async function assignServiceDetails(data: {
  ticketId: number;
  partnerId?: number;
  assignedFeId?: number;
}) {
  const ticketBefore = await db.ticket.findUnique({
    where: { id: data.ticketId }
  });

  const ticket = await db.ticket.update({
    where: { id: data.ticketId },
    data: {
      partnerId: data.partnerId || null,
      assignedFeId: data.assignedFeId || null,
      feAcknowledgeStatus: data.assignedFeId ? "PENDING" : null,
      feAcknowledgedAt: null,
    },
    include: {
      assignedFe: true,
      partner: true,
    }
  });

  if (data.assignedFeId) {
    await db.ticketActivity.create({
      data: {
        ticketId: data.ticketId,
        type: "ASSIGNMENT",
        notes: `Assigned to Partner: ${ticket.partner?.name || "Unknown"} and Engineer: ${ticket.assignedFe?.name || "Unknown"}. Awaiting acknowledgment.`,
        author: "Admin",
      }
    });

    if (data.assignedFeId !== ticketBefore?.assignedFeId) {
      notifyFeTicketAssigned(data.ticketId).catch((err) =>
        console.warn("assignServiceDetails FE notify err:", err)
      );
    }
  } else if (ticketBefore?.assignedFeId && !data.assignedFeId) {
    await db.ticketActivity.create({
      data: {
        ticketId: data.ticketId,
        type: "ASSIGNMENT",
        notes: "Field Engineer unassigned.",
        author: "Admin",
      }
    });
  }

  if (data.partnerId && data.partnerId !== ticketBefore?.partnerId) {
    notifyPartnerTicketDispatched(data.ticketId).catch((err) =>
      console.warn("assignServiceDetails partner notify err:", err)
    );
  }

  return JSON.parse(JSON.stringify(ticket));
}

export async function acknowledgeTicket(ticketId: number, notes?: string | null, author: string = "Field Engineer") {
  const ticketBefore = await db.ticket.findUnique({
    where: { id: ticketId },
    include: { assignedFe: true }
  });

  const ticket = await db.ticket.update({
    where: { id: ticketId },
    data: {
      feAcknowledgeStatus: "ACKNOWLEDGED",
      feAcknowledgedAt: new Date(),
    }
  });

  await db.ticketActivity.create({
    data: {
      ticketId,
      type: "FE_ACKNOWLEDGE",
      notes: notes || `Ticket acknowledged by assigned Engineer: ${ticketBefore?.assignedFe?.name || author}`,
      author,
    }
  });

  return JSON.parse(JSON.stringify(ticket));
}

export async function updateTicketEta(ticketId: number, eta: Date | string, author: string = "Admin") {
  const ticketBefore = await db.ticket.findUnique({
    where: { id: ticketId },
    include: { assignedFe: true }
  });

  const shouldAck = ticketBefore?.feAcknowledgeStatus === "PENDING" || ticketBefore?.status === "NEW";
  const nextStatus = undefined;

  const ticket = await db.ticket.update({
    where: { id: ticketId },
    data: {
      eta: new Date(eta),
      ...(shouldAck ? {
        feAcknowledgeStatus: "ACKNOWLEDGED",
        feAcknowledgedAt: new Date(),
      } : {}),
      ...(nextStatus ? { status: nextStatus } : {})
    }
  });

  if (shouldAck) {
    await db.ticketActivity.create({
      data: {
        ticketId,
        type: "FE_ACKNOWLEDGE",
        notes: `Ticket automatically acknowledged upon setting ETA by assigned Engineer: ${ticketBefore?.assignedFe?.name || author}`,
        author,
      }
    });
    if (nextStatus) {
      await db.ticketActivity.create({
        data: {
          ticketId,
          type: "STATUS_CHANGE",
          status: nextStatus,
          notes: "Status auto-updated to In Progress upon engineer setting ETA.",
          author: "System",
        }
      });
    }
  }

  await db.ticketActivity.create({
    data: {
      ticketId,
      type: "ETA_UPDATE",
      notes: `ETA updated to ${new Date(eta).toLocaleString("en-MY", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })}`,
      author,
    }
  });

  return JSON.parse(JSON.stringify(ticket));
}

export async function addTicketComment(ticketId: number, notes: string, author: string = "System") {
  const activity = await db.ticketActivity.create({
    data: {
      ticketId,
      type: "COMMENT",
      notes,
      author,
    }
  });

  return JSON.parse(JSON.stringify(activity));
}

export async function getTicketById(ticketId: number) {
  try {
    const ticket = await db.ticket.findUnique({
      where: { id: ticketId },
      include: {
        maincon: true,
        partner: true,
        assignedFe: {
          include: {
            user: true,
          },
        },
        device: true,
        site: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        spareParts: {
          include: {
            inventoryItem: {
              include: {
                warehouse: true,
              },
            },
          },
        },
        activities: {
          orderBy: {
            createdAt: "desc"
          }
        }
      },
    });
    return JSON.parse(JSON.stringify(ticket));
  } catch (err: any) {
    console.warn("Primary getTicketById query notice, falling back to core query:", err.message);
    try {
      const fallbackTicket = await db.ticket.findUnique({
        where: { id: ticketId },
        include: {
          maincon: true,
          partner: true,
          assignedFe: {
            include: {
              user: true,
            },
          },
          device: true,
          site: true,
          activities: {
            orderBy: {
              createdAt: "desc"
            }
          }
        },
      });
      return JSON.parse(JSON.stringify(fallbackTicket));
    } catch (innerErr: any) {
      console.warn("Secondary getTicketById query notice, falling back to basic query:", innerErr.message);
      const basicTicket = await db.ticket.findUnique({
        where: { id: ticketId },
        include: {
          maincon: true,
          partner: true,
          assignedFe: true,
          activities: {
            orderBy: {
              createdAt: "desc"
            }
          }
        },
      });
      return JSON.parse(JSON.stringify(basicTicket));
    }
  }
}

export async function getEndCustomerSites(mainconId?: number, group?: string) {
  return await db.endCustomerSite.findMany({
    where: {
      mainconId: mainconId ? Number(mainconId) : undefined,
      group: group ? group : undefined,
    },
    orderBy: { name: "asc" },
  });
}

export async function createEndCustomerSite(data: {
  name: string;
  group: string;
  state: string;
  mainconId: number;
}) {
  const site = await db.endCustomerSite.create({
    data: {
      name: data.name,
      group: data.group,
      state: data.state,
      mainconId: Number(data.mainconId),
    },
  });
  return JSON.parse(JSON.stringify(site));
}



export async function deleteDeviceCatalogItem(id: number) {
  const item = await db.deviceCatalog.delete({
    where: { id: Number(id) },
  });
  return item;
}

export async function getCustomerSlas() {
  return await db.customerSla.findMany({
    orderBy: [
      { customer: "asc" },
      { severity: "asc" },
      { region: "asc" }
    ]
  });
}

export async function createCustomerSla(data: {
  customer: string;
  severity: "P1" | "P2" | "P3" | "P4" | "NA";
  region: "Semenanjung" | "Sabah/Sarawak";
  slaHours: number;
}) {
  const sla = await db.customerSla.create({
    data: {
      customer: data.customer,
      severity: data.severity as Severity,
      region: data.region,
      slaHours: data.slaHours,
    },
  });
  return JSON.parse(JSON.stringify(sla));
}

export async function updateCustomerSla(
  id: number,
  data: {
    customer: string;
    severity: "P1" | "P2" | "P3" | "P4" | "NA";
    region: "Semenanjung" | "Sabah/Sarawak";
    slaHours: number;
  }
) {
  const sla = await db.customerSla.update({
    where: { id },
    data: {
      customer: data.customer,
      severity: data.severity as Severity,
      region: data.region,
      slaHours: data.slaHours,
    },
  });
  return JSON.parse(JSON.stringify(sla));
}

export async function deleteCustomerSla(id: number) {
  const deleted = await db.customerSla.delete({
    where: { id },
  });
  return JSON.parse(JSON.stringify(deleted));
}

// --- Authentication & User Management Actions ---

export async function syncUserAndGetProfile(
  supabaseId: string,
  email: string,
  name?: string,
  phone?: string | null,
  registrationCode?: string | null
) {
  let user = await db.user.findUnique({
    where: { id: supabaseId },
    include: {
      partner: true,
      engineer: true,
    },
  });

  // If not found by supabaseId, check by email to handle re-authenticated or migrated users
  if (!user && email) {
    const existingByEmail = await db.user.findUnique({
      where: { email },
      include: {
        partner: true,
        engineer: true,
      },
    });

    if (existingByEmail) {
      user = await db.user.update({
        where: { email },
        data: {
          id: supabaseId,
          ...(name ? { name } : {}),
        },
        include: {
          partner: true,
          engineer: true,
        },
      });
    }
  }

  if (user) {
    // Auto-link if they are unlinked but we now have a matching FieldEngineer email
    if (user.role === "FIELD_ENGINEER" && !user.engineerId) {
      const matchedFe = await db.fieldEngineer.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
      });
      if (matchedFe) {
        const updatedUser = await db.user.update({
          where: { id: supabaseId },
          data: { engineerId: matchedFe.id },
          include: {
            partner: true,
            engineer: true,
          },
        });
        return updatedUser;
      }
    }
    return user;
  }

  // If no users exist yet, the first one registering gets SUPERADMIN role
  const totalUsers = await db.user.count();
  let role: UserRole = totalUsers === 0 ? "SUPERADMIN" : "FIELD_ENGINEER";
  let engineerId: number | null = null;
  let partnerId: number | null = null;

  // Process registration/invitation code if registrationCode is provided
  if (totalUsers > 0 && registrationCode) {
    const cleanCode = registrationCode.trim().toUpperCase();
    const codeRecord = await db.registrationCode.findUnique({
      where: { code: cleanCode },
    });

    if (codeRecord && codeRecord.uses < codeRecord.maxUses) {
      if (!codeRecord.expiresAt || new Date() <= new Date(codeRecord.expiresAt)) {
        role = codeRecord.role;
        partnerId = codeRecord.partnerId;

        if (role === "FIELD_ENGINEER") {
          // Auto-create a FieldEngineer profile
          const fe = await db.fieldEngineer.create({
            data: {
              name: name || email.split("@")[0],
              phone: phone || "",
              email: email,
              partnerId: codeRecord.partnerId,
              country: "Malaysia",
            },
          });
          engineerId = fe.id;
          partnerId = null; // FIELD_ENGINEER role maps partnerId through FieldEngineer model
        }

        // Increment the registration code usage
        await db.registrationCode.update({
          where: { id: codeRecord.id },
          data: { uses: { increment: 1 } },
        });
      }
    }
  }

  // Auto-link to FieldEngineer profile if email matches and wasn't created/linked yet
  if (role === "FIELD_ENGINEER" && !engineerId) {
    const matchedFe = await db.fieldEngineer.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });
    if (matchedFe) {
      engineerId = matchedFe.id;
    }
  }

  await db.user.create({
    data: {
      id: supabaseId,
      email,
      name: name || email.split("@")[0],
      role,
      engineerId,
      partnerId: role === "AGENT" ? partnerId : null,
    },
  });

  // If we linked a FieldEngineer, we should also ensure that the user relationship is synced back
  return await db.user.findUnique({
    where: { id: supabaseId },
    include: {
      partner: true,
      engineer: true,
    },
  });
}

export async function getUsers() {
  return await db.user.findMany({
    include: {
      partner: true,
      engineer: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateUserRoleAndLinks(
  userId: string,
  data: {
    role: "SUPERADMIN" | "MODERATOR" | "AGENT" | "FIELD_ENGINEER";
    partnerId?: number | null;
    engineerId?: number | null;
  }
) {
  const updated = await db.user.update({
    where: { id: userId },
    data: {
      role: data.role as UserRole,
      partnerId: data.role === "AGENT" ? data.partnerId : null,
      engineerId: data.role === "FIELD_ENGINEER" ? data.engineerId : null,
    },
    include: {
      partner: true,
      engineer: true,
    },
  });
  return updated;
}

export async function toggleUserStatusAction(userId: string, isActive: boolean) {
  const currentSession = await getSessionUser();
  if (currentSession?.id === userId && !isActive) {
    throw new Error("You cannot deactivate your own account.");
  }

  const targetUser = await db.user.findUnique({ where: { id: userId } });
  if (!targetUser) throw new Error("User not found.");

  if (!isActive && targetUser.role === "SUPERADMIN") {
    const activeSuperadmins = await db.user.count({
      where: { role: "SUPERADMIN", isActive: true, id: { not: userId } },
    });
    if (activeSuperadmins === 0) {
      throw new Error("Cannot deactivate the only active Superadmin in the system.");
    }
  }

  const updated = await db.user.update({
    where: { id: userId },
    data: { isActive },
    include: { partner: true, engineer: true },
  });

  return { success: true, user: JSON.parse(JSON.stringify(updated)) };
}

export async function deleteUserAction(userId: string) {
  const currentSession = await getSessionUser();
  if (currentSession?.id === userId) {
    throw new Error("You cannot delete your own account.");
  }

  const targetUser = await db.user.findUnique({ where: { id: userId } });
  if (!targetUser) throw new Error("User not found.");

  if (targetUser.role === "SUPERADMIN") {
    const totalSuperadmins = await db.user.count({
      where: { role: "SUPERADMIN", id: { not: userId } },
    });
    if (totalSuperadmins === 0) {
      throw new Error("Cannot delete the only Superadmin in the system.");
    }
  }

  // Delete user record safely
  await db.user.delete({
    where: { id: userId },
  });

  return { success: true };
}

export async function adminQuickLinkUserAction(
  userId: string,
  data: {
    partnerId?: number;
    engineerId?: number;
    autoCreateFe?: boolean;
    name?: string;
    phone?: string;
  }
) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found.");

  let finalEngineerId: number | null = data.engineerId || null;
  let finalPartnerId: number | null = data.partnerId || null;

  if (data.autoCreateFe) {
    if (!data.partnerId) throw new Error("Please select a Service Partner Agency.");
    
    // Check if engineer with email already exists
    const existingFe = await db.fieldEngineer.findFirst({
      where: { email: { equals: user.email, mode: "insensitive" } },
    });

    if (existingFe) {
      finalEngineerId = existingFe.id;
    } else {
      const createdFe = await db.fieldEngineer.create({
        data: {
          name: data.name || user.name || user.email.split("@")[0],
          phone: data.phone || "",
          email: user.email,
          partnerId: data.partnerId,
          country: "Malaysia",
        },
      });
      finalEngineerId = createdFe.id;
    }
    finalPartnerId = null; // FIELD_ENGINEER links partner through FieldEngineer
  }

  const updated = await db.user.update({
    where: { id: userId },
    data: {
      role: data.autoCreateFe || finalEngineerId ? "FIELD_ENGINEER" : (finalPartnerId ? "AGENT" : user.role),
      engineerId: finalEngineerId,
      partnerId: finalPartnerId,
    },
    include: {
      partner: true,
      engineer: true,
    },
  });

  return { success: true, user: JSON.parse(JSON.stringify(updated)) };
}

export async function adminMarkUserVerifiedAction(userId: string) {
  const updated = await db.user.update({
    where: { id: userId },
    data: {
      isEmailVerified: true,
      emailVerificationOtp: null,
      emailVerificationToken: null,
      emailVerificationExpiresAt: null,
    },
    include: {
      partner: true,
      engineer: true,
    },
  });

  return { success: true, user: JSON.parse(JSON.stringify(updated)) };
}

// --- Partner Team Management Actions ---

export async function getPartnerEngineers(partnerId: number) {
  return await db.fieldEngineer.findMany({
    where: { partnerId },
    include: {
      user: true,
    },
    orderBy: { name: "asc" },
  });
}

export async function createPartnerEngineerAction(data: {
  name: string;
  phone: string;
  email: string;
  partnerId: number;
  region?: string | null;
  country?: string | null;
}) {
  // Check if email already used by another Field Engineer
  if (data.email) {
    const existing = await db.fieldEngineer.findFirst({
      where: { email: { equals: data.email, mode: "insensitive" } },
    });
    if (existing) {
      throw new Error(`Email "${data.email}" is already registered to another field engineer.`);
    }
  }

  const fe = await db.fieldEngineer.create({
    data: {
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      partnerId: data.partnerId,
      region: data.region || null,
      country: data.country || "Malaysia",
    },
  });

  // Auto-link to user if a User with this email already registered
  if (data.email) {
    const matchedUser = await db.user.findUnique({
      where: { email: data.email },
    });
    if (matchedUser && matchedUser.role === "FIELD_ENGINEER") {
      await db.user.update({
        where: { id: matchedUser.id },
        data: { engineerId: fe.id },
      });
    }
  }

  return fe;
}

export async function updatePartnerEngineerAction(
  id: number,
  data: {
    name: string;
    phone: string;
    email: string;
    region?: string | null;
    country?: string | null;
  }
) {
  // Check if email is already taken
  if (data.email) {
    const existing = await db.fieldEngineer.findFirst({
      where: {
        email: { equals: data.email, mode: "insensitive" },
        NOT: { id },
      },
    });
    if (existing) {
      throw new Error(`Email "${data.email}" is already registered to another field engineer.`);
    }
  }

  const updated = await db.fieldEngineer.update({
    where: { id },
    data: {
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      region: data.region || null,
      country: data.country || "Malaysia",
    },
  });

  // Re-sync user linkage if email changed
  if (data.email) {
    const matchedUser = await db.user.findUnique({
      where: { email: data.email },
    });
    if (matchedUser && matchedUser.role === "FIELD_ENGINEER" && matchedUser.engineerId !== id) {
      await db.user.update({
        where: { id: matchedUser.id },
        data: { engineerId: id },
      });
    }
  }

  return updated;
}

export async function deletePartnerEngineerAction(id: number) {
  // Check if the engineer is assigned to any active tickets
  const ticketCount = await db.ticket.count({
    where: {
      assignedFeId: id,
      NOT: {
        status: { in: ["RESOLVED", "COMPLETE", "CLOSED"] },
      },
    },
  });

  if (ticketCount > 0) {
    throw new Error(
      `Cannot delete engineer because they are assigned to ${ticketCount} active ticket(s).`
    );
  }

  // Unlink user if any
  const linkedUser = await db.user.findFirst({
    where: { engineerId: id },
  });
  if (linkedUser) {
    await db.user.update({
      where: { id: linkedUser.id },
      data: { engineerId: null },
    });
  }

  const deleted = await db.fieldEngineer.delete({
    where: { id },
  });

  return deleted;
}

export async function updateSelfEngineerProfile(engineerId: number, userId: string, name: string, phone: string) {
  const updatedFe = await db.fieldEngineer.update({
    where: { id: engineerId },
    data: { name, phone },
  });

  await db.user.update({
    where: { id: userId },
    data: { name },
  });

  return updatedFe;
}

export async function updateUserProfile(userId: string, data: { name?: string; avatarUrl?: string | null }) {
  const updatedUser = await db.user.update({
    where: { id: userId },
    data: {
      name: data.name,
      avatarUrl: data.avatarUrl,
    },
  });
  return updatedUser;
}

export async function updateServicePartnerProfile(
  partnerId: number,
  data: {
    name: string;
    phone?: string | null;
    address?: string | null;
    dispatchEmail?: string | null;
    companyPhotoUrl?: string | null;
  }
) {
  const updatedPartner = await db.servicePartner.update({
    where: { id: partnerId },
    data: {
      name: data.name,
      phone: data.phone,
      address: data.address,
      dispatchEmail: data.dispatchEmail !== undefined ? (data.dispatchEmail?.trim() || null) : undefined,
      companyPhotoUrl: data.companyPhotoUrl,
    },
  });
  return updatedPartner;
}

export async function createRegistrationCode(data: {
  partnerId: number;
  role: "AGENT" | "FIELD_ENGINEER";
  maxUses?: number;
}) {
  const code = Math.random().toString(36).substring(2, 10).toUpperCase();

  await db.registrationCode.create({
    data: {
      code,
      role: data.role,
      partnerId: data.partnerId,
      maxUses: data.maxUses ?? 1,
    },
  });

  return { success: true };
}

export async function getRegistrationCodes(partnerId?: number) {
  const codes = await db.registrationCode.findMany({
    where: partnerId ? { partnerId } : undefined,
    include: {
      partner: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return JSON.parse(JSON.stringify(codes));
}

export async function deleteRegistrationCode(id: number) {
  await db.registrationCode.delete({
    where: { id },
  });
  return { success: true };
}

export async function validateRegistrationCode(code: string) {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) {
    throw new Error("Code cannot be empty.");
  }

  const codeRecord = await db.registrationCode.findUnique({
    where: { code: cleanCode },
    include: {
      partner: true,
    },
  });

  if (!codeRecord) {
    throw new Error("Invalid registration code.");
  }

  if (codeRecord.uses >= codeRecord.maxUses) {
    throw new Error("This registration code has reached its maximum usage limit.");
  }

  if (codeRecord.expiresAt && new Date() > new Date(codeRecord.expiresAt)) {
    throw new Error("This registration code has expired.");
  }

  return {
    valid: true,
    role: codeRecord.role as "AGENT" | "FIELD_ENGINEER",
    partnerId: codeRecord.partnerId,
    partnerName: codeRecord.partner.name,
  };
}

export async function getPartnerAgents(partnerId: number) {
  const agents = await db.user.findMany({
    where: {
      role: "AGENT",
      partnerId,
    },
    orderBy: { name: "asc" },
  });
  return JSON.parse(JSON.stringify(agents));
}

export async function removePartnerAgentAction(userId: string) {
  await db.user.update({
    where: { id: userId },
    data: {
      role: "FIELD_ENGINEER",
      partnerId: null,
    },
  });
  return { success: true };
}

export async function getFeTeamMembersByUserId(userId: string) {
  const me = await db.user.findUnique({
    where: { id: userId },
    select: {
      engineer: {
        select: { partnerId: true, id: true }
      }
    }
  });
  if (!me?.engineer) {
    throw new Error("Field Engineer profile not found.");
  }
  
  const members = await db.fieldEngineer.findMany({
    where: {
      partnerId: me.engineer.partnerId,
      NOT: { id: me.engineer.id }
    },
    orderBy: { name: "asc" }
  });
  return JSON.parse(JSON.stringify(members));
}

export async function reassignTicketByFe(data: {
  ticketId: number;
  feUserId: string;
  targetFeId: number | null;
  notes: string;
}) {
  const me = await db.user.findUnique({
    where: { id: data.feUserId },
    include: { engineer: true }
  });
  if (!me) throw new Error("User not found");
  const senderName = me.name || me.email;

  let targetFeName = "Agent Pool";
  if (data.targetFeId) {
    const target = await db.fieldEngineer.findUnique({
      where: { id: data.targetFeId }
    });
    if (!target) throw new Error("Target engineer not found");
    targetFeName = target.name;
  }

  const ticket = await db.ticket.update({
    where: { id: data.ticketId },
    data: {
      assignedFeId: data.targetFeId,
      feAcknowledgeStatus: null, 
      activities: {
        create: {
          type: "COMMENT",
          notes: `Reassigned by ${senderName} to ${targetFeName}. Reason: ${data.notes || "No reason specified."}`,
          author: senderName
        }
      }
    }
  });

  return ticket;
}

// ==========================================
// INVENTORY & WAREHOUSE ACTIONS
// ==========================================

export async function getWarehouses(partnerId?: number) {
  try {
    const warehouses = await db.warehouse.findMany({
      where: partnerId ? { partnerId } : undefined,
      include: {
        partner: true,
        _count: {
          select: { items: true }
        }
      },
      orderBy: { name: "asc" },
    });
    return JSON.parse(JSON.stringify(warehouses));
  } catch (err) {
    console.warn("getWarehouses notice:", err);
    return [];
  }
}

export async function createWarehouse(data: {
  name: string;
  state: string;
  address?: string;
  contactPerson?: string;
  contactPhone?: string;
  partnerId?: number | null;
}) {
  const warehouse = await db.warehouse.create({
    data: {
      name: data.name.trim(),
      state: data.state.trim(),
      address: data.address?.trim() || null,
      contactPerson: data.contactPerson?.trim() || null,
      contactPhone: data.contactPhone?.trim() || null,
      partnerId: data.partnerId ? Number(data.partnerId) : null,
    },
  });
  return JSON.parse(JSON.stringify(warehouse));
}

export async function updateWarehouse(
  id: number,
  data: {
    name?: string;
    state?: string;
    address?: string;
    contactPerson?: string;
    contactPhone?: string;
    partnerId?: number | null;
  }
) {
  const warehouse = await db.warehouse.update({
    where: { id: Number(id) },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.state !== undefined ? { state: data.state.trim() } : {}),
      ...(data.address !== undefined ? { address: data.address?.trim() || null } : {}),
      ...(data.contactPerson !== undefined ? { contactPerson: data.contactPerson?.trim() || null } : {}),
      ...(data.contactPhone !== undefined ? { contactPhone: data.contactPhone?.trim() || null } : {}),
      ...(data.partnerId !== undefined ? { partnerId: data.partnerId ? Number(data.partnerId) : null } : {}),
    },
  });
  return JSON.parse(JSON.stringify(warehouse));
}

export async function deleteWarehouse(id: number) {
  const count = await db.inventoryItem.count({
    where: { warehouseId: Number(id) }
  });
  if (count > 0) {
    throw new Error(`Cannot delete warehouse. It contains ${count} inventory item(s). Please reassign or delete the items first.`);
  }
  await db.warehouse.delete({
    where: { id: Number(id) },
  });
  return { success: true };
}

export async function getInventoryItems(filters?: {
  warehouseId?: number;
  status?: InventoryStatus;
  category?: string;
  search?: string;
  group?: string;
  trackingType?: InventoryTrackingType;
  mainconId?: number;
}) {
  try {
    const items = await db.inventoryItem.findMany({
      where: {
        ...(filters?.warehouseId ? { warehouseId: Number(filters.warehouseId) } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.category ? { category: filters.category } : {}),
        ...(filters?.group ? { group: filters.group } : {}),
        ...(filters?.trackingType ? { trackingType: filters.trackingType } : {}),
        ...(filters?.mainconId ? { mainconId: Number(filters.mainconId) } : {}),
        ...(filters?.search
          ? {
              OR: [
                { name: { contains: filters.search, mode: "insensitive" } },
                { serialNumber: { contains: filters.search, mode: "insensitive" } },
                { partNumber: { contains: filters.search, mode: "insensitive" } },
                { group: { contains: filters.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: {
        warehouse: {
          include: {
            partner: true,
          }
        },
        maincon: true,
        ticketAllocations: {
          include: {
            ticket: {
              select: {
                id: true,
                ticketRefNo: true,
                clientSiteName: true,
                endCustomer: true,
                state: true,
                status: true,
                subStatus: true,
              }
            }
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        logs: {
          orderBy: { createdAt: "desc" },
          take: 5,
        }
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    });
    return JSON.parse(JSON.stringify(items));
  } catch (err) {
    console.warn("getInventoryItems notice:", err);
    return [];
  }
}

export async function getInventoryItemById(id: number) {
  const item = await db.inventoryItem.findUnique({
    where: { id: Number(id) },
    include: {
      warehouse: {
        include: {
          partner: true,
        }
      },
      maincon: true,
      ticketAllocations: {
        include: {
          ticket: true,
        },
        orderBy: { createdAt: "desc" },
      },
      logs: {
        orderBy: { createdAt: "desc" }
      }
    }
  });
  return JSON.parse(JSON.stringify(item));
}

export async function createInventoryItem(data: {
  name: string;
  partNumber?: string;
  category: string;
  serialNumber?: string;
  trackingType?: InventoryTrackingType;
  quantity?: number;
  group?: string;
  mainconId?: number;
  warehouseId: number;
  status?: InventoryStatus;
  isLoaner?: boolean;
  supplier?: string;
  notes?: string;
  author?: string;
}) {
  const isBulk = data.trackingType === "BULK";
  const cleanSerial = data.serialNumber?.trim() ? data.serialNumber.trim().toUpperCase() : null;

  if (!isBulk && !cleanSerial) {
    throw new Error("Serial Number is required for serialized inventory items.");
  }

  if (cleanSerial) {
    const existing = await db.inventoryItem.findUnique({
      where: { serialNumber: cleanSerial }
    });
    if (existing) {
      throw new Error(`An inventory item with Serial Number "${cleanSerial}" already exists.`);
    }
  }

  const initialQty = isBulk ? Math.max(1, Number(data.quantity) || 1) : 1;

  const item = await db.inventoryItem.create({
    data: {
      name: data.name.trim(),
      partNumber: data.partNumber?.trim() || null,
      category: data.category.trim(),
      serialNumber: cleanSerial,
      trackingType: data.trackingType || "SERIALIZED",
      quantity: initialQty,
      availableQuantity: initialQty,
      group: data.group?.trim() || null,
      mainconId: data.mainconId ? Number(data.mainconId) : null,
      warehouseId: Number(data.warehouseId),
      status: data.status || "AVAILABLE",
      isLoaner: Boolean(data.isLoaner),
      supplier: data.supplier?.trim() || null,
      notes: data.notes?.trim() || null,
      logs: {
        create: {
          action: "CREATED",
          notes: `${data.isLoaner ? "Standby Loaner Unit" : isBulk ? `Bulk Stock (${initialQty} units)` : "Item"} registered into inventory. Group: ${data.group || "General"}. Initial status: ${data.status || "AVAILABLE"}.`,
          author: data.author || "System",
        }
      }
    },
    include: {
      warehouse: true,
      maincon: true,
    }
  });

  return JSON.parse(JSON.stringify(item));
}

export async function updateInventoryItem(
  id: number,
  data: {
    name?: string;
    partNumber?: string;
    category?: string;
    serialNumber?: string;
    trackingType?: InventoryTrackingType;
    quantity?: number;
    availableQuantity?: number;
    group?: string;
    mainconId?: number | null;
    warehouseId?: number;
    status?: InventoryStatus;
    isLoaner?: boolean;
    supplier?: string;
    notes?: string;
    author?: string;
    actionReason?: string;
  }
) {
  const current = await db.inventoryItem.findUnique({
    where: { id: Number(id) }
  });
  if (!current) throw new Error("Inventory item not found");

  const cleanSerial = data.serialNumber ? data.serialNumber.trim().toUpperCase() : undefined;
  if (cleanSerial && cleanSerial !== current.serialNumber) {
    const existing = await db.inventoryItem.findUnique({
      where: { serialNumber: cleanSerial }
    });
    if (existing) {
      throw new Error(`An inventory item with Serial Number "${cleanSerial}" already exists.`);
    }
  }

  const logsToCreate = [];
  if (data.status && data.status !== current.status) {
    logsToCreate.push({
      action: "STATUS_CHANGE",
      notes: `Status changed from ${current.status} to ${data.status}. Reason: ${data.actionReason || "Manual update"}`,
      author: data.author || "System",
    });
  }

  const updated = await db.inventoryItem.update({
    where: { id: Number(id) },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.partNumber !== undefined ? { partNumber: data.partNumber?.trim() || null } : {}),
      ...(data.category !== undefined ? { category: data.category.trim() } : {}),
      ...(cleanSerial !== undefined ? { serialNumber: cleanSerial || null } : {}),
      ...(data.trackingType !== undefined ? { trackingType: data.trackingType } : {}),
      ...(data.quantity !== undefined ? { quantity: Number(data.quantity) } : {}),
      ...(data.availableQuantity !== undefined ? { availableQuantity: Number(data.availableQuantity) } : {}),
      ...(data.group !== undefined ? { group: data.group?.trim() || null } : {}),
      ...(data.mainconId !== undefined ? { mainconId: data.mainconId ? Number(data.mainconId) : null } : {}),
      ...(data.warehouseId !== undefined ? { warehouseId: Number(data.warehouseId) } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.isLoaner !== undefined ? { isLoaner: Boolean(data.isLoaner) } : {}),
      ...(data.supplier !== undefined ? { supplier: data.supplier?.trim() || null } : {}),
      ...(data.notes !== undefined ? { notes: data.notes?.trim() || null } : {}),
      ...(logsToCreate.length > 0 ? { logs: { create: logsToCreate } } : {})
    },
    include: {
      warehouse: true,
      maincon: true,
    }
  });

  return JSON.parse(JSON.stringify(updated));
}

export async function deleteInventoryItem(id: number) {
  const item = await db.inventoryItem.findUnique({
    where: { id: Number(id) },
    include: { ticketAllocations: true }
  });
  if (!item) return { success: true };
  if (item.status === "INSTALLED" || item.ticketAllocations.length > 0) {
    throw new Error("Cannot delete item because it has ticket history/allocations. You can change its status to SCRAPPED instead.");
  }
  await db.inventoryItem.delete({
    where: { id: Number(id) }
  });
  return { success: true };
}

// ==========================================
// TICKET SPARE PART ACTIONS
// ==========================================

export async function getTicketSpareParts(ticketId: number) {
  const parts = await db.ticketSparePart.findMany({
    where: { ticketId: Number(ticketId) },
    include: {
      inventoryItem: {
        include: {
          warehouse: true,
          maincon: true,
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });
  return JSON.parse(JSON.stringify(parts));
}

export async function requestTicketSparePart(data: {
  ticketId: number;
  requestedPartName: string;
  quantity?: number;
  notes?: string;
  author?: string;
}) {
  const part = await db.ticketSparePart.create({
    data: {
      ticketId: Number(data.ticketId),
      requestedPartName: data.requestedPartName.trim(),
      quantity: data.quantity || 1,
      status: "REQUESTED",
      notes: data.notes?.trim() || null,
    }
  });

  await db.ticketActivity.create({
    data: {
      ticketId: Number(data.ticketId),
      type: "COMMENT",
      notes: `Spare part requested: "${data.requestedPartName.trim()}" (Qty: ${data.quantity || 1}). ${data.notes ? `Notes: ${data.notes}` : ""}`,
      author: data.author || "System",
    }
  });

  return JSON.parse(JSON.stringify(part));
}

export async function allocateAndDispatchSparePart(data: {
  ticketSparePartId: number;
  inventoryItemId: number;
  courierName?: string;
  dispatchTrackingNo?: string;
  notes?: string;
  author?: string;
}) {
  const item = await db.inventoryItem.findUnique({
    where: { id: Number(data.inventoryItemId) },
    include: { warehouse: true }
  });
  if (!item) throw new Error("Inventory item not found");

  const existingPart = await db.ticketSparePart.findUnique({
    where: { id: Number(data.ticketSparePartId) }
  });
  if (!existingPart) throw new Error("Ticket spare part request not found");

  const requestedQty = existingPart.quantity || 1;

  if (item.trackingType === "BULK") {
    if (item.availableQuantity < requestedQty) {
      throw new Error(`Insufficient bulk stock available (${item.availableQuantity} available, ${requestedQty} requested).`);
    }
  } else {
    if (item.status !== "AVAILABLE" && item.status !== "RESERVED") {
      throw new Error(`Selected item is not available (Current status: ${item.status})`);
    }
  }

  const isDispatch = Boolean(data.dispatchTrackingNo || data.courierName);
  const partStatus = isDispatch ? "DISPATCHED" : "ALLOCATED";
  const itemStatus = isDispatch ? "IN_TRANSIT" : "RESERVED";

  const updatedPart = await db.ticketSparePart.update({
    where: { id: Number(data.ticketSparePartId) },
    data: {
      inventoryItemId: Number(data.inventoryItemId),
      status: partStatus,
      courierName: data.courierName?.trim() || null,
      dispatchTrackingNo: data.dispatchTrackingNo?.trim() || null,
      dispatchedAt: isDispatch ? new Date() : null,
      notes: data.notes?.trim() || undefined,
    },
    include: {
      ticket: true,
      inventoryItem: true,
    }
  });

  if (item.trackingType === "BULK") {
    const newAvailable = Math.max(0, item.availableQuantity - requestedQty);
    await db.inventoryItem.update({
      where: { id: Number(data.inventoryItemId) },
      data: {
        availableQuantity: newAvailable,
        status: newAvailable === 0 ? "INSTALLED" : "AVAILABLE",
        logs: {
          create: {
            action: isDispatch ? "DISPATCHED" : "ALLOCATED",
            notes: `${requestedQty} units ${isDispatch ? "dispatched" : "allocated"} for Ticket #${updatedPart.ticket.ticketRefNo || updatedPart.ticket.id} (${updatedPart.ticket.clientSiteName}). Remaining available: ${newAvailable}.`,
            author: data.author || "System",
          }
        }
      }
    });
  } else {
    await db.inventoryItem.update({
      where: { id: Number(data.inventoryItemId) },
      data: {
        status: itemStatus,
        availableQuantity: 0,
        logs: {
          create: {
            action: isDispatch ? "DISPATCHED" : "ALLOCATED",
            notes: `${isDispatch ? "Dispatched" : "Allocated"} for Ticket #${updatedPart.ticket.ticketRefNo || updatedPart.ticket.id} (${updatedPart.ticket.clientSiteName}). ${data.courierName ? `Courier: ${data.courierName}, Tracking: ${data.dispatchTrackingNo}` : ""}`,
            author: data.author || "System",
          }
        }
      }
    });
  }

  await db.ticketActivity.create({
    data: {
      ticketId: updatedPart.ticketId,
      type: "COMMENT",
      notes: `Spare part ${isDispatch ? "dispatched" : "allocated"}: "${item.name}" ${item.serialNumber ? `(S/N: ${item.serialNumber})` : `(Qty: ${requestedQty})`} from ${item.warehouse.name}.${data.courierName ? ` Courier: ${data.courierName} | Tracking No: ${data.dispatchTrackingNo}` : ""}`,
      author: data.author || "System",
    }
  });

  return JSON.parse(JSON.stringify(updatedPart));
}

export async function restockOrReturnSparePart(data: {
  ticketSparePartId: number;
  reason?: string;
  author?: string;
}) {
  const part = await db.ticketSparePart.findUnique({
    where: { id: Number(data.ticketSparePartId) },
    include: { inventoryItem: true, ticket: true }
  });
  if (!part) throw new Error("Ticket spare part not found");

  if (part.inventoryItemId && part.inventoryItem) {
    const item = part.inventoryItem;
    const qtyToRestore = part.quantity || 1;

    if (item.trackingType === "BULK") {
      const restoredAvailable = item.availableQuantity + qtyToRestore;
      await db.inventoryItem.update({
        where: { id: item.id },
        data: {
          availableQuantity: restoredAvailable,
          status: "AVAILABLE",
          logs: {
            create: {
              action: "RESTOCKED",
              notes: `${qtyToRestore} unit(s) restocked from Ticket #${part.ticket.ticketRefNo || part.ticket.id}. Reason: ${data.reason || "Part returned / unused"}. New available: ${restoredAvailable}.`,
              author: data.author || "System",
            }
          }
        }
      });
    } else {
      await db.inventoryItem.update({
        where: { id: item.id },
        data: {
          status: "AVAILABLE",
          availableQuantity: 1,
          logs: {
            create: {
              action: "RETURNED_TO_STOCK",
              notes: `Unit returned to available stock from Ticket #${part.ticket.ticketRefNo || part.ticket.id}. Reason: ${data.reason || "Part unused / returned"}.`,
              author: data.author || "System",
            }
          }
        }
      });
    }
  }

  const updatedPart = await db.ticketSparePart.update({
    where: { id: Number(data.ticketSparePartId) },
    data: {
      status: "RETURNED",
    }
  });

  await db.ticketActivity.create({
    data: {
      ticketId: part.ticketId,
      type: "COMMENT",
      notes: `Spare part "${part.requestedPartName}" (Qty: ${part.quantity}) restocked / returned to warehouse inventory.`,
      author: data.author || "System",
    }
  });

  return JSON.parse(JSON.stringify(updatedPart));
}

export async function markSparePartInstalled(data: {
  ticketSparePartId: number;
  defectiveSerial?: string;
  replacedDefectiveSerial?: string;
  notes?: string;
  author?: string;
}) {
  const part = await db.ticketSparePart.findUnique({
    where: { id: Number(data.ticketSparePartId) },
    include: { inventoryItem: true, ticket: true }
  });
  if (!part) throw new Error("Ticket spare part not found");

  const serialReplaced = data.replacedDefectiveSerial || data.defectiveSerial;

  if (part.inventoryItemId && part.inventoryItem) {
    if (part.inventoryItem.trackingType !== "BULK") {
      await db.inventoryItem.update({
        where: { id: part.inventoryItemId },
        data: {
          status: "INSTALLED",
          logs: {
            create: {
              action: "INSTALLED",
              notes: `Installed on site for Ticket #${part.ticket.ticketRefNo || part.ticket.id} (${part.ticket.clientSiteName}). ${serialReplaced ? `Replaced defective S/N: ${serialReplaced}` : ""}`,
              author: data.author || "System",
            }
          }
        }
      });
    }
  }

  const updatedPart = await db.ticketSparePart.update({
    where: { id: Number(data.ticketSparePartId) },
    data: {
      status: "INSTALLED",
      installedAt: new Date(),
      replacedDefectiveSerial: serialReplaced?.trim() || null,
      notes: data.notes?.trim() || undefined,
    }
  });

  await db.ticketActivity.create({
    data: {
      ticketId: part.ticketId,
      type: "COMMENT",
      notes: `Spare part installed on site: "${part.requestedPartName}". ${serialReplaced ? `Replaced defective unit S/N: ${serialReplaced}` : ""}`,
      author: data.author || "System",
    }
  });

  return JSON.parse(JSON.stringify(updatedPart));
}

export async function cancelSparePartRequest(ticketSparePartId: number, author?: string) {
  const part = await db.ticketSparePart.findUnique({
    where: { id: Number(ticketSparePartId) },
    include: { inventoryItem: true, ticket: true }
  });
  if (!part) return { success: true };

  // If item was allocated or in transit, restore to AVAILABLE / replenish bulk qty
  if (part.inventoryItemId && part.inventoryItem) {
    const item = part.inventoryItem;
    const qtyToRestore = part.quantity || 1;

    if (item.trackingType === "BULK") {
      const restored = item.availableQuantity + qtyToRestore;
      await db.inventoryItem.update({
        where: { id: item.id },
        data: {
          availableQuantity: restored,
          status: "AVAILABLE",
          logs: {
            create: {
              action: "ALLOCATION_CANCELLED",
              notes: `Allocation of ${qtyToRestore} unit(s) cancelled for Ticket #${part.ticket.ticketRefNo || part.ticket.id}. Returned to available stock.`,
              author: author || "System",
            }
          }
        }
      });
    } else {
      await db.inventoryItem.update({
        where: { id: item.id },
        data: {
          status: "AVAILABLE",
          availableQuantity: 1,
          logs: {
            create: {
              action: "ALLOCATION_CANCELLED",
              notes: `Allocation cancelled for Ticket #${part.ticket.ticketRefNo || part.ticket.id}. Returned to available stock.`,
              author: author || "System",
            }
          }
        }
      });
    }
  }

  await db.ticketSparePart.update({
    where: { id: Number(ticketSparePartId) },
    data: {
      status: "CANCELLED",
    }
  });

  await db.ticketActivity.create({
    data: {
      ticketId: part.ticketId,
      type: "COMMENT",
      notes: `Spare part request for "${part.requestedPartName}" was cancelled.`,
      author: author || "System",
    }
  });

  return { success: true };
}

export async function getPendingPartsRequests() {
  try {
    const tickets = await db.ticket.findMany({
      where: {
        OR: [
          { subStatus: "PENDING_PARTS" },
          {
            spareParts: {
              some: {
                status: { in: ["REQUESTED", "ALLOCATED", "DISPATCHED"] }
              }
            }
          }
        ]
      },
      include: {
        maincon: true,
        partner: true,
        assignedFe: true,
        spareParts: {
          include: {
            inventoryItem: {
              include: {
                warehouse: true,
              }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    return JSON.parse(JSON.stringify(tickets));
  } catch (err) {
    console.warn("getPendingPartsRequests notice:", err);
    return [];
  }
}

/* ─────────────────────────────────────────────────────────────
   LOANER UNITS & STANDBY HARDWARE ACTIONS
────────────────────────────────────────────────────────────── */

export async function allocateAndDispatchLoanerUnit(data: {
  ticketId: number;
  inventoryItemId: number;
  loanDurationDays?: number;
  expectedReturnDate?: Date | string;
  courierName?: string;
  dispatchTrackingNo?: string;
  loanNotes?: string;
  author?: string;
}) {
  const item = await db.inventoryItem.findUnique({
    where: { id: Number(data.inventoryItemId) },
    include: { warehouse: true },
  });
  if (!item) throw new Error("Inventory item not found");
  if (item.status !== "AVAILABLE") {
    throw new Error(`Item is not available (Current status: ${item.status})`);
  }

  const durationDays = data.loanDurationDays || 14;
  let returnDate: Date;
  if (data.expectedReturnDate) {
    returnDate = new Date(data.expectedReturnDate);
  } else {
    returnDate = new Date();
    returnDate.setDate(returnDate.getDate() + durationDays);
  }

  const ticket = await db.ticket.findUnique({
    where: { id: Number(data.ticketId) },
  });
  if (!ticket) throw new Error("Ticket not found");

  const isDispatch = Boolean(data.dispatchTrackingNo || data.courierName);
  const partStatus = "ON_LOAN";
  const itemStatus = isDispatch ? "IN_TRANSIT" : "ON_LOAN";

  const loanerPart = await db.ticketSparePart.create({
    data: {
      ticketId: Number(data.ticketId),
      inventoryItemId: Number(data.inventoryItemId),
      requestedPartName: `[Loaner Unit] ${item.name}`,
      quantity: 1,
      status: partStatus,
      isLoaner: true,
      loanDurationDays: durationDays,
      expectedReturnDate: returnDate,
      courierName: data.courierName?.trim() || null,
      dispatchTrackingNo: data.dispatchTrackingNo?.trim() || null,
      dispatchedAt: new Date(),
      loanNotes: data.loanNotes?.trim() || null,
      notes: data.loanNotes?.trim() || null,
    },
    include: {
      ticket: true,
      inventoryItem: true,
    },
  });

  await db.inventoryItem.update({
    where: { id: Number(data.inventoryItemId) },
    data: {
      status: itemStatus,
      logs: {
        create: {
          action: "LOANER_DISPATCHED",
          notes: `Deployed as temporary loaner unit for Ticket #${ticket.ticketRefNo || ticket.id} (${ticket.clientSiteName}). Expected return: ${returnDate.toLocaleDateString("en-MY")}.${data.courierName ? ` Courier: ${data.courierName} | Tracking: ${data.dispatchTrackingNo}` : ""}`,
          author: data.author || "System",
        },
      },
    },
  });

  await db.ticketActivity.create({
    data: {
      ticketId: ticket.id,
      type: "COMMENT",
      notes: `🔄 Standby Loaner Unit deployed: "${item.name}" (S/N: ${item.serialNumber}) from ${item.warehouse.name} on a ${durationDays}-day loan. Expected return by ${returnDate.toLocaleDateString("en-MY")}.${data.courierName ? ` Courier: ${data.courierName} | Tracking: ${data.dispatchTrackingNo}` : ""}`,
      author: data.author || "System",
    },
  });

  return JSON.parse(JSON.stringify(loanerPart));
}

export async function extendLoanDuration(data: {
  ticketSparePartId: number;
  additionalDays: number;
  reason?: string;
  author?: string;
}) {
  const part = await db.ticketSparePart.findUnique({
    where: { id: Number(data.ticketSparePartId) },
    include: { ticket: true, inventoryItem: true },
  });
  if (!part) throw new Error("Loaner record not found");

  const currentReturnDate = part.expectedReturnDate ? new Date(part.expectedReturnDate) : new Date();
  const newReturnDate = new Date(currentReturnDate);
  newReturnDate.setDate(newReturnDate.getDate() + data.additionalDays);

  const updatedPart = await db.ticketSparePart.update({
    where: { id: Number(data.ticketSparePartId) },
    data: {
      expectedReturnDate: newReturnDate,
      loanDurationDays: (part.loanDurationDays || 14) + data.additionalDays,
      loanNotes: data.reason ? `${part.loanNotes || ""}\n[Extended +${data.additionalDays}d]: ${data.reason}`.trim() : part.loanNotes,
    },
    include: { ticket: true, inventoryItem: true },
  });

  if (part.inventoryItemId) {
    await db.inventoryLog.create({
      data: {
        inventoryItemId: part.inventoryItemId,
        action: "LOAN_EXTENDED",
        notes: `Loan duration extended by +${data.additionalDays} days for Ticket #${part.ticket.ticketRefNo || part.ticket.id}. New expected return: ${newReturnDate.toLocaleDateString("en-MY")}.${data.reason ? ` Reason: ${data.reason}` : ""}`,
        author: data.author || "System",
      },
    });
  }

  await db.ticketActivity.create({
    data: {
      ticketId: part.ticketId,
      type: "COMMENT",
      notes: `⏱️ Loaner Unit duration extended by +${data.additionalDays} days. New expected return date: ${newReturnDate.toLocaleDateString("en-MY")}.${data.reason ? ` Reason: ${data.reason}` : ""}`,
      author: data.author || "System",
    },
  });

  return JSON.parse(JSON.stringify(updatedPart));
}

export async function initiateLoanerReturn(data: {
  ticketSparePartId: number;
  returnCourierName?: string;
  returnTrackingNo?: string;
  notes?: string;
  author?: string;
}) {
  const part = await db.ticketSparePart.findUnique({
    where: { id: Number(data.ticketSparePartId) },
    include: { ticket: true, inventoryItem: true },
  });
  if (!part) throw new Error("Loaner record not found");

  const updatedPart = await db.ticketSparePart.update({
    where: { id: Number(data.ticketSparePartId) },
    data: {
      status: "RETURN_IN_TRANSIT",
      returnInitiatedAt: new Date(),
      returnCourierName: data.returnCourierName?.trim() || null,
      returnTrackingNo: data.returnTrackingNo?.trim() || null,
      notes: data.notes ? `${part.notes || ""}\n[Return Initiated]: ${data.notes}`.trim() : part.notes,
    },
    include: { ticket: true, inventoryItem: true },
  });

  if (part.inventoryItemId) {
    await db.inventoryItem.update({
      where: { id: part.inventoryItemId },
      data: {
        status: "RETURN_IN_TRANSIT",
        logs: {
          create: {
            action: "RETURN_INITIATED",
            notes: `Loaner unit return initiated from Ticket #${part.ticket.ticketRefNo || part.ticket.id}.${data.returnCourierName ? ` Return Courier: ${data.returnCourierName} | Tracking: ${data.returnTrackingNo}` : ""}`,
            author: data.author || "System",
          },
        },
      },
    });
  }

  await db.ticketActivity.create({
    data: {
      ticketId: part.ticketId,
      type: "COMMENT",
      notes: `📦 Loaner unit return initiated back to warehouse.${data.returnCourierName ? ` Return Courier: ${data.returnCourierName} | Tracking No: ${data.returnTrackingNo}` : ""}`,
      author: data.author || "System",
    },
  });

  return JSON.parse(JSON.stringify(updatedPart));
}

export async function receiveAndRestockLoaner(data: {
  ticketSparePartId: number;
  condition: "GOOD" | "DAMAGED_NEEDS_REPAIR" | "MISSING_ACCESSORIES";
  notes?: string;
  author?: string;
}) {
  const part = await db.ticketSparePart.findUnique({
    where: { id: Number(data.ticketSparePartId) },
    include: { ticket: true, inventoryItem: { include: { warehouse: true } } },
  });
  if (!part) throw new Error("Loaner record not found");

  const isGood = data.condition === "GOOD";
  const newItemStatus = isGood ? "AVAILABLE" : "DEFECTIVE_PENDING_RETURN";

  const updatedPart = await db.ticketSparePart.update({
    where: { id: Number(data.ticketSparePartId) },
    data: {
      status: "RETURNED",
      returnReceivedAt: new Date(),
      returnCondition: data.condition,
      notes: data.notes ? `${part.notes || ""}\n[Restocked - Condition: ${data.condition}]: ${data.notes}`.trim() : part.notes,
    },
    include: { ticket: true, inventoryItem: true },
  });

  if (part.inventoryItemId) {
    await db.inventoryItem.update({
      where: { id: part.inventoryItemId },
      data: {
        status: newItemStatus,
        logs: {
          create: {
            action: isGood ? "RESTOCKED_AVAILABLE" : "RESTOCKED_DEFECTIVE",
            notes: `Loaner unit returned from Ticket #${part.ticket.ticketRefNo || part.ticket.id} (${part.ticket.clientSiteName}). Condition check: ${data.condition}.${data.notes ? ` Notes: ${data.notes}` : ""}`,
            author: data.author || "Warehouse Coordinator",
          },
        },
      },
    });
  }

  await db.ticketActivity.create({
    data: {
      ticketId: part.ticketId,
      type: "COMMENT",
      notes: `✅ Loaner unit received & restocked at warehouse. Condition: ${data.condition}. Item status: ${newItemStatus}.${data.notes ? ` Notes: ${data.notes}` : ""}`,
      author: data.author || "Warehouse Coordinator",
    },
  });

  return JSON.parse(JSON.stringify(updatedPart));
}

export async function getActiveLoaners() {
  try {
    const loans = await db.ticketSparePart.findMany({
      where: {
        isLoaner: true,
        status: { in: ["ON_LOAN", "RETURN_IN_TRANSIT"] },
      },
      include: {
        ticket: {
          include: {
            maincon: true,
            partner: true,
            assignedFe: true,
          },
        },
        inventoryItem: {
          include: {
            warehouse: true,
          },
        },
      },
      orderBy: { expectedReturnDate: "asc" },
    });

    return JSON.parse(JSON.stringify(loans));
  } catch (err) {
    console.warn("getActiveLoaners notice:", err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────
// NATIVE AUTHENTICATION & SESSION ACTIONS
// ─────────────────────────────────────────────────────────────

export async function loginWithPasswordAction(email: string, passwordPlain: string) {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const user = await db.user.findFirst({
      where: { email: { equals: cleanEmail, mode: "insensitive" } },
      include: { partner: true, engineer: true },
    });

    if (!user) {
      return { success: false, error: "No account found with this email address." };
    }

    if (user.isActive === false) {
      return {
        success: false,
        error: "Your account has been deactivated. Please contact your system administrator.",
        isDeactivated: true,
      };
    }

    if (!user.passwordHash) {
      // First-time login for migrated account: automatically set password if >= 6 chars
      if (passwordPlain.length >= 6) {
        const hashedPassword = await hashPassword(passwordPlain);
        await db.user.update({
          where: { id: user.id },
          data: { passwordHash: hashedPassword },
        });

        // Set session cookie
        await createSessionCookie(user);

        return {
          success: true,
          user: JSON.parse(JSON.stringify(user)),
          firstTimeSetup: true,
        };
      } else {
        return {
          success: false,
          error: "First-time login: Please enter a password of at least 6 characters to activate your account.",
          needsPasswordSetup: true,
        };
      }
    }

    const isMatch = await verifyPassword(passwordPlain, user.passwordHash);
    if (!isMatch) {
      return { success: false, error: "Incorrect password. Please try again." };
    }

    // If not verified, prompt for email verification
    if (user.isEmailVerified === false) {
      return {
        success: false,
        requireEmailVerification: true,
        email: cleanEmail,
        error: "Please verify your email address to log in.",
      };
    }

    // Set HTTP-Only Session Cookie
    await createSessionCookie(user);

    return {
      success: true,
      user: JSON.parse(JSON.stringify(user)),
    };
  } catch (error: any) {
    console.error("loginWithPasswordAction error:", error);
    return { success: false, error: error.message || "An unexpected error occurred during login." };
  }
}

export async function logoutAction() {
  try {
    await destroySessionCookie();
    return { success: true };
  } catch (error: any) {
    console.error("logoutAction error:", error);
    return { success: false, error: error.message };
  }
}

export async function getCurrentUserAction() {
  try {
    const user = await getSessionUser();
    return user ? JSON.parse(JSON.stringify(user)) : null;
  } catch (error) {
    console.error("getCurrentUserAction error:", error);
    return null;
  }
}

export async function registerWithCodeNativeAction(data: {
  email: string;
  passwordPlain: string;
  name: string;
  phone?: string;
  registrationCode?: string;
  appOrigin?: string;
}) {
  try {
    const cleanEmail = data.email.trim().toLowerCase();
    const existing = await db.user.findFirst({
      where: { email: { equals: cleanEmail, mode: "insensitive" } },
    });

    if (existing) {
      if (existing.isEmailVerified === false) {
        return {
          success: false,
          requireEmailVerification: true,
          email: cleanEmail,
          error: "An account with this email exists but is pending verification. Please enter your verification code.",
        };
      }
      return { success: false, error: "An account with this email address already exists." };
    }

    const totalUsers = await db.user.count();
    const isFirstUser = totalUsers === 0;
    let role: UserRole = isFirstUser ? "SUPERADMIN" : "FIELD_ENGINEER";
    let engineerId: number | null = null;
    let partnerId: number | null = null;

    if (totalUsers > 0 && data.registrationCode) {
      const cleanCode = data.registrationCode.trim().toUpperCase();
      const codeRecord = await db.registrationCode.findUnique({
        where: { code: cleanCode },
      });

      if (!codeRecord || codeRecord.uses >= codeRecord.maxUses) {
        return { success: false, error: "Invalid or expired registration code." };
      }

      if (codeRecord.expiresAt && new Date() > new Date(codeRecord.expiresAt)) {
        return { success: false, error: "Registration code has expired." };
      }

      role = codeRecord.role;
      partnerId = codeRecord.partnerId;

      if (role === "FIELD_ENGINEER") {
        const fe = await db.fieldEngineer.create({
          data: {
            name: data.name || cleanEmail.split("@")[0],
            phone: data.phone || "",
            email: cleanEmail,
            partnerId: codeRecord.partnerId,
            country: "Malaysia",
          },
        });
        engineerId = fe.id;
        partnerId = null;
      }

      await db.registrationCode.update({
        where: { id: codeRecord.id },
        data: { uses: { increment: 1 } },
      });
    }

    // Generate 6-digit OTP and URL token
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    const hashedPassword = await hashPassword(data.passwordPlain);
    const newUserId = crypto.randomUUID();

    const newUser = await db.user.create({
      data: {
        id: newUserId,
        email: cleanEmail,
        name: data.name || cleanEmail.split("@")[0],
        passwordHash: hashedPassword,
        role,
        isActive: true,
        isEmailVerified: isFirstUser, // First superadmin is automatically verified
        emailVerificationOtp: isFirstUser ? null : otp,
        emailVerificationToken: isFirstUser ? null : verificationToken,
        emailVerificationExpiresAt: isFirstUser ? null : expiresAt,
        engineerId,
        partnerId: role === "AGENT" ? partnerId : null,
      },
      include: {
        partner: true,
        engineer: true,
      },
    });

    if (isFirstUser) {
      // First user gets immediate login
      await createSessionCookie(newUser);
      return {
        success: true,
        user: JSON.parse(JSON.stringify(newUser)),
        verified: true,
      };
    }

    // Send Verification Email
    const baseUrl = data.appOrigin || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const verifyLink = `${baseUrl}/login?verifyToken=${verificationToken}`;

    await sendTemplatedEmail("AUTH_EMAIL_VERIFICATION", cleanEmail, {
      "{{userName}}": newUser.name || "User",
      "{{userEmail}}": cleanEmail,
      "{{verifyOtp}}": otp,
      "{{verifyLink}}": verifyLink,
      "{{expiryMinutes}}": "15",
    }).catch((err) => console.warn("Email verification send notice:", err));

    return {
      success: true,
      requireEmailVerification: true,
      email: cleanEmail,
      message: `A 6-digit verification code has been sent to ${cleanEmail}. Please enter it to complete registration.`,
    };
  } catch (error: any) {
    console.error("registerWithCodeNativeAction error:", error);
    return { success: false, error: error.message || "Failed to create account." };
  }
}

export async function verifyEmailOtpAction(data: { email: string; otp: string }) {
  try {
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanOtp = data.otp.trim();

    const user = await db.user.findFirst({
      where: { email: { equals: cleanEmail, mode: "insensitive" } },
      include: { partner: true, engineer: true },
    });

    if (!user) {
      return { success: false, error: "User account not found." };
    }

    if (user.isEmailVerified) {
      await createSessionCookie(user);
      return { success: true, user: JSON.parse(JSON.stringify(user)), alreadyVerified: true };
    }

    if (!user.emailVerificationOtp || user.emailVerificationOtp !== cleanOtp) {
      return { success: false, error: "Invalid verification code. Please check and try again." };
    }

    if (user.emailVerificationExpiresAt && new Date() > new Date(user.emailVerificationExpiresAt)) {
      return { success: false, error: "Verification code has expired. Please click 'Resend Code'." };
    }

    // Mark verified
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerificationOtp: null,
        emailVerificationToken: null,
        emailVerificationExpiresAt: null,
      },
      include: { partner: true, engineer: true },
    });

    // Create session cookie
    await createSessionCookie(updatedUser);

    // Send Welcome Email
    sendTemplatedEmail("AUTH_WELCOME_USER", cleanEmail, {
      "{{userName}}": updatedUser.name || "User",
      "{{userEmail}}": updatedUser.email,
      "{{userRole}}": updatedUser.role,
      "{{loginLink}}": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    }).catch((err) => console.warn("Welcome email notice:", err));

    return {
      success: true,
      user: JSON.parse(JSON.stringify(updatedUser)),
    };
  } catch (error: any) {
    console.error("verifyEmailOtpAction error:", error);
    return { success: false, error: error.message || "Verification failed." };
  }
}

export async function verifyEmailTokenAction(token: string) {
  try {
    const cleanToken = token.trim();
    const user = await db.user.findFirst({
      where: { emailVerificationToken: cleanToken },
      include: { partner: true, engineer: true },
    });

    if (!user) {
      return { success: false, error: "Invalid or expired verification link." };
    }

    if (user.emailVerificationExpiresAt && new Date() > new Date(user.emailVerificationExpiresAt)) {
      return { success: false, error: "Verification link has expired. Please request a new one." };
    }

    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerificationOtp: null,
        emailVerificationToken: null,
        emailVerificationExpiresAt: null,
      },
      include: { partner: true, engineer: true },
    });

    await createSessionCookie(updatedUser);

    return {
      success: true,
      user: JSON.parse(JSON.stringify(updatedUser)),
    };
  } catch (error: any) {
    console.error("verifyEmailTokenAction error:", error);
    return { success: false, error: error.message || "Token verification failed." };
  }
}

export async function resendVerificationOtpAction(email: string, appOrigin?: string) {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const user = await db.user.findFirst({
      where: { email: { equals: cleanEmail, mode: "insensitive" } },
    });

    if (!user) {
      return { success: false, error: "No account found with this email address." };
    }

    if (user.isEmailVerified) {
      return { success: true, message: "Your email is already verified. You may log in directly." };
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await db.user.update({
      where: { id: user.id },
      data: {
        emailVerificationOtp: otp,
        emailVerificationToken: verificationToken,
        emailVerificationExpiresAt: expiresAt,
      },
    });

    const baseUrl = appOrigin || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const verifyLink = `${baseUrl}/login?verifyToken=${verificationToken}`;

    const mailResult = await sendTemplatedEmail("AUTH_EMAIL_VERIFICATION", cleanEmail, {
      "{{userName}}": user.name || "User",
      "{{userEmail}}": cleanEmail,
      "{{verifyOtp}}": otp,
      "{{verifyLink}}": verifyLink,
      "{{expiryMinutes}}": "15",
    });

    return {
      success: true,
      message: mailResult.success
        ? `A new verification code has been sent to ${cleanEmail}.`
        : "Verification code regenerated. (Note: Email service unconfigured/disabled, contact admin if not received).",
    };
  } catch (error: any) {
    console.error("resendVerificationOtpAction error:", error);
    return { success: false, error: error.message || "Failed to resend verification code." };
  }
}

// ─────────────────────────────────────────────────────────────
// PASSWORD RESET ACTIONS
// ─────────────────────────────────────────────────────────────

export async function requestPasswordResetAction(email: string, appOrigin?: string) {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const user = await db.user.findFirst({
      where: { email: { equals: cleanEmail, mode: "insensitive" } },
    });

    if (!user) {
      // Return true to prevent email enumeration
      return { success: true, message: "If that email exists in our system, a password reset link has been sent." };
    }

    // Delete any existing tokens for this email
    await db.passwordResetToken.deleteMany({
      where: { email: cleanEmail },
    });

    // Generate secure 32-character token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.passwordResetToken.create({
      data: {
        token,
        email: cleanEmail,
        expiresAt,
      },
    });

    const baseUrl = appOrigin || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const resetLink = `${baseUrl}/reset-password?token=${token}`;

    const mailResult = await sendTemplatedEmail("AUTH_RESET_PASSWORD", cleanEmail, {
      "{{userName}}": user.name || "User",
      "{{resetLink}}": resetLink,
      "{{expiryMinutes}}": "60",
    });

    return {
      success: true,
      message: mailResult.success
        ? "Password reset link has been sent to your email."
        : "Reset link created, but email could not be sent (SMTP not configured or disabled). Please contact your administrator.",
      mailSent: mailResult.success,
    };
  } catch (error: any) {
    console.error("requestPasswordResetAction error:", error);
    return { success: false, error: error.message || "Failed to initiate password reset." };
  }
}

export async function verifyResetTokenAction(token: string) {
  try {
    const record = await db.passwordResetToken.findUnique({
      where: { token },
    });

    if (!record || record.expiresAt < new Date()) {
      return { valid: false, error: "This password reset link is invalid or has expired." };
    }

    return { valid: true, email: record.email };
  } catch (error: any) {
    return { valid: false, error: error.message };
  }
}

export async function completePasswordResetAction(token: string, newPasswordPlain: string) {
  try {
    const record = await db.passwordResetToken.findUnique({
      where: { token },
    });

    if (!record || record.expiresAt < new Date()) {
      return { success: false, error: "This password reset link has expired. Please request a new one." };
    }

    const hashedPassword = await hashPassword(newPasswordPlain);

    await db.user.update({
      where: { email: record.email },
      data: { passwordHash: hashedPassword },
    });

    // Delete token once used
    await db.passwordResetToken.delete({
      where: { id: record.id },
    });

    return { success: true };
  } catch (error: any) {
    console.error("completePasswordResetAction error:", error);
    return { success: false, error: error.message || "Failed to update password." };
  }
}

export async function adminSetUserPasswordAction(userId: string, newPasswordPlain: string) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser || currentUser.role !== "SUPERADMIN") {
      return { success: false, error: "Unauthorized. Superadmin privilege required." };
    }

    const hashedPassword = await hashPassword(newPasswordPlain);

    await db.user.update({
      where: { id: userId },
      data: { passwordHash: hashedPassword },
    });

    return { success: true };
  } catch (error: any) {
    console.error("adminSetUserPasswordAction error:", error);
    return { success: false, error: error.message || "Failed to set user password." };
  }
}

export async function updateMyPasswordAction(newPasswordPlain: string) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return { success: false, error: "Unauthorized. Please log in first." };
    }

    if (newPasswordPlain.length < 6) {
      return { success: false, error: "Password must be at least 6 characters." };
    }

    const hashedPassword = await hashPassword(newPasswordPlain);

    await db.user.update({
      where: { id: currentUser.id },
      data: { passwordHash: hashedPassword },
    });

    return { success: true };
  } catch (error: any) {
    console.error("updateMyPasswordAction error:", error);
    return { success: false, error: error.message || "Failed to update password." };
  }
}

// ─────────────────────────────────────────────────────────────
// SYSTEM SETTINGS & SMTP CONFIGURATION ACTIONS
// ─────────────────────────────────────────────────────────────

export async function getSmtpConfigAction() {
  try {
    const config = await db.smtpConfig.findFirst({
      orderBy: { id: "desc" },
    });

    if (!config) return null;

    return {
      id: config.id,
      host: config.host,
      port: config.port,
      secure: config.secure,
      user: config.user,
      password: config.password ? "••••••••••••••••" : "",
      hasPassword: Boolean(config.password),
      fromName: config.fromName,
      fromEmail: config.fromEmail,
      adminCc: config.adminCc || "",
      updatedAt: config.updatedAt,
    };
  } catch (error) {
    console.error("getSmtpConfigAction error:", error);
    return null;
  }
}

export async function saveSmtpConfigAction(data: {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password?: string;
  fromName: string;
  fromEmail: string;
  adminCc?: string;
}) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser || currentUser.role !== "SUPERADMIN") {
      return { success: false, error: "Unauthorized. Only Superadmins can manage system SMTP settings." };
    }

    const existing = await db.smtpConfig.findFirst({
      orderBy: { id: "desc" },
    });

    // If password wasn't provided or is mask, keep existing password
    let passwordToSave = data.password;
    if (!passwordToSave || passwordToSave.includes("••••")) {
      passwordToSave = existing?.password || "";
    }

    if (existing) {
      await db.smtpConfig.update({
        where: { id: existing.id },
        data: {
          host: data.host,
          port: Number(data.port),
          secure: data.secure,
          user: data.user,
          password: passwordToSave,
          fromName: data.fromName,
          fromEmail: data.fromEmail || data.user,
          adminCc: data.adminCc?.trim() || null,
        },
      });
    } else {
      await db.smtpConfig.create({
        data: {
          host: data.host,
          port: Number(data.port),
          secure: data.secure,
          user: data.user,
          password: passwordToSave,
          fromName: data.fromName,
          fromEmail: data.fromEmail || data.user,
          adminCc: data.adminCc?.trim() || null,
        },
      });
    }

    return { success: true };
  } catch (error: any) {
    console.error("saveSmtpConfigAction error:", error);
    return { success: false, error: error.message || "Failed to save SMTP configuration." };
  }
}

export async function testSmtpConfigAction(testRecipient: string, testConfig?: {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password?: string;
  fromName: string;
  fromEmail: string;
}) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser || currentUser.role !== "SUPERADMIN") {
      return { success: false, message: "Unauthorized. Superadmin privilege required." };
    }

    let configToTest = undefined;
    if (testConfig && testConfig.user) {
      let password = testConfig.password;
      if (!password || password.includes("••••")) {
        const existing = await db.smtpConfig.findFirst({ orderBy: { id: "desc" } });
        password = existing?.password || "";
      }
      configToTest = {
        host: testConfig.host,
        port: Number(testConfig.port),
        secure: testConfig.secure,
        user: testConfig.user,
        password: password || "",
        fromName: testConfig.fromName,
        fromEmail: testConfig.fromEmail || testConfig.user,
      };
    }

    const result = await sendTestEmail(testRecipient, configToTest);
    return result;
  } catch (error: any) {
    return { success: false, message: error.message || "Test email execution failed." };
  }
}

// ─────────────────────────────────────────────────────────────
// EMAIL TEMPLATES MANAGEMENT ACTIONS
// ─────────────────────────────────────────────────────────────

export async function getEmailTemplatesAction() {
  try {
    // Ensure all default templates exist
    for (const tmpl of DEFAULT_EMAIL_TEMPLATES) {
      await db.emailTemplate.upsert({
        where: { eventKey: tmpl.eventKey },
        update: {},
        create: {
          eventKey: tmpl.eventKey,
          title: tmpl.title,
          description: tmpl.description,
          subject: tmpl.subject,
          bodyHtml: tmpl.bodyHtml,
          isEnabled: true,
          placeholders: tmpl.placeholders,
        },
      });
    }

    const templates = await db.emailTemplate.findMany({
      orderBy: { id: "asc" },
    });

    return JSON.parse(JSON.stringify(templates));
  } catch (error) {
    console.error("getEmailTemplatesAction error:", error);
    return [];
  }
}

export async function updateEmailTemplateAction(id: number, data: {
  subject: string;
  bodyHtml: string;
  isEnabled: boolean;
}) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser || currentUser.role !== "SUPERADMIN") {
      return { success: false, error: "Unauthorized. Superadmin privilege required." };
    }

    const updated = await db.emailTemplate.update({
      where: { id },
      data: {
        subject: data.subject,
        bodyHtml: data.bodyHtml,
        isEnabled: data.isEnabled,
      },
    });

    return { success: true, template: JSON.parse(JSON.stringify(updated)) };
  } catch (error: any) {
    console.error("updateEmailTemplateAction error:", error);
    return { success: false, error: error.message || "Failed to update email template." };
  }
}

export async function toggleEmailTemplateAction(id: number, isEnabled: boolean) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser || currentUser.role !== "SUPERADMIN") {
      return { success: false, error: "Unauthorized. Superadmin privilege required." };
    }

    const updated = await db.emailTemplate.update({
      where: { id },
      data: { isEnabled },
    });

    return { success: true, isEnabled: updated.isEnabled };
  } catch (error: any) {
    console.error("toggleEmailTemplateAction error:", error);
    return { success: false, error: error.message || "Failed to toggle template." };
  }
}


