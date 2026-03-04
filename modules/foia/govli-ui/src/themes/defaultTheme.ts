/**
 * Default Govli Theme Configuration
 * Used as fallback when tenant-specific theme is not available
 */

export interface Theme {
  name: string;
  colors: {
    primary?: string;
    primaryLight?: string;
    primaryDark?: string;
    secondary?: string;
    secondaryLight?: string;
    secondaryDark?: string;
    accent?: string;
    accentLight?: string;
    accentDark?: string;
  };
  logo?: string;
  favicon?: string;
  typography?: {
    fontFamily?: string;
  };
}

export const defaultTheme: Theme = {
  name: 'govli-default',
  colors: {
    primary: '#1e3a5f', // Navy
    primaryLight: '#2d5080',
    primaryDark: '#0f1d30',
    secondary: '#00a9a5', // Teal
    secondaryLight: '#00c9c4',
    secondaryDark: '#008985',
    accent: '#f6be00', // Gold
    accentLight: '#ffd633',
    accentDark: '#d4a000',
  },
  logo: undefined, // Will use default Govli logo
  favicon: undefined,
  typography: {
    fontFamily:
      'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
};
