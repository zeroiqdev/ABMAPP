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
  const [activeDatePicker, setActiveDatePicker] = useState<'start' | 'end' | null>(null);
  const [showPaymentSuccessModal, setShowPaymentSuccessModal] = useState(false);
  const [recordedPaymentAmount, setRecordedPaymentAmount] = useState<number>(0);

  useEffect(() => {
    loadInvoices();
    if (user?.workshopId) {
      loadInventory();
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
  }, [invoices, filter, searchQuery, dateFilter, customerNamesMap]);

  const loadInvoices = async () => {
    if (!user?.workshopId) return;
    setRefreshing(true);
    try {
      const invoicesData = await firebaseService.getInvoices(undefined, user.workshopId);
      setInvoices(invoicesData);

      // Load customer names for all invoices
      const customerIds = [...new Set(invoicesData.map(inv => inv.userId))];
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
          const customerName = customerNamesMap[inv.userId] || '';
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
    setEditingItemIndex(null);
    setShowAddItem(false);
    setNewItem({ description: '', quantity: '1', unitPrice: '' });
    setAddItemMode('manual');

    // Load customer name
    try {
      const customer = await firebaseService.getUser(invoice.userId);
      if (customer) {
        setCustomerName(customer.name);
      } else {
        setCustomerName('Unknown Customer');
      }
    } catch (error) {
      console.error('Error loading customer:', error);
      setCustomerName('Unknown Customer');
    }

    setShowInvoiceModal(true);
  };

  const canEditInvoice = () => {
    if (!selectedInvoice) return false;
    return (selectedInvoice.amountPaid || 0) === 0;
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
      const total = subtotal + (selectedInvoice.vat || 0) - (selectedInvoice.discount || 0);

      await firebaseService.updateInvoice(selectedInvoice.id, {
        items: items,
        subtotal,
        total,
        dueDate: editingDueDate || undefined,
      });

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
    const currentTotal = editingItems.reduce((sum, item) => sum + item.total, 0);
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
      setTimeout(() => {
        setShowPaymentModal(true);
      }, 300);
    }
  };

  const processPayment = async (amount: number, type: 'partial' | 'full') => {
    if (!selectedInvoice || amount <= 0) return;

    // Use current edited total
    const currentTotal = editingItems.reduce((sum, item) => sum + item.total, 0);
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
      const updatedTotal = editingItems.reduce((sum, item) => sum + item.total, 0);

      await firebaseService.updateInvoice(selectedInvoice.id, {
        paymentStatus: newStatus,
        amountPaid: newPaid,
        paymentHistory: paymentHistory,
        items: editingItems,
        subtotal: updatedTotal,
        total: updatedTotal,
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
      const total = subtotal + (selectedInvoice.vat || 0) - (selectedInvoice.discount || 0);

      await firebaseService.updateInvoice(selectedInvoice.id, {
        items: editingItems,
        subtotal,
        total,
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
      const customer = await firebaseService.getUser(selectedInvoice.userId);

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
              <p><strong>Customer:</strong> ${customer?.name || 'N/A'}</p>
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

  const renderInvoice = ({ item }: { item: Invoice }) => {
    const amountPaid = item.amountPaid || 0;
    const remaining = item.total - amountPaid;
    const customerName = customerNamesMap[item.userId] || 'Loading...';

    return (
      <TouchableOpacity
        style={styles.invoiceCard}
        onPress={() => handleInvoicePress(item)}
      >
        <View style={styles.invoiceHeader}>
          <View>
            <Text
              style={styles.invoiceNumber}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              Invoice #{item.id}
            </Text>
            <Text style={styles.invoiceCustomer}>{customerName}</Text>
            <Text style={styles.invoiceDate}>
              {format(item.createdAt, 'MMM dd, yyyy')}
            </Text>
          </View>
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
                ? 'Partially Paid'
                : item.paymentStatus.charAt(0).toUpperCase() + item.paymentStatus.slice(1)}
            </Text>
          </View>
        </View>
        <View style={styles.invoiceAmount}>
          <Text style={styles.amountLabel}>Total Amount</Text>
          <Text style={styles.amountValue}>₦{item.total.toLocaleString()}</Text>
        </View>
        {amountPaid > 0 && (
          <View style={styles.paymentInfo}>
            <Text style={styles.paidText}>Paid: ₦{amountPaid.toLocaleString()}</Text>
            <Text style={[styles.remainingText, remaining < 0 && { color: '#30D158' }]}>
              {remaining < 0
                ? `Overpayment: ₦${Math.abs(remaining).toLocaleString()}`
                : `Remaining: ₦${remaining.toLocaleString()}`}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Finance</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#999" style={styles.searchIcon} />
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
          <Ionicons name="calendar-outline" size={20} color="#000" />
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
            <Ionicons name="receipt-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No invoices found</Text>
          </View>
        }
      />

      {/* Invoice Details Modal */}
      <Modal
        visible={showInvoiceModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowInvoiceModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Invoice Details</Text>
            <TouchableOpacity onPress={() => setShowInvoiceModal(false)}>
              <Ionicons name="close" size={24} color="#000" />
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
                      <Ionicons name="add-circle-outline" size={24} color="#fff" />
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
                              <Ionicons name="trash-outline" size={18} color="#FF3B30" />
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
                          <Ionicons name="pencil-outline" size={18} color="#000" />
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
                            <Ionicons name="cube-outline" size={48} color="#ccc" />
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
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total:</Text>
                  <Text style={styles.summaryValue}>
                    ₦{editingItems.reduce((sum, item) => sum + item.total, 0).toLocaleString()}
                  </Text>
                </View>
                {(selectedInvoice.amountPaid || 0) > 0 && (
                  <>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Amount Paid:</Text>
                      <Text style={styles.summaryValue}>
                        ₦{(selectedInvoice.amountPaid || 0).toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>
                        {(editingItems.reduce((sum, item) => sum + item.total, 0) - (selectedInvoice.amountPaid || 0)) < 0 ? 'Overpayment:' : 'Balance Due:'}
                      </Text>
                      <Text style={[styles.summaryValue, (editingItems.reduce((sum, item) => sum + item.total, 0) - (selectedInvoice.amountPaid || 0)) < 0 ? { color: '#30D158' } : styles.balanceDue]}>
                        ₦
                        {Math.abs(editingItems.reduce((sum, item) => sum + item.total, 0) - (selectedInvoice.amountPaid || 0)).toLocaleString()}
                      </Text>
                    </View>
                  </>
                )}
              </View>

              {selectedInvoice.paymentHistory &&
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
                )}


              {!canEditInvoice() && (
                <View style={styles.lockedMessage}>
                  <Ionicons name="lock-closed-outline" size={20} color="#FFA500" />
                  <Text style={styles.lockedText}>
                    Invoice cannot be edited after payment has been recorded
                  </Text>
                </View>
              )}

              {!showAddItem && (
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
                    <Ionicons name="download-outline" size={20} color="#000" />
                    <Text style={styles.downloadButtonText}>Download Invoice</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Payment Modal */}
      <Modal
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
        }}
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
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.confirmButtonText}>Record</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Date Filter Modal */}
      <Modal
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
                <Ionicons name="close" size={24} color="#000" />
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
                  <Ionicons name="calendar-outline" size={20} color="#000" />
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
                  <Ionicons name="calendar-outline" size={20} color="#000" />
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
      </Modal>

      {/* Payment Success Modal */}
      <Modal
        visible={showPaymentSuccessModal}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
      >
        <View style={styles.successModalOverlay}>
          <View style={styles.successModalContent}>
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark" size={40} color="#fff" />
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
      </Modal>


    </View>
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
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 15,
    paddingHorizontal: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 14,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingBottom: 15,
    gap: 10,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
  },
  filterPillActive: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  filterTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 15,
  },
  invoiceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  invoiceNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    maxWidth: 200,
  },
  invoiceCustomer: {
    fontSize: 14,
    color: '#000',
    marginTop: 2,
    fontWeight: '500',
  },
  invoiceDate: {
    fontSize: 12,
    color: '#000',
    marginTop: 4,
  },
  dateFilterButton: {
    padding: 8,
    marginLeft: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
  },
  invoiceAmount: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 14,
    color: '#000',
  },
  amountValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  paymentInfo: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  paidText: {
    fontSize: 12,
    color: '#000',
    marginBottom: 4,
  },
  remainingText: {
    fontSize: 12,
    color: '#000',
  },
  emptyState: {
    padding: 60,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  invoiceDetailsCard: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 20,
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  itemsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  itemRow: {
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 15,
  },
  itemInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemEditForm: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 10,
  },
  itemEditInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  itemEditRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  itemEditField: {
    flex: 1,
  },
  itemEditLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  itemEditInputSmall: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#eee',
  },
  itemEditActions: {
    flexDirection: 'row',
    gap: 10,
  },
  itemEditButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#000',
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  addButton: {
    backgroundColor: '#000',
  },
  itemEditButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  addItemForm: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
    borderWidth: 2,
    borderColor: '#000',
    borderStyle: 'dashed',
  },
  addItemButton: {
    padding: 8,
    backgroundColor: '#000',
    borderRadius: 8,
  },
  addItemTabs: {
    flexDirection: 'row',
    marginBottom: 15,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 4,
  },
  addItemTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 6,
  },
  addItemTabActive: {
    backgroundColor: '#000',
  },
  addItemTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  addItemTabTextActive: {
    color: '#fff',
  },
  inventorySelectionContainer: {
    maxHeight: 400,
  },
  inventoryItemsList: {
    maxHeight: 300,
  },
  doneButton: {
    backgroundColor: '#000',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 15,
    marginBottom: 10,
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  inventoryItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inventoryItemInfo: {
    flex: 1,
    marginRight: 15,
  },
  inventoryItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  inventoryItemDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  inventoryItemCategory: {
    fontSize: 12,
    color: '#999',
  },
  inventoryItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quantityInput: {
    width: 60,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#eee',
  },
  addInventoryButton: {
    backgroundColor: '#000',
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
    marginBottom: 15,
  },
  saveInvoiceButton: {
    backgroundColor: '#000',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  saveInvoiceButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  lockedMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
    marginBottom: 10,
    gap: 10,
  },
  lockedText: {
    flex: 1,
    color: '#856404',
    fontSize: 14,
  },
  itemDescription: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    marginBottom: 4,
  },
  itemDetails: {
    fontSize: 14,
    color: '#666',
  },
  summarySection: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  balanceDue: {
    fontSize: 18,
    color: '#FF3B30',
  },
  paymentHistorySection: {
    marginBottom: 20,
  },
  paymentHistoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#30D158',
  },
  paymentDate: {
    fontSize: 14,
    color: '#666',
  },
  paymentActions: {
    marginTop: 20,
    marginBottom: 20,
  },
  paymentSummaryText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    textAlign: 'center',
  },
  payButton: {
    backgroundColor: '#000',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  fullPayButton: {
    backgroundColor: '#000',
  },
  payButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
    backgroundColor: '#ccc',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#000',
    marginTop: 10,
  },
  downloadButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  paymentModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  paymentModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  paymentModalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    marginBottom: 15,
  },
  methodButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  methodButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
    alignItems: 'center',
  },
  methodButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  methodButtonText: {
    fontSize: 14,
    color: '#666',
  },
  methodButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  paymentModalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
  },
  confirmButton: {
    backgroundColor: '#000',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dateFilterModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  dateFilterModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  dateFilterFields: {
    marginVertical: 20,
  },
  dateFilterField: {
    marginBottom: 20,
  },
  dateInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 15,
    borderWidth: 1,
    borderColor: '#eee',
  },
  dateInputText: {
    fontSize: 16,
    color: '#000',
  },
  dateFilterActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  successModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  successIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 10,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  successButton: {
    backgroundColor: '#000',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  successButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

