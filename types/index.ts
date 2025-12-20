export type UserRole =
  | 'customer'
  | 'admin'
  | 'technician'
  | 'storekeeper'
  | 'accountant'
  | 'service_advisor'
  | 'vendor';

export type JobStatus =
  | 'received'
  | 'diagnosed'
  | 'repairing'
  | 'completed'
  | 'cancelled';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_paid';

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: UserRole;
  workshopId?: string; // For multi-tenant support
  createdAt: Date;
  updatedAt: Date;
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

export interface Job {
  id: string;
  userId: string;
  vehicleId: string;
  workshopId: string;
  type: 'service' | 'complaint' | 'repair' | 'service_and_repair' | 'tow';
  issues?: string[]; // Selected issue categories
  description: string;
  status: JobStatus;
  assignedTechnicianId?: string;
  technicianName?: string;
  images?: string[];
  videos?: string[];
  scheduledDate?: Date;
  partsUsed?: PartUsed[];
  notes?: string;
  serviceCharge?: number;
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
}

export interface Invoice {
  id: string;
  jobId: string;
  userId: string;
  workshopId: string;
  items: InvoiceItem[];
  subtotal: number;
  vat: number;
  discount: number;
  total: number;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  paymentDate?: Date;
  dueDate?: Date;
  amountPaid?: number;
  paymentHistory?: PaymentRecord[];
  status: 'draft' | 'approved' | 'void';
  approvedAt?: Date;
  approvedBy?: string;
  createdAt: Date;
}

export interface InvoiceItem {
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
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  deliveryMethod: 'delivery' | 'pickup';
  shippingAddress?: string;
  createdAt: Date;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export interface Workshop {
  id: string;
  name: string;
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
  message: string;
  type: 'job_update' | 'payment' | 'inventory' | 'general';
  read: boolean;
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
