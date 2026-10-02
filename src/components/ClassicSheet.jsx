import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

function statusBar(bg) {
  try {
    window.parent.postMessage({ type: 'hvs-statusbar', bg }, '*');
  } catch (e) {
    /* no parent */
  }
}

// openOverlay() from app.js: mounts on <body>, adds .show on the next frame for the CSS transition,
// dims the device frame's status bar, and closes on Escape.
function useOverlay(onClose, barColor) {
  const [shown, setShown] = useState(false);
  // Callers pass inline handlers; a ref keeps the mount effect (and its animation) from re-running.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    statusBar(barColor);
    document.body.classList.add('no-scroll');
    const t = setTimeout(() => setShown(true), 16);
    const onKey = (e) => e.key === 'Escape' && closeRef.current();
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
      statusBar('#f5f5f5');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return shown ? ' show' : '';
}

export const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M5 5l14 14M19 5 5 19" />
  </svg>
);

// Bottom sheet (.mask + .bsheet).
export function Sheet({ className = '', onClose, children }) {
  const show = useOverlay(onClose, '#a8a8a8');
  return createPortal(
    <div>
      <div className={'mask light' + show} onClick={onClose} />
      <div className={'bsheet ' + className + show} role="dialog" aria-modal="true">
        {children}
      </div>
    </div>,
    document.body
  );
}

// Sheet header with a title and the ✕ button.
export function SheetHead({ title, onClose }) {
  return (
    <div className="bsheet-head">
      <h3>{title}</h3>
      <button type="button" onClick={onClose} aria-label="Close">
        <CloseIcon />
      </button>
    </div>
  );
}
