import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * A small click-to-open dropdown anchored to its trigger. Portalled to <body>
 * with fixed positioning so it is never clipped by an ancestor's overflow (the
 * heatmaps scroll inside overflow-auto). `trigger` is the clickable node;
 * `items` is [{ label, onClick, icon? }]. Click-outside / scroll / resize
 * closes it. Click handling stops propagation so it never triggers a clickable
 * parent row.
 */
export default function PopoverMenu({ trigger, items, className = '', menuClassName = '' }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const ref = useRef(null);

  const place = useCallback(() => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ left: r.left, top: r.bottom + 4 });
  }, []);

  const toggle = useCallback(
    (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (open) { setOpen(false); return; }
      place();
      setOpen(true);
    },
    [open, place]
  );

  useEffect(() => {
    if (!open) return;
    // Any scroll or resize invalidates the anchored position — just close.
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <span ref={ref} className={`relative inline-flex ${className}`}>
      <span onClick={toggle} className="inline-flex cursor-pointer">
        {trigger}
      </span>
      {open && pos &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[9998]"
              onClick={(e) => { e.stopPropagation(); setOpen(false); }}
            />
            <div
              style={{ position: 'fixed', left: pos.left, top: pos.top, zIndex: 9999 }}
              className={`min-w-[160px] bg-white border border-border-light rounded-xl shadow-[0_10px_26px_-8px_rgba(10,40,52,0.35)] py-1 ${menuClassName}`}
              onClick={(e) => e.stopPropagation()}
            >
              {items.map((it, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setOpen(false); it.onClick(); }}
                  className="w-full text-left px-3 py-2 text-[12px] font-semibold text-text-mid hover:bg-primary-bg hover:text-primary flex items-center gap-2 cursor-pointer bg-transparent border-0"
                >
                  {it.icon && <span className="text-[13px] w-4 text-center shrink-0">{it.icon}</span>}
                  {it.label}
                </button>
              ))}
            </div>
          </>,
          document.body
        )}
    </span>
  );
}
