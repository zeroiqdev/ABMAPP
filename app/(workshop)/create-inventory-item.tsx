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

    const handleNewQuantityChange = (delta: number) => {
        setNewUnitIds((prev) => {
            if (delta > 0) {
                // Add empty slots
                const newSlots = Array(delta).fill('');
                return [...prev, ...newSlots];
            } else {
                // Remove from end
                const slotsToRemove = Math.abs(delta);
                if (prev.length === 0) return prev;

                // Check if we are removing filled slots
                const idsToRemove = prev.slice(-slotsToRemove);
                const filledIdsToRemove = idsToRemove.filter(id => id.trim() !== '').length;

                if (filledIdsToRemove > 0) {
                    // Ideally we'd warn here, but for simplicity in this refactor we'll just remove
                    // consistent with standard UI patterns where - button just removes.
                    // If user wants to clear specific ones they can clear text.
                }
                return prev.slice(0, Math.max(0, prev.length - slotsToRemove));
            }
        });
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
        const emptyNewSlots = newUnitIds.some(id => id.trim() === '');
        if (emptyNewSlots) {
            Alert.alert('Error', 'Please enter Unique ID for all new units or remove empty slots using the - button');
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
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#5B68F6" />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.push('/(workshop)/inventory')}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{id ? 'Edit Item' : 'New Item'}</Text>
                <TouchableOpacity onPress={handleSave} disabled={loading}>
                    {loading ? (
                        <ActivityIndicator size="small" color="#000" />
                    ) : (
                        <View style={styles.saveButtonHeader}>
                            <Ionicons name="checkmark" size={24} color="#fff" />
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
                {/* Vendor Section */}
                <View style={styles.section}>
                    <Text style={styles.label}>Vendor Name *</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter vendor name"
                        placeholderTextColor="#999"
                        value={vendorName}
                        onChangeText={setVendorName}
                    />
                </View>

                {/* Item Details */}
                <View style={styles.section}>
                    <Text style={styles.label}>Item Name *</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter the item name"
                        placeholderTextColor="#999"
                        value={itemName}
                        onChangeText={setItemName}
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.label}>SKU</Text>
                    <View style={styles.skuContainer}>
                        <TextInput
                            style={[styles.input, { flex: 1, marginBottom: 0 }]}
                            placeholder="Enter SKU"
                            placeholderTextColor="#999"
                            value={sku}
                            onChangeText={setSku}
                        />
                    </View>
                </View>

                {/* Units & Serial Numbers */}
                <View style={styles.section}>
                    <Text style={styles.label}>Stock Management</Text>

                    {/* Summary Card */}
                    <View style={styles.stockSummary}>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Current Stock</Text>
                            <Text style={styles.summaryValue}>{existingUnitIds.length}</Text>
                        </View>
                        <View style={styles.summaryDivider} />
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Adding</Text>
                            <Text style={styles.summaryValue}>+{newUnitIds.length}</Text>
                        </View>
                        <View style={styles.summaryDivider} />
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Total</Text>
                            <Text style={styles.summaryValue}>{totalQuantity}</Text>
                        </View>
                    </View>

                    <View style={styles.quantityContainer}>
                        <Text style={styles.subLabel}>Add New Units</Text>
                        <View style={styles.quantityControls}>
                            <TouchableOpacity
                                style={[styles.quantityButton, newUnitIds.length === 0 && styles.quantityButtonDisabled]}
                                onPress={() => handleNewQuantityChange(-1)}
                                disabled={newUnitIds.length === 0}
                            >
                                <Ionicons name="remove" size={20} color={newUnitIds.length === 0 ? "#ccc" : "#000"} />
                            </TouchableOpacity>

                            <View style={styles.quantityDisplay}>
                                <Text style={styles.quantityText}>{newUnitIds.length}</Text>
                            </View>

                            <TouchableOpacity
                                style={styles.quantityButton}
                                onPress={() => handleNewQuantityChange(1)}
                            >
                                <Ionicons name="add" size={20} color="#000" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {newUnitIds.length > 0 && (
                        <View style={styles.unitIdsContainer}>
                            <Text style={styles.helperText}>Enter Unique ID (Serial Number) for each new unit</Text>
                            {newUnitIds.map((uid, index) => {
                                const isEmpty = !uid.trim();
                                return (
                                    <View key={index} style={styles.unitIdRow}>
                                        <TextInput
                                            style={[styles.unitInput, !isEmpty && styles.unitInputFilled]}
                                            placeholder={`New Unit ${index + 1} ID`}
                                            placeholderTextColor="#999"
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
                        <View style={styles.existingUnitsContainer}>
                            <Text style={styles.existingUnitsTitle}>Existing Units ({existingUnitIds.length})</Text>
                            <Text style={styles.existingUnitsList}>
                                {existingUnitIds.join(', ')}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Pricing */}
                <View style={styles.row}>
                    <View style={[styles.section, { flex: 1, marginRight: 10 }]}>
                        <Text style={styles.label}>Cost Price (₦)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Amount"
                            placeholderTextColor="#999"
                            value={costPrice}
                            onChangeText={setCostPrice}
                            keyboardType="numeric"
                        />
                    </View>
                    <View style={[styles.section, { flex: 1, marginLeft: 10 }]}>
                        <Text style={styles.label}>Selling Price (₦)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Amount"
                            placeholderTextColor="#999"
                            value={sellingPrice}
                            onChangeText={setSellingPrice}
                            keyboardType="numeric"
                        />
                    </View>
                </View>

                <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={loading}>
                    <Text style={styles.saveButtonText}>Save Item</Text>
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
        minWidth: 60,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    quantityText: {
        fontSize: 24,
        fontWeight: '600',
        color: '#333',
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
