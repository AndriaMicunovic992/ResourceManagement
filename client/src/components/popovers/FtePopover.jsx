import { useState, useEffect, useRef } from 'react';
import { fteToHours, hoursToFte } from '../../lib/constants';

function FteRow({ label, value, hours, maxFte, onFteChange, onHoursChange, onKeyDown, onSave, inputRef, accent }) {
  const bg = accent ? 'bg-primary' : 'bg-text-mid';
  return (
    <div>
      <div className="text-[10px] font-semibold text-text-mid mb-1">
        {label}{maxFte != null && ` (max ${maxFte.toFixed(1)})`}
      </div>
      <div className="flex gap-2 items-center">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <input
              ref={inputRef}
              type="number" step="0.01" min="0" max={maxFte}
              value={value}
              onChange={onFteChange}
              onKeyDown={onKeyDown}
              className="w-20 px-2 py-1 border border-border rounded-lg text-sm font-mono text-text outline-none focus:border-primary"
            />
            <span className="text-[10px] text-text-light">FTE</span>
          </div>
          <div className="flex items-center gap-1">
            <input
              type="number" step="1" min="0"
              value={hours}
              onChange={onHoursChange}
              onKeyDown={onKeyDown}
              className="w-20 px-2 py-1 border border-border rounded-lg text-sm font-mono text-text outline-none focus:border-primary"
            />
            <span className="text-[10px] text-text-light">h/mo</span>
          </div>
        </div>
        <button onClick={onSave}
          className={`px-3 py-1 ${bg} text-white rounded-lg text-xs font-bold cursor-pointer border-0 hover:opacity-90 active:scale-95 transition`}>
          Set
        </button>
      </div>
    </div>
  );
}

function QuickChips({ maxFte, onPick }) {
  const presets = [0.2, 0.5, 0.8, 1.0].filter((v) => v <= maxFte + 0.001);
  return (
    <div className="flex gap-1.5 mb-2.5">
      {presets.map((v) => (
        <button
          key={v}
          onClick={() => onPick(v)}
          className="flex-1 py-1.5 rounded-lg border border-border-light bg-white text-[10px] font-mono font-bold text-text-mid cursor-pointer hover:border-primary hover:text-primary transition-colors"
        >
          {v.toFixed(1)}
        </button>
      ))}
      <button
        onClick={() => onPick(Math.round(maxFte * 100) / 100)}
        className="flex-1 py-1.5 rounded-lg border-0 bg-primary-light text-[10px] font-bold text-primary cursor-pointer hover:bg-primary hover:text-white transition-colors whitespace-nowrap px-2"
        title={`Fill the remaining gap (${maxFte.toFixed(2)})`}
      >
        Fill gap
      </button>
    </div>
  );
}

export default function FtePopover({ x, y, maxFte = 1, currentFte = 0, title, showRemove, showNeedEdit, needFte, onSave, onSaveNeed, onRemove, onClose }) {
  const [value, setValue] = useState(currentFte || 0.5);
  const [hours, setHours] = useState(fteToHours(currentFte || 0.5));
  const [needValue, setNeedValue] = useState(needFte || 0.5);
  const [needHours, setNeedHours] = useState(fteToHours(needFte || 0.5));
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // Commit only a finite value — clearing the input and pressing Enter/Set
  // otherwise fires onSave(NaN), which serialises to fte:null and is rejected
  // by the server, leaving the popover stuck with no feedback.
  const commitFte = () => {
    const n = parseFloat(value);
    if (Number.isFinite(n)) onSave(Math.min(Math.max(n, 0), maxFte));
  };
  const commitNeed = () => {
    const n = parseFloat(needValue);
    if (Number.isFinite(n)) onSaveNeed?.(Math.max(n, 0));
  };

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

  const handleNeedFteChange = (e) => {
    const v = e.target.value;
    setNeedValue(v);
    const n = parseFloat(v);
    if (!isNaN(n)) setNeedHours(fteToHours(n));
  };

  const handleNeedHoursChange = (e) => {
    const v = e.target.value;
    setNeedHours(v);
    const n = parseFloat(v);
    if (!isNaN(n)) setNeedValue(hoursToFte(n));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commitFte(); }
    if (e.key === 'Escape') onClose();
  };

  const handleNeedKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commitNeed(); }
    if (e.key === 'Escape') onClose();
  };

  return (
    <div
      className="fixed bg-white rounded-2xl border border-[#F1F5F9] p-3.5 z-[3000]"
      style={{ left: x, top: y, boxShadow: '0 16px 40px rgba(44,62,80,0.18)' }}
      onClick={(e) => e.stopPropagation()}
    >
      {!showNeedEdit ? (
        <>
          <div className="text-[9px] font-bold uppercase tracking-wider text-text-light mb-2">
            {title || `FTE (max ${maxFte.toFixed(1)})`}
          </div>
          <QuickChips maxFte={maxFte} onPick={(v) => onSave(v)} />
          <div className="flex gap-2 items-center">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <input
                  ref={inputRef}
                  type="number" step="0.01" min="0" max={maxFte}
                  value={value}
                  onChange={handleFteChange}
                  onKeyDown={handleKeyDown}
                  className="w-20 px-2 py-1 border border-border rounded-lg text-sm font-mono text-text outline-none focus:border-primary"
                />
                <span className="text-[10px] text-text-light">FTE</span>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number" step="1" min="0"
                  value={hours}
                  onChange={handleHoursChange}
                  onKeyDown={handleKeyDown}
                  className="w-20 px-2 py-1 border border-border rounded-lg text-sm font-mono text-text outline-none focus:border-primary"
                />
                <span className="text-[10px] text-text-light">h/mo</span>
              </div>
            </div>
            <button onClick={commitFte}
              className="px-3 py-1 bg-primary text-white rounded-lg text-xs font-bold cursor-pointer border-0 hover:opacity-90 active:scale-95 transition">
              Set
            </button>
            {showRemove && (
              <button onClick={() => { if (onRemove) onRemove(); else onSave(0); }}
                className="px-3 py-1 text-danger text-xs font-bold cursor-pointer border-0 bg-danger-bg rounded-lg hover:brightness-95 active:scale-95 transition">
                Remove
              </button>
            )}
            <button onClick={onClose}
              className="px-2 py-1 text-text-mid text-xs cursor-pointer border-0 bg-transparent hover:text-danger">
              ✕
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-end gap-2 -mt-1 -mr-1">
            {showRemove && (
              <button onClick={() => { if (onRemove) onRemove(); else onSave(0); }}
                className="px-2 py-0.5 text-danger text-[10px] font-semibold cursor-pointer border border-danger/30 bg-white rounded-lg hover:bg-danger-bg active:scale-95 transition">
                Remove
              </button>
            )}
            <button onClick={onClose}
              className="px-1.5 py-0.5 text-text-mid text-xs cursor-pointer border-0 bg-transparent hover:text-danger">
              ✕
            </button>
          </div>
          <FteRow
            label="Assignment" value={value} hours={hours} maxFte={maxFte}
            onFteChange={handleFteChange} onHoursChange={handleHoursChange}
            onKeyDown={handleKeyDown} onSave={commitFte}
            inputRef={inputRef} accent
          />
          <QuickChips maxFte={maxFte} onPick={(v) => onSave(v)} />
          <div className="border-t border-border-light pt-2">
            <FteRow
              label="Need" value={needValue} hours={needHours} maxFte={2.0}
              onFteChange={handleNeedFteChange} onHoursChange={handleNeedHoursChange}
              onKeyDown={handleNeedKeyDown} onSave={commitNeed}
            />
          </div>
        </div>
      )}
    </div>
  );
}
