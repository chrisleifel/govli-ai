/**
 * Theme Loader
 * Fetches tenant-specific branding and applies CSS custom properties
 * Includes caching and fallback to default Govli theme
 */

import { defaultTheme, type Theme } from './defaultTheme';

const THEME_CACHE_KEY = 'govli_theme_cache';
const THEME_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

interface CachedTheme {
  theme: Theme;
  timestamp: number;
  tenantId: string;
}

interface BrandSettingsResponse {
  success: boolean;
  data?: {
    primary_color?: string;
    secondary_color?: string;
    logo_url?: string;
    favicon_url?: string;
    font_family?: string;
    agency_name?: string;
  };
  error?: string;
}

/**
 * Apply theme colors to CSS custom properties
 * @param theme - Theme configuration object
 */
function applyThemeToDOM(theme: Theme): void {
  const root = document.documentElement;

  // Apply primary colors
  if (theme.colors.primary) {
    root.style.setProperty('--color-navy', theme.colors.primary);
    root.style.setProperty('--color-primary', theme.colors.primary);
  }
  if (theme.colors.primaryLight) {
    root.style.setProperty('--color-navy-light', theme.colors.primaryLight);
  }
  if (theme.colors.primaryDark) {
    root.style.setProperty('--color-navy-dark', theme.colors.primaryDark);
  }

  // Apply secondary colors
  if (theme.colors.secondary) {
    root.style.setProperty('--color-teal', theme.colors.secondary);
    root.style.setProperty('--color-secondary', theme.colors.secondary);
  }
  if (theme.colors.secondaryLight) {
    root.style.setProperty('--color-teal-light', theme.colors.secondaryLight);
  }
  if (theme.colors.secondaryDark) {
    root.style.setProperty('--color-teal-dark', theme.colors.secondaryDark);
  }

  // Apply accent colors
  if (theme.colors.accent) {
    root.style.setProperty('--color-gold', theme.colors.accent);
    root.style.setProperty('--color-accent', theme.colors.accent);
  }
  if (theme.colors.accentLight) {
    root.style.setProperty('--color-gold-light', theme.colors.accentLight);
  }
  if (theme.colors.accentDark) {
    root.style.setProperty('--color-gold-dark', theme.colors.accentDark);
  }

  // Apply typography
  if (theme.typography?.fontFamily) {
    root.style.setProperty('--font-family-sans', theme.typography.fontFamily);
    root.style.setProperty('--font-family-base', theme.typography.fontFamily);
  }

  // Update favicon if provided
  if (theme.favicon) {
    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (favicon) {
      favicon.href = theme.favicon;
    }
  }
}

/**
 * Get cached theme from localStorage
 * @param tenantId - Tenant identifier
 * @returns Cached theme or null if not found or expired
 */
function getCachedTheme(tenantId: string): Theme | null {
  try {
    const cached = localStorage.getItem(THEME_CACHE_KEY);
    if (!cached) return null;

    const parsedCache: CachedTheme = JSON.parse(cached);
    const now = Date.now();

    // Check if cache is valid
    if (
      parsedCache.tenantId === tenantId &&
      now - parsedCache.timestamp < THEME_CACHE_DURATION
    ) {
      return parsedCache.theme;
    }

    // Cache expired or different tenant
    localStorage.removeItem(THEME_CACHE_KEY);
    return null;
  } catch (error) {
    console.error('Error reading theme cache:', error);
    return null;
  }
}

/**
 * Cache theme in localStorage
 * @param tenantId - Tenant identifier
 * @param theme - Theme configuration to cache
 */
function cacheTheme(tenantId: string, theme: Theme): void {
  try {
    const cacheData: CachedTheme = {
      theme,
      timestamp: Date.now(),
      tenantId,
    };
    localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    console.error('Error caching theme:', error);
  }
}

/**
 * Transform API response to Theme object
 * @param data - API response data
 * @returns Theme configuration
 */
function transformAPIResponseToTheme(
  data: BrandSettingsResponse['data']
): Theme {
  if (!data) return defaultTheme;

  return {
    name: data.agency_name || 'custom-tenant',
    colors: {
      primary: data.primary_color,
      secondary: data.secondary_color,
      // Use default colors for variants if not provided
      primaryLight: defaultTheme.colors.primaryLight,
      primaryDark: defaultTheme.colors.primaryDark,
      secondaryLight: defaultTheme.colors.secondaryLight,
      secondaryDark: defaultTheme.colors.secondaryDark,
      accent: defaultTheme.colors.accent,
      accentLight: defaultTheme.colors.accentLight,
      accentDark: defaultTheme.colors.accentDark,
    },
    logo: data.logo_url,
    favicon: data.favicon_url,
    typography: {
      fontFamily: data.font_family || defaultTheme.typography?.fontFamily,
    },
  };
}

/**
 * Load and apply tenant-specific theme
 * Fetches from /api/v1/foia/settings/brand endpoint
 * Falls back to default Govli theme on error
 * Caches theme in localStorage for 24 hours
 *
 * @param tenantId - Tenant identifier (uuid or slug)
 * @param apiBaseUrl - Optional API base URL (defaults to relative path)
 * @returns Promise that resolves to the loaded theme
 *
 * @example
 * ```typescript
 * // Load theme for a specific tenant
 * const theme = await loadTheme('tenant-123');
 *
 * // With custom API URL
 * const theme = await loadTheme('tenant-123', 'https://api.example.com');
 * ```
 */
export async function loadTheme(
  tenantId: string,
  apiBaseUrl: string = ''
): Promise<Theme> {
  // Check cache first
  const cachedTheme = getCachedTheme(tenantId);
  if (cachedTheme) {
    console.log(`Using cached theme for tenant: ${tenantId}`);
    applyThemeToDOM(cachedTheme);
    return cachedTheme;
  }

  try {
    // Fetch theme from API
    const url = `${apiBaseUrl}/api/v1/foia/settings/brand?tenant_id=${encodeURIComponent(tenantId)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies for authentication
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: BrandSettingsResponse = await response.json();

    if (!result.success || !result.data) {
      console.warn('API returned unsuccessful response, using default theme');
      applyThemeToDOM(defaultTheme);
      return defaultTheme;
    }

    // Transform and apply theme
    const theme = transformAPIResponseToTheme(result.data);
    applyThemeToDOM(theme);
    cacheTheme(tenantId, theme);

    console.log(`Theme loaded successfully for tenant: ${tenantId}`);
    return theme;
  } catch (error) {
    console.error('Error loading theme, falling back to default:', error);
    applyThemeToDOM(defaultTheme);
    return defaultTheme;
  }
}

/**
 * Clear cached theme
 * Useful for forcing theme refresh
 */
export function clearThemeCache(): void {
  try {
    localStorage.removeItem(THEME_CACHE_KEY);
    console.log('Theme cache cleared');
  } catch (error) {
    console.error('Error clearing theme cache:', error);
  }
}

/**
 * Apply default theme without API call
 * Useful for initial page load or testing
 */
export function applyDefaultTheme(): void {
  applyThemeToDOM(defaultTheme);
}

/**
 * Manually apply a theme configuration
 * Useful for testing or custom theme overrides
 *
 * @param theme - Theme configuration to apply
 */
export function applyTheme(theme: Theme): void {
  applyThemeToDOM(theme);
}
