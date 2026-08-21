"use client";

import React, { useMemo, useState } from "react";
import { Ticket, Maincon, ServicePartner, DeviceCatalog, CustomerSla } from "./Dashboard";
import { useAuth } from "./AuthProvider";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart3, CheckCircle2, Clock, AlertTriangle, Building2, MapPin, Activity, ShieldAlert } from "lucide-react";

interface AnalyticsDashboardTabProps {
  tickets: Ticket[];
  maincons: Maincon[];
  partners: ServicePartner[];
  devices: DeviceCatalog[];
  slas: CustomerSla[];
}

export default function AnalyticsDashboardTab({
  tickets,
  maincons,
  partners,
  devices,
  slas,
}: AnalyticsDashboardTabProps) {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState<"all" | "30d" | "7d" | "today">("all");
  const [mainconFilter, setMainconFilter] = useState<string>("all");

  // Filter tickets by time range and maincon
  const filteredTickets = useMemo(() => {
    const now = new Date().getTime();
    return tickets.filter((t) => {
      // Maincon filter
      if (mainconFilter !== "all" && String(t.mainconId) !== mainconFilter) {
        return false;
      }

      // Time filter
      if (timeRange === "all") return true;
      const createdTime = new Date(t.createdAt).getTime();
      const diffHours = (now - createdTime) / (1000 * 60 * 60);

      if (timeRange === "today") return diffHours <= 24;
      if (timeRange === "7d") return diffHours <= 24 * 7;
      if (timeRange === "30d") return diffHours <= 24 * 30;
      return true;
    });
  }, [tickets, timeRange, mainconFilter]);

  // Compute Core Metrics
  const metrics = useMemo(() => {
    const total = filteredTickets.length;
    let newCount = 0;
    let inProgressCount = 0;
    let onHoldCount = 0;
    let followUpCount = 0;
    let resolvedCount = 0;
    let completeCount = 0;
    let closedCount = 0;

    let p1Count = 0;
    let p2Count = 0;
    let p3Count = 0;
    let p4Count = 0;

    let slaBreachedCount = 0;
    let slaAtRiskCount = 0; // < 2 hours remaining
    let slaOnTrackCount = 0;
    let totalResolvedDurationHours = 0;
    let resolvedWithDurationCount = 0;

    const now = new Date().getTime();

    filteredTickets.forEach((t) => {
      // Status
      if (t.status === "NEW") newCount++;
      else if (t.status === "IN_PROGRESS") inProgressCount++;
      else if (t.status === "ON_HOLD") onHoldCount++;
      else if (t.status === "FOLLOW_UP") followUpCount++;
      else if (t.status === "RESOLVED") resolvedCount++;
      else if (t.status === "COMPLETE") completeCount++;
      else if (t.status === "CLOSED") closedCount++;

      // Priority
      if (t.severity === "P1") p1Count++;
      else if (t.severity === "P2") p2Count++;
      else if (t.severity === "P3") p3Count++;
      else if (t.severity === "P4") p4Count++;

      // SLA Tracking
      if (t.slaDeadline) {
        const deadline = new Date(t.slaDeadline).getTime();
        const isFinished = ["RESOLVED", "COMPLETE", "CLOSED"].includes(t.status);

        if (isFinished) {
          const finishTime = t.resolvedAt ? new Date(t.resolvedAt).getTime() : new Date(t.createdAt).getTime();
          if (finishTime > deadline) {
            slaBreachedCount++;
          } else {
            slaOnTrackCount++;
          }
        } else {
          // Ongoing
          if (t.slaPaused) {
            // Paused
          } else if (now > deadline) {
            slaBreachedCount++;
          } else if (deadline - now <= 2 * 60 * 60 * 1000) {
            slaAtRiskCount++;
          } else {
            slaOnTrackCount++;
          }
        }
      }

      // Resolution Time
      if (t.resolvedAt) {
        const start = new Date(t.reportedAt || t.createdAt).getTime();
        const end = new Date(t.resolvedAt).getTime();
        const durationH = (end - start) / (1000 * 60 * 60);
        if (durationH > 0) {
          totalResolvedDurationHours += durationH;
          resolvedWithDurationCount++;
        }
      }
    });

    const activeTotal = newCount + inProgressCount + onHoldCount + followUpCount;
    const closedTotal = resolvedCount + completeCount + closedCount;
    const trackedSlaTotal = slaBreachedCount + slaOnTrackCount + slaAtRiskCount;
    const slaComplianceRate = trackedSlaTotal > 0
      ? Math.round(((trackedSlaTotal - slaBreachedCount) / trackedSlaTotal) * 100)
      : 100;
    const avgResolutionHours = resolvedWithDurationCount > 0
      ? (totalResolvedDurationHours / resolvedWithDurationCount).toFixed(1)
      : "N/A";

    return {
      total,
      activeTotal,
      closedTotal,
      newCount,
      inProgressCount,
      onHoldCount,
      followUpCount,
      resolvedCount,
      completeCount,
      closedCount,
      p1Count,
      p2Count,
      p3Count,
      p4Count,
      slaBreachedCount,
      slaAtRiskCount,
      slaOnTrackCount,
      slaComplianceRate,
      avgResolutionHours,
    };
  }, [filteredTickets]);

  // Breakdown by Maincon
  const mainconBreakdown = useMemo(() => {
    const counts: Record<number, { name: string; count: number; active: number; closed: number }> = {};
    maincons.forEach((m) => {
      counts[m.id] = { name: m.name, count: 0, active: 0, closed: 0 };
    });

    filteredTickets.forEach((t) => {
      if (counts[t.mainconId]) {
        counts[t.mainconId].count++;
        if (["RESOLVED", "COMPLETE", "CLOSED"].includes(t.status)) {
          counts[t.mainconId].closed++;
        } else {
          counts[t.mainconId].active++;
        }
      }
    });

    return Object.values(counts)
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [filteredTickets, maincons]);

  // Breakdown by Service Partner
  const partnerBreakdown = useMemo(() => {
    const counts: Record<number, { name: string; count: number; active: number; closed: number }> = {};
    partners.forEach((p) => {
      counts[p.id] = { name: p.name, count: 0, active: 0, closed: 0 };
    });

    filteredTickets.forEach((t) => {
      if (t.partnerId && counts[t.partnerId]) {
        counts[t.partnerId].count++;
        if (["RESOLVED", "COMPLETE", "CLOSED"].includes(t.status)) {
          counts[t.partnerId].closed++;
        } else {
          counts[t.partnerId].active++;
        }
      }
    });

    return Object.values(counts)
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [filteredTickets, partners]);

  // Breakdown by State
  const stateBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredTickets.forEach((t) => {
      const state = t.state || "Unknown";
      counts[state] = (counts[state] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([state, count]) => ({ state, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredTickets]);

  return (
    <div className="space-y-6">
      {/* Header & Global Filters */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Performance & SLA Analytics</CardTitle>
            </div>
            <CardDescription className="text-xs mt-1">
              Operational KPIs, SLA compliance rates, and partner dispatch workload across {filteredTickets.length} tickets.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Time Range Filter Buttons */}
            <div className="inline-flex rounded-lg bg-muted p-1 text-xs">
              {(["all", "30d", "7d", "today"] as const).map((r) => (
                <Button
                  key={r}
                  variant={timeRange === r ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setTimeRange(r)}
                  className="h-7 px-3 text-xs font-medium"
                >
                  {r === "all" ? "All Time" : r === "30d" ? "Past 30 Days" : r === "7d" ? "Past 7 Days" : "Today"}
                </Button>
              ))}
            </div>

            {/* Maincon Selector */}
            <select
              value={mainconFilter}
              onChange={(e) => setMainconFilter(e.target.value)}
              className="h-9 px-3 bg-background border rounded-md text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary font-medium"
            >
              <option value="all">All Clients (Maincons)</option>
              {maincons.map((m) => (
                <option key={m.id} value={String(m.id)}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
      </Card>

      {/* Top 4 Hero Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tickets */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">Total Volume</span>
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-foreground tracking-tight">{metrics.total}</span>
              <span className="text-[11px] text-muted-foreground font-medium">tickets</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground pt-2 border-t">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{metrics.closedTotal} Resolved</span>
              <span>•</span>
              <span className="font-semibold text-amber-600 dark:text-amber-400">{metrics.activeTotal} Open</span>
            </div>
          </CardContent>
        </Card>

        {/* SLA Compliance Rate */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">SLA Compliance Rate</span>
              <CheckCircle2 className={`h-4 w-4 ${metrics.slaComplianceRate >= 90 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-500"}`} />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className={`text-3xl font-black tracking-tight ${metrics.slaComplianceRate >= 90 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-500"}`}>
                {metrics.slaComplianceRate}%
              </span>
              <span className="text-[11px] text-muted-foreground font-medium">met target</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground pt-2 border-t">
              <span className="font-semibold text-destructive">{metrics.slaBreachedCount} Breached</span>
              <span>•</span>
              <span className="font-semibold text-amber-600 dark:text-amber-400">{metrics.slaAtRiskCount} At Risk (&lt;2h)</span>
            </div>
          </CardContent>
        </Card>

        {/* Active Open Queue */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">Active Work Queue</span>
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-amber-600 dark:text-amber-400 tracking-tight">{metrics.activeTotal}</span>
              <span className="text-[11px] text-muted-foreground font-medium">requiring action</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground pt-2 border-t">
              <span>{metrics.newCount} New</span>
              <span>•</span>
              <span>{metrics.inProgressCount} Active</span>
              <span>•</span>
              <span>{metrics.onHoldCount} Hold</span>
            </div>
          </CardContent>
        </Card>

        {/* Avg Resolution Duration */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">Avg Turnaround Time</span>
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-primary tracking-tight">{metrics.avgResolutionHours}</span>
              <span className="text-[11px] text-muted-foreground font-medium">hours / ticket</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground pt-2 border-t">
              <span className="font-semibold text-foreground">{partners.length} Partners</span>
              <span>•</span>
              <span className="font-semibold text-foreground">{maincons.length} Clients</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Status Breakdown & Priority Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Distribution */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Status Distribution</span>
              <Badge variant="outline" className="text-[10px] font-normal">{filteredTickets.length} Total</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {[
              { label: "New (Unacknowledged)", count: metrics.newCount, color: "bg-blue-500" },
              { label: "In Progress", count: metrics.inProgressCount, color: "bg-amber-500" },
              { label: "On Hold (SLA Paused)", count: metrics.onHoldCount, color: "bg-purple-500" },
              { label: "Follow Up", count: metrics.followUpCount, color: "bg-orange-500" },
              { label: "Resolved", count: metrics.resolvedCount, color: "bg-emerald-500" },
              { label: "Closed / Completed", count: metrics.closedCount + metrics.completeCount, color: "bg-slate-500" },
            ].map((item) => {
              const pct = metrics.total > 0 ? Math.round((item.count / metrics.total) * 100) : 0;
              return (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{item.label}</span>
                    <span className="font-bold text-muted-foreground">
                      {item.count} <span className="font-normal text-[10px]">({pct}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Priority Severity Breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Severity & Urgency</span>
              <Badge variant="outline" className="text-[10px] font-normal">SLA Priorities</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-lg border border-destructive/20 bg-destructive/5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-destructive block">P1 - Critical</span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-2xl font-black text-destructive">{metrics.p1Count}</span>
                  <span className="text-[10px] text-muted-foreground">tickets</span>
                </div>
              </div>
              <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block">P2 - High</span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-2xl font-black text-amber-600 dark:text-amber-400">{metrics.p2Count}</span>
                  <span className="text-[10px] text-muted-foreground">tickets</span>
                </div>
              </div>
              <div className="p-3 rounded-lg border border-blue-500/20 bg-blue-500/5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 block">P3 - Medium</span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{metrics.p3Count}</span>
                  <span className="text-[10px] text-muted-foreground">tickets</span>
                </div>
              </div>
              <div className="p-3 rounded-lg border border-slate-500/20 bg-slate-500/5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">P4 - Low</span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-2xl font-black text-foreground">{metrics.p4Count}</span>
                  <span className="text-[10px] text-muted-foreground">tickets</span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-muted/50 border text-xs space-y-1">
              <div className="font-semibold text-foreground flex items-center justify-between">
                <span>Configured SLA Policies</span>
                <Badge variant="secondary" className="text-[10px]">{slas.length} Rules</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Target deadlines are dynamically calculated according to regional SLA matrices and pause when awaiting parts.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Geographic / State Breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Regional Distribution</span>
              <Badge variant="outline" className="text-[10px] font-normal">{stateBreakdown.length} States</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-y-auto max-h-[260px] space-y-2 pr-1">
              {stateBreakdown.map((item, idx) => {
                const pct = metrics.total > 0 ? Math.round((item.count / metrics.total) * 100) : 0;
                return (
                  <div key={item.state} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="w-5 text-[10px] font-bold text-muted-foreground">#{idx + 1}</span>
                      <span className="font-medium text-foreground">{item.state}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">{item.count}</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {pct}%
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Main Contractor & Service Partner Workload Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Main Contractors Breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Client (Main Contractor) Workload</span>
              <Badge variant="outline" className="text-[10px] font-normal">{mainconBreakdown.length} Active Clients</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Maincon Client</TableHead>
                    <TableHead className="text-center">Open</TableHead>
                    <TableHead className="text-center">Resolved</TableHead>
                    <TableHead className="text-right">Total Tickets</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mainconBreakdown.map((m) => (
                    <TableRow key={m.name}>
                      <TableCell className="font-medium text-xs">{m.name}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="text-amber-600 dark:text-amber-400 bg-amber-500/10 text-[10px]">
                          {m.active}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-[10px]">
                          {m.closed}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-xs">{m.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Service Partner Dispatch Distribution */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Service Partner Assignment</span>
              <Badge variant="outline" className="text-[10px] font-normal">{partnerBreakdown.length} Active Partners</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service Partner</TableHead>
                    <TableHead className="text-center">Active</TableHead>
                    <TableHead className="text-center">Completed</TableHead>
                    <TableHead className="text-right">Total Assigned</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partnerBreakdown.map((p) => (
                    <TableRow key={p.name}>
                      <TableCell className="font-medium text-xs">{p.name}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="text-amber-600 dark:text-amber-400 bg-amber-500/10 text-[10px]">
                          {p.active}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-[10px]">
                          {p.closed}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-xs">{p.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
