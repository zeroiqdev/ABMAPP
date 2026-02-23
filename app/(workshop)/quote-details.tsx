import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Dimensions,
    TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';
import { Quote, InventoryItem } from '@/types';
import { format } from 'date-fns';
import { useColors, Colors, Typography } from '@/constants/design';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const { width } = Dimensions.get('window');

export default function QuoteDetailsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { user } = useAuthStore();
    const router = useRouter();
    const colors = useColors();
    const styles = getStyles(colors);

    const [quote, setQuote] = useState<Quote | null>(null);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);

    // Editing State
    const [isEditing, setIsEditing] = useState(false);
    const [editingItems, setEditingItems] = useState<any[]>([]);
    const [editingVatRate, setEditingVatRate] = useState('');
    const [editingDiscount, setEditingDiscount] = useState('');
    const [saving, setSaving] = useState(false);

    // Add Item State
    const [showAddItem, setShowAddItem] = useState(false);
    const [addItemMode, setAddItemMode] = useState<'manual' | 'inventory'>('manual');
    const [newItem, setNewItem] = useState({ description: '', quantity: '1', unitPrice: '' });
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);

    useEffect(() => {
        loadQuote();
    }, [id]);

    useEffect(() => {
        if (isEditing && user?.workshopId) {
            loadInventory();
        }
    }, [isEditing]);

    const loadQuote = async () => {
        if (!id) return;
        try {
            const quoteData = await firebaseService.getQuote(id);
            setQuote(quoteData);
            if (quoteData) {
                setEditingItems(JSON.parse(JSON.stringify(quoteData.items)));
                setEditingVatRate((quoteData.vatRate || 0).toString());
                setEditingDiscount((quoteData.discount || 0).toString());
            }
        } catch (error) {
            console.error('Error loading quote:', error);
            Alert.alert('Error', 'Failed to load quote');
        } finally {
            setLoading(false);
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

    const handleSendForApproval = async () => {
        if (!quote) return;

        Alert.alert(
            'Send for Approval',
            'This will send the quote to the customer for approval. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Send',
                    onPress: async () => {
                        setSending(true);
                        try {
                            await firebaseService.sendQuoteForApproval(
                                quote.id,
                                user?.id || '',
                                user?.name || 'Staff'
                            );
                            Alert.alert('Success', 'Quote sent for customer approval');
                            loadQuote();
                        } catch (error: any) {
                            Alert.alert('Error', error.message || 'Failed to send quote');
                        } finally {
                            setSending(false);
                        }
                    }
                }
            ]
        );
    };

    const handleApproveOnBehalf = async () => {
        if (!quote) return;

        Alert.alert(
            'Approve on Behalf',
            'Are you sure you want to approve this quote on behalf of the customer? This will convert it into an invoice.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Approve',
                    onPress: async () => {
                        setSending(true);
                        try {
                            await firebaseService.approveQuote(
                                quote.id,
                                user?.id || '',
                                user?.name || 'Staff',
                                quote.total
                            );
                            Alert.alert(
                                'Success',
                                'Quote approved and converted to invoice.',
                                [{ text: 'OK', onPress: () => router.back() }]
                            );
                        } catch (error: any) {
                            Alert.alert('Error', error.message || 'Failed to approve quote');
                        } finally {
                            setSending(false);
                        }
                    }
                }
            ]
        );
    };

    const handleViewInvoice = () => {
        if (quote?.convertedToInvoiceId) {
            router.push(`/(workshop)/finance?invoiceId=${quote.convertedToInvoiceId}`);
        }
    };

    const handleEditItem = (index: number, field: string, value: string) => {
        const updatedcontent = [...editingItems];
        if (field === 'quantity' || field === 'unitPrice') {
            updatedcontent[index][field] = value; // Keep as string for input
            // Update total
            const qty = parseFloat(updatedcontent[index].quantity) || 0;
            const price = parseFloat(updatedcontent[index].unitPrice) || 0;
            updatedcontent[index].total = qty * price;
        } else {
            updatedcontent[index][field] = value;
        }
        setEditingItems(updatedcontent);
    };

    const handleDeleteItem = (index: number) => {
        const updatedItems = editingItems.filter((_, i) => i !== index);
        setEditingItems(updatedItems);
    };

    const handleAddItem = () => {
        if (!newItem.description || !newItem.quantity || !newItem.unitPrice) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        const item: any = {
            description: newItem.description,
            quantity: parseFloat(newItem.quantity) || 1,
            unitPrice: parseFloat(newItem.unitPrice) || 0,
            total: (parseFloat(newItem.quantity) || 1) * (parseFloat(newItem.unitPrice) || 0),
        };

        setEditingItems([...editingItems, item]);
        setNewItem({ description: '', quantity: '1', unitPrice: '' });
        // Don't close, allow adding more
    };

    const handleAddInventoryItem = (inventoryItem: InventoryItem, quantity: number) => {
        const item: any = {
            description: inventoryItem.name,
            quantity: quantity,
            unitPrice: inventoryItem.unitPrice,
            total: quantity * inventoryItem.unitPrice,
        };

        setEditingItems([...editingItems, item]);
    };

    const handleSaveQuote = async () => {
        if (!quote) return;
        setSaving(true);
        try {
            // Recalculate totals with edited VAT and discount
            const subtotal = editingItems.reduce((sum, item) => sum + (item.total || 0), 0);
            const vatRate = parseFloat(editingVatRate) || 0;
            const discount = parseFloat(editingDiscount) || 0;
            const vat = subtotal * (vatRate / 100);
            const total = subtotal + vat - discount;

            const updatedQuote = {
                items: editingItems.map(item => ({
                    ...item,
                    quantity: parseFloat(item.quantity) || 0,
                    unitPrice: parseFloat(item.unitPrice) || 0,
                })),
                subtotal,
                vatRate,
                vat,
                discount,
                total,
            };

            await firebaseService.updateQuote(quote.id, updatedQuote);

            // Log the edit action
            if (user) {
                await firebaseService.addQuoteLog(quote.id, {
                    action: 'edit',
                    description: `Updated quote items and totals (Total: ₦${total.toLocaleString()})`,
                    userId: user.id,
                    userName: user.name,
                });
            }

            Alert.alert('Success', 'Quote updated successfully');
            setIsEditing(false);
            setShowAddItem(false);
            loadQuote();
        } catch (error) {
            console.error('Error updating quote:', error);
            Alert.alert('Error', 'Failed to update quote');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveVatDiscount = async () => {
        if (!quote) return;
        try {
            const vatRate = parseFloat(editingVatRate) || 0;
            const discount = parseFloat(editingDiscount) || 0;
            const subtotal = quote.subtotal || 0;
            const vat = subtotal * (vatRate / 100);
            const total = subtotal + vat - discount;

            await firebaseService.updateQuote(quote.id, {
                vatRate,
                vat,
                discount,
                total,
            });
            // Silently reload quote data
            const updated = await firebaseService.getQuote(quote.id);
            if (updated) setQuote(updated);
        } catch (error) {
            console.error('Error saving VAT/discount:', error);
        }
    };

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
            setQuantity('1');
        };

        return (
            <View style={styles.inventoryItemRow}>
                <View style={styles.inventoryItemInfo}>
                    <Text style={styles.inventoryItemName}>{item.name}</Text>
                    <Text style={styles.inventoryItemDetails}>
                        Stock: {item.quantity} • ₦{item.unitPrice.toLocaleString()} each
                    </Text>
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
                        placeholderTextColor={colors.textTertiary}
                    />
                    <TouchableOpacity
                        style={styles.addInventoryButton}
                        onPress={handleAdd}
                        disabled={item.quantity === 0}
                    >
                        <Ionicons name="add" size={20} color="#000" />
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'draft': return colors.textSecondary;
            case 'pending_approval': return colors.warning;
            case 'converted': return colors.success;
            case 'cancelled': return colors.error;
            case 'rejected': return colors.error;
            default: return colors.textSecondary;
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'draft': return 'Draft';
            case 'pending_approval': return 'Awaiting Approval';
            case 'converted': return 'Converted to Invoice';
            case 'cancelled': return 'Cancelled';
            case 'rejected': return 'Rejected by Customer';
            default: return status;
        }
    };

    const handleDownloadQuote = async () => {
        if (!quote) return;
        try {
            const items = isEditing ? editingItems : quote.items;
            const subtotal = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0);
            const vatAmount = subtotal * (quote.vatRate || 0) / 100;
            const discount = quote.discount || 0;
            const total = subtotal + vatAmount - discount;

            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <style>
                        body { font-family: Arial, sans-serif; padding: 30px; color: #333; }
                        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 15px; }
                        .header h1 { margin: 0; font-size: 28px; color: #000; }
                        .header p { margin: 5px 0; color: #666; }
                        .info-grid { display: flex; justify-content: space-between; margin-bottom: 25px; }
                        .info-block p { margin: 4px 0; }
                        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                        .items-table th { background-color: #f0f0f0; padding: 10px; text-align: left; border-bottom: 2px solid #ddd; font-weight: 600; }
                        .items-table td { padding: 10px; text-align: left; border-bottom: 1px solid #eee; }
                        .total-section { text-align: right; margin-top: 20px; }
                        .total-section p { margin: 5px 0; }
                        .total-section .grand-total { font-size: 18px; font-weight: bold; border-top: 2px solid #000; padding-top: 10px; margin-top: 10px; }
                        .footer { margin-top: 40px; text-align: center; color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 15px; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>QUOTATION</h1>
                        <p>Quote #${quote.id.slice(-8).toUpperCase()}</p>
                    </div>
                    <div class="info-grid">
                        <div class="info-block">
                            <p><strong>Customer:</strong> ${quote.customerName || 'N/A'}</p>
                            ${quote.customerEmail ? `<p><strong>Email:</strong> ${quote.customerEmail}</p>` : ''}
                            ${quote.customerPhone ? `<p><strong>Phone:</strong> ${quote.customerPhone}</p>` : ''}
                            ${quote.customerAddress ? `<p><strong>Address:</strong> ${quote.customerAddress}</p>` : ''}
                        </div>
                        <div class="info-block">
                            <p><strong>Date:</strong> ${format(quote.createdAt, 'MMM dd, yyyy')}</p>
                            ${quote.sentAt ? `<p><strong>Sent:</strong> ${format(quote.sentAt, 'MMM dd, yyyy')}</p>` : ''}
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
                            ${items.map((item: any) => `
                                <tr>
                                    <td>${item.description}</td>
                                    <td>${item.quantity}</td>
                                    <td>₦${Number(item.unitPrice).toLocaleString()}</td>
                                    <td>₦${(item.quantity * item.unitPrice).toLocaleString()}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <div class="total-section">
                        <p>Subtotal: ₦${subtotal.toLocaleString()}</p>
                        ${quote.vatRate > 0 ? `<p>VAT (${quote.vatRate}%): ₦${vatAmount.toLocaleString()}</p>` : ''}
                        ${discount > 0 ? `<p>Discount: -₦${discount.toLocaleString()}</p>` : ''}
                        <p class="grand-total">Total: ₦${total.toLocaleString()}</p>
                    </div>
                    <div class="footer">
                        <p>This is a computer-generated quotation.</p>
                    </div>
                </body>
                </html>
            `;
            const { uri } = await Print.printToFileAsync({ html });
            await Sharing.shareAsync(uri);
        } catch (error: any) {
            Alert.alert('Error', 'Failed to generate quote PDF');
            console.error('Error generating quote PDF:', error);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (!quote) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.errorText}>Quote not found</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.push('/(workshop)/quotes')}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Quote Details</Text>
                <TouchableOpacity onPress={handleDownloadQuote}>
                    <Ionicons name="download-outline" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Status Badge */}
                <View style={styles.statusContainer}>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(quote.status) + '20' }]}>
                        <Ionicons
                            name={quote.status === 'converted' ? 'checkmark-circle' : 'time-outline'}
                            size={16}
                            color={getStatusColor(quote.status)}
                        />
                        <Text style={[styles.statusText, { color: getStatusColor(quote.status) }]}>
                            {getStatusLabel(quote.status)}
                        </Text>
                    </View>
                    <Text style={styles.dateText}>
                        Created {format(quote.createdAt, 'MMM dd, yyyy')}
                    </Text>
                </View>

                {/* Rejection Reason Banner */}
                {quote.status === 'rejected' && (
                    <View style={[styles.card, { backgroundColor: colors.error + '15', borderColor: colors.error + '30', borderWidth: 1 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <Ionicons name="close-circle" size={20} color={colors.error} />
                            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.error }}>Quote Rejected by Customer</Text>
                        </View>
                        <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 4 }}>
                            See History & Activity at bottom for details
                        </Text>
                    </View>
                )}

                {/* Customer Info */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Customer</Text>
                    <Text style={styles.customerName}>{quote.customerName}</Text>
                    {quote.customerPhone && (
                        <Text style={styles.customerDetail}>{quote.customerPhone}</Text>
                    )}
                    {quote.customerEmail && (
                        <Text style={styles.customerDetail}>{quote.customerEmail}</Text>
                    )}
                </View>

                {/* Line Items */}
                <View style={styles.card}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <Text style={[styles.cardTitle, { marginBottom: 0 }]}>Line Items</Text>
                    </View>

                    {(isEditing ? editingItems : quote.items).map((item, index) => (
                        <View key={item.id || index} style={styles.lineItem}>
                            {isEditing ? (
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <TextInput
                                            style={[styles.input, { marginBottom: 8, flex: 1, marginRight: 8 }]}
                                            value={item.description}
                                            onChangeText={(text) => handleEditItem(index, 'description', text)}
                                            placeholder="Description"
                                            placeholderTextColor={colors.textTertiary}
                                        />
                                        <TouchableOpacity onPress={() => handleDeleteItem(index)} style={{ padding: 4 }}>
                                            <Ionicons name="trash-outline" size={20} color={colors.error} />
                                        </TouchableOpacity>
                                    </View>
                                    <View style={{ flexDirection: 'row', gap: 10 }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.inputLabel}>Qty</Text>
                                            <TextInput
                                                style={styles.input}
                                                value={item.quantity.toString()}
                                                onChangeText={(text) => handleEditItem(index, 'quantity', text)}
                                                keyboardType="numeric"
                                            />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.inputLabel}>Price</Text>
                                            <TextInput
                                                style={styles.input}
                                                value={item.unitPrice.toString()}
                                                onChangeText={(text) => handleEditItem(index, 'unitPrice', text)}
                                                keyboardType="numeric"
                                            />
                                        </View>
                                    </View>
                                </View>
                            ) : (
                                <>
                                    <View style={styles.lineItemInfo}>
                                        <Text style={styles.lineItemDesc}>{item.description}</Text>
                                        <Text style={styles.lineItemQty}>
                                            {item.quantity} × ₦{item.unitPrice.toLocaleString()}
                                        </Text>
                                    </View>
                                    <Text style={styles.lineItemTotal}>₦{item.total.toLocaleString()}</Text>
                                </>
                            )}
                        </View>
                    ))}

                    {isEditing && (
                        <View style={{ marginTop: 16 }}>
                            {!showAddItem ? (
                                <TouchableOpacity style={styles.addItemButton} onPress={() => setShowAddItem(true)}>
                                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.textPrimary, justifyContent: 'center', alignItems: 'center' }}>
                                        <Ionicons name="add" size={16} color={colors.surface} />
                                    </View>
                                    <Text style={styles.addItemButtonText}>Add Line Item</Text>
                                </TouchableOpacity>
                            ) : (
                                <View style={styles.addItemForm}>
                                    <View style={styles.addItemTabs}>
                                        <TouchableOpacity
                                            style={[styles.addItemTab, addItemMode === 'manual' && styles.addItemTabActive]}
                                            onPress={() => setAddItemMode('manual')}
                                        >
                                            <Text style={[styles.addItemTabText, addItemMode === 'manual' && styles.addItemTabTextActive]}>Manual Entry</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.addItemTab, addItemMode === 'inventory' && styles.addItemTabActive]}
                                            onPress={() => setAddItemMode('inventory')}
                                        >
                                            <Text style={[styles.addItemTabText, addItemMode === 'inventory' && styles.addItemTabTextActive]}>From Inventory</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {addItemMode === 'manual' ? (
                                        <>
                                            <TextInput
                                                style={[styles.input, { marginBottom: 12 }]}
                                                placeholder="Description"
                                                placeholderTextColor={colors.textTertiary}
                                                value={newItem.description}
                                                onChangeText={(text) => setNewItem({ ...newItem, description: text })}
                                            />
                                            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                                                <View style={{ flex: 1 }}>
                                                    <TextInput
                                                        style={styles.input}
                                                        placeholder="Qty"
                                                        placeholderTextColor={colors.textTertiary}
                                                        value={newItem.quantity}
                                                        onChangeText={(text) => setNewItem({ ...newItem, quantity: text })}
                                                        keyboardType="numeric"
                                                    />
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <TextInput
                                                        style={styles.input}
                                                        placeholder="Price"
                                                        placeholderTextColor={colors.textTertiary}
                                                        value={newItem.unitPrice}
                                                        onChangeText={(text) => setNewItem({ ...newItem, unitPrice: text })}
                                                        keyboardType="numeric"
                                                    />
                                                </View>
                                            </View>
                                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                                <TouchableOpacity
                                                    style={[styles.button, styles.editButton]}
                                                    onPress={() => setShowAddItem(false)}
                                                >
                                                    <Text style={styles.editButtonText}>Cancel</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.button, { backgroundColor: colors.secondary }]}
                                                    onPress={handleAddItem}
                                                >
                                                    <Text style={{ color: '#000', fontWeight: '600' }}>Add Item</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </>
                                    ) : (
                                        <View>
                                            <Text style={{ color: colors.textSecondary, marginBottom: 8, fontStyle: 'italic' }}>
                                                Select item to add:
                                            </Text>
                                            {inventoryItems.map((item) => (
                                                <InventoryItemRow key={item.id} item={item} onAdd={(qty) => handleAddInventoryItem(item, qty)} />
                                            ))}
                                            <TouchableOpacity
                                                style={styles.doneButton}
                                                onPress={() => setShowAddItem(false)}
                                            >
                                                <Text style={styles.doneButtonText}>Done</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            )}
                        </View>
                    )}
                </View>

                {/* Pricing Summary */}
                <View style={styles.card}>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Subtotal</Text>
                        <Text style={styles.summaryValue}>
                            ₦{isEditing
                                ? editingItems.reduce((sum, item) => sum + (item.total || 0), 0).toLocaleString()
                                : (quote.subtotal || 0).toLocaleString()
                            }
                        </Text>
                    </View>

                    {(quote.status === 'draft' || quote.status === 'rejected' || quote.status === 'pending_approval') ? (
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
                                    onChangeText={(text) => {
                                        setEditingVatRate(text);
                                    }}
                                    onBlur={() => handleSaveVatDiscount()}
                                    keyboardType="numeric"
                                    placeholder="0"
                                />
                            </View>
                            {(parseFloat(editingVatRate) || 0) > 0 && (
                                <View style={styles.summaryRow}>
                                    <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>VAT ({editingVatRate}%):</Text>
                                    <Text style={styles.summaryValue}>
                                        ₦{(() => {
                                            const sub = isEditing
                                                ? editingItems.reduce((sum, item) => sum + (item.total || 0), 0)
                                                : (quote.subtotal || 0);
                                            return (sub * ((parseFloat(editingVatRate) || 0) / 100)).toLocaleString();
                                        })()}
                                    </Text>
                                </View>
                            )}
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
                                        color: colors.textPrimary,
                                    }}
                                    value={editingDiscount}
                                    onChangeText={(text) => {
                                        setEditingDiscount(text);
                                    }}
                                    onBlur={() => handleSaveVatDiscount()}
                                    keyboardType="numeric"
                                    placeholder="0"
                                />
                            </View>
                        </>
                    ) : (
                        <>
                            {(quote.vatRate || 0) > 0 && (
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>VAT ({quote.vatRate}%)</Text>
                                    <Text style={styles.summaryValue}>₦{(quote.vat || 0).toLocaleString()}</Text>
                                </View>
                            )}
                            {(quote.discount || 0) > 0 && (
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Discount</Text>
                                    <Text style={[styles.summaryValue, { color: colors.error }]}>-₦{(quote.discount || 0).toLocaleString()}</Text>
                                </View>
                            )}
                        </>
                    )}
                    <View style={[styles.summaryRow, styles.totalRow]}>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalValue}>
                            ₦{(() => {
                                const sub = isEditing
                                    ? editingItems.reduce((sum, item) => sum + (item.total || 0), 0)
                                    : (quote.subtotal || 0);
                                const vr = parseFloat(editingVatRate) || 0;
                                const disc = parseFloat(editingDiscount) || 0;
                                return (sub + (sub * vr / 100) - disc).toLocaleString();
                            })()}
                        </Text>
                    </View>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.footer}>
                {(quote.status === 'draft' || quote.status === 'rejected' || quote.status === 'pending_approval') && (
                    <>
                        {isEditing ? (
                            <>
                                <TouchableOpacity
                                    style={[styles.button, styles.editButton, { flex: 1 }]}
                                    onPress={() => {
                                        setIsEditing(false);
                                        setEditingItems(JSON.parse(JSON.stringify(quote.items))); // Reset
                                    }}
                                >
                                    <Text style={styles.editButtonText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.button, { backgroundColor: '#fff', flex: 2 }]}
                                    onPress={handleSaveQuote}
                                    disabled={saving}
                                >
                                    {saving ? (
                                        <ActivityIndicator color="#000" />
                                    ) : (
                                        <Text style={{ color: '#000', fontSize: 16, fontWeight: '600' }}>Save Changes</Text>
                                    )}
                                </TouchableOpacity>
                            </>
                        ) : (
                            <>
                                {quote.status === 'pending_approval' && (
                                    <TouchableOpacity
                                        style={[styles.button, { backgroundColor: colors.success, flex: 2 }]}
                                        onPress={handleApproveOnBehalf}
                                        disabled={sending}
                                    >
                                        {sending ? (
                                            <ActivityIndicator color="#fff" />
                                        ) : (
                                            <>
                                                <Ionicons name="checkmark-done-outline" size={20} color="#fff" />
                                                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Approve on Behalf</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                    style={[styles.button, styles.editButton]}
                                    onPress={() => setIsEditing(true)}
                                >
                                    <Ionicons name="create-outline" size={20} color={colors.textPrimary} />
                                    <Text style={styles.editButtonText}>Edit</Text>
                                </TouchableOpacity>
                                {quote.status !== 'pending_approval' && (
                                    <TouchableOpacity
                                        style={[styles.button, styles.sendButton]}
                                        onPress={handleSendForApproval}
                                        disabled={sending}
                                    >
                                        {sending ? (
                                            <ActivityIndicator color={colors.textPrimary} />
                                        ) : (
                                            <>
                                                <Ionicons name="send-outline" size={20} color={colors.textPrimary} />
                                                <Text style={styles.sendButtonText}>Send for Approval</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                )}
                            </>
                        )
                        }
                    </>
                )}

                {quote.status === 'converted' && (
                    <TouchableOpacity
                        style={[styles.button, styles.viewInvoiceButton]}
                        onPress={handleViewInvoice}
                    >
                        <Ionicons name="receipt-outline" size={20} color="#fff" />
                        <Text style={styles.sendButtonText}>View Invoice</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View >
    );
}

const getStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },
    errorText: {
        fontSize: 16,
        color: colors.textSecondary,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingTop: 60,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.textPrimary,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    statusContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        gap: 6,
    },
    statusText: {
        fontSize: 14,
        fontWeight: '600',
    },
    dateText: {
        fontSize: 13,
        color: colors.textSecondary,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    customerName: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: 4,
    },
    customerDetail: {
        fontSize: 14,
        color: colors.textSecondary,
        marginTop: 2,
    },
    lineItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    lineItemInfo: {
        flex: 1,
    },
    lineItemDesc: {
        fontSize: 15,
        fontWeight: '500',
        color: colors.textPrimary,
    },
    lineItemQty: {
        fontSize: 13,
        color: colors.textSecondary,
        marginTop: 2,
    },
    lineItemTotal: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    input: {
        backgroundColor: colors.background,
        borderRadius: 8,
        padding: 10,
        borderWidth: 1,
        borderColor: colors.border,
        color: colors.textPrimary,
    },
    inputLabel: {
        fontSize: 12,
        color: colors.textSecondary,
        marginBottom: 4,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
    },
    summaryLabel: {
        fontSize: 15,
        color: colors.textSecondary,
    },
    summaryValue: {
        fontSize: 15,
        fontWeight: '500',
        color: colors.textPrimary,
    },
    totalRow: {
        borderTopWidth: 1,
        borderTopColor: colors.border,
        marginTop: 8,
        paddingTop: 16,
    },
    totalLabel: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.textPrimary,
    },
    totalValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.textPrimary,
    },
    footer: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        gap: 12,
    },
    button: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 12,
        gap: 8,
    },
    editButton: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    editButtonText: {
        color: colors.textPrimary,
        fontSize: 16,
        fontWeight: '600',
    },
    sendButton: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    sendButtonText: {
        color: colors.textPrimary,
        fontSize: 16,
        fontWeight: '600',
    },
    viewInvoiceButton: {
        backgroundColor: colors.success,
    },
    pendingBanner: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        backgroundColor: colors.warning + '20',
        borderRadius: 12,
        gap: 8,
    },
    pendingText: {
        color: colors.warning,
        fontSize: 15,
        fontWeight: '500',
    },
    addItemButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.textPrimary,
        borderStyle: 'dashed',
        backgroundColor: colors.surface,
        gap: 8,
    },
    addItemButtonText: {
        color: colors.textPrimary,
        fontWeight: '600',
        fontSize: 15,
    },
    addItemForm: {
        backgroundColor: colors.surface,
        marginTop: 16,
    },
    addItemTabs: {
        flexDirection: 'row',
        marginBottom: 16,
        backgroundColor: colors.border,
        borderRadius: 8,
        padding: 2,
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
        backgroundColor: colors.secondary,
    },
    addItemTabText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    addItemTabTextActive: {
        color: colors.textInverse,
    },
    inventoryItemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.surface,
        padding: 12,
        borderRadius: 8,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
        borderWidth: 1,
        borderColor: colors.border,
    },
    inventoryItemInfo: {
        flex: 1,
        marginRight: 12,
    },
    inventoryItemName: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: 4,
    },
    inventoryItemDetails: {
        fontSize: 13,
        color: colors.textSecondary,
    },
    inventoryItemCategory: {
        fontSize: 11,
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
        borderRadius: 6,
        padding: 8,
        fontSize: 14,
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
    doneButton: {
        backgroundColor: colors.secondary,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 12,
        marginBottom: 8,
    },
    doneButtonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '600',
    },
});
