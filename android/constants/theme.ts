import { Platform } from 'react-native';

export const Colors = {
  light: {
    background: '#FFFFFF',
    foreground: '#2C2C2C',
    primary: '#2C2C2C',
    secondary: '#1B4332',
    accent: '#D62828',
    muted: '#F5F5F5',
    mutedForeground: '#808080',
    border: '#E0E0E0',
    success: '#1B4332',
    error: '#D62828',
    warning: '#F59E0B',
    info: '#3B82F6',
  },
  dark: {
    background: '#1A1A1A',
    foreground: '#F5F5F5',
    primary: '#F5F5F5',
    secondary: '#4CAF50',
    accent: '#FF6B6B',
    muted: '#333333',
    mutedForeground: '#CCCCCC',
    border: '#444444',
    success: '#4CAF50',
    error: '#FF6B6B',
    warning: '#FFC107',
    info: '#2196F3',
  },
  // ライトテーマのフラットエイリアス（直接参照用）
  white: '#FFFFFF',
  black: '#000000',
  background: '#FFFFFF',
  foreground: '#2C2C2C',
  primary: '#2C2C2C',
  secondary: '#1B4332',
  accent: '#D62828',
  muted: '#F5F5F5',
  mutedForeground: '#808080',
  border: '#E0E0E0',
  success: '#1B4332',
  error: '#D62828',
  warning: '#F59E0B',
  info: '#3B82F6',
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  android: {
    sans: 'Roboto',
    serif: 'Noto Serif',
    rounded: 'Roboto',
    mono: 'Roboto Mono',
  },
});

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
};

export const BorderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  full: 9999,
};

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
};
