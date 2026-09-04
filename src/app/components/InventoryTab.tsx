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
  Check,
  X,
  Shield,
  Layers2,
  FileText,
  Boxes,
  ArrowRightLeft,
  DollarSign,
  ClipboardCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "./AuthProvider";
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
  approveSparePartRequestAction,
  rejectSparePartRequestAction,
  batchAllocateAndDispatchSparePartsAction,
  createWarehouseTransferAction,
  receiveWarehouseTransferAction,
  getWarehouseTransfers,
  approvePartReplacementClaimAction,
  rejectPartReplacementClaimAction,
  getPartReplacementClaims,
  getServicePartners,
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

export interface WarehouseTransferItem {
  id: number;
  transferId: number;
  inventoryItemId: number;
  inventoryItem?: InventoryItem;
  quantity: number;
}

export interface WarehouseTransfer {
  id: number;
  sourceWarehouseId: number;
  sourceWarehouse?: Warehouse;
  destinationWarehouseId: number;
  destinationWarehouse?: Warehouse;
  courierName?: string | null;
  trackingNo?: string | null;
  notes?: string | null;
  status: "IN_TRANSIT" | "RECEIVED" | "CANCELLED";
  transferredBy: string;
  receivedBy?: string | null;
  receivedAt?: string | Date | null;
  items?: WarehouseTransferItem[];
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface PartReplacementClaim {
  id: number;
  ticketId: number;
  ticket?: {
    id: number;
    ticketRefNo: string | null;
    clientSiteName: string;
    state: string;
    status: string;
    defectiveSerial?: string | null;
  };
  partnerId: number;
  partner?: {
    id: number;
    name: string;
  };
  inventoryItemId?: number | null;
  inventoryItem?: InventoryItem | null;
  partName: string;
  serialNumber?: string | null;
  defectiveSerial?: string | null;
  claimAmount?: number | null;
  status: "PENDING" | "APPROVED_REPLENISH" | "APPROVED_REIMBURSE" | "REJECTED" | "CANCELLED";
  settlementType?: string | null;
  replacementItemId?: number | null;
  requestedBy: string;
  approvedBy?: string | null;
  approvedAt?: string | Date | null;
  rejectionReason?: string | null;
  notes?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface InventoryItem {
  id: number;
  name: string;
  partNumber?: string | null;
  category: string;
  serialNumber?: string | null;
  trackingType?: "SERIALIZED" | "BULK";
  ownership?: "HQ_CONSIGNED" | "PARTNER_OWNED";
  quantity?: number;
  availableQuantity?: number;
  costPrice?: number | null;
  group?: string | null;
  mainconId?: number | null;
  maincon?: {
    id: number;
    name: string;
  } | null;
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
      endCustomer?: string | null;
      state?: string | null;
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
  status:
    | "PENDING_APPROVAL"
    | "APPROVED"
    | "REJECTED"
    | "REQUESTED"
    | "ALLOCATED"
    | "DISPATCHED"
    | "INSTALLED"
    | "ON_LOAN"
    | "RETURN_IN_TRANSIT"
    | "RETURNED"
    | "CANCELLED";
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
  batchTrackingNo?: string | null;
  dispatchedAt?: string | Date | null;
  installedAt?: string | Date | null;
  replacedDefectiveSerial?: string | null;
  requestedBy?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | Date | null;
  rejectionReason?: string | null;
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
  initialMaincons?: Array<{
    id: number;
    name: string;
    siteCustomers?: unknown;
  }>;
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
  "Keyboard / Mouse",
  "Network / Router / Switch",
  "Display / Monitor / Screen",
  "POS Terminal / Peripherals",
  "Cable / Adapter",
  "Consumables / Generic",
  "Other",
];

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

export default function InventoryTab({
  initialItems = [],
  initialWarehouses = [],
  initialPendingTickets = [],
  initialMaincons = [],
  userRole = "SUPERADMIN",
  userName = "Admin",
  onRefresh,
  onOpenTicket,
}: InventoryTabProps) {
  const isSuperAdminOrModerator = userRole === "SUPERADMIN" || userRole === "MODERATOR";
  const isAgent = userRole === "AGENT";
  const { user } = useAuth();

  const [activeSubTab, setActiveSubTab] = useState<
    "STOCK" | "DISPATCH" | "TRANSFERS" | "CLAIMS" | "LOANS" | "WAREHOUSES"
  >("STOCK");
  const [items, setItems] = useState<InventoryItem[]>(initialItems);
  const [warehouses, setWarehouses] = useState<Warehouse[]>(initialWarehouses);
  const [pendingTickets, setPendingTickets] = useState<PendingTicketPart[]>(initialPendingTickets);
  const [activeLoans, setActiveLoans] = useState<TicketSparePart[]>([]);
  const [transfers, setTransfers] = useState<WarehouseTransfer[]>([]);
  const [claims, setClaims] = useState<PartReplacementClaim[]>([]);
  const [servicePartners, setServicePartners] = useState<Array<{ id: number; name: string }>>([]);
  const [isPending, startTransition] = useTransition();

  // Load Active Loaner Units, Transfers, Claims, and Service Partners
  const fetchActiveLoans = async () => {
    try {
      const loans = await getActiveLoaners();
      setActiveLoans(loans);
    } catch (err) {
      console.error("Error fetching active loans:", err);
    }
  };

  const fetchTransfers = async () => {
    try {
      const t = await getWarehouseTransfers();
      setTransfers(t);
    } catch (err) {
      console.error("Error fetching transfers:", err);
    }
  };

  const fetchClaims = async () => {
    try {
      const c = await getPartReplacementClaims();
      setClaims(c);
    } catch (err) {
      console.error("Error fetching claims:", err);
    }
  };

  const fetchPartners = async () => {
    try {
      const p = await getServicePartners();
      setServicePartners(p.map((part: any) => ({ id: part.id, name: part.name })));
    } catch (err) {
      console.error("Error fetching service partners:", err);
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
    fetchTransfers();
    fetchClaims();
    fetchPartners();
  }, []);

  // Periodic refresh for Inventory Hub
  useEffect(() => {
    const interval = setInterval(() => {
      Promise.all([
        getInventoryItems(),
        getPendingPartsRequests(),
        getActiveLoaners(),
        getWarehouses(),
        getWarehouseTransfers(),
        getPartReplacementClaims(),
      ])
        .then(([freshItems, freshPending, freshLoans, freshWhs, freshTransfers, freshClaims]) => {
          setItems(freshItems);
          setPendingTickets(freshPending);
          setActiveLoans(freshLoans);
          setWarehouses(freshWhs);
          setTransfers(freshTransfers);
          setClaims(freshClaims);
        })
        .catch((err) => console.error(err));
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("ALL");
  const [selectedOwnershipFilter, setSelectedOwnershipFilter] = useState<"ALL" | "HQ_CONSIGNED" | "PARTNER_OWNED">("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>("ALL");
  const [selectedTrackingTypeFilter, setSelectedTrackingTypeFilter] = useState<"ALL" | "SERIALIZED" | "BULK">("ALL");
  const [itemTypeFilter, setItemTypeFilter] = useState<"ALL" | "PARTS" | "LOANERS">("ALL");

  // Dispatch Queue Request Status Filter
  const [dispatchStatusFilter, setDispatchStatusFilter] = useState<
    "ALL" | "PENDING_APPROVAL" | "APPROVED" | "DISPATCHED" | "INSTALLED" | "REJECTED_CANCELLED"
  >("ALL");

  // Modals state
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [viewingLogsItem, setViewingLogsItem] = useState<InventoryItem | null>(null);
  const [isAddWarehouseOpen, setIsAddWarehouseOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);

  // Single Dispatch modal
  const [dispatchModalData, setDispatchModalData] = useState<{
    ticket: PendingTicketPart;
    partRequest: TicketSparePart;
  } | null>(null);
  const [dispatchSelectedItemId, setDispatchSelectedItemId] = useState<string>("");
  const [dispatchCourierName, setDispatchCourierName] = useState("");
  const [dispatchTrackingNo, setDispatchTrackingNo] = useState("");
  const [dispatchNotes, setDispatchNotes] = useState("");

  // Reject Request Modal
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectingPart, setRejectingPart] = useState<{ id: number; name: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Multi-Part Batch Dispatch Modal & Cart State
  const [isBatchDispatchOpen, setIsBatchDispatchOpen] = useState(false);
  const [batchTicketId, setBatchTicketId] = useState<string>("");
  const [batchSelectedItems, setBatchSelectedItems] = useState<
    Array<{
      inventoryItemId: number;
      item: InventoryItem;
      quantity: number;
      isLoaner: boolean;
      loanDurationDays: number;
      requestedPartName?: string;
      ticketSparePartId?: number;
      notes?: string;
    }>
  >([]);
  const [batchCourierName, setBatchCourierName] = useState("");
  const [batchTrackingNo, setBatchTrackingNo] = useState("");
  const [batchNotes, setBatchNotes] = useState("");
  const [batchItemSearch, setBatchItemSearch] = useState("");

  // Warehouse Transfer Modal State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferSourceWhId, setTransferSourceWhId] = useState<string>("");
  const [transferDestWhId, setTransferDestWhId] = useState<string>("");
  const [transferCourierName, setTransferCourierName] = useState("");
  const [transferTrackingNo, setTransferTrackingNo] = useState("");
  const [transferNotes, setTransferNotes] = useState("");
  const [transferItemSearch, setTransferItemSearch] = useState("");
  const [transferSelectedItems, setTransferSelectedItems] = useState<
    Array<{
      inventoryItemId: number;
      item: InventoryItem;
      quantity: number;
    }>
  >([]);

  // Part Replacement Claim Review Modal State
  const [reviewingClaim, setReviewingClaim] = useState<PartReplacementClaim | null>(null);
  const [claimResolutionType, setClaimResolutionType] = useState<"REPLENISH" | "REIMBURSE" | "REJECT">("REPLENISH");
  const [claimReplacementItemId, setClaimReplacementItemId] = useState("");
  const [claimRejectReason, setClaimRejectReason] = useState("");
  const [claimNotes, setClaimNotes] = useState("");

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
    trackingType: "SERIALIZED" as "SERIALIZED" | "BULK",
    ownership: "HQ_CONSIGNED" as "HQ_CONSIGNED" | "PARTNER_OWNED",
    quantity: 1,
    costPrice: "" as string | number,
    group: "",
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
    partnerId: "" as string | number,
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

    // Buffer transfers counts
    const transfersTotal = transfers.length;
    const transfersInTransit = transfers.filter((t) => t.status === "IN_TRANSIT").length;

    // Claims counts
    const claimsTotal = claims.length;
    const claimsPending = claims.filter((c) => c.status === "PENDING").length;

    // Count tickets waiting for parts
    const pendingPartsTicketsCount = pendingTickets.filter(
      (t) =>
        t.subStatus === "PENDING_PARTS" ||
        t.spareParts?.some(
          (p) => p.status === "PENDING_APPROVAL" || p.status === "APPROVED" || p.status === "REQUESTED" || p.status === "ALLOCATED"
        )
    ).length;

    // Detailed parts request counts
    let pendingApprovalCount = 0;
    let approvedCount = 0;
    let dispatchedCount = 0;
    let installedCount = 0;

    pendingTickets.forEach((t) => {
      t.spareParts?.forEach((p) => {
        if (p.status === "PENDING_APPROVAL") pendingApprovalCount++;
        else if (p.status === "APPROVED" || p.status === "REQUESTED" || p.status === "ALLOCATED") approvedCount++;
        else if (p.status === "DISPATCHED" || p.status === "ON_LOAN" || p.status === "RETURN_IN_TRANSIT") dispatchedCount++;
        else if (p.status === "INSTALLED" || p.status === "RETURNED") installedCount++;
      });
    });

    return {
      total,
      available,
      inTransit,
      installed,
      onLoanCount,
      overdueLoansCount,
      defective,
      transfersTotal,
      transfersInTransit,
      claimsTotal,
      claimsPending,
      pendingPartsTicketsCount,
      pendingApprovalCount,
      approvedCount,
      dispatchedCount,
      installedCount,
    };
  }, [items, pendingTickets, activeLoans, transfers, claims]);


  // Known Groups extracted from clients, end-customers, and inventory items
  const { endCustomerGroups, clientGroups, allKnownGroups } = useMemo(() => {
    const endCustSet = new Set<string>();
    const clientSet = new Set<string>();
    const allSet = new Set<string>();

    // 1. Add End-Customers and Clients from registered Client profiles
    (initialMaincons || []).forEach((m) => {
      if (m.name && m.name.trim()) {
        clientSet.add(m.name.trim());
        allSet.add(m.name.trim());
      }
      if (m.siteCustomers) {
        try {
          const parsed = typeof m.siteCustomers === "string" ? JSON.parse(m.siteCustomers) : m.siteCustomers;
          if (Array.isArray(parsed)) {
            parsed.forEach((c: string) => {
              if (c && typeof c === "string" && c.trim()) {
                endCustSet.add(c.trim());
                allSet.add(c.trim());
              }
            });
          }
        } catch {}
      }
    });

    // 2. Add any groups already tagged on inventory hardware
    items.forEach((i) => {
      if (i.group && i.group.trim()) {
        allSet.add(i.group.trim());
        if (!clientSet.has(i.group.trim()) && !endCustSet.has(i.group.trim())) {
          endCustSet.add(i.group.trim());
        }
      }
      if (i.maincon?.name && i.maincon.name.trim()) {
        clientSet.add(i.maincon.name.trim());
        allSet.add(i.maincon.name.trim());
      }
    });

    return {
      endCustomerGroups: Array.from(endCustSet).sort(),
      clientGroups: Array.from(clientSet).sort(),
      allKnownGroups: Array.from(allSet).sort(),
    };
  }, [items, initialMaincons]);

  // Filtered Stock Items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedWarehouseId !== "ALL" && String(item.warehouseId) !== selectedWarehouseId) {
        return false;
      }
      if (selectedOwnershipFilter !== "ALL") {
        const itemOwnership = item.ownership || "HQ_CONSIGNED";
        if (itemOwnership !== selectedOwnershipFilter) {
          return false;
        }
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
      if (selectedGroupFilter !== "ALL") {
        if (item.group !== selectedGroupFilter && item.maincon?.name !== selectedGroupFilter) {
          return false;
        }
      }
      if (selectedTrackingTypeFilter !== "ALL") {
        const itemType = item.trackingType || "SERIALIZED";
        if (itemType !== selectedTrackingTypeFilter) {
          return false;
        }
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = item.name.toLowerCase().includes(q);
        const matchSerial = (item.serialNumber || "").toLowerCase().includes(q);
        const matchPartNo = item.partNumber?.toLowerCase().includes(q);
        const matchWarehouse = item.warehouse?.name?.toLowerCase().includes(q);
        const matchGroup = item.group?.toLowerCase().includes(q) || item.maincon?.name?.toLowerCase().includes(q);
        const matchSite = item.ticketAllocations?.some(
          (a) =>
            a.ticket?.clientSiteName?.toLowerCase().includes(q) ||
            a.ticket?.ticketRefNo?.toLowerCase().includes(q)
        );
        if (!matchName && !matchSerial && !matchPartNo && !matchWarehouse && !matchGroup && !matchSite) {
          return false;
        }
      }
      return true;
    });
  }, [
    items,
    selectedWarehouseId,
    selectedOwnershipFilter,
    selectedStatus,
    selectedCategory,
    selectedGroupFilter,
    selectedTrackingTypeFilter,
    searchTerm,
    itemTypeFilter,
  ]);

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

  // Add/Edit Item Handler
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemForm.name.trim() || !itemForm.warehouseId) {
      toast.error("Please fill in Item Name and Warehouse.");
      return;
    }

