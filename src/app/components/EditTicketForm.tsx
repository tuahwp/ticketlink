"use client";

import React, { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateTicket, createEndCustomerSite } from "../actions";
import { calculateSlaDeadline } from "../../lib/sla";

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
  customValues: unknown;
  partnerId: number | null;
  assignedFeId: number | null;
  deviceId: number | null;
  deviceStatus: "STANDARD" | "ON_REQUEST" | null;
  customDeviceDetails: string | null;
  reportedAt: Date | string;
  createdAt: Date | string;
  siteId: number | null;
  severity: string | null;
  eta?: Date | string | null;
  holdReason?: string | null;
  defectiveSerial?: string | null;
  defectiveReturnStatus?: string | null;
}

interface SlaRuleLike {
  customer: string;
  severity: string;
  region: string;
  slaHours: number;
}

interface Props {
  ticket: Ticket;
  maincons: Maincon[];
  partners: ServicePartner[];
  devices: DeviceCatalog[];
  states: State[];
  initialSites: EndCustomerSite[];
  slaRules: SlaRuleLike[];
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

export default function EditTicketForm({
  ticket,
  maincons,
  partners,
  devices,
  states,
  initialSites,
  slaRules,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Form State initialized to Ticket values
  const [ticketRefNo, setTicketRefNo] = useState(ticket.ticketRefNo || "");
  const [autoRefNo, setAutoRefNo] = useState(false); // Default to false when editing so existing ref is shown
  const [clientSiteName, setClientSiteName] = useState(ticket.clientSiteName);
  const [state, setState] = useState(ticket.state);
  const [issueDescription, setIssueDescription] = useState(ticket.issueDescription);
  const [mainconId, setMainconId] = useState(String(ticket.mainconId));
  const [customValues, setCustomValues] = useState<Record<string, string>>(
    safeParseJson<Record<string, string>>(ticket.customValues, {})
  );
  const [partnerId, setPartnerId] = useState(ticket.partnerId ? String(ticket.partnerId) : "");
  const [assignedFeId, setAssignedFeId] = useState(ticket.assignedFeId ? String(ticket.assignedFeId) : "");
  const [deviceId, setDeviceId] = useState(ticket.deviceId ? String(ticket.deviceId) : "");
  const [deviceStatus, setDeviceStatus] = useState<"STANDARD" | "ON_REQUEST">(
    (ticket.deviceStatus as "STANDARD" | "ON_REQUEST") || "STANDARD"
  );
  const [customDeviceDetails, setCustomDeviceDetails] = useState(ticket.customDeviceDetails || "");
  const matchedDevice = ticket.deviceId ? devices.find((d) => d.id === ticket.deviceId) : null;
  const [deviceSearchQuery, setDeviceSearchQuery] = useState(
    matchedDevice ? `${matchedDevice.category} - ${matchedDevice.brand} ${matchedDevice.model}` : ""
  );
  const [isDeviceDropdownOpen, setIsDeviceDropdownOpen] = useState(false);
  const [slaDeadline, setSlaDeadline] = useState(
    ticket.slaDeadline ? new Date(ticket.slaDeadline).toISOString().slice(0, 16) : ""
  );
  const [status, setStatus] = useState<Ticket["status"]>(ticket.status);
  const [subStatus, setSubStatus] = useState(ticket.subStatus || "");
  const [holdReason, setHoldReason] = useState(ticket.holdReason || "");
  const [eta, setEta] = useState(ticket.eta ? new Date(ticket.eta).toISOString().slice(0, 16) : "");
  const [endCustomer, setEndCustomer] = useState(
    maincons.find((m) => m.id === ticket.mainconId)?.siteCustomers 
      ? (initialSites.find((s) => s.id === ticket.siteId)?.group || "") 
      : ""
  );
  const [severity, setSeverity] = useState<"" | "P1" | "P2" | "P3" | "P4">(
    (ticket.severity as any) || ""
  );

  // Check if reportedAt timestamp matches creation date (to toggle override state)
  const hasReportedOverride = !!ticket.reportedAt && 
    new Date(ticket.reportedAt).getTime() !== new Date(ticket.createdAt).getTime();

  const [useReportedDateOverride, setUseReportedDateOverride] = useState(hasReportedOverride);
  const [reportedAt, setReportedAt] = useState(
    ticket.reportedAt ? new Date(ticket.reportedAt).toISOString().slice(0, 16) : ""
  );

  // Auto-calculate SLA Deadline
  useEffect(() => {
    if (!severity || !state) {
      return;
    }
    const start = useReportedDateOverride && reportedAt ? new Date(reportedAt) : new Date(ticket.createdAt);
    const deadline = calculateSlaDeadline(
      start,
      state,
      endCustomer,
      severity as any,
      slaRules
    );
    if (deadline) {
      const pad = (num: number) => String(num).padStart(2, "0");
      const localStr = `${deadline.getFullYear()}-${pad(deadline.getMonth() + 1)}-${pad(deadline.getDate())}T${pad(deadline.getHours())}:${pad(deadline.getMinutes())}`;
      setSlaDeadline(localStr);
    }
  }, [severity, state, endCustomer, reportedAt, useReportedDateOverride, slaRules, ticket.createdAt]);

  // DB-backed sites state
  const [sites, setSites] = useState<EndCustomerSite[]>(initialSites);
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(ticket.siteId);
  
  // Autocomplete and search state for Site branch dropdown
  const matchedSite = sites.find((s) => s.id === selectedSiteId);
  const [siteSearchQuery, setSiteSearchQuery] = useState(matchedSite ? matchedSite.name : ticket.clientSiteName);
  const [isSiteDropdownOpen, setIsSiteDropdownOpen] = useState(false);

  // Quick Add Site Modal state
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickSiteName, setQuickSiteName] = useState("");
  const [quickSiteState, setQuickSiteState] = useState("");

  // Core Computed selections
  const selectedMaincon = maincons.find((m) => m.id === Number(mainconId));
  const mainconGroups = selectedMaincon ? safeParseJson<string[]>(selectedMaincon.siteCustomers, []) : [];

  // Filter sites based on selected Maincon and selected End-Customer Group
  const filteredSites = sites.filter((site) => {
    const matchMaincon = site.mainconId === Number(mainconId);
    const matchGroup = endCustomer ? site.group === endCustomer : true;
    const matchSearch = siteSearchQuery
      ? site.name.toLowerCase().includes(siteSearchQuery.toLowerCase())
      : true;
    return matchMaincon && matchGroup && matchSearch;
  });

  // Filter Device Catalog by customer restriction and search query
  const filteredDevices = devices.filter((d) => {
    const matchesCustomer = !d.restrictedTo || d.restrictedTo === endCustomer;
    if (!matchesCustomer) return false;
    
    const matchedLabel = `${d.category} - ${d.brand} ${d.model}`;
    if (deviceSearchQuery && deviceSearchQuery !== matchedLabel) {
      const query = deviceSearchQuery.toLowerCase();
      return (
        d.category.toLowerCase().includes(query) ||
        d.brand.toLowerCase().includes(query) ||
        d.model.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const fallbackDevice = devices.find((d) => d.brand.toLowerCase() === "generic" || !d.isStandard);
  const hasRestrictedDevices = endCustomer ? devices.some((d) => d.restrictedTo === endCustomer) : false;
  const showHardwareCatalog = !!mainconId && (
    hasRestrictedDevices ||
    !selectedMaincon?.siteCustomers ||
    safeParseJson<string[]>(selectedMaincon.siteCustomers, []).length === 0
  );

  // Filter partners based on selected State
  const filteredPartners = partners.filter((p) => {
    const covered = safeParseJson<string[]>(p.statesCovered, []);
    return covered.includes(state);
  });

  // Engineers for selected partner
  const selectedPartnerObj = partners.find((p) => p.id === Number(partnerId));
  const eligibleEngineers = selectedPartnerObj?.engineers || [];

  // Handle Quick Add Site Branch submission
  const handleQuickAddSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSiteName || !quickSiteState || !mainconId || !endCustomer) {
      alert("Please fill in Site Name, State, Maincon and End-Customer Group.");
      return;
    }

    startTransition(async () => {
      try {
        const created = await createEndCustomerSite({
          name: quickSiteName,
          group: endCustomer,
          state: quickSiteState,
          mainconId: Number(mainconId),
        });

        // Add to local sites list
        setSites((prev) => [...prev, created]);
        
        // Select newly created site branch
        setSelectedSiteId(created.id);
        setClientSiteName(created.name);
        setState(created.state);
        setSiteSearchQuery(created.name);
        
        // Reset states
        setQuickSiteName("");
        setQuickSiteState("");
        setIsQuickAddOpen(false);
        setIsSiteDropdownOpen(false);
      } catch (err) {
        alert("Error adding site branch: " + (err instanceof Error ? err.message : String(err)));
      }
    });
  };

  // Submit main ticket form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientSiteName || !state || !mainconId) {
      alert("Please fill in all core fields (Site Name, State, Maincon)");
      return;
    }

    startTransition(async () => {
      try {
        const slaDate = slaDeadline ? new Date(slaDeadline) : null;
        const reportedDate = useReportedDateOverride && reportedAt ? new Date(reportedAt) : null;

        await updateTicket(ticket.id, {
          ticketRefNo: autoRefNo ? "" : ticketRefNo || null,
          clientSiteName,
          state,
          issueDescription,
          mainconId: Number(mainconId),
          customValues,
          partnerId: partnerId ? Number(partnerId) : null,
          assignedFeId: assignedFeId ? Number(assignedFeId) : null,
          deviceId: deviceId && showHardwareCatalog ? Number(deviceId) : null,
          deviceStatus: deviceId && showHardwareCatalog ? deviceStatus : null,
          customDeviceDetails: deviceId && showHardwareCatalog ? (customDeviceDetails || null) : null,
          slaDeadline: slaDate,
          endCustomer: endCustomer || null,
          reportedAt: reportedDate,
          siteId: selectedSiteId || null,
          status,
          subStatus: status === "FOLLOW_UP" ? subStatus || null : null,
          severity: severity || null,
          holdReason: status === "ON_HOLD" ? holdReason || null : null,
          eta: eta ? new Date(eta) : null,
        });

        router.push(`/tickets/${ticket.id}`);
        router.refresh();
      } catch (err) {
        alert("Error updating ticket: " + (err instanceof Error ? err.message : String(err)));
      }
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans antialiased relative pb-16">
      {/* Ambient gradient */}
      <div className="absolute top-0 left-0 w-full h-[400px] bg-gradient-to-b from-indigo-50/5 dark:from-indigo-900/10 via-background to-transparent pointer-events-none" />

      {/* Header */}
      <header className="relative border-b border-card-border bg-background/80 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/tickets/${ticket.id}`)}
              className="p-2 rounded-xl border border-card-border hover:bg-slate-100 dark:hover:bg-slate-800/50 text-muted-text hover:text-foreground transition-all flex items-center gap-2 text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span>Back</span>
            </button>
            <div>
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold uppercase tracking-wider">Ticket ID #{ticket.id}</span>
              <h1 className="text-base sm:text-lg font-bold text-foreground mt-0.5">Edit Support Ticket</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* ── Left Column: Ticket Info ── */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Core Ticket Details */}
            <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-text border-b border-card-border pb-2.5">
                1. Core Information
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Ref No */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide">
                      Ticket Ref No
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-medium cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={autoRefNo}
                        onChange={(e) => setAutoRefNo(e.target.checked)}
                        className="rounded bg-input-bg border-card-border text-indigo-600 focus:ring-indigo-500/20"
                      />
                      Auto-generate
                    </label>
                  </div>
                  {autoRefNo ? (
                    <div className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-card-border rounded-xl text-slate-400 dark:text-slate-500 text-sm font-mono select-none">
                      Auto-generated Reference (TKL-YYYYMMDD-XXXX)
                    </div>
                  ) : (
                    <input
                      type="text"
                      required={!autoRefNo}
                      value={ticketRefNo}
                      onChange={(e) => setTicketRefNo(e.target.value)}
                      placeholder="e.g. TKT-2026-908"
                      className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-505 text-sm font-mono"
                    />
                  )}
                </div>

                {/* Client Selection */}
                <div>
                  <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1.5">
                    Client <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={mainconId}
                    onChange={(e) => {
                      setMainconId(e.target.value);
                      setEndCustomer("");
                      setSelectedSiteId(null);
                      setClientSiteName("");
                      setSiteSearchQuery("");
                      setCustomValues({});
                    }}
                    className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-505 text-sm cursor-pointer"
                  >
                    <option value="">Select Client</option>
                    {maincons.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* End-Customer & Autocomplete sites dropdown */}
              {mainconId && mainconGroups.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* End Customer Group Selection */}
                  <div>
                    <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1.5">
                      End-Customer Group
                    </label>
                    <select
                      value={endCustomer}
                      onChange={(e) => {
                        setEndCustomer(e.target.value);
                        setSelectedSiteId(null);
                        setClientSiteName("");
                        setSiteSearchQuery("");
                        setDeviceId("");
                        setDeviceStatus("STANDARD");
                        setCustomDeviceDetails("");
                      }}
                      className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-505 text-sm cursor-pointer"
                    >
                      <option value="">No Group Restriction</option>
                      {mainconGroups.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Autocomplete database site branch search */}
                  <div className="relative">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide">
                        Search Database Site Branch
                      </label>
                      {endCustomer && (
                        <button
                          type="button"
                          onClick={() => setIsQuickAddOpen(true)}
                          className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                        >
                          + Quick Add Site
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder={endCustomer ? `Search ${endCustomer} sites...` : "Select Maincon and Group first"}
                      value={siteSearchQuery}
                      onChange={(e) => {
                        setSiteSearchQuery(e.target.value);
                        setIsSiteDropdownOpen(true);
                      }}
                      onFocus={() => setIsSiteDropdownOpen(true)}
                      className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-505 text-sm"
                      disabled={!mainconId}
                    />

                    {isSiteDropdownOpen && siteSearchQuery && filteredSites.length > 0 && (
                      <div className="absolute left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-card border border-card-border rounded-xl shadow-xl z-50 divide-y divide-card-border">
                        {filteredSites.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setSelectedSiteId(s.id);
                              setClientSiteName(s.name);
                              setState(s.state);
                              setSiteSearchQuery(s.name);
                              setIsSiteDropdownOpen(false);
                            }}
                            className="w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-900 text-foreground transition-colors flex flex-col gap-0.5"
                          >
                            <span className="font-semibold">{s.name}</span>
                            <span className="text-[10px] text-muted-text font-mono uppercase">{s.state} · {s.group}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Client Site Name (Manual / Selected) & State selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1.5">
                    Client Site Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={clientSiteName}
                    onChange={(e) => {
                      setClientSiteName(e.target.value);
                      setSelectedSiteId(null); // break DB link since it's manual text edit
                    }}
                    placeholder="e.g. JPJ Kuala Lumpur Wangsa Maju"
                    className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-505 text-sm"
                  />
                  {selectedSiteId && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-1">
                      ✓ Linked to pre-seeded location ID #{selectedSiteId}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1.5">
                    State / Region <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={state}
                    onChange={(e) => {
                      setState(e.target.value);
                      setPartnerId("");
                      setAssignedFeId("");
                    }}
                    className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-505 text-sm cursor-pointer"
                  >
                    <option value="">Select State</option>
                    {states.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* SLA Target & Email Override */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-card-border pt-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1.5">
                    Severity Level
                  </label>
                  <select
                    name="severity"
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as any)}
                    className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-505 text-sm cursor-pointer"
                  >
                    <option value="">None / Standard</option>
                    <option value="P1">P1 (Critical)</option>
                    <option value="P2">P2 (High)</option>
                    <option value="P3">P3 (Medium)</option>
                    <option value="P4">P4 (Low)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1.5">
                    SLA Deadline (Auto-computed)
                  </label>
                  <input
                    type="datetime-local"
                    value={slaDeadline}
                    onChange={(e) => setSlaDeadline(e.target.value)}
                    className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-505 text-sm cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide">
                      Email / Reported At Override
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-medium cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={useReportedDateOverride}
                        onChange={(e) => setUseReportedDateOverride(e.target.checked)}
                        className="rounded bg-input-bg border-card-border text-indigo-600 focus:ring-indigo-500/20"
                      />
                      Enable
                    </label>
                  </div>
                  {useReportedDateOverride ? (
                    <input
                      type="datetime-local"
                      required={useReportedDateOverride}
                      value={reportedAt}
                      onChange={(e) => setReportedAt(e.target.value)}
                      className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-505 text-sm cursor-pointer"
                    />
                  ) : (
                    <div className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/30 border border-card-border rounded-xl text-muted-text text-sm select-none">
                      Uses creation time (default)
                    </div>
                  )}
                </div>
              </div>

              {/* Status and sub-status section */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-card-border pt-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1.5">
                    Ticket Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value as any);
                      setSubStatus("");
                      setHoldReason("");
                    }}
                    className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm cursor-pointer"
                  >
                    <option value="NEW">New</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="ON_HOLD">On Hold</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="FOLLOW_UP">Follow Up</option>
                    <option value="COMPLETE">Complete</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                </div>

                <div>
                  {status === "FOLLOW_UP" && (
                    <>
                      <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1.5">
                        Follow Up Sub-status
                      </label>
                      <select
                        value={subStatus}
                        onChange={(e) => setSubStatus(e.target.value)}
                        required
                        className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm cursor-pointer"
                      >
                        <option value="">Select Sub-status</option>
                        <option value="PENDING_PARTS">Follow Up (Pending Parts)</option>
                        <option value="PENDING_SIGN_OFF">Follow Up (Pending Sign off User)</option>
                        <option value="MONITORING">Follow Up (In Monitoring)</option>
                        <option value="OTHER">Follow Up (Others)</option>
                      </select>
                    </>
                  )}

                  {status === "ON_HOLD" && (
                    <>
                      <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1.5">
                        Hold Reason
                      </label>
                      <select
                        value={holdReason}
                        onChange={(e) => setHoldReason(e.target.value)}
                        required
                        className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm cursor-pointer"
                      >
                        <option value="">Select Hold Reason</option>
                        <option value="Awaiting Client Feedback">Awaiting Client Feedback</option>
                        <option value="Site Closed / Public Holiday">Site Closed / Public Holiday</option>
                        <option value="Under Maintenance">Under Maintenance</option>
                        <option value="Spare Part Not Available">Spare Part Not Available</option>
                        <option value="Other">Other</option>
                      </select>
                    </>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1.5">
                    Field Engineer ETA
                  </label>
                  <input
                    type="datetime-local"
                    value={eta}
                    onChange={(e) => setEta(e.target.value)}
                    className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Dynamic Maincon Fields Form */}
            {mainconId && selectedMaincon && (
              <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 border-b border-card-border pb-2.5">
                  2. Contractor Data Custom Fields
                </h2>
                {(() => {
                  const fields = safeParseJson<string[]>(selectedMaincon.customFieldsSchema, []);
                  if (fields.length === 0) {
                    return <p className="text-xs text-muted-text italic">No custom fields schema required for {selectedMaincon.name}.</p>;
                  }
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {fields.map((fName) => (
                        <div key={fName}>
                          <label className="block text-xs font-semibold text-muted-text mb-1">{fName} <span className="text-rose-500">*</span></label>
                          <input
                            type="text"
                            required
                            value={customValues[fName] || ""}
                            onChange={(e) => setCustomValues({ ...customValues, [fName]: e.target.value })}
                            className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Issue Description */}
            <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-text border-b border-card-border pb-2.5">
                3. Issue Details
              </h2>
              <div>
                <label className="block text-xs font-semibold text-muted-text mb-1.5">Description of Issue</label>
                <textarea
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  placeholder="Provide technical error logs, offline status, or onsite actions needed..."
                  rows={4}
                  className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm leading-relaxed"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => router.push(`/tickets/${ticket.id}`)}
                className="px-6 py-2.5 border border-card-border hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-xs font-bold text-white transition-all shadow-lg shadow-indigo-600/30"
              >
                {isPending ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>

          {/* ── Right Column: Dispatch & Hardware ── */}
          <div className="space-y-6">
            
            {/* Device Configuration */}
            {showHardwareCatalog && (
              <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-card-border pb-3">
                  <span className="text-lg">💻</span>
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-widest text-muted-text">
                      Hardware Catalog
                    </h2>
                    <p className="text-[10px] text-muted-text mt-0.5">Link a device model to this ticket</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Searchable Autocomplete Input */}
                  <div className="relative" onMouseLeave={() => setIsDeviceDropdownOpen(false)}>
                    <label className="block text-xs font-semibold text-muted-text mb-1.5">
                      Search Device Model
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search devices by brand, model, or category..."
                        value={deviceSearchQuery}
                        onChange={(e) => {
                          setDeviceSearchQuery(e.target.value);
                          setIsDeviceDropdownOpen(true);
                        }}
                        onFocus={() => setIsDeviceDropdownOpen(true)}
                        className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none text-xs"
                      />
                      {deviceId && (
                        <button
                          type="button"
                          onClick={() => {
                            setDeviceId("");
                            setDeviceSearchQuery("");
                            setDeviceStatus("STANDARD");
                            setCustomDeviceDetails("");
                            setIsDeviceDropdownOpen(false);
                          }}
                          className="absolute right-3 top-2 text-muted-text hover:text-foreground text-xs"
                        >
                          ✕ Clear
                        </button>
                      )}
                    </div>

                    {isDeviceDropdownOpen && (
                      <div className="absolute left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-card border border-card-border rounded-xl shadow-xl z-50 divide-y divide-card-border">
                        <button
                          type="button"
                          onClick={() => {
                            setDeviceId("");
                            setDeviceSearchQuery("");
                            setDeviceStatus("STANDARD");
                            setCustomDeviceDetails("");
                            setIsDeviceDropdownOpen(false);
                          }}
                          className="w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-900 text-muted-text transition-colors italic"
                        >
                          No Hardware Associated (Clear Selection)
                        </button>
                        {filteredDevices.map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => {
                              setDeviceId(String(d.id));
                              setDeviceSearchQuery(`${d.category} - ${d.brand} ${d.model}`);
                              setDeviceStatus(d.isStandard ? "STANDARD" : "ON_REQUEST");
                              setIsDeviceDropdownOpen(false);
                            }}
                            className="w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-900 text-foreground transition-colors flex flex-col gap-0.5"
                          >
                            <span className="font-semibold">{d.category} - {d.brand} {d.model}</span>
                            <span className="text-[10px] text-muted-text font-mono">
                              {d.isStandard ? "Standard Catalog" : "On Request Fallback"}
                              {d.restrictedTo ? ` · Restricted to ${d.restrictedTo}` : ""}
                            </span>
                          </button>
                        ))}
                        {filteredDevices.length === 0 && deviceSearchQuery && (
                          <div className="px-4 py-3 text-xs text-muted-text italic">
                            No matching devices found in catalog.
                          </div>
                        )}
                        {deviceSearchQuery && fallbackDevice && (
                          <div className="p-2 bg-slate-50 dark:bg-slate-900/50 border-t border-card-border sticky bottom-0">
                            <button
                              type="button"
                              onClick={() => {
                                setDeviceId(String(fallbackDevice.id));
                                setDeviceSearchQuery(`${fallbackDevice.category} - ${fallbackDevice.brand} ${fallbackDevice.model}`);
                                setDeviceStatus("ON_REQUEST");
                                setCustomDeviceDetails(deviceSearchQuery);
                                setIsDeviceDropdownOpen(false);
                              }}
                              className="w-full py-2 px-3 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 border border-indigo-100 dark:border-indigo-900/60 rounded-lg text-[10px] text-indigo-600 dark:text-indigo-400 font-bold transition-all text-center flex items-center justify-center gap-1.5"
                            >
                              💡 Select &quot;On Request&quot; Fallback for &quot;{deviceSearchQuery}&quot;
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Hidden inputs to guarantee form submit payload */}
                  <input type="hidden" name="deviceId" value={deviceId} />

                  {/* Status & Custom Details (Only visible if deviceId is selected) */}
                  {deviceId && (
                    <div className="space-y-4 pt-4 border-t border-card-border">
                      {/* Status selectors */}
                      <div>
                        <label className="block text-xs font-semibold text-muted-text mb-1.5">Device Dispatch Status</label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setDeviceStatus("STANDARD")}
                            className={`flex-1 py-2 text-center text-xs font-bold rounded-lg border transition-all ${
                              deviceStatus === "STANDARD"
                                ? "bg-slate-200 dark:bg-slate-800 border-indigo-500 text-indigo-600 dark:text-indigo-400"
                                : "bg-input-bg border-card-border text-muted-text cursor-not-allowed opacity-50"
                            }`}
                            disabled={deviceId ? devices.find((d) => d.id === Number(deviceId))?.isStandard === false : false}
                          >
                            STANDARD
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeviceStatus("ON_REQUEST")}
                            className={`flex-1 py-2 text-center text-xs font-bold rounded-lg border transition-all ${
                              deviceStatus === "ON_REQUEST"
                                ? "bg-slate-200 dark:bg-slate-800 border-indigo-500 text-indigo-600 dark:text-indigo-400"
                                : "bg-input-bg border-card-border text-muted-text cursor-not-allowed opacity-50"
                            }`}
                            disabled={deviceId ? devices.find((d) => d.id === Number(deviceId))?.isStandard === true : false}
                          >
                            ON REQUEST
                          </button>
                        </div>
                      </div>

                      {/* Custom Details */}
                      {deviceStatus === "ON_REQUEST" && (
                        <div>
                          <label className="block text-xs font-semibold text-muted-text mb-1">Custom Device details</label>
                          <input
                            type="text"
                            required
                            value={customDeviceDetails}
                            onChange={(e) => setCustomDeviceDetails(e.target.value)}
                            placeholder="e.g. Acer Aspire 5 Laptop, Serial: AC-2299"
                            className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none text-xs"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Service Partner Dispatch */}
            <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-text border-b border-card-border pb-2.5">
                Service Dispatch
              </h2>

              <div>
                <label className="block text-xs font-semibold text-muted-text mb-1.5">Service Partner</label>
                <select
                  value={partnerId}
                  onChange={(e) => {
                    setPartnerId(e.target.value);
                    setAssignedFeId("");
                  }}
                  disabled={!state}
                  className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none text-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">{state ? "Choose Service Partner" : "Select State First"}</option>
                  {filteredPartners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {partnerId && (
                <div>
                  <label className="block text-xs font-semibold text-muted-text mb-1.5">Assign Field Engineer</label>
                  <select
                    value={assignedFeId}
                    onChange={(e) => setAssignedFeId(e.target.value)}
                    className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none text-xs cursor-pointer"
                  >
                    <option value="">Select Field Engineer</option>
                    {eligibleEngineers.map((fe) => {
                      const locationStr = fe.country || fe.region 
                        ? ` (${[fe.country, fe.region].filter(Boolean).join(" - ")})`
                        : "";
                      return (
                        <option key={fe.id} value={fe.id}>
                          {fe.name}{locationStr} ({fe.phone})
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>
          </div>
        </form>
      </main>

      {/* QUICK ADD SITE MODAL */}
      {isQuickAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-sm bg-card border border-card-border rounded-2xl shadow-2xl">
            <div className="flex justify-between items-center px-6 py-4 border-b border-card-border bg-slate-50 dark:bg-slate-900/40">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                + Quick Register Branch Location
              </h3>
              <button
                type="button"
                onClick={() => setIsQuickAddOpen(false)}
                className="text-muted-text hover:text-foreground"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleQuickAddSite} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-muted-text uppercase tracking-wide mb-1">
                  Site/Branch Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. JPJ Kuala Terengganu"
                  value={quickSiteName}
                  onChange={(e) => setQuickSiteName(e.target.value)}
                  className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted-text uppercase tracking-wide mb-1">
                  State / Region
                </label>
                <select
                  required
                  value={quickSiteState}
                  onChange={(e) => setQuickSiteState(e.target.value)}
                  className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none text-xs cursor-pointer"
                >
                  <option value="">Select State</option>
                  {states.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4 border-t border-card-border flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsQuickAddOpen(false)}
                  className="px-3 py-1.5 border border-card-border hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-505 rounded-lg text-xs text-white"
                >
                  Register Site
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
