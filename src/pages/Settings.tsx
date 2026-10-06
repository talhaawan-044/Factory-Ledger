import { useEffect, useState, useRef } from 'react';
import {
  getSettings,
  saveSettings,
  clearAllData,
  getDispatches,
  getParties,
  getAllBackupData,
  restoreBackup
} from '../lib/db';
import type { AppSettings } from '../types';
import {
  User,
  Building2,
  Phone,
  Image,
  Moon,
  Sun,
  Check,
  Download,
  Upload,
  Trash2,
  ChevronRight,
  ChevronDown,
  Smartphone,
  Coins,
  Globe,
  FileText,
  MapPin,
  Volume2,
  VolumeX,
  PenLine,
  Camera,
  Loader2,
  Cloud,
  LogOut,
  RefreshCw
} from 'lucide-react';
import { triggerConfetti, playSuccessSound, playPopSound, playCashChime } from '../utils/delight';
import { processImageFile } from '../utils/imageUtils';
import IOSConfirmModal from '../components/IOSConfirmModal';
import {
  loginWithGoogle,
  checkRedirectAuth,
  getFriendlyAuthErrorMessage,
} from '../lib/firebase';
import { useSyncStatus, type LoginScenarioResult } from '../lib/syncManager';
import { useLedgerListener } from '../hooks/useLedgerListener';
import {
  AccountSwitchModal,
  AnonymousConflictModal,
  SignOutActionSheet,
} from '../components/AccountSyncModals';

function GoogleLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings>({
    userName: '',
    businessName: '',
    phoneNumber: '',
    logoUrl: '',
    signatureUrl: '',
    companyAddress: '',
    ntnNumber: '',
    theme: 'light',
  });
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [stats, setStats] = useState({ dispatches: 0, parties: 0 });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('coal_sound_enabled') !== 'false');
  const [isLogoUploading, setIsLogoUploading] = useState(false);
  const [isSignatureUploading, setIsSignatureUploading] = useState(false);
  const [systemPrefersDark, setSystemPrefersDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  // Collapsible dropdown groups (all collapsed by default)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    google: false,
    business: false,
    appearance: false,
    currency: false,
    backup: false,
  });

  // Cloud Sync & Auth Manager
  const {
    status: syncStatus,
    lastSyncTime,
    isOnline,
    hasPendingChanges,
    isAutoSyncEnabled: autoSyncEnabled,
    currentUser: googleUser,
    syncNow,
    restoreFromCloud,
    setAutoSyncEnabled,
    checkLoginScenario,
    resolveLoginDecision,
    handleSignOut,
  } = useSyncStatus();

  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRestoringFromCloud, setIsRestoringFromCloud] = useState(false);
  const [switchScenario, setSwitchScenario] = useState<LoginScenarioResult | null>(null);
  const [conflictScenario, setConflictScenario] = useState<LoginScenarioResult | null>(null);
  const [isSignOutSheetOpen, setIsSignOutSheetOpen] = useState(false);

  // Auto-refresh settings and stats when any mutation or cloud sync happens
  useLedgerListener(() => {
    Promise.all([getSettings(), getDispatches(), getParties()]).then(([s, d, p]) => {
      setSettings(s);
      setStats({ dispatches: d.length, parties: p.length });
    });
  });

  // Handle any redirect logins on web
  useEffect(() => {
    checkRedirectAuth()
      .then((redirectUser) => {
        if (redirectUser) {
          showToast('Signed in with Google!');
        }
      })
      .catch((err) => console.error('Redirect auth check error:', err));
  }, []);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    playPopSound();
    try {
      const user = await loginWithGoogle();
      localStorage.setItem('coal_google_user', JSON.stringify(user));

      // Analyze real-world scenario (account switch, anonymous conflict, or clean ready)
      const scenario = await checkLoginScenario(user);

      if (scenario.type === 'account_switch') {
        setSwitchScenario(scenario);
      } else if (scenario.type === 'anonymous_conflict') {
        setConflictScenario(scenario);
      } else {
        playSuccessSound();
        triggerConfetti();
        showToast(scenario.message || 'Signed in with Google successfully!');
        const [s, d, p] = await Promise.all([getSettings(), getDispatches(), getParties()]);
        setSettings(s);
        setStats({ dispatches: d.length, parties: p.length });
      }
    } catch (err: any) {
      console.error('Google Sign-in error:', err);
      if (err.message && err.message.includes('Redirecting to Google sign in')) {
        showToast('Redirecting to Google Sign-In...');
        return;
      }
      const friendlyMsg = getFriendlyAuthErrorMessage(err);
      alert(friendlyMsg);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleGoogleSignOut = () => {
    playPopSound();
    setIsSignOutSheetOpen(true);
  };

  const handleConfirmSignOut = async (mode: 'keep_data' | 'clear_data') => {
    setIsSignOutSheetOpen(false);
    playPopSound();
    try {
      const res = await handleSignOut(mode);
      showToast(res.message);
      const [s, d, p] = await Promise.all([getSettings(), getDispatches(), getParties()]);
      setSettings(s);
      setStats({ dispatches: d.length, parties: p.length });
    } catch (err: any) {
      console.error('Sign out error:', err);
      showToast('Error signing out');
    }
  };

  const handleManualSync = async () => {
    if (!googleUser) {
      showToast('Please sign in with Google first');
      return;
    }
    setIsSyncing(true);
    playPopSound();
    try {
      const result = await syncNow(true);
      if (result.success) {
        playCashChime();
        showToast('All ledgers synchronized with Firebase Cloud');
      } else if (result.protected) {
        showToast('Cloud backup preserved (Local storage is empty)');
      } else {
        alert('Cloud Sync: ' + (result.message || 'Failed to sync'));
      }
    } catch (err: any) {
      console.error('Cloud Sync error:', err);
      alert('Cloud Sync Error: ' + (err.message || 'Failed to sync data to Firebase'));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCloudRestore = async () => {
    if (!googleUser) {
      showToast('Please sign in with Google first');
      return;
    }
    if (!confirm('Restore ledgers and parties from Firebase Cloud? This will merge and download your cloud records to this device.')) {
      return;
    }
    setIsRestoringFromCloud(true);
    playPopSound();
    try {
      const result = await restoreFromCloud();
      if (result.success) {
        playSuccessSound();
        triggerConfetti();
        showToast('Restored successfully from Firebase Cloud! 🎉');
        const [s, d, p] = await Promise.all([getSettings(), getDispatches(), getParties()]);
        setSettings(s);
        setStats({ dispatches: d.length, parties: p.length });
      } else {
        alert(result.message || 'Failed to restore backup');
      }
    } catch (err: any) {
      console.error('Cloud restore error:', err);
      alert('Failed to restore from Firebase Cloud: ' + (err.message || 'Error'));
    } finally {
      setIsRestoringFromCloud(false);
    }
  };

  const toggleSection = (sectionKey: string) => {
    playPopSound();
    setOpenSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    Promise.all([getSettings(), getDispatches(), getParties()]).then(([s, d, p]) => {
      setSettings(s);
      setStats({ dispatches: d.length, parties: p.length });
      setLoading(false);
    });
  }, []);

  const handleChange = (field: keyof AppSettings, value: string) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await saveSettings(settings);
    setSaved(true);
    playSuccessSound();
    triggerConfetti();
    showToast('Settings saved');
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsLogoUploading(true);
      const dataUrl = await processImageFile(file, { maxWidth: 400, maxHeight: 400, quality: 0.85 });
      const updated = { ...settings, logoUrl: dataUrl };
      setSettings(updated);
      await saveSettings(updated);
      playSuccessSound();
      showToast('logo updated');
    } catch (err: any) {
      alert(err.message || 'Failed to process logo');
    } finally {
      setIsLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const [showRemoveLogoConfirm, setShowRemoveLogoConfirm] = useState(false);
  const [showRemoveSignatureConfirm, setShowRemoveSignatureConfirm] = useState(false);

  const handleRemoveLogo = (e: React.MouseEvent) => {
    e.stopPropagation();
    playPopSound();
    setShowRemoveLogoConfirm(true);
  };

  const handleConfirmRemoveLogo = async () => {
    const updated = { ...settings, logoUrl: '' };
    setSettings(updated);
    await saveSettings(updated);
    setShowRemoveLogoConfirm(false);
    playPopSound();
    showToast('Logo removed');
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsSignatureUploading(true);
      const dataUrl = await processImageFile(file, { maxWidth: 500, maxHeight: 250, quality: 0.85, preferPng: true });
      const updated = { ...settings, signatureUrl: dataUrl };
      setSettings(updated);
      await saveSettings(updated);
      playSuccessSound();
      showToast('Authorized signature updated successfully');
    } catch (err: any) {
      alert(err.message || 'Failed to process signature image');
    } finally {
      setIsSignatureUploading(false);
      if (signatureInputRef.current) signatureInputRef.current.value = '';
    }
  };

  const handleRemoveSignature = (e: React.MouseEvent) => {
    e.stopPropagation();
    playPopSound();
    setShowRemoveSignatureConfirm(true);
  };

  const handleConfirmRemoveSignature = async () => {
    const updated = { ...settings, signatureUrl: '' };
    setSettings(updated);
    await saveSettings(updated);
    setShowRemoveSignatureConfirm(false);
    playPopSound();
    showToast('Signature removed');
  };

  {/* const handleAccentChange = (accent: string) => {
    localStorage.setItem('coal_accent_theme', accent);
    const root = document.documentElement;
    ['theme-emerald', 'theme-violet', 'theme-amber', 'theme-crimson'].forEach((cls) => {
      root.classList.remove(cls);
    });
    if (accent !== 'blue' && accent !== 'sapphire') {
      root.classList.add(`theme-${accent}`);
    }
    playPopSound();
    showToast(`Accent updated to ${accent.charAt(0).toUpperCase() + accent.slice(1)}`);
  }; */}

  const handleSoundToggle = (enabled: boolean) => {
    setSoundEnabled(enabled);
    localStorage.setItem('coal_sound_enabled', String(enabled));
    if (enabled) {
      playCashChime();
      showToast('Sound effects enabled');
    } else {
      showToast('Sound effects muted');
    }
  };

  const handleThemeChange = async (theme: 'light' | 'dark' | 'system') => {
    const updated = { ...settings, theme };
    setSettings(updated);
    await saveSettings(updated);
    const isDark =
      theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
        : theme === 'dark';
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    playPopSound();
    const label =
      theme === 'system'
        ? `Switched to System Mode (${isDark ? 'Dark' : 'Light'})`
        : theme === 'dark'
          ? 'Switched to Dark Mode'
          : 'Switched to Light Mode';
    showToast(label);
  };

  const handleExportData = async () => {
    try {
      const fullBackup = await getAllBackupData();
      const blob = new Blob([JSON.stringify(fullBackup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `coal-ledger-full-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Full database backup exported');
    } catch {
      alert('Failed to generate export backup');
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const result = await restoreBackup(json);
      if (result.success && result.counts) {
        alert(
          `Backup Restored Successfully!\n\n` +
          `• Parties: ${result.counts.parties}\n` +
          `• Dispatches: ${result.counts.dispatches}\n` +
          `• Payments: ${result.counts.payments}\n` +
          `• Purchase Orders: ${result.counts.pos}`
        );
        window.location.reload();
      } else {
        alert(`Restore Failed: ${result.message}`);
      }
    } catch {
      alert('Failed to parse the backup file. Please ensure it is a valid JSON file exported from Factory Ledger.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleClear = () => {
    playPopSound();
    setShowClearConfirm(true);
  };

  const handleConfirmClear = async () => {
    await clearAllData();
    setShowClearConfirm(false);
    window.location.reload();
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--label-secondary)', fontSize: 15 }}>
        Loading settings…
      </div>
    );
  }

  return (
    <div className="ios-fade-in" style={{ paddingBottom: 32 }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '4%',
          left: '50%',
          transform: 'translate(-50%)',
          background: 'rgba(28, 28, 30, 0.95)',
          color: '#FFFFFF',
          padding: '10px 20px',
          borderRadius: 24,
          fontSize: 14,
          fontWeight: 600,
          zIndex: 9999,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          backdropFilter: 'blur(16px)',
          border: '0.5px solid rgba(255,255,255,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <Check size={16} strokeWidth={3} style={{ color: 'var(--ios-green)' }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Hidden File Input for Backup Restore */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportFile}
        accept=".json"
        style={{ display: 'none' }}
      />

      {/* Hidden File Input for Company Logo */}
      <input
        type="file"
        ref={logoInputRef}
        onChange={handleLogoUpload}
        accept="image/*"
        style={{ display: 'none' }}
      />

      {/* Hidden File Input for Authorized Signature */}
      <input
        type="file"
        ref={signatureInputRef}
        onChange={handleSignatureUpload}
        accept="image/*"
        style={{ display: 'none' }}
      />

      {/* ── iOS Navigation Header with Large Title ── */}
      <div className="ios-large-header">
        <h1 className="ios-large-title">Settings</h1>
      </div>

      {/* ── Apple ID / Business Profile Banner (with Company Logo) ── */}
      <div className="ios-group" style={{ marginTop: 6 }}>
        <div className="ios-card-grouped" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            onClick={() => logoInputRef.current?.click()}
            title="Tap to change company logo"
            style={{
              width: 58,
              height: 58,
              borderRadius: '50%',
              background: settings.logoUrl
                ? 'var(--fill-tertiary)'
                : 'var(--ios-blue)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 22,
              flexShrink: 0,
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              border: '2px solid rgba(255,255,255,0.2)'
            }}
          >
            {isLogoUploading ? (
              <Loader2 className="animate-spin" style={{ width: 22, height: 22, color: 'var(--ios-blue)' }} />
            ) : settings.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt="Company Logo"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              settings.userName?.charAt(0)?.toUpperCase() || 'T'
            )}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 18,
                background: 'rgba(0, 0, 0, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Camera style={{ width: 11, height: 11, color: '#FFFFFF' }} />
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--label-primary)' }}>
              {settings.userName || 'Coal Trader'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--label-secondary)', marginTop: 2 }}>
              {settings.businessName || 'Apex Coal Logistics'} · {settings.phoneNumber || 'Operations'}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ios-blue)', marginTop: 4 }}>
              Commercial Account · {stats.parties} Parties · {googleUser ? 'Firebase Synced' : `${stats.dispatches} Trucks`}
            </div>
          </div>
        </div>
      </div>

      {/* ── Section: Google Account & Cloud Sync ── */}
      <div className="ios-group" style={{ marginBottom: 14 }}>
        <div className="ios-card-grouped" style={{ overflow: 'hidden' }}>
          {/* Collapsible Header Trigger */}
          <div
            className="ios-cell"
            onClick={() => toggleSection('google')}
            style={{
              cursor: 'pointer',
              userSelect: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '13px 16px',
              minHeight: 52
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <div
                className="ios-glyph-badge"
                style={{
                  background: 'var(--fill-tertiary)',
                  border: '0.5px solid var(--separator-opaque)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <GoogleLogo size={18} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--label-primary)', letterSpacing: '-0.2px' }}>
                  Google Account
                </span>
                {!openSections['google'] && (
                  <span
                    style={{
                      fontSize: 12,
                      color: googleUser ? 'var(--ios-green)' : 'var(--label-secondary)',
                      marginTop: 1,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {googleUser ? `${googleUser.email}` : 'Sign in for Firebase Cloud Sync'}
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {!openSections['google'] && (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: 10,
                    background: googleUser ? 'var(--ios-green)' : 'var(--fill-tertiary)',
                    color: googleUser ? 'white' : 'var(--ios-green)'
                  }}
                >
                  {googleUser ? 'Signed IN' : 'Not Linked'}
                </span>
              )}
              <ChevronDown
                style={{
                  width: 18,
                  height: 18,
                  color: 'var(--label-tertiary)',
                  transform: openSections['google'] ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
                strokeWidth={2.4}
              />
            </div>
            {openSections['google'] && <div className="ios-separator with-glyph" />}
          </div>

          {/* Expanded Body */}
          {openSections['google'] && (
            <div>
              {!googleUser ? (
                /* ── NOT SIGNED IN STATE ── */
                <div style={{ padding: '20px 16px 16px' }}>
                  {/* Explanatory Hero Card */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      padding: '16px 12px 20px',
                      background: 'var(--fill-quaternary)',
                      borderRadius: 14,
                      marginBottom: 16
                    }}
                  >
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: '50%',
                        background: 'var(--bg-card)',
                        border: '0.5px solid var(--separator-opaque)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 12,
                        boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
                      }}
                    >
                      <GoogleLogo size={26} />
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--label-primary)', marginBottom: 6 }}>
                      Sign In with Google
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--label-secondary)', lineHeight: 1.45, maxWidth: 300 }}>
                      Connect your Google Account to back up dispatches and parties automatically with Firebase Cloud.
                    </div>
                  </div>

                  {/* Native iOS Styled Google Sign In Button */}
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isSigningIn}
                    style={{
                      width: '100%',
                      height: 50,
                      borderRadius: 12,
                      border: '0.5px solid var(--separator-opaque)',
                      background: 'var(--bg-card)',
                      color: 'var(--label-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 12,
                      fontSize: 16,
                      fontWeight: 600,
                      cursor: isSigningIn ? 'not-allowed' : 'pointer',
                      transition: 'opacity 0.15s ease',
                      opacity: isSigningIn ? 0.75 : 1,
                      userSelect: 'none',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                    }}
                  >
                    {isSigningIn ? (
                      <>
                        <Loader2 className="animate-spin" style={{ width: 19, height: 19, color: 'var(--ios-blue)' }} />
                        <span>Signing in with Google…</span>
                      </>
                    ) : (
                      <>
                        <GoogleLogo size={20} />
                        <span>Sign in with Google</span>
                      </>
                    )}
                  </button>

                  {/* Benefits Feature Grid */}
                  {/* <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: 'rgba(0, 122, 255, 0.12)',
                          color: 'var(--ios-blue)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        <Cloud style={{ width: 17, height: 17 }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--label-primary)' }}>
                          Real-time Firebase Sync
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--label-secondary)', marginTop: 2 }}>
                          Dispatches, contracts, and ledger balances synced directly to the cloud.
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: 'rgba(52, 199, 89, 0.12)',
                          color: 'var(--ios-green)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        <Smartphone style={{ width: 17, height: 17 }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--label-primary)' }}>
                          Multi-Device Access
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--label-secondary)', marginTop: 2 }}>
                          Open Factory Ledger on your mobile phone, laptop, or tablet anytime.
                        </div>
                      </div>
                    </div>
                  </div> */}
                </div>
              ) : (
                /* ── SIGNED IN STATE ── */
                <div>
                  {/* User Profile Cell */}
                  <div className="ios-cell" style={{ cursor: 'default', padding: '14px 16px' }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: 'var(--ios-blue)',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 18,
                        fontWeight: 700,
                        marginRight: 12,
                        flexShrink: 0,
                        overflow: 'hidden'
                      }}
                    >
                      {googleUser.photoUrl ? (
                        <img src={googleUser.photoUrl} alt="Google Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        googleUser.displayName?.charAt(0) || 'G'
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--label-primary)' }}>
                          {googleUser.displayName}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 6,
                            background: !isOnline
                              ? 'rgba(255, 149, 0, 0.15)'
                              : syncStatus === 'error'
                                ? 'rgba(255, 59, 48, 0.15)'
                                : syncStatus === 'syncing' || isSyncing
                                  ? 'rgba(0, 122, 255, 0.15)'
                                  : syncStatus === 'pending'
                                    ? 'rgba(255, 149, 0, 0.15)'
                                    : 'rgba(52, 199, 89, 0.15)',
                            color: !isOnline
                              ? 'var(--ios-orange)'
                              : syncStatus === 'error'
                                ? 'var(--ios-red)'
                                : syncStatus === 'syncing' || isSyncing
                                  ? 'var(--ios-blue)'
                                  : syncStatus === 'pending'
                                    ? 'var(--ios-orange)'
                                    : 'var(--ios-green)',
                            textTransform: 'uppercase',
                            letterSpacing: 0.4
                          }}
                        >
                          {!isOnline
                            ? 'Offline (Local)'
                            : syncStatus === 'syncing' || isSyncing
                              ? 'Syncing…'
                              : syncStatus === 'pending'
                                ? 'Pending Sync'
                                : syncStatus === 'error'
                                  ? 'Sync Issue'
                                  : 'Firebase Synced'}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--label-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {googleUser.email}
                      </div>
                    </div>
                    <div className="ios-separator with-glyph" />
                  </div>

                  {/* Auto Sync Toggle Row */}
                  <div
                    className="ios-cell"
                    onClick={() => {
                      playPopSound();
                      const next = !autoSyncEnabled;
                      setAutoSyncEnabled(next);
                      showToast(next ? 'Cloud Sync enabled' : 'Cloud Sync paused');
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="ios-glyph-badge" style={{ background: 'var(--ios-blue)' }}>
                      <Cloud style={{ width: 18, height: 18 }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <span className="ios-cell-label">Automatic Cloud Backup</span>
                      <div style={{ fontSize: 12, color: 'var(--label-secondary)' }}>
                        Write-through sync on every change
                      </div>
                    </div>
                    <div
                      style={{
                        width: 51,
                        height: 31,
                        borderRadius: 31,
                        background: autoSyncEnabled ? 'var(--ios-green)' : 'var(--fill-primary)',
                        position: 'relative',
                        transition: 'background 0.25s ease'
                      }}
                    >
                      <div
                        style={{
                          width: 27,
                          height: 27,
                          borderRadius: '50%',
                          background: '#FFFFFF',
                          position: 'absolute',
                          top: 2,
                          left: autoSyncEnabled ? 22 : 2,
                          boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                          transition: 'left 0.25s ease'
                        }}
                      />
                    </div>
                    <div className="ios-separator with-glyph" />
                  </div>

                  {/* Manual Cloud Sync (Upload) Row */}
                  <div className="ios-cell" onClick={handleManualSync} style={{ cursor: isSyncing || syncStatus === 'syncing' ? 'default' : 'pointer' }}>
                    <div className="ios-glyph-badge" style={{ background: 'var(--ios-teal)' }}>
                      <RefreshCw className={isSyncing || syncStatus === 'syncing' ? 'animate-spin' : ''} style={{ width: 18, height: 18 }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span className="ios-cell-label">Back Up to Cloud</span>
                      <div style={{ fontSize: 12, color: 'var(--label-secondary)', marginTop: 1 }}>
                        {isSyncing || syncStatus === 'syncing'
                          ? 'Syncing with Firebase Cloud…'
                          : !isOnline
                            ? 'Offline: Changes queued locally'
                            : hasPendingChanges
                              ? 'Local changes waiting to sync'
                              : lastSyncTime
                                ? `Last synced: ${new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                : 'Upload current ledgers & parties'}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isSyncing || syncStatus === 'syncing'}
                      style={{
                        border: 'none',
                        background: 'var(--ios-blue)',
                        color: 'white',
                        padding: '6px 14px',
                        borderRadius: 14,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: isSyncing || syncStatus === 'syncing' ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {isSyncing || syncStatus === 'syncing' ? 'Syncing…' : 'Sync Now'}
                    </button>
                    <div className="ios-separator with-glyph" />
                  </div>

                  {/* Restore from Cloud Row */}
                  <div className="ios-cell" onClick={handleCloudRestore} style={{ cursor: isRestoringFromCloud ? 'default' : 'pointer' }}>
                    <div className="ios-glyph-badge" style={{ background: 'var(--ios-purple)' }}>
                      <Download className={isRestoringFromCloud ? 'animate-pulse' : ''} style={{ width: 18, height: 18 }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span className="ios-cell-label">Restore from Cloud</span>
                      <div style={{ fontSize: 12, color: 'var(--label-secondary)', marginTop: 1 }}>
                        Download saved data from Firebase
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isRestoringFromCloud}
                      style={{
                        border: 'none',
                        background: 'var(--fill-tertiary)',
                        color: 'var(--label-primary)',
                        padding: '6px 14px',
                        borderRadius: 14,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: isRestoringFromCloud ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {isRestoringFromCloud ? 'Restoring…' : 'Restore'}
                    </button>
                    <div className="ios-separator with-glyph" />
                  </div>

                  {/* Sign Out Row */}
                  <div className="ios-cell" onClick={handleGoogleSignOut} style={{ cursor: 'pointer' }}>
                    <div className="ios-glyph-badge" style={{ background: 'var(--ios-red)' }}>
                      <LogOut style={{ width: 18, height: 18 }} />
                    </div>
                    <span className="ios-cell-label" style={{ color: 'var(--ios-red)' }}>
                      Sign Out of Google
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        {/* {openSections['google'] && (
          <div className="ios-group-footnote">
            Only Google Account authentication is supported for simplified single-sign-on. No passwords or email registrations required.
          </div>
        )}  */}
      </div>

      {/* ── Section: Business Profile ── */}
      <div className="ios-group" style={{ marginBottom: 14 }}>
        <div className="ios-card-grouped" style={{ overflow: 'hidden' }}>
          {/* Collapsible Header */}
          <div
            className="ios-cell"
            onClick={() => toggleSection('business')}
            style={{
              cursor: 'pointer',
              userSelect: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '13px 16px',
              minHeight: 52
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <div className="ios-glyph-badge" style={{ background: 'var(--ios-blue)', flexShrink: 0 }}>
                <Building2 style={{ width: 18, height: 18, color: '#FFFFFF' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--label-primary)', letterSpacing: '-0.2px' }}>
                  Business Profile
                </span>
                {!openSections['business'] && (
                  <span
                    style={{
                      fontSize: 12,
                      color: 'var(--label-secondary)',
                      marginTop: 1,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {settings.businessName || 'Contact, Tax ID & Invoicing'}
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <ChevronDown
                style={{
                  width: 18,
                  height: 18,
                  color: 'var(--label-tertiary)',
                  transform: openSections['business'] ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
                strokeWidth={2.4}
              />
            </div>
            {openSections['business'] && <div className="ios-separator with-glyph" />}
          </div>

          {/* Expanded Body */}
          {openSections['business'] && (
            <form onSubmit={handleSave}>
              {/* User Name */}
              <div className="ios-cell" style={{ cursor: 'default' }}>
                <div className="ios-glyph-badge" style={{ background: 'var(--ios-blue)' }}>
                  <User style={{ width: 18, height: 18 }} />
                </div>
                <span className="ios-cell-label">Trader Name</span>
                <input
                  type="text"
                  value={settings.userName}
                  onChange={(e) => handleChange('userName', e.target.value)}
                  placeholder="Your name"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    fontSize: 17,
                    textAlign: 'right',
                    color: 'var(--label-primary)',
                    outline: 'none',
                    fontFamily: 'var(--font-system)',
                    maxWidth: 180
                  }}
                />
                <div className="ios-separator with-glyph" />
              </div>

              {/* Business Name */}
              <div className="ios-cell" style={{ cursor: 'default' }}>
                <div className="ios-glyph-badge" style={{ background: 'var(--ios-orange)' }}>
                  <Building2 style={{ width: 18, height: 18 }} />
                </div>
                <span className="ios-cell-label">Business Name</span>
                <input
                  type="text"
                  value={settings.businessName}
                  onChange={(e) => handleChange('businessName', e.target.value)}
                  placeholder="Enterprise name"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    fontSize: 17,
                    textAlign: 'right',
                    color: 'var(--label-primary)',
                    outline: 'none',
                    fontFamily: 'var(--font-system)',
                    maxWidth: 180
                  }}
                />
                <div className="ios-separator with-glyph" />
              </div>

              {/* NTN / Tax ID */}
              <div className="ios-cell" style={{ cursor: 'default' }}>
                <div className="ios-glyph-badge" style={{ background: 'var(--ios-indigo)' }}>
                  <FileText style={{ width: 18, height: 18 }} />
                </div>
                <span className="ios-cell-label">NTN / STRN #</span>
                <input
                  type="text"
                  value={settings.ntnNumber || ''}
                  onChange={(e) => handleChange('ntnNumber', e.target.value)}
                  placeholder="e.g. 7482910-3"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    fontSize: 17,
                    textAlign: 'right',
                    color: 'var(--label-primary)',
                    outline: 'none',
                    fontFamily: 'var(--font-system)',
                    maxWidth: 180
                  }}
                />
                <div className="ios-separator with-glyph" />
              </div>

              {/* Direct Phone */}
              <div className="ios-cell" style={{ cursor: 'default' }}>
                <div className="ios-glyph-badge" style={{ background: 'var(--ios-green)' }}>
                  <Phone style={{ width: 18, height: 18 }} />
                </div>
                <span className="ios-cell-label">Direct Phone</span>
                <input
                  type="tel"
                  value={settings.phoneNumber}
                  onChange={(e) => handleChange('phoneNumber', e.target.value)}
                  placeholder="Phone number"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    fontSize: 17,
                    textAlign: 'right',
                    color: 'var(--label-primary)',
                    outline: 'none',
                    fontFamily: 'var(--font-system)',
                    maxWidth: 180
                  }}
                />
                <div className="ios-separator with-glyph" />
              </div>

              {/* Office / Depot Address */}
              <div className="ios-cell" style={{ cursor: 'default' }}>
                <div className="ios-glyph-badge" style={{ background: 'var(--ios-teal)' }}>
                  <MapPin style={{ width: 18, height: 18 }} />
                </div>
                <span className="ios-cell-label">Office / Yard</span>
                <input
                  type="text"
                  value={settings.companyAddress || ''}
                  onChange={(e) => handleChange('companyAddress', e.target.value)}
                  placeholder="Address or Plot #"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    fontSize: 17,
                    textAlign: 'right',
                    color: 'var(--label-primary)',
                    outline: 'none',
                    fontFamily: 'var(--font-system)',
                    maxWidth: 180
                  }}
                />
                <div className="ios-separator with-glyph" />
              </div>

              {/* Company Logo Row (exact Day-2-Day Kotlin design) */}
              <div
                className="ios-cell"
                onClick={() => {
                  if (!settings.logoUrl && !isLogoUploading) {
                    logoInputRef.current?.click();
                  }
                }}
                style={{ cursor: settings.logoUrl ? 'default' : 'pointer' }}
              >
                <div className="ios-glyph-badge" style={{ background: 'var(--ios-red)' }}>
                  <Image style={{ width: 18, height: 18 }} />
                </div>
                <span className="ios-cell-label">Company Logo</span>

                {settings.logoUrl || isLogoUploading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        logoInputRef.current?.click();
                      }}
                      title="Change company logo"
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        border: '0.5px solid var(--separator-opaque)',
                        background: 'var(--fill-tertiary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        position: 'relative',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                      }}
                    >
                      {settings.logoUrl && (
                        <img
                          src={settings.logoUrl}
                          alt="Logo"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            opacity: isLogoUploading ? 0.35 : 1
                          }}
                        />
                      )}
                      {isLogoUploading && (
                        <Loader2
                          className="animate-spin"
                          style={{
                            position: 'absolute',
                            width: 18,
                            height: 18,
                            color: 'var(--ios-blue)'
                          }}
                        />
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      title="Remove logo"
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: 'rgba(255, 59, 48, 0.1)',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'var(--ios-red)',
                        transition: 'background-color 0.15s'
                      }}
                    >
                      <Trash2 style={{ width: 18, height: 18 }} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--ios-blue)',
                      fontSize: 16,
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    Upload
                  </button>
                )}
                <div className="ios-separator with-glyph" />
              </div>

              {/* Signature Row (exact Day-2-Day Kotlin design) */}
              <div
                className="ios-cell"
                onClick={() => {
                  if (!settings.signatureUrl && !isSignatureUploading) {
                    signatureInputRef.current?.click();
                  }
                }}
                style={{ cursor: settings.signatureUrl ? 'default' : 'pointer' }}
              >
                <div className="ios-glyph-badge" style={{ background: 'var(--ios-purple)' }}>
                  <PenLine style={{ width: 18, height: 18 }} />
                </div>
                <span className="ios-cell-label">Signature</span>

                {settings.signatureUrl || isSignatureUploading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        signatureInputRef.current?.click();
                      }}
                      title="Change signature"
                      style={{
                        width: 48,
                        height: 36,
                        borderRadius: 8,
                        border: '0.5px solid var(--separator-opaque)',
                        background: 'var(--fill-tertiary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        position: 'relative',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                      }}
                    >
                      {settings.signatureUrl && (
                        <img
                          src={settings.signatureUrl}
                          alt="Signature"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            opacity: isSignatureUploading ? 0.35 : 1
                          }}
                        />
                      )}
                      {isSignatureUploading && (
                        <Loader2
                          className="animate-spin"
                          style={{
                            position: 'absolute',
                            width: 18,
                            height: 18,
                            color: 'var(--ios-blue)'
                          }}
                        />
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleRemoveSignature}
                      title="Remove signature"
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: 'rgba(255, 59, 48, 0.1)',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'var(--ios-red)',
                        transition: 'background-color 0.15s'
                      }}
                    >
                      <Trash2 style={{ width: 18, height: 18 }} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => signatureInputRef.current?.click()}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--ios-blue)',
                      fontSize: 16,
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    Upload
                  </button>
                )}
              </div>

              {/* Save button */}
              <div style={{ padding: '12px 16px', background: 'var(--bg-card)' }}>
                <button
                  type="submit"
                  className="ios-btn ios-btn-primary"
                  style={{ width: '100%' }}
                >
                  {saved ? 'Changes Saved!' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          )}
        </div>
        {/* {openSections['business'] && (
          <div className="ios-group-footnote">
            Your name, NTN, and business credentials appear on generated WhatsApp statements and dispatch settlement vouchers.
          </div>
        )} */}
      </div>

      {/* ── Section: Appearance & iOS Theme ── */}
      <div className="ios-group" style={{ marginBottom: 14 }}>
        <div className="ios-card-grouped" style={{ overflow: 'hidden' }}>
          {/* Collapsible Header */}
          <div
            className="ios-cell"
            onClick={() => toggleSection('appearance')}
            style={{
              cursor: 'pointer',
              userSelect: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '13px 16px',
              minHeight: 52
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <div className="ios-glyph-badge" style={{ background: 'var(--ios-indigo)', flexShrink: 0 }}>
                <Moon style={{ width: 18, height: 18, color: '#FFFFFF' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--label-primary)', letterSpacing: '-0.2px' }}>
                  Appearance
                </span>
                {!openSections['appearance'] && (
                  <span style={{ fontSize: 12, color: 'var(--label-secondary)', marginTop: 1 }}>
                    {settings.theme === 'system'
                      ? `System (${systemPrefersDark ? 'Dark' : 'Light'})`
                      : settings.theme === 'dark'
                        ? 'Dark Mode'
                        : 'Light Mode'}
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <ChevronDown
                style={{
                  width: 18,
                  height: 18,
                  color: 'var(--label-tertiary)',
                  transform: openSections['appearance'] ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
                strokeWidth={2.4}
              />
            </div>
            {openSections['appearance'] && <div className="ios-separator with-glyph" />}
          </div>

          {/* Expanded Body */}
          {openSections['appearance'] && (
            <div>
              {/* System (Device Default) Mode */}
              <div
                className="ios-cell"
                onClick={() => handleThemeChange('system')}
                style={{ cursor: 'pointer' }}
              >
                <div className="ios-glyph-badge" style={{ background: 'var(--ios-teal, #30B0C7)' }}>
                  <Smartphone style={{ width: 18, height: 18, color: '#FFFFFF' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                  <span className="ios-cell-label">System</span>
                  <span style={{ fontSize: 12, color: 'var(--label-secondary)', marginTop: 1 }}>
                    Matches device's Mode - {systemPrefersDark ? 'Dark' : 'Light'}
                  </span>
                </div>
                {settings.theme === 'system' && (
                  <Check style={{ width: 20, height: 20, color: 'var(--ios-blue)' }} strokeWidth={2.8} />
                )}
                <div className="ios-separator with-glyph" />
              </div>

              {/* Light Mode */}
              <div
                className="ios-cell"
                onClick={() => handleThemeChange('light')}
                style={{ cursor: 'pointer' }}
              >
                <div className="ios-glyph-badge" style={{ background: 'var(--ios-yellow)' }}>
                  <Sun style={{ width: 18, height: 18, color: '#FFFFFF' }} />
                </div>
                <span className="ios-cell-label" style={{ flex: 1 }}>Light Mode</span>
                {settings.theme === 'light' && (
                  <Check style={{ width: 20, height: 20, color: 'var(--ios-blue)' }} strokeWidth={2.8} />
                )}
                <div className="ios-separator with-glyph" />
              </div>

              {/* Dark Mode */}
              <div
                className="ios-cell"
                onClick={() => handleThemeChange('dark')}
                style={{ cursor: 'pointer' }}
              >
                <div className="ios-glyph-badge" style={{ background: 'var(--ios-indigo)' }}>
                  <Moon style={{ width: 18, height: 18, color: '#FFFFFF' }} />
                </div>
                <span className="ios-cell-label" style={{ flex: 1 }}>Dark Mode</span>
                {settings.theme === 'dark' && (
                  <Check style={{ width: 20, height: 20, color: 'var(--ios-blue)' }} strokeWidth={2.8} />
                )}
                <div className="ios-separator with-glyph" />
              </div>

              {/* Dynamic Accent Color Theme 
            <div className="ios-cell" style={{ cursor: 'default', flexDirection: 'column', alignItems: 'flex-start', padding: '14px 16px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="ios-glyph-badge" style={{ background: 'var(--ios-blue)' }}>
                    <Palette style={{ width: 18, height: 18, color: '#FFFFFF' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--label-primary)' }}>Accent Color Theme</div>
                    <div style={{ fontSize: 12, color: 'var(--label-secondary)' }}>Personalize tabs, buttons, and visual highlights</div>
                  </div>
                </div>
              </div> */}

              {/* Color swatches 
              <div style={{ display: 'flex', gap: 12, width: '100%', justifyContent: 'space-around', padding: '4px 0 6px' }}>
                {[
                  { id: 'sapphire', name: 'Sapphire', color: '#007AFF' },
                  { id: 'emerald', name: 'Emerald', color: '#34C759' },
                  { id: 'violet', name: 'Violet', color: '#AF52DE' },
                  { id: 'amber', name: 'Amber', color: '#FF9500' },
                  { id: 'crimson', name: 'Crimson', color: '#FF2D55' },
                ].map((swatch) => (
                  <button
                    key={swatch.id}
                    type="button"
                    onClick={() => handleAccentChange(swatch.id)}
                    style={{
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: '50%',
                        background: swatch.color,
                        boxShadow: accentColor === swatch.id ? `0 0 0 3px var(--bg-card), 0 0 0 5px ${swatch.color}` : '0 2px 6px rgba(0,0,0,0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#FFFFFF',
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                        transform: accentColor === swatch.id ? 'scale(1.1)' : 'scale(1)'
                      }}
                    >
                      {accentColor === swatch.id && <Check size={18} strokeWidth={3} />}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: accentColor === swatch.id ? 700 : 500, color: accentColor === swatch.id ? 'var(--label-primary)' : 'var(--label-tertiary)' }}>
                      {swatch.name}
                    </span>
                  </button>
                ))}
              </div>
              <div className="ios-separator with-glyph" style={{ marginTop: 8 }} />
            </div> */}

              {/* Audio Feedback & Tactile Chimes */}
              <div className="ios-cell" style={{ cursor: 'pointer' }} onClick={() => handleSoundToggle(!soundEnabled)}>
                <div className="ios-glyph-badge" style={{ background: soundEnabled ? 'var(--ios-green)' : 'var(--fill-secondary)' }}>
                  {soundEnabled ? (
                    <Volume2 style={{ width: 18, height: 18, color: '#FFFFFF' }} />
                  ) : (
                    <VolumeX style={{ width: 18, height: 18, color: 'var(--label-secondary)' }} />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <span className="ios-cell-label">Sound & Haptics</span>
                  <div style={{ fontSize: 12, color: 'var(--label-secondary)' }}>
                    Audio feedback
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {soundEnabled && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        playCashChime();
                      }}
                      style={{
                        border: 'none',
                        background: 'var(--ios-blue)',
                        color: 'white',
                        padding: '4px 10px',
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Test Chime
                    </button>
                  )}
                  <div
                    style={{
                      width: 51,
                      height: 31,
                      borderRadius: 31,
                      background: soundEnabled ? 'var(--ios-green)' : 'var(--fill-primary)',
                      position: 'relative',
                      transition: 'background 0.25s ease'
                    }}
                  >
                    <div
                      style={{
                        width: 27,
                        height: 27,
                        borderRadius: '50%',
                        background: '#FFFFFF',
                        position: 'absolute',
                        top: 2,
                        left: soundEnabled ? 22 : 2,
                        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                        transition: 'left 0.25s ease'
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* {openSections['appearance'] && (
          <div className="ios-group-footnote">
            Personalize display theme and audio/haptic responses across the application.
          </div>
        )} */}
      </div>

      {/* ── Section: Region & Currency ── */}
      <div className="ios-group" style={{ marginBottom: 14 }}>
        <div className="ios-card-grouped" style={{ overflow: 'hidden' }}>
          {/* Collapsible Header */}
          <div
            className="ios-cell"
            onClick={() => toggleSection('currency')}
            style={{
              cursor: 'pointer',
              userSelect: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '13px 16px',
              minHeight: 52
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <div className="ios-glyph-badge" style={{ background: 'var(--ios-green)', flexShrink: 0 }}>
                <Coins style={{ width: 18, height: 18, color: '#FFFFFF' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--label-primary)', letterSpacing: '-0.2px' }}>
                  Currency & Region
                </span>
                {!openSections['currency'] && (
                  <span style={{ fontSize: 12, color: 'var(--label-secondary)', marginTop: 1 }}>
                    PKR (Rs.) · Pakistan (en-PK)
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <ChevronDown
                style={{
                  width: 18,
                  height: 18,
                  color: 'var(--label-tertiary)',
                  transform: openSections['currency'] ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
                strokeWidth={2.4}
              />
            </div>
            {openSections['currency'] && <div className="ios-separator with-glyph" />}
          </div>

          {/* Expanded Body */}
          {openSections['currency'] && (
            <div>
              <div className="ios-cell" style={{ cursor: 'default' }}>
                <div className="ios-glyph-badge" style={{ background: 'var(--ios-green)' }}>
                  <Coins style={{ width: 18, height: 18 }} />
                </div>
                <span className="ios-cell-label">Operating Currency</span>
                <span className="ios-cell-value" style={{ fontWeight: 600, color: 'var(--label-primary)' }}>
                  PKR (Rs.)
                </span>
                <div className="ios-separator with-glyph" />
              </div>

              <div className="ios-cell" style={{ cursor: 'default' }}>
                <div className="ios-glyph-badge" style={{ background: 'var(--ios-teal)' }}>
                  <Globe style={{ width: 18, height: 18 }} />
                </div>
                <span className="ios-cell-label">Region / Locale</span>
                <span className="ios-cell-value">Pakistan (en-PK)</span>
              </div>
            </div>
          )}
        </div>
        {/* {openSections['currency'] && (
          <div className="ios-group-footnote">
            All coal dispatch contracts, lab adjustments, tax calculations, and party ledgers are computed in Pakistani Rupee (PKR - Rs.).
          </div>
        )} */}
      </div>

      {/* ── Section: Data & Backup ── */}
      <div className="ios-group" style={{ marginBottom: 14 }}>
        <div className="ios-card-grouped" style={{ overflow: 'hidden' }}>
          {/* Collapsible Header */}
          <div
            className="ios-cell"
            onClick={() => toggleSection('backup')}
            style={{
              cursor: 'pointer',
              userSelect: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '13px 16px',
              minHeight: 52
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <div className="ios-glyph-badge" style={{ background: 'var(--ios-teal)', flexShrink: 0 }}>
                <Download style={{ width: 18, height: 18, color: '#FFFFFF' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--label-primary)', letterSpacing: '-0.2px' }}>
                  Data & Backup
                </span>
                {!openSections['backup'] && (
                  <span style={{ fontSize: 12, color: 'var(--label-secondary)', marginTop: 1 }}>
                    Offline Storage · Export & Restore
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <ChevronDown
                style={{
                  width: 18,
                  height: 18,
                  color: 'var(--label-tertiary)',
                  transform: openSections['backup'] ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
                strokeWidth={2.4}
              />
            </div>
            {openSections['backup'] && <div className="ios-separator with-glyph" />}
          </div>

          {/* Expanded Body */}
          {openSections['backup'] && (
            <div>
              {/* Export JSON */}
              <div className="ios-cell" onClick={handleExportData}>
                <div className="ios-glyph-badge" style={{ background: 'var(--ios-blue)' }}>
                  <Download style={{ width: 18, height: 18 }} />
                </div>
                <span className="ios-cell-label">Export Full Backup (JSON)</span>
                <ChevronRight className="ios-chevron" strokeWidth={2.5} />
                <div className="ios-separator with-glyph" />
              </div>

              {/* Import JSON */}
              <div className="ios-cell" onClick={() => fileInputRef.current?.click()}>
                <div className="ios-glyph-badge" style={{ background: 'var(--ios-purple)' }}>
                  <Upload style={{ width: 18, height: 18 }} />
                </div>
                <span className="ios-cell-label">Import & Restore Backup (JSON)</span>
                <ChevronRight className="ios-chevron" strokeWidth={2.5} />
                <div className="ios-separator with-glyph" />
              </div>

              {/* Clear All */}
              <div className="ios-cell" onClick={handleClear}>
                <div className="ios-glyph-badge" style={{ background: 'var(--ios-red)' }}>
                  <Trash2 style={{ width: 18, height: 18 }} />
                </div>
                <span className="ios-cell-label" style={{ color: 'var(--ios-red)' }}>
                  Erase All Data
                </span>
              </div>
            </div>
          )}
        </div>
        {/* {openSections['backup'] && (
          <div className="ios-group-footnote">
            All records are stored securely in local browser offline storage. Use Export & Restore to transfer your data between devices.
          </div>
        )} */}
      </div>

      {/* ── Section: About ── 
      <div className="ios-group">
        <div className="ios-group-title">About</div>
        <div className="ios-card-grouped">
          <div className="ios-cell" style={{ cursor: 'default' }}>
            <div className="ios-glyph-badge" style={{ background: '#636366' }}>
              <Info style={{ width: 18, height: 18 }} />
            </div>
            <span className="ios-cell-label">Application</span>
            <span className="ios-cell-value">Factory Ledger iOS</span>
            <div className="ios-separator with-glyph" />
          </div>

          <div className="ios-cell" style={{ cursor: 'default' }}>
            <div className="ios-glyph-badge" style={{ background: '#8E8E93' }}>
              <Smartphone style={{ width: 18, height: 18 }} />
            </div>
            <span className="ios-cell-label">Design Specification</span>
            <span className="ios-cell-value">Apple iOS 18 HIG</span>
            <div className="ios-separator with-glyph" />
          </div>

          <div className="ios-cell" style={{ cursor: 'default' }}>
            <div className="ios-glyph-badge" style={{ background: 'var(--ios-green)' }}>
              <ShieldCheck style={{ width: 18, height: 18 }} />
            </div>
            <span className="ios-cell-label">Version</span>
            <span className="ios-cell-value">2.4.0 (Build 2026.10)</span>
          </div>
        </div>
      </div> */}

      {/* ── iOS Liquid Glass Confirmation Modal ── */}
      <IOSConfirmModal
        isOpen={showClearConfirm}
        title="Clear All Data?"
        message="Are you sure you want to clear ALL dispatches, parties, payments, and POs? This action cannot be undone."
        confirmText="Clear All Data"
        cancelText="Cancel"
        destructive
        countdownSeconds={2}
        icon="warning"
        onConfirm={handleConfirmClear}
        onCancel={() => setShowClearConfirm(false)}
      />

      {/* ── iOS Liquid Glass Remove Logo Confirmation Modal (Instant / No 2s timer) ── */}
      <IOSConfirmModal
        isOpen={showRemoveLogoConfirm}
        title="Remove Company Logo?"
        message="Are you sure you want to remove your company logo? It will no longer appear on exported bills and PDF receipts."
        confirmText="Remove"
        cancelText="Cancel"
        destructive
        countdownSeconds={0}
        icon="trash"
        onConfirm={handleConfirmRemoveLogo}
        onCancel={() => setShowRemoveLogoConfirm(false)}
      />

      {/* ── iOS Liquid Glass Remove Signature Confirmation Modal (Instant / No 2s timer) ── */}
      <IOSConfirmModal
        isOpen={showRemoveSignatureConfirm}
        title="Remove Authorized Signature?"
        message="Are you sure you want to remove your authorized signature image? Invoices will no longer display a signature."
        confirmText="Remove"
        cancelText="Cancel"
        destructive
        countdownSeconds={0}
        icon="trash"
        onConfirm={handleConfirmRemoveSignature}
        onCancel={() => setShowRemoveSignatureConfirm(false)}
      />

      {/* ── Real-World Account & Sync Modals ── */}
      {switchScenario && (
        <AccountSwitchModal
          isOpen={Boolean(switchScenario)}
          previousEmail={switchScenario.previousEmail || 'previous account'}
          newEmail={switchScenario.newEmail || 'new account'}
          localCount={switchScenario.localCount || 0}
          cloudCount={switchScenario.cloudCount || 0}
          onSwitchToNewAccount={async () => {
            const res = await resolveLoginDecision('use_cloud', switchScenario);
            setSwitchScenario(null);
            playSuccessSound();
            triggerConfetti();
            showToast(res.message);
            const [s, d, p] = await Promise.all([getSettings(), getDispatches(), getParties()]);
            setSettings(s);
            setStats({ dispatches: d.length, parties: p.length });
          }}
          onMergeIntoNewAccount={async () => {
            const res = await resolveLoginDecision('merge', switchScenario);
            setSwitchScenario(null);
            playSuccessSound();
            triggerConfetti();
            showToast(res.message);
            const [s, d, p] = await Promise.all([getSettings(), getDispatches(), getParties()]);
            setSettings(s);
            setStats({ dispatches: d.length, parties: p.length });
          }}
          onCancel={async () => {
            await resolveLoginDecision('cancel', switchScenario);
            setSwitchScenario(null);
            showToast('Sign-in cancelled. Local records kept intact.');
          }}
        />
      )}

      {conflictScenario && (
        <AnonymousConflictModal
          isOpen={Boolean(conflictScenario)}
          email={conflictScenario.newEmail || 'Google Account'}
          localCount={conflictScenario.localCount || 0}
          cloudCount={conflictScenario.cloudCount || 0}
          onMerge={async () => {
            const res = await resolveLoginDecision('merge', conflictScenario);
            setConflictScenario(null);
            playSuccessSound();
            triggerConfetti();
            showToast(res.message);
            const [s, d, p] = await Promise.all([getSettings(), getDispatches(), getParties()]);
            setSettings(s);
            setStats({ dispatches: d.length, parties: p.length });
          }}
          onUseCloud={async () => {
            const res = await resolveLoginDecision('use_cloud', conflictScenario);
            setConflictScenario(null);
            playSuccessSound();
            triggerConfetti();
            showToast(res.message);
            const [s, d, p] = await Promise.all([getSettings(), getDispatches(), getParties()]);
            setSettings(s);
            setStats({ dispatches: d.length, parties: p.length });
          }}
          onCancel={async () => {
            await resolveLoginDecision('cancel', conflictScenario);
            setConflictScenario(null);
            showToast('Sign-in cancelled.');
          }}
        />
      )}

      {isSignOutSheetOpen && googleUser && (
        <SignOutActionSheet
          isOpen={isSignOutSheetOpen}
          email={googleUser.email}
          onKeepData={() => handleConfirmSignOut('keep_data')}
          onClearData={() => handleConfirmSignOut('clear_data')}
          onCancel={() => setIsSignOutSheetOpen(false)}
        />
      )}
    </div>
  );
}
