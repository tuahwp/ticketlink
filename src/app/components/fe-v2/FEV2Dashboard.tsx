"use client";

import React, { useState, useEffect, useTransition, useRef, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "../AuthProvider";
import {
  getTickets,
  getTicketById,
  acceptTicket,
  enrouteTicket,
  checkInTicket,
  recordFeAttendance,
  updateTicketEta,
  addTicketComment,
  updateTicketResolution,
  uploadServiceReport,
  updateSelfEngineerProfile,
  updateUserProfile,
  updateUserProfileAction,
  changeUserPasswordAction,
  updateTicketStatus,
  getFeTeamMembersByUserId,
  reassignTicketByFe,
  requestTicketSparePart,
  markSparePartInstalled,
  updateMyPasswordAction,
  generateAiResolutionAction,
  getCustomerGroupLogosAction,
} from "@/app/actions";
import { compressImage } from "@/lib/imageCompress";
import SlaCountdown from "../SlaCountdown";
import ThemeToggle from "../ThemeToggle";
import { getEffectiveCustomFields } from "@/lib/customFields";
import { categorizeFeTickets } from "@/lib/feTicketBuckets";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import FeAiCopilotCard from "../fe/FeAiCopilotCard";
import { i18n } from "./i18n";

const MALAYSIAN_STATE_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "Kuala Lumpur", pattern: /\b(?:kuala\s+lumpur|w\.?p\.?\s*kuala\s+lumpur|wilayah\s+persekutuan\s+kuala\s+lumpur|wpkl)\b/i },
  { name: "Selangor", pattern: /\b(?:selangor(?:\s+darul\s+ehsan)?)\b/i },
  { name: "Putrajaya", pattern: /\b(?:putrajaya|w\.?p\.?\s*putrajaya|wilayah\s+persekutuan\s+putrajaya)\b/i },
  { name: "Labuan", pattern: /\b(?:labuan|w\.?p\.?\s*labuan|wilayah\s+persekutuan\s+labuan)\b/i },
  { name: "Johor", pattern: /\b(?:johor(?:\s+darul\s+ta'zim|\s+darul\s+takzim)?)\b/i },
  { name: "Penang", pattern: /\b(?:pulau\s+pinang|penang)\b/i },
  { name: "Perak", pattern: /\b(?:perak(?:\s+darul\s+ridzuan)?)\b/i },
  { name: "Kedah", pattern: /\b(?:kedah(?:\s+darul\s+aman)?)\b/i },
  { name: "Pahang", pattern: /\b(?:pahang(?:\s+darul\s+makmur)?)\b/i },
  { name: "Terengganu", pattern: /\b(?:terengganu(?:\s+darul\s+iman)?)\b/i },
  { name: "Kelantan", pattern: /\b(?:kelantan(?:\s+darul\s+naim)?)\b/i },
  { name: "Melaka", pattern: /\b(?:melaka|malacca)\b/i },
  { name: "Negeri Sembilan", pattern: /\b(?:negeri\s+sembilan|n\.?\s*sembilan)\b/i },
  { name: "Sabah", pattern: /\b(?:sabah)\b/i },
  { name: "Sarawak", pattern: /\b(?:sarawak)\b/i },
  { name: "Perlis", pattern: /\b(?:perlis)\b/i },
];

/**
 * Pemformat Alamat Bersih & Standard (Standard Malaysian Address Sanitizer)
 * Membuang duplikasi negeri tidak sensitif huruf (termasuk variasi cth: "Selangor Darul Ehsan", "W.P. Kuala Lumpur")
 * dan menukar pembahagi pipe "|" kepada koma.
 */
export function formatCleanAddress(
  rawAddress?: string | null,
  state?: string | null,
  siteName?: string | null
): string {
  let addr = (rawAddress || "").trim();
  if (!addr && siteName) {
    addr = siteName.trim();
  }
  if (!addr) {
    return state ? `${state}, Malaysia` : "";
  }

  // 1. Gantikan tanda '|' dengan koma
  addr = addr.replace(/\|+/g, ", ");

  // 2. Normalkan koma dan jarak berlebihan
  addr = addr.replace(/\s*,\s*/g, ", ").replace(/\s{2,}/g, " ").trim();

  // 3. Semak sama ada alamat sudah mengandungi sebarang nama negeri (case-insensitive & variasi)
  const stateStr = (state || "").trim();
  let addressAlreadyHasState = false;

  if (stateStr) {
    const matchedStateDef = MALAYSIAN_STATE_PATTERNS.find(
      (s) => s.name.toLowerCase() === stateStr.toLowerCase() || s.pattern.test(stateStr)
    );
    if (matchedStateDef) {
      if (matchedStateDef.pattern.test(addr)) {
        addressAlreadyHasState = true;
      }
    } else if (new RegExp(`\\b${stateStr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(addr)) {
      addressAlreadyHasState = true;
    }
  }

  // Jika alamat belum mengandungi nama negeri, tambah stateStr jika ada
  if (!addressAlreadyHasState && stateStr) {
    addr = `${addr}, ${stateStr}`;
  }

  // 4. Pastikan perkataan 'Malaysia' di hujung sekali
  if (!/,\s*Malaysia$/i.test(addr) && !/Malaysia$/i.test(addr)) {
    addr = `${addr}, Malaysia`;
  }

  // 5. Buang sebarang duplikasi perkataan berganda bersebelahan (cth: "Selangor, Selangor")
  addr = addr.replace(/\b([A-Za-z]+)\b(?:\s*,\s*|\s+)\1\b/gi, "$1");

  return addr.replace(/\s*,\s*,+/g, ", ").replace(/^,\s*/, "").replace(/,\s*$/, "").trim();
}

/**
 * Penterjemah Label Medan Tambahan (Custom Fields) ke Bahasa Melayu
 */
const CUSTOM_FIELD_LABELS: Record<string, string> = {
  name: "Nama",
  contact_name: "Nama",
  contact_person: "Nama PIC",
  pic: "Nama PIC",
  phone: "No. Telefon",
  phone_number: "No. Telefon",
  contact_number: "No. Telefon",
  tel: "No. Telefon",
  asset_location: "Lokasi Aset",
  location: "Lokasi Aset",
  warranty: "Waranti",
  warranty_status: "Status Waranti",
  serial_number: "No. Siri Aset",
  asset_serial: "No. Siri Aset",
  serial: "No. Siri Aset",
  defective_serial: "No. Siri Rosak",
  model: "Model / Siri",
  brand: "Jenama",
  category: "Kategori Perkakasan",
};

export function translateCustomFieldLabel(key: string): string {
  const normalized = key.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (CUSTOM_FIELD_LABELS[normalized]) return CUSTOM_FIELD_LABELS[normalized];
  if (normalized.includes("phone") || normalized.includes("tel")) return "No. Telefon";
  if (normalized.includes("warranty")) return "Waranti";
  if (normalized.includes("serial")) return "No. Siri Aset";
  if (normalized.includes("location")) return "Lokasi Aset";
  if (normalized.includes("pic") || normalized.includes("contact")) return "Nama PIC";
  return key;
}

/**
 * Komponen Paparan Logo Rakan Niaga / Pelanggan dengan Fallback Inisial (onError)
 */
const BrandAvatar = ({
  logoUrl,
  initials,
  alt = "Logo",
  className = "w-9 h-9",
  imgClassName = "w-full h-full object-contain p-1",
  fallbackClassName = "w-full h-full flex items-center justify-center font-bold text-slate-800 dark:text-slate-200 font-mono text-xs",
}: {
  logoUrl?: string | null;
  initials: string;
  alt?: string;
  className?: string;
  imgClassName?: string;
  fallbackClassName?: string;
}) => {
  const [hasError, setHasError] = useState(false);

  if (logoUrl && !hasError) {
    return (
      <div className={`${className} rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 overflow-hidden shrink-0 flex items-center justify-center`}>
        <img
          src={logoUrl}
          alt={alt}
          className={imgClassName}
          onError={() => setHasError(true)}
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div className={`${className} rounded-lg bg-[#e2e7ff] dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 shrink-0 overflow-hidden`}>
      <div className={fallbackClassName}>
        {initials}
      </div>
    </div>
  );
};

interface TicketActivity {
  id: number;
  type: string;
  status?: string | null;
  subStatus?: string | null;
  notes: string | null;
  attachmentUrl?: string | null;
  author: string;
  createdAt: Date | string;
}

interface Ticket {
  id: number;
  ticketRefNo: string | null;
  clientSiteName: string;
  address?: string | null;
  state: string;
  subject?: string | null;
  issueDescription: string;
  status: "NEW" | "IN_PROGRESS" | "ON_HOLD" | "RESOLVED" | "FOLLOW_UP" | "COMPLETE" | "CLOSED" | "CANCELLED";
  subStatus: string | null;
  severity: "P1" | "P2" | "P3" | "P4" | "NA" | null;
  slaDeadline: Date | string | null;
  slaPaused?: boolean;
  slaPausedAt?: Date | string | null;
  resolvedAt?: Date | string | null;
  updatedAt?: Date | string | null;
  eta: Date | string | null;
  feAcknowledgeStatus: string | null;
  serviceReportUrl?: string | null;
  endCustomer?: string | null;
  representAs?: string | null;
  onSiteSop?: string | null;
  defectiveSerial?: string | null;
  defectiveReturnStatus?: string | null;
  resolutionDetails?: string | null;
  createdAt: Date | string;
  mainconId?: number | null;
  maincon?: {
    id: number;
    name: string;
    customFieldsSchema: unknown;
  } | null;
  customValues?: unknown;
  deviceId?: number | null;
  device?: {
    id: number;
    category: string;
    brand: string;
    model: string;
    isStandard: boolean;
  } | null;
  deviceStatus?: string | null;
  customDeviceDetails?: string | null;
  site?: {
    id: number;
    name: string;
    group: string;
    state: string;
    address?: string | null;
  } | null;
  activities?: TicketActivity[];
  referenceAttachments?: unknown;
  serviceReportTemplateId?: number | null;
  serviceReportTemplateUrl?: string | null;
  serviceReportTemplateName?: string | null;
  serviceReportSignedAt?: Date | string | null;
  spareParts?: Array<{
    id: number;
    requestedPartName: string;
    quantity: number;
    status: string;
    courierName?: string | null;
    dispatchTrackingNo?: string | null;
    inventoryItem?: {
      name: string;
      serialNumber: string;
      warehouse?: { name: string };
    } | null;
    replacedDefectiveSerial?: string | null;
  }>;
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

export default function FEV2Dashboard() {
  const { user, signOut, refreshProfile } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const selectedTicketRef = useRef<Ticket | null>(null);

  const selectTicket = (t: Ticket | null) => {
    selectedTicketRef.current = t;
    setSelectedTicket(t);
    if (t?.id) {
      getTicketById(t.id)
        .then((fresh) => {
          if (fresh && selectedTicketRef.current?.id === t.id) {
            setSelectedTicket(fresh as unknown as Ticket);
            selectedTicketRef.current = fresh as unknown as Ticket;
          }
        })
        .catch(() => {});
    }
  };

  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [isReportTemplatePreviewOpen, setIsReportTemplatePreviewOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Navigation tab state: "home" | "service_orders" | "setting"
  const [activeTab, setActiveTab] = useState<"home" | "service_orders" | "setting">("home");

  // Filter state for Service Orders list
  const [statusFilter, setStatusFilter] = useState<"ALL" | "NEW" | "WIP" | "RESOLVED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<string | null>(null);

  // Attendance State
  const [attendanceStatus, setAttendanceStatus] = useState<"CLOCK_IN" | "ON_DUTY" | "ON_BREAK" | "CLOCK_OUT">("CLOCK_IN");
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);

  // Resume Work Confirmation Modal State
  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);
  const [ticketToResume, setTicketToResume] = useState<Ticket | null>(null);

  // Modals & Action States
  const [isEnrouteModalOpen, setIsEnrouteModalOpen] = useState(false);
  const [enrouteEtaInput, setEnrouteEtaInput] = useState("");
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [isCommentsModalOpen, setIsCommentsModalOpen] = useState(false);
  const [isDetailMenuOpen, setIsDetailMenuOpen] = useState(false);
  const [isFloatingMenuOpen, setIsFloatingMenuOpen] = useState(false);

  // Reassignment Modal States
  const [isReassignOpen, setIsReassignOpen] = useState(false);
  const [targetFeId, setTargetFeId] = useState("");
  const [reassignNotes, setReassignNotes] = useState("");
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);

  // Comment input state
  const [newCommentText, setNewCommentText] = useState("");

  // Resolution Form States
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [serviceReportFile, setServiceReportFile] = useState<File | null>(null);
  const [resolveFiles, setResolveFiles] = useState<File[]>([]);
  const [hasReplacedPart, setHasReplacedPart] = useState(false);
  const [defectiveSerial, setDefectiveSerial] = useState("");
  const [defectiveReturnStatus, setDefectiveReturnStatus] = useState("PENDING");
  const [uploading, setUploading] = useState(false);

  // Signature Pad States (ADR 0008 & Hybrid Workflow)
  const [resolveDocMode, setResolveDocMode] = useState<"upload" | "pad">("upload");
  const signCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [hasSignatureDrawn, setHasSignatureDrawn] = useState(false);

  // Follow-Up / Spare Part Request States
  const [followUpSubStatus, setFollowUpSubStatus] = useState("");
  const [partModel, setPartModel] = useState("");
  const [partName, setPartName] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [partQty, setPartQty] = useState(1);
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [followUpReportFile, setFollowUpReportFile] = useState<File | null>(null);
  const [followUpFiles, setFollowUpFiles] = useState<File[]>([]);

  // AI Drafting States
  const [isGeneratingAiResolution, setIsGeneratingAiResolution] = useState(false);
  const [isGeneratingAiFollowUp, setIsGeneratingAiFollowUp] = useState(false);

  // Profile Form States
  const [profileName, setProfileName] = useState(user?.name || "");
  const [profilePhone, setProfilePhone] = useState(user?.engineer?.phone || "");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState(user?.avatarUrl || "");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Branding & Customer Logos
  const [groupLogos, setGroupLogos] = useState<Record<string, string>>({});
  const [mainconLogos, setMainconLogos] = useState<Record<string, string>>({});

  const loadBrandLogos = async () => {
    try {
      const res = await getCustomerGroupLogosAction();
      if (res?.success) {
        setGroupLogos(res.groups || {});
        setMainconLogos(res.maincons || {});
      }
    } catch {
      // Non-blocking fallback
    }
  };

  useEffect(() => {
    loadBrandLogos();
  }, []);

  const getTicketBrandInfo = (ticket: Ticket) => {
    const representName = ticket.representAs || "";
    const groupName = ticket.endCustomer || ticket.site?.group || "";
    const mainconName = ticket.maincon?.name || "";
    const mainconId = ticket.mainconId ? String(ticket.mainconId) : "";

    let logoUrl: string | undefined;
    if (representName && groupLogos[representName.toUpperCase()]) {
      logoUrl = groupLogos[representName.toUpperCase()];
    } else if (representName && groupLogos[representName]) {
      logoUrl = groupLogos[representName];
    } else if (groupName && groupLogos[groupName.toUpperCase()]) {
      logoUrl = groupLogos[groupName.toUpperCase()];
    } else if (groupName && groupLogos[groupName]) {
      logoUrl = groupLogos[groupName];
    } else if (mainconName && mainconLogos[mainconName.toLowerCase()]) {
      logoUrl = mainconLogos[mainconName.toLowerCase()];
    } else if (mainconName && mainconLogos[mainconName]) {
      logoUrl = mainconLogos[mainconName];
    } else if (mainconId && mainconLogos[mainconId]) {
      logoUrl = mainconLogos[mainconId];
    } else if (ticket.maincon && (ticket.maincon as any).logoUrl) {
      logoUrl = (ticket.maincon as any).logoUrl;
    } else if (user?.partner?.companyPhotoUrl) {
      logoUrl = user.partner.companyPhotoUrl;
    }

    const title = representName || groupName || mainconName || ticket.clientSiteName || "Job";
    const initials = (representName || groupName || mainconName || "SO")
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 3)
      .toUpperCase() || "SO";

    return { logoUrl, title, initials };
  };

  // Live Sync & Audio Notification States
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date>(new Date());
  const initialLoadedRef = useRef(false);
  const prevTicketIdsRef = useRef<Set<number>>(new Set());

  // Web Audio chime for sound alert on new job
  const playNotificationChime = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch {
      // Audio autoplay policy fallback
    }
  };

  const activeSyncReqIdRef = useRef(0);

  const syncFETickets = async (silent = false) => {
    if (!user?.engineerId) {
      setLoading(false);
      return;
    }
    const currentReqId = ++activeSyncReqIdRef.current;
    if (!silent) setIsRefreshing(true);
    try {
      const allTicketsRes = await getTickets({ page: 1, pageSize: 250, viewPreset: "all" });
      if (currentReqId !== activeSyncReqIdRef.current) return;
      const allTickets = Array.isArray(allTicketsRes) ? allTicketsRes : (allTicketsRes?.tickets || []);
      const filtered = user.engineerId
        ? allTickets.filter((t: any) => t.assignedFeId === user.engineerId)
        : allTickets;

      const currentIds = new Set<number>(filtered.map((t: any) => t.id));
      if (initialLoadedRef.current) {
        const hasNew = filtered.some(
          (t: any) =>
            !prevTicketIdsRef.current.has(t.id) &&
            t.status !== "RESOLVED" &&
            t.status !== "CLOSED"
        );
        if (hasNew) {
          playNotificationChime();
          toast.info("New Service Order Dispatched!", {
            description: "A new service order has been assigned to you.",
          });
        }
      } else {
        initialLoadedRef.current = true;
      }
      prevTicketIdsRef.current = currentIds;

      setTickets(filtered as unknown as Ticket[]);
      setLastSyncedAt(new Date());

      // If viewing a selected ticket, keep it fresh without stale closure re-opening
      if (selectedTicketRef.current) {
        const currentTargetId = selectedTicketRef.current.id;
        const updated = filtered.find((t: any) => t.id === currentTargetId);
        if (updated && selectedTicketRef.current?.id === currentTargetId) {
          const freshDetail = await getTicketById(updated.id);
          if (currentReqId !== activeSyncReqIdRef.current) return;
          if (selectedTicketRef.current?.id === currentTargetId) {
            selectTicket((freshDetail || updated) as unknown as Ticket);
          }
        }
      }
    } catch (err: any) {
      if (currentReqId !== activeSyncReqIdRef.current) return;
      console.error("Failed to sync tickets:", err);
      if (err?.message && (err.message.includes("Server Action") || err.message.includes("Failed to find Server Action"))) {
        if (typeof window !== "undefined" && !document.hidden) {
          window.location.reload();
          return;
        }
      }
      if (!silent) toast.error("Could not refresh tickets.");
    } finally {
      if (currentReqId === activeSyncReqIdRef.current) {
        setLoading(false);
        if (!silent) setIsRefreshing(false);
      }
    }
  };

  useEffect(() => {
    syncFETickets();
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      syncFETickets(true);
    }, 45000);

    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        syncFETickets(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user?.engineerId]);

  // Load engineer profile data
  useEffect(() => {
    if (user) {
      setProfileName(user.name || "");
      setProfilePhone(user.engineer?.phone || "");
      setProfileAvatarUrl(user.avatarUrl || "");
    }
  }, [user]);

  // Pre-fill device model for spare part requests
  useEffect(() => {
    if (selectedTicket) {
      const defaultModel = selectedTicket.device
        ? `${selectedTicket.device.brand} ${selectedTicket.device.model}`.trim()
        : (selectedTicket.customDeviceDetails || "");
      setPartModel(defaultModel);
    }
  }, [selectedTicket]);

  // Calculate Ticket Queue Counts & Buckets via shared logic (ADR 0026)
  const { newTickets, wipTickets, resolvedTickets, activeJobs } = useMemo(() => {
    return categorizeFeTickets(tickets);
  }, [tickets]);

  // Distinct Client Options for Filter Chips in Orders View
  const clientOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    tickets.forEach((t) => {
      const title = getTicketBrandInfo(t).title;
      counts[title] = (counts[title] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [tickets, groupLogos, mainconLogos]);

  // Filtered List of Tickets for Service Order Tab
  const displayedTickets = useMemo(() => {
    let list = [...tickets];

    // Status Filter
    if (statusFilter === "NEW") {
      list = newTickets;
    } else if (statusFilter === "WIP") {
      list = wipTickets;
    } else if (statusFilter === "RESOLVED") {
      list = resolvedTickets;
    }

    // Client Filter
    if (selectedClient) {
      list = list.filter((t) => getTicketBrandInfo(t).title === selectedClient);
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((t) => {
        const ref = (t.ticketRefNo || `SO-${t.id}`).toLowerCase();
        const site = (t.clientSiteName || "").toLowerCase();
        const addr = (t.address || t.site?.address || "").toLowerCase();
        const state = (t.state || "").toLowerCase();
        const desc = (t.issueDescription || "").toLowerCase();
        const stat = (t.status || "").toLowerCase();
        const sub = (t.subStatus || "").toLowerCase();
        const brand = getTicketBrandInfo(t).title.toLowerCase();
        return (
          ref.includes(q) ||
          site.includes(q) ||
          addr.includes(q) ||
          state.includes(q) ||
          desc.includes(q) ||
          stat.includes(q) ||
          sub.includes(q) ||
          brand.includes(q)
        );
      });
    }

    // Sort by SLA Urgency / Newest
    return list.sort((a, b) => {
      if (a.slaDeadline && b.slaDeadline) {
        return new Date(a.slaDeadline).getTime() - new Date(b.slaDeadline).getTime();
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [tickets, statusFilter, selectedClient, searchQuery, newTickets, wipTickets, resolvedTickets, groupLogos, mainconLogos]);

  // ── Operations: Accept ➔ Enroute ➔ Check-In ➔ Check-Out ──

  const handleAccept = async (ticketId: number) => {
    startTransition(async () => {
      try {
        await acceptTicket(ticketId, "Accepted via Field Engineer mobile app.", user?.name || "Field Engineer");
        toast.success("Service Order accepted!");
        await syncFETickets(true);
      } catch (err: any) {
        toast.error(err.message || "Failed to accept service order.");
      }
    });
  };

  const handleOpenEnroute = () => {
    // Default ETA to 45 mins from now
    const now = new Date();
    now.setMinutes(now.getMinutes() + 45);
    const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setEnrouteEtaInput(localIso);
    setIsEnrouteModalOpen(true);
  };

  const handleConfirmEnroute = async () => {
    if (!selectedTicket) return;
    startTransition(async () => {
      try {
        await enrouteTicket(
          selectedTicket.id,
          enrouteEtaInput ? new Date(enrouteEtaInput) : null,
          "Field Engineer is enroute to customer site.",
          user?.name || "Field Engineer"
        );
        setIsEnrouteModalOpen(false);
        toast.success("Status updated to Enroute!");
        await syncFETickets(true);
      } catch (err: any) {
        toast.error(err.message || "Failed to update enroute status.");
      }
    });
  };

  const handleCheckIn = async (ticketId: number) => {
    startTransition(async () => {
      try {
        await checkInTicket(ticketId, "Field Engineer checked in on site.", user?.name || "Field Engineer");
        toast.success("Checked in on-site! Ticket is now In Progress.");
        await syncFETickets(true);
      } catch (err: any) {
        toast.error(err.message || "Failed to check in.");
      }
    });
  };

  const handleConfirmResumeWork = async () => {
    if (!ticketToResume) return;
    const ticketId = ticketToResume.id;
    setIsResumeModalOpen(false);
    startTransition(async () => {
      try {
        await checkInTicket(ticketId, "Field Engineer resumed on-site work.", user?.name || "Field Engineer");
        toast.success("Resumed on-site work! Status updated to In Progress.");
        setTicketToResume(null);
        await syncFETickets(true);
      } catch (err: any) {
        toast.error(err.message || "Failed to resume work.");
      }
    });
  };

  // Multi-file handling helpers
  // Multi-file handling helpers with 10MB & type guardrails (ADR 0008)
  const handleAddResolveFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      const validFiles: File[] = [];
      for (const file of newFiles) {
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`Saiz fail "${file.name}" (${(file.size / (1024 * 1024)).toFixed(1)}MB) melebihi had 10MB.`);
          continue;
        }
        if (!file.type.startsWith("image/") && !file.type.includes("pdf")) {
          toast.error(`Fail "${file.name}" bukan format imej atau PDF.`);
          continue;
        }
        validFiles.push(file);
      }
      if (validFiles.length > 0) {
        setResolveFiles((prev) => [...prev, ...validFiles]);
      }
    }
    e.target.value = "";
  };

  const handleRemoveResolveFile = (index: number) => {
    setResolveFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddFollowUpFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      const validFiles: File[] = [];
      for (const file of newFiles) {
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`Saiz fail "${file.name}" (${(file.size / (1024 * 1024)).toFixed(1)}MB) melebihi had 10MB.`);
          continue;
        }
        if (!file.type.startsWith("image/") && !file.type.includes("pdf")) {
          toast.error(`Fail "${file.name}" bukan format imej atau PDF.`);
          continue;
        }
        validFiles.push(file);
      }
      if (validFiles.length > 0) {
        setFollowUpFiles((prev) => [...prev, ...validFiles]);
      }
    }
    e.target.value = "";
  };

  const handleRemoveFollowUpFile = (index: number) => {
    setFollowUpFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Digital Signature Pad Canvas Handlers (ADR 0008 & Hybrid Workflow)
  const startSignDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = signCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsSigning(true);
  };

  const signDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isSigning) return;
    const canvas = signCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
    setHasSignatureDrawn(true);
  };

  const stopSignDraw = () => {
    setIsSigning(false);
  };

  const handleClearSignature = () => {
    const canvas = signCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignatureDrawn(false);
  };

  const handleSaveSignature = () => {
    const canvas = signCanvasRef.current;
    if (!canvas || !hasSignatureDrawn) {
      toast.error("Sila turunkan tandatangan di atas pad terlebih dahulu.");
      return;
    }
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File(
          [blob],
          `tandatangan_servis_${selectedTicket?.ticketRefNo || selectedTicket?.id || "job"}_${Date.now()}.png`,
          { type: "image/png" }
        );
        setServiceReportFile(file);
        toast.success("Tandatangan digital disimpan & dilampirkan!");
      }
    }, "image/png");
  };

  // Helper to upload multiple files and return URLs
  const uploadFileList = async (files: File[], ticketId: number): Promise<string[]> => {
    if (!files || files.length === 0) return [];
    const urls: string[] = [];
    for (const file of files) {
      try {
        let fileToUpload: Blob | File = file;
        if (file.type.startsWith("image/")) {
          fileToUpload = await compressImage(file, 1400, 1400, 0.82);
        }
        const formData = new FormData();
        formData.append("file", fileToUpload, file.name);
        formData.append("ticketId", String(ticketId));

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          if (data.url) urls.push(data.url);
        }
      } catch (uploadErr) {
        console.warn("File upload failed for:", file.name, uploadErr);
      }
    }
    return urls;
  };

  const handleAiGenerateResolution = async () => {
    if (!selectedTicket) return;
    setIsGeneratingAiResolution(true);
    try {
      const res = await generateAiResolutionAction({
        ticketId: selectedTicket.id,
        rawNotes: resolutionNotes,
        outcome: "RESOLVED",
        replacedParts: hasReplacedPart ? defectiveSerial : undefined,
        defectiveSerial: hasReplacedPart ? defectiveSerial : undefined,
      });

      if (res.success && res.draft) {
        setResolutionNotes(res.draft);
        toast.success("AI resolution summary generated!");
      } else {
        toast.error(res.error || "Failed to generate AI resolution.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to connect to AI service.");
    } finally {
      setIsGeneratingAiResolution(false);
    }
  };

  const handleAiGenerateFollowUp = async () => {
    if (!selectedTicket) return;
    setIsGeneratingAiFollowUp(true);
    try {
      const res = await generateAiResolutionAction({
        ticketId: selectedTicket.id,
        rawNotes: followUpNotes,
        outcome: "FOLLOW_UP",
        partName: partName,
        partModel: partModel,
        partQty: partQty,
      });

      if (res.success && res.draft) {
        setFollowUpNotes(res.draft);
        toast.success("AI diagnosis & follow-up draft generated!");
      } else {
        toast.error(res.error || "Failed to generate AI follow-up draft.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to connect to AI service.");
    } finally {
      setIsGeneratingAiFollowUp(false);
    }
  };

  const handleConfirmResolve = async () => {
    if (!selectedTicket) return;
    if (!resolutionNotes.trim()) {
      toast.error("Please enter resolution details before checking out.");
      return;
    }
    if (!serviceReportFile) {
      toast.error("Signed Service Report is required to complete and resolve the service order.");
      return;
    }

    setUploading(true);
    try {
      // 1. Upload mandatory Signed Service Report
      let reportUrl: string | null = null;
      if (serviceReportFile) {
        let fileToUpload: Blob | File = serviceReportFile;
        if (serviceReportFile.type.startsWith("image/")) {
          fileToUpload = await compressImage(serviceReportFile, 1600, 1600, 0.85);
        }
        const reportFormData = new FormData();
        reportFormData.append("file", fileToUpload, serviceReportFile.name);
        reportFormData.append("ticketId", String(selectedTicket.id));

        const res = await fetch("/api/upload", {
          method: "POST",
          body: reportFormData,
        });
        if (res.ok) {
          const data = await res.json();
          reportUrl = data.url;
        } else {
          throw new Error("Failed to upload service report file.");
        }
      }

      // 2. Upload optional additional field photos
      const uploadedPhotoUrls = await uploadFileList(resolveFiles, selectedTicket.id);

      startTransition(async () => {
        try {
          await updateTicketResolution(
            selectedTicket.id,
            resolutionNotes.trim(),
            new Date(),
            user?.name || "Field Engineer",
            reportUrl,
            hasReplacedPart ? defectiveSerial.trim() : null,
            hasReplacedPart ? defectiveReturnStatus : null
          );

          // If additional field photos uploaded, log them into ticket activities
          if (uploadedPhotoUrls.length > 0) {
            const photoListMarkdown = uploadedPhotoUrls
              .map((url, idx) => `[Field Photo ${idx + 1}](${url})`)
              .join(" • ");
            await addTicketComment(
              selectedTicket.id,
              `📷 Attached Field Photos (${uploadedPhotoUrls.length}):\n${photoListMarkdown}`,
              user?.name || "Field Engineer"
            );
          }

          // Mark installed spare parts if any
          if (selectedTicket?.spareParts && selectedTicket.spareParts.length > 0) {
            const activePart = selectedTicket.spareParts.find(
              (p) => p.status === "DISPATCHED" || p.status === "ALLOCATED"
            );
            if (activePart) {
              await markSparePartInstalled({
                ticketSparePartId: activePart.id,
                defectiveSerial: defectiveSerial.trim() || undefined,
                author: user?.name || "Field Engineer",
              });
            }
          }

          setIsResolveModalOpen(false);
          setResolutionNotes("");
          setServiceReportFile(null);
          setResolveFiles([]);
          setHasReplacedPart(false);
          setDefectiveSerial("");
          toast.success("Service order checked out and resolved successfully!");
          await syncFETickets(true);
        } catch (err: any) {
          toast.error(err.message || "Failed to resolve ticket.");
        } finally {
          setUploading(false);
        }
      });
    } catch (err: any) {
      toast.error("Failed to upload service report: " + err.message);
      setUploading(false);
    }
  };

  const handleConfirmFollowUp = async () => {
    if (!selectedTicket) return;
    if (!followUpSubStatus) {
      toast.error("Please select a follow-up reason before checking out.");
      return;
    }
    if (!followUpNotes.trim()) {
      toast.error("Please enter action taken & follow-up notes.");
      return;
    }

    if (followUpSubStatus === "PENDING_PARTS" && !partName.trim()) {
      toast.error("Please enter the required spare part name.");
      return;
    }

    if (!followUpReportFile) {
      toast.error("Signed Service Report is required as proof to complete check out.");
      return;
    }

    setUploading(true);
    try {
      // 1. Upload optional interim visit report if provided
      let interimReportUrl: string | null = null;
      if (followUpReportFile) {
        let fileToUpload: Blob | File = followUpReportFile;
        if (followUpReportFile.type.startsWith("image/")) {
          fileToUpload = await compressImage(followUpReportFile, 1600, 1600, 0.85);
        }
        const reportFormData = new FormData();
        reportFormData.append("file", fileToUpload, followUpReportFile.name);
        reportFormData.append("ticketId", String(selectedTicket.id));

        const res = await fetch("/api/upload", {
          method: "POST",
          body: reportFormData,
        });
        if (res.ok) {
          const data = await res.json();
          interimReportUrl = data.url;
        }
      }

      // 2. Upload multiple diagnostic photos if any
      const uploadedUrls = await uploadFileList(followUpFiles, selectedTicket.id);

      startTransition(async () => {
        try {
          // Format complete follow-up notes
          let fullNotes = followUpNotes.trim();
          if (followUpSubStatus === "PENDING_PARTS") {
            const partInfo = `[Spare Part Request: ${partName.trim()}${partModel.trim() ? ` | Model: ${partModel.trim()}` : ""}${partNumber.trim() ? ` | P/N: ${partNumber.trim()}` : ""} | Qty: ${partQty}]`;
            fullNotes = `${fullNotes}\n\n${partInfo}`;
          }

          if (interimReportUrl) {
            fullNotes = `${fullNotes}\n📄 Signed Service Report: ${interimReportUrl}`;
          }

          await updateTicketStatus(
            selectedTicket.id,
            "FOLLOW_UP",
            followUpSubStatus,
            fullNotes,
            user?.name || "Field Engineer",
            interimReportUrl || null
          );

          if (followUpSubStatus === "PENDING_PARTS" && partName.trim()) {
            const formattedPartTitle = `${partModel.trim() ? `[${partModel.trim()}] ` : ""}${partNumber.trim() ? `[P/N: ${partNumber.trim()}] ` : ""}${partName.trim()}`;
            const partNotesDetail = `Model: ${partModel.trim() || "N/A"} | P/N: ${partNumber.trim() || "N/A"}\nField Notes & Diagnosis: ${followUpNotes.trim()}${interimReportUrl ? `\nSigned Report: ${interimReportUrl}` : ""}`;

            await requestTicketSparePart({
              ticketId: selectedTicket.id,
              requestedPartName: formattedPartTitle,
              quantity: partQty,
              notes: partNotesDetail,
              author: user?.name || "Field Engineer",
            });
          }

          // If photos were uploaded, log them in activity comments
          if (uploadedUrls.length > 0) {
            const photoListMarkdown = uploadedUrls
              .map((url, idx) => `[Follow-Up Photo ${idx + 1}](${url})`)
              .join(" • ");
            await addTicketComment(
              selectedTicket.id,
              `📷 Attached Diagnostic Photos (${uploadedUrls.length}):\n${photoListMarkdown}`,
              user?.name || "Field Engineer"
            );
          }

          setIsFollowUpModalOpen(false);
          setFollowUpNotes("");
          setFollowUpSubStatus("");
          setPartModel("");
          setPartName("");
          setPartNumber("");
          setPartQty(1);
          setFollowUpReportFile(null);
          setFollowUpFiles([]);
          toast.success("Service order checked out & set to Follow-Up.");
          await syncFETickets(true);
        } catch (err: any) {
          toast.error(err.message || "Failed to set follow-up.");
        } finally {
          setUploading(false);
        }
      });
    } catch (err: any) {
      toast.error("Failed to upload attachments: " + err.message);
      setUploading(false);
    }
  };

  // Accidental Dismissal Prevention Handlers (ADR 0008 & User Safeguards)
  const handleSafeCloseResolveModal = () => {
    const hasUnsaved =
      resolutionNotes.trim() !== "" ||
      serviceReportFile !== null ||
      resolveFiles.length > 0 ||
      hasReplacedPart ||
      defectiveSerial.trim() !== "";
    if (hasUnsaved) {
      if (typeof window !== "undefined" && window.confirm("Buang draf resolusi kerja? Data yang telah diisi akan hilang.")) {
        setResolutionNotes("");
        setServiceReportFile(null);
        setResolveFiles([]);
        setHasReplacedPart(false);
        setDefectiveSerial("");
        setIsResolveModalOpen(false);
      }
    } else {
      setIsResolveModalOpen(false);
    }
  };

  const handleSafeCloseFollowUpModal = () => {
    const hasUnsaved =
      followUpNotes.trim() !== "" ||
      followUpSubStatus !== "" ||
      partName.trim() !== "" ||
      partModel.trim() !== "" ||
      partNumber.trim() !== "" ||
      followUpReportFile !== null ||
      followUpFiles.length > 0;
    if (hasUnsaved) {
      if (typeof window !== "undefined" && window.confirm("Buang draf permohonan susulan? Data yang telah diisi akan hilang.")) {
        setFollowUpNotes("");
        setFollowUpSubStatus("");
        setPartModel("");
        setPartName("");
        setPartNumber("");
        setPartQty(1);
        setFollowUpReportFile(null);
        setFollowUpFiles([]);
        setIsFollowUpModalOpen(false);
      }
    } else {
      setIsFollowUpModalOpen(false);
    }
  };

  const handleAddComment = async () => {
    if (!selectedTicket || !newCommentText.trim()) return;
    startTransition(async () => {
      try {
        await addTicketComment(selectedTicket.id, newCommentText.trim(), user?.name || "Field Engineer");
        setNewCommentText("");
        toast.success("Note added to timeline.");
        const fresh = await getTicketById(selectedTicket.id);
        if (fresh) selectTicket(fresh as unknown as Ticket);
      } catch (err: any) {
        toast.error("Failed to add note: " + err.message);
      }
    });
  };

  const handleSaveAttendance = async (newStatus: "CLOCK_IN" | "ON_DUTY" | "ON_BREAK" | "CLOCK_OUT") => {
    setAttendanceStatus(newStatus);
    setIsAttendanceModalOpen(false);
    try {
      await recordFeAttendance(newStatus);
      const labels: Record<string, string> = {
        CLOCK_IN: "Clocked In",
        ON_DUTY: "On Duty / Available",
        ON_BREAK: "On Break",
        CLOCK_OUT: "Clocked Out",
      };
      toast.success(`Status updated: ${labels[newStatus]}`);
    } catch {
      // Graceful fallback
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file (JPG, PNG, WebP).");
      return;
    }

    setUploadingAvatar(true);
    try {
      const compressed = await compressImage(file, 600, 600, 0.88);
      const formData = new FormData();
      formData.append("file", compressed, file.name);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      if (data.url) {
        setProfileAvatarUrl(data.url);
        // Persist immediately to user profile
        const updateRes = await updateUserProfileAction({ avatarUrl: data.url });
        if (updateRes.success) {
          toast.success("Profile photo updated successfully!");
          await refreshProfile();
        } else {
          toast.error(updateRes.error || "Failed to save profile photo.");
        }
      }
    } catch (err: any) {
      console.error("Avatar upload error:", err);
      toast.error("Failed to upload profile photo.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setUploadingAvatar(true);
    try {
      const updateRes = await updateUserProfileAction({ avatarUrl: null });
      if (updateRes.success) {
        setProfileAvatarUrl("");
        toast.success("Profile photo removed.");
        await refreshProfile();
      } else {
        toast.error(updateRes.error || "Failed to remove photo.");
      }
    } catch (err: any) {
      toast.error("Error removing profile photo.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) {
      toast.error("Full Name is required.");
      return;
    }
    setSavingProfile(true);
    try {
      const res = await updateUserProfileAction({
        name: profileName.trim(),
        phone: profilePhone.trim(),
        avatarUrl: profileAvatarUrl || null,
      });

      if (res.success) {
        toast.success("Profile details saved successfully!");
        await refreshProfile();
      } else {
        toast.error(res.error || "Failed to update profile.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Please enter your current password.");
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      toast.error("New password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match. Please re-enter.");
      return;
    }

    setChangingPassword(true);
    try {
      const res = await changeUserPasswordAction({
        currentPassword,
        newPassword,
      });

      if (res.success) {
        toast.success("Password changed successfully!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(res.error || "Failed to change password.");
      }
    } catch (err: any) {
      console.error("Password change error:", err);
      toast.error("Failed to change password.");
    } finally {
      setChangingPassword(false);
    }
  };

  // Helper for Google Maps Navigation
  const openMapsDirections = (siteName: string, stateName: string, address?: string | null) => {
    const fullQuery = address?.trim()
      ? `${address.trim()}, ${stateName}, Malaysia`
      : `${siteName}, ${stateName}, Malaysia`;
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullQuery)}`;
    window.open(mapsUrl, "_blank");
  };

  // Helper to copy text to clipboard
  const copyToClipboard = (text: string, label: string = "Text") => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  // Determine current lifecycle stage & CTA button for selected ticket
  const getTicketStageInfo = (ticket: Ticket) => {
    const sub = ticket.subStatus?.toUpperCase();
    const stat = ticket.status?.toUpperCase();

    if (stat === "RESOLVED" || stat === "CLOSED" || stat === "COMPLETE") {
      return {
        stage: "RESOLVED",
        label: "Selesai",
        color: "text-emerald-600 bg-emerald-50 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800",
        ctaText: "TIKET SELESAI",
        ctaDisabled: true,
        action: () => {},
      };
    }

    if (stat === "FOLLOW_UP" || stat === "ON_HOLD") {
      return {
        stage: "ON_HOLD",
        label: stat === "FOLLOW_UP" ? "Susulan Tapak" : "Ditangguhkan",
        color: "text-amber-600 bg-amber-50 border-amber-300 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-800",
        ctaText: "SAMBUNG KERJA",
        ctaDisabled: false,
        action: () => {
          setTicketToResume(ticket);
          setIsResumeModalOpen(true);
        },
      };
    }

    if (stat === "IN_PROGRESS" || sub === "CHECKED_IN") {
      return {
        stage: "CHECKED_IN",
        label: "Sedang Berlangsung",
        color: "text-blue-600 bg-blue-50 border-blue-300 dark:bg-blue-950/60 dark:text-blue-400 dark:border-blue-800",
        ctaText: "DAFTAR KELUAR & SELESAIKAN",
        ctaDisabled: false,
        action: () => setIsResolveModalOpen(true),
      };
    }

    if (sub === "ENROUTE") {
      return {
        stage: "ENROUTE",
        label: ticket.eta
          ? `Dalam Perjalanan (ETA ${new Date(ticket.eta).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })})`
          : "Dalam Perjalanan",
        color: "text-indigo-600 bg-indigo-50 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-400 dark:border-indigo-800",
        ctaText: "DAFTAR MASUK TAPAK",
        ctaDisabled: false,
        action: () => handleCheckIn(ticket.id),
      };
    }

    if (sub === "FE_ACK" || sub === "ACCEPTED" || ticket.feAcknowledgeStatus === "ACKNOWLEDGED") {
      return {
        stage: "ACCEPTED",
        label: "Pesanan Diterima",
        color: "text-sky-600 bg-sky-50 border-sky-300 dark:bg-sky-950/60 dark:text-sky-400 dark:border-sky-800",
        ctaText: "GERAK KE TAPAK (SET ETA)",
        ctaDisabled: false,
        action: handleOpenEnroute,
      };
    }

    // Default: NEW (Dispatched / Action Needed: Accept)
    return {
      stage: "NEW",
      label: "Tindakan: Terima Pesanan",
      color: "text-amber-600 bg-amber-50 border-amber-300 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-800",
      ctaText: "TERIMA PESANAN",
      ctaDisabled: false,
      action: () => handleAccept(ticket.id),
    };
  };

  // Next Priority Job: Top urgent active job sorted by active state, SLA urgency, and severity
  const nextPriorityJob = useMemo(() => {
    if (!activeJobs || activeJobs.length === 0) return null;
    return [...activeJobs].sort((a, b) => {
      const isAWorking = a.subStatus === "CHECKED_IN" || a.subStatus === "ENROUTE" || a.status === "IN_PROGRESS";
      const isBWorking = b.subStatus === "CHECKED_IN" || b.subStatus === "ENROUTE" || b.status === "IN_PROGRESS";
      if (isAWorking && !isBWorking) return -1;
      if (!isAWorking && isBWorking) return 1;

      if (a.slaDeadline && b.slaDeadline) {
        return new Date(a.slaDeadline).getTime() - new Date(b.slaDeadline).getTime();
      }
      if (a.slaDeadline && !b.slaDeadline) return -1;
      if (!a.slaDeadline && b.slaDeadline) return 1;

      const sevWeight: Record<string, number> = { P1: 1, P2: 2, P3: 3, P4: 4, NA: 5 };
      return (sevWeight[a.severity || "NA"] || 5) - (sevWeight[b.severity || "NA"] || 5);
    })[0];
  }, [activeJobs]);

  const priorityStageInfo = useMemo(() => {
    return nextPriorityJob ? getTicketStageInfo(nextPriorityJob) : null;
  }, [nextPriorityJob]);

  const getTicketPic = (ticket: Ticket | null) => {
    if (!ticket) return null;
    const schemaFields = getEffectiveCustomFields(ticket.maincon?.customFieldsSchema, ticket.endCustomer);
    const parsedValues = safeParseJson<Record<string, unknown>>(ticket.customValues, {});

    let phone = "";
    let name = "";
    for (const key of schemaFields) {
      const k = key.toLowerCase();
      const val = String(parsedValues[key] || "").trim();
      if (!val) continue;
      if (!phone && (k.includes("phone") || k.includes("tel") || k.includes("contact") || k.includes("telefon") || k.includes("hp"))) {
        phone = val;
      }
      if (!name && (k.includes("name") || k.includes("nama") || k.includes("pic") || k.includes("requestor"))) {
        name = val;
      }
    }
    if (!phone && !name) return null;
    return { name: name || "Site PIC", phone };
  };

  const priorityPic = useMemo(() => {
    return getTicketPic(nextPriorityJob);
  }, [nextPriorityJob]);

  const nocPhone = user?.partner?.phone?.trim() || "";

  // Render Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-sky-50/50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg animate-bounce mb-4">
          <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3 3 3m-3-3v12" />
          </svg>
        </div>
        <h3 className="font-bold text-slate-800 dark:text-white text-base">Loading TicketLink FE</h3>
        <p className="text-xs text-slate-500 mt-1">Synchronizing your dispatched service orders...</p>
      </div>
    );
  }

  // Render Unlinked Field Engineer Account Message
  if (!user?.engineerId) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 flex items-center justify-center mb-4 shadow-sm">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          Account Not Linked
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-sm mb-6 leading-relaxed">
          Your account is not linked to an engineer profile. Please contact your system administrator to link your profile.
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => refreshProfile()}
            className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-sm active:scale-95 transition cursor-pointer"
          >
            <span>🔄</span> Refresh Status
          </button>
          <button
            onClick={() => signOut()}
            className="w-full min-h-[44px] py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium text-sm flex items-center justify-center gap-2 active:scale-95 transition cursor-pointer"
          >
            <span>🚪</span> Sign Out
          </button>
        </div>
      </div>
    );
  }
  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN 3: TICKET DETAILS (Google Stitch Ticket Detail Design)
  // ═══════════════════════════════════════════════════════════════════════════
  if (selectedTicket) {
    const stageInfo = getTicketStageInfo(selectedTicket);
    const resolvedSiteAddress = selectedTicket.address?.trim() || selectedTicket.site?.address?.trim() || "";
    const fullAddress = formatCleanAddress(
      resolvedSiteAddress,
      selectedTicket.state,
      selectedTicket.clientSiteName
    );
    const refDisplay = selectedTicket.ticketRefNo || `SO-${String(selectedTicket.id).padStart(7, "0")}`;
    const brand = getTicketBrandInfo(selectedTicket);
    const pic = getTicketPic(selectedTicket);

    const hasSlaAlertBanner = Boolean(
      selectedTicket.slaDeadline &&
      selectedTicket.severity &&
      selectedTicket.severity !== "NA" &&
      !selectedTicket.slaPaused &&
      selectedTicket.status !== "RESOLVED"
    );

    // Stepper lifecycle progress calculation
    const isStep1Done = stageInfo.stage !== "NEW";
    const isStep2Done = ["ENROUTE", "CHECKED_IN", "ON_HOLD", "RESOLVED"].includes(stageInfo.stage);
    const isStep3Done = ["CHECKED_IN", "ON_HOLD", "RESOLVED"].includes(stageInfo.stage);
    const isStep4Done = stageInfo.stage === "RESOLVED";

    return (
      <div className="min-h-screen bg-[#faf8ff] dark:bg-slate-950 text-[#131b2e] dark:text-slate-100 flex flex-col pb-36 select-none font-st-body">
        {/* Top Header Bar */}
        <header className="fixed top-0 inset-x-0 z-50 bg-[#faf8ff]/85 dark:bg-slate-900/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-b border-slate-200/60 dark:border-slate-800 pt-safe">
          <div className="h-16 px-4 flex items-center justify-between gap-2 max-w-md mx-auto">
            {/* Back Button */}
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => selectTicket(null)}
                aria-label="Kembali"
                className="w-11 h-11 flex items-center justify-center rounded-full text-[#131b2e] dark:text-slate-100 hover:bg-[#eaedff] dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[24px]">arrow_back</span>
              </button>
              <h1 className="font-bold text-base text-[#131b2e] dark:text-white truncate tracking-tight font-st-headline">
                {i18n.details.headerTitle}
              </h1>
            </div>

            {/* Right Quick Actions: Call NOC & Activities */}
            <div className="flex items-center gap-1 shrink-0">
              {nocPhone && (
                <a
                  href={`tel:${nocPhone.replace(/[^0-9+]/g, "")}`}
                  aria-label="Hubungi Dispatch NOC"
                  className="w-10 h-10 flex items-center justify-center rounded-full text-[#3f4850] dark:text-slate-300 hover:text-[#006194] dark:hover:text-cyan-400 hover:bg-[#eaedff] dark:hover:bg-slate-800 transition-colors"
                  title={`Hubungi NOC: ${nocPhone}`}
                >
                  <span className="material-symbols-outlined text-[20px]">phone_in_talk</span>
                </a>
              )}

              <button
                type="button"
                onClick={() => setIsCommentsModalOpen(true)}
                aria-label="Log Catatan & Aktiviti"
                className="w-10 h-10 flex items-center justify-center rounded-full text-[#3f4850] dark:text-slate-300 hover:text-[#006194] dark:hover:text-cyan-400 hover:bg-[#eaedff] dark:hover:bg-slate-800 transition-colors relative cursor-pointer"
                title="Buka Catatan & Aktiviti"
              >
                <span className="material-symbols-outlined text-[20px]">chat</span>
                {selectedTicket.activities && selectedTicket.activities.length > 0 && (
                  <span className="absolute 1 top-1 right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center shadow-xs">
                    {selectedTicket.activities.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Container */}
        <main className="flex flex-col relative w-full pt-16 pb-safe bg-[#faf8ff] dark:bg-slate-950 px-4 max-w-md mx-auto">
          <div className="flex flex-col w-full pb-36 gap-y-3.5 mt-3">

            {/* 1. SLA Alert Status Banner */}
            {hasSlaAlertBanner ? (
              <div className="w-full bg-[#ffdbce] dark:bg-amber-950/60 text-[#370e00] dark:text-amber-200 rounded-xl p-3.5 shadow-sm border border-[#ffb599]/60 dark:border-amber-800/60 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-[#ffb599] dark:bg-amber-900 flex items-center justify-center shrink-0 text-[#370e00] dark:text-amber-100">
                    <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>timer</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#7f2b00] dark:text-amber-300 font-st-headline">
                      {i18n.sla.slaAlert}
                    </p>
                    <div className="text-base font-bold tracking-tight truncate font-st-headline text-[#370e00] dark:text-amber-100">
                      <SlaCountdown
                        slaDeadline={selectedTicket.slaDeadline}
                        status={selectedTicket.status}
                        severity={selectedTicket.severity}
                        state={selectedTicket.state}
                        resolvedAt={selectedTicket.resolvedAt}
                        slaPaused={selectedTicket.slaPaused}
                        slaPausedAt={selectedTicket.slaPausedAt}
                        lang="en"
                        hidePrefix={true}
                        flat={true}
                      />
                    </div>
                  </div>
                </div>
                <div className="bg-white/40 dark:bg-amber-900/60 px-2.5 py-1 rounded-full flex items-center gap-1.5 shrink-0 border border-[#a33900]/20">
                  <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                  <span className="text-[11px] font-bold uppercase font-st-headline text-[#a33900] dark:text-amber-300">
                    SLA Level: {selectedTicket.severity || "P3"}
                  </span>
                </div>
              </div>
            ) : selectedTicket.slaPaused ? (
              <div className="w-full bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-xl p-3.5 shadow-sm border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-700 dark:text-slate-300">
                    <span className="material-symbols-outlined text-[20px]">pause_circle</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-st-headline">
                      {i18n.attendance.statusLabel}
                    </p>
                    <p className="text-sm font-bold tracking-tight font-st-headline text-slate-900 dark:text-white">
                      Ditangguhkan (Menunggu Alat Ganti)
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-bold uppercase px-2.5 py-1 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-st-headline">
                  {(() => {
                    if (!selectedTicket.slaDeadline) return "SLA PAUSED";
                    const deadline = new Date(selectedTicket.slaDeadline);
                    const pausedTime = selectedTicket.slaPausedAt ? new Date(selectedTicket.slaPausedAt) : new Date();
                    return deadline.getTime() - pausedTime.getTime() < 0 ? "SLA BREACHED (PAUSED)" : "SLA PAUSED";
                  })()}
                </span>
              </div>
            ) : selectedTicket.status === "RESOLVED" ? (
              <div className="w-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 rounded-xl p-3.5 shadow-sm border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center shrink-0 text-emerald-700 dark:text-emerald-200">
                    <span className="material-symbols-outlined text-[20px]">check_circle</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-st-headline">
                      Status Pesanan
                    </p>
                    <p className="text-sm font-bold tracking-tight font-st-headline text-emerald-950 dark:text-white">
                      Tiket Selesai (SLA Dipatuhi)
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-bold uppercase px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-300 font-st-headline">
                  {i18n.queues.resolved}
                </span>
              </div>
            ) : (
              <div className="w-full bg-[#f2f3ff] dark:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-xl p-3 shadow-sm border border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-slate-400 text-[20px]">schedule</span>
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    {i18n.sla.noSla}
                  </span>
                </div>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-st-headline">
                  {i18n.sla.noSlaShort}
                </span>
              </div>
            )}

            {/* 2. Reference & Status Header Card */}
            <div className="bg-white dark:bg-slate-900 rounded-xl p-3.5 shadow-sm border border-slate-200/80 dark:border-slate-800 flex flex-col gap-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs text-[#006194] dark:text-cyan-400 font-mono font-bold bg-[#cce5ff] dark:bg-blue-950/70 px-2.5 py-1 rounded-md border border-blue-200 dark:border-blue-800">
                  #{refDisplay}
                </span>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#86f2e4]/30 dark:bg-teal-950/60 text-[#006f66] dark:text-teal-300 text-[11px] font-bold uppercase font-st-headline border border-teal-200/50 dark:border-teal-800/50">
                  <span className={`w-2 h-2 rounded-full ${
                    stageInfo.stage === "RESOLVED"
                      ? "bg-emerald-500"
                      : stageInfo.stage === "ON_HOLD"
                      ? "bg-amber-500"
                      : stageInfo.stage === "NEW"
                      ? "bg-amber-500"
                      : "bg-[#006a61] dark:bg-teal-400 animate-pulse"
                  }`} />
                  <span>{stageInfo.label}</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-[#3f4850] dark:text-slate-400 text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
                <span className="flex items-center gap-2 font-medium truncate">
                  <BrandAvatar
                    logoUrl={brand.logoUrl}
                    initials={brand.initials}
                    alt={brand.title}
                    className="w-5 h-5 rounded-xs"
                    fallbackClassName="w-full h-full flex items-center justify-center font-bold text-[9px] font-mono"
                  />
                  <span className="truncate">{brand.title}</span>
                </span>
                {!hasSlaAlertBanner && selectedTicket.severity && selectedTicket.severity !== "NA" && (
                  <span className="flex items-center gap-1 font-semibold shrink-0 font-st-headline">
                    <span className="material-symbols-outlined text-[16px] text-amber-500">priority_high</span>
                    <span>SLA Level: {selectedTicket.severity}</span>
                  </span>
                )}
              </div>
            </div>

            {/* 3. Customer & Location Card (Zero fake data as per Q3) */}
            <div className="bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow-sm border border-slate-200/80 dark:border-slate-800 flex flex-col">
              {/* Styled Vector Map Banner (No fake driving time, no fake GPS) */}
              <div className="w-full bg-gradient-to-br from-[#eaedff] via-[#e2e7ff] to-[#dae2fd] dark:from-slate-800 dark:via-slate-800/80 dark:to-slate-900 p-4 border-b border-slate-200/60 dark:border-slate-700/60 relative overflow-hidden">
                <div className="absolute right-3 -bottom-4 text-slate-400/20 dark:text-slate-600/20 pointer-events-none select-none">
                  <span className="material-symbols-outlined text-[90px]">map</span>
                </div>
                <div className="relative z-10 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-[#006194] dark:text-cyan-400 font-bold text-xs uppercase tracking-wider">
                    <span className="material-symbols-outlined text-[18px]">store</span>
                    <span>{brand.title}</span>
                  </div>
                  <h2 className="text-base font-extrabold text-[#131b2e] dark:text-white leading-tight font-st-headline">
                    {selectedTicket.clientSiteName}
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                    {fullAddress}
                  </p>
                </div>
              </div>

              <div className="p-3.5 flex flex-col gap-3">
                {/* Action Buttons Row: Waze, Google Maps, Hubungi PIC / Salin Alamat */}
                <div className="grid grid-cols-3 gap-2">
                  <a
                    href={`https://waze.com/ul?q=${encodeURIComponent(fullAddress)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Pandu arah dengan Waze"
                    className="flex flex-col items-center justify-center p-2 rounded-xl bg-[#f2f3ff] dark:bg-slate-800/80 hover:bg-[#eaedff] dark:hover:bg-slate-700/80 active:scale-95 transition-all text-[#131b2e] dark:text-slate-100 border border-slate-200/60 dark:border-slate-700/60"
                  >
                    <span className="material-symbols-outlined text-[#006194] dark:text-cyan-400 text-[22px]">near_me</span>
                    <span className="text-[11px] font-bold mt-1 font-st-headline">Waze</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => openMapsDirections(selectedTicket.clientSiteName, selectedTicket.state, resolvedSiteAddress)}
                    aria-label="Buka Google Maps"
                    className="flex flex-col items-center justify-center p-2 rounded-xl bg-[#f2f3ff] dark:bg-slate-800/80 hover:bg-[#eaedff] dark:hover:bg-slate-700/80 active:scale-95 transition-all text-[#131b2e] dark:text-slate-100 border border-slate-200/60 dark:border-slate-700/60 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[#006a61] dark:text-teal-400 text-[22px]">map</span>
                    <span className="text-[11px] font-bold mt-1 font-st-headline">Google Maps</span>
                  </button>

                  {pic?.phone ? (
                    <a
                      href={`tel:${pic.phone.replace(/[^0-9+]/g, "")}`}
                      aria-label={`Panggil PIC: ${pic.name}`}
                      className="flex flex-col items-center justify-center p-2 rounded-xl bg-[#cce5ff] dark:bg-blue-950/70 text-[#001d31] dark:text-cyan-300 hover:bg-[#b8daff] active:scale-95 transition-all text-center border border-blue-200 dark:border-blue-800"
                    >
                      <span className="material-symbols-outlined text-[22px]">phone_enabled</span>
                      <span className="text-[11px] font-bold mt-1 leading-none font-st-headline">Hubungi PIC</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(fullAddress, "Alamat Tapak")}
                      aria-label="Salin Alamat Tapak"
                      className="flex flex-col items-center justify-center p-2 rounded-xl bg-[#f2f3ff] dark:bg-slate-800/80 hover:bg-[#eaedff] dark:hover:bg-slate-700/80 active:scale-95 transition-all text-[#131b2e] dark:text-slate-100 border border-slate-200/60 dark:border-slate-700/60 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-slate-500 text-[22px]">content_copy</span>
                      <span className="text-[11px] font-bold mt-1 font-st-headline">Salin Alamat</span>
                    </button>
                  )}
                </div>

                {/* Sub-box: PIC Details */}
                <div className="bg-[#f2f3ff] dark:bg-slate-800/60 p-2.5 rounded-xl flex items-center justify-between border border-slate-200/40 dark:border-slate-700/40">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#e2e7ff] dark:bg-slate-700 flex items-center justify-center text-[#006194] dark:text-cyan-400 shrink-0">
                      <span className="material-symbols-outlined text-[18px]">badge</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#131b2e] dark:text-slate-100 truncate">
                        {pic?.name || "Pegawai Bertanggungjawab Tapak"}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        {pic?.phone || "Tiada nombor telefon direkod"}
                      </p>
                    </div>
                  </div>
                  {pic?.phone && (
                    <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[18px]" title="Nombor PIC Disahkan">
                      verified
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 4. Issue Description & Device Specification Card */}
            <div className="bg-white dark:bg-slate-900 rounded-xl p-3.5 shadow-sm border border-slate-200/80 dark:border-slate-800 flex flex-col gap-y-3">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[#a33900] text-[20px] shrink-0 mt-0.5">report_problem</span>
                <h3 className="font-bold text-sm text-[#131b2e] dark:text-white leading-snug font-st-headline">
                  {selectedTicket.subject || selectedTicket.issueDescription}
                </h3>
              </div>

              {/* Specs Grid */}
              <div className="bg-[#f2f3ff] dark:bg-slate-800/60 rounded-xl p-3 flex flex-col gap-y-2 border border-slate-200/40 dark:border-slate-700/40">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#3f4850] dark:text-slate-400 font-medium">Kategori Perkakasan:</span>
                  <span className="font-bold text-[#131b2e] dark:text-slate-100 font-st-headline">
                    {selectedTicket.device?.category || (selectedTicket as any).deviceCategory || "POS / Komputer Terminal"}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#3f4850] dark:text-slate-400 font-medium">Jenama:</span>
                  <span className="font-semibold text-[#131b2e] dark:text-slate-100">
                    {selectedTicket.device?.brand || (selectedTicket as any).deviceBrand || "Standard"}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#3f4850] dark:text-slate-400 font-medium">Model / Siri:</span>
                  <span className="font-mono text-xs text-[#006194] dark:text-cyan-400 font-semibold truncate max-w-[200px]">
                    {selectedTicket.device?.model || (selectedTicket as any).deviceModel || selectedTicket.customDeviceDetails || "—"}
                  </span>
                </div>
              </div>

              {/* Problem Symptoms & SOP Notes */}
              <div className="flex flex-col gap-y-2 pt-1">
                <div className="p-3 bg-rose-50/70 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 rounded-xl border border-rose-200/60 dark:border-rose-900/60">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[11px] font-bold uppercase flex items-center gap-1 font-st-headline">
                      <span className="material-symbols-outlined text-[15px]">info</span>
                      <span>Simptom Masalah</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(selectedTicket.issueDescription, "Keterangan Masalah")}
                      className="text-xs text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                    >
                      Salin
                    </button>
                  </div>
                  <p className="text-xs text-[#3f4850] dark:text-slate-300 leading-relaxed whitespace-pre-line">
                    {selectedTicket.issueDescription}
                  </p>
                </div>

                {/* On-Site SOP / White-Label Persona Notice */}
                {(selectedTicket.representAs || selectedTicket.onSiteSop) && (
                  <div className="p-3 bg-[#e2e7ff]/70 dark:bg-slate-800 text-[#131b2e] dark:text-slate-200 rounded-xl border border-blue-200/60 dark:border-blue-900/60 space-y-1">
                    <p className="text-[11px] font-bold uppercase flex items-center gap-1 text-[#006194] dark:text-cyan-400 font-st-headline">
                      <span className="material-symbols-outlined text-[15px]">security</span>
                      <span>Protokol & SOP Di Tapak {selectedTicket.representAs ? `(${selectedTicket.representAs})` : ""}</span>
                    </p>
                    <p className="text-xs text-[#3f4850] dark:text-slate-300 leading-relaxed">
                      {selectedTicket.onSiteSop || "Patuhi etika pakaian kemas, pamerkan pas keselamatan, dan daftarkan diri di kaunter pengurusan sebelum memulakan servis."}
                    </p>
                  </div>
                )}
              </div>

              {/* Dynamic Custom Fields (if configured) */}
              {(() => {
                const parsedCustomValues = safeParseJson<Record<string, any>>(selectedTicket.customValues, {});
                const schemaFields = getEffectiveCustomFields(selectedTicket.maincon?.customFieldsSchema, selectedTicket.endCustomer);
                const allFieldKeys = Array.from(new Set([...schemaFields, ...Object.keys(parsedCustomValues)]));
                if (allFieldKeys.length === 0) return null;

                return (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                    <span className="text-[11px] font-bold uppercase text-slate-500 font-st-headline">
                      Maklumat Tambahan Permintaan
                    </span>
                    <div className="space-y-1 divide-y divide-slate-100 dark:divide-slate-800">
                      {allFieldKeys.map((fName) => {
                        const val = parsedCustomValues[fName];
                        const displayVal = val !== undefined && val !== null && String(val).trim() !== "" ? String(val) : "—";
                        return (
                          <div key={fName} className="pt-1.5 first:pt-0 flex items-center justify-between text-xs">
                            <span className="text-slate-500 dark:text-slate-400">{translateCustomFieldLabel(fName)}:</span>
                            <span className="font-semibold text-slate-900 dark:text-slate-100 text-right truncate max-w-[200px]">
                              {displayVal}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* 5. Live AI Copilot Card */}
            <FeAiCopilotCard ticket={selectedTicket} />

            {/* 6. Aliran Kerja Lapangan (Lifecycle Stepper) */}
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200/80 dark:border-slate-800 flex flex-col gap-y-3">
              <h3 className="font-bold text-sm text-[#131b2e] dark:text-white font-st-headline">
                Aliran Kerja Lapangan
              </h3>
              <div className="flex items-center justify-between w-full pt-1 px-1">
                {/* Step 1: Terima */}
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-xs transition-colors ${
                    isStep1Done
                      ? "bg-[#006a61] text-white"
                      : "bg-[#006194] text-white ring-4 ring-[#cce5ff]"
                  }`}>
                    <span className="material-symbols-outlined text-[16px]">
                      {isStep1Done ? "done" : "electric_bolt"}
                    </span>
                  </div>
                  <span className={`text-[11px] font-bold mt-1.5 font-st-headline ${
                    isStep1Done ? "text-[#006a61] dark:text-teal-400" : "text-[#006194] dark:text-cyan-400"
                  }`}>
                    {i18n.stepper.step1}
                  </span>
                </div>

                <div className={`h-0.5 flex-1 mx-1.5 mb-5 transition-colors ${
                  isStep2Done ? "bg-[#006a61]" : "bg-slate-200 dark:bg-slate-800"
                }`} />

                {/* Step 2: Dalam Perjalanan */}
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-xs transition-colors ${
                    isStep2Done
                      ? "bg-[#006a61] text-white"
                      : stageInfo.stage === "ENROUTE"
                      ? "bg-[#006194] text-white ring-4 ring-[#cce5ff]"
                      : "bg-slate-200 dark:bg-slate-800 text-slate-400"
                  }`}>
                    <span className="material-symbols-outlined text-[16px]">
                      {isStep2Done ? "done" : "directions_car"}
                    </span>
                  </div>
                  <span className={`text-[11px] font-bold mt-1.5 font-st-headline text-center max-w-[70px] leading-tight ${
                    isStep2Done ? "text-[#006a61] dark:text-teal-400" : "text-slate-400"
                  }`}>
                    {i18n.stepper.step2}
                  </span>
                </div>

                <div className={`h-0.5 flex-1 mx-1.5 mb-5 transition-colors ${
                  isStep3Done ? "bg-[#006a61]" : "bg-slate-200 dark:bg-slate-800"
                }`} />

                {/* Step 3: Di Tapak */}
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-xs transition-colors ${
                    isStep3Done
                      ? "bg-[#006a61] text-white"
                      : stageInfo.stage === "CHECKED_IN"
                      ? "bg-[#006194] text-white ring-4 ring-[#cce5ff]"
                      : "bg-slate-200 dark:bg-slate-800 text-slate-400"
                  }`}>
                    <span className="material-symbols-outlined text-[16px]">
                      {isStep3Done ? "done" : "location_on"}
                    </span>
                  </div>
                  <span className={`text-[11px] font-bold mt-1.5 font-st-headline ${
                    isStep3Done ? "text-[#006a61] dark:text-teal-400" : "text-slate-400"
                  }`}>
                    {i18n.stepper.step3}
                  </span>
                </div>

                <div className={`h-0.5 flex-1 mx-1.5 mb-5 transition-colors ${
                  isStep4Done ? "bg-[#006a61]" : "bg-slate-200 dark:bg-slate-800"
                }`} />

                {/* Step 4: Selesai */}
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-xs transition-colors ${
                    isStep4Done
                      ? "bg-[#006a61] text-white"
                      : stageInfo.stage === "CHECKED_IN"
                      ? "bg-[#006194] text-white ring-4 ring-[#cce5ff]"
                      : "bg-slate-200 dark:bg-slate-800 text-slate-400"
                  }`}>
                    <span className="material-symbols-outlined text-[16px]">
                      {isStep4Done ? "task_alt" : "construction"}
                    </span>
                  </div>
                  <span className={`text-[11px] font-bold mt-1.5 font-st-headline ${
                    isStep4Done ? "text-[#006a61] dark:text-teal-400" : "text-slate-400"
                  }`}>
                    {i18n.stepper.step4}
                  </span>
                </div>
              </div>
            </div>

            {/* 7. Alat Ganti (Allocated Spare Parts) */}
            {selectedTicket.spareParts && selectedTicket.spareParts.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-xl p-3.5 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-st-headline flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px] text-[#006194]">swap_horiz</span>
                    <span>Alat Ganti Diperuntukkan</span>
                  </span>
                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-full">
                    {selectedTicket.spareParts.length} Komponen
                  </span>
                </div>
                <div className="space-y-2">
                  {selectedTicket.spareParts.map((part) => (
                    <div key={part.id} className="p-2.5 rounded-xl bg-[#f2f3ff] dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs">
                      <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-100">
                        <span>{part.requestedPartName} (x{part.quantity})</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          {part.status}
                        </span>
                      </div>
                      {part.inventoryItem && (
                        <p className="text-[11px] text-slate-500 mt-1 font-mono">
                          Siri: {part.inventoryItem.serialNumber} ({part.inventoryItem.name})
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 8. Dokumen Rasmi & Bukti Lapangan (ADR 0008) */}
            <div className="bg-white dark:bg-slate-900 rounded-xl p-3.5 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-st-headline flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px] text-[#006194]">assignment</span>
                  <span>Laporan Servis & Dokumen Rujukan</span>
                </span>
              </div>

              {/* Blank Form Template Link */}
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => setIsReportTemplatePreviewOpen(true)}
                  className="flex-1 py-2.5 px-3 bg-[#eaedff] dark:bg-slate-800 hover:bg-[#dae2fd] text-[#006194] dark:text-cyan-400 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer font-st-headline"
                >
                  <span className="material-symbols-outlined text-[18px]">print</span>
                  <span>Buka & Cetak Borang Servis Rasmi</span>
                </button>

                {selectedTicket.serviceReportUrl && (
                  <a
                    href={selectedTicket.serviceReportUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer font-st-headline"
                  >
                    <span className="material-symbols-outlined text-[18px]">task_alt</span>
                    <span>Lihat Laporan Bertandatangan</span>
                  </a>
                )}
              </div>

              {/* Pre-Dispatch Reference Attachments */}
              {(() => {
                const refAtts = safeParseJson<Array<{ id: string; name: string; url: string; type: string; tag?: string }>>(
                  selectedTicket.referenceAttachments,
                  []
                );
                if (refAtts.length === 0) return null;

                return (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    <span className="text-[11px] font-bold uppercase text-slate-500 font-st-headline">
                      Lampiran Pra-Hantar ({refAtts.length})
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {refAtts.map((att, idx) => (
                        <div
                          key={att.id || idx}
                          className="group relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-[#f2f3ff] dark:bg-slate-800/40 p-1 flex flex-col items-center gap-1 text-center aspect-square"
                        >
                          {att.type?.startsWith("image/") ? (
                            <div
                              className="w-full h-full rounded-lg overflow-hidden relative cursor-pointer"
                              onClick={() => setLightboxUrl(att.url)}
                              title="Tekan untuk zum"
                            >
                              <img src={att.url} alt={att.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition-opacity">
                                Zum
                              </div>
                            </div>
                          ) : (
                            <a
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full h-full rounded-lg flex flex-col items-center justify-center text-slate-700 dark:text-slate-300"
                            >
                              <span className="material-symbols-outlined text-[24px] text-[#006194]">description</span>
                              <span className="text-[9px] font-mono mt-1 truncate max-w-[65px]">{att.name}</span>
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* 9. Catatan & Log Aktiviti Tapak */}
            <div className="bg-white dark:bg-slate-900 rounded-xl p-3.5 shadow-sm border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-[#006194]">forum</span>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white font-st-headline">
                    Catatan & Aktiviti Tapak
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {selectedTicket.activities?.length || 0} entri direkodkan
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCommentsModalOpen(true)}
                className="px-3 py-1.5 bg-[#eaedff] dark:bg-slate-800 hover:bg-[#dae2fd] text-[#006194] dark:text-cyan-400 rounded-lg text-xs font-bold transition cursor-pointer font-st-headline"
              >
                Buka Log
              </button>
            </div>

          </div>
        </main>

        {/* ── Fixed Bottom Operational Actions (Stitch Docked Design) ── */}
        <div className="fixed bottom-0 inset-x-0 z-40 bg-[#faf8ff]/90 dark:bg-slate-900/90 backdrop-blur-lg px-4 pb-safe pt-2 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] border-t border-slate-200/60 dark:border-slate-800">
          <div className="flex flex-col gap-2 max-w-md mx-auto mb-2">
            {stageInfo.stage === "CHECKED_IN" ? (
              <>
                {/* Primary Action: Check-Out & Selesai */}
                <button
                  type="button"
                  onClick={() => setIsResolveModalOpen(true)}
                  disabled={isPending}
                  className="w-full h-12 bg-[#006194] hover:bg-[#007bb9] text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-1.5 shadow-md active:scale-98 transition-all cursor-pointer font-st-headline whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-[20px]">check_circle</span>
                  <span>Check-Out &amp; Selesai</span>
                </button>

                {/* Secondary Action: Alat Ganti / Follow-Up */}
                <button
                  type="button"
                  onClick={() => setIsFollowUpModalOpen(true)}
                  disabled={isPending}
                  className="w-full h-10 bg-[#eaedff] dark:bg-slate-800 text-[#131b2e] dark:text-slate-100 hover:bg-[#dae2fd] font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 active:scale-98 transition-all cursor-pointer font-st-headline whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-[#a33900] text-[18px]">inventory_2</span>
                  <span>Alat Ganti / Follow-Up</span>
                </button>
              </>
            ) : stageInfo.stage === "ACCEPTED" ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenEnroute}
                  disabled={isPending}
                  className="flex-1 h-12 bg-[#006194] hover:bg-[#007bb9] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1 shadow-md active:scale-98 transition-all cursor-pointer font-st-headline whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-[18px]">directions_car</span>
                  <span>Set ETA</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCheckIn(selectedTicket.id)}
                  disabled={isPending}
                  className="flex-1 h-12 bg-[#006a61] hover:bg-[#007f74] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1 shadow-md active:scale-98 transition-all cursor-pointer font-st-headline whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-[18px]">location_on</span>
                  <span>Check-In Tapak</span>
                </button>
              </div>
            ) : stageInfo.stage === "ENROUTE" ? (
              <button
                type="button"
                onClick={() => handleCheckIn(selectedTicket.id)}
                disabled={isPending}
                className="w-full h-12 bg-[#006a61] hover:bg-[#007f74] text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-1.5 shadow-md active:scale-98 transition-all cursor-pointer font-st-headline whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-[20px]">location_on</span>
                <span>Check-In Tapak</span>
              </button>
            ) : stageInfo.stage === "NEW" ? (
              <button
                type="button"
                onClick={() => handleAccept(selectedTicket.id)}
                disabled={isPending}
                className="w-full h-12 bg-[#006194] hover:bg-[#007bb9] text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-1.5 shadow-md active:scale-98 transition-all cursor-pointer font-st-headline whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-[20px]">electric_bolt</span>
                <span>Terima &amp; Set ETA</span>
              </button>
            ) : stageInfo.stage === "ON_HOLD" ? (
              <button
                type="button"
                onClick={() => {
                  setTicketToResume(selectedTicket);
                  setIsResumeModalOpen(true);
                }}
                disabled={isPending}
                className="w-full h-12 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-1.5 shadow-md active:scale-98 transition-all cursor-pointer font-st-headline whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-[20px]">replay</span>
                <span>Sambung Semula Kerja</span>
              </button>
            ) : (
              <div className="w-full h-11 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 font-st-headline whitespace-nowrap">
                <span className="material-symbols-outlined text-[18px]">task_alt</span>
                <span>Pesanan Servis Selesai</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Modal: Set Enroute & ETA ── */}
        {isEnrouteModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
              <div className="text-center">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950 text-blue-600 flex items-center justify-center mx-auto mb-2">
                  <span className="material-symbols-outlined text-[24px]">directions_car</span>
                </div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white font-st-headline">Mula Perjalanan (Set ETA)</h3>
                <p className="text-xs text-slate-500 mt-1">Tetapkan anggaran masa ketibaan anda di tapak pelanggan.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 font-st-headline">
                  Anggaran Masa Ketibaan (ETA)
                </label>
                <input
                  type="datetime-local"
                  value={enrouteEtaInput}
                  onChange={(e) => setEnrouteEtaInput(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsEnrouteModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer font-st-headline"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmEnroute}
                  disabled={isPending}
                  className="flex-1 py-2.5 rounded-xl bg-[#006194] hover:bg-[#007bb9] text-white text-xs font-bold shadow-sm cursor-pointer font-st-headline"
                >
                  {isPending ? "Menetapkan..." : "Sahkan & Gerak"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal: Check Out & Selesaikan Tugasan (ADR 0008 & Hybrid Workflow) ── */}
        {isResolveModalOpen && (
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 z-50 animate-in fade-in"
            onClick={(e) => {
              if (e.target === e.currentTarget) handleSafeCloseResolveModal();
            }}
          >
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 max-w-md w-full space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="text-teal-600">✓</span>
                  <span>Daftar Keluar & Selesaikan Tugasan</span>
                </h3>
                <button
                  type="button"
                  onClick={handleSafeCloseResolveModal}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Resolution Notes */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Tindakan Penyelesaian & Nota *
                  </label>
                  <button
                    type="button"
                    onClick={handleAiGenerateResolution}
                    disabled={isGeneratingAiResolution}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[11px] font-semibold transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className={`h-3 w-3 ${isGeneratingAiResolution ? "animate-spin" : "animate-pulse"}`} />
                    <span>{isGeneratingAiResolution ? "Menjana..." : "✨ Draf AI"}</span>
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Nyatakan tindakan pembaikan, penyelesaian masalah, dan alat ganti yang diganti (atau klik ✨ Draf AI)..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Defective Part Replaced Toggle */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasReplacedPart}
                    onChange={(e) => setHasReplacedPart(e.target.checked)}
                    className="w-4 h-4 rounded text-teal-600"
                  />
                  <span>Ada menggantikan modul / perkakasan fizikal?</span>
                </label>
                {hasReplacedPart && (
                  <div className="space-y-2 pt-1 animate-in fade-in">
                    <div>
                      <span className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                        Nombor Siri (S/N) Alat Ganti Rosak
                      </span>
                      <input
                        type="text"
                        value={defectiveSerial}
                        onChange={(e) => setDefectiveSerial(e.target.value)}
                        placeholder="Masukkan S/N alat rosak yang diambil dari tapak"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 1. Mandatory Signed Service Report (Upload OR Signature Pad) */}
              <div className="space-y-2.5 p-3.5 rounded-2xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200/80 dark:border-teal-800/60">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-teal-950 dark:text-teal-200 flex items-center gap-1.5">
                    <span>📄</span>
                    <span>Laporan Servis Bertandatangan *</span>
                  </label>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    serviceReportFile
                      ? "text-emerald-700 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300"
                      : "text-rose-600 bg-rose-100 dark:bg-rose-950 dark:text-rose-300"
                  }`}>
                    {serviceReportFile ? "Dilampirkan ✓" : "Wajib"}
                  </span>
                </div>

                {serviceReportFile ? (
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-teal-300 dark:border-teal-700 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xl flex-shrink-0">
                        {serviceReportFile.type.includes("pdf") ? "📑" : "✍️"}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
                          {serviceReportFile.name}
                        </p>
                        <p className="text-[10px] text-teal-600 dark:text-teal-400 font-medium">
                          {(serviceReportFile.size / 1024).toFixed(1)} KB • Sedia untuk dimuat naik
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setServiceReportFile(null);
                        handleClearSignature();
                      }}
                      className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-xs font-bold transition cursor-pointer flex-shrink-0"
                      title="Buang laporan"
                    >
                      ✕ Buang / Tukar
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Mode Toggle: Upload vs Signature Pad */}
                    <div className="grid grid-cols-2 p-1 bg-teal-100/60 dark:bg-teal-900/40 rounded-xl text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setResolveDocMode("upload")}
                        className={`py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          resolveDocMode === "upload"
                            ? "bg-white dark:bg-slate-800 text-teal-900 dark:text-white shadow-xs"
                            : "text-teal-700 dark:text-teal-300 hover:text-teal-900"
                        }`}
                      >
                        <span>📁</span>
                        <span>Muat Naik / Imbas</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setResolveDocMode("pad")}
                        className={`py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          resolveDocMode === "pad"
                            ? "bg-white dark:bg-slate-800 text-teal-900 dark:text-white shadow-xs"
                            : "text-teal-700 dark:text-teal-300 hover:text-teal-900"
                        }`}
                      >
                        <span>✍️</span>
                        <span>Pad Tandatangan</span>
                      </button>
                    </div>

                    {resolveDocMode === "upload" ? (
                      <label className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed border-teal-300 dark:border-teal-700/80 bg-white/80 dark:bg-slate-900/80 hover:bg-teal-50 dark:hover:bg-teal-950/50 text-center cursor-pointer transition">
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          capture="environment"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 10 * 1024 * 1024) {
                                toast.error(`Saiz fail "${file.name}" (${(file.size / (1024 * 1024)).toFixed(1)}MB) melebihi had 10MB.`);
                                e.target.value = "";
                                return;
                              }
                              if (!file.type.startsWith("image/") && !file.type.includes("pdf")) {
                                toast.error(`Fail "${file.name}" bukan format imej atau PDF.`);
                                e.target.value = "";
                                return;
                              }
                              setServiceReportFile(file);
                            }
                            e.target.value = "";
                          }}
                          className="hidden"
                        />
                        <span className="text-2xl mb-1">📸</span>
                        <span className="text-xs font-bold text-teal-950 dark:text-teal-200">
                          Muat Naik / Ambil Gambar Borang Laporan Servis
                        </span>
                        <span className="text-[10px] text-slate-500 mt-0.5">
                          PDF, JPG atau PNG (Maks 10MB • Sokongan imbasan kamera)
                        </span>
                      </label>
                    ) : (
                      <div className="space-y-2 p-2 bg-white dark:bg-slate-900 rounded-xl border border-teal-200 dark:border-teal-800">
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>Turunkan tandatangan di ruang bawah:</span>
                          <button
                            type="button"
                            onClick={handleClearSignature}
                            className="text-rose-600 hover:underline cursor-pointer font-semibold"
                          >
                            Padam Semula
                          </button>
                        </div>
                        <canvas
                          ref={signCanvasRef}
                          width={320}
                          height={140}
                          onPointerDown={startSignDraw}
                          onPointerMove={signDraw}
                          onPointerUp={stopSignDraw}
                          onPointerLeave={stopSignDraw}
                          className="w-full h-36 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-300 dark:border-slate-700 touch-none cursor-crosshair"
                        />
                        <button
                          type="button"
                          onClick={handleSaveSignature}
                          disabled={!hasSignatureDrawn}
                          className="w-full py-2 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <span>✓</span>
                          <span>Sahkan & Lampirkan Tandatangan Ini</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2. Optional Additional Field Photos */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    📷 Foto Lapangan Tambahan <span className="text-[10px] font-normal text-slate-400">(Pilihan / Pelbagai)</span>
                  </label>
                  {resolveFiles.length > 0 && (
                    <span className="text-[10px] font-bold text-teal-600 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-full">
                      {resolveFiles.length} foto
                    </span>
                  )}
                </div>

                {/* File Previews Grid */}
                {resolveFiles.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 py-1">
                    {resolveFiles.map((file, idx) => {
                      const isImg = file.type.startsWith("image/");
                      const previewUrl = isImg ? URL.createObjectURL(file) : null;
                      return (
                        <div
                          key={idx}
                          className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-1 flex flex-col items-center justify-center text-center aspect-square"
                        >
                          {isImg && previewUrl ? (
                            <img
                              src={previewUrl}
                              alt={file.name}
                              className="w-full h-full object-cover rounded-lg"
                              onLoad={() => URL.revokeObjectURL(previewUrl)}
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center p-1">
                              <span className="text-xl">📄</span>
                              <span className="text-[9px] font-mono text-slate-500 truncate max-w-[70px] mt-1">
                                {file.name}
                              </span>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveResolveFile(idx)}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-600 text-white font-bold text-[10px] flex items-center justify-center shadow-xs hover:bg-rose-700 cursor-pointer"
                            title="Buang foto"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add Photos Button */}
                <label className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/80 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer transition">
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    capture="environment"
                    onChange={handleAddResolveFiles}
                    className="hidden"
                  />
                  <span className="text-base">📸</span>
                  <span>{resolveFiles.length > 0 ? "Tambah Foto Lapangan Lain" : "Ambil Foto / Pilih Foto Lapangan"}</span>
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleSafeCloseResolveModal}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmResolve}
                  disabled={uploading || isPending}
                  className="flex-1 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {uploading ? "Memuat Naik & Menyelesaikan..." : "Hantar & Selesaikan"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal: Daftar Keluar & Tetapkan Susulan Tapak (Follow Up) ── */}
        {isFollowUpModalOpen && (
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 z-50 animate-in fade-in"
            onClick={(e) => {
              if (e.target === e.currentTarget) handleSafeCloseFollowUpModal();
            }}
          >
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 max-w-md w-full space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>📦</span>
                  <span>Daftar Keluar & Tetapkan Susulan Tapak</span>
                </h3>
                <button
                  type="button"
                  onClick={handleSafeCloseFollowUpModal}
                  className="text-slate-400 p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Follow-Up Reason Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Sebab Susulan *
                </label>
                <select
                  value={followUpSubStatus}
                  onChange={(e) => setFollowUpSubStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white cursor-pointer"
                >
                  <option value="" disabled>-- Sila Pilih Sebab Susulan --</option>
                  <option value="PENDING_PARTS">📦 Menunggu Penghantaran Alat Ganti</option>
                  <option value="PENDING_SIGN_OFF">⏳ Menunggu Akses Tapak / Pengesahan Pelanggan</option>
                  <option value="MONITORING">🔬 Ujian & Pemantauan Peralatan</option>
                  <option value="REVISIT">🔁 Lawatan Tapak Ulangan Diperlukan</option>
                </select>
              </div>

              {/* Structured Spare Part Request Form (Model, Part Name, Part Number, Qty, Diagnosis) */}
              {followUpSubStatus === "PENDING_PARTS" && (
                <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 rounded-2xl space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                      <span>⚙️</span>
                      <span>Butiran Alat Ganti</span>
                    </span>
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
                      Diperlukan
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Device Model */}
                    <div>
                      <label className="block text-[11px] font-bold text-amber-900 dark:text-amber-200 mb-1">
                        Model Peranti
                      </label>
                      <input
                        type="text"
                        value={partModel}
                        onChange={(e) => setPartModel(e.target.value)}
                        placeholder="cth. ThinkPad L14 Gen 2"
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-300/80 dark:border-amber-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>

                    {/* Part Name */}
                    <div>
                      <label className="block text-[11px] font-bold text-amber-900 dark:text-amber-200 mb-1">
                        Nama Alat Ganti *
                      </label>
                      <input
                        type="text"
                        value={partName}
                        onChange={(e) => setPartName(e.target.value)}
                        placeholder="cth. Skrin LCD / Motherboard"
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-300/80 dark:border-amber-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>

                    {/* Part Number (P/N / FRU) */}
                    <div>
                      <label className="block text-[11px] font-bold text-amber-900 dark:text-amber-200 mb-1">
                        Nombor Alat Ganti (P/N / FRU)
                      </label>
                      <input
                        type="text"
                        value={partNumber}
                        onChange={(e) => setPartNumber(e.target.value)}
                        placeholder="cth. 5M10W85942"
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-300/80 dark:border-amber-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                      />
                    </div>

                    {/* Quantity */}
                    <div>
                      <label className="block text-[11px] font-bold text-amber-900 dark:text-amber-200 mb-1">
                        Kuantiti
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={partQty}
                        onChange={(e) => setPartQty(Math.max(1, Number(e.target.value)))}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-300/80 dark:border-amber-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Action Taken & Findings Notes */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Tindakan Diambil & Langkah Seterusnya *
                  </label>
                  <button
                    type="button"
                    onClick={handleAiGenerateFollowUp}
                    disabled={isGeneratingAiFollowUp}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[11px] font-semibold transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className={`h-3 w-3 ${isGeneratingAiFollowUp ? "animate-spin" : "animate-pulse"}`} />
                    <span>{isGeneratingAiFollowUp ? "Menjana..." : "✨ Draf AI"}</span>
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={followUpNotes}
                  onChange={(e) => setFollowUpNotes(e.target.value)}
                  placeholder="Nyatakan diagnosis, tindakan troubleshooting hari ini, dan kerja yang diperlukan untuk lawatan seterusnya (atau klik ✨ Draf AI)..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Mandatory Signed Service Report */}
              <div className="space-y-1.5 p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                    <span>📄</span>
                    <span>Laporan Servis Bertandatangan (Wajib) *</span>
                  </label>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    followUpReportFile
                      ? "text-emerald-700 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300"
                      : "text-rose-600 bg-rose-100 dark:bg-rose-950 dark:text-rose-300"
                  }`}>
                    {followUpReportFile ? "Dilampirkan ✓" : "Wajib"}
                  </span>
                </div>

                {followUpReportFile ? (
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xl flex-shrink-0">
                        {followUpReportFile.type.includes("pdf") ? "📑" : "🖼️"}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
                          {followUpReportFile.name}
                        </p>
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                          {(followUpReportFile.size / 1024).toFixed(1)} KB • Sedia dimuat naik
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFollowUpReportFile(null)}
                      className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-xs font-bold transition cursor-pointer flex-shrink-0"
                      title="Buang laporan"
                    >
                      ✕ Buang
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl border border-dashed border-amber-300 dark:border-amber-700 bg-white/80 dark:bg-slate-900/80 hover:bg-amber-50 dark:hover:bg-amber-950/50 text-xs font-semibold text-amber-900 dark:text-amber-200 cursor-pointer transition">
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      capture="environment"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 10 * 1024 * 1024) {
                            toast.error(`Saiz fail "${file.name}" (${(file.size / (1024 * 1024)).toFixed(1)}MB) melebihi had 10MB.`);
                            e.target.value = "";
                            return;
                          }
                          if (!file.type.startsWith("image/") && !file.type.includes("pdf")) {
                            toast.error(`Fail "${file.name}" bukan format imej atau PDF.`);
                            e.target.value = "";
                            return;
                          }
                          setFollowUpReportFile(file);
                        }
                        e.target.value = "";
                      }}
                      className="hidden"
                    />
                    <span className="text-base">📎</span>
                    <span>Lampirkan Laporan Servis Bertandatangan (Maks 10MB)</span>
                  </label>
                )}
              </div>

              {/* Optional Diagnostic Photos & Evidence */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    📷 Foto Diagnostik & Bukti <span className="text-[10px] font-normal text-slate-400">(Pilihan / Pelbagai)</span>
                  </label>
                  {followUpFiles.length > 0 && (
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full">
                      {followUpFiles.length} foto
                    </span>
                  )}
                </div>

                {/* File Previews Grid */}
                {followUpFiles.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 py-1">
                    {followUpFiles.map((file, idx) => {
                      const isImg = file.type.startsWith("image/");
                      const previewUrl = isImg ? URL.createObjectURL(file) : null;
                      return (
                        <div
                          key={idx}
                          className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-1 flex flex-col items-center justify-center text-center aspect-square"
                        >
                          {isImg && previewUrl ? (
                            <img
                              src={previewUrl}
                              alt={file.name}
                              className="w-full h-full object-cover rounded-lg"
                              onLoad={() => URL.revokeObjectURL(previewUrl)}
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center p-1">
                              <span className="text-xl">📄</span>
                              <span className="text-[9px] font-mono text-slate-500 truncate max-w-[70px] mt-1">
                                {file.name}
                              </span>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveFollowUpFile(idx)}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-600 text-white font-bold text-[10px] flex items-center justify-center shadow-xs hover:bg-rose-700 cursor-pointer"
                            title="Buang fail"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add Photos Button / Input */}
                <label className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/80 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer transition">
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    capture="environment"
                    onChange={handleAddFollowUpFiles}
                    className="hidden"
                  />
                  <span className="text-base">📸</span>
                  <span>{followUpFiles.length > 0 ? "Tambah Foto Diagnostik Lain" : "Ambil Foto / Pilih Foto Diagnostik"}</span>
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleSafeCloseFollowUpModal}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmFollowUp}
                  disabled={uploading || isPending}
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {uploading ? "Memuat Naik..." : "Sahkan & Daftar Keluar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal: Comments / Timeline Feed ── */}
        {isCommentsModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 max-w-md w-full space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  💬 Service Order Timeline & Notes
                </h3>
                <button onClick={() => setIsCommentsModalOpen(false)} className="text-slate-400 p-1">✕</button>
              </div>

              {/* Feed List */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {(selectedTicket.activities || []).length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No notes yet.</p>
                ) : (
                  (selectedTicket.activities || []).map((act) => (
                    <div key={act.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs">
                      <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
                        <span>{act.author}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(act.createdAt).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                        {act.notes}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {/* Add Note Input */}
              <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <input
                  type="text"
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="Add a field note..."
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddComment}
                  disabled={isPending || !newCommentText.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer"
                >
                  Post
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal: Service Report Form Preview & Print ── */}
        {isReportTemplatePreviewOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
            <div className="relative w-full max-w-2xl max-h-[92vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
              {/* Modal Header */}
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-lg shadow-xs">
                    📄
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      {selectedTicket.serviceReportTemplateName || "Official Field Service Report"}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-mono">
                      {selectedTicket.ticketRefNo || `SO-${selectedTicket.id}`} • {selectedTicket.clientSiteName}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition cursor-pointer"
                    title="Print this form"
                  >
                    <span>🖨️</span>
                    <span>Print Form</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsReportTemplatePreviewOpen(false)}
                    className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center text-xs font-bold transition cursor-pointer"
                    title="Close"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Modal Printable Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 print:p-0">
                {/* Optional Custom Template Direct Link */}
                {selectedTicket.serviceReportTemplateUrl && (
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-indigo-950 dark:text-indigo-200 block">
                        Custom Client PDF Template Attached
                      </span>
                      <span className="text-[11px] text-indigo-700 dark:text-indigo-300">
                        You can also open or download the exact uploaded PDF file.
                      </span>
                    </div>
                    <a
                      href={selectedTicket.serviceReportTemplateUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shrink-0 shadow-xs inline-flex items-center gap-1"
                    >
                      <span>↗</span> Open PDF
                    </a>
                  </div>
                )}

                {/* Standard Printable Sheet */}
                <div className="bg-white text-slate-900 p-5 rounded-2xl border border-slate-300 shadow-xs space-y-4 font-sans text-xs">
                  {/* Header with White-Label Persona */}
                  <div className="border-b-2 border-slate-900 pb-3 flex items-start justify-between gap-4">
                    <div>
                      {selectedTicket.representAs ? (
                        <div className="inline-block px-2.5 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-300 font-black text-[11px] uppercase tracking-wider mb-1">
                          🛡️ On-Site Persona: Represent as {selectedTicket.representAs}
                        </div>
                      ) : (
                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-0.5">
                          TicketLink Field Operations
                        </span>
                      )}
                      <h2 className="text-lg font-black tracking-tight uppercase">
                        Field Service Report
                      </h2>
                      <p className="text-[11px] text-slate-600">
                        Client: <strong>{selectedTicket.maincon?.name || "N/A"}</strong>
                        {selectedTicket.endCustomer && ` • Agency: ${selectedTicket.endCustomer}`}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase text-slate-500 block">Service Order</span>
                      <span className="font-mono font-black text-sm text-blue-700 block">
                        {selectedTicket.ticketRefNo || `SO-${selectedTicket.id}`}
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        Date: {new Date(selectedTicket.createdAt).toLocaleDateString("en-MY")}
                      </span>
                    </div>
                  </div>

                  {/* Grid: Site & Client Info */}
                  <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Site Location</span>
                      <span className="font-bold text-slate-900 block">{selectedTicket.clientSiteName}</span>
                      <span className="text-[11px] text-slate-600 block mt-0.5">
                        {selectedTicket.address || selectedTicket.site?.address || `${selectedTicket.clientSiteName}, ${selectedTicket.state}`}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Assigned Engineer</span>
                      <span className="font-bold text-slate-900 block">{profileName || "Field Engineer"}</span>
                      <span className="text-[11px] text-slate-600 block mt-0.5">
                        State: {selectedTicket.state} • Severity: {selectedTicket.severity || "P3"}
                      </span>
                    </div>
                  </div>

                  {/* Requestor / Client Custom Fields */}
                  {(() => {
                    const customObj = safeParseJson<Record<string, any>>(selectedTicket.customValues, {});
                    const schemaFields = getEffectiveCustomFields(selectedTicket.maincon?.customFieldsSchema, selectedTicket.endCustomer);
                    const fieldKeys = Array.from(new Set([...schemaFields, ...Object.keys(customObj)]));

                    if (fieldKeys.length === 0) return null;

                    return (
                      <div className="border border-slate-200 rounded-xl p-3 space-y-1.5">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">
                          Customer Asset &amp; Contact Details
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {fieldKeys.map((key) => (
                            <div key={key} className="text-[11px]">
                              <span className="text-slate-500 block">{key}:</span>
                              <span className="font-semibold text-slate-800 block truncate">
                                {String(customObj[key] ?? "—")}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Problem Description */}
                  <div className="border border-slate-200 rounded-xl p-3 space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">
                      Reported Problem
                    </span>
                    {selectedTicket.subject && (
                      <p className="font-bold text-slate-900 text-xs">{selectedTicket.subject}</p>
                    )}
                    <p className="text-slate-700 text-xs whitespace-pre-line leading-relaxed">
                      {selectedTicket.issueDescription}
                    </p>
                  </div>

                  {/* Blank Ruled Section for On-site Technician Findings & Action Taken */}
                  <div className="border border-slate-200 rounded-xl p-3 space-y-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">
                      Corrective Action Taken / Root Cause
                    </span>
                    <div className="space-y-3 pt-1">
                      <div className="border-b border-dashed border-slate-300 h-5" />
                      <div className="border-b border-dashed border-slate-300 h-5" />
                      <div className="border-b border-dashed border-slate-300 h-5" />
                    </div>
                  </div>

                  {/* Blank Ruled Section for Spare Parts Replaced */}
                  <div className="border border-slate-200 rounded-xl p-3 space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">
                      Spare Parts Replaced
                    </span>
                    <div className="grid grid-cols-3 gap-2 text-[10px] font-bold text-slate-600 bg-slate-100 p-1.5 rounded">
                      <span>Part Name / Item</span>
                      <span>Defective S/N</span>
                      <span>Installed New S/N</span>
                    </div>
                    <div className="border-b border-dashed border-slate-300 h-6" />
                    <div className="border-b border-dashed border-slate-300 h-6" />
                  </div>

                  {/* Dual Client & Engineer Sign-Off Section */}
                  <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-300">
                    <div className="border border-slate-300 rounded-xl p-3 space-y-8">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">
                        Field Engineer Sign-Off
                      </span>
                      <div className="space-y-1 text-[11px] text-slate-700">
                        <div className="border-b border-slate-400 pt-6" />
                        <p>Name: {profileName || "_________________________"}</p>
                        <p>Date &amp; Time: _______________________</p>
                      </div>
                    </div>

                    <div className="border border-slate-300 rounded-xl p-3 space-y-8">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">
                        Client / Site Representative Stamp &amp; Signature
                      </span>
                      <div className="space-y-1 text-[11px] text-slate-700">
                        <div className="border-b border-slate-400 pt-6" />
                        <p>Name &amp; IC: ________________________</p>
                        <p>Designation: ____________________</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN 1: HOME DASHBOARD (Screenshot 1)
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen fe-v2-root bg-slate-100/60 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col pb-32 select-none font-st-body">
      
      {/* ── Top Header with TicketLink FE v2 Stitch Branding ── */}
      <header className="fixed top-0 inset-x-0 z-50 bg-[#faf8ff]/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-16 px-3 sm:px-4 flex items-center justify-between gap-1.5 sm:gap-2 max-w-md mx-auto whitespace-nowrap">
          <div className="flex items-center gap-2 min-w-0 shrink-0">
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shadow-xs flex-shrink-0 bg-white flex items-center justify-center">
              <img
                src={user?.partner?.companyPhotoUrl || "/logo.jpg"}
                alt={user?.partner?.name || "TicketLink Logo"}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = "/logo.jpg";
                }}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="header-brand-text hidden sm:inline font-bold text-base text-[#006194] dark:text-cyan-400 tracking-tight truncate font-st-headline">
                  TicketLink
                </span>
                <span className="text-[10px] tracking-wider text-white bg-[#006194] px-1.5 py-0.5 rounded font-bold font-mono whitespace-nowrap">
                  FE v2
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#006a61] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#006a61]"></span>
                </span>
                <span className="text-[10px] uppercase text-[#006a61] dark:text-teal-400 font-bold tracking-wider font-mono">
                  LIVE SYNC
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 whitespace-nowrap">
            {/* Audio Alert Chime Toggle */}
            <button
              onClick={() => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                if (next) playNotificationChime();
                toast.success(next ? "Notification audio alert enabled." : "Audio chime muted.");
              }}
              aria-label="Toggle Audio Chime"
              className="w-10 h-10 flex items-center justify-center rounded-full text-slate-600 dark:text-slate-300 hover:text-[#006194] transition-colors cursor-pointer shrink-0"
              title={soundEnabled ? "Audio alert on" : "Audio muted"}
            >
              <span className="material-symbols-outlined text-[20px]">
                {soundEnabled ? "notifications_active" : "notifications_off"}
              </span>
            </button>

            {/* Prominent High-Contrast Classic UI Switcher Button */}
            <Link
              href="/"
              className="w-10 h-10 sm:w-auto sm:h-auto flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm hover:opacity-90 active:scale-95 transition shrink-0 font-st-headline"
              title="UI Klasik"
              aria-label="Kembali ke UI Klasik"
            >
              <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
              <span className="header-classic-text hidden sm:inline">Classic UI</span>
            </Link>

            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Screen Container */}
      <main className="flex flex-col relative w-full pt-20 pb-28 px-4 max-w-md mx-auto flex-1">
        
        {/* ─── TAB 1: HOME (Google Stitch Home View) ─── */}
        {activeTab === "home" && (
          <div className="flex flex-col w-full space-y-4">
            
            {/* 1. Engineer Profile & Quick Attendance Card */}
            <section className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200/70 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-[#cce5ff] text-[#006194] dark:bg-slate-800 dark:text-cyan-400 flex items-center justify-center font-bold text-base border-2 border-white dark:border-slate-800 shadow-xs">
                    {user?.avatarUrl ? (
                      <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span>{user?.name ? user.name.slice(0, 2).toUpperCase() : "FE"}</span>
                    )}
                  </div>
                  <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[#006a61] ring-2 ring-white dark:ring-slate-900 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="font-bold text-base text-slate-900 dark:text-white truncate font-st-headline">
                    {user?.name || "Field Engineer"}
                  </h2>
                  <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                    {user?.partner?.companyPhotoUrl ? (
                      <div className="w-4 h-4 rounded overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 bg-white flex items-center justify-center">
                        <img
                          src={user.partner.companyPhotoUrl}
                          alt={user.partner.name || "Partner Logo"}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = "none";
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded shrink-0 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[9px] font-bold flex items-center justify-center font-mono">
                        {(user?.partner?.name || "SP").slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="text-xs text-slate-500 dark:text-slate-400 truncate font-medium">
                      {user?.partner?.name || "Rakan Servis Bebas"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Attendance Mode Toggles */}
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/60">
                {attendanceStatus === "ON_BREAK" ? (
                  <button
                    onClick={() => handleSaveAttendance("ON_DUTY")}
                    className="flex items-center justify-center gap-1.5 h-11 px-3 rounded-lg bg-[#eaedff] dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-bold active:scale-95 transition cursor-pointer"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[18px] text-[#006a61]">play_arrow</span>
                    <span>Kembali Bertugas</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleSaveAttendance("ON_BREAK")}
                    disabled={attendanceStatus === "CLOCK_OUT"}
                    className="flex items-center justify-center gap-1.5 h-11 px-3 rounded-lg bg-[#eaedff] dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-bold active:scale-95 transition cursor-pointer disabled:opacity-50"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[18px] text-[#a33900]">coffee</span>
                    <span>{i18n.attendance.onBreak}</span>
                  </button>
                )}

                {attendanceStatus === "CLOCK_OUT" ? (
                  <button
                    onClick={() => handleSaveAttendance("CLOCK_IN")}
                    className="flex items-center justify-center gap-1.5 h-11 px-3 rounded-lg bg-[#cce5ff] dark:bg-blue-950/60 text-[#001d31] dark:text-blue-200 border border-transparent dark:border-blue-800/60 text-xs font-bold active:scale-95 transition cursor-pointer"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[18px]">login</span>
                    <span>{i18n.attendance.clockIn}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleSaveAttendance("CLOCK_OUT")}
                    className="flex items-center justify-center gap-1.5 h-11 px-3 rounded-lg bg-[#ffdcd3] dark:bg-rose-950/60 text-[#370e00] dark:text-rose-200 border border-transparent dark:border-rose-900/60 text-xs font-bold active:scale-95 transition cursor-pointer"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[18px]">logout</span>
                    <span>{i18n.attendance.clockOut}</span>
                  </button>
                )}
              </div>
            </section>

            {/* 2. Service Orders Queue Summary (ADR 0026 synchronized) */}
            <section className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white font-st-headline">
                  Status Tiket Servis
                </h3>
                <span className="text-[11px] font-bold text-[#006194] dark:text-cyan-400 font-mono uppercase">
                  {tickets.length} Jumlah Tiket
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {/* Baru / New Card */}
                <div
                  onClick={() => {
                    setStatusFilter("NEW");
                    setActiveTab("service_orders");
                  }}
                  className="bg-white dark:bg-slate-900 p-3 rounded-xl shadow-xs border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between min-h-[96px] cursor-pointer hover:border-[#006194]/40 transition active:scale-98"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#006194] dark:text-cyan-400 font-bold uppercase tracking-wider font-mono">
                      {i18n.queues.new}
                    </span>
                    <span className="w-2 h-2 rounded-full bg-[#006194]"></span>
                  </div>
                  <div className="my-1">
                    <span className="text-3xl font-black text-[#006194] dark:text-cyan-400 leading-none font-st-headline">
                      {newTickets.length}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    Tindakan: Terima
                  </span>
                </div>

                {/* Sedang WIP Card */}
                <div
                  onClick={() => {
                    setStatusFilter("WIP");
                    setActiveTab("service_orders");
                  }}
                  className="bg-white dark:bg-slate-900 p-3 rounded-xl shadow-xs border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between min-h-[96px] cursor-pointer hover:border-[#a33900]/40 transition active:scale-98"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#a33900] dark:text-orange-400 font-bold uppercase tracking-wider font-mono">
                      {i18n.queues.wip}
                    </span>
                    <span className="w-2 h-2 rounded-full bg-[#a33900]"></span>
                  </div>
                  <div className="my-1">
                    <span className="text-3xl font-black text-[#a33900] dark:text-orange-400 leading-none font-st-headline">
                      {wipTickets.length}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    Enroute / Tapak
                  </span>
                </div>

                {/* Selesai Card */}
                <div
                  onClick={() => {
                    setStatusFilter("RESOLVED");
                    setActiveTab("service_orders");
                  }}
                  className="bg-white dark:bg-slate-900 p-3 rounded-xl shadow-xs border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between min-h-[96px] cursor-pointer hover:border-[#006a61]/40 transition active:scale-98"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#006a61] dark:text-teal-400 font-bold uppercase tracking-wider font-mono">
                      {i18n.queues.resolved}
                    </span>
                    <span className="w-2 h-2 rounded-full bg-[#006a61]"></span>
                  </div>
                  <div className="my-1">
                    <span className="text-3xl font-black text-[#006a61] dark:text-teal-400 leading-none font-st-headline">
                      {resolvedTickets.length}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    Selesai Disahkan
                  </span>
                </div>
              </div>
            </section>

            {/* 3. Urgent Priority Job Highlight Card (Stitch View) */}
            {nextPriorityJob && priorityStageInfo && (
              <section className="flex flex-col gap-2">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[20px] text-[#cc4900]">warning</span>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white font-st-headline">
                      Tugasan Keutamaan Seterusnya
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-[#cc4900] font-mono uppercase">
                    {nextPriorityJob.severity && ["P1", "P2"].includes(nextPriorityJob.severity)
                      ? `${nextPriorityJob.severity} SEGERA`
                      : nextPriorityJob.severity
                      ? `SLA Level: ${nextPriorityJob.severity}`
                      : "P1 SEGERA"}
                  </span>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200/70 dark:border-slate-800 relative overflow-hidden flex flex-col gap-3">
                  {/* Left Urgent Indicator Strip */}
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#cc4900]"></div>

                  {/* Brand Header & SLA Badge */}
                  <div className="flex items-start justify-between gap-2">
                    {(() => {
                      const priorityBrand = getTicketBrandInfo(nextPriorityJob);
                      return (
                        <div className="flex items-center gap-2.5 min-w-0">
                          <BrandAvatar
                            logoUrl={priorityBrand.logoUrl}
                            initials={priorityBrand.initials}
                            alt={priorityBrand.title}
                            className="w-9 h-9"
                          />
                          <div className="min-w-0">
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 tracking-wider uppercase font-bold block truncate font-mono">
                              {priorityBrand.title}
                            </span>
                            <span className="text-xs font-bold text-[#006194] dark:text-cyan-400 font-mono">
                              {nextPriorityJob.ticketRefNo || `SO-${String(nextPriorityJob.id).padStart(7, "0")}`}
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* SLA Badge */}
                    {nextPriorityJob.slaPaused ? (
                      <div className="shrink-0 bg-[#eaedff] dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 px-2.5 py-1 rounded-full flex items-center gap-1 font-mono text-[11px] font-bold">
                        <span className="material-symbols-outlined text-[14px]">pause_circle</span>
                        <span>
                          {(() => {
                            if (!nextPriorityJob.slaDeadline) return "SLA PAUSED";
                            const deadline = new Date(nextPriorityJob.slaDeadline);
                            const pausedTime = nextPriorityJob.slaPausedAt ? new Date(nextPriorityJob.slaPausedAt) : new Date();
                            return deadline.getTime() - pausedTime.getTime() < 0 ? "SLA BREACHED (PAUSED)" : "SLA PAUSED";
                          })()}
                        </span>
                      </div>
                    ) : (
                      <div className="shrink-0 bg-[#ffdbce] dark:bg-amber-950/60 text-[#370e00] dark:text-amber-200 border border-transparent dark:border-amber-800/50 px-2.5 py-1 rounded-full flex items-center gap-1 font-mono text-[11px] font-bold">
                        <span className="material-symbols-outlined text-[14px]">timer</span>
                        {nextPriorityJob.slaDeadline ? (
                          <SlaCountdown
                            slaDeadline={nextPriorityJob.slaDeadline}
                            status={nextPriorityJob.status}
                            severity={nextPriorityJob.severity}
                            state={nextPriorityJob.state}
                            slaPaused={nextPriorityJob.slaPaused}
                            slaPausedAt={nextPriorityJob.slaPausedAt}
                            lang="en"
                            hidePrefix={true}
                            flat={true}
                          />
                        ) : (
                          <span>{i18n.sla.noSlaShort}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Problem Statement */}
                  <div
                    onClick={() => selectTicket(nextPriorityJob)}
                    className="cursor-pointer group"
                  >
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white leading-snug group-hover:text-[#006194] transition font-st-headline">
                      {nextPriorityJob.subject || nextPriorityJob.issueDescription}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {nextPriorityJob.issueDescription}
                    </p>
                  </div>

                  {/* Location Details */}
                  <div className="bg-[#f2f3ff] dark:bg-slate-800/80 p-2.5 rounded-lg flex items-center justify-between">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="material-symbols-outlined text-[20px] text-[#006194] shrink-0 mt-0.5">storefront</span>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-900 dark:text-white block truncate font-st-headline">
                          {nextPriorityJob.clientSiteName}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-300 block truncate mt-0.5">
                          {formatCleanAddress(
                            nextPriorityJob.address || nextPriorityJob.site?.address,
                            nextPriorityJob.state,
                            nextPriorityJob.clientSiteName
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Buttons for Field Ergonomics (48px+ targets) */}
                  <div className="space-y-2 pt-1">
                    {/* Primary Button */}
                    <button
                      onClick={() => {
                        selectTicket(nextPriorityJob);
                        if (priorityStageInfo.action) priorityStageInfo.action();
                      }}
                      disabled={isPending || priorityStageInfo.ctaDisabled}
                      className="w-full min-h-[48px] bg-[#006194] hover:bg-[#004b73] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs active:scale-98 transition cursor-pointer"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {priorityStageInfo.stage === "NEW" ? "bolt" : priorityStageInfo.stage === "ON_HOLD" ? "sync" : priorityStageInfo.stage === "ENROUTE" ? "pin_drop" : "how_to_reg"}
                      </span>
                      <span>{priorityStageInfo.ctaText}</span>
                    </button>

                    {/* Navigation & Call Row */}
                    <div className="grid grid-cols-2 gap-2">
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          formatCleanAddress(
                            nextPriorityJob.address || nextPriorityJob.site?.address,
                            nextPriorityJob.state,
                            nextPriorityJob.clientSiteName
                          )
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-11 bg-[#eaedff] dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 active:scale-98 transition cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[18px] text-[#006194]">navigation</span>
                        <span>Waze / Maps</span>
                      </a>

                      {priorityPic?.phone ? (
                        <a
                          href={`tel:${priorityPic.phone}`}
                          className="h-11 bg-[#eaedff] dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 active:scale-98 transition cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[18px] text-[#006a61]">call</span>
                          <span className="truncate">Hubungi: {priorityPic.name}</span>
                        </a>
                      ) : (
                        <button
                          onClick={() => {
                            copyToClipboard(
                              formatCleanAddress(
                                nextPriorityJob.address || nextPriorityJob.site?.address,
                                nextPriorityJob.state,
                                nextPriorityJob.clientSiteName
                              ),
                              "Alamat Tapak"
                            );
                          }}
                          className="h-11 bg-[#eaedff] dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 active:scale-98 transition cursor-pointer"
                          type="button"
                        >
                          <span className="material-symbols-outlined text-[18px] text-slate-500">content_copy</span>
                          <span>Salin Alamat</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* 4. Today's Upcoming Schedule ('Jadual Tugasan Hari Ini') */}
            <section className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white font-st-headline">
                  Jadual Tugasan Hari Ini
                </h3>
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 font-mono">
                  {activeJobs.length} Menunggu
                </span>
              </div>

              {activeJobs.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200/70 dark:border-slate-800 text-center shadow-xs">
                  <span className="material-symbols-outlined text-3xl text-emerald-500 mb-1">task_alt</span>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Tiada tugasan tertangguh</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Semua servis pesanan telah selesai disahkan.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeJobs.slice(0, 4).map((job) => {
                    const stage = getTicketStageInfo(job);
                    const clientTag = job.representAs || job.endCustomer || job.maincon?.name || "Client";
                    const ref = job.ticketRefNo || `SO-${String(job.id).padStart(7, "0")}`;
                    return (
                      <div
                        key={job.id}
                        onClick={() => selectTicket(job)}
                        className="bg-white dark:bg-slate-900 p-3.5 rounded-xl shadow-xs border border-slate-200/70 dark:border-slate-800 flex flex-col gap-2 cursor-pointer hover:border-[#006194]/40 active:scale-98 transition"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider block truncate font-mono">
                              {clientTag}
                            </span>
                            <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate mt-0.5 font-st-headline">
                              {job.subject || job.issueDescription}
                            </h4>
                            <span className="text-[11px] text-[#006194] dark:text-cyan-400 font-semibold font-mono">
                              #{ref}
                            </span>
                          </div>

                          <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] uppercase font-bold font-mono ${
                            stage.stage === "CHECKED_IN"
                              ? "bg-[#e2e7ff] text-[#006194]"
                              : stage.stage === "ENROUTE"
                              ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                              : stage.stage === "ON_HOLD"
                              ? "bg-[#ffdbce] text-[#370e00]"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                          }`}>
                            {stage.stage === "CHECKED_IN" ? "On Site" : stage.stage === "NEW" ? "Action Needed" : stage.label}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs pt-1 border-t border-slate-100 dark:border-slate-800/80">
                          <div className="flex items-center gap-1 min-w-0">
                            <span className="material-symbols-outlined text-[15px] shrink-0 text-slate-400">location_on</span>
                            <span className="text-[11px] truncate">{job.clientSiteName}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                            {job.state}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* 5. Clean Quick Utilities Grid ('Peralatan Lapangan') - Functional Only */}
            <section className="flex flex-col gap-2">
              <div className="px-1">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white font-st-headline">
                  Peralatan Lapangan
                </h3>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {/* AI Copilot FE Tool */}
                <button
                  onClick={() => {
                    if (activeJobs.length > 0) {
                      selectTicket(activeJobs[0]);
                    } else {
                      toast.info("Pilih tiket untuk menggunakan pembantu AI Copilot.");
                    }
                  }}
                  className="bg-white dark:bg-slate-900 p-3.5 rounded-xl shadow-xs border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-3 min-h-[56px] active:scale-98 transition cursor-pointer"
                  type="button"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#ffdbce] text-[#a33900] flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[22px]">smart_toy</span>
                    </div>
                    <div className="text-left">
                      <span className="font-bold text-xs text-slate-900 dark:text-white block font-st-headline">
                        AI Copilot FE
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                        Bantuan diagnosis ralat & cadangan penyelesaian pantas
                      </span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-slate-400 text-[18px]">chevron_right</span>
                </button>
              </div>
            </section>

            {/* 6. Quick NOC Hotline Support Trigger - Only Shown If Partner Phone Exists */}
            {nocPhone && (
              <div className="flex items-center justify-between p-3.5 bg-[#eaedff] dark:bg-slate-800 rounded-xl">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[#006194] flex items-center justify-center text-white shrink-0">
                    <span className="material-symbols-outlined text-[18px]">support_agent</span>
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-xs text-slate-900 dark:text-white block font-st-headline">
                      NOC Meja Bantuan FE
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate font-mono">
                      {nocPhone}
                    </span>
                  </div>
                </div>
                <a
                  className="h-9 px-3 rounded-lg bg-white dark:bg-slate-900 text-[#006194] dark:text-cyan-400 font-bold text-xs flex items-center gap-1 shadow-xs active:scale-95 transition shrink-0"
                  href={`tel:${nocPhone}`}
                >
                  <span className="material-symbols-outlined text-[16px]">call</span>
                  <span>Dail</span>
                </a>
              </div>
            )}

          </div>
        )}

        {/* ─── TAB 2: SERVICE ORDER LISTING (Google Stitch Orders Design) ─── */}
        {activeTab === "service_orders" && (
          <div className="flex flex-col w-full pb-10">
            {/* Search & Quick Navigation */}
            <div className="flex flex-col gap-2 pt-1 mb-3">
              {/* Search Bar */}
              <div className="relative flex items-center w-full">
                <span className="material-symbols-outlined absolute left-3.5 text-[22px] text-slate-400 dark:text-slate-500 pointer-events-none">
                  search
                </span>
                <input
                  aria-label="Cari Pesanan Servis"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-12 pl-11 pr-10 rounded-xl bg-[#eaedff] dark:bg-slate-900 text-[#131b2e] dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 text-sm focus:outline-none focus:bg-[#e2e7ff] dark:focus:bg-slate-800 transition-colors border border-transparent focus:border-[#006194]/40"
                  placeholder="Cari No. SO, Tapak, Isu, Status..."
                  type="search"
                />
                {searchQuery ? (
                  <button
                    onClick={() => setSearchQuery("")}
                    aria-label="Kosongkan Carian"
                    className="absolute right-2.5 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                ) : (
                  <div
                    aria-label="Imbas Kod Bar"
                    className="absolute right-2.5 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-500 pointer-events-none"
                  >
                    <span className="material-symbols-outlined text-[20px]">barcode_scanner</span>
                  </div>
                )}
              </div>

              {/* Segmented Status Tabs (ADR 0026 Synchronized) */}
              <div className="flex p-1 bg-[#f2f3ff] dark:bg-slate-900 rounded-xl gap-1 overflow-x-auto no-scrollbar" role="tablist">
                <button
                  type="button"
                  aria-selected={statusFilter === "ALL"}
                  onClick={() => setStatusFilter("ALL")}
                  className={`flex-1 py-2 px-2.5 rounded-lg text-xs text-center whitespace-nowrap cursor-pointer transition-all font-st-headline ${
                    statusFilter === "ALL"
                      ? "bg-white dark:bg-slate-800 text-[#006194] dark:text-cyan-400 shadow-sm font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-semibold"
                  }`}
                  role="tab"
                >
                  Semua ({tickets.length})
                </button>
                <button
                  type="button"
                  aria-selected={statusFilter === "NEW"}
                  onClick={() => setStatusFilter("NEW")}
                  className={`flex-1 py-2 px-2.5 rounded-lg text-xs text-center whitespace-nowrap cursor-pointer transition-all flex items-center justify-center gap-1 font-st-headline ${
                    statusFilter === "NEW"
                      ? "bg-white dark:bg-slate-800 text-[#006194] dark:text-cyan-400 shadow-sm font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-semibold"
                  }`}
                  role="tab"
                >
                  <span>Baru</span>
                  {newTickets.length > 0 && (
                    <span className="w-4 h-4 rounded-full bg-[#cc4900] text-white text-[10px] flex items-center justify-center font-bold font-mono">
                      {newTickets.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  aria-selected={statusFilter === "WIP"}
                  onClick={() => setStatusFilter("WIP")}
                  className={`flex-1 py-2 px-2.5 rounded-lg text-xs text-center whitespace-nowrap cursor-pointer transition-all flex items-center justify-center gap-1 font-st-headline ${
                    statusFilter === "WIP"
                      ? "bg-white dark:bg-slate-800 text-[#006194] dark:text-cyan-400 shadow-sm font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-semibold"
                  }`}
                  role="tab"
                >
                  <span>WIP</span>
                  {wipTickets.length > 0 && (
                    <span className="w-4 h-4 rounded-full bg-[#006a61] text-white text-[10px] flex items-center justify-center font-bold font-mono">
                      {wipTickets.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  aria-selected={statusFilter === "RESOLVED"}
                  onClick={() => setStatusFilter("RESOLVED")}
                  className={`flex-1 py-2 px-2.5 rounded-lg text-xs text-center whitespace-nowrap cursor-pointer transition-all font-st-headline ${
                    statusFilter === "RESOLVED"
                      ? "bg-white dark:bg-slate-800 text-[#006194] dark:text-cyan-400 shadow-sm font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-semibold"
                  }`}
                  role="tab"
                >
                  Selesai ({resolvedTickets.length})
                </button>
              </div>

              {/* Horizontal Multi-Client Chips (Dynamic from Loaded Tickets) */}
              {clientOptions.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                  <button
                    type="button"
                    onClick={() => setSelectedClient(null)}
                    className={`px-3 py-1.5 rounded-full text-[11px] whitespace-nowrap transition cursor-pointer font-bold font-st-headline ${
                      selectedClient === null
                        ? "bg-[#006194] text-white shadow-sm"
                        : "bg-[#eaedff] dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-[#dae2fd] dark:hover:bg-slate-800"
                    }`}
                  >
                    Semua Klien
                  </button>
                  {clientOptions.map(([clientTitle, count]) => (
                    <button
                      key={clientTitle}
                      type="button"
                      onClick={() => setSelectedClient(selectedClient === clientTitle ? null : clientTitle)}
                      className={`px-3 py-1.5 rounded-full text-[11px] whitespace-nowrap transition cursor-pointer flex items-center gap-1 font-semibold font-st-headline ${
                        selectedClient === clientTitle
                          ? "bg-[#006194] text-white shadow-sm"
                          : "bg-[#eaedff] dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-[#dae2fd] dark:hover:bg-slate-800"
                      }`}
                    >
                      <span className="truncate max-w-[120px]">{clientTitle}</span>
                      <span className="opacity-70 text-[10px] font-mono">({count})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Live Sync Info & Dispatch Banner */}
            <div
              onClick={() => syncFETickets(true)}
              className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#e2e7ff]/60 dark:bg-slate-900/80 mb-3 cursor-pointer hover:bg-[#dae2fd]/70 dark:hover:bg-slate-800/80 transition border border-slate-200/50 dark:border-slate-800"
            >
              <div className="flex items-center gap-2">
                <span className={`material-symbols-outlined text-[18px] text-[#006a61] ${isRefreshing ? "animate-spin" : ""}`}>
                  sync
                </span>
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  {isRefreshing ? "Mengemas kini tiket..." : "Tarik ke bawah / klik untuk kemas kini live sync"}
                </span>
              </div>
              <div className="flex items-center gap-1 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full text-[#006a61] text-[10px] font-bold font-mono shadow-xs shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-[#006a61] animate-pulse"></span>
                <span>NOC AKTIF</span>
              </div>
            </div>

            {/* Orders Feed */}
            <div className="flex flex-col gap-3">
              {displayedTickets.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-xl p-8 border border-slate-200/80 dark:border-slate-800 text-center space-y-2 shadow-sm">
                  <span className="material-symbols-outlined text-[40px] text-slate-300 dark:text-slate-600">
                    inbox
                  </span>
                  <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 font-st-headline">
                    Tiada Pesanan Servis
                  </h4>
                  <p className="text-xs text-slate-400">
                    {searchQuery || selectedClient || statusFilter !== "ALL"
                      ? "Tiada pesanan memenuhi kriteria carian atau penapis semasa."
                      : "Tiada tugasan aktif dalam senarai."}
                  </p>
                  {(searchQuery || selectedClient || statusFilter !== "ALL") && (
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setSelectedClient(null);
                        setStatusFilter("ALL");
                      }}
                      className="mt-2 px-3 py-1.5 rounded-lg bg-[#eaedff] dark:bg-slate-800 text-[#006194] dark:text-cyan-400 text-xs font-bold cursor-pointer"
                    >
                      Tetapkan Semula Penapis
                    </button>
                  )}
                </div>
              ) : (
                displayedTickets.map((ticket) => {
                  const stage = getTicketStageInfo(ticket);
                  const soRef = ticket.ticketRefNo || `SO-${String(ticket.id).padStart(7, "0")}`;
                  const brand = getTicketBrandInfo(ticket);
                  const pic = getTicketPic(ticket);
                  const isP1 = ticket.severity === "P1";
                  const isResolved = ticket.status === "RESOLVED" || ticket.status === "CLOSED" || ticket.status === "COMPLETE";
                  const isCheckedIn = ticket.feAcknowledgeStatus === "CHECKED_IN" || ticket.status === "IN_PROGRESS";
                  const isEnroute = ticket.feAcknowledgeStatus === "ENROUTE" || ticket.subStatus?.toUpperCase() === "ENROUTE";
                  const isAccepted = ticket.feAcknowledgeStatus === "ACKNOWLEDGED" || ticket.subStatus?.toUpperCase() === "ACCEPTED" || ticket.subStatus?.toUpperCase() === "FE_ACK";
                  const isNew = stage.stage === "NEW";

                  // Left Accent Strip color
                  const stripColor = isResolved
                    ? "bg-[#86f2e4]"
                    : isP1
                    ? "bg-[#cc4900]"
                    : ticket.status === "ON_HOLD" || ticket.status === "FOLLOW_UP" || ticket.slaPaused
                    ? "bg-[#707881]"
                    : isCheckedIn || isEnroute || isAccepted
                    ? "bg-[#006a61]"
                    : "bg-[#007bb9]";

                  return (
                    <div
                      key={ticket.id}
                      className="relative bg-white dark:bg-slate-900 rounded-xl shadow-sm hover:shadow-md p-4 flex flex-col gap-3 overflow-hidden border border-slate-200/80 dark:border-slate-800 transition"
                    >
                      {/* Critical/Status Accent Left Strip */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${stripColor}`} />

                      {/* Header: Client & Meta */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <BrandAvatar
                            logoUrl={brand.logoUrl}
                            initials={brand.initials}
                            alt={brand.title}
                            className="w-8 h-8"
                          />
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-[#e2e7ff] dark:bg-slate-800 text-[#131b2e] dark:text-slate-100 font-bold text-[10px] tracking-wider uppercase font-st-headline truncate max-w-[140px]">
                                {brand.title}
                              </span>
                              <span className="text-[10px] tracking-wide text-slate-500 dark:text-slate-400 truncate font-mono">
                                {soRef}
                              </span>
                            </div>
                            {isP1 ? (
                              <span className="text-[10px] font-bold text-[#cc4900] dark:text-orange-400 mt-1 uppercase flex items-center gap-1 font-st-headline">
                                <span className="material-symbols-outlined text-[14px]">warning</span>
                                P1 KRITIKAL
                              </span>
                            ) : ticket.severity === "P2" ? (
                              <span className="text-[10px] font-bold text-[#cc4900] dark:text-orange-400 mt-1 uppercase flex items-center gap-1 font-st-headline">
                                <span className="material-symbols-outlined text-[14px]">priority_high</span>
                                P2 SEGERA
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase font-st-headline">
                                SLA Level: {ticket.severity || "P3"}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* SLA Pill */}
                        {isResolved ? (
                          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 text-xs shrink-0 font-bold font-st-headline">
                            <span className="material-symbols-outlined text-[14px]">check_circle</span>
                            <span>SELESAI</span>
                          </div>
                        ) : ticket.slaPaused ? (
                          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#eaedff] dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs shrink-0 font-bold font-st-headline">
                            <span className="material-symbols-outlined text-[14px]">pause_circle</span>
                            <span>
                              {(() => {
                                if (!ticket.slaDeadline) return "SLA PAUSED";
                                const deadline = new Date(ticket.slaDeadline);
                                const pausedTime = ticket.slaPausedAt ? new Date(ticket.slaPausedAt) : new Date();
                                return deadline.getTime() - pausedTime.getTime() < 0 ? "SLA BREACHED (PAUSED)" : "SLA PAUSED";
                              })()}
                            </span>
                          </div>
                        ) : ticket.slaDeadline && ticket.severity && ticket.severity !== "NA" ? (
                          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#ffdbce] dark:bg-amber-950/60 text-[#370e00] dark:text-amber-200 border border-transparent dark:border-amber-800/50 text-xs shrink-0 font-bold font-st-headline">
                            <span className="material-symbols-outlined text-[14px]">timer</span>
                            <SlaCountdown
                              slaDeadline={ticket.slaDeadline}
                              status={ticket.status}
                              severity={ticket.severity}
                              state={ticket.state}
                              resolvedAt={ticket.resolvedAt}
                              slaPaused={ticket.slaPaused}
                              slaPausedAt={ticket.slaPausedAt}
                              lang="en"
                              hidePrefix={true}
                              flat={true}
                            />
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 text-[10px] font-mono">Tiada SLA</span>
                        )}
                      </div>

                      {/* Subject & Site Detail */}
                      <div
                        onClick={() => selectTicket(ticket)}
                        className="flex flex-col gap-1.5 cursor-pointer group"
                      >
                        <h2 className="font-bold text-sm text-[#131b2e] dark:text-slate-100 leading-snug group-hover:text-[#006194] dark:group-hover:text-cyan-400 transition font-st-headline">
                          {ticket.subject || ticket.issueDescription}
                        </h2>
                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 text-xs">
                          <span className="material-symbols-outlined text-[16px] shrink-0 text-[#006194] dark:text-cyan-400">
                            storefront
                          </span>
                          <span className="truncate">
                            {ticket.clientSiteName} • {formatCleanAddress(ticket.address || ticket.site?.address, ticket.state, ticket.clientSiteName)}
                          </span>
                        </div>
                      </div>

                      {/* Substatus / On-Site Indicator */}
                      {isCheckedIn && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#eaedff] dark:bg-slate-800 text-[#006f66] dark:text-teal-300">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#006a61] animate-pulse shrink-0"></span>
                          <span className="text-xs font-semibold font-st-headline">
                            Sedang Berlangsung (Daftar Masuk Tapak Aktif)
                          </span>
                        </div>
                      )}

                      {/* Spare Parts Banner if exists */}
                      {ticket.spareParts && ticket.spareParts.length > 0 && (
                        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-[#ffdbce]/40 dark:bg-orange-950/30 text-[#7f2b00] dark:text-orange-200 text-xs">
                          <span className="material-symbols-outlined text-[18px] text-[#a33900] shrink-0">
                            local_shipping
                          </span>
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-xs text-[#a33900] dark:text-orange-300 font-st-headline truncate">
                              Alat Ganti: {ticket.spareParts[0].requestedPartName} ({ticket.spareParts[0].quantity} unit)
                            </span>
                            <span className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">
                              Status: {ticket.spareParts[0].status} {ticket.spareParts[0].dispatchTrackingNo ? `• No Tracking: ${ticket.spareParts[0].dispatchTrackingNo}` : ""}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Action Row (48px+ touch targets) */}
                      {isNew ? (
                        <div className="flex items-center gap-2 pt-1 mt-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAccept(ticket.id);
                            }}
                            disabled={isPending}
                            className="flex-1 h-12 bg-[#006194] hover:bg-[#007bb9] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition cursor-pointer font-st-headline disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-[20px]">assignment_turned_in</span>
                            <span>Terima Pesanan (Accept Job)</span>
                          </button>
                          {pic?.phone ? (
                            <a
                              href={`tel:${pic.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`Hubungi ${pic.name}`}
                              title={`Hubungi ${pic.name}`}
                              className="w-12 h-12 rounded-xl bg-[#eaedff] dark:bg-slate-800 flex items-center justify-center text-[#006194] dark:text-cyan-400 hover:bg-[#dae2fd] dark:hover:bg-slate-700 transition cursor-pointer shrink-0"
                            >
                              <span className="material-symbols-outlined text-[22px]">phone_in_talk</span>
                            </a>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                selectTicket(ticket);
                              }}
                              aria-label="Lihat Butiran"
                              className="w-12 h-12 rounded-xl bg-[#eaedff] dark:bg-slate-800 flex items-center justify-center text-[#006194] dark:text-cyan-400 hover:bg-[#dae2fd] transition cursor-pointer shrink-0"
                            >
                              <span className="material-symbols-outlined text-[20px]">open_in_new</span>
                            </button>
                          )}
                        </div>
                      ) : isAccepted ? (
                        <div className="flex items-center gap-2 pt-1 mt-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              selectTicket(ticket);
                              handleOpenEnroute();
                            }}
                            disabled={isPending}
                            className="flex-1 h-12 bg-[#006194] hover:bg-[#007bb9] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition cursor-pointer font-st-headline"
                          >
                            <span className="material-symbols-outlined text-[20px]">directions_car</span>
                            <span>Gerak ke Tapak (Set ETA)</span>
                          </button>
                          <a
                            href={`https://www.waze.com/ul?q=${encodeURIComponent(ticket.address || ticket.site?.address || ticket.clientSiteName)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            aria-label="Navigasi Waze"
                            className="w-12 h-12 rounded-xl bg-[#eaedff] dark:bg-slate-800 flex items-center justify-center text-[#006194] dark:text-cyan-400 hover:bg-[#dae2fd] transition cursor-pointer shrink-0"
                          >
                            <span className="material-symbols-outlined text-[22px]">navigation</span>
                          </a>
                        </div>
                      ) : isEnroute ? (
                        <div className="flex items-center gap-2 pt-1 mt-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCheckIn(ticket.id);
                            }}
                            disabled={isPending}
                            className="flex-1 h-12 bg-[#006a61] hover:bg-[#006f66] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition cursor-pointer font-st-headline"
                          >
                            <span className="material-symbols-outlined text-[20px]">location_on</span>
                            <span>Daftar Masuk Tapak (Check-In)</span>
                          </button>
                          {pic?.phone ? (
                            <a
                              href={`tel:${pic.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`Hubungi ${pic.name}`}
                              className="w-12 h-12 rounded-xl bg-[#eaedff] dark:bg-slate-800 flex items-center justify-center text-[#006194] dark:text-cyan-400 hover:bg-[#dae2fd] transition cursor-pointer shrink-0"
                            >
                              <span className="material-symbols-outlined text-[22px]">phone_in_talk</span>
                            </a>
                          ) : (
                            <a
                              href={`https://www.waze.com/ul?q=${encodeURIComponent(ticket.address || ticket.site?.address || ticket.clientSiteName)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              aria-label="Navigasi Waze"
                              className="w-12 h-12 rounded-xl bg-[#eaedff] dark:bg-slate-800 flex items-center justify-center text-[#006194] dark:text-cyan-400 hover:bg-[#dae2fd] transition cursor-pointer shrink-0"
                            >
                              <span className="material-symbols-outlined text-[22px]">navigation</span>
                            </a>
                          )}
                        </div>
                      ) : isCheckedIn ? (
                        <div className="flex flex-col gap-2 pt-1 mt-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              selectTicket(ticket);
                              setIsResolveModalOpen(true);
                            }}
                            className="w-full h-12 bg-[#006a61] hover:bg-[#006f66] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition cursor-pointer font-st-headline"
                          >
                            <span className="material-symbols-outlined text-[20px]">task_alt</span>
                            <span>Selesaikan & Daftar Keluar (Resolve)</span>
                          </button>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                selectTicket(ticket);
                                setIsFollowUpModalOpen(true);
                              }}
                              className="flex-1 h-10 bg-[#eaedff] dark:bg-slate-800 text-[#3f4850] dark:text-slate-300 hover:text-[#131b2e] dark:hover:text-white font-semibold text-xs rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer font-st-headline"
                            >
                              <span className="material-symbols-outlined text-[18px]">inventory_2</span>
                              <span>Minta Alat Ganti / Follow-Up</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                selectTicket(ticket);
                              }}
                              className="h-10 px-3 bg-[#eaedff] dark:bg-slate-800 text-[#006194] dark:text-cyan-400 hover:text-blue-700 font-bold text-xs rounded-lg flex items-center justify-center gap-1 transition cursor-pointer font-st-headline"
                            >
                              <span>Butiran</span>
                              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                            </button>
                          </div>
                        </div>
                      ) : ticket.status === "ON_HOLD" || ticket.status === "FOLLOW_UP" ? (
                        <div className="flex items-center gap-2 pt-1 mt-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setTicketToResume(ticket);
                              setIsResumeModalOpen(true);
                            }}
                            className="flex-1 h-12 bg-[#eaedff] dark:bg-slate-800 text-[#131b2e] dark:text-slate-100 hover:bg-[#dae2fd] dark:hover:bg-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition cursor-pointer font-st-headline"
                          >
                            <span className="material-symbols-outlined text-[20px]">play_circle</span>
                            <span>Sambung Kerja (Resume)</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              selectTicket(ticket);
                            }}
                            aria-label="Lihat Butiran"
                            className="w-12 h-12 rounded-xl bg-[#eaedff] dark:bg-slate-800 flex items-center justify-center text-[#006194] dark:text-cyan-400 hover:bg-[#dae2fd] transition cursor-pointer shrink-0"
                          >
                            <span className="material-symbols-outlined text-[20px]">open_in_new</span>
                          </button>
                        </div>
                      ) : isResolved ? (
                        <div className="pt-1 mt-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              selectTicket(ticket);
                              if (ticket.serviceReportUrl) {
                                setLightboxUrl(ticket.serviceReportUrl);
                              } else {
                                setIsReportTemplatePreviewOpen(true);
                              }
                            }}
                            className="w-full h-11 bg-[#f2f3ff] dark:bg-slate-800 text-[#006194] dark:text-cyan-400 hover:bg-[#eaedff] dark:hover:bg-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition cursor-pointer font-st-headline"
                          >
                            <span className="material-symbols-outlined text-[18px]">verified</span>
                            <span>Lihat Laporan Servis {ticket.serviceReportUrl ? "Bertandatangan" : ""}</span>
                          </button>
                        </div>
                      ) : (
                        <div className="pt-1 mt-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              selectTicket(ticket);
                            }}
                            className="w-full h-11 bg-[#eaedff] dark:bg-slate-800 text-[#006194] dark:text-cyan-400 hover:bg-[#dae2fd] font-bold text-xs rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition cursor-pointer font-st-headline"
                          >
                            <span>Lihat Butiran Tiket</span>
                            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Quick Floating Dispatch Direct Dial Action (Only if NOC phone exists) */}
            {nocPhone && (
              <div className="fixed right-4 bottom-20 z-40">
                <a
                  href={`tel:${nocPhone.replace(/[^0-9+]/g, "")}`}
                  aria-label="Panggil Dispatch NOC"
                  className="w-14 h-14 rounded-full bg-[#a33900] hover:bg-[#cc4900] text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform hover:shadow-xl cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[26px]">headset_mic</span>
                </a>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 5: SETTINGS / PROFILE ─── */}
        {activeTab === "setting" && (
          <div className="space-y-4 pb-4">
            
            {/* 1. Profile Photo & Identity Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col items-center text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-r from-[#006194]/10 via-[#006a61]/10 to-[#006194]/10 dark:from-[#006194]/20 dark:via-[#006a61]/20 dark:to-[#006194]/20" />
              
              <div className="relative mt-2">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-tr from-[#006194] to-[#006a61] text-white flex items-center justify-center font-bold text-2xl border-4 border-white dark:border-slate-900 shadow-md">
                  {profileAvatarUrl ? (
                    <img src={profileAvatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span>{profileName ? profileName.charAt(0).toUpperCase() : "FE"}</span>
                  )}
                </div>

                {/* Upload Trigger Button */}
                <label className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#006194] hover:bg-[#007bb9] text-white flex items-center justify-center shadow-lg border-2 border-white dark:border-slate-900 cursor-pointer transition active:scale-95">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    disabled={uploadingAvatar}
                    className="hidden"
                  />
                  {uploadingAvatar ? (
                    <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                  )}
                </label>
              </div>

              <div className="mt-3 space-y-1">
                <h3 className="font-bold text-base text-slate-900 dark:text-white font-st-headline">
                  {profileName || user?.name || "Field Engineer"}
                </h3>
                <div className="flex flex-wrap items-center justify-center gap-1.5 pt-0.5">
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                    {user?.role === "FIELD_ENGINEER" ? "Jurutera Lapangan" : user?.role || "Staf"}
                  </span>
                  {user?.partner?.name && (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#e2e7ff] dark:bg-slate-800 text-[#006194] dark:text-cyan-400 border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">apartment</span>
                      <span>{user.partner.name}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Photo Actions */}
              <div className="mt-3 flex items-center gap-2">
                <label className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer transition">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    disabled={uploadingAvatar}
                    className="hidden"
                  />
                  {uploadingAvatar ? i18n.profile.uploadingPhoto : i18n.profile.changePhoto}
                </label>
                {profileAvatarUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    disabled={uploadingAvatar}
                    className="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold cursor-pointer transition"
                  >
                    {i18n.profile.removePhoto}
                  </button>
                )}
              </div>
            </div>

            {/* ── 🚀 Portal Switcher Card (Return to Classic UI) ── */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[#006194] dark:text-cyan-400">language</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-st-headline">{i18n.profile.portalVersion}</span>
                </div>
                <span className="text-[10px] bg-[#006194] text-white font-mono font-bold px-2 py-0.5 rounded-full uppercase">{i18n.profile.portalBeta}</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-300 leading-relaxed">
                {i18n.profile.previewNotice}
              </p>
              <Link
                href="/"
                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900 font-bold text-xs flex items-center justify-center gap-2 shadow-sm active:scale-95 transition cursor-pointer"
              >
                <span>← {i18n.profile.switchToClassic}</span>
              </Link>
            </div>

            {/* 2. Personal Information Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5 font-st-headline">
                  <span className="material-symbols-outlined text-[16px] text-[#006194] dark:text-cyan-400">person</span>
                  <span>{i18n.profile.personalDetails}</span>
                </h4>
                <span className="text-[10px] font-medium text-slate-400">{i18n.profile.profileSubtitle}</span>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {i18n.profile.fullName}
                  </label>
                  <input
                    type="text"
                    required
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="cth: Ahmad bin Razak"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#006194]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {i18n.profile.phoneContact}
                  </label>
                  <input
                    type="tel"
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    placeholder="cth: +60 12-345 6789"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#006194]"
                  />
                </div>

                {/* Read-Only Account Identity */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {i18n.profile.loginEmail}
                  </label>
                  <div className="w-full px-3 py-2 rounded-xl bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-500 dark:text-slate-300 flex items-center justify-between">
                    <span className="font-mono">{user?.email || "N/A"}</span>
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">verified</span>
                      <span>{i18n.profile.verified}</span>
                    </span>
                  </div>
                </div>

                {/* Read-Only Service Center / Partner */}
                {user?.partner?.name && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {i18n.profile.servicePartner}
                    </label>
                    <div className="w-full px-3 py-2 rounded-xl bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-500 dark:text-slate-300 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-slate-400">apartment</span>
                      <span>{user.partner.name}</span>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={savingProfile}
                  className="w-full py-2.5 rounded-xl bg-[#006194] hover:bg-[#007bb9] active:bg-[#004b73] text-white font-bold text-xs shadow-md cursor-pointer transition mt-1 font-st-headline"
                >
                  {savingProfile ? i18n.profile.savingProfile : i18n.profile.saveProfile}
                </button>
              </form>
            </div>

            {/* 3. Security & Change Password Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5 font-st-headline">
                  <span className="material-symbols-outlined text-[16px] text-[#006194] dark:text-cyan-400">lock</span>
                  <span>{i18n.profile.securityPassword}</span>
                </h4>
                <span className="text-[10px] font-medium text-slate-400">{i18n.profile.updateCredentials}</span>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-3">
                {/* Current Password */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {i18n.profile.currentPassword}
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Masukkan kata laluan semasa"
                      className="w-full pl-3 pr-10 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#006194] font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {showCurrentPassword ? "visibility" : "visibility_off"}
                      </span>
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {i18n.profile.newPassword}
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Cipta kata laluan kukuh"
                      className="w-full pl-3 pr-10 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#006194] font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {showNewPassword ? "visibility" : "visibility_off"}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {i18n.profile.confirmPassword}
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Sahkan kata laluan baharu"
                      className="w-full pl-3 pr-10 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#006194] font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {showConfirmPassword ? "visibility" : "visibility_off"}
                      </span>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={changingPassword}
                  className="w-full py-2.5 rounded-xl bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white font-bold text-xs shadow-md cursor-pointer transition mt-1 font-st-headline"
                >
                  {changingPassword ? i18n.profile.changingPassword : i18n.profile.changePasswordButton}
                </button>
              </form>
            </div>

            {/* 4. App Preferences & Attendance Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5 font-st-headline">
                  <span className="material-symbols-outlined text-[16px] text-[#006194] dark:text-cyan-400">tune</span>
                  <span>Tetapan Aplikasi</span>
                </h4>
                <span className="text-[10px] font-medium text-slate-400">Paparan &amp; Pemberitahuan</span>
              </div>

              {/* Theme Toggle */}
              <div className="flex items-center justify-between py-1">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block font-st-headline">Mod Tema</span>
                  <span className="text-[11px] text-slate-400">Tukar antara paparan gelap &amp; terang</span>
                </div>
                <ThemeToggle />
              </div>

              {/* Notification Sound Toggle */}
              <div className="flex items-center justify-between py-1 border-t border-slate-100 dark:border-slate-800 pt-3">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block font-st-headline">{i18n.profile.audioNotification}</span>
                  <span className="text-[11px] text-slate-400">{i18n.profile.audioDesc}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      playNotificationChime();
                      toast.info("Pratonton audio loceng dimainkan.");
                    }}
                    className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 cursor-pointer flex items-center gap-1"
                    title="Uji audio pemberitahuan"
                  >
                    <span className="material-symbols-outlined text-[14px]">volume_up</span>
                    <span>Uji</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !soundEnabled;
                      setSoundEnabled(next);
                      toast.success(next ? "Audio loceng diaktifkan." : "Audio loceng dibisukan.");
                    }}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition cursor-pointer ${
                      soundEnabled ? "bg-[#006a61]" : "bg-slate-300 dark:bg-slate-700"
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition ${
                        soundEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Shift Attendance Quick Switch */}
              <div className="flex items-center justify-between py-1 border-t border-slate-100 dark:border-slate-800 pt-3">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block font-st-headline">{i18n.attendance.title}</span>
                  <span className="text-[11px] text-slate-400">
                    Status: <strong className="text-[#006194] dark:text-cyan-400">{i18n.attendance.statusBadge[attendanceStatus] || attendanceStatus}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAttendanceModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-[#e2e7ff] dark:bg-slate-800 text-[#006194] dark:text-cyan-400 text-xs font-bold border border-blue-200 dark:border-blue-800 hover:bg-[#cce5ff] cursor-pointer transition flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[15px]">badge</span>
                  <span>Kemas Kini</span>
                </button>
              </div>
            </div>

            {/* 5. Session & App Info Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>TicketLink Mobile FE</span>
                <span className="font-mono font-bold">v2.4.2</span>
              </div>
              
              <button
                type="button"
                onClick={signOut}
                className="w-full py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-bold text-xs border border-rose-200 dark:border-rose-900/60 cursor-pointer transition flex items-center justify-center gap-1.5 font-st-headline"
              >
                <span className="material-symbols-outlined text-[16px]">logout</span>
                <span>{i18n.profile.signOut}</span>
              </button>
            </div>

          </div>
        )}

      </main>

      {/* ── Floating Action Button (...) (Screenshot 1) ── */}
      <div className="fixed bottom-20 right-5 z-40">
        <button
          onClick={() => setIsFloatingMenuOpen(!isFloatingMenuOpen)}
          className="w-12 h-12 rounded-full bg-blue-700 hover:bg-blue-800 text-white flex items-center justify-center text-lg font-bold shadow-xl active:scale-95 transition cursor-pointer"
          title="Quick Actions"
        >
          •••
        </button>

        {isFloatingMenuOpen && (
          <div className="absolute bottom-14 right-0 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 shadow-2xl space-y-1 text-xs font-semibold animate-in fade-in slide-in-from-bottom-2 z-50">
            <button
              onClick={() => {
                setIsFloatingMenuOpen(false);
                syncFETickets(false);
              }}
              className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer text-slate-700 dark:text-slate-200"
            >
              <span className="material-symbols-outlined text-[18px] text-[#006194] dark:text-sky-400">sync</span>
              <span>Segerakkan Dispat</span>
            </button>
            <button
              onClick={() => {
                setIsFloatingMenuOpen(false);
                setIsAttendanceModalOpen(true);
              }}
              className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer text-slate-700 dark:text-slate-200"
            >
              <span className="material-symbols-outlined text-[18px] text-[#006194] dark:text-sky-400">badge</span>
              <span>Status Kehadiran</span>
            </button>
            <button
              onClick={() => {
                setIsFloatingMenuOpen(false);
                toast.info("Hubungi bilik kawalan dispat di +603-8888-9999");
              }}
              className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer text-[#006194] dark:text-sky-400 font-bold"
            >
              <span className="material-symbols-outlined text-[18px]">call</span>
              <span>Hubungi Dispat</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Bottom Navigation Bar (Google Stitch View) ── */}
      <nav className="fixed bottom-0 inset-x-0 z-50 bg-[#faf8ff]/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-4px_16px_rgba(15,23,42,0.06)]">
        <div className="grid grid-cols-3 items-center h-16 px-4 max-w-md mx-auto">
          {/* 1. Utama (Home) */}
          <button
            onClick={() => setActiveTab("home")}
            className={`flex flex-col items-center justify-center min-h-[48px] py-1 transition-colors gap-0.5 cursor-pointer ${
              activeTab === "home"
                ? "text-[#006194] dark:text-cyan-400 font-bold"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <span className="material-symbols-outlined text-[24px]">home</span>
            <span className="text-xs font-semibold font-st-headline">Utama</span>
          </button>

          {/* 2. Pesanan (Service Orders) */}
          <button
            onClick={() => setActiveTab("service_orders")}
            className={`flex flex-col items-center justify-center min-h-[48px] py-1 transition-colors relative gap-0.5 cursor-pointer ${
              activeTab === "service_orders"
                ? "text-[#006194] dark:text-cyan-400 font-bold"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <div className="relative flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">assignment</span>
              {activeJobs.length > 0 && (
                <span className="absolute -top-1 -right-2.5 bg-[#a33900] text-white text-[10px] px-1.5 py-0.2 rounded-full min-w-[16px] text-center leading-tight font-bold font-mono">
                  {activeJobs.length}
                </span>
              )}
            </div>
            <span className="text-xs font-semibold font-st-headline">Pesanan</span>
          </button>

          {/* 3. Profil & Tetapan */}
          <button
            onClick={() => setActiveTab("setting")}
            className={`flex flex-col items-center justify-center min-h-[48px] py-1 transition-colors gap-0.5 cursor-pointer ${
              activeTab === "setting"
                ? "text-[#006194] dark:text-cyan-400 font-bold"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <span className="material-symbols-outlined text-[24px]">manage_accounts</span>
            <span className="text-xs font-semibold font-st-headline">Profil</span>
          </button>
        </div>
      </nav>

      {/* ── Modal: Confirm Resume Work ── */}
      {isResumeModalOpen && ticketToResume && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-[22px]">replay</span>
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white font-st-headline">
                  Sambung Semula Kerja di Tapak?
                </h3>
                <p className="text-[11px] text-slate-500 font-mono">
                  {ticketToResume.ticketRefNo || `SO-${ticketToResume.id}`}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 font-st-body">
              Adakah anda telah kembali ke tapak di <strong className="text-slate-900 dark:text-white">{ticketToResume.clientSiteName}</strong>? Ini akan menukar status tugasan kembali ke <strong className="text-[#006194] dark:text-sky-400">SEDANG DILAKSANAKAN</strong> dan menyambung pengesanan SLA operasi.
            </p>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsResumeModalOpen(false);
                  setTicketToResume(null);
                }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer font-st-headline"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmResumeWork}
                disabled={isPending}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-md transition cursor-pointer flex items-center justify-center gap-1.5 font-st-headline"
              >
                <span>{isPending ? "Menyambung..." : "Sahkan & Sambung"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Attendance Status Switcher ── */}
      {isAttendanceModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2 font-st-headline">
                <span className="material-symbols-outlined text-[20px] text-[#006194] dark:text-sky-400">badge</span>
                Kemas Kini Status Kehadiran
              </h3>
              <button onClick={() => setIsAttendanceModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer">✕</button>
            </div>

            <div className="space-y-2">
              {[
                { id: "CLOCK_IN", label: "Masuk Kerja", desc: "Mula syif harian", icon: "login" },
                { id: "ON_DUTY", label: "Bertugas / Sedia", desc: "Sedia untuk dispat & tugasan", icon: "task_alt" },
                { id: "ON_BREAK", label: "Rehat", desc: "Waktu makan / rehat operasi", icon: "coffee" },
                { id: "CLOCK_OUT", label: "Tamat Kerja", desc: "Selesai syif bertugas", icon: "logout" },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    handleSaveAttendance(item.id as any);
                    setIsAttendanceModalOpen(false);
                  }}
                  className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition cursor-pointer ${
                    attendanceStatus === item.id
                      ? "bg-sky-50 dark:bg-sky-950/50 border-[#006194] text-[#006194] dark:text-sky-300"
                      : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[22px] text-slate-600 dark:text-slate-300">
                      {item.icon}
                    </span>
                    <div>
                      <h4 className="font-bold text-xs text-slate-800 dark:text-white font-st-headline">{item.label}</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{item.desc}</p>
                    </div>
                  </div>
                  {attendanceStatus === item.id && (
                    <span className="text-[#006194] dark:text-sky-400 font-bold text-sm">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* IMAGE LIGHTBOX MODAL */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md cursor-pointer"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-transparent flex flex-col items-center">
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute -top-10 right-0 text-white hover:text-slate-300 text-sm font-bold bg-black/50 px-3 py-1 rounded-full cursor-pointer font-st-headline"
            >
              ✕ Tutup Pratonton
            </button>
            <img
              src={lightboxUrl}
              alt="Pratonton Lampiran Rujukan"
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

    </div>
  );
}
