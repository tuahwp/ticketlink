"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { Severity, UserRole } from "../generated/prisma/client";

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
  revalidatePath("/");
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
  revalidatePath("/");
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
  revalidatePath("/");
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
  revalidatePath("/");
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

  revalidatePath("/");
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
  revalidatePath("/");
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
  revalidatePath("/");
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

  revalidatePath("/");
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
  revalidatePath("/");
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
  revalidatePath("/");
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
    const duplicate = await db.ticket.findFirst({
      where: { ticketRefNo: refNo }
    });
    if (duplicate) {
      throw new Error(`Ticket Reference Number "${refNo}" already exists and cannot be duplicated.`);
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

  revalidatePath("/");
  return ticket;
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

  revalidatePath("/");
  return ticket;
}

export async function deleteTicket(id: number) {
  const deleted = await db.ticket.delete({
    where: { id },
  });
  revalidatePath("/");
  return deleted;
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

  revalidatePath("/");
  return updatedTicket;
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

  revalidatePath("/");
  return ticket;
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

  revalidatePath("/");
  return ticket;
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

  revalidatePath("/");
  return ticket;
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

  revalidatePath("/");
  return ticket;
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

  revalidatePath("/");
  return activity;
}

export async function getTicketById(ticketId: number) {
  return await db.ticket.findUnique({
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
  revalidatePath("/");
  return site;
}



export async function deleteDeviceCatalogItem(id: number) {
  const item = await db.deviceCatalog.delete({
    where: { id: Number(id) },
  });
  revalidatePath("/");
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
  revalidatePath("/");
  return sla;
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
  revalidatePath("/");
  return sla;
}

export async function deleteCustomerSla(id: number) {
  const deleted = await db.customerSla.delete({
    where: { id },
  });
  revalidatePath("/");
  return deleted;
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
  revalidatePath("/");
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

  revalidatePath("/");
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

  revalidatePath("/");
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

  revalidatePath("/");
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

  revalidatePath("/");
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
  revalidatePath("/");
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
  revalidatePath("/");
  return updatedPartner;
}

export async function createRegistrationCode(data: {
  partnerId: number;
  role: "AGENT" | "FIELD_ENGINEER";
  maxUses?: number;
}) {
  const code = Math.random().toString(36).substring(2, 10).toUpperCase();

  const created = await db.registrationCode.create({
    data: {
      code,
      role: data.role,
      partnerId: data.partnerId,
      maxUses: data.maxUses ?? 1,
    },
  });

  revalidatePath("/");
  return created;
}

export async function getRegistrationCodes(partnerId?: number) {
  return await db.registrationCode.findMany({
    where: partnerId ? { partnerId } : undefined,
    include: {
      partner: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function deleteRegistrationCode(id: number) {
  const deleted = await db.registrationCode.delete({
    where: { id },
  });
  revalidatePath("/");
  return deleted;
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
  return await db.user.findMany({
    where: {
      role: "AGENT",
      partnerId,
    },
    orderBy: { name: "asc" },
  });
}

export async function removePartnerAgentAction(userId: string) {
  const updated = await db.user.update({
    where: { id: userId },
    data: {
      role: "FIELD_ENGINEER",
      partnerId: null,
    },
  });
  revalidatePath("/");
  return updated;
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
  
  return await db.fieldEngineer.findMany({
    where: {
      partnerId: me.engineer.partnerId,
      NOT: { id: me.engineer.id }
    },
    orderBy: { name: "asc" }
  });
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

  revalidatePath("/");
  return ticket;
}




