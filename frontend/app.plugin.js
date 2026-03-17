/**
 * Expo Config Plugin for ACCESS Browser VPN
 * 
 * This plugin injects the required native permissions and entitlements
 * for VPN functionality during the `expo prebuild` phase.
 * 
 * Android: Adds VpnService permissions to AndroidManifest.xml
 * iOS: Adds NetworkExtension entitlements to the app
 * 
 * Usage:
 * 1. Add to app.json/app.config.js: "plugins": ["./app.plugin.js"]
 * 2. Run: npx expo prebuild
 * 3. Build native apps: npx expo run:ios / npx expo run:android
 * 
 * Note: This plugin only sets up permissions. The actual VPN tunnel
 * implementation requires native code in the ios/ and android/ directories.
 */

const { withAndroidManifest, withEntitlementsPlist, withInfoPlist } = require('@expo/config-plugins');

/**
 * Android Configuration
 * Adds required permissions for VpnService
 */
const withAndroidVPNPermissions = (config) => {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults.manifest;
    
    // Ensure permissions array exists
    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }
    
    // VPN-related permissions
    const vpnPermissions = [
      // Required for VPN service
      'android.permission.INTERNET',
      'android.permission.ACCESS_NETWORK_STATE',
      'android.permission.FOREGROUND_SERVICE',
      // Required for VPN tunnel
      'android.permission.BIND_VPN_SERVICE',
    ];
    
    // Add permissions if not already present
    vpnPermissions.forEach(permission => {
      const exists = manifest['uses-permission'].some(
        p => p.$?.['android:name'] === permission
      );
      
      if (!exists) {
        manifest['uses-permission'].push({
          $: { 'android:name': permission }
        });
        console.log(`[VPN Plugin] Added Android permission: ${permission}`);
      }
    });
    
    // Add VPN service declaration to application
    const application = manifest.application?.[0];
    if (application) {
      if (!application.service) {
        application.service = [];
      }
      
      // Check if VPN service already declared
      const vpnServiceExists = application.service.some(
        s => s.$?.['android:name'] === '.vpn.AccessVPNService'
      );
      
      if (!vpnServiceExists) {
        application.service.push({
          $: {
            'android:name': '.vpn.AccessVPNService',
            'android:permission': 'android.permission.BIND_VPN_SERVICE',
            'android:exported': 'false',
          },
          'intent-filter': [{
            action: [{ $: { 'android:name': 'android.net.VpnService' } }]
          }]
        });
        console.log('[VPN Plugin] Added Android VPN service declaration');
      }
    }
    
    return config;
  });
};

/**
 * iOS Entitlements Configuration
 * Adds NetworkExtension entitlements for VPN
 */
const withIOSVPNEntitlements = (config) => {
  return withEntitlementsPlist(config, async (config) => {
    // Add Network Extension entitlements
    // Note: These require specific provisioning profile setup in Apple Developer Portal
    
    // Personal VPN entitlement
    config.modResults['com.apple.developer.networking.vpn.api'] = ['allow-vpn'];
    
    // Network Extension entitlements (for packet tunnel)
    config.modResults['com.apple.developer.networking.networkextension'] = [
      'packet-tunnel-provider',
      'app-proxy-provider',
      'content-filter-provider',
    ];
    
    console.log('[VPN Plugin] Added iOS VPN entitlements');
    
    return config;
  });
};

/**
 * iOS Info.plist Configuration
 * Adds usage descriptions and background modes
 */
const withIOSVPNInfoPlist = (config) => {
  return withInfoPlist(config, async (config) => {
    // Add background modes for VPN
    if (!config.modResults.UIBackgroundModes) {
      config.modResults.UIBackgroundModes = [];
    }
    
    const backgroundModes = ['fetch', 'remote-notification', 'network-authentication'];
    backgroundModes.forEach(mode => {
      if (!config.modResults.UIBackgroundModes.includes(mode)) {
        config.modResults.UIBackgroundModes.push(mode);
      }
    });
    
    // Add VPN usage description
    config.modResults.NSVPNUsageDescription = 
      'ACCESS Browser uses VPN to protect your privacy and secure your browsing.';
    
    console.log('[VPN Plugin] Added iOS Info.plist VPN configurations');
    
    return config;
  });
};

/**
 * Main plugin function
 * Applies all VPN-related configurations
 */
const withVPN = (config) => {
  console.log('[VPN Plugin] Configuring VPN permissions and entitlements...');
  
  // Apply Android configurations
  config = withAndroidVPNPermissions(config);
  
  // Apply iOS configurations
  config = withIOSVPNEntitlements(config);
  config = withIOSVPNInfoPlist(config);
  
  console.log('[VPN Plugin] VPN configuration complete');
  
  return config;
};

module.exports = withVPN;
