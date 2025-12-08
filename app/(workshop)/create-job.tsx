import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Modal,
    FlatList,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';
import { User, Vehicle, InventoryItem, PartUsed } from '@/types';

export default function CreateJobScreen() {
    const router = useRouter();
    const { user } = useAuthStore();

    // Form State
    const [description, setDescription] = useState('');
    const [serviceCharge, setServiceCharge] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<User | null>(null);
    const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
    const [selectedTechnician, setSelectedTechnician] = useState<User | null>(null);
    const [parts, setParts] = useState<PartUsed[]>([]);

    // Data State
    const [customers, setCustomers] = useState<User[]>([]);
    const [technicians, setTechnicians] = useState<User[]>([]);
    const [customerVehicles, setCustomerVehicles] = useState<Vehicle[]>([]);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);

    // UI State
    const [loading, setLoading] = useState(false);
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [showVehicleModal, setShowVehicleModal] = useState(false);
    const [showPartModal, setShowPartModal] = useState(false);
    const [showTechnicianModal, setShowTechnicianModal] = useState(false);

    // New Entity State
    const [newCustomer, setNewCustomer] = useState({ name: '', email: '', phone: '' });
    const [newVehicle, setNewVehicle] = useState({ make: '', model: '', year: '', licensePlate: '', vin: '' });
    const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
    const [isCreatingVehicle, setIsCreatingVehicle] = useState(false);

    // Part Modal State
    const [partMode, setPartMode] = useState<'inventory' | 'external'>('inventory');
    // Map of itemId -> quantity (string)
    const [selectedInventoryItems, setSelectedInventoryItems] = useState<Map<string, string>>(new Map());
    const [externalPart, setExternalPart] = useState({ name: '', quantity: '1', cost: '', supplier: '' });

    useFocusEffect(
        useCallback(() => {
            loadInitialData();
            return () => {
                resetForm();
            };
        }, [user])
    );

    const resetForm = () => {
        setDescription('');
        setServiceCharge('');
        setSelectedCustomer(null);
        setSelectedVehicle(null);
        setSelectedTechnician(null);
        setParts([]);
        setPartMode('inventory');
        setSelectedInventoryItems(new Map());
        setExternalPart({ name: '', quantity: '1', cost: '', supplier: '' });
    };

    useEffect(() => {
        if (selectedCustomer) {
            loadCustomerVehicles(selectedCustomer.id);
        } else {
            setCustomerVehicles([]);
            setSelectedVehicle(null);
        }
    }, [selectedCustomer]);

    const loadInitialData = async () => {
        if (!user?.workshopId) return;
        try {
            // Fetch data independently to catch specific errors
            try {
                const techs = await firebaseService.getUsersByRole('technician', user.workshopId);
                setTechnicians(techs);
            } catch (e) { console.error('Tech fetch error', e); }

            try {
                const inv = await firebaseService.getInventoryItems(user.workshopId);
                setInventory(inv);
            } catch (e) { console.error('Inventory fetch error', e); }

            try {
                const custs = await firebaseService.getUsersByRole('customer', user.workshopId);
                setCustomers(custs);
            } catch (error: any) {
                console.error('Customer fetch error:', error);
                if (error.message?.includes('requires an index')) {
                    Alert.alert('Configuration Error', 'Missing Firestore Index for Customers. Please check the console or documentation.');
                }
            }
        } catch (error) {
            console.error('Error loading data:', error);
        }
    };

    const loadCustomerVehicles = async (userId: string) => {
        try {
            const vehicles = await firebaseService.getVehicles(userId);
            setCustomerVehicles(vehicles);
        } catch (error) {
            console.error('Error loading vehicles:', error);
        }
    };

    const handleCreateCustomer = async () => {
        if (!newCustomer.name || !newCustomer.email || !user?.workshopId) {
            Alert.alert('Error', 'Please fill in required fields');
            return;
        }

        // Check for duplicate email
        const emailExists = customers.some(
            c => c.email.toLowerCase() === newCustomer.email.trim().toLowerCase()
        );

        if (emailExists) {
            Alert.alert('Error', 'A customer with this email already exists.');
            return;
        }

        setLoading(true);
        try {
            const id = await firebaseService.createCustomer({
                ...newCustomer,
                role: 'customer',
                workshopId: user.workshopId,
            } as any);
            const createdUser = { id, ...newCustomer, role: 'customer' } as User;
            setCustomers([...customers, createdUser]);
            setSelectedCustomer(createdUser);
            setIsCreatingCustomer(false);
            setShowCustomerModal(false);
        } catch (error) {
            Alert.alert('Error', 'Failed to create customer');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateVehicle = async () => {
        if (!selectedCustomer || !newVehicle.make || !newVehicle.model || !newVehicle.licensePlate) {
            Alert.alert('Error', 'Please fill in required fields');
            return;
        }
        setLoading(true);
        try {
            const vehicleData = {
                ...newVehicle,
                year: parseInt(newVehicle.year) || new Date().getFullYear(),
                userId: selectedCustomer.id,
                vin: newVehicle.vin || 'N/A',
            };
            const id = await firebaseService.addVehicle(vehicleData as any);
            const createdVehicle = { id, ...vehicleData } as Vehicle;
            setCustomerVehicles([createdVehicle, ...customerVehicles]);
            setSelectedVehicle(createdVehicle);
            setIsCreatingVehicle(false);
            setShowVehicleModal(false);
        } catch (error) {
            Alert.alert('Error', 'Failed to create vehicle');
        } finally {
            setLoading(false);
        }
    };

    // Calculate available stock for an inventory item
    // Since we update inventory state immediately when parts are added,
    // the current inventory quantity already reflects available stock
    const getAvailableStock = (itemId: string): number => {
        const item = inventory.find(i => i.id === itemId);
        return item ? item.quantity : 0;
    };

    const toggleInventoryItem = (item: InventoryItem) => {
        const newMap = new Map(selectedInventoryItems);
        if (newMap.has(item.id)) {
            newMap.delete(item.id);
        } else {
            newMap.set(item.id, '1'); // Default quantity to '1' when selected
        }
        setSelectedInventoryItems(newMap);
    };

    const updateInventoryItemQty = (itemId: string, qty: string) => {
        const newMap = new Map(selectedInventoryItems);
        if (newMap.has(itemId)) {
            newMap.set(itemId, qty);
        }
        setSelectedInventoryItems(newMap);
    };

    const handleAddPart = () => {
        const newParts: PartUsed[] = [];
        const updatedInventory = [...inventory];
        let error = '';
        let itemsAddedCount = 0;

        // 1. Process Inventory Items
        if (selectedInventoryItems.size > 0) {
            for (const [itemId, qtyStr] of selectedInventoryItems.entries()) {
                const item = updatedInventory.find(i => i.id === itemId);
                if (!item) continue;

                const qty = parseInt(qtyStr) || 0;
                if (qty <= 0) {
                    error = `Invalid quantity for ${item.name}`;
                    break;
                }

                if (qty > item.quantity) {
                    error = `Only ${item.quantity} available for ${item.name}`;
                    break;
                }

                newParts.push({
                    partId: item.id,
                    partName: item.name,
                    quantity: qty,
                    unitPrice: item.sellingPrice || item.unitPrice || 0,
                });

                // Update local inventory count
                item.quantity -= qty;
                itemsAddedCount++;
            }
        }

        if (error) {
            Alert.alert('Error', error);
            return;
        }

        // 2. Process External Part (if filled)
        if (externalPart.name && externalPart.cost) {
            const qty = parseInt(externalPart.quantity) || 1;
            if (qty <= 0) {
                Alert.alert('Error', 'External part quantity must be > 0');
                return;
            }

            newParts.push({
                partId: 'EXTERNAL',
                partName: `${externalPart.name}${externalPart.supplier ? ` (${externalPart.supplier})` : ''}`,
                quantity: qty,
                unitPrice: parseFloat(externalPart.cost),
            });
            itemsAddedCount++;
        } else if (externalPart.name || externalPart.cost) {
            // Partially filled - warn user?
            // Or just ignore? Let's warn if they might have forgotten.
            if (partMode === 'external') {
                Alert.alert('Error', 'Please complete external part details or clear fields');
                return;
            }
        }

        if (itemsAddedCount === 0) {
            Alert.alert('Error', 'Please select items or enter external part details');
            return;
        }

        // 3. Commit Changes
        setParts([...parts, ...newParts]);
        setInventory(updatedInventory);

        // 4. Reset Forms and Close Modal
        setSelectedInventoryItems(new Map());
        setExternalPart({ name: '', quantity: '1', cost: '', supplier: '' });
        setShowPartModal(false);
    };

    const handleRemovePart = (index: number) => {
        const partToRemove = parts[index];

        // If it's an inventory item, restore the quantity to inventory
        if (partToRemove.partId !== 'EXTERNAL') {
            setInventory(prevInventory =>
                prevInventory.map(item =>
                    item.id === partToRemove.partId
                        ? { ...item, quantity: item.quantity + partToRemove.quantity }
                        : item
                )
            );
        }

        setParts(parts.filter((_, i) => i !== index));
    };

    const handleCreateJob = async () => {
        if (!selectedCustomer || !selectedVehicle || !description || !user?.workshopId) {
            Alert.alert('Error', 'Please fill in all required fields');
            return;
        }

        if (!serviceCharge || parseFloat(serviceCharge) <= 0) {
            Alert.alert('Error', 'Please enter a service charge');
            return;
        }

        setLoading(true);
        try {
            const jobId = await firebaseService.createJob({
                userId: selectedCustomer.id,
                vehicleId: selectedVehicle.id,
                workshopId: user.workshopId,
                type: 'service', // Default to service
                description,
                status: 'received',
                assignedTechnicianId: selectedTechnician?.id,
                technicianName: selectedTechnician?.name,
                partsUsed: parts,
                serviceCharge: parseFloat(serviceCharge),
                notes: '',
            } as any);

            // Update inventory if needed
            // Group parts by partId to sum quantities
            const inventoryUsage = new Map<string, number>();
            for (const part of parts) {
                if (part.partId !== 'EXTERNAL') {
                    const currentQty = inventoryUsage.get(part.partId) || 0;
                    inventoryUsage.set(part.partId, currentQty + part.quantity);
                }
            }

            // Reload original inventory from database to get accurate quantities
            const originalInventory = await firebaseService.getInventoryItems(user.workshopId);

            // Update each inventory item once with total quantity used
            for (const [partId, totalQty] of inventoryUsage.entries()) {
                const originalItem = originalInventory.find(i => i.id === partId);
                if (originalItem) {
                    await firebaseService.updateInventoryItem(originalItem.id, {
                        quantity: originalItem.quantity - totalQty
                    });
                }
            }

            // Automatically create invoice
            const labourCost = parseFloat(serviceCharge);
            const invoiceItems = [
                {
                    description: 'LABOUR',
                    quantity: 1,
                    unitPrice: labourCost,
                    total: labourCost,
                }
            ];

            // Add parts as invoice items
            parts.forEach(part => {
                invoiceItems.push({
                    description: part.partName,
                    quantity: part.quantity,
                    unitPrice: part.unitPrice,
                    total: part.quantity * part.unitPrice,
                });
            });

            const subtotal = invoiceItems.reduce((sum, item) => sum + item.total, 0);
            const total = subtotal; // Assuming no VAT/discount for initial creation

            const invoiceData: any = {
                jobId,
                userId: selectedCustomer.id,
                workshopId: user.workshopId,
                items: invoiceItems,
                subtotal,
                vat: 0,
                discount: 0,
                total,
                paymentStatus: 'pending',
                amountPaid: 0,
                paymentHistory: [],
            };
            // Only include dueDate if it's not undefined
            // Due date will be set later in invoice details

            await firebaseService.createInvoice(invoiceData);

            Alert.alert('Success', 'Job and invoice created successfully', [
                { text: 'OK', onPress: () => router.back() }
            ]);
        } catch (error) {
            Alert.alert('Error', 'Failed to create job');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="close" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>New Job</Text>
                <TouchableOpacity onPress={handleCreateJob} disabled={loading}>
                    {loading ? (
                        <ActivityIndicator size="small" color="#007AFF" />
                    ) : (
                        <Text style={styles.saveText}>Create</Text>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
                {/* Customer Section */}
                <View style={styles.section}>
                    <Text style={styles.label}>Customer Details</Text>
                    <TouchableOpacity
                        style={styles.selector}
                        onPress={() => setShowCustomerModal(true)}
                    >
                        <Text style={selectedCustomer ? styles.value : styles.placeholder}>
                            {selectedCustomer ? selectedCustomer.name : 'Select Customer'}
                        </Text>
                        <Ionicons name="chevron-down" size={20} color="#666" />
                    </TouchableOpacity>
                </View>

                {/* Vehicle Section */}
                <View style={styles.section}>
                    <Text style={styles.label}>Vehicle Details</Text>
                    <TouchableOpacity
                        style={[styles.selector, !selectedCustomer && styles.disabled]}
                        onPress={() => selectedCustomer && setShowVehicleModal(true)}
                        disabled={!selectedCustomer}
                    >
                        <Text style={selectedVehicle ? styles.value : styles.placeholder}>
                            {selectedVehicle
                                ? `${selectedVehicle.make} ${selectedVehicle.model} (${selectedVehicle.licensePlate})`
                                : 'Select Vehicle'}
                        </Text>
                        <Ionicons name="chevron-down" size={20} color="#666" />
                    </TouchableOpacity>
                </View>

                {/* Description */}
                <View style={styles.section}>
                    <Text style={styles.label}>Job Description</Text>
                    <TextInput
                        style={styles.textArea}
                        value={description}
                        onChangeText={setDescription}
                        placeholder="Describe the issue..."
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                    />
                </View>

                {/* Service Charge */}
                <View style={styles.section}>
                    <Text style={styles.label}>Service Charge *</Text>
                    <View style={styles.currencyInputContainer}>
                        <Text style={styles.currencySymbol}>₦</Text>
                        <TextInput
                            style={styles.currencyInput}
                            value={serviceCharge}
                            onChangeText={(text) => {
                                const numericValue = text.replace(/[^0-9.]/g, '');
                                setServiceCharge(numericValue);
                            }}
                            placeholder="Enter service charge"
                            keyboardType="numeric"
                        />
                    </View>
                </View>

                {/* Technician */}
                <View style={styles.section}>
                    <Text style={styles.label}>Technician Assignment</Text>
                    <TouchableOpacity
                        style={styles.selector}
                        onPress={() => setShowTechnicianModal(true)}
                    >
                        <Text style={selectedTechnician ? styles.value : styles.placeholder}>
                            {selectedTechnician ? selectedTechnician.name : 'Assign Technician'}
                        </Text>
                        <Ionicons name="chevron-down" size={20} color="#666" />
                    </TouchableOpacity>
                </View>

                {/* Parts */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.label}>Parts Needed</Text>
                        <TouchableOpacity onPress={async () => {
                            // Reload inventory to get accurate stock when opening modal
                            if (user?.workshopId) {
                                try {
                                    const freshInventory = await firebaseService.getInventoryItems(user.workshopId);
                                    // Restore quantities based on parts already added
                                    const restoredInventory = freshInventory.map(item => {
                                        const alreadyAdded = parts
                                            .filter(p => p.partId === item.id)
                                            .reduce((sum, p) => sum + p.quantity, 0);
                                        return { ...item, quantity: item.quantity - alreadyAdded };
                                    });
                                    setInventory(restoredInventory);
                                } catch (e) {
                                    console.error('Error reloading inventory:', e);
                                }
                            }
                            setShowPartModal(true);
                        }}>
                            <Text style={styles.addText}>+ Add Part</Text>
                        </TouchableOpacity>
                    </View>
                    {parts.map((part, index) => (
                        <View key={index} style={styles.partItem}>
                            <View>
                                <Text style={styles.partName}>{part.partName}</Text>
                                <Text style={styles.partMeta}>Qty: {part.quantity} • ₦{part.unitPrice}</Text>
                            </View>
                            <TouchableOpacity onPress={() => handleRemovePart(index)}>
                                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            </ScrollView>

            {/* Customer Modal */}
            <Modal visible={showCustomerModal} animationType="slide">
                <SafeAreaWrapper>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setShowCustomerModal(false)}>
                            <Text style={styles.closeText}>Close</Text>
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Select Customer</Text>
                        <TouchableOpacity onPress={() => setIsCreatingCustomer(!isCreatingCustomer)}>
                            <Text style={styles.addText}>{isCreatingCustomer ? 'Cancel' : 'New'}</Text>
                        </TouchableOpacity>
                    </View>

                    {isCreatingCustomer ? (
                        <View style={styles.modalForm}>
                            <TextInput
                                style={styles.input}
                                placeholder="Name"
                                value={newCustomer.name}
                                onChangeText={(t) => setNewCustomer({ ...newCustomer, name: t })}
                            />
                            <TextInput
                                style={styles.input}
                                placeholder="Email"
                                value={newCustomer.email}
                                onChangeText={(t) => setNewCustomer({ ...newCustomer, email: t })}
                                autoCapitalize="none"
                            />
                            <TextInput
                                style={styles.input}
                                placeholder="Phone"
                                value={newCustomer.phone}
                                onChangeText={(t) => setNewCustomer({ ...newCustomer, phone: t })}
                            />
                            <TouchableOpacity style={styles.primaryButton} onPress={handleCreateCustomer}>
                                <Text style={styles.primaryButtonText}>Create Customer</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <FlatList
                            data={customers}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.listItem}
                                    onPress={() => {
                                        setSelectedCustomer(item);
                                        setShowCustomerModal(false);
                                    }}
                                >
                                    <Text style={styles.listItemTitle}>{item.name}</Text>
                                    <Text style={styles.listItemSubtitle}>{item.email}</Text>
                                </TouchableOpacity>
                            )}
                        />
                    )}
                </SafeAreaWrapper>
            </Modal>

            {/* Vehicle Modal */}
            <Modal visible={showVehicleModal} animationType="slide">
                <SafeAreaWrapper>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setShowVehicleModal(false)}>
                            <Text style={styles.closeText}>Close</Text>
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Select Vehicle</Text>
                        <TouchableOpacity onPress={() => setIsCreatingVehicle(!isCreatingVehicle)}>
                            <Text style={styles.addText}>{isCreatingVehicle ? 'Cancel' : 'New'}</Text>
                        </TouchableOpacity>
                    </View>

                    {isCreatingVehicle ? (
                        <View style={styles.modalForm}>
                            <TextInput
                                style={styles.input}
                                placeholder="Make (e.g. Toyota)"
                                value={newVehicle.make}
                                onChangeText={(t) => setNewVehicle({ ...newVehicle, make: t })}
                            />
                            <TextInput
                                style={styles.input}
                                placeholder="Model (e.g. Camry)"
                                value={newVehicle.model}
                                onChangeText={(t) => setNewVehicle({ ...newVehicle, model: t })}
                            />
                            <TextInput
                                style={styles.input}
                                placeholder="Year"
                                value={newVehicle.year}
                                onChangeText={(t) => setNewVehicle({ ...newVehicle, year: t })}
                                keyboardType="numeric"
                            />
                            <TextInput
                                style={styles.input}
                                placeholder="License Plate"
                                value={newVehicle.licensePlate}
                                onChangeText={(t) => setNewVehicle({ ...newVehicle, licensePlate: t })}
                            />
                            <TouchableOpacity style={styles.primaryButton} onPress={handleCreateVehicle}>
                                <Text style={styles.primaryButtonText}>Add Vehicle</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <FlatList
                            data={customerVehicles}
                            keyExtractor={(item) => item.id}
                            ListEmptyComponent={<Text style={styles.emptyText}>No vehicles found</Text>}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.listItem}
                                    onPress={() => {
                                        setSelectedVehicle(item);
                                        setShowVehicleModal(false);
                                    }}
                                >
                                    <Text style={styles.listItemTitle}>{item.make} {item.model}</Text>
                                    <Text style={styles.listItemSubtitle}>{item.licensePlate}</Text>
                                </TouchableOpacity>
                            )}
                        />
                    )}
                </SafeAreaWrapper>
            </Modal>

            {/* Technician Modal */}
            <Modal visible={showTechnicianModal} animationType="slide">
                <SafeAreaWrapper>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setShowTechnicianModal(false)}>
                            <Text style={styles.closeText}>Close</Text>
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Select Technician</Text>
                        <View style={{ width: 40 }} />
                    </View>
                    <FlatList
                        data={technicians}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.listItem}
                                onPress={() => {
                                    setSelectedTechnician(item);
                                    setShowTechnicianModal(false);
                                }}
                            >
                                <Text style={styles.listItemTitle}>{item.name}</Text>
                                <Text style={styles.listItemSubtitle}>{item.email}</Text>
                            </TouchableOpacity>
                        )}
                    />
                </SafeAreaWrapper>
            </Modal>

            {/* Part Modal */}
            <Modal visible={showPartModal} animationType="slide">
                <SafeAreaWrapper>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setShowPartModal(false)}>
                            <Text style={styles.closeText}>Done</Text>
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Add Parts ({parts.length})</Text>
                        <View style={{ width: 40 }} />
                    </View>

                    <View style={{ flex: 1 }}>
                        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
                            {/* Show Added Parts */}
                            {parts.length > 0 && (
                                <View style={styles.addedPartsSection}>
                                    <Text style={styles.label}>Added Parts</Text>
                                    {parts.map((part, index) => (
                                        <View key={index} style={styles.addedPartItem}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.addedPartName}>{part.partName}</Text>
                                                <Text style={styles.addedPartMeta}>
                                                    Qty: {part.quantity} • ₦{part.unitPrice.toLocaleString()} each
                                                </Text>
                                            </View>
                                            <TouchableOpacity onPress={() => handleRemovePart(index)}>
                                                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            )}

                            <View style={styles.tabContainer}>
                                <TouchableOpacity
                                    style={[styles.tab, partMode === 'inventory' && styles.activeTab]}
                                    onPress={() => setPartMode('inventory')}
                                >
                                    <Text style={[styles.tabText, partMode === 'inventory' && styles.activeTabText]}>Inventory</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.tab, partMode === 'external' && styles.activeTab]}
                                    onPress={() => setPartMode('external')}
                                >
                                    <Text style={[styles.tabText, partMode === 'external' && styles.activeTabText]}>External</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.modalForm}>
                                {partMode === 'inventory' ? (
                                    <>
                                        <Text style={styles.label}>Select Items</Text>
                                        <Text style={styles.helperText}>Tap to select multiple items</Text>
                                        <FlatList
                                            data={inventory.filter(item => getAvailableStock(item.id) > 0)}
                                            scrollEnabled={false}
                                            keyExtractor={(item) => item.id}
                                            extraData={[selectedInventoryItems, parts, inventory]}
                                            renderItem={({ item }) => {
                                                const availableStock = getAvailableStock(item.id);
                                                const isSelected = selectedInventoryItems.has(item.id);
                                                const qty = selectedInventoryItems.get(item.id) || '';

                                                return (
                                                    <TouchableOpacity
                                                        style={[
                                                            styles.listItem,
                                                            isSelected && styles.selectedItem,
                                                            availableStock === 0 && styles.disabledItem
                                                        ]}
                                                        onPress={() => availableStock > 0 && toggleInventoryItem(item)}
                                                        disabled={availableStock === 0}
                                                    >
                                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <View style={{ flex: 1 }}>
                                                                <Text style={styles.listItemTitle}>{item.name}</Text>
                                                                <Text style={styles.listItemSubtitle}>
                                                                    Available: {availableStock} • ₦{item.sellingPrice || item.unitPrice}
                                                                </Text>
                                                            </View>
                                                            {isSelected ? (
                                                                <View style={styles.stepperContainer}>
                                                                    <TouchableOpacity
                                                                        style={styles.stepperButton}
                                                                        onPress={(e) => {
                                                                            e.stopPropagation();
                                                                            const currentQty = parseInt(qty) || 0;
                                                                            if (currentQty > 1) {
                                                                                updateInventoryItemQty(item.id, (currentQty - 1).toString());
                                                                            } else {
                                                                                // Optional: Deselect if goes to 0? Or just stay at 1?
                                                                                // Let's stay at 1 for now, or allow deselecting by tapping the row again.
                                                                                toggleInventoryItem(item); // Toggle off if reducing from 1
                                                                            }
                                                                        }}
                                                                    >
                                                                        <Ionicons name="remove" size={20} color="#007AFF" />
                                                                    </TouchableOpacity>

                                                                    <Text style={styles.stepperValue}>{qty}</Text>

                                                                    <TouchableOpacity
                                                                        style={styles.stepperButton}
                                                                        onPress={(e) => {
                                                                            e.stopPropagation();
                                                                            const currentQty = parseInt(qty) || 0;
                                                                            if (currentQty < availableStock) {
                                                                                updateInventoryItemQty(item.id, (currentQty + 1).toString());
                                                                            } else {
                                                                                Alert.alert('Limit Reached', `Only ${availableStock} available`);
                                                                            }
                                                                        }}
                                                                    >
                                                                        <Ionicons name="add" size={20} color="#007AFF" />
                                                                    </TouchableOpacity>
                                                                </View>
                                                            ) : (
                                                                <Ionicons name="ellipse-outline" size={24} color="#ccc" />
                                                            )}
                                                        </View>
                                                    </TouchableOpacity>
                                                );
                                            }}
                                        />
                                    </>
                                ) : (
                                    <>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Part Name"
                                            value={externalPart.name}
                                            onChangeText={(t) => setExternalPart({ ...externalPart, name: t })}
                                        />

                                        <View style={{ marginBottom: 15 }}>
                                            <Text style={styles.label}>Quantity</Text>
                                            <View style={[styles.stepperContainer, { justifyContent: 'space-between', padding: 10, backgroundColor: '#f9f9f9' }]}>
                                                <TouchableOpacity
                                                    style={styles.stepperButton}
                                                    onPress={() => {
                                                        const currentQty = parseInt(externalPart.quantity) || 1;
                                                        if (currentQty > 1) {
                                                            setExternalPart({ ...externalPart, quantity: (currentQty - 1).toString() });
                                                        }
                                                    }}
                                                >
                                                    <Ionicons name="remove" size={24} color="#007AFF" />
                                                </TouchableOpacity>

                                                <Text style={[styles.stepperValue, { fontSize: 18 }]}>{externalPart.quantity}</Text>

                                                <TouchableOpacity
                                                    style={styles.stepperButton}
                                                    onPress={() => {
                                                        const currentQty = parseInt(externalPart.quantity) || 1;
                                                        setExternalPart({ ...externalPart, quantity: (currentQty + 1).toString() });
                                                    }}
                                                >
                                                    <Ionicons name="add" size={24} color="#007AFF" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>

                                        <TextInput
                                            style={styles.input}
                                            placeholder="Unit Cost"
                                            value={externalPart.cost}
                                            onChangeText={(t) => setExternalPart({ ...externalPart, cost: t })}
                                            keyboardType="numeric"
                                        />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Supplier (Optional)"
                                            value={externalPart.supplier}
                                            onChangeText={(t) => setExternalPart({ ...externalPart, supplier: t })}
                                        />
                                    </>
                                )}
                            </View>
                        </ScrollView>

                        {/* Global Add Button */}
                        <View style={styles.footer}>
                            <TouchableOpacity style={styles.primaryButton} onPress={handleAddPart}>
                                <Text style={styles.primaryButtonText}>
                                    Add Items to Job
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </SafeAreaWrapper>
            </Modal>
        </KeyboardAvoidingView>
    );
}

