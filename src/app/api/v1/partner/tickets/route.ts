import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPartnerApiKey } from "@/lib/partnerAuth";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/partner/tickets
 * Pull/sync JPJ tickets assigned to the authenticated partner agency.
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const auth = await verifyPartnerApiKey(req);

  if (!auth) {
    return NextResponse.json(
      { success: false, error: "Unauthorized. Missing or invalid Bearer API key." },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const since = searchParams.get("since");
    const endCustomer = searchParams.get("endCustomer"); // Optional agency filter (e.g. JPJ, RELA, KWSP)
    const mainconId = searchParams.get("mainconId") || searchParams.get("clientId"); // Optional client filter
    const stateParam = searchParams.get("state") || searchParams.get("area"); // Optional coverage state filter (e.g. Selangor, Perak)
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50", 10), 1), 100);
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const skip = (page - 1) * limit;

    const where: any = {
      partnerId: auth.partnerId,
    };

    if (endCustomer && endCustomer !== "ALL") {
      where.endCustomer = { contains: endCustomer.trim(), mode: "insensitive" };
    }

    if (mainconId && mainconId !== "ALL") {
      const parsedMaincon = parseInt(mainconId, 10);
      if (!isNaN(parsedMaincon)) {
        where.mainconId = parsedMaincon;
      }
    }

    if (stateParam && stateParam !== "ALL") {
      where.state = { contains: stateParam.trim(), mode: "insensitive" };
    }

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (since) {
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate.getTime())) {
        where.updatedAt = { gte: sinceDate };
      }
    }

    const [tickets, totalCount] = await Promise.all([
      db.ticket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: "desc" },
        include: {
          maincon: {
            select: { id: true, name: true },
          },
          assignedFe: {
            select: { id: true, name: true, phone: true, email: true },
          },
          device: {
            select: { id: true, category: true, brand: true, model: true, isStandard: true },
          },
          site: {
            select: { id: true, name: true, group: true, state: true, address: true },
          },
        },
      }),
      db.ticket.count({ where }),
    ]);

    // Format output payload for the partner
    const formattedTickets = tickets.map((t) => ({
      id: t.id,
      ticketRefNo: t.ticketRefNo,
      externalTicketRef: t.externalTicketRef,
      subject: t.subject,
      issueDescription: t.issueDescription,
      status: t.status,
      subStatus: t.subStatus,
      severity: t.severity,
      slaDeadline: t.slaDeadline,
      slaPaused: t.slaPaused,
      slaPausedAt: t.slaPausedAt,
      eta: t.eta,
      feAcknowledgeStatus: t.feAcknowledgeStatus,
      feAcknowledgedAt: t.feAcknowledgedAt,
      clientSiteName: t.clientSiteName,
      state: t.state,
      address: t.address || t.site?.address || null,
      endCustomer: t.endCustomer,
      representAs: t.representAs,
      onSiteSop: t.onSiteSop,
      reportedAt: t.reportedAt,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      resolvedAt: t.resolvedAt,
      resolutionDetails: t.resolutionDetails,
      defectiveSerial: t.defectiveSerial,
      serviceReportUrl: t.serviceReportUrl,
      referenceAttachments: t.referenceAttachments,
      maincon: t.maincon,
      assignedEngineer: t.assignedFe
        ? {
            id: t.assignedFe.id,
            name: t.assignedFe.name,
            phone: t.assignedFe.phone,
            email: t.assignedFe.email,
          }
        : null,
      device: t.device,
      customValues: t.customValues,
    }));

    const durationMs = Date.now() - startTime;

    // Async sync log
    (db as any).partnerSyncLog.create({
      data: {
        partnerId: auth.partnerId,
        direction: "INBOUND_API",
        endpoint: "/api/v1/partner/tickets",
        action: "GET /tickets",
        requestPayload: { status, since, limit, page, endCustomer, state: stateParam },
        responseStatus: 200,
        responseBody: `Returned ${formattedTickets.length} tickets (Total: ${totalCount})`,
        durationMs,
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      partner: {
        id: auth.partnerId,
        name: auth.partnerName,
        env: auth.env,
      },
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
      count: formattedTickets.length,
      tickets: formattedTickets,
    });
  } catch (error: any) {
    console.error("GET /api/v1/partner/tickets error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
