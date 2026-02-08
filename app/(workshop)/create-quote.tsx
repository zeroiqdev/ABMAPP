import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';
import { QuoteItem, User } from '@/types';
import { format } from 'date-fns';
import { useColors } from '@/constants/design';

interface LineItem {
    id: string;
    description: string;
    quantity: string;
    unitPrice: string;
}

export default function CreateQuoteScreen() {
    const { user } = useAuthStore();
    const router = useRouter();
    const colors = useColors();
    const styles = useMemo(() => getStyles(colors), [colors]);

    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerEmail, setCustomerEmail] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');

    const [items, setItems] = useState<LineItem[]>([
        { id: '1', description: '', quantity: '1', unitPrice: '' }
    ]);

    const [vatRate, setVatRate] = useState('7.5');
    const [discount, setDiscount] = useState('0');
    const [saving, setSaving] = useState(false);
    const [sendAfterCreate, setSendAfterCreate] = useState(false);

    const [customers, setCustomers] = useState<User[]>([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const [showCustomerSearch, setShowCustomerSearch] = useState(false);
    const [customerSearch, setCustomerSearch] = useState('');

    useEffect(() => {
        loadCustomers();
    }, []);

    const loadCustomers = async () => {
        if (!user?.workshopId) return;
        try {
            const customersData = await firebaseService.getUsersByRole('customer', user.workshopId);
            setCustomers(customersData);
        } catch (error) {
            console.error('Error loading customers:', error);
        }
    };

    const handleAddItem = () => {
        setItems([
            ...items,
            { id: Date.now().toString(), description: '', quantity: '1', unitPrice: '' }
        ]);
    };

    const handleRemoveItem = (id: string) => {
        if (items.length === 1) return;
        setItems(items.filter(item => item.id !== id));
    };

    const handleUpdateItem = (id: string, field: keyof LineItem, value: string) => {
        setItems(items.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ));
    };

    const calculateTotals = () => {
        const subtotal = items.reduce((sum, item) => {
            const qty = parseFloat(item.quantity) || 0;
            const price = parseFloat(item.unitPrice) || 0;
            return sum + (qty * price);
        }, 0);

        const vatAmount = subtotal * (parseFloat(vatRate) || 0) / 100;
        const discountAmount = parseFloat(discount) || 0;
        const total = subtotal + vatAmount - discountAmount;

        return { subtotal, vatAmount, discountAmount, total };
    };

    const { subtotal, vatAmount, discountAmount, total } = calculateTotals();

    const selectCustomer = (customer: User) => {
        setSelectedCustomerId(customer.id);
        setCustomerName(customer.name);
        setCustomerPhone(customer.phone || '');
        setCustomerEmail(customer.email || '');
        setCustomerAddress('');
        setShowCustomerSearch(false);
        setCustomerSearch('');
    };

    const handleCreateQuote = async (sendForApproval: boolean = false) => {
        if (!customerName.trim()) {
            Alert.alert('Error', 'Please enter customer name');
            return;
        }

        const validItems = items.filter(item =>
            item.description.trim() && parseFloat(item.unitPrice) > 0
        );

        if (validItems.length === 0) {
            Alert.alert('Error', 'Please add at least one item with description and price');
            return;
        }

        setSaving(true);
        try {
            const quoteItems: QuoteItem[] = validItems.map(item => ({
                id: item.id,
                description: item.description,
                quantity: parseFloat(item.quantity) || 1,
                unitPrice: parseFloat(item.unitPrice) || 0,
                total: (parseFloat(item.quantity) || 1) * (parseFloat(item.unitPrice) || 0),
                isAdditionalWork: false,
                addedAt: new Date(),
            }));

            const quoteId = await firebaseService.createQuote({
                workshopId: user?.workshopId || '',
                userId: selectedCustomerId || undefined,
                customerName,
                customerPhone: customerPhone || undefined,
                customerEmail: customerEmail || undefined,
                customerAddress: customerAddress || undefined,
                items: quoteItems,
                subtotal,
                vatRate: parseFloat(vatRate) || 0,
                vat: vatAmount,
                discount: discountAmount,
                total,
                status: 'draft',
            });

            if (sendForApproval) {
                await firebaseService.sendQuoteForApproval(
                    quoteId,
                    user?.id || '',
                    user?.name || 'Staff'
                );
                Alert.alert('Success', 'Quote created and sent for approval');
            } else {
                Alert.alert('Success', 'Quote saved as draft');
            }

            router.back();
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to create quote');
        } finally {
            setSaving(false);
        }
    };

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        (c.phone && c.phone.includes(customerSearch))
    );

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Create Quote</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Customer Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Customer</Text>

                    <TouchableOpacity
                        style={styles.searchButton}
                        onPress={() => setShowCustomerSearch(!showCustomerSearch)}
                    >
                        <Ionicons name="search" size={20} color={colors.primary} />
                        <Text style={styles.searchButtonText}>Search Existing Customer</Text>
                    </TouchableOpacity>

                    {showCustomerSearch && (
                        <View style={styles.customerSearch}>
                            <TextInput
                                style={styles.searchInput}
                                value={customerSearch}
                                onChangeText={setCustomerSearch}
                                placeholderTextColor={colors.textTertiary} placeholder="Search by name or phone..."
                            />
                            {filteredCustomers.slice(0, 5).map(customer => (
                                <TouchableOpacity
                                    key={customer.id}
                                    style={styles.customerItem}
                                    onPress={() => selectCustomer(customer)}
                                >
                                    <Text style={styles.customerItemName}>{customer.name}</Text>
                                    <Text style={styles.customerItemPhone}>{customer.phone}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    <TextInput
                        style={styles.input}
                        value={customerName}
                        onChangeText={setCustomerName}
                        placeholderTextColor={colors.textTertiary} placeholder="Customer Name *"
                    />
                    <TextInput
                        style={styles.input}
                        value={customerPhone}
                        onChangeText={setCustomerPhone}
                        placeholderTextColor={colors.textTertiary} placeholder="Phone Number"
                        keyboardType="phone-pad"
                    />
                    <TextInput
                        style={styles.input}
                        value={customerEmail}
                        onChangeText={setCustomerEmail}
                        placeholderTextColor={colors.textTertiary} placeholder="Email"
                        keyboardType="email-address"
                    />
                    <TextInput
                        style={styles.input}
                        value={customerAddress}
                        onChangeText={setCustomerAddress}
                        placeholderTextColor={colors.textTertiary} placeholder="Address"
                        multiline
                    />
                </View>

                {/* Line Items */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Line Items</Text>
                        <TouchableOpacity onPress={handleAddItem}>
                            <Ionicons name="add-circle" size={28} color={colors.primary} />
                        </TouchableOpacity>
                    </View>

                    {items.map((item, index) => (
                        <View key={item.id} style={styles.lineItem}>
                            <View style={styles.lineItemHeader}>
                                <Text style={styles.lineItemNumber}>Item {index + 1}</Text>
                                {items.length > 1 && (
                                    <TouchableOpacity onPress={() => handleRemoveItem(item.id)}>
                                        <Ionicons name="trash-outline" size={20} color={colors.error} />
                                    </TouchableOpacity>
                                )}
                            </View>
                            <TextInput
                                style={styles.input}
                                value={item.description}
                                onChangeText={(v) => handleUpdateItem(item.id, 'description', v)}
                                placeholderTextColor={colors.textTertiary} placeholder="Description"
                            />
                            <View style={styles.row}>
                                <TextInput
                                    style={[styles.input, styles.halfInput]}
                                    value={item.quantity}
                                    onChangeText={(v) => handleUpdateItem(item.id, 'quantity', v)}
                                    placeholderTextColor={colors.textTertiary} placeholder="Qty"
                                    keyboardType="numeric"
                                />
                                <TextInput
                                    style={[styles.input, styles.halfInput]}
                                    value={item.unitPrice}
                                    onChangeText={(v) => handleUpdateItem(item.id, 'unitPrice', v)}
                                    placeholderTextColor={colors.textTertiary} placeholder="Unit Price (₦)"
                                    keyboardType="numeric"
                                />
                            </View>
                            <Text style={styles.lineTotal}>
                                Total: ₦{((parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0)).toLocaleString()}
                            </Text>
                        </View>
                    ))}
                </View>

                {/* Pricing */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Pricing</Text>
                    <View style={styles.row}>
                        <TextInput
                            style={[styles.input, styles.halfInput]}
                            value={vatRate}
                            onChangeText={setVatRate}
                            placeholderTextColor={colors.textTertiary} placeholder="VAT %"
                            keyboardType="numeric"
                        />
                        <TextInput
                            style={[styles.input, styles.halfInput]}
                            value={discount}
                            onChangeText={setDiscount}
                            placeholderTextColor={colors.textTertiary} placeholder="Discount (₦)"
                            keyboardType="numeric"
                        />
                    </View>
                </View>

                {/* Summary */}
                <View style={styles.summaryCard}>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Subtotal</Text>
                        <Text style={styles.summaryValue}>₦{subtotal.toLocaleString()}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>VAT ({vatRate}%)</Text>
                        <Text style={styles.summaryValue}>₦{vatAmount.toLocaleString()}</Text>
                    </View>
                    {discountAmount > 0 && (
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Discount</Text>
                            <Text style={[styles.summaryValue, { color: colors.error }]}>-₦{discountAmount.toLocaleString()}</Text>
                        </View>
                    )}
                    <View style={[styles.summaryRow, styles.totalRow]}>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalValue}>₦{total.toLocaleString()}</Text>
                    </View>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.button, styles.draftButton]}
                    onPress={() => handleCreateQuote(false)}
                    disabled={saving}
                >
                    {saving ? (
                        <ActivityIndicator color={colors.primary} />
                    ) : (
                        <Text style={styles.draftButtonText}>Save Draft</Text>
                    )}
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.button, styles.sendButton]}
                    onPress={() => handleCreateQuote(true)}
                    disabled={saving}
                >
                    {saving ? (
                        <ActivityIndicator color={colors.textInverse} />
                    ) : (
                        <Text style={styles.sendButtonText}>Send for Approval</Text>
                    )}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const getStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
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
    section: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
        color: colors.textPrimary,
    },
    input: {
        backgroundColor: colors.background,
        borderRadius: 8,
        padding: 14,
        fontSize: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
        color: colors.textPrimary,
    },
    searchButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: colors.primary + '15',
        borderRadius: 8,
        marginBottom: 12,
        gap: 8,
    },
    searchButtonText: {
        color: colors.primary,
        fontSize: 14,
        fontWeight: '500',
    },
    customerSearch: {
        backgroundColor: colors.background,
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
    },
    searchInput: {
        backgroundColor: colors.surface,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: colors.border,
        color: colors.textPrimary,
    },
    customerItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    customerItemName: {
        fontSize: 15,
        fontWeight: '500',
        color: colors.textPrimary,
    },
    customerItemPhone: {
        fontSize: 13,
        color: colors.textSecondary,
        marginTop: 2,
    },
    lineItem: {
        backgroundColor: colors.background,
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    lineItemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    lineItemNumber: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    row: {
        flexDirection: 'row',
        gap: 12,
    },
    halfInput: {
        flex: 1,
    },
    lineTotal: {
        textAlign: 'right',
        fontSize: 14,
        fontWeight: '600',
        color: colors.textPrimary,
        marginTop: -4,
    },
    summaryCard: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 16,
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
        color: colors.primary,
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
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    draftButton: {
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.primary,
    },
    draftButtonText: {
        color: colors.primary,
        fontSize: 16,
        fontWeight: '600',
    },
    sendButton: {
        backgroundColor: colors.primary,
    },
    sendButtonText: {
        color: colors.textInverse,
        fontSize: 16,
        fontWeight: '600',
    },
});
