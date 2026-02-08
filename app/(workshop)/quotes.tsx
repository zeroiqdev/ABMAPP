import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';
import { Quote } from '@/types';
import { format } from 'date-fns';
import { useColors } from '@/constants/design';

export default function WorkshopQuotesScreen() {
    const { user } = useAuthStore();
    const router = useRouter();
    const colors = useColors();
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [filter, setFilter] = useState<'all' | 'draft' | 'pending' | 'converted'>('all');
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        if (!user?.workshopId) return;

        const unsubscribe = firebaseService.subscribeToQuotes(user.workshopId, (quotesData) => {
            let filtered = quotesData;
            if (filter === 'draft') {
                filtered = quotesData.filter((q) => q.status === 'draft');
            } else if (filter === 'pending') {
                filtered = quotesData.filter((q) => q.status === 'pending_approval');
            } else if (filter === 'converted') {
                filtered = quotesData.filter((q) => q.status === 'converted');
            }
            setQuotes(filtered);
            setRefreshing(false);
        });

        return () => unsubscribe();
    }, [user, filter]);

    const onRefresh = () => {
        setRefreshing(true);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'draft': return colors.textTertiary;
            case 'pending_approval': return colors.warning;
            case 'converted': return colors.success;
            case 'cancelled': return colors.error;
            default: return colors.textTertiary;
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'draft': return 'Draft';
            case 'pending_approval': return 'Awaiting Approval';
            case 'converted': return 'Converted';
            case 'cancelled': return 'Cancelled';
            default: return status;
        }
    };

    // Helper to get quote total, calculating from items if needed
    const getQuoteTotal = (quote: Quote): number => {
        if (typeof quote.total === 'number' && !isNaN(quote.total)) {
            return quote.total;
        }
        // Calculate from items if total is missing/NaN
        if (quote.items && quote.items.length > 0) {
            return quote.items.reduce((sum, item) => sum + (item.total || item.quantity * item.unitPrice || 0), 0);
        }
        return 0;
    };

    const renderQuote = ({ item }: { item: Quote }) => (
        <TouchableOpacity
            style={[styles.itemCard, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
            onPress={() => router.push(`/(workshop)/quote-details?id=${item.id}`)}
        >
            <View style={styles.itemLeft}>
                <View style={[styles.iconBox, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                    <Ionicons name="document-text-outline" size={24} color={getStatusColor(item.status)} />
                </View>
                <View style={styles.itemInfo}>
                    <Text style={[styles.itemName, { color: colors.textPrimary }]}>{item.customerName}</Text>
                    <Text style={[styles.itemSubtitle, { color: colors.textSecondary }]}>
                        {format(item.createdAt, 'MMM dd, yyyy')}
                    </Text>
                </View>
            </View>
            <View style={styles.itemRight}>
                <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
                    <Text style={[styles.amountText, { color: colors.textPrimary }]}>₦{getQuoteTotal(item).toLocaleString()}</Text>
                    <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                        {getStatusLabel(item.status)}
                    </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Quotes</Text>
                <TouchableOpacity onPress={() => router.push('/(workshop)/create-quote')}>
                    <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                </TouchableOpacity>
            </View>

            {/* Filter Tabs */}
            <View style={[styles.filterContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                {(['all', 'draft', 'pending', 'converted'] as const).map((f) => (
                    <TouchableOpacity
                        key={f}
                        style={[
                            styles.filterTab,
                            { backgroundColor: colors.background },
                            filter === f && { backgroundColor: colors.primary }
                        ]}
                        onPress={() => setFilter(f)}
                    >
                        <Text style={[
                            styles.filterText,
                            { color: colors.textSecondary },
                            filter === f && { color: colors.textInverse }
                        ]}>
                            {f === 'pending' ? 'Pending' : f.charAt(0).toUpperCase() + f.slice(1)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <FlatList
                data={quotes}
                renderItem={renderQuote}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="document-text-outline" size={64} color={colors.textTertiary} />
                        <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No quotes found</Text>
                        <TouchableOpacity
                            style={[styles.createButton, { backgroundColor: colors.primary }]}
                            onPress={() => router.push('/(workshop)/create-quote')}
                        >
                            <Text style={[styles.createButtonText, { color: colors.textInverse }]}>Create Quote</Text>
                        </TouchableOpacity>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingTop: 60,
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    filterContainer: {
        flexDirection: 'row',
        padding: 15,
        borderBottomWidth: 1,
        gap: 8,
    },
    filterTab: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    filterText: {
        fontSize: 13,
        fontWeight: '600',
    },
    listContent: {
        padding: 0,
    },
    itemCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    itemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconBox: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    itemInfo: {
        flex: 1,
    },
    itemName: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    itemSubtitle: {
        fontSize: 14,
    },
    itemRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    amountText: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '500',
    },
    emptyState: {
        padding: 60,
        alignItems: 'center',
    },
    emptyText: {
        marginTop: 16,
        fontSize: 16,
    },
    createButton: {
        marginTop: 20,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    createButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
});
