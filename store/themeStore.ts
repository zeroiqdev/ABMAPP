import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
    themeMode: ThemeMode;
    setThemeMode: (mode: ThemeMode) => void;
    getEffectiveTheme: () => 'light' | 'dark';
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set, get) => ({
            themeMode: 'system',

            setThemeMode: (mode: ThemeMode) => {
                set({ themeMode: mode });
            },

            getEffectiveTheme: () => {
                const { themeMode } = get();
                if (themeMode === 'system') {
                    return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
                }
                return themeMode;
            },
        }),
        {
            name: 'theme-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);

// Hook to get current theme colors
export const useThemeColors = () => {
    const { themeMode, getEffectiveTheme } = useThemeStore();
    const effectiveTheme = getEffectiveTheme();
    return { themeMode, effectiveTheme, isDark: effectiveTheme === 'dark' };
};
