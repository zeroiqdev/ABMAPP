import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Modal,
    ScrollView,
    Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import MapView, { Marker, Region, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';
import { Workshop } from '@/types';
import { WorkshopSelectorModal } from '@/components/WorkshopSelectorModal';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Colors, Spacing, Typography, BorderRadius, useColors } from '@/constants/design';
import { Vehicle } from '@/types';

// Workshop Location (Provided by User)
const WORKSHOP_LOCATION = {
    latitude: 8.980638458852763,
    longitude: 7.46247898968199,
    address: "Abuja Workshop",
};

const PRICE_PER_KM = 500;
const { width } = Dimensions.get('window');

export default function TowRequestScreen() {
    const router = useRouter();
    const { user } = useAuthStore();
    const colors = useColors();
    const styles = useMemo(() => getStyles(colors), [colors]);
    const mapRef = useRef<MapView>(null);

    const [loading, setLoading] = useState(true);
    const [locating, setLocating] = useState(false);
    const [location, setLocation] = useState<{ latitude: number, longitude: number } | null>(null);
    const [address, setAddress] = useState<string | null>(null);
    const [distance, setDistance] = useState<number>(0);
    const [price, setPrice] = useState<number>(0);

    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [selectedVehicle, setSelectedVehicle] = useState<string>('');

    // Workshop selection state
    const [selectedWorkshopId, setSelectedWorkshopId] = useState<string>('');
    const [availableWorkshops, setAvailableWorkshops] = useState<Workshop[]>([]);
    const [showWorkshopSelector, setShowWorkshopSelector] = useState(false);

    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [processing, setProcessing] = useState(false);

    // Map State
    const [region, setRegion] = useState<Region | null>(null);
    const [isMapReady, setIsMapReady] = useState(false);

    useEffect(() => {
        loadVehicles();
        loadWorkshops();
    }, [user?.id]);

    useEffect(() => {
        if (location) {
            updatePriceAndDistance(location.latitude, location.longitude);
        }
    }, [location]);

    const loadVehicles = async () => {
        if (user) {
            try {
                const userVehicles = await firebaseService.getVehicles(user.id);
                setVehicles(userVehicles);
                if (userVehicles.length > 0) {
                    setSelectedVehicle(userVehicles[0].id);
                }
            } catch (error) {
                console.error("Error loading vehicles", error);
            } finally {
                setLoading(false);
            }
        } else {
            setLoading(false);
        }
    };

    const loadWorkshops = async () => {
        if (!user) return;
        const ids = new Set([
            ...(user.selectedWorkshopIds || []),
            ...(user.addedByWorkshopIds || []),
            ...(user.connectedWorkshopIds || []),
            ...(user.workshopId ? [user.workshopId] : [])
        ]);

        const workshops: Workshop[] = [];
        for (const id of Array.from(ids)) {
            if (!id) continue;
            const w = await firebaseService.getWorkshop(id);
            if (w) workshops.push(w);
        }
        setAvailableWorkshops(workshops);
        if (workshops.length > 0 && !selectedWorkshopId) {
            setSelectedWorkshopId(workshops[0].id);
        }
    };

    const handleAddNewWorkshops = async (newIds: string[]) => {
        if (!user?.id) return;
        try {
            setLoading(true);
            await updateDoc(doc(db, 'users', user.id), {
                selectedWorkshopIds: arrayUnion(...newIds)
            });
            await loadWorkshops();
            if (newIds.length > 0) setSelectedWorkshopId(newIds[newIds.length - 1]);
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to add workshops');
        } finally {
            setLoading(false);
        }
    };

    const detectLocation = async () => {
        setLocating(true);
        setErrorMsg(null);
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setErrorMsg('Permission to access location was denied');
                setLocating(false);
                return;
            }

            let loc = await Location.getCurrentPositionAsync({});
            const coords = {
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
            };

            setLocation(coords);

            setRegion({
                ...coords,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
            });

            // Initial reverse geocode
            await reverseGeocode(coords.latitude, coords.longitude);

        } catch (err) {
            setErrorMsg('Failed to detect location');
        } finally {
            setLocating(false);
        }
    };

    const reverseGeocode = async (latitude: number, longitude: number) => {
        try {
            const reverseGeocode = await Location.reverseGeocodeAsync({
                latitude,
                longitude
            });

            if (reverseGeocode.length > 0) {
                const addr = reverseGeocode[0];
                const formattedAddress = [
                    addr.streetNumber,
                    addr.street,
                    addr.district,
                    addr.city,
                    addr.region
                ].filter(Boolean).join(', ');
                setAddress(formattedAddress || "Unknown Address");
            } else {
                setAddress("Address not found");
            }
        } catch (e) {
            console.log("Geocode error", e);
            setAddress("Locating...");
        }
    };

    const onRegionChangeComplete = (newRegion: Region) => {
        setRegion(newRegion);
        // Update location state to center of map
        setLocation({
            latitude: newRegion.latitude,
            longitude: newRegion.longitude
        });
        // Trigger reverse geocode for new center
        reverseGeocode(newRegion.latitude, newRegion.longitude);
    };

    const updatePriceAndDistance = (lat: number, lon: number) => {
        const dist = calculateDistance(
            lat,
            lon,
            WORKSHOP_LOCATION.latitude,
            WORKSHOP_LOCATION.longitude
        );
        setDistance(dist);
        setPrice(Math.ceil(dist * PRICE_PER_KM));
    };

    function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
        const R = 6371; // Radius of the earth in km
        const dLat = deg2rad(lat2 - lat1);
        const dLon = deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const d = R * c; // Distance in km
        return d;
    }

    function deg2rad(deg: number) {
        return deg * (Math.PI / 180);
    }

    const handleBookTow = async () => {
        if (!selectedVehicle) {
            Alert.alert('Error', 'Please select a vehicle');
            return;
        }
        if (!selectedWorkshopId) {
            Alert.alert('Error', 'Please select a workshop');
            return;
        }
        if (!location) {
            Alert.alert('Error', 'Please detect your location first');
            return;
        }
        setShowPaymentModal(true);
    };

    const confirmBooking = async () => {
        if (!user || !selectedVehicle || !location) return;
        setProcessing(true);

        try {
            const vehicle = vehicles.find(v => v.id === selectedVehicle);
            const vehicleName = vehicle ? `${vehicle.make} ${vehicle.model}` : 'Unknown Vehicle';

            const jobId = await firebaseService.createJob({
                userId: user.id,
                vehicleId: selectedVehicle,
                workshopId: selectedWorkshopId || user.workshopId || 'default_workshop',
                type: 'tow',
                description: `Tow Request for ${vehicleName}. \nPickup: ${address || 'Coordinates provided'}. \nLat: ${location.latitude}, Long: ${location.longitude}. \nDistance: ${distance.toFixed(2)}km`,
                status: 'received',
                issues: ['Tow Request'],
                serviceCharge: price,
            });

            const invoiceId = await firebaseService.createInvoice({
                jobId,
                userId: user.id,
                workshopId: selectedWorkshopId || user.workshopId || 'default_workshop',
                items: [{
                    description: `Tow Service from ${address ? address.substring(0, 20) + '...' : 'Location'}`,
                    quantity: 1,
                    unitPrice: price,
                    total: price
                }],
                subtotal: price,
                vat: 0,
                discount: 0,
                total: price,
                paymentStatus: 'pending',
                status: 'draft', // User requested to revert to manual approval
                dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            });

            // 3. Success
            setShowPaymentModal(false);
            Alert.alert(
                'Tow Requested',
                'Your tow request has been received. A driver will be assigned shortly.',
                [{ text: 'View Job', onPress: () => router.replace(`/(customer)/job-details?id=${jobId}`) }]
            );
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to request tow');
        } finally {
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Request Tow</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.content}>

                {/* Vehicle Selection - Form First */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Select Vehicle</Text>
                    {vehicles.length > 0 ? (
                        vehicles.map(v => (
                            <TouchableOpacity
                                key={v.id}
                                style={[styles.vehicleOption, selectedVehicle === v.id && styles.vehicleSelected]}
                                onPress={() => setSelectedVehicle(v.id)}
                            >
                                <Text style={[styles.vehicleText, selectedVehicle === v.id && styles.vehicleTextSelected]}>
                                    {v.make} {v.model} ({v.licensePlate})
                                </Text>
                                {selectedVehicle === v.id && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                            </TouchableOpacity>
                        ))
                    ) : (
                        <Text style={styles.noVehicleText}>No vehicles found. Please add a vehicle first.</Text>
                    )}
                </View>

                {/* Workshop Selection */}
                <View style={[styles.card, { padding: 15 }]}>
                    <Text style={styles.cardTitle}>Destination Workshop</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 20 }}>
                        {availableWorkshops.map(workshop => (
                            <TouchableOpacity
                                key={workshop.id}
                                style={[
                                    styles.vehicleOption,
                                    selectedWorkshopId === workshop.id && styles.vehicleSelected,
                                    { margin: 0, paddingVertical: 10, paddingHorizontal: 15, width: 150, height: 80, justifyContent: 'center', borderColor: selectedWorkshopId === workshop.id ? colors.textPrimary : colors.border, borderWidth: selectedWorkshopId === workshop.id ? 2 : 1 }
                                ]}
                                onPress={() => setSelectedWorkshopId(workshop.id)}
                            >
                                <Text style={[
                                    styles.vehicleText,
                                    selectedWorkshopId === workshop.id && styles.vehicleTextSelected,
                                    { textAlign: 'center' }
                                ]}>
                                    {workshop.name}
                                </Text>
                                {workshop.address && (
                                    <Text numberOfLines={1} style={{ fontSize: 10, color: colors.textSecondary, marginTop: 4, textAlign: 'center' }}>
                                        {workshop.address}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                            style={[
                                styles.vehicleOption,
                                { margin: 0, paddingVertical: 10, paddingHorizontal: 15, width: 100, height: 80, justifyContent: 'center', borderStyle: 'dashed', borderColor: colors.textPrimary }
                            ]}
                            onPress={() => setShowWorkshopSelector(true)}
                        >
                            <View style={{ alignItems: 'center', gap: 4 }}>
                                <Ionicons name="add" size={24} color={colors.textPrimary} />
                                <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 12 }}>Add</Text>
                            </View>
                        </TouchableOpacity>
                    </ScrollView>
                </View>

                {/* Location Info & Map */}
                <View style={[styles.card, { padding: 0, overflow: 'hidden' }]}>
                    <View style={{ padding: 20, paddingBottom: 10 }}>
                        <Text style={styles.cardTitle}>Pickup Location</Text>
                    </View>

                    {!region ? (
                        <View style={{ padding: 20, paddingTop: 0, alignItems: 'center' }}>
                            <Text style={styles.locationHelpText}>
                                We need your location to calculate the tow price.
                            </Text>
                            <TouchableOpacity
                                style={styles.detectButton}
                                onPress={detectLocation}
                                disabled={locating}
                            >
                                {locating ? (
                                    <ActivityIndicator color={colors.textInverse} size="small" />
                                ) : (
                                    <>
                                        <Ionicons name="navigate" size={20} color={colors.textInverse} />
                                        <Text style={styles.detectButtonText}>Detect My Location</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                            {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
                        </View>
                    ) : (
                        <View>
                            {/* Map View */}
                            <View style={styles.mapContainer}>
                                <MapView
                                    ref={mapRef}
                                    style={styles.map}
                                    provider={PROVIDER_GOOGLE}
                                    initialRegion={region}
                                    onRegionChangeComplete={onRegionChangeComplete}
                                    showsUserLocation
                                    showsMyLocationButton
                                />
                                {/* Fixed Center Marker */}
                                <View style={styles.centerMarkerContainer} pointerEvents="none">
                                    <Ionicons name="location" size={36} color={colors.primary} />
                                </View>
                            </View>

                            <View style={{ padding: 20 }}>
                                <Text style={styles.dragMapText}>Drag map to adjust location</Text>

                                <View style={styles.addressContainer}>
                                    <View style={styles.addressIcon}>
                                        <Ionicons name="location" size={24} color={colors.textPrimary} />
                                    </View>
                                    <View style={styles.addressDetails}>
                                        <Text style={styles.addressLabel}>Selected Address</Text>
                                        <Text style={styles.addressText}>{address || "Loading address..."}</Text>
                                    </View>
                                </View>

                                <View style={styles.distanceBadge}>
                                    <Text style={styles.distanceText}>
                                        Distance: {distance.toFixed(2)} km
                                    </Text>
                                </View>
                            </View>
                        </View>
                    )}
                </View>

                {/* Price Quote */}
                {region && (
                    <View style={styles.quoteCard}>
                        <Text style={styles.quoteLabel}>Estimated Price</Text>
                        <Text style={styles.quotePrice}>₦{price.toLocaleString()}</Text>
                    </View>
                )}

                {/* Spacer for bottom button */}
                <View style={{ height: 150 }} />
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.bookButton, (!selectedVehicle || !location) && styles.disabledButton]}
                    onPress={handleBookTow}
                    disabled={!selectedVehicle || !location}
                >
                    <Text style={styles.bookButtonText}>Book Tow Truck</Text>
                </TouchableOpacity>
            </View>

            {/* Payment Modal */}
            <Modal visible={showPaymentModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Confirm Booking</Text>

                        <View style={styles.paymentDetails}>
                            <Text style={styles.paymentLabel}>Account Name:</Text>
                            <Text style={styles.paymentValue}>ABM Workshop Ltd</Text>

                            <Text style={[styles.paymentLabel, { marginTop: 10 }]}>Bank:</Text>
                            <Text style={styles.paymentValue}>Zenith Bank</Text>

                            <Text style={[styles.paymentLabel, { marginTop: 10 }]}>Account Number:</Text>
                            <Text style={styles.paymentValueHighlight}>1234567890</Text>

                            <View style={styles.divider} />

                            <Text style={[styles.paymentLabel, { marginTop: 10 }]}>Amount to Pay:</Text>
                            <Text style={styles.paymentValuePrice}>₦{price.toLocaleString()}</Text>
                        </View>

                        <Text style={styles.modalNote}>
                            A job invoice will be created for you. You can pay now or after the service.
                        </Text>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => setShowPaymentModal(false)}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.confirmButton}
                                onPress={confirmBooking}
                                disabled={processing}
                            >
                                {processing ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.confirmButtonText}>Book</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>


            <WorkshopSelectorModal
                visible={showWorkshopSelector}
                onClose={() => setShowWorkshopSelector(false)}
                onSelect={handleAddNewWorkshops}
                excludeIds={availableWorkshops.map(w => w.id)}
                title="Add Workshop"
            />
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
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingTop: 60,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        zIndex: 10,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.textPrimary,
    },
    content: {
        flex: 1,
        padding: 20,
        backgroundColor: colors.background,
    },
    card: {
        backgroundColor: colors.surface,
        padding: 20,
        borderRadius: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: colors.border,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 15,
        color: colors.textPrimary,
    },
    locationHelpText: {
        color: colors.textSecondary,
        marginBottom: 15,
        textAlign: 'center',
    },
    detectButton: {
        backgroundColor: colors.textPrimary,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 25,
        gap: 8,
    },
    detectButtonText: {
        color: colors.textInverse,
        fontWeight: '600',
    },
    mapContainer: {
        height: 250,
        width: '100%',
        marginBottom: 10,
        position: 'relative',
        borderRadius: 12,
        overflow: 'hidden',
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },
    centerMarkerContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: -18, // Half height of marker icon to center it precisely at tip
    },
    dragMapText: {
        textAlign: 'center',
        color: colors.textTertiary,
        fontSize: 12,
        marginBottom: 10,
        fontStyle: 'italic',
    },
    addressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background,
        padding: 15,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    addressIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    addressDetails: {
        flex: 1,
    },
    addressLabel: {
        fontSize: 12,
        color: colors.textTertiary,
        marginBottom: 4,
    },
    addressText: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    errorText: {
        color: Colors.error || 'red',
        marginTop: 10,
    },
    distanceBadge: {
        marginTop: 15,
        backgroundColor: colors.background,
        padding: 10,
        borderRadius: 8,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: colors.border,
    },
    distanceText: {
        fontSize: 14,
        color: colors.textSecondary,
        fontWeight: '500',
    },
    vehicleOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        marginBottom: 10,
        backgroundColor: colors.background,
    },
    vehicleSelected: {
        backgroundColor: colors.surface,
        borderColor: colors.textPrimary,
        borderWidth: 2,
    },
    vehicleText: {
        fontSize: 15,
        color: colors.textPrimary,
    },
    vehicleTextSelected: {
        fontWeight: '600',
        color: colors.textPrimary,
    },
    noVehicleText: {
        color: colors.textTertiary,
        fontStyle: 'italic',
    },
    quoteCard: {
        backgroundColor: colors.surface, // Use surface instead of black
        padding: 20,
        borderRadius: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    quoteLabel: {
        color: colors.textSecondary,
        fontSize: 14,
        opacity: 0.8,
        marginBottom: 5,
    },
    quotePrice: {
        color: colors.primary, // Use primary color for price
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    quoteNote: {
        color: colors.textSecondary,
        fontSize: 12,
        opacity: 0.6,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 20,
        backgroundColor: colors.surface, // Changed from #fff
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingBottom: 40,
    },
    bookButton: {
        backgroundColor: colors.primary, // Changed from #000
        padding: 16,
        borderRadius: 30,
        alignItems: 'center',
    },
    disabledButton: {
        backgroundColor: colors.border, // Changed from #ccc
        opacity: 0.5,
    },
    bookButtonText: {
        color: colors.textInverse, // Changed from #fff
        fontSize: 16,
        fontWeight: 'bold',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: colors.surface,
        borderRadius: 20,
        padding: 25,
        borderWidth: 1,
        borderColor: colors.border,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 20,
        color: colors.textPrimary,
    },
    paymentDetails: {
        backgroundColor: colors.background,
        padding: 20,
        borderRadius: 12,
        marginBottom: 20,
    },
    paymentLabel: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    paymentValue: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    paymentValueHighlight: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.textPrimary,
        marginTop: 4,
    },
    paymentValuePrice: {
        fontSize: 28,
        fontWeight: 'bold',
        color: colors.primary,
        marginTop: 4,
    },
    divider: {
        height: 1,
        backgroundColor: colors.border,
        marginVertical: 15,
    },
    modalNote: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: 25,
        textAlign: 'center',
    },
    modalActions: {
        flexDirection: 'row',
        gap: 15,
    },
    cancelButton: {
        flex: 1,
        padding: 15,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
    },
    cancelButtonText: {
        color: colors.textPrimary,
        fontWeight: '600',
    },
    confirmButton: {
        flex: 1,
        backgroundColor: colors.primary,
        padding: 15,
        borderRadius: 12,
        alignItems: 'center',
    },
    confirmButtonText: {
        color: colors.textInverse,
        fontWeight: '600',
    },
});
