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
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    _internal: {
      isDebug: true
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.abmtek.abmapp"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.abmtek.abmapp",
      permissions: [
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "NOTIFICATIONS"
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
      ]
    ],
    scheme: "abmapp",
    extra: {
      firebaseApiKey: getEnv('EXPO_PUBLIC_FIREBASE_API_KEY'),
      firebaseAuthDomain: getEnv('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'),
      firebaseProjectId: getEnv('EXPO_PUBLIC_FIREBASE_PROJECT_ID'),
      firebaseStorageBucket: getEnv('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'),
      firebaseMessagingSenderId: getEnv('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
      firebaseAppId: getEnv('EXPO_PUBLIC_FIREBASE_APP_ID'),
      paystackPublicKey: getEnv('EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY'),
      flutterwavePublicKey: getEnv('EXPO_PUBLIC_FLUTTERWAVE_PUBLIC_KEY')
    }
  }
};

