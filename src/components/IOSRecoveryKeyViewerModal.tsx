import { useState } from 'react';
import { hasRecoveryKey, regenerateRecoveryKey } from '../utils/securityLock';
import { playPopSound, playSuccessSound } from '../utils/delight';
import { Check, Copy, KeyRound, RefreshCw, ShieldCheck, X } from 'lucide-react';
import IOSConfirmModal from './IOSConfirmModal';
import IOSVerifyPasscodeModal from './IOSVerifyPasscodeModal';

interface IOSRecoveryKeyViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function IOSRecoveryKeyViewerModal({ isOpen, onClose }: IOSRecoveryKeyViewerModalProps) {
  const [recoveryKey, setRecoveryKey] = useState('');
  const [configured, setConfigured] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [showAuthentication, setShowAuthentication] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setConfigured(hasRecoveryKey());
      setRecoveryKey('');
      setCopied(false);
      setShowRegenConfirm(false);
      setShowAuthentication(false);
      setIsGenerating(false);
    }
  }

  if (!isOpen) return null;

  const handleClose = () => {
    setRecoveryKey('');
    onClose();
  };

  const handleCopy = async () => {
    if (!recoveryKey) return;
    try {
      playPopSound();
      await navigator.clipboard.writeText(recoveryKey);
      setCopied(true);
      playSuccessSound();
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard permission can be denied; the displayed code remains selectable.
    }
  };

  const handleAuthenticatedRegeneration = async () => {
    setShowAuthentication(false);
    setIsGenerating(true);
    try {
      const newKey = await regenerateRecoveryKey();
      setRecoveryKey(newKey);
      setConfigured(true);
      setCopied(false);
      playSuccessSound();
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999999, background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="ios-fade-in" style={{ width: '100%', maxWidth: 380, background: 'var(--bg-card, #1C1D24)', borderRadius: 24, padding: '26px 20px 24px', boxShadow: '0 20px 48px rgba(0,0,0,0.5)', border: '0.5px solid var(--separator-opaque, #2C2D35)', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
        <button type="button" onClick={handleClose} aria-label="Close" style={{ position: 'absolute', top: 14, right: 14, background: 'var(--fill-tertiary, #2C2D35)', border: 'none', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--label-secondary, #8E8E93)' }}>
          <X size={16} />
        </button>

        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--ios-yellow)', color: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
          <KeyRound size={26} />
        </div>

        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--label-primary)', margin: '0 0 6px', textAlign: 'center' }}>
          Device Emergency Recovery Code
        </h3>
        <p style={{ fontSize: 13, color: 'var(--label-secondary)', margin: '0 0 18px', textAlign: 'center', lineHeight: 1.45 }}>
          This code resets the Factory Ledger PIN on this phone. It is not connected to the Gmail account currently signed in.
        </p>

        <div style={{ width: '100%', background: 'var(--fill-quaternary, #262730)', border: '1px solid var(--separator-opaque, #33343F)', borderRadius: 16, padding: '16px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          {recoveryKey ? (
            <>
              <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, letterSpacing: 1.6, color: 'var(--label-primary)', userSelect: 'all', textAlign: 'center' }}>
                {recoveryKey}
              </div>
              <button type="button" onClick={handleCopy} style={{ display: 'flex', alignItems: 'center', gap: 6, background: copied ? 'rgba(52, 199, 89, 0.16)' : 'var(--fill-tertiary)', border: `1px solid ${copied ? 'var(--ios-green)' : 'var(--separator-opaque)'}`, color: copied ? 'var(--ios-green)' : 'var(--label-primary)', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copied to Clipboard' : 'Copy Recovery Code'}
              </button>
              <div style={{ fontSize: 12, color: 'var(--ios-yellow)', textAlign: 'center', lineHeight: 1.4 }}>
                Save it now. After closing this window, the code cannot be displayed again.
              </div>
            </>
          ) : (
            <>
              <ShieldCheck size={24} color="var(--ios-green, #34C759)" />
              <div style={{ fontSize: 14, fontWeight: 650, color: 'var(--label-primary)', textAlign: 'center' }}>
                {configured ? 'Recovery code is configured' : 'No recovery code is configured'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--label-secondary)', textAlign: 'center', lineHeight: 1.4 }}>
                For security, Factory Ledger stores only a one-way verifier—not a readable copy of your code.
              </div>
            </>
          )}
        </div>

        <div style={{ width: '100%', background: 'rgba(10, 132, 255, 0.08)', border: '0.5px solid rgba(10, 132, 255, 0.25)', borderRadius: 12, padding: '10px 12px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <ShieldCheck size={16} color="var(--ios-blue, #0A84FF)" style={{ flexShrink: 0, marginTop: 2 }} />
          <span style={{ fontSize: 12, color: 'var(--label-secondary)', lineHeight: 1.35 }}>
            Creating a replacement requires your current app PIN or Android Phone Lock and immediately invalidates the previous code.
          </span>
        </div>

        <div style={{ width: '100%', display: 'flex', gap: 10 }}>
          <button type="button" onClick={() => setShowRegenConfirm(true)} disabled={isGenerating} style={{ flex: 1, padding: '12px', borderRadius: 12, background: 'transparent', border: '0.5px solid var(--separator-opaque)', color: 'var(--label-secondary)', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: isGenerating ? 'wait' : 'pointer', opacity: isGenerating ? 0.6 : 1 }}>
            <RefreshCw size={14} />
            {isGenerating ? 'Generating…' : configured ? 'Replace Code' : 'Create Code'}
          </button>
          <button type="button" onClick={handleClose} style={{ flex: 1, padding: '12px', borderRadius: 12, background: 'var(--ios-blue)', border: 'none', color: '#FFFFFF', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Done
          </button>
        </div>

        <IOSConfirmModal
          isOpen={showRegenConfirm}
          title={configured ? 'Replace Recovery Code?' : 'Create Recovery Code?'}
          message={configured ? 'Your previous recovery code will stop working immediately. The new code will be shown only once.' : 'The new device recovery code will be shown only once. Save it outside the app.'}
          confirmText={configured ? 'Replace Code' : 'Create Code'}
          cancelText="Cancel"
          destructive={false}
          countdownSeconds={0}
          icon="warning"
          onConfirm={() => {
            setShowRegenConfirm(false);
            setShowAuthentication(true);
          }}
          onCancel={() => setShowRegenConfirm(false)}
        />

        <IOSVerifyPasscodeModal
          isOpen={showAuthentication}
          title="Authorize Recovery Code Change"
          subtitle="Enter your current app PIN or use Android Phone Lock"
          onSuccess={handleAuthenticatedRegeneration}
          onCancel={() => setShowAuthentication(false)}
        />
      </div>
    </div>
  );
}
