import { CW } from '../../../../lib/constants';

/**
 * Cells encode state instead of printing it: amber tint = gap, green tint =
 * filled, a 2px meter shows filled/needed. Exact numbers appear on hover.
 */
export default function NeedCell({ width, needed, filled, inRange, canPlace, heldFree, paintActive, qEnd, onPointerDown }) {
  const cellWidth = width || CW;

  if (!inRange) {
    return (
      <div
        className="shrink-0"
        style={{
          width: cellWidth,
          background: paintActive ? '#4CBAD422' : undefined,
          borderRight: qEnd ? '1px solid #E2ECF2' : undefined,
        }}
        onPointerDown={onPointerDown}
      />
    );
  }

  const ok = needed > 0 && filled >= needed;
  const hasGap = needed > 0 && filled < needed;
  const isEditable = canPlace === undefined && needed > 0;
  const isClickable = canPlace === true || isEditable;
  const ratio = needed > 0 ? Math.min(1, filled / needed) : 0;

  const bg = paintActive
    ? '#4CBAD433'
    : canPlace
      ? '#E0F4FA40'
      : ok
        ? 'rgba(91,198,138,0.07)'
        : hasGap
          ? 'rgba(245,166,35,0.07)'
          : 'transparent';
  const cursor = canPlace ? 'cell' : isEditable ? 'pointer' : 'default';

  return (
    <div
      className="group/cell shrink-0 relative"
      style={{
        width: cellWidth, minHeight: 42, background: bg, cursor,
        opacity: canPlace === false ? 0.4 : 1,
        boxShadow: paintActive ? 'inset 0 0 0 1px #4CBAD4' : undefined,
        borderRight: qEnd ? '1px solid #E2ECF2' : undefined,
      }}
      onPointerDown={isClickable || canPlace === undefined ? onPointerDown : undefined}
    >
      {needed > 0 && (
        <>
          <span
            className="absolute left-[7px] right-[7px] bottom-[5px] h-[2.5px] rounded-full bg-border-light overflow-hidden"
            aria-hidden
          >
            <span
              className={`block h-full rounded-full ${ok ? 'bg-success' : 'bg-warning'}`}
              style={{ width: `${ratio * 100}%` }}
            />
          </span>
          <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[9px] font-mono px-1 rounded border bg-white text-text-mid border-border opacity-0 group-hover/cell:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
            {filled.toFixed(2)}/{needed.toFixed(2)}
          </span>
        </>
      )}
      {canPlace && heldFree != null && (
        <span
          className={`absolute top-0.5 right-1 text-[8px] font-mono font-bold ${
            heldFree > 0.001 ? 'text-primary' : 'text-danger'
          }`}
          title="Held person's free capacity this month"
        >
          {heldFree > 0.001 ? `+${heldFree.toFixed(1)}` : 'full'}
        </span>
      )}
    </div>
  );
}
