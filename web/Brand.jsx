import React from 'react';

// Ship hull + play-sail emblem. The mark lives in the header dock; this is the wordmark.
export function Brand() {
  return (
    <span className="ls-brand-word">
      Libre<span className="ls-brand-accent">Stream</span>
    </span>
  );
}

export function BrandMark({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path
        d="M17 6.5C17 5.4 18.25 4.75 19.15 5.38L32.4 14.63C33.2 15.19 33.15 16.4 32.3 16.9L19.05 24.65C18.12 25.2 17 24.52 17 23.44V6.5Z"
        fill="currentColor"
      />
      <path d="M14.5 9.5L7.5 23.5H14.5V9.5Z" fill="currentColor" fillOpacity="0.42" />
      <path
        d="M5.5 26.5H34.5L30.2 32.8C29.65 33.6 28.75 34 27.78 34H12.22C11.25 34 10.35 33.6 9.8 32.8L5.5 26.5Z"
        fill="currentColor"
      />
      <path
        d="M4.5 36.8C7.2 35.1 9.5 38.2 12.2 36.8C14.9 35.4 17.3 38.2 20 36.8C22.7 35.4 25.1 38.2 27.8 36.8C30.5 35.4 32.8 38.2 35.5 36.8"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
