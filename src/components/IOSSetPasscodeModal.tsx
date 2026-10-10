import { useState } from 'react';
import {
  enableAppLock,
  updatePin,
  verifyPin,
  getPinLength,
  isBiometricAvailable,
  isBiometricEnabled,
} from '../utils/securityLock';
import { playCashChime, playPopSound, playSuccessSound } from '../utils/delight';
import { Lock, X, Delete, Copy, Check, ShieldCheck } from 'lucide-react';
import IOSRecoveryKeyModal from './IOSRecoveryKeyModal';

interface IOSSetPasscodeModalProps {
  isOpen: boolean;
  isChangingExisting?: boolean;
  onSuccess: (withBiometrics: boolean) => void;
  onCancel: () => void;
}

type ModalStep = 'verify_current' | 'enter_new' | 'confirm_new' | 'show_recovery_key';

export default function IOSSetPasscodeModal({
  isOpen,
  isChangingExisting = false,
  onSuccess,
  onCancel,
}: IOSSetPasscodeModalProps) {
  const [step, setStep] = useState<ModalStep>('enter_new');
  const [currentPin, setCurrentPin] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [generatedKey, setGeneratedKey] = useState('');
  const [bioSupportedState, setBioSupportedState] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const currentPinLen = getPinLength();

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setStep(isChangingExisting ? 'verify_current' : 'enter_new');
      setCurrentPin('');
      setPin('');
      setConfirmPin('');
      setErrorMessage('');
      setIsShaking(false);
      setShowRecoveryModal(false);
      setKeyCopied(false);
    }
  }

  if (!isOpen) return null;

  const handleDigit = async (digit: string) => {
    playPopSound();
    setErrorMessage('');

    if (step === 'verify_current') {
      const next = currentPin + digit;
      if (next.length <= currentPinLen) {
        setCurrentPin(next);
        if (next.length === currentPinLen) {
          const isValid = await verifyPin(next);
          if (isValid) {
            playPopSound();
            setTimeout(() => {
              setStep('enter_new');
            }, 180);
          } else {
            setIsShaking(true);
            setErrorMessage('Incorrect current passcode');
            setTimeout(() => {
              setIsShaking(false);
              setCurrentPin('');
            }, 550);
          }
        }
      }
    } else if (step === 'enter_new') {
      const next = pin + digit;
      if (next.length <= 5) {
        setPin(next);
        if (next.length === 5) {
          setTimeout(() => {
            setStep('confirm_new');
          }, 180);
        }
      }
    } else {
      const next = confirmPin + digit;
      if (next.length <= 5) {
        setConfirmPin(next);
        if (next.length === 5) {
          if (next === pin) {
            // Success! Save PIN
            if (isChangingExisting) {
              await updatePin(next);
              playCashChime();
              onSuccess(isBiometricEnabled());
            } else {
              const bioSupported = await isBiometricAvailable();
              const newRecoveryKey = await enableAppLock(next, bioSupported);
              playCashChime();
              setBioSupportedState(bioSupported);
              if (newRecoveryKey) {
                setGeneratedKey(newRecoveryKey);
                setStep('show_recovery_key');
              } else {
                onSuccess(bioSupported);
              }
            }
          } else {
            // Mismatch
            setIsShaking(true);
            setErrorMessage('Passcodes do not match. Please try again.');
            setTimeout(() => {
              setIsShaking(false);
              setConfirmPin('');
              setPin('');
              setStep('enter_new');
            }, 550);
          }
        }
      }
    }
  };

  const handleDelete = () => {
    playPopSound();
    setErrorMessage('');
    if (step === 'verify_current') {
      if (currentPin.length > 0) setCurrentPin(currentPin.slice(0, -1));
    } else if (step === 'enter_new') {
      if (pin.length > 0) setPin(pin.slice(0, -1));
    } else {
      if (confirmPin.length > 0) setConfirmPin(confirmPin.slice(0, -1));
    }
  };

  const currentVal =
    step === 'verify_current' ? currentPin : step === 'enter_new' ? pin : confirmPin;
  const currentTotalDots = step === 'verify_current' ? currentPinLen : 5;

  const KEYPAD_BUTTONS = [
    { num: '1', letters: '' },
    { num: '2', letters: 'A B C' },
    { num: '3', letters: 'D E F' },
    { num: '4', letters: 'G H I' },
    { num: '5', letters: 'J K L' },
    { num: '6', letters: 'M N O' },
    { num: '7', letters: 'P Q R S' },
    { num: '8', letters: 'T U V' },
    { num: '9', letters: 'W X Y Z' },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(0, 0, 0, 0.65)',
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
          padding: '24px 20px 28px',
          boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
          border: '0.5px solid var(--separator-opaque, #2C2D35)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
        }}
      >
        {/* Cancel button */}
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

        {step === 'show_recovery_key' ? (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: 'var(--ios-green)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              <ShieldCheck size={28} />
            </div>

            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--label-primary)', margin: '0 0 6px', textAlign: 'center' }}>
              App Lock Protected!
            </h3>

            <p style={{ fontSize: 13, color: 'var(--label-secondary)', textAlign: 'center', margin: '0 0 16px', lineHeight: 1.4 }}>
              Save this <strong>Device Emergency Recovery Code</strong> outside the app. It is shown only once and can reset the PIN on this phone.
            </p>

            <div
              style={{
                width: '100%',
                background: 'var(--fill-quaternary)',
                border: '1px solid var(--separator)',
                borderRadius: 16,
                padding: '16px 14px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                marginBottom: 20,
              }}
            >
              <div style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 800, letterSpacing: 2.5, color: 'var(--label-primary)' }}>
                {generatedKey}
              </div>

              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(generatedKey);
                    setKeyCopied(true);
                    playSuccessSound();
                    setTimeout(() => setKeyCopied(false), 2200);
                  } catch { }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: keyCopied ? 'rgba(52, 199, 89, 0.16)' : 'var(--fill-secondary)',
                  border: `1px solid ${keyCopied ? 'var(--ios-green)' : 'var(--separator)'}`,
                  color: keyCopied ? 'var(--ios-green)' : 'var(--label-primary)',
                  borderRadius: 10,
                  padding: '7px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {keyCopied ? <Check size={15} /> : <Copy size={15} />}
                <span>{keyCopied ? 'Copied to Clipboard' : 'Copy Key'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                onSuccess(bioSupportedState);
              }}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 14,
                background: 'var(--ios-blue, #0A84FF)',
                border: 'none',
                color: '#FFFFFF',
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              I Have Saved My Key
            </button>
          </div>
        ) : (
          <>
            {/* Header Icon */}
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'var(--ios-blue)',
                color: 'var(--bg-card)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              <Lock size={22} />
            </div>

            {isChangingExisting && (
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--ios-blue, #0A84FF)',
                  marginBottom: 4,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                {step === 'verify_current'
                  ? 'Step 1 of 3 · Verify Identity'
                  : step === 'enter_new'
                    ? 'Step 2 of 3 · New Passcode'
                    : 'Step 3 of 3 · Confirm'}
              </div>
            )}

            <h3
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--label-primary, #FFFFFF)',
                margin: '0 0 4px',
                textAlign: 'center',
              }}
            >
              {step === 'verify_current'
                ? 'Enter Current Passcode'
                : step === 'enter_new'
                  ? isChangingExisting
                    ? 'Enter New 5-Digit Passcode'
                    : 'Set 5-Digit Passcode'
                  : 'Re-enter New Passcode'}
            </h3>

            <div
              style={{
                fontSize: 13,
                color: errorMessage ? 'var(--ios-red, #FF453A)' : 'var(--label-secondary, #8E8E93)',
                marginBottom: 16,
                textAlign: 'center',
                minHeight: 18,
                padding: '0 8px',
              }}
            >
              {errorMessage ||
                (step === 'verify_current'
                  ? 'Verify your current passcode to authorize change'
                  : step === 'enter_new'
                    ? 'Choose a 5-digit security code'
                    : 'Confirm your new passcode to save')}
            </div>

            {/* Pin Dots */}
            <div
              style={{
                display: 'flex',
                gap: 16,
                marginBottom: step === 'verify_current' ? 12 : 24,
                animation: isShaking ? 'ios-shake 0.4s ease-in-out' : 'none',
              }}
            >
              {Array.from({ length: currentTotalDots }).map((_, idx) => {
                const isFilled = currentVal.length > idx;
                return (
                  <div
                    key={idx}
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: isFilled ? 'var(--ios-blue, #0A84FF)' : 'transparent',
                      border: isFilled ? 'none' : '1.5px solid var(--label-tertiary, #636366)',
                      transition: 'all 0.15s ease',
                    }}
                  />
                );
              })}
            </div>

            {/* Forgot Current Passcode Link */}
            {step === 'verify_current' && (
              <button
                type="button"
                onClick={() => {
                  playPopSound();
                  setShowRecoveryModal(true);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--ios-blue, #0A84FF)',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  marginBottom: 16,
                  padding: '4px 8px',
                  outline: 'none',
                }}
              >
                Forgot Current Passcode?
              </button>
            )}

            {/* Compact Keypad */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 68px)',
                gap: '12px 18px',
                justifyContent: 'center',
              }}
            >
              {KEYPAD_BUTTONS.map((item) => (
                <button
                  key={item.num}
                  type="button"
                  onClick={() => handleDigit(item.num)}
                  style={{
                    width: 68,
                    height: 56,
                    borderRadius: 14,
                    background: 'var(--fill-quaternary, #262730)',
                    border: '0.5px solid var(--separator-opaque, #33343F)',
                    color: 'var(--label-primary, #FFFFFF)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    outline: 'none',
                    padding: 0,
                  }}
                >
                  <span style={{ fontSize: 22, fontWeight: 600 }}>{item.num}</span>
                  {item.letters && (
                    <span style={{ fontSize: 8, color: 'var(--label-secondary, #8E8E93)', fontWeight: 600 }}>
                      {item.letters}
                    </span>
                  )}
                </button>
              ))}

              <div style={{ width: 68, height: 56 }} />

              <button
                type="button"
                onClick={() => handleDigit('0')}
                style={{
                  width: 68,
                  height: 56,
                  borderRadius: 14,
                  background: 'var(--fill-quaternary, #262730)',
                  border: '0.5px solid var(--separator-opaque, #33343F)',
                  color: 'var(--label-primary, #FFFFFF)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  outline: 'none',
                  padding: 0,
                }}
              >
                <span style={{ fontSize: 22, fontWeight: 600 }}>0</span>
              </button>

              <button
                type="button"
                onClick={handleDelete}
                style={{
                  width: 68,
                  height: 56,
                  borderRadius: 14,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--label-secondary, #8E8E93)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  outline: 'none',
                  padding: 0,
                }}
              >
                <Delete size={22} />
              </button>
            </div>
          </>
        )}

        {/* Emergency Recovery Key Modal */}
        {showRecoveryModal && (
          <IOSRecoveryKeyModal
            isOpen={showRecoveryModal}
            onSuccess={() => {
              setShowRecoveryModal(false);
              setStep('enter_new');
            }}
            onCancel={() => setShowRecoveryModal(false)}
          />
        )}

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
