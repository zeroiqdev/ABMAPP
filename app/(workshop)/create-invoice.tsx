

import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import React, { useState, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';
import { User, Invoice, InvoiceItem } from '@/types';
import { Colors } from '@/constants/design';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';

export default function CreateInvoiceScreen() {
    const router = useRouter();
    const { user } = useAuthStore();
    const [loading, setLoading] = useState(false);

    interface ManualCustomer {
        name?: string;
        phone?: string;
        email?: string;
        address?: string;
    }

    const [selectedCustomer, setSelectedCustomer] = useState<ManualCustomer>({});
    const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);

    // New Item State
    const [newItemDescription, setNewItemDescription] = useState('');
    const [newItemQuantity, setNewItemQuantity] = useState('1');
    const [newItemPrice, setNewItemPrice] = useState('');

    // Invoice Settings
    const [vatRate, setVatRate] = useState('0'); // Default VAT
    const [discount, setDiscount] = useState('0');

    // Date Selection
    const [dueDate, setDueDate] = useState<Date | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Reset form when screen is focused
    useFocusEffect(
        useCallback(() => {
            // Reset all state variables
            setSelectedCustomer({});
            setInvoiceItems([]);
            setNewItemDescription('');
            setNewItemQuantity('1');
            setNewItemPrice('');
            setVatRate('0');
            setDiscount('0');
            setDueDate(null);
            setShowDatePicker(false);
            setLoading(false);
        }, [])
    );

    const handleAddItem = () => {
        if (!newItemDescription || !newItemPrice) {
            Alert.alert('Error', 'Please enter description and price');
            return;
        }

        const quantity = parseFloat(newItemQuantity) || 1;
        const price = parseFloat(newItemPrice) || 0;

        const newItem: InvoiceItem = {
            description: newItemDescription,
            quantity,
            unitPrice: price,
            total: quantity * price,
        };

        setInvoiceItems([...invoiceItems, newItem]);

        // Reset inputs
        setNewItemDescription('');
        setNewItemQuantity('1');
        setNewItemPrice('');
    };

    const handleRemoveItem = (index: number) => {
        const updatedItems = invoiceItems.filter((_, i) => i !== index);
        setInvoiceItems(updatedItems);
    };

    const calculateTotals = () => {
        const subtotal = invoiceItems.reduce((sum, item) => sum + item.total, 0);
        const vat = subtotal * (parseFloat(vatRate) || 0) / 100;
        const discountVal = parseFloat(discount) || 0;
        const total = subtotal + vat - discountVal;

        return { subtotal, vat, total };
    };

    const handleCreateInvoice = async () => {
        if (!selectedCustomer.name) {
            Alert.alert('Error', 'Please enter customer name');
            return;
        }

        if (invoiceItems.length === 0) {
            Alert.alert('Error', 'Please add at least one item');
            return;
        }

        if (!user?.workshopId) return;

        setLoading(true);
        try {
            const { subtotal, vat, total } = calculateTotals();

            const newInvoice: Omit<Invoice, 'id' | 'createdAt'> = {
                customerName: selectedCustomer.name,
                customerPhone: selectedCustomer.phone,
                customerEmail: selectedCustomer.email,
                customerAddress: selectedCustomer.address,
                workshopId: user.workshopId,
                items: invoiceItems,
                subtotal,
                vat,
                vatRate: parseFloat(vatRate) || 0,
                discount: parseFloat(discount) || 0,
                total,
                paymentStatus: 'pending',
                status: 'draft',
                dueDate: dueDate || undefined,
            };

            await firebaseService.createInvoice(newInvoice);
            Alert.alert('Success', 'Invoice created successfully', [
                { text: 'OK', onPress: () => router.back() }
            ]);
        } catch (error) {
            console.error('Error creating invoice:', error);
            Alert.alert('Error', 'Failed to create invoice');
        } finally {
            setLoading(false);
        }
    };

    const { subtotal, vat, total } = calculateTotals();

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={100}
        >
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Create New Invoice</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.content}>
                {/* Customer Details */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Customer Details</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Customer Name"
                        value={selectedCustomer?.name || ''}
                        onChangeText={(text) => setSelectedCustomer(prev => ({ ...prev, name: text }))}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Phone Number"
                        value={selectedCustomer?.phone || ''}
                        onChangeText={(text) => setSelectedCustomer(prev => ({ ...prev, phone: text }))}
                        keyboardType="phone-pad"
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Email (Optional)"
                        value={selectedCustomer?.email || ''}
                        onChangeText={(text) => setSelectedCustomer(prev => ({ ...prev, email: text }))}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Address (Optional)"
                        value={selectedCustomer?.address || ''}
                        onChangeText={(text) => setSelectedCustomer(prev => ({ ...prev, address: text }))}
                    />
                </View>

                {/* Invoice Items */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Invoice Items</Text>

                    {invoiceItems.map((item, index) => (
                        <View key={index} style={styles.itemCard}>
                            <View style={styles.itemInfo}>
                                <Text style={styles.itemDescription}>{item.description}</Text>
                                <Text style={styles.itemDetails}>
                                    {item.quantity} x ₦{item.unitPrice.toLocaleString()}
                                </Text>
                            </View>
                            <View style={styles.itemRight}>
                                <Text style={styles.itemTotal}>₦{item.total.toLocaleString()}</Text>
                                <TouchableOpacity onPress={() => handleRemoveItem(index)}>
                                    <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}

                    {/* Add Item Form */}
                    <View style={styles.addItemForm}>
                        <TextInput
                            style={[styles.input, styles.descInput]}
                            placeholder="Description (e.g. Service Fee)"
                            value={newItemDescription}
                            onChangeText={setNewItemDescription}
                        />
                        <View style={styles.row}>
                            <TextInput
                                style={[styles.input, styles.halfInput]}
                                placeholder="Qty"
                                value={newItemQuantity}
                                onChangeText={setNewItemQuantity}
                                keyboardType="numeric"
                            />
                            <TextInput
                                style={[styles.input, styles.halfInput]}
                                placeholder="Price"
                                value={newItemPrice}
                                onChangeText={setNewItemPrice}
                                keyboardType="numeric"
                            />
                        </View>
                        <TouchableOpacity style={styles.addButton} onPress={handleAddItem}>
                            <Ionicons name="add" size={20} color="#fff" />
                            <Text style={styles.addButtonText}>Add Item</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Settings & Totals */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Summary</Text>

                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Subtotal</Text>
                        <Text style={styles.summaryValue}>₦{subtotal.toLocaleString()}</Text>
                    </View>

                    <View style={styles.settingRow}>
                        <Text style={styles.settingLabel}>VAT Rate (%)</Text>
                        <TextInput
                            style={styles.settingInput}
                            value={vatRate}
                            onChangeText={setVatRate}
                            keyboardType="numeric"
                            placeholder="0"
                        />
                    </View>

                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>VAT Amount</Text>
                        <Text style={styles.summaryValue}>₦{vat.toLocaleString()}</Text>
                    </View>

                    <View style={styles.settingRow}>
                        <Text style={styles.settingLabel}>Discount (₦)</Text>
                        <TextInput
                            style={styles.settingInput}
                            value={discount}
                            onChangeText={setDiscount}
                            keyboardType="numeric"
                            placeholder="0"
                        />
                    </View>

                    <View style={styles.settingRow}>
                        <Text style={styles.settingLabel}>Due Date</Text>
                        <TouchableOpacity
                            style={styles.dateSelector}
                            onPress={() => setShowDatePicker(true)}
                        >
                            <Text style={styles.dateText}>
                                {dueDate ? format(dueDate, 'MMM dd, yyyy') : 'Select Date'}
                            </Text>
                            <Ionicons name="calendar-outline" size={20} color={Colors.textPrimary} />
                        </TouchableOpacity>
                    </View>

                    {showDatePicker && (
                        <DateTimePicker
                            value={dueDate || new Date()}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            minimumDate={new Date()}
                            onChange={(event, selectedDate) => {
                                setShowDatePicker(Platform.OS === 'ios');
                                if (selectedDate) {
                                    setDueDate(selectedDate);
                                }
                            }}
                        />
                    )}

                    {Platform.OS === 'ios' && showDatePicker && (
                        <View style={styles.iosDatePickerToolbar}>
                            <TouchableOpacity
                                style={styles.iosDatePickerButton}
                                onPress={() => setShowDatePicker(false)}
                            >
                                <Text style={styles.iosDatePickerButtonText}>Done</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    <View style={[styles.summaryRow, styles.totalRow]}>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalValue}>₦{total.toLocaleString()}</Text>
                    </View>
                </View>

            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.createButton, loading && styles.disabledButton]}
                    onPress={handleCreateInvoice}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.createButtonText}>Create Invoice</Text>
                    )}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingTop: 60,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    content: {
        flex: 1,
        padding: 20,
    },
    section: {
        marginBottom: 25,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 15,
        color: '#333',
    },
    input: {
        backgroundColor: '#f9f9f9',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#eee',
        padding: 12,
        fontSize: 16,
        marginBottom: 10,
    },
    customerList: {
        marginTop: 5,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    customerItem: {
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    customerItemName: {
        fontWeight: '500',
        fontSize: 16,
    },
    customerItemPhone: {
        color: '#666',
        fontSize: 14,
    },
    selectedCustomerCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#f0f9ff',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#b3e0ff',
    },
    customerName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#007AFF',
    },
    customerPhone: {
        fontSize: 14,
        color: '#555',
    },
    itemCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        marginBottom: 5,
    },
    itemInfo: {
        flex: 1,
    },
    itemDescription: {
        fontSize: 16,
        fontWeight: '500',
    },
    itemDetails: {
        fontSize: 14,
        color: '#666',
        marginTop: 2,
    },
    itemRight: {
        alignItems: 'flex-end',
        gap: 8,
    },
    itemTotal: {
        fontWeight: '600',
        fontSize: 16,
    },
    addItemForm: {
        marginTop: 15,
        paddingTop: 15,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    row: {
        flexDirection: 'row',
        gap: 10,
    },
    halfInput: {
        flex: 1,
    },
    descInput: {
        marginBottom: 10,
    },
    addButton: {
        flexDirection: 'row',
        backgroundColor: '#000',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 5,
    },
    addButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    summaryLabel: {
        fontSize: 16,
        color: '#666',
    },
    summaryValue: {
        fontSize: 16,
        fontWeight: '500',
    },
    settingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    settingLabel: {
        fontSize: 16,
        color: '#333',
    },
    settingInput: {
        backgroundColor: '#f9f9f9',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#eee',
        padding: 8,
        width: 100,
        textAlign: 'right',
    },
    totalRow: {
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    totalLabel: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    totalValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.textPrimary,
    },
    footer: {
        padding: 20,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    createButton: {
        backgroundColor: Colors.secondary,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    disabledButton: {
        opacity: 0.7,
    },
    createButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    dateSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f9f9f9',
        padding: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#eee',
        gap: 8,
    },
    dateText: {
        fontSize: 14,
        color: '#333',
    },
    iosDatePickerToolbar: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        padding: 10,
        backgroundColor: '#f0f0f0',
        borderTopWidth: 1,
        borderColor: '#ddd',
    },
    iosDatePickerButton: {
        padding: 5,
    },
    iosDatePickerButtonText: {
        color: Colors.primary,
        fontSize: 16,
        fontWeight: '600',
    },
});
