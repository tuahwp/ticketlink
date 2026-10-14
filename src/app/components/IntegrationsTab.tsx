"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  getPartnerIntegrationsData,
  createPartnerApiKeyAction,
  revokePartnerApiKeyAction,
  savePartnerWebhookAction,
  sendTestPartnerWebhookAction,
  retryPartnerWebhookAction,
} from "../actions";
import { toast } from "sonner";
import {
  KeyRound,
  Webhook,
  Activity,
  FileCode2,
  Copy,
  Check,
  RefreshCw,
  Plus,
  Trash2,
  ShieldCheck,
  Send,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  Eye,
  EyeOff,
  Globe,
  Terminal,
  FileText,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Download,
  Play,
  Sparkles,
  Lock,
} from "lucide-react";

interface Partner {
  id: number;
  name: string;
}

interface ApiKeyItem {
  id: number;
  partnerId: number;
  name: string;
  keyPrefix: string;
  token?: string;
  hasFullToken?: boolean;
  env: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  partner: { id: number; name: string };
}

interface WebhookItem {
  id: number;
  partnerId: number;
  url: string;
  secret: string;
  authHeader?: string | null;
  events: string[] | string;
  isActive: boolean;
  updatedAt: string;
  partner: { id: number; name: string };
}

interface SyncLogItem {
  id: number;
  partnerId: number;
  ticketId: number | null;
  direction: "INBOUND_API" | "OUTBOUND_WEBHOOK";
  endpoint: string;
  action: string;
  requestPayload: any;
  responseStatus: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: string;
  partner: { id: number; name: string };
}

