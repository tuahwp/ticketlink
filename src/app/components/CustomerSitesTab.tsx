"use client";

import React, { useState, useEffect, useMemo, useTransition } from "react";
import {
  MapPin,
  Building2,
  Upload,
  Download,
  Plus,
  Search,
  Trash2,
  Edit3,
  Filter,
  CheckCircle2,
  AlertCircle,
  Layers,
  FileSpreadsheet,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  Shield,
  Tag,
  Ticket,
} from "lucide-react";
import { toast } from "sonner";
import {
  getEndCustomerSites,
  createEndCustomerSite,
  updateEndCustomerSite,
  deleteEndCustomerSite,
  bulkImportEndCustomerSites,
  getMaincons,
} from "@/app/actions";

interface MainconOption {
  id: number;
  name: string;
  siteCustomers?: unknown;
}

interface EndCustomerSiteItem {
  id: number;
  name: string;
  group: string;
  state: string;
  mainconId: number;
  maincon?: {
    id: number;
    name: string;
  };
  _count?: {
    tickets: number;
  };
}

const MALAYSIAN_STATES = [
  "Johor",
  "Kedah",
  "Kelantan",
  "Kuala Lumpur",
  "Labuan",
  "Melaka",
  "Negeri Sembilan",
  "Pahang",
  "Penang",
  "Perak",
  "Perlis",
  "Putrajaya",
  "Sabah",
  "Sarawak",
  "Selangor",
  "Terengganu",
];

