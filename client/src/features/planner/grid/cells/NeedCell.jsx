import { CW } from '../../../../lib/constants';

export default function NeedCell({ width, needed, filled, inRange, canPlace, onClick }) {
  const cellWidth = width || CW;

  if (!inRange) {
    return <div className="shrink-0" style={{ width: cellWidth }} />;
  }

  const ok = needed > 0 && filled >= needed;
  const isEditable = canPlace === undefined && needed > 0;
  const isClickable = canPlace === true || isEditable;
  const bg = canPlace ? '#E0F4FA40' : 'white';
  const cursor = canPlace ? 'cell' : isEditable ? 'pointer' : 'default';

  return (
    <div
      className="shrink-0 border-r border-border-light relative flex items-end justify-center pb-0.5"
      style={{ width: cellWidth, minHeight: 42, background: bg, cursor, opacity: canPlace === false ? 0.4 : 1 }}
      onClick={isClickable ? (e) => { e.stopPropagation(); onClick(e); } : undefined}
    >
      {needed > 0 && (
        <span className={`text-[9px] font-mono px-1 rounded border ${ok ? 'bg-success-bg text-success border-success-border' : 'bg-white text-text-mid border-border'}`}>
          {filled.toFixed(1)}/{needed.toFixed(1)}
        </span>
      )}
    </div>
  );
}
