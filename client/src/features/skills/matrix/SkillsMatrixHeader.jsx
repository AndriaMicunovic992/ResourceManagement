export default function SkillsMatrixHeader({ skills }) {
  return (
    <div className="flex sticky top-0 z-20 bg-bg-subtle">
      <div
        className="sticky left-0 z-30 bg-bg-subtle border-r border-b border-border flex items-center px-3"
        style={{ width: 220, minWidth: 220 }}
      >
        <span className="text-[10px] uppercase tracking-wider text-text-light font-semibold">Person</span>
      </div>
      {skills.map((skill) => (
        <div
          key={skill.id}
          className="w-[60px] border-r border-b border-border flex items-end justify-center pb-1 bg-bg-subtle"
          style={{ height: 90 }}
          title={skill.category ? `${skill.category} · ${skill.name}` : skill.name}
        >
          <div
            className="text-[10px] font-semibold text-text-mid whitespace-nowrap"
            style={{ transform: 'rotate(-60deg)', transformOrigin: 'center center' }}
          >
            {skill.name}
          </div>
        </div>
      ))}
    </div>
  );
}
