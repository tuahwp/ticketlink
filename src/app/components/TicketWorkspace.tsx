"use client";

import React, { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import SlaCountdown from "./SlaCountdown";
import { useAuth } from "./AuthProvider";
import {
  updateTicketStatus,
  assignServiceDetails,
  updateTicketResolution,
  acknowledgeTicket,
  updateTicketEta,
  addTicketComment,
  getTicketById,
  requestTicketSparePart,
  allocateAndDispatchSparePart,
  markSparePartInstalled,
  cancelSparePartRequest,
  getInventoryItems,
  extendLoanDuration,
  initiateLoanerReturn,
  receiveAndRestockLoaner,
  allocateAndDispatchLoanerUnit,
} from "../actions";
import { toast } from "sonner";

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
  country?: string | null;
  region?: string | null;
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
  type: string;
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
  spareParts?: TicketSparePart[];
}

interface TicketSparePart {
  id: number;
  ticketId: number;
  requestedPartName: string;
  quantity: number;
  status: "REQUESTED" | "ALLOCATED" | "DISPATCHED" | "INSTALLED" | "ON_LOAN" | "RETURN_IN_TRANSIT" | "RETURNED" | "CANCELLED";
  isLoaner?: boolean;
  expectedReturnDate?: Date | string | null;
  loanDurationDays?: number | null;
  returnInitiatedAt?: Date | string | null;
  returnCourierName?: string | null;
  returnTrackingNo?: string | null;
  returnReceivedAt?: Date | string | null;
  returnCondition?: string | null;
  loanNotes?: string | null;
  courierName?: string | null;
  dispatchTrackingNo?: string | null;
  dispatchedAt?: Date | string | null;
  installedAt?: Date | string | null;
  replacedDefectiveSerial?: string | null;
  notes?: string | null;
  inventoryItemId?: number | null;
  inventoryItem?: {
    id: number;
    name: string;
    serialNumber: string;
    category: string;
    isLoaner?: boolean;
    warehouse?: {
      id: number;
      name: string;
      state: string;
    } | null;
  } | null;
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
    try {
      return JSON.parse(val) as T;
    } catch {
      return fallback;
    }
  }
  return val as T;
}

