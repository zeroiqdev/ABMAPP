export type UserRole =
  | 'customer'
  | 'admin'
  | 'technician'
  | 'storekeeper'
  | 'accountant'
  | 'service_advisor'
  | 'vendor'
  | 'super_admin'
  | string;

export type JobStatus =
  | 'received'
  | 'diagnosed'
  | 'repairing'
  | 'completed'
  | 'cancelled';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_paid';

export type QuoteStatus = 'draft' | 'pending_approval' | 'rejected' | 'converted' | 'cancelled';

export type InvoiceStatus = 'pending_approval' | 'approved' | 'in_progress' | 'settled' | 'void';

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: UserRole;
  workshopId?: string; // Current/Active Workshop ID
  connectedWorkshopIds?: string[]; // List of all workshops this user belongs to

  // Vendor specific fields
  vendorStatus?: 'active' | 'pending_details' | 'pending_approval' | 'rejected';
  rejectionReason?: string;
  businessDetails?: {
    businessName: string;
    rcNumber: string;
    address: string;
    city: string;
    state: string;
    country: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    contactName?: string;
    contactRole?: string;
    nin?: string;
  };
  documents?: {
    ninImage?: string;
    proofOfAddress?: string;
    certificateOfIncorporation?: string;
  };

  // Notification preferences
  pushNotificationsEnabled?: boolean;
  emailNotificationsEnabled?: boolean;
  pushToken?: string;

  // Customer workshop selection (for customers only)
  selectedWorkshopIds?: string[];    // Workshops customer selected at signup
  addedByWorkshopIds?: string[];     // Workshops that added this customer

  createdAt: Date;
  updatedAt: Date;
  birthday?: string; // Format: YYYY-MM-DD
}


export interface Vehicle {
  id: string;
  userId: string;
  vin: string;
  licensePlate: string;
  make: string;
  model: string;
  year: number;
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StatusHistoryEntry {
  fromStatus: JobStatus;
  toStatus: JobStatus;
  changedBy: string;      // User ID
  changedByName: string;  // User name for display
  changedAt: Date;
}

export interface Job {
  id: string;
  userId: string;
  vehicleId: string;
  workshopId: string;
  type: 'service' | 'complaint' | 'repair' | 'service_and_repair' | 'tow';
  issues?: string[]; // Selected issue categories
  description: string;
  status: JobStatus;
  assignedTechnicianId?: string; // Legacy: single technician
  technicianName?: string; // Legacy: single technician name
  assignedTechnicianIds?: string[]; // New: multiple technicians
  technicianNames?: string[]; // New: multiple technician names
  images?: string[];
  videos?: string[];
  scheduledDate?: Date;
  partsUsed?: PartUsed[];
  notes?: string;
  serviceCharge?: number;
  statusHistory?: StatusHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface PartUsed {
  partId: string;
  partName: string;
  quantity: number;
  unitPrice: number;
}

export interface PaymentRecord {
  amount: number;
  date: Date;
  method: string;
  recordedBy?: string;
  recordedByName?: string;
  reference?: string;
  note?: string;
  entityType?: 'quote' | 'invoice';
  entityId?: string;
}

export interface PendingPayment {
  id: string;
  amount: number;
  method: string;
  recordedBy: string;
  recordedByName: string;
  date: Date;
  status: 'pending' | 'confirmed' | 'rejected';
}

export interface ApprovalEntry {
  approvedBy: string;
  approvedByName: string;
  approvedAmount: number;
  approvedAt: Date;
}

export interface QuoteItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  isAdditionalWork: boolean;
  addedAt: Date;
  approvedAt?: Date;
}

export interface QuoteLogEntry {
  action: 'create' | 'edit' | 'send' | 'reject' | 'approve' | 'convert' | 'other';
  description: string;
  userId: string;
  userName: string;
  timestamp: Date;
}

export interface Quote {
  id: string;
  workshopId: string;
  jobId?: string;

  // Customer
  userId?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  customerId?: string; // Sometimes used instead of userId

  // Items & Pricing
  items: QuoteItem[];
  subtotal: number;
  vatRate: number;
  vat: number;
  discount: number;
  total: number;

  // Workflow
  status: QuoteStatus;
  convertedToInvoiceId?: string;
  rejectionReason?: string;
  history?: QuoteLogEntry[]; // Audit trail

