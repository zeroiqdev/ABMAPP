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
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '@/config/firebase';
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
} from '@/types';

export const firebaseService = {
  async getUser(userId: string): Promise<User | null> {
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

  async updateUser(userId: string, data: Partial<User>): Promise<void> {
    const docRef = doc(db, 'users', userId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now(),
    });
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

  async createInvoice(invoice: Omit<Invoice, 'id' | 'createdAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'invoices'), {
      ...invoice,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  },

  async updateInvoice(invoiceId: string, data: Partial<Invoice>): Promise<void> {
    const updateData: any = { ...data };
    if (updateData.dueDate) {
      updateData.dueDate = Timestamp.fromDate(updateData.dueDate);
    }
    if (updateData.paymentDate) {
      updateData.paymentDate = Timestamp.fromDate(updateData.paymentDate);
    }
    if (updateData.paymentHistory) {
      updateData.paymentHistory = updateData.paymentHistory.map((record: any) => ({
        ...record,
        date: Timestamp.fromDate(record.date),
      }));
    }
    await updateDoc(doc(db, 'invoices', invoiceId), updateData);
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

  async createOrder(order: Omit<Order, 'id' | 'createdAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'orders'), {
      ...order,
      createdAt: Timestamp.now(),
    });
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
      orders = orders.filter((order) =>
        order.products.some(() => true)
      );
    }

    return orders;
  },

  async updateOrder(orderId: string, data: Partial<Order>): Promise<void> {
    await updateDoc(doc(db, 'orders', orderId), data);
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
    const response = await fetch(fileUri);
    const blob = await response.blob();
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
  },

  async deleteFile(fileUrl: string): Promise<void> {
    const storageRef = ref(storage, fileUrl);
    await deleteObject(storageRef);
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
      where('used', '==', false),
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
      phone,
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
      where('used', '==', false),
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
};
