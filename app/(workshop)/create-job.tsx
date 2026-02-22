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
    Image,
} from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';
import { User, Vehicle, InventoryItem, PartUsed } from '@/types';
import { CAR_BRANDS } from '@/constants/carBrands';
import { BrandLogo } from '@/components/BrandLogo';
import { Colors, useColors } from '@/constants/design';

const ISSUE_OPTIONS = [
    'Servicing',
    'Mechanical',
    'Electrical',
    'Hydraulic',
    'Software / Sensors',
    'Wear & Tear',
    'Accidental Damage',
    'Fluid Leak',
    'Noise / Vibration',
    'Overheating',
    'Performance Loss',
    'Tow Request',
];

export default function CreateJobScreen() {
    const router = useRouter();
    const { user } = useAuthStore();
    const colors = useColors();
    const params = useLocalSearchParams<{ jobId: string }>();
    const editJobId = params.jobId;

    // Form State
    const [description, setDescription] = useState('');
    const [issues, setIssues] = useState<string[]>([]);
    const [serviceCharge, setServiceCharge] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<User | null>(null);
    const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
    const [selectedTechnicians, setSelectedTechnicians] = useState<User[]>([]);
    const [parts, setParts] = useState<PartUsed[]>([]);

    // Data State
    const [customers, setCustomers] = useState<User[]>([]);
    const [technicians, setTechnicians] = useState<User[]>([]);
    const [customerVehicles, setCustomerVehicles] = useState<Vehicle[]>([]);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);

    // UI State
    const [loading, setLoading] = useState(false);
    const [loadingJob, setLoadingJob] = useState(false);
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
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [selectedInventoryItems, setSelectedInventoryItems] = useState<Map<string, string>>(new Map());
    const [externalPart, setExternalPart] = useState({ name: '', quantity: '1', cost: '', supplier: '' });

    // Brand Selection State
    const [isBrandSelectionMode, setIsBrandSelectionMode] = useState(false);
    const [searchBrandQuery, setSearchBrandQuery] = useState('');
    const [searchCustomerQuery, setSearchCustomerQuery] = useState('');

    const filteredBrands = CAR_BRANDS.filter(b =>
        b.name.toLowerCase().includes(searchBrandQuery.toLowerCase())
    );

    useFocusEffect(
        useCallback(() => {
            loadInitialData();
            if (editJobId) {
                loadJobDetails(editJobId);
            }
            return () => {
                if (!editJobId) resetForm();
            };
        }, [user, editJobId])
    );

    const resetForm = () => {
        setDescription('');
        setIssues([]);
        setServiceCharge('');
        setSelectedCustomer(null);
        setSelectedVehicle(null);
        setSelectedTechnicians([]);
        setParts([]);
        setPartMode('inventory');
        setSelectedInventoryItems(new Map());
        setExternalPart({ name: '', quantity: '1', cost: '', supplier: '' });
    };

    // Real-time subscription for customers
    useEffect(() => {
        if (!user?.workshopId) {
            console.log('[CreateJob] No workshopId, skipping customer subscription');
            return;
        }
        console.log('[CreateJob] Subscribing to customers for workshop:', user.workshopId);
        const unsubscribe = firebaseService.subscribeToUsersByRole('customer', user.workshopId, (custs) => {
            console.log('[CreateJob] Customer subscription received:', custs.length, 'customers');
            setCustomers(custs);
        });
        return () => {
            console.log('[CreateJob] Unsubscribing from customers');
            unsubscribe();
        };
    }, [user?.workshopId]);

    // Load vehicles when customer is selected
    useEffect(() => {
        if (selectedCustomer) {
            loadCustomerVehicles(selectedCustomer.id);
        } else if (!editJobId) {
            // Only clear vehicles if not in edit mode
            setCustomerVehicles([]);
            setSelectedVehicle(null);
        }
    }, [selectedCustomer]);

    const loadInitialData = async () => {
        if (!user?.workshopId) return;
        try {
            // Fetch technicians
            try {
                const techs = await firebaseService.getUsersByRole('technician', user.workshopId);
                setTechnicians(techs);
            } catch (e) { console.error('Tech fetch error', e); }

            // Fetch inventory
            try {
                const inv = await firebaseService.getInventoryItems(user.workshopId);
                setInventory(inv);
            } catch (e) { console.error('Inventory fetch error', e); }

        } catch (error) {
            console.error('Error loading data:', error);
        }
    };

    const loadJobDetails = async (jobId: string) => {
        setLoadingJob(true);
        try {
            const job = await firebaseService.getJob(jobId);
            if (!job) {
                Alert.alert('Error', 'Job not found');
                router.back();
                return;
            }

            // Pre-fill form
            if (job.userId) {
                const customer = await firebaseService.getUser(job.userId);
                if (customer) setSelectedCustomer(customer as User);

                // Load vehicles immediately to ensure we can select the vehicle
                const vehicles = await firebaseService.getVehicles(job.userId);
                setCustomerVehicles(vehicles);
                const vehicle = vehicles.find(v => v.id === job.vehicleId);
                if (vehicle) setSelectedVehicle(vehicle);
            }

            setDescription(job.description || '');

            // Robustly handle Tow Request issue selection
            if (job.issues && job.issues.length > 0) {
                setIssues(job.issues);
            } else if (job.type === 'tow' || (job.description && job.description.toLowerCase().includes('tow request'))) {
                setIssues(['Tow Request']);
            } else {
                setIssues([]);
            }
            // Service charge/tech/parts will likely be empty for new requests, but we populate if they exist
            if (job.serviceCharge) setServiceCharge(job.serviceCharge.toString());
            // Load multiple technicians if available
            if (job.assignedTechnicianIds && job.assignedTechnicianIds.length > 0) {
                const techs = await Promise.all(
                    job.assignedTechnicianIds.map(id => firebaseService.getUser(id))
                );
                setSelectedTechnicians(techs.filter((t): t is User => t !== null));
            } else if (job.assignedTechnicianId) {
                // Fallback for single technician
                const tech = await firebaseService.getUser(job.assignedTechnicianId);
                if (tech) setSelectedTechnicians([tech as User]);
            }
            if (job.partsUsed) setParts(job.partsUsed);

        } catch (error) {
            console.error('Error loading job:', error);
            Alert.alert('Error', 'Failed to load job details');
        } finally {
            setLoadingJob(false);
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

    const toggleIssue = (issue: string) => {
        setIssues((prev) =>
            prev.includes(issue) ? prev.filter((i) => i !== issue) : [...prev, issue]
        );
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
            // Create the customer in users collection
            const id = await firebaseService.createCustomer({
                ...newCustomer,
                email: newCustomer.email.toLowerCase().trim(),
                role: 'customer',
                workshopId: user.workshopId,
            } as any);

            // Customer is created in users collection - when they signup with this email,
            // they will be auto-linked to this workshop

            const createdUser: User = {
                id,
                ...newCustomer,
                email: newCustomer.email.toLowerCase().trim(),
                role: 'customer',
                workshopId: user.workshopId,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            setCustomers(prev => {
                const exists = prev.some(c => c.id === createdUser.id);
                if (exists) return prev;
                // Add and sort by name
                const updated = [...prev, createdUser];
                return updated.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            });
            setSelectedCustomer(createdUser);
            setIsCreatingCustomer(false);
            setShowCustomerModal(false);
            setSearchCustomerQuery('');
            setNewCustomer({ name: '', email: '', phone: '' }); // Reset form for next use
            console.log('[CreateJob] Customer created successfully:', createdUser.id, createdUser.name);
        } catch (error) {
            console.error('Error creating customer:', error);
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
            setShowVehicleModal(false);
            setIsCreatingVehicle(false); // Switch back to list view
            setNewVehicle({ make: '', model: '', year: '', licensePlate: '', vin: '' }); // Reset form
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

    const addExternalPartToList = () => {
        if (!externalPart.name || !externalPart.cost) {
            Alert.alert('Error', 'Please enter part name and cost');
            return false;
        }

        const qty = parseInt(externalPart.quantity) || 1;
        if (qty <= 0) {
            Alert.alert('Error', 'Quantity must be greater than 0');
            return false;
        }

        const newPart = {
            partId: 'EXTERNAL',
            partName: `${externalPart.name}${externalPart.supplier ? ` (${externalPart.supplier})` : ''}`,
            quantity: qty,
            unitPrice: parseFloat(externalPart.cost),
        };

        setParts(prev => [...prev, newPart]);
        setExternalPart({ name: '', quantity: '1', cost: '', supplier: '' });
        return true;
    };

    const addInventorySelectionToList = () => {
        if (selectedInventoryItems.size === 0) {
            Alert.alert('Error', 'Please select items first');
            return false;
        }

        const newParts: PartUsed[] = [];
        const updatedInventory = [...inventory];
        let error = '';

        for (const [itemId, qtyStr] of selectedInventoryItems.entries()) {
            const item = updatedInventory.find(i => i.id === itemId);
            if (!item) continue;

            const qty = parseInt(qtyStr) || 0;
            if (qty <= 0) continue;

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
        }

        if (error) {
            Alert.alert('Error', error);
            return false;
        }

        setParts(prev => [...prev, ...newParts]);
        setInventory(updatedInventory);
        setSelectedInventoryItems(new Map());
        return true;
    };

    const handleEditPart = (index: number) => {
        const part = parts[index];

        if (part.partId === 'EXTERNAL') {
            let name = part.partName;
            let supplier = '';
            // Parse name/supplier format: "Name (Supplier)"
            const match = part.partName.match(/^(.*) \((.*)\)$/);
            if (match) {
                name = match[1];
                supplier = match[2];
            } else {
                name = part.partName;
            }

            setExternalPart({
                name,
                quantity: part.quantity.toString(),
                cost: part.unitPrice.toString(),
                supplier
            });
            setPartMode('external');
        } else {
            // For inventory, switch to inventory tab
            setPartMode('inventory');
            Alert.alert('Info', 'Item removed. Please re-select from inventory.');
        }

        // Remove from list (functionally acting as "Edit" by removing and putting back in form)
        handleRemovePart(index);
    };

    const handleAddPart = () => {
        // This is now the "Done" / "Commit" button
        let itemsAdded = false;

        // Try adding pending items
        if (selectedInventoryItems.size > 0) {
            if (addInventorySelectionToList()) {
                itemsAdded = true;
            } else {
                return; // Error occurred
            }
        }

        if (externalPart.name || externalPart.cost) {
            if (addExternalPartToList()) {
                itemsAdded = true;
            } else {
                return; // Error occurred
            }
        }

        // If nothing pending was added, check if we have existing parts
        if (!itemsAdded) {
            if (parts.length > 0) {
                setShowPartModal(false);
            } else {
                Alert.alert('Error', 'Please select items or enter details');
            }
            return;
        }

        // If we added items, close modal
        setShowPartModal(false);
    };

    const handleSubmitJob = async () => {
        if (!selectedCustomer || !selectedVehicle || !description || !user?.workshopId) {
            Alert.alert('Error', 'Please fill in all required fields');
            return;
        }

        if (issues.length === 0) {
            Alert.alert('Error', 'Please select at least one issue');
            return;
        }

        if (!serviceCharge || parseFloat(serviceCharge) <= 0) {
            Alert.alert('Error', 'Please enter a service charge');
            return;
        }

        setLoading(true);
        try {
            const jobData: any = {
                userId: selectedCustomer.id,
                vehicleId: selectedVehicle.id,
                workshopId: user.workshopId,
                type: issues.length === 1 && issues[0] === 'Servicing'
                    ? 'service'
                    : issues.includes('Servicing')
                        ? 'service_and_repair'
                        : 'repair',
                issues,
                description,
                assignedTechnicianIds: selectedTechnicians.map(t => t.id),
                technicianNames: selectedTechnicians.map(t => t.name),
                // Keep legacy fields for backwards compatibility
                assignedTechnicianId: selectedTechnicians[0]?.id || undefined,
                technicianName: selectedTechnicians[0]?.name || undefined,
                partsUsed: parts,
                serviceCharge: parseFloat(serviceCharge),
                // Only set status to 'received' if we are creating, 
                // OR if updating, we might want to keep it or move it to 'diagnosed' if tech is assigned?
                // For now, let's keep consistent: if tech is assigned, maybe move to diagnosed? 
                // Creating a job from scratch defaults to 'received'.
                // If updating a 'received' request, and we add tech/charge, we might want to ACK it.
                // But the requirement says "Create Job page... remaining like add parts...".
                status: 'diagnosed', // Ensure status becomes 'diagnosed' when confirming/updating a request
            };

            // If creating new
            if (!editJobId) {
                // New jobs created by staff should start as 'diagnosed'
                jobData.status = 'diagnosed';
                jobData.notes = '';
            }

            let jobId = editJobId;

            if (editJobId) {
                // Update existing job
                await firebaseService.updateJob(editJobId, jobData);
            } else {
                // Create new job
                jobId = await firebaseService.createJob(jobData);
            }

            if (!jobId) throw new Error('Job ID missing');

            // Inventory Updates (Logic is same for Create/Update for now - assuming we track deltas or just snapshot)
            // Ideally for updates we should diff against previous parts usage, but for this "Complete Request" flow,
            // the previous parts were likely EMPTY (since customer didn't add any).
            // So we can assume all parts in `parts` are NEWLY added for this specific flow.
            // CAUTION: If we edit a job multiple times, this might double-deduct. 
            // BUT: This flow is specifically for "Completing a Request". 
            // We assume request had NO parts.

            // Group parts by partId to sum quantities
            const inventoryUsage = new Map<string, number>();
            for (const part of parts) {
                if (part.partId !== 'EXTERNAL') {
                    const currentQty = inventoryUsage.get(part.partId) || 0;
                    inventoryUsage.set(part.partId, currentQty + part.quantity);
                }
            }

            // Reload original inventory and deduct
            // Note: This logic assumes we haven't deducted these parts yet.
            const originalInventory = await firebaseService.getInventoryItems(user.workshopId);
            for (const [partId, totalQty] of inventoryUsage.entries()) {
                const originalItem = originalInventory.find(i => i.id === partId);
                if (originalItem) {
                    await firebaseService.updateInventoryItem(originalItem.id, {
                        quantity: originalItem.quantity - totalQty
                    });
                }
            }

            // Create Invoice (Only if one doesn't exist? Or always create new one?)
            // If updating, we should check if invoice exists. 
            // For "Request Repair", no invoice exists yet.
            // If we edit a job that HAS an invoice, we might duplicate.
            // We'll assume this flow is for INITIAL confirmation.
            // TODO: In future, check for existing invoice.

            const labourCost = parseFloat(serviceCharge);
            const quoteItems = [
                {
                    description: 'LABOUR',
                    quantity: 1,
                    unitPrice: labourCost,
                    total: labourCost,
                }
            ];

            parts.forEach(part => {
                quoteItems.push({
                    description: part.partName,
                    quantity: part.quantity,
                    unitPrice: part.unitPrice,
                    total: part.quantity * part.unitPrice,
                });
            });

            const subtotal = quoteItems.reduce((sum, item) => sum + item.total, 0);
            const total = subtotal;

            const quoteData: any = {
                jobId,
                customerId: selectedCustomer.id,
                userId: selectedCustomer.id, // Add userId for customer app visibility
                customerName: selectedCustomer.name,
                workshopId: user.workshopId,
                items: quoteItems,
                subtotal,
                vat: 0,
                discount: 0,
                total,
                status: 'pending_approval',
            };

            await firebaseService.createQuote(quoteData);

            setShowSuccessModal(true);
        } catch (error) {
            Alert.alert('Error', `Failed to ${editJobId ? 'update' : 'create'} job`);
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: colors.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => router.push('/(workshop)/jobs')}>
                    <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{editJobId ? 'Confirm Job' : 'New Job'}</Text>
                <TouchableOpacity onPress={handleSubmitJob} disabled={loading || loadingJob}>
                    {loading ? (
                        <ActivityIndicator size="small" color={colors.textPrimary} />
                    ) : (
                        <Text style={[styles.saveText, { color: colors.primary }]}>{editJobId ? 'Update' : 'Create'}</Text>
                    )}
                </TouchableOpacity>
            </View>

            {loadingJob ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={{ color: colors.textSecondary }}>Loading Job Details...</Text>
                </View>
            ) : (
                <ScrollView style={styles.content}>
                    {/* Customer Section */}
                    <View style={[styles.section, { backgroundColor: 'transparent' }]}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Customer Details</Text>
                        <TouchableOpacity
                            style={[styles.selector, { backgroundColor: 'transparent', borderColor: colors.border }]}
                            onPress={() => setShowCustomerModal(true)}
                        >
                            <Text style={selectedCustomer ? [styles.value, { color: colors.textPrimary }] : [styles.placeholder, { color: colors.textTertiary }]}>
                                {selectedCustomer ? selectedCustomer.name : 'Select Customer'}
                            </Text>
                            <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Vehicle Section */}
                    <View style={[styles.section, { backgroundColor: 'transparent' }]}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Vehicle Details</Text>
                        <TouchableOpacity
                            style={[styles.selector, { backgroundColor: 'transparent', borderColor: colors.border }, !selectedCustomer && styles.disabled]}
                            onPress={() => selectedCustomer && setShowVehicleModal(true)}
                            disabled={!selectedCustomer}
                        >
                            <Text style={selectedVehicle ? [styles.value, { color: colors.textPrimary }] : [styles.placeholder, { color: colors.textTertiary }]}>
                                {selectedVehicle
                                    ? `${selectedVehicle.make} ${selectedVehicle.model} (${selectedVehicle.licensePlate})`
                                    : 'Select Vehicle'}
                            </Text>
                            <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Issue Categories */}
                    <View style={[styles.section, { backgroundColor: 'transparent' }]}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Issue</Text>
                        <View style={styles.issueChipsContainer}>
                            {ISSUE_OPTIONS.map((option) => {
                                const active = issues.includes(option);
                                return (
                                    <TouchableOpacity
                                        key={option}
                                        style={[
                                            styles.issueChip,
                                            { backgroundColor: colors.background, borderColor: colors.border },
                                            active && { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary }
                                        ]}
                                        onPress={() => toggleIssue(option)}
                                    >
                                        <Text style={[
                                            styles.issueChipText,
                                            { color: colors.textPrimary },
                                            active && { color: colors.textInverse }
                                        ]}>
                                            {option}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        {issues.length > 1 && (
                            <Text style={[styles.issueHint, { color: colors.textSecondary }]}>Multiple selections will be summarized on cards</Text>
                        )}
                    </View>

                    {/* Description */}
                    <View style={[styles.section, { backgroundColor: 'transparent' }]}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Issue Description</Text>
                        <TextInput
                            style={[styles.textArea, { backgroundColor: 'transparent', borderColor: colors.border, color: colors.textPrimary }]}
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Describe the issue..."
                            placeholderTextColor={colors.textTertiary}
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                        />
                    </View>

                    {/* Service Charge */}
                    <View style={[styles.section, { backgroundColor: 'transparent' }]}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Service Charge *</Text>
                        <View style={[styles.currencyInputContainer, { backgroundColor: 'transparent', borderColor: colors.border }]}>
                            <Text style={[styles.currencySymbol, { color: colors.textPrimary }]}>₦</Text>
                            <TextInput
                                style={[styles.currencyInput, { color: colors.textPrimary }]}
                                value={serviceCharge}
                                onChangeText={(text) => {
                                    const numericValue = text.replace(/[^0-9.]/g, '');
                                    setServiceCharge(numericValue);
                                }}
                                placeholder="Enter service charge"
                                placeholderTextColor={colors.textTertiary}
                                keyboardType="numeric"
                            />
                        </View>
                    </View>

                    {/* Technician */}
                    <View style={[styles.section, { backgroundColor: 'transparent' }]}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Technician Assignment</Text>
                        <TouchableOpacity
                            style={[styles.selector, { backgroundColor: 'transparent', borderColor: colors.border }]}
                            onPress={() => setShowTechnicianModal(true)}
                        >
                            <Text style={selectedTechnicians.length > 0 ? [styles.value, { color: colors.textPrimary }] : [styles.placeholder, { color: colors.textTertiary }]}>
                                {selectedTechnicians.length > 0 ? selectedTechnicians.map(t => t.name).join(', ') : 'Assign Technicians'}
                            </Text>
                            <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Parts */}
                    <View style={[styles.section, { backgroundColor: 'transparent' }]}>
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>Parts Needed</Text>
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
                                <Text style={[styles.addText, { color: colors.primary }]}>+ Add Part</Text>
                            </TouchableOpacity>
                        </View>
                        {parts.map((part, index) => (
                            <View key={index} style={[styles.partItem, { backgroundColor: 'transparent', borderColor: colors.border }]}>
                                <View>
                                    <Text style={[styles.partName, { color: colors.textPrimary }]}>{part.partName}</Text>
                                    <Text style={[styles.partMeta, { color: colors.textSecondary }]}>Qty: {part.quantity} • ₦{part.unitPrice}</Text>
                                </View>
                                <TouchableOpacity onPress={() => handleRemovePart(index)}>
                                    <Ionicons name="trash-outline" size={20} color={Colors.error} />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                </ScrollView>
            )}

            {/* Customer Modal */}
            <Modal visible={showCustomerModal} animationType="slide">
                <SafeAreaWrapper>
                    <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                        <TouchableOpacity onPress={() => setShowCustomerModal(false)}>
                            <Text style={[styles.closeText, { color: colors.textPrimary }]}>Close</Text>
                        </TouchableOpacity>
                        <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Select Customer</Text>
                        <TouchableOpacity onPress={() => setIsCreatingCustomer(!isCreatingCustomer)}>
                            <Text style={[styles.addText, { color: colors.primary }]}>{isCreatingCustomer ? 'Cancel' : 'New'}</Text>
                        </TouchableOpacity>
                    </View>

                    {isCreatingCustomer ? (
                        <View style={styles.modalForm}>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                                placeholder="Name"
                                placeholderTextColor={colors.textTertiary}
                                value={newCustomer.name}
                                onChangeText={(t) => setNewCustomer({ ...newCustomer, name: t })}
                            />
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                                placeholder="Email"
                                placeholderTextColor={colors.textTertiary}
                                value={newCustomer.email}
                                onChangeText={(t) => setNewCustomer({ ...newCustomer, email: t })}
                                autoCapitalize="none"
                            />
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                                placeholder="Phone"
                                placeholderTextColor={colors.textTertiary}
                                value={newCustomer.phone}
                                onChangeText={(t) => setNewCustomer({ ...newCustomer, phone: t })}
                            />
                            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={handleCreateCustomer}>
                                <Text style={styles.primaryButtonText}>Create Customer</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={{ flex: 1 }}>
                            <TextInput
                                style={[styles.input, { backgroundColor: 'transparent', borderColor: colors.border, color: colors.textPrimary, margin: 20, marginBottom: 10 }]}
                                placeholder="Search Customer..."
                                placeholderTextColor={colors.textTertiary}
                                value={searchCustomerQuery}
                                onChangeText={setSearchCustomerQuery}
                            />
                            <FlatList
                                data={customers
                                    .filter(c =>
                                        c.name.toLowerCase().includes(searchCustomerQuery.toLowerCase()) ||
                                        c.email.toLowerCase().includes(searchCustomerQuery.toLowerCase()) ||
                                        (c.phone && c.phone.includes(searchCustomerQuery))
                                    )
                                    .sort((a, b) => a.name.localeCompare(b.name))
                                }
                                keyExtractor={(item) => item.id}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={[styles.listItem, { borderBottomColor: colors.border }]}
                                        onPress={() => {
                                            setSelectedCustomer(item);
                                            setShowCustomerModal(false);
                                        }}
                                    >
                                        <Text style={[styles.listItemTitle, { color: colors.textPrimary }]}>{item.name}</Text>
                                        <Text style={[styles.listItemSubtitle, { color: colors.textSecondary }]}>{item.email}</Text>
                                    </TouchableOpacity>
                                )}
                            />
                        </View>
                    )}
                </SafeAreaWrapper>
            </Modal>

            {/* Vehicle Modal */}
            <Modal visible={showVehicleModal} animationType="slide">
                <SafeAreaWrapper>
                    <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                        <TouchableOpacity onPress={isBrandSelectionMode ? () => setIsBrandSelectionMode(false) : () => {
                            setShowVehicleModal(false);
                            setNewVehicle({ make: '', model: '', year: '', licensePlate: '', vin: '' });
                            setIsCreatingVehicle(false);
                        }}>
                            <Text style={[styles.closeText, { color: colors.textPrimary }]}>{isBrandSelectionMode ? 'Back' : 'Close'}</Text>
                        </TouchableOpacity>
                        <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{isBrandSelectionMode ? 'Select Make' : 'Select Vehicle'}</Text>
                        <TouchableOpacity onPress={() => setIsCreatingVehicle(!isCreatingVehicle)} disabled={isBrandSelectionMode}>
                            {!isBrandSelectionMode && <Text style={[styles.addText, { color: colors.primary }]}>{isCreatingVehicle ? 'Cancel' : 'New'}</Text>}
                        </TouchableOpacity>
                    </View>

                    {isBrandSelectionMode ? (
                        <View style={{ flex: 1, padding: 20 }}>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                                placeholder="Search or Enter Custom Brand..."
                                placeholderTextColor={colors.textTertiary}
                                value={searchBrandQuery}
                                onChangeText={setSearchBrandQuery}
                                autoFocus
                            />
                            <FlatList
                                data={filteredBrands}
                                keyExtractor={(item) => item.name}
                                ListHeaderComponent={() => (
                                    searchBrandQuery.length > 0 ? (
                                        <TouchableOpacity
                                            style={[styles.brandItem, { borderBottomColor: colors.border }]}
                                            onPress={() => {
                                                setNewVehicle({ ...newVehicle, make: searchBrandQuery });
                                                setIsBrandSelectionMode(false);
                                                setSearchBrandQuery('');
                                            }}
                                        >
                                            <Ionicons name="create-outline" size={24} color={colors.textPrimary} style={{ marginRight: 12 }} />
                                            <Text style={[styles.brandName, { fontWeight: '600', color: colors.textPrimary }]}>Use "{searchBrandQuery}"</Text>
                                        </TouchableOpacity>
                                    ) : null
                                )}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={[styles.brandItem, { borderBottomColor: colors.border }]}
                                        onPress={() => {
                                            setNewVehicle({ ...newVehicle, make: item.name });
                                            setIsBrandSelectionMode(false);
                                            setSearchBrandQuery('');
                                        }}
                                    >
                                        <BrandLogo brand={item.name} size={28} style={{ marginRight: 12 }} />
                                        <Text style={[styles.brandName, { color: colors.textPrimary }]}>{item.name}</Text>
                                    </TouchableOpacity>
                                )}
                            />
                        </View>
                    ) : isCreatingVehicle ? (
                        <ScrollView style={styles.modalForm} contentContainerStyle={{ padding: 20 }}>
                            <View style={{ marginBottom: 20 }}>
                                <TouchableOpacity
                                    style={[styles.selector, { backgroundColor: colors.surface, borderColor: colors.border }]}
                                    onPress={() => setIsBrandSelectionMode(true)}
                                >
                                    <Text style={newVehicle.make ? [styles.value, { color: colors.textPrimary }] : [styles.placeholder, { color: colors.textTertiary }]}>
                                        {newVehicle.make || 'Select Make'}
                                    </Text>
                                    <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                                </TouchableOpacity>
                            </View>

                            <View style={{ marginBottom: 20 }}>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                                    placeholder="Model (e.g. Camry)"
                                    placeholderTextColor={colors.textTertiary}
                                    value={newVehicle.model}
                                    onChangeText={(t) => setNewVehicle({ ...newVehicle, model: t })}
                                />
                            </View>

                            <View style={{ marginBottom: 20 }}>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                                    placeholder="Year"
                                    placeholderTextColor={colors.textTertiary}
                                    value={newVehicle.year}
                                    onChangeText={(t) => setNewVehicle({ ...newVehicle, year: t })}
                                    keyboardType="numeric"
                                />
                            </View>

                            <View style={{ marginBottom: 20 }}>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                                    placeholder="License Plate"
                                    placeholderTextColor={colors.textTertiary}
                                    value={newVehicle.licensePlate}
                                    onChangeText={(t) => setNewVehicle({ ...newVehicle, licensePlate: t })}
                                />
                            </View>

                            <View style={{ marginBottom: 20 }}>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                                    placeholder="VIN (Optional)"
                                    placeholderTextColor={colors.textTertiary}
                                    value={newVehicle.vin}
                                    onChangeText={(t) => setNewVehicle({ ...newVehicle, vin: t })}
                                />
                            </View>

                            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={handleCreateVehicle}>
                                <Text style={[styles.primaryButtonText, { color: colors.textInverse }]}>Add Vehicle</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    ) : (
                        <FlatList
                            data={customerVehicles}
                            keyExtractor={(item) => item.id}
                            ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.textSecondary }]}>No vehicles found</Text>}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[styles.listItem, { borderBottomColor: colors.border }]}
                                    onPress={() => {
                                        setSelectedVehicle(item);
                                        setShowVehicleModal(false);
                                    }}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <BrandLogo brand={item.make} size={30} style={{ marginRight: 12 }} />
                                        <View>
                                            <Text style={[styles.listItemTitle, { color: colors.textPrimary }]}>{item.make} {item.model}</Text>
                                            <Text style={[styles.listItemSubtitle, { color: colors.textSecondary }]}>{item.licensePlate}</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            )}
                        />
                    )}
                </SafeAreaWrapper>
            </Modal>

            {/* Technician Modal - Multi-Select */}
            <Modal visible={showTechnicianModal} animationType="slide">
                <SafeAreaWrapper>
                    <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                        <TouchableOpacity onPress={() => setShowTechnicianModal(false)}>
                            <Ionicons name="close" size={24} color={colors.textPrimary} />
                        </TouchableOpacity>
                        <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Select Technicians ({selectedTechnicians.length})</Text>
                        <TouchableOpacity onPress={() => setShowTechnicianModal(false)}>
                            <Text style={[styles.saveText, { color: colors.primary }]}>Done</Text>
                        </TouchableOpacity>
                    </View>
                    <FlatList
                        data={technicians}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => {
                            const isSelected = selectedTechnicians.some(t => t.id === item.id);
                            return (
                                <TouchableOpacity
                                    style={[styles.listItem, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomColor: colors.border }]}
                                    onPress={() => {
                                        if (isSelected) {
                                            setSelectedTechnicians(selectedTechnicians.filter(t => t.id !== item.id));
                                        } else {
                                            setSelectedTechnicians([...selectedTechnicians, item]);
                                        }
                                    }}
                                >
                                    <View>
                                        <Text style={[styles.listItemTitle, { color: colors.textPrimary }]}>{item.name}</Text>
                                        <Text style={[styles.listItemSubtitle, { color: colors.textSecondary }]}>{item.email}</Text>
                                    </View>
                                    <Ionicons
                                        name={isSelected ? "checkbox" : "square-outline"}
                                        size={24}
                                        color={isSelected ? colors.textPrimary : colors.textTertiary}
                                    />
                                </TouchableOpacity>
                            );
                        }}
                    />
                </SafeAreaWrapper>
            </Modal>

            {/* Part Modal */}
            <Modal visible={showPartModal} animationType="slide">
                <SafeAreaWrapper>
                    <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                        <TouchableOpacity onPress={() => setShowPartModal(false)}>
                            <Ionicons name="close" size={24} color={colors.textPrimary} />
                        </TouchableOpacity>
                        <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Add Parts ({parts.length})</Text>
                        <View style={{ width: 40 }} />
                    </View>

                    <View style={{ flex: 1 }}>
                        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
                            {/* Show Added Parts */}
                            {parts.length > 0 && (
                                <View style={[styles.addedPartsSection, { borderBottomColor: colors.border }]}>
                                    <Text style={[styles.label, { color: colors.textSecondary }]}>Added Parts</Text>
                                    {parts.map((part, index) => (
                                        <View key={index} style={[styles.addedPartItem, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={[styles.addedPartName, { color: colors.textPrimary }]}>{part.partName}</Text>
                                                <Text style={[styles.addedPartMeta, { color: colors.textSecondary }]}>
                                                    Qty: {part.quantity} • ₦{part.unitPrice.toLocaleString()} each
                                                </Text>
                                            </View>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
                                                {part.partId === 'EXTERNAL' && (
                                                    <TouchableOpacity onPress={() => handleEditPart(index)}>
                                                        <Ionicons name="create-outline" size={22} color={colors.textPrimary} />
                                                    </TouchableOpacity>
                                                )}
                                                <TouchableOpacity onPress={() => handleRemovePart(index)}>
                                                    <Ionicons name="trash-outline" size={22} color={Colors.error} />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            )}

                            <View style={[styles.tabContainer, { backgroundColor: colors.background }]}>
                                <TouchableOpacity
                                    style={[styles.tab, partMode === 'inventory' && [styles.activeTab, { backgroundColor: colors.surface }]]}
                                    onPress={() => setPartMode('inventory')}
                                >
                                    <Text style={[styles.tabText, { color: colors.textSecondary }, partMode === 'inventory' && [styles.activeTabText, { color: colors.textPrimary }]]}>Inventory</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.tab, partMode === 'external' && [styles.activeTab, { backgroundColor: colors.surface }]]}
                                    onPress={() => setPartMode('external')}
                                >
                                    <Text style={[styles.tabText, { color: colors.textSecondary }, partMode === 'external' && [styles.activeTabText, { color: colors.textPrimary }]]}>External</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.modalForm}>
                                {partMode === 'inventory' ? (
                                    <>
                                        <Text style={[styles.label, { color: colors.textSecondary }]}>Select Items</Text>
                                        <Text style={[styles.helperText, { color: colors.textTertiary }]}>Tap to select multiple items</Text>
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
                                                            { borderBottomColor: colors.border },
                                                            isSelected && [styles.selectedItem, { backgroundColor: colors.surface, borderColor: colors.textPrimary }],
                                                            availableStock === 0 && styles.disabledItem
                                                        ]}
                                                        onPress={() => availableStock > 0 && toggleInventoryItem(item)}
                                                        disabled={availableStock === 0}
                                                    >
                                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <View style={{ flex: 1 }}>
                                                                <Text style={[styles.listItemTitle, { color: colors.textPrimary }]}>{item.name}</Text>
                                                                <Text style={[styles.listItemSubtitle, { color: colors.textSecondary }]}>
                                                                    Available: {availableStock} • ₦{item.sellingPrice || item.unitPrice}
                                                                </Text>
                                                            </View>
                                                            {isSelected ? (
                                                                <View style={[styles.stepperContainer, { backgroundColor: colors.background }]}>
                                                                    <TouchableOpacity
                                                                        style={[styles.stepperButton, { backgroundColor: colors.surface }]}
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
                                                                        <Ionicons name="remove" size={20} color={colors.textPrimary} />
                                                                    </TouchableOpacity>

                                                                    <Text style={[styles.stepperValue, { color: colors.textPrimary }]}>{qty}</Text>

                                                                    <TouchableOpacity
                                                                        style={[styles.stepperButton, { backgroundColor: colors.surface }]}
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
                                                                        <Ionicons name="add" size={20} color={colors.textPrimary} />
                                                                    </TouchableOpacity>
                                                                </View>
                                                            ) : (
                                                                <Ionicons name="ellipse-outline" size={24} color={colors.border} />
                                                            )}
                                                        </View>
                                                    </TouchableOpacity>
                                                );
                                            }}
                                        />
                                        <TouchableOpacity
                                            style={{
                                                backgroundColor: colors.surface,
                                                padding: 15,
                                                borderRadius: 12,
                                                alignItems: 'center',
                                                marginTop: 10,
                                            }}
                                            onPress={addInventorySelectionToList}
                                        >
                                            <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 16 }}>+ Add Selection to List</Text>
                                        </TouchableOpacity>
                                    </>
                                ) : (
                                    <>
                                        <TextInput
                                            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                                            placeholder="Part Name"
                                            placeholderTextColor={colors.textTertiary}
                                            value={externalPart.name}
                                            onChangeText={(t) => setExternalPart({ ...externalPart, name: t })}
                                        />

                                        <View style={{ marginBottom: 15 }}>
                                            <Text style={[styles.label, { color: colors.textSecondary }]}>Quantity</Text>
                                            <View style={[styles.stepperContainer, { justifyContent: 'space-between', padding: 10, backgroundColor: colors.surface }]}>
                                                <TouchableOpacity
                                                    style={[styles.stepperButton, { backgroundColor: colors.surface }]}
                                                    onPress={() => {
                                                        const currentQty = parseInt(externalPart.quantity) || 1;
                                                        if (currentQty > 1) {
                                                            setExternalPart({ ...externalPart, quantity: (currentQty - 1).toString() });
                                                        }
                                                    }}
                                                >
                                                    <Ionicons name="remove" size={24} color={colors.textPrimary} />
                                                </TouchableOpacity>

                                                <Text style={[styles.stepperValue, { fontSize: 18, color: colors.textPrimary }]}>{externalPart.quantity}</Text>

                                                <TouchableOpacity
                                                    style={[styles.stepperButton, { backgroundColor: colors.surface }]}
                                                    onPress={() => {
                                                        const currentQty = parseInt(externalPart.quantity) || 1;
                                                        setExternalPart({ ...externalPart, quantity: (currentQty + 1).toString() });
                                                    }}
                                                >
                                                    <Ionicons name="add" size={24} color={colors.textPrimary} />
                                                </TouchableOpacity>
                                            </View>
                                        </View>

                                        <TextInput
                                            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                                            placeholder="Unit Cost"
                                            placeholderTextColor={colors.textTertiary}
                                            value={externalPart.cost}
                                            onChangeText={(t) => setExternalPart({ ...externalPart, cost: t })}
                                            keyboardType="numeric"
                                        />
                                        <TextInput
                                            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                                            placeholder="Supplier (Optional)"
                                            placeholderTextColor={colors.textTertiary}
                                            value={externalPart.supplier}
                                            onChangeText={(t) => setExternalPart({ ...externalPart, supplier: t })}
                                        />
                                        <TouchableOpacity
                                            style={{
                                                backgroundColor: colors.surface,
                                                padding: 15,
                                                borderRadius: 12,
                                                alignItems: 'center',
                                                marginTop: 20,
                                                marginBottom: 20
                                            }}
                                            onPress={addExternalPartToList}
                                        >
                                            <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 16 }}>+ Add to List</Text>
                                        </TouchableOpacity>
                                    </>
                                )}
                            </View>
                        </ScrollView >

                        {/* Global Add Button */}
                        < View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]} >
                            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={handleAddPart}>
                                <Text style={[styles.primaryButtonText, { color: colors.textInverse }]}>
                                    Done
                                </Text>
                            </TouchableOpacity>
                        </View >
                    </View >
                </SafeAreaWrapper >
            </Modal >

            {/* Success Modal */}
            < Modal
                visible={showSuccessModal}
                transparent={true}
                animationType="fade"
                statusBarTranslucent={true}
            >
                <View style={styles.successModalOverlay}>
                    <View style={[styles.successModalContent, { backgroundColor: colors.surface }]}>
                        <View style={[styles.successIconContainer, { backgroundColor: '#30D158' }]}>
                            <Ionicons name="checkmark" size={40} color="#fff" />
                        </View>
                        <Text style={[styles.successTitle, { color: colors.textPrimary }]}>Job Created!</Text>
                        <Text style={[styles.successMessage, { color: colors.textSecondary }]}>
                            The job has been successfully created for {selectedCustomer?.name}
                        </Text>
                        <TouchableOpacity
                            style={[styles.successButton, { backgroundColor: '#30D158' }]}
                            onPress={() => {
                                setShowSuccessModal(false);
                                router.back();
                            }}
                        >
                            <Text style={styles.successButtonText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal >
        </KeyboardAvoidingView >
    );
}

