import React, { useState } from 'react';

export default function FloatingField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  suffix,
  step,
  required = false,
  autoFocus = false,
  style,
  inputStyle,
}: {
  label: string;
  value: string | number;
  onChange: (val: string) => void;
  type?: string;
  placeholder?: string;
  suffix?: string;
  step?: string;
  required?: boolean;
  autoFocus?: boolean;
  style?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [localVal, setLocalVal] = useState<string>(() => {
    if (value === 0 || value === '0') return '';
    return value !== undefined && value !== null ? String(value) : '';
  });

  const [prevValue, setPrevValue] = useState(value);

  // Sync localVal during render when external prop changes while not actively typing
  if (value !== prevValue) {
    setPrevValue(value);
    if (!isFocused) {
      setLocalVal(value === 0 || value === '0' ? '' : (value !== undefined && value !== null ? String(value) : ''));
    }
  }

  const isFloated =
    type === 'date' ||
    isFocused ||
    Boolean(localVal !== '' && localVal !== undefined && localVal !== null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalVal(val);
    onChange(val);
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (value === 0 || value === '0') {
      setLocalVal('');
    } else {
      setLocalVal(value !== undefined && value !== null ? String(value) : '');
    }
  };

  return (
    <div
      className={`floating-field ${isFocused ? 'is-focused' : ''} ${isFloated ? 'is-floated' : ''} ${suffix ? 'has-suffix' : ''}`}
      style={{ marginBottom: 12, ...style }}
    >
      <input
        type={type}
        step={step}
        required={required}
        autoFocus={autoFocus}
        placeholder={isFloated && placeholder ? placeholder : ''}
        value={localVal}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={handleBlur}
        className="floating-input"
        style={inputStyle}
      />
      <label className="floating-label">
        {label}
      </label>
      {suffix && (
        <span className="floating-suffix">
          {suffix}
        </span>
      )}
    </div>
  );
}
