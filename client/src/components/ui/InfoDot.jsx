import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * Small "ⓘ" affordance that reveals how a KPI is calculated. Hover (desktop) or
 * tap (touch) to show; the bubble is portalled to <body> with fixed positioning
 * so it never clips inside a card with overflow hidden. `text` can be a string
 * or JSX. Stops click propagation so it never triggers a clickable parent tile.
 */
export default function InfoDot({ text, label = 'How this is calculated', size = 13, className = '' }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const ref = useRef(null);

  const place = useCallback(() => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ left: r.left + r.width / 2, top: r.bottom + 6 });
  }, []);

  const show = useCallback(() => { place(); setOpen(true); }, [place]);
  const hide = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onMove = () => hide();
    // Any scroll or resize invalidates the anchored position — just close.
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open, hide]);

  return (
    <span
      ref={ref}
      className={`relative inline-flex items-center align-middle ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <button
        type="button"
        aria-label={label}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); open ? hide() : show(); }}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.68) }}
        className="inline-flex items-center justify-center rounded-full border border-current font-bold leading-none text-text-light hover:text-primary cursor-help select-none"
      >
        i
      </button>
      {open && pos &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: 'fixed',
              left: pos.left,
              top: pos.top,
              transform: 'translateX(-50%)',
              zIndex: 9999,
              maxWidth: 280,
            }}
            className="pointer-events-none rounded-lg bg-text text-white text-[10.5px] font-medium leading-snug px-2.5 py-1.5 shadow-lg"
          >
            {text}
          </div>,
          document.body
        )}
    </span>
  );
}
