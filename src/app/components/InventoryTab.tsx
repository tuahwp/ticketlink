"use client";

import React, { useState, useMemo, useTransition, useEffect } from "react";
import {
  Package,
  Plus,
  Search,
  Filter,
  Truck,
  Building2,
  AlertCircle,
  CheckCircle2,
  Clock,
  RotateCcw,
  ArrowRight,
  ExternalLink,
  Edit2,
  Trash2,
  History,
  FileSpreadsheet,
  Layers,
  Wrench,
  ChevronRight,
  RefreshCw,
  Send,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  getInventoryItems,
  getWarehouses,
  getPendingPartsRequests,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  allocateAndDispatchSparePart,
  cancelSparePartRequest,
  allocateAndDispatchLoanerUnit,
  extendLoanDuration,
  initiateLoanerReturn,
  receiveAndRestockLoaner,
  getActiveLoaners,
} from "../actions";

export interface Warehouse {
  id: number;
  name: string;
  state: string;
  address?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
  partnerId?: number | null;
  partner?: {
    id: number;
    name: string;
  } | null;
  _count?: {
    items: number;
  };
}

export interface InventoryLog {
  id: number;
  action: string;
  notes?: string | null;
  author: string;
  createdAt: string | Date;
}

export interface InventoryItem {
  id: number;
  name: string;
  partNumber?: string | null;
  category: string;
  serialNumber: string;
  warehouseId: number;
  warehouse: Warehouse;
  status:
    | "AVAILABLE"
    | "RESERVED"
    | "IN_TRANSIT"
    | "INSTALLED"
    | "ON_LOAN"
    | "RETURN_IN_TRANSIT"
    | "UNDER_INSPECTION"
    | "DEFECTIVE_PENDING_RETURN"
    | "DEFECTIVE_RETURNED_TO_VENDOR"
    | "SCRAPPED";
  isLoaner?: boolean;
  dateAdded: string | Date;
  supplier?: string | null;
  notes?: string | null;
  ticketAllocations?: Array<{
    id: number;
    status: string;
    ticket?: {
      id: number;
      ticketRefNo: string | null;
      clientSiteName: string;
      status: string;
      subStatus: string | null;
    } | null;
  }>;
  logs?: InventoryLog[];
}

export interface TicketSparePart {
  id: number;
  ticketId: number;
  requestedPartName: string;
  quantity: number;
  status: "REQUESTED" | "ALLOCATED" | "DISPATCHED" | "INSTALLED" | "ON_LOAN" | "RETURN_IN_TRANSIT" | "RETURNED" | "CANCELLED";
  isLoaner?: boolean;
  expectedReturnDate?: string | Date | null;
  loanDurationDays?: number | null;
  returnInitiatedAt?: string | Date | null;
  returnCourierName?: string | null;
  returnTrackingNo?: string | null;
  returnReceivedAt?: string | Date | null;
  returnCondition?: string | null;
  loanNotes?: string | null;
  courierName?: string | null;
  dispatchTrackingNo?: string | null;
  dispatchedAt?: string | Date | null;
  installedAt?: string | Date | null;
  replacedDefectiveSerial?: string | null;
  notes?: string | null;
  inventoryItemId?: number | null;
  inventoryItem?: InventoryItem | null;
  ticket?: {
    id: number;
    ticketRefNo: string | null;
    clientSiteName: string;
    state: string;
    status: string;
    subStatus: string | null;
    assignedFe?: {
      name: string;
      phone: string;
    } | null;
    partner?: {
      name: string;
    } | null;
  } | null;
}


export interface PendingTicketPart {
  id: number;
  ticketRefNo: string | null;
  clientSiteName: string;
  state: string;
  status: string;
  subStatus: string | null;
  reportedAt: string | Date;
  assignedFe?: {
    name: string;
    phone: string;
  } | null;
  partner?: {
    name: string;
  } | null;
  spareParts?: TicketSparePart[];
}

interface InventoryTabProps {
  initialItems: InventoryItem[];
  initialWarehouses: Warehouse[];
  initialPendingTickets: PendingTicketPart[];
  userRole?: string;
  userName?: string;
  onRefresh?: () => void;
  onOpenTicket?: (ticketId: number) => void;
}

const CATEGORIES = [
  "Power Supply",
  "Motherboard",
  "RAM",
  "Storage / SSD / HDD",
  "Printhead",
  "Roller / Maintenance Kit",
  "Network / Router / Switch",
  "Display / Monitor / Screen",
  "POS Terminal / Peripherals",
  "Cable / Adapter",
  "Other",
];

