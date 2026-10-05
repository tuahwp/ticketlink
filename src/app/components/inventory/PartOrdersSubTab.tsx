"use client";

import React, { useState, useMemo } from "react";
import {
  ShoppingCart,
  Plus,
  Search,
  Filter,
  Truck,
  Building2,
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Edit2,
  Trash2,
  Copy,
  Receipt,
  User,
  Phone,
  MapPin,
  FileText,
  DollarSign,
  Package,
  Calendar,
  XCircle,
  RefreshCw,
  Sparkles,
  Layers,
  CheckSquare,
  Square,
  ArrowRight,
  ListOrdered,
} from "lucide-react";
import { toast } from "sonner";
import { PartOrder, PartOrderStatus, SourcingPlatform } from "./PartOrdersTypes";
import { InitialOrderItem } from "./CreatePartOrderModal";
import { deletePartOrderAction, updatePartOrderStatusAction } from "../../actions";

interface Warehouse {
  id: number;
  name: string;
  state: string;
}

interface PendingTicketPart {
  id: number;
  ticketRefNo: string | null;
  clientSiteName: string;
  state: string;
  status: string;
  subStatus: string | null;
  spareParts?: Array<{
    id: number;
    requestedPartName: string;
    quantity: number;
    status: string;
    inventoryItemId?: number | null;
    inventoryItem?: any;
    isLoaner?: boolean;
    ticketId?: number;
  }>;
}

interface PartOrdersSubTabProps {
  orders: PartOrder[];
  warehouses: Warehouse[];
  pendingTickets?: PendingTicketPart[];
  currentUserRole?: string;
  currentUserName?: string;
  onRefresh: () => void;
  onOpenCreateModal: (preselectedItems?: InitialOrderItem[]) => void;
  onOpenDetailsModal: (order: PartOrder) => void;
  onOpenReceiveModal: (order: PartOrder) => void;
  onOpenTicket?: (ticketId: number) => void;
}

