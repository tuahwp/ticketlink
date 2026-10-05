"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Plus,
  Trash2,
  Building2,
  Truck,
  DollarSign,
  ShoppingCart,
  Receipt,
  Link as LinkIcon,
  Package,
  User,
  Phone,
  MapPin,
  FileText,
  AlertCircle,
  ExternalLink,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { createPartOrderAction } from "../../actions";
import { PartOrderRecipientType, SourcingPlatform } from "./PartOrdersTypes";

interface Warehouse {
  id: number;
  name: string;
  state: string;
  address?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
  partnerId?: number | null;
}

interface ServicePartner {
  id: number;
  name: string;
  address?: string | null;
  phone?: string | null;
  statesCovered?: any;
}

interface TicketOption {
  id: number;
  ticketRefNo?: string | null;
  clientSiteName: string;
  state: string;
  status: string;
  address?: string | null;
  assignedFe?: {
    id?: number;
    name: string;
    phone?: string;
  } | null;
}

export interface InitialOrderItem {
  partName: string;
  quantity: number;
  category?: string;
  partNumber?: string;
  trackingType?: "SERIALIZED" | "BULK";
  unitCost?: number;
  warehouseId?: number;
  ticketId?: number | null;
  ticketSparePartId?: number | null;
  clientSiteName?: string;
}

interface CreatePartOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  warehouses: Warehouse[];
  servicePartners: ServicePartner[];
  tickets?: TicketOption[];
  categories: string[];
  currentUserRole?: string;
  currentUserName?: string;
  initialItems?: InitialOrderItem[];
  preselectedTicketId?: number | null;
  preselectedPartName?: string;
  onOrderCreated: () => void;
}

