"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Severity } from "../../generated/prisma/client";

function safeParseJson<T>(val: unknown, fallback: T): T {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "string") {
    try {
      return JSON.parse(val) as T;
    } catch {
      return fallback;
    }
  }
  return val as T;
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

export async function createTicketAction(formData: FormData) {
  let isSuccess = false;
  try {
    const clientSiteName = formData.get("clientSiteName") as string;
    const issueDescription = formData.get("issueDescription") as string;
    const state = formData.get("state") as string;
    const mainconIdRaw = formData.get("mainconId");
    
    if (!clientSiteName || !state || !mainconIdRaw) {
      throw new Error("Missing required core fields: Client Site Name, State, or Main Contractor");
    }

    const mainconId = Number(mainconIdRaw);
    if (isNaN(mainconId)) {
      throw new Error("Invalid Main Contractor ID");
    }

    // Additional fields
    const autoRefNo = formData.get("autoRefNo") === "true";
    const ticketRefNo = formData.get("ticketRefNo") as string;
    const endCustomer = (formData.get("endCustomer") as string) || null;
    
    const partnerIdRaw = formData.get("partnerId");
    const partnerId = partnerIdRaw ? Number(partnerIdRaw) : null;

    const assignedFeIdRaw = formData.get("assignedFeId");
    const assignedFeId = assignedFeIdRaw ? Number(assignedFeIdRaw) : null;

    const deviceIdRaw = formData.get("deviceId");
    const deviceId = deviceIdRaw ? Number(deviceIdRaw) : null;

    const deviceStatus = (formData.get("deviceStatus") as "STANDARD" | "ON_REQUEST") || null;
    const customDeviceDetails = (formData.get("customDeviceDetails") as string) || null;
    
    const slaDeadlineRaw = formData.get("slaDeadline") as string;
    const slaDeadline = slaDeadlineRaw ? new Date(slaDeadlineRaw) : null;

    const reportedAtRaw = formData.get("reportedAt") as string;
    const reportedAt = reportedAtRaw ? new Date(reportedAtRaw) : new Date();

    const siteIdRaw = formData.get("siteId");
    const siteId = siteIdRaw ? Number(siteIdRaw) : null;

    const severity = (formData.get("severity") as "P1" | "P2" | "P3" | "P4") || null;

    // Custom Contractor Fields
    const maincon = await db.maincon.findUnique({
      where: { id: mainconId }
    });
    if (!maincon) {
      throw new Error(`Main Contractor with ID ${mainconId} not found.`);
    }

    const customFieldsSchema = safeParseJson<string[]>(maincon.customFieldsSchema, []);
    const customValues: Record<string, string> = {};
    for (const field of customFieldsSchema) {
      customValues[field] = (formData.get(`custom_${field}`) as string) || "";
    }

    // Unique reference number generation & verification
    let refNo = ticketRefNo ? ticketRefNo.trim() : "";
    if (autoRefNo || !refNo) {
      refNo = await generateUniqueRefNo();
    } else {
      const duplicate = await db.ticket.findFirst({
        where: { ticketRefNo: refNo }
      });
      if (duplicate) {
        throw new Error(`Ticket Reference Number "${refNo}" already exists and cannot be duplicated.`);
      }
    }

    // Create the ticket in database
    await db.ticket.create({
      data: {
        ticketRefNo: refNo,
        clientSiteName,
        state,
        issueDescription,
        status: "NEW", // default status
        mainconId,
        customValues,
        partnerId: partnerId || null,
        assignedFeId: assignedFeId || null,
        deviceId: deviceId || null,
        deviceStatus: deviceStatus || null,
        customDeviceDetails: customDeviceDetails || null,
        slaDeadline: slaDeadline || null,
        endCustomer: endCustomer || null,
        reportedAt: reportedAt || new Date(),
        siteId: siteId || null,
        severity: (severity as Severity) || null,
      },
    });

    isSuccess = true;
  } catch (error) {
    console.error("Error creating ticket:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred while creating the ticket."
    };
  }

  if (isSuccess) {
    revalidatePath("/dashboard");
    revalidatePath("/");
    return { success: true };
  }
}
