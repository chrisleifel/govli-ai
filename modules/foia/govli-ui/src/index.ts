/**
 * @govli/foia-ui
 * Shared UI components, design tokens, and utilities for FOIA portal and admin dashboard
 * Built by Govli AI FOIA Build Guide v2/v3
 */

// ============================================================================
// Components
// ============================================================================
export { Button } from './components/Button';
export type { ButtonProps } from './components/Button';

export { Badge } from './components/Badge';
export type { BadgeProps } from './components/Badge';

export { Card } from './components/Card';
export type { CardProps } from './components/Card';

export { Modal } from './components/Modal';
export type { ModalProps } from './components/Modal';

export { Toast } from './components/Toast';
export type { ToastProps } from './components/Toast';

export { Spinner } from './components/Spinner';
export type { SpinnerProps } from './components/Spinner';

export { StatusBadge } from './components/StatusBadge';
export type { StatusBadgeProps } from './components/StatusBadge';

export { SLAIndicator } from './components/SLAIndicator';
export type { SLAIndicatorProps } from './components/SLAIndicator';

export { EmptyState } from './components/EmptyState';
export type { EmptyStateProps } from './components/EmptyState';

// ============================================================================
// Hooks
// ============================================================================
export { useAuth } from './hooks/useAuth';
export { useTenant } from './hooks/useTenant';
export { useWebSocket } from './hooks/useWebSocket';
export { useRealTime } from './hooks/useRealTime';
export { useTheme } from './hooks/useTheme';

// ============================================================================
// Utilities
// ============================================================================
export { formatDate } from './utils/formatDate';
export { calculateBusinessDays } from './utils/businessDayCalc';
export { formatCurrency } from './utils/currencyFormat';

// ============================================================================
// Theme System
// ============================================================================
export {
  loadTheme,
  clearThemeCache,
  applyDefaultTheme,
  applyTheme,
} from './themes/themeLoader';

export { defaultTheme } from './themes/defaultTheme';
export type { Theme } from './themes/defaultTheme';

// ============================================================================
// Internationalization (i18n)
// ============================================================================
// Import all translation files
import enTranslations from './i18n/en.json';
import esTranslations from './i18n/es.json';
import zhTranslations from './i18n/zh.json';
import viTranslations from './i18n/vi.json';
import frTranslations from './i18n/fr.json';
import arTranslations from './i18n/ar.json';
import tlTranslations from './i18n/tl.json';
import koTranslations from './i18n/ko.json';
import ruTranslations from './i18n/ru.json';
import ptTranslations from './i18n/pt.json';

/**
 * All available translations organized by locale
 */
export const translations = {
  en: enTranslations,
  es: esTranslations,
  zh: zhTranslations,
  vi: viTranslations,
  fr: frTranslations,
  ar: arTranslations,
  tl: tlTranslations,
  ko: koTranslations,
  ru: ruTranslations,
  pt: ptTranslations,
};

/**
 * Supported locales
 */
export const SUPPORTED_LOCALES = [
  'en',
  'es',
  'zh',
  'vi',
  'fr',
  'ar',
  'tl',
  'ko',
  'ru',
  'pt',
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * Get translation for a specific locale
 * @param locale - The locale code (e.g., 'en', 'es')
 * @returns Translation object for the locale
 */
export function getTranslations(locale: SupportedLocale) {
  return translations[locale] || translations.en;
}

/**
 * Check if a locale is supported
 * @param locale - The locale code to check
 * @returns True if the locale is supported
 */
export function isSupportedLocale(locale: string): locale is SupportedLocale {
  return SUPPORTED_LOCALES.includes(locale as SupportedLocale);
}

// ============================================================================
// Design Token CSS Imports (for CSS-in-JS or styled-components usage)
// ============================================================================
// These can be imported separately in applications that need them
// import '@govli/foia-ui/src/tokens/colors.css';
// import '@govli/foia-ui/src/tokens/typography.css';
// import '@govli/foia-ui/src/tokens/spacing.css';

// ============================================================================
// Version and Package Info
// ============================================================================
export const VERSION = '1.0.0';
export const PACKAGE_NAME = '@govli/foia-ui';
