const path = require('path');
const fs = require('fs');

const possiblePaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname || process.cwd(), '.env'),
  path.join(__dirname || process.cwd(), '.env'),
];

let envPath = null;
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    envPath = p;
    break;
  }
}

if (envPath) {
  const result = require('dotenv').config({ path: envPath, override: true });
  if (result.error) {
    console.error('Error loading .env file');
  } else {
    const loaded = Object.keys(result.parsed || {}).length;
    if (loaded === 0) {
      console.warn('Warning: .env file found but no variables parsed');
    }
  }
} else {
  console.warn('Warning: .env file not found');
  require('dotenv').config({ override: true });
}

const getEnv = (key) => {
  return (process.env[key] || '').trim();
};

export default {
  expo: {
    name: "ABM Workshop & Marketplace",
    slug: "abmapp",
    version: "1.0.10",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    backgroundColor: "#000000",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#000000"
    },
    _internal: {
      isDebug: true
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.abmtek.abmapp",
      buildNumber: "11",
      backgroundColor: "#000000",
      googleServicesFile: './GoogleService-Info.plist',
      config: {
        googleMapsApiKey: getEnv('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY'),
        usesNonExemptEncryption: false
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#000000"
      },
      package: "com.abmtek.abmapp",
      versionCode: 11,
      googleServicesFile: './google-services.json',
      config: {
        googleMaps: {
          apiKey: getEnv('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY')
        }
      },
      permissions: [
        "CAMERA",
        "NOTIFICATIONS",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION"
      ]
    },
    web: {
      favicon: "./assets/favicon.png",
      bundler: "metro"
    },
    plugins: [
      "expo-router",
      "expo-font",
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: "#ffffff"
        }
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "The app accesses your photos to upload service images."
        }
      ],
      [
        "expo-camera",
        {
          cameraPermission: "The app accesses your camera to capture service images."
        }
      ],
      [
        "expo-build-properties",
        {
          "ios": {
            "useFrameworks": "static",
            "buildReactNativeFromSource": true
          }
        }
      ],
      "./plugins/withFirebaseFixes"
    ],
    scheme: "abmapp",
    extra: {
      eas: {
        projectId: "7be241e0-2bad-4133-a489-251c099fbbe3"
      },
      firebaseApiKey: getEnv('EXPO_PUBLIC_FIREBASE_API_KEY'),
      firebaseAuthDomain: getEnv('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'),
      firebaseProjectId: getEnv('EXPO_PUBLIC_FIREBASE_PROJECT_ID'),
      firebaseStorageBucket: getEnv('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'),
      firebaseMessagingSenderId: getEnv('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
      firebaseAppId: getEnv('EXPO_PUBLIC_FIREBASE_APP_ID'),
      cloudinaryCloudName: getEnv('EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME'),
      cloudinaryUploadPreset: getEnv('EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET'),
      apiBaseUrl: getEnv('EXPO_PUBLIC_API_BASE_URL')
    }
  }
};

