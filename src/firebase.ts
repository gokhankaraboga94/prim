import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAKkEHHeHnfHSN0MpEcJoK4Ix9o2PFbPY8",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "harita-4b58b.firebaseapp.com",
  databaseURL:
    import.meta.env.VITE_FIREBASE_DATABASE_URL ||
    "https://harita-4b58b-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "harita-4b58b",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "harita-4b58b.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "778047554386",
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID || "1:778047554386:web:41f29d854399a1d878b08b",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-ZNSZZC3HVS",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);
export const storage = getStorage(app);
export const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || "admin@servis.com";

export default app;
