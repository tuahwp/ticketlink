"use client";

import React, { useState, useEffect, useMemo, useTransition } from "react";
import {
  Laptop,
  Monitor,
  Printer,
  Router,
  Server,
  HardDrive,
  Cpu,
  Plus,
  Upload,
  Download,
  Search,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  Shield,
  Tag,
  Ticket,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import {
  getDevices,
  createDeviceCatalogItem,
  updateDeviceCatalogItem,
  deleteDeviceCatalogItem,
  bulkImportDeviceCatalogItems,
  getMaincons,
} from "@/app/actions";

interface DeviceCatalogItem {
  id: number;
  category: string;
  brand: string;
  model: string;
  isStandard: boolean;
  restrictedTo?: string | null;
  _count?: {
    tickets: number;
  };
}

interface MainconOption {
  id: number;
  name: string;
  siteCustomers?: unknown;
}

const COMMON_CATEGORIES = [
  "Desktop",
  "Laptop",
  "Printer",
  "Router",
  "Switch",
  "Firewall",
  "POS Terminal",
  "Server",
  "Scanner",
  "UPS",
  "Access Point",
];

export default function DeviceCatalogTab() {
  const [devices, setDevices] = useState<DeviceCatalogItem[]>([]);
  const [maincons, setMaincons] = useState<MainconOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedType, setSelectedType] = useState<string>("ALL"); // 'ALL' | 'STANDARD' | 'ON_REQUEST'
  const [selectedAgency, setSelectedAgency] = useState<string>("ALL");

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<DeviceCatalogItem | null>(null);
  const [deletingDevice, setDeletingDevice] = useState<DeviceCatalogItem | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Form States (Single Add/Edit)
  const [formData, setFormData] = useState({
    category: "Desktop",
    brand: "",
    model: "",
    isStandard: true,
    restrictedTo: "",
  });

  // CSV Import States
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedCsvRows, setParsedCsvRows] = useState<
    Array<{
      category: string;
      brand: string;
      model: string;
      isStandard: boolean;
      restrictedTo?: string | null;
      error?: string;
    }>
  >([]);
  const [isParsingCsv, setIsParsingCsv] = useState(false);

  // Fetch Data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [fetchedDevices, fetchedMaincons] = await Promise.all([
        getDevices(),
        getMaincons(),
      ]);
      setDevices(fetchedDevices || []);
      setMaincons(fetchedMaincons || []);
    } catch (error) {
      console.error("Failed to load device catalog:", error);
      toast.error("Failed to load device catalog data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Available unique categories dynamically collected
  const availableCategories = useMemo(() => {
    const cats = new Set<string>(COMMON_CATEGORIES);
    devices.forEach((d) => {
      if (d.category?.trim()) cats.add(d.category.trim());
    });
    return Array.from(cats).sort();
  }, [devices]);

  // Available agencies / groups dynamically collected
  const availableAgencies = useMemo(() => {
    const agencies = new Set<string>();
    devices.forEach((d) => {
      if (d.restrictedTo?.trim()) agencies.add(d.restrictedTo.trim());
    });
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
        if (c?.trim()) agencies.add(c.trim());
      });
    });
    return Array.from(agencies).sort();
  }, [devices, maincons]);

  // Filtered Devices List
  const filteredDevices = useMemo(() => {
    return devices.filter((device) => {
      // Category filter
      if (selectedCategory !== "ALL" && device.category !== selectedCategory) {
        return false;
      }
      // Type filter
      if (selectedType === "STANDARD" && !device.isStandard) return false;
      if (selectedType === "ON_REQUEST" && device.isStandard) return false;
      // Agency restriction filter
      if (selectedAgency !== "ALL") {
        if (selectedAgency === "GENERAL") {
          if (device.restrictedTo) return false;
        } else if (device.restrictedTo !== selectedAgency) {
          return false;
        }
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchCat = device.category.toLowerCase().includes(q);
        const matchBrand = device.brand.toLowerCase().includes(q);
        const matchModel = device.model.toLowerCase().includes(q);
        const matchAgency = (device.restrictedTo || "").toLowerCase().includes(q);
        if (!matchCat && !matchBrand && !matchModel && !matchAgency) {
          return false;
        }
      }
      return true;
    });
  }, [devices, selectedCategory, selectedType, selectedAgency, searchQuery]);

  // Pagination Slice
  const totalPages = Math.ceil(filteredDevices.length / pageSize) || 1;
  const paginatedDevices = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDevices.slice(start, start + pageSize);
  }, [filteredDevices, currentPage, pageSize]);

  // Handle Add/Edit Submit
  const handleSaveDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.category.trim() || !formData.brand.trim() || !formData.model.trim()) {
      toast.error("Please fill in Category, Brand, and Model.");
      return;
    }

    startTransition(async () => {
      try {
        if (editingDevice) {
          await updateDeviceCatalogItem(editingDevice.id, {
            category: formData.category.trim(),
            brand: formData.brand.trim(),
            model: formData.model.trim(),
            isStandard: formData.isStandard,
            restrictedTo: formData.restrictedTo.trim() || null,
          });
          toast.success("Device model updated successfully.");
        } else {
          await createDeviceCatalogItem({
            category: formData.category.trim(),
            brand: formData.brand.trim(),
            model: formData.model.trim(),
            isStandard: formData.isStandard,
            restrictedTo: formData.restrictedTo.trim() || null,
          });
          toast.success("New device model added to catalog.");
        }
        setIsAddModalOpen(false);
        setEditingDevice(null);
        await loadData();
      } catch (err: any) {
        toast.error(err.message || "Failed to save device model.");
      }
    });
  };

  // Handle Delete Device
  const handleDeleteDevice = async () => {
    if (!deletingDevice) return;
    startTransition(async () => {
      try {
        await deleteDeviceCatalogItem(deletingDevice.id);
        toast.success(`Deleted "${deletingDevice.brand} ${deletingDevice.model}".`);
        setDeletingDevice(null);
        await loadData();
      } catch (err: any) {
        toast.error(err.message || "Failed to delete device.");
      }
    });
  };

  // Open Edit Modal
  const openEditModal = (device: DeviceCatalogItem) => {
    setEditingDevice(device);
    setFormData({
      category: device.category,
      brand: device.brand,
      model: device.model,
      isStandard: device.isStandard,
      restrictedTo: device.restrictedTo || "",
    });
    setIsAddModalOpen(true);
  };

  // Open Add Modal
  const openAddModal = () => {
    setEditingDevice(null);
    setFormData({
      category: "Desktop",
      brand: "",
      model: "",
      isStandard: true,
      restrictedTo: "",
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

        let catIdx = rawHeaders.findIndex((h) => h.includes("category") || h.includes("kategori") || h.includes("type"));
        let brandIdx = rawHeaders.findIndex((h) => h.includes("brand") || h.includes("make") || h.includes("oem") || h.includes("jenama"));
        let modelIdx = rawHeaders.findIndex((h) => h.includes("model") || h.includes("part") || h.includes("item"));
        let typeIdx = rawHeaders.findIndex((h) => h.includes("standard") || h.includes("contract") || h.includes("sla"));
        let agencyIdx = rawHeaders.findIndex((h) => h.includes("restricted") || h.includes("agency") || h.includes("group") || h.includes("customer"));

        if (catIdx === -1) catIdx = 0;
        if (brandIdx === -1) brandIdx = 1;
        if (modelIdx === -1) modelIdx = 2;
        if (typeIdx === -1) typeIdx = 3;
        if (agencyIdx === -1) agencyIdx = 4;

        const parsed: Array<{
          category: string;
          brand: string;
          model: string;
          isStandard: boolean;
          restrictedTo?: string | null;
          error?: string;
        }> = [];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

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

          const category = cols[catIdx] || "";
          const brand = cols[brandIdx] || "";
          const model = cols[modelIdx] || "";
          const rawType = (cols[typeIdx] || "standard").toLowerCase();
          const isStandard = !rawType.includes("request") && !rawType.includes("non") && !rawType.includes("false");
          let rawAgency = cols[agencyIdx] || "";
          if (rawAgency.toLowerCase() === "all" || rawAgency.toLowerCase() === "general" || rawAgency === "-") {
            rawAgency = "";
          }

          let errorMsg = "";
          if (!category) errorMsg = "Missing Category";
          else if (!brand) errorMsg = "Missing Brand";
          else if (!model) errorMsg = "Missing Model";

          parsed.push({
            category,
            brand,
            model,
            isStandard,
            restrictedTo: rawAgency || null,
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
        "Category,Brand,Model,Type (Standard/On-Request),Restricted To (Agency/All)",
        "Desktop,Dell,OptiPlex 7090,Standard,All",
        "Laptop,HP,EliteBook 840 G8,Standard,All",
        "Printer,Zebra,ZD220 Barcode Printer,Standard,JPJ",
        "Router,Cisco,Catalyst 2960-X,Standard,All",
        "Firewall,Fortinet,FortiGate 60F,Standard,All",
        "POS Terminal,Wincor,Beetle MIII,On-Request,RELA",
        "Scanner,Epson,WorkForce DS-530,Standard,KWSP",
      ].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "device_catalog_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Device Catalog template downloaded.");
  };

  // Export Filtered Devices to CSV
  const handleExportCsv = () => {
    if (filteredDevices.length === 0) {
      toast.error("No device models to export.");
      return;
    }

    const headers = ["ID", "Category", "Brand", "Model", "Contract Type", "Restricted Agency", "Linked Tickets"];
    const rows = filteredDevices.map((d) => [
      d.id,
      `"${d.category.replace(/"/g, '""')}"`,
      `"${d.brand.replace(/"/g, '""')}"`,
      `"${d.model.replace(/"/g, '""')}"`,
      d.isStandard ? "Standard" : "On-Request",
      `"${(d.restrictedTo || "All Agencies").replace(/"/g, '""')}"`,
      d._count?.tickets || 0,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `device_catalog_export_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${filteredDevices.length} device models to CSV.`);
  };

  // Execute Bulk Import
  const handleExecuteImport = async () => {
    const validRows = parsedCsvRows.filter((r) => !r.error);
    if (validRows.length === 0) {
      toast.error("No valid device records to import.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await bulkImportDeviceCatalogItems(validRows);
        toast.success(
          `Import complete! Inserted: ${result.insertedCount}, Updated: ${result.updatedCount}` +
            (result.skippedCount > 0 ? `, Skipped: ${result.skippedCount}` : "")
        );
        setIsImportModalOpen(false);
        setCsvFile(null);
        setParsedCsvRows([]);
        await loadData();
      } catch (err: any) {
        toast.error(err.message || "Failed to import devices from CSV.");
      }
    });
  };

  // Icon helper for categories
  const getCategoryIcon = (category: string) => {
    const cat = category.toLowerCase();
    if (cat.includes("laptop")) return <Laptop className="w-3.5 h-3.5 text-indigo-500" />;
    if (cat.includes("printer") || cat.includes("scanner")) return <Printer className="w-3.5 h-3.5 text-amber-500" />;
    if (cat.includes("firewall") || cat.includes("security") || cat.includes("fortigate") || cat.includes("palo")) return <Shield className="w-3.5 h-3.5 text-rose-500" />;
    if (cat.includes("router") || cat.includes("switch") || cat.includes("network")) return <Router className="w-3.5 h-3.5 text-emerald-500" />;
    if (cat.includes("server")) return <Server className="w-3.5 h-3.5 text-purple-500" />;
    if (cat.includes("pos") || cat.includes("terminal")) return <HardDrive className="w-3.5 h-3.5 text-sky-500" />;
    return <Monitor className="w-3.5 h-3.5 text-indigo-500" />;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Header & Summary Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-card-border rounded-2xl p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Device Catalog & Hardware Models</h2>
              <p className="text-xs text-muted-text mt-0.5">
                Maintain standard supported equipment makes, models, SLA tiers, and agency contract restrictions.
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
            title="Refresh Device Catalog"
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
            Add Device Model
          </button>
        </div>
      </div>

      {/* 2. KPI Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-card border border-card-border rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-text">Total Models</span>
            <Cpu className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-bold text-foreground mt-1">{devices.length}</p>
          <span className="text-[10px] text-muted-text">Registered in catalog</span>
        </div>

        <div className="bg-card border border-card-border rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-text">Categories</span>
            <Tag className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-foreground mt-1">{availableCategories.length}</p>
          <span className="text-[10px] text-muted-text">Desktops, Printers, Routers...</span>
        </div>

        <div className="bg-card border border-card-border rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-text">Standard SLA Tier</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {devices.filter((d) => d.isStandard).length}
          </p>
          <span className="text-[10px] text-muted-text">Fast contract resolution</span>
        </div>

        <div className="bg-card border border-card-border rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-text">Agency Restricted</span>
            <Shield className="w-4 h-4 text-sky-500" />
          </div>
          <p className="text-2xl font-bold text-sky-600 dark:text-sky-400 mt-1">
            {devices.filter((d) => !!d.restrictedTo).length}
          </p>
          <span className="text-[10px] text-muted-text">Scoped to specific clients</span>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="bg-card border border-card-border rounded-xl p-3.5 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-muted-text absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by model, brand, category, agency..."
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
          {/* Category Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-text font-medium hidden sm:inline">Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 text-xs bg-input-bg border border-card-border rounded-lg text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="ALL">All Categories ({availableCategories.length})</option>
              {availableCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Contract Type Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-text font-medium hidden sm:inline">Type:</span>
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 text-xs bg-input-bg border border-card-border rounded-lg text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="ALL">All Types</option>
              <option value="STANDARD">Standard SLA Only</option>
              <option value="ON_REQUEST">On-Request Only</option>
            </select>
          </div>

          {/* Agency Restriction Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-text font-medium hidden sm:inline">Agency:</span>
            <select
              value={selectedAgency}
              onChange={(e) => {
                setSelectedAgency(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 text-xs bg-input-bg border border-card-border rounded-lg text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="ALL">All Agencies</option>
              <option value="GENERAL">General Pool (Unrestricted)</option>
              {availableAgencies.map((a) => (
                <option key={a} value={a}>
                  Restricted to {a}
                </option>
              ))}
            </select>
          </div>

          {/* Reset Filters */}
          {(selectedCategory !== "ALL" || selectedType !== "ALL" || selectedAgency !== "ALL" || searchQuery) && (
            <button
              onClick={() => {
                setSelectedCategory("ALL");
                setSelectedType("ALL");
                setSelectedAgency("ALL");
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

      {/* 4. Devices Table */}
      <div className="bg-card border border-card-border rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-card-border bg-slate-50/70 dark:bg-slate-900/50 text-muted-text font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Brand</th>
                <th className="py-3 px-4">Hardware Model</th>
                <th className="py-3 px-4">Contract SLA Type</th>
                <th className="py-3 px-4">Restricted Agency</th>
                <th className="py-3 px-4 text-center">Tickets</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-text">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    Loading device catalog...
                  </td>
                </tr>
              ) : paginatedDevices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-text">
                    <Cpu className="w-8 h-8 mx-auto mb-2 opacity-40 text-indigo-400" />
                    <p className="font-semibold text-foreground">No device models found</p>
                    <p className="text-[11px] mt-1 text-muted-text">
                      {searchQuery || selectedCategory !== "ALL" || selectedType !== "ALL" || selectedAgency !== "ALL"
                        ? "Try adjusting your search or filters to see more results."
                        : "Click 'Add Device Model' or 'Import CSV' to populate your equipment catalog."}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedDevices.map((device, index) => {
                  const rowNumber = (currentPage - 1) * pageSize + index + 1;
                  return (
                    <tr
                      key={device.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors group"
                    >
                      <td className="py-3 px-4 text-center font-mono text-muted-text text-[11px]">
                        {rowNumber}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/50">
                          {getCategoryIcon(device.category)}
                          {device.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-foreground">
                        {device.brand}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-foreground/90">
                        {device.model}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border ${
                            device.isStandard
                              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-500/25"
                              : "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 border-amber-500/25"
                          }`}
                        >
                          {device.isStandard ? "Standard SLA" : "On Request"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {device.restrictedTo ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-500/20 uppercase">
                            <Shield className="w-2.5 h-2.5" />
                            {device.restrictedTo}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-text italic">All Agencies</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            (device._count?.tickets || 0) > 0
                              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-500/20"
                              : "text-muted-text bg-slate-100 dark:bg-slate-800"
                          }`}
                        >
                          {device._count?.tickets || 0}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(device)}
                            className="p-1.5 rounded-lg text-muted-text hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-all cursor-pointer"
                            title="Edit Device Details"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingDevice(device)}
                            className="p-1.5 rounded-lg text-muted-text hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
                            title="Delete Device"
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
        {filteredDevices.length > 0 && (
          <div className="border-t border-card-border bg-slate-50/50 dark:bg-slate-950/30 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-muted-text text-[11px]">
              Showing{" "}
              <span className="font-semibold text-foreground">
                {(currentPage - 1) * pageSize + 1}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-foreground">
                {Math.min(currentPage * pageSize, filteredDevices.length)}
              </span>{" "}
              of <span className="font-semibold text-foreground">{filteredDevices.length}</span> device models
            </div>

            <div className="flex items-center gap-3">
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

      {/* 5. MODAL: Add / Edit Single Device Model */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-card-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-card-border pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Cpu className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-foreground text-sm">
                  {editingDevice ? "Edit Device Catalog Item" : "Add Device to Catalog"}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingDevice(null);
                }}
                className="text-muted-text hover:text-foreground p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDevice} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Device Category *
                </label>
                <div className="flex gap-2">
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    {availableCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value="Other">Other (Custom Category)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Brand / Manufacturer *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dell, HP, Cisco"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Hardware Model Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. OptiPlex 7090"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Contract SLA Tier
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isStandard: true })}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      formData.isStandard
                        ? "bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold"
                        : "border-card-border text-muted-text hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Standard SLA Model
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isStandard: false })}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      !formData.isStandard
                        ? "bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400 font-bold"
                        : "border-card-border text-muted-text hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    On-Request / Custom
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Client Agency Restriction (Optional)
                </label>
                <select
                  value={formData.restrictedTo}
                  onChange={(e) => setFormData({ ...formData, restrictedTo: e.target.value })}
                  className="w-full px-3 py-2 bg-input-bg border border-card-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="">🌐 General Pool (Available to all Agencies)</option>
                  {availableAgencies.map((a) => (
                    <option key={a} value={a}>
                      🔒 Restricted exclusively to {a}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-text mt-1">
                  Restricting this device to an agency scopes ticket auto-completion to only that client contract.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-card-border">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingDevice(null);
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
                  {isPending ? "Saving..." : editingDevice ? "Update Device" : "Save Device"}
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
                  <h3 className="font-bold text-foreground text-sm">Bulk Import Device Models via CSV</h3>
                  <p className="text-[11px] text-muted-text">
                    Upload a spreadsheet to batch register hardware models or update existing standard/agency rules.
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
              {/* Template Download Prompt */}
              <div className="bg-slate-50 dark:bg-slate-900/50 border border-card-border rounded-xl p-3.5 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-foreground">Need the standard CSV format?</p>
                  <p className="text-[11px] text-muted-text">
                    Includes columns: <code>Category, Brand, Model, Type, Restricted To</code>.
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
                    id="device-csv-file-input"
                  />
                  <label
                    htmlFor="device-csv-file-input"
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
                          <p className="font-semibold text-foreground truncate">
                            {row.brand} {row.model} ({row.category})
                          </p>
                          <p className="text-[10px] text-muted-text">
                            Type: <span className="font-medium text-foreground">{row.isStandard ? "Standard" : "On-Request"}</span> |
                            Agency: <span className="font-medium text-foreground">{row.restrictedTo || "All Agencies"}</span>
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
                        + {parsedCsvRows.length - 10} more models ready for import
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
                disabled={isPending || parsedCsvRows.filter((r) => !r.error).length === 0}
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
                    Confirm & Import ({parsedCsvRows.filter((r) => !r.error).length}) Models
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL: Delete Confirmation */}
      {deletingDevice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-card-border rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-sm">Delete Device Model</h3>
                <p className="text-xs text-muted-text">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-foreground/80">
              Are you sure you want to delete <strong className="text-foreground">{deletingDevice.brand} {deletingDevice.model}</strong> ({deletingDevice.category}) from the catalog?
            </p>

            {(deletingDevice._count?.tickets || 0) > 0 && (
              <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl p-3 text-[11px] text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <Shield className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  This model is linked to <strong>{deletingDevice._count?.tickets}</strong> ticket(s). Deletion is blocked to preserve historical ticket records.
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-card-border">
              <button
                type="button"
                onClick={() => setDeletingDevice(null)}
                className="px-3.5 py-1.5 rounded-xl text-muted-text hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending || (deletingDevice._count?.tickets || 0) > 0}
                onClick={handleDeleteDevice}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl shadow-sm transition disabled:opacity-50 cursor-pointer text-xs"
              >
                {isPending ? "Deleting..." : "Delete Device"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