const MALAYSIAN_STATES = [
  "Johor",
  "Kedah",
  "Kelantan",
  "Kuala Lumpur",
  "Labuan",
  "Malacca",
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

export default function InventoryTab({
  initialItems = [],
  initialWarehouses = [],
  initialPendingTickets = [],
  userRole = "SUPERADMIN",
  userName = "Admin",
  onRefresh,
  onOpenTicket,
}: InventoryTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<"STOCK" | "DISPATCH" | "LOANS" | "WAREHOUSES">("STOCK");
  const [items, setItems] = useState<InventoryItem[]>(initialItems);
  const [warehouses, setWarehouses] = useState<Warehouse[]>(initialWarehouses);
  const [pendingTickets, setPendingTickets] = useState<PendingTicketPart[]>(initialPendingTickets);
  const [activeLoans, setActiveLoans] = useState<TicketSparePart[]>([]);
  const [isPending, startTransition] = useTransition();

  // Load Active Loaner Units
  const fetchActiveLoans = async () => {
    try {
      const loans = await getActiveLoaners();
      setActiveLoans(loans);
    } catch (err) {
      console.error("Error fetching active loans:", err);
    }
  };

  // Sync props when parent updates
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    setWarehouses(initialWarehouses);
  }, [initialWarehouses]);

  useEffect(() => {
    setPendingTickets(initialPendingTickets);
  }, [initialPendingTickets]);

  useEffect(() => {
    fetchActiveLoans();
  }, []);

  // Periodic refresh for Inventory Hub
  useEffect(() => {
    const interval = setInterval(() => {
      Promise.all([
        getInventoryItems(),
        getPendingPartsRequests(),
        getActiveLoaners(),
        getWarehouses(),
      ]).then(([freshItems, freshPending, freshLoans, freshWhs]) => {
        setItems(freshItems);
        setPendingTickets(freshPending);
        setActiveLoans(freshLoans);
        setWarehouses(freshWhs);
      }).catch((err) => console.error(err));
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [itemTypeFilter, setItemTypeFilter] = useState<"ALL" | "PARTS" | "LOANERS">("ALL");

  // Modals state
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [viewingLogsItem, setViewingLogsItem] = useState<InventoryItem | null>(null);
  const [isAddWarehouseOpen, setIsAddWarehouseOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);

  // Dispatch modal
  const [dispatchModalData, setDispatchModalData] = useState<{
    ticket: PendingTicketPart;
    partRequest: TicketSparePart;
  } | null>(null);
  const [dispatchSelectedItemId, setDispatchSelectedItemId] = useState<string>("");
  const [dispatchCourierName, setDispatchCourierName] = useState("");
  const [dispatchTrackingNo, setDispatchTrackingNo] = useState("");
  const [dispatchNotes, setDispatchNotes] = useState("");

  // Loaner Modals State
  const [isExtendLoanModalOpen, setIsExtendLoanModalOpen] = useState(false);
  const [selectedLoanToExtend, setSelectedLoanToExtend] = useState<TicketSparePart | null>(null);
  const [extendDays, setExtendDays] = useState(7);
  const [extendReason, setExtendReason] = useState("");

  const [isReturnLoanModalOpen, setIsReturnLoanModalOpen] = useState(false);
  const [selectedLoanToReturn, setSelectedLoanToReturn] = useState<TicketSparePart | null>(null);
  const [returnCourier, setReturnCourier] = useState("");
  const [returnTracking, setReturnTracking] = useState("");
  const [returnNotes, setReturnNotes] = useState("");

  const [isRestockLoanModalOpen, setIsRestockLoanModalOpen] = useState(false);
  const [selectedLoanToRestock, setSelectedLoanToRestock] = useState<TicketSparePart | null>(null);
  const [restockCondition, setRestockCondition] = useState<"GOOD" | "DAMAGED_NEEDS_REPAIR" | "MISSING_ACCESSORIES">("GOOD");
  const [restockNotes, setRestockNotes] = useState("");

  const [isDeployLoanerModalOpen, setIsDeployLoanerModalOpen] = useState(false);
  const [selectedLoanerItem, setSelectedLoanerItem] = useState<InventoryItem | null>(null);
  const [deployTicketId, setDeployTicketId] = useState("");
  const [deployDuration, setDeployDuration] = useState(14);
  const [deployCourier, setDeployCourier] = useState("");
  const [deployTracking, setDeployTracking] = useState("");
  const [deployNotes, setDeployNotes] = useState("");

  // Form states
  const [itemForm, setItemForm] = useState({
    name: "",
    partNumber: "",
    category: "Power Supply",
    serialNumber: "",
    warehouseId: "",
    status: "AVAILABLE",
    isLoaner: false,
    supplier: "",
    notes: "",
  });

  const [warehouseForm, setWarehouseForm] = useState({
    name: "",
    state: "Selangor",
    address: "",
    contactPerson: "",
    contactPhone: "",
  });

  // Calculate KPIs
  const stats = useMemo(() => {
    const total = items.length;
    const available = items.filter((i) => i.status === "AVAILABLE").length;
    const inTransit = items.filter((i) => i.status === "IN_TRANSIT" || i.status === "RESERVED").length;
    const installed = items.filter((i) => i.status === "INSTALLED").length;
    const onLoanCount = activeLoans.length;
    const overdueLoansCount = activeLoans.filter((l) => {
      if (l.status !== "ON_LOAN" || !l.expectedReturnDate) return false;
      return new Date(l.expectedReturnDate) < new Date();
    }).length;
    const defective = items.filter(
      (i) => i.status === "DEFECTIVE_PENDING_RETURN" || i.status === "DEFECTIVE_RETURNED_TO_VENDOR"
    ).length;

    // Count tickets waiting for parts
    const pendingPartsTicketsCount = pendingTickets.filter(
      (t) =>
        t.subStatus === "PENDING_PARTS" ||
        t.spareParts?.some((p) => p.status === "REQUESTED" || p.status === "ALLOCATED")
    ).length;

    return { total, available, inTransit, installed, onLoanCount, overdueLoansCount, defective, pendingPartsTicketsCount };
  }, [items, pendingTickets, activeLoans]);


  // Filtered Stock Items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedWarehouseId !== "ALL" && String(item.warehouseId) !== selectedWarehouseId) {
        return false;
      }
      if (itemTypeFilter === "PARTS" && item.isLoaner) {
        return false;
      }
      if (itemTypeFilter === "LOANERS" && !item.isLoaner) {
        return false;
      }
      if (selectedStatus !== "ALL" && item.status !== selectedStatus) {
        return false;
      }
      if (selectedCategory !== "ALL" && item.category !== selectedCategory) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = item.name.toLowerCase().includes(q);
        const matchSerial = item.serialNumber.toLowerCase().includes(q);
        const matchPartNo = item.partNumber?.toLowerCase().includes(q);
        const matchWarehouse = item.warehouse?.name?.toLowerCase().includes(q);
        if (!matchName && !matchSerial && !matchPartNo && !matchWarehouse) return false;
      }
      return true;
    });
  }, [items, selectedWarehouseId, selectedStatus, selectedCategory, searchTerm, itemTypeFilter]);

  // Status Badge formatting helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "AVAILABLE":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
            Available
          </span>
        );
      case "RESERVED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Clock className="w-3 h-3 mr-1" />
            Reserved
          </span>
        );
      case "IN_TRANSIT":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <Truck className="w-3 h-3 mr-1" />
            In Transit
          </span>
        );
      case "ON_LOAN":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
            <RotateCcw className="w-3 h-3 mr-1" />
            On Loan
          </span>
        );
      case "RETURN_IN_TRANSIT":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <Truck className="w-3 h-3 mr-1" />
            Return In Transit
          </span>
        );
      case "UNDER_INSPECTION":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Clock className="w-3 h-3 mr-1" />
            Under Inspection
          </span>
        );
      case "INSTALLED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Installed
          </span>
        );
      case "DEFECTIVE_PENDING_RETURN":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <RotateCcw className="w-3 h-3 mr-1" />
            Defective (Pending Return)
          </span>
        );
      case "DEFECTIVE_RETURNED_TO_VENDOR":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
            Returned to Vendor
          </span>
        );
      case "SCRAPPED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
            Scrapped
          </span>
        );
      default:
        return <span className="text-xs text-zinc-500">{status}</span>;
    }
  };

  // Add Item Handler
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemForm.name.trim() || !itemForm.serialNumber.trim() || !itemForm.warehouseId) {
      toast.error("Please fill in Item Name, Serial Number, and Warehouse.");
      return;
    }

    startTransition(async () => {
      try {
        if (editingItem) {
          const updated = await updateInventoryItem(editingItem.id, {
            name: itemForm.name,
            partNumber: itemForm.partNumber || undefined,
            category: itemForm.category,
            serialNumber: itemForm.serialNumber,
            warehouseId: Number(itemForm.warehouseId),
            status: itemForm.status as any,
            isLoaner: itemForm.isLoaner,
            supplier: itemForm.supplier || undefined,
            notes: itemForm.notes || undefined,
            author: userName,
          });
          setItems((prev) => prev.map((i) => (i.id === updated.id ? { ...i, ...updated } : i)));
          toast.success("Inventory item updated successfully!");
          setEditingItem(null);
        } else {
          const created = await createInventoryItem({
            name: itemForm.name,
            partNumber: itemForm.partNumber || undefined,
            category: itemForm.category,
            serialNumber: itemForm.serialNumber,
            warehouseId: Number(itemForm.warehouseId),
            status: itemForm.status as any,
            isLoaner: itemForm.isLoaner,
            supplier: itemForm.supplier || undefined,
            notes: itemForm.notes || undefined,
            author: userName,
          });
          setItems((prev) => [created, ...prev]);
          toast.success("New inventory item registered!");
          setIsAddItemOpen(false);
        }
        resetItemForm();
        onRefresh?.();
      } catch (err: any) {
        toast.error(err.message || "Failed to save inventory item.");
      }
    });
  };

  // Delete Item Handler
  const handleDeleteItem = async (id: number) => {
    if (!confirm("Are you sure you want to delete this inventory item?")) return;
    startTransition(async () => {
      try {
        await deleteInventoryItem(id);
        setItems((prev) => prev.filter((i) => i.id !== id));
        toast.success("Item deleted from inventory.");
        onRefresh?.();
      } catch (err: any) {
        toast.error(err.message || "Failed to delete item.");
      }
    });
  };

  const resetItemForm = () => {
    setItemForm({
      name: "",
      partNumber: "",
      category: "Power Supply",
      serialNumber: "",
      warehouseId: warehouses[0]?.id ? String(warehouses[0].id) : "",
      status: "AVAILABLE",
      isLoaner: false,
      supplier: "",
      notes: "",
    });
  };


  // Add/Edit Warehouse Handler
  const handleSaveWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseForm.name.trim()) {
      toast.error("Please enter a warehouse name.");
      return;
    }

    startTransition(async () => {
      try {
        if (editingWarehouse) {
          const updated = await updateWarehouse(editingWarehouse.id, {
            name: warehouseForm.name,
            state: warehouseForm.state,
            address: warehouseForm.address || undefined,
            contactPerson: warehouseForm.contactPerson || undefined,
            contactPhone: warehouseForm.contactPhone || undefined,
          });
          setWarehouses((prev) => prev.map((w) => (w.id === updated.id ? { ...w, ...updated } : w)));
          toast.success("Warehouse updated!");
          setEditingWarehouse(null);
        } else {
          const created = await createWarehouse({
            name: warehouseForm.name,
            state: warehouseForm.state,
            address: warehouseForm.address || undefined,
            contactPerson: warehouseForm.contactPerson || undefined,
            contactPhone: warehouseForm.contactPhone || undefined,
          });
          setWarehouses((prev) => [...prev, created]);
          toast.success("Warehouse created successfully!");
          setIsAddWarehouseOpen(false);
        }
        setWarehouseForm({
          name: "",
          state: "Selangor",
          address: "",
          contactPerson: "",
          contactPhone: "",
        });
        onRefresh?.();
      } catch (err: any) {
        toast.error(err.message || "Failed to save warehouse.");
      }
    });
  };

  const handleDeleteWarehouse = async (id: number) => {
    if (!confirm("Are you sure you want to delete this warehouse?")) return;
    startTransition(async () => {
      try {
        await deleteWarehouse(id);
        setWarehouses((prev) => prev.filter((w) => w.id !== id));
        toast.success("Warehouse deleted.");
        onRefresh?.();
      } catch (err: any) {
        toast.error(err.message || "Failed to delete warehouse.");
      }
    });
  };

  // Dispatch Spare Part Action
  const handleConfirmDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchModalData) return;
    if (!dispatchSelectedItemId) {
      toast.error("Please select an inventory item to allocate.");
      return;
    }

    startTransition(async () => {
      try {
        await allocateAndDispatchSparePart({
          ticketSparePartId: dispatchModalData.partRequest.id,
          inventoryItemId: Number(dispatchSelectedItemId),
          courierName: dispatchCourierName || undefined,
          dispatchTrackingNo: dispatchTrackingNo || undefined,
          notes: dispatchNotes || undefined,
          author: userName,
        });

        // Immediately update state with fresh data for instant UI response
        const [freshItems, freshPending] = await Promise.all([
          getInventoryItems(),
          getPendingPartsRequests(),
        ]);
        setItems(freshItems);
        setPendingTickets(freshPending);

        toast.success("Spare part successfully allocated & dispatched!");
        setDispatchModalData(null);
        setDispatchSelectedItemId("");
        setDispatchCourierName("");
        setDispatchTrackingNo("");
        setDispatchNotes("");
        onRefresh?.();
      } catch (err: any) {
        toast.error(err.message || "Failed to dispatch spare part.");
      }
    });
  };

  // Loaner Handlers
  const handleExtendLoanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanToExtend) return;
    startTransition(async () => {
      try {
        await extendLoanDuration({
          ticketSparePartId: selectedLoanToExtend.id,
          additionalDays: Number(extendDays) || 7,
          reason: extendReason || undefined,
          author: userName,
        });
        const freshLoans = await getActiveLoaners();
        setActiveLoans(freshLoans);
        setIsExtendLoanModalOpen(false);
        setSelectedLoanToExtend(null);
        setExtendReason("");
        toast.success(`Loan extended by +${extendDays} days!`);
        onRefresh?.();
      } catch (err: any) {
        toast.error(err.message || "Failed to extend loan.");
      }
    });
  };

  const handleReturnLoanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanToReturn) return;
    startTransition(async () => {
      try {
        await initiateLoanerReturn({
          ticketSparePartId: selectedLoanToReturn.id,
          returnCourierName: returnCourier || undefined,
          returnTrackingNo: returnTracking || undefined,
          notes: returnNotes || undefined,
          author: userName,
        });
        const [freshLoans, freshItems] = await Promise.all([
          getActiveLoaners(),
          getInventoryItems(),
        ]);
        setActiveLoans(freshLoans);
        setItems(freshItems);
        setIsReturnLoanModalOpen(false);
        setSelectedLoanToReturn(null);
        setReturnCourier("");
        setReturnTracking("");
        setReturnNotes("");
        toast.success("Loaner return initiated!");
        onRefresh?.();
      } catch (err: any) {
        toast.error(err.message || "Failed to initiate return.");
      }
    });
  };

  const handleRestockLoanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanToRestock) return;
    startTransition(async () => {
      try {
        await receiveAndRestockLoaner({
          ticketSparePartId: selectedLoanToRestock.id,
          condition: restockCondition,
          notes: restockNotes || undefined,
          author: userName,
        });
        const [freshLoans, freshItems] = await Promise.all([
          getActiveLoaners(),
          getInventoryItems(),
        ]);
        setActiveLoans(freshLoans);
        setItems(freshItems);
        setIsRestockLoanModalOpen(false);
        setSelectedLoanToRestock(null);
        setRestockNotes("");
        toast.success(`Loaner restocked with condition: ${restockCondition}!`);
        onRefresh?.();
      } catch (err: any) {
        toast.error(err.message || "Failed to restock loaner.");
      }
    });
  };

  const handleDeployLoanerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanerItem || !deployTicketId) {
      toast.error("Please select a target ticket.");
      return;
    }
    startTransition(async () => {
      try {
        await allocateAndDispatchLoanerUnit({
          ticketId: Number(deployTicketId),
          inventoryItemId: selectedLoanerItem.id,
          loanDurationDays: Number(deployDuration) || 14,
          courierName: deployCourier || undefined,
          dispatchTrackingNo: deployTracking || undefined,
          loanNotes: deployNotes || undefined,
          author: userName,
        });
        const [freshLoans, freshItems] = await Promise.all([
          getActiveLoaners(),
          getInventoryItems(),
        ]);
        setActiveLoans(freshLoans);
        setItems(freshItems);
        setIsDeployLoanerModalOpen(false);
        setSelectedLoanerItem(null);
        setDeployTicketId("");
        setDeployCourier("");
        setDeployTracking("");
        setDeployNotes("");
        toast.success("Standby Loaner successfully dispatched to site!");
        onRefresh?.();
      } catch (err: any) {
        toast.error(err.message || "Failed to dispatch loaner.");
      }
    });
  };

  // Cancel Spare Part Request
  const handleCancelRequest = async (partRequestId: number) => {
    if (!confirm("Are you sure you want to cancel this spare part request?")) return;
    startTransition(async () => {
      try {
        await cancelSparePartRequest(partRequestId, userName);
        toast.success("Part request cancelled.");
        onRefresh?.();
      } catch (err: any) {
        toast.error(err.message || "Failed to cancel request.");
      }
    });
  };


  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      "ID",
      "Item Name",
      "Part Number / SKU",
      "Category",
      "Serial Number",
      "Warehouse",
      "State",
      "Status",
      "Date Added",
      "Supplier",
      "Notes",
    ];

    const rows = filteredItems.map((item) => [
      item.id,
      `"${item.name.replace(/"/g, '""')}"`,
      `"${item.partNumber || ""}"`,
      `"${item.category}"`,
      `"${item.serialNumber}"`,
      `"${item.warehouse?.name || ""}"`,
      `"${item.warehouse?.state || ""}"`,
      item.status,
      new Date(item.dateAdded).toLocaleDateString("en-MY"),
      `"${item.supplier || ""}"`,
      `"${(item.notes || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ticketlink_inventory_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Inventory stock exported to CSV.");
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Metrics */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2.5">
            <Package className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            Inventory & Spare Parts Hub
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Track hardware parts across warehouses, dispatch spares to Field Engineers, and manage defective returns.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeSubTab === "STOCK" && (
            <>
              <button
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 transition"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Export CSV
              </button>
              <button
                onClick={() => {
                  resetItemForm();
                  setIsAddItemOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition shadow-indigo-500/20"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            </>
          )}

          {activeSubTab === "WAREHOUSES" && (
            <button
              onClick={() => {
                setWarehouseForm({
                  name: "",
                  state: "Selangor",
                  address: "",
                  contactPerson: "",
                  contactPhone: "",
                });
                setIsAddWarehouseOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              Add Warehouse
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total Stock</span>
            <Package className="w-4 h-4 text-zinc-400" />
          </div>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-2">{stats.total}</p>
          <span className="text-[11px] text-zinc-400">Tracked Units</span>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Available</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">{stats.available}</p>
          <span className="text-[11px] text-zinc-400">Ready to dispatch</span>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400">In Transit / Reserved</span>
            <Truck className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-2">{stats.inTransit}</p>
          <span className="text-[11px] text-zinc-400">Dispatched to site/FE</span>
        </div>

        <div
          onClick={() => setActiveSubTab("DISPATCH")}
          className="cursor-pointer bg-white dark:bg-zinc-900 border border-amber-300/80 dark:border-amber-800/80 rounded-xl p-4 shadow-sm hover:border-amber-500 transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Parts Needed</span>
            <AlertCircle className="w-4 h-4 text-amber-500 animate-pulse" />
          </div>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2">
            {stats.pendingPartsTicketsCount}
          </p>
          <span className="text-[11px] text-amber-600/80 flex items-center gap-1 mt-0.5">
            Click to dispatch <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
          </span>
        </div>

        <div
          onClick={() => setActiveSubTab("LOANS")}
          className="cursor-pointer bg-white dark:bg-zinc-900 border border-cyan-300/80 dark:border-cyan-800/80 rounded-xl p-4 shadow-sm hover:border-cyan-500 transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-cyan-600 dark:text-cyan-400">Active Loans</span>
            <RotateCcw className="w-4 h-4 text-cyan-500" />
          </div>
          <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400 mt-2">{stats.onLoanCount}</p>
          <span className={`text-[11px] font-semibold flex items-center gap-1 mt-0.5 ${stats.overdueLoansCount > 0 ? "text-rose-500" : "text-zinc-400"}`}>
            {stats.overdueLoansCount > 0 ? `🚨 ${stats.overdueLoansCount} Overdue` : "Temporary deployments"}
          </span>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-600 dark:text-rose-400">Defective Returns</span>
            <RotateCcw className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-2">{stats.defective}</p>
          <span className="text-[11px] text-zinc-400">Swapped / RMA</span>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800 space-x-2">
        <button
          onClick={() => setActiveSubTab("STOCK")}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
            activeSubTab === "STOCK"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          <Layers className="w-4 h-4" />
          Stock Inventory ({items.length})
        </button>

        <button
          onClick={() => setActiveSubTab("DISPATCH")}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition flex items-center gap-2 relative ${
            activeSubTab === "DISPATCH"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          <Wrench className="w-4 h-4" />
          Pending Parts Dispatch Queue
          {stats.pendingPartsTicketsCount > 0 && (
            <span className="ml-1.5 px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500 text-white">
              {stats.pendingPartsTicketsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab("LOANS")}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition flex items-center gap-2 relative ${
            activeSubTab === "LOANS"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          Active Loans ({activeLoans.length})
          {stats.overdueLoansCount > 0 && (
            <span className="ml-1.5 px-2 py-0.5 text-xs font-bold rounded-full bg-rose-500 text-white animate-pulse">
              {stats.overdueLoansCount} OVERDUE
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab("WAREHOUSES")}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
            activeSubTab === "WAREHOUSES"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          <Building2 className="w-4 h-4" />
          Warehouses & Hubs ({warehouses.length})
        </button>
      </div>


      {/* TAB 1: STOCK INVENTORY */}
      {activeSubTab === "STOCK" && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by part name, serial number, SKU, or warehouse..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Item Type Filter Toggle */}
              <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-700 p-0.5 bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setItemTypeFilter("ALL")}
                  className={`px-2.5 py-1.5 rounded-md transition ${
                    itemTypeFilter === "ALL"
                      ? "bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  }`}
                >
                  All ({items.length})
                </button>
                <button
                  type="button"
                  onClick={() => setItemTypeFilter("PARTS")}
                  className={`px-2.5 py-1.5 rounded-md transition ${
                    itemTypeFilter === "PARTS"
                      ? "bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  }`}
                >
                  Spare Parts ({items.filter((i) => !i.isLoaner).length})
                </button>
                <button
                  type="button"
                  onClick={() => setItemTypeFilter("LOANERS")}
                  className={`px-2.5 py-1.5 rounded-md transition ${
                    itemTypeFilter === "LOANERS"
                      ? "bg-white dark:bg-zinc-700 text-cyan-600 dark:text-cyan-400 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  }`}
                >
                  Loaners ({items.filter((i) => i.isLoaner).length})
                </button>
              </div>

              <select
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                className="text-xs font-medium px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Warehouses</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.state})
                  </option>
                ))}
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="text-xs font-medium px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="AVAILABLE">Available</option>
                <option value="RESERVED">Reserved</option>
                <option value="IN_TRANSIT">In Transit</option>
                <option value="ON_LOAN">On Loan</option>
                <option value="RETURN_IN_TRANSIT">Return In Transit</option>
                <option value="INSTALLED">Installed</option>
                <option value="DEFECTIVE_PENDING_RETURN">Defective (Pending Return)</option>
                <option value="DEFECTIVE_RETURNED_TO_VENDOR">Returned to Vendor</option>
                <option value="SCRAPPED">Scrapped</option>
              </select>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="text-xs font-medium px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {(searchTerm ||
                selectedWarehouseId !== "ALL" ||
                selectedStatus !== "ALL" ||
                selectedCategory !== "ALL" ||
                itemTypeFilter !== "ALL") && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedWarehouseId("ALL");
                    setSelectedStatus("ALL");
                    setSelectedCategory("ALL");
                    setItemTypeFilter("ALL");
                  }}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline px-2"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4">Item Details</th>
                    <th className="py-3.5 px-4">Category / SKU</th>
                    <th className="py-3.5 px-4">Serial Number</th>
                    <th className="py-3.5 px-4">Warehouse</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Date Added</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-800 dark:text-zinc-200 font-normal">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-zinc-500 dark:text-zinc-400">
                        <Package className="w-8 h-8 mx-auto text-zinc-400 mb-2 opacity-50" />
                        No inventory items found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition"
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="font-semibold text-zinc-900 dark:text-white">{item.name}</div>
                            {item.isLoaner && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800">
                                Standby Loaner
                              </span>
                            )}
                          </div>
                          {item.supplier && (
                            <div className="text-[11px] text-zinc-400">Supplier: {item.supplier}</div>
                          )}
                          {item.notes && (
                            <div className="text-[11px] text-zinc-400 italic line-clamp-1">
                              Note: {item.notes}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium">
                            {item.category}
                          </span>
                          {item.partNumber && (
                            <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                              SKU: {item.partNumber}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-medium text-zinc-900 dark:text-zinc-100">
                          {item.serialNumber}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-zinc-800 dark:text-zinc-200">
                            {item.warehouse?.name || "Unassigned"}
                          </div>
                          <div className="text-[11px] text-zinc-400">{item.warehouse?.state}</div>
                        </td>
                        <td className="py-3.5 px-4">{getStatusBadge(item.status)}</td>
                        <td className="py-3.5 px-4 text-zinc-500 dark:text-zinc-400">
                          {new Date(item.dateAdded).toLocaleDateString("en-MY", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {item.isLoaner && item.status === "AVAILABLE" && (
                              <button
                                title="Deploy as Standby Loaner to Ticket"
                                onClick={() => {
                                  setSelectedLoanerItem(item);
                                  setDeployTicketId("");
                                  setDeployDuration(14);
                                  setDeployCourier("");
                                  setDeployTracking("");
                                  setDeployNotes("");
                                  setIsDeployLoanerModalOpen(true);
                                }}
                                className="px-2 py-1 bg-cyan-50 dark:bg-cyan-950/60 hover:bg-cyan-100 dark:hover:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300 rounded text-xs font-semibold transition border border-cyan-200 dark:border-cyan-800 flex items-center gap-1"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Deploy
                              </button>
                            )}
                            <button
                              title="View Activity Logs"
                              onClick={() => setViewingLogsItem(item)}
                              className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            >
                              <History className="w-4 h-4" />
                            </button>
                            <button
                              title="Edit Item"
                              onClick={() => {
                                setEditingItem(item);
                                setItemForm({
                                  name: item.name,
                                  partNumber: item.partNumber || "",
                                  category: item.category,
                                  serialNumber: item.serialNumber,
                                  warehouseId: String(item.warehouseId),
                                  status: item.status,
                                  isLoaner: !!item.isLoaner,
                                  supplier: item.supplier || "",
                                  notes: item.notes || "",
                                });
                              }}
                              className="p-1.5 text-zinc-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {item.status !== "INSTALLED" && item.status !== "ON_LOAN" && (
                              <button
                                title="Delete Item"
                                onClick={() => handleDeleteItem(item.id)}
                                className="p-1.5 text-zinc-400 hover:text-rose-600 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PENDING PARTS DISPATCH QUEUE */}
      {activeSubTab === "DISPATCH" && (
        <div className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  Tickets Waiting for Spare Parts / Loaner Hardware
                </h3>
                <p className="text-xs text-amber-700 dark:text-amber-300/90 mt-0.5">
                  The tickets listed below are in Follow-Up (Pending Parts) status. Allocate available parts from
                  warehouses and record courier dispatch tracking numbers so Field Engineers can complete repairs on site.
                </p>
              </div>
            </div>
          </div>

          {pendingTickets.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-12 text-center text-zinc-500">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-3 opacity-80" />
              <h4 className="text-base font-semibold text-zinc-900 dark:text-white">All Clear!</h4>
              <p className="text-xs text-zinc-400 mt-1">There are no pending spare part requests at this time.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400">
                        #{ticket.ticketRefNo || ticket.id}
                      </span>
                      <h4 className="font-semibold text-zinc-900 dark:text-white">{ticket.clientSiteName}</h4>
                      <span className="text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                        {ticket.state}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onOpenTicket?.(ticket.id)}
                        className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 inline-flex items-center gap-1 px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                      >
                        Open Ticket <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-zinc-600 dark:text-zinc-400">
                    <div>
                      <span className="font-medium text-zinc-500">Assigned Partner:</span>{" "}
                      <span className="text-zinc-900 dark:text-zinc-200">{ticket.partner?.name || "Unassigned"}</span>
                    </div>
                    <div>
                      <span className="font-medium text-zinc-500">Assigned FE:</span>{" "}
                      <span className="text-zinc-900 dark:text-zinc-200">
                        {ticket.assignedFe?.name ? `${ticket.assignedFe.name} (${ticket.assignedFe.phone})` : "Unassigned"}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-zinc-500">Reported At:</span>{" "}
                      <span className="text-zinc-900 dark:text-zinc-200">
                        {new Date(ticket.reportedAt).toLocaleDateString("en-MY", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Spare Parts List */}
                  <div className="space-y-2 pt-1">
                    <h5 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                      Requested Hardware & Spare Parts:
                    </h5>

                    {(!ticket.spareParts || ticket.spareParts.length === 0) ? (
                      <div className="text-xs text-zinc-400 italic bg-zinc-50 dark:bg-zinc-800/40 p-3 rounded-lg flex items-center justify-between">
                        <span>Ticket is marked Pending Parts but no specific item has been allocated yet.</span>
                        <button
                          onClick={() => {
                            setDispatchModalData({
                              ticket,
                              partRequest: {
                                id: 0,
                                ticketId: ticket.id,
                                requestedPartName: "Required Replacement Part",
                                quantity: 1,
                                status: "REQUESTED",
                              },
                            });
                          }}
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold"
                        >
                          Allocate Part Now
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {ticket.spareParts.map((sp) => (
                          <div
                            key={sp.id}
                            className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-700/80 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div>
                              <div className="font-semibold text-xs text-zinc-900 dark:text-white flex items-center gap-2">
                                <span>{sp.requestedPartName}</span>
                                <span className="text-zinc-400 text-[11px]">(Qty: {sp.quantity})</span>
                                {sp.status === "REQUESTED" && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                    Awaiting Dispatch
                                  </span>
                                )}
                                {sp.status === "DISPATCHED" && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                                    Dispatched / In Transit
                                  </span>
                                )}
                                {sp.status === "INSTALLED" && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                    Installed on Site
                                  </span>
                                )}
                              </div>

                              {sp.inventoryItem && (
                                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 flex flex-wrap gap-x-3">
                                  <span>Allocated: <strong>{sp.inventoryItem.name}</strong></span>
                                  <span>S/N: <strong className="font-mono">{sp.inventoryItem.serialNumber}</strong></span>
                                  <span>Warehouse: <strong>{sp.inventoryItem.warehouse?.name}</strong></span>
                                </div>
                              )}

                              {sp.dispatchTrackingNo && (
                                <div className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 flex items-center gap-1">
                                  <Truck className="w-3.5 h-3.5" />
                                  <span>
                                    {sp.courierName ? `${sp.courierName}: ` : "Tracking: "}
                                    <strong className="font-mono">{sp.dispatchTrackingNo}</strong>
                                  </span>
                                </div>
                              )}

                              {sp.replacedDefectiveSerial && (
                                <div className="text-xs text-rose-600 dark:text-rose-400 mt-0.5">
                                  Replaced Defective S/N: <strong className="font-mono">{sp.replacedDefectiveSerial}</strong>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {sp.status === "REQUESTED" && (
                                <>
                                  <button
                                    onClick={() => {
                                      setDispatchModalData({ ticket, partRequest: sp });
                                    }}
                                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                    Allocate & Dispatch
                                  </button>
                                  <button
                                    onClick={() => handleCancelRequest(sp.id)}
                                    className="px-2.5 py-1.5 text-zinc-500 hover:text-rose-600 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded text-xs transition"
                                  >
                                    Cancel
                                  </button>
                                </>
                              )}

                              {sp.status === "DISPATCHED" && (
                                <button
                                  onClick={() => {
                                    setDispatchModalData({ ticket, partRequest: sp });
                                    setDispatchCourierName(sp.courierName || "");
                                    setDispatchTrackingNo(sp.dispatchTrackingNo || "");
                                    if (sp.inventoryItemId) setDispatchSelectedItemId(String(sp.inventoryItemId));
                                  }}
                                  className="px-2.5 py-1 text-xs text-zinc-600 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-600 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700"
                                >
                                  Update Courier Info
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ACTIVE LOANS (STANDBY HARDWARE) */}
      {activeSubTab === "LOANS" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="flex items-center gap-3">
              <RotateCcw className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Active Loaner Units on Site</h2>
                <p className="text-xs text-zinc-500">
                  Track temporary standby hardware deployed to customer sites and manage return handovers.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchActiveLoans}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 transition flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh Loans
              </button>
            </div>
          </div>

          {activeLoans.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm space-y-3">
              <RotateCcw className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto" />
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">No active loaner units</h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                No standby units are currently out on loan. To dispatch a loaner, select an available loaner item from the Stock Inventory tab or from a ticket.
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Ticket / Client Site</th>
                      <th className="py-3 px-4">Loaner Hardware</th>
                      <th className="py-3 px-4">Dispatched & Return Due</th>
                      <th className="py-3 px-4">Loan Status</th>
                      <th className="py-3 px-4">Courier / Waybills</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-medium">
                    {activeLoans.map((loan) => {
                      const now = new Date();
                      const returnDate = loan.expectedReturnDate ? new Date(loan.expectedReturnDate) : null;
                      const isOverdue = returnDate && returnDate < now && loan.status === "ON_LOAN";
                      const diffDays = returnDate
                        ? Math.ceil((returnDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                        : null;

                      return (
                        <tr
                          key={loan.id}
                          className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition"
                        >
                          <td className="py-3.5 px-4">
                            <div className="space-y-0.5">
                              <button
                                type="button"
                                onClick={() => onOpenTicket?.(loan.ticketId)}
                                className="font-mono font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                              >
                                <span>{loan.ticket?.ticketRefNo || `TKT-#${loan.ticketId}`}</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                              <p className="font-bold text-zinc-900 dark:text-white text-xs">
                                {loan.ticket?.clientSiteName || "Client Site"}
                              </p>
                              <p className="text-[11px] text-zinc-400">
                                State: {loan.ticket?.state || "—"} {loan.ticket?.assignedFe ? `| FE: ${loan.ticket.assignedFe.name}` : ""}
                              </p>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="space-y-0.5">
                              <p className="font-bold text-zinc-900 dark:text-white">
                                {loan.inventoryItem?.name || loan.requestedPartName}
                              </p>
                              <p className="text-zinc-500 font-mono text-[11px]">
                                S/N: <strong className="text-zinc-800 dark:text-zinc-200">{loan.inventoryItem?.serialNumber || "—"}</strong>
                              </p>
                              <p className="text-zinc-400 text-[11px]">
                                Hub: {loan.inventoryItem?.warehouse?.name || "Warehouse"}
                              </p>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="space-y-0.5">
                              <div className="text-[11px] text-zinc-500">
                                Dispatched: {loan.dispatchedAt ? new Date(loan.dispatchedAt).toLocaleDateString("en-MY") : "—"}
                              </div>
                              <div className="font-bold text-zinc-900 dark:text-white">
                                Due: {returnDate ? returnDate.toLocaleDateString("en-MY") : "Not set"}
                              </div>
                              <span className="text-[10px] text-zinc-400 block">
                                Duration: {loan.loanDurationDays || 14} days
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            {loan.status === "RETURN_IN_TRANSIT" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                                <Truck className="w-3.5 h-3.5" />
                                Return in Transit
                              </span>
                            ) : isOverdue ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse">
                                <AlertCircle className="w-3.5 h-3.5" />
                                🚨 Overdue by {Math.abs(diffDays || 0)}d
                              </span>
                            ) : diffDays !== null && diffDays <= 3 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                <Clock className="w-3.5 h-3.5" />
                                ⚠️ Due in {diffDays}d
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                🟢 {diffDays}d remaining
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="space-y-1">
                              {loan.dispatchTrackingNo && (
                                <div className="text-[11px] text-zinc-600 dark:text-zinc-300 font-mono">
                                  Outbound: <strong>{loan.courierName || "Courier"}</strong> ({loan.dispatchTrackingNo})
                                </div>
                              )}
                              {loan.returnTrackingNo && (
                                <div className="text-[11px] text-blue-600 dark:text-blue-400 font-mono font-bold">
                                  Return: <strong>{loan.returnCourierName || "Return"}</strong> ({loan.returnTrackingNo})
                                </div>
                              )}
                              {!loan.dispatchTrackingNo && !loan.returnTrackingNo && (
                                <span className="text-zinc-400 text-[11px]">Hand delivered / Local</span>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {loan.status === "ON_LOAN" && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedLoanToExtend(loan);
                                      setExtendDays(7);
                                      setExtendReason("");
                                      setIsExtendLoanModalOpen(true);
                                    }}
                                    className="px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded text-xs font-semibold transition"
                                  >
                                    Extend (+Days)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedLoanToReturn(loan);
                                      setReturnCourier("");
                                      setReturnTracking("");
                                      setReturnNotes("");
                                      setIsReturnLoanModalOpen(true);
                                    }}
                                    className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold transition shadow-sm"
                                  >
                                    Initiate Return
                                  </button>
                                </>
                              )}

                              {(loan.status === "RETURN_IN_TRANSIT" || loan.status === "ON_LOAN") && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedLoanToRestock(loan);
                                    setRestockCondition("GOOD");
                                    setRestockNotes("");
                                    setIsRestockLoanModalOpen(true);
                                  }}
                                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold transition shadow-sm"
                                >
                                  Inspect & Restock
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: WAREHOUSES & HUBS */}
      {activeSubTab === "WAREHOUSES" && (

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {warehouses.map((w) => (
              <div
                key={w.id}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-3 relative group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-zinc-900 dark:text-white">{w.name}</h3>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">{w.state}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingWarehouse(w);
                        setWarehouseForm({
                          name: w.name,
                          state: w.state,
                          address: w.address || "",
                          contactPerson: w.contactPerson || "",
                          contactPhone: w.contactPhone || "",
                        });
                      }}
                      className="p-1.5 text-zinc-400 hover:text-indigo-600 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteWarehouse(w.id)}
                      className="p-1.5 text-zinc-400 hover:text-rose-600 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="text-xs text-zinc-600 dark:text-zinc-300 space-y-1 pt-1">
                  {w.address && <p className="text-zinc-500 dark:text-zinc-400">📍 {w.address}</p>}
                  {(w.contactPerson || w.contactPhone) && (
                    <p className="text-zinc-500 dark:text-zinc-400">
                      👤 {w.contactPerson || "Contact"}: {w.contactPhone || "-"}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs">
                  <span className="text-zinc-500 font-medium">In-Stock Hardware</span>
                  <span className="font-bold text-zinc-900 dark:text-white bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                    {items.filter((i) => i.warehouseId === w.id && i.status === "AVAILABLE").length} available
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: Add / Edit Item */}
      {(isAddItemOpen || editingItem) && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-600" />
                {editingItem ? "Edit Inventory Item" : "Register New Hardware Item"}
              </h3>
              <button
                onClick={() => {
                  setIsAddItemOpen(false);
                  setEditingItem(null);
                }}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Item / Part Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HP 500W Power Supply ATX"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Serial Number / Barcode *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SN-PSU-2026-0042"
                    value={itemForm.serialNumber}
                    onChange={(e) => setItemForm({ ...itemForm, serialNumber: e.target.value })}
                    className="w-full font-mono px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white uppercase"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Part Number / SKU
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 500W-HP-GOLD"
                    value={itemForm.partNumber}
                    onChange={(e) => setItemForm({ ...itemForm, partNumber: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Category</label>
                  <select
                    value={itemForm.category}
                    onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Warehouse Location *
                  </label>
                  <select
                    required
                    value={itemForm.warehouseId}
                    onChange={(e) => setItemForm({ ...itemForm, warehouseId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.state})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Status</label>
                  <select
                    value={itemForm.status}
                    onChange={(e) => setItemForm({ ...itemForm, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  >
                    <option value="AVAILABLE">Available</option>
                    <option value="RESERVED">Reserved</option>
                    <option value="IN_TRANSIT">In Transit</option>
                    <option value="INSTALLED">Installed</option>
                    <option value="DEFECTIVE_PENDING_RETURN">Defective (Pending Return)</option>
                    <option value="DEFECTIVE_RETURNED_TO_VENDOR">Returned to Vendor</option>
                    <option value="SCRAPPED">Scrapped</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Supplier</label>
                  <input
                    type="text"
                    placeholder="e.g. HP Direct / Ingram Micro"
                    value={itemForm.supplier}
                    onChange={(e) => setItemForm({ ...itemForm, supplier: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Standby Loaner Unit Toggle */}
              <div className="p-3 rounded-lg bg-cyan-50/70 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800/60 flex items-center justify-between">
                <div>
                  <label htmlFor="isLoanerModalCheckbox" className="font-bold text-xs text-cyan-900 dark:text-cyan-200 cursor-pointer block">
                    Standby Loaner Unit
                  </label>
                  <p className="text-[11px] text-cyan-700 dark:text-cyan-400">
                    Mark as standby hardware for temporary deployment to customer sites while primary unit undergoes RMA.
                  </p>
                </div>
                <input
                  type="checkbox"
                  id="isLoanerModalCheckbox"
                  checked={itemForm.isLoaner}
                  onChange={(e) => setItemForm({ ...itemForm, isLoaner: e.target.checked })}
                  className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 border-cyan-300 dark:border-cyan-700 cursor-pointer"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Notes / Remarks</label>
                <textarea
                  rows={2}
                  placeholder="Optional notes or condition details..."
                  value={itemForm.notes}
                  onChange={(e) => setItemForm({ ...itemForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                />
              </div>


              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddItemOpen(false);
                    setEditingItem(null);
                  }}
                  className="px-4 py-2 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm transition disabled:opacity-50"
                >
                  {isPending ? "Saving..." : editingItem ? "Update Item" : "Register Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Allocate & Dispatch Spare Part */}
      {dispatchModalData && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Truck className="w-5 h-5 text-blue-600" />
                  Allocate & Dispatch Spare Part
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Ticket #{dispatchModalData.ticket.ticketRefNo || dispatchModalData.ticket.id} -{" "}
                  {dispatchModalData.ticket.clientSiteName}
                </p>
              </div>
              <button
                onClick={() => setDispatchModalData(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmDispatch} className="space-y-4 text-xs">
              <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700">
                <span className="text-[11px] font-medium text-zinc-500">Requested Item:</span>
                <p className="font-semibold text-zinc-900 dark:text-white">
                  {dispatchModalData.partRequest.requestedPartName} (Qty: {dispatchModalData.partRequest.quantity})
                </p>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Select Available Item from Inventory *
                </label>
                <select
                  required
                  value={dispatchSelectedItemId}
                  onChange={(e) => setDispatchSelectedItemId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                >
                  <option value="">-- Choose Stock Item --</option>
                  {items
                    .filter((i) => i.status === "AVAILABLE" || i.id === dispatchModalData.partRequest.inventoryItemId)
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} | S/N: {i.serialNumber} ({i.warehouse.name}) - {i.status}
                      </option>
                    ))}
                </select>
                {items.filter((i) => i.status === "AVAILABLE").length === 0 && (
                  <p className="text-[11px] text-rose-500 mt-1">
                    No items currently in AVAILABLE status. Please add an item to stock first.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Courier / Method
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. J&T Express, PosLaju, Van Stock"
                    value={dispatchCourierName}
                    onChange={(e) => setDispatchCourierName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Courier Tracking Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. JT987654321MY"
                    value={dispatchTrackingNo}
                    onChange={(e) => setDispatchTrackingNo(e.target.value)}
                    className="w-full font-mono px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Dispatch Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Dispatched to FE Ahmad at site branch entrance..."
                  value={dispatchNotes}
                  onChange={(e) => setDispatchNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setDispatchModalData(null)}
                  className="px-4 py-2 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !dispatchSelectedItemId}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm transition disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isPending ? "Dispatching..." : "Confirm & Dispatch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add / Edit Warehouse */}
      {(isAddWarehouseOpen || editingWarehouse) && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                {editingWarehouse ? "Edit Warehouse" : "Add Warehouse / Depot"}
              </h3>
              <button
                onClick={() => {
                  setIsAddWarehouseOpen(false);
                  setEditingWarehouse(null);
                }}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveWarehouse} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Warehouse Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HQ Central Warehouse / Penang Hub"
                  value={warehouseForm.name}
                  onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">State *</label>
                <select
                  value={warehouseForm.state}
                  onChange={(e) => setWarehouseForm({ ...warehouseForm, state: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                >
                  {MALAYSIAN_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Address</label>
                <textarea
                  rows={2}
                  placeholder="Physical street address..."
                  value={warehouseForm.address}
                  onChange={(e) => setWarehouseForm({ ...warehouseForm, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. En. Razak"
                    value={warehouseForm.contactPerson}
                    onChange={(e) => setWarehouseForm({ ...warehouseForm, contactPerson: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. +6012-3456789"
                    value={warehouseForm.contactPhone}
                    onChange={(e) => setWarehouseForm({ ...warehouseForm, contactPhone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddWarehouseOpen(false);
                    setEditingWarehouse(null);
                  }}
                  className="px-4 py-2 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm transition disabled:opacity-50"
                >
                  {isPending ? "Saving..." : editingWarehouse ? "Update Warehouse" : "Create Warehouse"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: View History Logs */}
      {viewingLogsItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-600" />
                  Item Audit Trail
                </h3>
                <p className="text-xs text-zinc-500 font-mono mt-0.5">S/N: {viewingLogsItem.serialNumber}</p>
              </div>
              <button
                onClick={() => setViewingLogsItem(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1 text-xs">
              {(!viewingLogsItem.logs || viewingLogsItem.logs.length === 0) ? (
                <p className="text-zinc-400 text-center py-6">No historical logs recorded for this item.</p>
              ) : (
                viewingLogsItem.logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 space-y-1"
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-indigo-600 dark:text-indigo-400 uppercase tracking-wide text-[10px]">
                        {log.action}
                      </span>
                      <span className="text-zinc-400 text-[10px]">
                        {new Date(log.createdAt).toLocaleString("en-MY")}
                      </span>
                    </div>
                    {log.notes && <p className="text-zinc-700 dark:text-zinc-300 text-xs">{log.notes}</p>}
                    <p className="text-[10px] text-zinc-400">By: {log.author}</p>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <button
                onClick={() => setViewingLogsItem(null)}
                className="px-4 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Extend Loan Duration */}
      {isExtendLoanModalOpen && selectedLoanToExtend && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-600" />
                Extend Standby Loan Duration
              </h3>
              <button
                onClick={() => setIsExtendLoanModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExtendLoanSubmit} className="space-y-3.5 text-xs">
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 space-y-1">
                <p className="font-bold text-zinc-900 dark:text-white text-xs">
                  {selectedLoanToExtend.inventoryItem?.name || selectedLoanToExtend.requestedPartName}
                </p>
                <p className="text-zinc-500 font-mono text-[11px]">
                  S/N: {selectedLoanToExtend.inventoryItem?.serialNumber || "—"} | Site: {selectedLoanToExtend.ticket?.clientSiteName}
                </p>
                <p className="text-[11px] text-zinc-400">
                  Current Return Due: <strong>{selectedLoanToExtend.expectedReturnDate ? new Date(selectedLoanToExtend.expectedReturnDate).toLocaleDateString("en-MY") : "—"}</strong>
                </p>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Additional Days to Extend *
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[7, 14, 21, 30].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setExtendDays(days)}
                      className={`py-1.5 text-xs font-bold rounded-lg border transition ${
                        extendDays === days
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                          : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      +{days} Days
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min={1}
                  max={90}
                  required
                  value={extendDays}
                  onChange={(e) => setExtendDays(Number(e.target.value) || 7)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Reason for Extension (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Vendor RMA delayed by supplier, customer requested standby unit extension..."
                  value={extendReason}
                  onChange={(e) => setExtendReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsExtendLoanModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm transition disabled:opacity-50"
                >
                  {isPending ? "Extending..." : `Confirm +${extendDays} Days Extension`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Initiate Loan Return */}
      {isReturnLoanModalOpen && selectedLoanToReturn && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-indigo-600" />
                Initiate Loaner Return
              </h3>
              <button
                onClick={() => setIsReturnLoanModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleReturnLoanSubmit} className="space-y-3.5 text-xs">
              <p className="text-zinc-600 dark:text-zinc-300">
                Register inbound courier or handover details for returning <strong>{selectedLoanToReturn.inventoryItem?.name || selectedLoanToReturn.requestedPartName}</strong> (S/N: {selectedLoanToReturn.inventoryItem?.serialNumber}) back to depot.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Return Courier / Transporter
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. J&T / PosLaju / Handover"
                    value={returnCourier}
                    onChange={(e) => setReturnCourier(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Tracking / Consignment No
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. JT8827361MY"
                    value={returnTracking}
                    onChange={(e) => setReturnTracking(e.target.value)}
                    className="w-full font-mono px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Return Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Packed in original box, power adapter included..."
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsReturnLoanModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm transition disabled:opacity-50"
                >
                  {isPending ? "Updating..." : "Mark as Return in Transit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Inspect & Restock Loaner */}
      {isRestockLoanModalOpen && selectedLoanToRestock && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Inspect & Restock Loaner Unit
              </h3>
              <button
                onClick={() => setIsRestockLoanModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRestockLoanSubmit} className="space-y-3.5 text-xs">
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 space-y-1">
                <p className="font-bold text-zinc-900 dark:text-white text-xs">
                  {selectedLoanToRestock.inventoryItem?.name || selectedLoanToRestock.requestedPartName}
                </p>
                <p className="text-zinc-500 font-mono text-[11px]">
                  S/N: {selectedLoanToRestock.inventoryItem?.serialNumber} | Warehouse: {selectedLoanToRestock.inventoryItem?.warehouse?.name}
                </p>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Physical Condition Inspection Check *
                </label>
                <select
                  value={restockCondition}
                  onChange={(e: any) => setRestockCondition(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold"
                >
                  <option value="GOOD">✓ Good Condition (Ready to return to AVAILABLE stock)</option>
                  <option value="DAMAGED_NEEDS_REPAIR">⚠️ Damaged / Needs Repair (Moves to Defective RMA)</option>
                  <option value="MISSING_ACCESSORIES">⚠️ Missing Accessories (Cables / PSU missing)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Warehouse Restock Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Unit tested on bench, fully operational, firmware wiped and clean..."
                  value={restockNotes}
                  onChange={(e) => setRestockNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsRestockLoanModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm transition disabled:opacity-50"
                >
                  {isPending ? "Restocking..." : "Confirm & Restock to Inventory"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Deploy Standby Loaner to Ticket */}
      {isDeployLoanerModalOpen && selectedLoanerItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-indigo-600" />
                Deploy Standby Loaner to Ticket
              </h3>
              <button
                onClick={() => setIsDeployLoanerModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleDeployLoanerSubmit} className="space-y-3.5 text-xs">
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 space-y-1">
                <span className="text-zinc-400 font-bold uppercase text-[10px] block">Selected Standby Hardware</span>
                <p className="font-bold text-zinc-900 dark:text-white text-sm">{selectedLoanerItem.name}</p>
                <p className="text-zinc-500 font-mono text-[11px]">
                  S/N: <strong>{selectedLoanerItem.serialNumber}</strong> | Origin: {selectedLoanerItem.warehouse?.name}
                </p>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Target Ticket *
                </label>
                <select
                  required
                  value={deployTicketId}
                  onChange={(e) => setDeployTicketId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium"
                >
                  <option value="">-- Select Active Ticket --</option>
                  {pendingTickets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.ticketRefNo || `TKT-#${t.id}`} | {t.clientSiteName} ({t.state}) - {t.status}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Loan Duration (Days) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    required
                    value={deployDuration}
                    onChange={(e) => setDeployDuration(Number(e.target.value) || 14)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Courier / Method
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. J&T / PosLaju / Onsite Handover"
                    value={deployCourier}
                    onChange={(e) => setDeployCourier(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Tracking / Waybill Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. JT99881122MY"
                  value={deployTracking}
                  onChange={(e) => setDeployTracking(e.target.value)}
                  className="w-full font-mono px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Deployment Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Temporary replacement for mainboard fault, client agreement signed..."
                  value={deployNotes}
                  onChange={(e) => setDeployNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsDeployLoanerModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !deployTicketId}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm transition disabled:opacity-50"
                >
                  {isPending ? "Deploying..." : "Confirm & Deploy Loaner"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

