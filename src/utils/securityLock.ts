/**
 * securityLock.ts
 * Manages Passcode PIN, Fingerprint / Biometric authentication,
 * and App Locking lifecycle for Factory Ledger.
 */

import { registerPlugin, Capacitor } from '@capacitor/core';

interface AppBiometricPluginInterface {
  isAvailable(): Promise<{ available: boolean }>;
  authenticate(): Promise<{ success: boolean; error?: string; errorCode?: number }>;
}

const AppBiometric = registerPlugin<AppBiometricPluginInterface>('AppBiometric');

const LOCK_ENABLED_KEY = 'coal_app_lock_enabled';
const BIOMETRIC_ENABLED_KEY = 'coal_biometric_enabled';
const PIN_HASH_KEY = 'coal_app_pin_hash';
const PIN_LENGTH_KEY = 'coal_pin_length';
const LOCK_TIMEOUT_KEY = 'coal_lock_timeout'; // in seconds: 0 = immediate, 60 = 1 min, 300 = 5 min
const LAST_ACTIVE_KEY = 'coal_last_active_time';
const BIOMETRIC_CRED_ID_KEY = 'coal_biometric_cred_id';
const RECOVERY_KEY_KEY = 'coal_app_recovery_key';

export const DEFAULT_PIN_LENGTH = 5;

// Session state (in-memory, lost on full app reload, but checked on startup)
let isLockedInMemory = false;

// Compute SHA-256 hash of PIN
export async function hashPin(pin: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(pin + '_factory_ledger_salt_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function isAppLockEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(LOCK_ENABLED_KEY) === 'true';
}

export function getPinLength(): number {
  if (typeof window === 'undefined') return DEFAULT_PIN_LENGTH;
  const stored = localStorage.getItem(PIN_LENGTH_KEY);
  if (stored) {
    const parsed = parseInt(stored, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  // Backward-compatibility: If an existing PIN hash exists without a recorded length, it is a legacy 4-digit PIN
  if (getStoredPinHash()) {
    return 4;
  }
  return DEFAULT_PIN_LENGTH;
}

export function setPinLength(length: number): void {
  localStorage.setItem(PIN_LENGTH_KEY, String(length));
}

export function isBiometricEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true';
}

export function setBiometricEnabled(enabled: boolean): void {
  localStorage.setItem(BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false');
  notifyLockStatusChanged();
}

export function getStoredPinHash(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(PIN_HASH_KEY);
}

export function getLockTimeout(): number {
  if (typeof window === 'undefined') return 0;
  const val = localStorage.getItem(LOCK_TIMEOUT_KEY);
  return val ? parseInt(val, 10) : 0;
}

export function setLockTimeout(seconds: number) {
  localStorage.setItem(LOCK_TIMEOUT_KEY, String(seconds));
  notifyLockStatusChanged();
}

/**
 * Check if the device hardware supports platform biometrics (Fingerprint / Face ID)
 */
export async function isBiometricAvailable(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await AppBiometric.isAvailable();
      return Boolean(res?.available);
    } catch (err) {
      console.warn('Native biometric availability check failed:', err);
      return false;
    }
  }

  try {
    if (
      typeof window !== 'undefined' &&
      window.PublicKeyCredential &&
      typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
    ) {
      return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
  } catch (err) {
    console.warn('Biometric check error:', err);
  }
  return false;
}

/**
 * Register biometric platform authenticator
 */
export async function registerBiometrics(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    const available = await isBiometricAvailable();
    if (available) {
      localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
      notifyLockStatusChanged();
      return true;
    }
    return false;
  }

  try {
    if (!window.PublicKeyCredential) return false;

    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    const userId = new Uint8Array(16);
    crypto.getRandomValues(userId);

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'Factory Ledger',
          id: window.location.hostname || 'localhost',
        },
        user: {
          id: userId,
          name: 'factory-ledger-admin',
          displayName: 'Factory Ledger Operator',
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },  // ES256
          { alg: -257, type: 'public-key' }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'discouraged',
        },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;

    if (credential && credential.id) {
      localStorage.setItem(BIOMETRIC_CRED_ID_KEY, credential.id);
      localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
      notifyLockStatusChanged();
      return true;
    }
  } catch (err: any) {
    console.warn('Biometric registration error/cancelled:', err);
    // If registration fails or cancelled, user can still use PIN
  }
  return false;
}

/**
 * Authenticate using device Fingerprint / Biometrics
 */
export async function authenticateWithBiometrics(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await AppBiometric.authenticate();
      if (res && res.success) {
        unlockSession();
        return true;
      }
    } catch (err: any) {
      console.warn('Native biometric authentication error:', err);
    }
    return false;
  }

  try {
    if (!window.PublicKeyCredential) return false;

    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const credId = localStorage.getItem(BIOMETRIC_CRED_ID_KEY);
    const allowCredentials: PublicKeyCredentialDescriptor[] = credId
      ? [
          {
            id: Uint8Array.from(atob(credId.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)),
            type: 'public-key',
          },
        ]
      : [];

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: window.location.hostname || 'localhost',
        userVerification: 'required',
        allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
        timeout: 60000,
      },
    });

    if (assertion) {
      unlockSession();
      return true;
    }
  } catch (err: any) {
    console.warn('Biometric authentication failed or cancelled:', err);
  }
  return false;
}

/**
 * Enable App Lock with a given PIN (now 5 digits standard)
 */
export async function enableAppLock(pin: string, enableBio = true): Promise<void> {
  const hash = await hashPin(pin);
  localStorage.setItem(PIN_HASH_KEY, hash);
  localStorage.setItem(PIN_LENGTH_KEY, String(pin.length));
  localStorage.setItem(LOCK_ENABLED_KEY, 'true');
  getOrCreateRecoveryKey();
  if (enableBio) {
    const supported = await isBiometricAvailable();
    if (supported) {
      await registerBiometrics();
    }
  }
  notifyLockStatusChanged();
}

