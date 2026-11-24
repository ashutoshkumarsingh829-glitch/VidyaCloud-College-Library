import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const requiredConfig = Object.keys(firebaseConfig);
const placeholderValue = /^(?:your_|replace_|placeholder|example)|your[_ -]project|your[_ -]sender/i;
const isPlainHost = (value) =>
  typeof value === 'string' &&
  !/[/:?#\s]/.test(value) &&
  (/^[a-z\d](?:[a-z\d.-]*[a-z\d])?$/i.test(value) || value === 'localhost');

const configValidators = {
  apiKey: (value) => /^AIza[0-9A-Za-z_-]{20,}$/.test(value),
  authDomain: isPlainHost,
  projectId: (value) => /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(value),
  storageBucket: (value) => isPlainHost(value),
  messagingSenderId: (value) => /^\d+$/.test(value),
  appId: (value) => /^1:\d+:web:[a-f0-9]+$/i.test(value),
};

export const firebaseConfigIssues = requiredConfig
  .filter((key) => {
    const value = firebaseConfig[key]?.trim();
    return !value || placeholderValue.test(value) || !configValidators[key](value);
  })
  .map((key) => `VITE_FIREBASE_${key.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`);

export let firebaseInitializationError = '';
export let firebaseApp = null;
export let auth = null;
export let db = null;
export let functions = null;
export let storage = null;

if (firebaseConfigIssues.length === 0) {
  try {
    firebaseApp = getApps().some((app) => app.name === '[DEFAULT]')
      ? getApp()
      : initializeApp(firebaseConfig);
    auth = getAuth(firebaseApp);
    db = getFirestore(firebaseApp);
    functions = getFunctions(firebaseApp, 'us-central1');
    storage = getStorage(firebaseApp);
  } catch (error) {
    firebaseApp = null;
    auth = null;
    db = null;
    functions = null;
    storage = null;
    firebaseInitializationError =
      error instanceof Error ? error.message : 'Firebase could not be initialized.';
  }
}

export const firebaseConfigured = Boolean(
  firebaseConfigIssues.length === 0 && firebaseApp && auth && db && functions && storage,
);
