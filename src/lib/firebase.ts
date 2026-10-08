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
  updateDoc,
  deleteField,
  type DocumentReference,
} from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { markRecordsClean } from './db';

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

/**
 * Validates whether valid Firebase environment credentials are configured.
 * If false, app seamlessly falls back to offline-only local storage mode.
 */
export const isFirebaseConfigured: boolean = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey.trim().length > 0 &&
  firebaseConfig.apiKey !== 'your-firebase-api-key' &&
  firebaseConfig.projectId &&
  firebaseConfig.projectId.trim().length > 0
);

// Initialize Firebase App singleton safely
export const firebaseApp = isFirebaseConfigured
  ? (!getApps().length ? initializeApp(firebaseConfig) : getApp())
  : (null as any);

// Initialize Firebase Services with offline IndexedDB persistent cache
function initFirestore() {
  if (!isFirebaseConfigured || !firebaseApp) return null as any;
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

export const auth = isFirebaseConfigured && firebaseApp ? getAuth(firebaseApp) : ({ currentUser: null } as any);
export const db = initFirestore();

export const googleProvider = isFirebaseConfigured ? (() => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account'
  });
  return provider;
})() : (null as any);

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
    return 'Google Sign-In configuration error (Code 10). Please ensure your Android app (com.factoryledger.app) and SHA-1 fingerprint are added in Firebase Console.';
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
  if (!isFirebaseConfigured) {
    throw new Error('Firebase configuration missing. The app is running in offline-only mode. Set up your Firebase project in .env to enable Google Sign-In.');
  }

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
  if (!isFirebaseConfigured) return null;

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
  if (!isFirebaseConfigured) return;

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
  if (!isFirebaseConfigured || !auth || typeof auth.onAuthStateChanged !== 'function') {
    callback(null);
    return () => {};
  }
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
  deltaOnly?: boolean;
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

  if (!isFirebaseConfigured || !db) {
    return {
      success: false,
      timestamp: now,
      message: 'Offline-only mode: Firebase cloud synchronization is not configured.',
    };
  }

  const rawParties: any[] = backupData.parties || [];
  const rawDispatches: any[] = backupData.dispatches || [];
  const rawPayments: any[] = backupData.payments || [];
  const rawPos: any[] = backupData.pos || [];

  const partiesList: any[] = options?.deltaOnly ? rawParties.filter((p) => p.dirty) : rawParties;
  const dispatchesList: any[] = options?.deltaOnly ? rawDispatches.filter((d) => d.dirty) : rawDispatches;
  const paymentsList: any[] = options?.deltaOnly ? rawPayments.filter((p) => p.dirty) : rawPayments;
  const posList: any[] = options?.deltaOnly ? rawPos.filter((po) => po.dirty) : rawPos;

  const isLocalEmpty =
    rawParties.length === 0 &&
    rawDispatches.length === 0 &&
    rawPayments.length === 0 &&
    rawPos.length === 0;

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
  const syncedPartyIds: string[] = [];
  const syncedDispatchIds: string[] = [];
  const syncedPaymentIds: string[] = [];
  const syncedPoIds: string[] = [];

  // 1. Parties subcollection
  for (const party of partiesList) {
    if (party.id) {
      operations.push({
        type: 'set',
        ref: doc(db, 'users', uid, 'parties', party.id),
        data: sanitizeForFirestore({ ...party, updatedAt: party.updatedAt || Date.now() }),
      });
      syncedPartyIds.push(party.id);
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
      syncedDispatchIds.push(dispatch.id);
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
      syncedPaymentIds.push(payment.id);
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
      syncedPoIds.push(po.id);
    }
  }

  // 5. Settings document (strictly strips sensitive PIN and device lock credentials per Issue 14)
  if (backupData.settings) {
    const cloudSettings = { ...backupData.settings };
    delete cloudSettings.pinHash;
    delete cloudSettings.pinLength;
    delete cloudSettings.lockTimeout;
    delete cloudSettings.appLockEnabled;

    operations.push({
      type: 'set',
      ref: doc(db, 'users', uid, 'settings', 'config'),
      data: sanitizeForFirestore({
        ...cloudSettings,
        updatedAt: cloudSettings.updatedAt || Date.now(),
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
      partiesCount: rawParties.length,
      dispatchesCount: rawDispatches.length,
      paymentsCount: rawPayments.length,
      posCount: rawPos.length,
      totalCount: rawParties.length + rawDispatches.length + rawPayments.length + rawPos.length,
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

  // Issue 11: Mark synced records clean in IndexedDB
  try {
    await markRecordsClean({
      partyIds: syncedPartyIds,
      dispatchIds: syncedDispatchIds,
      paymentIds: syncedPaymentIds,
      poIds: syncedPoIds,
    });
  } catch (cleanErr) {
    console.warn('[CloudSync] Warning marking records clean:', cleanErr);
  }

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
  if (!isFirebaseConfigured || !db) return null;
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
  if (!isFirebaseConfigured || !db || !uid || !item) return;
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
  id: string,
  deletedAt = Date.now()
): Promise<void> {
  if (!isFirebaseConfigured || !db || !uid || !id) return;
  try {
    const collectionName =
      entityType === 'party' ? 'parties' :
      entityType === 'dispatch' ? 'dispatches' :
      entityType === 'payment' ? 'payments' :
      entityType === 'purchase_order' ? 'pos' : null;

    if (collectionName) {
      const ref = doc(db, 'users', uid, collectionName, id);
      await setDoc(
        ref,
        {
          id,
          deleted: true,
          deletedAt,
          updatedAt: deletedAt,
        },
        { merge: true }
      );
    }
  } catch (err) {
    console.warn(`[CloudSync] Warning soft-deleting single ${entityType} in cloud:`, err);
  }
}

/**
 * Issue 17: Fully wipe user's ledger data from Cloud Firestore
 */
export async function wipeCloudUserData(uid: string): Promise<{ success: boolean; message: string }> {
  if (!uid) return { success: false, message: 'No authenticated user ID provided' };
  if (!isFirebaseConfigured || !db) return { success: true, message: 'Offline mode: no cloud database to wipe.' };

  try {
    const subcollections = ['parties', 'dispatches', 'payments', 'pos'];
    const operations: Array<{ type: 'set' | 'delete'; ref: DocumentReference }> = [];

    for (const sub of subcollections) {
      try {
        const snap = await getDocs(collection(db, 'users', uid, sub));
        snap.forEach((docSnap) => {
          operations.push({ type: 'delete', ref: docSnap.ref });
        });
      } catch (err) {
        console.warn(`[CloudWipe] Warning querying subcollection ${sub}:`, err);
      }
    }

    // Also delete config, meta, and legacy backup
    operations.push({ type: 'delete', ref: doc(db, 'users', uid, 'settings', 'config') });
    operations.push({ type: 'delete', ref: doc(db, 'users', uid, 'meta', 'sync') });
    operations.push({ type: 'delete', ref: doc(db, 'users', uid, 'ledger', 'backup') });

    await commitInBatches(operations);
    return { success: true, message: 'Cloud database wiped cleanly.' };
  } catch (err: any) {
    console.error('[CloudWipe] Error wiping cloud database:', err);
    return { success: false, message: err?.message || 'Failed to wipe cloud database' };
  }
}

/**
 * One-time cloud purge for legacy security fields (pinHash, pinLength, lockTimeout, appLockEnabled)
 * previously stored in Firestore under users/{uid}/settings/config (Issue 23).
 * Protects accounts that synced before the local PIN security hardening fix.
 */
export async function purgeLegacySecurityFieldsFromCloud(uid: string): Promise<void> {
  if (!isFirebaseConfigured || !db || !uid) return;
  const flag = `fl_cloud_security_purged_v1:${uid}`;
  if (typeof localStorage !== 'undefined' && localStorage.getItem(flag)) return;

  try {
    const ref = doc(db, 'users', uid, 'settings', 'config');
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      const stale = ['pinHash', 'pinLength', 'lockTimeout', 'appLockEnabled'].filter((k) => k in data);
      if (stale.length > 0) {
        console.log(`[Firebase] Purging ${stale.length} legacy PIN security fields from cloud for user:`, uid);
        await updateDoc(ref, Object.fromEntries(stale.map((k) => [k, deleteField()])));
      }
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(flag, '1');
    }
  } catch (err) {
    console.warn('[Firebase] Warning: Failed to purge legacy security fields from cloud:', err);
  }
}


