import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/constants/design';
import { firebaseService } from '@/services/firebaseService';
import { Workshop } from '@/types';

interface WorkshopSelectorModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (selectedIds: string[]) => void;
    excludeIds?: string[];
    initialSelectedIds?: string[];
    multiSelect?: boolean;
    title?: string;
}

export function WorkshopSelectorModal({
    visible,
    onClose,
    onSelect,
    excludeIds = [],
    initialSelectedIds = [],
    multiSelect = true,
    title = 'Select Workshops',
}: WorkshopSelectorModalProps) {
    const colors = useColors();
    const styles = getStyles(colors);

    const [workshops, setWorkshops] = useState<Workshop[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);

    useEffect(() => {
        if (visible) {
            loadWorkshops();
            setSelectedIds(initialSelectedIds);
        }
    }, [visible, initialSelectedIds]);

    const loadWorkshops = async () => {
        // If we already have workshops, don't show full loading if just refreshing
        if (workshops.length === 0) setLoading(true);

        try {
            // Add a timeout to prevent indefinite spinning
            const fetchPromise = firebaseService.getAllWorkshops();
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout loading workshops')), 10000)
            );

            const allWorkshops = await Promise.race([fetchPromise, timeoutPromise]) as Workshop[];
            setWorkshops(allWorkshops.filter(w => !excludeIds.includes(w.id)));
        } catch (error) {
            console.error('Failed to load workshops:', error);
            // Optionally show an alert or empty state
        } finally {
            setLoading(false);
        }
    };

    const filteredWorkshops = useMemo(() => {
        if (!searchQuery.trim()) return workshops;
        const query = searchQuery.toLowerCase();
        return workshops.filter(w =>
            w.name?.toLowerCase().includes(query) ||
            w.address?.toLowerCase().includes(query)
        );
    }, [workshops, searchQuery]);

    const toggleSelection = (workshopId: string) => {
        if (multiSelect) {
            setSelectedIds(prev =>
                prev.includes(workshopId)
                    ? prev.filter(id => id !== workshopId)
                    : [...prev, workshopId]
            );
        } else {
            setSelectedIds([workshopId]);
        }
    };

    const handleConfirm = () => {
        if (selectedIds.length === 0) return;
        onSelect(selectedIds);
        onClose();
    };

    const renderItem = ({ item }: { item: Workshop }) => {
        const isSelected = selectedIds.includes(item.id);
        return (
            <TouchableOpacity
                style={[styles.workshopItem, isSelected && styles.workshopItemSelected]}
                onPress={() => toggleSelection(item.id)}
            >
                <View style={styles.workshopInfo}>
                    <Text style={styles.workshopName}>{item.name || 'Unnamed Workshop'}</Text>
                    {item.address && (
                        <Text style={styles.workshopAddress} numberOfLines={1}>
                            {item.address}
                        </Text>
                    )}
                </View>
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected && <Ionicons name="checkmark" size={16} color="#000" />}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.title}>{title}</Text>
                    <TouchableOpacity
                        onPress={handleConfirm}
                        style={styles.confirmButton}
                        disabled={selectedIds.length === 0}
                    >
                        <Text style={[
                            styles.confirmText,
                            selectedIds.length === 0 && styles.confirmTextDisabled
                        ]}>
                            Done ({selectedIds.length})
                        </Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color={colors.textTertiary} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search workshops..."
                        placeholderTextColor={colors.textTertiary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
                        </TouchableOpacity>
                    )}
                </View>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                ) : filteredWorkshops.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="business-outline" size={48} color={colors.textTertiary} />
                        <Text style={styles.emptyText}>No workshops found</Text>
                    </View>
                ) : (
                    <FlatList
                        data={filteredWorkshops}
                        renderItem={renderItem}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </View>
        </Modal>
    );
}

const getStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        paddingTop: 50,
    },
    closeButton: {
        padding: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    confirmButton: {
        padding: 8,
    },
    confirmText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    confirmTextDisabled: {
        color: colors.textTertiary,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        margin: 16,
        paddingHorizontal: 12,
        borderRadius: 10,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 12,
        fontSize: 16,
        color: colors.textPrimary,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    emptyText: {
        fontSize: 16,
        color: colors.textTertiary,
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 20,
    },
    workshopItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.surface,
        padding: 16,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    workshopItemSelected: {
        borderColor: '#FFFFFF',
    },
    workshopInfo: {
        flex: 1,
        marginRight: 12,
    },
    workshopName: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: 4,
    },
    workshopAddress: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxSelected: {
        backgroundColor: '#FFFFFF',
        borderColor: '#FFFFFF',
    },
}); // Updated styles for White/Black theme
