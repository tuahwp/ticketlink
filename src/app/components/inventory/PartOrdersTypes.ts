export type PartOrderStatus =
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "ORDERED"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "CANCELLED";

export type PartOrderRecipientType =
  | "WAREHOUSE"
  | "SERVICE_PARTNER"
  | "FIELD_ENGINEER"
  | "TICKET_SITE"
  | "CUSTOM";

export type SourcingPlatform =
  | "SHOPEE"
  | "LAZADA"
  | "DIRECT_SUPPLIER"
  | "LOCAL_STORE"
  | "BOSS_PURCHASE"
  | "OTHER";

export interface PartOrderItem {
  id: number;
  orderId: number;
  partName: string;
  category: string;
  partNumber?: string | null;
  trackingType: "SERIALIZED" | "BULK";
  quantity: number;
  unitCost: number;
  totalCost: number;
  receivedQuantity: number;
  warehouseId: number;
  warehouse?: {
    id: number;
    name: string;
    state?: string;
  };
  ownership: "HQ_CONSIGNED" | "PARTNER_OWNED";
  ticketId?: number | null;
  ticket?: {
    id: number;
    ticketRefNo: string | null;
    clientSiteName: string;
    state: string;
    status: string;
    subject?: string | null;
  } | null;
  ticketSparePartId?: number | null;
  isFullyReceived: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface PartOrder {
  id: number;
  poNumber: string;
  status: PartOrderStatus;
  sourcingPlatform: SourcingPlatform;
  supplierName?: string | null;
  externalOrderRef?: string | null;
  orderUrl?: string | null;

  // Financials
  subtotalCost: number;
  shippingCost: number;
  totalCost: number;
  paymentMethod?: string | null;
  paidBy?: string | null;
  receiptAttachments?: Array<{
    id: string;
    name: string;
    url: string;
    type?: string;
    size?: number;
    uploadedAt?: string;
  }> | null;

  // Shipping & Tracking
  courierName?: string | null;
  trackingNo?: string | null;
  estimatedDelivery?: string | Date | null;

  // Recipient
  recipientType: PartOrderRecipientType;
  targetWarehouseId?: number | null;
  targetWarehouse?: {
    id: number;
    name: string;
    state: string;
    address?: string | null;
    contactPerson?: string | null;
    contactPhone?: string | null;
  } | null;
  targetPartnerId?: number | null;
  targetPartner?: {
    id: number;
    name: string;
    address?: string | null;
    phone?: string | null;
  } | null;
  recipientName: string;
  recipientPhone?: string | null;
  deliveryAddress: string;
  deliveryNotes?: string | null;

  // Audit
  notes?: string | null;
  requestedBy: string;
  approvedBy?: string | null;
  approvedAt?: string | Date | null;
  rejectionReason?: string | null;
  orderedBy?: string | null;
  orderedAt?: string | Date | null;
  receivedBy?: string | null;
  receivedAt?: string | Date | null;

  items: PartOrderItem[];
  createdAt: string | Date;
  updatedAt: string | Date;
}
