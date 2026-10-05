"use client";

import React, { useState } from "react";
import {
  X,
  Package,
  CheckCircle2,
  Clock,
  Truck,
  Building2,
  DollarSign,
  ShoppingCart,
  ExternalLink,
  Copy,
  Receipt,
  User,
  Phone,
  MapPin,
  FileText,
  AlertCircle,
  XCircle,
  Calendar,
  Check,
  Edit2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { updatePartOrderStatusAction } from "../../actions";
import { PartOrder, PartOrderStatus } from "./PartOrdersTypes";

interface PartOrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: PartOrder | null;
  currentUserRole?: string;
  onOrderUpdated: () => void;
  onOpenReceiveModal: (order: PartOrder) => void;
}

export default function PartOrderDetailsModal({
  isOpen,
  onClose,
  order,
  currentUserRole = "MODERATOR",
  onOrderUpdated,
  onOpenReceiveModal,
}: PartOrderDetailsModalProps) {
  if (!isOpen || !order) return null;

  const isSuperAdminOrModerator = currentUserRole === "SUPERADMIN" || currentUserRole === "MODERATOR";

  // Quick edit tracking state
  const [isEditingTracking, setIsEditingTracking] = useState(false);
  const [courierName, setCourierName] = useState(order.courierName || "");
  const [trackingNo, setTrackingNo] = useState(order.trackingNo || "");
  const [externalOrderRef, setExternalOrderRef] = useState(order.externalOrderRef || "");
  const [estimatedDelivery, setEstimatedDelivery] = useState(
    order.estimatedDelivery ? new Date(order.estimatedDelivery).toISOString().split("T")[0] : ""
  );
  const [isUpdating, setIsUpdating] = useState(false);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${label} to clipboard!`);
  };

  const handleApprove = async () => {
    try {
      setIsUpdating(true);
      const res = await updatePartOrderStatusAction({
        orderId: order.id,
        status: "APPROVED",
      });
      if (res.success) {
        toast.success(`Order ${order.poNumber} approved! Ready for purchase.`);
        onOrderUpdated();
      } else {
        toast.error(res.error || "Failed to approve order.");
      }
    } catch (err: any) {
      toast.error(err.message || "Error approving order.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveTracking = async () => {
    try {
      setIsUpdating(true);
      const res = await updatePartOrderStatusAction({
        orderId: order.id,
        status: order.status === "PENDING_APPROVAL" || order.status === "APPROVED" ? "ORDERED" : order.status,
        courierName: courierName.trim() || undefined,
        trackingNo: trackingNo.trim() || undefined,
        externalOrderRef: externalOrderRef.trim() || undefined,
        estimatedDelivery: estimatedDelivery || undefined,
      });
      if (res.success) {
        toast.success(`Tracking and order details updated!`);
        setIsEditingTracking(false);
        onOrderUpdated();
      } else {
        toast.error(res.error || "Failed to update tracking.");
      }
    } catch (err: any) {
      toast.error(err.message || "Error updating tracking.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelOrder = async () => {
    const reason = window.prompt("Please provide a reason for cancelling this order:");
    if (!reason || !reason.trim()) return;

    try {
      setIsUpdating(true);
      const res = await updatePartOrderStatusAction({
        orderId: order.id,
        status: "CANCELLED",
        rejectionReason: reason.trim(),
      });
      if (res.success) {
        toast.success(`Order ${order.poNumber} marked as Cancelled.`);
        onOrderUpdated();
      } else {
        toast.error(res.error || "Failed to cancel order.");
      }
    } catch (err: any) {
      toast.error(err.message || "Error cancelling order.");
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusBadge = (status: PartOrderStatus) => {
    switch (status) {
      case "PENDING_APPROVAL":
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 animate-pulse" />
            <span>Pending Approval</span>
          </span>
        );
      case "APPROVED":
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Approved / Sourcing</span>
          </span>
        );
      case "ORDERED":
      case "IN_TRANSIT":
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5 animate-pulse" />
            <span>Ordered (In Transit)</span>
          </span>
        );
      case "DELIVERED":
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Delivered & Restocked</span>
          </span>
        );
      case "CANCELLED":
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5" />
            <span>Cancelled</span>
          </span>
        );
      default:
        return null;
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "SHOPEE":
        return { icon: "🟠", label: "Shopee" };
      case "LAZADA":
        return { icon: "🟣", label: "Lazada" };
      case "DIRECT_SUPPLIER":
        return { icon: "🔵", label: "OEM Supplier" };
      case "BOSS_PURCHASE":
        return { icon: "🟢", label: "Boss Cash Purchase" };
      case "LOCAL_STORE":
        return { icon: "🟡", label: "Walk-in Store" };
      default:
        return { icon: "⚪", label: platform };
    }
  };

  const plat = getPlatformIcon(order.sourcingPlatform);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in">
      <div className="relative w-full max-w-4xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col text-left">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-gradient-to-r from-zinc-50 via-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zinc-900 dark:text-white font-mono">
                  {order.poNumber}
                </h2>
                {getStatusBadge(order.status)}
              </div>
              <div className="text-xs text-zinc-500 flex items-center gap-2 mt-0.5">
                <span>Created {new Date(order.createdAt).toLocaleDateString()}</span>
                <span>•</span>
                <span>By {order.requestedBy}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1 text-xs sm:text-sm">
          {/* Quick Action Banner */}
          {isSuperAdminOrModerator && (
            <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span className="font-semibold">Quick Actions for this Purchase Order:</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {order.status === "PENDING_APPROVAL" && (
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={isUpdating}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve Order</span>
                  </button>
                )}

                {order.status !== "DELIVERED" && order.status !== "CANCELLED" && (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsEditingTracking(!isEditingTracking)}
                      className="px-3 py-1.5 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>{isEditingTracking ? "Close Tracking Edit" : "Update Tracking & Waybill"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenReceiveModal(order);
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Package className="w-3.5 h-3.5" />
                      <span>Receive Inbound Stock</span>
                    </button>
                  </>
                )}

                {order.status !== "DELIVERED" && order.status !== "CANCELLED" && (
                  <button
                    type="button"
                    onClick={handleCancelOrder}
                    disabled={isUpdating}
                    className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl text-xs font-semibold transition cursor-pointer"
                  >
                    Cancel Order
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Quick Tracking Editor Form (if toggled) */}
          {isEditingTracking && (
            <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-zinc-900 shadow-md space-y-3">
              <h4 className="font-bold text-xs text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-indigo-600" />
                <span>Update Logistics, Platform ID & ETA</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                    Courier Name
                  </label>
                  <input
                    type="text"
                    value={courierName}
                    onChange={(e) => setCourierName(e.target.value)}
                    placeholder="e.g. Shopee Xpress, J&T"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                    Tracking / AWB Number
                  </label>
                  <input
                    type="text"
                    value={trackingNo}
                    onChange={(e) => setTrackingNo(e.target.value)}
                    placeholder="e.g. SPXMY012345"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                    Platform Order ID
                  </label>
                  <input
                    type="text"
                    value={externalOrderRef}
                    onChange={(e) => setExternalOrderRef(e.target.value)}
                    placeholder="e.g. 241005ABC"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                    Estimated Delivery
                  </label>
                  <input
                    type="date"
                    value={estimatedDelivery}
                    onChange={(e) => setEstimatedDelivery(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditingTracking(false)}
                  className="px-3 py-1.5 text-xs rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveTracking}
                  disabled={isUpdating}
                  className="px-4 py-1.5 bg-indigo-600 text-white font-bold rounded-lg text-xs hover:bg-indigo-700 cursor-pointer shadow-xs"
                >
                  Save Tracking
                </button>
              </div>
            </div>
          )}

          {/* SOURCING & SHIPPING 2-COLUMN GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Sourcing Platform & Vendor */}
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  Vendor & Sourcing
                </span>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
                  {plat.icon} {plat.label}
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                {order.supplierName && (
                  <div>
                    <span className="text-zinc-400">Supplier:</span>{" "}
                    <strong className="text-zinc-900 dark:text-zinc-100">{order.supplierName}</strong>
                  </div>
                )}
                {order.externalOrderRef && (
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400">Order ID:</span>
                    <strong className="font-mono text-zinc-900 dark:text-zinc-100">{order.externalOrderRef}</strong>
                    <button
                      type="button"
                      onClick={() => handleCopy(order.externalOrderRef!, "Order ID")}
                      className="text-zinc-400 hover:text-indigo-600 p-0.5 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {order.orderUrl && (
                  <div className="pt-1">
                    <a
                      href={order.orderUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                    >
                      <span>Open Product / Order Page</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Recipient & Delivery Address Card */}
            <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                  Delivery Destination
                </span>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300">
                  {order.recipientType}
                </span>
              </div>

              <div className="space-y-1 text-xs">
                <div className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-blue-600" />
                  <span>{order.recipientName}</span>
                  {order.recipientPhone && (
                    <span className="text-zinc-400 font-mono font-normal">({order.recipientPhone})</span>
                  )}
                </div>
                <div className="text-zinc-600 dark:text-zinc-300 flex items-start gap-1.5 pt-1">
                  <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                  <span>{order.deliveryAddress}</span>
                </div>
                {order.deliveryNotes && (
                  <div className="text-[11px] text-zinc-500 italic pt-1">
                    Note: "{order.deliveryNotes}"
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* LOGISTICS & WAYBILL TRACKING BAR */}
          {(order.courierName || order.trackingNo || order.estimatedDelivery) && (
            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Truck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <div>
                  <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                    {order.courierName || "Courier Transit"}
                  </div>
                  <div className="font-mono font-bold text-xs text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <span>{order.trackingNo || "No tracking number"}</span>
                    {order.trackingNo && (
                      <button
                        type="button"
                        onClick={() => handleCopy(order.trackingNo!, "Tracking number")}
                        className="text-zinc-400 hover:text-indigo-600 p-0.5 cursor-pointer"
                        title="Copy tracking number"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {order.estimatedDelivery && (
                <div className="flex items-center gap-2 text-xs">
                  <Calendar className="w-4 h-4 text-amber-500" />
                  <div>
                    <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Estimated Arrival</div>
                    <div className="font-bold text-zinc-900 dark:text-zinc-100">
                      {new Date(order.estimatedDelivery).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ORDERED LINE ITEMS TABLE */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-purple-500" />
                <span>Ordered Hardware & Line Items ({order.items.length})</span>
              </span>
            </div>

            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Part Details</th>
                    <th className="py-2.5 px-3">Format & Depot</th>
                    <th className="py-2.5 px-3 text-center">Qty / Received</th>
                    <th className="py-2.5 px-3 text-right">Unit Price</th>
                    <th className="py-2.5 px-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-medium">
                  {order.items.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40">
                      <td className="py-3 px-3">
                        <div className="font-bold text-zinc-900 dark:text-zinc-100">{item.partName}</div>
                        <div className="text-[11px] text-zinc-400">{item.category}</div>
                        {item.ticket && (
                          <div className="mt-1">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                              🎯 For Ticket #{item.ticket.ticketRefNo || item.ticket.id} ({item.ticket.clientSiteName})
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-zinc-700 dark:text-zinc-300">
                          {item.trackingType === "SERIALIZED" ? "🏷️ Serialized" : "📦 Bulk"}
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          {item.warehouse?.name || "HQ Central"}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="font-bold text-zinc-900 dark:text-zinc-100">
                          {item.quantity} units
                        </div>
                        <div className="text-[10px] mt-0.5">
                          {item.receivedQuantity >= item.quantity ? (
                            <span className="text-emerald-600 font-bold">✅ Complete</span>
                          ) : item.receivedQuantity > 0 ? (
                            <span className="text-blue-600 font-bold">{item.receivedQuantity}/{item.quantity} Received</span>
                          ) : (
                            <span className="text-zinc-400">0 Received</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono">
                        RM {(item.unitCost || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-zinc-900 dark:text-white">
                        RM {(item.totalCost || (item.unitCost * item.quantity) || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* FINANCIAL SUMMARY & PROOF ATTACHMENTS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Receipts / Proof Attachments */}
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 space-y-2">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                Proof of Purchase & Invoices
              </span>

              {order.receiptAttachments && order.receiptAttachments.length > 0 ? (
                <div className="space-y-1.5 pt-1">
                  {order.receiptAttachments.map((att) => (
                    <a
                      key={att.id}
                      href={att.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Receipt className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span className="truncate">{att.name}</span>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
                    </a>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-zinc-400 italic py-2">No receipt attachments uploaded.</div>
              )}
            </div>

            {/* Financial Card */}
            <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 space-y-2 text-xs">
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Items Subtotal:</span>
                <span className="font-mono">RM {(order.subtotalCost || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Shipping Fee:</span>
                <span className="font-mono">RM {(order.shippingCost || 0).toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-900/60 flex justify-between text-sm font-black text-emerald-950 dark:text-emerald-200">
                <span>Total Amount:</span>
                <span className="font-mono text-base">RM {(order.totalCost || 0).toFixed(2)}</span>
              </div>
              <div className="text-[11px] text-zinc-500 pt-1 flex justify-between">
                <span>Payment: <strong>{order.paymentMethod || "Company Card"}</strong></span>
                <span>Paid by: <strong>{order.paidBy || "Staff"}</strong></span>
              </div>
            </div>
          </div>

          {/* Audit Notes & Rejection Reason */}
          {order.rejectionReason && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-900 dark:text-rose-200">
              <strong className="block font-bold text-rose-700 dark:text-rose-400 uppercase text-[10px] tracking-wider">
                Cancellation / Rejection Reason
              </strong>
              <p className="mt-0.5">{order.rejectionReason}</p>
            </div>
          )}

          {order.notes && (
            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 text-xs text-zinc-700 dark:text-zinc-300">
              <strong className="block font-bold text-zinc-400 uppercase text-[10px] tracking-wider">
                Internal Procurement Notes
              </strong>
              <p className="mt-0.5 whitespace-pre-wrap">{order.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="text-[11px] text-zinc-400">
            {order.receivedAt ? (
              <span>Received by {order.receivedBy || "Staff"} on {new Date(order.receivedAt).toLocaleDateString()}</span>
            ) : order.orderedAt ? (
              <span>Ordered by {order.orderedBy || "Staff"} on {new Date(order.orderedAt).toLocaleDateString()}</span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
