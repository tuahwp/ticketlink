"use client";

import React, { useState, useTransition, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import SlaCountdown from "./SlaCountdown";
import { useAuth } from "./AuthProvider";
import FEDashboard from "./FEDashboard";
import UserManagementTab from "./UserManagementTab";
import PartnerTeamTab from "./PartnerTeamTab";
import AnalyticsDashboardTab from "./AnalyticsDashboardTab";
import InventoryTab, {
  InventoryItem as TabInventoryItem,
  Warehouse as TabWarehouse,
  PendingTicketPart as TabPendingTicketPart,
} from "./InventoryTab";
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
  getInventoryItems,
  getWarehouses,
  getPendingPartsRequests,
} from "../actions";
import { compressImage } from "@/lib/imageCompress";
import { toast } from "sonner";

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
  initialInventoryItems?: TabInventoryItem[];
  initialWarehouses?: TabWarehouse[];
  initialPendingPartsTickets?: TabPendingTicketPart[];
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
  initialInventoryItems = [],
  initialWarehouses = [],
  initialPendingPartsTickets = [],
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
  const [inventoryItems, setInventoryItems] = useState<TabInventoryItem[]>(initialInventoryItems);
  const [warehouses, setWarehouses] = useState<TabWarehouse[]>(initialWarehouses);
  const [pendingPartsTickets, setPendingPartsTickets] = useState<TabPendingTicketPart[]>(initialPendingPartsTickets);

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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "TicketSparePart" },
        async () => {
          console.log("Realtime DB event received on TicketSparePart table");
          try {
            const [freshItems, freshPending, freshTickets] = await Promise.all([
              getInventoryItems(),
              getPendingPartsRequests(),
              getTickets(),
            ]);
            setInventoryItems(freshItems);
            setPendingPartsTickets(freshPending);
            setTickets(freshTickets);
          } catch (err) {
            console.error("Error refreshing realtime spare parts:", err);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "InventoryItem" },
        async () => {
          console.log("Realtime DB event received on InventoryItem table");
          try {
            const [freshItems, freshPending] = await Promise.all([
              getInventoryItems(),
              getPendingPartsRequests(),
            ]);
            setInventoryItems(freshItems);
            setPendingPartsTickets(freshPending);
          } catch (err) {
            console.error("Error refreshing realtime inventory items:", err);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "Warehouse" },
        async () => {
          console.log("Realtime DB event received on Warehouse table");
          try {
            const [freshWhs, freshItems] = await Promise.all([
              getWarehouses(),
              getInventoryItems(),
            ]);
            setWarehouses(freshWhs);
            setInventoryItems(freshItems);
          } catch (err) {
            console.error("Error refreshing realtime warehouses:", err);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);


  const [isPending, startTransition] = useTransition();

  // Tab state: 'tickets' | 'analytics' | 'inventory' | 'maincons' | 'partners' | 'devices' | 'slas' | 'users' | 'team' | 'profile' | 'agency-profile'
  const [activeTab, setActiveTab] = useState<"tickets" | "analytics" | "inventory" | "maincons" | "partners" | "devices" | "slas" | "users" | "team" | "profile" | "agency-profile">("tickets");

  // Sidebar expand/collapse state (default slim icon rail mode)
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  // Mobile sidebar open state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Preset View Tab state: 'all_active' | 'sla_risk' | 'needs_fe' | 'awaiting_ack' | 'on_hold' | 'resolved' | 'all'
  const [viewPreset, setViewPreset] = useState<"all_active" | "sla_risk" | "needs_fe" | "awaiting_ack" | "on_hold" | "resolved" | "all">("all_active");

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [mainconFilter, setMainconFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [partnerFilter, setPartnerFilter] = useState("");
  const [endCustomerFilter, setEndCustomerFilter] = useState("");
  const [feFilter, setFeFilter] = useState("");
  const [slaHealthFilter, setSlaHealthFilter] = useState("");
  const [reportFilter, setReportFilter] = useState("");
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);

  // Sorting states for Ticket Queue
  type SortField =
    | "severity"
    | "ticketRefNo"
    | "clientSiteName"
    | "state"
    | "issueDescription"
    | "assignedTo"
    | "status"
    | "slaDeadline"
    | "reportedAt";
  type SortDirection = "asc" | "desc";

  const [sortField, setSortField] = useState<SortField>("reportedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(field === "reportedAt" ? "desc" : "asc");
    }
  };

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Reset currentPage to 1 when filters or active tab change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchQuery,
    statusFilter,
    stateFilter,
    mainconFilter,
    severityFilter,
    partnerFilter,
    endCustomerFilter,
    feFilter,
    slaHealthFilter,
    reportFilter,
    viewPreset,
    activeTab,
  ]);
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
      const compressed = await compressImage(file, 800, 800, 0.8);
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
      toast.error("Please fill in all core fields (Site Name, State, Maincon)");
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
          toast.success("Ticket updated successfully!");
        } else {
          // Create new Ticket
          await createTicket({
            ticketRefNo: newTicket.autoRefNo ? undefined : newTicket.ticketRefNo || undefined,
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
          toast.success("Ticket created successfully!");
        }

        // Reset state
        setNewTicket({
          clientSiteName: "",
          state: "",
          issueDescription: "",
          mainconId: "",
          customValues: {},
          ticketRefNo: "",
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
        toast.error(
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
          toast.success("Client updated successfully!");
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
          toast.success("Client created successfully!");
        }
        setNewMaincon({ name: "", sheetName: "", customFields: [""], siteCustomersInput: "" });
        setIsMainconModalOpen(false);
      } catch (err) {
        toast.error((editingMainconId !== null ? "Error updating" : "Error creating") + " Maincon: " + (err instanceof Error ? err.message : String(err)));
      }
    });
  };

  const handleCreatePartnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartner.name || newPartner.statesCovered.length === 0) {
      toast.error("Please enter partner name and cover at least 1 state.");
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
          };
          setPartners((prev) =>
            prev.map((p) => (p.id === editingPartnerId ? { ...p, ...mappedUpdated } : p)).sort((a, b) => a.name.localeCompare(b.name))
          );
          setEditingPartnerId(null);
          toast.success("Service Partner updated!");
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
          toast.success("Service Partner created!");
        }
        setNewPartner({ name: "", statesCovered: [] });
        setIsPartnerModalOpen(false);
      } catch (err) {
        toast.error(
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
          toast.success("Field Engineer updated!");
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
          toast.success("Field Engineer registered!");
        }

        setNewFe({ name: "", phone: "", partnerId: "", country: "", region: "", email: "" });
        setIsFeModalOpen(false);
      } catch (err) {
        toast.error(
          (editingFeId !== null ? "Error updating" : "Error registering") +
            " Field Engineer: " +
            (err instanceof Error ? err.message : String(err))
        );
      }
    });
  };

  const handleCopyFeInvite = (engName: string, engEmail: string | null | undefined) => {
    if (!engEmail) {
      toast.error("Please configure an email address for this engineer first.");
      return;
    }
    const origin = window.location.origin;
    const inviteUrl = `${origin}/login?email=${encodeURIComponent(engEmail)}&name=${encodeURIComponent(engName)}&role=FIELD_ENGINEER&mode=signup`;
    
    navigator.clipboard.writeText(inviteUrl)
      .then(() => {
        toast.success(`Invitation link copied for ${engName}!`);
      })
      .catch(() => {
        toast.info(`Direct link: ${inviteUrl}`);
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
        toast.success("Device added to catalog!");
      } catch (err) {
        toast.error("Error creating device: " + (err instanceof Error ? err.message : String(err)));
      }
    });
  };

  const handleCreateSlaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSla.customer || !newSla.severity || !newSla.region || !newSla.slaHours) {
      toast.error("Please fill in all SLA configuration fields");
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
          toast.success("SLA policy updated!");
        } else {
          await createCustomerSla({
            customer: newSla.customer,
            severity: newSla.severity,
            region: newSla.region,
            slaHours: Number(newSla.slaHours),
          });
          toast.success("SLA policy created!");
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
        toast.error("Error saving SLA rule: " + (err instanceof Error ? err.message : String(err)));
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
        toast.success("SLA policy deleted!");
      } catch (err) {
        toast.error("Error deleting SLA configuration: " + (err instanceof Error ? err.message : String(err)));
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

  // Count summaries (Agent only sees their own partner's tickets)
  const visibleTickets = useMemo(() => {
    return user?.role === "AGENT" ? tickets.filter((t) => t.partnerId === user.partnerId) : tickets;
  }, [tickets, user]);

  // Unique end customers extracted from data
  const uniqueEndCustomers = useMemo(() => {
    const set = new Set<string>();
    visibleTickets.forEach((t) => {
      if (t.endCustomer) set.add(t.endCustomer);
    });
    return Array.from(set).sort();
  }, [visibleTickets]);

  // Unique engineers across partners
  const availableEngineers = useMemo(() => {
    const list: { id: number; name: string; partnerName?: string }[] = [];
    partners.forEach((p) => {
      if (user?.role === "AGENT" && p.id !== user.partnerId) return;
      if (p.engineers) {
        p.engineers.forEach((fe) => {
          list.push({ id: fe.id, name: fe.name, partnerName: p.name });
        });
      }
    });
    return list;
  }, [partners, user]);

  // Preset Counts for the 1-click View Tabs
  const presetCounts = useMemo(() => {
    const nowTime = Date.now();
    let allActive = 0;
    let slaRisk = 0;
    let needsFe = 0;
    let awaitingAck = 0;
    let onHold = 0;
    let resolved = 0;

    visibleTickets.forEach((t) => {
      const isActive = ["NEW", "IN_PROGRESS", "ON_HOLD", "FOLLOW_UP"].includes(t.status);
      const isResolved = ["RESOLVED", "COMPLETE", "CLOSED"].includes(t.status);

      if (isActive) allActive++;
      if (isResolved) resolved++;

      if (isActive && t.slaDeadline) {
        const deadline = new Date(t.slaDeadline).getTime();
        if (!t.slaPaused && deadline - nowTime <= 2 * 60 * 60 * 1000) {
          slaRisk++;
        }
      }

      if (isActive && t.partnerId && !t.assignedFeId) {
        needsFe++;
      }

      if (isActive && t.assignedFeId && (t.feAcknowledgeStatus === "PENDING" || !t.feAcknowledgeStatus)) {
        awaitingAck++;
      }

      if (t.status === "ON_HOLD" || t.slaPaused) {
        onHold++;
      }
    });

    return {
      allActive,
      slaRisk,
      needsFe,
      awaitingAck,
      onHold,
      resolved,
      all: visibleTickets.length,
    };
  }, [visibleTickets]);

  // Comprehensive multi-dimensional filtering
  const filteredTickets = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const nowTime = Date.now();

    return visibleTickets.filter((t) => {
      // 1. Preset filter
      const isActive = ["NEW", "IN_PROGRESS", "ON_HOLD", "FOLLOW_UP"].includes(t.status);
      const isResolved = ["RESOLVED", "COMPLETE", "CLOSED"].includes(t.status);

      if (viewPreset === "all_active" && !isActive) return false;
      if (viewPreset === "resolved" && !isResolved) return false;
      if (viewPreset === "on_hold" && !(t.status === "ON_HOLD" || t.slaPaused)) return false;
      if (viewPreset === "needs_fe" && !(isActive && t.partnerId && !t.assignedFeId)) return false;
      if (viewPreset === "awaiting_ack" && !(isActive && t.assignedFeId && (t.feAcknowledgeStatus === "PENDING" || !t.feAcknowledgeStatus))) return false;
      if (viewPreset === "sla_risk") {
        if (!isActive || !t.slaDeadline || t.slaPaused) return false;
        const deadline = new Date(t.slaDeadline).getTime();
        if (deadline - nowTime > 2 * 60 * 60 * 1000) return false;
      }

      // 2. Global Universal Search
      if (query) {
        const matchRef = t.ticketRefNo && t.ticketRefNo.toLowerCase().includes(query);
        const matchSite = t.clientSiteName && t.clientSiteName.toLowerCase().includes(query);
        const matchIssue = t.issueDescription && t.issueDescription.toLowerCase().includes(query);
        const matchState = t.state && t.state.toLowerCase().includes(query);
        const matchMaincon = t.maincon && t.maincon.name.toLowerCase().includes(query);
        const matchPartner = t.partner && t.partner.name.toLowerCase().includes(query);
        const matchFe = t.assignedFe && t.assignedFe.name.toLowerCase().includes(query);
        const matchEndCustomer = t.endCustomer && t.endCustomer.toLowerCase().includes(query);
        const matchDevice = t.device && `${t.device.brand} ${t.device.model}`.toLowerCase().includes(query);
        const matchSerial = t.defectiveSerial && t.defectiveSerial.toLowerCase().includes(query);

        if (!matchRef && !matchSite && !matchIssue && !matchState && !matchMaincon && !matchPartner && !matchFe && !matchEndCustomer && !matchDevice && !matchSerial) {
          return false;
        }
      }

      // 3. Status filter
      if (statusFilter && t.status !== statusFilter) return false;

      // 4. Severity filter
      if (severityFilter && t.severity !== severityFilter) return false;

      // 5. Maincon filter
      if (mainconFilter && String(t.mainconId) !== mainconFilter) return false;

      // 6. State filter
      if (stateFilter && t.state !== stateFilter) return false;

      // 7. Partner filter
      if (partnerFilter && String(t.partnerId) !== partnerFilter) return false;

      // 8. End Customer filter
      if (endCustomerFilter && t.endCustomer !== endCustomerFilter) return false;

      // 9. Field Engineer filter
      if (feFilter === "unassigned") {
        if (t.assignedFeId) return false;
      } else if (feFilter && String(t.assignedFeId) !== feFilter) {
        return false;
      }

      // 10. SLA Health filter
      if (slaHealthFilter) {
        if (!t.slaDeadline) return false;
        const deadline = new Date(t.slaDeadline).getTime();
        if (slaHealthFilter === "paused" && !t.slaPaused) return false;
        if (slaHealthFilter === "breached" && (t.slaPaused || nowTime <= deadline)) return false;
        if (slaHealthFilter === "at_risk" && (t.slaPaused || nowTime > deadline || deadline - nowTime > 2 * 60 * 60 * 1000)) return false;
        if (slaHealthFilter === "on_track" && (t.slaPaused || deadline - nowTime <= 2 * 60 * 60 * 1000)) return false;
      }

      // 11. Service Report filter
      if (reportFilter === "has_report" && !t.serviceReportUrl) return false;
      if (reportFilter === "no_report" && t.serviceReportUrl) return false;

      return true;
    })
    .sort((a, b) => {
      let comp = 0;
      if (sortField === "severity") {
        const rank: Record<string, number> = { P1: 1, P2: 2, P3: 3, P4: 4 };
        const rankA = a.severity ? rank[a.severity] || 5 : 5;
        const rankB = b.severity ? rank[b.severity] || 5 : 5;
        comp = rankA - rankB;
      } else if (sortField === "ticketRefNo") {
        const refA = a.ticketRefNo || String(a.id);
        const refB = b.ticketRefNo || String(b.id);
        comp = refA.localeCompare(refB, undefined, { numeric: true });
      } else if (sortField === "clientSiteName") {
        comp = a.clientSiteName.localeCompare(b.clientSiteName);
      } else if (sortField === "state") {
        comp = (a.state || "").localeCompare(b.state || "");
      } else if (sortField === "issueDescription") {
        comp = (a.issueDescription || "").localeCompare(b.issueDescription || "");
      } else if (sortField === "assignedTo") {
        const nameA = a.assignedFe?.name || a.partner?.name || "";
        const nameB = b.assignedFe?.name || b.partner?.name || "";
        comp = nameA.localeCompare(nameB);
      } else if (sortField === "status") {
        const statusOrder: Record<string, number> = {
          NEW: 1,
          IN_PROGRESS: 2,
          FOLLOW_UP: 3,
          ON_HOLD: 4,
          RESOLVED: 5,
          COMPLETE: 6,
          CLOSED: 7,
        };
        const orderA = statusOrder[a.status] || 99;
        const orderB = statusOrder[b.status] || 99;
        comp = orderA - orderB;
      } else if (sortField === "slaDeadline") {
        const timeA = a.slaDeadline ? new Date(a.slaDeadline).getTime() : 9999999999999;
        const timeB = b.slaDeadline ? new Date(b.slaDeadline).getTime() : 9999999999999;
        comp = timeA - timeB;
      } else if (sortField === "reportedAt") {
        const timeA = new Date(a.reportedAt || a.createdAt).getTime();
        const timeB = new Date(b.reportedAt || b.createdAt).getTime();
        comp = timeA - timeB;
      }

      return sortDirection === "asc" ? comp : -comp;
    });
  }, [
    visibleTickets,
    viewPreset,
    searchQuery,
    statusFilter,
    severityFilter,
    mainconFilter,
    stateFilter,
    partnerFilter,
    endCustomerFilter,
    feFilter,
    slaHealthFilter,
    reportFilter,
    sortField,
    sortDirection,
  ]);

  const activeFiltersCount = [
    statusFilter,
    severityFilter,
    mainconFilter,
    stateFilter,
    partnerFilter,
    endCustomerFilter,
    feFilter,
    slaHealthFilter,
    reportFilter,
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setSearchQuery("");
    setStatusFilter("");
    setSeverityFilter("");
    setMainconFilter("");
    setStateFilter("");
    setPartnerFilter("");
    setEndCustomerFilter("");
    setFeFilter("");
    setSlaHealthFilter("");
    setReportFilter("");
    setViewPreset("all_active");
  };

  const totalPages = Math.ceil(filteredTickets.length / pageSize) || 1;

  // Adjust currentPage if it exceeds totalPages
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [filteredTickets.length, pageSize, totalPages, currentPage]);

  const paginatedTickets = filteredTickets.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      if (start > 2) {
        pages.push("...");
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (end < totalPages - 1) {
        pages.push("...");
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  // Configure navigation items based on user role
  interface NavItem {
    id: "tickets" | "analytics" | "inventory" | "maincons" | "partners" | "devices" | "slas" | "users" | "team" | "profile" | "agency-profile";
    label: string;
    icon: React.ReactNode;
  }

  const getNavItems = (): NavItem[] => {
    const items: NavItem[] = [];

    // All active users get Tickets Queue & Analytics Dashboard
    items.push(
      {
        id: "tickets",
        label: "Tickets Queue",
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
          </svg>
        ),
      },
      {
        id: "analytics",
        label: "Dashboard & Metrics",
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ),
      }
    );

    if (user?.role === "SUPERADMIN" || user?.role === "MODERATOR" || user?.role === "AGENT") {
      items.push({
        id: "inventory",
        label: "Inventory & Spares",
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        ),
      });
    }

    if (user?.role === "SUPERADMIN" || user?.role === "MODERATOR") {
      items.push(
        {
          id: "maincons",
          label: "Clients",
          icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          ),
        },
        {
          id: "partners",
          label: "Service Partners",
          icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          ),
        },
        {
          id: "devices",
          label: "Device Catalog",
          icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          ),
        },
        {
          id: "slas",
          label: "SLA Configurations",
          icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        }
      );

      if (user?.role === "SUPERADMIN") {
        items.push({
          id: "users",
          label: "Users & Roles",
          icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ),
        });
      }
    }

    if (user?.role === "AGENT") {
      items.push(
        {
          id: "team",
          label: "My Team",
          icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          ),
        },
        {
          id: "agency-profile",
          label: "Agency Profile",
          icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          ),
        }
      );
    }

    items.push({
      id: "profile",
      label: "Profile Settings",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    });

    return items;
  };

  const renderPaginationFooter = (
    totalCount: number,
    labelSingular: string,
    labelPlural: string
  ) => {
    const totalPagesCount = Math.ceil(totalCount / pageSize) || 1;

    const getPageNumbersForTotal = (total: number) => {
      const totalPages = Math.ceil(total / pageSize) || 1;
      const pages: (number | string)[] = [];

      if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        const start = Math.max(2, currentPage - 2);
        const end = Math.min(totalPages - 1, currentPage + 2);

        if (start > 2) pages.push("...");
        for (let i = start; i <= end; i++) pages.push(i);
        if (end < totalPages - 1) pages.push("...");
        pages.push(totalPages);
      }
      return pages;
    };

    return (
      <div className="border-t border-card-border bg-slate-50/50 dark:bg-slate-950/40 px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Left: summary info */}
        <div className="text-xs text-muted-text">
          Showing{" "}
          <span className="font-semibold text-foreground">
            {totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1}
          </span>{" "}
          to{" "}
          <span className="font-semibold text-foreground">
            {Math.min(currentPage * pageSize, totalCount)}
          </span>{" "}
          of{" "}
          <span className="font-semibold text-foreground">
            {totalCount}
          </span>{" "}
          {totalCount === 1 ? labelSingular : labelPlural}
        </div>

        {/* Center/Right: Page navigation */}
        <div className="flex items-center gap-4">
          {/* Page Size Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-text">Show:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2.5 py-1 bg-input-bg border border-card-border rounded-xl text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-505 cursor-pointer font-semibold"
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          {/* Page Numbers */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-1.5 border border-card-border rounded-xl bg-card hover:bg-slate-100 dark:hover:bg-slate-800/80 text-muted-text hover:text-foreground disabled:opacity-50 disabled:pointer-events-none transition-all cursor-pointer"
              title="Previous Page"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {getPageNumbersForTotal(totalCount).map((pageNum, index) => {
              if (pageNum === "...") {
                return (
                  <span key={`ellipsis-${index}`} className="px-2 py-1 text-xs text-muted-text font-bold select-none">
                    ...
                  </span>
                );
              }
              return (
                <button
                  key={`page-${pageNum}`}
                  onClick={() => setCurrentPage(Number(pageNum))}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    currentPage === pageNum
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                      : "border border-card-border bg-card hover:bg-slate-100 dark:hover:bg-slate-800/80 text-muted-text hover:text-foreground"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPagesCount))}
              disabled={currentPage === totalPagesCount}
              className="p-1.5 border border-card-border rounded-xl bg-card hover:bg-slate-100 dark:hover:bg-slate-800/80 text-muted-text hover:text-foreground disabled:opacity-50 disabled:pointer-events-none transition-all cursor-pointer"
              title="Next Page"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Visible ticket count for agent/superadmin
  const totalCount = visibleTickets.length;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans antialiased flex overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-indigo-500/5 dark:from-indigo-900/10 via-background to-transparent pointer-events-none" />

      {/* 1. Desktop Sidebar (Slim Icon Rail by default, expandable on toggle) */}
      <aside className={`hidden md:flex flex-col bg-card border-r border-card-border h-screen md:fixed md:left-0 md:top-0 md:bottom-0 z-40 flex-shrink-0 transition-all duration-300 ${
        isSidebarExpanded ? "w-60" : "w-[68px]"
      }`}>
        {/* Brand Logo & Collapse Toggle */}
        <div className="h-[73px] px-3.5 border-b border-card-border flex items-center justify-between flex-shrink-0">
          <div
            className="flex items-center gap-3 overflow-hidden cursor-pointer"
            onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
            title={!isSidebarExpanded ? "Expand Sidebar (TicketLink)" : undefined}
          >
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-blue-100 dark:border-blue-900/40 shadow-sm flex-shrink-0">
              <img src="/logo.jpg" alt="TicketLink Logo" className="w-full h-full object-cover" />
            </div>
            {isSidebarExpanded && (
              <div className="animate-in fade-in duration-200">
                <h1 className="text-base font-bold tracking-tight bg-gradient-to-r from-slate-950 via-slate-800 to-slate-600 dark:from-white dark:via-slate-100 dark:to-slate-400 bg-clip-text text-transparent leading-none">
                  Ticket<span className="text-teal-500">Link</span>
                </h1>
                <span className="text-[10px] text-teal-500 font-semibold tracking-wider uppercase mt-1 block">Dispatch Hub</span>
              </div>
            )}
          </div>
          {isSidebarExpanded && (
            <button
              onClick={() => setIsSidebarExpanded(false)}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-muted-text hover:text-foreground cursor-pointer transition-all"
              title="Collapse Sidebar"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          )}
        </div>

        {/* Sidebar Nav Items */}
        <nav className="flex-1 px-2.5 py-4 space-y-1.5 overflow-y-auto">
          {getNavItems().map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                title={!isSidebarExpanded ? item.label : undefined}
                className={`w-full flex items-center rounded-xl text-xs font-bold transition-all cursor-pointer group relative ${
                  isSidebarExpanded ? "gap-3 px-3 py-2.5" : "justify-center p-3"
                } ${
                  isActive
                    ? "bg-indigo-50/80 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40 shadow-sm"
                    : "text-muted-text hover:text-foreground hover:bg-slate-100/70 dark:hover:bg-slate-800/50"
                }`}
              >
                <span className={`flex-shrink-0 transition-transform group-hover:scale-110 ${isActive ? "text-indigo-600 dark:text-indigo-400" : "text-muted-text"}`}>
                  {item.icon}
                </span>
                {isSidebarExpanded && <span className="truncate">{item.label}</span>}

                {/* Floating tooltip for slim mode */}
                {!isSidebarExpanded && (
                  <span className="absolute left-full ml-3 px-2.5 py-1 bg-slate-900 text-white text-xs font-medium rounded-lg shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Bottom Expand/Collapse Toggle & Profile */}
        <div className="p-3 border-t border-card-border bg-slate-50/50 dark:bg-slate-950/20 flex flex-col gap-2">
          {!isSidebarExpanded ? (
            <button
              onClick={() => setIsSidebarExpanded(true)}
              className="w-full flex items-center justify-center p-2 rounded-xl text-muted-text hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              title="Expand Sidebar"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          ) : null}

          <div className={`flex items-center ${isSidebarExpanded ? "gap-3" : "justify-center"}`}>
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-indigo-500 text-white flex items-center justify-center font-bold text-xs shadow-sm flex-shrink-0">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span>{user?.name?.charAt(0).toUpperCase() || "?"}</span>
              )}
            </div>
            {isSidebarExpanded && (
              <div className="min-w-0 flex-1 animate-in fade-in duration-200">
                <p className="text-xs font-bold text-foreground truncate leading-tight">
                  {user?.name || user?.email}
                </p>
                <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider mt-0.5 leading-none">
                  {user?.role}
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* 2. Mobile Sidebar Sliding Drawer */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileSidebarOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="relative flex flex-col w-64 max-w-xs bg-card border-r border-card-border h-full shadow-2xl animate-in slide-in-from-left duration-200">
            {/* Brand Logo */}
            <div className="p-6 border-b border-card-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl overflow-hidden border border-blue-100 shadow-sm flex-shrink-0">
                  <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover" />
                </div>
                <h1 className="text-sm font-bold tracking-tight bg-gradient-to-r from-slate-950 via-slate-800 to-slate-600 dark:from-white dark:via-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
                  Ticket<span className="text-teal-500">Link</span>
                </h1>
              </div>
              <button
                onClick={() => setIsMobileSidebarOpen(false)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-muted-text cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Mobile Nav Menu */}
            <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
              {getNavItems().map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMobileSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? "bg-indigo-50/70 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400 border-l-4 border-indigo-600 dark:border-indigo-400 pl-2"
                        : "text-muted-text hover:text-foreground hover:bg-slate-100/50 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    <span className={isActive ? "text-indigo-600 dark:text-indigo-400" : "text-muted-text"}>
                      {item.icon}
                    </span>
                    {item.label}
                  </button>
                );
              })}
            </nav>

            {/* Mobile Sidebar Footer Profile */}
            <div className="p-4 border-t border-card-border bg-slate-50/50 dark:bg-slate-950/20">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg overflow-hidden bg-indigo-500 text-white flex items-center justify-center font-bold text-xs shadow-sm flex-shrink-0">
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span>{user?.name?.charAt(0).toUpperCase() || "?"}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-foreground truncate leading-tight">
                    {user?.name || user?.email}
                  </p>
                  <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider mt-0.5 leading-none">
                    {user?.role}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Main Workspace Panel */}
      <div className={`flex-1 flex flex-col min-w-0 h-screen overflow-hidden transition-all duration-300 ${
        isSidebarExpanded ? "md:pl-60" : "md:pl-[68px]"
      }`}>
        {/* Workspace Sticky Header */}
        <header className="h-[73px] border-b border-card-border bg-background/80 backdrop-blur-md sticky top-0 z-30 px-6 flex items-center justify-between gap-4 flex-shrink-0">
          {/* Left: Mobile hamburger menu & active tab title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden p-2 border border-card-border hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-xl transition-all text-muted-text cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h2 className="text-lg font-bold capitalize text-foreground leading-none">
              {getNavItems().find((item) => item.id === activeTab)?.label || activeTab}
            </h2>
          </div>

          {/* Right: Quick actions, Theme, Profile */}
          <div className="flex items-center gap-3">
            {/* Create Ticket quick action (desktop only, for superadmin/moderator) */}
            {(user?.role === "SUPERADMIN" || user?.role === "MODERATOR") && (
              <button
                onClick={() => router.push("/tickets/new")}
                className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all text-white font-medium rounded-xl text-xs shadow-md shadow-indigo-600/20 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                Create Ticket
              </button>
            )}

            <button
              onClick={refreshData}
              className="p-2 border border-indigo-100 bg-indigo-50/50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 dark:border-indigo-950 dark:bg-indigo-950/25 dark:text-indigo-400 dark:hover:bg-indigo-950/50 rounded-xl transition-all cursor-pointer shadow-sm"
              title="Refresh Data"
            >
              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3 3 3m-3-3v12" />
              </svg>
            </button>

            <ThemeToggle />

            {/* Profile Dropdown Menu */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowUserMenu(!showUserMenu);
                }}
                className="flex items-center gap-2 pl-2.5 border-l border-card-border ml-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/60 dark:hover:bg-slate-900 px-3 py-1.5 rounded-xl border transition-all cursor-pointer select-none text-left"
              >
                <div className="w-8 h-8 rounded-lg overflow-hidden bg-indigo-500 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span>{user?.name?.charAt(0).toUpperCase() || "?"}</span>
                  )}
                </div>
                <div className="hidden lg:flex flex-col items-start pr-1">
                  <span className="text-[10.5px] font-bold text-foreground truncate max-w-[100px] leading-tight">
                    {user?.name || user?.email}
                  </span>
                  <span className="text-[8px] text-indigo-400 font-bold uppercase tracking-wider mt-0.5 leading-none">
                    {user?.role}
                  </span>
                </div>
                <svg className={`w-3 h-3 text-muted-text transition-transform duration-200 ${showUserMenu ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                  <button
                    onClick={() => {
                      setActiveTab("tickets");
                      setShowUserMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-900 text-foreground flex items-center gap-2"
                  >
                    🎫 Tickets Desk
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

        {/* Fluid Content Pane with widescreen optimization */}
        <main className="flex-1 w-full max-w-[1920px] mx-auto px-6 lg:px-10 py-8 relative overflow-y-auto">
        {/* Tab Contents: Analytics / Dashboard */}
        {activeTab === "analytics" && (
          <AnalyticsDashboardTab
            tickets={visibleTickets}
            maincons={maincons}
            partners={partners}
            devices={devices}
            slas={slas}
          />
        )}

        {/* Tab Contents: Inventory & Spare Parts */}
        {activeTab === "inventory" && (
          <InventoryTab
            initialItems={inventoryItems}
            initialWarehouses={warehouses}
            initialPendingTickets={pendingPartsTickets}
            userRole={user?.role}
            userName={user?.name || user?.email || "Admin"}
            onRefresh={async () => {
              try {
                const [freshItems, freshWhs, freshPending] = await Promise.all([
                  getInventoryItems(),
                  getWarehouses(),
                  getPendingPartsRequests(),
                ]);
                setInventoryItems(freshItems);
                setWarehouses(freshWhs);
                setPendingPartsTickets(freshPending);
              } catch (err) {
                console.error("Failed to refresh inventory:", err);
              }
            }}
            onOpenTicket={(ticketId) => {
              router.push(`/tickets/${ticketId}`);
            }}
          />
        )}

        {/* Section Action Buttons (Rendered at top-right of page if relevant) */}
        {["maincons", "partners", "devices", "slas"].includes(activeTab) && (
          <div className="flex justify-end mb-6">
            <div className="flex flex-wrap items-center gap-2">
              {activeTab === "maincons" && (
                <button
                  onClick={() => setIsMainconModalOpen(true)}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl border border-transparent inline-flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  Register Client
                </button>
              )}
              {activeTab === "partners" && (
                <>
                  <button
                    onClick={() => setIsPartnerModalOpen(true)}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl border border-transparent inline-flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                    Register Partner
                  </button>
                  <button
                    onClick={() => setIsFeModalOpen(true)}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl border border-transparent inline-flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                    Register Engineer
                  </button>
                </>
              )}
              {activeTab === "devices" && (
                <button
                  onClick={() => setIsDeviceModalOpen(true)}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl border border-transparent inline-flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Device to Catalog
                </button>
              )}
              {activeTab === "slas" && (
                <button
                  onClick={() => setIsSlaModalOpen(true)}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl border border-transparent inline-flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  Add SLA Rule
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tab Contents: Tickets */}
        {activeTab === "tickets" && (
          <div>
            {/* Zendesk / ServiceNow-style Quick View Presets & Multi-Dimensional Filter Bar */}
            <div className="space-y-3 mb-5">
              {/* 1. Quick View Preset Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs select-none">
                {[
                  { id: "all_active" as const, label: "Active Queue", count: presetCounts.allActive, icon: "🔥", badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
                  { id: "sla_risk" as const, label: "SLA At Risk / Breached", count: presetCounts.slaRisk, icon: "🚨", badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
                  { id: "needs_fe" as const, label: "Needs Dispatch", count: presetCounts.needsFe, icon: "⏳", badgeClass: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
                  { id: "awaiting_ack" as const, label: "Awaiting FE Ack", count: presetCounts.awaitingAck, icon: "👤", badgeClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
                  { id: "on_hold" as const, label: "On Hold", count: presetCounts.onHold, icon: "⏸️", badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
                  { id: "resolved" as const, label: "Resolved & Closed", count: presetCounts.resolved, icon: "✅", badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
                  { id: "all" as const, label: "All Tickets", count: presetCounts.all, icon: "📋", badgeClass: "bg-slate-100 dark:bg-slate-800 text-muted-text" },
                ].map((tab) => {
                  const isActive = viewPreset === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setViewPreset(tab.id)}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer border ${
                        isActive
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-600/20"
                          : "bg-card border-card-border text-muted-text hover:text-foreground hover:bg-slate-100/60 dark:hover:bg-slate-800/40"
                      }`}
                    >
                      <span>{tab.icon}</span>
                      <span>{tab.label}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-md font-extrabold ${
                          isActive ? "bg-white/20 text-white" : tab.badgeClass
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* 2. Primary Filter Bar */}
              <div className="p-3.5 bg-card border border-card-border rounded-2xl shadow-sm space-y-3">
                <div className="flex flex-col md:flex-row items-center gap-3">
                  {/* Global Search Input */}
                  <div className="relative w-full md:w-80">
                    <svg className="w-4 h-4 text-muted-text absolute left-3 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search ref, site, issue, FE, device..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 bg-input-bg border border-card-border rounded-xl text-foreground placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2.5 top-2.5 text-muted-text hover:text-foreground p-0.5"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Primary Dropdowns */}
                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto flex-1">
                    {/* Status */}
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-2.5 py-1.5 bg-input-bg border border-card-border rounded-xl text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500/30 cursor-pointer"
                    >
                      <option value="">All Statuses</option>
                      <option value="NEW">New</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="ON_HOLD">On Hold</option>
                      <option value="FOLLOW_UP">Follow Up</option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="COMPLETE">Complete</option>
                      <option value="CLOSED">Closed</option>
                    </select>

                    {/* Severity */}
                    <select
                      value={severityFilter}
                      onChange={(e) => setSeverityFilter(e.target.value)}
                      className="px-2.5 py-1.5 bg-input-bg border border-card-border rounded-xl text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500/30 cursor-pointer"
                    >
                      <option value="">All Severity</option>
                      <option value="P1">P1 - Critical</option>
                      <option value="P2">P2 - High</option>
                      <option value="P3">P3 - Medium</option>
                      <option value="P4">P4 - Low</option>
                    </select>

                    {/* Client / Maincon */}
                    <select
                      value={mainconFilter}
                      onChange={(e) => setMainconFilter(e.target.value)}
                      className="px-2.5 py-1.5 bg-input-bg border border-card-border rounded-xl text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500/30 cursor-pointer"
                    >
                      <option value="">All Clients</option>
                      {maincons.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>

                    {/* State */}
                    <select
                      value={stateFilter}
                      onChange={(e) => setStateFilter(e.target.value)}
                      className="px-2.5 py-1.5 bg-input-bg border border-card-border rounded-xl text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500/30 cursor-pointer"
                    >
                      <option value="">All States</option>
                      {states.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>

                    {/* More Filters Toggle */}
                    <button
                      onClick={() => setIsMoreFiltersOpen(!isMoreFiltersOpen)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                        isMoreFiltersOpen || activeFiltersCount > 0
                          ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400"
                          : "bg-input-bg border-card-border text-muted-text hover:text-foreground"
                      }`}
                    >
                      <span>⚙️</span>
                      <span>Filters</span>
                      {activeFiltersCount > 0 && (
                        <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center">
                          {activeFiltersCount}
                        </span>
                      )}
                    </button>

                    {/* Clear All Filters */}
                    {(activeFiltersCount > 0 || searchQuery || viewPreset !== "all_active") && (
                      <button
                        onClick={clearAllFilters}
                        className="px-2.5 py-1.5 text-xs font-bold text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer"
                      >
                        Reset All ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* 3. Collapsible Advanced Filters Drawer */}
                {isMoreFiltersOpen && (
                  <div className="pt-3 border-t border-card-border grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 animate-in fade-in slide-in-from-top-1 duration-150 text-xs">
                    {/* Service Partner (Superadmin/Moderator) */}
                    {user?.role !== "AGENT" && (
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-muted-text mb-1">Service Partner</label>
                        <select
                          value={partnerFilter}
                          onChange={(e) => setPartnerFilter(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-input-bg border border-card-border rounded-xl text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
                        >
                          <option value="">All Partners</option>
                          {partners.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* End Customer Group */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-muted-text mb-1">End Customer</label>
                      <select
                        value={endCustomerFilter}
                        onChange={(e) => setEndCustomerFilter(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-input-bg border border-card-border rounded-xl text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
                      >
                        <option value="">All End Customers</option>
                        {uniqueEndCustomers.map((cust) => (
                          <option key={cust} value={cust}>
                            {cust}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Field Engineer */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-muted-text mb-1">Field Engineer</label>
                      <select
                        value={feFilter}
                        onChange={(e) => setFeFilter(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-input-bg border border-card-border rounded-xl text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
                      >
                        <option value="">All Engineers</option>
                        <option value="unassigned">⏳ Unassigned (No FE)</option>
                        {availableEngineers.map((fe) => (
                          <option key={fe.id} value={fe.id}>
                            {fe.name} {user?.role !== "AGENT" && fe.partnerName ? `(${fe.partnerName})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* SLA Health Status */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-muted-text mb-1">SLA Health</label>
                      <select
                        value={slaHealthFilter}
                        onChange={(e) => setSlaHealthFilter(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-input-bg border border-card-border rounded-xl text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
                      >
                        <option value="">All SLA Statuses</option>
                        <option value="breached">🔴 Breached (Overdue)</option>
                        <option value="at_risk">🟡 At Risk (&lt; 2h Remaining)</option>
                        <option value="paused">⏸️ Paused (On Hold)</option>
                        <option value="on_track">🟢 On Track</option>
                      </select>
                    </div>

                    {/* Service Report */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-muted-text mb-1">Service Report</label>
                      <select
                        value={reportFilter}
                        onChange={(e) => setReportFilter(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-input-bg border border-card-border rounded-xl text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
                      >
                        <option value="">All Reports</option>
                        <option value="has_report">📄 Uploaded</option>
                        <option value="no_report">❌ Missing</option>
                      </select>
                    </div>
                  </div>
                )}
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
                    {/* ServiceNow / Zendesk-style High Density 1-Row Table Header */}
                    <div className="overflow-x-auto">
                      <div
                        className="grid items-center gap-3 px-4 py-3 border-b border-card-border bg-slate-50/90 dark:bg-slate-950/80 text-[11px] font-bold uppercase tracking-wider text-muted-text select-none min-w-[1050px]"
                        style={{
                          gridTemplateColumns:
                            user?.role === "AGENT"
                              ? "40px 65px 130px 170px 95px 1fr 150px 115px 125px 95px 65px"
                              : "40px 65px 130px 170px 95px 1fr 160px 115px 125px 95px 75px",
                        }}
                      >
                        <span className="pl-1">#</span>

                        {/* Severity */}
                        <div
                          onClick={() => handleSort("severity")}
                          className="flex items-center justify-center gap-1 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 group transition-colors"
                          title="Sort by Severity"
                        >
                          <span>Severity</span>
                          <span className={sortField === "severity" ? "text-indigo-600 dark:text-indigo-400 font-bold" : "opacity-0 group-hover:opacity-40"}>
                            {sortField === "severity" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                          </span>
                        </div>

                        {/* Ticket Ref */}
                        <div
                          onClick={() => handleSort("ticketRefNo")}
                          className="flex items-center gap-1 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 group transition-colors"
                          title="Sort by Ref Number"
                        >
                          <span>Ticket Ref</span>
                          <span className={sortField === "ticketRefNo" ? "text-indigo-600 dark:text-indigo-400 font-bold" : "opacity-0 group-hover:opacity-40"}>
                            {sortField === "ticketRefNo" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                          </span>
                        </div>

                        {/* Client / Site */}
                        <div
                          onClick={() => handleSort("clientSiteName")}
                          className="flex items-center gap-1 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 group transition-colors"
                          title="Sort by Site Name"
                        >
                          <span>Client / Site</span>
                          <span className={sortField === "clientSiteName" ? "text-indigo-600 dark:text-indigo-400 font-bold" : "opacity-0 group-hover:opacity-40"}>
                            {sortField === "clientSiteName" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                          </span>
                        </div>

                        {/* State */}
                        <div
                          onClick={() => handleSort("state")}
                          className="flex items-center gap-1 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 group transition-colors"
                          title="Sort by State"
                        >
                          <span>State</span>
                          <span className={sortField === "state" ? "text-indigo-600 dark:text-indigo-400 font-bold" : "opacity-0 group-hover:opacity-40"}>
                            {sortField === "state" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                          </span>
                        </div>

                        {/* Issue Summary */}
                        <div
                          onClick={() => handleSort("issueDescription")}
                          className="flex items-center gap-1 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 group transition-colors"
                          title="Sort by Issue"
                        >
                          <span>Issue Summary</span>
                          <span className={sortField === "issueDescription" ? "text-indigo-600 dark:text-indigo-400 font-bold" : "opacity-0 group-hover:opacity-40"}>
                            {sortField === "issueDescription" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                          </span>
                        </div>

                        {/* Assigned To */}
                        <div
                          onClick={() => handleSort("assignedTo")}
                          className="flex items-center gap-1 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 group transition-colors"
                          title="Sort by Assignee"
                        >
                          <span>Assigned To</span>
                          <span className={sortField === "assignedTo" ? "text-indigo-600 dark:text-indigo-400 font-bold" : "opacity-0 group-hover:opacity-40"}>
                            {sortField === "assignedTo" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                          </span>
                        </div>

                        {/* Status */}
                        <div
                          onClick={() => handleSort("status")}
                          className="flex items-center justify-center gap-1 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 group transition-colors"
                          title="Sort by Status"
                        >
                          <span>Status</span>
                          <span className={sortField === "status" ? "text-indigo-600 dark:text-indigo-400 font-bold" : "opacity-0 group-hover:opacity-40"}>
                            {sortField === "status" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                          </span>
                        </div>

                        {/* SLA Countdown */}
                        <div
                          onClick={() => handleSort("slaDeadline")}
                          className="flex items-center justify-center gap-1 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 group transition-colors"
                          title="Sort by SLA Deadline"
                        >
                          <span>SLA Countdown</span>
                          <span className={sortField === "slaDeadline" ? "text-indigo-600 dark:text-indigo-400 font-bold" : "opacity-0 group-hover:opacity-40"}>
                            {sortField === "slaDeadline" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                          </span>
                        </div>

                        {/* Reported */}
                        <div
                          onClick={() => handleSort("reportedAt")}
                          className="flex items-center justify-end gap-1 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 group transition-colors pr-1"
                          title="Sort by Reported Date"
                        >
                          <span>Reported</span>
                          <span className={sortField === "reportedAt" ? "text-indigo-600 dark:text-indigo-400 font-bold" : "opacity-0 group-hover:opacity-40"}>
                            {sortField === "reportedAt" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                          </span>
                        </div>

                        <span className="text-right pr-1">Actions</span>
                      </div>

                      {/* Single-Row Ticket Items */}
                      <div className="divide-y divide-card-border/40 min-w-[1050px]">
                        {paginatedTickets.map((t, idx) => {
                          const isActive = t.status === "NEW" || t.status === "IN_PROGRESS" || t.status === "FOLLOW_UP";

                          let rowAnimationClass = "";
                          if (isActive && t.slaDeadline) {
                            const deadline = new Date(t.slaDeadline);
                            const diffMs = deadline.getTime() - Date.now();
                            if (diffMs < 0) {
                              rowAnimationClass = "bg-rose-500/5 hover:bg-rose-500/10";
                            } else if (diffMs < 2 * 60 * 60 * 1000) {
                              rowAnimationClass = "bg-amber-500/5 hover:bg-amber-500/10";
                            }
                          }

                          const statusConfig: Record<string, { label: string; dot: string; badge: string }> = {
                            NEW: {
                              label: "New",
                              dot: "bg-sky-500",
                              badge: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
                            },
                            IN_PROGRESS: {
                              label: "In Progress",
                              dot: "bg-amber-500",
                              badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                            },
                            ON_HOLD: {
                              label: "On Hold",
                              dot: "bg-orange-500",
                              badge: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
                            },
                            RESOLVED: {
                              label: "Resolved",
                              dot: "bg-emerald-500",
                              badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
                            },
                            FOLLOW_UP: {
                              label: "Follow Up",
                              dot: "bg-fuchsia-500",
                              badge: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/20",
                            },
                            COMPLETE: {
                              label: "Complete",
                              dot: "bg-teal-500",
                              badge: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
                            },
                            CLOSED: {
                              label: "Closed",
                              dot: "bg-slate-500",
                              badge: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
                            },
                          };
                          const sc = statusConfig[t.status] || statusConfig["NEW"];

                          return (
                            <div
                              key={t.id}
                              onClick={() => router.push(`/tickets/${t.id}`)}
                              className={`grid items-center gap-3 px-4 py-2.5 cursor-pointer transition-all hover:bg-slate-100/70 dark:hover:bg-indigo-950/20 text-xs group ${rowAnimationClass} ${
                                idx % 2 === 0 ? "bg-card" : "bg-slate-50/40 dark:bg-slate-950/20"
                              }`}
                              style={{
                                gridTemplateColumns:
                                  user?.role === "AGENT"
                                    ? "40px 65px 130px 170px 95px 1fr 150px 115px 125px 95px 65px"
                                    : "40px 65px 130px 170px 95px 1fr 160px 115px 125px 95px 75px",
                              }}
                            >
                              {/* 1. Index No. */}
                              <div className="font-mono text-[11px] text-muted-text font-semibold pl-1">
                                {(currentPage - 1) * pageSize + idx + 1}
                              </div>

                              {/* 2. Priority/Severity Badge */}
                              <div className="flex justify-center">
                                {renderSeverityBadge(t.severity)}
                              </div>

                              {/* 3. Ticket Ref */}
                              <div className="min-w-0">
                                <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono group-hover:underline truncate block">
                                  {t.ticketRefNo || `#${t.id}`}
                                </span>
                              </div>

                              {/* 4. Client & Site */}
                              <div className="min-w-0 pr-1">
                                <p className="font-semibold text-foreground truncate leading-tight">
                                  {t.clientSiteName}
                                </p>
                                <p className="text-[10px] text-muted-text font-medium truncate mt-0.5">
                                  {t.maincon?.name || "No Client"}{t.endCustomer ? ` (${t.endCustomer})` : ""}
                                </p>
                              </div>

                              {/* 5. State */}
                              <div className="min-w-0">
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-foreground text-[10px] font-medium truncate inline-block max-w-full">
                                  {t.state}
                                </span>
                              </div>

                              {/* 6. Issue Summary (1-line truncated with tooltip) */}
                              <div className="min-w-0 pr-2">
                                <p className="text-muted-text truncate group-hover:text-foreground transition-colors" title={t.issueDescription}>
                                  {t.issueDescription}
                                </p>
                              </div>

                              {/* 7. Assigned To */}
                              <div className="min-w-0">
                                {t.assignedFe ? (
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span className="w-5 h-5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-[9px] flex items-center justify-center flex-shrink-0 border border-indigo-500/20">
                                      {t.assignedFe.name.charAt(0).toUpperCase()}
                                    </span>
                                    <span className="font-medium text-foreground truncate text-[11px]" title={`FE: ${t.assignedFe.name}`}>
                                      {t.assignedFe.name}
                                    </span>
                                  </div>
                                ) : t.partner ? (
                                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 px-1.5 py-0.5 rounded font-medium truncate block" title={`Partner: ${t.partner.name}`}>
                                    🏢 {t.partner.name}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-amber-500/90 font-medium italic">
                                    Unassigned
                                  </span>
                                )}
                              </div>

                              {/* 8. Status */}
                              <div className="flex justify-center">
                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold whitespace-nowrap ${sc.badge}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sc.dot} ${isActive ? "animate-pulse" : ""}`} />
                                  {sc.label}
                                </span>
                              </div>

                              {/* 9. Live SLA Countdown */}
                              <div className="flex justify-center">
                                {t.slaDeadline ? (
                                  renderSlaBadge(t)
                                ) : (
                                  <span className="text-[10px] text-muted-text italic">—</span>
                                )}
                              </div>

                              {/* 10. Reported Time */}
                              <div className="text-right font-mono text-[11px] text-muted-text whitespace-nowrap">
                                {new Date(t.reportedAt || t.createdAt).toLocaleDateString("en-MY", {
                                  day: "2-digit",
                                  month: "short",
                                })}
                              </div>

                              {/* 11. Actions */}
                              <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => router.push(`/tickets/${t.id}/edit`)}
                                  className="p-1 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 transition-all cursor-pointer"
                                  title="Edit Ticket"
                                >
                                  ✏️
                                </button>
                                {t.serviceReportUrl && (
                                  <a
                                    href={t.serviceReportUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 transition-all"
                                    title="View Service Report"
                                  >
                                    📄
                                  </a>
                                )}
                                {user?.role === "SUPERADMIN" && (
                                  <button
                                    onClick={() => {
                                      if (window.confirm(`Delete Support Ticket ${t.ticketRefNo || `#${t.id}`}?`)) {
                                        deleteTicket(t.id)
                                          .then(() => {
                                            toast.success("Ticket deleted");
                                            refreshData();
                                          })
                                          .catch((err) => toast.error("Error: " + err.message));
                                      }
                                    }}
                                    className="p-1 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 transition-all cursor-pointer"
                                    title="Delete Ticket"
                                  >
                                    🗑️
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Table Footer / Pagination */}
                    {renderPaginationFooter(filteredTickets.length, "ticket", "tickets")}
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
                                  toast.success("Client deleted");
                                } catch (err) {
                                  toast.error("Error deleting Client: " + (err instanceof Error ? err.message : String(err)));
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
                                    toast.success("Service Partner deleted");
                                  } catch (err) {
                                    toast.error("Error deleting partner: " + (err instanceof Error ? err.message : String(err)));
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
                                      toast.success("Field Engineer deleted");
                                    } catch (err) {
                                      toast.error("Error deleting engineer: " + (err instanceof Error ? err.message : String(err)));
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
                    {devices.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((device, idx) => (
                      <tr
                        key={device.id}
                        className="group hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors"
                      >
                        <td className="px-6 py-3.5 text-xs text-muted-text font-mono">{(currentPage - 1) * pageSize + idx + 1}</td>
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
                                  toast.success("Device deleted from catalog");
                                } catch (err) {
                                  toast.error("Error deleting: " + (err instanceof Error ? err.message : String(err)));
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
            {renderPaginationFooter(devices.length, "device model", "device models")}
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
                    {slas.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((sla, idx) => (
                      <tr
                        key={sla.id}
                        className="group hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors"
                      >
                        <td className="px-6 py-3.5 text-xs text-muted-text font-mono">{(currentPage - 1) * pageSize + idx + 1}</td>
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
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-indigo-650 dark:text-indigo-400 hover:bg-indigo-550/10 border border-transparent hover:border-indigo-500/30 rounded-lg transition-all"
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
            {renderPaginationFooter(slas.length, "SLA rule", "SLA rules")}
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
    </div>
  );
}
