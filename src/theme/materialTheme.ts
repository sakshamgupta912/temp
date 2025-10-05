import { MD3LightTheme, MD3DarkTheme, configureFonts } from 'react-native-paper';

// Extend the theme colors interface
declare global {
  namespace ReactNativePaper {
    interface MD3Colors {
      income: string;
      expense: string;
      neutral: string;
      warning: string;
      surface1: string;
      surface2: string;
      surface3: string;
      surface4: string;
      surface5: string;
    }
  }
}

// Material Design 3 Color Palette
const materialColors = {
  primary: '#6750A4',
  onPrimary: '#FFFFFF',
  primaryContainer: '#EADDFF',
  onPrimaryContainer: '#21005D',
  
  secondary: '#625B71',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#E8DEF8',
  onSecondaryContainer: '#1D192B',
  
  tertiary: '#7D5260',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#FFD8E4',
  onTertiaryContainer: '#31111D',
  
  error: '#BA1A1A',
  onError: '#FFFFFF',
  errorContainer: '#FFDAD6',
  onErrorContainer: '#410002',
  
  background: '#FFFBFE',
  onBackground: '#1C1B1F',
  surface: '#FFFBFE',
  onSurface: '#1C1B1F',
  surfaceVariant: '#E7E0EC',
  onSurfaceVariant: '#49454F',
  
  outline: '#79747E',
  outlineVariant: '#CAC4D0',
  shadow: '#000000',
  scrim: '#000000',
  
  inverseSurface: '#313033',
  inverseOnSurface: '#F4EFF4',
  inversePrimary: '#D0BCFF',
  
  // Custom colors for financial app
  income: '#4CAF50',
  expense: '#F44336',
  neutral: '#9E9E9E',
  warning: '#FF9800',
  
  // Surface elevations
  surface1: '#F7F2FA',
  surface2: '#F1ECF4',
  surface3: '#ECE6F0',
  surface4: '#E8E2E8',
  surface5: '#E6E0E9',
};

// Typography configuration
const fontConfig = {
  displayLarge: {
    fontFamily: 'Roboto',
    fontSize: 57,
    fontWeight: '400' as const,
    lineHeight: 64,
  },
  displayMedium: {
    fontFamily: 'Roboto',
    fontSize: 45,
    fontWeight: '400' as const,
    lineHeight: 52,
  },
  displaySmall: {
    fontFamily: 'Roboto',
    fontSize: 36,
    fontWeight: '400' as const,
    lineHeight: 44,
  },
  headlineLarge: {
    fontFamily: 'Roboto',
    fontSize: 32,
    fontWeight: '400' as const,
    lineHeight: 40,
  },
  headlineMedium: {
    fontFamily: 'Roboto',
    fontSize: 28,
    fontWeight: '400' as const,
    lineHeight: 36,
  },
  headlineSmall: {
    fontFamily: 'Roboto',
    fontSize: 24,
    fontWeight: '400' as const,
    lineHeight: 32,
  },
  titleLarge: {
    fontFamily: 'Roboto',
    fontSize: 22,
    fontWeight: '400' as const,
    lineHeight: 28,
  },
  titleMedium: {
    fontFamily: 'Roboto-Medium',
    fontSize: 16,
    fontWeight: '500' as const,
    lineHeight: 24,
  },
  titleSmall: {
    fontFamily: 'Roboto-Medium',
    fontSize: 14,
    fontWeight: '500' as const,
    lineHeight: 20,
  },
  bodyLarge: {
    fontFamily: 'Roboto',
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  bodyMedium: {
    fontFamily: 'Roboto',
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  bodySmall: {
    fontFamily: 'Roboto',
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
  labelLarge: {
    fontFamily: 'Roboto-Medium',
    fontSize: 14,
    fontWeight: '500' as const,
    lineHeight: 20,
  },
  labelMedium: {
    fontFamily: 'Roboto-Medium',
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 16,
  },
  labelSmall: {
    fontFamily: 'Roboto-Medium',
    fontSize: 11,
    fontWeight: '500' as const,
    lineHeight: 16,
  },
};

// Light Theme
export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    ...materialColors,
  },
  fonts: configureFonts({ config: fontConfig }),
};

// Dark Theme
export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#D0BCFF',
    onPrimary: '#381E72',
    primaryContainer: '#4F378B',
    onPrimaryContainer: '#EADDFF',
    
    secondary: '#CCC2DC',
    onSecondary: '#332D41',
    secondaryContainer: '#4A4458',
    onSecondaryContainer: '#E8DEF8',
    
    tertiary: '#EFB8C8',
    onTertiary: '#492532',
    tertiaryContainer: '#633B48',
    onTertiaryContainer: '#FFD8E4',
    
    error: '#FFB4AB',
    onError: '#690005',
    errorContainer: '#93000A',
    onErrorContainer: '#FFDAD6',
    
    background: '#10141B',
    onBackground: '#E6E0E9',
    surface: '#10141B',
    onSurface: '#E6E0E9',
    surfaceVariant: '#49454F',
    onSurfaceVariant: '#CAC4D0',
    
    outline: '#938F99',
    outlineVariant: '#49454F',
    
    inverseSurface: '#E6E0E9',
    inverseOnSurface: '#313033',
    inversePrimary: '#6750A4',
    
    // Custom financial colors for dark theme
    income: '#81C784',
    expense: '#EF5350',
    neutral: '#BDBDBD',
    warning: '#FFB74D',
    
    // Dark surface elevations
    surface1: '#1D1B20',
    surface2: '#22202A',
    surface3: '#2B2930',
    surface4: '#2E2B35',
    surface5: '#33303A',
  },
  fonts: configureFonts({ config: fontConfig }),
};

// Common spacing and sizing values
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const elevation = {
  level0: 0,
  level1: 1,
  level2: 3,
  level3: 6,
  level4: 8,
  level5: 12,
};

// Material Design component variants
export const componentStyles = {
  card: {
    elevated: {
      elevation: elevation.level1,
      shadowColor: materialColors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    filled: {
      backgroundColor: materialColors.surfaceVariant,
    },
    outlined: {
      borderWidth: 1,
      borderColor: materialColors.outline,
    },
  },
  
  fab: {
    primary: {
      backgroundColor: materialColors.primaryContainer,
    },
    secondary: {
      backgroundColor: materialColors.secondaryContainer,
    },
    tertiary: {
      backgroundColor: materialColors.tertiaryContainer,
    },
  },
  
  button: {
    elevated: {
      elevation: elevation.level1,
    },
    filled: {
      backgroundColor: materialColors.primary,
    },
    tonal: {
      backgroundColor: materialColors.secondaryContainer,
    },
    outlined: {
      borderWidth: 1,
      borderColor: materialColors.outline,
    },
  },
};

// Export commonly used color combinations
export const colorCombinations = {
  primary: {
    background: materialColors.primary,
    text: materialColors.onPrimary,
  },
  primaryContainer: {
    background: materialColors.primaryContainer,
    text: materialColors.onPrimaryContainer,
  },
  secondary: {
    background: materialColors.secondary,
    text: materialColors.onSecondary,
  },
  secondaryContainer: {
    background: materialColors.secondaryContainer,
    text: materialColors.onSecondaryContainer,
  },
  surface: {
    background: materialColors.surface,
    text: materialColors.onSurface,
  },
  surfaceVariant: {
    background: materialColors.surfaceVariant,
    text: materialColors.onSurfaceVariant,
  },
  error: {
    background: materialColors.error,
    text: materialColors.onError,
  },
  errorContainer: {
    background: materialColors.errorContainer,
    text: materialColors.onErrorContainer,
  },
};