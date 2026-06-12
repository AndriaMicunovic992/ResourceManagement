import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { XIcon } from './icons';

export default function Modal({ title, onClose, wide, children }) {
  const panelRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Move focus into the dialog on open and back to the opener on close.
  useEffect(() => {
    const opener = document.activeElement;
    const panel = panelRef.current;
    if (panel) {
      const target = panel.querySelector(
        'input, select, textarea, button:not([data-modal-close])'
      );
      (target || panel).focus();
    }
    return () => {
      if (opener && typeof opener.focus === 'function') opener.focus();
    };
  }, []);

  // Keep Tab cycling inside the dialog.
  const handleKeyDown = (e) => {
    if (e.key !== 'Tab' || !panelRef.current) return;
    const focusables = panelRef.current.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-text/25 backdrop-blur-sm flex items-center justify-center z-[9000]"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        className={`bg-white rounded-2xl p-7 max-h-[85vh] overflow-y-auto shadow-2xl border border-border outline-none ${wide ? 'min-w-[560px] max-w-[700px]' : 'min-w-[380px] max-w-[480px]'}`}
      >
        <div className="flex justify-between items-center mb-5">
          <h3 className="m-0 text-lg font-bold text-text">{title}</h3>
          <button
            onClick={onClose}
            data-modal-close
            aria-label="Close dialog"
            className="bg-primary-light border-0 w-7 h-7 rounded-lg text-primary cursor-pointer flex items-center justify-center hover:opacity-80"
          >
            <XIcon size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