const STATUS_CONFIG = {
  NEW: { label: "New", dot: "bg-sky-500", badge: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30", ring: "ring-sky-500/20 border-sky-500" },
  IN_PROGRESS: { label: "In Progress", dot: "bg-amber-500", badge: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30", ring: "ring-amber-500/20 border-amber-500" },
  ON_HOLD: { label: "On Hold", dot: "bg-orange-500", badge: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30", ring: "ring-orange-500/20 border-orange-500" },
  RESOLVED: { label: "Resolved", dot: "bg-emerald-500", badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30", ring: "ring-emerald-500/20 border-emerald-500" },
  FOLLOW_UP: { label: "Follow Up", dot: "bg-purple-500", badge: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30", ring: "ring-purple-500/20 border-purple-500" },
  COMPLETE: { label: "Complete", dot: "bg-teal-500", badge: "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30", ring: "ring-teal-500/20 border-teal-500" },
  CLOSED: { label: "Closed", dot: "bg-slate-500", badge: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700", ring: "ring-slate-500/20 border-slate-600" },
} as const;

function renderSeverityBadge(severity: string | null) {
  if (!severity) return null;
  const config: Record<string, { label: string; badge: string }> = {
    P1: { label: "P1 - Critical", badge: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/40" },
    P2: { label: "P2 - High", badge: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/40" },
    P3: { label: "P3 - Medium", badge: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/40" },
    P4: { label: "P4 - Low", badge: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/40" },
  };
  const c = config[severity] || { label: severity, badge: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30" };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-bold ${c.badge}`}>
      {c.label}
    </span>
  );
}

export default function TicketWorkspace({ ticket: initialTicket, partners }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<Ticket>(initialTicket);

  // Realtime Supabase Subscription
  useEffect(() => {
    setTicket(initialTicket);
  }, [initialTicket]);

  useEffect(() => {
    const interval = setInterval(() => {
      getTicketById(ticket.id).then((fresh) => {
        if (fresh) setTicket(fresh as unknown as Ticket);
      }).catch((e) => console.error(e));
    }, 15000);

    return () => clearInterval(interval);
  }, [ticket.id]);


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

  // Spare Parts management states
  const [isRequestPartModalOpen, setIsRequestPartModalOpen] = useState(false);
  const [reqPartName, setReqPartName] = useState("");
  const [reqPartQty, setReqPartQty] = useState(1);
  const [reqPartNotes, setReqPartNotes] = useState("");

  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [selectedPartToDispatch, setSelectedPartToDispatch] = useState<TicketSparePart | null>(null);
  const [availableStockItems, setAvailableStockItems] = useState<any[]>([]);
  const [selectedStockItemId, setSelectedStockItemId] = useState("");
  const [dispatchCourierName, setDispatchCourierName] = useState("");
  const [dispatchTrackingNo, setDispatchTrackingNo] = useState("");
  const [dispatchNotes, setDispatchNotes] = useState("");

  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [selectedPartToInstall, setSelectedPartToInstall] = useState<TicketSparePart | null>(null);
  const [installDefectiveSerial, setInstallDefectiveSerial] = useState("");

  // Loaner states
  const [isExtendModalOpen, setIsExtendModalOpen] = useState(false);
  const [selectedLoanToExtend, setSelectedLoanToExtend] = useState<TicketSparePart | null>(null);
  const [extendDays, setExtendDays] = useState(7);
  const [extendReason, setExtendReason] = useState("");

  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedLoanToReturn, setSelectedLoanToReturn] = useState<TicketSparePart | null>(null);
  const [returnCourier, setReturnCourier] = useState("");
  const [returnTracking, setReturnTracking] = useState("");
  const [returnNotes, setReturnNotes] = useState("");

  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [selectedLoanToRestock, setSelectedLoanToRestock] = useState<TicketSparePart | null>(null);
  const [restockCondition, setRestockCondition] = useState<"GOOD" | "DAMAGED_NEEDS_REPAIR" | "MISSING_ACCESSORIES">("GOOD");
  const [restockNotes, setRestockNotes] = useState("");

  const handleExtendLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanToExtend) return;
    startTransition(async () => {
      try {
        await extendLoanDuration({
          ticketSparePartId: selectedLoanToExtend.id,
          additionalDays: Number(extendDays) || 7,
          reason: extendReason || undefined,
          author: updateAuthor,
        });
        const fresh = await getTicketById(ticket.id);
        if (fresh) setTicket(fresh as unknown as Ticket);
        setIsExtendModalOpen(false);
        setSelectedLoanToExtend(null);
        setExtendReason("");
        toast.success(`Loan duration extended by +${extendDays} days!`);
      } catch (err: any) {
        toast.error(err.message || "Failed to extend loan.");
      }
    });
  };

  const handleInitiateReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanToReturn) return;
    startTransition(async () => {
      try {
        await initiateLoanerReturn({
          ticketSparePartId: selectedLoanToReturn.id,
          returnCourierName: returnCourier || undefined,
          returnTrackingNo: returnTracking || undefined,
          notes: returnNotes || undefined,
          author: updateAuthor,
        });
        const fresh = await getTicketById(ticket.id);
        if (fresh) setTicket(fresh as unknown as Ticket);
        setIsReturnModalOpen(false);
        setSelectedLoanToReturn(null);
        setReturnCourier("");
        setReturnTracking("");
        setReturnNotes("");
        toast.success("Standby loaner return initiated!");
      } catch (err: any) {
        toast.error(err.message || "Failed to initiate return.");
      }
    });
  };

  const handleRestockLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanToRestock) return;
    startTransition(async () => {
      try {
        await receiveAndRestockLoaner({
          ticketSparePartId: selectedLoanToRestock.id,
          condition: restockCondition,
          notes: restockNotes || undefined,
          author: updateAuthor,
        });
        const fresh = await getTicketById(ticket.id);
        if (fresh) setTicket(fresh as unknown as Ticket);
        setIsRestockModalOpen(false);
        setSelectedLoanToRestock(null);
        setRestockNotes("");
        toast.success(`Standby loaner restocked with condition: ${restockCondition}!`);
      } catch (err: any) {
        toast.error(err.message || "Failed to restock loaner.");
      }
    });
  };


  // Open Dispatch Modal and fetch stock items
  const handleOpenDispatchModal = async (part: TicketSparePart) => {
    setSelectedPartToDispatch(part);
    setDispatchCourierName(part.courierName || "");
    setDispatchTrackingNo(part.dispatchTrackingNo || "");
    setDispatchNotes(part.notes || "");
    if (part.inventoryItemId) {
      setSelectedStockItemId(String(part.inventoryItemId));
    } else {
      setSelectedStockItemId("");
    }

    try {
      const items = await getInventoryItems({ status: "AVAILABLE" as any });
      setAvailableStockItems(items);
      setIsDispatchModalOpen(true);
    } catch (err) {
      toast.error("Failed to load inventory stock.");
    }
  };

  // Submit Part Request
  const handleSubmitPartRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqPartName.trim()) {
      toast.error("Please provide a part name.");
      return;
    }

    startTransition(async () => {
      try {
        await requestTicketSparePart({
          ticketId: ticket.id,
          requestedPartName: reqPartName.trim(),
          quantity: reqPartQty,
          notes: reqPartNotes.trim() || undefined,
          author: updateAuthor,
        });
        const fresh = await getTicketById(ticket.id);
        if (fresh) setTicket(fresh as unknown as Ticket);
        toast.success("Spare part request submitted!");
        setIsRequestPartModalOpen(false);
        setReqPartName("");
        setReqPartQty(1);
        setReqPartNotes("");
      } catch (err: any) {
        toast.error(err.message || "Failed to request part.");
      }
    });
  };

  // Submit Dispatch
  const handleSubmitDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartToDispatch || !selectedStockItemId) {
      toast.error("Please select an item from stock.");
      return;
    }

    startTransition(async () => {
      try {
        await allocateAndDispatchSparePart({
          ticketSparePartId: selectedPartToDispatch.id,
          inventoryItemId: Number(selectedStockItemId),
          courierName: dispatchCourierName || undefined,
          dispatchTrackingNo: dispatchTrackingNo || undefined,
          notes: dispatchNotes || undefined,
          author: updateAuthor,
        });
        const fresh = await getTicketById(ticket.id);
        if (fresh) setTicket(fresh as unknown as Ticket);
        toast.success("Spare part successfully dispatched!");
        setIsDispatchModalOpen(false);
      } catch (err: any) {
        toast.error(err.message || "Failed to dispatch part.");
      }
    });
  };

  // Confirm Install
  const handleConfirmInstall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartToInstall) return;

    startTransition(async () => {
      try {
        await markSparePartInstalled({
          ticketSparePartId: selectedPartToInstall.id,
          defectiveSerial: installDefectiveSerial.trim() || undefined,
          author: updateAuthor,
        });
        const fresh = await getTicketById(ticket.id);
        if (fresh) setTicket(fresh as unknown as Ticket);
        toast.success("Part marked as installed!");
        setIsInstallModalOpen(false);
        setSelectedPartToInstall(null);
        setInstallDefectiveSerial("");
      } catch (err: any) {
        toast.error(err.message || "Failed to mark installed.");
      }
    });
  };

  // Cancel Request
  const handleCancelPart = async (partId: number) => {
    if (!confirm("Are you sure you want to cancel this part request?")) return;
    startTransition(async () => {
      try {
        await cancelSparePartRequest(partId, updateAuthor);
        const fresh = await getTicketById(ticket.id);
        if (fresh) setTicket(fresh as unknown as Ticket);
        toast.success("Part request cancelled.");
      } catch (err: any) {
        toast.error(err.message || "Failed to cancel request.");
      }
    });
  };

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
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "No SLA assigned";

    const text = `*🚨 TICKET DISPATCH ALERT*

*Ticket Number:* ${ticket.ticketRefNo || `#${ticket.id}`}
*Severity:* ${ticket.severity || "Standard"}
*Client:* ${ticket.maincon?.name || "Client"} ${ticket.endCustomer ? `(${ticket.endCustomer})` : ""}
*Site Name:* ${ticket.clientSiteName}
*State:* ${ticket.state}

