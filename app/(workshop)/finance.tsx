import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';
import { Invoice, InvoiceItem, Job, User, PaymentStatus, InventoryItem } from '@/types';
import { format } from 'date-fns';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, Typography, Spacing, BorderRadius, Shadows, StatusColors } from '@/constants/design';
import { Platform } from 'react-native';

export default function FinanceScreen() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid' | 'partially_paid'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [loading, setLoading] = useState(false);
  const [editingItems, setEditingItems] = useState<InvoiceItem[]>([]);
  const [editingDueDate, setEditingDueDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [newItem, setNewItem] = useState({ description: '', quantity: '1', unitPrice: '' });
  const [showAddItem, setShowAddItem] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [addItemMode, setAddItemMode] = useState<'manual' | 'inventory'>('manual');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerNamesMap, setCustomerNamesMap] = useState<Record<string, string>>({});
  const [dateFilter, setDateFilter] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });
  const [showDateFilterModal, setShowDateFilterModal] = useState(false);
  const [activeDatePicker, setActiveDatePicker] = useState<'start' | 'end' | 'due' | null>(null);
  const [showPaymentSuccessModal, setShowPaymentSuccessModal] = useState(false);

  const [recordedPaymentAmount, setRecordedPaymentAmount] = useState<number>(0);
  const [editingVatRate, setEditingVatRate] = useState('');
  const [editingDiscount, setEditingDiscount] = useState('');

  const [invoiceType, setInvoiceType] = useState<'job' | 'direct'>('job');

  useEffect(() => {
    loadInvoices();
    if (user?.workshopId) {
      loadInventory();
    }
    if (user?.id) {
      // Run reminder check silently in background
      firebaseService.checkAndSendInvoiceReminders(user.id);
    }
  }, [user]);

  const loadInventory = async () => {
    if (!user?.workshopId) return;
    try {
      const items = await firebaseService.getInventoryItems(user.workshopId);
      setInventoryItems(items);
    } catch (error) {
      console.error('Error loading inventory:', error);
    }
  };

  useEffect(() => {
    filterInvoices();
  }, [invoices, filter, searchQuery, dateFilter, customerNamesMap, invoiceType]);

  const loadInvoices = async () => {
    if (!user?.workshopId) return;
    setRefreshing(true);
    try {
      const invoicesData = await firebaseService.getInvoices(undefined, user.workshopId);
      setInvoices(invoicesData);

      // Load customer names for all invoices
      const customerIds = [...new Set(invoicesData.map(inv => inv.userId).filter((id): id is string => !!id))];
      const namesMap: Record<string, string> = {};

      await Promise.all(
        customerIds.map(async (customerId) => {
          try {
            const customer = await firebaseService.getUser(customerId);
            if (customer) {
              namesMap[customerId] = customer.name;
            } else {
              namesMap[customerId] = 'Unknown Customer';
            }
          } catch (error) {
            console.error('Error loading customer:', customerId, error);
            namesMap[customerId] = 'Unknown Customer';
          }
        })
      );

      setCustomerNamesMap(namesMap);
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const filterInvoices = () => {
    let result = invoices;

    // Filter by Type (Job vs Direct)
    if (invoiceType === 'job') {
      result = result.filter(inv => !!inv.jobId);
    } else {
      result = result.filter(inv => !inv.jobId);
    }

    // Status filter
    if (filter === 'pending') {
      result = result.filter((inv) => inv.paymentStatus === 'pending');
    } else if (filter === 'paid') {
      result = result.filter((inv) => inv.paymentStatus === 'paid');
    } else if (filter === 'partially_paid') {
      result = result.filter((inv) => inv.paymentStatus === 'partially_paid');
    }

    // Date filter
    if (dateFilter.start || dateFilter.end) {
      result = result.filter((inv) => {
        const invDate = new Date(inv.createdAt);
        if (dateFilter.start && invDate < dateFilter.start) return false;
        if (dateFilter.end) {
          const endDate = new Date(dateFilter.end);
          endDate.setHours(23, 59, 59, 999); // Include entire end date
          if (invDate > endDate) return false;
        }
        return true;
      });
    }

    // Search filter (by customer name or invoice ID)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (inv) => {
          const customerName = inv.customerName || (inv.userId ? customerNamesMap[inv.userId] : '') || '';
          return (
            inv.id.toLowerCase().includes(query) ||
            customerName.toLowerCase().includes(query) ||
            format(inv.createdAt, 'MMM dd, yyyy').toLowerCase().includes(query)
          );
        }
      );
    }

    setFilteredInvoices(result);
  };

  const onRefresh = async () => {
    await loadInvoices();
    if (user?.workshopId) {
      loadInventory();
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return '#30D158';
      case 'pending': return '#FFA500';
      case 'partially_paid': return '#5856D6';
      case 'failed': return '#FF3B30';
      default: return '#666';
    }
  };

  const handleInvoicePress = async (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setEditingItems([...invoice.items]);
    setEditingDueDate(invoice.dueDate || null);
    setActiveDatePicker(null);
    setEditingItemIndex(null);
    setShowAddItem(false);

    setNewItem({ description: '', quantity: '1', unitPrice: '' });
    setAddItemMode('manual');
    setEditingVatRate(invoice.vatRate ? invoice.vatRate.toString() : '0');
    setEditingDiscount(invoice.discount ? invoice.discount.toString() : '0');

    // Load customer name
    try {
      if (invoice.userId) {
        const customer = await firebaseService.getUser(invoice.userId);
        if (customer) {
          setCustomerName(customer.name);
        } else {
          setCustomerName('Unknown Customer');
        }
      } else {
        setCustomerName(invoice.customerName || 'Direct Customer');
      }
    } catch (error) {
      console.error('Error loading customer:', error);
      setCustomerName('Unknown Customer');
    }

    setShowInvoiceModal(true);
  };

  const canEditInvoice = () => {
    if (!selectedInvoice) return false;
    // Cannot edit if paid (even partially) OR if approved (unless it's just to record payment)
    // Actually, canEditInvoice controls item editing. Payment is separate.
    // Locking edits after approval:
    return (selectedInvoice.amountPaid || 0) === 0 && (selectedInvoice.status === 'draft' || !selectedInvoice.status);
  };

  const handleApproveInvoice = async () => {
    if (!selectedInvoice) return;

    if (!editingDueDate) {
      Alert.alert('Required', 'Please select a Due Date before approving the invoice.');
      return;
    }

    setLoading(true);
    try {
      await firebaseService.approveInvoice(selectedInvoice.id, user?.name || 'Staff', editingDueDate);

      // Reload invoices
      await loadInvoices();

      // Update local selection
      const updatedInvoices = await firebaseService.getInvoices(undefined, user?.workshopId);
      const updatedInvoice = updatedInvoices.find(inv => inv.id === selectedInvoice.id);
      if (updatedInvoice) {
        setSelectedInvoice(updatedInvoice);
        setEditingItems([...updatedInvoice.items]);
      }

      const isTowInvoice = selectedInvoice.items.some(i => i.description.toLowerCase().includes('tow'));
      const successMessage = isTowInvoice
        ? 'Invoice approved.'
        : 'Invoice approved. Customer can now view it.';

      Alert.alert('Success', successMessage);
    } catch (error) {
      console.error('Error approving invoice:', error);
      Alert.alert('Error', 'Failed to approve invoice');
    } finally {
      setLoading(false);
    }
  };

  const handleEditItem = (index: number, field: 'description' | 'quantity' | 'unitPrice', value: string) => {
    if (!canEditInvoice()) return;

    const updatedItems = [...editingItems];
    const item = { ...updatedItems[index] };

    if (field === 'description') {
      item.description = value;
    } else if (field === 'quantity') {
      const qty = parseFloat(value) || 0;
      item.quantity = qty;
      item.total = qty * item.unitPrice;
    } else if (field === 'unitPrice') {
      const price = parseFloat(value) || 0;
      item.unitPrice = price;
      item.total = item.quantity * price;
    }

    updatedItems[index] = item;
    setEditingItems(updatedItems);
  };

  const handleDeleteItem = async (index: number) => {
    if (!canEditInvoice()) return;
    if (editingItems[index].description === 'LABOUR') {
      Alert.alert('Error', 'Cannot delete LABOUR item');
      return;
    }
    const updatedItems = editingItems.filter((_, i) => i !== index);
    setEditingItems(updatedItems);

    // Save immediately after deletion
    await saveInvoiceItems(updatedItems);
  };

  const handleAddItem = async () => {
    if (!canEditInvoice()) return;
    if (!newItem.description || !newItem.quantity || !newItem.unitPrice) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const item: InvoiceItem = {
      description: newItem.description,
      quantity: parseFloat(newItem.quantity) || 1,
      unitPrice: parseFloat(newItem.unitPrice) || 0,
      total: (parseFloat(newItem.quantity) || 1) * (parseFloat(newItem.unitPrice) || 0),
    };

    const updatedItems = [...editingItems, item];
    setEditingItems(updatedItems);

    // Save immediately
    await saveInvoiceItems(updatedItems);

    // Clear form but keep it open for adding more items
    setNewItem({ description: '', quantity: '1', unitPrice: '' });
  };

  const handleAddInventoryItem = async (inventoryItem: InventoryItem, quantity: number) => {
    if (!canEditInvoice()) return;

    const item: InvoiceItem = {
      description: inventoryItem.name,
      quantity: quantity,
      unitPrice: inventoryItem.unitPrice,
      total: quantity * inventoryItem.unitPrice,
    };

    const updatedItems = [...editingItems, item];
    setEditingItems(updatedItems);

    // Save immediately
    await saveInvoiceItems(updatedItems);
  };

  const saveInvoiceItems = async (items: InvoiceItem[]) => {
    if (!selectedInvoice || !canEditInvoice()) return;

    try {
      const subtotal = items.reduce((sum, item) => sum + item.total, 0);
      const vatRate = parseFloat(editingVatRate) || 0;
      const discount = parseFloat(editingDiscount) || 0;
      const vatAmount = subtotal * (vatRate / 100);
      const total = subtotal + vatAmount - discount;

      const updateData: any = {
        items: items,
        subtotal,
        total,
      };

      // Only update due date if it's being edited and has a value
      if (editingDueDate) {
        updateData.dueDate = editingDueDate;
      }

      await firebaseService.updateInvoice(selectedInvoice.id, updateData);

      // Reload the invoice to get updated data
      const updatedInvoices = await firebaseService.getInvoices(undefined, user?.workshopId);
      const updatedInvoice = updatedInvoices.find(inv => inv.id === selectedInvoice.id);
      if (updatedInvoice) {
        setSelectedInvoice(updatedInvoice);
      }

      // Reload all invoices to update the list
      await loadInvoices();
    } catch (error) {
      console.error('Error saving invoice items:', error);
      Alert.alert('Error', 'Failed to save item');
    }
  };

  const handleRecordPayment = (isFullPayment: boolean = false) => {
    console.log('handleRecordPayment called', { isFullPayment, selectedInvoice: !!selectedInvoice });

    if (!selectedInvoice) {
      Alert.alert('Error', 'No invoice selected');
      return;
    }

    // Use current edited total instead of original total
    const subtotal = editingItems.reduce((sum, item) => sum + item.total, 0);
    const vatRate = parseFloat(editingVatRate) || 0;
    const discount = parseFloat(editingDiscount) || 0;
    const vatAmount = subtotal * (vatRate / 100);
    const currentTotal = subtotal + vatAmount - discount;
    const amountPaid = selectedInvoice.amountPaid || 0;

    if (isFullPayment) {
      const remaining = currentTotal - amountPaid;
      if (remaining <= 0) {
        Alert.alert('Info', 'Invoice is already fully paid');
        return;
      }
      processPayment(remaining, 'full');
    } else {
      // Open payment modal for partial payment
      // Temporarily hide invoice modal to show payment modal on top
      setShowInvoiceModal(false);
      setActiveDatePicker(null);
      setTimeout(() => {
        setShowPaymentModal(true);
      }, 300);
    }
  };

  const processPayment = async (amount: number, type: 'partial' | 'full') => {
    if (!selectedInvoice || amount <= 0) return;

    // Use current edited total
    const subtotal = editingItems.reduce((sum, item) => sum + item.total, 0);
    const vatRate = parseFloat(editingVatRate) || 0;
    const discount = parseFloat(editingDiscount) || 0;
    const vatAmount = subtotal * (vatRate / 100);
    const currentTotal = subtotal + vatAmount - discount;
    const currentPaid = selectedInvoice.amountPaid || 0;
    const newPaid = currentPaid + amount;
    const remaining = currentTotal - newPaid;

    let newStatus: PaymentStatus = 'pending';
    if (remaining <= 0) {
      newStatus = 'paid';
    } else {
      newStatus = 'partially_paid';
    }

    setLoading(true);
    try {
      const paymentHistory = selectedInvoice.paymentHistory || [];
      paymentHistory.push({
        amount,
        date: new Date(),
        method: paymentMethod,
        recordedBy: user?.id,
      });

      // Also update the total if items were edited
      const finalSubtotal = editingItems.reduce((sum, item) => sum + item.total, 0);
      const finalVatAmount = finalSubtotal * (vatRate / 100);
      const finalTotal = finalSubtotal + finalVatAmount - discount;

      await firebaseService.updateInvoice(selectedInvoice.id, {
        paymentStatus: newStatus,
        amountPaid: newPaid,
        paymentHistory: paymentHistory,
        items: editingItems,
        subtotal: finalSubtotal,
        total: finalTotal,
        vat: finalVatAmount,
        vatRate: vatRate,
        discount: discount,
      });

      setRecordedPaymentAmount(amount);
      setShowPaymentSuccessModal(true);
      setShowPaymentModal(false);
      setPaymentAmount('');
      await loadInvoices();

      // Reload the invoice to get updated data
      const updatedInvoices = await firebaseService.getInvoices(undefined, user?.workshopId);
      const updatedInvoice = updatedInvoices.find(inv => inv.id === selectedInvoice.id);
      if (updatedInvoice) {
        setSelectedInvoice(updatedInvoice);
        setEditingItems([...updatedInvoice.items]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to record payment');
      console.error('Error recording payment:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveInvoice = async (showAlert: boolean = true, closeModal: boolean = false) => {
    if (!selectedInvoice || !canEditInvoice()) return;

    setLoading(true);
    try {
      const subtotal = editingItems.reduce((sum, item) => sum + item.total, 0);
      const vatRate = parseFloat(editingVatRate) || 0;
      const discount = parseFloat(editingDiscount) || 0;
      const vatAmount = subtotal * (vatRate / 100);
      const total = subtotal + vatAmount - discount;

      await firebaseService.updateInvoice(selectedInvoice.id, {
        items: editingItems,
        subtotal,
        total,
        vat: vatAmount,
        vatRate,
        discount,
        dueDate: editingDueDate || undefined,
      });

      if (showAlert) {
        Alert.alert('Success', 'Invoice updated successfully');
      }
      await loadInvoices();

      // Reload the invoice to get updated data
      const updatedInvoices = await firebaseService.getInvoices(undefined, user?.workshopId);
      const updatedInvoice = updatedInvoices.find(inv => inv.id === selectedInvoice.id);
      if (updatedInvoice) {
        setSelectedInvoice(updatedInvoice);
        setEditingItems([...updatedInvoice.items]);
      }

      if (closeModal) {
        setShowInvoiceModal(false);
        setActiveDatePicker(null);
      }
    } catch (error) {
      if (showAlert) {
        Alert.alert('Error', 'Failed to update invoice');
      }
      console.error('Error updating invoice:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!selectedInvoice) return;

    try {
      const job = selectedInvoice.jobId
        ? await firebaseService.getJob(selectedInvoice.jobId)
        : null;
      const customer = selectedInvoice.userId ? await firebaseService.getUser(selectedInvoice.userId) : null;

      // Use edited items and totals for PDF
      const currentTotal = editingItems.reduce((sum, item) => sum + item.total, 0);
      const invoiceForPDF = {
        ...selectedInvoice,
        items: editingItems,
        total: currentTotal,
        subtotal: currentTotal,
      };

      const html = generateInvoiceHTML(invoiceForPDF, job, customer);
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to generate invoice PDF');
      console.error('Error generating PDF:', error);
    }
  };

  const generateInvoiceHTML = (inv: Invoice, job: Job | null, customer: User | null) => {
    const amountPaid = inv.amountPaid || 0;
    const balanceDue = inv.total - amountPaid;
    const paymentHistory = inv.paymentHistory || [];

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .invoice-info { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .items-table th, .items-table td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
            .items-table th { background-color: #f5f5f5; }
            .total-section { text-align: right; margin-top: 20px; }
            .balance-box { background: #f5f5f5; padding: 15px; margin-top: 20px; text-align: center; }
            .payment-history { margin-top: 30px; }
            .payment-item { padding: 8px; border-bottom: 1px solid #eee; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>INVOICE</h1>
            <p>Invoice #${inv.id}</p>
          </div>
          <div class="invoice-info">
            <div>
              <p><strong>Customer:</strong> ${customer?.name || inv.customerName || 'Direct Customer'}</p>
              <p><strong>Date:</strong> ${format(inv.createdAt, 'MMM dd, yyyy')}</p>
              ${inv.dueDate ? `<p><strong>Due Date:</strong> ${format(inv.dueDate, 'MMM dd, yyyy')}</p>` : ''}
            </div>
          </div>
          <table class="items-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${inv.items.map(
      (item) => `
                <tr>
                  <td>${item.description}</td>
                  <td>${item.quantity}</td>
                  <td>₦${item.unitPrice.toLocaleString()}</td>
                  <td>₦${item.total.toLocaleString()}</td>
                </tr>
              `
    ).join('')}
            </tbody>
          </table>
          <div class="total-section">
            <p>Subtotal: ₦${inv.subtotal.toLocaleString()}</p>
            ${inv.vat > 0 ? `<p>VAT: ₦${inv.vat.toLocaleString()}</p>` : ''}
            ${inv.discount > 0 ? `<p>Discount: -₦${inv.discount.toLocaleString()}</p>` : ''}
            <p><strong>Total: ₦${inv.total.toLocaleString()}</strong></p>
            ${amountPaid > 0 ? `<p>Amount Paid: ₦${amountPaid.toLocaleString()}</p>` : ''}
          </div>
          <div class="balance-box">
            <div><strong>{balanceDue < 0 ? 'Overpayment' : 'Balance Due'}</strong></div>
            <div style="font-size: 24px; font-weight: bold; color: ${balanceDue < 0 ? '#30D158' : '#000'}">
              ₦{Math.abs(balanceDue).toLocaleString()}
            </div>
          </div>
              ${paymentHistory.length > 0 ? `
            <div class="payment-history">
              <h3>Payment History</h3>
              ${paymentHistory.map(
      (payment) => {
        const paymentDate = payment.date instanceof Date ? payment.date : new Date(payment.date);
        return `
                <div class="payment-item">
                  <p>₦${payment.amount.toLocaleString()} - ${format(paymentDate, 'MMM dd, yyyy')} - ${payment.method}</p>
                </div>
              `;
      }
    ).join('')}
            </div>
          ` : ''}
        </body>
      </html>
    `;
  };

  const getInvoiceIcon = (status: string): keyof typeof Ionicons.glyphMap => {
    switch (status) {
      case 'paid': return 'checkmark-circle-outline';
      case 'partially_paid': return 'pie-chart-outline';
      case 'overdue': return 'alert-circle-outline';
      case 'unpaid': return 'time-outline';
      case 'pending': return 'time-outline';
      case 'cancelled': return 'close-circle-outline';
      case 'refunded': return 'arrow-undo-outline';
      default: return 'document-text-outline';
    }
  };

  const renderInvoice = ({ item }: { item: Invoice }) => {
    const amountPaid = item.amountPaid || 0;
    const remaining = item.total - amountPaid;
    const customerName = item.customerName || (item.userId ? customerNamesMap[item.userId] : 'Direct Customer') || 'Loading...';

    return (
      <TouchableOpacity
        style={styles.itemCard}
        onPress={() => handleInvoicePress(item)}
      >
        <View style={[styles.iconBox, { backgroundColor: getPaymentStatusColor(item.paymentStatus) + '20' }]}>
          <Ionicons name={getInvoiceIcon(item.paymentStatus)} size={24} color={getPaymentStatusColor(item.paymentStatus)} />
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={1}>
            Invoice #{item.id.slice(0, 8)}
          </Text>
          <Text style={styles.itemSubtitle} numberOfLines={1}>
            {customerName} • {format(item.createdAt, 'MMM dd, yyyy')}
          </Text>
        </View>
        <View style={styles.itemRight}>
          <Text style={styles.amountText}>₦{item.total.toLocaleString()}</Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getPaymentStatusColor(item.paymentStatus) + '20' },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                { color: getPaymentStatusColor(item.paymentStatus) },
              ]}
            >
              {item.paymentStatus === 'partially_paid'
                ? 'Partial'
                : item.paymentStatus.charAt(0).toUpperCase() + item.paymentStatus.slice(1)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Finance</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/(workshop)/create-invoice')}
        >
          <Ionicons name="add" size={24} color={Colors.textInverse} />
        </TouchableOpacity>
      </View>

      {/* Invoice Type Tabs */}
      <View style={styles.typeContainer}>
        <TouchableOpacity
          style={[styles.typeTab, invoiceType === 'job' && styles.typeTabActive]}
          onPress={() => setInvoiceType('job')}
        >
          <Text style={[styles.typeText, invoiceType === 'job' && styles.typeTextActive]}>Job Invoices</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.typeTab, invoiceType === 'direct' && styles.typeTabActive]}
          onPress={() => setInvoiceType('direct')}
        >
          <Text style={[styles.typeText, invoiceType === 'direct' && styles.typeTextActive]}>Direct Invoices</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color={Colors.textTertiary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by customer name or invoice ID..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity
          onPress={() => setShowDateFilterModal(true)}
          style={styles.dateFilterButton}
        >
          <Ionicons name="calendar-outline" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Filter Pills */}
      <View style={styles.filterContainer}>
        {(['all', 'pending', 'paid', 'partially_paid'] as const).map((filterOption) => (
          <TouchableOpacity
            key={filterOption}
            style={[
              styles.filterPill,
              filter === filterOption && styles.filterPillActive,
            ]}
            onPress={() => setFilter(filterOption)}
          >
            <Text
              style={[
                styles.filterText,
                filter === filterOption && styles.filterTextActive,
              ]}
            >
              {filterOption === 'partially_paid'
                ? 'Partially Paid'
                : filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Invoices List */}
      <FlatList
        data={filteredInvoices}
        renderItem={renderInvoice}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={64} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>No invoices found</Text>
          </View>
        }
      />

      {/* Invoice Details Modal */}
      <Modal
        visible={showInvoiceModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowInvoiceModal(false);
          setActiveDatePicker(null);
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Invoice Details</Text>
            <TouchableOpacity onPress={() => {
              setShowInvoiceModal(false);
              setActiveDatePicker(null);
            }}>
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {selectedInvoice && (
            <ScrollView style={styles.modalContent}>
              <View style={styles.invoiceDetailsCard}>
                <View style={styles.detailRow}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Invoice #</Text>
                    <Text style={styles.detailValue}>{selectedInvoice.id}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Customer</Text>
                    <Text style={styles.detailValue}>{customerName || 'Loading...'}</Text>
                  </View>
                </View>
                <View style={[styles.detailRow, { marginTop: 15 }]}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Status</Text>
                    <View style={[styles.statusBadge, { alignSelf: 'flex-start', marginLeft: 0, marginTop: 4 }]}>
                      <Text style={styles.statusText}>
                        {(selectedInvoice.status || 'draft').toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Due Date</Text>
                    <Text style={styles.detailValue}>
                      {selectedInvoice.dueDate ? format(selectedInvoice.dueDate, 'MMM dd, yyyy') : 'N/A'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.itemsSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Items</Text>
                  {canEditInvoice() && !showAddItem && (
                    <TouchableOpacity
                      onPress={() => {
                        setShowAddItem(true);
                        setAddItemMode('manual');
                      }}
                      style={styles.addItemButton}
                    >
                      <Ionicons name="add-circle-outline" size={24} color={Colors.textInverse} />
                    </TouchableOpacity>
                  )}
                </View>

                {editingItems.map((item, index) => (
                  <View key={index} style={styles.itemRow}>
                    {canEditInvoice() && editingItemIndex === index ? (
                      <View style={styles.itemEditForm}>
                        <TextInput
                          style={styles.itemEditInput}
                          value={item.description}
                          onChangeText={(text) => handleEditItem(index, 'description', text)}
                          placeholder="Description"
                        />
                        <View style={styles.itemEditRow}>
                          <View style={styles.itemEditField}>
                            <Text style={styles.itemEditLabel}>Qty</Text>
                            <TextInput
                              style={styles.itemEditInputSmall}
                              value={item.quantity.toString()}
                              onChangeText={(text) => handleEditItem(index, 'quantity', text)}
                              keyboardType="numeric"
                            />
                          </View>
                          <View style={styles.itemEditField}>
                            <Text style={styles.itemEditLabel}>Unit Price</Text>
                            <TextInput
                              style={styles.itemEditInputSmall}
                              value={item.unitPrice.toString()}
                              onChangeText={(text) => handleEditItem(index, 'unitPrice', text)}
                              keyboardType="numeric"
                            />
                          </View>
                        </View>
                        <View style={styles.itemEditActions}>
                          <TouchableOpacity
                            onPress={async () => {
                              // Save immediately when done editing (no alert, don't close modal)
                              await handleSaveInvoice(false, false);
                              setEditingItemIndex(null);
                            }}
                            style={styles.itemEditButton}
                          >
                            <Text style={styles.itemEditButtonText}>Done</Text>
                          </TouchableOpacity>
                          {item.description !== 'LABOUR' && (
                            <TouchableOpacity
                              onPress={() => handleDeleteItem(index)}
                              style={[styles.itemEditButton, styles.deleteButton]}
                            >
                              <Ionicons name="trash-outline" size={18} color={Colors.error} />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.itemInfoContainer}
                        onPress={() => canEditInvoice() && setEditingItemIndex(index)}
                        disabled={!canEditInvoice()}
                      >
                        <View style={styles.itemInfo}>
                          <Text style={styles.itemDescription}>{item.description}</Text>
                          <Text style={styles.itemDetails}>
                            {item.quantity} × ₦{item.unitPrice.toLocaleString()} = ₦
                            {item.total.toLocaleString()}
                          </Text>
                        </View>
                        {canEditInvoice() && (
                          <Ionicons name="pencil-outline" size={18} color={Colors.textPrimary} />
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                ))}

                {canEditInvoice() && showAddItem && (
                  <View style={styles.addItemForm}>
                    {/* Mode Tabs */}
                    <View style={styles.addItemTabs}>
                      <TouchableOpacity
                        style={[styles.addItemTab, addItemMode === 'manual' && styles.addItemTabActive]}
                        onPress={() => setAddItemMode('manual')}
                      >
                        <Text style={[styles.addItemTabText, addItemMode === 'manual' && styles.addItemTabTextActive]}>
                          Manual Entry
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.addItemTab, addItemMode === 'inventory' && styles.addItemTabActive]}
                        onPress={() => setAddItemMode('inventory')}
                      >
                        <Ionicons
                          name="cube-outline"
                          size={16}
                          color={addItemMode === 'inventory' ? '#fff' : '#000'}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={[styles.addItemTabText, addItemMode === 'inventory' && styles.addItemTabTextActive]}>
                          From Inventory
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {addItemMode === 'manual' ? (
                      <>
                        <TextInput
                          style={styles.itemEditInput}
                          value={newItem.description}
                          onChangeText={(text) => setNewItem({ ...newItem, description: text })}
                          placeholder="Description"
                        />
                        <View style={styles.itemEditRow}>
                          <View style={styles.itemEditField}>
                            <Text style={styles.itemEditLabel}>Qty</Text>
                            <TextInput
                              style={styles.itemEditInputSmall}
                              value={newItem.quantity}
                              onChangeText={(text) => setNewItem({ ...newItem, quantity: text })}
                              keyboardType="numeric"
                            />
                          </View>
                          <View style={styles.itemEditField}>
                            <Text style={styles.itemEditLabel}>Unit Price</Text>
                            <TextInput
                              style={styles.itemEditInputSmall}
                              value={newItem.unitPrice}
                              onChangeText={(text) => setNewItem({ ...newItem, unitPrice: text })}
                              keyboardType="numeric"
                            />
                          </View>
                        </View>
                        <View style={styles.itemEditActions}>
                          <TouchableOpacity
                            onPress={handleAddItem}
                            style={[styles.itemEditButton, styles.addButton]}
                          >
                            <Text style={styles.itemEditButtonText}>Add Item</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    ) : (
                      <View style={styles.inventorySelectionContainer}>
                        {inventoryItems.length === 0 ? (
                          <View style={styles.emptyState}>
                            <Ionicons name="cube-outline" size={48} color={Colors.textTertiary} />
                            <Text style={styles.emptyText}>No inventory items found</Text>
                          </View>
                        ) : (
                          <ScrollView
                            style={styles.inventoryItemsList}
                            nestedScrollEnabled={true}
                            showsVerticalScrollIndicator={true}
                          >
                            {inventoryItems.map((item) => (
                              <InventoryItemRow
                                key={item.id}
                                item={item}
                                onAdd={(qty) => {
                                  handleAddInventoryItem(item, qty);
                                }}
                              />
                            ))}
                          </ScrollView>
                        )}
                      </View>
                    )}
                  </View>
                )}

                {/* Done Button - Appears for both manual and inventory modes */}
                {canEditInvoice() && showAddItem && (
                  <TouchableOpacity
                    onPress={() => {
                      setShowAddItem(false);
                      setNewItem({ description: '', quantity: '1', unitPrice: '' });
                      setAddItemMode('manual');
                    }}
                    style={styles.doneButton}
                  >
                    <Text style={styles.doneButtonText}>Done</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.summarySection}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Subtotal:</Text>
                  <Text style={styles.summaryValue}>
                    ₦{editingItems.reduce((sum, item) => sum + item.total, 0).toLocaleString()}
                  </Text>
                </View>

                {canEditInvoice() ? (
                  <>
                    <View style={[styles.summaryRow, { alignItems: 'center' }]}>
                      <Text style={styles.summaryLabel}>VAT Rate (%):</Text>
                      <TextInput
                        style={{
                          borderWidth: 1,
                          borderColor: '#ddd',
                          borderRadius: 4,
                          width: 60,
                          height: 35,
                          textAlign: 'right',
                          paddingHorizontal: 8,
                          fontSize: 14,
                          backgroundColor: '#fff'
                        }}
                        value={editingVatRate}
                        onChangeText={setEditingVatRate}
                        keyboardType="numeric"
                        placeholder="0"
                      />
                    </View>
                    <View style={[styles.summaryRow, { alignItems: 'center' }]}>
                      <Text style={styles.summaryLabel}>Discount (Amount):</Text>
                      <TextInput
                        style={{
                          borderWidth: 1,
                          borderColor: '#ddd',
                          borderRadius: 4,
                          width: 60,
                          height: 35,
                          textAlign: 'right',
                          paddingHorizontal: 8,
                          fontSize: 14,
                          backgroundColor: '#fff'
                        }}
                        value={editingDiscount}
                        onChangeText={setEditingDiscount}
                        keyboardType="numeric"
                        placeholder="0"
                      />
                    </View>
                  </>
                ) : (
                  <>
                    {(parseFloat(editingVatRate) > 0) && (
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>VAT ({editingVatRate}%):</Text>
                        <Text style={styles.summaryValue}>
                          ₦{(editingItems.reduce((sum, item) => sum + item.total, 0) * (parseFloat(editingVatRate) / 100)).toLocaleString()}
                        </Text>
                      </View>
                    )}
                    {(parseFloat(editingDiscount) > 0) && (
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Discount:</Text>
                        <Text style={[styles.summaryValue, { color: '#FF3B30' }]}>
                          -₦{parseFloat(editingDiscount).toLocaleString()}
                        </Text>
                      </View>
                    )}
                  </>
                )}

                <View style={[styles.summaryRow, { marginTop: 10, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10 }]}>
                  <Text style={[styles.summaryLabel, { fontWeight: 'bold', fontSize: 18 }]}>Total:</Text>
                  <Text style={[styles.summaryValue, { fontWeight: 'bold', fontSize: 18 }]}>
                    ₦{(
                      editingItems.reduce((sum, item) => sum + item.total, 0) +
                      (editingItems.reduce((sum, item) => sum + item.total, 0) * (parseFloat(editingVatRate) || 0) / 100) -
                      (parseFloat(editingDiscount) || 0)
                    ).toLocaleString()}
                  </Text>
                </View>
              </View>


              {/* Due Date Selection - Prerequisite for Approval */}
              {
                (selectedInvoice.status === 'draft' || !selectedInvoice.status) && (
                  <View style={styles.dueDateSection}>
                    <Text style={styles.sectionTitle}>Due Date (Required)</Text>
                    <TouchableOpacity
                      style={[styles.dateInput, !editingDueDate && styles.dateInputError]}
                      onPress={() => {
                        setActiveDatePicker('due');
                        if (Platform.OS === 'android') {
                          setShowDatePicker(true);
                        }
                      }}
                    >
                      <Text style={styles.dateInputText}>
                        {editingDueDate ? format(editingDueDate, 'MMM dd, yyyy') : 'Select Due Date'}
                      </Text>
                      <Ionicons name="calendar-outline" size={20} color={Colors.textPrimary} />
                    </TouchableOpacity>
                    {activeDatePicker === 'due' && (Platform.OS === 'ios' || showDatePicker) && (
                      <View>
                        {Platform.OS === 'ios' && (
                          <View style={styles.datePickerToolbar}>
                            <TouchableOpacity
                              onPress={() => setActiveDatePicker(null)}
                              style={styles.datePickerDoneButton}
                            >
                              <Text style={styles.datePickerDoneText}>Done</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                        <DateTimePicker
                          value={editingDueDate || new Date()}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                          minimumDate={new Date()}
                          themeVariant="light"
                          onChange={(event, selectedDate) => {
                            if (Platform.OS === 'android') {
                              setShowDatePicker(false);
                              setActiveDatePicker(null);
                            }
                            if (selectedDate) {
                              setEditingDueDate(selectedDate);
                              // Do not close on iOS, wait for Done button
                            }
                          }}
                          style={Platform.OS === 'ios' ? { backgroundColor: 'white' } : undefined}
                        />
                      </View>
                    )}
                  </View>
                )
              }

              {
                selectedInvoice.paymentHistory &&
                selectedInvoice.paymentHistory.length > 0 && (
                  <View style={styles.paymentHistorySection}>
                    <Text style={styles.sectionTitle}>Payment History</Text>
                    {selectedInvoice.paymentHistory.map(
                      (payment, index: number) => {
                        const paymentDate = payment.date instanceof Date ? payment.date : new Date(payment.date);
                        return (
                          <View key={index} style={styles.paymentHistoryItem}>
                            <Text style={styles.paymentAmount}>
                              ₦{payment.amount.toLocaleString()}
                            </Text>
                            <Text style={styles.paymentDate}>
                              {format(paymentDate, 'MMM dd, yyyy')} - {payment.method}
                            </Text>
                          </View>
                        );
                      }
                    )}
                  </View>
                )
              }


              {/* Locked Message */}
              {
                !canEditInvoice() && (
                  <View style={styles.lockedMessage}>
                    <Ionicons name="lock-closed-outline" size={20} color={Colors.warning} />
                    <Text style={styles.lockedText}>
                      {selectedInvoice.status === 'approved'
                        ? 'Invoice is approved and locked'
                        : 'Invoice cannot be edited after payment has been recorded'}
                    </Text>
                  </View>
                )
              }

              {/* Approve Button for Drafts */}
              {
                (selectedInvoice.status === 'draft' || !selectedInvoice.status) && (
                  <TouchableOpacity
                    style={styles.approveButton}
                    onPress={handleApproveInvoice}
                  >
                    <Ionicons name="checkmark-circle-outline" size={24} color={Colors.textInverse} style={{ marginRight: 8 }} />
                    <Text style={styles.approveButtonText}>
                      {selectedInvoice.items.some(i => i.description.toLowerCase().includes('tow'))
                        ? 'Approve'
                        : 'Approve & Send'}
                    </Text>
                  </TouchableOpacity>
                )
              }

              {
                !showAddItem && (
                  <>
                    <View style={styles.paymentActions}>
                      <Text style={styles.paymentSummaryText}>
                        Paid: ₦{(selectedInvoice.amountPaid || 0).toLocaleString()} / {(editingItems.reduce((sum, item) => sum + item.total, 0) - (selectedInvoice.amountPaid || 0)) < 0 ? 'Overpayment' : 'Remaining'}: ₦
                        {Math.abs(editingItems.reduce((sum, item) => sum + item.total, 0) - (selectedInvoice.amountPaid || 0)).toLocaleString()}
                      </Text>
                      {(() => {
                        const currentTotal = editingItems.reduce((sum, item) => sum + item.total, 0);
                        const amountPaid = selectedInvoice.amountPaid || 0;
                        const isFullyPaid = amountPaid >= currentTotal;

                        return (
                          <>
                            <TouchableOpacity
                              style={[styles.payButton, (isFullyPaid || loading) && styles.disabledButton]}
                              onPress={() => {
                                console.log('Record Payment button pressed');
                                handleRecordPayment(false);
                              }}
                              disabled={isFullyPaid || loading}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.payButtonText}>Record Payment</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.payButton, styles.fullPayButton, (isFullyPaid || loading) && styles.disabledButton]}
                              onPress={() => handleRecordPayment(true)}
                              disabled={isFullyPaid || loading}
                            >
                              <Text style={styles.payButtonText}>Mark Fully Paid</Text>
                            </TouchableOpacity>
                          </>
                        );
                      })()}
                    </View>

                    <TouchableOpacity style={styles.downloadButton} onPress={handleDownload}>
                      <Ionicons name="download-outline" size={20} color={Colors.textPrimary} />
                      <Text style={styles.downloadButtonText}>Download Invoice</Text>
                    </TouchableOpacity>
                  </>
                )
              }
            </ScrollView >
          )
          }
        </View >
      </Modal >

      {/* Payment Modal */}
      < Modal
        visible={showPaymentModal}
        animationType="slide"
        transparent={true}
        statusBarTranslucent={true}
        onRequestClose={() => {
          console.log('Modal onRequestClose called');
          setShowPaymentModal(false);
          setPaymentAmount('');
          // Reopen invoice modal when canceling payment
          setTimeout(() => {
            setShowInvoiceModal(true);
          }, 100);
        }
        }
      >
        <TouchableOpacity
          style={styles.paymentModalOverlay}
          activeOpacity={1}
          onPress={() => {
            console.log('Overlay pressed');
            setShowPaymentModal(false);
            setPaymentAmount('');
            // Reopen invoice modal when canceling payment
            setTimeout(() => {
              setShowInvoiceModal(true);
            }, 100);
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={styles.paymentModalContent}
          >
            <Text style={styles.paymentModalTitle}>Record Payment</Text>
            <Text style={styles.paymentModalSubtitle}>
              {selectedInvoice && (editingItems.reduce((sum, item) => sum + item.total, 0) - (selectedInvoice.amountPaid || 0)) < 0 ? 'Overpayment' : 'Remaining'}: ₦
              {selectedInvoice
                ? Math.abs(editingItems.reduce((sum, item) => sum + item.total, 0) - (selectedInvoice.amountPaid || 0)).toLocaleString()
                : '0'}
            </Text>

            <Text style={styles.inputLabel}>Amount</Text>
            <TextInput
              style={styles.input}
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              placeholder="Enter amount"
              keyboardType="numeric"
            />

            <View style={styles.paymentModalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowPaymentModal(false);
                  setPaymentAmount('');
                  // Reopen invoice modal when canceling payment
                  setTimeout(() => {
                    setShowInvoiceModal(true);
                  }, 100);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={() => {
                  const amount = parseFloat(paymentAmount);
                  if (amount > 0) {
                    processPayment(amount, 'partial');
                  }
                }}
                disabled={loading || !paymentAmount || parseFloat(paymentAmount) <= 0}
              >
                {loading ? (
                  <ActivityIndicator color={Colors.textInverse} />
                ) : (
                  <Text style={styles.confirmButtonText}>Record</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal >

      {/* Date Filter Modal */}
      < Modal
        visible={showDateFilterModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDateFilterModal(false)}
      >
        <View style={styles.dateFilterModalOverlay}>
          <View style={styles.dateFilterModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter by Date</Text>
              <TouchableOpacity onPress={() => setShowDateFilterModal(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.dateFilterFields}>
              <View style={styles.dateFilterField}>
                <Text style={styles.inputLabel}>Start Date</Text>
                <TouchableOpacity
                  style={styles.dateInput}
                  onPress={() => {
                    setActiveDatePicker('start');
                    if (Platform.OS === 'android') {
                      setShowDatePicker(true);
                    }
                  }}
                >
                  <Text style={styles.dateInputText}>
                    {dateFilter.start ? format(dateFilter.start, 'MMM dd, yyyy') : 'Select start date'}
                  </Text>
                  <Ionicons name="calendar-outline" size={20} color={Colors.textPrimary} />
                </TouchableOpacity>
                {activeDatePicker === 'start' && (Platform.OS === 'ios' || showDatePicker) && (
                  <DateTimePicker
                    value={dateFilter.start || new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedDate) => {
                      if (Platform.OS === 'android') {
                        setShowDatePicker(false);
                        setActiveDatePicker(null);
                      }
                      if (selectedDate) {
                        setDateFilter({ ...dateFilter, start: selectedDate });
                        if (Platform.OS === 'ios') {
                          setActiveDatePicker(null);
                        }
                      }
                    }}
                  />
                )}
              </View>

              <View style={styles.dateFilterField}>
                <Text style={styles.inputLabel}>End Date</Text>
                <TouchableOpacity
                  style={styles.dateInput}
                  onPress={() => {
                    setActiveDatePicker('end');
                    if (Platform.OS === 'android') {
                      setShowDatePicker(true);
                    }
                  }}
                >
                  <Text style={styles.dateInputText}>
                    {dateFilter.end ? format(dateFilter.end, 'MMM dd, yyyy') : 'Select end date'}
                  </Text>
                  <Ionicons name="calendar-outline" size={20} color={Colors.textPrimary} />
                </TouchableOpacity>
                {activeDatePicker === 'end' && (Platform.OS === 'ios' || showDatePicker) && (
                  <DateTimePicker
                    value={dateFilter.end || new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedDate) => {
                      if (Platform.OS === 'android') {
                        setShowDatePicker(false);
                        setActiveDatePicker(null);
                      }
                      if (selectedDate) {
                        setDateFilter({ ...dateFilter, end: selectedDate });
                        if (Platform.OS === 'ios') {
                          setActiveDatePicker(null);
                        }
                      }
                    }}
                  />
                )}
              </View>
            </View>

            <View style={styles.dateFilterActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setDateFilter({ start: null, end: null });
                  setShowDateFilterModal(false);
                }}
              >
                <Text style={styles.cancelButtonText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={() => setShowDateFilterModal(false)}
              >
                <Text style={styles.confirmButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal >

      {/* Payment Success Modal */}
      < Modal
        visible={showPaymentSuccessModal}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
      >
        <View style={styles.successModalOverlay}>
          <View style={styles.successModalContent}>
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark" size={40} color={Colors.textInverse} />
            </View>
            <Text style={styles.successTitle}>Payment Recorded!</Text>
            <Text style={styles.successMessage}>
              Payment of ₦{recordedPaymentAmount.toLocaleString()} recorded successfully for Invoice #{selectedInvoice?.id}
            </Text>
            <TouchableOpacity
              style={styles.successButton}
              onPress={() => {
                setShowPaymentSuccessModal(false);
                // Reopen invoice modal
                setTimeout(() => {
                  setShowInvoiceModal(true);
                }, 100);
              }}
            >
              <Text style={styles.successButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal >


    </View >
  );
}

function InventoryItemRow({ item, onAdd }: { item: InventoryItem; onAdd: (qty: number) => void }) {
  const [quantity, setQuantity] = useState('1');

  const handleAdd = () => {
    const qty = parseFloat(quantity) || 1;
    if (qty <= 0) {
      Alert.alert('Error', 'Quantity must be greater than 0');
      return;
    }
    if (qty > item.quantity) {
      Alert.alert('Error', `Only ${item.quantity} available in stock`);
      return;
    }
    onAdd(qty);
    // Reset quantity after adding but keep the row visible
    setQuantity('1');
  };

  return (
    <View style={styles.inventoryItemRow}>
      <View style={styles.inventoryItemInfo}>
        <Text style={styles.inventoryItemName}>{item.name}</Text>
        <Text style={styles.inventoryItemDetails}>
          Stock: {item.quantity} • ₦{item.unitPrice.toLocaleString()} each
        </Text>
        {item.category && (
          <Text style={styles.inventoryItemCategory}>{item.category}</Text>
        )}
      </View>
      <View style={styles.inventoryItemActions}>
        <TextInput
          style={styles.quantityInput}
          value={quantity}
          onChangeText={(text) => {
            const numericValue = text.replace(/[^0-9.]/g, '');
            setQuantity(numericValue);
          }}
          placeholder="Qty"
          keyboardType="numeric"
        />
        <TouchableOpacity
          style={styles.addInventoryButton}
          onPress={handleAdd}
          disabled={item.quantity === 0}
        >
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    paddingTop: Platform.OS === 'android' ? 40 : Spacing['5xl'],
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeContainer: {
    flexDirection: 'row',
    padding: Spacing.base,
    backgroundColor: Colors.surface,
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  typeTab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: BorderRadius.md,
  },
  typeTabActive: {
    backgroundColor: Colors.secondary,
  },
  typeText: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.textSecondary,
  },
  typeTextActive: {
    color: Colors.textInverse,
    fontWeight: Typography.fontWeight.semibold,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
  },
  dateFilterButton: {
    padding: Spacing.sm,
  },
  filterContainer: {
    flexDirection: 'row',
    padding: Spacing.base,
    backgroundColor: Colors.surface,
    gap: Spacing.sm,
  },
  filterPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterPillActive: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  filterText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeight.medium,
  },
  filterTextActive: {
    color: Colors.textInverse,
  },
  listContent: {
    padding: Spacing.base,
  },
  invoiceCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.base,
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  invoiceNumber: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
    paddingVertical: 16,
    paddingHorizontal: 15,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  itemSubtitle: {
    fontSize: 13,
    color: '#888',
  },
  itemRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  amountText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    padding: Spacing['5xl'],
    alignItems: 'center',
  },
  emptyText: {
    marginTop: Spacing.base,
    fontSize: Typography.fontSize.base,
    color: Colors.textTertiary,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    paddingTop: Platform.OS === 'android' ? 20 : Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  modalContent: {
    flex: 1,
    padding: Spacing.lg,
  },
  invoiceDetailsCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.lg,
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
  },
  itemsSection: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.base,
    color: Colors.textPrimary,
  },
  itemRow: {
    marginBottom: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: Spacing.base,
  },
  itemInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  itemEditForm: {
    backgroundColor: Colors.background,
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
  },
  itemEditInput: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: Typography.fontSize.base,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textPrimary,
  },
  itemEditRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  itemEditField: {
    flex: 1,
  },
  itemEditLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  itemEditInputSmall: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: Typography.fontSize.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textPrimary,
  },
  itemEditActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  itemEditButton: {
    flex: 1,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  itemEditButtonText: {
    color: Colors.textInverse,
    fontWeight: Typography.fontWeight.semibold,
  },
  addItemForm: {
    backgroundColor: Colors.background,
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.sm,
    borderWidth: 2,
    borderColor: Colors.secondary,
    borderStyle: 'dashed',
  },
  addItemButton: {
    padding: 8,
    backgroundColor: Colors.secondary,
    borderRadius: BorderRadius.md,
  },
  addItemTabs: {
    flexDirection: 'row',
    marginBottom: Spacing.base,
    backgroundColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: 2,
  },
  approveButton: {
    backgroundColor: Colors.success,
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    marginTop: Spacing.sm,
  },
  approveButtonText: {
    color: Colors.textInverse,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
  },
  addItemTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: BorderRadius.sm,
  },
  addItemTabActive: {
    backgroundColor: Colors.secondary,
  },
  addItemTabText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textSecondary,
  },
  addItemTabTextActive: {
    color: Colors.textInverse,
  },
  inventorySelectionContainer: {
    maxHeight: 400,
  },
  inventoryItemsList: {
    maxHeight: 300,
  },
  doneButton: {
    backgroundColor: Colors.secondary,
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginTop: Spacing.base,
    marginBottom: Spacing.sm,
  },
  doneButtonText: {
    color: Colors.textInverse,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
  },
  inventoryItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  inventoryItemInfo: {
    flex: 1,
    marginRight: Spacing.base,
  },
  inventoryItemName: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  inventoryItemDetails: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  inventoryItemCategory: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
  },
  inventoryItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quantityInput: {
    width: 60,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
    padding: 8,
    fontSize: Typography.fontSize.sm,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textPrimary,
  },
  addInventoryButton: {
    backgroundColor: Colors.secondary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.base,
  },
  saveInvoiceButton: {
    backgroundColor: Colors.secondary,
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginTop: Spacing.base,
    marginBottom: Spacing.sm,
  },
  saveInvoiceButtonText: {
    color: Colors.textInverse,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
  },
  lockedMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd', // Status color warning light? Maybe use design constants if available
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    gap: 10,
  },
  lockedText: {
    flex: 1,
    color: '#856404',
    fontSize: Typography.fontSize.sm,
  },
  itemDescription: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  itemDetails: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  summarySection: {
    backgroundColor: Colors.background,
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
  },
  balanceDue: {
    fontSize: Typography.fontSize.lg,
    color: Colors.error,
  },
  paymentHistorySection: {
    marginBottom: Spacing.lg,
  },
  paymentHistoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  paymentAmount: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.successLight, // or calculate based on payment status
  },
  paymentDate: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  paymentActions: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  paymentSummaryText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.base,
    textAlign: 'center',
  },
  payButton: {
    backgroundColor: Colors.secondary,
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginBottom: 10,
  },
  fullPayButton: {
    backgroundColor: Colors.secondary,
  },
  payButtonText: {
    color: Colors.textInverse,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
  },
  disabledButton: {
    opacity: 0.5,
    backgroundColor: '#ccc',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.textPrimary,
    marginTop: 10,
  },
  downloadButtonText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
    marginLeft: 8,
  },
  paymentModalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentModalContent: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    width: '90%',
    maxWidth: 400,
  },
  paymentModalTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: 8,
    color: Colors.textPrimary,
  },
  paymentModalSubtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: Typography.fontSize.base,
    marginBottom: Spacing.base,
    color: Colors.textPrimary,
  },
  methodButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: Spacing.lg,
  },
  methodButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  methodButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  methodButtonText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  methodButtonTextActive: {
    color: Colors.textInverse,
    fontWeight: Typography.fontWeight.semibold,
  },
  paymentModalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: Colors.background,
  },
  confirmButton: {
    backgroundColor: Colors.secondary,
  },
  cancelButtonText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
  },
  confirmButtonText: {
    color: Colors.textInverse,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
  },
  dateFilterModalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  dateFilterModalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingBottom: 40,
  },
  dateFilterFields: {
    marginVertical: Spacing.lg,
  },
  dateFilterField: {
    marginBottom: Spacing.lg,
  },
  dateInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dateInputText: {
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
  },
  dateFilterActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: Spacing.lg,
  },
  successModalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  successModalContent: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing['2xl'],
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    ...Shadows.lg,
  },
  successIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  successTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: 10,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: Typography.fontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing['2xl'],
    lineHeight: 22,
  },
  successButton: {
    backgroundColor: Colors.secondary,
    paddingVertical: Spacing.base,
    paddingHorizontal: 40,
    borderRadius: BorderRadius.md,
    width: '100%',
    alignItems: 'center',
  },
  successButtonText: {
    color: Colors.textInverse,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
  },
  dueDateSection: {
    marginBottom: Spacing.lg,
    marginTop: 10,
  },
  dateInputError: {
    borderColor: Colors.error,
  },
  datePickerToolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    backgroundColor: Colors.borderLight,
    padding: 10,
    borderTopLeftRadius: BorderRadius.md,
    borderTopRightRadius: BorderRadius.md,
  },
  datePickerDoneButton: {
    paddingHorizontal: 15,
  },
  datePickerDoneText: {
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeight.semibold,
    fontSize: Typography.fontSize.base,
  },
});

