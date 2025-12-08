import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import Constants from 'expo-constants';

const getConfigValue = (extraKey: string): string => {
  const value = Constants.expoConfig?.extra?.[extraKey];
  const trimmed = value ? String(value).trim() : '';
  
  if (__DEV__ && !trimmed) {
    console.warn(`Missing Firebase config: ${extraKey}`);
    console.warn(`Available extra keys:`, Object.keys(Constants.expoConfig?.extra || {}));
  }
  
  return trimmed;
};

const requiredConfigKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];

const firebaseConfig = {
  apiKey: getConfigValue('firebaseApiKey'),
  authDomain: getConfigValue('firebaseAuthDomain'),
  projectId: getConfigValue('firebaseProjectId'),
  storageBucket: getConfigValue('firebaseStorageBucket'),
  messagingSenderId: getConfigValue('firebaseMessagingSenderId'),
  appId: getConfigValue('firebaseAppId'),
};

const missingKeys = requiredConfigKeys.filter(key => !firebaseConfig[key as keyof typeof firebaseConfig]);

if (__DEV__) {
  const hasAllConfig = requiredConfigKeys.every(key => firebaseConfig[key as keyof typeof firebaseConfig]);
  if (!hasAllConfig) {
    console.warn('Firebase configuration incomplete.');
    console.warn('Constants.expoConfig exists:', !!Constants.expoConfig);
    console.warn('Constants.expoConfig.extra exists:', !!Constants.expoConfig?.extra);
    console.warn('Available extra keys:', Object.keys(Constants.expoConfig?.extra || {}));
    console.warn('Missing keys:', missingKeys);
    console.warn('Check your .env file and restart Expo server with: npm start -- --clear');
  }
}

if (missingKeys.length > 0) {
  console.error(
    'Missing Firebase configuration values:',
    missingKeys.join(', '),
    '\n\nPlease set these in your .env file or app.config.js\nSee .env.example for reference.'
  );
  throw new Error(`Missing Firebase configuration: ${missingKeys.join(', ')}`);
}

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;