export default function PartOrdersSubTab({
  orders,
  warehouses,
  pendingTickets = [],
  currentUserRole = "MODERATOR",
  currentUserName = "Staff",
  onRefresh,
  onOpenCreateModal,
  onOpenDetailsModal,
  onOpenReceiveModal,
  onOpenTicket,
}: PartOrdersSubTabProps) {
  const isSuperAdminOrModerator = currentUserRole === "SUPERADMIN" || currentUserRole === "MODERATOR";

  // Requisition Backlog selection state
  const [selectedBacklogPartIds, setSelectedBacklogPartIds] = useState<number[]>([]);
  const [isBacklogCollapsed, setIsBacklogCollapsed] = useState(false);

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("ALL");

  // Calculate unfulfilled requested parts from active tickets
  const unfulfilledParts = useMemo(() => {
    const list: Array<{
      ticketId: number;
      ticketRefNo: string | null;
      clientSiteName: string;
      state: string;
      sparePartId: number;
      partName: string;
      quantity: number;
      status: string;
      isLoaner: boolean;
    }> = [];

    pendingTickets.forEach((ticket) => {
      ticket.spareParts?.forEach((sp) => {
        // Check if waiting for allocation or approval
        const isWaiting =
          sp.status === "PENDING_APPROVAL" ||
          sp.status === "APPROVED" ||
          sp.status === "REQUESTED";

        if (isWaiting && !sp.inventoryItemId) {
          // Check if already covered by an existing active in-transit order
          const isAlreadyInOrder = orders.some(
            (o) =>
              o.status !== "CANCELLED" &&
              o.status !== "DELIVERED" &&
              o.items.some((i) => i.ticketId === ticket.id && i.ticketSparePartId === sp.id)
          );

          if (!isAlreadyInOrder) {
            list.push({
              ticketId: ticket.id,
              ticketRefNo: ticket.ticketRefNo,
              clientSiteName: ticket.clientSiteName,
              state: ticket.state,
              sparePartId: sp.id,
              partName: sp.requestedPartName,
              quantity: sp.quantity || 1,
              status: sp.status,
              isLoaner: !!sp.isLoaner,
            });
          }
        }
      });
    });

    return list;
  }, [pendingTickets, orders]);

  // KPI calculations
  const stats = useMemo(() => {
    const total = orders.length;
    const pendingApproval = orders.filter((o) => o.status === "PENDING_APPROVAL").length;
    const inTransit = orders.filter((o) => o.status === "ORDERED" || o.status === "IN_TRANSIT").length;
    const delivered = orders.filter((o) => o.status === "DELIVERED").length;
    const totalSpend = orders
      .filter((o) => o.status !== "CANCELLED")
      .reduce((sum, o) => sum + (Number(o.totalCost) || 0), 0);

    return {
      total,
      pendingApproval,
      inTransit,
      delivered,
      totalSpend,
    };
  }, [orders]);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Platform filter
      if (platformFilter !== "ALL" && order.sourcingPlatform !== platformFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== "ALL" && order.status !== statusFilter) {
        return false;
      }

      // Warehouse filter
      if (warehouseFilter !== "ALL") {
        const whId = Number(warehouseFilter);
        const matchesTarget = order.targetWarehouseId === whId;
        const matchesItem = order.items.some((i) => i.warehouseId === whId);
        if (!matchesTarget && !matchesItem) return false;
      }

      // Search query
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesPo = order.poNumber.toLowerCase().includes(q);
        const matchesSupplier = order.supplierName?.toLowerCase().includes(q);
        const matchesRef = order.externalOrderRef?.toLowerCase().includes(q);
        const matchesTracking = order.trackingNo?.toLowerCase().includes(q);
        const matchesRecipient = order.recipientName.toLowerCase().includes(q);
        const matchesAddress = order.deliveryAddress.toLowerCase().includes(q);
        const matchesItem = order.items.some(
          (i) => i.partName.toLowerCase().includes(q) || i.partNumber?.toLowerCase().includes(q)
        );

        if (!matchesPo && !matchesSupplier && !matchesRef && !matchesTracking && !matchesRecipient && !matchesAddress && !matchesItem) {
          return false;
        }
      }

      return true;
    });
  }, [orders, platformFilter, statusFilter, warehouseFilter, searchTerm]);

  const activeFiltersCount = useMemo(() => {
    return [
      searchTerm ? 1 : 0,
      platformFilter !== "ALL" ? 1 : 0,
      statusFilter !== "ALL" ? 1 : 0,
      warehouseFilter !== "ALL" ? 1 : 0,
    ].reduce((a, b) => a + b, 0);
  }, [searchTerm, platformFilter, statusFilter, warehouseFilter]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${label} to clipboard!`);
  };

  const handleToggleBacklogSelect = (sparePartId: number) => {
    setSelectedBacklogPartIds((prev) =>
      prev.includes(sparePartId) ? prev.filter((id) => id !== sparePartId) : [...prev, sparePartId]
    );
  };

  const handleSelectAllBacklog = () => {
    if (selectedBacklogPartIds.length === unfulfilledParts.length) {
      setSelectedBacklogPartIds([]);
    } else {
      setSelectedBacklogPartIds(unfulfilledParts.map((p) => p.sparePartId));
    }
  };

  const handleCreateOrderFromSelected = () => {
    const selected = unfulfilledParts.filter((p) => selectedBacklogPartIds.includes(p.sparePartId));
    if (selected.length === 0) {
      toast.error("Please select at least 1 part from the backlog.");
      return;
    }

    const items: InitialOrderItem[] = selected.map((p) => ({
      partName: p.partName,
      quantity: p.quantity,
      ticketId: p.ticketId,
      ticketSparePartId: p.sparePartId,
      clientSiteName: p.clientSiteName,
      trackingType: "SERIALIZED",
    }));

    onOpenCreateModal(items);
  };

  const handleCreateSinglePartOrder = (part: typeof unfulfilledParts[0]) => {
    const items: InitialOrderItem[] = [
      {
        partName: part.partName,
        quantity: part.quantity,
        ticketId: part.ticketId,
        ticketSparePartId: part.sparePartId,
        clientSiteName: part.clientSiteName,
        trackingType: "SERIALIZED",
      },
    ];
    onOpenCreateModal(items);
  };

  const handleQuickApprove = async (order: PartOrder) => {
    try {
      const res = await updatePartOrderStatusAction({
        orderId: order.id,
        status: "APPROVED",
      });
      if (res.success) {
        toast.success(`Order ${order.poNumber} approved!`);
        onRefresh();
      } else {
        toast.error(res.error || "Failed to approve order.");
      }
    } catch (err: any) {
      toast.error(err.message || "Error approving order.");
    }
  };

  const handleDelete = async (order: PartOrder) => {
    if (!window.confirm(`Are you sure you want to delete purchase order ${order.poNumber}?`)) {
      return;
    }

    try {
      const res = await deletePartOrderAction(order.id);
      if (res.success) {
        toast.success(`Purchase order ${order.poNumber} deleted.`);
        onRefresh();
      } else {
        toast.error(res.error || "Failed to delete order.");
      }
    } catch (err: any) {
      toast.error(err.message || "Error deleting order.");
    }
  };

  const getPlatformIcon = (platform: SourcingPlatform) => {
    switch (platform) {
      case "SHOPEE":
        return { icon: "🟠", label: "Shopee", bg: "bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800" };
      case "LAZADA":
        return { icon: "🟣", label: "Lazada", bg: "bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800" };
      case "DIRECT_SUPPLIER":
        return { icon: "🔵", label: "OEM Supplier", bg: "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800" };
      case "BOSS_PURCHASE":
        return { icon: "🟢", label: "Boss Cash", bg: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800" };
      case "LOCAL_STORE":
        return { icon: "🟡", label: "Walk-in Store", bg: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800" };
      default:
        return { icon: "⚪", label: platform, bg: "bg-zinc-50 text-zinc-800 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700" };
    }
  };

  const getStatusPill = (status: PartOrderStatus) => {
    switch (status) {
      case "PENDING_APPROVAL":
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 inline-flex items-center gap-1">
            <Clock className="w-3 h-3 animate-pulse" />
            <span>Pending Approval</span>
          </span>
        );
      case "APPROVED":
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Approved (To Buy)</span>
          </span>
        );
      case "ORDERED":
      case "IN_TRANSIT":
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 inline-flex items-center gap-1">
            <Truck className="w-3 h-3 animate-pulse" />
            <span>In Transit</span>
          </span>
        );
      case "DELIVERED":
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Delivered & Stocked</span>
          </span>
        );
      case "CANCELLED":
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 inline-flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            <span>Cancelled</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 text-left">
      {/* Top Banner & Action Header */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/20 shrink-0">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <span>Part Orders & Procurement</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 font-bold">
                {orders.length} Orders
              </span>
            </h2>
            <p className="text-xs text-zinc-500">
              Review parts requested by Field Engineers, buy in bulk on Shopee/Suppliers, and auto-allocate upon arrival.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="p-2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
            title="Refresh Orders"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {isSuperAdminOrModerator && (
            <button
              type="button"
              onClick={() => onOpenCreateModal()}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md shadow-indigo-600/20 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ Create Blank PO</span>
            </button>
          )}
        </div>
      </div>

      {/* FEATURE 1: PARTS REQUISITION BACKLOG (NEEDS ORDERING) */}
      {unfulfilledParts.length > 0 && (
        <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-purple-500/10 border-2 border-amber-500/30 dark:border-amber-500/20 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500 text-white shadow-xs">
                <ListOrdered className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <span>Parts Awaiting Procurement (Backlog)</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white">
                    {unfulfilledParts.length} Parts Needed
                  </span>
                </h3>
                <p className="text-xs text-zinc-500">
                  These parts were requested for active tickets with 0 stock. Select them to create a combined Shopee/Supplier order in 1-click!
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={handleSelectAllBacklog}
                className="px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 text-xs font-semibold text-zinc-700 dark:text-zinc-200 transition cursor-pointer"
              >
                {selectedBacklogPartIds.length === unfulfilledParts.length ? "Deselect All" : "Select All"}
              </button>

              {isSuperAdminOrModerator && (
                <button
                  type="button"
                  onClick={handleCreateOrderFromSelected}
                  disabled={selectedBacklogPartIds.length === 0}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md shadow-amber-600/20 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>Order Selected ({selectedBacklogPartIds.length})</span>
                </button>
              )}
            </div>
          </div>

          {/* Backlog Items List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {unfulfilledParts.map((item) => {
              const isSelected = selectedBacklogPartIds.includes(item.sparePartId);

              return (
                <div
                  key={item.sparePartId}
                  onClick={() => handleToggleBacklogSelect(item.sparePartId)}
                  className={`p-3 rounded-xl border transition cursor-pointer flex items-start justify-between gap-3 ${
                    isSelected
                      ? "border-amber-500 bg-amber-50/90 dark:bg-amber-950/60 ring-2 ring-amber-500/20 shadow-xs"
                      : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 hover:bg-zinc-50 dark:hover:bg-zinc-800/70"
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="mt-0.5 text-amber-600 shrink-0">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4 text-zinc-400" />
                      )}
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="font-bold text-xs text-zinc-900 dark:text-white truncate">
                        {item.quantity}x {item.partName}
                      </div>
                      <div className="text-[11px] text-zinc-500 truncate">
                        #{item.ticketRefNo || item.ticketId} • {item.clientSiteName} ({item.state})
                      </div>
                      <div className="text-[10px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>0 Available in Warehouse</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCreateSinglePartOrder(item);
                    }}
                    className="p-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 text-xs font-bold shrink-0 transition"
                    title="Order this single part now"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Active POs</div>
            <div className="text-2xl font-black text-zinc-900 dark:text-white mt-1">{stats.total}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
            <ShoppingCart className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Awaiting Approval</div>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{stats.pendingApproval}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">In Transit / Shipped</div>
            <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{stats.inTransit}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Total Sourced (RM)</div>
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              RM {stats.totalSpend.toFixed(2)}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 2-Tier Filter Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-4 shadow-sm space-y-3">
        {/* Tier 1: Search & Warehouse */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by PO#, part name, supplier, tracking no, recipient..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm rounded-xl border border-zinc-200 dark:border-zinc-700/80 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-900 dark:text-white placeholder-zinc-400 focus:ring-2 focus:ring-indigo-500/40 outline-none"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs p-1 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className={`text-xs font-medium px-3 py-2 rounded-xl border transition focus:ring-2 focus:ring-indigo-500/40 cursor-pointer ${
                warehouseFilter !== "ALL"
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-bold"
                  : "border-zinc-200 dark:border-zinc-700/80 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-200"
              }`}
            >
              <option value="ALL">🏢 All Target Depots</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.state})
                </option>
              ))}
            </select>

            {activeFiltersCount > 0 && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setPlatformFilter("ALL");
                  setStatusFilter("ALL");
                  setWarehouseFilter("ALL");
                }}
                className="text-xs font-semibold text-zinc-500 hover:text-rose-600 px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700/80 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition flex items-center gap-1.5 cursor-pointer shrink-0"
                title="Reset all filters"
              >
                <span>Reset</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                  {activeFiltersCount}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Tier 2: Platform & Status Dropdowns */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className={`text-xs font-medium px-3 py-1.5 rounded-xl border transition focus:ring-2 focus:ring-indigo-500/40 cursor-pointer ${
              platformFilter !== "ALL"
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-bold"
                : "border-zinc-200 dark:border-zinc-700/80 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300"
            }`}
          >
            <option value="ALL">🌐 All Sourcing Platforms</option>
            <option value="SHOPEE">🟠 Shopee</option>
            <option value="LAZADA">🟣 Lazada</option>
            <option value="DIRECT_SUPPLIER">🔵 Direct Supplier</option>
            <option value="BOSS_PURCHASE">🟢 Boss Cash</option>
            <option value="LOCAL_STORE">🟡 Walk-in Store</option>
            <option value="OTHER">⚪ Other</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`text-xs font-medium px-3 py-1.5 rounded-xl border transition focus:ring-2 focus:ring-indigo-500/40 cursor-pointer ${
              statusFilter !== "ALL"
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-bold"
                : "border-zinc-200 dark:border-zinc-700/80 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300"
            }`}
          >
            <option value="ALL">📋 All Order Statuses</option>
            <option value="PENDING_APPROVAL">⏳ Pending Approval</option>
            <option value="APPROVED">✅ Approved (To Buy)</option>
            <option value="ORDERED">🚚 In Transit / Ordered</option>
            <option value="DELIVERED">📦 Delivered & Stocked</option>
            <option value="CANCELLED">❌ Cancelled</option>
          </select>
        </div>
      </div>

      {/* Orders Table / Cards */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm space-y-3">
          <ShoppingCart className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto" />
          <h3 className="text-base font-bold text-zinc-900 dark:text-white">No Purchase Orders Found</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            {activeFiltersCount > 0
              ? "No orders match your filter criteria. Try clearing search filters."
              : "No part purchase orders have been logged yet."}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">PO Ref & Platform</th>
                  <th className="py-3 px-4">Ordered Parts</th>
                  <th className="py-3 px-4">Delivery Recipient</th>
                  <th className="py-3 px-4">Tracking & Courier</th>
                  <th className="py-3 px-4">Financials</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-medium">
                {filteredOrders.map((order) => {
                  const plat = getPlatformIcon(order.sourcingPlatform);
                  const totalItemsQty = order.items.reduce((sum, i) => sum + (i.quantity || 1), 0);
                  const totalRecQty = order.items.reduce((sum, i) => sum + (i.receivedQuantity || 0), 0);
                  const isFullyStocked = order.status === "DELIVERED" || (totalRecQty >= totalItemsQty && totalItemsQty > 0);

                  return (
                    <tr
                      key={order.id}
                      onClick={() => onOpenDetailsModal(order)}
                      className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/50 cursor-pointer transition"
                    >
                      {/* PO Ref & Platform */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {order.poNumber}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${plat.bg}`}>
                            {plat.icon} {plat.label}
                          </span>
                        </div>
                        {order.externalOrderRef && (
                          <div className="text-[10px] font-mono text-zinc-400 mt-1 truncate max-w-[140px]">
                            ID: {order.externalOrderRef}
                          </div>
                        )}
                        <div className="text-[10px] text-zinc-400 mt-0.5">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </div>
                      </td>

                      {/* Ordered Parts Summary */}
                      <td className="py-3.5 px-4 align-top max-w-xs">
                        <div className="space-y-1">
                          {order.items.slice(0, 2).map((item) => (
                            <div key={item.id} className="text-xs">
                              <span className="font-bold text-zinc-900 dark:text-zinc-100">
                                {item.quantity}x {item.partName}
                              </span>
                              {item.ticket && (
                                <div className="mt-0.5">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (item.ticketId && onOpenTicket) onOpenTicket(item.ticketId);
                                    }}
                                    className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 hover:underline inline-flex items-center gap-1"
                                  >
                                    🎯 #{item.ticket.ticketRefNo || item.ticket.id} ({item.ticket.clientSiteName})
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                          {order.items.length > 2 && (
                            <div className="text-[10px] text-zinc-400 italic">
                              +{order.items.length - 2} more items...
                            </div>
                          )}
                        </div>

                        <div className="text-[10px] text-zinc-500 mt-1.5 flex items-center gap-1.5">
                          <span>Progress:</span>
                          <strong className={isFullyStocked ? "text-emerald-600" : "text-blue-600"}>
                            {totalRecQty}/{totalItemsQty} Received
                          </strong>
                        </div>
                      </td>

                      {/* Delivery Recipient */}
                      <td className="py-3.5 px-4 align-top max-w-xs">
                        <div className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
                          <User className="w-3 h-3 text-blue-500" />
                          <span>{order.recipientName}</span>
                        </div>
                        <div className="text-[11px] text-zinc-500 truncate mt-0.5">
                          {order.deliveryAddress}
                        </div>
                        {order.recipientPhone && (
                          <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                            📞 {order.recipientPhone}
                          </div>
                        )}
                      </td>

                      {/* Tracking & Courier */}
                      <td className="py-3.5 px-4 align-top">
                        {order.trackingNo ? (
                          <div className="space-y-0.5">
                            <div className="text-[10px] font-bold text-zinc-400 uppercase">
                              {order.courierName || "Courier"}
                            </div>
                            <div className="font-mono font-bold text-xs text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
                              <span>{order.trackingNo}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopy(order.trackingNo!, "Tracking number");
                                }}
                                className="text-zinc-400 hover:text-indigo-600 p-0.5"
                                title="Copy tracking"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                            {order.estimatedDelivery && (
                              <div className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1 pt-0.5">
                                <Calendar className="w-3 h-3" />
                                <span>ETA: {new Date(order.estimatedDelivery).toLocaleDateString()}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-zinc-400 text-[11px] italic">No tracking yet</span>
                        )}
                      </td>

                      {/* Financials */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="font-bold text-sm text-zinc-900 dark:text-white font-mono">
                          RM {(order.totalCost || 0).toFixed(2)}
                        </div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">
                          {order.paymentMethod || "Company Card"}
                        </div>
                        {order.receiptAttachments && order.receiptAttachments.length > 0 && (
                          <div className="mt-1">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                              <Receipt className="w-2.5 h-2.5 text-indigo-500" />
                              <span>{order.receiptAttachments.length} Receipt</span>
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 align-top">
                        {getStatusPill(order.status)}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 align-top text-right space-y-1" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {order.status === "PENDING_APPROVAL" && isSuperAdminOrModerator && (
                            <button
                              type="button"
                              onClick={() => handleQuickApprove(order)}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                              title="Approve Order"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Approve</span>
                            </button>
                          )}

                          {order.status !== "DELIVERED" && order.status !== "CANCELLED" && isSuperAdminOrModerator && (
                            <button
                              type="button"
                              onClick={() => onOpenReceiveModal(order)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                              title="Receive Inbound Stock"
                            >
                              <Package className="w-3 h-3" />
                              <span>Receive</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onOpenDetailsModal(order)}
                            className="px-2 py-1 text-zinc-600 hover:text-indigo-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-xs font-semibold transition cursor-pointer"
                            title="View Details"
                          >
                            Details
                          </button>

                          {order.status !== "DELIVERED" && isSuperAdminOrModerator && (
                            <button
                              type="button"
                              onClick={() => handleDelete(order)}
                              className="p-1 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                              title="Delete Order"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
  );
}
