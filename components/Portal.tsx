
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders children directly into <body>, escaping any ancestor stacking
 * context or transform. Without this, a full-screen overlay declared deep in
 * the tree can be trapped under the app header or clipped by an animated
 * container.
 */
const Portal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(children, document.body);
};

export default Portal;
