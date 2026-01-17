
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  Timestamp,
  onSnapshot,
  QueryConstraint,
  writeBatch,
  arrayUnion,
  deleteField,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject, uploadString } from 'firebase/storage';
import { sendPasswordResetEmail } from 'firebase/auth'; // Added
import * as FileSystem from 'expo-file-system';
import { db, storage, auth } from '@/config/firebase'; // Added auth
import { uploadImageToCloudinary, uploadMultipleImagesToCloudinary } from './cloudinaryService';
import {
  User,
  Vehicle,
  Job,
  Invoice,
  InventoryItem,
  StockTransaction,
  MarketplaceProduct,
  Order,
  Workshop,
  Notification,
  CustomerRegistration,
  StaffInvitation,
  ChatMessage,
  RolePermissions,
} from '@/types';

export const firebaseService = {
  async sendPasswordResetEmail(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email);
  },

  async getUser(userId: string): Promise<User | null> {
    // ... rest of the file

    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as User;
    }
    return null;
  },

  async getUsersByWorkshop(workshopId: string): Promise<User[]> {
    const q = query(collection(db, 'users'), where('workshopId', '==', workshopId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      };
    }) as User[];
  },

  async updateUser(userId: string, data: Partial<User>): Promise<void> {
    const docRef = doc(db, 'users', userId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now(),
    });
  },

  async submitVendorDetails(userId: string, details: any, documents: any): Promise<void> {
    const docRef = doc(db, 'users', userId);
    await updateDoc(docRef, {
      businessDetails: details,
      documents: documents,
      vendorStatus: 'pending_approval',
      updatedAt: Timestamp.now(),
    });
  },

  async approveVendor(userId: string): Promise<void> {
    const docRef = doc(db, 'users', userId);
    await updateDoc(docRef, {
      vendorStatus: 'active',
      updatedAt: Timestamp.now(),
    });
  },

  async rejectVendor(userId: string, reason?: string): Promise<void> {
    const docRef = doc(db, 'users', userId);
    await updateDoc(docRef, {
      vendorStatus: 'rejected',
      rejectionReason: reason || 'Application declined by admin.',
      updatedAt: Timestamp.now(),
    });
  },

  async savePushToken(userId: string, token: string): Promise<void> {
    const batch = writeBatch(db);

    // 1. Save to private user profile (legacy/admin view)
    const userRef = doc(db, 'users', userId);
    batch.update(userRef, {
      pushToken: token,
      updatedAt: Timestamp.now(),
    });

    // 2. Save to public/shared notification_tokens collection
    // We need to fetch the user's role to store it here for filtering
    // This optimization prevents needing to join with users collection on read
    // But since this is called on login, we might not have fresh role if we don't fetch.
    // However, saving just the token is enough if we trust the client logic, 
    // BUT getAdminTokens needs to filter by role. 
    // So we should fetch the user role first or assume it's passed or stored.
    // Let's just update it.

    // We can't easily get the role inside a batch without a read.
    // Let's just do a set functionality.

    const tokenRef = doc(db, 'notification_tokens', userId);
    // We will update the token. Role might be updated separately or we assume it's set.
    // Actually, to make getAdminTokens work, we MUST store the role here.
    // Let's fetch the user first to be safe, or just accept that maybe we only update token.
    // Better strategy: The App should pass the role to savePushToken or we fetch it.
    // For now, let's fetch the user to get the role.
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const userData = userSnap.data();
      batch.set(tokenRef, {
        token: token,
        role: userData.role || 'customer',
        workshopId: userData.workshopId || null,
        pushEnabled: userData.pushNotificationsEnabled !== false,
        updatedAt: Timestamp.now(),
      });
    }

    await batch.commit();
  },

  async getAdminTokens(): Promise<string[]> {
    try {
      const q = query(
        collection(db, 'notification_tokens'),
        where('role', 'in', ['admin', 'manager', 'super_admin'])
      );
      const snapshot = await getDocs(q);
      const tokens = snapshot.docs
        .filter(doc => doc.data().pushEnabled !== false) // Respect user preference
        .map(doc => doc.data().token)
        .filter(token => token && token.startsWith('ExponentPushToken'));

      // Remove duplicates
      return [...new Set(tokens)];
    } catch (error) {
      console.error('Error fetching admin tokens:', error);
      return [];
    }
  },

  async deleteUser(userId: string): Promise<void> {
    await deleteDoc(doc(db, 'users', userId));
  },

  async deleteAccount(): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error('No user logged in');

    // 1. Delete Firestore user document
    await deleteDoc(doc(db, 'users', user.uid));

    // 2. Delete Authentication user
    // Note: This requires recent login. If it fails with 'auth/requires-recent-login',
    // the UI should prompt user to re-login.
    await user.delete();
  },

  async createCustomer(customer: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'users'), {
      ...customer,
      role: 'customer',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return docRef.id;
  },

  async getUsersByRole(role: string, workshopId: string): Promise<User[]> {
    const q = query(
      collection(db, 'users'),
      where('role', '==', role),
      where('workshopId', '==', workshopId)
    );
    const snapshot = await getDocs(q);
    const users = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      };
    }) as User[];

    // Sort in memory by name ascending
    return users.sort((a, b) => {
      const aName = a.name?.toLowerCase() || '';
      const bName = b.name?.toLowerCase() || '';
      return aName.localeCompare(bName);
    });
  },

  async getVehicle(vehicleId: string): Promise<Vehicle | null> {
    const docRef = doc(db, 'vehicles', vehicleId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt?.toDate(),
        updatedAt: docSnap.data().updatedAt?.toDate(),
      } as Vehicle;
    }
    return null;
  },

  async getVehicles(userId: string): Promise<Vehicle[]> {
    const q = query(
      collection(db, 'vehicles'),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    const vehicles = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    })) as Vehicle[];

    // Sort in memory by createdAt descending
    return vehicles.sort((a, b) => {
      const aDate = a.createdAt?.getTime() || 0;
      const bDate = b.createdAt?.getTime() || 0;
      return bDate - aDate;
    });
  },

  async addVehicle(vehicle: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'vehicles'), {
      ...vehicle,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return docRef.id;
  },

  async updateVehicle(vehicleId: string, data: Partial<Vehicle>): Promise<void> {
    const docRef = doc(db, 'vehicles', vehicleId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now(),
    });
  },

  async deleteVehicle(vehicleId: string): Promise<void> {
    await deleteDoc(doc(db, 'vehicles', vehicleId));
  },

  async getJobs(userId?: string, workshopId?: string, status?: string[]): Promise<Job[]> {
    const constraints: QueryConstraint[] = [];
    if (userId) {
      constraints.push(where('userId', '==', userId));
    }
    if (workshopId) {
      constraints.push(where('workshopId', '==', workshopId));
    }
    if (status && status.length > 0) {
      constraints.push(where('status', 'in', status));
    }
    constraints.push(orderBy('createdAt', 'desc'));

    const q = query(collection(db, 'jobs'), ...constraints);
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
      scheduledDate: doc.data().scheduledDate?.toDate(),
      completedAt: doc.data().completedAt?.toDate(),
    })) as Job[];
  },

  async getJob(jobId: string): Promise<Job | null> {
    const docRef = doc(db, 'jobs', jobId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt?.toDate(),
        updatedAt: docSnap.data().updatedAt?.toDate(),
        scheduledDate: docSnap.data().scheduledDate?.toDate(),
        completedAt: docSnap.data().completedAt?.toDate(),
      } as Job;
    }
    return null;
  },

  async createJob(job: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'jobs'), {
      ...job,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    // Send Push Notification to Admins
    const { notificationService } = require('./notificationService');
    notificationService.sendPushToAdmins(
      'New Job Request',
      `New ${job.type} request created.`,
      { type: 'job', id: docRef.id }
    ).catch((err: any) => console.log('Failed to send admin push:', err));

    return docRef.id;
  },

  async updateJob(jobId: string, data: Partial<Job>): Promise<void> {
    const docRef = doc(db, 'jobs', jobId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now(),
    });
  },

  async getInvoices(userId?: string, workshopId?: string): Promise<Invoice[]> {
    const constraints: QueryConstraint[] = [];
    if (userId) {
      constraints.push(where('userId', '==', userId));
    }
    if (workshopId) {
      constraints.push(where('workshopId', '==', workshopId));
    }
    constraints.push(orderBy('createdAt', 'desc'));

    const q = query(collection(db, 'invoices'), ...constraints);
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        paymentDate: data.paymentDate?.toDate(),
        dueDate: data.dueDate?.toDate(),
        approvedAt: data.approvedAt?.toDate(),
        status: data.status || 'draft', // Backwards compatibility
        approvedBy: data.approvedBy,
        amountPaid: data.amountPaid || 0,
        paymentHistory: data.paymentHistory
          ? data.paymentHistory.map((record: any) => ({
            ...record,
            date: record.date?.toDate() || new Date(),
          }))
          : [],
      };
    }) as Invoice[];
  },

  async getInvoice(invoiceId: string): Promise<Invoice | null> {
    const docRef = doc(db, 'invoices', invoiceId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        paymentDate: data.paymentDate?.toDate(),
        dueDate: data.dueDate?.toDate(),
        approvedAt: data.approvedAt?.toDate(),
        status: data.status || 'draft',
        approvedBy: data.approvedBy,
        amountPaid: data.amountPaid || 0,
        paymentHistory: data.paymentHistory
          ? data.paymentHistory.map((record: any) => ({
            ...record,
            date: record.date?.toDate() || new Date(),
          }))
          : [],
      } as Invoice;
    }
    return null;
  },

  async createInvoice(invoice: Omit<Invoice, 'id' | 'createdAt'>): Promise<string> {
    // Generate invoice ID in format: INV-CUSTOMERID-XXXX
    // XXXX is last 4 digits of timestamp
    const timestamp = Date.now().toString();
    const lastFour = timestamp.slice(-4);
    // Use first 8 chars of customer ID or 'DIRECT' if no user ID
    const customerIdentifier = invoice.userId ? invoice.userId.slice(0, 8) : 'DIRECT';
    const invoiceId = `INV-${customerIdentifier}-${lastFour}`;

    // Use setDoc with custom ID instead of setDoc
    const docRef = doc(db, 'invoices', invoiceId);
    await setDoc(docRef, {
      ...invoice,
      status: 'draft', // Default status
      createdAt: Timestamp.now(),
    });

    // Send Push Notification to Admins
    const { notificationService } = require('./notificationService');
    notificationService.sendPushToAdmins(
      'New Invoice Created',
      `Invoice #${invoiceId} created for ${customerIdentifier}`,
      { type: 'invoice', id: invoiceId }
    ).catch((err: any) => console.log('Failed to send admin push:', err));

    return invoiceId;
  },

  async updateInvoice(invoiceId: string, data: Partial<Invoice>): Promise<void> {
    const updateData: any = { ...data };
    if (updateData.dueDate) {
      updateData.dueDate = Timestamp.fromDate(updateData.dueDate);
    }
    if (updateData.paymentDate) {
      updateData.paymentDate = Timestamp.fromDate(updateData.paymentDate);
    }
    if (updateData.approvedAt) {
      updateData.approvedAt = Timestamp.fromDate(updateData.approvedAt);
    }
    if (updateData.paymentHistory) {
      updateData.paymentHistory = updateData.paymentHistory.map((record: any) => ({
        ...record,
        date: Timestamp.fromDate(record.date),
      }));
    }
    await updateDoc(doc(db, 'invoices', invoiceId), updateData);
  },

  async approveInvoice(invoiceId: string, approvedBy: string, explicitDueDate?: Date): Promise<void> {
    const now = new Date();
    let dueDate = explicitDueDate;

    if (!dueDate) {
      dueDate = new Date();
      dueDate.setDate(now.getDate() + 7); // Default 7 days if not provided
    }

    await this.updateInvoice(invoiceId, {
      status: 'approved',
      approvedBy,
      approvedAt: now,
      dueDate: dueDate,
    });
  },

  async checkAndSendInvoiceReminders(userId: string): Promise<void> {
    try {
      const user = await this.getUser(userId);
      if (!user?.workshopId) return;

      const invoices = await this.getInvoices(undefined, user.workshopId);
      const approvedInvoices = invoices.filter(inv => inv.status === 'approved' && (!inv.amountPaid || inv.amountPaid < (inv.items || []).reduce((sum, item) => sum + item.total, 0)));

      const now = new Date();
      const batch = [];

      for (const invoice of approvedInvoices) {
        if (!invoice.dueDate) continue;

        const diffTime = invoice.dueDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const invoiceTotal = (invoice.items || []).reduce((sum, item) => sum + item.total, 0);

        // Check if we should remind (7, 2, or 1 days before due)
        if ([7, 2, 1].includes(diffDays)) {
          // Check if we already sent a reminder TODAY for this invoice
          // Since we don't have a complex query, we'll check local storage or a simpler heuristic
          // ideally we'd store 'lastReminderSent' on the invoice, but let's check notifications
          // Optimization: Fetch only recent notifications for this user?
          // For now, let's keep it simple: If we are effectively spamming, we need 'lastReminderDate' on invoice.

          // Let's assume we can add a field to invoice locally to track this without schema change if we use 'any'
          // or we just query notifications.

          const notificationsRef = collection(db, 'notifications');
          const q = query(
            notificationsRef,
            where('userId', '==', invoice.userId),
            where('metadata.invoiceId', '==', invoice.id),
            where('metadata.type', '==', 'invoice_reminder'),
            orderBy('createdAt', 'desc'),
            limit(1)
          );

          const snapshot = await getDocs(q);
          let alreadySentToday = false;

          if (!snapshot.empty) {
            const lastNotif = snapshot.docs[0].data();
            const lastDate = lastNotif.createdAt?.toDate();
            if (lastDate) {
              const isToday = lastDate.toDateString() === now.toDateString();
              if (isToday) alreadySentToday = true;
            }
          }

          if (!alreadySentToday) {
            const notificationData = {
              userId: invoice.userId,
              title: 'Invoice Payment Reminder',
              body: `Invoice #${invoice.id} for ₦${invoiceTotal.toLocaleString()} is due in ${diffDays} day${diffDays > 1 ? 's' : ''}.`,
              read: false,
              createdAt: Timestamp.now(),
              metadata: {
                invoiceId: invoice.id,
                type: 'invoice_reminder'
              }
            };
            await addDoc(collection(db, 'notifications'), notificationData);
            console.log(`Sent reminder for invoice ${invoice.id}`);
          }
        }
      }
    } catch (error) {
      console.error('Error checking invoice reminders:', error);
    }
  },

  async getInventoryItems(workshopId: string): Promise<InventoryItem[]> {
    const q = query(
      collection(db, 'inventory'),
      where('workshopId', '==', workshopId)
    );
    const snapshot = await getDocs(q);
    const items = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    })) as InventoryItem[];

    // Sort in memory by name ascending
    return items.sort((a, b) => {
      const aName = a.name?.toLowerCase() || '';
      const bName = b.name?.toLowerCase() || '';
      return aName.localeCompare(bName);
    });
  },

  subscribeToInventory(
    workshopId: string,
    callback: (items: InventoryItem[]) => void
  ): () => void {
    const q = query(
      collection(db, 'inventory'),
      where('workshopId', '==', workshopId)
    );
    return onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as InventoryItem[];

      // Sort in memory by name ascending
      const sortedItems = items.sort((a, b) => {
        const aName = a.name?.toLowerCase() || '';
        const bName = b.name?.toLowerCase() || '';
        return aName.localeCompare(bName);
      });

      callback(sortedItems);
    });
  },

  async createInventoryItem(
    item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    const docRef = await addDoc(collection(db, 'inventory'), {
      ...item,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return docRef.id;
  },

  async updateInventoryItem(itemId: string, data: Partial<InventoryItem>): Promise<void> {
    const docRef = doc(db, 'inventory', itemId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now(),
    });
  },

  async createStockTransaction(
    transaction: Omit<StockTransaction, 'id' | 'createdAt'>
  ): Promise<string> {
    const docRef = await addDoc(collection(db, 'stockTransactions'), {
      ...transaction,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  },

  async getStockTransactions(workshopId: string): Promise<StockTransaction[]> {
    const q = query(
      collection(db, 'stockTransactions'),
      where('workshopId', '==', workshopId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
    })) as StockTransaction[];
  },

  async getMarketplaceProducts(
    category?: string,
    searchTerm?: string,
    approved: boolean = true
  ): Promise<MarketplaceProduct[]> {
    const constraints: QueryConstraint[] = [];
    if (approved) {
      constraints.push(where('approved', '==', true));
    }
    if (category) {
      constraints.push(where('category', '==', category));
    }
    constraints.push(orderBy('createdAt', 'desc'));

    const q = query(collection(db, 'marketplaceProducts'), ...constraints);
    const snapshot = await getDocs(q);
    let products = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
    })) as MarketplaceProduct[];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      products = products.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.description.toLowerCase().includes(term)
      );
    }

    return products;
  },

  async getVendorProducts(vendorId: string): Promise<MarketplaceProduct[]> {
    const q = query(
      collection(db, 'marketplaceProducts'),
      where('vendorId', '==', vendorId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
    })) as MarketplaceProduct[];
  },

  async createMarketplaceProduct(
    product: Omit<MarketplaceProduct, 'id' | 'createdAt'>
  ): Promise<string> {
    const docRef = await addDoc(collection(db, 'marketplaceProducts'), {
      ...product,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  },

  async updateMarketplaceProduct(
    productId: string,
    data: Partial<MarketplaceProduct>
  ): Promise<void> {
    await updateDoc(doc(db, 'marketplaceProducts', productId), data);
  },

  async uploadMarketplaceImage(imageUri: string, vendorId?: string): Promise<string> {
    try {
      // Upload to Cloudinary with marketplace folder and vendor ID
      // Transformations are applied when displaying images (not during upload)
      return await uploadImageToCloudinary(
        imageUri,
        'marketplace',
        undefined, // No transformation in upload (unsigned uploads don't support it)
        vendorId // Organize by vendor: marketplace/vendorId
      );
    } catch (error: any) {
      console.error('Error uploading marketplace image:', JSON.stringify(error, null, 2));
      throw error;
    }
  },

  async createOrder(order: Omit<Order, 'id' | 'createdAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'orders'), {
      ...order,
      createdAt: Timestamp.now(),
    });

    // Send Push Notification to Admins
    const { notificationService } = require('./notificationService');
    notificationService.sendPushToAdmins(
      'New Market Order',
      `New order received for ₦${order.total?.toLocaleString()}`,
      { type: 'order', id: docRef.id }
    ).catch((err: any) => console.log('Failed to send admin push:', err));

    return docRef.id;
  },

  async getOrders(userId?: string, vendorId?: string): Promise<Order[]> {
    const constraints: QueryConstraint[] = [];
    if (userId) {
      constraints.push(where('userId', '==', userId));
    }
    constraints.push(orderBy('createdAt', 'desc'));

    const q = query(collection(db, 'orders'), ...constraints);
    const snapshot = await getDocs(q);
    let orders = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
    })) as Order[];


    if (vendorId) {
      // Filter orders to only include those with products from this vendor
      const vendorProductIds = new Set<string>();

      // Get all products for this vendor
      const vendorProductsQuery = query(
        collection(db, 'marketplaceProducts'),
        where('vendorId', '==', vendorId)
      );
      const vendorProductsSnapshot = await getDocs(vendorProductsQuery);
      vendorProductsSnapshot.docs.forEach((doc) => {
        vendorProductIds.add(doc.id);
      });

      // Filter orders to only include those with at least one product from this vendor
      orders = orders.filter((order) =>
        order.products.some((item) => vendorProductIds.has(item.productId))
      );
    }

    return orders;
  },

  async getOrder(orderId: string): Promise<Order | null> {
    const docRef = doc(db, 'orders', orderId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
      } as Order;
    }
    return null;
  },

  async updateOrder(orderId: string, data: Partial<Order>): Promise<void> {
    await updateDoc(doc(db, 'orders', orderId), data);
  },

  subscribeToOrders(userId: string, callback: (orders: Order[]) => void): () => void {
    const q = query(
      collection(db, 'orders'),
      where('userId', '==', userId)
    );
    return onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      })) as Order[];

      orders.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));

      callback(orders);
    });
  },

  subscribeToGuestOrders(email: string, callback: (orders: Order[]) => void): () => void {
    const q = query(
      collection(db, 'orders'),
      where('customerEmail', '==', email)
    );
    return onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      })) as Order[];

      orders.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));

      callback(orders);
    });
  },

  subscribeToVendorOrders(vendorId: string, callback: (orders: Order[]) => void): () => void {
    const q = query(
      collection(db, 'orders'),
      where('vendorIds', 'array-contains', vendorId)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const orders = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
        })) as Order[];

        orders.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));

        callback(orders);
      },
      (error) => {
        console.error('Error in subscribeToVendorOrders:', error);
        // Return empty array on error to prevent app crash
        callback([]);
      }
    );
  },

  async getWorkshop(workshopId: string): Promise<Workshop | null> {
    const docRef = doc(db, 'workshops', workshopId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt?.toDate(),
        subscriptionExpiry: docSnap.data().subscriptionExpiry?.toDate(),
      } as Workshop;
    }
    return null;
  },

  async updateWorkshop(workshopId: string, data: Partial<Workshop>): Promise<void> {
    await updateDoc(doc(db, 'workshops', workshopId), data);
  },

  async getWorkshopPermissions(workshopId: string): Promise<Record<string, RolePermissions['permissions']>> {
    const docRef = doc(db, 'workshops', workshopId, 'settings', 'permissions');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as Record<string, RolePermissions['permissions']>;
    }
    return {};
  },

  async updateWorkshopPermissions(
    workshopId: string,
    role: string,
    permissions: RolePermissions['permissions']
  ): Promise<void> {
    const docRef = doc(db, 'workshops', workshopId, 'settings', 'permissions');
    await setDoc(docRef, { [role]: permissions }, { merge: true });
  },

  async deleteWorkshopRole(workshopId: string, role: string): Promise<void> {
    const docRef = doc(db, 'workshops', workshopId, 'settings', 'permissions');
    await updateDoc(docRef, {
      [role]: deleteField()
    });
  },

  async createNotification(
    notification: Omit<Notification, 'id' | 'createdAt'>
  ): Promise<string> {
    const docRef = await addDoc(collection(db, 'notifications'), {
      ...notification,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  },

  async getNotifications(userId: string, unreadOnly: boolean = false): Promise<Notification[]> {
    const constraints: QueryConstraint[] = [where('userId', '==', userId)];
    if (unreadOnly) {
      constraints.push(where('read', '==', false));
    }
    constraints.push(orderBy('createdAt', 'desc'));

    const q = query(collection(db, 'notifications'), ...constraints);
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
    })) as Notification[];
  },

  async markNotificationAsRead(notificationId: string): Promise<void> {
    await updateDoc(doc(db, 'notifications', notificationId), { read: true });
  },

  async uploadFile(fileUri: string, path: string): Promise<string> {
    try {
      // Extract folder from path (e.g., 'jobs/user123' from 'jobs/user123/image.jpg')
      const folder = path.split('/').slice(0, -1).join('/') || 'general';

      // Upload to Cloudinary with folder
      // Transformations are applied when displaying images (not during upload)
      // Unsigned uploads don't support transformation parameters
      return await uploadImageToCloudinary(fileUri, folder, undefined);
    } catch (error) {
      console.error('Error uploading file to Cloudinary:', error);
      throw error;
    }
  },

  async deleteFile(fileUrl: string): Promise<void> {
    // Check if it's a Cloudinary URL
    if (fileUrl.includes('cloudinary.com')) {
      // Cloudinary deletion requires API key/secret setup
      // For now, we'll just log a warning
      console.warn('Cloudinary image deletion not implemented. Image will remain in Cloudinary:', fileUrl);
      // TODO: Implement Cloudinary deletion if needed using deleteImageFromCloudinary
      return;
    }

    // Fallback to Firebase Storage deletion for legacy URLs
    try {
      const storageRef = ref(storage, fileUrl);
      await deleteObject(storageRef);
    } catch (error) {
      console.error('Error deleting file from Firebase Storage:', error);
      // Don't throw - file might already be deleted or URL might be invalid
    }
  },

  subscribeToJobs(
    userId: string,
    callback: (jobs: Job[]) => void
  ): () => void {
    const q = query(
      collection(db, 'jobs'),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const jobs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        scheduledDate: doc.data().scheduledDate?.toDate(),
        completedAt: doc.data().completedAt?.toDate(),
      })) as Job[];
      callback(jobs);
    });
  },

  subscribeToWorkshopJobs(
    workshopId: string,
    callback: (jobs: Job[]) => void
  ): () => void {
    const q = query(
      collection(db, 'jobs'),
      where('workshopId', '==', workshopId),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const jobs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        scheduledDate: doc.data().scheduledDate?.toDate(),
        completedAt: doc.data().completedAt?.toDate(),
      })) as Job[];
      callback(jobs);
    });
  },

  subscribeToNotifications(
    userId: string,
    callback: (notifications: Notification[]) => void
  ): () => void {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const notifications = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      })) as Notification[];
      callback(notifications);
    });
  },

  async createCustomerRegistration(
    email: string,
    name: string,
    phone: string,
    registeredBy: string,
    workshopId: string
  ): Promise<{ id: string; registrationCode: string }> {
    const registrationCode = Math.random().toString(36).substring(2, 10).toUpperCase();

    const registrationData: Omit<CustomerRegistration, 'id' | 'createdAt' | 'usedAt'> = {
      email: email.toLowerCase().trim(),
      name,
      phone,
      registrationCode,
      registeredBy,
      workshopId,
      used: false,
    };

    const docRef = await addDoc(collection(db, 'customerRegistrations'), {
      ...registrationData,
      createdAt: Timestamp.now(),
    });

    return { id: docRef.id, registrationCode };
  },

  async getCustomerRegistrationByCode(code: string): Promise<CustomerRegistration | null> {
    const q = query(
      collection(db, 'customerRegistrations'),
      where('registrationCode', '==', code.toUpperCase()),
      limit(1)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      usedAt: data.usedAt?.toDate(),
    } as CustomerRegistration;
  },

  async markRegistrationAsUsed(registrationId: string): Promise<void> {
    const docRef = doc(db, 'customerRegistrations', registrationId);
    await updateDoc(docRef, {
      used: true,
      usedAt: Timestamp.now(),
    });
  },

  async getCustomerRegistrations(workshopId: string): Promise<CustomerRegistration[]> {
    const q = query(
      collection(db, 'customerRegistrations'),
      where('workshopId', '==', workshopId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        usedAt: data.usedAt?.toDate(),
      } as CustomerRegistration;
    });
  },

  async getCustomerRegistrationByEmail(email: string, workshopId: string): Promise<CustomerRegistration | null> {
    try {
      const registrations = await this.getCustomerRegistrations(workshopId);
      const normalizedEmail = email.toLowerCase().trim();
      // Find most recent registration for this email (even if used)
      const registration = registrations.find(reg => {
        const normalizedRegEmail = (reg.email || '').toLowerCase().trim();
        return normalizedRegEmail === normalizedEmail;
      });
      return registration || null;
    } catch (error) {
      console.error('Error getting registration by email:', error);
      return null;
    }
  },

  async createStaffInvitation(
    email: string,
    name: string,
    role: StaffInvitation['role'],
    invitedBy: string,
    workshopId: string,
    phone?: string
  ): Promise<{ id: string; invitationCode: string }> {
    const invitationCode = Math.random().toString(36).substring(2, 10).toUpperCase();

    const invitationData: Omit<StaffInvitation, 'id' | 'createdAt' | 'usedAt'> = {
      email: email.toLowerCase().trim(),
      name,
      ...(phone ? { phone } : {}),
      role,
      invitationCode,
      invitedBy,
      workshopId,
      used: false,
    };

    const docRef = await addDoc(collection(db, 'staffInvitations'), {
      ...invitationData,
      createdAt: Timestamp.now(),
    });

    return { id: docRef.id, invitationCode };
  },

  async getStaffInvitationByCode(code: string): Promise<StaffInvitation | null> {
    const q = query(
      collection(db, 'staffInvitations'),
      where('invitationCode', '==', code.toUpperCase()),
      limit(1)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    const docSnap = snapshot.docs[0];
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      usedAt: data.usedAt?.toDate(),
      expiresAt: data.expiresAt?.toDate(),
    } as StaffInvitation;
  },

  async markStaffInvitationAsUsed(invitationId: string): Promise<void> {
    const docRef = doc(db, 'staffInvitations', invitationId);
    await updateDoc(docRef, {
      used: true,
      usedAt: Timestamp.now(),
    });
  },

  async getStaffInvitations(workshopId: string): Promise<StaffInvitation[]> {
    const q = query(
      collection(db, 'staffInvitations'),
      where('workshopId', '==', workshopId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        usedAt: data.usedAt?.toDate(),
        expiresAt: data.expiresAt?.toDate(),
      } as StaffInvitation;
    });
  },

  async cancelStaffInvitation(invitationId: string): Promise<void> {
    const docRef = doc(db, 'staffInvitations', invitationId);
    await deleteDoc(docRef);
  },

  async sendJobMessage(jobId: string, message: Omit<ChatMessage, 'id' | 'jobId' | 'createdAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'jobs', jobId, 'messages'), {
      ...message,
      jobId,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  },

  subscribeToJobMessages(jobId: string, callback: (messages: ChatMessage[]) => void): () => void {
    const q = query(
      collection(db, 'jobs', jobId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      })) as ChatMessage[];
      callback(messages);
    });
  },

  async markMessagesAsRead(jobId: string, messageIds: string[], userId: string): Promise<void> {
    if (messageIds.length === 0) return;

    const batch = writeBatch(db);
    messageIds.forEach((msgId) => {
      const msgRef = doc(db, 'jobs', jobId, 'messages', msgId);
      batch.update(msgRef, {
        readBy: arrayUnion(userId)
      });
    });

    await batch.commit();
  },

  async uploadChatImage(imageUri: string, jobId: string): Promise<string> {
    try {
      // Upload to Cloudinary with folder specific to job
      return await uploadImageToCloudinary(
        imageUri,
        'chat_images',
        undefined,
        `jobs/${jobId}`
      );
    } catch (error: any) {
      // Fallback to Firebase Storage if Cloudinary fails (optional, but good for robustness)
      // For now, re-throw or use existing uploadFile
      console.error('Cloudinary upload failed, falling back logic could be here', error);
      throw error;
    }
  },

  async getAllMarketplaceOrders(): Promise<Order[]> {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
      } as Order;
    });
  },

  subscribeToAllOrders(callback: (orders: Order[]) => void): () => void {
    const q = query(
      collection(db, 'orders'),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
        } as Order;
      });
      callback(orders);
    });
  },

  async updateOrderPayoutStatus(orderId: string, status: 'pending' | 'processing' | 'paid' | 'failed', adminNotes?: string): Promise<void> {
    const docRef = doc(db, 'orders', orderId);
    const updateData: any = {
      payoutStatus: status,
      updatedAt: Timestamp.now(),
    };
    if (adminNotes) {
      updateData.adminNotes = adminNotes;
    }
    await updateDoc(docRef, updateData);
  },

  async updateOrderStatus(orderId: string, status: Order['status']): Promise<void> {
    const docRef = doc(db, 'orders', orderId);
    await updateDoc(docRef, {
      status,
      updatedAt: Timestamp.now(),
    });
  },
};
