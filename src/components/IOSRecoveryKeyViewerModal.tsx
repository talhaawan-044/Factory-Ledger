import { useState, useEffect } from 'react';
import { getOrCreateRecoveryKey, regenerateRecoveryKey } from '../utils/securityLock';
import { playPopSound, playSuccessSound } from '../utils/delight';
import { KeyRound, X, Copy, Check, RefreshCw, ShieldCheck } from 'lucide-react';
import IOSConfirmModal from './IOSConfirmModal';

interface IOSRecoveryKeyViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function IOSRecoveryKeyViewerModal({
  isOpen,
  onClose,
}: IOSRecoveryKeyViewerModalProps) {
  const [recoveryKey, setRecoveryKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRecoveryKey(getOrCreateRecoveryKey());
      setCopied(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      playPopSound();
      await navigator.clipboard.writeText(recoveryKey);
      setCopied(true);
      playSuccessSound();
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback
    }
  };

  const handleConfirmRegenerate = () => {
    setShowRegenConfirm(false);
    const newKey = regenerateRecoveryKey();
    setRecoveryKey(newKey);
    setCopied(false);
    playSuccessSound();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(20px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        className="ios-fade-in"
        style={{
          width: '100%',
          maxWidth: 360,
          background: 'var(--bg-card, #1C1D24)',
          borderRadius: 24,
          padding: '26px 20px 24px',
          boxShadow: '0 20px 48px rgba(0,0,0,0.5)',
          border: '0.5px solid var(--separator-opaque, #2C2D35)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            background: 'var(--fill-tertiary, #2C2D35)',
            border: 'none',
            borderRadius: '50%',
            width: 30,
            height: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--label-secondary, #8E8E93)',
          }}
        >
          <X size={16} />
        </button>

        {/* Icon */}
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: 'var(--ios-yellow)',
            color: 'var(--bg-card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 14,
          }}
        >
          <KeyRound size={26} />
        </div>

        <h3
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--label-primary, #FFFFFF)',
            margin: '0 0 6px',
            textAlign: 'center',
          }}
        >
          Master Recovery Key
        </h3>

        <p
          style={{
            fontSize: 13,
            color: 'var(--label-secondary, #8E8E93)',
            margin: '0 0 18px',
            textAlign: 'center',
            lineHeight: 1.4,
          }}
        >
          Save this key in your private notes, safe, or diary. It allows you to reset your 5-digit PIN completely offline.
        </p>

        {/* Highlighted Key Card */}
        <div
          style={{
            width: '100%',
            background: 'var(--fill-quaternary, #262730)',
            border: '1px solid var(--separator-opaque, #33343F)',
            borderRadius: 16,
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: 3,
              color: 'var(--label-primary, #FFFFFF)',
              userSelect: 'all',
            }}
          >
            {recoveryKey}
          </div>

          <button
            type="button"
            onClick={handleCopy}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: copied ? 'rgba(52, 199, 89, 0.16)' : 'var(--fill-tertiary, #2C2D35)',
              border: `1px solid ${copied ? 'var(--ios-green, #34C759)' : 'var(--separator-opaque, #3A3B45)'}`,
              color: copied ? 'var(--ios-green, #34C759)' : 'var(--label-primary, #FFFFFF)',
              borderRadius: 10,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            <span>{copied ? 'Copied to Clipboard' : 'Copy Key'}</span>
          </button>
        </div>

        {/* Security Info Box */}
        <div
          style={{
            width: '100%',
            background: 'rgba(10, 132, 255, 0.08)',
            border: '0.5px solid rgba(10, 132, 255, 0.25)',
            borderRadius: 12,
            padding: '10px 12px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          <ShieldCheck size={16} color="var(--ios-blue, #0A84FF)" style={{ flexShrink: 0, marginTop: 2 }} />
          <span style={{ fontSize: 12, color: 'var(--label-secondary, #8E8E93)', lineHeight: 1.35 }}>
            Because this key is kept offline, nobody holding your phone can reset your PIN without knowing this secret code.
          </span>
        </div>

        {/* Footer Actions */}
        <div style={{ width: '100%', display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={() => setShowRegenConfirm(true)}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: 12,
              background: 'transparent',
              border: '0.5px solid var(--separator-opaque, #33343F)',
              color: 'var(--label-secondary, #8E8E93)',
              fontSize: 13,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} />
            <span>New Key</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: 12,
              background: 'var(--ios-blue, #0A84FF)',
              border: 'none',
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>

        <IOSConfirmModal
          isOpen={showRegenConfirm}
          title="Regenerate Recovery Key?"
          message="Generating a new key will invalidate your previous recovery key. Be sure to save the new one."
          confirmText="Generate New Key"
          cancelText="Keep Current"
          destructive={false}
          countdownSeconds={0}
          icon="warning"
          onConfirm={handleConfirmRegenerate}
          onCancel={() => setShowRegenConfirm(false)}
        />
      </div>
    </div>
  );
}
