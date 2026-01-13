const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Custom Expo config plugin to add `use_modular_headers!` to the Podfile.
 * This is required for Firebase Swift pods to build correctly with static libraries.
 */
function withModularHeaders(config) {
    return withDangerousMod(config, [
        'ios',
        async (config) => {
            const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');

            if (fs.existsSync(podfilePath)) {
                let podfileContent = fs.readFileSync(podfilePath, 'utf8');

                // Check if use_modular_headers! is already present
                if (!podfileContent.includes('use_modular_headers!')) {
                    // Add use_modular_headers! after use_frameworks! or at the beginning of the target block
                    if (podfileContent.includes("use_frameworks! :linkage => :static")) {
                        podfileContent = podfileContent.replace(
                            "use_frameworks! :linkage => :static",
                            "use_frameworks! :linkage => :static\n  use_modular_headers!"
                        );
                    } else if (podfileContent.includes("use_frameworks!")) {
                        podfileContent = podfileContent.replace(
                            "use_frameworks!",
                            "use_frameworks!\n  use_modular_headers!"
                        );
                    } else {
                        // Add it near the top of the target block
                        podfileContent = podfileContent.replace(
                            /target ['"].*?['"] do/,
                            (match) => `${match}\n  use_modular_headers!`
                        );
                    }

                    fs.writeFileSync(podfilePath, podfileContent);
                    console.log('[withModularHeaders] Added use_modular_headers! to Podfile');
                } else {
                    console.log('[withModularHeaders] use_modular_headers! already present in Podfile');
                }
            }

            return config;
        },
    ]);
}

module.exports = withModularHeaders;
