"use client";

import React, { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import SlaCountdown from "./SlaCountdown";
import { useAuth } from "./AuthProvider";
import { supabase } from "../../lib/supabaseClient";
import {
  updateTicketStatus,
  assignServiceDetails,
  updateTicketResolution,
  acknowledgeTicket,
  updateTicketEta,
  addTicketComment,
  getTicketById,
} from "../actions";

/* ─── Shared type helpers ─── */
interface Maincon {
  id: number;
  name: string;
  sheetName: string;
  customFieldsSchema: unknown;
}

interface FieldEngineer {
  id: number;
  name: string;
  phone: string;
  partnerId: number;
  user?: {
    avatarUrl?: string | null;
  } | null;
}

interface ServicePartner {
  id: number;
  name: string;
  statesCovered: unknown;
  engineers?: FieldEngineer[];
}

interface DeviceCatalog {
  id: number;
  category: string;
  brand: string;
  model: string;
  isStandard: boolean;
}

interface TicketActivity {
  id: number;
  ticketId: number;
  type: string; // "STATUS_CHANGE", "COMMENT", "ASSIGNMENT", "ETA_UPDATE", "SLA_PAUSE", "SLA_RESUME", "FE_ACKNOWLEDGE"
  status: string | null;
  subStatus: string | null;
  notes: string | null;
  author: string;
  createdAt: Date | string;
}

interface Ticket {
  id: number;
  ticketRefNo: string | null;
  clientSiteName: string;
  state: string;
  issueDescription: string;
  status: "NEW" | "IN_PROGRESS" | "ON_HOLD" | "RESOLVED" | "FOLLOW_UP" | "COMPLETE" | "CLOSED";
  subStatus: string | null;
  slaDeadline: Date | string | null;
  mainconId: number;
  maincon?: Maincon | null;
  customValues: unknown;
  partnerId: number | null;
  partner?: ServicePartner | null;
  assignedFeId: number | null;
  assignedFe?: FieldEngineer | null;
  deviceId: number | null;
  device?: DeviceCatalog | null;
  deviceStatus: "STANDARD" | "ON_REQUEST" | null;
  customDeviceDetails: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  resolutionDetails?: string | null;
  resolvedAt?: Date | string | null;
  serviceReportUrl?: string | null;
  endCustomer: string | null;
  reportedAt: Date | string;
  siteId: number | null;
  site?: EndCustomerSite | null;
  severity: string | null;
  eta?: Date | string | null;
  slaPaused: boolean;
  slaPausedAt: Date | string | null;
  feAcknowledgeStatus?: string | null;
  defectiveSerial?: string | null;
  defectiveReturnStatus?: string | null;
  feAcknowledgedAt?: Date | string | null;
  holdReason?: string | null;
  activities?: TicketActivity[];
}

interface EndCustomerSite {
  id: number;
  name: string;
  group: string;
  state: string;
  mainconId: number;
}

interface Props {
  ticket: Ticket;
  partners: ServicePartner[];
}

function safeParseJson<T>(val: unknown, fallback: T): T {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "string") {
    try { return JSON.parse(val) as T; } catch { return fallback; }
  }
  return val as T;
}

