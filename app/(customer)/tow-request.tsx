import React, { useState, useEffect, useRef } from 'react';
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
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/design';
import { Vehicle } from '@/types';

// Workshop Location (Provided by User)
const WORKSHOP_LOCATION = {
    latitude: 8.980638458852763,
    longitude: 7.46247898968199,
    address: "Abuja Workshop",
};

const PRICE_PER_KM = 50;
const { width } = Dimensions.get('window');

export default function TowRequestScreen() {
    const router = useRouter();
    const { user } = useAuthStore();
    const mapRef = useRef<MapView>(null);

    const [loading, setLoading] = useState(true);
    const [locating, setLocating] = useState(false);
    const [location, setLocation] = useState<{ latitude: number, longitude: number } | null>(null);
    const [address, setAddress] = useState<string | null>(null);
    const [distance, setDistance] = useState<number>(0);
    const [price, setPrice] = useState<number>(0);

    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [selectedVehicle, setSelectedVehicle] = useState<string>('');

    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [processing, setProcessing] = useState(false);

    // Map State
    const [region, setRegion] = useState<Region | null>(null);
    const [isMapReady, setIsMapReady] = useState(false);

    useEffect(() => {
        loadVehicles();
    }, [user]);

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
        setPrice(Math.max(2000, Math.ceil(dist * PRICE_PER_KM)));
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

            // 1. Create Job
            const jobId = await firebaseService.createJob({
                userId: user.id,
                vehicleId: selectedVehicle,
                workshopId: user.workshopId || 'default_workshop',
                type: 'tow',
                description: `Tow Request for ${vehicleName}. \nPickup: ${address || 'Coordinates provided'}. \nLat: ${location.latitude}, Long: ${location.longitude}. \nDistance: ${distance.toFixed(2)}km`,
                status: 'received',
                issues: ['Tow Request'],
                serviceCharge: price,
            });

            // 2. Create Invoice
            await firebaseService.createInvoice({
                jobId,
                userId: user.id,
                workshopId: user.workshopId || 'default_workshop',
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
                status: 'draft',
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
                    <Ionicons name="arrow-back" size={24} color="#000" />
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
                                {selectedVehicle === v.id && <Ionicons name="checkmark-circle" size={20} color="#000" />}
                            </TouchableOpacity>
                        ))
                    ) : (
                        <Text style={styles.noVehicleText}>No vehicles found. Please add a vehicle first.</Text>
                    )}
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
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <>
                                        <Ionicons name="navigate" size={20} color="#fff" />
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
                                    <Ionicons name="location" size={36} color="#000" />
                                </View>
                            </View>

                            <View style={{ padding: 20 }}>
                                <Text style={styles.dragMapText}>Drag map to adjust location</Text>

                                <View style={styles.addressContainer}>
                                    <View style={styles.addressIcon}>
                                        <Ionicons name="location" size={24} color="#000" />
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
                <View style={{ height: 100 }} />
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
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
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
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        zIndex: 10,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    content: {
        flex: 1,
        padding: 20,
    },
    card: {
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#eee',
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 15,
        color: '#333',
    },
    locationHelpText: {
        color: '#666',
        marginBottom: 15,
        textAlign: 'center',
    },
    detectButton: {
        backgroundColor: '#000',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 25,
        gap: 8,
    },
    detectButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
    mapContainer: {
        height: 250,
        width: '100%',
        marginBottom: 10,
        position: 'relative',
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
        color: '#888',
        fontSize: 12,
        marginBottom: 10,
        fontStyle: 'italic',
    },
    addressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f9f9f9',
        padding: 15,
        borderRadius: 12,
    },
    addressIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#eee',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    addressDetails: {
        flex: 1,
    },
    addressLabel: {
        fontSize: 12,
        color: '#888',
        marginBottom: 4,
    },
    addressText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#000',
    },
    errorText: {
        color: Colors.error || 'red',
        marginTop: 10,
    },
    distanceBadge: {
        marginTop: 15,
        backgroundColor: '#eee',
        padding: 10,
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    distanceText: {
        fontSize: 14,
        color: '#333',
        fontWeight: '500',
    },
    vehicleOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        borderWidth: 1,
        borderColor: '#eee',
        borderRadius: 12,
        marginBottom: 10,
    },
    vehicleSelected: {
        backgroundColor: '#eee',
    },
    vehicleText: {
        fontSize: 15,
        color: '#000',
    },
    vehicleTextSelected: {
        fontWeight: '600',
        color: '#000',
    },
    noVehicleText: {
        color: '#999',
        fontStyle: 'italic',
    },
    quoteCard: {
        backgroundColor: '#000',
        padding: 20,
        borderRadius: 16,
        alignItems: 'center',
    },
    quoteLabel: {
        color: '#fff',
        fontSize: 14,
        opacity: 0.8,
        marginBottom: 5,
    },
    quotePrice: {
        color: '#fff',
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    quoteNote: {
        color: '#fff',
        fontSize: 12,
        opacity: 0.6,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 20,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#eee',
        paddingBottom: 40,
    },
    bookButton: {
        backgroundColor: '#000',
        padding: 16,
        borderRadius: 30,
        alignItems: 'center',
    },
    disabledButton: {
        backgroundColor: '#ccc',
    },
    bookButtonText: {
        color: '#fff',
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
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 25,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 20,
    },
    paymentDetails: {
        backgroundColor: '#f9f9f9',
        padding: 20,
        borderRadius: 12,
        marginBottom: 20,
    },
    paymentLabel: {
        fontSize: 14,
        color: '#666',
    },
    paymentValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000',
    },
    paymentValueHighlight: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#000',
        marginTop: 4,
    },
    paymentValuePrice: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#000',
        marginTop: 4,
    },
    divider: {
        height: 1,
        backgroundColor: '#ddd',
        marginVertical: 15,
    },
    modalNote: {
        fontSize: 14,
        color: '#666',
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
        borderColor: '#ddd',
        alignItems: 'center',
    },
    cancelButtonText: {
        color: '#000',
        fontWeight: '600',
    },
    confirmButton: {
        flex: 1,
        backgroundColor: '#000',
        padding: 15,
        borderRadius: 12,
        alignItems: 'center',
    },
    confirmButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
});