export default function CreatePartOrderModal({
  isOpen,
  onClose,
  warehouses,
  servicePartners,
  tickets = [],
  categories,
  currentUserRole = "MODERATOR",
  currentUserName = "Staff",
  initialItems,
  preselectedTicketId,
  preselectedPartName,
  onOrderCreated,
}: CreatePartOrderModalProps) {
  // Step state: 1 = Parts, 2 = Sourcing & Shipping, 3 = Payment & Confirmation
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  const defaultWarehouseId = warehouses[0]?.id || 1;

  // Step 1: Line Items
  const [lineItems, setLineItems] = useState<
    Array<{
      partName: string;
      category: string;
      partNumber: string;
      trackingType: "SERIALIZED" | "BULK";
      quantity: number;
      unitCost: number;
      warehouseId: number;
      ownership: "HQ_CONSIGNED" | "PARTNER_OWNED";
      ticketId: number | null;
      ticketSparePartId?: number | null;
      clientSiteName?: string;
    }>
  >(() => {
    if (initialItems && initialItems.length > 0) {
      return initialItems.map((item) => ({
        partName: item.partName,
        category: item.category || "Spare Parts",
        partNumber: item.partNumber || "",
        trackingType: item.trackingType || "SERIALIZED",
        quantity: item.quantity || 1,
        unitCost: item.unitCost || 0,
        warehouseId: item.warehouseId || defaultWarehouseId,
        ownership: "HQ_CONSIGNED",
        ticketId: item.ticketId || null,
        ticketSparePartId: item.ticketSparePartId || null,
        clientSiteName: item.clientSiteName,
      }));
    }

    return [
      {
        partName: preselectedPartName || "",
        category: "Power Supply",
        partNumber: "",
        trackingType: "SERIALIZED",
        quantity: 1,
        unitCost: 0,
        warehouseId: defaultWarehouseId,
        ownership: "HQ_CONSIGNED",
        ticketId: preselectedTicketId ? Number(preselectedTicketId) : null,
      },
    ];
  });

  // Step 2: Sourcing & Recipient
  const [sourcingPlatform, setSourcingPlatform] = useState<SourcingPlatform>("SHOPEE");
  const [supplierName, setSupplierName] = useState("");
  const [recipientType, setRecipientType] = useState<PartOrderRecipientType>("WAREHOUSE");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(String(defaultWarehouseId));
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>("");
  const [selectedTicketIdForAddress, setSelectedTicketIdForAddress] = useState<string>(
    preselectedTicketId ? String(preselectedTicketId) : ""
  );
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");

  // Step 3: Logistics, Financials & Ref
  const [externalOrderRef, setExternalOrderRef] = useState("");
  const [orderUrl, setOrderUrl] = useState("");
  const [courierName, setCourierName] = useState("Shopee Xpress");
  const [trackingNo, setTrackingNo] = useState("");
  const [estimatedDelivery, setEstimatedDelivery] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("COMPANY_CARD");
  const [paidBy, setPaidBy] = useState(currentUserName);
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [initialStatus, setInitialStatus] = useState<"PENDING_APPROVAL" | "ORDERED">("ORDERED");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync initial items if props change
  useEffect(() => {
    if (initialItems && initialItems.length > 0) {
      setLineItems(
        initialItems.map((item) => ({
          partName: item.partName,
          category: item.category || "Spare Parts",
          partNumber: item.partNumber || "",
          trackingType: item.trackingType || "SERIALIZED",
          quantity: item.quantity || 1,
          unitCost: item.unitCost || 0,
          warehouseId: item.warehouseId || defaultWarehouseId,
          ownership: "HQ_CONSIGNED",
          ticketId: item.ticketId || null,
          ticketSparePartId: item.ticketSparePartId || null,
          clientSiteName: item.clientSiteName,
        }))
      );
    }
  }, [initialItems, defaultWarehouseId]);

  // Auto-populate recipient info when Warehouse changes
  useEffect(() => {
    if (recipientType === "WAREHOUSE" && selectedWarehouseId) {
      const wh = warehouses.find((w) => w.id === Number(selectedWarehouseId));
      if (wh) {
        setRecipientName(wh.contactPerson || `${wh.name} Manager`);
        setRecipientPhone(wh.contactPhone || "");
        setDeliveryAddress(wh.address || `${wh.name}, ${wh.state}`);
      }
    }
  }, [recipientType, selectedWarehouseId, warehouses]);

  // Auto-populate when Service Partner changes
  useEffect(() => {
    if (recipientType === "SERVICE_PARTNER" && selectedPartnerId) {
      const sp = servicePartners.find((p) => p.id === Number(selectedPartnerId));
      if (sp) {
        setRecipientName(`${sp.name} Operations`);
        setRecipientPhone(sp.phone || "");
        setDeliveryAddress(sp.address || `${sp.name} Hub`);
      }
    }
  }, [recipientType, selectedPartnerId, servicePartners]);

  // Auto-populate when Ticket changes
  useEffect(() => {
    if (recipientType === "TICKET_SITE" && selectedTicketIdForAddress) {
      const t = tickets.find((tick) => tick.id === Number(selectedTicketIdForAddress));
      if (t) {
        setRecipientName(t.assignedFe?.name ? `${t.assignedFe.name} (FE)` : `${t.clientSiteName} PIC`);
        setRecipientPhone(t.assignedFe?.phone || "");
        setDeliveryAddress(t.address || `${t.clientSiteName}, ${t.state}`);
        setDeliveryNotes(`Urgent part delivery for Ticket #${t.ticketRefNo || t.id}`);
      }
    }
  }, [recipientType, selectedTicketIdForAddress, tickets]);

  // Calculation helpers
  const calculatedSubtotal = useMemo(() => {
    return lineItems.reduce((acc, item) => acc + (Number(item.unitCost) || 0) * (Number(item.quantity) || 1), 0);
  }, [lineItems]);

  const totalOrderAmount = useMemo(() => {
    return calculatedSubtotal + (Number(shippingCost) || 0);
  }, [calculatedSubtotal, shippingCost]);

  const handleAddLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        partName: "",
        category: "Power Supply",
        partNumber: "",
        trackingType: "SERIALIZED",
        quantity: 1,
        unitCost: 0,
        warehouseId: defaultWarehouseId,
        ownership: "HQ_CONSIGNED",
        ticketId: null,
      },
    ]);
  };

  const handleRemoveLineItem = (index: number) => {
    if (lineItems.length <= 1) {
      toast.error("An order must contain at least 1 part item.");
      return;
    }
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateLineItem = (index: number, field: string, value: any) => {
    setLineItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Step navigation validations
  const handleNextStep = () => {
    if (currentStep === 1) {
      const invalid = lineItems.some((i) => !i.partName.trim() || i.quantity <= 0);
      if (invalid) {
        toast.error("Please enter a part name and quantity for all items.");
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!recipientName.trim() || !deliveryAddress.trim()) {
        toast.error("Please provide a recipient contact name and delivery address.");
        return;
      }
      setCurrentStep(3);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!recipientName.trim() || !deliveryAddress.trim()) {
      toast.error("Please provide a recipient name and delivery address.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await createPartOrderAction({
        sourcingPlatform,
        supplierName: supplierName.trim() || undefined,
        externalOrderRef: externalOrderRef.trim() || undefined,
        orderUrl: orderUrl.trim() || undefined,
        subtotalCost: calculatedSubtotal,
        shippingCost: Number(shippingCost) || 0,
        totalCost: totalOrderAmount,
        paymentMethod,
        paidBy: paidBy.trim() || currentUserName,
        courierName: courierName.trim() || undefined,
        trackingNo: trackingNo.trim() || undefined,
        estimatedDelivery: estimatedDelivery || undefined,
        recipientType,
        targetWarehouseId: recipientType === "WAREHOUSE" ? Number(selectedWarehouseId) : undefined,
        targetPartnerId: recipientType === "SERVICE_PARTNER" ? Number(selectedPartnerId) : undefined,
        recipientName: recipientName.trim(),
        recipientPhone: recipientPhone.trim() || undefined,
        deliveryAddress: deliveryAddress.trim(),
        deliveryNotes: deliveryNotes.trim() || undefined,
        notes: notes.trim() || undefined,
        status: initialStatus,
        items: lineItems.map((item) => ({
          partName: item.partName.trim(),
          category: item.category,
          partNumber: item.partNumber.trim() || undefined,
          trackingType: item.trackingType,
          quantity: Number(item.quantity) || 1,
          unitCost: Number(item.unitCost) || 0,
          totalCost: (Number(item.unitCost) || 0) * (Number(item.quantity) || 1),
          warehouseId: Number(item.warehouseId),
          ownership: item.ownership,
          ticketId: item.ticketId ? Number(item.ticketId) : null,
          ticketSparePartId: item.ticketSparePartId ? Number(item.ticketSparePartId) : null,
        })),
      });

      if (res.success) {
        toast.success(`Purchase Order ${res.order?.poNumber} created successfully!`);
        onOrderCreated();
        onClose();
      } else {
        toast.error(res.error || "Failed to create purchase order.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "An error occurred while creating order.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in">
      <div className="relative w-full max-w-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col text-left">
        {/* Header & Step Indicator */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-gradient-to-r from-indigo-50/70 via-white to-purple-50/70 dark:from-zinc-900 dark:to-zinc-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                  Create Part Purchase Order
                </h2>
                <p className="text-xs text-zinc-500">
                  Step {currentStep} of 3:{" "}
                  {currentStep === 1
                    ? "Review Parts to Order"
                    : currentStep === 2
                    ? "Sourcing & Delivery Destination"
                    : "Payment & Confirmation"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stepper Wizard Indicator */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            {[
              { num: 1, title: "1. Parts List", subtitle: `${lineItems.length} items` },
              { num: 2, title: "2. Shipping", subtitle: sourcingPlatform },
              { num: 3, title: "3. Confirm", subtitle: `RM ${totalOrderAmount.toFixed(2)}` },
            ].map((step) => {
              const isActive = currentStep === step.num;
              const isPast = currentStep > step.num;

              return (
                <button
                  key={step.num}
                  type="button"
                  onClick={() => {
                    if (step.num < currentStep) setCurrentStep(step.num as any);
                  }}
                  className={`p-2 rounded-xl border text-left transition flex items-center gap-2.5 cursor-pointer ${
                    isActive
                      ? "border-indigo-600 bg-indigo-50/90 dark:bg-indigo-950/60 text-indigo-950 dark:text-indigo-200 ring-2 ring-indigo-500/20 font-bold"
                      : isPast
                      ? "border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300"
                      : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 text-zinc-400 opacity-60"
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                      isActive
                        ? "bg-indigo-600 text-white"
                        : isPast
                        ? "bg-emerald-600 text-white"
                        : "bg-zinc-200 dark:bg-zinc-700 text-zinc-500"
                    }`}
                  >
                    {isPast ? <Check className="w-3.5 h-3.5" /> : step.num}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs truncate">{step.title}</div>
                    <div className="text-[10px] opacity-75 truncate">{step.subtitle}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Modal Body: STEP 1 */}
        {currentStep === 1 && (
          <div className="overflow-y-auto p-6 space-y-4 flex-1 text-xs sm:text-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-purple-500" />
                <span>Parts in this Order ({lineItems.length})</span>
              </span>
              <button
                type="button"
                onClick={handleAddLineItem}
                className="px-3 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 rounded-xl border border-indigo-200 dark:border-indigo-800 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="space-y-3">
              {lineItems.map((item, index) => (
                <div
                  key={index}
                  className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/60 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-zinc-700 dark:text-zinc-300">
                        Item #{index + 1}
                      </span>
                      {item.clientSiteName && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                          🎯 Ticket #{item.ticketId} ({item.clientSiteName})
                        </span>
                      )}
                    </div>
                    {lineItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveLineItem(index)}
                        className="text-zinc-400 hover:text-rose-600 transition p-1 cursor-pointer"
                        title="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                        Part Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Dell Motherboard, 16GB DDR4 RAM, Power Supply"
                        value={item.partName}
                        onChange={(e) => handleUpdateLineItem(index, "partName", e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/40"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                        Tracking Format
                      </label>
                      <select
                        value={item.trackingType}
                        onChange={(e) => handleUpdateLineItem(index, "trackingType", e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none font-semibold"
                      >
                        <option value="SERIALIZED">🏷️ Serialized (Unique S/N)</option>
                        <option value="BULK">📦 Bulk Count</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                        Quantity *
                      </label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={item.quantity}
                        onChange={(e) =>
                          handleUpdateLineItem(index, "quantity", Math.max(1, parseInt(e.target.value) || 1))
                        }
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/40 font-bold text-center"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                        Est. Unit Cost (RM)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        placeholder="0.00"
                        value={item.unitCost || ""}
                        onChange={(e) =>
                          handleUpdateLineItem(index, "unitCost", parseFloat(e.target.value) || 0)
                        }
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                        Target Depot
                      </label>
                      <select
                        value={item.warehouseId}
                        onChange={(e) => handleUpdateLineItem(index, "warehouseId", Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none"
                      >
                        {warehouses.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                        Link Ticket
                      </label>
                      <select
                        value={item.ticketId || ""}
                        onChange={(e) =>
                          handleUpdateLineItem(index, "ticketId", e.target.value ? Number(e.target.value) : null)
                        }
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none"
                      >
                        <option value="">-- General Stock --</option>
                        {tickets.map((t) => (
                          <option key={t.id} value={t.id}>
                            #{t.ticketRefNo || t.id} ({t.clientSiteName})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Step 1 Summary Footer */}
            <div className="p-3.5 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 flex items-center justify-between">
              <span className="text-xs text-zinc-500 font-medium">
                Total Parts: <strong>{lineItems.reduce((acc, i) => acc + (Number(i.quantity) || 1), 0)} units</strong>
              </span>
              <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                Est. Subtotal: <strong className="font-mono text-indigo-600 dark:text-indigo-400">RM {calculatedSubtotal.toFixed(2)}</strong>
              </span>
            </div>
          </div>
        )}

        {/* Modal Body: STEP 2 (SOURCING & SHIPPING) */}
        {currentStep === 2 && (
          <div className="overflow-y-auto p-6 space-y-5 flex-1 text-xs sm:text-sm">
            {/* Sourcing Platform Selector */}
            <div className="space-y-2.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
                1. Where are you purchasing this from?
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: "SHOPEE", label: "Shopee", icon: "🟠" },
                  { id: "LAZADA", label: "Lazada", icon: "🟣" },
                  { id: "DIRECT_SUPPLIER", label: "OEM Supplier", icon: "🔵" },
                  { id: "BOSS_PURCHASE", label: "Boss Cash Purchase", icon: "🟢" },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSourcingPlatform(p.id as SourcingPlatform);
                      if (p.id === "SHOPEE") setCourierName("Shopee Xpress");
                      else if (p.id === "LAZADA") setCourierName("Lazada Express");
                      else if (p.id === "DIRECT_SUPPLIER") setCourierName("Supplier Delivery / PosLaju");
                    }}
                    className={`p-3 rounded-xl border text-center transition cursor-pointer ${
                      sourcingPlatform === p.id
                        ? "border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/50 text-indigo-950 dark:text-indigo-200 ring-2 ring-indigo-500/20 font-bold"
                        : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    <div className="text-xl mb-1">{p.icon}</div>
                    <div className="text-xs">{p.label}</div>
                  </button>
                ))}
              </div>

              <div className="pt-1">
                <input
                  type="text"
                  placeholder="Optional: Shop/Supplier Name (e.g. Dell Official Store)"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none"
                />
              </div>
            </div>

            {/* Destination Selector */}
            <div className="space-y-2.5 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
                2. Where should the supplier deliver the parcel?
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: "WAREHOUSE", label: "HQ / Warehouse", icon: Building2 },
                  { id: "SERVICE_PARTNER", label: "Partner Depot", icon: Truck },
                  { id: "TICKET_SITE", label: "Ticket Client Site", icon: MapPin },
                  { id: "CUSTOM", label: "Custom Address", icon: FileText },
                ].map((r) => {
                  const Icon = r.icon;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRecipientType(r.id as PartOrderRecipientType)}
                      className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition cursor-pointer ${
                        recipientType === r.id
                          ? "border-blue-600 bg-blue-50/80 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 ring-2 ring-blue-500/20 font-bold"
                          : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      <Icon className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="text-xs truncate">{r.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Sub-selectors */}
              {recipientType === "WAREHOUSE" && (
                <select
                  value={selectedWarehouseId}
                  onChange={(e) => setSelectedWarehouseId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      🏢 {w.name} ({w.state}) - {w.address || "Main Hub"}
                    </option>
                  ))}
                </select>
              )}

              {recipientType === "SERVICE_PARTNER" && (
                <select
                  value={selectedPartnerId}
                  onChange={(e) => setSelectedPartnerId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none"
                >
                  <option value="">-- Choose Partner Depot --</option>
                  {servicePartners.map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      🤝 {sp.name} ({sp.address || "Depot"})
                    </option>
                  ))}
                </select>
              )}

              {recipientType === "TICKET_SITE" && (
                <select
                  value={selectedTicketIdForAddress}
                  onChange={(e) => setSelectedTicketIdForAddress(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none"
                >
                  <option value="">-- Choose Target Ticket --</option>
                  {tickets.map((t) => (
                    <option key={t.id} value={t.id}>
                      #{t.ticketRefNo || t.id} - {t.clientSiteName} ({t.state})
                    </option>
                  ))}
                </select>
              )}

              {/* Auto-filled details */}
              <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                    Recipient PIC Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ali (HQ Warehouse)"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. +60 12-345 6789"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                    Delivery Address *
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Delivery street address..."
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Body: STEP 3 (CONFIRMATION & PAYMENT) */}
        {currentStep === 3 && (
          <div className="overflow-y-auto p-6 space-y-5 flex-1 text-xs sm:text-sm">
            {/* Order Review Box */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50/70 to-teal-50/70 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-200 dark:border-emerald-900/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  Order Summary
                </span>
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-white dark:bg-zinc-900 border border-emerald-200">
                  {sourcingPlatform}
                </span>
              </div>

              <div className="space-y-1 text-xs text-zinc-700 dark:text-zinc-300">
                <div>
                  <strong>{lineItems.length} Part(s):</strong>{" "}
                  {lineItems.map((i) => `${i.quantity}x ${i.partName}`).join(", ")}
                </div>
                <div>
                  <strong>Deliver to:</strong> {recipientName} ({deliveryAddress})
                </div>
              </div>

              <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-900/60 flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Total Order Amount:</span>
                <span className="font-mono font-black text-base text-emerald-700 dark:text-emerald-400">
                  RM {totalOrderAmount.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Optional Logistics & External ID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Shopee / Platform Order ID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 241005ABC99"
                  value={externalOrderRef}
                  onChange={(e) => setExternalOrderRef(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white font-mono outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Tracking / AWB Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. SPXMY01234567"
                  value={trackingNo}
                  onChange={(e) => setTrackingNo(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white font-mono outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none"
                >
                  <option value="COMPANY_CARD">💳 Company Debit/Credit Card</option>
                  <option value="BOSS_REIMBURSEMENT">💵 Boss Direct / Reimbursement</option>
                  <option value="PETTY_CASH">🪙 Petty Cash Voucher</option>
                  <option value="INVOICE_TERMS">📄 30-Day Supplier Invoice</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Initial Status
                </label>
                <select
                  value={initialStatus}
                  onChange={(e) => setInitialStatus(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none font-bold"
                >
                  <option value="ORDERED">🚚 Already Purchased (In Transit)</option>
                  <option value="PENDING_APPROVAL">⏳ Awaiting Approval</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Wizard Footer Controls */}
        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => (prev - 1) as any)}
              className="px-4 py-2 text-xs font-bold rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition cursor-pointer flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              Cancel
            </button>
          )}

          {currentStep < 3 ? (
            <button
              type="button"
              onClick={handleNextStep}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition cursor-pointer flex items-center gap-1.5"
            >
              <span>Continue to Step {currentStep + 1}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-6 py-2.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? "Creating Order..." : "Confirm & Place Purchase Order"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
