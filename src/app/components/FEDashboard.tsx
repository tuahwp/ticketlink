"use client";

import React, { useState, useEffect, useTransition, useRef, useMemo } from "react";
import { useAuth } from "./AuthProvider";
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
} from "@/app/actions";
import { compressImage } from "@/lib/imageCompress";
import SlaCountdown from "./SlaCountdown";
import ThemeToggle from "./ThemeToggle";
import { getEffectiveCustomFields } from "@/lib/customFields";
import { toast } from "sonner";

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

export default function FEDashboard() {
  const { user, signOut, refreshProfile } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Navigation tab state: "home" | "service_orders" | "timeline" | "schedule" | "setting"
  const [activeTab, setActiveTab] = useState<"home" | "service_orders" | "timeline" | "schedule" | "setting">("home");

  // Filter state for Service Orders list
  const [statusFilter, setStatusFilter] = useState<"ALL" | "NEW" | "WIP" | "RESOLVED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Attendance State
  const [attendanceStatus, setAttendanceStatus] = useState<"CLOCK_IN" | "ON_DUTY" | "ON_BREAK" | "CLOCK_OUT">("CLOCK_IN");
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);

  // Selected Ticket Detail View
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

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

  // Follow-Up / Spare Part Request States
  const [followUpSubStatus, setFollowUpSubStatus] = useState("PENDING_PARTS");
  const [partModel, setPartModel] = useState("");
  const [partName, setPartName] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [partQty, setPartQty] = useState(1);
  const [partDiagnosis, setPartDiagnosis] = useState("");
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [followUpReportFile, setFollowUpReportFile] = useState<File | null>(null);
  const [followUpFiles, setFollowUpFiles] = useState<File[]>([]);

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

  const syncFETickets = async (silent = false) => {
    if (!user?.engineerId) {
      setLoading(false);
      return;
    }
    if (!silent) setIsRefreshing(true);
    try {
      const allTickets = await getTickets();
      const filtered = allTickets.filter(
        (t: any) => t.assignedFeId === user.engineerId
      );

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

      // If viewing a selected ticket, keep it fresh
      if (selectedTicket) {
        const updated = filtered.find((t: any) => t.id === selectedTicket.id);
        if (updated) {
          const freshDetail = await getTicketById(updated.id);
          setSelectedTicket((freshDetail || updated) as unknown as Ticket);
        }
      }
    } catch (err: any) {
      console.error("Failed to sync tickets:", err);
      if (!silent) toast.error("Could not refresh tickets.");
    } finally {
      setLoading(false);
      if (!silent) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    syncFETickets();
    const interval = setInterval(() => {
      syncFETickets(true);
    }, 15000);
    return () => clearInterval(interval);
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

  // Calculate Ticket Queue Counts (strictly mutually exclusive)
  const newTickets = useMemo(() => {
    return tickets.filter(
      (t) =>
        t.status === "NEW" &&
        (!t.subStatus || t.subStatus === "NEW" || t.subStatus === "PENDING")
    );
  }, [tickets]);

  const wipTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (t.status === "RESOLVED" || t.status === "CLOSED" || t.status === "CANCELLED") return false;
      if (t.status === "NEW" && (!t.subStatus || t.subStatus === "NEW" || t.subStatus === "PENDING")) return false;
      return (
        t.status === "IN_PROGRESS" ||
        t.status === "ON_HOLD" ||
        t.status === "FOLLOW_UP" ||
        t.subStatus === "ACCEPTED" ||
        t.subStatus === "ENROUTE" ||
        t.subStatus === "CHECKED_IN"
      );
    });
  }, [tickets]);

  const resolvedTickets = useMemo(() => {
    return tickets.filter(
      (t) => t.status === "RESOLVED" || t.status === "CLOSED" || t.status === "COMPLETE"
    );
  }, [tickets]);

  // Deduplicated Active Jobs for Schedule Agenda
  const activeJobs = useMemo(() => {
    const map = new Map<number, Ticket>();
    [...newTickets, ...wipTickets].forEach((t) => map.set(t.id, t));
    return Array.from(map.values());
  }, [newTickets, wipTickets]);

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
        return (
          ref.includes(q) ||
          site.includes(q) ||
          addr.includes(q) ||
          state.includes(q) ||
          desc.includes(q) ||
          stat.includes(q) ||
          sub.includes(q)
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
  }, [tickets, statusFilter, searchQuery, newTickets, wipTickets, resolvedTickets]);

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

  // Multi-file handling helpers
  const handleAddResolveFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setResolveFiles((prev) => [...prev, ...newFiles]);
    }
    e.target.value = "";
  };

  const handleRemoveResolveFile = (index: number) => {
    setResolveFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddFollowUpFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setFollowUpFiles((prev) => [...prev, ...newFiles]);
    }
    e.target.value = "";
  };

  const handleRemoveFollowUpFile = (index: number) => {
    setFollowUpFiles((prev) => prev.filter((_, i) => i !== index));
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
    if (!followUpNotes.trim()) {
      toast.error("Please enter action taken & follow-up notes.");
      return;
    }

    if (followUpSubStatus === "PENDING_PARTS" && !partName.trim()) {
      toast.error("Please enter the required spare part name.");
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
            const partInfo = `[Spare Part Request: ${partName.trim()}${partModel.trim() ? ` | Model: ${partModel.trim()}` : ""}${partNumber.trim() ? ` | P/N: ${partNumber.trim()}` : ""} | Qty: ${partQty}]${partDiagnosis.trim() ? `\nDiagnosis: ${partDiagnosis.trim()}` : ""}`;
            fullNotes = `${fullNotes}\n\n${partInfo}`;
          }

          if (interimReportUrl) {
            fullNotes = `${fullNotes}\n📄 Interim Visit Report: ${interimReportUrl}`;
          }

          await updateTicketStatus(
            selectedTicket.id,
            "FOLLOW_UP",
            followUpSubStatus,
            fullNotes,
            user?.name || "Field Engineer"
          );

          if (followUpSubStatus === "PENDING_PARTS" && partName.trim()) {
            const formattedPartTitle = `${partModel.trim() ? `[${partModel.trim()}] ` : ""}${partNumber.trim() ? `[P/N: ${partNumber.trim()}] ` : ""}${partName.trim()}`;
            const partNotesDetail = `Model: ${partModel.trim() || "N/A"} | P/N: ${partNumber.trim() || "N/A"}\nDefect Diagnosis: ${partDiagnosis.trim() || "N/A"}\nField Notes: ${followUpNotes.trim()}${interimReportUrl ? `\nInterim Report: ${interimReportUrl}` : ""}`;

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
          setFollowUpSubStatus("PENDING_PARTS");
          setPartModel("");
          setPartName("");
          setPartNumber("");
          setPartQty(1);
          setPartDiagnosis("");
          setFollowUpReportFile(null);
          setFollowUpFiles([]);
          toast.success("Service order checked out & set to Follow-Up / Pending Parts.");
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

  const handleAddComment = async () => {
    if (!selectedTicket || !newCommentText.trim()) return;
    startTransition(async () => {
      try {
        await addTicketComment(selectedTicket.id, newCommentText.trim(), user?.name || "Field Engineer");
        setNewCommentText("");
        toast.success("Note added to timeline.");
        const fresh = await getTicketById(selectedTicket.id);
        if (fresh) setSelectedTicket(fresh as unknown as Ticket);
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
        label: "Resolved",
        color: "text-emerald-600 bg-emerald-50 border-emerald-300",
        ctaText: "RESOLVED",
        ctaDisabled: true,
        action: () => {},
      };
    }

    if (stat === "FOLLOW_UP" || stat === "ON_HOLD") {
      return {
        stage: "ON_HOLD",
        label: stat === "FOLLOW_UP" ? "Follow Up" : "On Hold",
        color: "text-amber-600 bg-amber-50 border-amber-300",
        ctaText: "RESUME WORK",
        ctaDisabled: false,
        action: () => handleCheckIn(ticket.id),
      };
    }

    if (stat === "IN_PROGRESS" || sub === "CHECKED_IN") {
      return {
        stage: "CHECKED_IN",
        label: "Checked-In",
        color: "text-blue-600 bg-blue-50 border-blue-300",
        ctaText: "CHECK OUT & RESOLVE",
        ctaDisabled: false,
        action: () => setIsResolveModalOpen(true),
      };
    }

    if (sub === "ENROUTE") {
      return {
        stage: "ENROUTE",
        label: "Enroute",
        color: "text-indigo-600 bg-indigo-50 border-indigo-300",
        ctaText: "CHECK IN",
        ctaDisabled: false,
        action: () => handleCheckIn(ticket.id),
      };
    }

    if (sub === "ACCEPTED") {
      return {
        stage: "ACCEPTED",
        label: "Accepted",
        color: "text-sky-600 bg-sky-50 border-sky-300",
        ctaText: "ENROUTE",
        ctaDisabled: false,
        action: handleOpenEnroute,
      };
    }

    // Default: NEW (Dispatched)
    return {
      stage: "NEW",
      label: "New",
      color: "text-emerald-600 bg-emerald-50 border-emerald-300",
      ctaText: "ACCEPT",
      ctaDisabled: false,
      action: () => handleAccept(ticket.id),
    };
  };

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

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN 3: TICKET DETAIL & OPERATIONAL ACTION VIEW (Screenshot 3)
  // ═══════════════════════════════════════════════════════════════════════════
  if (selectedTicket) {
    const stageInfo = getTicketStageInfo(selectedTicket);
    const resolvedSiteAddress = selectedTicket.address?.trim() || selectedTicket.site?.address?.trim() || "";
    const fullAddress = resolvedSiteAddress
      ? `${resolvedSiteAddress}, ${selectedTicket.state}, Malaysia`
      : `${selectedTicket.clientSiteName}, ${selectedTicket.state}, Malaysia`;
    const refDisplay = `I-${String(selectedTicket.mainconId || 1000).padStart(7, "0")} > ${
      selectedTicket.ticketRefNo || `SO-${String(selectedTicket.id).padStart(7, "0")}`
    }`;

    return (
      <div className="min-h-screen bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col pb-28 select-none">
        {/* Top Header Bar */}
        <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 pt-10 pb-4 border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-30 shadow-xs">
          <div className="flex items-center justify-between">
            {/* Back Button */}
            <button
              onClick={() => setSelectedTicket(null)}
              className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shadow-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition active:scale-95 cursor-pointer"
              title="Back to Service Orders"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Header Title with TicketLink Branding */}
            <div className="text-center">
              <h1 className="text-sm font-black text-slate-950 dark:text-white tracking-tight">
                Ticket<span className="text-teal-500">Link</span> <span className="text-xs font-semibold text-slate-500 font-mono">Service Order</span>
              </h1>
            </div>

            {/* Right Action Icons: Notes / Chat & Menu */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsCommentsModalOpen(true)}
                className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shadow-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition active:scale-95 cursor-pointer relative"
                title="Service Notes & Activities"
              >
                <svg className="w-5 h-5 text-slate-800 dark:text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
                </svg>
                {selectedTicket.activities && selectedTicket.activities.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow-xs">
                    {selectedTicket.activities.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setIsDetailMenuOpen(!isDetailMenuOpen)}
                className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shadow-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition active:scale-95 cursor-pointer"
                title="Options"
              >
                <svg className="w-5 h-5 text-slate-800 dark:text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Breadcrumb Incident > SO Ref */}
          <div className="mt-2.5 text-center">
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 font-mono bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-800">
              {refDisplay}
            </span>
          </div>
        </header>

        {/* Options Dropdown Menu */}
        {isDetailMenuOpen && (
          <div className="mx-4 mt-2 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-40 animate-in fade-in slide-in-from-top-2">
            <button
              onClick={() => {
                setIsDetailMenuOpen(false);
                openMapsDirections(selectedTicket.clientSiteName, selectedTicket.state, resolvedSiteAddress);
              }}
              className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              🗺️ Open in Google Maps
            </button>
            <button
              onClick={() => {
                setIsDetailMenuOpen(false);
                copyToClipboard(resolvedSiteAddress || selectedTicket.clientSiteName, "Site Address");
              }}
              className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              📋 Copy Site Address
            </button>
            <button
              onClick={() => {
                setIsDetailMenuOpen(false);
                setIsFollowUpModalOpen(true);
              }}
              className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-950/40 text-xs font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-400 cursor-pointer"
            >
              📦 Request Spare Parts / Follow-Up
            </button>
          </div>
        )}

        {/* Detail Content Container */}
        <main className="max-w-md w-full mx-auto px-4 mt-3 space-y-3.5">
          {/* 3-Column Top Stat Bar (Status | Time Left | Severity) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-200/80 dark:border-slate-800 shadow-xs grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800 text-center">
            {/* 1. Status */}
            <div className="px-2 flex flex-col items-center justify-center">
              <span className="text-[11px] font-medium text-slate-400">Status</span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {stageInfo.label}
              </span>
              <div className="w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center text-xs mt-1">
                ⏱️
              </div>
            </div>

            {/* 2. Time Left (Live SLA Timer) */}
            <div className="px-2 flex flex-col items-center justify-center">
              <span className="text-[11px] font-medium text-slate-400">Time left</span>
              <div className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                {selectedTicket.slaDeadline ? (
                  <SlaCountdown
                    slaDeadline={selectedTicket.slaDeadline}
                    status={selectedTicket.status}
                    resolvedAt={selectedTicket.resolvedAt}
                    slaPaused={selectedTicket.slaPaused}
                    slaPausedAt={selectedTicket.slaPausedAt}
                  />
                ) : (
                  <span className="text-slate-400">No SLA</span>
                )}
              </div>
              <div className="w-6 h-6 rounded-full bg-blue-500/15 text-blue-600 flex items-center justify-center text-xs mt-1">
                ⏰
              </div>
            </div>

            {/* 3. Severity */}
            <div className="px-2 flex flex-col items-center justify-center">
              <span className="text-[11px] font-medium text-slate-400">Severity</span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {selectedTicket.severity || "P3"}
              </span>
              <div className="w-6 h-6 rounded-full bg-amber-500/15 text-amber-600 flex items-center justify-center text-xs mt-1">
                ⚡
              </div>
            </div>
          </div>

          {/* Issue Summary Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center text-lg flex-shrink-0">
              📋
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                {selectedTicket.ticketRefNo || selectedTicket.id} | {selectedTicket.issueDescription}
              </p>
            </div>
          </div>

          {/* Location & Navigation Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center text-sm flex-shrink-0 mt-0.5">
                📍
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                  {selectedTicket.clientSiteName}
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  {fullAddress}
                </p>
              </div>
            </div>

            {/* Direct Google Maps Navigation Button */}
            <button
              onClick={() => openMapsDirections(selectedTicket.clientSiteName, selectedTicket.state, resolvedSiteAddress)}
              className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-md active:scale-95 transition cursor-pointer flex-shrink-0"
              title="Navigate to Site"
            >
              <svg className="w-5 h-5 -rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>

          {/* Description Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Description</span>
              <button
                onClick={() => copyToClipboard(selectedTicket.issueDescription, "Description")}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer p-1"
                title="Copy Description"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
              {selectedTicket.issueDescription}
            </p>

            {/* Custom Values if any */}
            {Boolean(selectedTicket.customValues) && typeof selectedTicket.customValues === "object" && !Array.isArray(selectedTicket.customValues) && (
              <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
                {Object.entries((selectedTicket.customValues as Record<string, unknown>) || {}).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">{key}:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{String(val ?? "")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Spare Parts Card (if any assigned/requested) */}
          {selectedTicket.spareParts && selectedTicket.spareParts.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Allocated Spare Parts</span>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full">
                  {selectedTicket.spareParts.length} Part{selectedTicket.spareParts.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className="space-y-2">
                {selectedTicket.spareParts.map((part) => (
                  <div key={part.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs">
                    <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-100">
                      <span>{part.requestedPartName} (x{part.quantity})</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {part.status}
                      </span>
                    </div>
                    {part.inventoryItem && (
                      <p className="text-[11px] text-slate-500 mt-1 font-mono">
                        S/N: {part.inventoryItem.serialNumber} ({part.inventoryItem.name})
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timestamps Section */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Timestamp</span>
            <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-center justify-between">
                <span>Dispatched Time:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {new Date(selectedTicket.createdAt).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              {selectedTicket.eta && (
                <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400">
                  <span>Estimated Arrival (ETA):</span>
                  <span className="font-bold font-mono">
                    {new Date(selectedTicket.eta).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              )}
              {selectedTicket.resolvedAt && (
                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                  <span>Resolved Time:</span>
                  <span className="font-bold">
                    {new Date(selectedTicket.resolvedAt).toLocaleString("en-MY", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* ── Sticky Bottom Action Bar (Screenshot 3 Action Flow) ── */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 z-40 shadow-lg">
          <div className="max-w-md mx-auto">
            {stageInfo.stage === "CHECKED_IN" ? (
              <div className="flex items-center gap-2.5">
                {/* 1. Primary Success CTA: Resolve & Check Out */}
                <button
                  onClick={() => setIsResolveModalOpen(true)}
                  disabled={isPending}
                  className="flex-1 py-3.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-teal-600 hover:bg-teal-700 active:bg-teal-800 shadow-md active:scale-98 transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>✓</span>
                  <span>CHECK OUT & RESOLVE</span>
                </button>

                {/* 2. Secondary Partial/Blocked CTA: Follow-Up & Request Part */}
                <button
                  onClick={() => setIsFollowUpModalOpen(true)}
                  disabled={isPending}
                  className="flex-1 py-3.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-amber-500 hover:bg-amber-600 active:bg-amber-700 shadow-md active:scale-98 transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>📦</span>
                  <span>CHECK OUT & FOLLOW-UP</span>
                </button>
              </div>
            ) : (
              <button
                onClick={stageInfo.action}
                disabled={isPending || stageInfo.ctaDisabled}
                className={`w-full py-3.5 rounded-xl font-bold text-sm text-white shadow-md active:scale-98 transition flex items-center justify-center gap-2 cursor-pointer ${
                  stageInfo.stage === "RESOLVED"
                    ? "bg-emerald-600 opacity-90 cursor-default"
                    : stageInfo.stage === "ON_HOLD"
                    ? "bg-amber-600 hover:bg-amber-700 active:bg-amber-800"
                    : "bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800"
                }`}
              >
                {isPending ? (
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3 3 3m-3-3v12" />
                  </svg>
                ) : (
                  <span>{stageInfo.ctaText}</span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* ── Modal: Set Enroute & ETA ── */}
        {isEnrouteModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 flex items-center justify-center text-xl mx-auto mb-2">
                  🚗
                </div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Start Traveling (Enroute)</h3>
                <p className="text-xs text-slate-500 mt-1">Set your estimated time of arrival at customer site.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Estimated Arrival Time (ETA)
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
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmEnroute}
                  disabled={isPending}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm cursor-pointer"
                >
                  Confirm Enroute
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal: Check Out & Resolve Ticket ── */}
        {isResolveModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 max-w-md w-full space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  ✅ Check Out & Complete Job
                </h3>
                <button
                  onClick={() => setIsResolveModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Resolution Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Resolution Action & Notes *
                </label>
                <textarea
                  rows={3}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Describe troubleshooting, repairs performed, and parts replaced..."
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
                  <span>Replaced a physical hardware part / module?</span>
                </label>
                {hasReplacedPart && (
                  <div className="space-y-2 pt-1 animate-in fade-in">
                    <div>
                      <span className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                        Defective Part Serial Number
                      </span>
                      <input
                        type="text"
                        value={defectiveSerial}
                        onChange={(e) => setDefectiveSerial(e.target.value)}
                        placeholder="Enter defective S/N retrieved from site"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 1. Mandatory Signed Service Report Upload */}
              <div className="space-y-1.5 p-3 rounded-2xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200/80 dark:border-teal-800/60">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-teal-950 dark:text-teal-200 flex items-center gap-1.5">
                    <span>📄</span>
                    <span>Signed Service Report *</span>
                  </label>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    serviceReportFile
                      ? "text-emerald-700 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300"
                      : "text-rose-600 bg-rose-100 dark:bg-rose-950 dark:text-rose-300"
                  }`}>
                    {serviceReportFile ? "Attached ✓" : "Mandatory"}
                  </span>
                </div>

                {serviceReportFile ? (
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-teal-300 dark:border-teal-700 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xl flex-shrink-0">
                        {serviceReportFile.type.includes("pdf") ? "📑" : "🖼️"}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
                          {serviceReportFile.name}
                        </p>
                        <p className="text-[10px] text-teal-600 dark:text-teal-400 font-medium">
                          {(serviceReportFile.size / 1024).toFixed(1)} KB • Ready for upload
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setServiceReportFile(null)}
                      className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-xs font-bold transition cursor-pointer flex-shrink-0"
                      title="Remove service report"
                    >
                      ✕ Remove
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center p-3.5 rounded-xl border-2 border-dashed border-teal-300 dark:border-teal-700/80 bg-white/80 dark:bg-slate-900/80 hover:bg-teal-50 dark:hover:bg-teal-950/50 text-center cursor-pointer transition">
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      capture="environment"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setServiceReportFile(file);
                        e.target.value = "";
                      }}
                      className="hidden"
                    />
                    <span className="text-2xl mb-1">✍️</span>
                    <span className="text-xs font-bold text-teal-900 dark:text-teal-200">
                      Upload Signed Service Report / Scan
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">
                      PDF, JPG or PNG (Camera scan supported)
                    </span>
                  </label>
                )}
              </div>

              {/* 2. Optional Additional Field Photos */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    📷 Additional Field Photos <span className="text-[10px] font-normal text-slate-400">(Optional / Multi-upload)</span>
                  </label>
                  {resolveFiles.length > 0 && (
                    <span className="text-[10px] font-bold text-teal-600 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-full">
                      {resolveFiles.length} photo{resolveFiles.length > 1 ? "s" : ""}
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
                            title="Remove photo"
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
                  <span>{resolveFiles.length > 0 ? "Add More Field Photos" : "Take Photo / Select Field Photos"}</span>
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsResolveModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmResolve}
                  disabled={uploading || isPending}
                  className="flex-1 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  {uploading ? "Uploading & Resolving..." : "Submit & Resolve"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal: Request Parts / Follow Up ── */}
        {isFollowUpModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 max-w-md w-full space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>📦</span>
                  <span>Check Out & Set Follow-Up</span>
                </h3>
                <button onClick={() => setIsFollowUpModalOpen(false)} className="text-slate-400 p-1 cursor-pointer">✕</button>
              </div>

              {/* Follow-Up Reason Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Follow-Up Reason *
                </label>
                <select
                  value={followUpSubStatus}
                  onChange={(e) => setFollowUpSubStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white cursor-pointer"
                >
                  <option value="PENDING_PARTS">📦 Pending Spare Parts Dispatch</option>
                  <option value="PENDING_SIGN_OFF">⏳ Pending Site Access / Client Sign-off</option>
                  <option value="MONITORING">🔬 Equipment Testing & Monitoring</option>
                  <option value="REVISIT">🔁 Secondary Site Visit Required</option>
                </select>
              </div>

              {/* Structured Spare Part Request Form (Model, Part Name, Part Number, Qty, Diagnosis) */}
              {followUpSubStatus === "PENDING_PARTS" && (
                <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 rounded-2xl space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                      <span>⚙️</span>
                      <span>Spare Part Details</span>
                    </span>
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
                      Required
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Device Model */}
                    <div>
                      <label className="block text-[11px] font-bold text-amber-900 dark:text-amber-200 mb-1">
                        Device Model
                      </label>
                      <input
                        type="text"
                        value={partModel}
                        onChange={(e) => setPartModel(e.target.value)}
                        placeholder="e.g. ThinkPad L14 Gen 2"
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-300/80 dark:border-amber-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>

                    {/* Part Name */}
                    <div>
                      <label className="block text-[11px] font-bold text-amber-900 dark:text-amber-200 mb-1">
                        Part Name *
                      </label>
                      <input
                        type="text"
                        value={partName}
                        onChange={(e) => setPartName(e.target.value)}
                        placeholder="e.g. LCD Screen / Motherboard"
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-300/80 dark:border-amber-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>

                    {/* Part Number (P/N / FRU) */}
                    <div>
                      <label className="block text-[11px] font-bold text-amber-900 dark:text-amber-200 mb-1">
                        Part Number (P/N / FRU)
                      </label>
                      <input
                        type="text"
                        value={partNumber}
                        onChange={(e) => setPartNumber(e.target.value)}
                        placeholder="e.g. 5M10W85942"
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-300/80 dark:border-amber-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                      />
                    </div>

                    {/* Quantity */}
                    <div>
                      <label className="block text-[11px] font-bold text-amber-900 dark:text-amber-200 mb-1">
                        Quantity
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

                  {/* Defect Diagnosis */}
                  <div>
                    <label className="block text-[11px] font-bold text-amber-900 dark:text-amber-200 mb-1">
                      Defect Diagnosis / Symptoms
                    </label>
                    <input
                      type="text"
                      value={partDiagnosis}
                      onChange={(e) => setPartDiagnosis(e.target.value)}
                      placeholder="e.g. Burnt charging port / LCD vertical lines / no display"
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-300/80 dark:border-amber-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>
              )}

              {/* Action Taken & Findings Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Action Taken & Next Steps *
                </label>
                <textarea
                  rows={3}
                  value={followUpNotes}
                  onChange={(e) => setFollowUpNotes(e.target.value)}
                  placeholder="Describe troubleshooting done today, site findings, and work required for next visit..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Optional Interim Visit Slip */}
              <div className="space-y-1.5 p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                    <span>📄</span>
                    <span>Interim Visit Slip / Access Pass <span className="text-[10px] font-normal text-slate-400">(Optional)</span></span>
                  </label>
                  {followUpReportFile && (
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded-full">
                      Attached ✓
                    </span>
                  )}
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
                          {(followUpReportFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFollowUpReportFile(null)}
                      className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-xs font-bold transition cursor-pointer flex-shrink-0"
                      title="Remove visit slip"
                    >
                      ✕ Remove
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
                        if (file) setFollowUpReportFile(file);
                        e.target.value = "";
                      }}
                      className="hidden"
                    />
                    <span className="text-base">📎</span>
                    <span>Attach Signed Visit Slip / Gate Pass</span>
                  </label>
                )}
              </div>

              {/* Optional Diagnostic Photos & Evidence */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    📷 Diagnostic Photos & Evidence <span className="text-[10px] font-normal text-slate-400">(Optional / Multi-upload)</span>
                  </label>
                  {followUpFiles.length > 0 && (
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full">
                      {followUpFiles.length} photo{followUpFiles.length > 1 ? "s" : ""}
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
                            title="Remove file"
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
                  <span>{followUpFiles.length > 0 ? "Add More Diagnostic Photos" : "Take Photo / Select Diagnostic Photos"}</span>
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFollowUpModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmFollowUp}
                  disabled={uploading || isPending}
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  {uploading ? "Uploading..." : "Confirm & Check Out"}
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
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN 1: HOME DASHBOARD (Screenshot 1)
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-slate-100/60 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col pb-24 select-none">
      
      {/* ── Top Header with TicketLink Branding ── */}
      <header className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md pt-10 pb-4 px-5 border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-30 shadow-xs">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shadow-xs flex-shrink-0">
              <img src="/logo.jpg" alt="TicketLink Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tight leading-none text-slate-950 dark:text-white">
                Ticket<span className="text-teal-500">Link</span> <span className="text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase ml-1">FE</span>
              </h1>
              <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">Field Engineer Portal</span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {activeTab === "home"
                ? "Home"
                : activeTab === "service_orders"
                ? "Service Order"
                : activeTab === "timeline"
                ? "Timeline"
                : activeTab === "schedule"
                ? "Schedule"
                : "Settings"}
            </span>
          </div>
        </div>
      </header>

      {/* Main Screen Container */}
      <main className="max-w-md w-full mx-auto px-4 mt-4 flex-1">
        
        {/* ─── TAB 1: HOME (Screenshot 1) ─── */}
        {activeTab === "home" && (
          <div className="space-y-4">
            
            {/* User Profile Welcome Row */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-3">
                {/* Avatar Icon / Image */}
                <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-tr from-indigo-600 to-teal-500 text-white flex items-center justify-center font-bold text-sm border-2 border-white dark:border-slate-800 shadow-sm flex-shrink-0">
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-base font-bold">{user?.name ? user.name.charAt(0).toUpperCase() : "FE"}</span>
                  )}
                </div>

                {/* Name & Subtitle */}
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                    Hi, {user?.name || "Field Engineer"}
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    TicketLink Field Operations
                  </p>
                </div>
              </div>

              {/* Right Action Icons: Help (?) & Notifications (Bell) */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toast.info("TicketLink Support: Contact Dispatch Hub for emergency dispatch assistance.")}
                  className="w-9 h-9 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center font-bold text-sm shadow-sm transition active:scale-95 cursor-pointer"
                  title="TicketLink Support"
                >
                  ?
                </button>

                <button
                  onClick={() => syncFETickets(false)}
                  className="w-9 h-9 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shadow-sm hover:bg-slate-50 transition active:scale-95 cursor-pointer relative"
                  title="Notifications & Sync"
                >
                  <svg className={`w-4 h-4 ${isRefreshing ? "animate-spin text-teal-600" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {newTickets.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center">
                      {newTickets.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Attendance Status Card (Clock In / On Duty) */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm flex items-center justify-between relative overflow-hidden">
              {/* Green Right Accent Bar */}
              <div className="absolute right-0 top-0 bottom-0 w-3.5 bg-emerald-600 rounded-r-2xl" />

              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xl flex-shrink-0">
                  🪪
                </div>
                <div>
                  <span className="text-[11px] font-medium text-slate-400 block">
                    Your current status:
                  </span>
                  <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                    {attendanceStatus === "CLOCK_IN"
                      ? "Clock In"
                      : attendanceStatus === "ON_DUTY"
                      ? "On Duty"
                      : attendanceStatus === "ON_BREAK"
                      ? "On Break"
                      : "Clock Out"}
                  </span>
                </div>
              </div>

              {/* Edit Status Pencil Button */}
              <button
                onClick={() => setIsAttendanceModalOpen(true)}
                className="mr-3 p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                title="Change Attendance Status"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>

            {/* ── Colored Metric Cards (Screenshot 1) ── */}
            <div className="space-y-3 pt-1">
              
              {/* 1. Blue Card: New */}
              <div
                onClick={() => {
                  setStatusFilter("NEW");
                  setActiveTab("service_orders");
                }}
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-2xl p-4 shadow-md flex items-center justify-between cursor-pointer transition active:scale-98"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white text-xl">
                    📑
                  </div>
                  <div>
                    <h3 className="font-bold text-base leading-tight">New</h3>
                    <p className="text-xs text-blue-100 mt-0.5">No. of Service Order</p>
                  </div>
                </div>
                <span className="text-2xl font-black">{newTickets.length}</span>
              </div>

              {/* 2. Orange Card: WIP */}
              <div
                onClick={() => {
                  setStatusFilter("WIP");
                  setActiveTab("service_orders");
                }}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-2xl p-4 shadow-md flex items-center justify-between cursor-pointer transition active:scale-98"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white text-xl">
                    ⏱️
                  </div>
                  <div>
                    <h3 className="font-bold text-base leading-tight">WIP</h3>
                    <p className="text-xs text-orange-100 mt-0.5">No. of Service Order</p>
                  </div>
                </div>
                <span className="text-2xl font-black">{wipTickets.length}</span>
              </div>

              {/* 3. Green Card: Resolved */}
              <div
                onClick={() => {
                  setStatusFilter("RESOLVED");
                  setActiveTab("service_orders");
                }}
                className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-2xl p-4 shadow-md flex items-center justify-between cursor-pointer transition active:scale-98"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white text-xl">
                    ✅
                  </div>
                  <div>
                    <h3 className="font-bold text-base leading-tight">Resolved</h3>
                    <p className="text-xs text-emerald-100 mt-0.5">No. of Service Order</p>
                  </div>
                </div>
                <span className="text-2xl font-black">{resolvedTickets.length}</span>
              </div>

            </div>

          </div>
        )}

        {/* ─── TAB 2: SERVICE ORDER LISTING (Screenshot 2) ─── */}
        {activeTab === "service_orders" && (
          <div className="space-y-3.5">
            
            {/* Header Navigation & Subtitle Badge */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setActiveTab("home")}
                className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 cursor-pointer"
              >
                <span>‹ Home</span>
              </button>
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                Filter: <span className="text-blue-600 font-extrabold">{statusFilter}</span>
              </div>
            </div>

            {/* Search Input Bar */}
            <div className="relative">
              <span className="absolute left-3.5 top-3 text-sm text-slate-400">🔍</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="SO Number, Site, Summary, Status"
                className="w-full pl-9 pr-9 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Pills: All | New | WIP | Resolved */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {(["ALL", "NEW", "WIP", "RESOLVED"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer flex-shrink-0 ${
                    statusFilter === st
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50"
                  }`}
                >
                  {st === "ALL" ? "All Orders" : st}
                </button>
              ))}
            </div>

            {/* Service Order Cards List */}
            <div className="space-y-3 pt-1">
              {displayedTickets.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200/80 dark:border-slate-800 text-center space-y-2">
                  <div className="text-3xl">📭</div>
                  <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">No service orders found</h4>
                  <p className="text-xs text-slate-400">
                    {searchQuery ? "Try refining your search terms." : "No orders matching current filter."}
                  </p>
                </div>
              ) : (
                displayedTickets.map((ticket) => {
                  const stage = getTicketStageInfo(ticket);
                  const soRef = ticket.ticketRefNo || `SO-${String(ticket.id).padStart(7, "0")}`;

                  return (
                    <div
                      key={ticket.id}
                      onClick={() => setSelectedTicket(ticket)}
                      className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-blue-300 dark:hover:border-blue-700 transition cursor-pointer space-y-2.5 active:scale-99"
                    >
                      {/* Top Row: Icon + SO Number + Chevron */}
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center text-lg font-bold flex-shrink-0 shadow-xs">
                          💠
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-extrabold text-sm text-blue-600 dark:text-blue-400 font-mono tracking-tight">
                            {soRef}
                          </h3>
                          <div className="flex items-center justify-between mt-0.5">
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate pr-2">
                              {ticket.id} | {ticket.issueDescription}
                            </p>
                            <span className="text-slate-300 dark:text-slate-600 font-bold text-sm flex-shrink-0">›</span>
                          </div>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                            {ticket.clientSiteName}
                          </p>
                        </div>
                      </div>

                      {/* Footer Badges: Status | SLA Timer | Severity */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/80 text-[11px]">
                        {/* Status Pill */}
                        <div className="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                          <span>⏱️</span>
                          <span>{stage.label}</span>
                        </div>

                        {/* SLA Countdown Timer */}
                        <div className="flex items-center gap-1 font-bold text-slate-700 dark:text-slate-300 font-mono">
                          <span>⏰</span>
                          {ticket.slaDeadline ? (
                            <SlaCountdown
                              slaDeadline={ticket.slaDeadline}
                              status={ticket.status}
                              resolvedAt={ticket.resolvedAt}
                              slaPaused={ticket.slaPaused}
                              slaPausedAt={ticket.slaPausedAt}
                            />
                          ) : (
                            <span>No SLA</span>
                          )}
                        </div>

                        {/* Severity Badge */}
                        <div className="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                          <span>⚡</span>
                          <span>{ticket.severity || "P3"}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        )}

        {/* ─── TAB 3: TIMELINE / RECENT ACTIVITY ─── */}
        {activeTab === "timeline" && (
          <div className="space-y-3">
            <h3 className="font-bold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Recent Job Activity Feed
            </h3>
            <div className="space-y-2">
              {tickets.flatMap((t) => t.activities || []).length === 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 text-center text-xs text-slate-400 border border-slate-200 dark:border-slate-800">
                  No recent activities recorded.
                </div>
              ) : (
                tickets
                  .flatMap((t) =>
                    (t.activities || []).map((a) => ({
                      ...a,
                      ticketRef: t.ticketRefNo || `SO-${t.id}`,
                      site: t.clientSiteName,
                    }))
                  )
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .slice(0, 15)
                  .map((act) => (
                    <div key={act.id} className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 border border-slate-200/80 dark:border-slate-800 shadow-xs text-xs space-y-1">
                      <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
                        <span className="font-mono text-blue-600">{act.ticketRef}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(act.createdAt).toLocaleString("en-MY", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium">{act.site}</p>
                      <p className="text-slate-700 dark:text-slate-300">{act.notes}</p>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 4: WORKING SCHEDULE / CALENDAR ─── */}
        {activeTab === "schedule" && (
          <div className="space-y-3">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
              <h3 className="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Today's Field Agenda ({new Date().toLocaleDateString("en-MY", { weekday: "long", day: "numeric", month: "short" })})
              </h3>
              <p className="text-xs text-slate-500">
                You have {wipTickets.length + newTickets.length} active service order(s) scheduled for today.
              </p>
            </div>

            <div className="space-y-2.5">
              {activeJobs.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 text-center text-xs text-slate-400 border border-slate-200 dark:border-slate-800">
                  No active service orders scheduled for today.
                </div>
              ) : (
                activeJobs.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTicket(t)}
                    className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-700 cursor-pointer space-y-1.5 transition active:scale-99"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold font-mono text-xs text-indigo-600 dark:text-indigo-400">{t.ticketRefNo || `SO-${t.id}`}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {t.status}
                      </span>
                    </div>
                    <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100">{t.clientSiteName}</h4>
                    <p className="text-[11px] text-slate-500 line-clamp-1">{t.issueDescription}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 5: SETTINGS / PROFILE ─── */}
        {activeTab === "setting" && (
          <div className="space-y-4 pb-4">
            
            {/* 1. 📸 Profile Photo & Identity Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col items-center text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-r from-indigo-500/10 via-teal-500/10 to-indigo-500/10 dark:from-indigo-900/20 dark:via-teal-900/20 dark:to-indigo-900/20" />
              
              <div className="relative mt-2">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-tr from-indigo-600 to-teal-500 text-white flex items-center justify-center font-bold text-2xl border-4 border-white dark:border-slate-900 shadow-md">
                  {profileAvatarUrl ? (
                    <img src={profileAvatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span>{profileName ? profileName.charAt(0).toUpperCase() : "FE"}</span>
                  )}
                </div>

                {/* Upload Trigger Button */}
                <label className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-lg border-2 border-white dark:border-slate-900 cursor-pointer transition active:scale-95">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    disabled={uploadingAvatar}
                    className="hidden"
                  />
                  {uploadingAvatar ? (
                    <span className="animate-spin text-xs">⏳</span>
                  ) : (
                    <span className="text-xs">📷</span>
                  )}
                </label>
              </div>

              <div className="mt-3 space-y-1">
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {profileName || user?.name || "Field Engineer"}
                </h3>
                <div className="flex flex-wrap items-center justify-center gap-1.5 pt-0.5">
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                    {user?.role === "FIELD_ENGINEER" ? "Field Engineer" : user?.role || "Staff"}
                  </span>
                  {user?.partner?.name && (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      🏢 {user.partner.name}
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
                  {uploadingAvatar ? "Uploading Photo..." : "Change Photo"}
                </label>
                {profileAvatarUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    disabled={uploadingAvatar}
                    className="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold cursor-pointer transition"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            {/* 2. 👤 Personal Information Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <span>👤</span>
                  <span>Personal Details</span>
                </h4>
                <span className="text-[10px] font-medium text-slate-400">Profile Information</span>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="e.g. Ahmad bin Razak"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Phone / WhatsApp Contact
                  </label>
                  <input
                    type="tel"
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    placeholder="e.g. +60 12-345 6789"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* Read-Only Account Identity */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Login Email Address
                  </label>
                  <div className="w-full px-3 py-2 rounded-xl bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
                    <span className="font-mono">{user?.email || "N/A"}</span>
                    <span className="text-[10px] font-bold text-slate-400">🔒 Verified</span>
                  </div>
                </div>

                {/* Read-Only Service Center / Partner */}
                {user?.partner?.name && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Assigned Service Partner Center
                    </label>
                    <div className="w-full px-3 py-2 rounded-xl bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <span>🏢</span>
                      <span>{user.partner.name}</span>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={savingProfile}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs shadow-md cursor-pointer transition mt-1"
                >
                  {savingProfile ? "Saving Profile..." : "Save Profile Details"}
                </button>
              </form>
            </div>

            {/* 3. 🔒 Security & Change Password Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🔒</span>
                  <span>Security & Password</span>
                </h4>
                <span className="text-[10px] font-medium text-slate-400">Update Credentials</span>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-3">
                {/* Current Password */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Current Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      className="w-full pl-3 pr-10 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1"
                    >
                      {showCurrentPassword ? "👁️" : "👁️‍🗨️"}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    New Password (min 6 characters) *
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Create a strong password"
                      className="w-full pl-3 pr-10 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1"
                    >
                      {showNewPassword ? "👁️" : "👁️‍🗨️"}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Confirm New Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full pl-3 pr-10 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1"
                    >
                      {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={changingPassword}
                  className="w-full py-2.5 rounded-xl bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white font-bold text-xs shadow-md cursor-pointer transition mt-1"
                >
                  {changingPassword ? "Updating Password..." : "Change Password"}
                </button>
              </form>
            </div>

            {/* 4. ⚙️ App Preferences & Attendance Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <span>⚙️</span>
                  <span>App Preferences</span>
                </h4>
                <span className="text-[10px] font-medium text-slate-400">Display & Alerts</span>
              </div>

              {/* Theme Toggle */}
              <div className="flex items-center justify-between py-1">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Theme Mode</span>
                  <span className="text-[11px] text-slate-400">Switch between dark & light appearance</span>
                </div>
                <ThemeToggle />
              </div>

              {/* Notification Sound Toggle */}
              <div className="flex items-center justify-between py-1 border-t border-slate-100 dark:border-slate-800 pt-3">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Dispatch Sound Chime</span>
                  <span className="text-[11px] text-slate-400">Play alert sound when assigned new jobs</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      playNotificationChime();
                      toast.info("Chime sound preview played.");
                    }}
                    className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
                    title="Test audio alert"
                  >
                    🔊 Test
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !soundEnabled;
                      setSoundEnabled(next);
                      toast.success(next ? "Notification audio chime enabled." : "Audio chime muted.");
                    }}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition cursor-pointer ${
                      soundEnabled ? "bg-teal-600" : "bg-slate-300 dark:bg-slate-700"
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
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Attendance / Shift</span>
                  <span className="text-[11px] text-slate-400">
                    Status: <strong className="text-indigo-600 dark:text-indigo-400">{attendanceStatus.replace("_", " ")}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAttendanceModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-xs font-bold border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 cursor-pointer transition"
                >
                  🪪 Update
                </button>
              </div>
            </div>

            {/* 5. 🚪 Session & App Info Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>TicketLink Mobile FE</span>
                <span className="font-mono font-bold">v2.4.2</span>
              </div>
              
              <button
                type="button"
                onClick={signOut}
                className="w-full py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-bold text-xs border border-rose-200 dark:border-rose-900/60 cursor-pointer transition"
              >
                Sign Out / Log Out
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
          <div className="absolute bottom-14 right-0 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 shadow-2xl space-y-1 text-xs font-semibold animate-in fade-in slide-in-from-bottom-2 z-50">
            <button
              onClick={() => {
                setIsFloatingMenuOpen(false);
                syncFETickets(false);
              }}
              className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
            >
              🔄 Sync Dispatches
            </button>
            <button
              onClick={() => {
                setIsFloatingMenuOpen(false);
                setIsAttendanceModalOpen(true);
              }}
              className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
            >
              🪪 Clock In / Out
            </button>
            <button
              onClick={() => {
                setIsFloatingMenuOpen(false);
                toast.info("Call central dispatch at +603-8888-9999");
              }}
              className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer text-blue-600"
            >
              📞 Call Dispatch
            </button>
          </div>
        )}
      </div>

      {/* ── Bottom Navigation Bar (Screenshot 1) ── */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 py-2 px-3 z-30 shadow-lg">
        <div className="max-w-md mx-auto flex items-center justify-around">
          
          {/* 1. Home */}
          <button
            onClick={() => setActiveTab("home")}
            className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-2xl transition cursor-pointer ${
              activeTab === "home"
                ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400"
                : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <span className="text-base">🏠</span>
            <span className="text-[10px] font-bold">Home</span>
          </button>

          {/* 2. Service Order */}
          <button
            onClick={() => setActiveTab("service_orders")}
            className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-2xl transition cursor-pointer ${
              activeTab === "service_orders"
                ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400"
                : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <span className="text-base">📋</span>
            <span className="text-[10px] font-bold">Service Order</span>
          </button>

          {/* 3. Timeline */}
          <button
            onClick={() => setActiveTab("timeline")}
            className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-2xl transition cursor-pointer relative ${
              activeTab === "timeline"
                ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400"
                : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <span className="text-base">💬</span>
            <span className="text-[10px] font-bold">Timeline</span>
            {newTickets.length > 0 && (
              <span className="absolute 0 top-0.5 right-2 w-4 h-4 rounded-full bg-rose-500 text-white font-bold text-[9px] flex items-center justify-center">
                {newTickets.length}
              </span>
            )}
          </button>

          {/* 4. Working Schedule */}
          <button
            onClick={() => setActiveTab("schedule")}
            className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-2xl transition cursor-pointer ${
              activeTab === "schedule"
                ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400"
                : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <span className="text-base">📅</span>
            <span className="text-[10px] font-bold truncate max-w-[65px]">Working Sched...</span>
          </button>

          {/* 5. Setting */}
          <button
            onClick={() => setActiveTab("setting")}
            className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-2xl transition cursor-pointer ${
              activeTab === "setting"
                ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400"
                : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <span className="text-base">⚙️</span>
            <span className="text-[10px] font-bold">Setting</span>
          </button>

        </div>
      </nav>

      {/* ── Modal: Attendance Status Switcher ── */}
      {isAttendanceModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                🪪 Update Attendance Status
              </h3>
              <button onClick={() => setIsAttendanceModalOpen(false)} className="text-slate-400 p-1">✕</button>
            </div>

            <div className="space-y-2">
              {[
                { id: "CLOCK_IN", label: "Clock In", desc: "Start daily shift", icon: "🟢" },
                { id: "ON_DUTY", label: "On Duty / Available", desc: "Ready for dispatches", icon: "🔵" },
                { id: "ON_BREAK", label: "On Break", desc: "Lunch / Rest period", icon: "☕" },
                { id: "CLOCK_OUT", label: "Clock Out", desc: "End of work day", icon: "🔴" },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSaveAttendance(item.id as any)}
                  className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition cursor-pointer ${
                    attendanceStatus === item.id
                      ? "bg-blue-50 dark:bg-blue-950/50 border-blue-500 text-blue-900 dark:text-blue-200"
                      : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{item.icon}</span>
                    <div>
                      <h4 className="font-bold text-xs text-slate-800 dark:text-white">{item.label}</h4>
                      <p className="text-[11px] text-slate-500">{item.desc}</p>
                    </div>
                  </div>
                  {attendanceStatus === item.id && (
                    <span className="text-blue-600 font-bold text-sm">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
