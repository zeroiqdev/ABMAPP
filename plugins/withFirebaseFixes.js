const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin to fix Firebase build issues with static frameworks.
 * This plugin modifies the Podfile to:
 * 1. Add modular_headers for Firebase pods (fixes CocoaPods install error)
 * 2. Add build settings in post_install (fixes Xcode build error)
 */
function withFirebaseFixes(config) {
    return withDangerousMod(config, [
        'ios',
        async (config) => {
            const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');

            if (!fs.existsSync(podfilePath)) {
                console.log('[withFirebaseFixes] Podfile not found, skipping...');
                return config;
            }

            let podfileContent = fs.readFileSync(podfilePath, 'utf8');

            // Check if our fixes are already applied
            if (podfileContent.includes('# Firebase modular headers - added by withFirebaseFixes')) {
                console.log('[withFirebaseFixes] Fixes already applied, skipping...');
                return config;
            }

            // 1. Add modular headers for Firebase pods after use_expo_modules! (fixes CocoaPods error)
            const modularHeadersPods = `
  # Firebase modular headers - added by withFirebaseFixes plugin
  # This fixes: "Swift pods cannot yet be integrated as static libraries"
  pod 'FirebaseCore', :modular_headers => true
  pod 'FirebaseCoreInternal', :modular_headers => true
  pod 'FirebaseCoreExtension', :modular_headers => true
  pod 'FirebaseInstallations', :modular_headers => true
  pod 'FirebaseSessions', :modular_headers => true
  pod 'FirebaseCrashlytics', :modular_headers => true
  pod 'GoogleDataTransport', :modular_headers => true
  pod 'GoogleUtilities', :modular_headers => true
  pod 'nanopb', :modular_headers => true
`;

            // Insert after use_expo_modules!
            if (podfileContent.includes('use_expo_modules!')) {
                podfileContent = podfileContent.replace(
                    'use_expo_modules!',
                    'use_expo_modules!' + modularHeadersPods
                );
                console.log('[withFirebaseFixes] Added modular headers for Firebase pods');
            }

            // 2. Add post_install fixes (fixes Xcode build error)
            const postInstallFixes = `
    # Firebase build fixes - added by withFirebaseFixes plugin
    # This fixes: "declaration of 'RCTBridgeModule' must be imported from module"
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        # Disable warnings as errors
        build_config.build_settings['GCC_TREAT_WARNINGS_AS_ERRORS'] = 'NO'
        build_config.build_settings['CLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER'] = 'NO'
        
        # Enable modular headers for Firebase pods
        if ['FirebaseCore', 'FirebaseInstallations', 'FirebaseCoreExtension',
            'FirebaseCoreInternal', 'FirebaseSessions', 'FirebaseCrashlytics',
            'GoogleDataTransport', 'GoogleUtilities', 'nanopb'].include? target.name
          build_config.build_settings['DEFINES_MODULE'] = 'YES'
        end
        
        # Allow non-modular includes for RNFB pods
        if target.name.start_with?('RNFB')
          build_config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        end
      end
    end
    
    # Project-level settings
    installer.pods_project.build_configurations.each do |build_config|
      build_config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
    end
`;

            // Find the react_native_post_install call and add our fixes after it
            if (podfileContent.includes('react_native_post_install(')) {
                // Match react_native_post_install with its full block
                const postInstallRegex = /(react_native_post_install\(\s*installer[\s\S]*?\n\s*\))/;
                const match = podfileContent.match(postInstallRegex);

                if (match) {
                    podfileContent = podfileContent.replace(
                        match[0],
                        match[0] + postInstallFixes
                    );
                    console.log('[withFirebaseFixes] Added post_install fixes');
                }
            }

            fs.writeFileSync(podfilePath, podfileContent);
            console.log('[withFirebaseFixes] Podfile modifications complete');

            return config;
        },
    ]);
}

module.exports = withFirebaseFixes;