    if (itemForm.trackingType === "SERIALIZED" && !itemForm.serialNumber.trim()) {
      toast.error("Serial Number is required for serialized items.");
      return;
    }

    startTransition(async () => {
      try {
        if (editingItem) {
          const updated = await updateInventoryItem(editingItem.id, {
            name: itemForm.name,
            partNumber: itemForm.partNumber || undefined,
            category: itemForm.category,
            serialNumber: itemForm.serialNumber || undefined,
            trackingType: itemForm.trackingType,
            ownership: isAgent ? "PARTNER_OWNED" : itemForm.ownership,
            quantity: Number(itemForm.quantity) || 1,
            costPrice: itemForm.costPrice !== "" ? Number(itemForm.costPrice) : undefined,
            group: itemForm.group || undefined,
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
            serialNumber: itemForm.serialNumber || undefined,
            trackingType: itemForm.trackingType,
            ownership: isAgent ? "PARTNER_OWNED" : itemForm.ownership,
            quantity: Number(itemForm.quantity) || 1,
            costPrice: itemForm.costPrice !== "" ? Number(itemForm.costPrice) : undefined,
            group: itemForm.group || undefined,
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
      trackingType: "SERIALIZED",
      ownership: isAgent ? "PARTNER_OWNED" : "HQ_CONSIGNED",
      quantity: 1,
      costPrice: "",
      group: "",
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
            partnerId: warehouseForm.partnerId ? Number(warehouseForm.partnerId) : null,
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
            partnerId: warehouseForm.partnerId ? Number(warehouseForm.partnerId) : null,
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
          partnerId: "",
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

  // Warehouse Transfer Handlers
  const handleAddItemToTransfer = (item: InventoryItem) => {
    if (transferSelectedItems.some((t) => t.inventoryItemId === item.id)) {
      toast.info("Item is already added to this transfer batch.");
      return;
    }
    setTransferSelectedItems((prev) => [
      ...prev,
      {
        inventoryItemId: item.id,
        item,
        quantity: 1,
      },
    ]);
    toast.success(`Added ${item.name} to buffer transfer.`);
  };

  const handleRemoveItemFromTransfer = (index: number) => {
    setTransferSelectedItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateTransferItemQty = (index: number, qty: number) => {
    setTransferSelectedItems((prev) =>
      prev.map((t, idx) => (idx === index ? { ...t, quantity: Math.max(1, qty) } : t))
    );
  };

  const handleInitiateTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferSourceWhId || !transferDestWhId) {
      toast.error("Please select both Source and Destination Warehouses.");
      return;
    }
    if (transferSourceWhId === transferDestWhId) {
      toast.error("Source and Destination warehouses must be different.");
      return;
    }
    if (transferSelectedItems.length === 0) {
      toast.error("Please select at least one item to transfer.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await createWarehouseTransferAction({
          sourceWarehouseId: Number(transferSourceWhId),
          destinationWarehouseId: Number(transferDestWhId),
          courierName: transferCourierName || undefined,
          trackingNo: transferTrackingNo || undefined,
          notes: transferNotes || undefined,
          items: transferSelectedItems.map((t) => ({
            inventoryItemId: t.inventoryItemId,
            quantity: t.quantity,
          })),
        });

        if (!res.success) {
          toast.error(res.message || "Failed to initiate buffer stock transfer.");
          return;
        }

        toast.success("Buffer stock transfer dispatched!");
        setIsTransferModalOpen(false);
        setTransferSourceWhId("");
        setTransferDestWhId("");
        setTransferCourierName("");
        setTransferTrackingNo("");
        setTransferNotes("");
        setTransferSelectedItems([]);
        setTransferItemSearch("");

        const [freshItems, freshTransfers] = await Promise.all([
          getInventoryItems(),
          getWarehouseTransfers(),
        ]);
        setItems(freshItems);
        setTransfers(freshTransfers);
        onRefresh?.();
      } catch (err: any) {
        toast.error(err.message || "Failed to initiate transfer.");
      }
    });
  };

  const handleReceiveTransfer = async (transferId: number) => {
    if (!confirm("Confirm receipt of this buffer stock transfer into your warehouse?")) return;
    startTransition(async () => {
      try {
        const res = await receiveWarehouseTransferAction(transferId);
        if (!res.success) {
          toast.error(res.message || "Failed to receive transfer.");
          return;
        }
        toast.success("Buffer stock transfer received & restocked!");
        const [freshItems, freshTransfers] = await Promise.all([
          getInventoryItems(),
          getWarehouseTransfers(),
        ]);
        setItems(freshItems);
        setTransfers(freshTransfers);
        onRefresh?.();
      } catch (err: any) {
        toast.error(err.message || "Failed to receive transfer.");
      }
    });
  };

  // Claim Review Handlers
  const handleReviewClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingClaim) return;

    startTransition(async () => {
      try {
        if (claimResolutionType === "REJECT") {
          const res = await rejectPartReplacementClaimAction(
            reviewingClaim.id,
            claimRejectReason || "Rejected by administrator"
          );
          if (!res.success) {
            toast.error(res.message || "Failed to reject claim.");
            return;
          }
          toast.success("Part replacement claim rejected.");
        } else {
          const res = await approvePartReplacementClaimAction(reviewingClaim.id, {
            settlementType: claimResolutionType,
            replacementItemId:
              claimResolutionType === "REPLENISH" && claimReplacementItemId
                ? Number(claimReplacementItemId)
                : undefined,
            notes: claimNotes || undefined,
          });
          if (!res.success) {
            toast.error(res.message || "Failed to approve claim.");
            return;
          }
          toast.success(
            claimResolutionType === "REPLENISH"
              ? "Claim approved: HQ Replenishment item assigned!"
              : "Claim approved: Financial reimbursement authorized!"
          );
        }

        setReviewingClaim(null);
        setClaimReplacementItemId("");
        setClaimRejectReason("");
        setClaimNotes("");

        const [freshItems, freshClaims] = await Promise.all([
          getInventoryItems(),
          getPartReplacementClaims(),
        ]);
        setItems(freshItems);
        setClaims(freshClaims);
        onRefresh?.();
      } catch (err: any) {
        toast.error(err.message || "Failed to process claim review.");
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

  // Approve Spare Part Request
  const handleApproveRequest = async (partRequestId: number) => {
    startTransition(async () => {
      try {
        const res = await approveSparePartRequestAction(partRequestId, userName);
        if (!res.success) {
          toast.error(res.message || "Failed to approve request.");
          return;
        }
        toast.success("Spare part request approved!");
        const [freshItems, freshPending] = await Promise.all([
          getInventoryItems(),
          getPendingPartsRequests(),
        ]);
        setItems(freshItems);
        setPendingTickets(freshPending);
        onRefresh?.();
      } catch (err: any) {
        toast.error(err.message || "Failed to approve request.");
      }
    });
  };

  // Reject Spare Part Request
  const handleRejectRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingPart) return;
    startTransition(async () => {
      try {
        const res = await rejectSparePartRequestAction(
          rejectingPart.id,
          rejectReason || "Rejected by administrator",
          userName
        );
        if (!res.success) {
          toast.error(res.message || "Failed to reject request.");
          return;
        }
        toast.success("Spare part request rejected.");
        setIsRejectModalOpen(false);
        setRejectingPart(null);
        setRejectReason("");
        const [freshItems, freshPending] = await Promise.all([
          getInventoryItems(),
          getPendingPartsRequests(),
        ]);
        setItems(freshItems);
        setPendingTickets(freshPending);
        onRefresh?.();
      } catch (err: any) {
        toast.error(err.message || "Failed to reject request.");
      }
    });
  };

  // Batch Cart Handlers
  const handleAddItemToBatch = (item: InventoryItem) => {
    if (batchSelectedItems.some((b) => b.inventoryItemId === item.id)) {
      toast.info("Item is already in your dispatch batch list.");
      return;
    }
    setBatchSelectedItems((prev) => [
      ...prev,
      {
        inventoryItemId: item.id,
        item,
        quantity: 1,
        isLoaner: !!item.isLoaner,
        loanDurationDays: 14,
        requestedPartName: item.name,
      },
    ]);
    toast.success(`Added ${item.name} to batch dispatch cart!`);
  };

  const handleRemoveItemFromBatch = (index: number) => {
    setBatchSelectedItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateBatchItem = (index: number, updates: Partial<typeof batchSelectedItems[0]>) => {
    setBatchSelectedItems((prev) =>
      prev.map((b, idx) => (idx === index ? { ...b, ...updates } : b))
    );
  };

  // Submit Batch Dispatch
  const handleBatchDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchTicketId) {
      toast.error("Please select a target ticket.");
      return;
    }
    if (batchSelectedItems.length === 0) {
      toast.error("Please add at least one hardware item to the dispatch batch.");
      return;
    }

    startTransition(async () => {
      try {
        const payloadItems = batchSelectedItems.map((b) => ({
          inventoryItemId: b.inventoryItemId,
          quantity: b.quantity,
          isLoaner: b.isLoaner,
          loanDurationDays: b.loanDurationDays,
          requestedPartName: b.requestedPartName || b.item.name,
          ticketSparePartId: b.ticketSparePartId,
          notes: b.notes,
        }));

        const res = await batchAllocateAndDispatchSparePartsAction({
          ticketId: Number(batchTicketId),
          items: payloadItems,
          courierName: batchCourierName || undefined,
          batchTrackingNo: batchTrackingNo || undefined,
          notes: batchNotes || undefined,
          author: userName,
        });

        if (!res.success) {
          toast.error(res.message || "Failed to dispatch batch.");
          return;
        }

        toast.success(`Successfully dispatched ${batchSelectedItems.length} items to Ticket #${batchTicketId}!`);
        setIsBatchDispatchOpen(false);
        setBatchTicketId("");
        setBatchSelectedItems([]);
        setBatchCourierName("");
        setBatchTrackingNo("");
        setBatchNotes("");
        setBatchItemSearch("");

        const [freshItems, freshPending, freshLoans] = await Promise.all([
          getInventoryItems(),
          getPendingPartsRequests(),
          getActiveLoaners(),
        ]);
        setItems(freshItems);
        setPendingTickets(freshPending);
        setActiveLoans(freshLoans);
        onRefresh?.();
      } catch (err: any) {
        toast.error(err.message || "Failed to complete batch dispatch.");
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
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 transition cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Export CSV
              </button>
              {(isSuperAdminOrModerator || isAgent) && (
                <button
                  onClick={() => {
                    resetItemForm();
                    setIsAddItemOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition shadow-indigo-500/20 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  {isAgent ? "Register Local Stock" : "Add Item"}
                </button>
              )}
            </>
          )}

          {activeSubTab === "TRANSFERS" && isSuperAdminOrModerator && (
            <button
              onClick={() => {
                setTransferSourceWhId(warehouses[0]?.id ? String(warehouses[0].id) : "");
                setTransferDestWhId(warehouses[1]?.id ? String(warehouses[1].id) : "");
                setTransferCourierName("");
                setTransferTrackingNo("");
                setTransferNotes("");
                setTransferSelectedItems([]);
                setTransferItemSearch("");
                setIsTransferModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition cursor-pointer"
            >
              <ArrowRightLeft className="w-4 h-4" />
              Initiate Buffer Transfer
            </button>
          )}
        </div>
      </div>

      {/* Agent Company-Scoped Access Banner */}
      {isAgent && (
        <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl p-3.5 flex items-center gap-3">
          <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <div className="text-xs text-indigo-900 dark:text-indigo-200">
            <span className="font-semibold">Partner Buffer & Claims Autonomy:</span> You can register local stock in your assigned partner warehouse, track HQ buffer consignments, and submit part replacement claims against resolved tickets.
          </div>
        </div>
      )}

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
          onClick={() => setActiveSubTab("TRANSFERS")}
          className="cursor-pointer bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-800/80 rounded-xl p-4 shadow-sm hover:border-indigo-500 transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">Buffer Transfers</span>
            <ArrowRightLeft className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-2">
            {stats.transfersTotal}
          </p>
          <span className="text-[11px] text-indigo-600/80 flex items-center gap-1 mt-0.5">
            {stats.transfersInTransit > 0 ? `🚚 ${stats.transfersInTransit} in transit` : "Warehouse movements"}
          </span>
        </div>

        <div
          onClick={() => setActiveSubTab("CLAIMS")}
          className="cursor-pointer bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800/80 rounded-xl p-4 shadow-sm hover:border-emerald-500 transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Part Claims</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
            {stats.claimsTotal}
          </p>
          <span className="text-[11px] text-emerald-600/80 flex items-center gap-1 mt-0.5">
            {stats.claimsPending > 0 ? `⚠️ ${stats.claimsPending} pending review` : "Settled / Replenished"}
          </span>
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
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800 space-x-2 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab("STOCK")}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeSubTab === "STOCK"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          <Layers className="w-4 h-4" />
          Stock Inventory ({items.length})
        </button>

        <button
          onClick={() => setActiveSubTab("DISPATCH")}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition flex items-center gap-2 whitespace-nowrap relative cursor-pointer ${
            activeSubTab === "DISPATCH"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          <Wrench className="w-4 h-4" />
          Pending Parts Dispatch Queue
          {stats.pendingPartsTicketsCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-amber-500 text-white">
              {stats.pendingPartsTicketsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab("TRANSFERS")}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition flex items-center gap-2 whitespace-nowrap relative cursor-pointer ${
            activeSubTab === "TRANSFERS"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          <ArrowRightLeft className="w-4 h-4" />
          Buffer Transfers ({transfers.length})
          {stats.transfersInTransit > 0 && (
            <span className="ml-1 px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-blue-500 text-white animate-pulse">
              {stats.transfersInTransit} IN TRANSIT
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab("CLAIMS")}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition flex items-center gap-2 whitespace-nowrap relative cursor-pointer ${
            activeSubTab === "CLAIMS"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          <DollarSign className="w-4 h-4" />
          Part Claims ({claims.length})
          {stats.claimsPending > 0 && (
            <span className="ml-1 px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-amber-500 text-white">
              {stats.claimsPending} PENDING
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab("LOANS")}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition flex items-center gap-2 whitespace-nowrap relative cursor-pointer ${
            activeSubTab === "LOANS"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          Active Loans ({activeLoans.length})
          {stats.overdueLoansCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-rose-500 text-white animate-pulse">
              {stats.overdueLoansCount} OVERDUE
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab("WAREHOUSES")}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeSubTab === "WAREHOUSES"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold"
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
                  className={`px-2.5 py-1.5 rounded-md transition cursor-pointer ${
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
                  className={`px-2.5 py-1.5 rounded-md transition cursor-pointer ${
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
                  className={`px-2.5 py-1.5 rounded-md transition cursor-pointer ${
                    itemTypeFilter === "LOANERS"
                      ? "bg-white dark:bg-zinc-700 text-cyan-600 dark:text-cyan-400 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  }`}
                >
                  Loaners ({items.filter((i) => i.isLoaner).length})
                </button>
              </div>

              {/* Tracking Type (Serialized vs Bulk) */}
              <select
                value={selectedTrackingTypeFilter}
                onChange={(e) => setSelectedTrackingTypeFilter(e.target.value as any)}
                className="text-xs font-medium px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="ALL">All Formats</option>
                <option value="SERIALIZED">📦 Serialized</option>
                <option value="BULK">🔢 Bulk / Qty</option>
              </select>

              {/* Ownership Filter */}
              <select
                value={selectedOwnershipFilter}
                onChange={(e) => setSelectedOwnershipFilter(e.target.value as any)}
                className="text-xs font-medium px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="ALL">All Ownership</option>
                <option value="HQ_CONSIGNED">🏢 HQ Consigned / Central</option>
                <option value="PARTNER_OWNED">🤝 Partner Owned</option>
              </select>

              {/* Group / End-Customer Filter */}
              {allKnownGroups.length > 0 && (
                <select
                  value={selectedGroupFilter}
                  onChange={(e) => setSelectedGroupFilter(e.target.value)}
                  className="text-xs font-medium px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="ALL">All Groups / Clients</option>
                  {allKnownGroups.map((grp) => (
                    <option key={grp} value={grp}>
                      {grp}
                    </option>
                  ))}
                </select>
              )}

              <select
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                className="text-xs font-medium px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="ALL">All Warehouses</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.state}){w.partner ? ` [${w.partner.name}]` : ""}
                  </option>
                ))}
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="text-xs font-medium px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
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
                className="text-xs font-medium px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
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
                selectedOwnershipFilter !== "ALL" ||
                selectedStatus !== "ALL" ||
                selectedCategory !== "ALL" ||
                selectedGroupFilter !== "ALL" ||
                selectedTrackingTypeFilter !== "ALL" ||
                itemTypeFilter !== "ALL") && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedWarehouseId("ALL");
                    setSelectedOwnershipFilter("ALL");
                    setSelectedStatus("ALL");
                    setSelectedCategory("ALL");
                    setSelectedGroupFilter("ALL");
                    setSelectedTrackingTypeFilter("ALL");
                    setItemTypeFilter("ALL");
                  }}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline px-2 cursor-pointer"
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
                    <th className="py-3.5 px-4">Tracking & Stock</th>
                    <th className="py-3.5 px-4">Ownership</th>
                    <th className="py-3.5 px-4">Group / Client</th>
                    <th className="py-3.5 px-4">Warehouse</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Where-Used / Active Site</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-800 dark:text-zinc-200 font-normal">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-zinc-500 dark:text-zinc-400">
                        <Package className="w-8 h-8 mx-auto text-zinc-400 mb-2 opacity-50" />
                        No inventory items found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      const isBulk = item.trackingType === "BULK";
                      const latestAlloc = item.ticketAllocations?.[0];
                      const groupLabel = item.group || item.maincon?.name;
                      const isPartnerOwned = item.ownership === "PARTNER_OWNED";

                      return (
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

                          {/* Tracking & Stock Format */}
                          <td className="py-3.5 px-4">
                            {isBulk ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                  🔢 Bulk Stock
                                </span>
                                <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                                  {item.availableQuantity ?? item.quantity} / {item.quantity} available
                                </div>
                                {item.serialNumber && (
                                  <div className="text-[10px] font-mono text-zinc-400">
                                    Lot: {item.serialNumber}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                  📦 Serialized
                                </span>
                                <div className="font-mono font-medium text-zinc-900 dark:text-zinc-100">
                                  {item.serialNumber || "—"}
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Ownership Badge */}
                          <td className="py-3.5 px-4">
                            {isPartnerOwned ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                <Shield className="w-3 h-3" />
                                Partner Stock
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                <Building2 className="w-3 h-3" />
                                HQ Consigned
                              </span>
                            )}
                            {item.costPrice !== null && item.costPrice !== undefined && isSuperAdminOrModerator && (
                              <div className="text-[10px] text-zinc-400 mt-0.5">
                                RM {Number(item.costPrice).toFixed(2)}
                              </div>
                            )}
                          </td>

                          {/* Group / Client */}
                          <td className="py-3.5 px-4">
                            {groupLabel ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                {groupLabel}
                              </span>
                            ) : (
                              <span className="text-[11px] text-zinc-400 italic">General Pool</span>
                            )}
                          </td>

                          {/* Warehouse */}
                          <td className="py-3.5 px-4">
                            <div className="font-medium text-zinc-800 dark:text-zinc-200">
                              {item.warehouse?.name || "Unassigned"}
                            </div>
                            <div className="text-[11px] text-zinc-400">{item.warehouse?.state}</div>
                          </td>

                          {/* Status Badge */}
                          <td className="py-3.5 px-4">{getStatusBadge(item.status)}</td>

                          {/* Where-Used / Site History Traceability */}
                          <td className="py-3.5 px-4">
                            {latestAlloc?.ticket ? (
                              <button
                                type="button"
                                onClick={() => onOpenTicket?.(latestAlloc.ticket!.id)}
                                className="text-left group/t hover:underline cursor-pointer block"
                              >
                                <div className="font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 text-[11px]">
                                  <span>#{latestAlloc.ticket.ticketRefNo || `TKT-${latestAlloc.ticket.id}`}</span>
                                  <ExternalLink className="w-3 h-3 opacity-0 group-hover/t:opacity-100 transition" />
                                </div>
                                <div className="text-[11px] text-zinc-700 dark:text-zinc-300 truncate max-w-[140px]">
                                  {latestAlloc.ticket.clientSiteName}
                                </div>
                                {latestAlloc.ticket.endCustomer && (
                                  <div className="text-[10px] text-zinc-400">
                                    {latestAlloc.ticket.endCustomer} ({latestAlloc.ticket.state || ""})
                                  </div>
                                )}
                              </button>
                            ) : item.status === "AVAILABLE" ? (
                              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                In Warehouse
                              </span>
                            ) : (
                              <span className="text-[11px] text-zinc-400 italic">—</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isSuperAdminOrModerator && item.isLoaner && item.status === "AVAILABLE" && (
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
                                  className="px-2 py-1 bg-cyan-50 dark:bg-cyan-950/60 hover:bg-cyan-100 dark:hover:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300 rounded text-xs font-semibold transition border border-cyan-200 dark:border-cyan-800 flex items-center gap-1 cursor-pointer"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  Deploy
                                </button>
                              )}
                              <button
                                title="View Activity Logs"
                                onClick={() => setViewingLogsItem(item)}
                                className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                              >
                                <History className="w-4 h-4" />
                              </button>
                              {isSuperAdminOrModerator && (
                                <>
                                  <button
                                    title="Edit Item"
                                    onClick={() => {
                                      setEditingItem(item);
                                      setItemForm({
                                        name: item.name,
                                        partNumber: item.partNumber || "",
                                        category: item.category,
                                        serialNumber: item.serialNumber || "",
                                        trackingType: item.trackingType || "SERIALIZED",
                                        ownership: (item.ownership as any) || "HQ_CONSIGNED",
                                        quantity: item.quantity || 1,
                                        costPrice: item.costPrice || "",
                                        group: item.group || item.maincon?.name || "",
                                        warehouseId: String(item.warehouseId),
                                        status: item.status,
                                        isLoaner: !!item.isLoaner,
                                        supplier: item.supplier || "",
                                        notes: item.notes || "",
                                      });
                                      setIsAddItemOpen(true);
                                    }}
                                    className="p-1.5 text-zinc-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  {item.status !== "INSTALLED" && item.status !== "ON_LOAN" && (
                                    <button
                                      title="Delete Item"
                                      onClick={() => handleDeleteItem(item.id)}
                                      className="p-1.5 text-zinc-400 hover:text-rose-600 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </>
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

      {/* TAB 2: PENDING PARTS DISPATCH QUEUE */}
      {activeSubTab === "DISPATCH" && (
        <div className="space-y-4">
          {/* Header Banner & Batch Dispatch Action */}
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  Tickets Waiting for Spare Parts / Loaner Hardware
                </h3>
                <p className="text-xs text-amber-700 dark:text-amber-300/90 mt-0.5">
                  Approve field part requests, allocate stock from warehouses, or dispatch multiple bundled parts under a common courier tracking number.
                </p>
              </div>
            </div>

            {isSuperAdminOrModerator && (
              <button
                onClick={() => {
                  setBatchTicketId("");
                  setBatchSelectedItems([]);
                  setBatchCourierName("");
                  setBatchTrackingNo("");
                  setBatchNotes("");
                  setBatchItemSearch("");
                  setIsBatchDispatchOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition shrink-0 cursor-pointer shadow-indigo-500/20"
              >
                <Boxes className="w-4 h-4" />
                📦 Multi-Part Batch Dispatch
              </button>
            )}
          </div>

          {/* Status Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700/60">
            {[
              { id: "ALL", label: "All Requests", count: pendingTickets.length },
              { id: "PENDING_APPROVAL", label: "⏳ Pending Approval", count: stats.pendingApprovalCount },
              { id: "APPROVED", label: "✅ Approved / Ready", count: stats.approvedCount },
              { id: "DISPATCHED", label: "🚚 Dispatched", count: stats.dispatchedCount },
              { id: "INSTALLED", label: "🛠️ Installed", count: stats.installedCount },
              { id: "REJECTED_CANCELLED", label: "❌ Rejected / Cancelled", count: null },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDispatchStatusFilter(tab.id as any)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  dispatchStatusFilter === tab.id
                    ? "bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      dispatchStatusFilter === tab.id
                        ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                        : "bg-zinc-200 text-zinc-700 dark:bg-zinc-600 dark:text-zinc-300"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {pendingTickets
            .filter((ticket) => {
              if (dispatchStatusFilter === "ALL") return true;
              if (!ticket.spareParts || ticket.spareParts.length === 0) {
                return dispatchStatusFilter === "PENDING_APPROVAL" || dispatchStatusFilter === "APPROVED";
              }
              return ticket.spareParts.some((sp) => {
                if (dispatchStatusFilter === "PENDING_APPROVAL") return sp.status === "PENDING_APPROVAL";
                if (dispatchStatusFilter === "APPROVED") return sp.status === "APPROVED" || sp.status === "REQUESTED" || sp.status === "ALLOCATED";
                if (dispatchStatusFilter === "DISPATCHED") return sp.status === "DISPATCHED" || sp.status === "ON_LOAN" || sp.status === "RETURN_IN_TRANSIT";
                if (dispatchStatusFilter === "INSTALLED") return sp.status === "INSTALLED" || sp.status === "RETURNED";
                if (dispatchStatusFilter === "REJECTED_CANCELLED") return sp.status === "REJECTED" || sp.status === "CANCELLED";
                return true;
              });
            })
            .length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-12 text-center text-zinc-500">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-3 opacity-80" />
              <h4 className="text-base font-semibold text-zinc-900 dark:text-white">No requests found</h4>
              <p className="text-xs text-zinc-400 mt-1">There are no spare part requests matching your current status filter.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingTickets
                .filter((ticket) => {
                  if (dispatchStatusFilter === "ALL") return true;
                  if (!ticket.spareParts || ticket.spareParts.length === 0) {
                    return dispatchStatusFilter === "PENDING_APPROVAL" || dispatchStatusFilter === "APPROVED";
                  }
                  return ticket.spareParts.some((sp) => {
                    if (dispatchStatusFilter === "PENDING_APPROVAL") return sp.status === "PENDING_APPROVAL";
                    if (dispatchStatusFilter === "APPROVED") return sp.status === "APPROVED" || sp.status === "REQUESTED" || sp.status === "ALLOCATED";
                    if (dispatchStatusFilter === "DISPATCHED") return sp.status === "DISPATCHED" || sp.status === "ON_LOAN" || sp.status === "RETURN_IN_TRANSIT";
                    if (dispatchStatusFilter === "INSTALLED") return sp.status === "INSTALLED" || sp.status === "RETURNED";
                    if (dispatchStatusFilter === "REJECTED_CANCELLED") return sp.status === "REJECTED" || sp.status === "CANCELLED";
                    return true;
                  });
                })
                .map((ticket) => (
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
                          className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 inline-flex items-center gap-1 px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition cursor-pointer"
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
                          {isSuperAdminOrModerator && (
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
                              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold cursor-pointer"
                            >
                              Allocate Part Now
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {ticket.spareParts.map((sp) => (
                            <div
                              key={sp.id}
                              className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-700/80 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div>
                                <div className="font-semibold text-xs text-zinc-900 dark:text-white flex flex-wrap items-center gap-2">
                                  <span>{sp.requestedPartName}</span>
                                  <span className="text-zinc-400 text-[11px]">(Qty: {sp.quantity})</span>

                                  {/* Status Badges */}
                                  {sp.status === "PENDING_APPROVAL" && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      Pending Approval
                                    </span>
                                  )}
                                  {(sp.status === "APPROVED" || sp.status === "REQUESTED") && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" />
                                      Approved / Ready to Dispatch
                                    </span>
                                  )}
                                  {sp.status === "DISPATCHED" && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 flex items-center gap-1">
                                      <Truck className="w-3 h-3" />
                                      Dispatched / In Transit
                                    </span>
                                  )}
                                  {sp.status === "INSTALLED" && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" />
                                      Installed on Site
                                    </span>
                                  )}
                                  {sp.status === "REJECTED" && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800 flex items-center gap-1">
                                      <XCircle className="w-3 h-3" />
                                      Rejected
                                    </span>
                                  )}
                                  {sp.status === "CANCELLED" && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
                                      Cancelled
                                    </span>
                                  )}
                                </div>

                                {/* Request & Approval Metadata */}
                                {sp.requestedBy && (
                                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                    Requested by: <strong className="text-zinc-700 dark:text-zinc-300">{sp.requestedBy}</strong>
                                  </div>
                                )}
                                {sp.approvedBy && (
                                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                                    Approved by: <strong>{sp.approvedBy}</strong>
                                    {sp.approvedAt && ` on ${new Date(sp.approvedAt).toLocaleDateString("en-MY")}`}
                                  </div>
                                )}
                                {sp.rejectionReason && (
                                  <div className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5 font-medium">
                                    Rejection reason: <span>{sp.rejectionReason}</span>
                                  </div>
                                )}

                                {sp.inventoryItem && (
                                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 flex flex-wrap gap-x-3">
                                    <span>Allocated: <strong>{sp.inventoryItem.name}</strong></span>
                                    <span>S/N: <strong className="font-mono">{sp.inventoryItem.serialNumber}</strong></span>
                                    <span>Warehouse: <strong>{sp.inventoryItem.warehouse?.name}</strong></span>
                                  </div>
                                )}

                                {(sp.dispatchTrackingNo || sp.batchTrackingNo) && (
                                  <div className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 flex items-center gap-1">
                                    <Truck className="w-3.5 h-3.5" />
                                    <span>
                                      {sp.courierName ? `${sp.courierName}: ` : "Tracking: "}
                                      <strong className="font-mono">{sp.dispatchTrackingNo || sp.batchTrackingNo}</strong>
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
                                {/* Pending Approval Action Buttons */}
                                {sp.status === "PENDING_APPROVAL" && isSuperAdminOrModerator && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleApproveRequest(sp.id)}
                                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold inline-flex items-center gap-1 shadow-sm transition cursor-pointer"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      Approve
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRejectingPart({ id: sp.id, name: sp.requestedPartName });
                                        setIsRejectModalOpen(true);
                                      }}
                                      className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 dark:text-rose-300 rounded text-xs font-semibold inline-flex items-center gap-1 border border-rose-200 dark:border-rose-800 transition cursor-pointer"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                      Reject
                                    </button>
                                  </>
                                )}

                                {/* Approved / Requested Action Buttons */}
                                {(sp.status === "APPROVED" || sp.status === "REQUESTED") && isSuperAdminOrModerator && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDispatchModalData({ ticket, partRequest: sp });
                                      }}
                                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                                    >
                                      <Send className="w-3.5 h-3.5" />
                                      Allocate & Dispatch
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleCancelRequest(sp.id)}
                                      className="px-2.5 py-1.5 text-zinc-500 hover:text-rose-600 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded text-xs transition cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  </>
                                )}

                                {sp.status === "DISPATCHED" && isSuperAdminOrModerator && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDispatchModalData({ ticket, partRequest: sp });
                                      setDispatchCourierName(sp.courierName || "");
                                      setDispatchTrackingNo(sp.dispatchTrackingNo || sp.batchTrackingNo || "");
                                      if (sp.inventoryItemId) setDispatchSelectedItemId(String(sp.inventoryItemId));
                                    }}
                                    className="px-2.5 py-1 text-xs text-zinc-600 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-600 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer"
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

      {/* TAB: BUFFER STOCK TRANSFERS */}
      {activeSubTab === "TRANSFERS" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="flex items-center gap-3">
              <ArrowRightLeft className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Warehouse Buffer Stock Transfers</h2>
                <p className="text-xs text-zinc-500">
                  Track batch hardware shipments from Central HQ Warehouses to Regional Partner Buffer Hubs.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchTransfers}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 transition flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh Transfers
              </button>
            </div>
          </div>

          {transfers.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm space-y-3">
              <ArrowRightLeft className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto" />
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">No buffer stock transfers</h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                No inter-warehouse transfers recorded yet. Superadmins and Moderators can initiate a buffer replenishment to regional partner hubs.
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-semibold uppercase tracking-wider text-[11px]">
                    <tr className="divide-x divide-zinc-200/40 dark:divide-zinc-800/40">
                      <th className="py-3.5 px-4">Transfer Details</th>
                      <th className="py-3.5 px-4">Route (Origin → Destination)</th>
                      <th className="py-3.5 px-4">Items Transferred</th>
                      <th className="py-3.5 px-4">Logistics & Tracking</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-800 dark:text-zinc-200">
                    {transfers.map((t) => {
                      const isInTransit = t.status === "IN_TRANSIT";
                      return (
                        <tr key={t.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition">
                          <td className="py-3.5 px-4">
                            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              #TRF-{String(t.id).padStart(4, "0")}
                            </span>
                            <div className="text-[11px] text-zinc-400 mt-0.5">
                              {new Date(t.createdAt).toLocaleDateString("en-MY", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </div>
                            <div className="text-[10px] text-zinc-500">By: {t.transferredBy}</div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-white">
                                <Building2 className="w-3.5 h-3.5 text-zinc-400" />
                                <span>{t.sourceWarehouse?.name || `Warehouse #${t.sourceWarehouseId}`}</span>
                                <span className="text-[10px] text-zinc-400 font-normal">({t.sourceWarehouse?.state})</span>
                              </div>
                              <div className="flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 font-bold pl-5">
                                <ArrowRight className="w-3 h-3" />
                                <span>{t.destinationWarehouse?.name || `Warehouse #${t.destinationWarehouseId}`}</span>
                                {t.destinationWarehouse?.partner && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-medium ml-1">
                                    {t.destinationWarehouse.partner.name}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="space-y-1">
                              {t.items && t.items.length > 0 ? (
                                t.items.map((it) => (
                                  <div key={it.id} className="text-xs flex items-center justify-between gap-3">
                                    <span className="font-medium text-zinc-900 dark:text-white">
                                      {it.inventoryItem?.name || `Item #${it.inventoryItemId}`}
                                    </span>
                                    <span className="font-bold text-zinc-600 dark:text-zinc-300 font-mono">
                                      x{it.quantity}
                                    </span>
                                  </div>
                                ))
                              ) : (
                                <span className="text-zinc-400 italic">No item records</span>
                              )}
                              {t.notes && <p className="text-[10px] text-zinc-400 italic">Note: {t.notes}</p>}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            {t.trackingNo ? (
                              <div className="space-y-0.5">
                                <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                  {t.courierName || "Courier"}
                                </div>
                                <div className="font-mono text-[11px] text-blue-600 dark:text-blue-400 font-bold">
                                  {t.trackingNo}
                                </div>
                              </div>
                            ) : (
                              <span className="text-zinc-400 text-xs italic">Internal / Hand Delivery</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            {isInTransit ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 dark:border-blue-800 animate-pulse">
                                <Truck className="w-3.5 h-3.5" />
                                In Transit
                              </span>
                            ) : t.status === "RECEIVED" ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Received & Restocked
                                </span>
                                {t.receivedBy && (
                                  <div className="text-[10px] text-zinc-400">
                                    By: {t.receivedBy} {t.receivedAt && `(${new Date(t.receivedAt).toLocaleDateString("en-MY")})`}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                                Cancelled
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            {isInTransit && (
                              <button
                                type="button"
                                onClick={() => handleReceiveTransfer(t.id)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-sm transition inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Receive & Restock
                              </button>
                            )}
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

      {/* TAB: PART REPLACEMENT CLAIMS */}
      {activeSubTab === "CLAIMS" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="flex items-center gap-3">
              <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Part Replacement & Reimbursement Claims</h2>
                <p className="text-xs text-zinc-500">
                  Manage partner claims for hardware replaced on customer tickets. Authorize HQ hardware replenishment or financial reimbursement.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchClaims}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 transition flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh Claims
              </button>
            </div>
          </div>

          {claims.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm space-y-3">
              <DollarSign className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto" />
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">No replacement claims submitted</h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                When partners use their own hardware buffers to service tickets, they can submit replacement claims here for HQ review and settlement.
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-semibold uppercase tracking-wider text-[11px]">
                    <tr className="divide-x divide-zinc-200/40 dark:divide-zinc-800/40">
                      <th className="py-3.5 px-4">Claim ID & Date</th>
                      <th className="py-3.5 px-4">Ticket & Site Reference</th>
                      <th className="py-3.5 px-4">Service Partner</th>
                      <th className="py-3.5 px-4">Part Details & Defective S/N</th>
                      <th className="py-3.5 px-4">Claim Amount</th>
                      <th className="py-3.5 px-4">Status & Settlement</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-800 dark:text-zinc-200">
                    {claims.map((c) => {
                      const isPendingClaim = c.status === "PENDING";
                      return (
                        <tr key={c.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition">
                          <td className="py-3.5 px-4">
                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              #CLM-{String(c.id).padStart(4, "0")}
                            </span>
                            <div className="text-[11px] text-zinc-400 mt-0.5">
                              {new Date(c.createdAt).toLocaleDateString("en-MY", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </div>
                            <div className="text-[10px] text-zinc-500">By: {c.requestedBy}</div>
                          </td>

                          <td className="py-3.5 px-4">
                            {c.ticket ? (
                              <button
                                type="button"
                                onClick={() => onOpenTicket?.(c.ticketId)}
                                className="text-left group/t hover:underline cursor-pointer block"
                              >
                                <div className="font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 text-xs">
                                  <span>#{c.ticket.ticketRefNo || `TKT-${c.ticket.id}`}</span>
                                  <ExternalLink className="w-3 h-3 opacity-0 group-hover/t:opacity-100 transition" />
                                </div>
                                <div className="text-zinc-900 dark:text-white font-medium text-xs">
                                  {c.ticket.clientSiteName}
                                </div>
                                <div className="text-[10px] text-zinc-400">{c.ticket.state}</div>
                              </button>
                            ) : (
                              <span className="font-mono font-semibold">Ticket #{c.ticketId}</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                              <Shield className="w-3 h-3 text-indigo-500" />
                              {c.partner?.name || `Partner #${c.partnerId}`}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="space-y-0.5">
                              <div className="font-semibold text-zinc-900 dark:text-white">{c.partName}</div>
                              {c.serialNumber && (
                                <div className="text-[11px] text-zinc-500 font-mono">
                                  New S/N: <strong>{c.serialNumber}</strong>
                                </div>
                              )}
                              {c.defectiveSerial && (
                                <div className="text-[11px] text-rose-600 dark:text-rose-400 font-mono">
                                  Defective S/N: <strong>{c.defectiveSerial}</strong>
                                </div>
                              )}
                              {c.notes && <p className="text-[10px] text-zinc-400 italic">Note: {c.notes}</p>}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            {c.claimAmount ? (
                              <span className="font-bold text-zinc-900 dark:text-white font-mono text-xs">
                                RM {Number(c.claimAmount).toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-zinc-400 text-xs italic">Hardware only</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            {isPendingClaim ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                <Clock className="w-3.5 h-3.5" />
                                Pending Review
                              </span>
                            ) : c.status === "APPROVED_REPLENISH" ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
                                  <Package className="w-3.5 h-3.5" />
                                  Approved (Replenish)
                                </span>
                                {c.approvedBy && (
                                  <div className="text-[10px] text-zinc-400">
                                    By: {c.approvedBy} {c.approvedAt && `(${new Date(c.approvedAt).toLocaleDateString("en-MY")})`}
                                  </div>
                                )}
                              </div>
                            ) : c.status === "APPROVED_REIMBURSE" ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                  <DollarSign className="w-3.5 h-3.5" />
                                  Approved (Reimburse)
                                </span>
                                {c.approvedBy && (
                                  <div className="text-[10px] text-zinc-400">
                                    By: {c.approvedBy} {c.approvedAt && `(${new Date(c.approvedAt).toLocaleDateString("en-MY")})`}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                                  <XCircle className="w-3.5 h-3.5" />
                                  Rejected
                                </span>
                                {c.rejectionReason && (
                                  <p className="text-[10px] text-rose-500 italic max-w-xs">{c.rejectionReason}</p>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            {isPendingClaim && isSuperAdminOrModerator && (
                              <button
                                type="button"
                                onClick={() => {
                                  setReviewingClaim(c);
                                  setClaimResolutionType("REPLENISH");
                                  setClaimReplacementItemId("");
                                  setClaimRejectReason("");
                                  setClaimNotes("");
                                }}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold shadow-sm transition inline-flex items-center gap-1 cursor-pointer"
                              >
                                <ClipboardCheck className="w-3.5 h-3.5" />
                                Review Claim
                              </button>
                            )}
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
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Regional Warehouses & Buffer Hubs</h2>
                <p className="text-xs text-zinc-500">
                  {isSuperAdminOrModerator
                    ? "Manage central HQ storage locations and assign regional depots to Service Partners."
                    : "Manage and register your company's regional warehouse locations and buffer depots."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingWarehouse(null);
                  setWarehouseForm({
                    name: "",
                    state: "Selangor",
                    address: "",
                    contactPerson: "",
                    contactPhone: "",
                    partnerId: "",
                  });
                  setIsAddWarehouseOpen(true);
                }}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                {isSuperAdminOrModerator ? "Add Warehouse / Depot" : "Register Local Depot"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {warehouses.map((w) => {
              const canEditWh = isSuperAdminOrModerator || (isAgent && w.partnerId === user?.partnerId);
              return (
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

                  {canEditWh && (
                    <div className="flex items-center gap-1">
                      <button
                        title="Edit Warehouse"
                        onClick={() => {
                          setEditingWarehouse(w);
                          setWarehouseForm({
                            name: w.name,
                            state: w.state,
                            address: w.address || "",
                            contactPerson: w.contactPerson || "",
                            contactPhone: w.contactPhone || "",
                            partnerId: w.partnerId ? String(w.partnerId) : "",
                          });
                          setIsAddWarehouseOpen(true);
                        }}
                        className="p-1.5 text-zinc-400 hover:text-indigo-600 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        title="Delete Warehouse"
                        onClick={() => handleDeleteWarehouse(w.id)}
                        className="p-1.5 text-zinc-400 hover:text-rose-600 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Partner Affiliation Tag */}
                <div className="pt-1">
                  {w.partner ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      <Shield className="w-3 h-3" />
                      Partner Hub: {w.partner.name}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      <Building2 className="w-3 h-3" />
                      HQ Central Warehouse
                    </span>
                  )}
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
            );
            })}
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
              {/* Tracking Format Selector */}
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Item Tracking Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setItemForm({ ...itemForm, trackingType: "SERIALIZED" })}
                    className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition cursor-pointer ${
                      itemForm.trackingType === "SERIALIZED"
                        ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-500/20"
                        : "border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    <div className="font-bold">
                      <div className="flex items-center gap-1.5">
                        <span>📦 Serialized Unit</span>
                      </div>
                      <p className="text-[10px] font-normal text-muted-text mt-0.5">
                        Single unique asset (e.g. PC, Switch, Screen) with S/N.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setItemForm({ ...itemForm, trackingType: "BULK" })}
                    className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition cursor-pointer ${
                      itemForm.trackingType === "BULK"
                        ? "border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20"
                        : "border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    <div className="font-bold">
                      <div className="flex items-center gap-1.5">
                        <span>🔢 Bulk / Consumable</span>
                      </div>
                      <p className="text-[10px] font-normal text-muted-text mt-0.5">
                        Multi-quantity parts (e.g. 10 Rollers, Keyboards, Cables).
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Item / Part Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HP Printer Feed Roller Kit / USB Keyboard"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {itemForm.trackingType === "SERIALIZED" ? (
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
                ) : (
                  <div>
                    <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Stock Quantity *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      placeholder="e.g. 10"
                      value={itemForm.quantity}
                      onChange={(e) => setItemForm({ ...itemForm, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="w-full font-semibold px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                    />
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Part Number / SKU
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 500W-HP-GOLD / RL-HP-M402"
                    value={itemForm.partNumber}
                    onChange={(e) => setItemForm({ ...itemForm, partNumber: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Group / Client Scope */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center justify-between">
                    <span>Group / Client Scope</span>
                    {itemForm.group && (
                      <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
                        Selected: {itemForm.group}
                      </span>
                    )}
                  </label>
                  <select
                    value={itemForm.group}
                    onChange={(e) => setItemForm({ ...itemForm, group: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white cursor-pointer"
                  >
                    <option value="">General Pool (No group restriction)</option>
                    {endCustomerGroups.length > 0 && (
                      <optgroup label="🏢 End-Customers / Project Groups">
                        {endCustomerGroups.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {clientGroups.length > 0 && (
                      <optgroup label="💼 Registered Clients">
                        {clientGroups.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>

                  {/* Quick-select pills */}
                  {allKnownGroups.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 mt-1.5">
                      <span className="text-[10px] text-zinc-400">Quick tag:</span>
                      {allKnownGroups.slice(0, 5).map((grp) => (
                        <button
                          key={grp}
                          type="button"
                          onClick={() => setItemForm({ ...itemForm, group: grp })}
                          className={`text-[10px] px-1.5 py-0.5 rounded border transition cursor-pointer ${
                            itemForm.group === grp
                              ? "bg-indigo-600 text-white border-indigo-600 font-bold"
                              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-indigo-400"
                          }`}
                        >
                          {grp}
                        </button>
                      ))}
                      {itemForm.group && (
                        <button
                          type="button"
                          onClick={() => setItemForm({ ...itemForm, group: "" })}
                          className="text-[10px] text-rose-500 hover:underline ml-1 cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    {itemForm.trackingType === "BULK" ? "Lot / Batch No (Optional)" : "Optional Alias / Tag"}
                  </label>
                  <input
                    type="text"
                    placeholder={itemForm.trackingType === "BULK" ? "e.g. LOT-2026-Q1" : "e.g. TAG-001"}
                    value={itemForm.trackingType === "BULK" ? itemForm.serialNumber : ""}
                    onChange={(e) => {
                      if (itemForm.trackingType === "BULK") {
                        setItemForm({ ...itemForm, serialNumber: e.target.value });
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  />
                  {itemForm.trackingType === "BULK" && (
                    <p className="text-[10px] text-zinc-400 mt-1">
                      Bulk consumable parts are tracked by quantity without needing unique serial numbers.
                    </p>
                  )}
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

              {/* Ownership & Cost Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Stock Ownership Model *
                  </label>
                  {isAgent ? (
                    <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 font-bold flex items-center gap-1.5">
                      <Shield className="w-4 h-4" />
                      Partner-Owned Local Stock
                    </div>
                  ) : (
                    <select
                      value={itemForm.ownership}
                      onChange={(e) => setItemForm({ ...itemForm, ownership: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium"
                    >
                      <option value="HQ_CONSIGNED">🏢 HQ Consigned / Central Stock</option>
                      <option value="PARTNER_OWNED">🤝 Partner Owned Stock</option>
                    </select>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Cost Price (RM)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="e.g. 150.00"
                    value={itemForm.costPrice}
                    onChange={(e) => setItemForm({ ...itemForm, costPrice: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  />
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

      {/* MODAL: Initiate Buffer Stock Transfer */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 my-8 animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3 shrink-0">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
                  Initiate Warehouse Buffer Transfer
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Ship hardware consignment batches from HQ to regional partner warehouses.
                </p>
              </div>
              <button
                onClick={() => {
                  setIsTransferModalOpen(false);
                  setTransferSelectedItems([]);
                }}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleInitiateTransferSubmit} className="space-y-4 text-xs flex-1 overflow-y-auto pr-1">
              {/* Route Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-zinc-50 dark:bg-zinc-800/40 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700/60">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Source Warehouse (Origin) *
                  </label>
                  <select
                    required
                    value={transferSourceWhId}
                    onChange={(e) => {
                      setTransferSourceWhId(e.target.value);
                      setTransferSelectedItems([]);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium"
                  >
                    <option value="">-- Choose Origin Hub --</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.state}){w.partner ? ` [${w.partner.name}]` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Destination Warehouse (Partner Buffer) *
                  </label>
                  <select
                    required
                    value={transferDestWhId}
                    onChange={(e) => setTransferDestWhId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium"
                  >
                    <option value="">-- Choose Destination Hub --</option>
                    {warehouses
                      .filter((w) => String(w.id) !== transferSourceWhId)
                      .map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.state}){w.partner ? ` [${w.partner.name}]` : ""}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Items Picker from Source Warehouse */}
              {transferSourceWhId ? (
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 bg-zinc-50/50 dark:bg-zinc-800/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <Search className="w-3.5 h-3.5 text-indigo-600" />
                      Pick Stock to Transfer from Source Hub
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      {
                        items.filter(
                          (i) => String(i.warehouseId) === transferSourceWhId && i.status === "AVAILABLE"
                        ).length
                      }{" "}
                      available items
                    </span>
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Filter available stock in source hub..."
                      value={transferItemSearch}
                      onChange={(e) => setTransferItemSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                    />
                  </div>

                  <div className="max-h-36 overflow-y-auto space-y-1.5 divide-y divide-zinc-200/50 dark:divide-zinc-800">
                    {items
                      .filter(
                        (i) =>
                          String(i.warehouseId) === transferSourceWhId &&
                          i.status === "AVAILABLE" &&
                          (!transferItemSearch.trim() ||
                            i.name.toLowerCase().includes(transferItemSearch.toLowerCase()) ||
                            (i.serialNumber && i.serialNumber.toLowerCase().includes(transferItemSearch.toLowerCase())) ||
                            (i.partNumber && i.partNumber.toLowerCase().includes(transferItemSearch.toLowerCase())))
                      )
                      .slice(0, 10)
                      .map((item) => {
                        const isAdded = transferSelectedItems.some((t) => t.inventoryItemId === item.id);
                        return (
                          <div
                            key={item.id}
                            className="pt-1.5 first:pt-0 flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="min-w-0">
                              <span className="font-semibold text-zinc-900 dark:text-white">{item.name}</span>
                              <span className="text-zinc-400 text-[11px] ml-2">
                                {item.trackingType === "BULK"
                                  ? `Bulk (${item.availableQuantity ?? item.quantity} avail)`
                                  : `S/N: ${item.serialNumber || "—"}`}
                              </span>
                            </div>
                            <button
                              type="button"
                              disabled={isAdded}
                              onClick={() => handleAddItemToTransfer(item)}
                              className={`px-2.5 py-1 rounded text-xs font-semibold shrink-0 transition ${
                                isAdded
                                  ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-400 cursor-not-allowed"
                                  : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm cursor-pointer"
                              }`}
                            >
                              {isAdded ? "Added ✓" : "+ Transfer"}
                            </button>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-zinc-400 italic p-3 bg-zinc-50 dark:bg-zinc-800/30 rounded-lg">
                  Please choose a Source Warehouse to pick items for transfer.
                </p>
              )}

              {/* Selected Transfer Items Cart */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-zinc-900 dark:text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Boxes className="w-4 h-4 text-indigo-600" />
                    Items in Transfer Consignment ({transferSelectedItems.length})
                  </h4>
                </div>

                {transferSelectedItems.length === 0 ? (
                  <div className="p-4 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-400 text-xs">
                    No items added yet. Pick available parts above.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {transferSelectedItems.map((t, idx) => (
                      <div
                        key={t.inventoryItemId}
                        className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="font-bold text-zinc-900 dark:text-white text-xs">{t.item.name}</div>
                          <div className="text-[11px] text-zinc-500 font-mono">
                            {t.item.trackingType === "BULK" ? "Bulk Quantity" : `S/N: ${t.item.serialNumber || "—"}`}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {t.item.trackingType === "BULK" && (
                            <div className="flex items-center gap-1">
                              <span className="text-[11px] text-zinc-400">Qty:</span>
                              <input
                                type="number"
                                min={1}
                                max={t.item.availableQuantity ?? t.item.quantity ?? 1}
                                value={t.quantity}
                                onChange={(e) => handleUpdateTransferItemQty(idx, parseInt(e.target.value) || 1)}
                                className="w-16 px-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 text-xs font-bold text-center"
                              />
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveItemFromTransfer(idx)}
                            className="text-zinc-400 hover:text-rose-600 p-1 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Courier & Tracking */}
              <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Courier / Transporter Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. GDEX / PosLaju / Internal Fleet"
                      value={transferCourierName}
                      onChange={(e) => setTransferCourierName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Tracking / Consignment No
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. GDX99881122"
                      value={transferTrackingNo}
                      onChange={(e) => setTransferTrackingNo(e.target.value)}
                      className="w-full font-mono px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Transfer Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Q3 buffer replenishment for northern region..."
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !transferSourceWhId || !transferDestWhId || transferSelectedItems.length === 0}
                  className="px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  {isPending ? "Dispatching..." : `Dispatch ${transferSelectedItems.length} Item(s) Transfer`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Review / Settle Part Replacement Claim */}
      {reviewingClaim && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-indigo-600" />
                  Review Part Replacement Claim
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">Claim #CLM-{String(reviewingClaim.id).padStart(4, "0")}</p>
              </div>
              <button
                onClick={() => setReviewingClaim(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleReviewClaimSubmit} className="space-y-4 text-xs">
              {/* Claim Summary Card */}
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-zinc-900 dark:text-white text-xs">{reviewingClaim.partName}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {reviewingClaim.partner?.name}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-500 space-y-0.5">
                  <p>Ticket: <strong>#{reviewingClaim.ticket?.ticketRefNo || reviewingClaim.ticketId}</strong> - {reviewingClaim.ticket?.clientSiteName}</p>
                  {reviewingClaim.serialNumber && <p className="font-mono">Installed S/N: {reviewingClaim.serialNumber}</p>}
                  {reviewingClaim.defectiveSerial && <p className="font-mono text-rose-600">Defective S/N: {reviewingClaim.defectiveSerial}</p>}
                  {reviewingClaim.claimAmount && <p className="font-bold text-zinc-900 dark:text-white">Claim Cost: RM {Number(reviewingClaim.claimAmount).toFixed(2)}</p>}
                </div>
              </div>

              {/* Settlement Type Selector */}
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Settlement & Resolution Action *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setClaimResolutionType("REPLENISH")}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      claimResolutionType === "REPLENISH"
                        ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-500/20"
                        : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1">
                      <Package className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Replenish</span>
                    </div>
                    <p className="text-[10px] font-normal text-zinc-400 mt-0.5">Ship HQ Part</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setClaimResolutionType("REIMBURSE")}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      claimResolutionType === "REIMBURSE"
                        ? "border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20"
                        : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Reimburse</span>
                    </div>
                    <p className="text-[10px] font-normal text-zinc-400 mt-0.5">Invoice Credit</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setClaimResolutionType("REJECT")}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      claimResolutionType === "REJECT"
                        ? "border-rose-600 bg-rose-50/50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 ring-2 ring-rose-500/20"
                        : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span>Reject</span>
                    </div>
                    <p className="text-[10px] font-normal text-zinc-400 mt-0.5">Deny Claim</p>
                  </button>
                </div>
              </div>

              {/* Replenish Item Selector */}
              {claimResolutionType === "REPLENISH" && (
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Select Replacement Item from HQ Central Stock
                  </label>
                  <select
                    value={claimReplacementItemId}
                    onChange={(e) => setClaimReplacementItemId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  >
                    <option value="">-- Choose Stock Item to Ship --</option>
                    {items
                      .filter((i) => i.status === "AVAILABLE" && (i.ownership === "HQ_CONSIGNED" || !i.ownership))
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} | S/N: {item.serialNumber || "Bulk"} ({item.warehouse?.name})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Reject Reason */}
              {claimResolutionType === "REJECT" && (
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Rejection Reason *
                  </label>
                  <textarea
                    required
                    rows={2}
                    placeholder="e.g. Defective serial not verified on site, already claimed under warranty..."
                    value={claimRejectReason}
                    onChange={(e) => setClaimRejectReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Settlement Remarks / Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional internal remarks..."
                  value={claimNotes}
                  onChange={(e) => setClaimNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setReviewingClaim(null)}
                  className="px-4 py-2 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className={`px-5 py-2 rounded-lg text-white font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer ${
                    claimResolutionType === "REJECT"
                      ? "bg-rose-600 hover:bg-rose-700"
                      : "bg-indigo-600 hover:bg-indigo-700"
                  }`}
                >
                  {isPending ? "Processing..." : "Confirm Claim Settlement"}
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
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white cursor-pointer"
                >
                  <option value="">-- Choose Stock Item --</option>
                  {items
                    .filter((i) => {
                      const isAssigned = dispatchModalData?.partRequest?.inventoryItemId === i.id;
                      if (isAssigned) return true;
                      if (i.status !== "AVAILABLE") return false;
                      if (i.trackingType === "BULK") return (i.availableQuantity ?? i.quantity ?? 0) > 0;
                      return true;
                    })
                    .map((i) => {
                      const isBulk = i.trackingType === "BULK";
                      const groupTag = i.group || i.maincon?.name ? ` [${i.group || i.maincon?.name}]` : " [General Pool]";
                      const stockInfo = isBulk
                        ? `(Bulk: ${i.availableQuantity ?? i.quantity} avail)`
                        : `S/N: ${i.serialNumber || "N/A"}`;

                      return (
                        <option key={i.id} value={i.id}>
                          {i.name}{groupTag} | {stockInfo} ({i.warehouse.name})
                        </option>
                      );
                    })}
                </select>
                {items.filter(
                  (i) =>
                    i.id === dispatchModalData?.partRequest?.inventoryItemId ||
                    (i.status === "AVAILABLE" && (i.trackingType !== "BULK" || (i.availableQuantity ?? i.quantity ?? 0) > 0))
                ).length === 0 && (
                  <p className="text-[11px] text-rose-500 mt-1">
                    No items currently in AVAILABLE status or with remaining bulk stock.
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

              {/* Partner Assignment / Linking Field */}
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Partner Assignment & Hub Ownership
                </label>
                {isSuperAdminOrModerator ? (
                  <select
                    value={warehouseForm.partnerId || ""}
                    onChange={(e) => setWarehouseForm({ ...warehouseForm, partnerId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  >
                    <option value="">🏢 HQ Central Warehouse (Maincon / Central Consigned)</option>
                    {servicePartners.map((p) => (
                      <option key={p.id} value={p.id}>
                        🤝 Regional Partner: {p.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Scoped to your Partner Organization (Auto-linked)</span>
                  </div>
                )}
                <p className="text-[10px] text-zinc-400 mt-1">
                  {isSuperAdminOrModerator
                    ? "Link to a regional Service Partner to grant their agents access to this warehouse depot, or leave unassigned for central HQ."
                    : "This depot is automatically registered under your company's regional profile."}
                </p>
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

      {/* MODAL: Reject Spare Part Request */}
      {isRejectModalOpen && rejectingPart && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-600" />
                Reject Spare Part Request
              </h3>
              <button
                onClick={() => {
                  setIsRejectModalOpen(false);
                  setRejectingPart(null);
                  setRejectReason("");
                }}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRejectRequestSubmit} className="space-y-3.5 text-xs">
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 space-y-1">
                <span className="text-rose-500 font-bold uppercase text-[10px] block">Part Request</span>
                <p className="font-bold text-zinc-900 dark:text-white text-sm">{rejectingPart.name}</p>
                <p className="text-zinc-500 text-[11px]">Request ID: #{rejectingPart.id}</p>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Reason for Rejection *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Out of stock in all regional hubs, alternative fix available on site, duplicate request..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsRejectModalOpen(false);
                    setRejectingPart(null);
                    setRejectReason("");
                  }}
                  className="px-4 py-2 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !rejectReason.trim()}
                  className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? "Rejecting..." : "Confirm Rejection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Multi-Part Batch Dispatch */}
      {isBatchDispatchOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-5 my-8 animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3 shrink-0">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Boxes className="w-5 h-5 text-indigo-600" />
                  Multi-Part Batch Allocation & Dispatch
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Bundle multiple spare parts and standby loaners into one shipment under a single courier tracking number.
                </p>
              </div>
              <button
                onClick={() => {
                  setIsBatchDispatchOpen(false);
                  setBatchSelectedItems([]);
                }}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleBatchDispatchSubmit} className="space-y-4 text-xs flex-1 overflow-y-auto pr-1">
              {/* Target Ticket Selector */}
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Destination Ticket *
                </label>
                <select
                  required
                  value={batchTicketId}
                  onChange={(e) => {
                    const tid = e.target.value;
                    setBatchTicketId(tid);
                  }}
                  className="w-full px-3 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium"
                >
                  <option value="">-- Select Active Ticket --</option>
                  {pendingTickets.map((t) => (
                    <option key={t.id} value={t.id}>
                      #{t.ticketRefNo || t.id} | {t.clientSiteName} ({t.state}) — {t.partner?.name || "General"}
                    </option>
                  ))}
                </select>
              </div>

              {/* Hardware Search & Pick Section */}
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 bg-zinc-50/50 dark:bg-zinc-800/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 text-indigo-600" />
                    Pick Available Items from Stock
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    {items.filter((i) => i.status === "AVAILABLE").length} available items in inventory
                  </span>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search available parts by name, S/N, SKU, or warehouse..."
                    value={batchItemSearch}
                    onChange={(e) => setBatchItemSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  />
                </div>

                {/* Available Items List Picker */}
                <div className="max-h-40 overflow-y-auto space-y-1.5 divide-y divide-zinc-200/50 dark:divide-zinc-800">
                  {items
                    .filter(
                      (i) =>
                        i.status === "AVAILABLE" &&
                        (i.trackingType !== "BULK" || (i.availableQuantity ?? i.quantity ?? 0) > 0) &&
                        (!batchItemSearch.trim() ||
                          i.name.toLowerCase().includes(batchItemSearch.toLowerCase()) ||
                          (i.serialNumber && i.serialNumber.toLowerCase().includes(batchItemSearch.toLowerCase())) ||
                          (i.partNumber && i.partNumber.toLowerCase().includes(batchItemSearch.toLowerCase())) ||
                          i.warehouse?.name.toLowerCase().includes(batchItemSearch.toLowerCase()))
                    )
                    .slice(0, 10)
                    .map((item) => {
                      const isAlreadyInBatch = batchSelectedItems.some((b) => b.inventoryItemId === item.id);
                      return (
                        <div
                          key={item.id}
                          className="pt-1.5 first:pt-0 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0">
                            <span className="font-semibold text-zinc-900 dark:text-white">{item.name}</span>
                            <span className="text-zinc-400 text-[11px] ml-2">
                              {item.trackingType === "BULK" ? `Bulk (${item.availableQuantity ?? item.quantity} avail)` : `S/N: ${item.serialNumber || "—"}`}
                            </span>
                            <span className="text-indigo-600 dark:text-indigo-400 text-[10px] ml-2 font-medium">
                              @{item.warehouse?.name}
                            </span>
                          </div>
                          <button
                            type="button"
                            disabled={isAlreadyInBatch}
                            onClick={() => handleAddItemToBatch(item)}
                            className={`px-2.5 py-1 rounded text-xs font-semibold shrink-0 transition ${
                              isAlreadyInBatch
                                ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-400 cursor-not-allowed"
                                : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm cursor-pointer"
                            }`}
                          >
                            {isAlreadyInBatch ? "Added ✓" : "+ Add to Batch"}
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Batch Cart / Selected Items List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-zinc-900 dark:text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Boxes className="w-4 h-4 text-indigo-600" />
                    Selected Parts for this Dispatch ({batchSelectedItems.length})
                  </h4>
                  {batchSelectedItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setBatchSelectedItems([])}
                      className="text-[11px] text-rose-500 hover:underline cursor-pointer"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {batchSelectedItems.length === 0 ? (
                  <div className="p-6 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-400 text-xs">
                    No hardware items added to batch yet. Pick items from the search box above.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {batchSelectedItems.map((b, idx) => (
                      <div
                        key={b.inventoryItemId}
                        className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-zinc-900 dark:text-white text-xs flex items-center gap-2">
                              <span>{b.item.name}</span>
                              {b.isLoaner && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300">
                                  Standby Loaner
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                              S/N: {b.item.serialNumber || "—"} | Hub: {b.item.warehouse?.name}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveItemFromBatch(idx)}
                            className="text-zinc-400 hover:text-rose-600 p-1 cursor-pointer"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                          {b.item.trackingType === "BULK" && (
                            <div>
                              <label className="block text-[11px] font-medium text-zinc-500 mb-0.5">Quantity</label>
                              <input
                                type="number"
                                min={1}
                                max={b.item.availableQuantity ?? b.item.quantity ?? 1}
                                value={b.quantity}
                                onChange={(e) =>
                                  handleUpdateBatchItem(idx, { quantity: Math.max(1, parseInt(e.target.value) || 1) })
                                }
                                className="w-full px-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 text-zinc-900 dark:text-white text-xs"
                              />
                            </div>
                          )}

                          <div className="flex items-center gap-2 pt-4 sm:pt-3">
                            <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                              <input
                                type="checkbox"
                                checked={b.isLoaner}
                                onChange={(e) => handleUpdateBatchItem(idx, { isLoaner: e.target.checked })}
                                className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                              />
                              Deploy as Loaner
                            </label>
                          </div>

                          {b.isLoaner && (
                            <div>
                              <label className="block text-[11px] font-medium text-zinc-500 mb-0.5">Loan Days</label>
                              <input
                                type="number"
                                min={1}
                                max={90}
                                value={b.loanDurationDays}
                                onChange={(e) =>
                                  handleUpdateBatchItem(idx, { loanDurationDays: parseInt(e.target.value) || 14 })
                                }
                                className="w-full px-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 text-zinc-900 dark:text-white text-xs font-bold"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Shared Consignment & Courier Details */}
              <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3 space-y-3">
                <h4 className="font-bold text-zinc-900 dark:text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-indigo-600" />
                  Common Shipment & Courier Information
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Courier / Transporter Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. J&T Express / PosLaju / Grab Express"
                      value={batchCourierName}
                      onChange={(e) => setBatchCourierName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Common Consignment / Tracking No
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. JNT99883344MY"
                      value={batchTrackingNo}
                      onChange={(e) => setBatchTrackingNo(e.target.value)}
                      className="w-full font-mono px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Batch Dispatch Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Dispatched 2x power supply and 1x backup printer in single parcel box..."
                    value={batchNotes}
                    onChange={(e) => setBatchNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsBatchDispatchOpen(false)}
                  className="px-4 py-2 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !batchTicketId || batchSelectedItems.length === 0}
                  className="px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  {isPending ? "Dispatching..." : `Dispatch ${batchSelectedItems.length} Item(s) Now`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

