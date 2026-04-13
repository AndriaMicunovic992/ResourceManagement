import { SKILL_LEVELS, SKILL_LEVEL_LIST } from '../../lib/skillLevels';

export default function LevelPicker({ value, onChange, disabled = false, className = '' }) {
  const lvl = SKILL_LEVELS[value];
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(parseInt(e.target.value, 10))}
      className={`text-[10px] font-bold border border-border rounded px-1 py-0.5 outline-none bg-white cursor-pointer ${className}`}
      style={{ color: lvl?.color }}
    >
      {SKILL_LEVEL_LIST.map((n) => (
        <option key={n} value={n}>{SKILL_LEVELS[n].short} · {SKILL_LEVELS[n].label}</option>
      ))}
    </select>
  );
}
