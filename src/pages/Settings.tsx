import { useEffect, useState, useRef } from 'react';
import {
  getSettings,
  saveSettings,
  resetToDemoData,
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
  RotateCcw,
  Download,
  Upload,
  Trash2,
  ChevronRight,
  ShieldCheck,
  Smartphone,
  Info,
  Coins,
  Globe,
  FileText,
  MapPin,
  Palette,
  Volume2,
  VolumeX
} from 'lucide-react';
import { triggerConfetti, playSuccessSound, playPopSound, playCashChime } from '../utils/delight';

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings>({
    userName: '',
    businessName: '',
    phoneNumber: '',
    logoUrl: '',
    companyAddress: '',
    ntnNumber: '',
    theme: 'light',
  });
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [stats, setStats] = useState({ dispatches: 0, parties: 0 });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [accentColor, setAccentColor] = useState(() => localStorage.getItem('coal_accent_theme') || 'sapphire');
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('coal_sound_enabled') !== 'false');

  const fileInputRef = useRef<HTMLInputElement>(null);

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
    showToast('Settings saved successfully');
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAccentChange = (accent: string) => {
    setAccentColor(accent);
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
  };

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

  const handleThemeChange = async (theme: 'light' | 'dark') => {
    const updated = { ...settings, theme };
    setSettings(updated);
    await saveSettings(updated);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleResetDemo = async () => {
    if (confirm('Reload database with authentic industrial sample data? Existing modifications will be replaced.')) {
      await resetToDemoData();
      window.location.reload();
    }
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
      alert('Failed to parse the backup file. Please ensure it is a valid JSON file exported from Coal Ledger.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClear = async () => {
    if (confirm('Are you sure you want to clear ALL dispatches, parties, payments, and POs? This action cannot be undone.')) {
      await clearAllData();
      window.location.reload();
    }
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
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
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

      {/* ── iOS Navigation Header with Large Title ── */}
      <div className="ios-large-header">
        <h1 className="ios-large-title">Settings</h1>
      </div>

      {/* ── Apple ID / Business Profile Banner ── */}
      <div className="ios-group" style={{ marginTop: 6 }}>
        <div className="ios-card-grouped" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'var(--ios-blue)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 22,
              flexShrink: 0,
              boxShadow: 'none'
            }}
          >
            {settings.userName?.charAt(0) || 'T'}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--label-primary)' }}>
              {settings.userName || 'Coal Trader'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--label-secondary)', marginTop: 2 }}>
              {settings.businessName || 'Apex Coal Logistics'} · {settings.phoneNumber || 'Operations'}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ios-blue)', marginTop: 4 }}>
              Commercial Account · {stats.parties} Parties · {stats.dispatches} Trucks
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave}>
        {/* ── Section: Business Profile ── */}
        <div className="ios-group">
          <div className="ios-group-title">Business Profile</div>
          <div className="ios-card-grouped">
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

            {/* Logo URL */}
            <div className="ios-cell" style={{ cursor: 'default' }}>
              <div className="ios-glyph-badge" style={{ background: 'var(--ios-purple)' }}>
                <Image style={{ width: 18, height: 18 }} />
              </div>
              <span className="ios-cell-label">Logo URL</span>
              <input
                type="text"
                value={settings.logoUrl}
                onChange={(e) => handleChange('logoUrl', e.target.value)}
                placeholder="https://…"
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
            </div>
          </div>
          <div className="ios-group-footnote">
            Your name, NTN, and business credentials appear on generated WhatsApp statements and dispatch settlement vouchers.
          </div>
        </div>

        {/* ── Section: Appearance & iOS Theme ── */}
        <div className="ios-group">
          <div className="ios-group-title">Appearance</div>
          <div className="ios-card-grouped">
            {/* Light Mode */}
            <div
              className="ios-cell"
              onClick={() => handleThemeChange('light')}
            >
              <div className="ios-glyph-badge" style={{ background: 'var(--ios-yellow)' }}>
                <Sun style={{ width: 18, height: 18, color: '#FFFFFF' }} />
              </div>
              <span className="ios-cell-label">Light Mode</span>
              {settings.theme === 'light' && (
                <Check style={{ width: 20, height: 20, color: 'var(--ios-blue)' }} strokeWidth={2.8} />
              )}
              <div className="ios-separator with-glyph" />
            </div>

            {/* Dark Mode */}
            <div
              className="ios-cell"
              onClick={() => handleThemeChange('dark')}
            >
              <div className="ios-glyph-badge" style={{ background: 'var(--ios-indigo)' }}>
                <Moon style={{ width: 18, height: 18, color: '#FFFFFF' }} />
              </div>
              <span className="ios-cell-label">Dark Mode (OLED)</span>
              {settings.theme === 'dark' && (
                <Check style={{ width: 20, height: 20, color: 'var(--ios-blue)' }} strokeWidth={2.8} />
              )}
              <div className="ios-separator with-glyph" />
            </div>

            {/* Dynamic Accent Color Theme */}
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
              </div>

              {/* Color swatches */}
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
            </div>

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
                <span className="ios-cell-label">Sound Effects & Haptics</span>
                <div style={{ fontSize: 12, color: 'var(--label-secondary)' }}>
                  Tactile audio feedback on payments, dispatches, and taps
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
                      background: 'var(--tint-blue)',
                      color: 'var(--ios-blue)',
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
        </div>

        {/* ── Section: Region & Currency ── */}
        <div className="ios-group">
          <div className="ios-group-title">Currency & Region</div>
          <div className="ios-card-grouped">
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
          <div className="ios-group-footnote">
            All coal dispatch contracts, lab adjustments, tax calculations, and party ledgers are computed in Pakistani Rupee (PKR - Rs.).
          </div>
        </div>

        {/* Save button */}
        <div style={{ padding: '0 16px', marginBottom: 24 }}>
          <button
            type="submit"
            className="ios-btn ios-btn-primary"
            style={{ width: '100%' }}
          >
            {saved ? 'Changes Saved!' : 'Save Profile Changes'}
          </button>
        </div>
      </form>

      {/* ── Section: Data & Backup ── */}
      <div className="ios-group">
        <div className="ios-group-title">Data & Backup</div>
        <div className="ios-card-grouped">
          {/* Reload Demo Data */}
          <div className="ios-cell" onClick={handleResetDemo}>
            <div className="ios-glyph-badge" style={{ background: 'var(--ios-teal)' }}>
              <RotateCcw style={{ width: 18, height: 18 }} />
            </div>
            <span className="ios-cell-label">Load Authentic Demo Data</span>
            <ChevronRight className="ios-chevron" strokeWidth={2.5} />
            <div className="ios-separator with-glyph" />
          </div>

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
        <div className="ios-group-footnote">
          All records are stored securely in local browser offline storage. Use Export & Restore to transfer your data between devices.
        </div>
      </div>

      {/* ── Section: About ── */}
      <div className="ios-group">
        <div className="ios-group-title">About</div>
        <div className="ios-card-grouped">
          <div className="ios-cell" style={{ cursor: 'default' }}>
            <div className="ios-glyph-badge" style={{ background: '#636366' }}>
              <Info style={{ width: 18, height: 18 }} />
            </div>
            <span className="ios-cell-label">Application</span>
            <span className="ios-cell-value">Coal Ledger iOS</span>
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
      </div>
    </div>
  );
}
