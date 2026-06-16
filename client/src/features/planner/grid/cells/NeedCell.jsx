import { CW } from '../../../../lib/constants';

/**
 * Cells encode state instead of printing it: amber tint = gap, green tint =
 * filled, a 2px meter shows filled/needed. Exact numbers appear on hover.
 */
export default function NeedCell({ width, needed, filled, inRange, canPlace, paintActive, onPointerDown }) {
  const cellWidth = width || CW;

  if (!inRange) {
    return (
      <div
        className="shrink-0"
        style={{
          width: cellWidth,
          background: paintActive ? '#4CBAD422' : undefined,
        }}
        onPointerDown={onPointerDown}
      />
    );
  }

  const ok = needed > 0 && filled >= needed;
  const hasGap = needed > 0 && filled < needed;
  const isEditable = canPlace === undefined && needed > 0;
  const isClickable = canPlace === true || isEditable;

  // The bar is the signal — cells stay quiet; exact numbers live on hover.
  // While holding a person, placeability reads through the dimming of
  // non-matching rows and the labeled capacity footer (no cell wash/hints).
  const bg = paintActive ? '#4CBAD433' : 'transparent';
  const cursor = canPlace ? 'cell' : isEditable ? 'pointer' : 'default';

  return (
    <div
      className="group/cell shrink-0 relative"
      style={{
        width: cellWidth, minHeight: 42, background: bg, cursor,
        opacity: canPlace === false ? 0.4 : 1,
        boxShadow: paintActive ? 'inset 0 0 0 1px #4CBAD4' : undefined,
      }}
      onPointerDown={isClickable || canPlace === undefined ? onPointerDown : undefined}
    >
      {needed > 0 && (
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-mono px-1 rounded border bg-white text-text-mid border-border opacity-0 group-hover/cell:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
          {filled.toFixed(2)}/{needed.toFixed(2)}
        </span>
      )}
    </div>
  );
}
