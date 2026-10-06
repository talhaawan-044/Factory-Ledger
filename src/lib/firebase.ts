import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signInWithCredential,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser
} from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  type DocumentReference,
} from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

// Web app's Firebase configuration read from environment variables (.env)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || ""
};

// Initialize Firebase App singleton
export const firebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase Services with offline IndexedDB persistent cache
function initFirestore() {
  try {
    return initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
  } catch {
    return getFirestore(firebaseApp);
  }
}

export const auth = getAuth(firebaseApp);
export const db = initFirestore();

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export interface GoogleUserData {
  displayName: string;
  email: string;
  photoUrl: string;
  uid: string;
}

/**
 * Friendly error parser for Firebase Auth error codes
 */
export function getFriendlyAuthErrorMessage(error: any): string {
  if (!error) return 'An unexpected error occurred.';
  const code = error.code || '';
  const msg = error.message || String(error);

  if (msg.includes('10:') || msg.includes('DEVELOPER_ERROR')) {
    return 'Google Sign-In configuration error (Code 10). Please ensure your Android app (com.coalledger.app) and SHA-1 fingerprint are added in Firebase Console.';
  }
  if (msg.includes('12501') || code === 'auth/popup-closed-by-user' || msg.includes('cancel')) {
    return 'Sign-in was cancelled.';
  }
  switch (code) {
    case 'auth/operation-not-allowed':
    case 'auth/configuration-not-found':
      return 'Google Sign-In is not enabled yet in your Firebase Console. Go to Firebase Console > Build > Authentication > Sign-in method, click Google, and enable it.';
    case 'auth/unauthorized-domain':
      return 'Domain not authorized. Please add this domain or localhost in Firebase Console > Authentication > Settings > Authorized domains.';
    case 'auth/cancelled-popup-request':
      return 'Sign-in attempt was replaced by another attempt.';
    case 'auth/network-request-failed':
      return 'Network connection failed. Please check your internet connection.';
    default:
      return error.message || 'Failed to sign in with Google.';
  }
}

/**
 * Trigger Google Sign In
 * - On Native Android: Opens the Native Google Play Services bottom sheet account picker
 * - On Web / Desktop: Opens the standard popup
 */
export async function loginWithGoogle(): Promise<GoogleUserData> {
  if (Capacitor.isNativePlatform()) {
    try {
      // Native Android Google Play Services account picker
      const result = await FirebaseAuthentication.signInWithGoogle();

      // Bridge native credential to Firebase Web JS SDK for Firestore & cloud persistence
      if (result.credential?.idToken) {
        const credential = GoogleAuthProvider.credential(result.credential.idToken);
        await signInWithCredential(auth, credential);
      }

      const user = result.user;
      if (!user) {
        throw new Error('Google sign-in was cancelled.');
      }

      return {
        displayName: user.displayName || user.email?.split('@')[0] || 'Google User',
        email: user.email || '',
        photoUrl: user.photoUrl || '',
        uid: user.uid,
      };
    } catch (err: any) {
      console.error('Native Google Sign-In error:', err);
      if (err.message && (err.message.includes('12501') || err.message.includes('cancel'))) {
        throw new Error('Sign-in cancelled.');
      }
      throw err;
    }
  }

  // Web browser fallback
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    return {
      displayName: user.displayName || user.email?.split('@')[0] || 'Google User',
      email: user.email || '',
      photoUrl: user.photoURL || '',
      uid: user.uid,
    };
  } catch (error: any) {
    if (error.code === 'auth/popup-blocked') {
      try {
        await signInWithRedirect(auth, googleProvider);
        throw new Error('Redirecting to Google sign in...');
      } catch (redirectErr) {
        throw redirectErr;
      }
    }
    throw error;
  }
}

/**
 * Handle initial/redirect auth check across both native and web
 */
