"use client";

import React, { useState, useTransition, useEffect, useMemo } from "react";
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
  uploadServiceReport,
  updateTicket,
  createEndCustomerSite,
  submitPartReplacementClaimAction,
} from "../actions";
import { toast } from "sonner";
import { getEffectiveCustomFields } from "@/lib/customFields";

/* ─── Shared type definitions ─── */
interface Maincon {
  id: number;
  name: string;
  sheetName: string;
  customFieldsSchema: unknown;
  siteCustomers?: unknown;
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
  restrictedTo?: string | null;
}

interface State {
  id: number;
  name: string;
}

interface EndCustomerSite {
  id: number;
  name: string;
  group: string;
  state: string;
  mainconId: number;
}

interface SlaRuleLike {
  customer: string;
  severity: string;
  region: string;
  slaHours: number;
}

interface TicketActivity {
  id: number;
  ticketId: number;
  type: string;
  status: string | null;
  subStatus: string | null;
  notes: string | null;
  attachmentUrl?: string | null;
  author: string;
  createdAt: Date | string;
}

interface TicketSparePart {
  id: number;
  ticketId: number;
  requestedPartName: string;
  quantity: number;
  status:
    | "PENDING_APPROVAL"
    | "APPROVED"
    | "REJECTED"
    | "REQUESTED"
    | "ALLOCATED"
    | "DISPATCHED"
    | "INSTALLED"
    | "ON_LOAN"
    | "RETURN_IN_TRANSIT"
    | "RETURNED"
    | "CANCELLED";
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
  batchTrackingNo?: string | null;
  dispatchedAt?: Date | string | null;
  installedAt?: Date | string | null;
  replacedDefectiveSerial?: string | null;
  requestedBy?: string | null;
  approvedBy?: string | null;
  approvedAt?: Date | string | null;
  rejectionReason?: string | null;
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

interface PartReplacementClaim {
  id: number;
  ticketId: number;
  partnerId: number;
  inventoryItemId?: number | null;
  partName: string;
  serialNumber?: string | null;
  defectiveSerial?: string | null;
  claimAmount?: number | null;
  status: "PENDING" | "APPROVED_REPLENISH" | "APPROVED_REIMBURSE" | "REJECTED" | "CANCELLED";
  settlementType?: string | null;
  replacementItemId?: number | null;
  requestedBy: string;
  approvedBy?: string | null;
  approvedAt?: Date | string | null;
  rejectionReason?: string | null;
  notes?: string | null;
  createdAt: Date | string;
  partner?: { id: number; name: string };
  inventoryItem?: { id: number; name: string; serialNumber?: string | null; ownership?: string };
}

interface Ticket {
  id: number;
  ticketRefNo: string | null;
  clientSiteName: string;
  state: string;
  issueDescription: string;
  status: "NEW" | "IN_PROGRESS" | "ON_HOLD" | "RESOLVED" | "FOLLOW_UP" | "COMPLETE" | "CLOSED" | "CANCELLED";
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
  createdById?: string | null;
  createdByName?: string | null;
  createdBy?: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  } | null;
  activities?: TicketActivity[];
  spareParts?: TicketSparePart[];
  replacementClaims?: PartReplacementClaim[];
}

