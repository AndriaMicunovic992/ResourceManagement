export default function SkillCoverageCard({ skill, count, max }) {
  // Risk bands: 0 = red, 1 = orange, ≥2 = teal/ok
  let tone;
  if (count === 0) tone = { text: '#E8636F', bar: '#E8636F', risk: true };
  else if (count === 1) tone = { text: '#F5A623', bar: '#F5A623', risk: true };
  else tone = { text: '#4CBAD4', bar: '#4CBAD4', risk: false };

  const pct = Math.max(0, Math.min(1, max > 0 ? count / max : 0));

  return (
    <div className="bg-white border border-border rounded-xl p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-semibold text-text truncate">{skill.name}</div>
        <div className="text-sm font-bold font-mono" style={{ color: tone.text }}>{count}</div>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-border-light overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct * 100}%`, backgroundColor: tone.bar }}
        />
      </div>
      {tone.risk && (
        <div className="mt-1.5 text-[10px] font-semibold text-danger flex items-center gap-1">
          <span>⚠</span>
          <span>Risk</span>
        </div>
      )}
    </div>
  );
}