*Issue Description:* ${ticket.issueDescription}
*Hardware:* ${
      ticket.device
        ? ticket.deviceStatus === "ON_REQUEST" && ticket.customDeviceDetails
          ? ticket.customDeviceDetails
          : `${ticket.device.brand} ${ticket.device.model}`
        : "Standard/None"
    }
*SLA Target:* ${slaStr}

*Service Partner:* ${ticket.partner?.name || "Unassigned"}
*Assigned Engineer:* ${ticket.assignedFe?.name || "Unassigned"}

_Please acknowledge and coordinate immediately. Thank you!_`;

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
        toast.success(`Ticket status updated to ${status}!`);
        router.refresh();
      } catch (err) {
        toast.error("Error updating status: " + (err instanceof Error ? err.message : String(err)));
      }
    });
  };

  const handleAssignService = (partnerId?: number, assignedFeId?: number) => {
    startTransition(async () => {
      try {
        await assignServiceDetails({ ticketId: ticket.id, partnerId, assignedFeId });
        toast.success("Dispatch assignments updated!");
        router.refresh();
      } catch (err) {
        toast.error("Error assigning: " + (err instanceof Error ? err.message : String(err)));
      }
    });
  };

  const handleAcknowledge = () => {
    startTransition(async () => {
      try {
        await acknowledgeTicket(ticket.id, null, updateAuthor);
        toast.success("Ticket acknowledged!");
        router.refresh();
      } catch (err) {
        toast.error("Error acknowledging ticket: " + (err instanceof Error ? err.message : String(err)));
      }
    });
  };

  const handleSaveEta = () => {
    if (!etaDate) return;
    startTransition(async () => {
      try {
        await updateTicketEta(ticket.id, new Date(etaDate), updateAuthor);
        toast.success("Estimated Arrival Time (ETA) updated!");
        router.refresh();
      } catch (err) {
        toast.error("Error setting ETA: " + (err instanceof Error ? err.message : String(err)));
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
        toast.success("Update comment posted!");
        router.refresh();
      } catch (err) {
        toast.error("Error adding update log: " + (err instanceof Error ? err.message : String(err)));
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

  // Calculate lifecycle stepper stage
  const getLifecycleStage = () => {
    if (ticket.status === "RESOLVED" || ticket.status === "COMPLETE" || ticket.status === "CLOSED") return 4;
    if (ticket.status === "IN_PROGRESS" || ticket.status === "ON_HOLD" || ticket.status === "FOLLOW_UP") return 3;
    if (ticket.partnerId || ticket.assignedFeId) return 2;
    return 1;
  };
  const currentStage = getLifecycleStage();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased pb-16">
      
      {/* ── 1. Top Hero Header ── */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
          {/* Back & Ticket Title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-all cursor-pointer shadow-sm"
              title="Back to Tickets Queue"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-extrabold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                  {ticket.ticketRefNo || `TKT-#${ticket.id}`}
                </span>
                {ticket.maincon && (
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    {ticket.maincon.name}
                    {ticket.endCustomer ? ` · ${ticket.endCustomer}` : ""}
                  </span>
                )}
                {renderSeverityBadge(ticket.severity)}
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-bold ${sc.badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${sc.dot} ${isActive ? "animate-pulse" : ""}`} />
                  {sc.label}
                </span>
              </div>
              <h1 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate mt-1">
                {ticket.clientSiteName} <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 font-mono">({ticket.state})</span>
              </h1>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2">
            {/* WhatsApp Copy */}
            <button
              type="button"
              onClick={handleCopyToWhatsapp}
              className="px-3.5 py-2 rounded-xl border border-emerald-500/40 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Copy formatted WhatsApp dispatch message"
            >
              <span>💬</span>
              <span>{copied ? "Copied!" : "Dispatch WA"}</span>
            </button>

            {/* Service Report Link if uploaded */}
            {ticket.serviceReportUrl && (
              <a
                href={ticket.serviceReportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-xl border border-teal-500/40 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/50 dark:hover:bg-teal-900/50 text-teal-700 dark:text-teal-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <span>📄</span>
                <span>Report</span>
              </a>
            )}

            {/* Edit Ticket Button */}
            {user?.role !== "AGENT" && (
              <button
                type="button"
                onClick={() => router.push(`/tickets/${ticket.id}/edit`)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <span>✏️</span>
                <span>Edit</span>
              </button>
            )}
          </div>
        </div>

        {/* ── 2. Visual Lifecycle Stepper ── */}
        <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 px-4 sm:px-6 lg:px-8 py-2.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between text-xs font-semibold overflow-x-auto gap-2">
            {[
              { stage: 1, label: "1. Logged", icon: "📝" },
              { stage: 2, label: "2. Dispatched & Ack", icon: "🚀" },
              { stage: 3, label: "3. In Progress / Onsite", icon: "⚡" },
              { stage: 4, label: "4. Resolved & Closed", icon: "✅" },
            ].map((step, idx) => {
              const isPassed = currentStage >= step.stage;
              const isCurrent = currentStage === step.stage;
              return (
                <div key={step.stage} className="flex items-center gap-2 flex-1 min-w-[150px]">
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-xl transition-all ${
                    isCurrent
                      ? "bg-indigo-600 text-white font-extrabold shadow-sm shadow-indigo-600/30 ring-2 ring-indigo-500/20"
                      : isPassed
                      ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-800"
                      : "text-slate-400 dark:text-slate-500 opacity-60"
                  }`}>
                    <span>{step.icon}</span>
                    <span>{step.label}</span>
                  </div>
                  {idx < 3 && (
                    <div className={`flex-1 h-0.5 rounded ${isPassed ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-800"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </header>

      {/* ── 3. Main Workspace Grid ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* ═════════════════════════════════════════════════════════════════════════ */}
          {/* LEFT COLUMN (65% / 8 Cols): Ticket Info, Requestor, Hardware & Timeline */}
          {/* ═════════════════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-8 space-y-6">

            {/* Hold Banner if currently ON_HOLD */}
            {ticket.status === "ON_HOLD" && (
              <div className="bg-orange-50 dark:bg-orange-950/40 border border-orange-300 dark:border-orange-800 rounded-2xl p-4 flex items-start gap-3 shadow-sm animate-in fade-in">
                <span className="text-2xl">⏸️</span>
                <div>
                  <h4 className="text-xs font-black text-orange-800 dark:text-orange-300 uppercase tracking-wider">
                    Ticket Currently On Hold
                  </h4>
                  <p className="text-sm text-slate-900 dark:text-slate-100 font-bold mt-0.5">
                    {ticket.holdReason || "Awaiting spare parts or customer sign-off."}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    SLA countdown is frozen while on hold.
                  </p>
                </div>
              </div>
            )}

            {/* 1. 🏢 Ticket & Site Information */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🏢</span>
                  <h2 className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                    1. Ticket & Site Information
                  </h2>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold font-mono">
                  Reported: {new Date(ticket.reportedAt || ticket.createdAt).toLocaleString("en-MY", {
                    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
                  })}
                </span>
              </div>

              {/* High Contrast Structured Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <InfoRow label="Ticket Number" value={ticket.ticketRefNo || `#${ticket.id}`} mono />
                <InfoRow label="Client / Maincon" value={ticket.maincon?.name || "—"} />
                <InfoRow label="End-Customer Group" value={ticket.endCustomer || "Standard"} />
                <InfoRow label="Site / Branch Name" value={ticket.clientSiteName} />
                <InfoRow label="State / Territory" value={ticket.state} />
                <InfoRow label="Severity Level" value={ticket.severity || "Standard"} />
              </div>

              {/* Issue Description Box */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Issue Description & Technical Fault
                </label>
                <div className="bg-slate-50 dark:bg-slate-950/80 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-sm leading-relaxed text-slate-900 dark:text-slate-100 font-medium whitespace-pre-wrap">
                  {ticket.issueDescription}
                </div>
              </div>

              {/* Requestor / Contractor Custom Fields */}
              {customFields.length > 0 && (
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                  <label className="block text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    Requestor Information ({ticket.maincon?.name})
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50/80 dark:bg-slate-950/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                    {customFields.map((fName) => (
                      <div key={fName} className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block mb-0.5">{fName}</span>
                        <span className="text-sm font-black text-slate-900 dark:text-white font-mono">
                          {customValues[fName] || <span className="text-slate-400 font-normal">N/A</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 2. 💻 Hardware & Serial Numbers */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <span className="text-lg">💻</span>
                <h2 className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                  2. Hardware & Serial Details
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <InfoRow
                  label="Device Model"
                  value={
                    ticket.device
                      ? `${ticket.device.brand} ${ticket.device.model} (${ticket.device.category})`
                      : ticket.customDeviceDetails || "No hardware linked"
                  }
                />
                <InfoRow
                  label="Catalog Status"
                  value={
                    ticket.deviceStatus === "ON_REQUEST"
                      ? "On-Request Fallback"
                      : ticket.device?.isStandard
                      ? "Standard Catalog"
                      : "Standard"
                  }
                />
                <InfoRow
                  label="Defective Part Serial"
                  value={ticket.defectiveSerial || "—"}
                  mono
                />
              </div>

              {ticket.defectiveReturnStatus && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">
                    Warehouse Return Status:
                  </span>
                  <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-extrabold border ${
                    ticket.defectiveReturnStatus === "RETURNED"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                      : ticket.defectiveReturnStatus === "PENDING"
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                  }`}>
                    {ticket.defectiveReturnStatus === "RETURNED"
                      ? "✓ Returned to Warehouse"
                      : ticket.defectiveReturnStatus === "PENDING"
                      ? "⏳ Pending Return"
                      : ticket.defectiveReturnStatus}
                  </span>
                </div>
              )}
            </div>

            {/* 3. 📦 Spare Parts & Hardware Dispatch */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📦</span>
                  <h2 className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                    3. Spare Parts & Hardware Dispatch
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRequestPartModalOpen(true)}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                >
                  <span>+</span>
                  <span>Request Part</span>
                </button>
              </div>

              {(!ticket.spareParts || ticket.spareParts.length === 0) ? (
                <div className="p-5 text-center bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                  <p>No spare parts requested or allocated for this ticket yet.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Click &ldquo;Request Part&rdquo; above to log required hardware.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {ticket.spareParts.map((sp) => {
                    const isLoanerItem = sp.isLoaner || sp.status === "ON_LOAN" || sp.status === "RETURN_IN_TRANSIT" || sp.status === "RETURNED";
                    const returnDate = sp.expectedReturnDate ? new Date(sp.expectedReturnDate) : null;
                    const isOverdue = returnDate && returnDate < new Date() && sp.status === "ON_LOAN";
                    const diffDays = returnDate
                      ? Math.ceil((returnDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                      : null;

                    return (
                      <div
                        key={sp.id}
                        className={`border rounded-xl p-4 space-y-3 ${
                          isLoanerItem
                            ? "bg-cyan-50/50 dark:bg-cyan-950/20 border-cyan-200 dark:border-cyan-800/80"
                            : "bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                                {sp.requestedPartName}
                              </span>
                              <span className="text-xs text-slate-400 font-semibold">(Qty: {sp.quantity})</span>
                              {isLoanerItem && (
                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800 flex items-center gap-1">
                                  <span>🔄</span> Standby Loaner
                                </span>
                              )}
                              <span
                                className={`text-[10px] font-extrabold px-2 py-0.5 rounded uppercase border ${
                                  sp.status === "INSTALLED"
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                                    : sp.status === "ON_LOAN"
                                    ? isOverdue
                                      ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300 dark:border-rose-800 animate-pulse"
                                      : "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800"
                                    : sp.status === "RETURN_IN_TRANSIT"
                                    ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300 dark:border-blue-800"
                                    : sp.status === "RETURNED"
                                    ? "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-300 dark:border-teal-800"
                                    : sp.status === "DISPATCHED"
                                    ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300 dark:border-blue-800"
                                    : sp.status === "ALLOCATED"
                                    ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-300 dark:border-purple-800"
                                    : sp.status === "CANCELLED"
                                    ? "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-transparent"
                                    : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                                }`}
                              >
                                {sp.status === "REQUESTED"
                                  ? "Awaiting Allocation"
                                  : sp.status === "ON_LOAN"
                                  ? isOverdue
                                    ? `🚨 Overdue by ${Math.abs(diffDays || 0)}d`
                                    : `Active Loan (${diffDays}d left)`
                                  : sp.status === "RETURN_IN_TRANSIT"
                                  ? "🚚 Return In Transit"
                                  : sp.status === "RETURNED"
                                  ? "✓ Returned to Depot"
                                  : sp.status}
                              </span>
                            </div>

                            {sp.inventoryItem && (
                              <div className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 flex flex-wrap gap-x-4">
                                <span>
                                  Allocated Unit:{" "}
                                  <strong className="text-slate-900 dark:text-white">
                                    {sp.inventoryItem.name}
                                  </strong>
                                </span>
                                <span>
                                  S/N:{" "}
                                  <strong className="font-mono text-slate-900 dark:text-white">
                                    {sp.inventoryItem.serialNumber}
                                  </strong>
                                </span>
                                <span>
                                  Origin Hub:{" "}
                                  <strong>{sp.inventoryItem.warehouse?.name}</strong>
                                </span>
                              </div>
                            )}

                            {isLoanerItem && returnDate && (
                              <div className="text-xs mt-1 flex items-center gap-2 flex-wrap">
                                <span className="text-slate-500 font-semibold">
                                  Return Due:{" "}
                                  <strong className="text-slate-800 dark:text-slate-200">
                                    {returnDate.toLocaleDateString("en-MY")}
                                  </strong>{" "}
                                  ({sp.loanDurationDays || 14} days duration)
                                </span>
                              </div>
                            )}

                            {sp.dispatchTrackingNo && (
                              <div className="text-xs text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1 font-mono font-bold">
                                <span>🚚 Outbound ({sp.courierName || "Courier"}):</span>
                                <span>{sp.dispatchTrackingNo}</span>
                              </div>
                            )}

                            {sp.returnTrackingNo && (
                              <div className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 flex items-center gap-1 font-mono font-bold">
                                <span>📦 Return ({sp.returnCourierName || "Courier"}):</span>
                                <span>{sp.returnTrackingNo}</span>
                              </div>
                            )}

                            {sp.replacedDefectiveSerial && (
                              <div className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                                Replaced Defective Unit S/N:{" "}
                                <strong className="font-mono">{sp.replacedDefectiveSerial}</strong>
                              </div>
                            )}

                            {sp.notes && (
                              <p className="text-[11px] text-slate-500 italic mt-0.5">Notes: {sp.notes}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
                            {sp.status === "REQUESTED" && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenDispatchModal(sp)}
                                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition shadow-sm"
                                >
                                  Allocate & Dispatch
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCancelPart(sp.id)}
                                  className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-rose-600 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition"
                                >
                                  Cancel
                                </button>
                              </>
                            )}

                            {sp.status === "DISPATCHED" && !sp.isLoaner && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedPartToInstall(sp);
                                    setIsInstallModalOpen(true);
                                  }}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-sm"
                                >
                                  Mark Installed
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenDispatchModal(sp)}
                                  className="px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                  Edit Tracking
                                </button>
                              </>
                            )}

                            {sp.status === "ON_LOAN" && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedLoanToExtend(sp);
                                    setExtendDays(7);
                                    setExtendReason("");
                                    setIsExtendModalOpen(true);
                                  }}
                                  className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition"
                                >
                                  Extend (+Days)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedLoanToReturn(sp);
                                    setReturnCourier("");
                                    setReturnTracking("");
                                    setReturnNotes("");
                                    setIsReturnModalOpen(true);
                                  }}
                                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition shadow-sm"
                                >
                                  Initiate Return
                                </button>
                              </>
                            )}

                            {(sp.status === "RETURN_IN_TRANSIT" || sp.status === "ON_LOAN") && isLoanerItem && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedLoanToRestock(sp);
                                  setRestockCondition("GOOD");
                                  setRestockNotes("");
                                  setIsRestockModalOpen(true);
                                }}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-sm"
                              >
                                Inspect & Restock
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                </div>
              )}
            </div>

            {/* 4. 🛠️ Resolution Summary (When Resolved/Closed) */}
            {(ticket.resolutionDetails || ticket.status === "RESOLVED" || ticket.status === "COMPLETE" || ticket.status === "CLOSED") && (
              <div className="bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">✅</span>
                    <h2 className="text-xs font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                      4. Action Taken / Resolution Summary
                    </h2>
                  </div>

                  {ticket.resolvedAt && (
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-mono font-bold">
                      Resolved: {new Date(ticket.resolvedAt).toLocaleString("en-MY")}
                    </span>
                  )}
                </div>

                <div className="bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 space-y-2">
                  <p className="text-xs font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">
                    Onsite Work Resolution Notes:
                  </p>
                  <p className="text-sm text-slate-900 dark:text-slate-100 whitespace-pre-line leading-relaxed font-medium">
                    {ticket.resolutionDetails || "No detailed notes recorded."}
                  </p>
                </div>

                {ticket.serviceReportUrl && (
                  <div className="pt-2 flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs text-slate-700 dark:text-slate-300 font-bold">Official Signed Service Report:</span>
                    <a
                      href={ticket.serviceReportUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm inline-flex items-center gap-1.5"
                    >
                      <span>📄</span>
                      <span>Download Signed Service Report</span>
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* 4. 🕒 Chronology & Activity Timeline */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div
                className="flex justify-between items-center cursor-pointer select-none group border-b border-slate-200 dark:border-slate-800 pb-3"
                onClick={() => setIsChronologyExpanded(!isChronologyExpanded)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">🕒</span>
                  <h2 className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                    4. Chronology & Work History
                  </h2>
                  <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-0.5 rounded-full font-mono font-bold">
                    {ticket.activities?.length || 0}
                  </span>
                </div>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                  {isChronologyExpanded ? "Hide ▲" : "Expand ▼"}
                </span>
              </div>

              {isChronologyExpanded && (
                <div className="space-y-4 pt-1">
                  {/* Add Progress Comment Form */}
                  <form onSubmit={handleAddComment} className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                    <label className="block text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                      Record Progress Log / Work Note
                    </label>
                    <textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Describe what was done today (e.g., diagnostic checks, parts replaced, waiting for customer sign-off)..."
                      rows={2}
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs leading-relaxed font-medium"
                      required
                    />
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Posting as: <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{updateAuthor}</strong>
                      </span>
                      <button
                        type="submit"
                        disabled={isPending || !commentText.trim()}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        Add Progress Note
                      </button>
                    </div>
                  </form>

                  {/* Timeline Stream */}
                  <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-3 pl-6 space-y-6 pt-2">
                    {!ticket.activities || ticket.activities.length === 0 ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400 italic pl-2">No activity logs recorded yet.</p>
                    ) : (
                      ticket.activities.map((activity) => {
                        let icon = "⚙️";
                        let iconBg = "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300";
                        let title = activity.type;

                        if (activity.type === "STATUS_CHANGE") {
                          const sLabel = activity.status ? STATUS_CONFIG[activity.status as keyof typeof STATUS_CONFIG]?.label || activity.status : "Updated";
                          title = `Status updated to: ${sLabel}`;
                          icon = "📊";
                          iconBg = "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300";
                        } else if (activity.type === "COMMENT") {
                          title = "Work Progress Recorded";
                          icon = "📝";
                          iconBg = "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
                        } else if (activity.type === "ASSIGNMENT") {
                          title = "Dispatch Assignment";
                          icon = "👤";
                          iconBg = "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300";
                        } else if (activity.type === "ETA_UPDATE") {
                          title = "FE ETA Registered";
                          icon = "🕒";
                          iconBg = "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
                        } else if (activity.type === "FE_ACKNOWLEDGE") {
                          title = "Ticket Acknowledged by Engineer";
                          icon = "✓";
                          iconBg = "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300 font-bold";
                        } else if (activity.type === "SLA_PAUSE") {
                          title = "SLA Countdown Paused";
                          icon = "⏸️";
                          iconBg = "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300";
                        } else if (activity.type === "SLA_RESUME") {
                          title = "SLA Countdown Resumed";
                          icon = "▶️";
                          iconBg = "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300";
                        }

                        return (
                          <div key={activity.id} className="relative">
                            <span className={`absolute -left-9 top-0.5 w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${iconBg} shadow-sm border border-slate-200 dark:border-slate-700`}>
                              {icon}
                            </span>
                            <div className="bg-slate-50/80 dark:bg-slate-950/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                              <div className="flex items-center justify-between gap-4 flex-wrap">
                                <h4 className="text-xs font-black text-slate-900 dark:text-white">{title}</h4>
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono font-bold">
                                  {new Date(activity.createdAt).toLocaleString("en-MY", {
                                    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
                                  })}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">By {activity.author}</p>
                              {activity.notes && (
                                <div className="mt-2 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 whitespace-pre-wrap leading-relaxed font-medium">
                                  {activity.notes}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ═════════════════════════════════════════════════════════════════════════ */}
          {/* RIGHT COLUMN (35% / 4 Cols Sticky): SLA, Dispatch & Quick Status Actions */}
          {/* ═════════════════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-4 space-y-5 lg:sticky lg:top-20">

            {/* Acknowledgment Warning Banner */}
            {ticket.assignedFeId && ticket.feAcknowledgeStatus === "PENDING" && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl p-5 space-y-3 shadow-sm animate-in fade-in">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <h3 className="text-xs font-black text-amber-800 dark:text-amber-300 uppercase tracking-wide">
                      Awaiting Engineer Ack
                    </h3>
                    <p className="text-xs text-slate-800 dark:text-slate-200 font-bold mt-0.5">
                      {ticket.assignedFe?.name || "Field Engineer"} has not acknowledged yet.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAcknowledge}
                  disabled={isPending}
                  className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  Acknowledge Ticket (Act as FE)
                </button>
              </div>
            )}

            {/* 1. ⏱️ Live SLA Compliance Widget */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⏱️</span>
                  <h2 className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                    SLA Compliance
                  </h2>
                </div>
                {ticket.slaPaused && (
                  <span className="px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 text-[10px] font-extrabold border border-orange-300 dark:border-orange-800">
                    ⏸️ Frozen
                  </span>
                )}
              </div>

              {ticket.slaDeadline ? (
                <div className="p-3.5 bg-slate-50 dark:bg-slate-950/80 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-400 font-bold">Target Deadline:</span>
                    <span className="font-mono font-black text-slate-900 dark:text-white">
                      {new Date(ticket.slaDeadline).toLocaleString("en-MY", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-800">
                    <span className="text-xs text-slate-600 dark:text-slate-400 font-bold">Live SLA Countdown:</span>
                    <SlaCountdown
                      slaDeadline={ticket.slaDeadline}
                      status={ticket.status}
                      resolvedAt={ticket.resolvedAt}
                      updatedAt={ticket.updatedAt}
                      slaPaused={ticket.slaPaused}
                      slaPausedAt={ticket.slaPausedAt}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400 italic">No SLA rule assigned to this ticket.</p>
              )}
            </div>

            {/* 2. 🚀 Dispatch & Field Engineer Assignment */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
                <span className="text-lg">🚀</span>
                <h2 className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                  Dispatch & Assign
                </h2>
              </div>

              {/* Service Partner Dropdown */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                  Service Partner Agency
                </label>
                <select
                  value={ticket.partnerId ?? ""}
                  disabled={user?.role === "AGENT"}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : undefined;
                    handleAssignService(val, undefined);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/30 cursor-pointer disabled:opacity-60"
                >
                  <option value="">Unassigned</option>
                  {eligiblePartners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 italic">Filtered for partners in {ticket.state}</p>
              </div>

              {/* Field Engineer Dropdown */}
              {ticket.partnerId && assignedPartner && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                    Field Engineer
                  </label>
                  <select
                    value={ticket.assignedFeId ?? ""}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : undefined;
                      handleAssignService(ticket.partnerId!, val);
                    }}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/30 cursor-pointer"
                  >
                    <option value="">Select Field Engineer</option>
                    {(assignedPartner.engineers ?? []).map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} — {e.phone}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Assigned Engineer Card */}
              {ticket.assignedFe && (
                <div className="p-3.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl flex items-center gap-3">
                  {ticket.assignedFe.user?.avatarUrl ? (
                    <img
                      src={ticket.assignedFe.user.avatarUrl}
                      alt={ticket.assignedFe.name}
                      className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-sm flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-extrabold text-sm shadow-sm flex-shrink-0">
                      {ticket.assignedFe.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black text-indigo-700 dark:text-indigo-300 uppercase">Assigned Engineer</p>
                    <p className="text-xs font-black text-slate-900 dark:text-white truncate mt-0.5">{ticket.assignedFe.name}</p>
                    <p className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400 mt-0.5">{ticket.assignedFe.phone}</p>
                  </div>
                  {ticket.feAcknowledgeStatus && (
                    <span className={`px-2 py-0.5 text-[10px] font-black uppercase rounded-md border ${
                      ticket.feAcknowledgeStatus === "ACKNOWLEDGED"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                    }`}>
                      {ticket.feAcknowledgeStatus === "ACKNOWLEDGED" ? "✓ Ack" : "⏳ Pending"}
                    </span>
                  )}
                </div>
              )}

              {/* ETA Setter */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                  Arrival ETA
                </label>
                <div className="flex gap-2">
                  <input
                    type="datetime-local"
                    value={etaDate}
                    onChange={(e) => setEtaDate(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white flex-1 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSaveEta}
                    disabled={isPending || !etaDate}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    Set ETA
                  </button>
                </div>
              </div>
            </div>

            {/* 3. ⚡ Status & Lifecycle Actions */}
            {user?.role !== "AGENT" && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⚡</span>
                    <h2 className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                      Lifecycle Actions
                    </h2>
                  </div>
                </div>

                {/* Status Switcher Grid */}
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
                          if (st !== "FOLLOW_UP") setFollowUpSubStatus("");
                          if (st !== "ON_HOLD") setHoldReason("");
                          if (st !== "RESOLVED" && st !== "COMPLETE") setResolutionNotes("");
                        }}
                        disabled={isPending || isCurrentStatus}
                        className={`px-3 py-2 text-xs font-black rounded-xl border transition-all cursor-pointer ${
                          isCurrentStatus
                            ? `${s.badge} ring-2 ring-inset ${s.ring} opacity-90 cursor-default font-extrabold`
                            : isSelected
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                            : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                        }`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>

                {/* Status Parameter Prompt Drawer */}
                {selectedTargetStatus && selectedTargetStatus !== ticket.status && (
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3 animate-in fade-in">
                    {/* Hold Reason */}
                    {selectedTargetStatus === "ON_HOLD" && (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                          Hold Reason <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={holdReason}
                          onChange={(e) => setHoldReason(e.target.value)}
                          className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                          required
                        >
                          <option value="">Select Reason</option>
                          <option value="Awaiting Client Feedback">Awaiting Client Feedback</option>
                          <option value="Site Closed / Public Holiday">Site Closed / Public Holiday</option>
                          <option value="Spare Part Not Available">Spare Part Not Available</option>
                          <option value="Under Maintenance">Under Maintenance</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    )}

                    {/* Follow Up Sub-status */}
                    {selectedTargetStatus === "FOLLOW_UP" && (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                          Follow-up Reason <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={followUpSubStatus}
                          onChange={(e) => setFollowUpSubStatus(e.target.value)}
                          className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                          required
                        >
                          <option value="">Select Reason</option>
                          <option value="PENDING_PARTS">Pending Parts Delivery</option>
                          <option value="PENDING_SIGN_OFF">Pending Sign-off from User</option>
                          <option value="MONITORING">Active Monitoring</option>
                          <option value="OTHER">Other Reason</option>
                        </select>
                      </div>
                    )}

                    {/* Progress details for hold or follow-up */}
                    {(selectedTargetStatus === "ON_HOLD" || selectedTargetStatus === "FOLLOW_UP") && (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                          Work Done / Notes <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          placeholder="Describe reason or work completed..."
                          rows={2}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none"
                          required
                        />
                      </div>
                    )}

                    {/* Resolution Notes */}
                    {(selectedTargetStatus === "RESOLVED" || selectedTargetStatus === "COMPLETE") && (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                          Onsite Action Taken <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                          value={resolutionNotes}
                          onChange={(e) => setResolutionNotes(e.target.value)}
                          placeholder="What was fixed onsite? (e.g. replaced power cable, reinstalled driver)..."
                          rows={3}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none"
                          required
                        />
                      </div>
                    )}

                    {/* Confirm / Cancel Buttons */}
                    <div className="flex gap-2 justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTargetStatus(null);
                          setFollowUpSubStatus("");
                          setHoldReason("");
                          setResolutionNotes("");
                          setCommentText("");
                        }}
                        className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-bold cursor-pointer"
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
                                toast.success("Ticket resolved successfully!");
                              } catch (err) {
                                toast.error("Error resolving ticket: " + (err instanceof Error ? err.message : String(err)));
                              }
                            });
                          } else if (selectedTargetStatus === "ON_HOLD") {
                            const notesWithReason = `Hold Reason: ${holdReason}. Work Done: ${commentText}`;
                            handleUpdateStatus(selectedTargetStatus, holdReason, notesWithReason);
                          } else {
                            handleUpdateStatus(selectedTargetStatus, followUpSubStatus, commentText);
                          }
                        }}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        Confirm Status Update
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* MODAL: Request Spare Part */}
      {isRequestPartModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>📦</span> Request Spare Part
              </h3>
              <button
                type="button"
                onClick={() => setIsRequestPartModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitPartRequest} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Part Name / Description *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 500W Power Supply ATX / Roller Kit"
                  value={reqPartName}
                  onChange={(e) => setReqPartName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Quantity Required
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={reqPartQty}
                  onChange={(e) => setReqPartQty(Number(e.target.value) || 1)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Notes / Fault Context
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Current PSU smoked on site, urgent replacement required..."
                  value={reqPartNotes}
                  onChange={(e) => setReqPartNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRequestPartModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-sm disabled:opacity-50"
                >
                  {isPending ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Allocate & Dispatch Spare Part */}
      {isDispatchModalOpen && selectedPartToDispatch && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>🚚</span> Allocate & Dispatch Spare Part
              </h3>
              <button
                type="button"
                onClick={() => setIsDispatchModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitDispatch} className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 font-bold uppercase text-[10px] block">Requested Part</span>
                <span className="font-bold text-slate-900 dark:text-white text-sm">
                  {selectedPartToDispatch.requestedPartName} (Qty: {selectedPartToDispatch.quantity})
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Select Available Item from Inventory *
                </label>
                <select
                  required
                  value={selectedStockItemId}
                  onChange={(e) => setSelectedStockItemId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                >
                  <option value="">-- Choose Stock Item --</option>
                  {availableStockItems.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} | S/N: {i.serialNumber} ({i.warehouse?.name})
                    </option>
                  ))}
                </select>
                {availableStockItems.length === 0 && (
                  <p className="text-[11px] text-rose-500 mt-1">
                    No items in AVAILABLE status in inventory. Please register stock in the Inventory Tab.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Courier / Method
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. J&T Express / PosLaju"
                    value={dispatchCourierName}
                    onChange={(e) => setDispatchCourierName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tracking Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. JT987654321MY"
                    value={dispatchTrackingNo}
                    onChange={(e) => setDispatchTrackingNo(e.target.value)}
                    className="w-full font-mono px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Dispatched to FE Ahmad at site..."
                  value={dispatchNotes}
                  onChange={(e) => setDispatchNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsDispatchModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !selectedStockItemId}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-sm disabled:opacity-50"
                >
                  {isPending ? "Dispatching..." : "Confirm Dispatch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Mark Installed */}
      {isInstallModalOpen && selectedPartToInstall && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>✅</span> Confirm Hardware Installation
              </h3>
              <button
                type="button"
                onClick={() => setIsInstallModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmInstall} className="space-y-3 text-xs">
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                Confirm that <strong>{selectedPartToInstall.inventoryItem?.name || selectedPartToInstall.requestedPartName}</strong> was
                successfully installed and tested on site.
              </p>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Replaced Defective Serial Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. SN-OLD-PSU-9921"
                  value={installDefectiveSerial}
                  onChange={(e) => setInstallDefectiveSerial(e.target.value)}
                  className="w-full font-mono px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white uppercase"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Entering the old serial will automatically register the defective unit in warehouse RMA tracking.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsInstallModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-sm disabled:opacity-50"
                >
                  {isPending ? "Saving..." : "Confirm Installation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Extend Standby Loan Duration */}
      {isExtendModalOpen && selectedLoanToExtend && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>⏱️</span> Extend Standby Loan Duration
              </h3>
              <button
                type="button"
                onClick={() => setIsExtendModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExtendLoan} className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 font-bold uppercase text-[10px] block">Standby Hardware</span>
                <span className="font-bold text-slate-900 dark:text-white text-sm">
                  {selectedLoanToExtend.inventoryItem?.name || selectedLoanToExtend.requestedPartName}
                </span>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                  S/N: {selectedLoanToExtend.inventoryItem?.serialNumber || "—"}
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Additional Days to Extend *
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[7, 14, 21, 30].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setExtendDays(days)}
                      className={`py-1 text-xs font-bold rounded-lg border transition ${
                        extendDays === days
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                          : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      +{days}d
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min={1}
                  max={90}
                  required
                  value={extendDays}
                  onChange={(e) => setExtendDays(Number(e.target.value) || 7)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Extension (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. RMA mainboard delayed by vendor, client requested extension..."
                  value={extendReason}
                  onChange={(e) => setExtendReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsExtendModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-sm disabled:opacity-50"
                >
                  {isPending ? "Extending..." : `Confirm +${extendDays} Days`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Initiate Loaner Return */}
      {isReturnModalOpen && selectedLoanToReturn && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>🚚</span> Initiate Standby Loaner Return
              </h3>
              <button
                type="button"
                onClick={() => setIsReturnModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleInitiateReturn} className="space-y-3 text-xs">
              <p className="text-slate-600 dark:text-slate-300">
                Register inbound courier / handover for returning <strong>{selectedLoanToReturn.inventoryItem?.name || selectedLoanToReturn.requestedPartName}</strong> (S/N: {selectedLoanToReturn.inventoryItem?.serialNumber}) back to depot.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Courier / Transporter
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. J&T / PosLaju / Handover"
                    value={returnCourier}
                    onChange={(e) => setReturnCourier(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tracking Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. JT8827361MY"
                    value={returnTracking}
                    onChange={(e) => setReturnTracking(e.target.value)}
                    className="w-full font-mono px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Notes</label>
                <textarea
                  rows={2}
                  placeholder="Optional return notes or packing details..."
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsReturnModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-sm disabled:opacity-50"
                >
                  {isPending ? "Saving..." : "Mark as Return in Transit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Inspect & Restock Loaner */}
      {isRestockModalOpen && selectedLoanToRestock && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>✅</span> Inspect & Restock Loaner
              </h3>
              <button
                type="button"
                onClick={() => setIsRestockModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRestockLoan} className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="font-bold text-slate-900 dark:text-white text-sm">
                  {selectedLoanToRestock.inventoryItem?.name || selectedLoanToRestock.requestedPartName}
                </span>
                <p className="text-[11px] text-slate-500 font-mono">
                  S/N: {selectedLoanToRestock.inventoryItem?.serialNumber}
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Physical Condition Inspection Check *
                </label>
                <select
                  value={restockCondition}
                  onChange={(e: any) => setRestockCondition(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-bold"
                >
                  <option value="GOOD">✓ Good Condition (Ready to return to AVAILABLE stock)</option>
                  <option value="DAMAGED_NEEDS_REPAIR">⚠️ Damaged / Needs Repair (Moves to Defective RMA)</option>
                  <option value="MISSING_ACCESSORIES">⚠️ Missing Accessories (Cables / PSU missing)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Restock Notes</label>
                <textarea
                  rows={2}
                  placeholder="Optional condition inspection notes..."
                  value={restockNotes}
                  onChange={(e) => setRestockNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRestockModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-sm disabled:opacity-50"
                >
                  {isPending ? "Saving..." : "Confirm Restock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}



/* ── High Contrast Reusable Info Cell Component ── */
function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">{label}</p>
      <p className={`text-sm text-slate-900 dark:text-slate-100 font-extrabold ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
