import React from 'react';

/**
 * The mark: a device screen with a pulse line across it.
 *
 * A stethoscope says "medicine", which is only half the story — this app is
 * about the machines, not the patients. A monitor with a trace says "medical
 * equipment, watched", which is exactly the job. Drawn from two shapes so it
 * still reads at 16px in a browser tab.
 */
export const LogoMark: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <rect x="2" y="4" width="20" height="14" rx="2.5" />
    <path d="M5.5 11h2.7l1.6-3.2 2.6 6.4 1.6-3.2h2.5" />
  </svg>
);

/** The mark in its blue tile, as it appears in the sidebar and on the login screen. */
export const LogoTile: React.FC<{ className?: string; markClassName?: string }> = ({
  className = 'p-2.5 rounded-xl',
  markClassName = 'w-6 h-6',
}) => (
  <div className={`bg-blue-600 text-white shadow-xl shadow-blue-600/20 ${className}`}>
    <LogoMark className={markClassName} />
  </div>
);

export const APP_NAME = 'Biomedic';
export const APP_TAGLINE = 'Registru echipamente medicale';