interface Props {
  ticket: Ticket;
  partners: ServicePartner[];
  maincons?: Maincon[];
  devices?: DeviceCatalog[];
  states?: State[];
  initialSites?: EndCustomerSite[];
  slaRules?: SlaRuleLike[];
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
  CANCELLED: { label: "Cancelled", dot: "bg-rose-500", badge: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30", ring: "ring-rose-500/20 border-rose-600" },
} as const;

function renderSeverityBadge(severity: string | null) {
  if (!severity) return null;
  const config: Record<string, { label: string; badge: string }> = {
    P1: { label: "P1 Critical", badge: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/40" },
    P2: { label: "P2 High", badge: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/40" },
    P3: { label: "P3 Medium", badge: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/40" },
    P4: { label: "P4 Low", badge: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/40" },
    NA: { label: "NA (No SLA)", badge: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/40" },
  };
  const c = config[severity] || { label: severity, badge: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md border text-xs font-semibold ${c.badge}`}>
      {c.label}
    </span>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="bg-slate-50/80 dark:bg-slate-950/60 p-3 rounded-lg border border-slate-200/80 dark:border-slate-800/80">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
        {label}
      </span>
      <span className={`text-xs sm:text-sm font-semibold text-slate-900 dark:text-white break-words ${mono ? "font-mono" : ""}`}>
        {value || "—"}
      </span>
    </div>
  );
}

type WorkspaceTab = "activity" | "spare-parts" | "hardware" | "report";

export default function TicketWorkspace({ 
  ticket: initialTicket, 
  partners,
  maincons = [],
  devices = [],
  states = [],
  initialSites = [],
  slaRules = [],
}: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<Ticket>(initialTicket);

  // Role booleans
  const isSuperadmin = user?.role === "SUPERADMIN";
  const isModerator = user?.role === "MODERATOR";
  const isAgent = user?.role === "AGENT";
  const canEditDetails = isSuperadmin || isModerator;

  // Realtime Polling Fallback
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

  // Active Workspace Tab (Jira/ServiceNow Layout)
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("activity");

  // In-Page Edit Drawer state
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);

  // Quick Action States
  const [copied, setCopied] = useState(false);
  const [selectedTargetStatus, setSelectedTargetStatus] = useState<Ticket["status"] | null>(null);
  const [followUpSubStatus, setFollowUpSubStatus] = useState<string>(ticket.subStatus || "MONITORING");
  const [holdReason, setHoldReason] = useState(ticket.holdReason || "");

  // Cancellation Modal states
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReasonPreset, setCancelReasonPreset] = useState("Duplicate Ticket logged");
  const [cancelCustomReason, setCancelCustomReason] = useState("");

  // Activity comments
  const [commentText, setCommentText] = useState("");
  const [updateAuthor] = useState(user?.name || (isSuperadmin ? "Admin" : isModerator ? "Moderator" : "Agent"));
  const [etaDate, setEtaDate] = useState(ticket.eta ? new Date(ticket.eta).toISOString().slice(0, 16) : "");

  // Spare Parts management states
  const [isRequestPartModalOpen, setIsRequestPartModalOpen] = useState(false);
  const [reqPartName, setReqPartName] = useState("");
  const [reqPartQty, setReqPartQty] = useState(1);
  const [reqPartNotes, setReqPartNotes] = useState("");
  const [reqIsLoaner, setReqIsLoaner] = useState(false);
  const [reqLoanDays, setReqLoanDays] = useState(14);

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

  // Loaner lifecycle states
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

  // Part Replacement Claim states
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [claimPartName, setClaimPartName] = useState("");
  const [claimSerialNumber, setClaimSerialNumber] = useState("");
  const [claimDefectiveSerial, setClaimDefectiveSerial] = useState("");
  const [claimAmount, setClaimAmount] = useState("");
  const [claimNotes, setClaimNotes] = useState("");
  const [claimInventoryItemId, setClaimInventoryItemId] = useState("");
  const [claimPartnerId, setClaimPartnerId] = useState("");

  // Resolution Modal states
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [resolveTargetStatus, setResolveTargetStatus] = useState<"RESOLVED" | "COMPLETE">("RESOLVED");
  const [resolveDate, setResolveDate] = useState<string>(() => {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
  });
  const [resolveNotes, setResolveNotes] = useState(ticket.resolutionDetails || "");
  const [resolveServiceReportUrl, setResolveServiceReportUrl] = useState(ticket.serviceReportUrl || "");
  const [resolveDefectiveSerial, setResolveDefectiveSerial] = useState(ticket.defectiveSerial || "");
  const [resolveDefectiveReturnStatus, setResolveDefectiveReturnStatus] = useState(ticket.defectiveReturnStatus || "PENDING_RETURN");
  const [isUploadingReport, setIsUploadingReport] = useState(false);
  const [isStandaloneUploading, setIsStandaloneUploading] = useState(false);

  // Interim Visit Report Upload Modal (For Follow-Ups & Daily Slips)
  const [isInterimReportModalOpen, setIsInterimReportModalOpen] = useState(false);
  const [interimStage, setInterimStage] = useState<string>("INTERIM_VISIT");
  const [interimNotes, setInterimNotes] = useState("");

  /* ─── Drawer Edit Form States ─── */
  const [drawerRefNo, setDrawerRefNo] = useState(ticket.ticketRefNo || "");
  const [drawerClientSiteName, setDrawerClientSiteName] = useState(ticket.clientSiteName);
  const [drawerState, setDrawerState] = useState(ticket.state);
  const [drawerIssueDescription, setDrawerIssueDescription] = useState(ticket.issueDescription);
  const [drawerMainconId, setDrawerMainconId] = useState(String(ticket.mainconId));
  const [drawerCustomValues, setDrawerCustomValues] = useState<Record<string, string>>(
    safeParseJson<Record<string, string>>(ticket.customValues, {})
  );
  const [drawerDeviceId, setDrawerDeviceId] = useState(ticket.deviceId ? String(ticket.deviceId) : "");
  const [drawerDeviceStatus, setDrawerDeviceStatus] = useState<"STANDARD" | "ON_REQUEST">(
    ticket.deviceStatus || "STANDARD"
  );
  const [drawerCustomDeviceDetails, setDrawerCustomDeviceDetails] = useState(ticket.customDeviceDetails || "");
  const [drawerSeverity, setDrawerSeverity] = useState<string>(ticket.severity || "P3");
  const [drawerDefectiveSerial, setDrawerDefectiveSerial] = useState(ticket.defectiveSerial || "");
  const [drawerDefectiveReturnStatus, setDrawerDefectiveReturnStatus] = useState(ticket.defectiveReturnStatus || "PENDING");
  
  // Sites & Autocomplete for Drawer
  const [drawerSites, setDrawerSites] = useState<EndCustomerSite[]>(initialSites);
  const [drawerSelectedSiteId, setDrawerSelectedSiteId] = useState<number | null>(ticket.siteId);
  const [drawerEndCustomer, setDrawerEndCustomer] = useState(ticket.endCustomer || "");
  const [drawerSiteSearchQuery, setDrawerSiteSearchQuery] = useState(ticket.clientSiteName);
  const [isDrawerSiteDropdownOpen, setIsDrawerSiteDropdownOpen] = useState(false);
  const [drawerDeviceSearchQuery, setDrawerDeviceSearchQuery] = useState(
    ticket.device ? `${ticket.device.category} - ${ticket.device.brand} ${ticket.device.model}` : ""
  );
  const [isDrawerDeviceDropdownOpen, setIsDrawerDeviceDropdownOpen] = useState(false);
  const [isSavingDrawer, setIsSavingDrawer] = useState(false);

  // Sync drawer values when opening
  const handleOpenEditDrawer = () => {
    setDrawerRefNo(ticket.ticketRefNo || "");
    setDrawerClientSiteName(ticket.clientSiteName);
    setDrawerState(ticket.state);
    setDrawerIssueDescription(ticket.issueDescription);
    setDrawerMainconId(String(ticket.mainconId));
    setDrawerCustomValues(safeParseJson<Record<string, string>>(ticket.customValues, {}));
    setDrawerDeviceId(ticket.deviceId ? String(ticket.deviceId) : "");
    setDrawerDeviceStatus(ticket.deviceStatus || "STANDARD");
    setDrawerCustomDeviceDetails(ticket.customDeviceDetails || "");
    setDrawerSeverity(ticket.severity || "P3");
    setDrawerDefectiveSerial(ticket.defectiveSerial || "");
    setDrawerDefectiveReturnStatus(ticket.defectiveReturnStatus || "PENDING");
    setDrawerSelectedSiteId(ticket.siteId);
    setDrawerEndCustomer(ticket.endCustomer || "");
    setDrawerSiteSearchQuery(ticket.clientSiteName);
    setDrawerDeviceSearchQuery(ticket.device ? `${ticket.device.category} - ${ticket.device.brand} ${ticket.device.model}` : "");
    setIsEditDrawerOpen(true);
  };

  const handleSaveEditDrawer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!drawerClientSiteName.trim() || !drawerIssueDescription.trim()) {
      toast.error("Please fill in site name and issue description.");
      return;
    }

    setIsSavingDrawer(true);
    try {
      await updateTicket(ticket.id, {
        ticketRefNo: drawerRefNo.trim() || undefined,
        clientSiteName: drawerClientSiteName.trim(),
        state: drawerState,
        issueDescription: drawerIssueDescription.trim(),
        mainconId: Number(drawerMainconId),
        customValues: drawerCustomValues,
        deviceId: drawerDeviceId ? Number(drawerDeviceId) : null,
        deviceStatus: drawerDeviceStatus,
        customDeviceDetails: drawerCustomDeviceDetails.trim() || null,
        severity: drawerSeverity as any,
        defectiveSerial: drawerDefectiveSerial.trim() || null,
        defectiveReturnStatus: drawerDefectiveReturnStatus || null,
        siteId: drawerSelectedSiteId,
        endCustomer: drawerEndCustomer || null,
      });

      const fresh = await getTicketById(ticket.id);
      if (fresh) setTicket(fresh as unknown as Ticket);
      setIsEditDrawerOpen(false);
      toast.success("Ticket details updated successfully.");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to update ticket.");
    } finally {
      setIsSavingDrawer(false);
    }
  };

  /* ─── State Machine: Allowed Transitions Calculation ─── */
  const allowedStatuses = useMemo((): Array<Ticket["status"]> => {
    const cur = ticket.status;

    if (isSuperadmin) {
      if (cur === "CLOSED" || cur === "CANCELLED") {
        return ["NEW", "IN_PROGRESS"]; // Superadmin can re-open
      }
      const all: Array<Ticket["status"]> = ["NEW", "IN_PROGRESS", "ON_HOLD", "FOLLOW_UP", "RESOLVED", "COMPLETE", "CLOSED", "CANCELLED"];
      return all.filter((s) => s !== cur);
    }

    if (isModerator) {
      if (cur === "NEW") return ["IN_PROGRESS", "ON_HOLD", "CANCELLED"];
      if (cur === "IN_PROGRESS") return ["FOLLOW_UP", "ON_HOLD", "RESOLVED", "CANCELLED"];
      if (cur === "FOLLOW_UP") return ["IN_PROGRESS", "RESOLVED", "CANCELLED"];
      if (cur === "ON_HOLD") return ["IN_PROGRESS", "CANCELLED"];
      if (cur === "RESOLVED") return ["COMPLETE", "CLOSED"];
      return []; // Locked if COMPLETE, CLOSED, CANCELLED
    }

    if (isAgent) {
      if (cur === "NEW") return ["IN_PROGRESS"];
      if (cur === "IN_PROGRESS") return ["FOLLOW_UP", "ON_HOLD", "RESOLVED"];
      if (cur === "FOLLOW_UP") return ["IN_PROGRESS", "RESOLVED"];
      if (cur === "ON_HOLD") return ["IN_PROGRESS"];
      if (cur === "RESOLVED") return ["COMPLETE"];
      return []; // Locked if COMPLETE, CLOSED, CANCELLED
    }

    return [];
  }, [ticket.status, isSuperadmin, isModerator, isAgent]);

  /* ─── Custom Fields Parsed ─── */
  const customFields = getEffectiveCustomFields(ticket.maincon?.customFieldsSchema, ticket.endCustomer);
  const customValues = safeParseJson<Record<string, string>>(ticket.customValues, {});

  /* ─── WhatsApp Dispatch Notice Generator (Includes Custom Fields) ─── */
  const handleCopyToWhatsapp = () => {
    const sc = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.NEW;
    const ref = ticket.ticketRefNo || `TKT-#${ticket.id}`;
    const mainconName = ticket.maincon?.name || "N/A";
    const cust = ticket.endCustomer ? `\n*End-Customer:* ${ticket.endCustomer}` : "";
    const dev = ticket.device 
      ? `\n*Hardware:* ${ticket.device.brand} ${ticket.device.model} (${ticket.device.category})`
      : ticket.customDeviceDetails ? `\n*Hardware:* ${ticket.customDeviceDetails}` : "";
    const defective = ticket.defectiveSerial ? `\n*Defective S/N:* ${ticket.defectiveSerial}` : "";
    const etaStr = ticket.eta ? `\n*FE Arrival ETA:* ${new Date(ticket.eta).toLocaleString("en-MY", { dateStyle: "short", timeStyle: "short" })}` : "";
    const ackStr = ticket.feAcknowledgeStatus === "ACKNOWLEDGED" ? " [Acked]" : "";
    const feName = ticket.assignedFe?.name ? `\n*Engineer:* ${ticket.assignedFe.name} (${ticket.assignedFe.phone})${ackStr}` : "";
    const reportLink = ticket.serviceReportUrl ? `\n*Service Report:* ${ticket.serviceReportUrl}` : "";

    // Append Requestor Information (End-Customer Custom Details)
    let customFieldsBlock = "";
    if (customFields.length > 0) {
      const fieldLines = customFields
        .map((fName) => {
          const val = customValues[fName];
          return val ? `• *${fName}:* ${val}` : null;
        })
        .filter(Boolean);

      if (fieldLines.length > 0) {
        const reqHeader = ticket.endCustomer 
          ? `*Requestor Information (${ticket.endCustomer}):*` 
          : ticket.maincon?.name 
          ? `*Requestor Information (${ticket.maincon.name}):*` 
          : `*Requestor Information:*`;
        customFieldsBlock = `\n${reqHeader}\n${fieldLines.join("\n")}`;
      }
    }

    const text = `*TICKET DISPATCH NOTICE*
*Ticket No:* ${ref}
*Client / Maincon:* ${mainconName}${cust}
*Site Name:* ${ticket.clientSiteName} (${ticket.state})
*Severity:* ${ticket.severity || "Standard"}
*Current Status:* ${sc.label}${feName}${etaStr}${dev}${defective}${customFieldsBlock}
*Issue Description:*
${ticket.issueDescription}${reportLink}
----------------------------------------
_TicketLink System_`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("WhatsApp dispatch notice copied to clipboard.");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleAssignService = (partnerId?: number, engineerId?: number) => {
    // If agent tries to change the partner agency to something other than their own, block it
    if (isAgent && partnerId && user?.partnerId && partnerId !== user.partnerId) {
      toast.error("Agents cannot reassign tickets to other partner agencies.");
      return;
    }

    const effectivePartnerId = isAgent ? (user?.partnerId || ticket.partnerId || partnerId) : partnerId;

    startTransition(async () => {
      try {
        await assignServiceDetails({
          ticketId: ticket.id,
          partnerId: effectivePartnerId || undefined,
          assignedFeId: engineerId || undefined,
          author: user?.name || (isAgent ? "Partner Agent" : updateAuthor),
        });
        const fresh = await getTicketById(ticket.id);
        if (fresh) setTicket(fresh as unknown as Ticket);
        toast.success("Service assignment updated.");
        router.refresh();
      } catch (err: any) {
        toast.error("Error updating assignment: " + (err.message || String(err)));
      }
    });
  };

  const handleStatusChange = (targetStatus: Ticket["status"]) => {
    startTransition(async () => {
      try {
        await updateTicketStatus(
          ticket.id,
          targetStatus,
          targetStatus === "FOLLOW_UP" ? followUpSubStatus : null,
          targetStatus === "ON_HOLD" ? holdReason : undefined,
          updateAuthor
        );
        const fresh = await getTicketById(ticket.id);
        if (fresh) setTicket(fresh as unknown as Ticket);
        setSelectedTargetStatus(null);
        toast.success(`Status updated to ${STATUS_CONFIG[targetStatus]?.label || targetStatus}.`);
        router.refresh();
      } catch (err: any) {
        toast.error("Error updating status: " + (err.message || String(err)));
      }
    });
  };

  const handleConfirmCancellation = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason = cancelCustomReason.trim() 
      ? `${cancelReasonPreset}: ${cancelCustomReason.trim()}`
      : cancelReasonPreset;

    startTransition(async () => {
      try {
        await updateTicketStatus(
          ticket.id,
          "CANCELLED",
          null,
          `Cancelled: ${finalReason}`,
          updateAuthor
        );
        const fresh = await getTicketById(ticket.id);
        if (fresh) setTicket(fresh as unknown as Ticket);
        setIsCancelModalOpen(false);
        setSelectedTargetStatus(null);
        toast.success("Ticket has been cancelled.");
        router.refresh();
      } catch (err: any) {
        toast.error("Error cancelling ticket: " + (err.message || String(err)));
      }
    });
  };

  const handleAcknowledge = () => {
    startTransition(async () => {
      try {
        await acknowledgeTicket(ticket.id, null, updateAuthor);
        const fresh = await getTicketById(ticket.id);
        if (fresh) setTicket(fresh as unknown as Ticket);
        toast.success("Ticket acknowledged.");
        router.refresh();
      } catch (err: any) {
        toast.error("Error acknowledging ticket: " + (err.message || String(err)));
      }
    });
  };

  const handleSaveEta = () => {
    if (!etaDate) return;
    startTransition(async () => {
      try {
        await updateTicketEta(ticket.id, new Date(etaDate), updateAuthor);
        const fresh = await getTicketById(ticket.id);
        if (fresh) setTicket(fresh as unknown as Ticket);
        toast.success("Estimated Arrival Time (ETA) updated.");
        router.refresh();
      } catch (err: any) {
        toast.error("Error setting ETA: " + (err.message || String(err)));
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
        const fresh = await getTicketById(ticket.id);
        if (fresh) setTicket(fresh as unknown as Ticket);
        toast.success("Work note posted.");
        router.refresh();
      } catch (err: any) {
        toast.error("Error adding work note: " + (err.message || String(err)));
      }
    });
  };

  const handleUploadReportFile = async (file: File, isStandalone: boolean = false, notes?: string, stage?: string) => {
    if (!file) return;
    const toastId = toast.loading(`Uploading ${file.name}...`);
    if (isStandalone) setIsStandaloneUploading(true);
    else setIsUploadingReport(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to upload file");
      }
      const data = await res.json();
      if (isStandalone) {
        await uploadServiceReport(ticket.id, data.url, updateAuthor, notes, stage);
        const fresh = await getTicketById(ticket.id);
        if (fresh) setTicket(fresh as unknown as Ticket);
        toast.success("Service report attached successfully.", { id: toastId });
        setIsInterimReportModalOpen(false);
        setInterimNotes("");
      } else {
        setResolveServiceReportUrl(data.url);
        toast.success("File attached.", { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to upload report.", { id: toastId });
    } finally {
      if (isStandalone) setIsStandaloneUploading(false);
      else setIsUploadingReport(false);
    }
  };

  const handleOpenResolveModal = (target: "RESOLVED" | "COMPLETE") => {
    setResolveTargetStatus(target);
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    setResolveDate(new Date(now.getTime() - tzOffset).toISOString().slice(0, 16));
    setResolveServiceReportUrl(ticket.serviceReportUrl || "");
    setResolveDefectiveSerial(ticket.defectiveSerial || "");
    setResolveDefectiveReturnStatus(ticket.defectiveReturnStatus || "PENDING_RETURN");
    setResolveNotes(ticket.resolutionDetails || "");
    setIsResolveModalOpen(true);
  };

  const handleConfirmResolution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolveNotes.trim()) {
      toast.error("Please provide resolution notes.");
      return;
    }

    startTransition(async () => {
      try {
        const resolvedAtTimestamp = new Date(resolveDate);
        await updateTicketResolution(
          ticket.id,
          resolveNotes.trim(),
          resolvedAtTimestamp,
          updateAuthor,
          resolveServiceReportUrl || undefined,
          resolveDefectiveSerial.trim() || undefined,
          resolveDefectiveReturnStatus.trim() || undefined
        );

        if (resolveTargetStatus === "COMPLETE") {
          await updateTicketStatus(ticket.id, "COMPLETE", null, `Status set to Complete.`, updateAuthor);
        }

        const fresh = await getTicketById(ticket.id);
        if (fresh) setTicket(fresh as unknown as Ticket);
        setIsResolveModalOpen(false);
        toast.success(`Ticket marked as ${resolveTargetStatus}.`);
        router.refresh();
      } catch (err: any) {
        toast.error("Error saving resolution: " + (err.message || String(err)));
      }
    });
  };

  // Spare parts actions
  const handleRequestSparePart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqPartName.trim()) return;
    startTransition(async () => {
      try {
        await requestTicketSparePart({
          ticketId: ticket.id,
          requestedPartName: reqPartName,
          quantity: Number(reqPartQty) || 1,
          notes: reqPartNotes || undefined,
          author: updateAuthor,
        });
        const fresh = await getTicketById(ticket.id);
        if (fresh) setTicket(fresh as unknown as Ticket);
        setIsRequestPartModalOpen(false);
        setReqPartName("");
        setReqPartQty(1);
        setReqPartNotes("");
        setReqIsLoaner(false);
        toast.success(reqIsLoaner ? "Standby loaner requested." : "Spare part requested.");
      } catch (err: any) {
        toast.error(err.message || "Failed to request part.");
      }
    });
  };

  const handleOpenDispatchModal = async (part: TicketSparePart) => {
    setSelectedPartToDispatch(part);
    setSelectedStockItemId("");
    setDispatchCourierName("");
    setDispatchTrackingNo("");
    setDispatchNotes("");
    setIsDispatchModalOpen(true);
    try {
      const items = await getInventoryItems();
      const available = items.filter((i: any) => i.status === "AVAILABLE");
      setAvailableStockItems(available);
    } catch {
      setAvailableStockItems([]);
    }
  };

  const handleAllocateAndDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartToDispatch) return;
    startTransition(async () => {
      try {
        if (selectedPartToDispatch.isLoaner) {
          if (!selectedStockItemId) {
            toast.error("Please select a physical stock item.");
            return;
          }
          await allocateAndDispatchLoanerUnit({
            ticketId: ticket.id,
            inventoryItemId: Number(selectedStockItemId),
            loanDurationDays: 14,
            courierName: dispatchCourierName || undefined,
            dispatchTrackingNo: dispatchTrackingNo || undefined,
            loanNotes: dispatchNotes || undefined,
            author: updateAuthor,
          });
        } else {
          await allocateAndDispatchSparePart({
            ticketSparePartId: selectedPartToDispatch.id,
            inventoryItemId: Number(selectedStockItemId),
            courierName: dispatchCourierName || undefined,
            dispatchTrackingNo: dispatchTrackingNo || undefined,
            notes: dispatchNotes || undefined,
            author: updateAuthor,
          });
        }
        const fresh = await getTicketById(ticket.id);
        if (fresh) setTicket(fresh as unknown as Ticket);
        setIsDispatchModalOpen(false);
        setSelectedPartToDispatch(null);
        toast.success("Part dispatched.");
      } catch (err: any) {
        toast.error(err.message || "Failed to dispatch part.");
      }
    });
  };

  const handleOpenInstallModal = (part: TicketSparePart) => {
    setSelectedPartToInstall(part);
    setInstallDefectiveSerial(ticket.defectiveSerial || "");
    setIsInstallModalOpen(true);
  };

  const handleMarkInstalled = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartToInstall) return;
    startTransition(async () => {
      try {
        await markSparePartInstalled({
          ticketSparePartId: selectedPartToInstall.id,
          defectiveSerial: installDefectiveSerial || undefined,
          author: updateAuthor,
        });
        const fresh = await getTicketById(ticket.id);
        if (fresh) setTicket(fresh as unknown as Ticket);
        setIsInstallModalOpen(false);
        setSelectedPartToInstall(null);
        toast.success("Spare part marked as installed.");
      } catch (err: any) {
        toast.error(err.message || "Failed to mark installed.");
      }
    });
  };

