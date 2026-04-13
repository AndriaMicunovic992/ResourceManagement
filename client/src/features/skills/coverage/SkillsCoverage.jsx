import { useMemo } from 'react';
import CoverageRow from './CoverageRow';

export default function SkillsCoverage({ resources, skills }) {
  const groups = useMemo(() => {
    const byCat = {};
    for (const s of skills) {
      const cat = s.category || 'Uncategorized';
      if (!byCat[cat]) byCat[cat] = [];
      const holders = [];
      for (const r of resources) {
        const ps = (r.personSkills || []).find((x) => x.skillId === s.id);
        if (ps) holders.push({ resource: r, level: ps.level });
      }
      holders.sort((a, b) => b.level - a.level || a.resource.name.localeCompare(b.resource.name));
      byCat[cat].push({ skill: s, holders });
    }
    for (const cat of Object.keys(byCat)) {
      byCat[cat].sort((a, b) => a.skill.name.localeCompare(b.skill.name));
    }
    return Object.keys(byCat)
      .sort((a, b) => {
        if (a === 'Uncategorized') return 1;
        if (b === 'Uncategorized') return -1;
        return a.localeCompare(b);
      })
      .map((cat) => ({ category: cat, rows: byCat[cat] }));
  }, [resources, skills]);

  if (skills.length === 0) {
    return (
      <div className="text-center text-text-light text-sm py-10 bg-white rounded-xl border border-border">
        No skills defined yet. Add them from Settings.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g.category}>
          <div className="text-[10px] uppercase tracking-wider text-text-light font-semibold mb-2">
            {g.category}
          </div>
          <div className="space-y-2">
            {g.rows.map(({ skill, holders }) => (
              <CoverageRow key={skill.id} skill={skill} holders={holders} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