function SafeAreaWrapper({ children }: { children: React.ReactNode }) {
    return (
        <View style={{ flex: 1, backgroundColor: '#fff', paddingTop: Platform.OS === 'ios' ? 50 : 20 }}>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingTop: 60,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    saveText: {
        color: '#007AFF',
        fontWeight: '600',
        fontSize: 16,
    },
    content: {
        flex: 1,
        padding: 20,
    },
    section: {
        marginBottom: 25,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    selector: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        backgroundColor: '#f9f9f9',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#eee',
    },
    value: {
        fontSize: 16,
        color: '#000',
    },
    placeholder: {
        fontSize: 16,
        color: '#999',
    },
    disabled: {
        opacity: 0.5,
    },
    disabledItem: {
        opacity: 0.5,
    },
    addedPartsSection: {
        marginBottom: 20,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    addedPartItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#f9f9f9',
        borderRadius: 8,
        marginBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f5f5f5',
    },
    addedPartName: {
        fontSize: 16,
        fontWeight: '500',
        color: '#000',
    },
    addedPartMeta: {
        fontSize: 14,
        color: '#666',
        marginTop: 2,
    },
    textArea: {
        backgroundColor: '#f9f9f9',
        borderRadius: 12,
        padding: 15,
        fontSize: 16,
        minHeight: 100,
        borderWidth: 1,
        borderColor: '#eee',
    },
    currencyInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f9f9f9',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#eee',
        paddingHorizontal: 15,
    },
    currencySymbol: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginRight: 8,
    },
    currencyInput: {
        flex: 1,
        paddingVertical: 15,
        fontSize: 16,
        color: '#000',
    },
    partItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        backgroundColor: '#f9f9f9',
        borderRadius: 8,
        marginBottom: 10,
    },
    partName: {
        fontSize: 16,
        fontWeight: '500',
    },
    partMeta: {
        fontSize: 14,
        color: '#666',
        marginTop: 2,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    closeText: {
        fontSize: 16,
        color: '#007AFF',
    },
    addText: {
        fontSize: 16,
        color: '#007AFF',
        fontWeight: '600',
    },
    modalForm: {
        padding: 20,
    },
    input: {
        backgroundColor: '#f5f5f5',
        padding: 15,
        borderRadius: 12,
        marginBottom: 15,
        fontSize: 16,
    },
    smallInput: {
        backgroundColor: '#f5f5f5',
        padding: 5,
        borderRadius: 8,
        width: 50,
        textAlign: 'center',
        fontSize: 14,
    },
    helperText: {
        fontSize: 14,
        color: '#666',
        marginBottom: 10,
    },
    tabContainer: {
        flexDirection: 'row',
        marginBottom: 20,
        backgroundColor: '#f5f5f5',
        borderRadius: 12,
        padding: 4,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 10,
    },
    activeTab: {
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    tabText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#666',
    },
    activeTabText: {
        color: '#000',
        fontWeight: '600',
    },
    footer: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#eee',
        backgroundColor: '#fff',
    },
    selectedItem: {
        backgroundColor: '#f0f9ff',
        borderColor: '#007AFF',
        borderWidth: 1,
    },
    primaryButton: {
        backgroundColor: '#007AFF',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 10,
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    listItem: {
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    listItemTitle: {
        fontSize: 16,
        fontWeight: '500',
    },
    listItemSubtitle: {
        fontSize: 14,
        color: '#666',
        marginTop: 2,
    },
    emptyText: {
        textAlign: 'center',
        padding: 20,
        color: '#999',
    },
    stepperContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        padding: 4,
    },
    stepperButton: {
        padding: 8,
        backgroundColor: '#fff',
        borderRadius: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
        elevation: 1,
    },
    stepperValue: {
        fontSize: 16,
        fontWeight: '600',
        paddingHorizontal: 12,
        minWidth: 40,
        textAlign: 'center',
    },
});
