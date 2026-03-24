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
  Image,
  Dimensions,
  Platform,
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';
import { Invoice, InvoiceItem, Job, User, PaymentStatus, InventoryItem, Quote } from '@/types';
import { format } from 'date-fns';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, Typography, Spacing, BorderRadius, Shadows, StatusColors, useColors } from '@/constants/design';
import { amountToWords } from '@/utils/formatUtils';
// Merged into top react-native import


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
  const [proofModalUrl, setProofModalUrl] = useState<string | null>(null);
  const [pendingPaymentToConfirm, setPendingPaymentToConfirm] = useState<any>(null);
  const [pendingPaymentModal, setPendingPaymentModal] = useState(false);
  const [pendingProofUrl, setPendingProofUrl] = useState<string | null>(null);
  const [returnToInvoice, setReturnToInvoice] = useState(false);
  const colors = useColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [invoices, setInvoices] = useState<Invoice[]>([]);


  const [invoiceType, setInvoiceType] = useState<'job' | 'direct'>('job');
  const [mainSection, setMainSection] = useState<'quotes' | 'invoices'>('quotes');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [filteredQuotes, setFilteredQuotes] = useState<Quote[]>([]);
  const [quoteSearchQuery, setQuoteSearchQuery] = useState('');
  const [quoteFilter, setQuoteFilter] = useState<'all' | 'draft' | 'pending' | 'converted' | 'rejected'>('all');
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

  // Guard to prevent deep link from re-triggering on every invoice reload
  const handledDeepLinkRef = React.useRef<string | null>(null);

  // Auto-open invoice modal when navigating from quote's "View Invoice" button
  useEffect(() => {
    if (deepLinkInvoiceId && invoices.length > 0 && handledDeepLinkRef.current !== deepLinkInvoiceId) {
      handledDeepLinkRef.current = deepLinkInvoiceId;
      const target = invoices.find(inv => inv.id === deepLinkInvoiceId);
      if (target) {
        handleInvoicePress(target);
        setMainSection('invoices');
      } else {
        // Invoice might not be in current list, fetch directly
        firebaseService.getInvoice(deepLinkInvoiceId).then(inv => {
          if (inv) {
            handleInvoicePress(inv);
            setMainSection('invoices');
          }
        });
      }
    }
  }, [deepLinkInvoiceId, invoices]);

  // Sequencer for modals to prevent layering issues in React Native
  useEffect(() => {
    // 1. Invoice -> Payment Recording
    if (pendingPaymentModal && !showInvoiceModal) {
      setPendingPaymentModal(false);
      setShowPaymentModal(true);
    }
    // 2. Invoice -> Proof Viewer
    if (pendingProofUrl && !showInvoiceModal) {
      const url = pendingProofUrl;
      setPendingProofUrl(null);
      setProofModalUrl(url);
      setReturnToInvoice(true);
    }
    // 3. Return to Invoice (from Payment or Proof)
    if (returnToInvoice && !showPaymentModal && !proofModalUrl) {
      setReturnToInvoice(false);
      setShowInvoiceModal(true);
    }
  }, [pendingPaymentModal, pendingProofUrl, returnToInvoice, showInvoiceModal, showPaymentModal, proofModalUrl]);

  const loadQuotes = async () => {
    if (!user?.workshopId) return;
    try {
      console.log('[loadQuotes] Loading quotes for workshopId:', user.workshopId);
      const quotesData = await firebaseService.getQuotes(user.workshopId);
      console.log('[loadQuotes] Loaded', quotesData.length, 'quotes');
      setQuotes(quotesData);
    } catch (error) {
      console.error('[loadQuotes] Error loading quotes:', error);
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
    } else if (quoteFilter === 'rejected') {
      result = result.filter(q => q.status === 'rejected');
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

  const calculateSubtotal = (items: InvoiceItem[]) => {
    return items.reduce((sum, item) => {
      const itemTotal = typeof item.total === 'number' ? item.total : (item.quantity * item.unitPrice) || 0;
      return sum + itemTotal;
    }, 0);
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
    // Set initial state from the list item for immediate feedback
    setSelectedInvoice(invoice);
    setEditingItems([...(invoice.items || [])]);
    setEditingDueDate(invoice.dueDate || null);
    setActiveDatePicker(null);
    setEditingItemIndex(null);
    setShowAddItem(false);
    setNewItem({ description: '', quantity: '1', unitPrice: '' });
    setAddItemMode('manual');
    setEditingVatRate(invoice.vatRate ? invoice.vatRate.toString() : '0');
    setEditingDiscount(invoice.discount ? invoice.discount.toString() : '0');
    setShowInvoiceModal(true);

    // Fetch full invoice Details to ensure we have all items and latest data
    try {
      const fullInvoice = await firebaseService.getInvoice(invoice.id);
      if (fullInvoice) {
        setSelectedInvoice(fullInvoice);
        setEditingItems([...(fullInvoice.items || [])]);
        setEditingVatRate(fullInvoice.vatRate ? fullInvoice.vatRate.toString() : '0');
        setEditingDiscount(fullInvoice.discount ? fullInvoice.discount.toString() : '0');
        setEditingDueDate(fullInvoice.dueDate || null);
      }
    } catch (error) {
      console.error('Error fetching full invoice:', error);
    }

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
    return selectedInvoice && selectedInvoice.status !== 'void';
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
        setEditingItems([...(updatedInvoice.items || [])]);
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

    setEditingItems(prev => {
      const updatedItems = [...prev];
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
      return updatedItems;
    });
  };

  const handleDeleteItem = async (index: number) => {
    if (!canEditInvoice()) return;
    if (editingItems[index].description === 'LABOUR') {
      Alert.alert('Error', 'Cannot delete LABOUR item');
      return;
    }
    setEditingItems(prev => {
      const updated = prev.filter((_, i) => i !== index);
      saveInvoiceItems(updated);
      return updated;
    });

    // Save is now handled inside setEditingItems to ensure we use the correct array

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
      isNewAddition: selectedInvoice?.paymentStatus === 'paid',
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
      isNewAddition: selectedInvoice?.paymentStatus === 'paid',
    };

    setEditingItems(prev => {
      const updated = [...prev, item];
      saveInvoiceItems(updated);
      return updated;
    });

    // Save is now handled inside setEditingItems

  };

  const saveInvoiceItems = async (items: InvoiceItem[]) => {
    if (!selectedInvoice || !canEditInvoice()) return;

    try {
      const subtotal = calculateSubtotal(items);
      const vatRate = parseFloat(editingVatRate) || 0;
      const discount = parseFloat(editingDiscount) || 0;
      const vatAmount = subtotal * (vatRate / 100);
      const total = subtotal + vatAmount - discount;

      const amountPaid = selectedInvoice.amountPaid || 0;
      let newPaymentStatus = selectedInvoice.paymentStatus;
      
      if (total > amountPaid) {
        newPaymentStatus = amountPaid > 0 ? 'partially_paid' : 'pending';
      } else if (total <= amountPaid && amountPaid > 0) {
        newPaymentStatus = 'paid';
      }

      const updateData: any = {
        items: items,
        subtotal,
        total,
        vat: vatAmount,
        vatRate,
        discount,
        paymentStatus: newPaymentStatus,
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
    const subtotal = calculateSubtotal(editingItems);
    const vatRate = parseFloat(editingVatRate) || 0;
    const discount = parseFloat(editingDiscount) || 0;
    const vatAmount = subtotal * (vatRate / 100);
    const currentTotal = subtotal + vatAmount - discount;
    const amountPaid = selectedInvoice.amountPaid || 0;
    const remaining = currentTotal - amountPaid;

    if (remaining <= 0) {
      Alert.alert('Info', 'Invoice is already fully paid');
      return;
    }

    if (isFullPayment) {
      setPaymentAmount(remaining.toString());
    } else {
      setPaymentAmount('');
    }

    // Close invoice modal first, then open payment modal via useEffect
    setShowInvoiceModal(false);
    setPendingPaymentModal(true);
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
      const paymentHistory = [...(selectedInvoice.paymentHistory || [])];
      
      if (pendingPaymentToConfirm) {
        console.log('[processPayment] Confirming pending payment with amount:', amount);
        // Confirm pending payment with selected method
        await firebaseService.confirmPendingPayment(
          selectedInvoice.id,
          pendingPaymentToConfirm.id,
          user?.id || '',
          user?.name || '',
          paymentMethod,
          amount
        );
        
        // Add to local history for the final updateInvoice call below
        paymentHistory.push({
          amount,
          date: new Date(),
          method: paymentMethod,
          recordedBy: user?.id,
          recordedByName: user?.name || 'Staff',
          note: `Confirmed payment proof`
        });
        
        setPendingPaymentToConfirm(null);
      } else {
        paymentHistory.push({
          amount,
          date: new Date(),
          method: paymentMethod,
          recordedBy: user?.id,
          recordedByName: user?.name || 'Staff'
        });
      }

      // ALWAYS update the full invoice to ensure items and totals are synced
      const finalSubtotal = calculateSubtotal(editingItems);
      const finalVatRate = parseFloat(editingVatRate) || 0;
      const finalDiscount = parseFloat(editingDiscount) || 0;
      const finalVatAmount = finalSubtotal * (finalVatRate / 100);
      const finalTotal = finalSubtotal + finalVatAmount - finalDiscount;

      await firebaseService.updateInvoice(selectedInvoice.id, {
        paymentStatus: newStatus,
        amountPaid: newPaid,
        paymentHistory: paymentHistory,
        items: editingItems,
        subtotal: finalSubtotal,
        total: finalTotal,
        vat: finalVatAmount,
        vatRate: finalVatRate,
        discount: finalDiscount,
      });

      // Update state immediately for zero-latency feedback
      setSelectedInvoice({
        ...selectedInvoice,
        amountPaid: newPaid,
        paymentStatus: newStatus,
        paymentHistory: paymentHistory,
        items: editingItems,
        subtotal: finalSubtotal,
        total: finalTotal,
        vat: finalVatAmount,
        vatRate: finalVatRate,
        discount: finalDiscount
      });

      // Close payment modal and set flag to return to invoice
      setShowPaymentModal(false);
      setPaymentAmount('');
      setReturnToInvoice(true);

      // Reload invoices list in background
      loadInvoices();

      // Reload the selected invoice to ensure sync with server
      const updated = await firebaseService.getInvoice(selectedInvoice.id);
      if (updated) {
        setSelectedInvoice(updated);
        setEditingItems([...updated.items]);
        setEditingVatRate(updated.vatRate ? updated.vatRate.toString() : '0');
        setEditingDiscount(updated.discount ? updated.discount.toString() : '0');
      }

      Alert.alert('Payment Recorded', `₦${amount.toLocaleString()} recorded successfully.`);
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
      const subtotal = calculateSubtotal(editingItems);
      const vatRate = parseFloat(editingVatRate) || 0;
      const discount = parseFloat(editingDiscount) || 0;
      const vatAmount = subtotal * (vatRate / 100);
      const total = subtotal + vatAmount - discount;

      const amountPaid = selectedInvoice.amountPaid || 0;
      let newPaymentStatus = selectedInvoice.paymentStatus;
      
      if (total > amountPaid) {
        newPaymentStatus = amountPaid > 0 ? 'partially_paid' : 'pending';
      } else if (total <= amountPaid && amountPaid > 0) {
        newPaymentStatus = 'paid';
      }

      const updateData: any = {
        items: editingItems,
        subtotal,
        total,
        vat: vatAmount,
        vatRate,
        discount,
        paymentStatus: newPaymentStatus,
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
      const updatedInvoice = await firebaseService.getInvoice(selectedInvoice.id);
      if (updatedInvoice) {
        setSelectedInvoice(updatedInvoice);
        setEditingItems([...(updatedInvoice.items || [])]);
      }

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

      let vehicleData = null;
      if (job?.vehicleId) {
        try {
          vehicleData = await firebaseService.getVehicle(job.vehicleId);
        } catch (e) {
          console.log('Could not load vehicle:', e);
        }
      }

      const currentTotal = editingItems.reduce((sum, item) => sum + item.total, 0);
      const invoiceForPDF = {
        ...selectedInvoice,
        items: editingItems,
        total: currentTotal,
        subtotal: currentTotal,
      };

      const html = generateInvoiceHTML(invoiceForPDF, job, customer, vehicleData);
      const { uri } = await Print.printToFileAsync({ html });
      
      // Custom Filename
      const displayNumber = (selectedInvoice as any).invoiceNumber || `INV-${selectedInvoice.id.slice(-8).toUpperCase()}`;
      const pdfName = `${displayNumber}.pdf`;
      const newUri = FileSystem.cacheDirectory + pdfName;
      
      await FileSystem.moveAsync({
        from: uri,
        to: newUri
      });

      await Sharing.shareAsync(newUri);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to generate invoice PDF');
      console.error('Error generating PDF:', error);
    }
  };
  const generateInvoiceHTML = (inv: Invoice, job: Job | null, customer: User | null, vehicleData?: any) => {
    const amountPaid = inv.amountPaid || 0;
    const balanceDue = Math.max(0, inv.total - amountPaid);
    const displayNumber = (inv as any).invoiceNumber || `INV-${inv.id.slice(-8).toUpperCase()}`;
    const logoUrl = 'https://res.cloudinary.com/dyg7neetr/image/upload/v1772036824/ABM_BLACK_g6i4dm.png';
    const amountInWords = amountToWords(inv.total);

    const vehicleHtml = vehicleData ? `
      <div style="margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 8px; border: 1px solid #eee;">
        <p style="margin: 0; font-size: 13px; color: #666;">VEHICLE DETAILS</p>
        <p style="margin: 5px 0 0 0; font-size: 15px; font-weight: 600;">
          ${vehicleData.year} ${vehicleData.make} ${vehicleData.model} • ${vehicleData.licensePlate || 'N/A'}
        </p>
      </div>
    ` : '';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; line-height: 1.6; }
            .header-split { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; }
            .header-left h1 { margin: 0; font-size: 32px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
            .header-left p { margin: 5px 0 0 0; color: #666; font-size: 14px; font-family: monospace; }
            .logo { height: 60px; object-fit: contain; }
            
            .divider { height: 1px; background: #eee; margin: 20px 0; }
            
            .info-grid { display: flex; justify-content: space-between; margin-bottom: 40px; }
            .info-block { flex: 1; }
            .info-label { font-size: 12px; font-weight: 700; color: #000; text-transform: uppercase; margin-bottom: 8px; }
            .info-value { font-size: 16px; font-weight: 600; margin: 0; }
            .info-date { font-size: 14px; margin: 4px 0; display: flex; justify-content: flex-end; }
            .info-date span { color: #000; width: 100px; text-align: right; margin-right: 15px; }
            
            .section-title { font-size: 12px; font-weight: 700; color: #000; text-transform: uppercase; margin-bottom: 15px; letter-spacing: 0.5px; }
            
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; border-radius: 8px; overflow: hidden; }
            th { background: #f8f9fa; padding: 12px 15px; text-align: left; font-size: 12px; font-weight: 700; color: #000; border-bottom: 2px solid #eee; }
            td { padding: 12px 15px; border-bottom: 1px solid #eee; font-size: 14px; }
            .text-right { text-align: right; }
            
            .totals-container { display: flex; justify-content: flex-end; margin-top: 20px; }
            .totals-table { width: 300px; margin-bottom: 0; }
            .totals-table td { border-bottom: none; padding: 5px 0; }
            .totals-table .grand-total { border-top: 2px solid #333; padding-top: 15px; margin-top: 10px; font-size: 24px; font-weight: 800; }
            .totals-table .paid { color: #30D158; font-weight: 600; }
            .totals-table .balance { color: #FF9500; font-weight: 700; font-size: 18px; }
            
            .words-section { margin-top: 40px; }
            .words-label { font-size: 11px; font-weight: 700; color: #000; text-transform: uppercase; margin-bottom: 5px; }
            .words-value { font-size: 15px; font-weight: 600; }
            
            .footer-card { margin-top: 60px; background: #f8f9fa; padding: 25px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; }
            .bank-details { display: flex; gap: 40px; }
            .bank-detail-item { font-size: 14px; }
            .bank-detail-label { color: #000; margin-bottom: 4px; }
            .bank-detail-value { font-weight: 700; font-size: 16px; }
            .thanks { margin-top: 15px; color: #000; font-style: italic; font-size: 13px; }
          </style>
        </head>
        <body>
          <div class="header-split">
            <div class="header-left">
              <h1>INVOICE</h1>
              <p>#${displayNumber}</p>
            </div>
            <img src="${logoUrl}" class="logo" alt="ABM Logo" />
          </div>
          
          <div class="divider"></div>
          
          <div class="info-grid">
            <div class="info-block">
              <p class="info-label">BILL TO</p>
              <p class="info-value">${customer?.name || inv.customerName || 'Direct Customer'}</p>
              ${customer?.phone ? `<p style="margin:4px 0; color:#666;">${customer.phone}</p>` : ''}
              ${vehicleHtml}
            </div>
            <div class="info-block" style="max-width: 300px;">
              <p class="info-label" style="text-align: right;">INVOICE DETAILS</p>
              <div class="info-date"><span>Issued:</span><strong>${format(inv.createdAt, 'MMM dd, yyyy')}</strong></div>
              <div class="info-date"><span>Due Date:</span><strong style="color: ${inv.dueDate ? '#333' : '#999'}">${inv.dueDate ? format(inv.dueDate, 'MMM dd, yyyy') : 'N/A'}</strong></div>
            </div>
          </div>
          
          <p class="section-title">LINE ITEMS</p>
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th class="text-right" style="width: 60px;">Qty</th>
                <th class="text-right" style="width: 120px;">Unit Price</th>
                <th class="text-right" style="width: 120px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${inv.items.map(item => `
                <tr>
                  <td>${item.description}</td>
                  <td class="text-right">${item.quantity}</td>
                  <td class="text-right">₦${item.unitPrice.toLocaleString()}</td>
                  <td class="text-right">₦${item.total.toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="totals-container">
            <table class="totals-table">
              <tr>
                <td style="color:#666;">Subtotal</td>
                <td class="text-right">₦${inv.subtotal.toLocaleString()}</td>
              </tr>
              ${inv.vat > 0 ? `
                <tr>
                  <td style="color:#666;">VAT (${inv.vatRate || 0}%)</td>
                  <td class="text-right">₦${inv.vat.toLocaleString()}</td>
                </tr>
              ` : ''}
              ${inv.discount > 0 ? `
                <tr>
                  <td style="color:#666;">Discount</td>
                  <td class="text-right">-₦${inv.discount.toLocaleString()}</td>
                </tr>
              ` : ''}
              <tr class="grand-total">
                <td>Total</td>
                <td class="text-right">₦${inv.total.toLocaleString()}</td>
              </tr>
              <tr>
                <td class="paid">Amount Paid</td>
                <td class="text-right paid">₦${amountPaid.toLocaleString()}</td>
              </tr>
              <tr>
                <td class="balance">Balance Due</td>
                <td class="text-right balance">₦${balanceDue.toLocaleString()}</td>
              </tr>
            </table>
          </div>
          
          <div class="words-section">
            <p class="words-label">AMOUNT IN WORDS</p>
            <p class="words-value">${amountInWords}</p>
          </div>
          
          <div class="footer-card">
            <div style="flex:1;">
              <div class="bank-details">
                <div class="bank-detail-item">
                  <div class="bank-detail-label">Bank</div>
                  <div class="bank-detail-value">MONIEPOINT MFB</div>
                </div>
                <div class="bank-detail-item">
                  <div class="bank-detail-label">Acc No</div>
                  <div class="bank-detail-value">5071154448</div>
                </div>
                <div class="bank-detail-item">
                  <div class="bank-detail-label">Name</div>
                  <div class="bank-detail-value">ABDULLATEEF BABA MUSTAPHA</div>
                </div>
              </div>
              <p class="thanks">Thank you for your business!</p>
            </div>
            <img src="${logoUrl}" style="height: 30px; opacity: 0.2; transform: grayscale(1);" />
          </div>
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
              {(item as any).invoiceNumber || `INV-${item.id.slice(0, 8)}`}
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
            {(['all', 'draft', 'pending', 'rejected', 'converted'] as const).map((f) => (
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
                    <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{(selectedInvoice as any).invoiceNumber || selectedInvoice.id}</Text>
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
                            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                              <Text style={[styles.itemDescription, { color: colors.textPrimary, fontSize: 15, fontWeight: '500' }]}>{item.description}</Text>
                              {item.isNewAddition && (
                                <View style={{ backgroundColor: Colors.success, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 }}>
                                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>NEW</Text>
                                </View>
                              )}
                            </View>
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
                    ₦{calculateSubtotal(editingItems).toLocaleString()}
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


              {/* Due Date Selection - Available for any editable invoice */}
              {
                canEditInvoice() && (
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
                              onPress={() => {
                                setActiveDatePicker(null);
                                handleSaveInvoice(false, false);
                              }}
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
                          onChange={(event, selectedDate) => {
                            if (Platform.OS === 'android') {
                              setShowDatePicker(false);
                            }
                            if (selectedDate) {
                              setEditingDueDate(selectedDate);
                              if (Platform.OS === 'android') {
                                handleSaveInvoice(false, false);
                              }
                            }
                            // On iOS, we keep the picker open until "Done" is pressed (handled by toolbar)
                            // On Android, the modal closes after selection
                          }}
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
                  <View style={[styles.paymentHistorySection, { borderColor: colors.textPrimary, borderWidth: 1, borderRadius: 12, padding: 12 }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Pending Customer Payments</Text>
                    {selectedInvoice.pendingPayments.map((pp: any, index: number) => {
                      const pd: any = pp.date; const ppDate = pd?.toDate ? pd.toDate() : pd?.seconds ? new Date(pd.seconds * 1000) : pd instanceof Date ? pd : new Date(pd || Date.now());
                      return (
                        <View key={pp.id || index} style={{ backgroundColor: colors.surface, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border }}>
                          {/* Status Message instead of Amount */}
                          <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.success, marginBottom: 2 }}>
                            Payment proof submitted
                          </Text>
                          <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 10 }}>
                            {format(ppDate, 'MMM dd, yyyy')} — by {pp.recordedByName || 'Customer'}
                          </Text>

                          {/* Buttons Row */}
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            {pp.proofUrl && (
                              <TouchableOpacity
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary + '15', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, flex: 1, justifyContent: 'center' }}
                                onPress={() => {
                                  setShowInvoiceModal(false);
                                  setPendingProofUrl(pp.proofUrl);
                                }}
                              >
                                <Ionicons name="eye-outline" size={14} color={colors.primary} />
                                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>View Proof</Text>
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.success, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, flex: 1, justifyContent: 'center' }}
                              onPress={() => {
                                setPendingPaymentToConfirm(pp);
                                setPaymentAmount(''); // Force manual entry
                                setShowInvoiceModal(false);
                                setPendingPaymentModal(true);
                              }}
                            >
                              <Ionicons name="checkmark-outline" size={14} color="#fff" />
                              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 12 }}>Accept</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.error, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, flex: 1, justifyContent: 'center' }}
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
                              <Ionicons name="close-outline" size={14} color="#fff" />
                              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 12 }}>Reject</Text>
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
                        const d2: any = payment.date; const paymentDate = d2?.toDate ? d2.toDate() : d2?.seconds ? new Date(d2.seconds * 1000) : d2 instanceof Date ? d2 : new Date(d2 || Date.now());
                        return (
                          <View key={index} style={[styles.paymentHistoryItem, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.paymentAmount, { color: colors.textPrimary }]}>
                                ₦{payment.amount.toLocaleString()}
                              </Text>
                              <Text style={[styles.paymentDate, { color: colors.textSecondary }]}>
                                {format(paymentDate, 'MMM dd, yyyy')} - {payment.method?.replace('_', ' ')}
                              </Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              {payment.receiptUrl ? (
                                <TouchableOpacity
                                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary + '15', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}
                                  onPress={() => {
                                  setShowInvoiceModal(false);
                                  setPendingProofUrl(payment.receiptUrl!);
                                }}
                                >
                                  <Ionicons name="document-text-outline" size={14} color={colors.primary} />
                                  <Text style={{ fontSize: 11, fontWeight: '600', color: colors.primary }}>View Receipt</Text>
                                </TouchableOpacity>
                              ) : (
                                <TouchableOpacity
                                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.textPrimary + '10', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}
                                  onPress={async () => {
                                    try {
                                      const result = await ImagePicker.launchImageLibraryAsync({
                                        mediaTypes: ['images'],
                                        quality: 0.7,
                                      });
                                      if (!result.canceled && result.assets[0]) {
                                        const uploadUrl = await firebaseService.uploadFile(
                                          result.assets[0].uri,
                                          `receipts/${selectedInvoice.id}/payment_${index}`
                                        );
                                        const updatedHistory = [...(selectedInvoice.paymentHistory || [])];
                                        updatedHistory[index] = { ...updatedHistory[index], receiptUrl: uploadUrl };
                                        await firebaseService.updateInvoice(selectedInvoice.id, { paymentHistory: updatedHistory });
                                        const updated = await firebaseService.getInvoice(selectedInvoice.id);
                                        if (updated) {
                                          setSelectedInvoice(updated);
                                          setEditingItems([...updated.items]);
                                        }
                                        Alert.alert('Success', 'Receipt uploaded successfully');
                                      }
                                    } catch (err: any) {
                                      Alert.alert('Error', 'Failed to upload receipt');
                                      console.error(err);
                                    }
                                  }}
                                >
                                  <Ionicons name="cloud-upload-outline" size={14} color={colors.textSecondary} />
                                  <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary }}>Upload Receipt</Text>
                                </TouchableOpacity>
                              )}
                            </View>
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
                      This invoice has been voided and cannot be edited
                    </Text>
                  </View>
                )
              }

              {/* Save Changes Button */}
              {canEditInvoice() && (
                <TouchableOpacity
                  style={[styles.approveButton, { backgroundColor: colors.surface, borderColor: colors.primary, borderWidth: 1, marginBottom: 8 }]}
                  onPress={() => handleSaveInvoice(true, false)}
                  disabled={loading}
                >
                  <ActivityIndicator animating={loading} size="small" color={colors.primary} style={{ marginRight: 8, display: loading ? 'flex' : 'none' }} />
                  <Text style={[styles.approveButtonText, { color: colors.primary }]}>
                    Save Changes
                  </Text>
                </TouchableOpacity>
              )}

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
                      {(() => {
                        const subtotal = editingItems.reduce((sum, item) => sum + item.total, 0);
                        const vatRate = parseFloat(editingVatRate) || 0;
                        const discountVal = parseFloat(editingDiscount) || 0;
                        const vatAmount = subtotal * (vatRate / 100);
                        const computedTotal = subtotal + vatAmount - discountVal;
                        const amountPaid = selectedInvoice.amountPaid || 0;
                        const remaining = computedTotal - amountPaid;
                        const isFullyPaid = amountPaid >= computedTotal;

                        return (
                          <>
                            <Text style={styles.paymentSummaryText}>
                              Paid: ₦{amountPaid.toLocaleString()} / {remaining < 0 ? 'Overpayment' : 'Remaining'}: ₦
                              {Math.abs(remaining).toLocaleString()}
                            </Text>
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
          setShowPaymentModal(false);
          setPaymentAmount('');
          setReturnToInvoice(true);
        }
        }
      >
        <TouchableOpacity
          style={styles.paymentModalOverlay}
          activeOpacity={1}
          onPress={() => {
            setShowPaymentModal(false);
            setPaymentAmount('');
            setReturnToInvoice(true);
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

            <Text style={styles.inputLabel}>Payment Method</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {[
                { key: 'cash', label: 'Cash', icon: 'cash-outline' as const },
                { key: 'bank_transfer', label: 'Transfer', icon: 'swap-horizontal-outline' as const },
                { key: 'bank_card', label: 'Card', icon: 'card-outline' as const },
              ].map((m) => (
                <TouchableOpacity
                  key={m.key}
                  style={[
                    {
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      paddingVertical: 10,
                      borderRadius: 8,
                      borderWidth: 1.5,
                      borderColor: paymentMethod === m.key ? colors.primary : colors.border,
                      backgroundColor: paymentMethod === m.key ? colors.primary + '15' : colors.surface,
                    },
                  ]}
                  onPress={() => setPaymentMethod(m.key)}
                >
                  <Ionicons
                    name={m.icon}
                    size={16}
                    color={paymentMethod === m.key ? colors.primary : colors.textSecondary}
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '600',
                      color: paymentMethod === m.key ? colors.primary : colors.textSecondary,
                    }}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

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
                  setReturnToInvoice(true);
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
              Payment of ₦{recordedPaymentAmount.toLocaleString()} recorded successfully for {(selectedInvoice as any)?.invoiceNumber || `Invoice #${selectedInvoice?.id}`}
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

      {/* Payment Proof Viewer Modal */}
      <Modal
        visible={!!proofModalUrl}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => {
          setProofModalUrl(null);
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ position: 'absolute', top: 60, right: 20, left: 20, flexDirection: 'row', justifyContent: 'space-between', zIndex: 10 }}>
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>Payment Proof</Text>
            <TouchableOpacity onPress={() => {
              setProofModalUrl(null);
            }}>
              <Ionicons name="close-circle" size={30} color="#fff" />
            </TouchableOpacity>
          </View>
          {proofModalUrl && (
            <Image
              source={{ uri: proofModalUrl }}
              style={{
                width: Dimensions.get('window').width * 0.9,
                height: Dimensions.get('window').height * 0.7,
                borderRadius: 12,
                backgroundColor: '#222'
              }}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

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