/**
 * Disable App Lock completely
 */
export function disableAppLock(): void {
  localStorage.removeItem(LOCK_ENABLED_KEY);
  localStorage.removeItem(PIN_HASH_KEY);
  localStorage.removeItem(PIN_LENGTH_KEY);
  localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
  localStorage.removeItem(BIOMETRIC_CRED_ID_KEY);
  localStorage.removeItem(RECOVERY_KEY_KEY);
  isLockedInMemory = false;
  notifyLockStatusChanged();
}

/**
 * Update PIN
 */
export async function updatePin(newPin: string): Promise<void> {
  const hash = await hashPin(newPin);
  localStorage.setItem(PIN_HASH_KEY, hash);
  localStorage.setItem(PIN_LENGTH_KEY, String(newPin.length));
  notifyLockStatusChanged();
}

/**
 * Offline Master Recovery Key Management:
 * Generates an 8-character alphanumeric master key formatted as FL-XXXX-XXXX
 * using an unambiguous character set (no 0/O, no 1/I).
 */
export function generateRecoveryKey(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let part1 = '';
  let part2 = '';
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 4; i++) part1 += chars[arr[i] % chars.length];
  for (let i = 4; i < 8; i++) part2 += chars[arr[i] % chars.length];
  return `FL-${part1}-${part2}`;
}

export function getStoredRecoveryKey(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(RECOVERY_KEY_KEY);
}

export function getOrCreateRecoveryKey(): string {
  if (typeof window === 'undefined') return 'FL-8888-8888';
  let key = localStorage.getItem(RECOVERY_KEY_KEY);
  if (!key) {
    key = generateRecoveryKey();
    localStorage.setItem(RECOVERY_KEY_KEY, key);
  }
  return key;
}

export function regenerateRecoveryKey(): string {
  const key = generateRecoveryKey();
  if (typeof window !== 'undefined') {
    localStorage.setItem(RECOVERY_KEY_KEY, key);
  }
  return key;
}

export function verifyRecoveryKey(inputKey: string): boolean {
  if (!inputKey) return false;
  const storedKey = getStoredRecoveryKey();
  if (!storedKey) return false;
  const clean = (k: string) => k.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return clean(inputKey) === clean(storedKey);
}

export async function resetPinWithRecoveryKey(newPin: string): Promise<void> {
  await updatePin(newPin);
  unlockSession();
}

/**
 * Apply security settings from cloud profile (e.g. upon login on a new device or account switch)
 */
export function applyCloudSecuritySettings(
  cloudSettings?: {
    appLockEnabled?: boolean;
    pinHash?: string;
    pinLength?: number;
    lockTimeout?: number;
  },
  shouldLockSession = true
): void {
  if (!cloudSettings) return;

  if (cloudSettings.appLockEnabled && cloudSettings.pinHash) {
    localStorage.setItem(LOCK_ENABLED_KEY, 'true');
    localStorage.setItem(PIN_HASH_KEY, cloudSettings.pinHash);
    const len = cloudSettings.pinLength || (cloudSettings.pinHash ? (cloudSettings.pinLength || 5) : 5);
    localStorage.setItem(PIN_LENGTH_KEY, String(len));
    if (typeof cloudSettings.lockTimeout === 'number') {
      localStorage.setItem(LOCK_TIMEOUT_KEY, String(cloudSettings.lockTimeout));
    }
    // Note: Do NOT auto-enable biometrics on a new/different device until user explicitly configures it on this hardware
    localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
    localStorage.removeItem(BIOMETRIC_CRED_ID_KEY);

    if (shouldLockSession) {
      lockSession();
    } else {
      notifyLockStatusChanged();
    }
  } else if (cloudSettings.appLockEnabled === false) {
    disableAppLock();
  }
}

/**
 * Verify typed PIN
 */
export async function verifyPin(pin: string): Promise<boolean> {
  const storedHash = getStoredPinHash();
  if (!storedHash) return true;
  const hash = await hashPin(pin);
  const isValid = hash === storedHash;
  if (isValid) {
    unlockSession();
  }
  return isValid;
}

/**
 * Check if session is currently locked
 */
export function isSessionLocked(): boolean {
  if (!isAppLockEnabled()) return false;
  return isLockedInMemory;
}

/**
 * Manually lock the app immediately
 */
export function lockSession(): void {
  if (!isAppLockEnabled()) return;
  isLockedInMemory = true;
  notifyLockStatusChanged();
}

/**
 * Unlock the session
 */
export function unlockSession(): void {
  isLockedInMemory = false;
  recordActivity();
  notifyLockStatusChanged();
}

/**
 * Record user activity timestamp
 */
export function recordActivity(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
}

/**
 * Evaluate whether app should be locked based on elapsed time
 */
export function evaluateLockOnResume(): boolean {
  if (!isAppLockEnabled()) {
    isLockedInMemory = false;
    return false;
  }

  const timeoutSec = getLockTimeout();
  const lastActiveStr = localStorage.getItem(LAST_ACTIVE_KEY);
  const lastActive = lastActiveStr ? parseInt(lastActiveStr, 10) : 0;
  const elapsedSec = (Date.now() - lastActive) / 1000;

  if (lastActive === 0 || elapsedSec >= timeoutSec) {
    isLockedInMemory = true;
    notifyLockStatusChanged();
    return true;
  }
  return isLockedInMemory;
}

export function notifyLockStatusChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('coal_lock_status_changed'));
  }
}
