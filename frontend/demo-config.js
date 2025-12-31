/**
 * Demo Configuration
 *
 * IMPORTANT: This file controls demo mode for showcasing the application
 * without requiring backend authentication.
 *
 * FOR PRODUCTION: Set DEMO_CONFIG.enabled = false
 * FOR DEMO/SHOWCASE: Set DEMO_CONFIG.enabled = true
 */

const DEMO_CONFIG = {
    // Toggle demo mode on/off
    enabled: true,  // Set to false for production deployment

    // Demo user credentials
    credentials: {
        email: 'demo@govli.ai',
        name: 'Demo Administrator',
        role: 'admin',
        department: 'Administration',
        id: 1
    },

    // Display settings
    ui: {
        showBanner: true,  // Show "Demo Mode" banner at top of page
        bannerMessage: 'Demo Mode Active - No backend required'
    }
};

// Make available globally
window.DEMO_CONFIG = DEMO_CONFIG;

console.log('Demo Config loaded:', DEMO_CONFIG.enabled ? 'ENABLED' : 'DISABLED');
