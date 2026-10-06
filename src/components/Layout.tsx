import { useEffect, useState, useRef } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { getSettings, saveSettings, resetToDemoData } from '../lib/db';
import type { AppSettings } from '../types';
import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';
import { App as CapApp } from '@capacitor/app';
import { playPopSound, playSuccessSound } from '../utils/delight';
import {
  LayoutDashboard,
  Building2,
  FileSpreadsheet,
  Settings as SettingsIcon,
  Wifi,
  Sun,
  Moon,
  Smartphone,
  Maximize2,
  RotateCcw,
  Check,
  Volume2,
  VolumeX,
  Palette
} from 'lucide-react';

const ACCENT_PRESETS = [
  { id: 'blue', label: 'Sapphire', color: '#007AFF', className: '' },
  { id: 'emerald', label: 'Emerald', color: '#10B981', className: 'theme-emerald' },
  { id: 'violet', label: 'Violet', color: '#8B5CF6', className: 'theme-violet' },
  { id: 'amber', label: 'Amber', color: '#F59E0B', className: 'theme-amber' },
  { id: 'crimson', label: 'Ruby', color: '#F43F5E', className: 'theme-crimson' }
];

export default function Layout() {
  const isNative = Capacitor.isNativePlatform();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [currentTime, setCurrentTime] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(isNative);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeAccent, setActiveAccent] = useState(() => localStorage.getItem('coal_accent_theme') || 'blue');
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('coal_sound_enabled') !== 'false');

  const location = useLocation();
  const navigate = useNavigate();
  const pathnameRef = useRef(location.pathname);

  // Keep pathnameRef continuously up to date
  useEffect(() => {
    pathnameRef.current = location.pathname;
  }, [location.pathname]);

  // Handle Android hardware back button
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let lastBackPressTime = 0;

    const listenerPromise = CapApp.addListener('backButton', () => {
      // 1. If any modal sheet / backdrop is open, dismiss the top-most modal
      const backdrops = document.querySelectorAll<HTMLElement>('.ios-modal-backdrop');
      if (backdrops.length > 0) {
        const topBackdrop = backdrops[backdrops.length - 1];
        topBackdrop.click();
        return;
      }

      const currentPath = pathnameRef.current;

      // 2. If inside a nested dispatch form (/parties/:partyId/dispatch/:dispatchId)
      if (currentPath.includes('/dispatch/')) {
        const parentPartyPath = currentPath.split('/dispatch/')[0];
        navigate(parentPartyPath);
        return;
      }

      // 3. If inside a party ledger (/parties/:partyId)
      if (currentPath.startsWith('/parties/') && currentPath !== '/parties') {
        navigate('/parties');
        return;
      }

      // 4. If on a secondary tab (/parties, /entries, /settings)
      if (currentPath !== '/') {
        navigate('/');
        return;
      }

      // 5. At root home summary ('/') - require double press within 2s to exit
      const now = Date.now();
      if (now - lastBackPressTime < 2000) {
        CapApp.exitApp();
      } else {
        lastBackPressTime = now;
        setToastMessage('Press back again to exit');
        setTimeout(() => setToastMessage(null), 2000);
      }
    });

    return () => {
      listenerPromise.then(handle => handle.remove()).catch(() => {});
    };
  }, [navigate]);

  // Load settings
  useEffect(() => {
    getSettings().then(setSettings);
  }, [location.pathname]);

  // Apply theme accent class to root
  useEffect(() => {
    ACCENT_PRESETS.forEach(p => {
      if (p.className) document.documentElement.classList.remove(p.className);
    });
    const match = ACCENT_PRESETS.find(p => p.id === activeAccent);
    if (match?.className) {
      document.documentElement.classList.add(match.className);
    }
  }, [activeAccent]);

  // Handle dark mode class and native status bar styling
  useEffect(() => {
    if (settings?.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    if (Capacitor.isNativePlatform()) {
      StatusBar.hide().catch(() => { });
    }
  }, [settings?.theme]);

  // Live Status Bar Time
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      hours = hours % 12 || 12;
      setCurrentTime(`${hours}:${minutes}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 10000);
    return () => clearInterval(timer);
  }, []);

  const toggleTheme = async () => {
    if (!settings) return;
    const newTheme: 'light' | 'dark' = settings.theme === 'dark' ? 'light' : 'dark';
    const updated: AppSettings = { ...settings, theme: newTheme };
    setSettings(updated);
    await saveSettings(updated);
    playPopSound();
    showToast(`Switched to ${newTheme === 'dark' ? 'Dark' : 'Light'} Mode`);
  };

  const cycleAccent = () => {
    const currentIndex = ACCENT_PRESETS.findIndex(p => p.id === activeAccent);
    const nextPreset = ACCENT_PRESETS[(currentIndex + 1) % ACCENT_PRESETS.length];
    setActiveAccent(nextPreset.id);
    localStorage.setItem('coal_accent_theme', nextPreset.id);
    playPopSound();
    showToast(`Accent set to ${nextPreset.label}`);
  };

  const toggleSound = () => {
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    localStorage.setItem('coal_sound_enabled', String(nextVal));
    if (nextVal) playSuccessSound();
    showToast(nextVal ? 'Sound Feedback Enabled 🔔' : 'Sound Muted 🔕');
  };

  const handleResetDemo = async () => {
    if (confirm('Reset database with authentic industrial sample data?')) {
      await resetToDemoData();
      playSuccessSound();
      showToast('Sample data reloaded successfully!');
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Active 4-Tab detection
  const isSummary = location.pathname === '/';
  const isParties = location.pathname.startsWith('/parties') && !location.pathname.includes('/dispatch');
  const isEntries = location.pathname === '/entries' || location.pathname.includes('/dispatch');
  const isSettings = location.pathname === '/settings';

  return (
    <div className={`device-stage ${isFullscreen || isNative ? 'fullscreen-mode' : ''}`}>
      {/* ── Top Simulator Toolbar (Desktop) ── */}
      {!isNative && (
        <aside aria-label="Simulator Controls" className="simulator-toolbar hidden sm:flex">
          <button
            onClick={() => {
              setIsFullscreen(!isFullscreen);
              playPopSound();
            }}
            className={`sim-pill-btn ${isFullscreen ? 'active' : ''}`}
            title="Toggle Fullscreen vs iPhone Frame"
          >
            {isFullscreen ? <Smartphone style={{ width: 14, height: 14 }} /> : <Maximize2 style={{ width: 14, height: 14 }} />}
            <span>{isFullscreen ? 'iPhone View' : 'Full Screen'}</span>
          </button>

          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.15)' }} />

          <button
            onClick={toggleTheme}
            className="sim-pill-btn"
            title="Toggle Dark/Light Mode"
          >
            {settings?.theme === 'dark' ? (
              <Sun style={{ width: 14, height: 14, color: '#FFD60A' }} />
            ) : (
              <Moon style={{ width: 14, height: 14, color: '#0A84FF' }} />
            )}
            <span>{settings?.theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>

          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.15)' }} />

          {/* Quick Accent Selector */}
          <button
            onClick={cycleAccent}
            className="sim-pill-btn"
            title="Cycle Accent Palette"
          >
            <Palette style={{ width: 14, height: 14, color: ACCENT_PRESETS.find(p => p.id === activeAccent)?.color }} />
            <span>{ACCENT_PRESETS.find(p => p.id === activeAccent)?.label}</span>
          </button>

          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.15)' }} />

          {/* Audio Chimes Toggle */}
          <button
            onClick={toggleSound}
            className="sim-pill-btn"
            title="Toggle Sound FX"
          >
            {soundEnabled ? (
              <Volume2 style={{ width: 14, height: 14, color: 'var(--ios-green)' }} />
            ) : (
              <VolumeX style={{ width: 14, height: 14, color: 'var(--label-tertiary)' }} />
            )}
            <span>{soundEnabled ? 'Sound On' : 'Muted'}</span>
          </button>

          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.15)' }} />

          <button
            onClick={handleResetDemo}
            className="sim-pill-btn"
            title="Load sample industrial parties & dispatches"
          >
            <RotateCcw style={{ width: 13, height: 13 }} />
            <span>Reset Data</span>
          </button>
        </aside>
      )}

      {/* ── iPhone 16 Pro Frame Shell ── */}
      <div className={`iphone-frame ${isFullscreen || isNative ? 'fullscreen-mode' : ''}`}>

        {/* Dynamic Island */}
        {!isNative && (
          <div className="dynamic-island">
            <div className="dynamic-island-sensor" />
            <div style={{ fontSize: 10, color: '#fff', opacity: 0.6, fontWeight: 600 }}>FACTORY LEDGER</div>
            <div className="dynamic-island-cam" />
          </div>
        )}

        {/* ── Apple iOS Status Bar ── */}
        {!isNative && (
          <div className="ios-status-bar">
            <div className="status-time">{currentTime || '9:41'}</div>
            <div className="status-icons">
              {/* Cellular 4-bars */}
              <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor">
                <rect x="0" y="8" width="3" height="3" rx="0.8" />
                <rect x="4.5" y="5.5" width="3" height="5.5" rx="0.8" />
                <rect x="9" y="3" width="3" height="8" rx="0.8" />
                <rect x="13.5" y="0" width="3" height="11" rx="0.8" />
              </svg>
              <Wifi style={{ width: 15, height: 15 }} strokeWidth={2.4} />
              {/* Apple Battery Indicator */}
              <div style={{
                width: 24,
                height: 12,
                borderRadius: 3.5,
                border: '1px solid currentColor',
                padding: 1.5,
                display: 'flex',
                alignItems: 'center',
                position: 'relative'
              }}>
                <div style={{
                  height: '100%',
                  width: '85%',
                  background: 'var(--ios-green)',
                  borderRadius: 1.5
                }} />
                <div style={{
                  position: 'absolute',
                  right: -3.5,
                  top: 3,
                  width: 2,
                  height: 4,
                  borderRadius: '0 1px 1px 0',
                  background: 'currentColor'
                }} />
              </div>
            </div>
          </div>
        )}

        {/* ── Toast Notification ── */}
        {toastMessage && (
          <div style={{
            position: 'absolute',
            top: 56,
            left: 20,
            right: 20,
            zIndex: 99,
            background: 'rgba(28, 28, 30, 0.92)',
            color: '#FFFFFF',
            padding: '10px 16px',
            borderRadius: 20,
            fontSize: 14,
            fontWeight: 500,
            textAlign: 'center',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            backdropFilter: 'blur(20px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            animation: 'fadeIn 0.2s ease'
          }}>
            <Check style={{ width: 16, height: 16, color: 'var(--ios-green)' }} strokeWidth={3} />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* ── Main Scrollable iOS Viewport ── */}
        <main className="ios-viewport pb-32">
          <Outlet context={{ settings }} />
        </main>

        {/* ── Apple iOS Bottom Tab Bar (Solid Floating 4px Dock) ── */}
        <nav aria-label="Main Navigation" className="ios-tabbar">
          {/* Tab 1: Summary */}
          <NavLink
            to="/"
            onClick={() => playPopSound()}
            className={`ios-tab-item ${isSummary ? 'active' : ''}`}
            end
          >
            <div className="ios-tab-pill">
              <LayoutDashboard
                className="ios-tab-icon"
                strokeWidth={isSummary ? 2.4 : 1.7}
              />
            </div>
            <span className="ios-tab-label">Summary</span>
          </NavLink>

          {/* Tab 2: Parties */}
          <NavLink
            to="/parties"
            onClick={() => playPopSound()}
            className={`ios-tab-item ${isParties ? 'active' : ''}`}
          >
            <div className="ios-tab-pill">
              <Building2
                className="ios-tab-icon"
                strokeWidth={isParties ? 2.4 : 1.7}
              />
            </div>
            <span className="ios-tab-label">Parties</span>
          </NavLink>

          {/* Tab 3: All Entries */}
          <NavLink
            to="/entries"
            onClick={() => playPopSound()}
            className={`ios-tab-item ${isEntries ? 'active' : ''}`}
          >
            <div className="ios-tab-pill">
              <FileSpreadsheet
                className="ios-tab-icon"
                strokeWidth={isEntries ? 2.4 : 1.7}
              />
            </div>
            <span className="ios-tab-label">All Entries</span>
          </NavLink>

          {/* Tab 4: Settings */}
          <NavLink
            to="/settings"
            onClick={() => playPopSound()}
            className={`ios-tab-item ${isSettings ? 'active' : ''}`}
          >
            <div className="ios-tab-pill">
              <SettingsIcon
                className="ios-tab-icon"
                strokeWidth={isSettings ? 2.4 : 1.7}
              />
            </div>
            <span className="ios-tab-label">Settings</span>
          </NavLink>
        </nav>

        {/* iOS Bottom Home Indicator (Desktop Simulator Frame) */}
        {!isNative && <div className="home-indicator" />}
      </div>
    </div>
  );
}
