import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";


// REPLACE THIS OBJECT WITH YOUR ACTUAL KEYS FROM FIREBASE CONSOLE
const firebaseConfig = {
  apiKey: "AIzaSyCBCGGV04oRuXjKdBMSRJgLj7xwHSHKM0U",
  authDomain: "agapay-9505c.firebaseapp.com",
  projectId: "agapay-9505c",
  storageBucket: "agapay-9505c.firebasestorage.app",
  messagingSenderId: "843643906560",
  appId: "1:843643906560:web:dee64d9d0ff7dbca5c86e5",
  measurementId: "G-4ZPLEE2167"
};

// Initialize Firebase (Singleton pattern to prevent re-initialization errors)
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

export { db, storage };