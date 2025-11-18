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
} from '@/types';

export const firebaseService = {
  async getUser(userId: string): Promise<User | null> {
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as User;
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

  async getVehicles(userId: string): Promise<Vehicle[]> {
    const q = query(
      collection(db, 'vehicles'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    })) as Vehicle[];
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
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      paymentDate: doc.data().paymentDate?.toDate(),
      dueDate: doc.data().dueDate?.toDate(),
    })) as Invoice[];
  },

  async createInvoice(invoice: Omit<Invoice, 'id' | 'createdAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'invoices'), {
      ...invoice,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  },

  async updateInvoice(invoiceId: string, data: Partial<Invoice>): Promise<void> {
    await updateDoc(doc(db, 'invoices', invoiceId), data);
  },

  async getInventoryItems(workshopId: string): Promise<InventoryItem[]> {
    const q = query(
      collection(db, 'inventory'),
      where('workshopId', '==', workshopId),
      orderBy('name', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    })) as InventoryItem[];
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
};

