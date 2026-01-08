import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, subMonths, addMonths } from 'date-fns';
import { Colors, Typography, BorderRadius } from '@/constants/design';

interface MonthPickerModalProps {
    visible: boolean;
    dateRange: { start: Date; end: Date };
    onRangeChange: (range: { start: Date; end: Date }) => void;
    onClose: () => void;
}

export const MonthPickerModal: React.FC<MonthPickerModalProps> = ({
    visible,
    dateRange,
    onRangeChange,
    onClose,
}) => {
    const [mode, setMode] = useState<'single' | 'range'>('single');
    const [tempRange, setTempRange] = useState(dateRange);

    useEffect(() => {
        if (visible) {
            setTempRange(dateRange);
            if (format(dateRange.start, 'MMM yyyy') === format(dateRange.end, 'MMM yyyy')) {
                setMode('single');
            } else {
                setMode('range');
            }
        }
    }, [visible, dateRange]);

    const handleMonthChange = (direction: 'prev' | 'next', type: 'start' | 'end' | 'single') => {
        setTempRange((prev) => {
            let baseDate = type === 'end' ? prev.end : prev.start;
            if (type === 'single') baseDate = prev.start;

            const newDate = direction === 'prev' ? subMonths(baseDate, 1) : addMonths(baseDate, 1);

            if (type === 'single') {
                return { start: newDate, end: newDate };
            } else if (type === 'start') {
                const newStart = newDate > prev.end ? prev.end : newDate;
                return { ...prev, start: newStart };
            } else {
                const newEnd = newDate < prev.start ? prev.start : newDate;
                return { ...prev, end: newEnd };
            }
        });
    };

    const handleApply = () => {
        onRangeChange(tempRange);
        onClose();
    };

    const MonthSelector = ({
        label,
        date,
        type,
    }: {
        label?: string;
        date: Date;
        type: 'start' | 'end' | 'single';
    }) => (
        <View style={styles.monthSelectorRow}>
            {label && <Text style={styles.monthSelectorLabel}>{label}</Text>}
            <View style={styles.monthPickerHeader}>
                <TouchableOpacity
                    onPress={() => handleMonthChange('prev', type)}
                    style={styles.monthPickerNavButton}
                >
                    <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.monthPickerTitle}>{format(date, 'MMMM yyyy')}</Text>
                <TouchableOpacity
                    onPress={() => handleMonthChange('next', type)}
                    style={styles.monthPickerNavButton}
                >
                    <Ionicons name="chevron-forward" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.monthPickerContainer}>
                    <View style={styles.toggleContainer}>
                        <TouchableOpacity
                            style={[styles.toggleButton, mode === 'single' && styles.toggleButtonActive]}
                            onPress={() => {
                                setMode('single');
                                setTempRange({ start: tempRange.start, end: tempRange.start });
                            }}
                        >
                            <Text style={[styles.toggleText, mode === 'single' && styles.toggleTextActive]}>
                                Single Month
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.toggleButton, mode === 'range' && styles.toggleButtonActive]}
                            onPress={() => setMode('range')}
                        >
                            <Text style={[styles.toggleText, mode === 'range' && styles.toggleTextActive]}>
                                Period
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {mode === 'single' ? (
                        <MonthSelector date={tempRange.start} type="single" />
                    ) : (
                        <View style={{ width: '100%' }}>
                            <MonthSelector label="From" date={tempRange.start} type="start" />
                            <MonthSelector label="To" date={tempRange.end} type="end" />
                        </View>
                    )}

                    <TouchableOpacity style={styles.monthPickerSelectButton} onPress={handleApply}>
                        <Text style={styles.monthPickerSelectButtonText}>Apply Filter</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.monthPickerCancelButton} onPress={onClose}>
                        <Text style={styles.monthPickerCancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    monthPickerContainer: {
        width: '85%',
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    monthPickerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        marginBottom: 20,
    },
    monthPickerNavButton: {
        padding: 10,
    },
    monthPickerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#000',
    },
    monthPickerSelectButton: {
        backgroundColor: '#000',
        paddingVertical: 12,
        paddingHorizontal: 30,
        borderRadius: 25,
        marginTop: 10,
        width: '100%',
        alignItems: 'center',
    },
    monthPickerSelectButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    monthPickerCancelButton: {
        paddingVertical: 12,
        marginTop: 10,
    },
    monthPickerCancelButtonText: {
        color: '#666',
        fontSize: 16,
    },
    toggleContainer: {
        flexDirection: 'row',
        backgroundColor: '#f0f0f0',
        borderRadius: 25,
        padding: 4,
        marginBottom: 20,
        width: '100%',
    },
    toggleButton: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 20,
    },
    toggleButtonActive: {
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    toggleText: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
    },
    toggleTextActive: {
        color: '#000',
        fontWeight: '600',
    },
    monthSelectorRow: {
        width: '100%',
        marginBottom: 10,
    },
    monthSelectorLabel: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginBottom: 4,
        fontWeight: '600',
        marginLeft: 10,
    },
});
