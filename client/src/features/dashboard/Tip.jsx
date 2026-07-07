import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * Hover tooltip for heatmap cells. Rendered through a portal with fixed
 * positioning so the heatmaps' overflow-auto containers can't clip it.
 * `content` is a ready-to-render node; pass null to disable entirely.
 */
export default function Tip({ content, children, className }) {
  const [pos, setPos] = useState(null);
  const move = useCallback((e) => setPos({ x: e.clientX, y: e.clientY }), []);
  const active = content != null;
  // Above the cursor by default; flip below near the top of the viewport.
  const below = pos && pos.y < 130;
  return (
    <div
      className={className}
      onMouseEnter={active ? move : undefined}
      onMouseMove={active ? move : undefined}
      onMouseLeave={() => setPos(null)}
    >
      {children}
      {active && pos &&
        createPortal(
          <div
            className="fixed z-50 pointer-events-none bg-[#16323C] text-white rounded-xl px-3 py-2 text-[10.5px] leading-relaxed shadow-[0_10px_26px_-8px_rgba(10,40,52,0.55)] max-w-[250px]"
            style={{
              left: Math.min(pos.x + 14, window.innerWidth - 260),
              top: below ? pos.y + 18 : pos.y - 12,
              transform: below ? 'none' : 'translateY(-100%)',
            }}
          >
            {content}
          </div>,
          document.body
        )}
    </div>
  );
}

/** One aligned label/value line inside a Tip. */
export function TipRow({ swatch, label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5">
        {swatch && <i className="w-2 h-2 rounded-full inline-block" style={{ background: swatch }} />}
        {label}
      </span>
      <b>{value}</b>
    </div>
  );
}