const STATUS_CONFIG = {
  NEW: { label: "New", dot: "bg-sky-500", badge: "bg-sky-55 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/30", ring: "ring-sky-500/20 border-sky-500" },
  IN_PROGRESS: { label: "In Progress", dot: "bg-amber-500", badge: "bg-amber-55 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30", ring: "ring-amber-500/20 border-amber-500" },
  ON_HOLD: { label: "On Hold", dot: "bg-orange-500", badge: "bg-orange-55 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/30", ring: "ring-orange-500/20 border-orange-500" },
  RESOLVED: { label: "Resolved", dot: "bg-emerald-500", badge: "bg-emerald-55 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30", ring: "ring-emerald-500/20 border-emerald-500" },
  FOLLOW_UP: { label: "Follow Up", dot: "bg-fuchsia-500", badge: "bg-fuchsia-55 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-500/10 dark:text-fuchsia-400 dark:border-fuchsia-500/30", ring: "ring-fuchsia-500/20 border-fuchsia-500" },
  COMPLETE: { label: "Complete", dot: "bg-teal-500", badge: "bg-teal-55 text-teal-700 border-teal-200 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/30", ring: "ring-teal-500/20 border-teal-500" },
  CLOSED: { label: "Closed", dot: "bg-slate-500", badge: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700/40 dark:text-slate-400 dark:border-slate-600/30", ring: "ring-slate-500/20 border-slate-600" },
} as const;

function renderSlaBadge(ticket: Ticket) {
  if (!ticket.slaDeadline) return null;
  return (
    <SlaCountdown
      slaDeadline={ticket.slaDeadline}
      status={ticket.status}
      resolvedAt={ticket.resolvedAt}
      updatedAt={ticket.updatedAt}
      slaPaused={ticket.slaPaused}
      slaPausedAt={ticket.slaPausedAt}
    />
  );
}

function renderSeverityBadge(severity: string | null) {
  if (!severity) return null;
  const config: Record<string, { label: string; badge: string; dot: string }> = {
    P1: { label: "P1 Severity", badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20", dot: "bg-rose-500" },
    P2: { label: "P2 Severity", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20", dot: "bg-amber-500" },
    P3: { label: "P3 Severity", badge: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20", dot: "bg-indigo-500" },
    P4: { label: "P4 Severity", badge: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20", dot: "bg-slate-500" },
  };
  const sc = config[severity] || { label: severity, badge: "bg-slate-100 text-slate-700", dot: "bg-slate-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wider ${sc.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
      {sc.label}
    </span>
  );
}

export default function TicketWorkspace({ ticket: initialTicket, partners }: Props) {
  const router = useRouter();
  const { user } = useAuth();

  // Guard access for Agent roles
  if (user?.role === "AGENT" && initialTicket.partnerId !== user.partnerId) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 text-center">
        <div className="max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <h3 className="text-xl font-bold text-red-500 mb-2">Access Denied</h3>
          <p className="text-sm text-slate-400 mb-6">
            You do not have permission to view this ticket.
          </p>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 bg-indigo-65 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const [ticket, setTicket] = useState<Ticket>(initialTicket);

  useEffect(() => {
    setTicket(initialTicket);
  }, [initialTicket]);

  // Realtime subscription for single ticket updates
  useEffect(() => {
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!anonKey) {
      console.log("Supabase anon key is missing. Skipping real-time ticket subscription.");
      return;
    }

    const channel = supabase
      .channel(`realtime-ticket-${ticket.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "Ticket",
        },
        async (payload) => {
          const newTicket = payload.new as any;
          const oldTicket = payload.old as any;
          const targetId = newTicket?.id != null ? Number(newTicket.id) : (oldTicket?.id != null ? Number(oldTicket.id) : null);

          if (targetId === ticket.id) {
            console.log("Real-time update for ticket from Ticket table:", payload);
            if (payload.eventType === "DELETE") {
              router.push("/");
            } else {
              const updated = await getTicketById(ticket.id);
              if (updated) {
                setTicket(updated as unknown as Ticket);
              }
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "TicketActivity",
        },
        async (payload) => {
          const newActivity = payload.new as any;
          if (newActivity && newActivity.ticketId != null && Number(newActivity.ticketId) === ticket.id) {
            console.log("Real-time update for ticket from TicketActivity table:", payload);
            const updated = await getTicketById(ticket.id);
            if (updated) {
              setTicket(updated as unknown as Ticket);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticket.id, router]);

  const [isPending, startTransition] = useTransition();

  const [copied, setCopied] = useState(false);
  const [selectedTargetStatus, setSelectedTargetStatus] = useState<Ticket["status"] | null>(null);
  const [followUpSubStatus, setFollowUpSubStatus] = useState<string>(ticket.subStatus || "");
  const [resolutionNotes, setResolutionNotes] = useState<string>(ticket.resolutionDetails || "");
  
  // Custom enhanced states
  const [commentText, setCommentText] = useState("");
  const [updateAuthor, setUpdateAuthor] = useState("Admin");
  const [etaDate, setEtaDate] = useState(ticket.eta ? new Date(ticket.eta).toISOString().slice(0, 16) : "");
  const [holdReason, setHoldReason] = useState(ticket.holdReason || "");
  const [isChronologyExpanded, setIsChronologyExpanded] = useState(true);

  // Update default acting author based on assigned engineer or logged in user
  useEffect(() => {
    if (user) {
      setUpdateAuthor(user.name || user.email);
    } else if (ticket.assignedFe?.name) {
      setUpdateAuthor(ticket.assignedFe.name);
    } else {
      setUpdateAuthor("Admin");
    }
  }, [user, ticket.assignedFe]);

  const handleCopyToWhatsapp = () => {
    const slaStr = ticket.slaDeadline 
      ? new Date(ticket.slaDeadline).toLocaleString("en-MY", {
          day: "2-digit", month: "short", year: "numeric",
          hour: "2-digit", minute: "2-digit",
        })
      : "No SLA assigned";

    const text = `*🚨 TICKET DISPATCH ALERT*

*Ref No:* ${ticket.ticketRefNo || `#${ticket.id}`}
*Severity:* ${ticket.severity || "Standard"}
*Site Name:* ${ticket.clientSiteName}
*State:* ${ticket.state}

*Issue Details:* ${ticket.issueDescription}
*Hardware:* ${
      ticket.device 
        ? (ticket.deviceStatus === "ON_REQUEST" && ticket.customDeviceDetails
            ? ticket.customDeviceDetails
            : `${ticket.device.brand} ${ticket.device.model}`)
        : "Standard/None"
    }
*SLA Target:* ${slaStr}

*Partner:* ${ticket.partner?.name || "Unassigned"}
*Engineer:* ${ticket.assignedFe?.name || "Unassigned"}

_Please coordinate immediately. Thank you!_`;

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const sc = STATUS_CONFIG[ticket.status] || STATUS_CONFIG["NEW"];
  const isActive = ticket.status === "NEW" || ticket.status === "IN_PROGRESS" || ticket.status === "FOLLOW_UP";

  const handleUpdateStatus = (
    status: Ticket["status"],
    subStatus?: string | null,
    notes?: string | null
  ) => {
    startTransition(async () => {
      try {
        await updateTicketStatus(ticket.id, status, subStatus, notes, updateAuthor);
        setCommentText("");
        setHoldReason("");
        setSelectedTargetStatus(null);
        router.refresh();
      } catch (err) {
        alert("Error updating status: " + (err instanceof Error ? err.message : String(err)));
      }
    });
  };

  const handleAssignService = (partnerId?: number, assignedFeId?: number) => {
    startTransition(async () => {
      try {
        await assignServiceDetails({ ticketId: ticket.id, partnerId, assignedFeId });
        router.refresh();
      } catch (err) {
        alert("Error assigning: " + (err instanceof Error ? err.message : String(err)));
      }
    });
  };

  const handleAcknowledge = () => {
    startTransition(async () => {
      try {
        await acknowledgeTicket(ticket.id, null, updateAuthor);
        router.refresh();
      } catch (err) {
        alert("Error acknowledging ticket: " + (err instanceof Error ? err.message : String(err)));
      }
    });
  };

  const handleSaveEta = () => {
    if (!etaDate) return;
    startTransition(async () => {
      try {
        await updateTicketEta(ticket.id, new Date(etaDate), updateAuthor);
        router.refresh();
      } catch (err) {
        alert("Error setting ETA: " + (err instanceof Error ? err.message : String(err)));
      }
    });
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    startTransition(async () => {
      try {
        await addTicketComment(ticket.id, commentText, updateAuthor);
        setCommentText("");
        router.refresh();
      } catch (err) {
        alert("Error adding update log: " + (err instanceof Error ? err.message : String(err)));
      }
    });
  };

  const customFields = safeParseJson<string[]>(ticket.maincon?.customFieldsSchema, []);
  const customValues = safeParseJson<Record<string, string>>(ticket.customValues, {});

  const assignedPartner = partners.find((p) => p.id === ticket.partnerId);
  const eligiblePartners = partners.filter((p) => {
    const covered = safeParseJson<string[]>(p.statesCovered, []);
    return covered.includes(ticket.state);
  });

  return (
    <div className="min-h-screen bg-background text-foreground font-sans antialiased pb-12">
      {/* Ambient gradient */}
      <div className="absolute top-0 left-0 w-full h-[400px] bg-gradient-to-b from-indigo-50/5 dark:from-indigo-900/10 via-background to-transparent pointer-events-none" />

      {/* Header */}
      <header className="relative border-b border-card-border bg-background/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          {/* Back button */}
          <button
            onClick={() => router.push("/")}
            className="p-2 rounded-xl border border-card-border hover:bg-slate-100 dark:hover:bg-slate-800/50 text-muted-text hover:text-foreground transition-all flex items-center gap-2 text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline">Back to Dashboard</span>
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                {ticket.ticketRefNo ?? `#${ticket.id}`}
              </span>
              <span className="text-xs text-muted-text">
                {ticket.maincon?.name}
                {ticket.endCustomer ? ` · ${ticket.endCustomer}` : ""}
              </span>
            </div>
            <h1 className="text-base sm:text-lg font-bold text-foreground truncate mt-0.5">{ticket.clientSiteName}</h1>
          </div>

          {/* Edit button */}
          {user?.role !== "AGENT" && (
            <button
              onClick={() => router.push(`/tickets/${ticket.id}/edit`)}
              className="p-2 rounded-xl border border-card-border hover:bg-slate-100 dark:hover:bg-slate-800/50 text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition-all flex items-center gap-1.5 text-xs font-semibold"
              title="Edit Ticket"
            >
              ✏️ <span>Edit</span>
            </button>
          )}

          {/* WhatsApp Copy button */}
          <button
            onClick={handleCopyToWhatsapp}
            className="p-2 rounded-xl border border-card-border hover:bg-slate-100 dark:hover:bg-slate-800/50 text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 transition-all flex items-center gap-1.5 text-xs font-semibold"
            title="Copy for WhatsApp Dispatch"
          >
            💬 <span>{copied ? "Copied!" : "Copy for WA"}</span>
          </button>

          {/* Severity badge */}
          {renderSeverityBadge(ticket.severity)}

          {/* Status badge */}
          <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold whitespace-nowrap ${sc.badge}`}>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sc.dot} ${isActive ? "animate-pulse" : ""}`} />
            {sc.label}
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left column: Ticket Info & Chronology ── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Core info card */}
            <div className="bg-card border border-card-border rounded-2xl p-6">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-text mb-4">Ticket Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoRow label="Site Name" value={ticket.clientSiteName} />
                <InfoRow label="State / Region" value={ticket.state} />
                <InfoRow label="Ref Number" value={ticket.ticketRefNo ?? "—"} mono />
                <InfoRow label="Client" value={ticket.maincon?.name ?? "—"} />
                {ticket.severity && (
                   <InfoRow label="Severity Level" value={ticket.severity} />
                )}
                {ticket.endCustomer && (
                  <InfoRow label="End-Customer Group" value={ticket.endCustomer} />
                )}
                {ticket.site && (
                  <InfoRow label="Location Presets" value={`Linked to pre-seeded location #${ticket.site.id}`} />
                )}
                <InfoRow
                  label="Reported At (Email Stamp)"
                  value={new Date(ticket.reportedAt || ticket.createdAt).toLocaleString("en-MY", {
                    day: "2-digit", month: "short", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                />
                <div className="sm:col-span-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-text mb-1">SLA Target</p>
                  <div className="flex items-center gap-2">
                    {ticket.slaDeadline ? (
                      <>
                        <span className="text-sm text-foreground font-mono font-medium">
                          {new Date(ticket.slaDeadline).toLocaleString("en-MY")}
                        </span>
                        {renderSlaBadge(ticket)}
                      </>
                    ) : (
                      <span className="text-sm text-muted-text">No SLA assigned</span>
                    )}
                  </div>
                </div>
                {ticket.serviceReportUrl && (
                  <div className="sm:col-span-2 mt-2 pt-2 border-t border-card-border">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">📄 Signed Service Report</p>
                    <div className="flex items-center gap-2">
                      <a
                        href={ticket.serviceReportUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold transition-all"
                      >
                        👁️ View Uploaded Service Report
                      </a>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-card-border">
                <p className="text-xs font-semibold text-muted-text mb-2">Issue Description</p>
                <p className="text-sm text-foreground leading-relaxed bg-input-bg p-3.5 rounded-xl border border-card-border">
                  {ticket.issueDescription}
                </p>
              </div>
            </div>

            {/* Hold details banner if currently ON_HOLD */}
            {ticket.status === "ON_HOLD" && (
              <div className="bg-orange-500/10 border border-orange-55 rounded-2xl p-4 flex gap-3">
                <span className="text-xl">⏸️</span>
                <div>
                  <h4 className="text-xs font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wide">Ticket on Hold</h4>
                  <p className="text-sm text-foreground mt-1 font-semibold">{ticket.holdReason || "No specific reason provided."}</p>
                  <p className="text-[10px] text-muted-text mt-1.5">SLA countdown is currently frozen.</p>
                </div>
              </div>
            )}

            {/* Chronology / Timeline (Work History Log) */}
            <div className="bg-card border border-card-border rounded-2xl p-6 space-y-4">
              <div
                className="flex justify-between items-center cursor-pointer select-none group"
                onClick={() => setIsChronologyExpanded(!isChronologyExpanded)}
              >
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-text flex items-center gap-2">
                  <span>Ticket Chronology & Work History</span>
                  <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded font-mono font-normal">
                    {ticket.activities?.length || 0}
                  </span>
                </h2>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:text-indigo-500 transition-colors">
                  {isChronologyExpanded ? (
                    <>Hide <span className="text-[10px]">▲</span></>
                  ) : (
                    <>Unhide <span className="text-[10px]">▼</span></>
                  )}
                </span>
              </div>
              
              {isChronologyExpanded && (
                <div className="space-y-4 pt-2">
                  {/* Add Progress Comment Form */}
              <form onSubmit={handleAddComment} className="bg-input-bg/30 p-4 rounded-xl border border-card-border space-y-3">
                <label className="block text-xs font-bold text-muted-text uppercase tracking-wide">Record Work Done / Progress Comment</label>
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Describe what was done today (cleaning, diagnostic checks, part replacements, etc.)..."
                  rows={2}
                  className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none text-xs"
                  required
                />
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-muted-text">
                    Logging as: <strong className="text-indigo-65 text-indigo-600 dark:text-indigo-400 font-semibold">{updateAuthor}</strong>
                  </span>
                  <button
                    type="submit"
                    disabled={isPending || !commentText.trim()}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                  >
                    Add Progress Log
                  </button>
                </div>
              </form>

              {/* Timeline List */}
              <div className="relative border-l border-slate-200 dark:border-slate-800 ml-3 pl-6 space-y-6 pt-2">
                {!ticket.activities || ticket.activities.length === 0 ? (
                  <p className="text-xs text-muted-text italic pl-2">No activity logs recorded yet.</p>
                ) : (
                  ticket.activities.map((activity) => {
                    let icon = "⚙️";
                    let iconBg = "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400";
                    let title = activity.type;

                    if (activity.type === "STATUS_CHANGE") {
                      const sLabel = activity.status ? STATUS_CONFIG[activity.status as keyof typeof STATUS_CONFIG]?.label || activity.status : "Updated";
                      title = `Status updated to: ${sLabel}`;
                      icon = "📊";
                      iconBg = "bg-indigo-500/10 text-indigo-500";
                    } else if (activity.type === "COMMENT") {
                      title = "Work Progress Recorded";
                      icon = "📝";
                      iconBg = "bg-emerald-500/10 text-emerald-500";
                    } else if (activity.type === "ASSIGNMENT") {
                      title = "Dispatch Assignment";
                      icon = "👤";
                      iconBg = "bg-sky-500/10 text-sky-500";
                    } else if (activity.type === "ETA_UPDATE") {
                      title = "FE ETA Registered";
                      icon = "🕒";
                      iconBg = "bg-amber-500/10 text-amber-500";
                    } else if (activity.type === "FE_ACKNOWLEDGE") {
                      title = "Ticket Acknowledged by Engineer";
                      icon = "✓";
                      iconBg = "bg-teal-500/10 text-teal-600 dark:text-teal-400 font-bold";
                    } else if (activity.type === "SLA_PAUSE") {
                      title = "SLA Countdown Paused";
                      icon = "⏸️";
                      iconBg = "bg-orange-500/10 text-orange-500";
                    } else if (activity.type === "SLA_RESUME") {
                      title = "SLA Countdown Resumed";
                      icon = "▶️";
                      iconBg = "bg-indigo-500/10 text-indigo-500";
                    }

                    return (
                      <div key={activity.id} className="relative">
                        {/* Timeline dot */}
                        <span className={`absolute -left-9 top-0.5 w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${iconBg} shadow-sm border border-card-border`}>
                          {icon}
                        </span>
                        <div>
                          <div className="flex items-center justify-between gap-4 flex-wrap">
                            <h4 className="text-xs font-bold text-foreground">{title}</h4>
                            <span className="text-[10px] text-muted-text font-mono">
                              {new Date(activity.createdAt).toLocaleString("en-MY", {
                                day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
                              })}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-text mt-0.5">By {activity.author}</p>
                          {activity.notes && (() => {
                             const imageRegex = /\[Attached Image: ([^\]]+)\]/g;
                             const matches = [...activity.notes.matchAll(imageRegex)];
                             const imageUrls = matches.map((m) => m[1]);
                             const withoutImages = activity.notes.replace(imageRegex, "").trim();

                             const srRegex = /\[Attached Service Report: ([^\]]+)\]/;
                             const hasSr = withoutImages.match(srRegex);
                             const cleanNotes = withoutImages.replace(srRegex, "").trim();
                             const srUrl = hasSr ? hasSr[1] : null;

                             return (
                               <div className="mt-2 bg-input-bg/40 p-2.5 rounded-xl border border-card-border space-y-2">
                                 {cleanNotes && (
                                   <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                                     {cleanNotes}
                                   </p>
                                 )}
                                 {imageUrls.length > 0 && (
                                   <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                                     {imageUrls.map((url, idx) => (
                                       <div key={idx} className="rounded-lg overflow-hidden border border-card-border shadow-sm bg-black/5 dark:bg-black/20 aspect-video relative">
                                         <img
                                           src={url}
                                           alt={`Attached reference photo ${idx + 1}`}
                                           className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
                                           onClick={() => window.open(url, "_blank")}
                                         />
                                       </div>
                                     ))}
                                   </div>
                                 )}
                                 {srUrl && (
                                   <div className="mt-2 pt-2 border-t border-card-border/60 flex items-center justify-between">
                                     <span className="text-[10px] text-muted-text font-bold uppercase">Service Report</span>
                                     <a
                                       href={srUrl}
                                       target="_blank"
                                       rel="noopener noreferrer"
                                       className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                                     >
                                       📄 View Service Report
                                     </a>
                                   </div>
                                 )}
                               </div>
                             );
                           })()}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

            {/* Resolution info / Action Taken */}
            {(ticket.resolutionDetails || ticket.status === "RESOLVED" || ticket.status === "COMPLETE") && (
              <div className="bg-card border border-card-border rounded-2xl p-6">
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-text mb-4">Action Taken / Resolution</h2>
                <div className="bg-emerald-500/5 dark:bg-emerald-950/10 p-4 rounded-xl border border-emerald-500/20">
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-2">Onsite Action Details</p>
                  {ticket.resolutionDetails ? (
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{ticket.resolutionDetails}</p>
                  ) : (
                    <p className="text-sm text-muted-text italic">No action details recorded yet.</p>
                  )}
                  {ticket.resolvedAt && (
                    <p className="text-[10px] text-muted-text mt-3 font-mono">
                      Resolved on: {new Date(ticket.resolvedAt).toLocaleString("en-MY")}
                    </p>
                  )}
                  {ticket.serviceReportUrl && (
                    <div className="mt-3 pt-3 border-t border-emerald-500/10 dark:border-emerald-500/20">
                      <a
                        href={ticket.serviceReportUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        📄 View Signed Service Report
                      </a>
                    </div>
                  )}
                  {ticket.defectiveSerial && (
                    <div className="mt-3 pt-3 border-t border-emerald-500/10 dark:border-emerald-500/20 grid grid-cols-2 gap-4 text-xs font-semibold">
                      <div>
                        <span className="text-[10px] text-muted-text uppercase font-bold block mb-0.5">Defective Part Serial</span>
                        <span className="font-mono text-foreground">{ticket.defectiveSerial}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-text uppercase font-bold block mb-0.5">Return Status</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          ticket.defectiveReturnStatus === "RETURNED"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : ticket.defectiveReturnStatus === "PENDING"
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "bg-slate-500/10 text-slate-650 dark:text-slate-400"
                        }`}>
                          {ticket.defectiveReturnStatus === "RETURNED"
                            ? "✓ Returned to Warehouse"
                            : ticket.defectiveReturnStatus === "PENDING"
                            ? "⏳ Pending Return"
                            : ticket.defectiveReturnStatus || "Not Specified"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Dynamic custom fields */}
            {customFields.length > 0 && (
              <div className="bg-card border border-card-border rounded-2xl p-6">
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-text mb-4">
                  Client Fields — {ticket.maincon?.name}
                </h2>
                <div className="divide-y divide-card-border">
                  {customFields.map((fName) => (
                    <div key={fName} className="flex justify-between items-center py-2.5">
                      <span className="text-sm text-muted-text font-medium">{fName}</span>
                      <span className="text-sm font-semibold text-foreground font-mono">
                        {customValues[fName] || <span className="text-slate-400 dark:text-slate-600 font-normal">N/A</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Device info */}
            {ticket.device && (
              <div className="bg-card border border-card-border rounded-2xl p-6">
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-text mb-4">Device Information</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InfoRow label="Category" value={ticket.device.category} />
                  <InfoRow label="Brand" value={ticket.device.brand} />
                  <InfoRow label="Model" value={ticket.device.model} />
                  <InfoRow
                    label="Standard Type"
                    value={ticket.device.isStandard ? "Catalog Standard" : "Non-Standard / On Request"}
                  />
                </div>
                {ticket.deviceStatus === "ON_REQUEST" && ticket.customDeviceDetails && (
                   <div className="mt-4 pt-4 border-t border-card-border">
                    <p className="text-xs font-semibold text-muted-text mb-2">Custom Device Request</p>
                    <p className="font-mono text-sm text-indigo-600 dark:text-indigo-400 bg-input-bg p-3 rounded-xl border border-card-border">
                      {ticket.customDeviceDetails}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Right column: Actions ── */}
          <div className="space-y-5">

            {/* Acknowledgment Warning Banner */}
            {ticket.assignedFeId && ticket.feAcknowledgeStatus === "PENDING" && (
              <div className="bg-amber-500/5 dark:bg-amber-950/10 border border-amber-500/20 rounded-2xl p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-xl">⚠️</span>
                  <div>
                    <h3 className="text-sm font-bold text-amber-800 dark:text-amber-400">Awaiting Acknowledgment</h3>
                    <p className="text-xs text-muted-text mt-1">Field Engineer has not acknowledged this dispatch ticket yet.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAcknowledge}
                  disabled={isPending}
                  className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                >
                  Acknowledge Ticket (Act as FE)
                </button>
              </div>
            )}

            {/* Active Acting Role settings */}
            {user?.role === "SUPERADMIN" && (
              <div className="bg-card border border-card-border rounded-2xl p-5 space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-text">Acting User Role</h2>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <select
                      value={updateAuthor === "Admin" || updateAuthor === "Field Engineer" ? updateAuthor : "Custom"}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "Admin" || val === "Field Engineer") {
                          setUpdateAuthor(val);
                        } else {
                          setUpdateAuthor(ticket.assignedFe?.name || "Field Engineer");
                        }
                      }}
                      className="px-3 py-2 bg-input-bg border border-card-border rounded-xl text-xs flex-1 text-foreground focus:outline-none"
                    >
                      <option value="Admin">Admin Portal</option>
                      <option value="Field Engineer">Field Engineer ({ticket.assignedFe?.name || "Unassigned"})</option>
                      <option value="Custom">Custom User Name</option>
                    </select>
                  </div>
                  {(updateAuthor !== "Admin" && updateAuthor !== "Field Engineer" && updateAuthor !== (ticket.assignedFe?.name || "")) && (
                    <input
                      type="text"
                      value={updateAuthor}
                      onChange={(e) => setUpdateAuthor(e.target.value)}
                      className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-xs text-foreground focus:outline-none font-medium"
                      placeholder="Enter actor name..."
                    />
                  )}
                </div>
              </div>
            )}

            {/* Status Update */}
            {user?.role !== "AGENT" && (
              <div className="bg-card border border-card-border rounded-2xl p-5">
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-text mb-4">Update Status</h2>
                
                {/* Main Status Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  {(["NEW", "IN_PROGRESS", "ON_HOLD", "RESOLVED", "FOLLOW_UP", "COMPLETE", "CLOSED"] as const).map((st) => {
                    const s = STATUS_CONFIG[st] || STATUS_CONFIG["NEW"];
                    const isCurrentStatus = ticket.status === st;
                    const isSelected = selectedTargetStatus === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => {
                          setSelectedTargetStatus(st);
                          if (st !== "FOLLOW_UP") {
                            setFollowUpSubStatus("");
                          }
                          if (st !== "ON_HOLD") {
                            setHoldReason("");
                          }
                          if (st !== "RESOLVED" && st !== "COMPLETE") {
                            setResolutionNotes("");
                          }
                        }}
                        disabled={isPending || isCurrentStatus}
                        className={`px-3 py-2.5 text-xs font-semibold rounded-xl border transition-all ${
                          isCurrentStatus
                            ? `${s.badge} ${s.ring} ring-1 cursor-default opacity-85`
                            : isSelected
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                            : "bg-input-bg border-card-border text-muted-text hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-foreground"
                        }`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>

                {/* Conditional Inputs based on Selected target status */}
                {selectedTargetStatus && selectedTargetStatus !== ticket.status && (
                  <div className="mt-4 pt-4 border-t border-card-border space-y-3">
                    
                    {/* Hold Reason Dropdown */}
                    {selectedTargetStatus === "ON_HOLD" && (
                      <div>
                        <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1.5">
                          Hold Reason
                        </label>
                        <select
                          value={holdReason}
                          onChange={(e) => setHoldReason(e.target.value)}
                          className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none text-xs cursor-pointer"
                          required
                        >
                          <option value="">Select Hold Reason</option>
                          <option value="Awaiting Client Feedback">Awaiting Client Feedback</option>
                          <option value="Site Closed / Public Holiday">Site Closed / Public Holiday</option>
                          <option value="Under Maintenance">Under Maintenance</option>
                          <option value="Spare Part Not Available">Spare Part Not Available</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    )}

                    {/* Follow Up Sub-status selector */}
                    {selectedTargetStatus === "FOLLOW_UP" && (
                      <div>
                        <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1.5">
                          Follow Up Sub-status
                        </label>
                        <select
                          value={followUpSubStatus}
                          onChange={(e) => setFollowUpSubStatus(e.target.value)}
                          className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none text-xs cursor-pointer"
                          required
                        >
                          <option value="">Select Sub-status</option>
                          <option value="PENDING_PARTS">Follow Up (Pending Parts)</option>
                          <option value="PENDING_SIGN_OFF">Follow Up (Pending Sign off User)</option>
                          <option value="MONITORING">Follow Up (In Monitoring)</option>
                          <option value="OTHER">Follow Up (Others)</option>
                        </select>
                      </div>
                    )}

                    {/* Work progress update text details (Required for holding or following up) */}
                    {(selectedTargetStatus === "ON_HOLD" || selectedTargetStatus === "FOLLOW_UP") && (
                      <div>
                        <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1.5">
                          Work Done Today / Reason details <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          placeholder="What checking / cleaning was done today? Describe progress details..."
                          rows={3}
                          className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none text-xs"
                          required
                        />
                      </div>
                    )}

                    {/* Resolution Notes / Action Taken */}
                    {(selectedTargetStatus === "RESOLVED" || selectedTargetStatus === "COMPLETE") && (
                      <div>
                        <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1.5">
                          Action Taken onsite <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                          value={resolutionNotes}
                          onChange={(e) => setResolutionNotes(e.target.value)}
                          placeholder="Describe what action was taken to resolve the issue..."
                          rows={3}
                          className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none text-xs"
                          required
                        />
                      </div>
                    )}

                    {/* Submit / Action buttons */}
                    <div className="flex gap-2 justify-end pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTargetStatus(null);
                          setFollowUpSubStatus("");
                          setHoldReason("");
                          setResolutionNotes("");
                          setCommentText("");
                        }}
                        className="px-3 py-1.5 border border-card-border hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={
                          isPending ||
                          (selectedTargetStatus === "FOLLOW_UP" && (!followUpSubStatus || !commentText.trim())) ||
                          (selectedTargetStatus === "ON_HOLD" && (!holdReason || !commentText.trim())) ||
                          ((selectedTargetStatus === "RESOLVED" || selectedTargetStatus === "COMPLETE") && !resolutionNotes.trim())
                        }
                        onClick={() => {
                          if (selectedTargetStatus === "RESOLVED" || selectedTargetStatus === "COMPLETE") {
                            startTransition(async () => {
                              try {
                                const updated = await updateTicketResolution(ticket.id, resolutionNotes, new Date(), updateAuthor);
                                if (selectedTargetStatus === "COMPLETE") {
                                  const updatedComplete = await updateTicketStatus(ticket.id, "COMPLETE", null, "Ticket marked complete.", updateAuthor);
                                  setTicket((prev) => ({
                                    ...prev,
                                    status: updatedComplete.status as any,
                                    resolutionDetails: updatedComplete.resolutionDetails,
                                    resolvedAt: updatedComplete.resolvedAt,
                                    subStatus: null,
                                  }));
                                } else {
                                  setTicket((prev) => ({
                                    ...prev,
                                    status: updated.status as any,
                                    resolutionDetails: updated.resolutionDetails,
                                    resolvedAt: updated.resolvedAt,
                                    subStatus: null,
                                  }));
                                }
                                setSelectedTargetStatus(null);
                              } catch (err) {
                                alert("Error resolving ticket: " + (err instanceof Error ? err.message : String(err)));
                              }
                            });
                          } else if (selectedTargetStatus === "ON_HOLD") {
                            const notesWithReason = `Hold Reason: ${holdReason}. Work Done: ${commentText}`;
                            handleUpdateStatus(selectedTargetStatus, holdReason, notesWithReason);
                          } else {
                            handleUpdateStatus(selectedTargetStatus, followUpSubStatus, commentText);
                          }
                        }}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs text-white disabled:opacity-50"
                      >
                        Save Status
                      </button>
                    </div>
                  </div>
                )}

                {isPending && (
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 animate-pulse mt-3 text-center">Saving…</p>
                )}
              </div>
            )}

            {/* Field Engineer ETA settings */}
            <div className="bg-card border border-card-border rounded-2xl p-5">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-text mb-3">Field Engineer ETA</h2>
              <div className="space-y-3">
                {ticket.eta ? (
                  <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-muted-text font-semibold uppercase">Current ETA Target</p>
                      <p className="text-sm font-bold text-foreground mt-0.5">
                        {new Date(ticket.eta).toLocaleString("en-MY", {
                          day: "2-digit", month: "short", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <span className="text-lg">🕒</span>
                  </div>
                ) : (
                  <p className="text-xs text-muted-text italic">No arrival ETA has been set for this ticket.</p>
                )}
                
                <div className="flex gap-2">
                  <input
                    type="datetime-local"
                    value={etaDate}
                    onChange={(e) => setEtaDate(e.target.value)}
                    className="px-3 py-2 bg-input-bg border border-card-border rounded-xl text-xs flex-1 text-foreground focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSaveEta}
                    disabled={isPending || !etaDate}
                    className="px-4 py-2 bg-indigo-65 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                  >
                    Set ETA
                  </button>
                </div>
              </div>
            </div>

            {/* Service Partner Assignment */}
            <div className="bg-card border border-card-border rounded-2xl p-5">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-text mb-4">
                Dispatch Assignment
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-muted-text mb-1.5">Service Partner</label>
                  <select
                    value={ticket.partnerId ?? ""}
                    disabled={user?.role === "AGENT"}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : undefined;
                      handleAssignService(val, undefined);
                    }}
                    className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-505 cursor-pointer"
                  >
                    <option value="">Unassigned</option>
                    {eligiblePartners.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-muted-text mt-1 italic">Showing partners covering {ticket.state}</p>
                </div>

                {ticket.partnerId && assignedPartner && (
                  <div>
                    <label className="block text-xs font-medium text-muted-text mb-1.5">Field Engineer</label>
                    <select
                      value={ticket.assignedFeId ?? ""}
                      onChange={(e) => {
                        const val = e.target.value ? Number(e.target.value) : undefined;
                        handleAssignService(ticket.partnerId!, val);
                      }}
                      className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-505 cursor-pointer"
                    >
                      <option value="">Select Engineer</option>
                      {(assignedPartner.engineers ?? []).map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name} — {e.phone}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {ticket.assignedFe && (
                  <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-xl relative flex items-center gap-3">
                    {/* FE Avatar / Placeholder */}
                    {ticket.assignedFe.user?.avatarUrl ? (
                      <img
                        src={ticket.assignedFe.user.avatarUrl}
                        alt={ticket.assignedFe.name}
                        className="w-10 h-10 rounded-full object-cover border border-card-border shadow-sm flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center font-bold text-sm border border-card-border shadow-sm flex-shrink-0">
                        {ticket.assignedFe.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Assigned Engineer</p>
                      <p className="text-sm font-semibold text-foreground truncate mt-0.5">{ticket.assignedFe.name}</p>
                      <p className="text-xs font-mono text-muted-text mt-0.5">{ticket.assignedFe.phone}</p>
                    </div>
                    {ticket.feAcknowledgeStatus && (
                      <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-md border self-start ${
                        ticket.feAcknowledgeStatus === "ACKNOWLEDGED"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                      }`}>
                        {ticket.feAcknowledgeStatus === "ACKNOWLEDGED" ? "✓ Ack" : "⏳ Pending"}
                      </span>
                    )}
                  </div>
                )}

                {!ticket.partnerId && (
                  <div className="flex items-center gap-2 p-3 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 rounded-xl">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse flex-shrink-0" />
                    <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">No partner assigned yet</p>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Summary */}
            <div className="bg-card border border-card-border rounded-2xl p-5">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-text mb-3">Quick Summary</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-text">Ticket ID</span>
                  <span className="text-foreground font-mono font-semibold">#{ticket.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-text">Partner</span>
                  <span className="text-foreground font-semibold truncate max-w-[140px] text-right">
                    {ticket.partner?.name ?? <span className="text-slate-400 dark:text-slate-600">None</span>}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-text">Engineer</span>
                  <span className="text-foreground font-semibold truncate max-w-[140px] text-right">
                    {ticket.assignedFe?.name ?? <span className="text-slate-400 dark:text-slate-600">None</span>}
                  </span>
                </div>
                {ticket.eta && (
                  <div className="flex justify-between">
                    <span className="text-muted-text">Arrival ETA</span>
                    <span className="text-foreground font-semibold font-mono text-right text-xs">
                      {new Date(ticket.eta).toLocaleDateString("en-MY")}
                    </span>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}

/* ── Reusable info row ── */
function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-text mb-1">{label}</p>
      <p className={`text-sm text-foreground font-medium ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
