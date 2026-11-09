import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

/* LibreStream primitives. No component library: these are the only controls
   the app uses, built on native elements so focus, keyboard and semantics
   come from the browser. */

export function Button({
  children,
  label,
  variant = 'secondary',
  size = 'md',
  icon,
  onClick,
  disabled = false,
  busy = false,
  type = 'button',
  className = '',
  ...rest
}) {
  return (
    <button
      type={type}
      className={`ls-btn ls-btn--${variant} ls-btn--${size} ${className}`.trim()}
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy ? <span className="ls-btn-spinner" aria-hidden="true" /> : icon}
      {label || children}
    </button>
  );
}

export function IconButton({ icon, label, onClick, active = false, className = '', ...rest }) {
  return (
    <button
      type="button"
      className={`ls-iconbtn ${active ? 'is-active' : ''} ${className}`.trim()}
      aria-label={label}
      title={label}
      onClick={onClick}
      {...rest}
    >
      {icon}
    </button>
  );
}

export function Badge({ children, tone = 'neutral', className = '' }) {
  return <span className={`ls-badge ls-badge--${tone} ${className}`.trim()}>{children}</span>;
}

export function Chip({ children, active = false, onClick, className = '' }) {
  return (
    <button
      type="button"
      className={`ls-chip ${active ? 'is-active' : ''} ${className}`.trim()}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function Field({ label, value, onChange, placeholder, type = 'text', inputRef, autoComplete = 'off' }) {
  const id = useRef(`f${Math.random().toString(36).slice(2, 8)}`);
  return (
    <div className="ls-field">
      <label className="ls-field-label" htmlFor={id.current}>
        {label}
      </label>
      <input
        id={id.current}
        ref={inputRef}
        className="ls-input"
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export function Select({ label, value, options, onChange, className = '' }) {
  const id = useRef(`s${Math.random().toString(36).slice(2, 8)}`);
  return (
    <div className={`ls-select ${className}`.trim()}>
      <label className="ls-field-label" htmlFor={id.current}>
        {label}
      </label>
      <div className="ls-select-wrap">
        <select
          id={id.current}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="ls-select-caret" aria-hidden="true">▾</span>
      </div>
    </div>
  );
}

export function Segmented({ label, value, options, onChange }) {
  return (
    <div className="ls-segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={value === option.value ? 'is-active' : ''}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, children, labelledBy, wide = false, bare = false }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement;

    const focusables = () =>
      [...(ref.current?.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
      ) || [])].filter((el) => el.offsetParent !== null);

    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      // Keep Tab inside the dialog.
      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = setTimeout(() => focusables()[0]?.focus(), 30);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      clearTimeout(timer);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="ls-modal-root">
      <div className="ls-modal-scrim" onClick={onClose} aria-hidden="true" />
      <div
        className={`ls-modal ${wide ? 'is-wide' : ''} ${bare ? 'is-bare' : ''}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        ref={ref}
      >
        {children}
      </div>
    </div>
  );
}

export function ModalHeader({ title, id, onClose, actions }) {
  return (
    <header className="ls-modal-head">
      <h2 id={id} className="ls-modal-title">{title}</h2>
      <div className="ls-modal-head-actions">
        {actions}
        {onClose && (
          <button type="button" className="ls-iconbtn" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        )}
      </div>
    </header>
  );
}

export function Skeleton({ width = '100%', height = 16, radius = 8 }) {
  return (
    <span
      className="ls-skeleton"
      style={{ width, height: typeof height === 'number' ? `${height}px` : height, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}

export function Spinner({ label = 'Loading' }) {
  return <span className="ls-spinner" role="status" aria-label={label} />;
}
