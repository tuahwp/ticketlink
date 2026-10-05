"use client";

import React, { useState } from "react";
import {
  X,
  Package,
  CheckCircle2,
  Building2,
  Barcode,
  Sparkles,
  AlertCircle,
  Truck,
  Send,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { receivePartOrderItemsAction } from "../../actions";
import { PartOrder } from "./PartOrdersTypes";

interface Warehouse {
  id: number;
  name: string;
  state: string;
}

interface ReceivePartOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: PartOrder | null;
  warehouses: Warehouse[];
  onOrderReceived: () => void;
}

export default function ReceivePartOrderModal({
  isOpen,
  onClose,
  order,
  warehouses,
  onOrderReceived,
}: ReceivePartOrderModalProps) {
  if (!isOpen || !order) return null;

  // Initialize receiving item state based on order items
  const [receivingItems, setReceivingItems] = useState<
    Array<{
      itemId: number;
      partName: string;
      category: string;
      trackingType: "SERIALIZED" | "BULK";
      orderedQty: number;
      alreadyReceivedQty: number;
      receivingQty: number;
      serialNumbersText: string;
      warehouseId: number;
      allocateToTicket: boolean;
      ticketId?: number | null;
      ticketRefNo?: string | null;
      clientSiteName?: string | null;
    }>
  >(() => {
    return order.items.map((item) => {
      const remaining = Math.max(0, item.quantity - (item.receivedQuantity || 0));
      return {
        itemId: item.id,
        partName: item.partName,
        category: item.category,
        trackingType: item.trackingType,
        orderedQty: item.quantity,
        alreadyReceivedQty: item.receivedQuantity || 0,
        receivingQty: remaining,
        serialNumbersText: "",
        warehouseId: item.warehouseId || order.targetWarehouseId || warehouses[0]?.id || 1,
        allocateToTicket: !!item.ticketId,
        ticketId: item.ticketId,
        ticketRefNo: item.ticket?.ticketRefNo || (item.ticketId ? String(item.ticketId) : null),
        clientSiteName: item.ticket?.clientSiteName,
      };
    });
  });

  const [inboundNotes, setInboundNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUpdateItem = (index: number, field: string, value: any) => {
    setReceivingItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleGenerateSerials = (index: number) => {
    const item = receivingItems[index];
    const qty = item.receivingQty || 1;
    const generated = Array.from(
      { length: qty },
      (_, i) => `SN-${Date.now().toString().slice(-6)}-${i + 1}`
    ).join("\n");
    handleUpdateItem(index, "serialNumbersText", generated);
    toast.info(`Generated ${qty} temporary serial numbers.`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const activeReceives = receivingItems.filter((i) => i.receivingQty > 0);
    if (activeReceives.length === 0) {
      toast.error("Please specify at least 1 item with receiving quantity > 0.");
      return;
    }

    // Validate serial numbers for serialized items
    for (const item of activeReceives) {
      if (item.trackingType === "SERIALIZED") {
        const serials = item.serialNumbersText
          .split(/[\n,]+/)
          .map((s) => s.trim())
          .filter((s) => s !== "");

        if (serials.length < item.receivingQty) {
          toast.error(
            `Item "${item.partName}" requires ${item.receivingQty} serial numbers, but only ${serials.length} provided. Please enter or generate serials.`
          );
          return;
        }
      }
    }

    try {
      setIsSubmitting(true);
      const payload = {
        orderId: order.id,
        items: activeReceives.map((i) => ({
          itemId: i.itemId,
          receivedQuantity: i.receivingQty,
          serialNumbers:
            i.trackingType === "SERIALIZED"
              ? i.serialNumbersText
                  .split(/[\n,]+/)
                  .map((s) => s.trim())
                  .filter((s) => s !== "")
              : undefined,
          warehouseId: i.warehouseId,
          allocateToTicket: i.allocateToTicket,
          ticketId: i.ticketId,
        })),
        notes: inboundNotes.trim() || undefined,
      };

      const res = await receivePartOrderItemsAction(payload);
      if (res.success) {
        toast.success(`Inbound stock received & registered for ${order.poNumber}!`);
        onOrderReceived();
        onClose();
      } else {
        toast.error(res.error || "Failed to process inbound receiving.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "An error occurred during receiving.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in">
      <div className="relative w-full max-w-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col text-left">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-gradient-to-r from-emerald-50/60 via-white to-teal-50/60 dark:from-zinc-900 dark:to-zinc-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <span>Receive Inbound Stock</span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {order.poNumber}
                </span>
              </h2>
              <p className="text-xs text-zinc-500">
                Unbox incoming package from {order.sourcingPlatform} and add hardware into inventory.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5 flex-1 text-xs sm:text-sm">
          {/* Order Summary Ribbon */}
          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider">Source & Courier</div>
              <div className="font-semibold text-zinc-800 dark:text-zinc-200 text-xs">
                {order.sourcingPlatform} {order.supplierName ? `(${order.supplierName})` : ""}
                {order.courierName ? ` • ${order.courierName}` : ""}
              </div>
            </div>
            {order.trackingNo && (
              <div>
                <div className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider">Tracking No</div>
                <div className="font-mono font-bold text-xs text-zinc-900 dark:text-zinc-100">
                  {order.trackingNo}
                </div>
              </div>
            )}
            <div>
              <div className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider">Recipient</div>
              <div className="font-semibold text-zinc-800 dark:text-zinc-200 text-xs">
                {order.recipientName} ({order.recipientType})
              </div>
            </div>
          </div>

          {/* Line Items Receiving Section */}
          <div className="space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Items in this Shipment</span>
            </div>

            {receivingItems.map((item, index) => {
              const remainingToReceive = item.orderedQty - item.alreadyReceivedQty;
              const isAlreadyComplete = remainingToReceive <= 0;

              return (
                <div
                  key={item.itemId}
                  className={`p-4 rounded-xl border transition ${
                    isAlreadyComplete
                      ? "border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/30 dark:bg-emerald-950/10 opacity-75"
                      : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 shadow-xs"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div>
                      <div className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                        <span>{item.partName}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                          {item.trackingType}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-500 flex items-center gap-2 mt-0.5">
                        <span>Ordered: <strong>{item.orderedQty}</strong></span>
                        <span>•</span>
                        <span>Already Received: <strong>{item.alreadyReceivedQty}</strong></span>
                        <span>•</span>
                        <span className="text-emerald-600 font-bold">Remaining: {remainingToReceive}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                        Receiving Now:
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={remainingToReceive}
                        value={item.receivingQty}
                        onChange={(e) =>
                          handleUpdateItem(
                            index,
                            "receivingQty",
                            Math.min(remainingToReceive, Math.max(0, parseInt(e.target.value) || 0))
                          )
                        }
                        className="w-16 px-2.5 py-1 text-center font-bold text-xs rounded-lg border border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 focus:ring-2 focus:ring-emerald-500/40 outline-none"
                      />
                    </div>
                  </div>

                  {item.receivingQty > 0 && (
                    <div className="space-y-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Target Warehouse for this stock */}
                        <div>
                          <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                            Restock In Warehouse
                          </label>
                          <select
                            value={item.warehouseId}
                            onChange={(e) => handleUpdateItem(index, "warehouseId", Number(e.target.value))}
                            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none"
                          >
                            {warehouses.map((w) => (
                              <option key={w.id} value={w.id}>
                                🏢 {w.name} ({w.state})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Ticket Allocation Toggle if linked */}
                        {item.ticketId && (
                          <div className="p-2.5 rounded-lg bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-900/40 flex items-center justify-between">
                            <div>
                              <div className="text-xs font-bold text-purple-950 dark:text-purple-200">
                                Linked to Ticket #{item.ticketRefNo || item.ticketId}
                              </div>
                              <div className="text-[10px] text-purple-700 dark:text-purple-400 truncate">
                                {item.clientSiteName || "Client Site"}
                              </div>
                            </div>
                            <label className="inline-flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={item.allocateToTicket}
                                onChange={(e) => handleUpdateItem(index, "allocateToTicket", e.target.checked)}
                                className="w-4 h-4 text-purple-600 rounded cursor-pointer"
                              />
                              <span className="text-xs font-bold text-purple-900 dark:text-purple-200">
                                Auto-Reserve
                              </span>
                            </label>
                          </div>
                        )}
                      </div>

                      {/* Serial Number Entry if SERIALIZED */}
                      {item.trackingType === "SERIALIZED" && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                              <Barcode className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Serial Numbers (Enter {item.receivingQty} serials, 1 per line or scanned) *</span>
                            </label>
                            <button
                              type="button"
                              onClick={() => handleGenerateSerials(index)}
                              className="text-[11px] text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Sparkles className="w-3 h-3" />
                              <span>Auto-Generate</span>
                            </button>
                          </div>
                          <textarea
                            rows={Math.max(2, item.receivingQty)}
                            placeholder={`Enter serial numbers here:\nSN-123456\nSN-123457`}
                            value={item.serialNumbersText}
                            onChange={(e) => handleUpdateItem(index, "serialNumbersText", e.target.value)}
                            className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-emerald-500/40 outline-none"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Inbound Inspection Remarks */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Inbound Inspection Notes (Package condition, seal intact, etc.)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Unboxed in good condition, anti-static seal intact..."
              value={inboundNotes}
              onChange={(e) => setInboundNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none"
            />
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? "Restocking Inventory..." : "Confirm Inbound & Restock"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
