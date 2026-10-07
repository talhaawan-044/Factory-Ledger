import { useState, useEffect } from 'react';
import { verifyRecoveryKey } from '../utils/securityLock';
import { playCashChime, playPopSound } from '../utils/delight';
import { KeyRound, X, ClipboardPaste, ArrowRight, ShieldAlert } from 'lucide-react';

interface IOSRecoveryKeyModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function IOSRecoveryKeyModal({
  isOpen,
  onSuccess,
  onCancel,
}: IOSRecoveryKeyModalProps) {
  const [keyInput, setKeyInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isShaking, setIsShaking] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setKeyInput('');
      setErrorMessage('');
      setIsShaking(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFormatInput = (val: string) => {
    // Keep uppercase alphanumeric and dashes
    const cleaned = val.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    setKeyInput(cleaned);
    setErrorMessage('');
  };

  const handlePaste = async () => {
    try {
      playPopSound();
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          handleFormatInput(text.trim());
        }
      }
    } catch {
      // Clipboard read may require user focus or permission
    }
  };

  const handleVerify = () => {
    if (!keyInput.trim()) {
      setErrorMessage('Please enter your recovery key');
      return;
    }

    const isValid = verifyRecoveryKey(keyInput.trim());
    if (isValid) {
      playCashChime();
      onSuccess();
    } else {
      setIsShaking(true);
      setErrorMessage('Invalid recovery key. Please check and try again.');
      setTimeout(() => setIsShaking(false), 500);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999999,
        background: 'rgba(0, 0, 0, 0.72)',
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
          onClick={onCancel}
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
            color: 'white',
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
          Reset Forgotten Passcode
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
          Enter your secret offline Master Recovery Key to verify identity and choose a new 5-digit PIN.
        </p>

        {/* Key Input Box */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            background: 'var(--fill-quaternary, #262730)',
            borderRadius: 14,
            border: `1.5px solid ${errorMessage ? 'var(--ios-red, #FF453A)' : 'var(--separator-opaque, #33343F)'}`,
            padding: '2px 8px 2px 14px',
            marginBottom: 10,
            animation: isShaking ? 'ios-shake 0.4s ease-in-out' : 'none',
          }}
        >
          <input
            type="text"
            value={keyInput}
            onChange={(e) => handleFormatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleVerify();
            }}
            placeholder="FL-XXXX-XXXX"
            autoFocus
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: 'var(--label-primary, #FFFFFF)',
              fontSize: 18,
              fontWeight: 700,
              fontFamily: 'monospace',
              letterSpacing: 2,
              padding: '12px 0',
              outline: 'none',
              textTransform: 'uppercase',
            }}
          />

          <button
            type="button"
            onClick={handlePaste}
            title="Paste from Clipboard"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--ios-blue, #0A84FF)',
              padding: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ClipboardPaste size={20} />
          </button>
        </div>

        {/* Error message */}
        <div
          style={{
            fontSize: 12,
            color: 'var(--ios-red, #FF453A)',
            minHeight: 18,
            marginBottom: 14,
            textAlign: 'center',
            fontWeight: 500,
          }}
        >
          {errorMessage}
        </div>

        {/* Privacy Note */}
        <div
          style={{
            width: '100%',
            background: 'rgba(255, 159, 10, 0.08)',
            border: '0.5px solid rgba(255, 159, 10, 0.25)',
            borderRadius: 12,
            padding: '10px 12px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          <ShieldAlert size={16} color="#FF9F0A" style={{ flexShrink: 0, marginTop: 2 }} />
          <span style={{ fontSize: 12, color: 'var(--label-secondary, #8E8E93)', lineHeight: 1.35 }}>
            This recovery key operates 100% offline. No internet connection is needed to reset your PIN.
          </span>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={handleVerify}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: 14,
            background: 'var(--ios-blue, #0A84FF)',
            border: 'none',
            color: '#FFFFFF',
            fontSize: 15,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            cursor: 'pointer',
          }}
        >
          <span>Verify & Reset Passcode</span>
          <ArrowRight size={18} />
        </button>

        <style>{`
          @keyframes ios-shake {
            0%, 100% { transform: translateX(0); }
            20% { transform: translateX(-12px); }
            40% { transform: translateX(12px); }
            60% { transform: translateX(-8px); }
            80% { transform: translateX(8px); }
          }
        `}</style>
      </div>
    </div>
  );
}
