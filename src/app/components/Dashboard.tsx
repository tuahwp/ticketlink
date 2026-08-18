"use client";

import React, { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import SlaCountdown from "./SlaCountdown";
import { useAuth } from "./AuthProvider";
import FEDashboard from "./FEDashboard";
import UserManagementTab from "./UserManagementTab";
import PartnerTeamTab from "./PartnerTeamTab";
import { supabase } from "../../lib/supabaseClient";
import {
  getTickets,
  getTicketById,
  createTicket,
  getMaincons,
  getServicePartners,
  getDevices,
  createMaincon,
  createServicePartner,
  createFieldEngineer,
  createDeviceCatalogItem,
  deleteDeviceCatalogItem,
  updateMaincon,
  deleteMaincon,
  updateServicePartner,
  deleteServicePartner,
  updateFieldEngineer,
  deleteFieldEngineer,
  updateTicket,
  deleteTicket,
  createCustomerSla,
  updateCustomerSla,
  deleteCustomerSla,
  getCustomerSlas,
  updateUserProfile,
  updateServicePartnerProfile,
} from "../actions";

export interface State {
  id: number;
  name: string;
}

export interface Maincon {
  id: number;
  name: string;
  sheetName: string;
  customFieldsSchema: unknown;
  siteCustomers?: unknown;
}

export interface FieldEngineer {
  id: number;
  name: string;
  phone: string;
  partnerId: number;
  country?: string | null;
  region?: string | null;
  email?: string | null;
  user?: {
    avatarUrl?: string | null;
  } | null;
}

export interface ServicePartner {
  id: number;
  name: string;
  statesCovered: unknown;
  engineers?: FieldEngineer[];
  address?: string | null;
  phone?: string | null;
  companyPhotoUrl?: string | null;
}

export interface DeviceCatalog {
  id: number;
  category: string;
  brand: string;
  model: string;
  isStandard: boolean;
  restrictedTo?: string | null;
}

export interface Ticket {
  id: number;
  ticketRefNo: string | null;
  clientSiteName: string;
  state: string;
  issueDescription: string;
  status: "NEW" | "IN_PROGRESS" | "ON_HOLD" | "RESOLVED" | "FOLLOW_UP" | "COMPLETE" | "CLOSED";
  subStatus: string | null;
  slaDeadline: Date | string | null;
  mainconId: number;
  maincon?: Maincon;
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
  resolutionDetails: string | null;
  resolvedAt: Date | string | null;
  endCustomer?: string | null;
  reportedAt?: Date | string | null;
  severity?: string | null;
  eta?: Date | string | null;
  slaPaused?: boolean;
  slaPausedAt?: Date | string | null;
  feAcknowledgeStatus?: string | null;
  feAcknowledgedAt?: Date | string | null;
  holdReason?: string | null;
  defectiveSerial?: string | null;
  defectiveReturnStatus?: string | null;
  serviceReportUrl?: string | null;
}

export interface CustomerSla {
  id: number;
  customer: string;
  severity: "P1" | "P2" | "P3" | "P4";
  region: string;
  slaHours: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface DashboardProps {
  initialTickets: Ticket[];
  initialMaincons: Maincon[];
  initialPartners: ServicePartner[];
  initialDevices: DeviceCatalog[];
  initialStates: State[];
  initialSlas: CustomerSla[];
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

export default function Dashboard({
  initialTickets,
  initialMaincons,
  initialPartners,
  initialDevices,
  initialStates,
  initialSlas,
}: DashboardProps) {
  const { user, signOut, refreshProfile } = useAuth();
  const router = useRouter();

  if (user?.role === "FIELD_ENGINEER") {
    return <FEDashboard />;
  }

  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [maincons, setMaincons] = useState<Maincon[]>(initialMaincons);
  const [partners, setPartners] = useState<ServicePartner[]>(initialPartners);
  const [devices, setDevices] = useState<DeviceCatalog[]>(initialDevices);
  const [states] = useState<State[]>(initialStates);
  const [slas, setSlas] = useState<CustomerSla[]>(initialSlas);

  // Sync props to state when Next.js updates Server Component data
  useEffect(() => {
    setTickets(initialTickets);
  }, [initialTickets]);

  // Real-time PostgreSQL subscription to sync updates back to listing for Admins, Agents, and Moderators
  useEffect(() => {
    const channel = supabase
      .channel("admin-dashboard-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "Ticket",
        },
        async () => {
          try {
            const freshTickets = await getTickets();
            setTickets(freshTickets);
          } catch (err) {
            console.error("Failed to fetch fresh tickets:", err);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    setMaincons(initialMaincons);
  }, [initialMaincons]);

  useEffect(() => {
    setPartners(initialPartners);
  }, [initialPartners]);

  useEffect(() => {
    setDevices(initialDevices);
  }, [initialDevices]);

  useEffect(() => {
    setSlas(initialSlas);
  }, [initialSlas]);

  // Refresh server component cache on mount to ensure fresh data
  useEffect(() => {
    router.refresh();
  }, [router]);

  // Polling fallback to keep dashboard fresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 30000);
    return () => clearInterval(interval);
  }, [router]);

  // Realtime subscription
  useEffect(() => {
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!anonKey) {
      console.log("Supabase anon key is missing. Skipping real-time ticket subscription.");
      return;
    }

    const channel = supabase
      .channel("realtime-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "Ticket" },
        async (payload) => {
          console.log("Realtime DB event received on Ticket table:", payload);
          if (payload.eventType === "INSERT") {
            const ticketId = Number((payload.new as Ticket).id);
            const fullTicket = await getTicketById(ticketId);
            if (fullTicket) {
              setTickets((prev) => {
                if (prev.some((t) => t.id === fullTicket.id)) return prev;
                return [fullTicket as unknown as Ticket, ...prev];
              });
            }
          } else if (payload.eventType === "UPDATE") {
            const ticketId = Number((payload.new as Ticket).id);
            const fullTicket = await getTicketById(ticketId);
            if (fullTicket) {
              setTickets((prev) =>
                prev.map((t) => (t.id === fullTicket.id ? (fullTicket as unknown as Ticket) : t))
              );
            }
          } else if (payload.eventType === "DELETE") {
            const oldTicket = payload.old as { id: number };
            const ticketId = Number(oldTicket.id);
            setTickets((prev) => prev.filter((t) => t.id !== ticketId));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "Maincon" },
        async () => {
          console.log("Realtime DB event received on Maincon table");
          const fresh = await getMaincons();
          setMaincons(fresh as unknown as Maincon[]);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ServicePartner" },
        async () => {
          console.log("Realtime DB event received on ServicePartner table");
          const fresh = await getServicePartners();
          setPartners(fresh as unknown as ServicePartner[]);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "DeviceCatalog" },
        async () => {
          console.log("Realtime DB event received on DeviceCatalog table");
          const fresh = await getDevices();
          setDevices(fresh as unknown as DeviceCatalog[]);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "CustomerSla" },
        async () => {
          console.log("Realtime DB event received on CustomerSla table");
          const fresh = await getCustomerSlas();
          setSlas(fresh as unknown as CustomerSla[]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const [isPending, startTransition] = useTransition();

  // Tab state: 'tickets' | 'maincons' | 'partners' | 'devices' | 'slas' | 'users' | 'team' | 'profile' | 'agency-profile'
  const [activeTab, setActiveTab] = useState<"tickets" | "maincons" | "partners" | "devices" | "slas" | "users" | "team" | "profile" | "agency-profile">("tickets");

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [mainconFilter, setMainconFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [isSlaModalOpen, setIsSlaModalOpen] = useState(false);
  const [editingSlaId, setEditingSlaId] = useState<number | null>(null);
  const [newSla, setNewSla] = useState({
    customer: "DEFAULT",
    severity: "P1" as "P1" | "P2" | "P3" | "P4",
    region: "Semenanjung" as "Semenanjung" | "Sabah/Sarawak",
    slaHours: 24,
  });

  // Modal open states
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [isMainconModalOpen, setIsMainconModalOpen] = useState(false);
  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);
  const [isFeModalOpen, setIsFeModalOpen] = useState(false);
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  // Editing state for Maincon
  const [editingMainconId, setEditingMainconId] = useState<number | null>(null);
  // Editing state for Service Partner and Field Engineer
  const [editingPartnerId, setEditingPartnerId] = useState<number | null>(null);
  const [editingFeId, setEditingFeId] = useState<number | null>(null);

  // Profile settings states
  const [profileName, setProfileName] = useState(user?.name || "");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState(user?.avatarUrl || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Close user dropdown menu when clicking anywhere else
  useEffect(() => {
    if (!showUserMenu) return;
    const handleClose = () => setShowUserMenu(false);
    window.addEventListener("click", handleClose);
    return () => window.removeEventListener("click", handleClose);
  }, [showUserMenu]);

  // Partner Profile settings states (for AGENT / SUPERADMIN edit)
  const [partnerName, setPartnerName] = useState("");
  const [partnerPhone, setPartnerPhone] = useState("");
  const [partnerAddress, setPartnerAddress] = useState("");
  const [partnerLogoUrl, setPartnerLogoUrl] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileName(user.name || "");
      setProfileAvatarUrl(user.avatarUrl || "");
      if (user.partner) {
        setPartnerName(user.partner.name || "");
        setPartnerPhone(user.partner.phone || "");
        setPartnerAddress(user.partner.address || "");
        setPartnerLogoUrl(user.partner.companyPhotoUrl || "");
      }
    }
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    if (!profileName.trim()) {
      setProfileError("Full Name is required.");
      return;
    }

    setSavingProfile(true);

    try {
      if (!user?.id) throw new Error("Not logged in");

      // 1. Update user profile
      await updateUserProfile(user.id, {
        name: profileName,
        avatarUrl: profileAvatarUrl || null,
      });

      // 2. Update password if entered
      if (newPassword) {
        if (newPassword !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }
        if (newPassword.length < 6) {
          throw new Error("Password must be at least 6 characters.");
        }
        const { error: pwdError } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (pwdError) throw pwdError;
        setNewPassword("");
        setConfirmPassword("");
      }

      // 3. Update Service Partner profile if AGENT and has partner
      if (user.role === "AGENT" && user.partnerId) {
        if (!partnerName.trim()) {
          throw new Error("Company Name is required.");
        }
        await updateServicePartnerProfile(user.partnerId, {
          name: partnerName,
          phone: partnerPhone || null,
          address: partnerAddress || null,
          companyPhotoUrl: partnerLogoUrl || null,
        });
      }

      await refreshProfile();
      setProfileSuccess("Settings saved successfully!");
      router.refresh();
    } catch (err: any) {
      setProfileError(err.message || "Failed to save settings.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveAgencyProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);
    setSavingProfile(true);

    try {
      if (!user?.partnerId) throw new Error("No agency associated with this account.");

      await updateServicePartnerProfile(user.partnerId, {
        name: partnerName,
        phone: partnerPhone || null,
        address: partnerAddress || null,
        companyPhotoUrl: partnerLogoUrl || null,
      });

      await refreshProfile();
      setProfileSuccess("Agency profile updated successfully!");
      router.refresh();
    } catch (err: any) {
      setProfileError(err.message || "Failed to update agency profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    setProfileError(null);
    setProfileSuccess(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

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
      setProfileSuccess("Profile picture uploaded! Save profile changes to persist.");
    } catch (err: any) {
      setProfileError(err.message || "Failed to upload avatar.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    setProfileError(null);
    setProfileSuccess(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Upload failed");
      }

      const data = await res.json();
      setPartnerLogoUrl(data.url);
      setProfileSuccess("Company photo uploaded! Save profile changes to persist.");
    } catch (err: any) {
      setProfileError(err.message || "Failed to upload company logo.");
    } finally {
      setUploadingLogo(false);
    }
  };

  // Form States - Create/Edit Ticket
  const [newTicket, setNewTicket] = useState({
    ticketRefNo: "",
    clientSiteName: "",
    state: "",
    issueDescription: "",
    mainconId: "",
    customValues: {} as Record<string, string>,
    partnerId: "",
    assignedFeId: "",
    deviceId: "",
    deviceStatus: "STANDARD" as "STANDARD" | "ON_REQUEST",
    customDeviceDetails: "",
    slaDeadline: "",
    status: "NEW" as "NEW" | "IN_PROGRESS" | "RESOLVED" | "FOLLOW_UP" | "COMPLETE" | "CLOSED",
    subStatus: "",
    autoRefNo: true,
    endCustomer: "",
    useReportedDateOverride: false,
    reportedAt: "",
  });

  // Editing state for Ticket
  const [editingTicketId, setEditingTicketId] = useState<number | null>(null);

  // Form States - Create Maincon
  const [newMaincon, setNewMaincon] = useState({
    name: "",
    sheetName: "",
    customFields: [""] as string[],
    siteCustomersInput: "",
  });

  // Form States - Create Partner
  const [newPartner, setNewPartner] = useState({
    name: "",
    statesCovered: [] as string[],
  });

  // Form States - Create Field Engineer
  const [newFe, setNewFe] = useState({
    name: "",
    phone: "",
    partnerId: "",
    country: "",
    region: "",
    email: "",
  });

  // Form States - Create Device Catalog Item
  const [newDevice, setNewDevice] = useState({
    category: "Desktop",
    brand: "",
    model: "",
    isStandard: true,
    restrictedTo: "",
  });

  // Get list of unique site/end customers from Maincons config
  const allSiteCustomers = Array.from(
    new Set(
      maincons
        .flatMap((m) => safeParseJson<string[]>(m.siteCustomers, []))
        .filter(Boolean)
    )
  );

  // Helper function to refresh the dashboard list
  const refreshData = async () => {
    const freshTickets = await getTickets();
    setTickets(freshTickets);
  };

  // Filter Service Partners based on the selected state in the ticket creation form
  const filteredPartnersForNewTicket = partners.filter((partner) => {
    if (!newTicket.state) return false;
    const coveredStates = safeParseJson<string[]>(partner.statesCovered, []);
    return coveredStates.includes(newTicket.state);
  });

  // Filter Field Engineers based on the selected partner in the ticket creation form
  const selectedPartnerObj = partners.find((p) => p.id === Number(newTicket.partnerId));
  const filteredEngineersForNewTicket = selectedPartnerObj?.engineers || [];

  // Submit Handlers
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicket.clientSiteName || !newTicket.state || !newTicket.mainconId) {
      alert("Please fill in all core fields (Site Name, State, Maincon)");
      return;
    }

    startTransition(async () => {
      try {
        const slaDate = newTicket.slaDeadline ? new Date(newTicket.slaDeadline) : undefined;
        const reportedDate = newTicket.useReportedDateOverride && newTicket.reportedAt 
          ? new Date(newTicket.reportedAt) 
          : undefined;

        if (editingTicketId !== null) {
          // Update existing Ticket
          await updateTicket(editingTicketId, {
            ticketRefNo: newTicket.autoRefNo ? "" : newTicket.ticketRefNo || null,
            clientSiteName: newTicket.clientSiteName,
            state: newTicket.state,
            issueDescription: newTicket.issueDescription,
            mainconId: Number(newTicket.mainconId),
            customValues: newTicket.customValues,
            partnerId: newTicket.partnerId ? Number(newTicket.partnerId) : null,
            assignedFeId: newTicket.assignedFeId ? Number(newTicket.assignedFeId) : null,
            deviceId: newTicket.deviceId ? Number(newTicket.deviceId) : null,
            deviceStatus: newTicket.deviceStatus || null,
            customDeviceDetails: newTicket.customDeviceDetails || null,
            status: newTicket.status,
            subStatus: newTicket.status === "FOLLOW_UP" ? newTicket.subStatus || null : null,
            slaDeadline: slaDate || null,
            endCustomer: newTicket.endCustomer || null,
            reportedAt: reportedDate || null,
          });
          setEditingTicketId(null);
        } else {
          // Create new Ticket
          await createTicket({
            ticketRefNo: newTicket.autoRefNo ? undefined : newTicket.ticketRefNo,
            clientSiteName: newTicket.clientSiteName,
            state: newTicket.state,
            issueDescription: newTicket.issueDescription,
            mainconId: Number(newTicket.mainconId),
            customValues: newTicket.customValues,
            partnerId: newTicket.partnerId ? Number(newTicket.partnerId) : undefined,
            assignedFeId: newTicket.assignedFeId ? Number(newTicket.assignedFeId) : undefined,
            deviceId: newTicket.deviceId ? Number(newTicket.deviceId) : undefined,
            deviceStatus: newTicket.deviceStatus,
            customDeviceDetails: newTicket.customDeviceDetails,
            slaDeadline: slaDate,
            endCustomer: newTicket.endCustomer || undefined,
            reportedAt: reportedDate,
          });
        }

        // Reset state
        setNewTicket({
          ticketRefNo: "",
          clientSiteName: "",
          state: "",
          issueDescription: "",
          mainconId: "",
          customValues: {},
          partnerId: "",
          assignedFeId: "",
          deviceId: "",
          deviceStatus: "STANDARD",
          customDeviceDetails: "",
          slaDeadline: "",
          status: "NEW",
          subStatus: "",
          autoRefNo: true,
          endCustomer: "",
          useReportedDateOverride: false,
          reportedAt: "",
        });

        setIsTicketModalOpen(false);
        await refreshData();
      } catch (err) {
        alert(
          (editingTicketId !== null ? "Error updating" : "Error creating") +
            " ticket: " +
            (err instanceof Error ? err.message : String(err))
        );
      }
    });
  };

  const handleCreateMainconSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMaincon.name || !newMaincon.sheetName) return;
    const fields = newMaincon.customFields.filter((f) => f.trim() !== "");
    const parsedCustomers = newMaincon.siteCustomersInput
      ? newMaincon.siteCustomersInput.split(",").map((s) => s.trim()).filter((s) => s !== "")
      : [];

    startTransition(async () => {
      try {
        if (editingMainconId !== null) {
          // Update existing Maincon
          const updated = await updateMaincon(editingMainconId, {
            name: newMaincon.name,
            sheetName: newMaincon.sheetName,
            customFieldsSchema: fields,
            siteCustomers: parsedCustomers,
          });
          const mappedUpdated: Maincon = {
            id: updated.id,
            name: updated.name,
            sheetName: updated.sheetName,
            customFieldsSchema: updated.customFieldsSchema,
            siteCustomers: updated.siteCustomers,
          };
          setMaincons((prev) =>
            prev.map((m) => (m.id === editingMainconId ? mappedUpdated : m)).sort((a, b) => a.name.localeCompare(b.name))
          );
          setEditingMainconId(null);
        } else {
          // Create new Maincon
          const created = await createMaincon({
            name: newMaincon.name,
            sheetName: newMaincon.sheetName,
            customFieldsSchema: fields,
            siteCustomers: parsedCustomers,
          });
          const mappedCreated: Maincon = {
            id: created.id,
            name: created.name,
            sheetName: created.sheetName,
            customFieldsSchema: created.customFieldsSchema,
            siteCustomers: created.siteCustomers,
          };
          setMaincons((prev) => [...prev, mappedCreated].sort((a, b) => a.name.localeCompare(b.name)));
        }
        setNewMaincon({ name: "", sheetName: "", customFields: [""], siteCustomersInput: "" });
        setIsMainconModalOpen(false);
      } catch (err) {
        alert((editingMainconId !== null ? "Error updating" : "Error creating") + " Maincon: " + (err instanceof Error ? err.message : String(err)));
      }
    });
  };

  const handleCreatePartnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartner.name || newPartner.statesCovered.length === 0) {
      alert("Please enter partner name and cover at least 1 state.");
      return;
    }

    startTransition(async () => {
      try {
        if (editingPartnerId !== null) {
          // Update existing partner
          const updated = await updateServicePartner(editingPartnerId, {
            name: newPartner.name,
            statesCovered: newPartner.statesCovered,
          });
          const mappedUpdated: ServicePartner = {
            id: updated.id,
            name: updated.name,
            statesCovered: updated.statesCovered,
            engineers: partners.find((p) => p.id === editingPartnerId)?.engineers || [],
          };
          setPartners((prev) =>
            prev.map((p) => (p.id === editingPartnerId ? mappedUpdated : p)).sort((a, b) => a.name.localeCompare(b.name))
          );
          setEditingPartnerId(null);
        } else {
          // Create new partner
          const created = await createServicePartner({
            name: newPartner.name,
            statesCovered: newPartner.statesCovered,
          });
          const mappedCreated: ServicePartner = {
            id: created.id,
            name: created.name,
            statesCovered: created.statesCovered,
            engineers: [],
          };
          setPartners((prev) => [...prev, mappedCreated].sort((a, b) => a.name.localeCompare(b.name)));
        }
        setNewPartner({ name: "", statesCovered: [] });
        setIsPartnerModalOpen(false);
      } catch (err) {
        alert(
          (editingPartnerId !== null ? "Error updating" : "Error creating") +
            " partner: " +
            (err instanceof Error ? err.message : String(err))
        );
      }
    });
  };

  const handleCreateFeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFe.name || !newFe.phone || !newFe.partnerId) return;

    startTransition(async () => {
      try {
        if (editingFeId !== null) {
          // Find old FE to know which partner they used to belong to (in case employer partner changed)
          let oldPartnerId: number | null = null;
          for (const p of partners) {
            if (p.engineers?.some((eng) => eng.id === editingFeId)) {
              oldPartnerId = p.id;
              break;
            }
          }

          // Update existing Field Engineer
          const updated = await updateFieldEngineer(editingFeId, {
            name: newFe.name,
            phone: newFe.phone,
            partnerId: Number(newFe.partnerId),
            country: newFe.country || null,
            region: newFe.region || null,
            email: newFe.email || null,
          });

          const mappedUpdated: FieldEngineer = {
            id: updated.id,
            name: updated.name,
            phone: updated.phone,
            partnerId: updated.partnerId,
            country: updated.country,
            region: updated.region,
            email: updated.email,
          };

          setPartners((prev) =>
            prev.map((partner) => {
              let newEngineers = partner.engineers || [];
              // Remove FE from old partner if partner changed
              if (partner.id === oldPartnerId && oldPartnerId !== Number(newFe.partnerId)) {
                newEngineers = newEngineers.filter((eng) => eng.id !== editingFeId);
              }
              // Add/Update FE in target partner
              if (partner.id === Number(newFe.partnerId)) {
                const alreadyExists = newEngineers.some((eng) => eng.id === editingFeId);
                if (alreadyExists) {
                  newEngineers = newEngineers.map((eng) => (eng.id === editingFeId ? mappedUpdated : eng));
                } else {
                  newEngineers = [...newEngineers, mappedUpdated];
                }
              }
              return {
                ...partner,
                engineers: [...newEngineers].sort((a, b) => a.name.localeCompare(b.name)),
              };
            })
          );
          setEditingFeId(null);
        } else {
          // Create new Field Engineer
          const created = await createFieldEngineer({
            name: newFe.name,
            phone: newFe.phone,
            partnerId: Number(newFe.partnerId),
            country: newFe.country || null,
            region: newFe.region || null,
            email: newFe.email || null,
          });

          const mappedCreated: FieldEngineer = {
            id: created.id,
            name: created.name,
            phone: created.phone,
            partnerId: created.partnerId,
            country: created.country,
            region: created.region,
            email: created.email,
          };

          // Update partners list to include new engineer
          setPartners((prev) =>
            prev.map((partner) => {
              if (partner.id === Number(newFe.partnerId)) {
                return {
                  ...partner,
                  engineers: [...(partner.engineers || []), mappedCreated].sort((a, b) => a.name.localeCompare(b.name)),
                };
              }
              return partner;
            })
          );
        }

        setNewFe({ name: "", phone: "", partnerId: "", country: "", region: "", email: "" });
        setIsFeModalOpen(false);
      } catch (err) {
        alert(
          (editingFeId !== null ? "Error updating" : "Error registering") +
            " Field Engineer: " +
            (err instanceof Error ? err.message : String(err))
        );
      }
    });
  };

  const handleCopyFeInvite = (engName: string, engEmail: string | null | undefined) => {
    if (!engEmail) {
      alert("Please configure an email address for this engineer first.");
      return;
    }
    const origin = window.location.origin;
    const inviteUrl = `${origin}/login?email=${encodeURIComponent(engEmail)}&name=${encodeURIComponent(engName)}&role=FIELD_ENGINEER&mode=signup`;
    
    navigator.clipboard.writeText(inviteUrl)
      .then(() => {
        alert(`Invitation link copied for ${engName}! Send it to them to complete registration.`);
      })
      .catch((err) => {
        console.error("Clipboard copy failed:", err);
        alert(`Direct link: ${inviteUrl}`);
      });
  };

  const handleCreateDeviceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDevice.brand || !newDevice.model) return;

    startTransition(async () => {
      try {
        const created = await createDeviceCatalogItem({
          category: newDevice.category,
          brand: newDevice.brand,
          model: newDevice.model,
          isStandard: newDevice.isStandard,
          restrictedTo: newDevice.restrictedTo || undefined,
        });
        const mappedCreated: DeviceCatalog = {
          id: created.id,
          category: created.category,
          brand: created.brand,
          model: created.model,
          isStandard: created.isStandard,
          restrictedTo: created.restrictedTo,
        };
        setDevices((prev) => [...prev, mappedCreated].sort((a, b) => {
          if (a.isStandard !== b.isStandard) return b.isStandard ? 1 : -1;
          return a.brand.localeCompare(b.brand);
        }));
        setNewDevice({ category: "Desktop", brand: "", model: "", isStandard: true, restrictedTo: "" });
        setIsDeviceModalOpen(false);
      } catch (err) {
        alert("Error creating device: " + (err instanceof Error ? err.message : String(err)));
      }
    });
  };

  const handleCreateSlaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSla.customer || !newSla.severity || !newSla.region || !newSla.slaHours) {
      alert("Please fill in all fields");
      return;
    }
    startTransition(async () => {
      try {
        if (editingSlaId !== null) {
          await updateCustomerSla(editingSlaId, {
            customer: newSla.customer,
            severity: newSla.severity,
            region: newSla.region,
            slaHours: Number(newSla.slaHours),
          });
          setEditingSlaId(null);
        } else {
          await createCustomerSla({
            customer: newSla.customer,
            severity: newSla.severity,
            region: newSla.region,
            slaHours: Number(newSla.slaHours),
          });
        }
        // Refresh local states
        const freshSlas = await getCustomerSlas();
        setSlas(freshSlas);

        // Reset
        setIsSlaModalOpen(false);
        setNewSla({
          customer: "DEFAULT",
          severity: "P1",
          region: "Semenanjung",
          slaHours: 24,
        });
      } catch (err) {
        alert("Error saving SLA rule: " + (err instanceof Error ? err.message : String(err)));
      }
    });
  };

  const handleDeleteSla = async (id: number) => {
    if (!confirm("Are you sure you want to delete this SLA configuration?")) return;
    startTransition(async () => {
      try {
        await deleteCustomerSla(id);
        const freshSlas = await getCustomerSlas();
        setSlas(freshSlas);
      } catch (err) {
        alert("Error deleting SLA configuration: " + (err instanceof Error ? err.message : String(err)));
      }
    });
  };

  function renderSeverityBadge(severity: string | null | undefined) {
    if (!severity) return null;
    const config: Record<string, { label: string; badge: string; dot: string }> = {
      P1: { label: "P1", badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20", dot: "bg-rose-500" },
      P2: { label: "P2", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20", dot: "bg-amber-500" },
      P3: { label: "P3", badge: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20", dot: "bg-indigo-500" },
      P4: { label: "P4", badge: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20", dot: "bg-slate-500" },
    };
    const sc = config[severity] || { label: severity, badge: "bg-slate-100 text-slate-700", dot: "bg-slate-400" };
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${sc.badge}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
        {sc.label}
      </span>
    );
  }

  // Filter tickets for dashboard
  const filteredTickets = tickets.filter((t) => {
    const matchSearch =
      t.clientSiteName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.ticketRefNo && t.ticketRefNo.toLowerCase().includes(searchQuery.toLowerCase())) ||
      t.issueDescription.toLowerCase().includes(searchQuery.toLowerCase());

    const matchStatus = statusFilter ? t.status === statusFilter : true;
    const matchState = stateFilter ? t.state === stateFilter : true;
    const matchMaincon = mainconFilter ? t.mainconId === Number(mainconFilter) : true;
    const matchSeverity = severityFilter ? t.severity === severityFilter : true;
    const matchAgent = user?.role === "AGENT" ? t.partnerId === user.partnerId : true;

    return matchSearch && matchStatus && matchState && matchMaincon && matchSeverity && matchAgent;
  });

  // Count summaries (Agent only sees their own partner's tickets)
  const visibleTickets = user?.role === "AGENT" ? tickets.filter((t) => t.partnerId === user.partnerId) : tickets;
  const totalCount = visibleTickets.length;
  const activeCount = visibleTickets.filter((t) => t.status === "NEW" || t.status === "IN_PROGRESS" || t.status === "FOLLOW_UP").length;
  const resolvedCount = visibleTickets.filter((t) => t.status === "RESOLVED" || t.status === "COMPLETE" || t.status === "CLOSED").length;
  const partnerCount = user?.role === "AGENT" 
    ? (partners.find((p) => p.id === user.partnerId)?.engineers?.length || 0) 
    : partners.length;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans antialiased">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-indigo-500/5 dark:from-indigo-900/10 via-background to-transparent pointer-events-none" />

      {/* Header */}
      <header className="relative border-b border-card-border bg-background/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-blue-100 shadow-sm flex-shrink-0">
              <img src="/logo.jpg" alt="TicketLink Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-slate-950 via-slate-800 to-slate-600 dark:from-white dark:via-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
                Ticket<span className="text-teal-500">Link</span>
              </h1>
              <p className="text-xs text-teal-500 font-medium">Service Delivery &amp; Dispatch Hub</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {(user?.role === "SUPERADMIN" || user?.role === "MODERATOR") && (
              <button
                onClick={() => router.push("/tickets/new")}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all text-white font-medium rounded-xl text-sm shadow-lg shadow-indigo-600/30"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                Create Ticket
              </button>
            )}
            <button
              onClick={() => {
                refreshData();
              }}
              className="p-2 border border-card-border hover:bg-slate-100 dark:hover:bg-slate-800/50 text-muted-text hover:text-foreground rounded-xl transition-all"
              title="Refresh Data"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3 3 3m-3-3v12" />
              </svg>
            </button>
            <ThemeToggle />
            
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowUserMenu(!showUserMenu);
                }}
                className="flex items-center gap-2.5 pl-2 border-l border-card-border ml-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/60 dark:hover:bg-slate-900 px-3 py-1.5 rounded-xl border transition-all cursor-pointer select-none text-left"
              >
                {/* User avatar or placeholder */}
                <div className="w-7 h-7 rounded-lg overflow-hidden bg-indigo-500 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span>{user?.name?.charAt(0).toUpperCase() || "?"}</span>
                  )}
                </div>
                <div className="hidden md:flex flex-col items-start pr-1">
                  <span className="text-[11px] font-bold text-foreground truncate max-w-[100px] leading-tight">
                    {user?.name || user?.email}
                  </span>
                  <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider mt-0.5 leading-none">
                    {user?.role}
                  </span>
                </div>
                <svg className={`w-3.5 h-3.5 text-muted-text transition-transform duration-200 ${showUserMenu ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showUserMenu && (
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 mt-2 w-48 bg-card border border-card-border rounded-xl shadow-xl z-50 py-1.5 text-xs font-semibold animate-in fade-in slide-in-from-top-2 duration-150"
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
                  
                  {(user?.role === "SUPERADMIN" || user?.role === "MODERATOR") && (
                    <button
                      onClick={() => {
                        setActiveTab("tickets");
                        setShowUserMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-900 text-foreground flex items-center gap-2"
                    >
                      🎫 Tickets Desk
                    </button>
                  )}

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
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        {/* Summaries */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="p-5 bg-card border border-card-border rounded-2xl backdrop-blur-sm">
            <p className="text-xs text-muted-text font-medium">Total Tickets</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-foreground">{totalCount}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-muted-text font-semibold">ALL</span>
            </div>
          </div>
          <div className="p-5 bg-card border border-card-border rounded-2xl backdrop-blur-sm">
            <p className="text-xs text-muted-text font-medium">Active (New / Progress)</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-amber-500 dark:text-amber-400">{activeCount}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 dark:text-amber-400 font-semibold">PENDING</span>
            </div>
          </div>
          <div className="p-5 bg-card border border-card-border rounded-2xl backdrop-blur-sm">
            <p className="text-xs text-muted-text font-medium">Resolved / Closed</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-emerald-500 dark:text-emerald-400">{resolvedCount}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 font-semibold">DONE</span>
            </div>
          </div>
          <div className="p-5 bg-card border border-card-border rounded-2xl backdrop-blur-sm">
            <p className="text-xs text-muted-text font-medium">
              {user?.role === "AGENT" ? "My Field Engineers" : "Service Partners"}
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-indigo-500 dark:text-indigo-400">{partnerCount}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 font-semibold">
                {user?.role === "AGENT" ? "STAFF" : "PARTNERS"}
              </span>
            </div>
          </div>
        </section>

        {/* Navigation Tabs & Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-card-border pb-4">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-950/80 rounded-xl border border-card-border w-fit">
            <button
              onClick={() => setActiveTab("tickets")}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === "tickets"
                  ? "bg-white dark:bg-slate-800 text-foreground dark:text-white shadow-sm"
                  : "text-muted-text hover:text-foreground"
              }`}
            >
              Tickets
            </button>
            {(user?.role === "SUPERADMIN" || user?.role === "MODERATOR") && (
              <>
                <button
                  onClick={() => setActiveTab("maincons")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === "maincons"
                      ? "bg-white dark:bg-slate-800 text-foreground dark:text-white shadow-sm"
                      : "text-muted-text hover:text-foreground"
                  }`}
                >
                  Clients
                </button>
                <button
                  onClick={() => setActiveTab("partners")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === "partners"
                      ? "bg-white dark:bg-slate-800 text-foreground dark:text-white shadow-sm"
                      : "text-muted-text hover:text-foreground"
                  }`}
                >
                  Service Partners
                </button>
                <button
                  onClick={() => setActiveTab("devices")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === "devices"
                      ? "bg-white dark:bg-slate-800 text-foreground dark:text-white shadow-sm"
                      : "text-muted-text hover:text-foreground"
                  }`}
                >
                  Device Catalog
                </button>
                <button
                  onClick={() => setActiveTab("slas")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === "slas"
                      ? "bg-white dark:bg-slate-800 text-foreground dark:text-white shadow-sm"
                      : "text-muted-text hover:text-foreground"
                  }`}
                >
                  SLA Configurations
                </button>
              </>
            )}
            {user?.role === "SUPERADMIN" && (
              <button
                onClick={() => setActiveTab("users")}
                className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === "users"
                    ? "bg-white dark:bg-slate-800 text-foreground dark:text-white shadow-sm"
                    : "text-muted-text hover:text-foreground"
                }`}
              >
                Users & Roles
              </button>
            )}
            {user?.role === "AGENT" && user.partnerId && (
              <>
                <button
                  onClick={() => setActiveTab("team")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === "team"
                      ? "bg-white dark:bg-slate-800 text-foreground dark:text-white shadow-sm"
                      : "text-muted-text hover:text-foreground"
                  }`}
                >
                  My Team
                </button>
                <button
                  onClick={() => setActiveTab("agency-profile")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === "agency-profile"
                      ? "bg-white dark:bg-slate-800 text-foreground dark:text-white shadow-sm"
                      : "text-muted-text hover:text-foreground"
                  }`}
                >
                  Agency Profile
                </button>
              </>
            )}
          </div>

          {/* Quick Register Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {activeTab === "maincons" && (
              <button
                onClick={() => setIsMainconModalOpen(true)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg border border-transparent inline-flex items-center gap-1 transition-all"
              >
                + Register Client
              </button>
            )}
            {activeTab === "partners" && (
              <>
                <button
                  onClick={() => setIsPartnerModalOpen(true)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg border border-transparent inline-flex items-center gap-1 transition-all"
                >
                  + Register Partner
                </button>
                <button
                  onClick={() => setIsFeModalOpen(true)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg border border-transparent inline-flex items-center gap-1 transition-all"
                >
                  + Register Engineer
                </button>
              </>
            )}
            {activeTab === "devices" && (
              <button
                onClick={() => setIsDeviceModalOpen(true)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg border border-transparent inline-flex items-center gap-1 transition-all"
              >
                + Add Device to Catalog
              </button>
            )}
            {activeTab === "slas" && (
              <button
                onClick={() => setIsSlaModalOpen(true)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg border border-transparent inline-flex items-center gap-1 transition-all"
              >
                + Add SLA Rule
              </button>
            )}
          </div>
        </div>

        {/* Tab Contents: Tickets */}
        {activeTab === "tickets" && (
          <div>
            {/* Filter and Search Bar */}
            <div className="p-4 bg-card border border-card-border rounded-2xl backdrop-blur-sm mb-6 flex flex-col md:flex-row items-center gap-4">
              <div className="relative w-full md:w-80">
                <svg className="w-4 h-4 text-muted-text absolute left-3 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search Site / Ref No..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-input-bg border border-card-border rounded-xl text-foreground placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-505 text-xs cursor-pointer"
                >
                  <option value="">All Statuses</option>
                  <option value="NEW">New</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="FOLLOW_UP">Follow Up</option>
                  <option value="COMPLETE">Complete</option>
                  <option value="CLOSED">Closed</option>
                </select>

                <select
                  value={stateFilter}
                  onChange={(e) => setStateFilter(e.target.value)}
                  className="px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs cursor-pointer"
                >
                  <option value="">All States</option>
                  {states.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>

                <select
                  value={mainconFilter}
                  onChange={(e) => setMainconFilter(e.target.value)}
                  className="px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs cursor-pointer"
                >
                  <option value="">All Clients</option>
                  {maincons.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>

                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs cursor-pointer"
                >
                  <option value="">All Severities</option>
                  <option value="P1">P1</option>
                  <option value="P2">P2</option>
                  <option value="P3">P3</option>
                  <option value="P4">P4</option>
                </select>
              </div>
            </div>

            {/* Ticket list — full width */}
            <div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-muted-text">Tickets ({filteredTickets.length})</h3>
                  {isPending && <span className="text-xs text-indigo-500 dark:text-indigo-400 animate-pulse">Syncing...</span>}
                </div>

                {filteredTickets.length === 0 ? (
                  <div className="p-12 text-center bg-slate-100/50 dark:bg-slate-900/10 border border-dashed border-card-border rounded-2xl">
                    <p className="text-muted-text text-sm">No tickets found matching filters.</p>
                  </div>
                ) : (
                  <div className="bg-card border border-card-border rounded-2xl overflow-hidden shadow-sm">
                    {/* Table header */}
                    <div className="grid items-center gap-4 px-5 py-3 border-b border-card-border bg-slate-50 dark:bg-slate-950/60"
                      style={{ gridTemplateColumns: user?.role === "AGENT" ? "135px 1fr 90px 100px 125px 125px 110px" : "135px 1fr 90px 100px 125px 125px 110px 80px" }}>
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-text">Ticket Ref</span>
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-text">Site & Issue Details</span>
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-text text-center">State</span>
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-text text-right">Created</span>
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-text text-center">SLA Target</span>
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-text text-center">Status</span>
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-text text-center">Service Report</span>
                      {user?.role !== "AGENT" && (
                        <span className="text-xs font-bold uppercase tracking-widest text-muted-text text-right">Actions</span>
                      )}
                    </div>                    {/* Table rows */}
                    {filteredTickets.map((t, idx) => {
                      const isActive = t.status === "NEW" || t.status === "IN_PROGRESS" || t.status === "FOLLOW_UP";

                      let rowAnimationClass = "";
                      if (isActive && t.slaDeadline) {
                        const deadline = new Date(t.slaDeadline);
                        const diffMs = deadline.getTime() - Date.now();
                        if (diffMs < 0) {
                          rowAnimationClass = "animate-row-warn border-rose-500/20";
                        } else if (diffMs < 2 * 60 * 60 * 1000) { // 2 hours
                          rowAnimationClass = "animate-row-warn border-amber-500/20";
                        }
                      }

                      const statusConfig: Record<string, { label: string; dot: string; badge: string }> = {
                        NEW: {
                          label: "New",
                          dot: "bg-sky-500",
                          badge: "bg-sky-55 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/30",
                        },
                        IN_PROGRESS: {
                          label: "In Progress",
                          dot: "bg-amber-500",
                          badge: "bg-amber-55 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30",
                        },
                        ON_HOLD: {
                          label: "On Hold",
                          dot: "bg-orange-500",
                          badge: "bg-orange-55 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/30",
                        },
                        RESOLVED: {
                          label: "Resolved",
                          dot: "bg-emerald-500",
                          badge: "bg-emerald-55 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30",
                        },
                        FOLLOW_UP: {
                          label: "Follow Up",
                          dot: "bg-fuchsia-500",
                          badge: "bg-fuchsia-55 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-500/10 dark:text-fuchsia-400 dark:border-fuchsia-500/30",
                        },
                        COMPLETE: {
                          label: "Complete",
                          dot: "bg-teal-500",
                          badge: "bg-teal-55 text-teal-700 border-teal-200 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/30",
                        },
                        CLOSED: {
                          label: "Closed",
                          dot: "bg-slate-500",
                          badge: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700/40 dark:text-slate-400 dark:border-slate-600/30",
                        },
                      };
                      const sc = statusConfig[t.status] || statusConfig["NEW"];
                      const subStatusLabels: Record<string, string> = {
                        PENDING_PARTS: "Pending Parts",
                        PENDING_SIGN_OFF: "Pending Sign-off",
                        MONITORING: "In Monitoring",
                        OTHER: "Others",
                      };

                      return (
                        <div
                          key={t.id}
                          onClick={() => router.push(`/tickets/${t.id}`)}
                          className={`grid items-center gap-4 px-5 py-4 cursor-pointer transition-all border-b last:border-b-0 group ${rowAnimationClass} ${
                            idx % 2 === 0
                              ? "bg-card border-card-border hover:bg-slate-50 dark:hover:bg-indigo-900/10"
                              : "bg-slate-50/50 dark:bg-slate-950/20 border-card-border hover:bg-slate-50 dark:hover:bg-indigo-900/10"
                          }`}
                          style={{ gridTemplateColumns: user?.role === "AGENT" ? "135px 1fr 90px 100px 125px 125px 110px" : "135px 1fr 90px 100px 125px 125px 110px 80px" }}
                        >
                          {/* Ticket Ref */}
                          <div className="min-w-0 flex flex-col gap-0.5">
                            <span className="block text-xs font-bold text-indigo-600 dark:text-indigo-400 font-mono leading-tight truncate">
                              {t.ticketRefNo ? t.ticketRefNo : `#${t.id}`}
                            </span>
                            <span className="block text-[10px] text-muted-text font-mono truncate leading-normal">
                              {t.maincon?.name ?? ""}{t.endCustomer ? ` · ${t.endCustomer}` : ""}
                            </span>
                          </div>

                          {/* Site & Issue Details */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-foreground truncate leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-200 transition-colors">
                                {t.clientSiteName}
                              </p>
                              {renderSeverityBadge(t.severity)}
                            </div>
                            <p className="text-xs text-muted-text truncate mt-1 leading-snug">{t.issueDescription}</p>
                            
                            {/* Assignee & Device info */}
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2">
                              {t.partner && user?.role !== "AGENT" && (
                                <span className="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                                  🏢 {t.partner.name}
                                </span>
                              )}
                              {t.assignedFe && (
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                                  t.feAcknowledgeStatus === "ACKNOWLEDGED"
                                    ? "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-750 text-slate-700 dark:text-slate-300"
                                    : "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold"
                                }`}>
                                  👤 {t.assignedFe.name} {t.feAcknowledgeStatus === "ACKNOWLEDGED" ? "✓ Ack" : "⏳ Ack Pending"}
                                </span>
                              )}
                              {t.device && (
                                <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded text-[10px] text-slate-700 dark:text-slate-300 font-medium">
                                  💻 {t.deviceStatus === "ON_REQUEST" && t.customDeviceDetails
                                    ? t.customDeviceDetails
                                    : `${t.device.brand} ${t.device.model}`}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* State */}
                          <div className="min-w-0 text-center">
                            <span className="text-xs text-muted-text font-medium block truncate">{t.state}</span>
                          </div>

                          {/* Created */}
                          <div className="text-right">
                            <span className="text-xs text-muted-text font-mono whitespace-nowrap">
                              {new Date(t.createdAt).toLocaleDateString("en-MY", {
                                day: "2-digit",
                                month: "short",
                                year: "2-digit",
                              })}
                            </span>
                          </div>

                          {/* SLA Target */}
                          <div className="flex flex-col items-center justify-center">
                            {t.slaDeadline ? (
                              renderSlaBadge(t)
                            ) : (
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 italic">No SLA</span>
                            )}
                          </div>

                          {/* Status badge with blinking dot */}
                          <div className="flex flex-col items-center gap-1">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold whitespace-nowrap ${sc.badge} ${
                              t.status === "NEW" ? "animate-pulse-soft" : ""
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sc.dot} ${isActive ? "animate-pulse" : ""}`} />
                              {sc.label}
                            </span>
                            {t.status === "FOLLOW_UP" && t.subStatus && (
                              <span className="text-[9.5px] font-semibold bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 border border-fuchsia-500/20 px-1.5 py-0.5 rounded whitespace-nowrap">
                                {subStatusLabels[t.subStatus] || t.subStatus}
                              </span>
                            )}
                            {t.status === "ON_HOLD" && t.holdReason && (
                              <span className="text-[9.5px] font-semibold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 px-1.5 py-0.5 rounded whitespace-nowrap truncate max-w-[110px]" title={t.holdReason}>
                                {t.holdReason}
                              </span>
                            )}
                            {isActive && (() => {
                              if (t.partnerId && !t.assignedFeId) {
                                return (
                                  <span className="text-[9px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded whitespace-nowrap">
                                    ⏳ Unassigned
                                  </span>
                                );
                              }
                              if (t.assignedFeId) {
                                if (t.feAcknowledgeStatus === "PENDING" || !t.feAcknowledgeStatus) {
                                  return (
                                    <span className="text-[9px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded whitespace-nowrap animate-pulse-soft">
                                      ⏳ Awaiting Ack
                                    </span>
                                  );
                                }
                                if (t.feAcknowledgeStatus === "DECLINED") {
                                  return (
                                    <span className="text-[9px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 px-1.5 py-0.5 rounded whitespace-nowrap">
                                      ❌ FE Declined
                                    </span>
                                  );
                                }
                                if (t.feAcknowledgeStatus === "ACKNOWLEDGED") {
                                  if (t.status === "IN_PROGRESS") {
                                    return (
                                      <span className="text-[9px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded whitespace-nowrap">
                                        📍 Ack (Onsite Now)
                                      </span>
                                    );
                                  }
                                  if ((t.status === "NEW" || t.status === "FOLLOW_UP") && t.eta) {
                                    const etaDate = new Date(t.eta);
                                    const formattedEta = etaDate.toLocaleDateString("en-MY", {
                                      day: "2-digit",
                                      month: "short",
                                    }) + " " + etaDate.toLocaleTimeString("en-MY", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      hour12: false,
                                    });
                                    return (
                                      <span className="text-[9px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded whitespace-nowrap" title={`ETA: ${etaDate.toLocaleString("en-MY")}`}>
                                        🕒 ETA: {formattedEta}
                                      </span>
                                    );
                                  }
                                  if (t.status === "NEW") {
                                    return (
                                      <span className="text-[9px] font-semibold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 px-1.5 py-0.5 rounded whitespace-nowrap">
                                        👤 Ack (No ETA)
                                      </span>
                                    );
                                  }
                                }
                              }
                              return null;
                            })()}
                          </div>

                          {/* Service Report Column */}
                          <div className="flex justify-center items-center">
                            {t.serviceReportUrl ? (
                              <a
                                href={t.serviceReportUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 px-2 py-1 rounded-lg text-[10px] text-emerald-600 dark:text-emerald-400 font-bold transition-all"
                              >
                                📄 View SR
                              </a>
                            ) : (
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 italic">—</span>
                            )}
                          </div>

                          {/* Actions */}
                          {user?.role !== "AGENT" && (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/tickets/${t.id}/edit`);
                                }}
                                className="p-1 border border-card-border rounded-md bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-400 text-xs flex items-center justify-center transition-all"
                                title="Edit Ticket"
                              >
                                ✏️
                              </button>
                              {user?.role === "SUPERADMIN" && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    if (window.confirm(`Delete Support Ticket ${t.ticketRefNo || `#${t.id}`}? This cannot be undone.`)) {
                                      deleteTicket(t.id)
                                        .then(() => refreshData())
                                        .catch((err) => {
                                          alert("Error deleting ticket: " + (err instanceof Error ? err.message : String(err)));
                                        });
                                    }
                                  }}
                                  className="p-1 border border-card-border rounded-md bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-red-955/20 text-red-600 dark:text-red-400 text-xs flex items-center justify-center transition-all"
                                  title="Delete Ticket"
                                >
                                  🗑️
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab Contents: Maincons */}
        {activeTab === "maincons" && (
          <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-foreground mb-4">Clients</h3>
            
            {maincons.length === 0 ? (
              <div className="p-12 text-center bg-slate-100/50 dark:bg-slate-900/10 border border-dashed border-card-border rounded-2xl">
                <p className="text-muted-text text-sm">No Clients registered yet.</p>
              </div>
            ) : (
              <div className="border border-card-border rounded-2xl overflow-hidden shadow-sm bg-card">
                {/* Table Header */}
                <div className="grid items-center gap-4 px-5 py-3.5 border-b border-card-border bg-slate-50 dark:bg-slate-950/60"
                  style={{ gridTemplateColumns: "200px 150px 180px 1fr 100px" }}>
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-text">Company Name</span>
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-text">End Customers</span>
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-text">Sheet Name</span>
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-text">Custom Fields Schema</span>
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-text text-right">Actions</span>
                </div>
                
                {/* Table Body */}
                <div className="divide-y divide-card-border">
                  {maincons.map((m, idx) => {
                    const schema = safeParseJson<string[]>(m.customFieldsSchema, []);
                    return (
                      <div
                        key={m.id}
                        className={`grid items-center gap-4 px-5 py-4 transition-all group ${
                          idx % 2 === 0
                            ? "bg-card hover:bg-slate-50 dark:hover:bg-indigo-900/10"
                            : "bg-slate-50/50 dark:bg-slate-950/20 hover:bg-slate-50 dark:hover:bg-indigo-900/10"
                        }`}
                        style={{ gridTemplateColumns: "200px 150px 180px 1fr 100px" }}
                      >
                        {/* Company Name */}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-200 transition-colors truncate">
                            {m.name}
                          </p>
                          <span className="text-[10px] text-muted-text">ID: #{m.id}</span>
                        </div>

                        {/* End Customers */}
                        <div className="min-w-0">
                          {(() => {
                            const custs = safeParseJson<string[]>(m.siteCustomers, []);
                            if (custs.length === 0) {
                              return <span className="text-xs text-muted-text italic">None</span>;
                            }
                            return (
                              <div className="flex flex-wrap gap-1">
                                {custs.map((c) => (
                                  <span key={c} className="text-[10px] bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 px-1.5 py-0.5 rounded text-indigo-600 dark:text-indigo-400 font-semibold uppercase">
                                    {c}
                                  </span>
                                ))}
                              </div>
                            );
                          })()}
                        </div>

                        {/* Sheet Name */}
                        <div className="min-w-0">
                          <span className="text-xs font-mono text-muted-text bg-slate-100 dark:bg-slate-900 border border-card-border px-2 py-0.5 rounded truncate block w-fit max-w-full">
                            {m.sheetName}
                          </span>
                        </div>

                        {/* Schema Fields */}
                        <div className="min-w-0">
                          {schema.length === 0 ? (
                            <span className="text-xs text-muted-text italic">No custom fields defined</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {schema.map((fName) => (
                                <span
                                  key={fName}
                                  className="text-[10px] bg-slate-100 dark:bg-slate-900 border border-card-border px-2 py-1 rounded text-slate-700 dark:text-slate-300 font-medium"
                                >
                                  {fName}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => {
                              setEditingMainconId(m.id);
                              setNewMaincon({
                                name: m.name,
                                sheetName: m.sheetName,
                                customFields: (m.customFieldsSchema as string[]) || [""],
                                siteCustomersInput: Array.isArray(m.siteCustomers) ? (m.siteCustomers as string[]).join(", ") : "",
                              });
                              setIsMainconModalOpen(true);
                            }}
                            className="p-1.5 border border-card-border rounded-lg bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-400 text-xs font-semibold flex items-center justify-center transition-all"
                            title="Edit Client"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm(`Delete Client "${m.name}"? This cannot be undone.`)) {
                                try {
                                  await deleteMaincon(m.id);
                                  setMaincons((prev) => prev.filter((mc) => mc.id !== m.id));
                                } catch (err) {
                                  alert("Error deleting Client: " + (err instanceof Error ? err.message : String(err)));
                                }
                              }
                            }}
                            className="p-1.5 border border-card-border rounded-lg bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-red-955/20 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center justify-center transition-all"
                            title="Delete Client"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab Contents: Service Partners */}
        {activeTab === "partners" && (
          <div className="space-y-6">
            {partners.map((partner) => {
              const statesCovered = safeParseJson<string[]>(partner.statesCovered, []);
              return (
                <div key={partner.id} className="bg-card border border-card-border rounded-2xl p-6 shadow-sm">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-card-border pb-4 mb-4 gap-4">
                    <div className="flex items-start gap-4">
                      {partner.companyPhotoUrl ? (
                        <img 
                          src={partner.companyPhotoUrl} 
                          alt={`${partner.name} Photo`} 
                          className="w-12 h-12 rounded-xl object-cover border border-card-border shadow-sm flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-600 flex items-center justify-center font-bold text-xl border border-card-border shadow-sm flex-shrink-0">
                          🏢
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="text-base font-bold text-foreground">{partner.name}</h3>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => {
                                setEditingPartnerId(partner.id);
                                setNewPartner({
                                  name: partner.name,
                                  statesCovered: statesCovered,
                                });
                                setIsPartnerModalOpen(true);
                              }}
                              className="p-1 text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200"
                              title="Edit Partner"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={async () => {
                                if (confirm(`Delete Service Partner "${partner.name}"? This will also remove all its field engineers (if not assigned to active tickets).`)) {
                                  try {
                                    await deleteServicePartner(partner.id);
                                    setPartners((prev) => prev.filter((p) => p.id !== partner.id));
                                  } catch (err) {
                                    alert("Error deleting partner: " + (err instanceof Error ? err.message : String(err)));
                                  }
                                }
                              }}
                              className="p-1 text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
                              title="Delete Partner"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                        
                        {/* Address and Phone Display */}
                        <div className="flex flex-col gap-1 mt-1 text-[11px] text-muted-text">
                          <span className="flex items-center gap-1.5">
                            📍 {partner.address || "No address configured"}
                          </span>
                          {partner.phone && (
                            <span className="flex items-center gap-1.5 font-mono">
                              📞 {partner.phone}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-1 mt-2 items-center">
                          <span className="text-[10px] text-muted-text mr-1.5 font-semibold">States:</span>
                          {statesCovered.map((stateName) => (
                            <span key={stateName} className="text-[9px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25 px-1.5 py-0.5 rounded-full font-semibold uppercase">
                              {stateName}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-xl text-muted-text font-semibold border border-card-border flex-shrink-0 self-start sm:self-center">
                      Engineers: {partner.engineers?.length || 0}
                    </span>
                  </div>

                  {/* Engineers list */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-text uppercase tracking-wider mb-2.5">Field Engineers</h4>
                    {(!partner.engineers || partner.engineers.length === 0) ? (
                      <p className="text-xs text-muted-text italic">No engineers registered for this partner.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {partner.engineers.map((eng: FieldEngineer) => (
                          <div key={eng.id} className="p-3 bg-slate-50/50 dark:bg-slate-950/40 border border-card-border rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                              {/* FE Avatar / Placeholder */}
                              {eng.user?.avatarUrl ? (
                                <img
                                  src={eng.user.avatarUrl}
                                  alt={eng.name}
                                  className="w-8 h-8 rounded-full object-cover border border-card-border shadow-sm flex-shrink-0"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center font-bold text-xs border border-card-border shadow-sm flex-shrink-0">
                                  {eng.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-foreground truncate">
                                  {eng.name}
                                  {(eng.country || eng.region) && (
                                    <span className="text-muted-text font-normal ml-1 text-[10px] block sm:inline">
                                      ({[eng.country, eng.region].filter(Boolean).join(" - ")})
                                    </span>
                                  )}
                                </p>
                                <p className="text-[11px] font-mono text-muted-text mt-0.5">{eng.phone}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {eng.email && (
                                <button
                                  onClick={() => handleCopyFeInvite(eng.name, eng.email)}
                                  className="p-1 text-[11px] hover:scale-110 transition-transform"
                                  title="Copy Invite Link"
                                >
                                  🔗
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setEditingFeId(eng.id);
                                  setNewFe({
                                    name: eng.name,
                                    phone: eng.phone,
                                    partnerId: String(partner.id),
                                    country: eng.country || "",
                                    region: eng.region || "",
                                    email: eng.email || "",
                                  });
                                  setIsFeModalOpen(true);
                                }}
                                className="p-1 text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200"
                                title="Edit Engineer"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={async () => {
                                  if (confirm(`Delete Field Engineer "${eng.name}"?`)) {
                                    try {
                                      await deleteFieldEngineer(eng.id);
                                      setPartners((prev) =>
                                        prev.map((p) => {
                                          if (p.id === partner.id) {
                                            return {
                                              ...p,
                                              engineers: (p.engineers || []).filter((e) => e.id !== eng.id),
                                            };
                                          }
                                          return p;
                                        })
                                      );
                                    } catch (err) {
                                      alert("Error deleting engineer: " + (err instanceof Error ? err.message : String(err)));
                                    }
                                  }
                                }}
                                className="p-1 text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
                                title="Delete Engineer"
                              >
                                🗑️
                              </button>
                              <span className="p-1.5 bg-slate-100 dark:bg-slate-900 rounded-lg text-muted-text border border-card-border">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab Contents: Devices */}
        {activeTab === "devices" && (
          <div className="bg-card border border-card-border rounded-2xl shadow-sm overflow-hidden">
            {/* Table Header */}
            <div className="px-6 py-4 border-b border-card-border bg-slate-50/50 dark:bg-slate-900/30">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-foreground">Device Catalog</h3>
                  <p className="text-xs text-muted-text mt-0.5">{devices.length} model{devices.length !== 1 ? "s" : ""} registered</p>
                </div>
              </div>
            </div>

            {devices.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="inline-flex p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/60 mb-4">
                  <svg className="w-8 h-8 text-muted-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-foreground">No devices in catalog</p>
                <p className="text-xs text-muted-text mt-1">Click &quot;+ Add Device to Catalog&quot; above to register your first device model.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-muted-text font-semibold border-b border-card-border">
                      <th className="px-6 py-3">#</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Brand</th>
                      <th className="px-4 py-3">Model</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Restricted To</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-card-border">
                    {devices.map((device, idx) => (
                      <tr
                        key={device.id}
                        className="group hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors"
                      >
                        <td className="px-6 py-3.5 text-xs text-muted-text font-mono">{idx + 1}</td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-500/8 dark:bg-indigo-500/15 px-2 py-0.5 rounded-md">
                            {device.category}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-sm font-bold text-foreground">{device.brand}</td>
                        <td className="px-4 py-3.5 text-xs text-muted-text font-mono">{device.model}</td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase whitespace-nowrap ${
                              device.isStandard
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25"
                            }`}
                          >
                            {device.isStandard ? "Standard" : "On Request"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          {device.restrictedTo ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400 uppercase whitespace-nowrap">
                              {device.restrictedTo}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-text/50 italic">All groups</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            onClick={async () => {
                              if (confirm(`Delete "${device.brand} ${device.model}" from the catalog? This cannot be undone.`)) {
                                try {
                                  await deleteDeviceCatalogItem(device.id);
                                  setDevices((prev) => prev.filter((d) => d.id !== device.id));
                                } catch (err) {
                                  alert("Error deleting: " + (err instanceof Error ? err.message : String(err)));
                                }
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-muted-text hover:text-red-600 dark:hover:text-red-400 border border-transparent hover:border-red-500/30 hover:bg-red-500/8 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                            title="Delete from catalog"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab Contents: SLA Configurations */}
        {activeTab === "slas" && (
          <div className="bg-card border border-card-border rounded-2xl shadow-sm overflow-hidden">
            {/* Table Header */}
            <div className="px-6 py-4 border-b border-card-border bg-slate-50/50 dark:bg-slate-900/30">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-foreground">SLA Configurations</h3>
                  <p className="text-xs text-muted-text mt-0.5">{slas.length} rule{slas.length !== 1 ? "s" : ""} registered</p>
                </div>
              </div>
            </div>

            {slas.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="inline-flex p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/60 mb-4">
                  <svg className="w-8 h-8 text-muted-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-foreground">No SLA rules defined</p>
                <p className="text-xs text-muted-text mt-1">Click &quot;+ Add SLA Rule&quot; above to create one.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-muted-text font-semibold border-b border-card-border">
                      <th className="px-6 py-3">#</th>
                      <th className="px-4 py-3">End-Customer Group</th>
                      <th className="px-4 py-3">Severity</th>
                      <th className="px-4 py-3">Region</th>
                      <th className="px-4 py-3">SLA Target (Hours)</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-card-border">
                    {slas.map((sla, idx) => (
                      <tr
                        key={sla.id}
                        className="group hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors"
                      >
                        <td className="px-6 py-3.5 text-xs text-muted-text font-mono">{idx + 1}</td>
                        <td className="px-4 py-3.5 text-sm font-bold text-foreground">
                          {sla.customer === "DEFAULT" ? (
                            <span className="inline-flex items-center bg-slate-100 dark:bg-slate-800 text-[10px] font-bold px-2 py-0.5 rounded border border-card-border">
                              Global Fallback (DEFAULT)
                            </span>
                          ) : (
                            <span className="font-bold text-indigo-650 dark:text-indigo-400">
                              {sla.customer}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          {renderSeverityBadge(sla.severity)}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 border border-card-border text-slate-700 dark:text-slate-300">
                            📍 {sla.region}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-muted-text font-mono font-bold">
                          {sla.slaHours} hours ({Math.round(sla.slaHours / 24 * 10) / 10} days)
                        </td>
                        <td className="px-4 py-3.5 text-right flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setNewSla({
                                customer: sla.customer,
                                severity: sla.severity,
                                region: sla.region as any,
                                slaHours: sla.slaHours,
                              });
                              setEditingSlaId(sla.id);
                              setIsSlaModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/8 border border-transparent hover:border-indigo-500/30 rounded-lg transition-all"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteSla(sla.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-muted-text hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/8 border border-transparent hover:border-red-500/30 rounded-lg transition-all"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab Contents: Users & Roles */}
        {activeTab === "users" && user?.role === "SUPERADMIN" && (
          <UserManagementTab partners={partners} />
        )}

        {/* Tab Contents: Partner Team (My Team) */}
        {activeTab === "team" && user?.role === "AGENT" && user.partnerId && (
          <PartnerTeamTab partnerId={user.partnerId} />
        )}

        {/* Tab Contents: User Profile Settings */}
        {activeTab === "profile" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground">Profile Settings</h2>
                <p className="text-xs text-muted-text mt-0.5">Manage your personal settings, password, and organization information.</p>
              </div>
            </div>

            {profileError && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/25 rounded-2xl text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-start gap-2.5">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{profileError}</span>
              </div>
            )}

            {profileSuccess && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-start gap-2.5">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{profileSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              
              {/* Left Column: User Credentials & Password */}
              <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Account Information</h3>
                  <p className="text-[11px] text-muted-text mt-0.5">Your personal credentials and profile details.</p>
                </div>

                {/* Profile Picture */}
                <div className="flex items-center gap-4">
                  <div className="relative group w-20 h-20 rounded-2xl overflow-hidden border border-card-border bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
                    {profileAvatarUrl ? (
                      <img src={profileAvatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl font-bold text-slate-400">{profileName.charAt(0).toUpperCase() || "?"}</span>
                    )}
                    <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-all text-[10px] font-bold text-white uppercase text-center p-1">
                      {uploadingAvatar ? "Uploading..." : "Change Picture"}
                      <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                    </label>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-foreground">Profile Picture</p>
                    <p className="text-[10px] text-muted-text">Upload a square image (PNG, JPG, max 2MB).</p>
                    {profileAvatarUrl && (
                      <button
                        type="button"
                        onClick={() => setProfileAvatarUrl("")}
                        className="text-[10px] font-bold text-rose-500 hover:underline"
                      >
                        Remove Image
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-text mb-1.5">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-input-bg border border-card-border text-foreground text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-text mb-1.5">Email Address (Read Only)</label>
                    <input
                      type="email"
                      disabled
                      value={user?.email || ""}
                      className="w-full px-4 py-2.5 rounded-xl bg-input-bg border border-card-border text-muted-text text-xs font-semibold opacity-60 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-text mb-1.5">System Role (Read Only)</label>
                    <div>
                      <span className="inline-flex mt-1 items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20">
                        {user?.role}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-card-border space-y-4">
                  <div>
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Update Password</h3>
                    <p className="text-[10px] text-muted-text mt-0.5">Fill in fields below if you want to change your login credentials.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-text mb-1.5">New Password</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-4 py-2.5 rounded-xl bg-input-bg border border-card-border text-foreground text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-text mb-1.5">Confirm Password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-4 py-2.5 rounded-xl bg-input-bg border border-card-border text-foreground text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Service Partner Details (Only for AGENT role) */}
              {user?.role === "AGENT" && user.partnerId ? (
                <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Service Partner Agency Profile</h3>
                    <p className="text-[11px] text-muted-text mt-0.5">Manage details of the agency partner linked to your credentials.</p>
                  </div>

                  {/* Company Logo Photo */}
                  <div className="flex items-center gap-4">
                    <div className="relative group w-20 h-20 rounded-2xl overflow-hidden border border-card-border bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
                      {partnerLogoUrl ? (
                        <img src={partnerLogoUrl} alt="Company Logo" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl font-bold text-slate-400">🏢</span>
                      )}
                      <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-all text-[10px] font-bold text-white uppercase text-center p-1">
                        {uploadingLogo ? "Uploading..." : "Change Logo"}
                        <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                      </label>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-foreground">Company Photo / Logo</p>
                      <p className="text-[10px] text-muted-text">Used on dispatch profiles and reports.</p>
                      {partnerLogoUrl && (
                        <button
                          type="button"
                          onClick={() => setPartnerLogoUrl("")}
                          className="text-[10px] font-bold text-rose-500 hover:underline"
                        >
                          Remove Logo
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-text mb-1.5">Company / Agency Name (Read Only)</label>
                      <input
                        type="text"
                        disabled
                        value={partnerName}
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-card-border text-muted-text text-xs font-semibold opacity-65 cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-text mb-1.5">Contact Phone Number</label>
                      <input
                        type="text"
                        value={partnerPhone}
                        onChange={(e) => setPartnerPhone(e.target.value)}
                        placeholder="e.g. +60 3-1234 5678"
                        className="w-full px-4 py-2.5 rounded-xl bg-input-bg border border-card-border text-foreground text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-text mb-1.5">Business Address</label>
                      <textarea
                        rows={3}
                        value={partnerAddress}
                        onChange={(e) => setPartnerAddress(e.target.value)}
                        placeholder="e.g. Suite 12-B, Plaza Mont Kiara, KL"
                        className="w-full px-4 py-2.5 rounded-xl bg-input-bg border border-card-border text-foreground text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all resize-none"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm space-y-4 flex flex-col justify-center items-center text-center py-12">
                  <span className="text-3xl">🏢</span>
                  <div className="max-w-xs space-y-1">
                    <p className="text-xs font-bold text-foreground">No Linked Service Partner</p>
                    <p className="text-[10px] text-muted-text font-medium">Only Service Partner Agent profiles display company information here. Superadmins and Moderators manage this under the &quot;Service Partners&quot; tab.</p>
                  </div>
                </div>
              )}

              <div className="lg:col-span-2 pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={savingProfile || uploadingAvatar || uploadingLogo}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/10 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                >
                  {savingProfile ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Saving Changes...
                    </>
                  ) : (
                    "Save All Profile Settings"
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab Contents: Service Partner Agency Profile */}
        {activeTab === "agency-profile" && user?.role === "AGENT" && user.partnerId && (
          <div className="space-y-6 animate-in fade-in duration-200 max-w-4xl mx-auto">
            <div>
              <h2 className="text-xl font-bold text-foreground">Agency Profile</h2>
              <p className="text-xs text-muted-text mt-0.5">Manage details of the service agency linked to your account.</p>
            </div>

            {profileError && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/25 rounded-2xl text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-start gap-2.5">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{profileError}</span>
              </div>
            )}

            {profileSuccess && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-start gap-2.5">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{profileSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSaveAgencyProfile} className="bg-card border border-card-border rounded-2xl p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Service Partner Agency Details</h3>
                <p className="text-[11px] text-muted-text mt-0.5">Edit details of your service partner agency.</p>
              </div>

              {/* Company Logo Photo */}
              <div className="flex items-center gap-4">
                <div className="relative group w-20 h-20 rounded-2xl overflow-hidden border border-card-border bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
                  {partnerLogoUrl ? (
                    <img src={partnerLogoUrl} alt="Company Logo" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-bold text-slate-400">🏢</span>
                  )}
                  <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-all text-[10px] font-bold text-white uppercase text-center p-1">
                    {uploadingLogo ? "Uploading..." : "Change Logo"}
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </label>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-foreground">Company Photo / Logo</p>
                  <p className="text-[10px] text-muted-text">Used on dispatch profiles and reports.</p>
                  {partnerLogoUrl && (
                    <button
                      type="button"
                      onClick={() => setPartnerLogoUrl("")}
                      className="text-[10px] font-bold text-rose-500 hover:underline"
                    >
                      Remove Logo
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-text mb-1.5">Company / Agency Name (Read Only)</label>
                  <input
                    type="text"
                    disabled
                    value={partnerName}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-card-border text-muted-text text-xs font-semibold opacity-65 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-text mb-1.5">Contact Phone Number</label>
                  <input
                    type="text"
                    value={partnerPhone}
                    onChange={(e) => setPartnerPhone(e.target.value)}
                    placeholder="e.g. +60 3-1234 5678"
                    className="w-full px-4 py-2.5 rounded-xl bg-input-bg border border-card-border text-foreground text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-text mb-1.5">Business Address</label>
                  <textarea
                    rows={3}
                    value={partnerAddress}
                    onChange={(e) => setPartnerAddress(e.target.value)}
                    placeholder="e.g. Suite 12-B, Plaza Mont Kiara, KL"
                    className="w-full px-4 py-2.5 rounded-xl bg-input-bg border border-card-border text-foreground text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all resize-none"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={savingProfile || uploadingLogo}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/10 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                >
                  {savingProfile ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Saving Changes...
                    </>
                  ) : (
                    "Save Agency Settings"
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* CREATE MAINCON MODAL */}
      {isMainconModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-card border border-card-border rounded-2xl shadow-2xl">
            <div className="flex justify-between items-center px-6 py-4 border-b border-card-border bg-slate-50 dark:bg-slate-900/40">
              <h3 className="text-sm font-bold text-foreground">
                {editingMainconId !== null ? "Edit Client Profile" : "Register Client Profile"}
              </h3>
              <button
                onClick={() => {
                  setIsMainconModalOpen(false);
                  setEditingMainconId(null);
                  setNewMaincon({ name: "", sheetName: "", customFields: [""], siteCustomersInput: "" });
                }}
                className="text-muted-text hover:text-foreground p-1 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateMainconSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-text mb-1">Company Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Telekom Malaysia (TM)"
                  value={newMaincon.name}
                  onChange={(e) => setNewMaincon({ ...newMaincon, name: e.target.value })}
                  className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-text mb-1">Sheet Name (for Excel imports)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TM_F2F_Master"
                  value={newMaincon.sheetName}
                  onChange={(e) => setNewMaincon({ ...newMaincon, sheetName: e.target.value })}
                  className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-text mb-1">
                  End-Customers / Site Groups (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. JPJ, RELA, LHDN"
                  value={newMaincon.siteCustomersInput}
                  onChange={(e) => setNewMaincon({ ...newMaincon, siteCustomersInput: e.target.value })}
                  className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-text mb-1 flex items-center justify-between">
                  <span>Custom Fields Schema</span>
                  <button
                    type="button"
                    onClick={() => setNewMaincon({ ...newMaincon, customFields: [...newMaincon.customFields, ""] })}
                    className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    + Add Field
                  </button>
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {newMaincon.customFields.map((field, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. IP Address, Circuit ID"
                        value={field}
                        onChange={(e) => {
                          const updated = [...newMaincon.customFields];
                          updated[idx] = e.target.value;
                          setNewMaincon({ ...newMaincon, customFields: updated });
                        }}
                        className="flex-1 px-3 py-1.5 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = newMaincon.customFields.filter((_, i) => i !== idx);
                          setNewMaincon({ ...newMaincon, customFields: updated });
                        }}
                        className="text-xs text-rose-505 dark:text-rose-500 px-1 hover:bg-slate-100 dark:hover:bg-slate-900 rounded"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-card-border flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsMainconModalOpen(false);
                    setEditingMainconId(null);
                    setNewMaincon({ name: "", sheetName: "", customFields: [""], siteCustomersInput: "" });
                  }}
                  className="px-3 py-1.5 border border-card-border hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs text-white"
                >
                  {editingMainconId !== null ? "Save Changes" : "Register Client"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE SERVICE PARTNER MODAL */}
      {isPartnerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-card border border-card-border rounded-2xl shadow-2xl">
            <div className="flex justify-between items-center px-6 py-4 border-b border-card-border bg-slate-50 dark:bg-slate-900/40">
              <h3 className="text-sm font-bold text-foreground">
                {editingPartnerId !== null ? "Edit Service Partner Profile" : "Register Service Partner"}
              </h3>
              <button
                onClick={() => {
                  setIsPartnerModalOpen(false);
                  setEditingPartnerId(null);
                  setNewPartner({ name: "", statesCovered: [] });
                }}
                className="text-muted-text hover:text-foreground p-1 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreatePartnerSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-text mb-1">Company / Partner Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Support Services"
                  value={newPartner.name}
                  onChange={(e) => setNewPartner({ ...newPartner, name: e.target.value })}
                  className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-text mb-2">States Covered</label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-input-bg border border-card-border rounded-xl">
                  {states.map((s) => {
                    const isChecked = newPartner.statesCovered.includes(s.name);
                    return (
                      <label key={s.id} className="flex items-center gap-2 text-xs p-1 hover:bg-slate-100 dark:hover:bg-slate-900 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setNewPartner({
                                ...newPartner,
                                statesCovered: newPartner.statesCovered.filter((name) => name !== s.name),
                              });
                            } else {
                              setNewPartner({
                                ...newPartner,
                                statesCovered: [...newPartner.statesCovered, s.name],
                              });
                            }
                          }}
                          className="rounded bg-input-bg border-card-border text-indigo-600 focus:ring-indigo-500 focus:ring-offset-background"
                        />
                        <span className="text-foreground/80">{s.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-card-border flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsPartnerModalOpen(false);
                    setEditingPartnerId(null);
                    setNewPartner({ name: "", statesCovered: [] });
                  }}
                  className="px-3 py-1.5 border border-card-border hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs text-white"
                >
                  {editingPartnerId !== null ? "Save Changes" : "Register Partner"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REGISTER FIELD ENGINEER MODAL */}
      {isFeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-card border border-card-border rounded-2xl shadow-2xl">
            <div className="flex justify-between items-center px-6 py-4 border-b border-card-border bg-slate-50 dark:bg-slate-900/40">
              <h3 className="text-sm font-bold text-foreground">
                {editingFeId !== null ? "Edit Dispatch Engineer" : "Register Dispatch Engineer"}
              </h3>
              <button
                onClick={() => {
                  setIsFeModalOpen(false);
                  setEditingFeId(null);
                  setNewFe({ name: "", phone: "", partnerId: "", country: "", region: "", email: "" });
                }}
                className="text-muted-text hover:text-foreground p-1 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateFeSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-text mb-1">Service Partner Employer</label>
                <select
                  required
                  value={newFe.partnerId}
                  onChange={(e) => setNewFe({ ...newFe, partnerId: e.target.value })}
                  className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none text-xs cursor-pointer"
                >
                  <option value="">Select Employer Partner</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-text mb-1">Engineer Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={newFe.name}
                  onChange={(e) => setNewFe({ ...newFe, name: e.target.value })}
                  className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-text mb-1">Mobile Phone Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. +60 12-345 6789"
                  value={newFe.phone}
                  onChange={(e) => setNewFe({ ...newFe, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-text mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. engineer@company.com"
                  value={newFe.email || ""}
                  onChange={(e) => setNewFe({ ...newFe, email: e.target.value })}
                  className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-text mb-1">Country / State</label>
                  <input
                    type="text"
                    placeholder="e.g. Sarawak"
                    value={newFe.country}
                    onChange={(e) => setNewFe({ ...newFe, country: e.target.value })}
                    className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-text mb-1">Region / City</label>
                  <input
                    type="text"
                    placeholder="e.g. Bintulu"
                    value={newFe.region}
                    onChange={(e) => setNewFe({ ...newFe, region: e.target.value })}
                    className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none text-xs"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-card-border flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsFeModalOpen(false);
                    setEditingFeId(null);
                    setNewFe({ name: "", phone: "", partnerId: "", country: "", region: "", email: "" });
                  }}
                  className="px-3 py-1.5 border border-card-border hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs text-white"
                >
                  {editingFeId !== null ? "Save Changes" : "Register Engineer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE DEVICE CATALOG ITEM MODAL */}
      {isDeviceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-card border border-card-border rounded-2xl shadow-2xl">
            <div className="flex justify-between items-center px-6 py-4 border-b border-card-border bg-slate-50 dark:bg-slate-900/40">
              <h3 className="text-sm font-bold text-foreground">Add Device to Standard Catalog</h3>
              <button
                onClick={() => setIsDeviceModalOpen(false)}
                className="text-muted-text hover:text-foreground p-1 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateDeviceSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-text mb-1">Device Category</label>
                <select
                  required
                  value={newDevice.category}
                  onChange={(e) => setNewDevice({ ...newDevice, category: e.target.value })}
                  className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none text-xs cursor-pointer"
                >
                  <option value="Desktop">Desktop</option>
                  <option value="Laptop">Laptop</option>
                  <option value="Printer">Printer</option>
                  <option value="Router">Router</option>
                  <option value="POS">POS</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-text mb-1">Brand Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lenovo, Cisco"
                  value={newDevice.brand}
                  onChange={(e) => setNewDevice({ ...newDevice, brand: e.target.value })}
                  className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-text mb-1">Model Name / Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ThinkPad T14 Gen 3"
                  value={newDevice.model}
                  onChange={(e) => setNewDevice({ ...newDevice, model: e.target.value })}
                  className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-text mb-1">
                  Restrict to End-Customer Group (Optional)
                </label>
                <select
                  value={newDevice.restrictedTo}
                  onChange={(e) => setNewDevice({ ...newDevice, restrictedTo: e.target.value })}
                  className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none text-xs cursor-pointer"
                >
                  <option value="">No Restriction (Standard catalog item for all)</option>
                  {allSiteCustomers.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 py-2">
                <input
                  type="checkbox"
                  id="isStandard"
                  checked={newDevice.isStandard}
                  onChange={(e) => setNewDevice({ ...newDevice, isStandard: e.target.checked })}
                  className="rounded bg-input-bg border-card-border text-indigo-600 focus:ring-indigo-500 focus:ring-offset-background"
                />
                <label htmlFor="isStandard" className="text-xs text-foreground/80 cursor-pointer selection:bg-transparent">
                  Is this a Standard Catalog Item? (Enables standard dispatch checks)
                </label>
              </div>

              <div className="pt-4 border-t border-card-border flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDeviceModalOpen(false)}
                  className="px-3 py-1.5 border border-card-border hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs text-white"
                >
                  Add to Catalog
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE/EDIT SLA MODAL */}
      {isSlaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-card border border-card-border rounded-2xl shadow-2xl">
            <div className="flex justify-between items-center px-6 py-4 border-b border-card-border bg-slate-50 dark:bg-slate-900/40">
              <h3 className="text-sm font-bold text-foreground">
                {editingSlaId !== null ? "Edit SLA Rule" : "Create SLA Configuration Rule"}
              </h3>
              <button
                onClick={() => {
                  setIsSlaModalOpen(false);
                  setEditingSlaId(null);
                  setNewSla({
                    customer: "DEFAULT",
                    severity: "P1",
                    region: "Semenanjung",
                    slaHours: 24,
                  });
                }}
                className="text-muted-text hover:text-foreground p-1 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateSlaSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-text mb-1">
                  End-Customer / Site Group
                </label>
                <select
                  required
                  value={newSla.customer}
                  onChange={(e) => setNewSla({ ...newSla, customer: e.target.value })}
                  className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs shadow-sm cursor-pointer"
                >
                  <option value="DEFAULT">Global Fallback (DEFAULT)</option>
                  {allSiteCustomers.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-text mt-1 font-medium">
                  Select &quot;Global Fallback (DEFAULT)&quot; if this rule should apply to any customer without their own specific override.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-text mb-1">Severity</label>
                  <select
                    required
                    value={newSla.severity}
                    onChange={(e) => setNewSla({ ...newSla, severity: e.target.value as any })}
                    className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs shadow-sm cursor-pointer"
                  >
                    <option value="P1">P1</option>
                    <option value="P2">P2</option>
                    <option value="P3">P3</option>
                    <option value="P4">P4</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-text mb-1">Region</label>
                  <select
                    required
                    value={newSla.region}
                    onChange={(e) => setNewSla({ ...newSla, region: e.target.value as any })}
                    className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs shadow-sm cursor-pointer"
                  >
                    <option value="Semenanjung">Semenanjung</option>
                    <option value="Sabah/Sarawak">Sabah/Sarawak</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-text mb-1">SLA Target (in Hours)</label>
                <input
                  type="number"
                  required
                  min={1}
                  placeholder="e.g. 24, 72"
                  value={newSla.slaHours || ""}
                  onChange={(e) => setNewSla({ ...newSla, slaHours: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs shadow-sm"
                />
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-card-border">
                <button
                  type="button"
                  onClick={() => {
                    setIsSlaModalOpen(false);
                    setEditingSlaId(null);
                    setNewSla({
                      customer: "DEFAULT",
                      severity: "P1",
                      region: "Semenanjung",
                      slaHours: 24,
                    });
                  }}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-500 hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-indigo-650 hover:bg-indigo-500 disabled:bg-indigo-650/50 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-indigo-550/10"
                >
                  {isPending ? "Saving..." : editingSlaId !== null ? "Save Changes" : "Create Rule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
