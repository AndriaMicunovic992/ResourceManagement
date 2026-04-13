import { SKILL_LEVELS } from '../../../lib/skillLevels';

export default function SkillsMatrixCell({ level }) {
  if (!level) {
    return (
      <div className="w-[60px] h-[36px] flex items-center justify-center border-r border-b border-border-light bg-white">
        <span className="text-[10px] text-text-light">—</span>
      </div>
    );
  }
  const lvl = SKILL_LEVELS[level];
  return (
    <div className="w-[60px] h-[36px] flex items-center justify-center border-r border-b border-border-light bg-white">
      <span
        className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white"
        style={{ backgroundColor: lvl?.color }}
        title={lvl?.label}
      >
        {lvl?.short}
      </span>
    </div>
  );
}
