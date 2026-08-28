"use server";

import { db } from "@/lib/db";
// revalidatePath removed - caused React #441 in production
import { Severity, UserRole, InventoryStatus, SparePartRequestStatus } from "../generated/prisma/client";

export async function getStates() {
  try {
    const dbStates = await db.state.findMany({
      orderBy: { name: "asc" },
    });
    if (dbStates && dbStates.length > 0) {
      return dbStates;
    }
  } catch (err) {
    console.error("Error fetching states from database, using fallback:", err);
  }

  // Fallback static list of Malaysian states if DB has none or query fails
  const fallbackStates = [
    "Johor",
    "Kedah",
    "Kelantan",
    "Kuala Lumpur",
    "Labuan",
    "Malacca",
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
}

export async function createMaincon(data: {
  name: string;
  sheetName: string;
  customFieldsSchema: string[];
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
  customFieldsSchema: string[];
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
}) {
  const partner = await db.servicePartner.create({
    data: {
      name: data.name,
      statesCovered: data.statesCovered,
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
  }
) {
  const partner = await db.servicePartner.update({
    where: { id },
    data: {
      name: data.name,
      statesCovered: data.statesCovered,
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
  siteId?: number;
  severity?: "P1" | "P2" | "P3" | "P4" | null;
}) {
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
    },
  });

  // Log creation in activities
  await db.ticketActivity.create({
    data: {
      ticketId: ticket.id,
      type: "STATUS_CHANGE",
      status: "NEW",
      notes: "Ticket created in system.",
      author: "System"
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
    status?: "NEW" | "IN_PROGRESS" | "ON_HOLD" | "RESOLVED" | "FOLLOW_UP" | "COMPLETE" | "CLOSED";
    subStatus?: string | null;
    slaDeadline?: Date | null;
    resolutionDetails?: string | null;
    resolvedAt?: Date | null;
    endCustomer?: string | null;
    reportedAt?: Date | null;
    siteId?: number | null;
    severity?: "P1" | "P2" | "P3" | "P4" | null;
    eta?: Date | null;
    holdReason?: string | null;
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
  status: "NEW" | "IN_PROGRESS" | "ON_HOLD" | "RESOLVED" | "FOLLOW_UP" | "COMPLETE" | "CLOSED",
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
  const isPausingStatus = (status === "ON_HOLD" || (status === "FOLLOW_UP" && subStatus === "PENDING_PARTS"));

  let slaPaused = wasPaused;
  let slaPausedAt = ticketBefore.slaPausedAt;
  let totalPausedMs = ticketBefore.totalPausedMs;
  let slaDeadline = ticketBefore.slaDeadline;

  // Track transitions
  let slaActionType: string | null = null;
  if (!wasPaused && isPausingStatus) {
    // Transitioning to Paused
    slaPaused = true;
    slaPausedAt = new Date();
    slaActionType = "SLA_PAUSE";
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
      eta: (status === "RESOLVED" || status === "COMPLETE" || status === "ON_HOLD" || status === "FOLLOW_UP" || status === "CLOSED") ? null : undefined,
      slaPaused,
      slaPausedAt,
      totalPausedMs,
      slaDeadline,
      holdReason: status === "ON_HOLD" ? (notes || subStatus || "On Hold") : null,
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
  severity: "P1" | "P2" | "P3" | "P4";
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
    severity: "P1" | "P2" | "P3" | "P4";
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
  const user = await db.user.findUnique({
    where: { id: supabaseId },
    include: {
      partner: true,
      engineer: true,
    },
  });

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
    companyPhotoUrl?: string | null;
  }
) {
  const updatedPartner = await db.servicePartner.update({
    where: { id: partnerId },
    data: {
      name: data.name,
      phone: data.phone,
      address: data.address,
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
}) {
  const items = await db.inventoryItem.findMany({
    where: {
      ...(filters?.warehouseId ? { warehouseId: Number(filters.warehouseId) } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.category ? { category: filters.category } : {}),
      ...(filters?.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: "insensitive" } },
              { serialNumber: { contains: filters.search, mode: "insensitive" } },
              { partNumber: { contains: filters.search, mode: "insensitive" } },
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
      ticketAllocations: {
        include: {
          ticket: {
            select: {
              id: true,
              ticketRefNo: true,
              clientSiteName: true,
              status: true,
              subStatus: true,
            }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      logs: {
        orderBy: { createdAt: "desc" },
        take: 5,
      }
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
  });
  return JSON.parse(JSON.stringify(items));
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
  serialNumber: string;
  warehouseId: number;
  status?: InventoryStatus;
  isLoaner?: boolean;
  supplier?: string;
  notes?: string;
  author?: string;
}) {
  const cleanSerial = data.serialNumber.trim().toUpperCase();
  const existing = await db.inventoryItem.findUnique({
    where: { serialNumber: cleanSerial }
  });
  if (existing) {
    throw new Error(`An inventory item with Serial Number "${cleanSerial}" already exists.`);
  }

  const item = await db.inventoryItem.create({
    data: {
      name: data.name.trim(),
      partNumber: data.partNumber?.trim() || null,
      category: data.category.trim(),
      serialNumber: cleanSerial,
      warehouseId: Number(data.warehouseId),
      status: data.status || "AVAILABLE",
      isLoaner: Boolean(data.isLoaner),
      supplier: data.supplier?.trim() || null,
      notes: data.notes?.trim() || null,
      logs: {
        create: {
          action: "CREATED",
          notes: `${data.isLoaner ? "Standby Loaner Unit" : "Item"} registered into inventory. Initial status: ${data.status || "AVAILABLE"}.`,
          author: data.author || "System",
        }
      }
    },
    include: {
      warehouse: true,
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
      ...(cleanSerial ? { serialNumber: cleanSerial } : {}),
      ...(data.warehouseId !== undefined ? { warehouseId: Number(data.warehouseId) } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.isLoaner !== undefined ? { isLoaner: Boolean(data.isLoaner) } : {}),
      ...(data.supplier !== undefined ? { supplier: data.supplier?.trim() || null } : {}),
      ...(data.notes !== undefined ? { notes: data.notes?.trim() || null } : {}),
      ...(logsToCreate.length > 0 ? { logs: { create: logsToCreate } } : {})
    },
    include: {
      warehouse: true,
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
  if (item.status !== "AVAILABLE" && item.status !== "RESERVED") {
    throw new Error(`Selected item is not available (Current status: ${item.status})`);
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

  await db.inventoryItem.update({
    where: { id: Number(data.inventoryItemId) },
    data: {
      status: itemStatus,
      logs: {
        create: {
          action: isDispatch ? "DISPATCHED" : "ALLOCATED",
          notes: `${isDispatch ? "Dispatched" : "Allocated"} for Ticket #${updatedPart.ticket.ticketRefNo || updatedPart.ticket.id} (${updatedPart.ticket.clientSiteName}). ${data.courierName ? `Courier: ${data.courierName}, Tracking: ${data.dispatchTrackingNo}` : ""}`,
          author: data.author || "System",
        }
      }
    }
  });

  await db.ticketActivity.create({
    data: {
      ticketId: updatedPart.ticketId,
      type: "COMMENT",
      notes: `Spare part ${isDispatch ? "dispatched" : "allocated"}: "${item.name}" (S/N: ${item.serialNumber}) from ${item.warehouse.name}.${data.courierName ? ` Courier: ${data.courierName} | Tracking No: ${data.dispatchTrackingNo}` : ""}`,
      author: data.author || "System",
    }
  });

  return JSON.parse(JSON.stringify(updatedPart));
}

export async function markSparePartInstalled(data: {
  ticketSparePartId: number;
  defectiveSerial?: string;
  author?: string;
}) {
  const part = await db.ticketSparePart.findUnique({
    where: { id: Number(data.ticketSparePartId) },
    include: {
      ticket: true,
      inventoryItem: {
        include: { warehouse: true }
      }
    }
  });
  if (!part) throw new Error("Ticket spare part request not found");

  const updatedPart = await db.ticketSparePart.update({
    where: { id: Number(data.ticketSparePartId) },
    data: {
      status: "INSTALLED",
      installedAt: new Date(),
      replacedDefectiveSerial: data.defectiveSerial?.trim() || null,
    }
  });

  if (part.inventoryItemId) {
    await db.inventoryItem.update({
      where: { id: part.inventoryItemId },
      data: {
        status: "INSTALLED",
        logs: {
          create: {
            action: "INSTALLED",
            notes: `Part installed on site for Ticket #${part.ticket.ticketRefNo || part.ticket.id}.${data.defectiveSerial ? ` Replaced defective S/N: ${data.defectiveSerial}` : ""}`,
            author: data.author || "Field Engineer",
          }
        }
      }
    });
  }

  // If defective serial was logged and provided, register it in inventory as DEFECTIVE_PENDING_RETURN
  if (data.defectiveSerial?.trim() && part.inventoryItem) {
    const cleanDefectiveSerial = data.defectiveSerial.trim().toUpperCase();
    const existing = await db.inventoryItem.findUnique({
      where: { serialNumber: cleanDefectiveSerial }
    });
    if (!existing) {
      await db.inventoryItem.create({
        data: {
          name: `[Defective] ${part.inventoryItem.name}`,
          partNumber: part.inventoryItem.partNumber,
          category: part.inventoryItem.category,
          serialNumber: cleanDefectiveSerial,
          warehouseId: part.inventoryItem.warehouseId,
          status: "DEFECTIVE_PENDING_RETURN",
          notes: `Defective unit swapped on site for Ticket #${part.ticket.ticketRefNo || part.ticket.id}. Replacement S/N: ${part.inventoryItem.serialNumber}`,
          logs: {
            create: {
              action: "DEFECTIVE_LOGGED",
              notes: `Defective part registered from Ticket #${part.ticket.ticketRefNo || part.ticket.id}. Pending return to depot.`,
              author: data.author || "Field Engineer",
            }
          }
        }
      });
    }
  }

  await db.ticketActivity.create({
    data: {
      ticketId: part.ticketId,
      type: "COMMENT",
      notes: `Spare part "${part.inventoryItem?.name || part.requestedPartName}" marked as INSTALLED.${data.defectiveSerial ? ` Replaced defective S/N: ${data.defectiveSerial.trim()}` : ""}`,
      author: data.author || "Field Engineer",
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

  // If item was allocated or in transit, restore to AVAILABLE
  if (part.inventoryItemId) {
    await db.inventoryItem.update({
      where: { id: part.inventoryItemId },
      data: {
        status: "AVAILABLE",
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
}

