import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    ScrollView,
    TouchableOpacity,
    Image,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { User } from '@/types';
import { firebaseService } from '@/services/firebaseService';

interface VendorDetailsModalProps {
    visible: boolean;
    vendor: User | null;
    onClose: () => void;
    onApprove: () => void; // Acts as onRefresh
}

export default function VendorDetailsModal({ visible, vendor, onClose, onApprove }: VendorDetailsModalProps) {
    if (!vendor) return null;

    const { businessDetails, documents } = vendor;

    const handleApprove = async () => {
        try {
            Alert.alert(
                'Confirm Approval',
                'Are you sure you want to approve this vendor? They will immediately gain access to the marketplace dashboard.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Approve',
                        style: 'default',
                        onPress: async () => {
                            await firebaseService.approveVendor(vendor.id);
                            Alert.alert('Success', 'Vendor approved successfully');
                            onApprove();
                            onClose();
                        }
                    }
                ]
            );
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to approve vendor');
        }
    };

    const handleReject = async () => {
        Alert.alert(
            'Decline Application',
            'Are you sure? The vendor will be notified and asked to resubmit.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Decline',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await firebaseService.rejectVendor(vendor.id);
                            Alert.alert('Success', 'Vendor application declined.');
                            onApprove();
                            onClose();
                        } catch (error: any) {
                            Alert.alert('Error', error.message);
                        }
                    }
                }
            ]
        );
    };

    const handleDelete = async () => {
        Alert.alert(
            'Delete User',
            'This action is irreversible. The user will be removed from the system.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await firebaseService.deleteUser(vendor.id);
                            onApprove();
                            onClose();
                        } catch (error: any) {
                            Alert.alert('Error', error.message);
                        }
                    }
                }
            ]
        );
    }

    const renderDetailRow = (label: string, value: string | undefined) => (
        <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{label}</Text>
            <Text style={styles.detailValue}>{value || 'N/A'}</Text>
        </View>
    );

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Vendor Application</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={24} color="#000" />
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    <View style={styles.statusBanner}>
                        <Ionicons
                            name={vendor.vendorStatus === 'active' ? "checkmark-circle" : "time"}
                            size={24}
                            color={vendor.vendorStatus === 'active' ? "#16a34a" : "#ca8a04"}
                        />
                        <Text style={[
                            styles.statusText,
                            { color: vendor.vendorStatus === 'active' ? "#16a34a" : "#ca8a04" }
                        ]}>
                            Status: {vendor.vendorStatus?.replace('_', ' ').toUpperCase()}
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Business Details</Text>
                        {renderDetailRow('Business Name', businessDetails?.businessName)}
                        {renderDetailRow('RC Number', businessDetails?.rcNumber)}
                        {renderDetailRow('Address', businessDetails?.address)}
                        {renderDetailRow('Location', `${businessDetails?.city}, ${businessDetails?.state}, ${businessDetails?.country}`)}
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Contact Person</Text>
                        {renderDetailRow('Full Name', vendor.name)}
                        {renderDetailRow('Role', businessDetails?.contactRole)}
                        {renderDetailRow('Email', vendor.email)}
                        {renderDetailRow('Phone', vendor.phone)}
                        {renderDetailRow('NIN', businessDetails?.nin)}
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Bank Details</Text>
                        {renderDetailRow('Bank Name', businessDetails?.bankName)}
                        {renderDetailRow('Account Number', businessDetails?.accountNumber)}
                        {renderDetailRow('Account Name', businessDetails?.accountName)}
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Documents</Text>
                        {documents?.ninImage && (
                            <View style={styles.docContainer}>
                                <Text style={styles.docLabel}>NIN Image</Text>
                                <Image source={{ uri: documents.ninImage }} style={styles.docImage} resizeMode="contain" />
                            </View>
                        )}
                        {documents?.certificateOfIncorporation && (
                            <View style={styles.docContainer}>
                                <Text style={styles.docLabel}>Certificate of Incorporation</Text>
                                <Image source={{ uri: documents.certificateOfIncorporation }} style={styles.docImage} resizeMode="contain" />
                            </View>
                        )}
                        {documents?.proofOfAddress && (
                            <View style={styles.docContainer}>
                                <Text style={styles.docLabel}>Proof of Address</Text>
                                <Image source={{ uri: documents.proofOfAddress }} style={styles.docImage} resizeMode="contain" />
                            </View>
                        )}
                        {(!documents || Object.keys(documents).length === 0) && <Text style={{ color: '#666' }}>No documents uploaded.</Text>}
                    </View>

                    <View style={{ height: 100 }} />
                </ScrollView>

                <View style={styles.footer}>
                    {vendor.vendorStatus !== 'active' && (
                        <View style={styles.actionButtons}>
                            <TouchableOpacity style={[styles.actionButton, styles.declineButton]} onPress={handleReject}>
                                <Text style={[styles.actionButtonText, styles.declineButtonText]}>Decline</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.actionButton, styles.approveButton]} onPress={handleApprove}>
                                <Text style={[styles.actionButtonText, styles.approveButtonText]}>Approve</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                        <Ionicons name="trash-outline" size={20} color="#ef4444" />
                        <Text style={styles.deleteButtonText}>Remove User</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
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
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    closeButton: {
        padding: 5,
    },
    content: {
        padding: 20,
    },
    statusBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        padding: 10,
        backgroundColor: '#f9f9f9',
        borderRadius: 8,
        gap: 10,
    },
    statusText: {
        fontWeight: 'bold',
        fontSize: 14,
    },
    section: {
        marginBottom: 25,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 15,
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 15,
        color: '#000',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        paddingBottom: 8,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    detailLabel: {
        color: '#666',
        flex: 1,
        fontSize: 14,
    },
    detailValue: {
        color: '#000',
        fontWeight: '500',
        flex: 1,
        textAlign: 'right',
        fontSize: 14,
    },
    docContainer: {
        marginBottom: 15,
    },
    docLabel: {
        marginBottom: 5,
        color: '#666',
        fontSize: 14,
    },
    docImage: {
        width: '100%',
        height: 200,
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
    },
    footer: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#eee',
        backgroundColor: '#fff',
        gap: 15,
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 15,
    },
    actionButton: {
        flex: 1,
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    declineButton: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ef4444',
    },
    approveButton: {
        backgroundColor: '#000',
    },
    actionButtonText: {
        fontWeight: 'bold',
        fontSize: 16,
    },
    declineButtonText: {
        color: '#ef4444',
    },
    approveButtonText: {
        color: '#fff',
    },
    deleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 15,
        gap: 8,
    },
    deleteButtonText: {
        color: '#ef4444',
        fontSize: 15,
        fontWeight: '600',
    },
});

