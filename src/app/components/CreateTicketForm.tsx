"use client";

import React, { useState, useTransition, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createTicket, createEndCustomerSite, checkDuplicateTicketRef } from "../actions";
import { createTicketAction } from "../tickets/actions";
import { toast } from "sonner";
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

interface SlaRuleLike {
  customer: string;
  severity: string;
  region: string;
  slaHours: number;
}

interface Props {
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

export default function CreateTicketForm({
  maincons,
  partners,
  devices,
  states,
  initialSites,
  slaRules,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Form State
  const [ticketRefNo, setTicketRefNo] = useState("");
  const [autoRefNo, setAutoRefNo] = useState(false);
  const [isCheckingRef, setIsCheckingRef] = useState(false);
  const [isDuplicateRef, setIsDuplicateRef] = useState(false);

  const [clientSiteName, setClientSiteName] = useState("");
  const [state, setState] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [mainconId, setMainconId] = useState("");
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [partnerId, setPartnerId] = useState("");
  const [assignedFeId, setAssignedFeId] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [deviceStatus, setDeviceStatus] = useState<"STANDARD" | "ON_REQUEST">("STANDARD");
  const [customDeviceDetails, setCustomDeviceDetails] = useState("");
  const [deviceSearchQuery, setDeviceSearchQuery] = useState("");
  const [isDeviceDropdownOpen, setIsDeviceDropdownOpen] = useState(false);
  const [defectiveSerial, setDefectiveSerial] = useState("");
  const [slaDeadline, setSlaDeadline] = useState("");
  const [endCustomer, setEndCustomer] = useState("");
  const [useReportedDateOverride, setUseReportedDateOverride] = useState(false);
  const [reportedAt, setReportedAt] = useState("");
  const [severity, setSeverity] = useState<"" | "P1" | "P2" | "P3" | "P4">("P3");

  // DB-backed sites state
  const [sites, setSites] = useState<EndCustomerSite[]>(initialSites);
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);

  // Autocomplete and search state for Site branch dropdown
  const [siteSearchQuery, setSiteSearchQuery] = useState("");
  const [isSiteDropdownOpen, setIsSiteDropdownOpen] = useState(false);

  // Quick Add Site Modal state
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickSiteName, setQuickSiteName] = useState("");
  const [quickSiteState, setQuickSiteState] = useState("");