export default function CustomerSitesTab() {
  const [sites, setSites] = useState<EndCustomerSiteItem[]>([]);
  const [maincons, setMaincons] = useState<MainconOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMainconId, setSelectedMainconId] = useState<string>("ALL");
  const [selectedGroup, setSelectedGroup] = useState<string>("ALL");
  const [selectedState, setSelectedState] = useState<string>("ALL");

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<EndCustomerSiteItem | null>(null);
  const [deletingSite, setDeletingSite] = useState<EndCustomerSiteItem | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Form States (Single Add/Edit)
  const [formData, setFormData] = useState({
    name: "",
    group: "",
    state: "Selangor",
    mainconId: "",
  });

  // CSV Import States
  const [importMainconId, setImportMainconId] = useState<string>("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedCsvRows, setParsedCsvRows] = useState<
    Array<{ name: string; group: string; state: string; error?: string }>
  >([]);
  const [isParsingCsv, setIsParsingCsv] = useState(false);

  // Fetch data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [fetchedSites, fetchedMaincons] = await Promise.all([
        getEndCustomerSites(),
        getMaincons(),
      ]);
      setSites(fetchedSites || []);
      setMaincons(fetchedMaincons || []);
      if (fetchedMaincons && fetchedMaincons.length > 0 && !importMainconId) {
        setImportMainconId(String(fetchedMaincons[0].id));
      }
    } catch (error) {
      console.error("Failed to load customer sites:", error);
      toast.error("Failed to load customer sites data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Available unique groups dynamically collected
  const availableGroups = useMemo(() => {
    const groups = new Set<string>();
    sites.forEach((s) => {
      if (s.group?.trim()) groups.add(s.group.trim());
    });
    // Also include configured groups from maincon siteCustomers
    maincons.forEach((m) => {
      let custs: string[] = [];
      if (typeof m.siteCustomers === "string") {
        try {
          custs = JSON.parse(m.siteCustomers);
        } catch {}
      } else if (Array.isArray(m.siteCustomers)) {
        custs = m.siteCustomers;
      }
      custs.forEach((c) => {
        if (c?.trim()) groups.add(c.trim());
      });
    });
    return Array.from(groups).sort();
  }, [sites, maincons]);

  // Filtered Sites List
  const filteredSites = useMemo(() => {
    return sites.filter((site) => {
      // Maincon filter
      if (selectedMainconId !== "ALL" && String(site.mainconId) !== selectedMainconId) {
        return false;
      }
      // Group filter
      if (selectedGroup !== "ALL" && site.group !== selectedGroup) {
        return false;
      }
      // State filter
      if (selectedState !== "ALL" && site.state !== selectedState) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = site.name.toLowerCase().includes(q);
        const matchGroup = site.group.toLowerCase().includes(q);
        const matchState = site.state.toLowerCase().includes(q);
        const matchMaincon = site.maincon?.name.toLowerCase().includes(q);
        if (!matchName && !matchGroup && !matchState && !matchMaincon) {
          return false;
        }
      }
      return true;
    });
  }, [sites, selectedMainconId, selectedGroup, selectedState, searchQuery]);

  // Pagination Slice
  const totalPages = Math.ceil(filteredSites.length / pageSize) || 1;
  const paginatedSites = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSites.slice(start, start + pageSize);
  }, [filteredSites, currentPage, pageSize]);

  // Handle Add/Edit Submit
  const handleSaveSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.group.trim() || !formData.state || !formData.mainconId) {
      toast.error("Please fill in all required fields.");
      return;
    }

    startTransition(async () => {
      try {
        if (editingSite) {
          await updateEndCustomerSite(editingSite.id, {
            name: formData.name.trim(),
            group: formData.group.trim(),
            state: formData.state,
            mainconId: Number(formData.mainconId),
          });
          toast.success("Site details updated successfully.");
        } else {
          await createEndCustomerSite({
            name: formData.name.trim(),
            group: formData.group.trim(),
            state: formData.state,
            mainconId: Number(formData.mainconId),
          });
          toast.success("New branch site added successfully.");
        }
        setIsAddModalOpen(false);
        setEditingSite(null);
        await loadData();
      } catch (err: any) {
        toast.error(err.message || "Failed to save site.");
      }
    });
  };

  // Handle Delete Site
  const handleDeleteSite = async () => {
    if (!deletingSite) return;
    startTransition(async () => {
      try {
        await deleteEndCustomerSite(deletingSite.id);
        toast.success(`Deleted site "${deletingSite.name}".`);
        setDeletingSite(null);
        await loadData();
      } catch (err: any) {
        toast.error(err.message || "Failed to delete site.");
      }
    });
  };

  // Open Edit Modal
  const openEditModal = (site: EndCustomerSiteItem) => {
    setEditingSite(site);
    setFormData({
      name: site.name,
      group: site.group,
      state: site.state,
      mainconId: String(site.mainconId),
    });
    setIsAddModalOpen(true);
  };

  // Open Add Modal
  const openAddModal = () => {
    setEditingSite(null);
    setFormData({
      name: "",
      group: availableGroups[0] || "JPJ",
      state: "Selangor",
      mainconId: maincons[0]?.id ? String(maincons[0].id) : "",
    });
    setIsAddModalOpen(true);
  };

  // CSV Parse Handler
  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    setIsParsingCsv(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) {
          setParsedCsvRows([]);
          setIsParsingCsv(false);
          return;
        }

        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) {
          toast.error("CSV file is empty or missing headers.");
          setParsedCsvRows([]);
          setIsParsingCsv(false);
          return;
        }

        // Header detection
        const rawHeaders = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/["']/g, ""));
        
        let nameIdx = rawHeaders.findIndex((h) => h.includes("name") || h.includes("site") || h.includes("branch"));
        let groupIdx = rawHeaders.findIndex((h) => h.includes("group") || h.includes("agency") || h.includes("customer"));
        let stateIdx = rawHeaders.findIndex((h) => h.includes("state") || h.includes("negeri") || h.includes("region"));

        // Fallback default index positions if headers are non-standard
        if (nameIdx === -1) nameIdx = 0;
        if (groupIdx === -1) groupIdx = 1;
        if (stateIdx === -1) stateIdx = 2;

        const parsed: Array<{ name: string; group: string; state: string; error?: string }> = [];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          // Simple CSV line splitter handling standard quoted fields
          const regex = /(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*|(?:\n|$))/g;
          const cols: string[] = [];
          let match;
          while ((match = regex.exec(line)) !== null) {
            let val = match[1] ?? "";
            if (val.startsWith('"') && val.endsWith('"')) {
              val = val.slice(1, -1).replace(/""/g, '"');
            }
            cols.push(val.trim());
            if (regex.lastIndex >= line.length) break;
          }

          const siteName = cols[nameIdx] || "";
          const siteGroup = cols[groupIdx] || "";
          let siteState = cols[stateIdx] || "";

          // Auto-normalize state name capitalization
          const matchedState = MALAYSIAN_STATES.find(
            (s) => s.toLowerCase() === siteState.toLowerCase()
          );
          if (matchedState) siteState = matchedState;

          let errorMsg = "";
          if (!siteName) errorMsg = "Missing Site Name";
          else if (!siteGroup) errorMsg = "Missing Agency Group";
          else if (!siteState) errorMsg = "Missing State";

          parsed.push({
            name: siteName,
            group: siteGroup,
            state: siteState,
            error: errorMsg || undefined,
          });
        }

        setParsedCsvRows(parsed);
      } catch (err) {
        console.error("CSV parse error:", err);
        toast.error("Failed to parse CSV file.");
      } finally {
        setIsParsingCsv(false);
      }
    };
    reader.readAsText(file);
  };

  // Download Sample CSV Template
  const handleDownloadTemplate = () => {
    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [
        "Site Name,Agency Group,State",
        "JPJ Cawangan Putrajaya (Galeria),JPJ,Putrajaya",
        "JPJ Padang Jawa Shah Alam,JPJ,Selangor",
        "JPJ Wangsa Maju,JPJ,Kuala Lumpur",
        "RELA Pusat Latihan Tuaran,RELA,Sabah",
        "KWSP Cawangan Petaling Jaya,KWSP,Selangor",
      ].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "customer_sites_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV import template downloaded.");
  };

  // Export Filtered Sites to CSV
  const handleExportCsv = () => {
    if (filteredSites.length === 0) {
      toast.error("No customer sites to export.");
      return;
    }

    const headers = ["ID", "Site Name", "Agency Group", "State", "Main Contractor", "Linked Tickets"];
    const rows = filteredSites.map((s) => [
      s.id,
      `"${s.name.replace(/"/g, '""')}"`,
      `"${s.group.replace(/"/g, '""')}"`,
      `"${s.state.replace(/"/g, '""')}"`,
      `"${(s.maincon?.name || "").replace(/"/g, '""')}"`,
      s._count?.tickets || 0,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `customer_sites_export_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${filteredSites.length} customer sites to CSV.`);
  };

  // Execute Bulk Import
  const handleExecuteImport = async () => {
    if (!importMainconId) {
      toast.error("Please select a target Main Contractor.");
      return;
    }
    const validRows = parsedCsvRows.filter((r) => !r.error);
    if (validRows.length === 0) {
      toast.error("No valid site records to import.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await bulkImportEndCustomerSites(Number(importMainconId), validRows);
        toast.success(
          `Import complete! Inserted: ${result.insertedCount}, Updated: ${result.updatedCount}` +
            (result.skippedCount > 0 ? `, Skipped: ${result.skippedCount}` : "")
        );
        setIsImportModalOpen(false);
        setCsvFile(null);
        setParsedCsvRows([]);
        await loadData();
      } catch (err: any) {
        toast.error(err.message || "Failed to import sites from CSV.");
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Header & Summary Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-card-border rounded-2xl p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Customer Sites & Branches Directory</h2>
              <p className="text-xs text-muted-text mt-0.5">
                Manage pre-seeded physical site locations and agency offices for automatic ticket resolution.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2 rounded-xl border border-card-border bg-card hover:bg-slate-100 dark:hover:bg-slate-800/80 text-muted-text hover:text-foreground transition-all cursor-pointer"
            title="Refresh Site Directory"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-indigo-500" : ""}`} />
          </button>

          <button
            onClick={handleExportCsv}
            className="px-3 py-2 bg-card border border-card-border hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold rounded-xl text-foreground inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-indigo-500" />
            Export CSV
          </button>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-all shadow-sm shadow-emerald-600/20 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            Import CSV
          </button>

          <button
            onClick={openAddModal}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-all shadow-sm shadow-indigo-600/20 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Branch Site
          </button>
        </div>
      </div>

      {/* 2. KPI Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-card border border-card-border rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-text">Total Seeded Branches</span>
            <Building2 className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-bold text-foreground mt-1">{sites.length}</p>
          <span className="text-[10px] text-muted-text">Across all client contracts</span>
        </div>

        <div className="bg-card border border-card-border rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-text">Agency Groups</span>
            <Tag className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-foreground mt-1">{availableGroups.length}</p>
          <span className="text-[10px] text-muted-text">
            {availableGroups.slice(0, 3).join(", ")}
            {availableGroups.length > 3 ? ` +${availableGroups.length - 3} more` : ""}
          </span>
        </div>

        <div className="bg-card border border-card-border rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-text">States Covered</span>
            <MapPin className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-foreground mt-1">
            {new Set(sites.map((s) => s.state)).size}
          </p>
          <span className="text-[10px] text-muted-text">Nationwide coverage</span>
        </div>

        <div className="bg-card border border-card-border rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-text">Linked Tickets</span>
            <Ticket className="w-4 h-4 text-sky-500" />
          </div>
          <p className="text-2xl font-bold text-foreground mt-1">
            {sites.reduce((sum, s) => sum + (s._count?.tickets || 0), 0)}
          </p>
          <span className="text-[10px] text-muted-text">Total ticket occurrences</span>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="bg-card border border-card-border rounded-xl p-3.5 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Full-text search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-muted-text absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by branch name, state, agency..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-3.5 py-1.5 text-xs bg-input-bg border border-card-border rounded-lg text-foreground placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-text hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Main Contractor Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-text font-medium hidden sm:inline">Client:</span>
            <select
              value={selectedMainconId}
              onChange={(e) => {
                setSelectedMainconId(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 text-xs bg-input-bg border border-card-border rounded-lg text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="ALL">All Clients ({maincons.length})</option>
              {maincons.map((m) => (
                <option key={m.id} value={String(m.id)}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Agency Group Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-text font-medium hidden sm:inline">Agency:</span>
            <select
              value={selectedGroup}
              onChange={(e) => {
                setSelectedGroup(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 text-xs bg-input-bg border border-card-border rounded-lg text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="ALL">All Agencies ({availableGroups.length})</option>
              {availableGroups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          {/* State Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-text font-medium hidden sm:inline">State:</span>
            <select
              value={selectedState}
              onChange={(e) => {
                setSelectedState(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 text-xs bg-input-bg border border-card-border rounded-lg text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="ALL">All States</option>
              {MALAYSIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Filters Button */}
          {(selectedMainconId !== "ALL" || selectedGroup !== "ALL" || selectedState !== "ALL" || searchQuery) && (
            <button
              onClick={() => {
                setSelectedMainconId("ALL");
                setSelectedGroup("ALL");
                setSelectedState("ALL");
                setSearchQuery("");
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all font-medium cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* 4. Customer Sites Table */}
      <div className="bg-card border border-card-border rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-card-border bg-slate-50/70 dark:bg-slate-900/50 text-muted-text font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">Branch / Site Name</th>
                <th className="py-3 px-4">Agency Group</th>
                <th className="py-3 px-4">State</th>
                <th className="py-3 px-4">Main Contractor</th>
                <th className="py-3 px-4 text-center">Tickets</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-text">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    Loading customer sites...
                  </td>
                </tr>
              ) : paginatedSites.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-text">
                    <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40 text-indigo-400" />
                    <p className="font-semibold text-foreground">No customer sites found</p>
                    <p className="text-[11px] mt-1 text-muted-text">
                      {searchQuery || selectedMainconId !== "ALL" || selectedGroup !== "ALL" || selectedState !== "ALL"
                        ? "Try clearing your search or filters to see more results."
                        : "Click 'Add Branch Site' or 'Import CSV' to seed customer branch locations."}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedSites.map((site, index) => {
                  const rowNumber = (currentPage - 1) * pageSize + index + 1;
                  return (
                    <tr
                      key={site.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors group"
                    >
                      <td className="py-3 px-4 text-center font-mono text-muted-text text-[11px]">
                        {rowNumber}
                      </td>
                      <td className="py-3 px-4 font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span className="truncate max-w-md">{site.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/50">
                          <Tag className="w-2.5 h-2.5" />
                          {site.group}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-card-border">
                          {site.state}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-foreground/80">
                        {site.maincon?.name || `Maincon #${site.mainconId}`}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            (site._count?.tickets || 0) > 0
                              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-500/20"
                              : "text-muted-text bg-slate-100 dark:bg-slate-800"
                          }`}
                        >
                          {site._count?.tickets || 0}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(site)}
                            className="p-1.5 rounded-lg text-muted-text hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-all cursor-pointer"
                            title="Edit Site Details"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingSite(site)}
                            className="p-1.5 rounded-lg text-muted-text hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
                            title="Delete Site"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination */}
        {filteredSites.length > 0 && (
          <div className="border-t border-card-border bg-slate-50/50 dark:bg-slate-950/30 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-muted-text text-[11px]">
              Showing{" "}
              <span className="font-semibold text-foreground">
                {(currentPage - 1) * pageSize + 1}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-foreground">
                {Math.min(currentPage * pageSize, filteredSites.length)}
              </span>{" "}
              of <span className="font-semibold text-foreground">{filteredSites.length}</span> branch sites
            </div>

            <div className="flex items-center gap-3">
              {/* Page Size Selector */}
              <div className="flex items-center gap-1.5 text-[11px] text-muted-text">
                <span>Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 bg-input-bg border border-card-border rounded-lg text-foreground font-medium cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              {/* Navigation Buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-card-border bg-card hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none text-muted-text hover:text-foreground cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 text-xs font-semibold text-foreground">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-card-border bg-card hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none text-muted-text hover:text-foreground cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. MODAL: Add / Edit Single Branch Site */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-card-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-card-border pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Building2 className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-foreground text-sm">
                  {editingSite ? "Edit Customer Branch Site" : "Add New Branch Site"}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingSite(null);
                }}
                className="text-muted-text hover:text-foreground p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSite} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Main Contractor / Client Project *
                </label>
                <select
                  required
                  value={formData.mainconId}
                  onChange={(e) => setFormData({ ...formData, mainconId: e.target.value })}
                  className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="">-- Choose Main Contractor --</option>
                  {maincons.map((m) => (
                    <option key={m.id} value={String(m.id)}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Branch / Physical Site Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. JPJ Cawangan Putrajaya (Galeria)"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Agency / Customer Group *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. JPJ, RELA, KWSP"
                    value={formData.group}
                    onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                    className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 uppercase"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Malaysian State *
                  </label>
                  <select
                    required
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    {MALAYSIAN_STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-card-border">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingSite(null);
                  }}
                  className="px-3.5 py-2 rounded-xl text-muted-text hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? "Saving..." : editingSite ? "Update Site" : "Save Site"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL: Bulk CSV Import with Upsert */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-card-border rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-card-border pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm">Bulk Import Sites via CSV</h3>
                  <p className="text-[11px] text-muted-text">
                    Upload a spreadsheet to bulk-add branches or update existing branch spelling.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setCsvFile(null);
                  setParsedCsvRows([]);
                }}
                className="text-muted-text hover:text-foreground p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto pr-1 text-xs">
              {/* Target Main Contractor Selection */}
              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Target Main Contractor / Client Project *
                </label>
                <select
                  value={importMainconId}
                  onChange={(e) => setImportMainconId(e.target.value)}
                  className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="">-- Choose Main Contractor --</option>
                  {maincons.map((m) => (
                    <option key={m.id} value={String(m.id)}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Template Download Prompt */}
              <div className="bg-slate-50 dark:bg-slate-900/50 border border-card-border rounded-xl p-3.5 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-foreground">Need the standard CSV format?</p>
                  <p className="text-[11px] text-muted-text">
                    Contains sample columns: <code>Site Name, Agency Group, State</code>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-3 py-1.5 bg-card border border-card-border hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold rounded-lg text-foreground inline-flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-500" />
                  Download Template
                </button>
              </div>

              {/* File Upload Dropzone */}
              <div>
                <label className="block font-semibold text-foreground mb-1">Select CSV File *</label>
                <div className="border-2 border-dashed border-card-border hover:border-indigo-500/50 rounded-xl p-5 text-center transition bg-slate-50/40 dark:bg-slate-950/20">
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleCsvFileChange}
                    className="hidden"
                    id="csv-file-input"
                  />
                  <label
                    htmlFor="csv-file-input"
                    className="cursor-pointer flex flex-col items-center justify-center gap-2"
                  >
                    <Upload className="w-7 h-7 text-indigo-500" />
                    <div>
                      <span className="font-semibold text-foreground">
                        {csvFile ? csvFile.name : "Click to browse CSV file"}
                      </span>
                      <p className="text-[10px] text-muted-text mt-0.5">
                        {csvFile ? `${(csvFile.size / 1024).toFixed(1)} KB` : "Supports UTF-8 formatted .csv"}
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Parsed Preview Table */}
              {isParsingCsv ? (
                <div className="py-4 text-center text-muted-text">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1 text-indigo-500" />
                  Parsing spreadsheet...
                </div>
              ) : parsedCsvRows.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">
                      Parsed Preview ({parsedCsvRows.length} rows detected)
                    </span>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                      {parsedCsvRows.filter((r) => !r.error).length} valid records
                    </span>
                  </div>

                  <div className="max-h-48 overflow-y-auto border border-card-border rounded-xl divide-y divide-card-border text-[11px]">
                    {parsedCsvRows.slice(0, 10).map((row, idx) => (
                      <div
                        key={idx}
                        className={`p-2.5 flex items-center justify-between gap-3 ${
                          row.error ? "bg-rose-50/50 dark:bg-rose-950/20" : ""
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-foreground truncate">{row.name || "—"}</p>
                          <p className="text-[10px] text-muted-text">
                            Group: <span className="font-medium text-foreground">{row.group}</span> | State:{" "}
                            <span className="font-medium text-foreground">{row.state}</span>
                          </p>
                        </div>
                        {row.error ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400">
                            {row.error}
                          </span>
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        )}
                      </div>
                    ))}
                    {parsedCsvRows.length > 10 && (
                      <div className="p-2 text-center text-muted-text text-[10px] bg-slate-50 dark:bg-slate-900/50">
                        + {parsedCsvRows.length - 10} more rows ready for import
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-card-border shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsImportModalOpen(false);
                  setCsvFile(null);
                  setParsedCsvRows([]);
                }}
                className="px-3.5 py-2 rounded-xl text-muted-text hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending || parsedCsvRows.filter((r) => !r.error).length === 0 || !importMainconId}
                onClick={handleExecuteImport}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl shadow-sm transition disabled:opacity-50 cursor-pointer inline-flex items-center gap-1.5"
              >
                {isPending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    Confirm & Import ({parsedCsvRows.filter((r) => !r.error).length}) Sites
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL: Delete Confirmation */}
      {deletingSite && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-card-border rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-sm">Delete Branch Site</h3>
                <p className="text-xs text-muted-text">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-foreground/80">
              Are you sure you want to remove <strong className="text-foreground">{deletingSite.name}</strong> (
              {deletingSite.group}) from the pre-seeded branch catalog?
            </p>

            {(deletingSite._count?.tickets || 0) > 0 && (
              <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl p-3 text-[11px] text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <Shield className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  This site is linked to <strong>{deletingSite._count?.tickets}</strong> active/historical ticket(s).
                  Deletion is blocked to maintain referential data integrity.
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-card-border">
              <button
                type="button"
                onClick={() => setDeletingSite(null)}
                className="px-3.5 py-1.5 rounded-xl text-muted-text hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending || (deletingSite._count?.tickets || 0) > 0}
                onClick={handleDeleteSite}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl shadow-sm transition disabled:opacity-50 cursor-pointer text-xs"
              >
                {isPending ? "Deleting..." : "Delete Site"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
