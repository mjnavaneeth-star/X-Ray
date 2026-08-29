import { initializeApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as fbSignOut,
  User 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  deleteDoc, 
  updateDoc,
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { ScanRecord, UserPreferences } from '../types';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Test connection on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline status check:', error.message);
    }
  }
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

// Recursively clean objects for Firestore by removing undefined fields
function cleanForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => cleanForFirestore(item)) as any;
  }
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = cleanForFirestore(value);
      }
    }
    return cleaned;
  }
  return obj;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const signInWithGoogle = async (): Promise<User | null> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    // Ensure user profile document exists
    if (result.user) {
      const userDocRef = doc(db, 'users', result.user.uid);
      try {
        const snap = await getDoc(userDocRef);
        if (!snap.exists()) {
          const defaultPrefs: UserPreferences = {
            allergiesAndSensitivities: ['Fragrance / Synthetic Parfum', 'Alcohol Denat / SD Alcohol'],
            sustainabilityPriorities: ['Cruelty-Free / Leaping Bunny', 'Recyclable / Glass Packaging'],
            budgetPreference: 'mid_range',
            skinType: 'combination',
            customWatchlist: []
          };
          await setDoc(userDocRef, {
            uid: result.user.uid,
            email: result.user.email,
            displayName: result.user.displayName,
            photoURL: result.user.photoURL,
            createdAt: new Date().toISOString(),
            preferences: defaultPrefs
          });
        }
      } catch (dbErr) {
        console.warn('Initial user profile bootstrap note:', dbErr);
      }
    }
    return result.user;
  } catch (error: any) {
    if (
      error.code === 'auth/popup-closed-by-user' || 
      error.code === 'auth/cancelled-popup-request' ||
      error.message?.includes('popup-closed-by-user') ||
      error.message?.includes('cancelled-popup-request')
    ) {
      // User closed the popup or clicked outside; handled as clean cancellation
      console.log('Google sign-in popup closed by user.');
      return null;
    }
    if (error.code === 'auth/popup-blocked' || error.message?.includes('popup-blocked')) {
      throw new Error('Sign-in popup was blocked by your browser. Please allow popups or open in a new tab.');
    }
    throw error;
  }
};

export const signOut = () => fbSignOut(auth);

// Firestore Operations strictly scoped to the user
export async function getUserPreferences(userId: string): Promise<UserPreferences> {
  const path = `users/${userId}`;
  try {
    const userDocRef = doc(db, 'users', userId);
    const snap = await getDoc(userDocRef);
    if (snap.exists() && snap.data()?.preferences) {
      return snap.data().preferences as UserPreferences;
    }
    return {
      allergiesAndSensitivities: ['Fragrance / Synthetic Parfum', 'Alcohol Denat / SD Alcohol'],
      sustainabilityPriorities: ['Cruelty-Free / Leaping Bunny', 'Recyclable / Glass Packaging'],
      budgetPreference: 'mid_range',
      skinType: 'combination',
      customWatchlist: [],
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return {
      allergiesAndSensitivities: [],
      sustainabilityPriorities: [],
      customWatchlist: [],
    };
  }
}

export async function saveUserPreferences(userId: string, preferences: UserPreferences): Promise<void> {
  const path = `users/${userId}`;
  try {
    const userDocRef = doc(db, 'users', userId);
    await setDoc(userDocRef, cleanForFirestore({ preferences, updatedAt: new Date().toISOString() }), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveScanRecord(userId: string, scan: ScanRecord): Promise<void> {
  const path = `users/${userId}/scans/${scan.id}`;
  try {
    const scanDocRef = doc(db, 'users', userId, 'scans', scan.id);
    await setDoc(scanDocRef, cleanForFirestore(scan));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateScanRecord(userId: string, scanId: string, updates: Partial<ScanRecord>): Promise<void> {
  const path = `users/${userId}/scans/${scanId}`;
  try {
    const scanDocRef = doc(db, 'users', userId, 'scans', scanId);
    await updateDoc(scanDocRef, cleanForFirestore(updates));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteScanRecord(userId: string, scanId: string): Promise<void> {
  const path = `users/${userId}/scans/${scanId}`;
  try {
    const scanDocRef = doc(db, 'users', userId, 'scans', scanId);
    await deleteDoc(scanDocRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function getUserScans(userId: string): Promise<ScanRecord[]> {
  const path = `users/${userId}/scans`;
  try {
    const scansCol = collection(db, 'users', userId, 'scans');
    const q = query(scansCol, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as ScanRecord);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

