const { withDangerousMod, withPlugins } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Custom Expo config plugin to configure Firebase with static frameworks.
 * This plugin modifies the Podfile to:
 * 1. Set $RNFirebaseAsStaticFramework = true
 * 2. Add use_modular_headers! for Firebase dependencies
 */
function withFirebaseStaticFramework(config) {
    return withDangerousMod(config, [
        'ios',
        async (config) => {
            const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');

            if (!fs.existsSync(podfilePath)) {
                console.log('[withFirebaseStaticFramework] Podfile not found, skipping...');
                return config;
            }

            let podfileContent = fs.readFileSync(podfilePath, 'utf8');
            let modified = false;

            // 1. Add $RNFirebaseAsStaticFramework = true at the very top if not present
            if (!podfileContent.includes('$RNFirebaseAsStaticFramework')) {
                podfileContent = `$RNFirebaseAsStaticFramework = true\n\n${podfileContent}`;
                modified = true;
                console.log('[withFirebaseStaticFramework] Added $RNFirebaseAsStaticFramework = true');
            }

            // 2. Add pod-level modular_headers for Firebase dependencies in post_install
            // This is more reliable than use_modular_headers! globally
            const firebaseModularHeadersHook = `
  # Firebase modular headers configuration (added by withFirebaseStaticFramework plugin)
  installer.pods_project.targets.each do |target|
    if ['GoogleUtilities', 'FirebaseCore', 'FirebaseCoreInternal', 'FirebaseCoreExtension', 
        'FirebaseInstallations', 'GoogleDataTransport', 'nanopb', 'FirebaseCrashlytics',
        'FirebaseSessions', 'PromisesObjC', 'PromisesSwift'].include?(target.name)
      target.build_configurations.each do |config|
        config.build_settings['DEFINES_MODULE'] = 'YES'
        config.build_settings['CLANG_ENABLE_MODULES'] = 'YES'
      end
    end
  end
`;

            // Check if post_install exists and add our hook
            if (podfileContent.includes('post_install do |installer|')) {
                if (!podfileContent.includes('Firebase modular headers configuration')) {
                    // Add our configuration inside the existing post_install block
                    podfileContent = podfileContent.replace(
                        /post_install do \|installer\|/,
                        `post_install do |installer|${firebaseModularHeadersHook}`
                    );
                    modified = true;
                    console.log('[withFirebaseStaticFramework] Added Firebase modular headers hook to existing post_install');
                }
            } else {
                // No post_install block exists, add one before the final 'end'
                // Find the last 'end' which closes the target block
                const lastEndIndex = podfileContent.lastIndexOf('\nend');
                if (lastEndIndex !== -1) {
                    const postInstallBlock = `
post_install do |installer|
${firebaseModularHeadersHook}
end

`;
                    podfileContent = podfileContent.slice(0, lastEndIndex + 4) + '\n' + postInstallBlock + podfileContent.slice(lastEndIndex + 4);
                    modified = true;
                    console.log('[withFirebaseStaticFramework] Added new post_install block with Firebase modular headers hook');
                }
            }

            // 3. Add use_modular_headers! if not present (belt and suspenders approach)
            if (!podfileContent.includes('use_modular_headers!')) {
                // Add it after the target declaration
                podfileContent = podfileContent.replace(
                    /(target\s+['"][^'"]+['"]\s+do)/,
                    `$1\n  use_modular_headers!`
                );
                modified = true;
                console.log('[withFirebaseStaticFramework] Added use_modular_headers! to target block');
            }

            if (modified) {
                fs.writeFileSync(podfilePath, podfileContent);
                console.log('[withFirebaseStaticFramework] Podfile modifications complete');
            } else {
                console.log('[withFirebaseStaticFramework] No modifications needed');
            }

            return config;
        },
    ]);
}

module.exports = withFirebaseStaticFramework;
