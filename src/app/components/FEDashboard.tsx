"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useAuth } from "./AuthProvider";
import { 
  getTickets, 
  getTicketById,
  acknowledgeTicket, 
  updateTicketEta, 
  addTicketComment, 
  updateTicketResolution,
  updateSelfEngineerProfile,
  updateUserProfile,
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
import NotificationCenter from "./NotificationCenter";
import { toast } from "sonner";

interface TicketActivity {
  id: number;
  type: string;
  status?: string | null;
  subStatus?: string | null;
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
  severity: "P1" | "P2" | "P3" | "P4" | null;
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

export default function FEDashboard() {
  const { user, signOut, refreshProfile } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Navigation tab state: "active" | "history" | "profile"
  const [activeTab, setActiveTab] = useState<"active" | "history" | "profile">("active");

  // Profile Form States
  const [profileName, setProfileName] = useState(user?.name || "");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState(user?.avatarUrl || "");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Close dropdown menu when clicking anywhere else
  useEffect(() => {
    if (!showUserMenu) return;
    const handleClose = () => setShowUserMenu(false);
    window.addEventListener("click", handleClose);
    return () => window.removeEventListener("click", handleClose);
  }, [showUserMenu]);

  // Detail views & modal states
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [actionTakenNotes, setActionTakenNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [serviceReportFile, setServiceReportFile] = useState<File | null>(null);
  const [actionType, setActionType] = useState<"followup" | "resolve">("followup");
  const [hasReplacedPart, setHasReplacedPart] = useState(false);
  const [defectiveSerial, setDefectiveSerial] = useState("");
  const [defectiveReturnStatus, setDefectiveReturnStatus] = useState("PENDING");
  const [editingEtaTicketId, setEditingEtaTicketId] = useState<number | null>(null);
  const [inlineEtaVal, setInlineEtaVal] = useState("");

  // Reassignment flow states
  const [isReassigning, setIsReassigning] = useState(false);
  const [targetFeId, setTargetFeId] = useState("");
  const [reassignNotes, setReassignNotes] = useState("");
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);

  const loadTeam = async () => {
    try {
      setLoadingTeam(true);
      const data = await getFeTeamMembersByUserId(user!.id);
      setTeamMembers(data);
    } catch (err) {
      console.error("Error loading team members:", err);
    } finally {
      setLoadingTeam(false);
    }
  };

  const handleConfirmReassign = async (ticketId: number) => {
    if (!reassignNotes.trim()) {
      toast.error("Please provide reassignment notes.");
      return;
    }
    startTransition(async () => {
      try {
        await reassignTicketByFe({
          ticketId,
          feUserId: user!.id,
          targetFeId: targetFeId ? Number(targetFeId) : null,
          notes: reassignNotes,
        });
        setSelectedTicket(null);
        setIsReassigning(false);
        setReassignNotes("");
        setTargetFeId("");
        await fetchFETickets();
        toast.success("Ticket reassigned successfully!");
      } catch (err: any) {
        toast.error(err.message || "Failed to reassign ticket.");
      }
    });
  };

  // Follow Up States
  const [followUpSubStatus, setFollowUpSubStatus] = useState("");
  const [partName, setPartName] = useState("");
  const [partModel, setPartModel] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [partQty, setPartQty] = useState(1);

  // Resumption States
  const [resumeNotes, setResumeNotes] = useState("");
  const [resumeEtaVal, setResumeEtaVal] = useState("");
  const [isChronologyExpanded, setIsChronologyExpanded] = useState(true);

  const fetchFETickets = async () => {
    if (!user?.engineerId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const allTickets = await getTickets();
      // Filter for active/completed tickets assigned to this FE
      const filtered = allTickets.filter(
        (t: any) => t.assignedFeId === user.engineerId
      );
      setTickets(filtered as unknown as Ticket[]);
    } catch (err: any) {
      setError(err.message || "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFETickets();
    if (user) {
      setProfileName(user.name || "");
      setProfileAvatarUrl(user.avatarUrl || "");
      if (user.engineer) {
        setProfilePhone((user.engineer as any).phone || "");
      }
    }
  }, [user]);

  // Auto-refresh tickets periodically
  useEffect(() => {
    const interval = setInterval(() => {
      getTickets().then((fresh) => {
        if (fresh) setTickets(fresh as any);
      }).catch((e) => console.error(e));
    }, 30000);
    return () => clearInterval(interval);
  }, []);


  useEffect(() => {
    if (selectedTicket) {
      setActionType("followup");
      setActionTakenNotes("");
      setPhotoFiles([]);
      setServiceReportFile(null);
      setHasReplacedPart(false);
      setDefectiveSerial("");
      setDefectiveReturnStatus("PENDING");
    }
  }, [selectedTicket?.id]);

  const handleAcknowledge = async (ticketId: number) => {
    startTransition(async () => {
      try {
        await acknowledgeTicket(ticketId, "Acknowledged via Field Engineer mobile portal.", user?.name || "Field Engineer");
        await fetchFETickets();
        setSelectedTicket(null);
        toast.success("Job acknowledged!");
      } catch (err: any) {
        toast.error(err.message || "Failed to acknowledge ticket");
      }
    });
  };

  const handleSubmitAction = async (ticketId: number) => {
    if (!actionTakenNotes.trim()) {
      toast.error("Please describe the action taken / work done.");
      return;
    }

    if (!serviceReportFile) {
      toast.error("Please attach the signed service report (PDF or Photo) before submitting.");
      return;
    }

    if (actionType === "followup") {
      if (!followUpSubStatus) {
        toast.error("Please select a follow-up reason.");
        return;
      }
      if (followUpSubStatus === "PENDING_PARTS") {
        if (!partName.trim()) {
          toast.error("Please provide the Part Name / Description.");
          return;
        }
        if (!partNumber.trim()) {
          toast.error("Please provide the Part Number.");
          return;
        }
      }
    }

    if (actionType === "resolve") {
      if (hasReplacedPart && !defectiveSerial.trim()) {
        toast.error("Please provide the defective part serial number (or type 'N/A' if unavailable).");
        return;
      }
    }

    setUploading(true);
    toast.loading("Uploading files & updating ticket...", { id: "fe-submit" });
    const photoUrls: string[] = [];
    let serviceReportUrl = "";

    try {
      // 1. Upload multiple photo files (compressed client-side)
      for (const photoFile of photoFiles) {
        const compressedPhoto = await compressImage(photoFile, 1200, 1200, 0.75);
        const formData = new FormData();
        formData.append("file", compressedPhoto);
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) throw new Error(`Failed to upload photo: ${photoFile.name}`);
        const data = await res.json();
        photoUrls.push(data.url);
      }

      // 2. Upload and rename service report file (for resolve and followup, compressed only if image)
      if (serviceReportFile && selectedTicket) {
        const ext = serviceReportFile.name.split(".").pop() || "pdf";
        const ticketRef = selectedTicket.ticketRefNo || `TICKET_${selectedTicket.id}`;
        const cleanRef = ticketRef.replace(/[^a-zA-Z0-9-_]/g, "_");
        const renamedName = `SR_${cleanRef}.${ext}`;

        const renamedFile = new File([serviceReportFile], renamedName, {
          type: serviceReportFile.type,
          lastModified: serviceReportFile.lastModified,
        });

        const compressedSR = await compressImage(renamedFile, 1200, 1200, 0.75);
        const formData = new FormData();
        formData.append("file", compressedSR);
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) throw new Error("Failed to upload service report file");
        const data = await res.json();
        serviceReportUrl = data.url;
      }

      startTransition(async () => {
        try {
          if (actionType === "followup") {
            let finalNotes = actionTakenNotes.trim();
            if (followUpSubStatus === "PENDING_PARTS") {
              const modelStr = partModel.trim() ? `, Model: ${partModel.trim()}` : "";
              const fullPartDesc = `${partName.trim()} (Part No: ${partNumber.trim()}${modelStr})`;
              finalNotes = `[Part Required: ${fullPartDesc} x${partQty}]\n\n${finalNotes}`;

              // Auto-register into Spare Parts Queue
              await requestTicketSparePart({
                ticketId,
                requestedPartName: fullPartDesc,
                quantity: Number(partQty) || 1,
                notes: actionTakenNotes.trim() || undefined,
                author: user?.name || "Field Engineer",
              });
            }
            if (photoUrls.length > 0) {
              const photoLinks = photoUrls.map(url => `[Attached Image: ${url}]`).join(" ");
              finalNotes = `${finalNotes}\n\n${photoLinks}`;
            }
            if (serviceReportUrl) {
              finalNotes = `${finalNotes}\n\n[Attached Service Report: ${serviceReportUrl}]`;
            }

            await updateTicketStatus(
              ticketId,
              "FOLLOW_UP",
              followUpSubStatus,
              finalNotes,
              user?.name || "Field Engineer",
              serviceReportUrl || null
            );
            await fetchFETickets();
            
            // Reset states
            setFollowUpSubStatus("");
            setActionTakenNotes("");
            setPhotoFiles([]);
            setServiceReportFile(null);
            setPartName("");
            setPartModel("");
            setPartNumber("");
            setPartQty(1);
            setSelectedTicket(null);
            toast.success("Ticket set to Follow-Up!", { id: "fe-submit" });
          } 
          else if (actionType === "resolve") {
            let finalNotes = actionTakenNotes.trim();
            if (photoUrls.length > 0) {
              const photoLinks = photoUrls.map(url => `[Attached Image: ${url}]`).join(" ");
              finalNotes = `${finalNotes}\n\n${photoLinks}`;
            }
            if (serviceReportUrl) {
              finalNotes = `${finalNotes}\n\n[Attached Service Report: ${serviceReportUrl}]`;
            }

            await updateTicketResolution(
              ticketId,
              finalNotes,
              new Date(),
              user?.name || "Field Engineer",
              serviceReportUrl || null,
              hasReplacedPart ? defectiveSerial.trim() : null,
              hasReplacedPart ? defectiveReturnStatus : null
            );

            // If there's an allocated/dispatched spare part on this ticket, mark it installed
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

            await fetchFETickets();
            setActionTakenNotes("");
            setPhotoFiles([]);
            setServiceReportFile(null);
            setHasReplacedPart(false);
            setDefectiveSerial("");
            setDefectiveReturnStatus("PENDING");
            setSelectedTicket(null);
            toast.success("Ticket resolved successfully!", { id: "fe-submit" });
          }

        } catch (err: any) {
          toast.error(err.message || "Operation failed", { id: "fe-submit" });
        }
      });
    } catch (err: any) {
      toast.error(err.message || "Upload failed", { id: "fe-submit" });
    } finally {
      setUploading(false);
    }
  };

  const handleResume = async (ticketId: number) => {
    startTransition(async () => {
      try {
        // 1. Update status to IN_PROGRESS and log notes
        await updateTicketStatus(
          ticketId,
          "IN_PROGRESS",
          null,
          resumeNotes.trim() || "Job resumed by Field Engineer.",
          user?.name || "Field Engineer"
        );

        // 2. Set new ETA if provided
        if (resumeEtaVal) {
          await updateTicketEta(ticketId, new Date(resumeEtaVal), user?.name || "Field Engineer");
        }

        await fetchFETickets();
        setResumeNotes("");
        setResumeEtaVal("");
        setSelectedTicket(null);
        toast.success("Ticket status set back to In Progress!");
      } catch (err: any) {
        toast.error(err.message || "Failed to resume ticket");
      }
    });
  };

  // Auto-clear profile alerts when switching tabs
  useEffect(() => {
    setProfileSuccess(null);
    setProfileError(null);
  }, [activeTab]);

  const showProfileSuccess = (msg: string) => {
    setProfileSuccess(msg);
    toast.success(msg);
    setTimeout(() => {
      setProfileSuccess(null);
    }, 4000);
  };

  const showProfileError = (msg: string) => {
    setProfileError(msg);
    toast.error(msg);
    setTimeout(() => {
      setProfileError(null);
    }, 6000);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    setProfileError(null);
    setProfileSuccess(null);

    try {
      const compressed = await compressImage(file, 400, 400, 0.75);
      const formData = new FormData();
      formData.append("file", compressed);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Upload failed");
      }

      const data = await res.json();
      setProfileAvatarUrl(data.url);
      showProfileSuccess("Avatar uploaded! Click save to persist.");
    } catch (err: any) {
      showProfileError(err.message || "Failed to upload avatar.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    if (!profileName.trim() || !profilePhone.trim()) {
      showProfileError("Full Name and Phone Number are required.");
      return;
    }

    setSavingProfile(true);

    try {
      // 1. Update Database Field Engineer record
      if (user?.engineerId && user.id) {
        await updateSelfEngineerProfile(user.engineerId, user.id, profileName, profilePhone);
      }

      // 2. Update User avatar and name
      if (user?.id) {
        await updateUserProfile(user.id, {
          name: profileName,
          avatarUrl: profileAvatarUrl || null,
        });
      }

      await refreshProfile();

      // 3. Update Password if entered
      if (newPassword) {
        if (newPassword !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }
        if (newPassword.length < 6) {
          throw new Error("Password must be at least 6 characters.");
        }
        const res = await updateMyPasswordAction(newPassword);
        if (!res.success) throw new Error(res.error || "Failed to update password.");
        setNewPassword("");
        setConfirmPassword("");
      }

      showProfileSuccess("Profile updated successfully!");
    } catch (err: any) {
      showProfileError(err.message || "An error occurred while saving profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  if (!user?.engineerId) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-6 border border-amber-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold mb-2">Account Link Pending</h3>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            Your login `{user?.email}` is registered as a Field Engineer but has not been linked to a specific engineer record in our database yet.
          </p>
          <div className="flex flex-col space-y-3">
            <div className="text-xs text-slate-500">
              Please contact your administrator or Superadmin to link your profile.
            </div>
            <button
              onClick={signOut}
              className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 font-semibold transition-all text-sm"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Filter Active vs Completed Jobs
  const activeTickets = tickets.filter(
    (t) => t.status !== "RESOLVED" && t.status !== "COMPLETE" && t.status !== "CLOSED"
  );
  const historyTickets = tickets.filter(
    (t) => t.status === "RESOLVED" || t.status === "COMPLETE" || t.status === "CLOSED"
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col pb-10">
      {/* Navbar Header */}
      <header className="sticky top-0 bg-background/85 backdrop-blur-md border-b border-card-border py-4 px-6 flex justify-between items-center z-10 shadow-sm">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight uppercase">FE Workspace</h1>
            <p className="text-[11px] text-muted-text">Welcome, {user.name || "Engineer"}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <NotificationCenter />
          <ThemeToggle />
          
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowUserMenu(!showUserMenu);
              }}
              className="flex items-center gap-2 pl-2 border-l border-card-border ml-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/60 dark:hover:bg-slate-900 px-3 py-1.5 rounded-xl border transition-all cursor-pointer select-none text-left"
            >
              <div className="w-7 h-7 rounded-lg overflow-hidden bg-indigo-500 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span>{user?.name?.charAt(0).toUpperCase() || "?"}</span>
                )}
              </div>
              <div className="hidden sm:flex flex-col items-start pr-1">
                <span className="text-[11px] font-bold text-foreground truncate max-w-[80px] leading-tight">
                  {user?.name || user?.email}
                </span>
                <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider mt-0.5 leading-none">
                  FE ENG
                </span>
              </div>
              <svg className={`w-3 h-3 text-muted-text transition-transform duration-200 ${showUserMenu ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showUserMenu && (
              <div 
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 mt-2 w-44 bg-card border border-card-border rounded-xl shadow-xl z-50 py-1.5 text-xs font-semibold animate-in fade-in slide-in-from-top-2 duration-150"
              >
                <button
                  onClick={() => {
                    setActiveTab("profile");
                    setShowUserMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-900 text-foreground flex items-center gap-2"
                >
                  👤 Profile Settings
                </button>
                <button
                  onClick={() => {
                    setActiveTab("active");
                    setShowUserMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-900 text-foreground flex items-center gap-2"
                >
                  💼 Active Jobs
                </button>
                <hr className="border-card-border my-1" />
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    signOut();
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-rose-500/10 text-rose-500 flex items-center gap-2"
                >
                  🚪 Log Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-lg w-full mx-auto px-4 mt-6">
        
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-950/80 rounded-xl border border-card-border w-full mb-6">
          <button
            onClick={() => setActiveTab("active")}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "active"
                ? "bg-white dark:bg-slate-800 text-foreground dark:text-white shadow-sm"
                : "text-muted-text hover:text-foreground"
            }`}
          >
            Active Jobs ({activeTickets.length})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "history"
                ? "bg-white dark:bg-slate-800 text-foreground dark:text-white shadow-sm"
                : "text-muted-text hover:text-foreground"
            }`}
          >
            Case History ({historyTickets.length})
          </button>
        </div>

        {/* Tab Panel: Active Jobs */}
        {activeTab === "active" && (
          <div className="space-y-4">
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
              </div>
            ) : activeTickets.length === 0 ? (
              <div className="text-center py-16 bg-card border border-card-border rounded-2xl p-6">
                <p className="text-sm font-semibold text-muted-text">No active job assignments</p>
                <p className="text-xs text-muted-text mt-1">You are currently fully cleared of pending dispatches.</p>
              </div>
            ) : (
              activeTickets.map((ticket) => {
                const isPendingAck = ticket.feAcknowledgeStatus === "PENDING";
                return (
                  <div
                    key={ticket.id}
                    onClick={async () => {
                      setSelectedTicket(ticket);
                      try {
                        const fullTicket = await getTicketById(ticket.id);
                        if (fullTicket) {
                          setSelectedTicket(fullTicket as unknown as Ticket);
                        }
                      } catch (err) {
                        console.error("Failed to load ticket activities:", err);
                      }
                    }}
                    className="bg-card hover:bg-slate-50 dark:hover:bg-slate-900/40 border border-card-border rounded-2xl p-5 shadow-sm cursor-pointer transition-all duration-200"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-mono font-bold text-muted-text">
                        {ticket.ticketRefNo || `TKT-#${ticket.id}`}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-md border font-bold uppercase ${
                        ticket.status === "IN_PROGRESS"
                          ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20"
                          : ticket.status === "FOLLOW_UP"
                          ? "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/20"
                          : ticket.status === "ON_HOLD"
                          ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20"
                          : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                      }`}>
                        {ticket.status}
                      </span>
                    </div>

                    <h4 className="font-bold text-foreground text-base mb-1">{ticket.clientSiteName}</h4>
                    <p className="text-xs text-muted-text mb-3">{ticket.state}</p>

                    {/* SLA Deadline details label */}
                    {ticket.slaDeadline && (
                      <div className="text-[11px] text-muted-text mb-3 flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-card-border/60">
                        <span>⏰ Deadline:</span>
                        <span className="font-bold text-foreground">
                          {new Date(ticket.slaDeadline).toLocaleString("en-MY", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    )}

                    {/* Dispatched / Requested Spare Parts & Loaners Banner for FE */}
                    {ticket.spareParts && ticket.spareParts.length > 0 && (
                      <div className="mb-3 space-y-2">
                        {ticket.spareParts.map((sp) => {
                          const isLoaner = sp.status === "ON_LOAN" || sp.status === "RETURN_IN_TRANSIT" || sp.status === "RETURNED";
                          return (
                            <div
                              key={sp.id}
                              className={`p-2.5 rounded-xl border text-xs space-y-1 ${
                                isLoaner
                                  ? "bg-cyan-50/80 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-800/60"
                                  : "bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/60"
                              }`}
                            >
                              <div className="flex items-center justify-between font-bold">
                                <span className={`flex items-center gap-1.5 ${isLoaner ? "text-cyan-700 dark:text-cyan-300" : "text-indigo-700 dark:text-indigo-300"}`}>
                                  {isLoaner ? "🔄 Standby Loaner:" : "📦 Spare Part:"}
                                </span>
                                <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-semibold ${
                                  isLoaner
                                    ? "bg-cyan-100 dark:bg-cyan-900/60 text-cyan-800 dark:text-cyan-200"
                                    : "bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200"
                                }`}>
                                  {sp.status === "ON_LOAN" ? "Active On Site" : sp.status}
                                </span>
                              </div>
                              <p className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                                {sp.inventoryItem?.name || sp.requestedPartName}
                              </p>
                              {sp.dispatchTrackingNo && (
                                <p className="text-[11px] text-blue-600 dark:text-blue-400 font-mono">
                                  🚚 Outbound ({sp.courierName || "Courier"}): {sp.dispatchTrackingNo}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}


                    <p className="text-xs text-foreground line-clamp-2 bg-slate-50 dark:bg-slate-950/40 p-2.5 rounded-xl border border-card-border mb-3 leading-relaxed">
                      {ticket.issueDescription}
                    </p>

                    <div className="flex justify-between items-center pt-2 border-t border-card-border text-xs">
                      <div className="flex items-center space-x-1.5 text-muted-text">
                        <span className={`w-2 h-2 rounded-full ${
                          ticket.severity === "P1" ? "bg-rose-500 animate-pulse" : ticket.severity === "P2" ? "bg-orange-500" : "bg-yellow-500"
                        }`} />
                        <span className="font-bold text-muted-text uppercase">{ticket.severity || "P3"}</span>
                      </div>

                      <SlaCountdown
                        slaDeadline={ticket.slaDeadline}
                        status={ticket.status}
                        resolvedAt={ticket.resolvedAt}
                        updatedAt={ticket.updatedAt}
                        slaPaused={ticket.slaPaused}
                        slaPausedAt={ticket.slaPausedAt}
                      />
                    </div>

                    <div className="mt-3.5 pt-3.5 border-t border-card-border">
                      {isPendingAck ? (
                        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={async () => {
                              try {
                                await acknowledgeTicket(ticket.id, "Acknowledged via Field Engineer mobile portal.", user?.name || "Field Engineer");
                                await fetchFETickets();
                                toast.success("Job acknowledged!");
                              } catch (err: any) {
                                toast.error(err.message || "Failed to acknowledge");
                              }
                            }}
                            className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all shadow-sm active:scale-[0.98] text-center"
                          >
                            Acknowledge Job
                          </button>
                        </div>
                      ) : editingEtaTicketId === ticket.id ? (
                        <div className="space-y-2 p-2 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-card-border" onClick={(e) => e.stopPropagation()}>
                          <label className="block text-[10px] text-muted-text uppercase font-bold">Quick Set ETA</label>
                          <div className="flex gap-2">
                            <input
                              type="datetime-local"
                              value={inlineEtaVal}
                              onChange={(e) => setInlineEtaVal(e.target.value)}
                              className="flex-1 px-2.5 py-1.5 rounded-lg bg-input-bg border border-card-border text-[11px] font-semibold text-foreground focus:outline-none"
                            />
                            <button
                              onClick={async () => {
                                if (!inlineEtaVal) return;
                                try {
                                  await updateTicketEta(ticket.id, new Date(inlineEtaVal), user?.name || "Field Engineer");
                                  setEditingEtaTicketId(null);
                                  await fetchFETickets();
                                  toast.success("ETA saved!");
                                } catch (err: any) {
                                  toast.error(err.message || "Failed to update ETA");
                                }
                              }}
                              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-[10px]"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingEtaTicketId(null)}
                              className="px-3 py-1 bg-slate-200 dark:bg-slate-800 text-foreground hover:bg-slate-300 rounded-lg text-[10px]"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
                          {/* Onsite Now button or Arrived label */}
                          {ticket.status === "NEW" ? (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (confirm("Confirm that you have arrived onsite? This will update the status to In Progress.")) {
                                  try {
                                    await updateTicketStatus(ticket.id, "IN_PROGRESS", null, "Field Engineer has arrived onsite.", user?.name || "Field Engineer");
                                    await fetchFETickets();
                                    toast.success("Arrival recorded! Status updated to In Progress.");
                                  } catch (err: any) {
                                    toast.error(err.message || "Failed to mark arrival");
                                  }
                                }
                              }}
                              className="flex-1 px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-all active:scale-[0.98] shadow-sm flex items-center justify-center gap-1"
                            >
                              📍 Onsite Now
                            </button>
                          ) : ticket.status === "IN_PROGRESS" ? (
                            <button
                              disabled
                              className="flex-1 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold rounded-xl text-xs flex items-center justify-center gap-1 cursor-default"
                            >
                              ✓ Arrived Onsite
                            </button>
                          ) : null}
                          
                          {ticket.status === "NEW" && (
                            <button
                              onClick={() => {
                                setEditingEtaTicketId(ticket.id);
                                setInlineEtaVal(ticket.eta ? new Date(new Date(ticket.eta).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
                              }}
                              className="flex-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all active:scale-[0.98] shadow-sm flex items-center justify-center gap-1"
                            >
                              {ticket.eta ? "🕒 Update ETA" : "🕒 Set ETA"}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab Panel: Case History */}
        {activeTab === "history" && (
          <div className="space-y-4">
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
              </div>
            ) : historyTickets.length === 0 ? (
              <div className="text-center py-16 bg-card border border-card-border rounded-2xl p-6">
                <p className="text-sm font-semibold text-muted-text">No job history</p>
                <p className="text-xs text-muted-text mt-1">You have not completed any dispatches yet.</p>
              </div>
            ) : (
              historyTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  onClick={async () => {
                    setSelectedTicket(ticket);
                    try {
                      const fullTicket = await getTicketById(ticket.id);
                      if (fullTicket) {
                        setSelectedTicket(fullTicket as unknown as Ticket);
                      }
                    } catch (err) {
                      console.error("Failed to load ticket activities:", err);
                    }
                  }}
                  className="bg-card hover:bg-slate-50 dark:hover:bg-slate-900/40 border border-card-border rounded-2xl p-5 shadow-sm cursor-pointer transition-all duration-200 opacity-80"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-mono font-bold text-muted-text">
                      {ticket.ticketRefNo || `TKT-#${ticket.id}`}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md border font-bold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                      {ticket.status}
                    </span>
                  </div>

                  <h4 className="font-bold text-foreground text-base mb-1">{ticket.clientSiteName}</h4>
                  <p className="text-xs text-muted-text mb-3">{ticket.state}</p>

                  <div className="flex justify-between items-center pt-2 border-t border-card-border text-xs">
                    <span className="text-muted-text font-semibold uppercase">{ticket.severity || "P3"}</span>
                    <span className="text-[10px] text-muted-text font-mono">
                      Report: {ticket.serviceReportUrl ? "✅ Uploaded" : "❌ None"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab Panel: Profile Settings */}
        {activeTab === "profile" && (
          <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm space-y-6">
            <div>
              <h3 className="text-base font-bold text-foreground">Operational Profile</h3>
              <p className="text-xs text-muted-text mt-0.5">Manage your user information and update login credentials.</p>
            </div>

            {profileError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 font-semibold">
                ⚠️ {profileError}
              </div>
            )}

            {profileSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                ✓ {profileSuccess}
              </div>
            )}

            <div className="flex items-center gap-4 border-b border-card-border pb-5 mb-5">
              <div className="relative group w-16 h-16 rounded-xl overflow-hidden border border-card-border bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
                {profileAvatarUrl ? (
                  <img src={profileAvatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-bold text-slate-400">{profileName.charAt(0).toUpperCase() || "?"}</span>
                )}
                <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-all text-[9px] font-bold text-white uppercase text-center p-1">
                  {uploadingAvatar ? "..." : "Upload"}
                  <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                </label>
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Profile Picture</p>
                <p className="text-[10px] text-muted-text mt-0.5">Upload a clean face shot (PNG/JPG).</p>
                {profileAvatarUrl && (
                   <button
                     type="button"
                     onClick={() => setProfileAvatarUrl("")}
                     className="text-[9px] font-bold text-rose-500 hover:underline mt-1 block"
                   >
                     Remove Image
                   </button>
                )}
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-muted-text uppercase mb-1.5">Full Name *</label>
                <input
                  type="text"
                  required
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-input-bg border border-card-border text-foreground font-semibold focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 transition-all"
                />
              </div>

              <div>
                <label className="block font-bold text-muted-text uppercase mb-1.5">Phone Number *</label>
                <input
                  type="text"
                  required
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-input-bg border border-card-border text-foreground font-mono font-semibold focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 transition-all"
                />
              </div>

              <div>
                <label className="block font-bold text-muted-text uppercase mb-1.5">Email Address (Read Only)</label>
                <input
                  type="text"
                  disabled
                  value={user?.email || ""}
                  className="w-full px-3 py-2.5 rounded-xl bg-input-bg border border-card-border text-muted-text font-semibold opacity-60 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block font-bold text-muted-text uppercase mb-1.5">Partner Agency (Read Only)</label>
                <input
                  type="text"
                  disabled
                  value={(user?.partner as any)?.name || "Unassigned Agency"}
                  className="w-full px-3 py-2.5 rounded-xl bg-input-bg border border-card-border text-muted-text font-semibold opacity-60 cursor-not-allowed"
                />
              </div>

              <div className="pt-4 border-t border-card-border space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-foreground">Update Password</h4>
                  <p className="text-[10px] text-muted-text mt-0.5">Leave blank if you do not wish to update your login password.</p>
                </div>

                <div>
                  <label className="block font-bold text-muted-text uppercase mb-1.5">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2.5 rounded-xl bg-input-bg border border-card-border text-foreground focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-muted-text uppercase mb-1.5">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2.5 rounded-xl bg-input-bg border border-card-border text-foreground focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="w-full py-3 bg-indigo-65 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-sm flex items-center justify-center active:scale-95 disabled:opacity-50"
              >
                {savingProfile ? "Saving Profile..." : "Save Settings"}
              </button>
            </form>
          </div>
        )}
      </main>

      {/* Ticket Details Drawer / Dialog */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-card border-t sm:border border-card-border w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-250">
            
            {/* Header */}
            <div className="p-5 border-b border-card-border flex justify-between items-center sticky top-0 bg-card z-10">
              <div>
                <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  {selectedTicket.ticketRefNo || `#${selectedTicket.id}`}
                </span>
                <h3 className="font-bold text-base text-foreground mt-0.5">{selectedTicket.clientSiteName}</h3>
              </div>
              <button
                onClick={() => {
                  setSelectedTicket(null);
                  setPhotoFiles([]);
                  setServiceReportFile(null);
                  setActionTakenNotes("");
                }}
                className="p-1.5 rounded-lg border border-card-border hover:bg-slate-100 dark:hover:bg-slate-800 text-muted-text hover:text-foreground transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
              <div>
                <h5 className="text-[10px] uppercase font-bold text-muted-text mb-1">Issue Description</h5>
                <p className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl text-foreground border border-card-border leading-relaxed">
                  {selectedTicket.issueDescription}
                </p>
              </div>

              {/* Resolution / Action Taken Info */}
              {(() => {
                const latestActionNotes = selectedTicket.resolutionDetails || (() => {
                  const followUpLogs = selectedTicket.activities?.filter(
                    (act) => act.type === "STATUS_CHANGE" && act.status === "FOLLOW_UP"
                  );
                  return followUpLogs && followUpLogs.length > 0 ? followUpLogs[0].notes : "";
                })();

                if (!latestActionNotes && !selectedTicket.serviceReportUrl) return null;

                return (
                  <div className="bg-emerald-500/5 dark:bg-emerald-950/10 p-4 rounded-xl border border-emerald-500/20 space-y-3">
                    <h5 className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider">Action Taken / Work Done Details</h5>
                    {latestActionNotes && (
                      <p className="text-xs text-foreground font-medium leading-relaxed whitespace-pre-wrap">
                        {latestActionNotes}
                      </p>
                    )}
                    
                    {selectedTicket.serviceReportUrl && (
                      <div className="pt-2 border-t border-emerald-500/10 flex items-center justify-between">
                        <span className="text-[10px] text-muted-text font-semibold uppercase">Signed Service Report</span>
                        <a
                          href={selectedTicket.serviceReportUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                        >
                          📄 View Report
                        </a>
                      </div>
                    )}

                    {selectedTicket.defectiveSerial && (
                      <div className="pt-2 border-t border-emerald-500/10 grid grid-cols-2 gap-2 text-[11px] font-semibold">
                        <div>
                          <span className="text-[9px] text-muted-text uppercase font-bold block">Defective Serial</span>
                          <span className="font-mono text-foreground">{selectedTicket.defectiveSerial}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-muted-text uppercase font-bold block">Return Status</span>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            selectedTicket.defectiveReturnStatus === "RETURNED"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : selectedTicket.defectiveReturnStatus === "PENDING"
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "bg-slate-500/10 text-slate-650 dark:text-slate-400"
                          }`}>
                            {selectedTicket.defectiveReturnStatus === "RETURNED" ? "✓ Returned" : selectedTicket.defectiveReturnStatus === "PENDING" ? "⏳ Pending" : selectedTicket.defectiveReturnStatus || "N/A"}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-4 border-t border-card-border pt-4">
                <div>
                  <h5 className="text-[10px] uppercase font-bold text-muted-text mb-1">SLA Target</h5>
                  <div className="flex items-center gap-1.5">
                    {selectedTicket.slaDeadline ? (
                      <>
                        <span className="font-semibold text-foreground">
                          {new Date(selectedTicket.slaDeadline).toLocaleString("en-MY", { day: "2-digit", month: "short" })}
                        </span>
                        <SlaCountdown
                          slaDeadline={selectedTicket.slaDeadline}
                          status={selectedTicket.status}
                          resolvedAt={selectedTicket.resolvedAt}
                          updatedAt={selectedTicket.updatedAt}
                          slaPaused={selectedTicket.slaPaused}
                          slaPausedAt={selectedTicket.slaPausedAt}
                        />
                      </>
                    ) : (
                      <span className="text-muted-text">None</span>
                    )}
                  </div>
                </div>
                <div>
                  <h5 className="text-[10px] uppercase font-bold text-muted-text mb-1">Current ETA</h5>
                  <span className="text-foreground font-semibold">
                    {selectedTicket.eta 
                      ? new Date(selectedTicket.eta).toLocaleString("en-MY", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) 
                      : "Not set"}
                  </span>
                </div>
              </div>

              {/* Client & End Customer Details */}
              <div className="grid grid-cols-2 gap-4 border-t border-card-border pt-4">
                <div>
                  <h5 className="text-[10px] uppercase font-bold text-muted-text mb-1">Client</h5>
                  <span className="text-foreground font-semibold">
                    {selectedTicket.maincon?.name || "N/A"}
                  </span>
                </div>
                <div>
                  <h5 className="text-[10px] uppercase font-bold text-muted-text mb-1">End Customer Group</h5>
                  <span className="text-foreground font-semibold">
                    {selectedTicket.endCustomer || "N/A"}
                  </span>
                </div>
              </div>

              {/* Custom Fields */}
              {(() => {
                const fields = selectedTicket.maincon?.customFieldsSchema
                  ? safeParseJson<string[]>(selectedTicket.maincon.customFieldsSchema, [])
                  : [];
                const values = selectedTicket.customValues
                  ? safeParseJson<Record<string, string>>(selectedTicket.customValues, {})
                  : {};

                if (fields.length === 0) return null;

                return (
                  <div className="border-t border-card-border pt-4">
                    <h5 className="text-[10px] uppercase font-bold text-muted-text mb-2">Custom Client Fields</h5>
                    <div className="grid grid-cols-2 gap-3 bg-slate-50/50 dark:bg-slate-900/10 p-3.5 rounded-xl border border-card-border">
                      {fields.map((fName) => (
                        <div key={fName}>
                          <p className="text-[10px] text-muted-text font-medium">{fName}</p>
                          <p className="text-xs font-bold text-foreground mt-0.5 font-mono">{values[fName] || "N/A"}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Device Catalog Details */}
              {selectedTicket.device && (
                <div className="border-t border-card-border pt-4">
                  <h5 className="text-[10px] uppercase font-bold text-muted-text mb-2">Device Information</h5>
                  <div className="grid grid-cols-2 gap-3 bg-slate-50/50 dark:bg-slate-900/10 p-3.5 rounded-xl border border-card-border">
                    <div>
                      <p className="text-[10px] text-muted-text">Device Model</p>
                      <p className="text-xs font-bold text-foreground mt-0.5">
                        {selectedTicket.device.brand} {selectedTicket.device.model}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-text">Standard Type</p>
                      <p className="text-xs font-bold text-foreground mt-0.5">
                        {selectedTicket.deviceStatus || "STANDARD"}
                      </p>
                    </div>
                    {selectedTicket.deviceStatus === "ON_REQUEST" && selectedTicket.customDeviceDetails && (
                      <div className="col-span-2">
                        <p className="text-[10px] text-muted-text">Custom Request Details</p>
                        <p className="text-xs font-semibold text-indigo-650 dark:text-indigo-400 mt-0.5">{selectedTicket.customDeviceDetails}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Chronology timeline activity log */}
              <div className="border-t border-card-border pt-4">
                <div
                  className="flex justify-between items-center cursor-pointer select-none group mb-3"
                  onClick={() => setIsChronologyExpanded(!isChronologyExpanded)}
                >
                  <h5 className="text-[10px] uppercase font-bold text-muted-text flex items-center gap-1.5">
                    <span>Chronology & Activity Logs</span>
                    <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1 py-0.2 rounded font-mono font-normal">
                      {selectedTicket.activities?.length || 0}
                    </span>
                  </h5>
                  <span className="text-[10px] font-bold text-indigo-65 text-indigo-600 dark:text-indigo-400 flex items-center gap-0.5 hover:text-indigo-500 transition-colors">
                    {isChronologyExpanded ? (
                      <>Hide <span className="text-[9px]">▲</span></>
                    ) : (
                      <>Unhide <span className="text-[9px]">▼</span></>
                    )}
                  </span>
                </div>

                {isChronologyExpanded && (
                  <div className="pt-1">
                    {!selectedTicket.activities || selectedTicket.activities.length === 0 ? (
                  <p className="text-xs text-muted-text italic">No activity logs recorded yet.</p>
                ) : (
                  <div className="relative border-l border-slate-200 dark:border-slate-800 ml-2 pl-4 space-y-4.5 pt-1">
                    {selectedTicket.activities.map((activity) => (
                      <div key={activity.id} className="relative text-[11px]">
                        <span className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 border-2 border-indigo-500 shadow-sm" />
                        <div>
                          <div className="flex justify-between items-center gap-2 flex-wrap">
                            <span className="font-bold text-foreground">
                              {activity.type === "STATUS_CHANGE" ? "Status Updated" : activity.type === "COMMENT" ? "Work Recorded" : activity.type === "ETA_UPDATE" ? "ETA Registered" : activity.type}
                            </span>
                            <span className="text-[9px] text-muted-text font-mono">
                              {new Date(activity.createdAt).toLocaleString("en-MY", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <span className="text-[9px] text-muted-text block mt-0.5">By {activity.author}</span>
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
                              <div className="mt-1.5 bg-slate-50 dark:bg-slate-900/30 p-2.5 rounded-xl border border-card-border space-y-2">
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
                                      className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
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
                    ))}
                  </div>
                )}
                  </div>
                )}
              </div>

              {/* Action Panels */}
              {isReassigning ? (
                <div className="space-y-4 pt-4 border-t border-card-border bg-indigo-500/5 dark:bg-indigo-950/20 p-5 rounded-2xl border border-indigo-500/10 animate-in fade-in duration-200">
                  <div>
                    <h4 className="font-bold text-indigo-650 dark:text-indigo-400 text-sm flex items-center gap-1.5">
                      <span>🔄 Reassign Ticket</span>
                    </h4>
                    <p className="text-[10px] text-muted-text mt-0.5 leading-relaxed">
                      Transfer this ticket to another engineer in your team or return it to the Agent pool.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-text">Reassign To *</label>
                    {loadingTeam ? (
                      <span className="text-[10px] text-muted-text block mt-1 animate-pulse">Loading team members...</span>
                    ) : (
                      <select
                        value={targetFeId}
                        onChange={(e) => setTargetFeId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-input-bg border border-card-border text-foreground text-xs focus:outline-none focus:border-indigo-500 font-semibold"
                      >
                        <option value="">Agent Pool (Return to Dispatcher)</option>
                        {teamMembers.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-text">Reassignment Notes / Reason *</label>
                    <textarea
                      rows={3}
                      required
                      value={reassignNotes}
                      onChange={(e) => setReassignNotes(e.target.value)}
                      placeholder="Explain why you are transferring this ticket..."
                      className="w-full px-3 py-2 rounded-xl bg-input-bg border border-card-border text-foreground placeholder-slate-400 text-xs focus:outline-none focus:border-indigo-500 font-semibold"
                    />
                  </div>

                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsReassigning(false);
                        setReassignNotes("");
                      }}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-foreground font-bold text-xs hover:bg-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isPending || !reassignNotes.trim()}
                      onClick={() => handleConfirmReassign(selectedTicket.id)}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs disabled:opacity-50"
                    >
                      {isPending ? "Reassigning..." : "Confirm Reassign"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {selectedTicket.status === "IN_PROGRESS" && (
                    <div className="space-y-5 pt-4 border-t border-card-border">
                      
                      {/* Action Taken notes field */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] text-muted-text uppercase font-bold tracking-wider">Action Taken / Work Done *</label>
                        <textarea
                          rows={3}
                          value={actionTakenNotes}
                          onChange={(e) => setActionTakenNotes(e.target.value)}
                          placeholder="Describe what work was done today..."
                          className="w-full px-3 py-2 rounded-xl bg-input-bg border border-card-border text-foreground placeholder-slate-400 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 transition-all font-semibold"
                        />
                      </div>

                      {/* Photo Attachments (Multiple, Optional) */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <label className="block text-[10px] text-muted-text uppercase font-bold tracking-wider">
                            Attach Photos (Multiple, Optional)
                          </label>
                          {photoFiles.length > 0 && (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                              📸 {photoFiles.length} photos selected
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="flex-1 px-3 py-2 rounded-xl border border-card-border flex items-center justify-center cursor-pointer transition-all hover:bg-slate-100 dark:hover:bg-slate-800 bg-input-bg text-muted-text text-xs gap-1.5 border-dashed">
                            <span>📎 Add Photo(s)</span>
                            <input
                              type="file"
                              multiple
                              accept="image/*"
                              onChange={(e) => {
                                const selected = e.target.files;
                                if (selected) {
                                  setPhotoFiles((prev) => [...prev, ...Array.from(selected)]);
                                }
                              }}
                              className="hidden"
                            />
                          </label>
                          
                          {/* Photo Thumbnails Preview */}
                          {photoFiles.length > 0 && (
                            <div className="grid grid-cols-4 gap-2 mt-1">
                              {photoFiles.map((photo, index) => (
                                <div key={index} className="relative w-full aspect-square rounded-lg overflow-hidden border border-card-border bg-slate-100 dark:bg-slate-800">
                                  <img
                                    src={URL.createObjectURL(photo)}
                                    alt={`Preview ${index + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setPhotoFiles((prev) => prev.filter((_, i) => i !== index))}
                                    className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center text-[9px] font-bold"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Service Report (Single, Required) */}
                      <div className="space-y-1.5 animate-in fade-in duration-200">
                          <div className="flex justify-between items-center">
                            <label className="block text-[10px] text-red-500 dark:text-red-400 uppercase font-bold tracking-wider">
                              Signed Service Report (PDF or Photo) *
                            </label>
                            {serviceReportFile && (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                📄 SR selected
                                <button
                                  type="button"
                                  onClick={() => setServiceReportFile(null)}
                                  className="text-red-500 hover:text-red-600 ml-1 font-bold"
                                >
                                  ✕
                                </button>
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col gap-2">
                            <label className={`flex-1 px-3 py-2 rounded-xl border border-card-border flex items-center justify-center cursor-pointer transition-all hover:bg-slate-100 dark:hover:bg-slate-800 bg-input-bg text-muted-text text-xs gap-1.5 ${serviceReportFile ? 'border-emerald-500/20 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5' : ''}`}>
                              <span>📎 {serviceReportFile ? serviceReportFile.name : "Select Service Report (PDF / Image)"}</span>
                              <input
                                type="file"
                                accept="image/*,application/pdf"
                                onChange={(e) => {
                                  const selected = e.target.files?.[0];
                                  if (selected) setServiceReportFile(selected);
                                }}
                                className="hidden"
                              />
                            </label>
                            
                            {/* Service Report Image Preview (if image) */}
                            {serviceReportFile && serviceReportFile.type.startsWith("image/") && (
                              <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-card-border bg-slate-100 dark:bg-slate-800 mt-1">
                                <img
                                  src={URL.createObjectURL(serviceReportFile)}
                                  alt="Service report preview"
                                  className="w-full h-full object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={() => setServiceReportFile(null)}
                                  className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center text-[9px] font-bold"
                                >
                                  ✕
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                      {/* Next Step Options */}
                      <div className="space-y-1.5">
                        <label className="block text-[9px] text-muted-text uppercase font-bold tracking-wider">Next Step / Ticket Status</label>
                        <div className="grid grid-cols-2 gap-1 bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl border border-card-border">
                          <button
                            type="button"
                            onClick={() => setActionType("followup")}
                            className={`py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-all ${
                              actionType === "followup"
                                ? "bg-card text-foreground shadow-sm"
                                : "text-muted-text hover:text-foreground"
                            }`}
                          >
                            ⏳ Needs Follow-Up
                          </button>
                          <button
                            type="button"
                            onClick={() => setActionType("resolve")}
                            className={`py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-all ${
                              actionType === "resolve"
                                ? "bg-card text-foreground shadow-sm"
                                : "text-muted-text hover:text-foreground"
                            }`}
                          >
                            ✅ Resolve & Close
                          </button>
                        </div>
                      </div>

                      {/* Option-specific fields */}
                      {actionType === "followup" && (
                        <div className="space-y-3 bg-fuchsia-500/5 p-4 rounded-2xl border border-fuchsia-500/10 animate-in fade-in duration-200">
                          <div className="space-y-1.5">
                            <label className="block text-[10px] text-muted-text uppercase font-semibold">Reason for Follow Up *</label>
                            <select
                              value={followUpSubStatus}
                              onChange={(e) => {
                                setFollowUpSubStatus(e.target.value);
                                if (e.target.value !== "PENDING_PARTS") {
                                  setPartName("");
                                  setPartModel("");
                                  setPartNumber("");
                                  setPartQty(1);
                                }
                              }}
                              className="w-full px-3 py-2 rounded-xl bg-input-bg border border-card-border text-foreground text-xs focus:outline-none focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500/25 cursor-pointer font-semibold"
                            >
                              <option value="">Select Reason</option>
                              <option value="PENDING_PARTS">Pending Parts / Loaner Device</option>
                              <option value="PENDING_SIGN_OFF">Pending Sign-off from Customer</option>
                              <option value="MONITORING">In Monitoring / Re-attend Required</option>
                              <option value="OTHER">Others</option>
                            </select>
                          </div>

                          {followUpSubStatus === "PENDING_PARTS" && (
                            <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-card-border space-y-3">
                              <p className="text-[10px] font-bold text-muted-text uppercase">Required Part Details</p>
                              
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <label className="block text-[9px] text-muted-text uppercase font-semibold">Part Name / Desc *</label>
                                  <input
                                    type="text"
                                    value={partName}
                                    onChange={(e) => setPartName(e.target.value)}
                                    placeholder="e.g. Network Router"
                                    className="w-full px-2.5 py-1.5 rounded-lg bg-input-bg border border-card-border text-foreground text-[11px] focus:outline-none focus:border-fuchsia-500 font-semibold"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="block text-[9px] text-muted-text uppercase font-semibold">Model</label>
                                  <input
                                    type="text"
                                    value={partModel}
                                    onChange={(e) => setPartModel(e.target.value)}
                                    placeholder="e.g. RG-EG105G"
                                    className="w-full px-2.5 py-1.5 rounded-lg bg-input-bg border border-card-border text-foreground text-[11px] focus:outline-none focus:border-fuchsia-500 font-semibold"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-3 gap-2">
                                <div className="col-span-2 space-y-1">
                                  <label className="block text-[9px] text-muted-text uppercase font-semibold">Part Number *</label>
                                  <input
                                    type="text"
                                    value={partNumber}
                                    onChange={(e) => setPartNumber(e.target.value)}
                                    placeholder="e.g. PN-901-22"
                                    className="w-full px-2.5 py-1.5 rounded-lg bg-input-bg border border-card-border text-foreground text-[11px] focus:outline-none focus:border-fuchsia-500 font-semibold"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="block text-[9px] text-muted-text uppercase font-semibold">Quantity</label>
                                  <input
                                    type="number"
                                    min={1}
                                    value={partQty}
                                    onChange={(e) => setPartQty(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-full px-2.5 py-1.5 rounded-lg bg-input-bg border border-card-border text-foreground text-[11px] focus:outline-none focus:border-fuchsia-500 font-semibold text-center"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {actionType === "resolve" && (
                        <div className="space-y-3 bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/10 animate-in fade-in duration-200">
                          {/* Defective Return Fields */}
                          <div className="space-y-3 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-card-border">
                            <div className="flex items-center justify-between">
                              <label className="block text-xs font-bold text-foreground">Defective Part Replacement?</label>
                              <input
                                type="checkbox"
                                checked={hasReplacedPart}
                                onChange={(e) => setHasReplacedPart(e.target.checked)}
                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-card-border bg-input-bg cursor-pointer"
                              />
                            </div>
                            
                            {hasReplacedPart && (
                              <div className="space-y-3 pt-2 border-t border-card-border animate-in fade-in slide-in-from-top-2 duration-150">
                                <div>
                                  <label className="block text-[10px] text-muted-text uppercase font-bold mb-1">Defective Part Serial Number *</label>
                                  <input
                                    type="text"
                                    required
                                    value={defectiveSerial}
                                    onChange={(e) => setDefectiveSerial(e.target.value)}
                                    placeholder="e.g. SN-882711A-DEF"
                                    className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground text-xs focus:outline-none font-semibold"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] text-muted-text uppercase font-bold mb-1">Return Status *</label>
                                  <select
                                    value={defectiveReturnStatus}
                                    onChange={(e) => setDefectiveReturnStatus(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl bg-input-bg border border-card-border text-foreground text-xs focus:outline-none focus:border-indigo-500 font-semibold"
                                  >
                                    <option value="PENDING">⏳ Pending (Bring back to office)</option>
                                    <option value="RETURNED">✓ Returned (Handed over to customer / office)</option>
                                    <option value="CUSTOMER_RETAINED">📦 Retained by Customer</option>
                                  </select>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Consolidated submit button */}
                      <button
                        onClick={() => handleSubmitAction(selectedTicket.id)}
                        disabled={uploading || isPending}
                        className={`w-full py-3 px-4 rounded-xl font-bold transition-all shadow-sm flex justify-center items-center text-xs disabled:opacity-50 active:scale-[0.98] ${
                          actionType === "resolve"
                            ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950"
                            : "bg-fuchsia-600 hover:bg-fuchsia-500 text-white"
                        }`}
                      >
                        {uploading ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            {actionType === "resolve" ? "Uploading Report & Resolving..." : "Uploading & Submitting..."}
                          </>
                        ) : (
                          actionType === "resolve"
                            ? "✓ Resolve & Close Ticket"
                            : "⏳ Submit Follow-Up Request"
                        )}
                      </button>

                    </div>
                  )}

                  {selectedTicket.status === "FOLLOW_UP" && (
                    <div className="space-y-5 pt-4 border-t border-card-border">
                      {/* Resume Panel */}
                      <div className="space-y-3 bg-emerald-500/5 p-5 rounded-2xl border border-emerald-500/10">
                        <h5 className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Resume Job / Re-attend</h5>
                        <p className="text-[10px] text-muted-text mt-0.5 font-medium leading-relaxed">Resume this ticket to In Progress once you are ready to re-attend or parts are delivered.</p>
                        
                        <div className="space-y-1.5">
                          <label className="block text-[10px] text-muted-text uppercase font-semibold">New ETA (Optional)</label>
                          <input
                            type="datetime-local"
                            value={resumeEtaVal}
                            onChange={(e) => setResumeEtaVal(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-input-bg border border-card-border text-foreground text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/25 font-semibold"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-[10px] text-muted-text uppercase font-semibold">Resumption / Re-attendance Notes</label>
                          <textarea
                            rows={2}
                            value={resumeNotes}
                            onChange={(e) => setResumeNotes(e.target.value)}
                            placeholder="e.g. Back on site with parts, resuming work..."
                            className="w-full px-3 py-2 rounded-xl bg-input-bg border border-card-border text-foreground placeholder-slate-400 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/25 font-semibold"
                          />
                        </div>

                        <button
                          onClick={() => handleResume(selectedTicket.id)}
                          disabled={isPending}
                          className="w-full mt-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors shadow-sm flex justify-center items-center text-xs disabled:opacity-50"
                        >
                          ⚡ Resume Job & Mark In Progress
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer buttons */}
            <div className="p-4 border-t border-card-border bg-card/60 flex gap-2 justify-between w-full">
              {/* Reassign Ticket Trigger Button */}
              {!isReassigning && (selectedTicket.status !== "RESOLVED" && selectedTicket.status !== "COMPLETE" && selectedTicket.status !== "CLOSED") && (
                <button
                  onClick={() => {
                    setIsReassigning(true);
                    loadTeam();
                  }}
                  className="px-4 py-2.5 bg-indigo-50/50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/30 dark:text-indigo-400 font-bold rounded-xl text-xs transition-colors border border-indigo-100 dark:border-indigo-950"
                >
                  🔄 Reassign Ticket
                </button>
              )}
              <button
                onClick={() => {
                  setSelectedTicket(null);
                  setPhotoFiles([]);
                  setServiceReportFile(null);
                  setActionTakenNotes("");
                  setIsReassigning(false);
                  setReassignNotes("");
                }}
                className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-foreground font-semibold rounded-xl text-xs transition-colors ml-auto"
              >
                Close View
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