function SafeAreaWrapper({ children }: { children: React.ReactNode }) {
    const colors = useColors();
    return (
        <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'ios' ? 50 : 20 }}>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
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
        color: '#000',
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
    fieldLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000',
        marginBottom: 4,
    },
    fieldDescription: {
        fontSize: 13,
        color: '#444', // Darker for better visibility
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
    issueChipsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    issueChip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#f5f5f5',
        borderWidth: 1,
        borderColor: '#e5e5e5',
        marginBottom: 8,
    },
    issueChipActive: {
        backgroundColor: '#f0f0f0',
        borderColor: '#000',
    },
    issueChipText: {
        fontSize: 14,
        color: '#555',
    },
    issueChipTextActive: {
        color: '#000',
        fontWeight: '600',
    },
    issueHint: {
        marginTop: 6,
        fontSize: 12,
        color: '#777',
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
        fontSize: 12,
        color: '#666',
        marginTop: 2,
    },
    brandItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    brandLogoSmall: {
        width: 28,
        height: 28,
        marginRight: 12,
    },
    brandName: {
        fontSize: 16,
        color: '#000',
    },
    listBrandLogo: {
        width: 40,
        height: 40,
        marginRight: 10,
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
        color: '#000',
    },
    addText: {
        fontSize: 16,
        color: '#000',
        fontWeight: '600',
    },
    modalForm: {
        padding: 20,
    },
    input: {
        backgroundColor: '#f9f9f9',
        padding: 15,
        borderRadius: 12,
        marginBottom: 15,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#eee',
        color: '#000',
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
        backgroundColor: '#fff',
        borderColor: '#000',
        borderWidth: 1,
        marginBottom: 8,
        marginTop: 8,
        borderRadius: 8,
    },
    primaryButton: {
        backgroundColor: '#000',
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
