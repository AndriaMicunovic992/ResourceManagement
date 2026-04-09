export default function ResizeHandle({ side, onMouseDown }) {
  return (
    <div
      className="absolute top-0 bottom-0 cursor-ew-resize z-10"
      style={{
        width: 8,
        [side]: -2,
      }}
      onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e); }}
    >
      <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-current opacity-20 rounded"
        style={{ [side === 'left' ? 'left' : 'right']: 3 }} />
    </div>
  );
}
