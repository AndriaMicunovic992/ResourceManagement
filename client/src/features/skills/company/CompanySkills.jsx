import { useMemo } from 'react';
import SkillCoverageCard from './SkillCoverageCard';

export default function CompanySkills({ resources, skills }) {
  const { groups, max } = useMemo(() => {
    const counts = new Map();
    for (const s of skills) counts.set(s.id, 0);
    for (const r of resources) {
      for (const ps of r.personSkills || []) {
        if (counts.has(ps.skillId)) counts.set(ps.skillId, counts.get(ps.skillId) + 1);
      }
    }
    let maxCount = 0;
    for (const v of counts.values()) if (v > maxCount) maxCount = v;
    const scale = Math.max(maxCount, 2);

    const byCat = {};
    for (const s of skills) {
      const cat = (s.category || 'Uncategorized').toUpperCase();
      if (!byCat[cat]) byCat[cat] = [];
      byCat[cat].push({ skill: s, count: counts.get(s.id) || 0 });
    }
    for (const cat of Object.keys(byCat)) {
      byCat[cat].sort((a, b) => a.skill.name.localeCompare(b.skill.name));
    }
    const orderedGroups = Object.keys(byCat)
      .sort((a, b) => {
        if (a === 'UNCATEGORIZED') return 1;
        if (b === 'UNCATEGORIZED') return -1;
        return a.localeCompare(b);
      })
      .map((cat) => ({ category: cat, rows: byCat[cat] }));

    return { groups: orderedGroups, max: scale };
  }, [resources, skills]);

  if (skills.length === 0) {
    return (
      <div className="text-center text-text-light text-sm py-10 bg-white rounded-2xl border border-border-light">
        No skills defined yet. Add them from Settings.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.category}>
          <div className="text-[11px] uppercase tracking-wider text-text-light font-bold mb-2">
            {g.category}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {g.rows.map(({ skill, count }) => (
              <SkillCoverageCard key={skill.id} skill={skill} count={count} max={max} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
