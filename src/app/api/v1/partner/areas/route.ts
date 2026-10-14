import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPartnerApiKey } from "@/lib/partnerAuth";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/partner/areas
 * Check coverage areas, serviceable states, branches, and active engineer regions for the authenticated partner.
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
    // 1. Fetch tickets assigned to this partner to aggregate coverage areas
    const tickets = await db.ticket.findMany({
      where: { partnerId: auth.partnerId },
      select: {
        id: true,
        state: true,
        status: true,
        clientSiteName: true,
        address: true,
        siteId: true,
        site: {
          select: { id: true, name: true, group: true, state: true, address: true },
        },
      },
    });

    // 2. Fetch partner's registered field engineers and their designated coverage regions
    const engineers = await db.fieldEngineer.findMany({
      where: { partnerId: auth.partnerId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        region: true,
        country: true,
      },
    });

    // 3. Aggregate state statistics
    const stateMap: Record<string, { state: string; totalTickets: number; activeTickets: number; sites: Set<string> }> = {};
    const activeStatuses = ["NEW", "IN_PROGRESS", "ON_HOLD", "FOLLOW_UP"];

    // Distinct customer sites list
    const sitesMap: Record<string, { id: number | null; name: string; group?: string; state: string; address?: string | null }> = {};

    for (const t of tickets) {
      const stateName = (t.state || t.site?.state || "Unassigned").trim();
      if (!stateMap[stateName]) {
        stateMap[stateName] = {
          state: stateName,
          totalTickets: 0,
          activeTickets: 0,
          sites: new Set(),
        };
      }

      stateMap[stateName].totalTickets += 1;
      if (activeStatuses.includes(t.status)) {
        stateMap[stateName].activeTickets += 1;
      }

      const siteTitle = t.clientSiteName || t.site?.name;
      if (siteTitle) {
        stateMap[stateName].sites.add(siteTitle);
        const siteKey = `${siteTitle}_${stateName}`;
        if (!sitesMap[siteKey]) {
          sitesMap[siteKey] = {
            id: t.siteId || t.site?.id || null,
            name: siteTitle,
            group: t.site?.group,
            state: stateName,
            address: t.address || t.site?.address || null,
          };
        }
      }
    }

    const stateList = Object.values(stateMap).map((s) => ({
      state: s.state,
      totalTickets: s.totalTickets,
      activeTickets: s.activeTickets,
      distinctSitesCount: s.sites.size,
    })).sort((a, b) => b.activeTickets - a.activeTickets || a.state.localeCompare(b.state));

    const siteList = Object.values(sitesMap).slice(0, 100);

    const activeTicketsTotal = tickets.filter((t) => activeStatuses.includes(t.status)).length;

    const durationMs = Date.now() - startTime;

    // Log request to PartnerSyncLog
    (db as any).partnerSyncLog.create({
      data: {
        partnerId: auth.partnerId,
        direction: "INBOUND_API",
        endpoint: "/api/v1/partner/areas",
        action: "GET /areas",
        requestPayload: {},
        responseStatus: 200,
        responseBody: `Returned ${stateList.length} states, ${siteList.length} sites, ${engineers.length} engineers`,
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
      summary: {
        coveredStatesCount: stateList.length,
        totalSitesCount: Object.keys(sitesMap).length,
        registeredEngineersCount: engineers.length,
        activeTicketsCount: activeTicketsTotal,
        totalTicketsCount: tickets.length,
      },
      states: stateList,
      engineers: engineers.map((e) => ({
        id: e.id,
        name: e.name,
        phone: e.phone,
        email: e.email,
        regionCoverage: e.region || "All Assigned",
      })),
      sites: siteList,
    });
  } catch (error: any) {
    console.error("GET /api/v1/partner/areas error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
