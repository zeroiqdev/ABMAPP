import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Alert,
    Image,
    ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';

export default function VendorRegistrationScreen() {
    const router = useRouter();
    const { user, setUser } = useAuthStore();
    const [loading, setLoading] = useState(false);

    // Business Details - Initialize from existing data if available
    const [businessName, setBusinessName] = useState(user?.businessDetails?.businessName || '');
    const [rcNumber, setRcNumber] = useState(user?.businessDetails?.rcNumber || '');
    const [address, setAddress] = useState(user?.businessDetails?.address || '');
    const [city, setCity] = useState(user?.businessDetails?.city || '');
    const [state, setState] = useState(user?.businessDetails?.state || '');
    const [country, setCountry] = useState(user?.businessDetails?.country || 'Nigeria');

    // Contact Details
    const [fullName, setFullName] = useState(user?.businessDetails?.contactName || user?.name || '');
    const [role, setRole] = useState(user?.businessDetails?.contactRole || '');
    const [nin, setNin] = useState(user?.businessDetails?.nin || '');

    // Bank Details
    const [bankName, setBankName] = useState(user?.businessDetails?.bankName || '');
    const [accountNumber, setAccountNumber] = useState(user?.businessDetails?.accountNumber || '');
    const [accountName, setAccountName] = useState(user?.businessDetails?.accountName || '');

    // Documents
    const [ninImage, setNinImage] = useState<string | null>(user?.documents?.ninImage || null);
    const [certificateImage, setCertificateImage] = useState<string | null>(user?.documents?.certificateOfIncorporation || null);
    const [proofAddressImage, setProofAddressImage] = useState<string | null>(user?.documents?.proofOfAddress || null);

    useEffect(() => {
        if (user?.vendorStatus === 'rejected') {
            Alert.alert(
                'Action Required',
                `Your previous application was declined.\n\nReason: ${user.rejectionReason || 'Details need verification.'}\n\nPlease update your information and resubmit.`
            );
        }
    }, [user]);

    const pickImage = async (setImage: (uri: string) => void) => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.7,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    };

    const handleSubmit = async () => {
        if (!businessName || !rcNumber || !address || !fullName || !nin || !bankName || !accountNumber) {
            Alert.alert('Missing Information', 'Please fill in all required fields.');
            return;
        }

        if (!ninImage) {
            Alert.alert('Missing Document', 'Please upload your NIN image.');
            return;
        }

        setLoading(true);
        try {
            const uploadPromises = [];
            const docUrls: any = { ...user?.documents }; // Start with existing docs

            // Only upload if changed (uri isn't http) - simplistic check, assume local URIs don't start with http
            // Or just re-upload. optimizing: check if string starts with http
            const isRemote = (uri: string) => uri.startsWith('http');

            if (ninImage && !isRemote(ninImage)) {
                uploadPromises.push(
                    firebaseService.uploadFile(ninImage, `vendors/${user!.id}/nin.jpg`)
                        .then(url => docUrls.ninImage = url)
                );
            }
            if (certificateImage && !isRemote(certificateImage)) {
                uploadPromises.push(
                    firebaseService.uploadFile(certificateImage, `vendors/${user!.id}/certificate.jpg`)
                        .then(url => docUrls.certificateOfIncorporation = url)
                );
            }
            if (proofAddressImage && !isRemote(proofAddressImage)) {
                uploadPromises.push(
                    firebaseService.uploadFile(proofAddressImage, `vendors/${user!.id}/proof_address.jpg`)
                        .then(url => docUrls.proofOfAddress = url)
                );
            }

            await Promise.all(uploadPromises);

            const businessDetails = {
                businessName,
                rcNumber,
                address,
                city,
                state,
                country,
                bankName,
                accountNumber,
                accountName,
                nin,
                contactName: fullName,
                contactRole: role,
            };

            await firebaseService.submitVendorDetails(user!.id, businessDetails, docUrls);

            // Update local state to prevent layout redirect loop
            setUser({
                ...user!,
                vendorStatus: 'pending_approval',
                businessDetails: { ...user?.businessDetails, ...businessDetails },
                documents: docUrls
            });

            Alert.alert(
                'Success',
                'Your application has been submitted and is pending approval.',
                [
                    { text: 'OK', onPress: () => router.replace('/(marketplace)/pending-approval') }
                ]
            );

        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to submit registration.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Vendor Registration</Text>
                {/* No back button if forced flow, or maybe logout needed */}
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {user?.vendorStatus === 'rejected' && (
                    <View style={styles.alertBox}>
                        <Ionicons name="alert-circle" size={24} color="#ef4444" />
                        <Text style={styles.alertText}>
                            Application Declined: {user.rejectionReason}
                        </Text>
                    </View>
                )}

                <Text style={styles.subtitle}>
                    Please provide your business and personal details to start selling.
                </Text>

                {/* Section 1: Business Info */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Business Information</Text>

                    <TextInput
                        style={styles.input}
                        placeholder="Business Name"
                        value={businessName}
                        onChangeText={setBusinessName}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="RC Number"
                        value={rcNumber}
                        onChangeText={setRcNumber}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Certificate of Incorporation (Optional)"
                        editable={false} selectTextOnFocus={false}
                        value={certificateImage ? "Image Selected" : ""}
                    />
                    <TouchableOpacity style={styles.uploadBtn} onPress={() => pickImage(setCertificateImage)}>
                        <Ionicons name="cloud-upload-outline" size={20} color="#000" />
                        <Text style={styles.uploadBtnText}>{certificateImage ? 'Change Certificate Image' : 'Upload Certificate'}</Text>
                    </TouchableOpacity>

                    <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Business Address"
                        value={address}
                        onChangeText={setAddress}
                        multiline
                    />
                    <View style={styles.row}>
                        <TextInput
                            style={[styles.input, styles.halfInput]}
                            placeholder="City"
                            value={city}
                            onChangeText={setCity}
                        />
                        <TextInput
                            style={[styles.input, styles.halfInput]}
                            placeholder="State"
                            value={state}
                            onChangeText={setState}
                        />
                    </View>
                    <TextInput
                        style={styles.input}
                        placeholder="Country"
                        value={country}
                        onChangeText={setCountry}
                    />
                    <TouchableOpacity style={styles.uploadBtn} onPress={() => pickImage(setProofAddressImage)}>
                        <Ionicons name="cloud-upload-outline" size={20} color="#000" />
                        <Text style={styles.uploadBtnText}>{proofAddressImage ? 'Change Proof of Address' : 'Upload Proof of Address'}</Text>
                    </TouchableOpacity>

                </View>

                {/* Section 2: Contact Info */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Primary Contact</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Full Name"
                        value={fullName}
                        onChangeText={setFullName}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Role (e.g. Manager, Owner)"
                        value={role}
                        onChangeText={setRole}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="NIN (National Identity Number)"
                        value={nin}
                        onChangeText={setNin}
                        keyboardType="numeric"
                    />
                    <TouchableOpacity style={styles.uploadBtn} onPress={() => pickImage(setNinImage)}>
                        <Ionicons name="cloud-upload-outline" size={20} color="#000" />
                        <Text style={styles.uploadBtnText}>{ninImage ? 'Change NIN Image' : 'Upload NIN Image (Required)'}</Text>
                    </TouchableOpacity>
                </View>

                {/* Section 3: Bank Details */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Bank Account</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Bank Name"
                        value={bankName}
                        onChangeText={setBankName}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Account Number"
                        value={accountNumber}
                        onChangeText={setAccountNumber}
                        keyboardType="numeric"
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Account Name"
                        value={accountName}
                        onChangeText={setAccountName}
                    />
                </View>

                <TouchableOpacity
                    style={[styles.submitButton, loading && styles.disabledButton]}
                    onPress={handleSubmit}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.submitButtonText}>Submit for Approval</Text>
                    )}
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
    header: {
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    content: {
        padding: 20,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginBottom: 30,
        lineHeight: 24,
    },
    alertBox: {
        flexDirection: 'row',
        backgroundColor: '#fef2f2',
        padding: 15,
        borderRadius: 8,
        marginBottom: 20,
        alignItems: 'center',
        gap: 10,
        borderWidth: 1,
        borderColor: '#fee2e2',
    },
    alertText: {
        color: '#b91c1c',
        flex: 1,
        fontSize: 14,
    },
    section: {
        marginBottom: 30,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 15,
        color: '#111',
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 15,
        marginBottom: 15,
        fontSize: 16,
        backgroundColor: '#fff',
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 15,
    },
    halfInput: {
        flex: 1,
    },
    uploadBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 15,
        borderWidth: 1,
        borderColor: '#000',
        borderStyle: 'dashed',
        borderRadius: 8,
        marginBottom: 15,
        gap: 10,
    },
    uploadBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#000',
    },
    submitButton: {
        backgroundColor: '#000',
        padding: 18,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 10,
    },
    disabledButton: {
        opacity: 0.7,
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
