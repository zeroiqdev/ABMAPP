import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';
import { Quote } from '@/types';
import { format } from 'date-fns';

export default function CustomerQuotesScreen() {
    const { user } = useAuthStore();
    const router = useRouter();
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadQuotes();
    }, [user?.id]);

    const loadQuotes = async () => {
        if (!user?.id) return;
        try {
            const quotesData = await firebaseService.getQuotes(undefined, user.id);
            // Only show pending_approval quotes (not drafts or converted)
            const pendingQuotes = quotesData.filter(q => q.status === 'pending_approval');
            setQuotes(pendingQuotes);
        } catch (error) {
            console.error('Error loading quotes:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadQuotes();
    };

    const renderQuote = ({ item }: { item: Quote }) => (
        <TouchableOpacity
            style={styles.quoteCard}
            onPress={() => router.push(`/(customer)/quote-details?id=${item.id}`)}
        >
            <View style={styles.quoteHeader}>
                <View style={styles.approvalBadge}>
                    <Ionicons name="alert-circle" size={16} color="#FFA500" />
                    <Text style={styles.approvalText}>Approval Needed</Text>
                </View>
                <Text style={styles.dateText}>
                    {format(item.sentAt || item.createdAt, 'MMM dd')}
                </Text>
            </View>

            <Text style={styles.itemCount}>
                {item.items.length} item{item.items.length !== 1 ? 's' : ''}
            </Text>

            <View style={styles.quoteFooter}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>₦{item.total.toLocaleString()}</Text>
            </View>

            <TouchableOpacity style={styles.reviewButton}>
                <Text style={styles.reviewButtonText}>Review & Approve</Text>
                <Ionicons name="chevron-forward" size={18} color="#007AFF" />
            </TouchableOpacity>
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Pending Approvals</Text>
                <View style={{ width: 24 }} />
            </View>

            <FlatList
                data={quotes}
                renderItem={renderQuote}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="checkmark-circle-outline" size={64} color="#30D158" />
                        <Text style={styles.emptyTitle}>All caught up!</Text>
                        <Text style={styles.emptyText}>No pending quotes to approve</Text>
                    </View>
                }
            />
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
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    listContent: {
        padding: 16,
    },
    quoteCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 2,
        borderColor: '#FFA50030',
    },
    quoteHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    approvalBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF8E7',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        gap: 6,
    },
    approvalText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FFA500',
    },
    dateText: {
        fontSize: 13,
        color: '#888',
    },
    itemCount: {
        fontSize: 14,
        color: '#666',
        marginBottom: 12,
    },
    quoteFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    totalLabel: {
        fontSize: 15,
        color: '#666',
    },
    totalValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    reviewButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
        paddingVertical: 12,
        backgroundColor: '#f0f8ff',
        borderRadius: 10,
        gap: 4,
    },
    reviewButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#007AFF',
    },
    emptyState: {
        padding: 60,
        alignItems: 'center',
    },
    emptyTitle: {
        marginTop: 16,
        fontSize: 20,
        fontWeight: '600',
        color: '#333',
    },
    emptyText: {
        marginTop: 8,
        fontSize: 15,
        color: '#888',
    },
});
