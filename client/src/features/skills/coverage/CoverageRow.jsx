import { Link } from 'react-router-dom';
import Avatar from '../../../components/ui/Avatar';
import { SKILL_LEVELS } from '../../../lib/skillLevels';
import { resourcePrimaryDomain, domainColor } from '../../../lib/resourceUtils';

export default function CoverageRow({ skill, holders }) {
  const total = holders.length;
  return (
    <div className="bg-white rounded-xl border border-border p-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-sm font-semibold text-text">{skill.name}</div>
          {skill.category && (
            <div className="text-[10px] uppercase tracking-wider text-text-light font-semibold">
              {skill.category}
            </div>
          )}
        </div>
        <div className="text-[10px] font-mono text-text-mid">
          {total} {total === 1 ? 'person' : 'people'}
        </div>
      </div>
      {total === 0 ? (
        <div className="text-[11px] text-text-light italic">Nobody has this skill yet.</div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {holders.map(({ resource, level }) => {
            const lvl = SKILL_LEVELS[level];
            const color = domainColor(resourcePrimaryDomain(resource));
            return (
              <Link
                key={resource.id}
                to={`/people/${resource.id}`}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border bg-white no-underline hover:shadow-card transition"
                title={`${resource.name} · ${lvl?.label || ''}`}
              >
                <Avatar name={resource.name} color={color} size={20} />
                <span className="text-xs font-semibold text-text">{resource.name}</span>
                <span
                  className="text-[10px] font-bold px-1 py-0.5 rounded text-white"
                  style={{ backgroundColor: lvl?.color }}
                >
                  {lvl?.short}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
