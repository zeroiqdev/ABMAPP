import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, addMonths, subMonths } from 'date-fns';
import { Colors, Typography, BorderRadius } from '@/constants/design';

interface DateRangeFilterProps {
    selectedDate: Date;
    onDateChange: (date: Date) => void;
    theme?: 'light' | 'dark'; // For different backgrounds if needed
}

export const DateRangeFilter = ({ selectedDate, onDateChange, theme = 'light' }: DateRangeFilterProps) => {
    const handlePrevMonth = () => {
        onDateChange(subMonths(selectedDate, 1));
    };

    const handleNextMonth = () => {
        onDateChange(addMonths(selectedDate, 1));
    };

    return (
        <View style={[styles.container, theme === 'dark' && styles.containerDark]}>
            <TouchableOpacity onPress={handlePrevMonth} style={styles.navButton}>
                <Ionicons
                    name="chevron-back"
                    size={20}
                    color={theme === 'dark' ? '#fff' : Colors.textPrimary}
                />
            </TouchableOpacity>

            <Text style={[styles.dateText, theme === 'dark' && styles.dateTextDark]}>
                {format(selectedDate, 'MMMM yyyy')}
            </Text>

            <TouchableOpacity onPress={handleNextMonth} style={styles.navButton}>
                <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={theme === 'dark' ? '#fff' : Colors.textPrimary}
                />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.background, // #F5F6FA likely
        borderRadius: BorderRadius.lg,
        paddingHorizontal: 8,
        paddingVertical: 6,
    },
    containerDark: {
        backgroundColor: '#333',
    },
    navButton: {
        padding: 4,
    },
    dateText: {
        fontSize: Typography.fontSize.sm,
        fontWeight: Typography.fontWeight.semibold,
        color: Colors.textPrimary,
        marginHorizontal: 8,
        minWidth: 100,
        textAlign: 'center',
    },
    dateTextDark: {
        color: '#fff',
    },
});