  createdAt: Date;
  updatedAt: Date;
  sentAt?: Date;
}

export interface Invoice {
  id: string;
  jobId?: string;
  userId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  workshopId: string;
  items: InvoiceItem[];
  pendingItems?: InvoiceItem[];      // Unapproved additions
  subtotal: number;
  vat: number;
  vatRate?: number;
  discount: number;
  total: number;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  paymentDate?: Date;
  dueDate?: Date;
  amountPaid?: number;
  paymentHistory?: PaymentRecord[];
  pendingPayments?: PendingPayment[];
  status: 'draft' | 'approved' | 'void';  // Backwards compat
  invoiceStatus?: InvoiceStatus;          // New workflow status
  approvedAt?: Date;
  approvedBy?: string;
  approvalHistory?: ApprovalEntry[];      // All approvals
  sourceQuoteId?: string;                 // Original quote
  lastUpdatedAt?: Date;                   // Last staff edit time
  wasUpdated?: boolean;                   // Flag for customer notification
  createdAt: Date;
}

export interface InvoiceItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface InventoryItem {
  id: string;
  workshopId: string;
  name: string;
  category: string;
  quantity: number;
  minStockLevel: number;
  unitPrice: number;
  supplier?: string;
  vendor?: string; // Vendor/supplier name
  sku?: string; // Stock Keeping Unit
  costPrice?: number; // Cost price per unit
  sellingPrice?: number; // Selling price per unit
  unitIds?: string[]; // Unique IDs/Serial numbers for each unit
  createdAt: Date;
  updatedAt: Date;
}

export interface StockTransaction {
  id: string;
  workshopId: string;
  itemId: string;
  type: 'stock_in' | 'stock_out';
  quantity: number;
  reason: string;
  approvedBy?: string;
  createdAt: Date;
}

export interface MarketplaceProduct {
  id: string;
  vendorId: string;
  userId?: string; // Author of the post
  name: string;
  description: string;
  category: string;
  price: number;
  images: string[];
  compatibility: string[]; // Vehicle makes/models
  stock: number;
  brand?: string;
  rating?: number;
  reviews?: number;
  soldCount?: number;
  condition?: 'new' | 'used' | 'refurbished';
  approved: boolean;
  createdAt: Date;
}

export interface Order {
  id: string;
  userId: string;
  products: OrderItem[];
  total: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'shipment_verified' | 'delivered' | 'cancelled';
  deliveryMethod: 'delivery' | 'pickup';
  shippingAddress?: string;
  vendorIds?: string[];
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  createdAt: Date;
  payoutStatus?: 'pending' | 'processing' | 'paid' | 'failed';
  adminNotes?: string;
  monnifyPaymentDetails?: {
    accountNumber: string;
    accountName: string;
    bankName: string;
    reference: string;
  };
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  vendorId?: string; // Add vendorId to item for easier extraction
  image?: string;
}

export interface Workshop {
  id: string;
  name: string;
  address?: string;
  subscriptionStatus: 'active' | 'inactive' | 'trial';
  subscriptionPlan: 'basic' | 'premium' | 'enterprise';
  subscriptionExpiry?: Date;
  settings: {
    vatRate: number;
    currency: string;
  };
  createdAt: Date;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message?: string; // specific to old usages
  body?: string; // explicit body content
  type: 'job_update' | 'payment' | 'inventory' | 'general' | 'order';
  read: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface CustomerRegistration {
  id: string;
  email: string;
  name: string;
  phone: string;
  registrationCode: string;
  registeredBy: string;
  workshopId: string;
  birthday?: string;
  used: boolean;
  createdAt: Date;
  usedAt?: Date;
}

export interface StaffInvitation {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  invitationCode: string;
  invitedBy: string;
  workshopId: string;
  birthday?: string;
  used: boolean;
  createdAt: Date;
  usedAt?: Date;
  expiresAt?: Date;
}

export interface ChatMessage {
  id: string;
  jobId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  text?: string;
  imageUrl?: string;
  createdAt: Date;
  readBy: string[];
}

export interface RolePermissions {
  role: UserRole;
  permissions: {
    canManageJobs: boolean;
    canViewInventory: boolean;
    canManageInventory: boolean;
    canViewFinance: boolean;
    canManageFinance: boolean;
    canManageStaff: boolean;
    canManageSettings: boolean;
    canViewReports: boolean;
  };
}
