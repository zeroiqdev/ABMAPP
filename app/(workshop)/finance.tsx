import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Pressable,
  RefreshControl,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';
import { Invoice, InvoiceItem, Job, User, PaymentStatus, InventoryItem, Quote } from '@/types';
import { format } from 'date-fns';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, Typography, Spacing, BorderRadius, Shadows, StatusColors, useColors } from '@/constants/design';
import { Platform } from 'react-native';

export default function FinanceScreen() {
  const { user } = useAuthStore();
  const router = useRouter();
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
  const colors = useColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [invoices, setInvoices] = useState<Invoice[]>([]);


  const [invoiceType, setInvoiceType] = useState<'job' | 'direct'>('job');
  const [mainSection, setMainSection] = useState<'quotes' | 'invoices'>('quotes');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [filteredQuotes, setFilteredQuotes] = useState<Quote[]>([]);
  const [quoteSearchQuery, setQuoteSearchQuery] = useState('');
  const [quoteFilter, setQuoteFilter] = useState<'all' | 'draft' | 'pending' | 'converted'>('all');
  const [showCreateOptionsModal, setShowCreateOptionsModal] = useState(false);

  const { invoiceId: deepLinkInvoiceId } = useLocalSearchParams<{ invoiceId?: string }>();

  useEffect(() => {
    loadInvoices();
    loadQuotes();
    if (user?.workshopId) {
      loadInventory();
    }
    if (user?.id) {
      // Run reminder check silently in background
      firebaseService.checkAndSendInvoiceReminders(user.id);
    }
  }, [user?.workshopId]);

  // Auto-open invoice modal when navigating from quote's "View Invoice" button
  useEffect(() => {
    if (deepLinkInvoiceId && invoices.length > 0) {
      const target = invoices.find(inv => inv.id === deepLinkInvoiceId);
      if (target) {
        setSelectedInvoice(target);
        setShowInvoiceModal(true);
        setMainSection('invoices');
      } else {
        // Invoice might not be in current list, fetch directly
        firebaseService.getInvoice(deepLinkInvoiceId).then(inv => {
          if (inv) {
            setSelectedInvoice(inv);
            setShowInvoiceModal(true);
            setMainSection('invoices');
          }
        });
      }
    }
  }, [deepLinkInvoiceId, invoices]);

  const loadQuotes = async () => {
    if (!user?.workshopId) return;
    try {
      const quotesData = await firebaseService.getQuotes(user.workshopId);
      setQuotes(quotesData);
    } catch (error) {
      console.error('Error loading quotes:', error);
    }
  };

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

  useEffect(() => {
    filterQuotes();
  }, [quotes, quoteFilter, quoteSearchQuery]);

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

  const filterQuotes = () => {
    let result = quotes;

    // Status Filter
    if (quoteFilter === 'draft') {
      result = result.filter(q => q.status === 'draft');
    } else if (quoteFilter === 'pending') {
      result = result.filter(q => q.status === 'pending_approval');
    } else if (quoteFilter === 'converted') {
      result = result.filter(q => q.status === 'converted');
    }

    // Search Filter
    if (quoteSearchQuery) {
      const query = quoteSearchQuery.toLowerCase();
      result = result.filter(q =>
        (q.customerName && q.customerName.toLowerCase().includes(query)) ||
        q.id.toLowerCase().includes(query) ||
        format(q.createdAt, 'MMM dd, yyyy').toLowerCase().includes(query)
      );
    }

    setFilteredQuotes(result);
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
    return selectedInvoice && (selectedInvoice.amountPaid || 0) < (selectedInvoice.total || 0);
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

  const handleAddItem = () => {
    if (!newItem.description || !newItem.unitPrice) {
      Alert.alert('Error', 'Please enter description and price');
      return;
    }

    const qty = parseFloat(newItem.quantity) || 1;
    const price = parseFloat(newItem.unitPrice) || 0;

    const item: InvoiceItem = {
      id: Date.now().toString(),
      description: newItem.description,
      quantity: qty,
      unitPrice: price,
      total: qty * price,
    };

    // Use functional updater to always get latest state
    setEditingItems(prev => {
      const updated = [...prev, item];
      saveInvoiceItems(updated);
      return updated;
    });

    // Clear form
    setNewItem({ description: '', quantity: '1', unitPrice: '' });
  };

  const handleAddInventoryItem = async (inventoryItem: InventoryItem, quantity: number) => {
    if (!canEditInvoice()) return;

    const item: InvoiceItem = {
      id: Date.now().toString(),
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
        vat: vatAmount,
        vatRate,
        discount,
      };

      // Ensure workshop ownership is set if available
      if (user?.workshopId) {
        updateData.workshopId = user.workshopId;
      }

      // Only update due date if it's being edited and has a value
      if (editingDueDate) {
        updateData.dueDate = editingDueDate;
      }

      await firebaseService.updateInvoice(selectedInvoice.id, updateData);

      // Optimistic local update — update selectedInvoice in place
      const updatedInvoice = { ...selectedInvoice, ...updateData };
      setSelectedInvoice(updatedInvoice);

      // Update the invoice in the list so the list view reflects changes
      setInvoices(prev => prev.map(inv =>
        inv.id === selectedInvoice.id ? updatedInvoice : inv
      ));
    } catch (error: any) {
      console.error('Error saving invoice items:', error);
      Alert.alert('Error', `Failed to save item: ${error.message}`);
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

      // Close invoice modal first to prevent modal stacking issues
      setShowInvoiceModal(false);
      setActiveDatePicker(null);

      // Show success modal after invoice modal closes
      setTimeout(() => {
        setShowPaymentSuccessModal(true);
      }, 300);

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

      const updateData: any = {
        items: editingItems,
        subtotal,
        total,
        vat: vatAmount,
        vatRate,
        discount,
        dueDate: editingDueDate || undefined,
      };

      if (user?.workshopId) {
        updateData.workshopId = user.workshopId;
      }

      await firebaseService.updateInvoice(selectedInvoice.id, updateData);

      if (showAlert) {
        Alert.alert('Success', 'Invoice updated successfully');
      }
      await loadInvoices();

      // Reload the invoice to get updated data
      // Trust local state for immediate feedback
      // const updatedInvoice = await firebaseService.getInvoice(selectedInvoice.id);
      // if (updatedInvoice) {
      //   setSelectedInvoice(updatedInvoice);
      //   setEditingItems([...updatedInvoice.items]);
      // }

      if (closeModal) {
        setShowInvoiceModal(false);
        setActiveDatePicker(null);
      }
    } catch (error: any) {
      console.error('Error saving invoice:', error);
      Alert.alert('Error', `Failed to update invoice: ${error.message}`);
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

  const getQuoteStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return colors.textTertiary;
      case 'pending_approval': return colors.warning;
      case 'converted': return colors.success;
      case 'cancelled': return colors.error;
      default: return colors.textTertiary;
    }
  };

  const getQuoteStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return 'Draft';
      case 'pending_approval': return 'Awaiting Approval';
      case 'converted': return 'Converted';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  // Helper to get quote total, calculating from items if needed
  const getQuoteTotal = (quote: Quote): number => {
    if (typeof quote.total === 'number' && !isNaN(quote.total)) {
      return quote.total;
    }
    // Calculate from items if total is missing/NaN
    if (quote.items && quote.items.length > 0) {
      return quote.items.reduce((sum, item) => sum + (item.total || item.quantity * item.unitPrice || 0), 0);
    }
    return 0;
  };

  // Helper to get invoice total safely
  const getInvoiceTotal = (invoice: Invoice): number => {
    if (typeof invoice.total === 'number' && !isNaN(invoice.total)) {
      return invoice.total;
    }
    // Calculate from items if total is missing/NaN
    if (invoice.items && invoice.items.length > 0) {
      return invoice.items.reduce((sum, item) => sum + (item.total || item.quantity * item.unitPrice || 0), 0);
    }
    return 0;
  };

  const renderQuote = ({ item }: { item: Quote }) => (
    <TouchableOpacity
      style={[styles.itemCard, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
      onPress={() => router.push(`/(workshop)/quote-details?id=${item.id}`)}
    >
      <View style={styles.itemLeft}>
        <View style={[styles.iconBox, { backgroundColor: getQuoteStatusColor(item.status) + '20' }]}>
          <Ionicons name="document-text-outline" size={24} color={getQuoteStatusColor(item.status)} />
        </View>
        <View style={styles.itemInfo}>
          <Text style={[styles.itemName, { color: colors.textPrimary }]} numberOfLines={1}>{item.customerName}</Text>
          <Text style={[styles.itemSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {format(item.createdAt, 'MMM dd, yyyy')}
          </Text>
        </View>
      </View>
      <View style={styles.itemRight}>
        <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
          <Text style={[styles.amountText, { color: colors.textPrimary }]}>₦{getQuoteTotal(item).toLocaleString()}</Text>
          <Text style={[styles.statusText, { color: getQuoteStatusColor(item.status) }]}>
            {getQuoteStatusLabel(item.status)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
      </View>
    </TouchableOpacity>
  );

  const renderInvoice = ({ item }: { item: Invoice }) => {
    const amountPaid = item.amountPaid || 0;
    const remaining = item.total - amountPaid;
    const customerName = item.customerName || (item.userId ? customerNamesMap[item.userId] : 'Direct Customer') || 'Loading...';

    return (
      <TouchableOpacity
        style={[styles.itemCard, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
        onPress={() => handleInvoicePress(item)}
      >
        <View style={styles.itemLeft}>
          <View style={[styles.iconBox, { backgroundColor: getPaymentStatusColor(item.paymentStatus) + '20' }]}>
            <Ionicons name={getInvoiceIcon(item.paymentStatus)} size={24} color={getPaymentStatusColor(item.paymentStatus)} />
          </View>
          <View style={styles.itemInfo}>
            <Text style={[styles.itemName, { color: colors.textPrimary }]} numberOfLines={1}>
              Invoice #{item.id.slice(0, 8)}
            </Text>
            <Text style={[styles.itemSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
              {customerName} • {format(item.createdAt, 'MMM dd, yyyy')}
            </Text>
          </View>
        </View>
        <View style={styles.itemRight}>
          <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
            <Text style={[styles.amountText, { color: colors.textPrimary }]}>₦{getInvoiceTotal(item).toLocaleString()}</Text>
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
          <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Finance</Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowCreateOptionsModal(true)}
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: colors.textPrimary,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Ionicons name="add" size={24} color={colors.background} />
        </TouchableOpacity>
      </View>

      <View style={[styles.typeContainer, { backgroundColor: 'transparent', borderBottomWidth: 0, paddingHorizontal: 0 }]}>
        <TouchableOpacity
          style={[
            styles.typeTab,
            mainSection === 'quotes' && styles.typeTabActive,
            { backgroundColor: mainSection === 'quotes' ? colors.textPrimary : colors.surface, borderWidth: 1, borderColor: colors.border }
          ]}
          onPress={() => setMainSection('quotes')}
        >
          <Text
            style={[
              styles.typeText,
              mainSection === 'quotes' && styles.typeTextActive,
              { color: mainSection === 'quotes' ? colors.textInverse : colors.textSecondary }
            ]}
          >
            Quotes
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.typeTab,
            mainSection === 'invoices' && styles.typeTabActive,
            { backgroundColor: mainSection === 'invoices' ? colors.textPrimary : colors.surface, borderWidth: 1, borderColor: colors.border }
          ]}
          onPress={() => setMainSection('invoices')}
        >
          <Text
            style={[
              styles.typeText,
              mainSection === 'invoices' && styles.typeTextActive,
              { color: mainSection === 'invoices' ? colors.textInverse : colors.textSecondary }
            ]}
          >
            Invoices
          </Text>
        </TouchableOpacity>
      </View>

      {/* Quotes Section */}
      {mainSection === 'quotes' ? (
        <View style={{ flex: 1 }}>
          <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
            <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: colors.textPrimary }]}
              placeholder="Search quotes..."
              value={quoteSearchQuery}
              onChangeText={setQuoteSearchQuery}
              placeholderTextColor={colors.textTertiary}
            />
          </View>
          <View style={[styles.filterContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            {(['all', 'draft', 'pending', 'converted'] as const).map((f) => (
              <TouchableOpacity
                key={f}
                style={[
                  styles.filterPill,
                  { backgroundColor: colors.background },
                  quoteFilter === f && { backgroundColor: colors.textPrimary }
                ]}
                onPress={() => setQuoteFilter(f as any)}
              >
                <Text style={[
                  styles.filterText,
                  { color: colors.textSecondary },
                  quoteFilter === f && { color: colors.textInverse }
                ]}>
                  {f === 'pending' ? 'Pending' : f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <FlatList
            data={filteredQuotes}
            renderItem={renderQuote}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => {
                loadInvoices();
                loadQuotes();
              }} />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={64} color={colors.textTertiary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No quotes found</Text>
              </View>
            }
          />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={[styles.subTabContainer, { backgroundColor: 'transparent', paddingHorizontal: 16, marginBottom: 10 }]}>
            <TouchableOpacity
              style={[
                styles.subTab,
                { backgroundColor: invoiceType === 'job' ? colors.textPrimary : colors.surface, borderWidth: 1, borderColor: colors.border },
              ]}
              onPress={() => setInvoiceType('job')}
            >
              <Text style={[
                styles.subTabText,
                { color: invoiceType === 'job' ? colors.textInverse : colors.textSecondary },
              ]}>Job Invoices</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.subTab,
                { backgroundColor: invoiceType === 'direct' ? colors.textPrimary : colors.surface, borderWidth: 1, borderColor: colors.border },
              ]}
              onPress={() => setInvoiceType('direct')}
            >
              <Text style={[
                styles.subTabText,
                { color: invoiceType === 'direct' ? colors.textInverse : colors.textSecondary },
              ]}>Direct Invoices</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <Ionicons name="search" size={20} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.textPrimary }]}
              placeholder="Search invoices..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.dateFilterButton}
              onPress={() => setShowDateFilterModal(true)}
            >
              <Ionicons name="calendar-outline" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={[styles.filterContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            {(['all', 'pending', 'partially_paid', 'paid'] as const).map((f) => (
              <TouchableOpacity
                key={f}
                style={[
                  styles.filterPill,
                  { backgroundColor: colors.background },
                  filter === f && { backgroundColor: colors.textPrimary }
                ]}
                onPress={() => setFilter(f)}
              >
                <Text style={[
                  styles.filterText,
                  { color: colors.textSecondary },
                  filter === f && { color: colors.textInverse }
                ]}>
                  {f.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

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

        </View>
      )
      }

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
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Invoice Details</Text>
            <TouchableOpacity onPress={() => {
              setShowInvoiceModal(false);
              setActiveDatePicker(null);
            }}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {selectedInvoice && (
            <ScrollView style={[styles.modalContent, { backgroundColor: colors.background }]}>
              <View style={[styles.invoiceDetailsCard, { backgroundColor: colors.surface }]}>
                <View style={styles.detailRow}>
                  <View style={styles.detailItem}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Invoice #</Text>
                    <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{selectedInvoice.id}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Customer</Text>
                    <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{customerName || 'Loading...'}</Text>
                  </View>
                </View>
                <View style={[styles.detailRow, { marginTop: 15 }]}>
                  <View style={styles.detailItem}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Status</Text>
                    <View style={[
                      styles.statusBadge,
                      {
                        alignSelf: 'flex-start',
                        marginLeft: 0,
                        marginTop: 4,
                        backgroundColor: getPaymentStatusColor(selectedInvoice.paymentStatus) + '15',
                        borderWidth: 1,
                        borderColor: getPaymentStatusColor(selectedInvoice.paymentStatus) + '30'
                      }
                    ]}>
                      <Text style={[styles.statusText, { color: getPaymentStatusColor(selectedInvoice.paymentStatus) }]}>
                        {selectedInvoice.paymentStatus.replace('_', ' ').toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Due Date</Text>
                    <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                      {selectedInvoice.dueDate ? format(selectedInvoice.dueDate, 'MMM dd, yyyy') : 'N/A'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.itemsSection}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 14 }]}>Line Items</Text>
                  {canEditInvoice() && !showAddItem && (
                    <TouchableOpacity
                      onPress={() => {
                        setShowAddItem(true);
                        setAddItemMode('manual');
                      }}
                      style={styles.addItemButton}
                    >
                      <Ionicons name="add-circle" size={32} color="#000" />
                    </TouchableOpacity>
                  )}
                </View>

                {editingItems.map((item, index) => (
                  <View key={item.id || index} style={[styles.itemRow, { backgroundColor: 'transparent', borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 12, marginBottom: 0 }]}>
                    {canEditInvoice() && editingItemIndex === index ? (
                      <View style={styles.itemEditForm}>
                        <TextInput
                          style={[styles.itemEditInput, { color: colors.textPrimary, backgroundColor: colors.background, borderColor: colors.border }]}
                          value={item.description}
                          onChangeText={(text) => handleEditItem(index, 'description', text)}
                          placeholder="Description"
                          placeholderTextColor={colors.textTertiary}
                        />
                        <View style={styles.itemEditRow}>
                          <View style={styles.itemEditField}>
                            <Text style={[styles.itemEditLabel, { color: colors.textSecondary }]}>Qty</Text>
                            <TextInput
                              style={[styles.itemEditInputSmall, { color: colors.textPrimary, backgroundColor: colors.background, borderColor: colors.border }]}
                              value={item.quantity.toString()}
                              onChangeText={(text) => handleEditItem(index, 'quantity', text)}
                              keyboardType="numeric"
                            />
                          </View>
                          <View style={styles.itemEditField}>
                            <Text style={[styles.itemEditLabel, { color: colors.textSecondary }]}>Unit Price</Text>
                            <TextInput
                              style={[styles.itemEditInputSmall, { color: colors.textPrimary, backgroundColor: colors.background, borderColor: colors.border }]}
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
                        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.itemDescription, { color: colors.textPrimary, fontSize: 15, fontWeight: '500' }]}>{item.description}</Text>
                            <Text style={[styles.itemDetails, { color: colors.textSecondary, fontSize: 13, marginTop: 2 }]}>
                              {item.quantity} × ₦{item.unitPrice.toLocaleString()}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>
                            ₦{item.total.toLocaleString()}
                          </Text>
                        </View>
                        {canEditInvoice() && (
                          <Ionicons name="pencil-outline" size={18} color={colors.textSecondary} style={{ marginLeft: 10 }} />
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
                        style={[
                          styles.addItemTab,
                          addItemMode === 'manual' && { backgroundColor: colors.primary },
                          addItemMode !== 'manual' && { backgroundColor: colors.surface }
                        ]}
                        onPress={() => setAddItemMode('manual')}
                      >
                        <Text style={[
                          styles.addItemTabText,
                          { color: addItemMode === 'manual' ? colors.textInverse : colors.textPrimary }
                        ]}>
                          Manual Entry
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.addItemTab,
                          addItemMode === 'inventory' && { backgroundColor: colors.primary },
                          addItemMode !== 'inventory' && { backgroundColor: colors.surface }
                        ]}
                        onPress={() => setAddItemMode('inventory')}
                      >
                        <Ionicons
                          name="cube-outline"
                          size={16}
                          color={addItemMode === 'inventory' ? colors.textInverse : colors.textPrimary}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={[
                          styles.addItemTabText,
                          { color: addItemMode === 'inventory' ? colors.textInverse : colors.textPrimary }
                        ]}>
                          From Inventory
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {addItemMode === 'manual' ? (
                      <>
                        <TextInput
                          style={[styles.itemEditInput, { color: colors.textPrimary, backgroundColor: colors.background, borderColor: colors.border }]}
                          value={newItem.description}
                          onChangeText={(text) => setNewItem({ ...newItem, description: text })}
                          placeholder="Description"
                          placeholderTextColor={colors.textTertiary}
                        />
                        <View style={styles.itemEditRow}>
                          <View style={styles.itemEditField}>
                            <Text style={[styles.itemEditLabel, { color: colors.textSecondary }]}>Qty</Text>
                            <TextInput
                              style={[styles.itemEditInputSmall, { color: colors.textPrimary, backgroundColor: colors.background, borderColor: colors.border }]}
                              value={newItem.quantity}
                              onChangeText={(text) => setNewItem({ ...newItem, quantity: text })}
                              keyboardType="numeric"
                            />
                          </View>
                          <View style={styles.itemEditField}>
                            <Text style={[styles.itemEditLabel, { color: colors.textSecondary }]}>Unit Price</Text>
                            <TextInput
                              style={[styles.itemEditInputSmall, { color: colors.textPrimary, backgroundColor: colors.background, borderColor: colors.border }]}
                              value={newItem.unitPrice}
                              onChangeText={(text) => setNewItem({ ...newItem, unitPrice: text })}
                              keyboardType="numeric"
                            />
                          </View>
                        </View>
                        <Pressable
                          onPress={() => handleAddItem()}
                          style={({ pressed }) => [{
                            backgroundColor: pressed ? colors.primary : colors.secondary,
                            padding: 14,
                            borderRadius: 10,
                            alignItems: 'center',
                            marginTop: 8,
                          }]}
                        >
                          <Text style={{ color: colors.textInverse, fontWeight: '700', fontSize: 16 }}>Add Item</Text>
                        </Pressable>
                      </>
                    ) : (
                      <View style={styles.inventorySelectionContainer}>
                        {inventoryItems.length === 0 ? (
                          <View style={styles.emptyState}>
                            <Ionicons name="cube-outline" size={48} color={colors.textTertiary} />
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No inventory items found</Text>
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

                {canEditInvoice() && showAddItem && (
                  <TouchableOpacity
                    onPress={() => {
                      // If in manual mode and form has data, add the item inline
                      if (addItemMode === 'manual' && newItem.description && newItem.unitPrice) {
                        const qty = parseFloat(newItem.quantity) || 1;
                        const price = parseFloat(newItem.unitPrice) || 0;
                        const item: InvoiceItem = {
                          id: Date.now().toString(),
                          description: newItem.description,
                          quantity: qty,
                          unitPrice: price,
                          total: qty * price,
                        };
                        // Use functional updater to get latest state
                        setEditingItems(prev => {
                          const updated = [...prev, item];
                          // Save in background with the updated array
                          saveInvoiceItems(updated);
                          return updated;
                        });
                        setNewItem({ description: '', quantity: '1', unitPrice: '' });
                      }
                      setShowAddItem(false);
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
                          borderColor: colors.border,
                          borderRadius: 4,
                          width: 60,
                          height: 35,
                          textAlign: 'right',
                          paddingHorizontal: 8,
                          fontSize: 14,
                          backgroundColor: colors.surface,
                          color: colors.textPrimary,
                        }}
                        value={editingVatRate}
                        onChangeText={setEditingVatRate}
                        onBlur={() => handleSaveInvoice(false, false)}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={colors.textTertiary}
                      />
                    </View>
                    <View style={[styles.summaryRow, { alignItems: 'center' }]}>
                      <Text style={styles.summaryLabel}>Discount (Amount):</Text>
                      <TextInput
                        style={{
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: 4,
                          width: 60,
                          height: 35,
                          textAlign: 'right',
                          paddingHorizontal: 8,
                          fontSize: 14,
                          backgroundColor: colors.surface,
                          color: colors.error,
                        }}
                        value={editingDiscount}
                        onChangeText={setEditingDiscount}
                        onBlur={() => handleSaveInvoice(false, false)}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={colors.textTertiary}
                      />
                    </View>
                  </>
                ) : (
                  <>
                    {(parseFloat(editingVatRate) > 0) && (
                      <View style={styles.summaryRow}>
                        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>VAT ({editingVatRate}%):</Text>
                        <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>
                          ₦{(editingItems.reduce((sum, item) => sum + item.total, 0) * (parseFloat(editingVatRate) / 100)).toLocaleString()}
                        </Text>
                      </View>
                    )}
                    {(parseFloat(editingDiscount) > 0) && (
                      <View style={styles.summaryRow}>
                        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Discount:</Text>
                        <Text style={[styles.summaryValue, { color: Colors.error }]}>
                          -₦{parseFloat(editingDiscount).toLocaleString()}
                        </Text>
                      </View>
                    )}
                  </>
                )}

                <View style={[styles.summaryRow, { marginTop: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }]}>
                  <Text style={[styles.summaryLabel, { fontWeight: 'bold', fontSize: 18, color: colors.textPrimary }]}>Total:</Text>
                  <Text style={[styles.summaryValue, { fontWeight: 'bold', fontSize: 18, color: colors.textPrimary }]}>
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
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Due Date (Required)</Text>
                    <TouchableOpacity
                      style={[styles.dateInput, { backgroundColor: colors.background, borderColor: colors.textPrimary, borderWidth: 1 }, !editingDueDate && styles.dateInputError]}
                      onPress={() => {
                        setActiveDatePicker('due');
                        if (Platform.OS === 'android') {
                          setShowDatePicker(true);
                        }
                      }}
                    >
                      <Text style={[styles.dateInputText, { color: colors.textPrimary }]}>
                        {editingDueDate ? format(editingDueDate, 'MMM dd, yyyy') : 'Select Due Date'}
                      </Text>
                      <Ionicons name="calendar-outline" size={20} color={colors.textPrimary} />
                    </TouchableOpacity>
                    {activeDatePicker === 'due' && (Platform.OS === 'ios' || showDatePicker) && (
                      <View>
                        {Platform.OS === 'ios' && (
                          <View style={[styles.datePickerToolbar, { backgroundColor: colors.surface, borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
                            <TouchableOpacity
                              onPress={() => setActiveDatePicker(null)}
                              style={styles.datePickerDoneButton}
                            >
                              <Text style={[styles.datePickerDoneText, { color: colors.primary }]}>Done</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                        <DateTimePicker
                          value={editingDueDate || new Date()}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                          minimumDate={new Date()}
                          // Use system theme variant or force dark based on background color check if needed
                          // For now keeping simple as we don't have straight access to isDark here without hook change
                          style={Platform.OS === 'ios' ? { backgroundColor: colors.surface } : undefined}
                        />
                      </View>
                    )}
                  </View>
                )
              }

              {/* Pending Customer Payments */}
              {
                selectedInvoice.pendingPayments &&
                selectedInvoice.pendingPayments.length > 0 && (
                  <View style={[styles.paymentHistorySection, { borderColor: Colors.warning, borderWidth: 1, borderRadius: 12, padding: 12 }]}>
                    <Text style={[styles.sectionTitle, { color: Colors.warning }]}>⏳ Pending Customer Payments</Text>
                    {selectedInvoice.pendingPayments.map((pp: any, index: number) => {
                      const ppDate = pp.date instanceof Date ? pp.date : new Date(pp.date);
                      return (
                        <View key={pp.id || index} style={[styles.paymentHistoryItem, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.paymentAmount, { color: colors.textPrimary }]}>
                              ₦{pp.amount.toLocaleString()}
                            </Text>
                            <Text style={[styles.paymentDate, { color: colors.textSecondary }]}>
                              {format(ppDate, 'MMM dd, yyyy')} — by {pp.recordedByName || 'Customer'}
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity
                              style={{ backgroundColor: Colors.success, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
                              onPress={async () => {
                                try {
                                  await firebaseService.confirmPendingPayment(
                                    selectedInvoice.id,
                                    pp.id,
                                    user?.id || '',
                                    user?.name || ''
                                  );
                                  Alert.alert('Confirmed', `Payment of ₦${pp.amount.toLocaleString()} confirmed.`);
                                  // Reload invoice
                                  const updated = await firebaseService.getInvoice(selectedInvoice.id);
                                  if (updated) setSelectedInvoice(updated);
                                } catch (err: any) {
                                  Alert.alert('Error', err.message);
                                }
                              }}
                            >
                              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Confirm</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={{ backgroundColor: Colors.error, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
                              onPress={() => {
                                Alert.alert('Reject Payment', `Reject ₦${pp.amount.toLocaleString()} from ${pp.recordedByName}?`, [
                                  { text: 'Cancel', style: 'cancel' },
                                  {
                                    text: 'Reject',
                                    style: 'destructive',
                                    onPress: async () => {
                                      try {
                                        await firebaseService.rejectPendingPayment(selectedInvoice.id, pp.id);
                                        Alert.alert('Rejected', 'Payment has been rejected.');
                                        const updated = await firebaseService.getInvoice(selectedInvoice.id);
                                        if (updated) setSelectedInvoice(updated);
                                      } catch (err: any) {
                                        Alert.alert('Error', err.message);
                                      }
                                    },
                                  },
                                ]);
                              }}
                            >
                              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Reject</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )
              }

              {
                selectedInvoice.paymentHistory &&
                selectedInvoice.paymentHistory.length > 0 && (
                  <View style={styles.paymentHistorySection}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Payment History</Text>
                    {selectedInvoice.paymentHistory.map(
                      (payment, index: number) => {
                        const paymentDate = payment.date instanceof Date ? payment.date : new Date(payment.date);
                        return (
                          <View key={index} style={[styles.paymentHistoryItem, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                            <Text style={[styles.paymentAmount, { color: colors.textPrimary }]}>
                              ₦{payment.amount.toLocaleString()}
                            </Text>
                            <Text style={[styles.paymentDate, { color: colors.textSecondary }]}>
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
                    style={[styles.approveButton, { backgroundColor: '#fff' }]}
                    onPress={handleApproveInvoice}
                  >
                    <Text style={[styles.approveButtonText, { color: '#000' }]}>
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
              }}
            >
              <Text style={styles.successButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal >

      {/* Create Options Modal */}
      <Modal
        visible={showCreateOptionsModal}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setShowCreateOptionsModal(false)}
      >
        <TouchableOpacity
          style={styles.successModalOverlay}
          activeOpacity={1}
          onPress={() => setShowCreateOptionsModal(false)}
        >
          <View style={[styles.successModalContent, { backgroundColor: colors.surface, paddingVertical: 16, alignItems: 'stretch' }]}>
            <Text style={[styles.successTitle, { color: colors.textPrimary, marginBottom: 20, textAlign: 'left', paddingHorizontal: 16 }]}>Create New</Text>

            {/* Create Direct Invoice - Functional Button */}
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 14,
                paddingHorizontal: 16,
              }}
              onPress={() => {
                setShowCreateOptionsModal(false);
                router.push('/(workshop)/create-invoice');
              }}
            >
              <Ionicons name="receipt-outline" size={24} color={colors.textPrimary} style={{ marginRight: 12 }} />
              <View>
                <Text style={{ fontSize: 16, color: colors.textPrimary, fontWeight: '600' }}>Create Direct Invoice</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                  For customers without a job request
                </Text>
              </View>
            </TouchableOpacity>

            {/* Cancel */}
            <TouchableOpacity
              style={{
                marginTop: 16,
                paddingVertical: 12,
                alignItems: 'center',
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
              onPress={() => setShowCreateOptionsModal(false)}
            >
              <Text style={{ fontSize: 16, color: colors.textSecondary }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

    </View >
  );
}

function InventoryItemRow({ item, onAdd }: { item: InventoryItem; onAdd: (qty: number) => void }) {
  const colors = useColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
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
          <Ionicons name="add" size={20} color={colors.textInverse} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
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
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: BorderRadius.full,
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
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  filterText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeight.medium,
  },
  filterTextActive: {
    color: '#000000',
  },
  listContent: {
    padding: 0,
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
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: 15,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
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
    flexDirection: 'row',
    alignItems: 'center',
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
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  modalContent: {
    flex: 1,
    padding: Spacing.lg,
  },
  invoiceDetailsCard: {
    backgroundColor: colors.surface,
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
    color: colors.textSecondary,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  itemsSection: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.base,
    color: colors.textPrimary,
  },
  itemRow: {
    marginBottom: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: Spacing.base,
  },
  itemInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemEditForm: {
    backgroundColor: colors.background,
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
  },
  itemEditInput: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: Typography.fontSize.base,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
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
    color: colors.textSecondary,
    marginBottom: 4,
  },
  itemEditInputSmall: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: Typography.fontSize.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
  },
  itemEditActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  itemEditButton: {
    flex: 1,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: colors.secondary,
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.error,
  },
  itemEditButtonText: {
    color: colors.textInverse,
    fontWeight: Typography.fontWeight.semibold,
  },
  addItemForm: {
    backgroundColor: colors.background,
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.sm,
    borderWidth: 2,
    borderColor: colors.secondary,
    borderStyle: 'dashed',
  },
  addItemButton: {
    padding: 8,
    backgroundColor: colors.secondary,
    borderRadius: BorderRadius.md,
  },
  addItemTabs: {
    flexDirection: 'row',
    marginBottom: Spacing.base,
    backgroundColor: colors.border,
    borderRadius: BorderRadius.md,
    padding: 2,
  },
  approveButton: {
    backgroundColor: colors.success,
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    marginTop: Spacing.sm,
  },
  approveButtonText: {
    color: colors.textInverse,
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
    backgroundColor: colors.secondary,
  },
  addItemTabText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: colors.textSecondary,
  },
  addItemTabTextActive: {
    color: colors.textInverse,
  },
  inventorySelectionContainer: {
    maxHeight: 400,
  },
  inventoryItemsList: {
    maxHeight: 300,
  },
  doneButton: {
    backgroundColor: colors.secondary,
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginTop: Spacing.base,
    marginBottom: Spacing.sm,
  },
  doneButtonText: {
    color: colors.textInverse,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
  },
  inventoryItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  inventoryItemInfo: {
    flex: 1,
    marginRight: Spacing.base,
  },
  inventoryItemName: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  inventoryItemDetails: {
    fontSize: Typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  inventoryItemCategory: {
    fontSize: Typography.fontSize.xs,
    color: colors.textTertiary,
  },
  inventoryItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quantityInput: {
    width: 60,
    backgroundColor: colors.background,
    borderRadius: BorderRadius.sm,
    padding: 8,
    fontSize: Typography.fontSize.sm,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
  },
  addInventoryButton: {
    backgroundColor: colors.secondary,
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
    backgroundColor: colors.secondary,
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginTop: Spacing.base,
    marginBottom: Spacing.sm,
  },
  saveInvoiceButtonText: {
    color: colors.textInverse,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
  },
  lockedMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '20',
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    gap: 10,
  },
  lockedText: {
    flex: 1,
    color: colors.warning, // Use warning text color
    fontSize: Typography.fontSize.sm,
  },
  itemDescription: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.medium,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  itemDetails: {
    fontSize: Typography.fontSize.sm,
    color: colors.textSecondary,
  },
  summarySection: {
    backgroundColor: colors.background,
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
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  balanceDue: {
    fontSize: Typography.fontSize.lg,
    color: colors.error,
  },
  paymentHistorySection: {
    marginBottom: Spacing.lg,
  },
  paymentHistoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  paymentAmount: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
    color: colors.success,
  },
  paymentDate: {
    fontSize: Typography.fontSize.sm,
    color: colors.textSecondary,
  },
  paymentActions: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  paymentSummaryText: {
    fontSize: Typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: Spacing.base,
    textAlign: 'center',
  },
  payButton: {
    backgroundColor: colors.surface,
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fullPayButton: {
    backgroundColor: colors.surface,
  },
  payButtonText: {
    color: colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
  },
  disabledButton: {
    opacity: 0.5,
    backgroundColor: colors.textTertiary + '20', // rough disabled color
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: colors.textPrimary,
    marginTop: 10,
  },
  downloadButtonText: {
    color: colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
    marginLeft: 8,
  },
  paymentModalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentModalContent: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    width: '90%',
    maxWidth: 400,
  },
  paymentModalTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: 8,
    color: colors.textPrimary,
  },
  paymentModalSubtitle: {
    fontSize: Typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: Typography.fontSize.base,
    marginBottom: Spacing.base,
    color: colors.textPrimary,
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
    borderColor: colors.border,
    alignItems: 'center',
  },
  methodButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
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
  quotesTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#007AFF',
    gap: 6,
  },
  quotesTabText: {
    color: '#007AFF',
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
  subTabContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  subTab: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: '#F5F6FA',
  },
  subTabActive: {
    backgroundColor: '#FFFFFF',
  },
  subTabText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },
  subTabTextActive: {
    color: '#000000',
  },
});