export async function checkRedirectAuth(): Promise<GoogleUserData | null> {
  if (Capacitor.isNativePlatform()) {
    try {
      const current = await FirebaseAuthentication.getCurrentUser();
      if (current.user) {
        const idTokenRes = await FirebaseAuthentication.getIdToken();
        if (idTokenRes.token) {
          const credential = GoogleAuthProvider.credential(idTokenRes.token);
          await signInWithCredential(auth, credential);
        }
        return {
          displayName: current.user.displayName || current.user.email?.split('@')[0] || 'Google User',
          email: current.user.email || '',
          photoUrl: current.user.photoUrl || '',
          uid: current.user.uid,
        };
      }
    } catch (err) {
      console.warn('Native initial auth check error:', err);
    }
    return null;
  }

  try {
    const result = await getRedirectResult(auth);
    if (result && result.user) {
      const user = result.user;
      return {
        displayName: user.displayName || user.email?.split('@')[0] || 'Google User',
        email: user.email || '',
        photoUrl: user.photoURL || '',
        uid: user.uid,
      };
    }
    return null;
  } catch (error) {
    console.error('Redirect sign-in error:', error);
    return null;
  }
}

/**
 * Sign out current Firebase user
 */
export async function logoutUser(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await FirebaseAuthentication.signOut();
    } catch (err) {
      console.warn('Native sign out error:', err);
    }
  }
  await signOut(auth);
}

/**
 * Listen to real-time auth changes
 */
export function subscribeToAuth(callback: (user: GoogleUserData | null) => void) {
  return onAuthStateChanged(auth, (user: FirebaseUser | null) => {
    if (user) {
      callback({
        displayName: user.displayName || user.email?.split('@')[0] || 'Google User',
        email: user.email || '',
        photoUrl: user.photoURL || '',
        uid: user.uid,
      });
    } else {
      callback(null);
    }
  });
}

export interface CloudSyncOptions {
  forceEmptyOverwrite?: boolean;
  tombstones?: Record<string, number>;
}

export interface CloudSyncResult {
  success: boolean;
  timestamp: string;
  protected?: boolean;
  message?: string;
}

/**
 * Strips undefined values, converts NaN/Infinity to 0, and deep clones so Firestore never rejects document fields
 */
function sanitizeForFirestore(obj: any): any {
  if (obj === undefined) return null;
  if (typeof obj === 'number') {
    return isNaN(obj) || !isFinite(obj) ? 0 : obj;
  }
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirestore);
  }
  const result: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== undefined) {
      if (typeof val === 'number') {
        result[key] = isNaN(val) || !isFinite(val) ? 0 : val;
      } else {
        result[key] = sanitizeForFirestore(val);
      }
    }
  }
  return result;
}

/**
 * Commits Firestore operations in chunks of 400 to strictly respect Firestore's 500-op limit
 */
async function commitInBatches(
  operations: Array<{ type: 'set' | 'delete'; ref: DocumentReference; data?: any }>
) {
  const CHUNK_SIZE = 400;
  for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
    const chunk = operations.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const op of chunk) {
      if (op.type === 'set') {
        batch.set(op.ref, op.data, { merge: true });
      } else if (op.type === 'delete') {
        batch.delete(op.ref);
      }
    }
    await batch.commit();
  }
}

/**
 * Sync local ledger to Cloud Firestore using granular subcollections:
 * - users/{uid}/parties/{partyId}
 * - users/{uid}/dispatches/{dispatchId}
 * - users/{uid}/payments/{paymentId}
 * - users/{uid}/pos/{poId}
 * - users/{uid}/settings/config
 * - users/{uid}/meta/sync
 *
 * Automatically includes accidental wipe protection, tombstone deletion, and legacy backup cleanup.
 */
