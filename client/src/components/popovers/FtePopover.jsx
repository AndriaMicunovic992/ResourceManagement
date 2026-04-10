import { useState, useEffect, useRef } from 'react';
import { fteToHours, hoursToFte } from '../../lib/constants';

export default function FtePopover({ x, y, maxFte = 1, currentFte = 0, title, showRemove, onSave, onRemove, onClose }) {
  const [value, setValue] = useState(currentFte || 0.5);
  const [hours, setHours] = useState(fteToHours(currentFte || 0.5));
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleFteChange = (e) => {
    const v = e.target.value;
    setValue(v);
    const n = parseFloat(v);
    if (!isNaN(n)) setHours(fteToHours(n));
  };

  const handleHoursChange = (e) => {
    const v = e.target.value;
    setHours(v);
    const n = parseFloat(v);
    if (!isNaN(n)) setValue(hoursToFte(n));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); onSave(parseFloat(value)); }
    if (e.key === 'Escape') onClose();
  };

  return (
    <div
      className="fixed bg-white rounded-xl border border-border shadow-lg p-3 z-[3000]"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-[10px] font-semibold text-text-mid mb-2">
        {title || `FTE (max ${maxFte.toFixed(1)})`}
      </div>
      <div className="flex gap-2 items-center">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <input
              ref={inputRef}
              type="number" step="0.01" min="0" max={maxFte}
              value={value}
              onChange={handleFteChange}
              onKeyDown={handleKeyDown}
              className="w-16 px-2 py-1 border border-border rounded-lg text-sm font-mono text-text outline-none focus:border-primary"
            />
            <span className="text-[10px] text-text-light">FTE</span>
          </div>
          <div className="flex items-center gap-1">
            <input
              type="number" step="1" min="0"
              value={hours}
              onChange={handleHoursChange}
              onKeyDown={handleKeyDown}
              className="w-16 px-2 py-1 border border-border rounded-lg text-sm font-mono text-text outline-none focus:border-primary"
            />
            <span className="text-[10px] text-text-light">h/mo</span>
          </div>
        </div>
        <button onClick={() => onSave(parseFloat(value))}
          className="px-3 py-1 bg-primary text-white rounded-lg text-xs font-bold cursor-pointer border-0 hover:opacity-90 active:scale-95 transition">
          Set
        </button>
        {showRemove && (
          <button onClick={() => { if (onRemove) onRemove(); else onSave(0); }}
            className="px-2 py-1 text-danger text-xs font-semibold cursor-pointer border border-danger/30 bg-white rounded-lg hover:bg-danger-bg active:scale-95 transition">
            Remove
          </button>
        )}
        <button onClick={onClose}
          className="px-2 py-1 text-text-mid text-xs cursor-pointer border-0 bg-transparent hover:text-danger">
          ✕
        </button>
      </div>
    </div>
  );
}
