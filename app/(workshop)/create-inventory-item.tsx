import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';
import { InventoryItem } from '@/types';
import { Colors, useColors } from '@/constants/design';

export default function CreateInventoryItemScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { user } = useAuthStore();

    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(!!id);

    // Form State
    const [vendorName, setVendorName] = useState('');
    const [itemName, setItemName] = useState('');
    const [sku, setSku] = useState('');
    const [costPrice, setCostPrice] = useState('');
    const [sellingPrice, setSellingPrice] = useState('');

    // Serial Numbers & Quantity Logic
    // existingUnitIds: IDs already saved in DB (for edit mode)
    const [existingUnitIds, setExistingUnitIds] = useState<string[]>([]);
    // newUnitIds: New IDs being added in this session
    const [newUnitIds, setNewUnitIds] = useState<string[]>([]);

    // Total quantity is calculated, not directly set
    const totalQuantity = existingUnitIds.length + newUnitIds.length;

    useEffect(() => {
        if (id) {
            loadItem();
        } else {
            // Reset form when creating new item (no id)
            resetForm();
        }
    }, [id]);

    const colors = useColors();

    // Generate a unique ID using timestamp + random hex
    const generateUniqueId = (): string => {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(16).substring(2, 6).toUpperCase();
        return `ITEM-${timestamp}${random}`;
    };

    const handleNewQuantityChange = (delta: number) => {
        setNewUnitIds((prev) => {
            if (delta > 0) {
                // Auto-generate unique IDs for new slots
                const newSlots = Array(delta).fill(null).map(() => generateUniqueId());
                return [...prev, ...newSlots];
            } else {
                // Remove from end
                const slotsToRemove = Math.abs(delta);
                if (prev.length === 0) return prev;
                return prev.slice(0, Math.max(0, prev.length - slotsToRemove));
            }
        });
    };

    // Allow typing a number directly into the quantity field
    const handleDirectQuantityInput = (text: string) => {
        const parsed = parseInt(text, 10);
        if (text === '' || text === '0') {
            // Clear all new units
            setNewUnitIds([]);
            return;
        }
        if (isNaN(parsed) || parsed < 0) return;
        const desired = parsed;
        const current = newUnitIds.length;
        if (desired > current) {
            handleNewQuantityChange(desired - current);
        } else if (desired < current) {
            handleNewQuantityChange(desired - current);
        }
    };

    const loadItem = async () => {
        if (!user?.workshopId || !id) return;
        try {
            resetForm();

            const items = await firebaseService.getInventoryItems(user.workshopId);
            const item = items.find(i => i.id === id);
            if (item) {
                setItemName(item.name);
                setSku(item.sku || '');
                setVendorName(item.vendor || item.supplier || '');
                setCostPrice(item.costPrice?.toString() || '');
                setSellingPrice(item.sellingPrice?.toString() || item.unitPrice?.toString() || '');

                // Load existing unit IDs
                const loadedUnitIds = item.unitIds || [];
                setExistingUnitIds([...loadedUnitIds]);

                // Start with 0 new units when editing
                setNewUnitIds([]);
            }
        } catch (error) {
            console.error('Error loading item:', error);
        } finally {
            setInitialLoading(false);
        }
    };

    const resetForm = () => {
        setItemName('');
        setSku('');
        setVendorName('');
        setCostPrice('');
        setSellingPrice('');
        setExistingUnitIds([]);
        setNewUnitIds([]);
    };

    const handleSave = async () => {
        if (!itemName || !vendorName || !user?.workshopId) {
            Alert.alert('Error', 'Please fill in required fields');
            return;
        }

        // Validate new unit IDs
        // 1. No empty slots allowed in new units
        const emptyNewSlots = newUnitIds.some(uid => uid.trim() === '');
        if (emptyNewSlots) {
            Alert.alert('Error', 'All units must have a unique ID. Please fill in or remove empty entries.');
            return;
        }

        // 2. Check for duplicates within the new batch
        const newIdsSet = new Set(newUnitIds.map(id => id.trim().toLowerCase()));
        if (newIdsSet.size !== newUnitIds.length) {
            Alert.alert('Error', 'You have entered duplicate IDs in the new units list.');
            return;
        }

        // 3. Check for duplicates against existing IDs of THIS item
        const existingIdsSet = new Set(existingUnitIds.map(id => id.trim().toLowerCase()));
        const duplicatesInExisting = newUnitIds.filter(id => existingIdsSet.has(id.trim().toLowerCase()));
        if (duplicatesInExisting.length > 0) {
            Alert.alert('Error', `The following IDs already exist in this item: ${duplicatesInExisting.join(', ')}`);
            return;
        }

        setLoading(true);

        try {
            // 4. Global Uniqueness Check
            const allItems = await firebaseService.getInventoryItems(user.workshopId);
            const allOtherUniqueIds = new Set<string>();

            allItems.forEach(item => {
                // Skip current item if editing
                if (item.id === id) return;

                if (item.unitIds) {
                    item.unitIds.forEach(uid => {
                        if (uid && uid.trim() !== '') {
                            allOtherUniqueIds.add(uid.trim().toLowerCase());
                        }
                    });
                }
            });

            const globalDuplicates: string[] = [];
            newUnitIds.forEach(newId => {
                if (allOtherUniqueIds.has(newId.trim().toLowerCase())) {
                    globalDuplicates.push(newId.trim());
                }
            });

            if (globalDuplicates.length > 0) {
                setLoading(false);
                Alert.alert(
                    'Duplicate Unique ID',
                    `The following unique ID(s) already exist in other inventory items: ${globalDuplicates.join(', ')}\n\nEach unique ID must be unique across all inventory items.`
                );
                return;
            }

            // Check for duplicate item names (if name changed or new item)
            const isNameDuplicate = allItems.some(
                (item) => item.name.toLowerCase() === itemName.trim().toLowerCase() && item.id !== id
            );

            if (isNameDuplicate) {
                setLoading(false);
                Alert.alert(
                    'Duplicate Item',
                    'An item with this name already exists. Please edit the existing item to update its stock level.'
                );
                return;
            }

            // Prepare final data
            const finalUnitIds = [...existingUnitIds, ...newUnitIds.map(id => id.trim())];
            const finalQuantity = finalUnitIds.length;

            const itemData: any = {
                workshopId: user.workshopId,
                name: itemName,
                category: 'General',
                quantity: finalQuantity,
                minStockLevel: 5,
                sku,
                vendor: vendorName,
                costPrice: parseFloat(costPrice) || 0,
                sellingPrice: parseFloat(sellingPrice) || 0,
                unitPrice: parseFloat(sellingPrice) || 0,
                unitIds: finalUnitIds,
            };

            if (id) {
                await firebaseService.updateInventoryItem(id, itemData);
            } else {
                await firebaseService.createInventoryItem(itemData);
            }

            console.log('Item saved successfully');
            // Navigate back with refresh param
            router.replace(`/(workshop)/inventory?refresh=${Date.now()}`);

            setTimeout(() => {
                Alert.alert('Success', 'Item saved successfully');
            }, 100);

        } catch (error) {
            console.error('Save error:', error);
            Alert.alert('Error', 'Failed to save item');
        } finally {
            setLoading(false);
        }
    };

    const updateNewUnitId = (index: number, value: string) => {
        setNewUnitIds((prev) => {
            const newIds = [...prev];
            newIds[index] = value;
            return newIds;
        });
    };

    if (initialLoading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: colors.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => router.push('/(workshop)/inventory')}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{id ? 'Edit Item' : 'New Item'}</Text>
                <TouchableOpacity onPress={handleSave} disabled={loading}>
                    {loading ? (
                        <ActivityIndicator size="small" color={colors.textPrimary} />
                    ) : (
                        <View style={[styles.saveButtonHeader, { backgroundColor: colors.textPrimary }]}>
                            <Ionicons name="checkmark" size={24} color={colors.textInverse} />
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
                {/* Vendor Section */}
                <View style={styles.section}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Vendor Name *</Text>
                    <TextInput
                        style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                        placeholder="Enter vendor name"
                        placeholderTextColor={colors.textTertiary}
                        value={vendorName}
                        onChangeText={setVendorName}
                    />
                </View>

                {/* Item Details */}
                <View style={styles.section}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Item Name *</Text>
                    <TextInput
                        style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                        placeholder="Enter the item name"
                        placeholderTextColor={colors.textTertiary}
                        value={itemName}
                        onChangeText={setItemName}
                    />
                </View>

                <View style={styles.section}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>SKU</Text>
                    <View style={styles.skuContainer}>
                        <TextInput
                            style={[styles.input, { flex: 1, marginBottom: 0, backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                            placeholder="Enter SKU"
                            placeholderTextColor={colors.textTertiary}
                            value={sku}
                            onChangeText={setSku}
                        />
                    </View>
                </View>

                {/* Units & Serial Numbers */}
                <View style={styles.section}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Stock Management</Text>

                    {/* Summary Card */}
                    <View style={[styles.stockSummary, { backgroundColor: colors.surface }]}>
                        <View style={styles.summaryItem}>
                            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Current Stock</Text>
                            <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{existingUnitIds.length}</Text>
                        </View>
                        <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
                        <View style={styles.summaryItem}>
                            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Adding</Text>
                            <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>+{newUnitIds.length}</Text>
                        </View>
                        <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
                        <View style={styles.summaryItem}>
                            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total</Text>
                            <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{totalQuantity}</Text>
                        </View>
                    </View>

                    <View style={styles.quantityContainer}>
                        <Text style={[styles.subLabel, { color: colors.textPrimary }]}>Add New Units</Text>
                        <View style={styles.quantityControls}>
                            <TouchableOpacity
                                style={[
                                    styles.quantityButton,
                                    { backgroundColor: colors.surface, borderColor: colors.textPrimary },
                                    newUnitIds.length === 0 && [styles.quantityButtonDisabled, { backgroundColor: colors.background, borderColor: colors.border }]
                                ]}
                                onPress={() => handleNewQuantityChange(-1)}
                                disabled={newUnitIds.length === 0}
                            >
                                <Ionicons name="remove" size={20} color={newUnitIds.length === 0 ? colors.textTertiary : colors.textPrimary} />
                            </TouchableOpacity>

                            <View style={[styles.quantityDisplay, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                                <TextInput
                                    style={[styles.quantityText, { color: colors.textPrimary }]}
                                    value={String(newUnitIds.length)}
                                    onChangeText={handleDirectQuantityInput}
                                    keyboardType="number-pad"
                                    selectTextOnFocus
                                />
                            </View>

                            <TouchableOpacity
                                style={[styles.quantityButton, { backgroundColor: colors.surface, borderColor: colors.textPrimary }]}
                                onPress={() => handleNewQuantityChange(1)}
                            >
                                <Ionicons name="add" size={20} color={colors.textPrimary} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {newUnitIds.length > 0 && (
                        <View style={[styles.unitIdsContainer, { backgroundColor: colors.background }]}>
                            <Text style={[styles.helperText, { color: colors.textSecondary }]}>Unique IDs are auto-generated. You can edit them if needed.</Text>
                            {newUnitIds.map((uid, index) => {
                                const isEmpty = !uid.trim();
                                return (
                                    <View key={index} style={styles.unitIdRow}>
                                        <TextInput
                                            style={[
                                                styles.unitInput,
                                                { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary },
                                                !isEmpty && [styles.unitInputFilled, { borderColor: Colors.success, backgroundColor: colors.surface }]
                                            ]}
                                            placeholder={`New Unit ${index + 1} ID`}
                                            placeholderTextColor={colors.textTertiary}
                                            value={uid}
                                            onChangeText={(text) => updateNewUnitId(index, text)}
                                            autoCapitalize="none"
                                        />
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    {existingUnitIds.length > 0 && (
                        <View style={[styles.existingUnitsContainer, { backgroundColor: colors.background }]}>
                            <Text style={[styles.existingUnitsTitle, { color: colors.textSecondary }]}>Existing Units ({existingUnitIds.length})</Text>
                            <Text style={[styles.existingUnitsList, { color: colors.textTertiary }]}>
                                {existingUnitIds.join(', ')}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Pricing */}
                <View style={styles.row}>
                    <View style={[styles.section, { flex: 1, marginRight: 10 }]}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Cost Price (₦)</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                            placeholder="Amount"
                            placeholderTextColor={colors.textTertiary}
                            value={costPrice}
                            onChangeText={setCostPrice}
                            keyboardType="numeric"
                        />
                    </View>
                    <View style={[styles.section, { flex: 1, marginLeft: 10 }]}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Selling Price (₦)</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                            placeholder="Amount"
                            placeholderTextColor={colors.textTertiary}
                            value={sellingPrice}
                            onChangeText={setSellingPrice}
                            keyboardType="numeric"
                        />
                    </View>
                </View>

                <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.textPrimary }]} onPress={handleSave} disabled={loading}>
                    <Text style={[styles.saveButtonText, { color: colors.textInverse }]}>Save Item</Text>
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingTop: 60,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        backgroundColor: '#fff',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    saveButtonHeader: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
        padding: 20,
    },
    section: {
        marginBottom: 24,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    subLabel: {
        fontSize: 14,
        color: '#333',
        marginBottom: 8,
        fontWeight: '500',
    },
    helperText: {
        fontSize: 12,
        color: '#888',
        marginBottom: 12,
    },
    input: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#E5E5EA',
        borderRadius: 12,
        padding: 15,
        fontSize: 16,
    },
    skuContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    // Stock Management Styles
    stockSummary: {
        flexDirection: 'row',
        backgroundColor: '#F9F9F9',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        justifyContent: 'space-between',
    },
    summaryItem: {
        alignItems: 'center',
        flex: 1,
    },
    summaryLabel: {
        fontSize: 12,
        color: '#888',
        marginBottom: 4,
    },
    summaryValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#000',
    },
    summaryDivider: {
        width: 1,
        backgroundColor: '#E5E5EA',
        height: '100%',
    },
    quantityContainer: {
        marginBottom: 16,
    },
    quantityControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    quantityButton: {
        width: 44,
        height: 44,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#000',
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    quantityButtonDisabled: {
        borderColor: '#E5E5EA',
        backgroundColor: '#F9F9F9',
    },
    quantityDisplay: {
        minWidth: 70,
        height: 44,
        paddingHorizontal: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        borderWidth: 1,
        marginHorizontal: 12,
    },
    quantityText: {
        fontSize: 20,
        fontWeight: '600',
        textAlign: 'center',
        minWidth: 40,
    },
    unitIdsContainer: {
        backgroundColor: '#F9F9F9',
        borderRadius: 12,
        padding: 12,
    },
    unitIdRow: {
        marginBottom: 8,
    },
    unitInput: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#E5E5EA',
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
    },
    unitInputFilled: {
        borderColor: '#4CAF50',
        backgroundColor: '#F1F8F4',
    },
    existingUnitsContainer: {
        marginTop: 16,
        padding: 12,
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
    },
    existingUnitsTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#666',
        marginBottom: 4,
    },
    existingUnitsList: {
        fontSize: 12,
        color: '#888',
        lineHeight: 18,
    },
    row: {
        flexDirection: 'row',
    },
    saveButton: {
        backgroundColor: '#000',
        padding: 18,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 20,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