export async function syncLedgerToCloud(
  uid: string,
  backupData: any,
  options?: CloudSyncOptions
): Promise<CloudSyncResult> {
  const now = new Date().toISOString();

  const partiesList: any[] = backupData.parties || [];
  const dispatchesList: any[] = backupData.dispatches || [];
  const paymentsList: any[] = backupData.payments || [];
  const posList: any[] = backupData.pos || [];

  const isLocalEmpty =
    partiesList.length === 0 &&
    dispatchesList.length === 0 &&
    paymentsList.length === 0 &&
    posList.length === 0;

  // Safeguard: Prevent accidental wipe of cloud records if local storage is cleared / empty
  if (isLocalEmpty && !options?.forceEmptyOverwrite) {
    try {
      const existingCloud = await fetchLedgerFromCloud(uid);
      if (existingCloud) {
        const cloudCount =
          (existingCloud.parties?.length || 0) +
          (existingCloud.dispatches?.length || 0) +
          (existingCloud.payments?.length || 0) +
          (existingCloud.pos?.length || 0);

        if (cloudCount > 0) {
          console.warn('[CloudSync] Protected: Prevented accidental wipe of remote cloud database with 0 local records.');
          return {
            success: false,
            timestamp: now,
            protected: true,
            message: 'Cloud backup protected: Local storage has 0 records while remote cloud database contains records.',
          };
        }
      }
    } catch (checkErr) {
      console.warn('[CloudSync] Warning checking existing cloud records:', checkErr);
    }
  }

  const operations: Array<{ type: 'set' | 'delete'; ref: DocumentReference; data?: any }> = [];

  // 1. Parties subcollection
  for (const party of partiesList) {
    if (party.id) {
      operations.push({
        type: 'set',
        ref: doc(db, 'users', uid, 'parties', party.id),
        data: sanitizeForFirestore({ ...party, updatedAt: party.updatedAt || Date.now() }),
      });
    }
  }

  // 2. Dispatches subcollection
  for (const dispatch of dispatchesList) {
    if (dispatch.id) {
      operations.push({
        type: 'set',
        ref: doc(db, 'users', uid, 'dispatches', dispatch.id),
        data: sanitizeForFirestore({ ...dispatch, updatedAt: dispatch.updatedAt || Date.now() }),
      });
    }
  }

  // 3. Payments subcollection
  for (const payment of paymentsList) {
    if (payment.id) {
      operations.push({
        type: 'set',
        ref: doc(db, 'users', uid, 'payments', payment.id),
        data: sanitizeForFirestore({ ...payment, updatedAt: payment.updatedAt || Date.now() }),
      });
    }
  }

  // 4. Purchase Orders subcollection
  for (const po of posList) {
    if (po.id) {
      operations.push({
        type: 'set',
        ref: doc(db, 'users', uid, 'pos', po.id),
        data: sanitizeForFirestore({ ...po, updatedAt: po.updatedAt || Date.now() }),
      });
    }
  }

  // 5. Settings document
  if (backupData.settings) {
    operations.push({
      type: 'set',
      ref: doc(db, 'users', uid, 'settings', 'config'),
      data: sanitizeForFirestore({
        ...backupData.settings,
        updatedAt: backupData.settings.updatedAt || Date.now(),
      }),
    });
  }

  // 6. Metadata document
  operations.push({
    type: 'set',
    ref: doc(db, 'users', uid, 'meta', 'sync'),
    data: sanitizeForFirestore({
      version: backupData.version || '2026.10_clean_production_v2',
      exportDate: backupData.exportDate || now,
      lastCloudSync: now,
      partiesCount: partiesList.length,
      dispatchesCount: dispatchesList.length,
      paymentsCount: paymentsList.length,
      posCount: posList.length,
      totalCount: partiesList.length + dispatchesList.length + paymentsList.length + posList.length,
      updatedAt: serverTimestamp(),
    }),
  });

  // 7. Deletion tombstones (cleanly remove deleted entities from Firestore subcollections)
  if (options?.tombstones) {
    for (const deletedId of Object.keys(options.tombstones)) {
      operations.push({ type: 'delete', ref: doc(db, 'users', uid, 'parties', deletedId) });
      operations.push({ type: 'delete', ref: doc(db, 'users', uid, 'dispatches', deletedId) });
      operations.push({ type: 'delete', ref: doc(db, 'users', uid, 'payments', deletedId) });
      operations.push({ type: 'delete', ref: doc(db, 'users', uid, 'pos', deletedId) });
    }
  }

  // Commit batch writes
  await commitInBatches(operations);

  // Clean up legacy single-document backup (users/{uid}/ledger/backup) so Firebase Console stays clean
  try {
    const legacyDocRef = doc(db, 'users', uid, 'ledger', 'backup');
    await deleteDoc(legacyDocRef);
  } catch (cleanErr) {
    // Non-fatal if legacy doc is already gone or non-existent
  }

  return {
    success: true,
    timestamp: now,
    message: 'Synchronized with Firebase Cloud subcollections successfully.',
  };
}

/**
 * Pull cloud records from Cloud Firestore subcollections:
 * parties, dispatches, payments, pos, settings, and meta.
 * Automatically checks and migrates legacy single-document backup if found.
 */
