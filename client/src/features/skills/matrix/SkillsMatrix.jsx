import SkillsMatrixHeader from './SkillsMatrixHeader';
import SkillsMatrixRow from './SkillsMatrixRow';

export default function SkillsMatrix({ resources, skills }) {
  if (skills.length === 0) {
    return (
      <div className="text-center text-text-light text-sm py-10 bg-white rounded-xl border border-border">
        No skills defined yet. Add them from Settings.
      </div>
    );
  }
  if (resources.length === 0) {
    return (
      <div className="text-center text-text-light text-sm py-10 bg-white rounded-xl border border-border">
        No people match the current filters.
      </div>
    );
  }
  return (
    <div className="bg-white rounded-xl border border-border overflow-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
      <div className="inline-block min-w-full">
        <SkillsMatrixHeader skills={skills} />
        {resources.map((r) => (
          <SkillsMatrixRow key={r.id} resource={r} skills={skills} />
        ))}
      </div>
    </div>
  );
}
