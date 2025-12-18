/**
 * Unified Design System
 * 
 * This file contains all design tokens used across the application
 * to ensure consistency between customer and workshop interfaces.
 */

// ==================== Colors ====================

export const Colors = {
  // Primary Colors
  primary: '#007AFF',        // iOS Blue - Primary action color
  primaryDark: '#0051D5',    // Darker blue for pressed states
  primaryLight: '#5AC8FA',    // Lighter blue for backgrounds
  
  // Secondary Colors
  secondary: '#000',         // Black - Used for text and emphasis
  secondaryLight: '#333',     // Dark gray for secondary text
  
  // Accent Colors
  accent: '#FF9500',         // Orange - For CTAs and highlights
  accentLight: '#FFB340',    // Lighter orange
  
  // Status Colors
  success: '#34C759',        // Green - Success states
  successLight: '#30D158',  // Lighter green
  warning: '#FF9500',        // Orange - Warning states
  error: '#FF3B30',          // Red - Error states
  info: '#007AFF',          // Blue - Info states
  
  // Neutral Colors
  background: '#F5F6FA',     // Main background (slightly cooler than #f5f5f5)
  backgroundLight: '#FFFFFF', // White backgrounds
  surface: '#FFFFFF',       // Card/surface backgrounds
  surfaceElevated: '#FFFFFF', // Elevated surfaces
  
  // Text Colors
  textPrimary: '#000',       // Primary text
  textSecondary: '#666',     // Secondary text
  textTertiary: '#999',      // Tertiary/disabled text
  textInverse: '#FFFFFF',   // Text on dark backgrounds
  
  // Border Colors
  border: '#EEE',            // Default borders
  borderLight: '#F0F0F0',   // Light borders
  borderDark: '#DDD',       // Darker borders
  
  // Overlay Colors
  overlay: 'rgba(0, 0, 0, 0.5)', // Modal overlays
  overlayLight: 'rgba(0, 0, 0, 0.1)', // Light overlays
  
  // Status Badge Colors
  statusReceived: '#FFA500',  // Orange
  statusDiagnosed: '#007AFF', // Blue
  statusRepairing: '#34C759', // Green
  statusCompleted: '#30D158', // Bright green
  statusPending: '#999',      // Gray
} as const;

// ==================== Typography ====================

export const Typography = {
  // Font Families
  fontFamily: {
    regular: 'System',        // Default system font
    medium: 'System',
    bold: 'System',
  },
  
  // Font Sizes
  fontSize: {
    xs: 12,      // Small labels, captions
    sm: 14,      // Secondary text, helper text
    base: 16,     // Body text, default
    lg: 18,      // Section titles, emphasized text
    xl: 20,      // Large section titles
    '2xl': 24,   // Page titles, large headings
    '3xl': 32,   // Hero text, very large headings
    '4xl': 42,   // Metric values, display text
  },
  
  // Font Weights
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  
  // Line Heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;

// ==================== Spacing ====================

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 60,
} as const;

// ==================== Border Radius ====================

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  full: 9999,
} as const;

// ==================== Shadows ====================

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
} as const;

// ==================== Component Styles ====================

export const ComponentStyles = {
  // Buttons
  button: {
    primary: {
      backgroundColor: Colors.primary,
      borderRadius: BorderRadius.md,
      paddingVertical: Spacing.base,
      paddingHorizontal: Spacing.lg,
    },
    secondary: {
      backgroundColor: Colors.secondary,
      borderRadius: BorderRadius.md,
      paddingVertical: Spacing.base,
      paddingHorizontal: Spacing.lg,
    },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: BorderRadius.md,
      paddingVertical: Spacing.base,
      paddingHorizontal: Spacing.lg,
    },
  },
  
  // Cards
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    ...Shadows.md,
  },
  
  // Inputs
  input: {
    backgroundColor: Colors.backgroundLight,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
  },
  
  // Headers
  header: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing['5xl'],
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
} as const;

// ==================== Layout Constants ====================

export const Layout = {
  // Screen padding
  screenPadding: Spacing.lg,
  
  // Header height
  headerHeight: 60,
  
  // Tab bar height
  tabBarHeight: 50,
  
  // Card spacing
  cardSpacing: Spacing.md,
  
  // Section spacing
  sectionSpacing: Spacing.xl,
} as const;

// ==================== Icon Sizes ====================

export const IconSizes = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 48,
  '2xl': 64,
} as const;

// ==================== Status Colors Map ====================

export const StatusColors: Record<string, string> = {
  received: Colors.statusReceived,
  diagnosed: Colors.statusDiagnosed,
  repairing: Colors.statusRepairing,
  completed: Colors.statusCompleted,
  pending: Colors.statusPending,
};