export async function fetchLedgerFromCloud(uid: string): Promise<any | null> {
  try {
    const [partiesSnap, dispatchesSnap, paymentsSnap, posSnap, settingsSnap, metaSnap] = await Promise.all([
      getDocs(collection(db, 'users', uid, 'parties')),
      getDocs(collection(db, 'users', uid, 'dispatches')),
      getDocs(collection(db, 'users', uid, 'payments')),
      getDocs(collection(db, 'users', uid, 'pos')),
      getDoc(doc(db, 'users', uid, 'settings', 'config')),
      getDoc(doc(db, 'users', uid, 'meta', 'sync')),
    ]);

    const parties = partiesSnap.docs.map((d) => d.data());
    const dispatches = dispatchesSnap.docs.map((d) => d.data());
    const payments = paymentsSnap.docs.map((d) => d.data());
    const pos = posSnap.docs.map((d) => d.data());
    const settings = settingsSnap.exists() ? settingsSnap.data() : null;
    const meta = metaSnap.exists() ? metaSnap.data() : null;

    const totalSubrecords = parties.length + dispatches.length + payments.length + pos.length;

    // Backward-compatibility: Check if legacy single-document backup exists
    if (totalSubrecords === 0 && !settings) {
      const legacyDocRef = doc(db, 'users', uid, 'ledger', 'backup');
      const legacySnap = await getDoc(legacyDocRef);
      if (legacySnap.exists()) {
        const legacyData = legacySnap.data();
        console.log('[CloudSync] Migrating existing legacy single-document data to subcollections...');
        // Migrate to granular subcollections immediately
        await syncLedgerToCloud(uid, legacyData);
        // Clean up legacy doc
        try {
          await deleteDoc(legacyDocRef);
        } catch (e) {
          // ignore
        }
        return legacyData;
      }
      return null;
    }

    return {
      version: meta?.version || '2026.10_clean_production_v2',
      exportDate: meta?.exportDate || new Date().toISOString(),
      lastCloudSync: meta?.lastCloudSync || new Date().toISOString(),
      parties,
      dispatches,
      payments,
      pos,
      settings: settings || {},
    };
  } catch (err: any) {
    console.error('Failed to fetch ledger from Cloud Firestore subcollections:', err);
    throw err;
  }
}

/**
 * Instant write-through for single item creation / update
 */
export async function syncSingleEntityToCloud(
  uid: string,
  entityType: 'party' | 'dispatch' | 'payment' | 'purchase_order' | 'settings',
  item: any
): Promise<void> {
  if (!uid || !item) return;
  try {
    if (entityType === 'settings') {
      const ref = doc(db, 'users', uid, 'settings', 'config');
      await setDoc(ref, sanitizeForFirestore({ ...item, updatedAt: Date.now() }), { merge: true });
      return;
    }
    const collectionName =
      entityType === 'party' ? 'parties' :
      entityType === 'dispatch' ? 'dispatches' :
      entityType === 'payment' ? 'payments' :
      entityType === 'purchase_order' ? 'pos' : null;

    if (collectionName && item.id) {
      const ref = doc(db, 'users', uid, collectionName, item.id);
      await setDoc(ref, sanitizeForFirestore({ ...item, updatedAt: item.updatedAt || Date.now() }), { merge: true });
    }
  } catch (err) {
    console.warn(`[CloudSync] Warning writing single ${entityType} to cloud:`, err);
  }
}

/**
 * Instant deletion for single item in Firestore subcollection
 */
export async function deleteSingleEntityFromCloud(
  uid: string,
  entityType: 'party' | 'dispatch' | 'payment' | 'purchase_order',
  id: string
): Promise<void> {
  if (!uid || !id) return;
  try {
    const collectionName =
      entityType === 'party' ? 'parties' :
      entityType === 'dispatch' ? 'dispatches' :
      entityType === 'payment' ? 'payments' :
      entityType === 'purchase_order' ? 'pos' : null;

    if (collectionName) {
      const ref = doc(db, 'users', uid, collectionName, id);
      await deleteDoc(ref);
    }
  } catch (err) {
    console.warn(`[CloudSync] Warning deleting single ${entityType} from cloud:`, err);
  }
}