  // Live duplicate checking for Ticket Number
  useEffect(() => {
    if (autoRefNo || !ticketRefNo.trim()) {
      setIsDuplicateRef(false);
      setIsCheckingRef(false);
      return;
    }

    const trimmed = ticketRefNo.trim();
    setIsCheckingRef(true);
    const timer = setTimeout(async () => {
      try {
        const isDup = await checkDuplicateTicketRef(trimmed);
        setIsDuplicateRef(isDup);
      } catch (err) {
        console.error("Error checking duplicate ref:", err);
      } finally {
        setIsCheckingRef(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [ticketRefNo, autoRefNo]);

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
  const showHardwareCatalog =
    !!mainconId &&
    (hasRestrictedDevices ||
      !selectedMaincon?.siteCustomers ||
      safeParseJson<string[]>(selectedMaincon.siteCustomers, []).length === 0);

  // Filter partners based on selected State
  const filteredPartners = partners.filter((p) => {
    const covered = safeParseJson<string[]>(p.statesCovered, []);
    return covered.includes(state);
  });

  // Engineers for selected partner
  const selectedPartnerObj = partners.find((p) => p.id === Number(partnerId));
  const eligibleEngineers = selectedPartnerObj?.engineers || [];

  // Auto-calculate SLA Deadline
  useEffect(() => {
    if (!severity || !state) {
      setSlaDeadline("");
      return;
    }
    const start = useReportedDateOverride && reportedAt ? new Date(reportedAt) : new Date();
    const deadline = calculateSlaDeadline(start, state, endCustomer, severity as any, slaRules);
    if (deadline) {
      const pad = (num: number) => String(num).padStart(2, "0");
      const localStr = `${deadline.getFullYear()}-${pad(deadline.getMonth() + 1)}-${pad(deadline.getDate())}T${pad(deadline.getHours())}:${pad(deadline.getMinutes())}`;
      setSlaDeadline(localStr);
    } else {
      setSlaDeadline("");
    }
  }, [severity, state, endCustomer, reportedAt, useReportedDateOverride, slaRules]);

  // Computed SLA Rule object for UI inspection
  const computedSlaRule = useMemo(() => {
    if (!severity || !state) return null;
    const isEast = ["Sabah", "Sarawak", "Labuan"].includes(state);
    const targetRegion = isEast ? "Sabah/Sarawak" : "Semenanjung";

    let rule = slaRules.find(
      (r) =>
        r.customer.toUpperCase() === (endCustomer || "DEFAULT").toUpperCase() &&
        r.severity === severity &&
        r.region === targetRegion
    );
    if (!rule) {
      rule = slaRules.find(
        (r) =>
          r.customer.toUpperCase() === "DEFAULT" &&
          r.severity === severity &&
          r.region === targetRegion
      );
    }
    return rule || null;
  }, [severity, state, endCustomer, slaRules]);

  // Handle Quick Add Site Branch submission
  const handleQuickAddSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSiteName || !quickSiteState || !mainconId || !endCustomer) {
      toast.error("Please fill in Site Name, State, Maincon and End-Customer Group.");
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
        toast.success(`Site branch "${created.name}" created!`);
      } catch (err) {
        toast.error("Error adding site branch: " + (err instanceof Error ? err.message : String(err)));
      }
    });
  };

  // Submit main ticket form via Server Action
  const handleFormAction = async (formData: FormData) => {
    if (!autoRefNo && !ticketRefNo.trim()) {
      toast.error("Please enter a Ticket Number.");
      return;
    }

    if (!autoRefNo && isDuplicateRef) {
      toast.error(`Ticket Number "${ticketRefNo}" already exists. Please use a unique Ticket Number.`);
      return;
    }

    if (!clientSiteName || !state || !mainconId) {
      toast.error("Please fill in all core fields (Site Name, State, Maincon)");
      return;
    }

    startTransition(async () => {
      try {
        formData.set("autoRefNo", autoRefNo ? "true" : "false");
        formData.set("ticketRefNo", ticketRefNo);
        if (selectedSiteId) {
          formData.set("siteId", String(selectedSiteId));
        }
        formData.set("mainconId", mainconId);
        formData.set("endCustomer", endCustomer);
        formData.set("clientSiteName", clientSiteName);
        formData.set("state", state);
        formData.set("severity", severity);
        formData.set("slaDeadline", slaDeadline);
        formData.set("useReportedDateOverride", useReportedDateOverride ? "true" : "false");
        formData.set("reportedAt", reportedAt);
        formData.set("issueDescription", issueDescription);
        formData.set("deviceId", deviceId);
        formData.set("deviceStatus", deviceStatus);
        formData.set("customDeviceDetails", customDeviceDetails);
        formData.set("defectiveSerial", defectiveSerial);
        formData.set("partnerId", partnerId);
        formData.set("assignedFeId", assignedFeId);
        formData.set("customValues", JSON.stringify(customValues));

        toast.loading("Creating ticket...", { id: "ticket-create" });
        await createTicketAction(formData);
        toast.success("Ticket created successfully!", { id: "ticket-create" });
        router.push("/");
        router.refresh();
      } catch (err) {
        toast.error("Failed to create ticket: " + (err instanceof Error ? err.message : String(err)), { id: "ticket-create" });
      }
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans antialiased">
      {/* Background Glow */}
      <div className="absolute top-0 left-0 w-full h-80 bg-gradient-to-b from-indigo-500/5 dark:from-indigo-900/10 via-background to-transparent pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 border-b border-card-border bg-card/60 backdrop-blur-md sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="p-2 rounded-xl border border-card-border hover:bg-slate-100 dark:hover:bg-slate-800 text-muted-text hover:text-foreground transition-all cursor-pointer"
              title="Back to Tickets Queue"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-base font-bold text-foreground">Create Service Ticket</h1>
              <p className="text-[11px] text-muted-text">Dispatch field engineers, track SLAs, and log hardware maintenance</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="px-4 py-2 border border-card-border hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                const formEl = document.getElementById("ticket-creation-form") as HTMLFormElement | null;
                if (formEl) formEl.requestSubmit();
              }}
              disabled={isPending || isDuplicateRef || isCheckingRef}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-xs font-bold text-white transition-all shadow-md shadow-indigo-600/20 inline-flex items-center gap-2 cursor-pointer"
            >
              {isPending ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <span>🚀</span>
                  <span>Save Ticket</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <form
          id="ticket-creation-form"
          action={handleFormAction}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
        >
          {/* ═════════════════════════════════════════════════════════════════════════ */}
          {/* LEFT PANEL (65% / 8 Cols): Core Operational Information */}
          {/* ═════════════════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* 0. 🎫 TICKET NUMBER (At Very Top) */}
            <div className={`bg-card border rounded-2xl p-6 shadow-sm space-y-3 transition-all ${
              isDuplicateRef
                ? "border-rose-500/80 ring-2 ring-rose-500/20 bg-rose-500/5"
                : ticketRefNo.trim() && !isCheckingRef && !autoRefNo
                ? "border-emerald-500/60 ring-1 ring-emerald-500/20"
                : "border-card-border"
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">🎫</span>
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      TICKET NUMBER <span className="text-rose-500">*</span>
                    </h2>
                    <p className="text-[10px] text-muted-text">Key in official incident / ticket reference</p>
                  </div>
                </div>

                {/* Auto-generate Toggle Option */}
                <label className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-semibold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoRefNo}
                    onChange={(e) => {
                      setAutoRefNo(e.target.checked);
                      if (e.target.checked) {
                        setIsDuplicateRef(false);
                      }
                    }}
                    className="rounded bg-input-bg border-card-border text-indigo-600 focus:ring-indigo-500/20"
                  />
                  <span>Auto-generate Reference</span>
                </label>
              </div>

              {autoRefNo ? (
                <div className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-card-border rounded-xl text-slate-400 dark:text-slate-500 text-sm font-mono select-none flex items-center justify-between">
                  <span>System will auto-generate format: TKL-YYYYMMDD-XXXX</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-bold uppercase">Auto Mode</span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="relative">
                    <input
                      type="text"
                      required={!autoRefNo}
                      name="ticketRefNo"
                      value={ticketRefNo}
                      onChange={(e) => setTicketRefNo(e.target.value)}
                      placeholder="e.g. TKT-2026-0012, INC-990812..."
                      className={`w-full px-4 py-3 bg-input-bg border rounded-xl text-foreground font-mono text-sm focus:outline-none transition-all ${
                        isDuplicateRef
                          ? "border-rose-500 focus:ring-2 focus:ring-rose-500/20 bg-rose-50/10 text-rose-600 dark:text-rose-400 font-bold"
                          : ticketRefNo.trim() && !isCheckingRef
                          ? "border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20"
                          : "border-card-border focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      }`}
                    />
                    {isCheckingRef && (
                      <span className="absolute right-3.5 top-3.5 text-xs text-muted-text animate-pulse font-mono">
                        Checking...
                      </span>
                    )}
                  </div>

                  {/* Validation Feedback Messages */}
                  {isDuplicateRef ? (
                    <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-500 font-bold flex items-center gap-2 animate-in fade-in duration-200">
                      <span>⚠️</span>
                      <span>Ticket Number &quot;{ticketRefNo}&quot; already exists in database. Duplicate ticket numbers cannot be logged.</span>
                    </div>
                  ) : ticketRefNo.trim() && !isCheckingRef ? (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5 animate-in fade-in duration-200">
                      <span>✓</span>
                      <span>Ticket Number is available and unique</span>
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-text">
                      Key in your contractor reference number. The system will prevent any duplicate submissions.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* 1. 🏢 CLIENT & SITE LOCATION */}
            <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm space-y-5">
              <div className="flex items-center gap-2.5 border-b border-card-border pb-3">
                <span className="text-base">🏢</span>
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                    1. Client & Location
                  </h2>
                  <p className="text-[10px] text-muted-text">Specify the client, site branch, and geographical region</p>
                </div>
              </div>

              {/* Row 1: Client (Maincon) & End-Customer Group */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Client / Maincon */}
                <div>
                  <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1.5">
                    Main Contractor (Client) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    name="mainconId"
                    value={mainconId}
                    onChange={(e) => {
                      setMainconId(e.target.value);
                      setEndCustomer("");
                      setSelectedSiteId(null);
                      setClientSiteName("");
                      setSiteSearchQuery("");
                      setCustomValues({});
                    }}
                    className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm cursor-pointer"
                  >
                    <option value="">Select Main Contractor</option>
                    {maincons.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* End Customer Group (e.g. JPJ, RELA) */}
                <div>
                  <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1.5">
                    End-Customer Group
                  </label>
                  <select
                    name="endCustomer"
                    value={endCustomer}
                    disabled={!mainconId || mainconGroups.length === 0}
                    onChange={(e) => {
                      setEndCustomer(e.target.value);
                      setSelectedSiteId(null);
                      setClientSiteName("");
                      setSiteSearchQuery("");
                      setDeviceId("");
                      setDeviceStatus("STANDARD");
                      setCustomDeviceDetails("");
                    }}
                    className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">{mainconId ? "All Groups / None" : "Select Maincon First"}</option>
                    {mainconGroups.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Database Site Branch Autocomplete (Smart Search) */}
              {mainconId && (
                <div className="relative p-3.5 bg-slate-50/80 dark:bg-slate-900/40 border border-card-border rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <span>📍</span>
                      <span>Search Pre-Registered Site Branches</span>
                    </label>
                    {endCustomer && (
                      <button
                        type="button"
                        onClick={() => setIsQuickAddOpen(true)}
                        className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer"
                      >
                        + Register New Branch
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      placeholder={
                        endCustomer
                          ? `Search among ${filteredSites.length} ${endCustomer} branches...`
                          : "Type site name to search..."
                      }
                      value={siteSearchQuery}
                      onChange={(e) => {
                        setSiteSearchQuery(e.target.value);
                        setIsSiteDropdownOpen(true);
                      }}
                      onFocus={() => setIsSiteDropdownOpen(true)}
                      className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs"
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
                            className="w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-900 text-foreground transition-colors flex items-center justify-between"
                          >
                            <span className="font-semibold">{s.name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-muted-text uppercase">
                              {s.state} · {s.group}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Row 3: Site Name (Direct/Manual) & State Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1.5">
                    Site / Branch Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    name="clientSiteName"
                    value={clientSiteName}
                    onChange={(e) => {
                      setClientSiteName(e.target.value);
                      setSelectedSiteId(null);
                    }}
                    placeholder="e.g. JPJ Kuala Lumpur Wangsa Maju"
                    className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                  />
                  {selectedSiteId && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block mt-1">
                      ✓ Linked to pre-registered Site ID #{selectedSiteId}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1.5">
                    State / Territory <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    name="state"
                    value={state}
                    onChange={(e) => {
                      setState(e.target.value);
                      setPartnerId("");
                      setAssignedFeId("");
                    }}
                    className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm cursor-pointer"
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
            </div>

            {/* 2. 👤 REQUESTOR INFORMATION (Dynamic Maincon Custom Fields) */}
            {mainconId && selectedMaincon && (
              <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5 border-b border-card-border pb-3">
                  <span className="text-base">👤</span>
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                      2. Requestor Information
                    </h2>
                    <p className="text-[10px] text-muted-text">Details required by {selectedMaincon.name}</p>
                  </div>
                </div>

                {(() => {
                  const fields = safeParseJson<string[]>(selectedMaincon.customFieldsSchema, []);
                  if (fields.length === 0) {
                    return (
                      <p className="text-xs text-muted-text italic">
                        No additional requestor fields configured for {selectedMaincon.name}.
                      </p>
                    );
                  }
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {fields.map((fName) => (
                        <div key={fName}>
                          <label className="block text-xs font-semibold text-muted-text mb-1">
                            {fName} <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            name={`custom_${fName}`}
                            value={customValues[fName] || ""}
                            onChange={(e) => setCustomValues({ ...customValues, [fName]: e.target.value })}
                            placeholder={`Enter ${fName}`}
                            className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* 3. ⚠️ PROBLEM & HARDWARE DETAILS */}
            <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm space-y-5">
              <div className="flex items-center gap-2.5 border-b border-card-border pb-3">
                <span className="text-base">⚠️</span>
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                    3. Problem & Hardware Details
                  </h2>
                  <p className="text-[10px] text-muted-text">Describe the issue and specify defective hardware if applicable</p>
                </div>
              </div>

              {/* Priority / Severity Segmented Chips */}
              <div>
                <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-2">
                  Severity & Priority Level <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { id: "P1" as const, label: "P1 - Critical", desc: "System Down / Immediate", color: "border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400" },
                    { id: "P2" as const, label: "P2 - High", desc: "Degraded / Urgent", color: "border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-400" },
                    { id: "P3" as const, label: "P3 - Medium", desc: "Standard Dispatch", color: "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400" },
                    { id: "P4" as const, label: "P4 - Low", desc: "Minor / General Query", color: "border-slate-400 bg-slate-500/10 text-slate-600 dark:text-slate-400" },
                  ].map((p) => {
                    const isSelected = severity === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSeverity(p.id)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? `${p.color} ring-2 ring-indigo-500/40 font-bold shadow-sm`
                            : "bg-input-bg border-card-border text-muted-text hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold">{p.label}</span>
                          {isSelected && <span className="text-xs">✓</span>}
                        </div>
                        <p className="text-[10px] opacity-75">{p.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Issue Description textarea */}
              <div>
                <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1.5">
                  Description of Issue <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  name="issueDescription"
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  placeholder="Provide details about the reported error, error codes, offline behavior, or onsite actions needed..."
                  rows={4}
                  className="w-full px-3.5 py-2.5 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm leading-relaxed"
                />
              </div>

              {/* Hardware / Device Section */}
              {showHardwareCatalog && (
                <div className="pt-4 border-t border-card-border space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">💻</span>
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Hardware Link (Optional)</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Device Search Autocomplete */}
                    <div className="relative">
                      <label className="block text-xs font-semibold text-muted-text mb-1">Search Device Catalog</label>
                      <input
                        type="text"
                        placeholder="Search model, brand, or category..."
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
                          className="absolute right-3 top-7 text-muted-text hover:text-foreground text-xs"
                        >
                          ✕ Clear
                        </button>
                      )}

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
                        </div>
                      )}
                    </div>

                    {/* Defective Serial Number */}
                    <div>
                      <label className="block text-xs font-semibold text-muted-text mb-1">Defective Serial Number</label>
                      <input
                        type="text"
                        name="defectiveSerial"
                        value={defectiveSerial}
                        onChange={(e) => setDefectiveSerial(e.target.value)}
                        placeholder="e.g. SN-998822001"
                        className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground font-mono focus:outline-none text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ═════════════════════════════════════════════════════════════════════════ */}
          {/* RIGHT PANEL (35% / 4 Cols Sticky): Dispatch, SLA & Actions */}
          {/* ═════════════════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-4 space-y-5 lg:sticky lg:top-20">
            {/* Live SLA Target Card */}
            <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm space-y-3.5">
              <div className="flex items-center gap-2 border-b border-card-border pb-2.5">
                <span className="text-base">⏱️</span>
                <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                  Target SLA & Timeline
                </h2>
              </div>

              {/* Computed SLA Badge */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-card-border space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-text font-semibold">Allocated Hours:</span>
                  <span className="font-extrabold text-foreground">
                    {computedSlaRule ? `${computedSlaRule.slaHours} Hours` : "Standard SLA"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-text font-semibold">Region Rule:</span>
                  <span className="font-semibold text-foreground">
                    {state ? (["Sabah", "Sarawak", "Labuan"].includes(state) ? "Sabah / Sarawak" : "Semenanjung") : "Select State"}
                  </span>
                </div>
                {slaDeadline && (
                  <div className="pt-2 border-t border-card-border">
                    <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 block mb-0.5">
                      Target Completion Deadline:
                    </span>
                    <span className="text-xs font-mono font-bold text-foreground">
                      {new Date(slaDeadline).toLocaleString("en-MY", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                )}
              </div>

              {/* Reported At Override */}
              <div className="pt-1">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-semibold text-muted-text">Override Reported Date</label>
                  <label className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-semibold cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={useReportedDateOverride}
                      onChange={(e) => setUseReportedDateOverride(e.target.checked)}
                      className="rounded bg-input-bg border-card-border text-indigo-600 focus:ring-indigo-500/20"
                    />
                    <span>Enable</span>
                  </label>
                </div>
                {useReportedDateOverride && (
                  <input
                    type="datetime-local"
                    name="reportedAt"
                    value={reportedAt}
                    onChange={(e) => setReportedAt(e.target.value)}
                    className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                )}
              </div>
            </div>

            {/* Service Partner Dispatch Card */}
            <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-card-border pb-2.5">
                <span className="text-base">🚀</span>
                <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                  Dispatch & Assign
                </h2>
              </div>

              {/* Service Partner */}
              <div>
                <label className="block text-xs font-semibold text-muted-text mb-1.5">
                  Service Partner Agency
                </label>
                <select
                  name="partnerId"
                  value={partnerId}
                  onChange={(e) => {
                    setPartnerId(e.target.value);
                    setAssignedFeId("");
                  }}
                  disabled={!state}
                  className="w-full px-3 py-2.5 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none text-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">{state ? "Choose Service Partner" : "Select State in Section 1 First"}</option>
                  {filteredPartners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {state && filteredPartners.length === 0 && (
                  <span className="text-[10px] text-amber-500 font-semibold block mt-1">
                    ⚠️ No partner registered for {state} yet.
                  </span>
                )}
              </div>

              {/* Field Engineer Assignment */}
              {partnerId && (
                <div>
                  <label className="block text-xs font-semibold text-muted-text mb-1.5">
                    Assign Field Engineer
                  </label>
                  <select
                    name="assignedFeId"
                    value={assignedFeId}
                    onChange={(e) => setAssignedFeId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-input-bg border border-card-border rounded-xl text-foreground focus:outline-none text-xs cursor-pointer"
                  >
                    <option value="">Leave Unassigned (Dispatch Later)</option>
                    {eligibleEngineers.map((fe) => {
                      const loc = [fe.country, fe.region].filter(Boolean).join(" - ");
                      return (
                        <option key={fe.id} value={fe.id}>
                          {fe.name} {loc ? `(${loc})` : ""} {fe.phone ? `· ${fe.phone}` : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>

            {/* Action Buttons Box */}
            <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm space-y-3">
              <button
                type="submit"
                disabled={isPending || isDuplicateRef || isCheckingRef}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-xs font-bold text-white transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Creating Ticket...</span>
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    <span>Save & Dispatch Ticket</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => router.push("/")}
                className="w-full py-2.5 border border-card-border hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl text-xs font-semibold text-muted-text hover:text-foreground transition-all cursor-pointer text-center"
              >
                Cancel & Return
              </button>
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
                className="text-muted-text hover:text-foreground cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleQuickAddSite} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-muted-text uppercase tracking-wide mb-1">
                  Site/Branch Name <span className="text-rose-500">*</span>
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
                  State / Region <span className="text-rose-500">*</span>
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
                  className="px-3 py-1.5 border border-card-border hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-bold text-white cursor-pointer"
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