export default function IntegrationsTab({
  currentUserRole,
  currentPartnerId,
}: {
  currentUserRole?: string;
  currentPartnerId?: number | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [activeSubTab, setActiveSubTab] = useState<"overview" | "keys" | "webhooks" | "logs" | "docs">("overview");

  // Data states
  const [partners, setPartners] = useState<Partner[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(currentPartnerId || null);
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLogItem[]>([]);
  const [stats, setStats] = useState({
    totalLogs: 0,
    activeKeysCount: 0,
    activeWebhooksCount: 0,
    outboundSuccessRate: 100,
    recentErrorsCount: 0,
  });

  // Modal & token reveal states
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyEnv, setNewKeyEnv] = useState<"SANDBOX" | "PRODUCTION">("PRODUCTION");
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<Record<number, boolean>>({});
  const [copiedKeyId, setCopiedKeyId] = useState<number | null>(null);

  // Webhook config edit states
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [webhookAuthHeader, setWebhookAuthHeader] = useState("");
  const [webhookEvents, setWebhookEvents] = useState<string[]>([
    "ticket.dispatched",
    "ticket.status_changed",
    "ticket.resolved",
  ]);
  const [webhookActive, setWebhookActive] = useState(true);
  const [showSecret, setShowSecret] = useState(false);

  // Log inspector & filters
  const [inspectedLog, setInspectedLog] = useState<SyncLogItem | null>(null);
  const [copiedGeneral, setCopiedGeneral] = useState(false);
  const [logFilter, setLogFilter] = useState<"ALL" | "ERRORS" | "INBOUND" | "OUTBOUND">("ALL");

  // Live Test Sandbox State
  const [docPhase, setDocPhase] = useState<"overview" | "webhook" | "assign" | "eta_status" | "resolve" | "areas" | "tester">("overview");
  const [testApiLoading, setTestApiLoading] = useState(false);
  const [testApiResponse, setTestApiResponse] = useState<any | null>(null);

  const loadData = async (partnerId?: number | null) => {
    try {
      const data = await getPartnerIntegrationsData(partnerId || undefined);
      setPartners(data.partners);
      setApiKeys(data.apiKeys);
      setWebhooks(data.webhooks);
      setSyncLogs(data.syncLogs);
      setStats(data.stats);

      if (!selectedPartnerId && data.partners.length > 0) {
        setSelectedPartnerId(data.partners[0].id);
      }

      // Populate webhook form for selected partner
      const targetPartnerId = partnerId || selectedPartnerId || (data.partners[0]?.id ?? null);
      if (targetPartnerId) {
        const currentWh = data.webhooks.find((w: WebhookItem) => w.partnerId === targetPartnerId);
        if (currentWh) {
          setWebhookUrl(currentWh.url || "");
          setWebhookSecret(currentWh.secret || "");
          setWebhookAuthHeader(currentWh.authHeader || "");
          setWebhookActive(currentWh.isActive);
          const evts = Array.isArray(currentWh.events)
            ? currentWh.events
            : typeof currentWh.events === "string"
            ? JSON.parse(currentWh.events || "[]")
            : [];
          setWebhookEvents(evts.length > 0 ? evts : ["ticket.dispatched", "ticket.status_changed", "ticket.resolved"]);
        } else {
          setWebhookUrl("");
          setWebhookSecret("sec_" + Math.random().toString(36).substring(2, 12));
          setWebhookAuthHeader("");
          setWebhookActive(true);
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load integrations data");
    }
  };

  useEffect(() => {
    loadData(selectedPartnerId);
  }, [selectedPartnerId]);

  const handlePartnerChange = (id: number) => {
    setSelectedPartnerId(id);
    loadData(id);
  };

  const handleCreateApiKey = () => {
    if (!selectedPartnerId) {
      toast.error("Please select a partner agency.");
      return;
    }
    if (!newKeyName.trim()) {
      toast.error("Please enter a descriptive key name.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await createPartnerApiKeyAction(selectedPartnerId, newKeyName, newKeyEnv);
        if (res.success) {
          setCreatedRawKey(res.rawKey);
          setNewKeyName("");
          toast.success("API Key generated successfully! Available to copy anytime.");
          await loadData(selectedPartnerId);
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to create API key");
      }
    });
  };

  const handleRevokeApiKey = (keyId: number) => {
    if (!confirm("Are you sure you want to revoke this API key? External systems using it will be blocked immediately.")) {
      return;
    }

    startTransition(async () => {
      try {
        await revokePartnerApiKeyAction(keyId);
        toast.success("API key revoked");
        await loadData(selectedPartnerId);
      } catch (err: any) {
        toast.error(err.message || "Failed to revoke key");
      }
    });
  };

  const handleSaveWebhook = () => {
    if (!selectedPartnerId) return;
    if (!webhookUrl.trim().startsWith("http")) {
      toast.error("Please provide a valid HTTPS/HTTP webhook URL.");
      return;
    }

    startTransition(async () => {
      try {
        await savePartnerWebhookAction(
          selectedPartnerId,
          webhookUrl,
          webhookSecret,
          webhookEvents,
          webhookActive,
          webhookAuthHeader
        );
        toast.success("Webhook settings saved successfully!");
        await loadData(selectedPartnerId);
      } catch (err: any) {
        toast.error(err.message || "Failed to save webhook settings");
      }
    });
  };

  const handleTestPing = () => {
    if (!selectedPartnerId) return;

    startTransition(async () => {
      const toastId = toast.loading("Sending test webhook ping...");
      try {
        const res = await sendTestPartnerWebhookAction(selectedPartnerId);
        if (res.success) {
          toast.success(`Ping delivered successfully! Status: ${res.status} (${res.durationMs}ms)`, { id: toastId });
        } else {
          toast.error(res.errorMessage || `Ping delivery failed with status ${res.status || "N/A"}`, { id: toastId, duration: 8000 });
        }
        await loadData(selectedPartnerId);
      } catch (err: any) {
        toast.error(err.message || "Ping failed", { id: toastId });
      }
    });
  };

  const handleRetryWebhook = (logId: number) => {
    startTransition(async () => {
      const toastId = toast.loading("Re-delivering webhook event...");
      try {
        const res = await retryPartnerWebhookAction(logId);
        if (res.success) {
          toast.success(`Webhook redelivered successfully! Status: ${res.status}`, { id: toastId });
        } else {
          toast.error(`Redelivery failed: Status ${res.status || "N/A"}. ${res.errorMessage || ""}`, { id: toastId });
        }
        await loadData(selectedPartnerId);
      } catch (err: any) {
        toast.error(err.message || "Retry failed", { id: toastId });
      }
    });
  };

  const copyToClipboard = (text: string, id?: number) => {
    navigator.clipboard.writeText(text);
    if (typeof id === "number") {
      setCopiedKeyId(id);
      setTimeout(() => setCopiedKeyId(null), 2000);
    } else {
      setCopiedGeneral(true);
      setTimeout(() => setCopiedGeneral(false), 2000);
    }
    toast.success("Token copied to clipboard!");
  };

  const toggleRevealKey = (id: number) => {
    setRevealedKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredLogs = syncLogs.filter((log) => {
    if (logFilter === "ERRORS") return (log.responseStatus && log.responseStatus >= 400) || log.errorMessage;
    if (logFilter === "INBOUND") return log.direction === "INBOUND_API";
    if (logFilter === "OUTBOUND") return log.direction === "OUTBOUND_WEBHOOK";
    return true;
  });

  const availableEvents = [
    { id: "ticket.dispatched", label: "Ticket Dispatched", desc: "Triggered when a ticket from any client is assigned to this partner" },
    { id: "ticket.status_changed", label: "Status & SubStatus Changed", desc: "Triggered on any status progression, on-site check-in, or hold note" },
    { id: "ticket.assigned", label: "Field Engineer Assigned", desc: "Triggered when an engineer is allocated to the job" },
    { id: "ticket.eta_updated", label: "Arrival ETA Updated", desc: "Triggered when estimated arrival time is changed" },
    { id: "ticket.evidence_uploaded", label: "Evidence Uploaded", desc: "Triggered when field photos or slips are attached" },
    { id: "ticket.resolved", label: "Ticket Resolved", desc: "Triggered when ticket is marked resolved with service report" },
  ];

  const currentPartner = partners.find((p) => p.id === selectedPartnerId);
  const activeKeyForPartner = apiKeys.find((k) => k.partnerId === selectedPartnerId && k.isActive && k.token) || apiKeys[0];
  const activeTokenString = activeKeyForPartner?.token || "tl_live_your_actual_token_here";

  // Live Test Sandbox Call
  const runLiveTestPull = async () => {
    if (!activeTokenString || activeTokenString.includes("your_actual_token")) {
      toast.error("No active API token found for this partner. Please generate one first.");
      return;
    }
    setTestApiLoading(true);
    setTestApiResponse(null);
    try {
      const res = await fetch("/api/v1/partner/tickets?limit=5", {
        headers: {
          Authorization: `Bearer ${activeTokenString}`,
        },
      });
      const data = await res.json();
      setTestApiResponse({
        httpStatus: res.status,
        data,
      });
      if (res.ok) {
        toast.success(`API Test Succeeded! Retrieved ${data.count ?? 0} tickets.`);
      } else {
        toast.error(`API Error: ${data.error || "Failed"}`);
      }
    } catch (err: any) {
      setTestApiResponse({
        error: err.message,
      });
      toast.error(err.message);
    } finally {
      setTestApiLoading(false);
    }
  };

  const downloadIntegrationPack = () => {
    const content = `# TicketLink - Service Partner Integration Guide
Agency: ${currentPartner?.name || "Service Partner"}
Date Generated: ${new Date().toLocaleDateString("en-MY")}

## 1. Your Credentials
- Base URL: ${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/api/v1/partner
- Authentication: Bearer Token
- Your Active Token: ${activeTokenString}

## 2. Real-Time Webhook (TicketLink -> Your System)
Whenever TicketLink creates or dispatches a ticket to your agency, our server sends an HTTPS POST:
- Webhook Header: X-TicketLink-Signature: sha256=<hmac_sha256>
- Event Name: ticket.dispatched

Payload Example:
{
  "event": "ticket.dispatched",
  "ticketId": 1042,
  "data": {
    "ticketRefNo": "TL-JPJ-089",
    "subject": "Printer malfunction",
    "clientSiteName": "JPJ Wangsa Maju",
    "address": "Jalan Wangsa Delima, 53300 KL",
    "endCustomer": "JPJ",
    "severity": "P2",
    "slaDeadline": "2026-10-14T10:00:00Z"
  }
}

## 3. Updating TicketLink from your ITS System
1. Assign Engineer:
   PATCH /api/v1/partner/tickets/:id/assign
   Body: { "engineerName": "Hafiz", "engineerPhone": "+60123456789", "externalTicketRef": "ITS-0045" }

2. Update Arrival ETA:
   PATCH /api/v1/partner/tickets/:id/eta
   Body: { "eta": "2026-10-12T14:30:00+08:00" }

3. Check-In On Site (Arrived):
   PATCH /api/v1/partner/tickets/:id/status
   Body: { "status": "IN_PROGRESS", "subStatus": "CHECKED_IN" }

4. Upload Completed Signed Report:
   POST /api/v1/partner/tickets/:id/evidence
   (multipart/form-data with file or JSON { "fileUrl": "https://..." })

5. Complete & Resolve:
   POST /api/v1/partner/tickets/:id/resolve
   Body: { "resolutionDetails": "Replaced printhead", "defectiveSerial": "DEF-901" }

6. Check Areas, Serviceable States & Client Sites:
   GET /api/v1/partner/areas
   Returns all states covered by your contract, ticket counts by state, and registered engineers.

7. Pull Tickets Filtered by State/Area:
   GET /api/v1/partner/tickets?state=Selangor&status=NEW
`;

    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ticketlink_integration_${(currentPartner?.name || "partner").toLowerCase().replace(/[^a-z0-9]/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded Partner Integration Pack!");
  };

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-indigo-500 to-teal-500 rounded-xl text-white shadow-md shadow-indigo-500/20">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-foreground tracking-tight">API &amp; Partner Integrations</h2>
              <span className="px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 rounded-md border border-emerald-200 dark:border-emerald-800">
                v1.0 Live
              </span>
            </div>
            <p className="text-xs text-muted-text mt-0.5">
              Direct system-to-system bridge for Service Partners (Universal Dispatch API &amp; Webhooks)
            </p>
          </div>
        </div>

        {/* Partner Selector & Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          {currentUserRole === "AGENT" ? (
            <div className="flex items-center gap-2 bg-indigo-50/80 dark:bg-indigo-950/60 px-3.5 py-2 rounded-xl border border-indigo-200/60 dark:border-indigo-800 shadow-sm">
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">Your Agency:</span>
              <span className="text-xs font-bold text-foreground">{currentPartner?.name || "Service Partner"}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-slate-100/80 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700">
              <span className="text-xs font-medium text-muted-text">Partner Agency:</span>
              <select
                value={selectedPartnerId || ""}
                onChange={(e) => handlePartnerChange(Number(e.target.value))}
                className="bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer"
              >
                {partners.map((p) => (
                  <option key={p.id} value={p.id} className="dark:bg-slate-900">
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={() => loadData(selectedPartnerId)}
            disabled={isPending}
            className="p-2 text-muted-text hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Sub Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        {[
          { id: "overview", label: "Overview & Health", icon: Activity },
          { id: "keys", label: "API Keys", count: stats.activeKeysCount, icon: KeyRound },
          { id: "webhooks", label: "Webhooks", count: stats.activeWebhooksCount, icon: Webhook },
          { id: "logs", label: "Sync Activity Logs", count: stats.totalLogs, icon: Terminal },
          { id: "docs", label: "Integration Guide", icon: FileCode2 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                  : "text-muted-text hover:text-foreground hover:bg-slate-100/70 dark:hover:bg-slate-800/60"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {typeof tab.count === "number" && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-800 text-muted-text"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* -------------------------------------------------------------------------------- */}
      {/* 1. OVERVIEW & HEALTH */}
      {/* -------------------------------------------------------------------------------- */}
      {activeSubTab === "overview" && (
        <div className="space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-text uppercase tracking-wider">Outbound Success</span>
                <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-foreground">{stats.outboundSuccessRate}%</span>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Webhook delivery</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-text uppercase tracking-wider">Active API Keys</span>
                <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                  <KeyRound className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-foreground">{stats.activeKeysCount}</span>
                <span className="text-[11px] text-muted-text">for {currentPartner?.name || "All"}</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-text uppercase tracking-wider">Total Synced Events</span>
                <span className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400">
                  <Activity className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-foreground">{stats.totalLogs}</span>
                <span className="text-[11px] text-muted-text">Audit records</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-text uppercase tracking-wider">Recent Errors</span>
                <span className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-foreground">{stats.recentErrorsCount}</span>
                <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Failed syncs</span>
              </div>
            </div>
          </div>

          {/* Integration Status Card & Quick Access */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-900/90 to-slate-950 border border-indigo-800/40 text-white shadow-xl relative overflow-hidden">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Multi-Client Service Partner Integration (Universal Dispatch Bridge)</span>
              </div>
              <h3 className="text-xl font-bold tracking-tight mb-2">
                Integration Ready for {currentPartner?.name || "Service Partner"}
              </h3>
              <p className="text-xs text-indigo-200/80 leading-relaxed mb-6">
                TicketLink connects external partner ticket systems (e.g. ITS, Apex Support) with real-time webhooks,
                tenant-isolated Bearer API keys, and two-way status and evidence sync across all client contracts and end-customers.
              </p>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setActiveSubTab("keys")}
                  className="px-4 py-2 bg-white text-indigo-950 hover:bg-indigo-50 font-semibold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>View &amp; Copy API Keys</span>
                </button>
                <button
                  onClick={() => setActiveSubTab("webhooks")}
                  className="px-4 py-2 bg-indigo-800/60 hover:bg-indigo-700/60 text-white font-semibold text-xs rounded-xl border border-indigo-700/50 transition-all cursor-pointer flex items-center gap-2"
                >
                  <Webhook className="w-3.5 h-3.5" />
                  <span>Configure Webhooks</span>
                </button>
                <button
                  onClick={() => setActiveSubTab("docs")}
                  className="px-4 py-2 bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-200 font-semibold text-xs rounded-xl border border-indigo-800/60 transition-all cursor-pointer flex items-center gap-2"
                >
                  <FileCode2 className="w-3.5 h-3.5" />
                  <span>Interactive Guide &amp; Test</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------------------- */}
      {/* 2. API KEYS MANAGEMENT */}
      {/* -------------------------------------------------------------------------------- */}
      {activeSubTab === "keys" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-foreground">Partner API Tokens</h3>
              <p className="text-xs text-muted-text">
                {currentUserRole === "AGENT"
                  ? "Your agency's active integration token. Click Reveal to view or Copy to paste into your ITS system."
                  : "Generate, inspect, and copy scoped Bearer tokens for external system-to-system access."}
              </p>
            </div>
            {currentUserRole !== "AGENT" && (
              <button
                onClick={() => {
                  setCreatedRawKey(null);
                  setShowNewKeyModal(true);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Generate New Key</span>
              </button>
            )}
          </div>

          {/* Newly Created Key Alert Box */}
          {createdRawKey && (
            <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <span className="font-bold text-sm">New API Key Created!</span>
                </div>
                <span className="text-[11px] font-mono bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-700 dark:text-emerald-300">
                  Active &amp; Ready
                </span>
              </div>
              <p className="text-xs text-emerald-800 dark:text-emerald-300/90">
                You can copy this token now or view/copy it anytime from the table below. Both Moderators and your Partner Agents can reveal it whenever needed.
              </p>
              <div className="flex items-center gap-2 bg-white/80 dark:bg-slate-900/90 p-2.5 rounded-xl border border-emerald-500/40">
                <code className="text-xs font-mono text-foreground flex-1 break-all select-all">
                  {createdRawKey}
                </code>
                <button
                  onClick={() => copyToClipboard(createdRawKey)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Token</span>
                </button>
              </div>
            </div>
          )}

          {/* Keys Table with Inline Reveal and Copy */}
          <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-muted-text font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4 min-w-[280px]">Key Name &amp; Token</th>
                    <th className="py-3 px-4">Partner Agency</th>
                    <th className="py-3 px-4">Environment</th>
                    <th className="py-3 px-4">Created Date</th>
                    <th className="py-3 px-4">Last Used</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-foreground">
                  {apiKeys.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-text">
                        No API keys generated yet. Click &quot;Generate New Key&quot; to issue credentials.
                      </td>
                    </tr>
                  ) : (
                    apiKeys.map((key) => {
                      const tokenVal = key.token || key.keyPrefix;
                      const isRevealed = Boolean(revealedKeys[key.id]);
                      const isCopied = copiedKeyId === key.id;

                      return (
                        <tr key={key.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-foreground">{key.name}</div>
                            {/* Inline Token Display with Reveal and Copy */}
                            <div className="flex items-center gap-2 mt-1.5">
                              <div className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg text-foreground max-w-[260px] truncate select-all border border-slate-200 dark:border-slate-700">
                                {isRevealed ? tokenVal : `${tokenVal.substring(0, 8)}••••••••••••••••••••`}
                              </div>
                              <button
                                type="button"
                                onClick={() => toggleRevealKey(key.id)}
                                className="p-1.5 rounded-lg text-muted-text hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                title={isRevealed ? "Hide Token" : "Reveal Token"}
                              >
                                {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(tokenVal, key.id)}
                                className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 font-semibold text-[11px] rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                                title="Copy Token to Clipboard"
                              >
                                {isCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                <span>{isCopied ? "Copied" : "Copy"}</span>
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-medium">{key.partner?.name || "Service Partner"}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                                key.env === "SANDBOX"
                                  ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800"
                                  : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800"
                              }`}
                            >
                              {key.env}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-muted-text">
                            {new Date(key.createdAt).toLocaleDateString("en-MY")}
                          </td>
                          <td className="py-3 px-4 text-muted-text">
                            {key.lastUsedAt
                              ? new Date(key.lastUsedAt).toLocaleString("en-MY", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })
                              : "Never"}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {currentUserRole !== "AGENT" ? (
                              <button
                                onClick={() => handleRevokeApiKey(key.id)}
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-all cursor-pointer"
                                title="Revoke Key"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : (
                              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium font-mono">ACTIVE</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Generate New Key */}
      {showNewKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-foreground">Generate Partner API Token</h3>
            <p className="text-xs text-muted-text">
              Create an authentication key for {currentPartner?.name || "selected partner"}. You and the partner will be able to reveal and copy it anytime.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Key Description / Label</label>
                <input
                  type="text"
                  placeholder="e.g. ITS System Primary Sync (Production)"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Target Environment</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewKeyEnv("PRODUCTION")}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border text-center cursor-pointer transition-all ${
                      newKeyEnv === "PRODUCTION"
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-slate-50 dark:bg-slate-800 text-muted-text border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    Production (tl_live_)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewKeyEnv("SANDBOX")}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border text-center cursor-pointer transition-all ${
                      newKeyEnv === "SANDBOX"
                        ? "bg-amber-600 text-white border-amber-600"
                        : "bg-slate-50 dark:bg-slate-800 text-muted-text border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    Sandbox (tl_test_)
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowNewKeyModal(false)}
                className="px-4 py-2 text-xs font-semibold text-muted-text hover:text-foreground cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  handleCreateApiKey();
                  setShowNewKeyModal(false);
                }}
                disabled={isPending || !newKeyName.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl cursor-pointer transition-all"
              >
                Generate Key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------------------- */}
      {/* 3. WEBHOOKS & SUBSCRIPTIONS */}
      {/* -------------------------------------------------------------------------------- */}
      {activeSubTab === "webhooks" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-foreground">Outbound Webhooks Configuration</h3>
              <p className="text-xs text-muted-text">
                TicketLink pushes real-time event payloads to your partner server endpoint via HTTPS.
              </p>
            </div>
            <button
              onClick={handleTestPing}
              disabled={isPending || !webhookUrl}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-foreground text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm transition-all cursor-pointer flex items-center gap-2"
            >
              <Send className="w-3.5 h-3.5 text-indigo-500" />
              <span>Send Test Ping</span>
            </button>
          </div>

          <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 space-y-6 shadow-sm">
            {/* Target URL */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground flex items-center gap-2">
                <Globe className="w-4 h-4 text-indigo-500" />
                <span>Partner Webhook Endpoint URL</span>
              </label>
              <input
                type="url"
                placeholder="https://partner-system.com/api/webhooks/ticketlink"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="w-full text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-[11px] text-muted-text block">
                Must accept HTTPS POST requests and return HTTP 200 OK within 10 seconds.
              </span>
            </div>

            {/* Shared Secret */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-teal-500" />
                <span>Webhook HMAC-SHA256 Secret</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type={showSecret ? "text" : "password"}
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  className="flex-1 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-foreground focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="p-2 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-muted-text cursor-pointer"
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(webhookSecret)}
                  className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-foreground rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Copy
                </button>
              </div>
              <span className="text-[11px] text-muted-text block">
                Used to verify payloads via the <code className="font-mono text-indigo-500">X-TicketLink-Signature: sha256=...</code> header.
              </span>
            </div>

            {/* Optional Custom Auth Header / Bearer Token */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-500" />
                  <span>Webhook Auth Header / Bearer Token (Optional)</span>
                </span>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Resolves HTTP 401 on partner receiver</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Bearer your_partner_incoming_token_here (or raw token string)"
                value={webhookAuthHeader}
                onChange={(e) => setWebhookAuthHeader(e.target.value)}
                className="w-full text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-[11px] text-muted-text block">
                If the partner webhook listener requires an <code className="font-mono text-amber-600 dark:text-amber-400">Authorization: Bearer &lt;token&gt;</code> header (or returned HTTP 401 Unauthorized during ping), enter their token here. TicketLink will transmit it alongside the HMAC signature.
              </span>
            </div>

            {/* Subscribed Events Checklist */}
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="text-xs font-bold text-foreground block">Subscribed Event Triggers</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {availableEvents.map((evt) => {
                  const isChecked = webhookEvents.includes(evt.id);
                  return (
                    <div
                      key={evt.id}
                      onClick={() => {
                        if (isChecked) {
                          setWebhookEvents(webhookEvents.filter((e) => e !== evt.id));
                        } else {
                          setWebhookEvents([...webhookEvents, evt.id]);
                        }
                      }}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                        isChecked
                          ? "bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 text-foreground"
                          : "bg-slate-50/50 dark:bg-slate-800/30 border-slate-200/80 dark:border-slate-700/60 text-muted-text hover:bg-slate-100/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="mt-0.5 rounded text-indigo-600 focus:ring-0 cursor-pointer"
                      />
                      <div>
                        <div className="text-xs font-bold text-foreground">{evt.label}</div>
                        <div className="text-[11px] font-mono text-indigo-500 dark:text-indigo-400 mt-0.5">{evt.id}</div>
                        <div className="text-[11px] text-muted-text mt-1">{evt.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Active Toggle & Save */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={webhookActive}
                  onChange={(e) => setWebhookActive(e.target.checked)}
                  className="rounded text-indigo-600 cursor-pointer"
                />
                <span className="text-xs font-semibold text-foreground">Enable outbound webhook delivery</span>
              </label>

              <button
                onClick={handleSaveWebhook}
                disabled={isPending}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
              >
                <span>Save Webhook Settings</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------------------- */}
      {/* 4. SYNC ACTIVITY LOGS */}
      {/* -------------------------------------------------------------------------------- */}
      {activeSubTab === "logs" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-foreground">System Synchronization Logs</h3>
              <p className="text-xs text-muted-text">
                Live audit trail of inbound REST API calls and outbound webhook event dispatches.
              </p>
            </div>

            {/* Log filter buttons */}
            <div className="flex items-center gap-1.5 bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700">
              {(["ALL", "ERRORS", "OUTBOUND", "INBOUND"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setLogFilter(filter)}
                  className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                    logFilter === filter
                      ? "bg-white dark:bg-slate-700 text-foreground shadow-sm"
                      : "text-muted-text hover:text-foreground"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {/* Logs Table */}
          <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-muted-text font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Direction &amp; Action</th>
                    <th className="py-3 px-4">Endpoint</th>
                    <th className="py-3 px-4">Ticket</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Duration</th>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-foreground">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted-text">
                        No synchronization events recorded for this filter.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => {
                      const isSuccess = log.responseStatus && log.responseStatus >= 200 && log.responseStatus < 300;
                      return (
                        <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              {log.direction === "OUTBOUND_WEBHOOK" ? (
                                <span className="p-1 rounded bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400">
                                  <ArrowUpRight className="w-3.5 h-3.5" />
                                </span>
                              ) : (
                                <span className="p-1 rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                                  <ArrowDownLeft className="w-3.5 h-3.5" />
                                </span>
                              )}
                              <span className="font-semibold text-foreground font-mono text-[11px]">{log.action}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-muted-text font-mono text-[11px] max-w-[200px] truncate" title={log.endpoint}>
                            {log.endpoint}
                          </td>
                          <td className="py-3 px-4 font-mono font-medium">
                            {log.ticketId ? `#${log.ticketId}` : "—"}
                          </td>
                          <td className="py-3 px-4">
                            {log.responseStatus ? (
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                                  isSuccess
                                    ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400"
                                    : "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400"
                                }`}
                              >
                                {log.responseStatus}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400">
                                TIMEOUT
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-muted-text font-mono text-[11px]">
                            {log.durationMs ? `${log.durationMs}ms` : "—"}
                          </td>
                          <td className="py-3 px-4 text-muted-text text-[11px]">
                            {new Date(log.createdAt).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setInspectedLog(log)}
                                className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-foreground text-[11px] font-medium rounded-lg transition-all cursor-pointer"
                              >
                                Inspect
                              </button>
                              {log.direction === "OUTBOUND_WEBHOOK" && !isSuccess && (
                                <button
                                  onClick={() => handleRetryWebhook(log.id)}
                                  disabled={isPending}
                                  className="px-2 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 rounded-lg text-[11px] font-medium transition-all cursor-pointer"
                                  title="Retry Delivery"
                                >
                                  Retry
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Inspect Log Payload */}
      {inspectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl p-6 space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-foreground">Event Payload Inspector</h3>
                <span className="text-xs font-mono text-muted-text">
                  {inspectedLog.action} • {inspectedLog.endpoint}
                </span>
              </div>
              <button
                onClick={() => setInspectedLog(null)}
                className="text-muted-text hover:text-foreground p-1 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto flex-1 pr-1">
              <div>
                <span className="text-xs font-bold text-foreground block mb-1">Request Payload (JSON):</span>
                <pre className="p-3 bg-slate-950 text-slate-200 rounded-xl text-[11px] font-mono overflow-x-auto max-h-56">
                  {JSON.stringify(inspectedLog.requestPayload, null, 2)}
                </pre>
              </div>

              {inspectedLog.responseBody && (
                <div>
                  <span className="text-xs font-bold text-foreground block mb-1">Response Body:</span>
                  <pre className="p-3 bg-slate-950 text-slate-200 rounded-xl text-[11px] font-mono overflow-x-auto max-h-40">
                    {inspectedLog.responseBody}
                  </pre>
                </div>
              )}

              {inspectedLog.errorMessage && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-600 dark:text-rose-400 text-xs">
                  <strong>Error Message:</strong> {inspectedLog.errorMessage}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              {inspectedLog.direction === "OUTBOUND_WEBHOOK" && (
                <button
                  onClick={() => {
                    handleRetryWebhook(inspectedLog.id);
                    setInspectedLog(null);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Retry Dispatch
                </button>
              )}
              <button
                onClick={() => setInspectedLog(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-foreground text-xs font-semibold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------------------- */}
      {/* 5. REDESIGNED STEP-BY-STEP PARTNER INTEGRATION GUIDE */}
      {/* -------------------------------------------------------------------------------- */}
      {activeSubTab === "docs" && (
        <div className="space-y-6">
          {/* Header & Quick Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-indigo-500/10 via-teal-500/10 to-transparent p-5 rounded-2xl border border-indigo-200/60 dark:border-indigo-900/40">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-base font-bold text-foreground">Service Partner Integration Walkthrough</h3>
              </div>
              <p className="text-xs text-muted-text mt-0.5">
                Panduan integrasi sistem ke sistem bagi agensi rakan perkhidmatan ({currentPartner?.name || "Service Partner"}).
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={downloadIntegrationPack}
                className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-foreground text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all cursor-pointer flex items-center gap-2"
              >
                <Download className="w-3.5 h-3.5 text-indigo-500" />
                <span>Download Integration Pack (.md)</span>
              </button>
            </div>
          </div>

          {/* Partner Credentials Banner (Pre-Filled with Active Token) */}
          <div className="p-5 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 space-y-3 shadow-sm">
            <span className="text-[11px] font-bold text-muted-text uppercase tracking-wider block">
              Active Authentication Credentials for {currentPartner?.name || "Your Agency"}
            </span>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[10px] text-muted-text block mb-1">Base API URL:</span>
                <code className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 block select-all">
                  {typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/api/v1/partner
                </code>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[10px] text-muted-text block mb-1">Your Bearer Token (Pre-filled):</span>
                  <code className="text-xs font-mono font-bold text-foreground block truncate select-all">
                    {activeTokenString}
                  </code>
                </div>
                <button
                  onClick={() => copyToClipboard(activeTokenString)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer flex-shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </button>
              </div>
            </div>
          </div>

          {/* Workflow Phase Tabs */}
          <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
            {[
              { id: "overview", label: "1. Integration Flow" },
              { id: "webhook", label: "2. Webhook (Receive Tickets)" },
              { id: "assign", label: "3. Assign Engineer" },
              { id: "eta_status", label: "4. ETA & On-Site Arrival" },
              { id: "resolve", label: "5. Upload & Resolve" },
              { id: "areas", label: "6. Check Areas & Sites" },
              { id: "tester", label: "🚀 Live API Tester" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setDocPhase(p.id as any)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  docPhase === p.id
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                    : "text-muted-text hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Phase 1: High Level Architecture */}
          {docPhase === "overview" && (
            <div className="p-6 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 space-y-6">
              <h4 className="text-sm font-bold text-foreground">How System-to-System Synchronization Works</h4>
              <p className="text-xs text-muted-text leading-relaxed">
                Integrasi ini membolehkan sistem tiket dalaman agensi anda ({currentPartner?.name}) berhubung secara terus dengan TicketLink.
                Sebarang tiket yang diagihkan kepada agensi anda akan dihantar serta-merta ke pelayan anda melalui <strong>Webhook</strong>,
                dan sebarang kemas kini daripada jurutera anda (nama FE, ETA, kehadiran di tapak, bukti servis) akan dihantar kembali ke TicketLink melalui <strong>REST API</strong>.
              </p>

              {/* Step By Step Diagram Box */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-900/50 space-y-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">1</span>
                  <div className="font-bold text-xs text-foreground">Ticket Created &amp; Dispatched</div>
                  <div className="text-[11px] text-muted-text">TicketLink sends real-time webhook payload to your ITS endpoint with ticket details.</div>
                </div>

                <div className="p-4 rounded-xl bg-teal-50/60 dark:bg-teal-950/40 border border-teal-200/70 dark:border-teal-900/50 space-y-2">
                  <span className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-bold">2</span>
                  <div className="font-bold text-xs text-foreground">ITS Assigns Engineer</div>
                  <div className="text-[11px] text-muted-text">Your system assigns field engineer &amp; sends your internal ticket ID via <code className="font-mono">PATCH /assign</code>.</div>
                </div>

                <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-900/50 space-y-2">
                  <span className="w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs font-bold">3</span>
                  <div className="font-bold text-xs text-foreground">Enroute &amp; On-Site Arrival</div>
                  <div className="text-[11px] text-muted-text">Engineer updates arrival ETA and checks in on-site via <code className="font-mono">PATCH /status</code>.</div>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-900/50 space-y-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">4</span>
                  <div className="font-bold text-xs text-foreground">Resolve &amp; Service Report</div>
                  <div className="text-[11px] text-muted-text">Upload signed service report PDF/photo via <code className="font-mono">POST /evidence</code> &amp; mark resolved via <code className="font-mono">POST /resolve</code>.</div>
                </div>
              </div>
            </div>
          )}

          {/* Phase 2: Webhook Push */}
          {docPhase === "webhook" && (
            <div className="p-6 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 space-y-4">
              <div>
                <h4 className="text-sm font-bold text-foreground">Receiving Dispatched Tickets in Your System (Webhook)</h4>
                <p className="text-xs text-muted-text mt-1">
                  TicketLink automatically performs an HTTPS POST to the Webhook URL you configured under the &quot;Webhooks&quot; tab whenever a ticket is assigned to your agency.
                </p>
              </div>

              <div className="bg-slate-950 text-slate-200 p-4 rounded-xl font-mono text-[11px] space-y-2 overflow-x-auto">
                <div className="text-slate-400">// Sample Payload sent to your webhook endpoint:</div>
                <pre>{JSON.stringify(
                  {
                    event: "ticket.dispatched",
                    timestamp: "2026-10-12T09:30:00Z",
                    partnerId: currentPartner?.id || 3,
                    ticketId: 1042,
                    data: {
                      ticketRefNo: "TL-JPJ-2026-0045",
                      subject: "Thermal receipt printer replacement",
                      issueDescription: "Printer head jammed, unable to output road tax slip",
                      clientSiteName: "JPJ Cawangan Wangsa Maju",
                      state: "Kuala Lumpur",
                      address: "Jalan Wangsa Delima, 53300 Kuala Lumpur",
                      endCustomer: "JPJ",
                      representAs: "Direct Client",
                      severity: "P2",
                      slaDeadline: "2026-10-14T12:00:00Z",
                      status: "NEW",
                      reportedAt: "2026-10-12T08:00:00Z",
                      maincon: { id: 1, name: "Telekom Malaysia (TM)" },
                    },
                  },
                  null,
                  2
                )}</pre>
              </div>
            </div>
          )}

          {/* Phase 3: Engineer Assignment */}
          {docPhase === "assign" && (
            <div className="p-6 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 space-y-4">
              <div>
                <h4 className="text-sm font-bold text-foreground">Step 3A: Assign Field Engineer &amp; Link Your Internal Ticket ID</h4>
                <p className="text-xs text-muted-text mt-1">
                  When your dispatcher allocates an engineer in your ITS system, call this endpoint to sync the engineer and store your internal ticket reference number inside TicketLink.
                </p>
              </div>

              <div className="bg-slate-950 text-slate-200 p-4 rounded-xl font-mono text-[11px] space-y-2 overflow-x-auto">
                <div className="text-emerald-400">PATCH /api/v1/partner/tickets/:ticketId/assign</div>
                <div className="text-slate-400">Authorization: Bearer {activeTokenString}</div>
                <div className="text-slate-400">Content-Type: application/json</div>
                <pre>{JSON.stringify(
                  {
                    engineerName: "Mohd Hafiz",
                    engineerPhone: "+60123456789",
                    engineerEmail: "hafiz@partner.com",
                    externalTicketRef: "ITS-JPJ-0045",
                    notes: "Allocated from Cheras branch depot",
                  },
                  null,
                  2
                )}</pre>
              </div>
            </div>
          )}

          {/* Phase 4: ETA & On-Site Arrival */}
          {docPhase === "eta_status" && (
            <div className="p-6 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 space-y-6">
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-foreground">Step 3B: Set Arrival ETA</h4>
                <div className="bg-slate-950 text-slate-200 p-4 rounded-xl font-mono text-[11px] space-y-2 overflow-x-auto">
                  <div className="text-emerald-400">PATCH /api/v1/partner/tickets/:ticketId/eta</div>
                  <pre>{JSON.stringify(
                    {
                      eta: "2026-10-12T14:30:00+08:00",
                      notes: "Travelling on MRR2 highway",
                    },
                    null,
                    2
                  )}</pre>
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-sm font-bold text-foreground">Step 3C: Arrive On-Site (Check-In)</h4>
                <p className="text-xs text-muted-text">
                  Set status to <code className="font-mono">IN_PROGRESS</code> and subStatus to <code className="font-mono">CHECKED_IN</code> to log on-site arrival time and satisfy SLA requirements.
                </p>
                <div className="bg-slate-950 text-slate-200 p-4 rounded-xl font-mono text-[11px] space-y-2 overflow-x-auto">
                  <div className="text-emerald-400">PATCH /api/v1/partner/tickets/:ticketId/status</div>
                  <pre>{JSON.stringify(
                    {
                      status: "IN_PROGRESS",
                      subStatus: "CHECKED_IN",
                      notes: "Engineer arrived at customer site and logged in with site security officer.",
                    },
                    null,
                    2
                  )}</pre>
                </div>
              </div>
            </div>
          )}

          {/* Phase 5: Resolve & Service Report */}
          {docPhase === "resolve" && (
            <div className="p-6 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 space-y-6">
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-foreground">Step 3D: Upload Evidence or Completed Service Slip</h4>
                <div className="bg-slate-950 text-slate-200 p-4 rounded-xl font-mono text-[11px] space-y-2 overflow-x-auto">
                  <div className="text-emerald-400">POST /api/v1/partner/tickets/:ticketId/evidence</div>
                  <pre>{JSON.stringify(
                    {
                      fileUrl: "https://your-cloud-storage.com/slips/signed_slip_1042.pdf",
                      fileName: "signed_slip_1042.pdf",
                      tag: "SERVICE_REPORT",
                      notes: "Customer signed acknowledgement slip",
                    },
                    null,
                    2
                  )}</pre>
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-sm font-bold text-foreground">Step 3E: Mark Ticket Resolved</h4>
                <div className="bg-slate-950 text-slate-200 p-4 rounded-xl font-mono text-[11px] space-y-2 overflow-x-auto">
                  <div className="text-emerald-400">POST /api/v1/partner/tickets/:ticketId/resolve</div>
                  <pre>{JSON.stringify(
                    {
                      resolutionDetails: "Replaced defective thermal printhead and verified test print calibration.",
                      defectiveSerial: "PRN-DEF-99124",
                      serviceReportUrl: "https://your-cloud-storage.com/slips/signed_slip_1042.pdf",
                    },
                    null,
                    2
                  )}</pre>
                </div>
              </div>
            </div>
          )}

          {/* Phase 6: Check Areas & Sites */}
          {docPhase === "areas" && (
            <div className="p-6 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 space-y-6">
              <div>
                <h4 className="text-sm font-bold text-foreground">Check Serviceable Areas, States &amp; Customer Branch Sites</h4>
                <p className="text-xs text-muted-text mt-1">
                  Use this endpoint to inspect all geographic coverage areas, states, active ticket volume per state, customer branch sites, and registered engineers linked to your partner agency.
                </p>
              </div>

              <div className="space-y-3">
                <span className="text-xs font-bold text-foreground block">1. Check Coverage Areas &amp; Sites</span>
                <div className="bg-slate-950 text-slate-200 p-4 rounded-xl font-mono text-[11px] space-y-2 overflow-x-auto">
                  <div className="text-emerald-400">GET /api/v1/partner/areas</div>
                  <div className="text-slate-400">Authorization: Bearer {activeTokenString}</div>
                  <pre>{JSON.stringify(
                    {
                      success: true,
                      partner: { id: currentPartner?.id || 3, name: currentPartner?.name || "ITS" },
                      summary: {
                        coveredStatesCount: 3,
                        totalSitesCount: 42,
                        registeredEngineersCount: 8,
                        activeTicketsCount: 14,
                        totalTicketsCount: 85,
                      },
                      states: [
                        { state: "Selangor", totalTickets: 45, activeTickets: 8, distinctSitesCount: 22 },
                        { state: "Kuala Lumpur", totalTickets: 30, activeTickets: 5, distinctSitesCount: 15 },
                        { state: "Perak", totalTickets: 10, activeTickets: 1, distinctSitesCount: 5 },
                      ],
                    },
                    null,
                    2
                  )}</pre>
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-foreground block">2. Filter Dispatched Tickets by State / Area</span>
                <p className="text-xs text-muted-text">
                  You can pass <code className="font-mono text-indigo-500">?state=</code> or <code className="font-mono text-indigo-500">?area=</code> when fetching tickets to scope tickets to specific regional dispatch hubs.
                </p>
                <div className="bg-slate-950 text-slate-200 p-4 rounded-xl font-mono text-[11px] space-y-2 overflow-x-auto">
                  <div className="text-emerald-400">GET /api/v1/partner/tickets?state=Selangor&amp;status=NEW</div>
                  <div className="text-slate-400">Authorization: Bearer {activeTokenString}</div>
                </div>
              </div>
            </div>
          )}

          {/* Phase 6: Interactive Live API Tester */}
          {docPhase === "tester" && (
            <div className="p-6 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 space-y-5">
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Play className="w-4 h-4 text-emerald-500" />
                  <span>Interactive API Tester (Live In-Browser Call)</span>
                </h4>
                <p className="text-xs text-muted-text mt-1">
                  Test your integration immediately right from this browser tab using your active Bearer token.
                </p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-foreground block">Endpoint: GET /api/v1/partner/tickets</span>
                  <span className="text-[11px] text-muted-text font-mono">Header: Authorization: Bearer {activeTokenString.substring(0, 16)}...</span>
                </div>
                <button
                  onClick={runLiveTestPull}
                  disabled={testApiLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer flex-shrink-0"
                >
                  <Play className={`w-3.5 h-3.5 ${testApiLoading ? "animate-spin" : ""}`} />
                  <span>{testApiLoading ? "Executing..." : "Execute Test Call"}</span>
                </button>
              </div>

              {testApiResponse && (
                <div className="space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-foreground">Response Output:</span>
                    <span
                      className={`px-2 py-0.5 rounded font-bold ${
                        testApiResponse.httpStatus === 200
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                          : "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
                      }`}
                    >
                      Status {testApiResponse.httpStatus || "Error"}
                    </span>
                  </div>
                  <pre className="p-4 bg-slate-950 text-slate-200 rounded-xl text-[11px] font-mono overflow-x-auto max-h-72">
                    {JSON.stringify(testApiResponse.data || testApiResponse, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