  const handleCancelPart = async (partId: number) => {
    if (!confirm("Cancel this spare part request?")) return;
    startTransition(async () => {
      try {
        await cancelSparePartRequest(partId, updateAuthor);
        const fresh = await getTicketById(ticket.id);
        if (fresh) setTicket(fresh as unknown as Ticket);
        toast.success("Part request cancelled.");
      } catch (err: any) {
        toast.error(err.message || "Failed to cancel part request.");
      }
    });
  };

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
        toast.success(`Loan extended by +${extendDays} days.`);
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
        toast.success("Loaner return initiated.");
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
        toast.success("Standby loaner restocked.");
      } catch (err: any) {
        toast.error(err.message || "Failed to restock loaner.");
      }
    });
  };

  const handleOpenClaimModal = (sp?: TicketSparePart) => {
    if (sp) {
      setClaimPartName(sp.requestedPartName || "");
      setClaimSerialNumber(sp.inventoryItem?.serialNumber || "");
      setClaimDefectiveSerial(sp.replacedDefectiveSerial || ticket.defectiveSerial || "");
      setClaimInventoryItemId(sp.inventoryItemId ? String(sp.inventoryItemId) : "");
    } else {
      setClaimPartName("");
      setClaimSerialNumber("");
      setClaimDefectiveSerial(ticket.defectiveSerial || "");
      setClaimInventoryItemId("");
    }
    setClaimAmount("");
    setClaimNotes("");
    setClaimPartnerId(ticket.partnerId ? String(ticket.partnerId) : (user?.partnerId ? String(user.partnerId) : ""));
    setIsClaimModalOpen(true);
  };

  const handleSubmitClaim = (e: React.FormEvent) => {
    e.preventDefault();
    const partnerIdToUse = claimPartnerId ? Number(claimPartnerId) : (ticket.partnerId || user?.partnerId);
    if (!partnerIdToUse) {
      toast.error("Please assign or select a Service Partner to file a claim.");
      return;
    }
    if (!claimPartName.trim()) {
      toast.error("Please enter the part name.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await submitPartReplacementClaimAction({
          ticketId: ticket.id,
          partnerId: partnerIdToUse,
          inventoryItemId: claimInventoryItemId ? Number(claimInventoryItemId) : undefined,
          partName: claimPartName.trim(),
          serialNumber: claimSerialNumber.trim() || undefined,
          defectiveSerial: claimDefectiveSerial.trim() || undefined,
          claimAmount: claimAmount ? parseFloat(claimAmount) : undefined,
          notes: claimNotes.trim() || undefined,
        });
        if (res.success) {
          toast.success("Part replacement claim submitted successfully.");
          setIsClaimModalOpen(false);
          const fresh = await getTicketById(ticket.id);
          if (fresh) setTicket(fresh as unknown as Ticket);
          router.refresh();
        } else {
          toast.error(res.error || "Failed to submit claim.");
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to submit claim.");
      }
    });
  };

  // Multi-Report Attachments Filter
  const reportActivities = useMemo(() => {
    return (ticket.activities || []).filter(
      (a) => a.attachmentUrl || a.type === "REPORT_UPLOAD"
    );
  }, [ticket.activities]);

  const activePartnerId = ticket.partnerId || (isAgent ? user?.partnerId : null);
  const assignedPartner = partners.find((p) => p.id === activePartnerId);
  const eligiblePartners = partners.filter((p) => {
    const covered = safeParseJson<string[]>(p.statesCovered, []);
    return covered.includes(ticket.state);
  });

  const sc = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.NEW;
  const isActive = ticket.status === "NEW" || ticket.status === "IN_PROGRESS" || ticket.status === "FOLLOW_UP";

  // Stepper Stage
  const getLifecycleStage = () => {
    if (ticket.status === "RESOLVED" || ticket.status === "COMPLETE" || ticket.status === "CLOSED") return 4;
    if (ticket.status === "IN_PROGRESS" || ticket.status === "ON_HOLD" || ticket.status === "FOLLOW_UP") return 3;
    if (ticket.partnerId || ticket.assignedFeId) return 2;
    return 1;
  };
  const currentStage = getLifecycleStage();

  // Drawer Maincon & Filtered Sites
  const selectedDrawerMaincon = maincons.find((m) => m.id === Number(drawerMainconId));
  const drawerMainconGroups = selectedDrawerMaincon ? safeParseJson<string[]>(selectedDrawerMaincon.siteCustomers, []) : [];
  const filteredDrawerSites = drawerSites.filter((site) => {
    const matchMaincon = site.mainconId === Number(drawerMainconId);
    const matchGroup = drawerEndCustomer ? site.group === drawerEndCustomer : true;
    const matchSearch = drawerSiteSearchQuery
      ? site.name.toLowerCase().includes(drawerSiteSearchQuery.toLowerCase())
      : true;
    return matchMaincon && matchGroup && matchSearch;
  });

  const filteredDrawerDevices = devices.filter((d) => {
    const matchesCustomer = !d.restrictedTo || d.restrictedTo === drawerEndCustomer;
    if (!matchesCustomer) return false;
    const matchedLabel = `${d.category} - ${d.brand} ${d.model}`;
    if (drawerDeviceSearchQuery && drawerDeviceSearchQuery !== matchedLabel) {
      const query = drawerDeviceSearchQuery.toLowerCase();
      return (
        d.category.toLowerCase().includes(query) ||
        d.brand.toLowerCase().includes(query) ||
        d.model.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const drawerCustomFieldsSchema = selectedDrawerMaincon 
    ? getEffectiveCustomFields(selectedDrawerMaincon.customFieldsSchema, drawerEndCustomer)
    : [];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased pb-20">
      
      {/* ── 1. Top Header Bar (Clean Enterprise Layout) ── */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Back & Breadcrumb Meta */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-all cursor-pointer flex items-center justify-center"
              title="Back to Tickets Queue"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                  {ticket.ticketRefNo || `TKT-#${ticket.id}`}
                </span>
                {ticket.maincon && (
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    {ticket.maincon.name}
                    {ticket.endCustomer ? ` · ${ticket.endCustomer}` : ""}
                  </span>
                )}
                {renderSeverityBadge(ticket.severity)}
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-semibold ${sc.badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${sc.dot} ${isActive ? "animate-pulse" : ""}`} />
                  {sc.label}
                </span>
              </div>
              <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate mt-0.5">
                {ticket.clientSiteName} <span className="text-xs font-normal text-slate-500 dark:text-slate-400 font-mono">({ticket.state})</span>
              </h1>
            </div>
          </div>

          {/* Clean Action Buttons */}
          <div className="flex items-center gap-2">
            {/* WhatsApp Dispatch Copy */}
            <button
              type="button"
              onClick={handleCopyToWhatsapp}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium transition cursor-pointer shadow-sm"
              title="Copy formatted WhatsApp dispatch message (includes contractor custom details)"
            >
              {copied ? "Copied" : "Dispatch WhatsApp"}
            </button>

            {/* Service Report Link if available */}
            {ticket.serviceReportUrl && (
              <a
                href={ticket.serviceReportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg border border-teal-300 dark:border-teal-800 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/50 dark:hover:bg-teal-900/50 text-teal-700 dark:text-teal-300 text-xs font-medium transition cursor-pointer"
              >
                Service Report
              </a>
            )}

            {/* In-Page Edit Details Drawer Button (Superadmin & Moderator Only) */}
            {canEditDetails && (
              <button
                type="button"
                onClick={handleOpenEditDrawer}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition cursor-pointer shadow-sm"
              >
                Edit Details
              </button>
            )}
          </div>
        </div>

        {/* Clean Lifecycle Stepper */}
        <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 px-4 sm:px-6 lg:px-8 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-between text-xs font-medium overflow-x-auto gap-2">
            {[
              { stage: 1, label: "1. Logged" },
              { stage: 2, label: "2. Dispatched" },
              { stage: 3, label: "3. Onsite / In Progress" },
              { stage: 4, label: "4. Resolved & Closed" },
            ].map((step, idx) => {
              const isPassed = currentStage >= step.stage && ticket.status !== "CANCELLED";
              const isCurrent = currentStage === step.stage && ticket.status !== "CANCELLED";
              return (
                <div key={step.stage} className="flex items-center gap-2 flex-1 min-w-[130px]">
                  <div className={`px-3 py-1 rounded-md transition-all text-xs ${
                    ticket.status === "CANCELLED"
                      ? "text-slate-400 opacity-50"
                      : isCurrent
                      ? "bg-indigo-600 text-white font-semibold shadow-sm"
                      : isPassed
                      ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-medium border border-emerald-300 dark:border-emerald-800"
                      : "text-slate-400 dark:text-slate-500"
                  }`}>
                    {step.label}
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

      {/* ── 2. Main Workspace Layout ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* ═════════════════════════════════════════════════════════════════════════ */}
          {/* LEFT COLUMN (65% / 8 Cols): Site Overview & Tabbed Feed */}
          {/* ═════════════════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-8 space-y-6">

            {/* Cancelled Banner if status === CANCELLED */}
            {ticket.status === "CANCELLED" && (
              <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl p-4 flex items-start gap-3 animate-in fade-in">
                <div>
                  <h4 className="text-xs font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider">
                    Ticket Cancelled
                  </h4>
                  <p className="text-sm text-slate-900 dark:text-slate-100 font-medium mt-0.5">
                    {ticket.holdReason || "This ticket was cancelled."}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    SLA tracking and work orders are terminated.
                  </p>
                </div>
              </div>
            )}

            {/* Hold Banner if currently ON_HOLD */}
            {ticket.status === "ON_HOLD" && (
              <div className="bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900 rounded-xl p-4 flex items-start gap-3 animate-in fade-in">
                <div>
                  <h4 className="text-xs font-bold text-orange-800 dark:text-orange-300 uppercase tracking-wider">
                    Ticket Currently On Hold
                  </h4>
                  <p className="text-sm text-slate-900 dark:text-slate-100 font-medium mt-0.5">
                    {ticket.holdReason || "Awaiting spare parts or customer sign-off."}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    SLA countdown is paused while on hold.
                  </p>
                </div>
              </div>
            )}

            {/* 1. Ticket & Site Information Overview */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Ticket & Site Details
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    Reported: {new Date(ticket.reportedAt || ticket.createdAt).toLocaleString("en-MY", {
                      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
                    })}
                  </span>
                  {canEditDetails && ticket.status !== "CANCELLED" && (
                    <button
                      type="button"
                      onClick={handleOpenEditDrawer}
                      className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer ml-2"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>

              {/* Clean Structured Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <InfoRow label="Ticket Number" value={ticket.ticketRefNo || `#${ticket.id}`} mono />
                <InfoRow label="Client / Maincon" value={ticket.maincon?.name || "—"} />
                <InfoRow label="End-Customer Group" value={ticket.endCustomer || "Standard"} />
                <InfoRow label="Site / Branch Name" value={ticket.clientSiteName} />
                <InfoRow label="State / Territory" value={ticket.state} />
                <InfoRow label="Severity Level" value={ticket.severity || "Standard"} />
                <InfoRow
                  label="Created By"
                  value={
                    ticket.createdBy?.name
                      ? `${ticket.createdBy.name} (${ticket.createdBy.role.toLowerCase()})`
                      : ticket.createdByName || "System"
                  }
                />
              </div>

              {/* Issue Description Box */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Issue Description & Technical Fault
                </label>
                <div className="bg-slate-50 dark:bg-slate-950/80 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 text-sm leading-relaxed text-slate-900 dark:text-slate-100 whitespace-pre-wrap">
                  {ticket.issueDescription}
                </div>
              </div>

              {/* Requestor Information (End-Customer Custom Details) */}
              {customFields.length > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Requestor Information {ticket.endCustomer ? `(${ticket.endCustomer})` : ticket.maincon?.name ? `(${ticket.maincon.name})` : ""}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50/80 dark:bg-slate-950/60 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                    {customFields.map((fName) => (
                      <div key={fName} className="bg-white dark:bg-slate-900 p-2.5 rounded-md border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400 block mb-0.5">{fName}</span>
                        <span className="text-xs font-semibold text-slate-900 dark:text-white font-mono">
                          {customValues[fName] || <span className="text-slate-400 font-normal">N/A</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Tabbed Workspace Section */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
              
              {/* Clean Tab Navigation Header */}
              <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900 px-4 pt-3 gap-2 overflow-x-auto">
                {[
                  { id: "activity" as const, label: "Activity & Notes", count: ticket.activities?.length || 0 },
                  { id: "spare-parts" as const, label: "Spare Parts & Loaners", count: ticket.spareParts?.length || 0 },
                  { id: "hardware" as const, label: "Hardware Details" },
                  { id: "report" as const, label: "Service Reports & Visits", count: reportActivities.length || (ticket.serviceReportUrl ? 1 : 0) },
                ].map((t) => {
                  const isCurrent = activeTab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveTab(t.id)}
                      className={`px-3.5 py-2 rounded-t-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer border-t border-x border-b-0 ${
                        isCurrent
                          ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border-slate-200 dark:border-slate-800 shadow-sm relative -mb-px z-10"
                          : "text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <span>{t.label}</span>
                      {t.count !== undefined && t.count > 0 && (
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                          isCurrent
                            ? "bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300"
                            : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                        }`}>
                          {t.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* TAB CONTENT 1: Activity & Work Notes */}
              {activeTab === "activity" && (
                <div className="p-5 sm:p-6 space-y-5 animate-in fade-in">
                  {/* Progress Note Form */}
                  {ticket.status !== "CANCELLED" && (
                    <form onSubmit={handleAddComment} className="p-3.5 bg-slate-50 dark:bg-slate-950/60 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2.5">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        Record Work Note
                      </label>
                      <textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Type diagnostic progress, parts replaced, or site visit logs..."
                        rows={2}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-medium"
                        required
                      />
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          Posting as: <strong className="text-slate-800 dark:text-slate-200 font-semibold">{updateAuthor}</strong>
                        </span>
                        <button
                          type="submit"
                          disabled={isPending || !commentText.trim()}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                        >
                          Add Note
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Activity Timeline Stream */}
                  <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-2.5 pl-5 space-y-5 pt-1">
                    {!ticket.activities || ticket.activities.length === 0 ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400 italic pl-1">No activity logs recorded yet.</p>
                    ) : (
                      ticket.activities.map((activity) => {
                        let title = activity.type;
                        let badgeBg = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";

                        if (activity.type === "STATUS_CHANGE") {
                          const sLabel = activity.status ? STATUS_CONFIG[activity.status as keyof typeof STATUS_CONFIG]?.label || activity.status : "Updated";
                          title = `Status: ${sLabel}`;
                          badgeBg = activity.status === "CANCELLED" 
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" 
                            : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300";
                        } else if (activity.type === "COMMENT") {
                          title = "Progress Note";
                          badgeBg = "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
                        } else if (activity.type === "REPORT_UPLOAD") {
                          title = "Report Attached";
                          badgeBg = "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300";
                        } else if (activity.type === "ASSIGNMENT") {
                          title = "Dispatch Assigned";
                          badgeBg = "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300";
                        } else if (activity.type === "ETA_UPDATE") {
                          title = "ETA Registered";
                          badgeBg = "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
                        } else if (activity.type === "FE_ACKNOWLEDGE") {
                          title = "Engineer Acknowledged";
                          badgeBg = "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300";
                        } else if (activity.type === "SLA_PAUSE") {
                          title = "SLA Paused";
                          badgeBg = "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300";
                        } else if (activity.type === "SLA_RESUME") {
                          title = "SLA Resumed";
                          badgeBg = "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300";
                        }

                        return (
                          <div key={activity.id} className="relative">
                            <span className="absolute -left-7 top-1 w-3.5 h-3.5 rounded-full bg-slate-300 dark:bg-slate-700 border-2 border-white dark:border-slate-900" />
                            <div className="bg-slate-50/80 dark:bg-slate-950/60 p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1">
                              <div className="flex items-center justify-between gap-4 flex-wrap">
                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${badgeBg}`}>
                                  {title}
                                </span>
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                                  {new Date(activity.createdAt).toLocaleString("en-MY", {
                                    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
                                  })}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400">By {activity.author}</p>
                              {activity.notes && (
                                <div className="mt-1 bg-white dark:bg-slate-900 p-2.5 rounded border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 whitespace-pre-wrap leading-relaxed">
                                  {activity.notes}
                                </div>
                              )}
                              {activity.attachmentUrl && (
                                <div className="mt-1.5">
                                  <a
                                    href={activity.attachmentUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-teal-50 dark:bg-teal-950/50 border border-teal-300 dark:border-teal-800 rounded text-xs font-semibold text-teal-700 dark:text-teal-300 hover:bg-teal-100"
                                  >
                                    View Attached Document
                                  </a>
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

              {/* TAB CONTENT 2: Spare Parts & Loaners */}
              {activeTab === "spare-parts" && (
                <div className="p-5 sm:p-6 space-y-4 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                        Hardware & Standby Loaners
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Replacement parts, waybills, and loaner returns.
                      </p>
                    </div>
                    {ticket.status !== "CANCELLED" && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenClaimModal()}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Claim Buffer Part
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsRequestPartModalOpen(true)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition cursor-pointer shadow-sm"
                        >
                          Request Part
                        </button>
                      </div>
                    )}
                  </div>

                  {(!ticket.spareParts || ticket.spareParts.length === 0) ? (
                    <div className="p-6 text-center bg-slate-50 dark:bg-slate-950/40 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                      <p className="font-semibold">No spare parts or loaners requested.</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Click &ldquo;Request Part&rdquo; to requisition replacement hardware or &ldquo;Claim Buffer Part&rdquo; for partner stock.</p>
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
                            className="border rounded-lg p-3.5 space-y-2.5 bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                                    {sp.requestedPartName}
                                  </span>
                                  <span className="text-xs text-slate-500 font-medium">(Qty: {sp.quantity})</span>
                                  {isLoanerItem && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800">
                                      Standby Loaner
                                    </span>
                                  )}
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase border ${
                                      sp.status === "INSTALLED"
                                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                                        : sp.status === "PENDING_APPROVAL"
                                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                                        : sp.status === "APPROVED"
                                        ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800"
                                        : sp.status === "REJECTED"
                                        ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300 dark:border-rose-800"
                                        : sp.status === "ON_LOAN"
                                        ? isOverdue
                                          ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300 dark:border-rose-800"
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
                                    {sp.status.replace(/_/g, " ")}
                                  </span>
                                </div>

                                {sp.requestedBy && (
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                    Requested by: <span className="font-medium text-slate-700 dark:text-slate-300">{sp.requestedBy}</span>
                                  </p>
                                )}
                                {sp.approvedBy && (
                                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                                    Approved by: <span className="font-medium">{sp.approvedBy}</span>
                                  </p>
                                )}
                                {sp.rejectionReason && (
                                  <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                                    Rejection Reason: <span className="font-medium">{sp.rejectionReason}</span>
                                  </p>
                                )}

                                {sp.inventoryItem && (
                                  <p className="text-xs text-slate-600 dark:text-slate-400 font-mono mt-1">
                                    Linked Stock: {sp.inventoryItem.name} (S/N: {sp.inventoryItem.serialNumber})
                                    {sp.inventoryItem.warehouse && ` · ${sp.inventoryItem.warehouse.name}`}
                                  </p>
                                )}
                              </div>

                              {/* Clean Part Actions */}
                              {ticket.status !== "CANCELLED" && (
                                <div className="flex items-center gap-2 flex-wrap">
                                  {(sp.status === "APPROVED" || sp.status === "REQUESTED") && canEditDetails && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenDispatchModal(sp)}
                                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold cursor-pointer"
                                    >
                                      Dispatch
                                    </button>
                                  )}
                                  {(sp.status === "REQUESTED" || sp.status === "PENDING_APPROVAL" || sp.status === "APPROVED") && (
                                    <button
                                      type="button"
                                      onClick={() => handleCancelPart(sp.id)}
                                      className="px-2 py-1 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-xs font-semibold hover:bg-rose-100 hover:text-rose-700 cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  )}

                                  {sp.status === "DISPATCHED" && !sp.isLoaner && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenInstallModal(sp)}
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold cursor-pointer"
                                    >
                                      Mark Installed
                                    </button>
                                  )}

                                  {sp.status === "INSTALLED" && !sp.isLoaner && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenClaimModal(sp)}
                                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold cursor-pointer"
                                    >
                                      File Replacement Claim
                                    </button>
                                  )}

                                  {sp.status === "ON_LOAN" && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedLoanToExtend(sp);
                                          setExtendDays(7);
                                          setIsExtendModalOpen(true);
                                        }}
                                        className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold cursor-pointer"
                                      >
                                        Extend Loan
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedLoanToReturn(sp);
                                          setIsReturnModalOpen(true);
                                        }}
                                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold cursor-pointer"
                                      >
                                        Initiate Return
                                      </button>
                                    </>
                                  )}

                                  {sp.status === "RETURN_IN_TRANSIT" && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedLoanToRestock(sp);
                                        setIsRestockModalOpen(true);
                                      }}
                                      className="px-2.5 py-1 bg-teal-600 hover:bg-teal-500 text-white rounded text-xs font-semibold cursor-pointer"
                                      >
                                      Restock Warehouse
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Loaner Status info */}
                            {isLoanerItem && returnDate && (
                              <div className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between gap-2 flex-wrap">
                                <div>
                                  <span className="text-slate-500 dark:text-slate-400">Expected Return: </span>
                                  <strong className="font-mono text-slate-900 dark:text-white">
                                    {returnDate.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" })}
                                  </strong>
                                </div>
                                {diffDays !== null && sp.status === "ON_LOAN" && (
                                  <span className={`font-semibold ${isOverdue ? "text-rose-600 dark:text-rose-400" : "text-cyan-700 dark:text-cyan-300"}`}>
                                    {isOverdue ? `Overdue by ${Math.abs(diffDays)} days` : `${diffDays} days remaining`}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Tracking info */}
                            {sp.dispatchTrackingNo && (
                              <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
                                <span>Courier: <strong>{sp.courierName || "Standard"}</strong></span>
                                <span>• Tracking No: <strong className="font-mono">{sp.dispatchTrackingNo}</strong></span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Part Replacement Claims Section */}
                  <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <span>Partner Buffer Claims & Settlements</span>
                        </h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          {ticket.replacementClaims?.length || 0}
                        </span>
                      </div>
                      {(!ticket.replacementClaims || ticket.replacementClaims.length === 0) && ticket.status !== "CANCELLED" && (
                        <button
                          type="button"
                          onClick={() => handleOpenClaimModal()}
                          className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                        >
                          + File Claim
                        </button>
                      )}
                    </div>

                    {(!ticket.replacementClaims || ticket.replacementClaims.length === 0) ? (
                      <div className="p-4 text-center bg-slate-50/50 dark:bg-slate-950/30 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400">
                        No replacement claims filed for this ticket. If partner buffer stock was used, file a claim to replenish hardware or request reimbursement.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {ticket.replacementClaims.map((claim) => (
                          <div
                            key={claim.id}
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-xs space-y-2 shadow-xs"
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 dark:text-white">{claim.partName}</span>
                                {claim.serialNumber && (
                                  <span className="font-mono text-slate-500 text-[11px]">S/N: {claim.serialNumber}</span>
                                )}
                              </div>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                                  claim.status === "APPROVED_REPLENISH"
                                    ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                                    : claim.status === "APPROVED_REIMBURSE"
                                    ? "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800"
                                    : claim.status === "REJECTED"
                                    ? "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800"
                                    : "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                                }`}
                              >
                                {claim.status.replace(/_/g, " ")}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/50 p-2 rounded">
                              <div>
                                <span className="text-slate-400 block">Claimed By:</span>
                                <strong>{claim.requestedBy}</strong> ({claim.partner?.name || "Partner"})
                              </div>
                              <div>
                                <span className="text-slate-400 block">Defective Replaced:</span>
                                <strong className="font-mono">{claim.defectiveSerial || "N/A"}</strong>
                              </div>
                              <div>
                                <span className="text-slate-400 block">Claim Value / Type:</span>
                                <strong>{claim.claimAmount ? `RM ${claim.claimAmount.toFixed(2)}` : (claim.settlementType?.replace(/_/g, " ") || "Replenishment")}</strong>
                              </div>
                            </div>

                            {claim.approvedBy && (
                              <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                                Settled by <strong>{claim.approvedBy}</strong> ({claim.settlementType?.replace(/_/g, " ")})
                              </p>
                            )}
                            {claim.rejectionReason && (
                              <p className="text-[11px] text-rose-600 dark:text-rose-400">
                                Rejection reason: <strong>{claim.rejectionReason}</strong>
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB CONTENT 3: Hardware Details */}
              {activeTab === "hardware" && (
                <div className="p-5 sm:p-6 space-y-4 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      Hardware Specs & Serial Numbers
                    </h3>
                    {canEditDetails && ticket.status !== "CANCELLED" && (
                      <button
                        type="button"
                        onClick={handleOpenEditDrawer}
                        className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        Edit Hardware
                      </button>
                    )}
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
                    <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">
                        Warehouse Return Status:
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold border ${
                        ticket.defectiveReturnStatus === "RETURNED"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                          : ticket.defectiveReturnStatus === "PENDING"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                      }`}>
                        {ticket.defectiveReturnStatus === "RETURNED"
                          ? "Returned to Warehouse"
                          : ticket.defectiveReturnStatus === "PENDING"
                          ? "Pending Return"
                          : ticket.defectiveReturnStatus}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* TAB CONTENT 4: Service Reports & Multi-Visit Slips */}
              {activeTab === "report" && (
                <div className="p-5 sm:p-6 space-y-5 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                        Signed Service Reports & Daily Visit Slips
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Interim diagnostic slips, daily sign-offs, and final reports.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsInterimReportModalOpen(true)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                    >
                      Attach Visit Slip
                    </button>
                  </div>

                  {/* 1. Primary / Latest Signed Service Report */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block mb-0.5">
                        Primary / Final Signed Service Report
                      </span>
                      <span className="text-sm font-semibold text-slate-900 dark:text-white block">
                        {ticket.serviceReportUrl ? "Official Signed Service Report on Record" : "No Final Report Attached Yet"}
                      </span>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {ticket.serviceReportUrl
                          ? "Official client sign-off slip for closure and billing."
                          : "Upload the signed physical report once work is finalized."}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {ticket.serviceReportUrl && (
                        <a
                          href={ticket.serviceReportUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                        >
                          View Report
                        </a>
                      )}

                      <label className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        ticket.serviceReportUrl
                          ? "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700"
                          : "bg-indigo-600 hover:bg-indigo-500 text-white"
                      }`}>
                        <span>{isStandaloneUploading ? "Uploading..." : ticket.serviceReportUrl ? "Replace Final" : "Upload Final"}</span>
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          disabled={isStandaloneUploading}
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadReportFile(file, true, "Primary Final Service Report", "FINAL_COMPLETION");
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  {/* 2. Chronological Multi-Visit Report History */}
                  <div className="space-y-2.5 pt-1">
                    <h4 className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300 tracking-wider">
                      Visit Slips & Interim Documents ({reportActivities.length})
                    </h4>

                    {reportActivities.length === 0 ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400 italic p-3 bg-slate-50 dark:bg-slate-950/40 rounded-lg border border-dashed border-slate-200 dark:border-slate-800">
                        No interim visit slips attached yet. When conducting multi-day checks or follow-ups, attach daily signed slips here.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {reportActivities.map((act) => (
                          <div
                            key={act.id}
                            className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold text-slate-900 dark:text-white">
                                  {act.notes || "Service Slip Attachment"}
                                </span>
                                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                                  ({new Date(act.createdAt).toLocaleString("en-MY", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })})
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Uploaded by {act.author}</p>
                            </div>

                            {act.attachmentUrl && (
                              <a
                                href={act.attachmentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs font-medium"
                              >
                                View File
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>

          </div>

          {/* ═════════════════════════════════════════════════════════════════════════ */}
          {/* RIGHT COLUMN (35% / 4 Cols Sticky): SLA, Dispatch & Status Actions */}
          {/* ═════════════════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-4 space-y-5 lg:sticky lg:top-20">

            {/* Acknowledgment Warning Banner */}
            {ticket.assignedFeId && ticket.feAcknowledgeStatus === "PENDING" && ticket.status !== "CANCELLED" && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl p-3.5 space-y-2 animate-in fade-in">
                <div>
                  <h3 className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wide">
                    Awaiting Engineer Acknowledgment
                  </h3>
                  <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5">
                    {ticket.assignedFe?.name || "Field Engineer"} has not acknowledged dispatch yet.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAcknowledge}
                  disabled={isPending}
                  className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  Acknowledge on Behalf
                </button>
              </div>
            )}

            {/* 1. SLA Compliance Widget */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  SLA Compliance
                </h2>
                {ticket.status === "CANCELLED" ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                    Cancelled
                  </span>
                ) : ticket.slaPaused ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 border border-orange-200 dark:border-orange-900">
                    Paused
                  </span>
                ) : null}
              </div>

              {ticket.slaDeadline ? (
                <div className="p-3 bg-slate-50 dark:bg-slate-950/80 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">Target Deadline:</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white">
                      {new Date(ticket.slaDeadline).toLocaleString("en-MY", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-800">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Live Countdown:</span>
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

            {/* 2. Dispatch & Field Engineer Assignment */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-3.5">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Dispatch & Assign
                </h2>
              </div>

              {/* Service Partner Dropdown */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Service Partner Agency
                </label>
                <select
                  value={ticket.partnerId ?? (isAgent ? (user?.partnerId ?? "") : "")}
                  disabled={isAgent || ticket.status === "CANCELLED"}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : undefined;
                    handleAssignService(val, undefined);
                  }}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer disabled:opacity-60"
                >
                  <option value="">Unassigned</option>
                  {eligiblePartners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {isAgent ? (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">Agency selection is locked to your partner company</p>
                ) : (
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Partners in {ticket.state}</p>
                )}
              </div>

              {/* Field Engineer Dropdown */}
              {(ticket.partnerId || (isAgent && user?.partnerId)) && (assignedPartner || (isAgent && partners.find(p => p.id === user?.partnerId))) && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Field Engineer
                  </label>
                  <select
                    value={ticket.assignedFeId ?? ""}
                    disabled={ticket.status === "CANCELLED"}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : undefined;
                      const currentPartnerId = ticket.partnerId || (isAgent ? user?.partnerId : undefined);
                      handleAssignService(currentPartnerId || undefined, val);
                    }}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer disabled:opacity-60"
                  >
                    <option value="">Select Field Engineer</option>
                    {((assignedPartner || partners.find(p => p.id === user?.partnerId))?.engineers ?? []).map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} — {e.phone}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Assigned Engineer Card */}
              {ticket.assignedFe && (
                <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center gap-2.5">
                  {ticket.assignedFe.user?.avatarUrl ? (
                    <img
                      src={ticket.assignedFe.user.avatarUrl}
                      alt={ticket.assignedFe.name}
                      className="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-sm flex-shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-xs flex-shrink-0">
                      {ticket.assignedFe.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Assigned Engineer</p>
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{ticket.assignedFe.name}</p>
                    <p className="text-xs font-mono text-slate-500 dark:text-slate-400">{ticket.assignedFe.phone}</p>
                  </div>
                  {ticket.feAcknowledgeStatus && (
                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${
                      ticket.feAcknowledgeStatus === "ACKNOWLEDGED"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                        : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                    }`}>
                      {ticket.feAcknowledgeStatus === "ACKNOWLEDGED" ? "Acked" : "Pending"}
                    </span>
                  )}
                </div>
              )}

              {/* ETA Setter */}
              {ticket.status !== "CANCELLED" && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Arrival ETA
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="datetime-local"
                      value={etaDate}
                      onChange={(e) => setEtaDate(e.target.value)}
                      className="px-2.5 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white flex-1 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSaveEta}
                      disabled={isPending || !etaDate}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                    >
                      Set ETA
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Guided Lifecycle Actions */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Lifecycle Actions
                </h2>
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${sc.badge}`}>
                  Current: {sc.label}
                </span>
              </div>

              {/* Allowed Next Steps Buttons based on Current State & Role */}
              {allowedStatuses.length === 0 ? (
                <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {ticket.status === "CANCELLED" 
                      ? "Ticket is Cancelled (Read-only)" 
                      : ticket.status === "CLOSED" || ticket.status === "COMPLETE"
                      ? "Ticket is finalized and closed."
                      : "No next transitions available for your role."}
                  </p>
                  {isSuperadmin && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange("IN_PROGRESS")}
                      disabled={isPending}
                      className="mt-2 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition"
                    >
                      Re-open Ticket
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Next step from <strong className="text-slate-900 dark:text-white">{sc.label}</strong>:
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {allowedStatuses.map((st) => {
                      const s = STATUS_CONFIG[st] || STATUS_CONFIG["NEW"];
                      const isSelected = selectedTargetStatus === st;
                      const isCancel = st === "CANCELLED";

                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => {
                            if (st === "CANCELLED") {
                              setIsCancelModalOpen(true);
                              return;
                            }
                            if (st === "RESOLVED" || st === "COMPLETE") {
                              handleOpenResolveModal(st);
                              return;
                            }
                            setSelectedTargetStatus(st);
                            if (st !== "FOLLOW_UP") setFollowUpSubStatus("");
                            if (st !== "ON_HOLD") setHoldReason("");
                          }}
                          disabled={isPending}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition cursor-pointer flex items-center justify-center ${
                            isCancel
                              ? "bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800"
                              : isSelected
                              ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                              : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                          }`}
                        >
                          <span>{s.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Status Transition Options Drawer (For FOLLOW_UP or ON_HOLD) */}
              {selectedTargetStatus && selectedTargetStatus !== "RESOLVED" && selectedTargetStatus !== "COMPLETE" && selectedTargetStatus !== "CANCELLED" && (
                <div className="p-3.5 bg-slate-50 dark:bg-slate-950/80 rounded-lg border border-indigo-200 dark:border-indigo-800 space-y-2.5 animate-in fade-in">
                  <h4 className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase">
                    Transition to {STATUS_CONFIG[selectedTargetStatus]?.label}
                  </h4>

                  {selectedTargetStatus === "FOLLOW_UP" && (
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Follow-up Reason:
                      </label>
                      <select
                        value={followUpSubStatus}
                        onChange={(e) => setFollowUpSubStatus(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white"
                      >
                        <option value="MONITORING">In Monitoring / Observation</option>
                        <option value="PENDING_PARTS">Pending Spare Parts (SLA Paused)</option>
                        <option value="UNFINISHED_NEXT_DAY">Unfinished Job (Continue Next Day)</option>
                        <option value="RETURN_VISIT">Requires Return Site Visit</option>
                        <option value="PENDING_CUSTOMER">Awaiting Customer Confirmation</option>
                      </select>
                    </div>
                  )}

                  {selectedTargetStatus === "ON_HOLD" && (
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Hold Reason:
                      </label>
                      <input
                        type="text"
                        value={holdReason}
                        onChange={(e) => setHoldReason(e.target.value)}
                        placeholder="Why is this ticket on hold?"
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white"
                      />
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setSelectedTargetStatus(null)}
                      className="px-3 py-1 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusChange(selectedTargetStatus)}
                      disabled={isPending}
                      className="px-3.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition"
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>
      </main>

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* IN-PAGE EDIT DETAILS SLIDE-OVER DRAWER */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {isEditDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => !isSavingDrawer && setIsEditDrawerOpen(false)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col">
              
              {/* Drawer Header */}
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/80">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Edit Ticket Details
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Update site, customer, severity, and hardware information.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditDrawerOpen(false)}
                  disabled={isSavingDrawer}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Drawer Form Body */}
              <form onSubmit={handleSaveEditDrawer} className="flex-1 overflow-y-auto p-6 space-y-4">
                
                {/* 1. Ticket Ref No & Maincon */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Ticket Ref No
                    </label>
                    <input
                      type="text"
                      value={drawerRefNo}
                      onChange={(e) => setDrawerRefNo(e.target.value)}
                      placeholder="e.g. TKT-2026-001"
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-semibold text-slate-900 dark:text-white focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Client / Maincon *
                    </label>
                    <select
                      value={drawerMainconId}
                      onChange={(e) => setDrawerMainconId(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                      required
                    >
                      {maincons.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 2. End-Customer Group if applicable */}
                {drawerMainconGroups.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      End-Customer Group
                    </label>
                    <select
                      value={drawerEndCustomer}
                      onChange={(e) => setDrawerEndCustomer(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="">Select End Customer</option>
                      {drawerMainconGroups.map((grp) => (
                        <option key={grp} value={grp}>
                          {grp}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 3. Site Name & State Selection */}
                <div className="space-y-3">
                  <div className="relative">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Client Site / Branch Name *
                    </label>
                    <input
                      type="text"
                      value={drawerSiteSearchQuery}
                      onChange={(e) => {
                        setDrawerSiteSearchQuery(e.target.value);
                        setDrawerClientSiteName(e.target.value);
                        setIsDrawerSiteDropdownOpen(true);
                      }}
                      onFocus={() => setIsDrawerSiteDropdownOpen(true)}
                      placeholder="Type site or branch name..."
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white focus:ring-1 focus:ring-indigo-500"
                      required
                    />

                    {/* Autocomplete Dropdown */}
                    {isDrawerSiteDropdownOpen && filteredDrawerSites.length > 0 && (
                      <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                        {filteredDrawerSites.map((s) => (
                          <div
                            key={s.id}
                            onClick={() => {
                              setDrawerClientSiteName(s.name);
                              setDrawerSiteSearchQuery(s.name);
                              setDrawerState(s.state);
                              setDrawerSelectedSiteId(s.id);
                              if (s.group) setDrawerEndCustomer(s.group);
                              setIsDrawerSiteDropdownOpen(false);
                            }}
                            className="p-2.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 cursor-pointer text-xs flex justify-between items-center border-b border-slate-100 dark:border-slate-800 last:border-none"
                          >
                            <span className="font-semibold text-slate-900 dark:text-white">{s.name}</span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">({s.state})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                        State / Territory *
                      </label>
                      <select
                        value={drawerState}
                        onChange={(e) => setDrawerState(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                        required
                      >
                        {states.map((st) => (
                          <option key={st.id} value={st.name}>
                            {st.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                        Severity Level *
                      </label>
                      <select
                        value={drawerSeverity}
                        onChange={(e) => setDrawerSeverity(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                        required
                      >
                        <option value="P1">P1 Critical (System Down)</option>
                        <option value="P2">P2 High (Major Impact)</option>
                        <option value="P3">P3 Medium (Degraded)</option>
                        <option value="P4">P4 Low (Inquiry / Non-critical)</option>
                        <option value="NA">NA - No SLA (Ad-hoc / Non-SLA)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 4. Hardware & Device Catalog Selection */}
                <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="relative">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Hardware / Device Catalog
                    </label>
                    <input
                      type="text"
                      value={drawerDeviceSearchQuery}
                      onChange={(e) => {
                        setDrawerDeviceSearchQuery(e.target.value);
                        setIsDrawerDeviceDropdownOpen(true);
                      }}
                      onFocus={() => setIsDrawerDeviceDropdownOpen(true)}
                      placeholder="Search device brand, model or category..."
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white focus:ring-1 focus:ring-indigo-500"
                    />

                    {isDrawerDeviceDropdownOpen && filteredDrawerDevices.length > 0 && (
                      <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                        {filteredDrawerDevices.map((d) => (
                          <div
                            key={d.id}
                            onClick={() => {
                              setDrawerDeviceId(String(d.id));
                              setDrawerDeviceSearchQuery(`${d.category} - ${d.brand} ${d.model}`);
                              setDrawerDeviceStatus(d.isStandard ? "STANDARD" : "ON_REQUEST");
                              setIsDrawerDeviceDropdownOpen(false);
                            }}
                            className="p-2.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 cursor-pointer text-xs flex justify-between items-center border-b border-slate-100 dark:border-slate-800 last:border-none"
                          >
                            <span className="font-semibold text-slate-900 dark:text-white">{d.brand} {d.model}</span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">({d.category})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                        Defective Part Serial No
                      </label>
                      <input
                        type="text"
                        value={drawerDefectiveSerial}
                        onChange={(e) => setDrawerDefectiveSerial(e.target.value)}
                        placeholder="e.g. SN-889210-KL"
                        className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-semibold text-slate-900 dark:text-white focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                        Warehouse Return Status
                      </label>
                      <select
                        value={drawerDefectiveReturnStatus}
                        onChange={(e) => setDrawerDefectiveReturnStatus(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                      >
                        <option value="PENDING">Pending Return</option>
                        <option value="RETURNED">Returned to Warehouse</option>
                        <option value="NOT_APPLICABLE">N/A</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 5. Requestor Information Fields */}
                {drawerCustomFieldsSchema.length > 0 && (
                  <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                      Requestor Information {drawerEndCustomer ? `(${drawerEndCustomer})` : selectedDrawerMaincon?.name ? `(${selectedDrawerMaincon.name})` : ""}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {drawerCustomFieldsSchema.map((fName) => (
                        <div key={fName}>
                          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                            {fName}
                          </label>
                          <input
                            type="text"
                            value={drawerCustomValues[fName] || ""}
                            onChange={(e) => setDrawerCustomValues({ ...drawerCustomValues, [fName]: e.target.value })}
                            className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 6. Issue Description */}
                <div className="space-y-1 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
                    Issue Description & Problem Summary *
                  </label>
                  <textarea
                    value={drawerIssueDescription}
                    onChange={(e) => setDrawerIssueDescription(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-medium"
                    required
                  />
                </div>

                {/* Drawer Footer Actions */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2.5 sticky bottom-0 bg-white dark:bg-slate-900 pb-2">
                  <button
                    type="button"
                    onClick={() => setIsEditDrawerOpen(false)}
                    disabled={isSavingDrawer}
                    className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingDrawer}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {isSavingDrawer ? "Saving..." : "Save Changes"}
                  </button>
                </div>

              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Cancellation Modal ── */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-rose-200 dark:border-rose-900 p-5 max-w-md w-full shadow-xl space-y-3.5">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                Cancel Ticket
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Permanently stop SLA and cancel dispatch. Select cancellation reason:
              </p>
            </div>
            <form onSubmit={handleConfirmCancellation} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Reason Preset *
                </label>
                <select
                  value={cancelReasonPreset}
                  onChange={(e) => setCancelReasonPreset(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white cursor-pointer"
                  required
                >
                  <option value="Duplicate Ticket logged">Duplicate Ticket logged</option>
                  <option value="Customer resolved internally / False alarm">Customer resolved internally / False alarm</option>
                  <option value="Cancelled by client / Contractor request">Cancelled by client / Contractor request</option>
                  <option value="Wrong site address / Out of coverage">Wrong site address / Out of coverage</option>
                  <option value="Other reason">Other reason</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Additional Explanation
                </label>
                <textarea
                  value={cancelCustomReason}
                  onChange={(e) => setCancelCustomReason(e.target.value)}
                  placeholder="Provide details..."
                  rows={2}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCancelModalOpen(false)}
                  className="px-3.5 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Keep Active
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  Confirm Cancellation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Interim / Visit Slip Upload Modal ── */}
      {isInterimReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 max-w-md w-full shadow-xl space-y-3.5">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Attach Daily Visit Slip / Interim Report
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Upload day visit sign-offs, diagnostic slips, or monitoring notes.
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Report Type / Stage *
                </label>
                <select
                  value={interimStage}
                  onChange={(e) => setInterimStage(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white cursor-pointer"
                >
                  <option value="INTERIM_VISIT">Interim Daily Visit Sign-Off</option>
                  <option value="DIAGNOSTIC_CHECK">Initial Diagnostic / Inspection Slip</option>
                  <option value="PARTS_FAULT_IDENTIFIED">Parts Fault Found & Acknowledged</option>
                  <option value="MONITORING">In-Monitoring / Observation Slip</option>
                  <option value="UNFINISHED_NEXT_DAY">Unfinished Day 1 Slip (Continue Next Day)</option>
                  <option value="FINAL_COMPLETION">Final Completion Service Report</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Visit Notes
                </label>
                <textarea
                  value={interimNotes}
                  onChange={(e) => setInterimNotes(e.target.value)}
                  placeholder="e.g. Diagnostic complete. Awaiting part delivery tomorrow."
                  rows={2}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Upload Signed Slip (PDF or Photo) *
                </label>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  disabled={isStandaloneUploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleUploadReportFile(file, true, interimNotes || undefined, interimStage);
                    }
                  }}
                  className="text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white cursor-pointer"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsInterimReportModalOpen(false)}
                  disabled={isStandaloneUploading}
                  className="px-3.5 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Spare Part & Resolution Modals ── */}
      {/* 1. Request Part Modal */}
      {isRequestPartModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 max-w-md w-full shadow-xl space-y-3.5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              {reqIsLoaner ? "Request Standby Loaner Unit" : "Request Replacement Spare Part"}
            </h3>
            <form onSubmit={handleRequestSparePart} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Part / Unit Name *
                </label>
                <input
                  type="text"
                  value={reqPartName}
                  onChange={(e) => setReqPartName(e.target.value)}
                  placeholder="e.g., Cisco Power Supply, 4G Router"
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={reqPartQty}
                    onChange={(e) => setReqPartQty(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer pb-2">
                    <input
                      type="checkbox"
                      checked={reqIsLoaner}
                      onChange={(e) => setReqIsLoaner(e.target.checked)}
                      className="rounded text-cyan-600"
                    />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Standby Loaner?</span>
                  </label>
                </div>
              </div>

              {reqIsLoaner && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Loan Duration (Days)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={reqLoanDays}
                    onChange={(e) => setReqLoanDays(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Reason / Fault Description
                </label>
                <textarea
                  value={reqPartNotes}
                  onChange={(e) => setReqPartNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRequestPartModalOpen(false)}
                  className="px-3.5 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Dispatch Spare Part Modal */}
      {isDispatchModalOpen && selectedPartToDispatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 max-w-md w-full shadow-xl space-y-3.5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Dispatch: {selectedPartToDispatch.requestedPartName}
            </h3>
            <form onSubmit={handleAllocateAndDispatch} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Link Warehouse Stock
                </label>
                <select
                  value={selectedStockItemId}
                  onChange={(e) => setSelectedStockItemId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white"
                >
                  <option value="">Unserialized / No Stock Linked</option>
                  {availableStockItems.map((item) => {
                    const isMatchGroup = (ticket.endCustomer && item.group === ticket.endCustomer) || (ticket.mainconId && item.mainconId === ticket.mainconId);
                    const groupLabel = item.group ? `[${item.group}] ` : item.maincon?.name ? `[${item.maincon.name}] ` : "[General Pool] ";
                    const stockLabel = item.trackingType === "BULK" ? `(Bulk: ${item.availableQuantity} units avail)` : `(S/N: ${item.serialNumber})`;
                    return (
                      <option key={item.id} value={item.id}>
                        {isMatchGroup ? "⭐ " : ""}{groupLabel}{item.name} — {stockLabel} {item.warehouse ? `@ ${item.warehouse.name}` : ""}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Courier
                  </label>
                  <input
                    type="text"
                    value={dispatchCourierName}
                    onChange={(e) => setDispatchCourierName(e.target.value)}
                    placeholder="e.g. Lalamove, J&T"
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Tracking No
                  </label>
                  <input
                    type="text"
                    value={dispatchTrackingNo}
                    onChange={(e) => setDispatchTrackingNo(e.target.value)}
                    placeholder="e.g. MY12345678"
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Notes
                </label>
                <textarea
                  value={dispatchNotes}
                  onChange={(e) => setDispatchNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsDispatchModalOpen(false)}
                  className="px-3.5 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition"
                >
                  Confirm Dispatch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Mark Installed Modal */}
      {isInstallModalOpen && selectedPartToInstall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 max-w-md w-full shadow-xl space-y-3.5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Confirm Installation: {selectedPartToInstall.requestedPartName}
            </h3>
            <form onSubmit={handleMarkInstalled} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Replaced Defective Serial
                </label>
                <input
                  type="text"
                  value={installDefectiveSerial}
                  onChange={(e) => setInstallDefectiveSerial(e.target.value)}
                  placeholder="e.g. DEFECT-9982"
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-semibold text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsInstallModalOpen(false)}
                  className="px-3.5 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition"
                >
                  Confirm Installed
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Extend Loan Modal */}
      {isExtendModalOpen && selectedLoanToExtend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 max-w-md w-full shadow-xl space-y-3.5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Extend Loan: {selectedLoanToExtend.requestedPartName}
            </h3>
            <form onSubmit={handleExtendLoan} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Additional Days
                </label>
                <input
                  type="number"
                  min={1}
                  value={extendDays}
                  onChange={(e) => setExtendDays(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Reason
                </label>
                <textarea
                  value={extendReason}
                  onChange={(e) => setExtendReason(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsExtendModalOpen(false)}
                  className="px-3.5 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold transition"
                >
                  Confirm Extension
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Initiate Loaner Return Modal */}
      {isReturnModalOpen && selectedLoanToReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 max-w-md w-full shadow-xl space-y-3.5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Initiate Return: {selectedLoanToReturn.requestedPartName}
            </h3>
            <form onSubmit={handleInitiateReturn} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Courier
                  </label>
                  <input
                    type="text"
                    value={returnCourier}
                    onChange={(e) => setReturnCourier(e.target.value)}
                    placeholder="e.g. GDEX"
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Tracking No
                  </label>
                  <input
                    type="text"
                    value={returnTracking}
                    onChange={(e) => setReturnTracking(e.target.value)}
                    placeholder="e.g. RET-1102"
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Notes
                </label>
                <textarea
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsReturnModalOpen(false)}
                  className="px-3.5 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition"
                >
                  Confirm In-Transit Return
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Restock Loaner Modal */}
      {isRestockModalOpen && selectedLoanToRestock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 max-w-md w-full shadow-xl space-y-3.5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Restock Warehouse: {selectedLoanToRestock.requestedPartName}
            </h3>
            <form onSubmit={handleRestockLoan} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Condition
                </label>
                <select
                  value={restockCondition}
                  onChange={(e) => setRestockCondition(e.target.value as any)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white"
                >
                  <option value="GOOD">Good Condition</option>
                  <option value="DAMAGED_NEEDS_REPAIR">Damaged / Needs Repair</option>
                  <option value="MISSING_ACCESSORIES">Missing Accessories</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Notes
                </label>
                <textarea
                  value={restockNotes}
                  onChange={(e) => setRestockNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRestockModalOpen(false)}
                  className="px-3.5 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-semibold transition"
                >
                  Restock Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Dedicated Resolution Modal */}
      {isResolveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 max-w-lg w-full shadow-xl space-y-3.5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Confirm Resolution ({resolveTargetStatus})
            </h3>
            <form onSubmit={handleConfirmResolution} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Resolution Date & Time *
                </label>
                <input
                  type="datetime-local"
                  value={resolveDate}
                  onChange={(e) => setResolveDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Action Taken / Resolution Work *
                </label>
                <textarea
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                  placeholder="Describe what was fixed..."
                  rows={3}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Defective Serial (if replaced)
                  </label>
                  <input
                    type="text"
                    value={resolveDefectiveSerial}
                    onChange={(e) => setResolveDefectiveSerial(e.target.value)}
                    placeholder="e.g. SN-998822"
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-semibold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Warehouse Return Status
                  </label>
                  <select
                    value={resolveDefectiveReturnStatus}
                    onChange={(e) => setResolveDefectiveReturnStatus(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    <option value="PENDING_RETURN">Pending Return</option>
                    <option value="RETURNED">Returned</option>
                    <option value="NOT_APPLICABLE">N/A</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Signed Physical Service Report
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadReportFile(file, false);
                    }}
                    disabled={isUploadingReport}
                    className="text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 dark:file:bg-slate-800 dark:file:text-slate-300 cursor-pointer"
                  />
                  {resolveServiceReportUrl && (
                    <span className="text-xs text-emerald-600 font-semibold">File Attached</span>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsResolveModalOpen(false)}
                  className="px-3.5 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || isUploadingReport}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition"
                >
                  Confirm Resolution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. Part Replacement Claim Modal */}
      {isClaimModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 max-w-lg w-full shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  File Part Replacement Claim
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Reimburse or replenish regional partner buffer stock used for this ticket.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsClaimModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitClaim} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Service Partner *
                </label>
                <select
                  value={claimPartnerId}
                  onChange={(e) => setClaimPartnerId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white"
                  required
                >
                  <option value="">Select Partner</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Replacement Part Name *
                </label>
                <input
                  type="text"
                  value={claimPartName}
                  onChange={(e) => setClaimPartName(e.target.value)}
                  placeholder="e.g. 500W Power Supply, Motherboard Rev 2"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Installed Serial (Partner Stock)
                  </label>
                  <input
                    type="text"
                    value={claimSerialNumber}
                    onChange={(e) => setClaimSerialNumber(e.target.value)}
                    placeholder="e.g. SN-883392"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-semibold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Defective Serial Removed
                  </label>
                  <input
                    type="text"
                    value={claimDefectiveSerial}
                    onChange={(e) => setClaimDefectiveSerial(e.target.value)}
                    placeholder="e.g. SN-DEF-001"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-semibold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Claimed Amount / Part Value (RM, Optional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={claimAmount}
                  onChange={(e) => setClaimAmount(e.target.value)}
                  placeholder="e.g. 250.00"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-semibold text-slate-900 dark:text-white"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Superadmin/Moderator can settle via Hardware Replenishment transfer or Financial Reimbursement.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Notes & Justification
                </label>
                <textarea
                  value={claimNotes}
                  onChange={(e) => setClaimNotes(e.target.value)}
                  placeholder="Details of the replacement, fault diagnosis, or invoice reference..."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsClaimModalOpen(false)}
                  className="px-3.5 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold transition"
                >
                  {isPending ? "Submitting..." : "Submit Claim"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
