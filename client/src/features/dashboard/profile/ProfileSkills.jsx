import { useMemo, useState } from 'react';
import { useData } from '../../../contexts/DataContext';
import { useOrg } from '../../../contexts/OrgContext';
import { SKILL_LEVELS, SKILL_LEVEL_LIST } from '../../../lib/skillLevels';

export default function ProfileSkills({ resource }) {
  const { resources, skills, upsertPersonSkill, deletePersonSkill } = useData();
  const { canEdit } = useOrg();
  const [addingSkillId, setAddingSkillId] = useState('');
  const [addingLevel, setAddingLevel] = useState(3);
  const [error, setError] = useState('');

  // Live resource from context so edits reflect instantly
  const live = resources.find((r) => r.id === resource.id) || resource;
  const personSkills = live.personSkills || [];

  const skillById = useMemo(() => {
    const map = {};
    for (const s of skills) map[s.id] = s;
    return map;
  }, [skills]);

  const grouped = useMemo(() => {
    const byCat = {};
    for (const ps of personSkills) {
      const s = skillById[ps.skillId];
      if (!s) continue;
      const cat = s.category || 'Uncategorized';
      if (!byCat[cat]) byCat[cat] = [];
      byCat[cat].push({ personSkill: ps, skill: s });
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
      .map((cat) => ({ category: cat, items: byCat[cat] }));
  }, [personSkills, skillById]);

  const availableSkills = useMemo(() => {
    const held = new Set(personSkills.map((ps) => ps.skillId));
    return skills.filter((s) => !held.has(s.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [skills, personSkills]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addingSkillId) return;
    setError('');
    try {
      await upsertPersonSkill({ resourceId: live.id, skillId: addingSkillId, level: addingLevel });
      setAddingSkillId('');
      setAddingLevel(3);
    } catch (err) {
      setError(err.message || 'Failed to add skill');
    }
  };

  const handleLevelChange = async (personSkill, level) => {
    setError('');
    try {
      await upsertPersonSkill({
        resourceId: live.id,
        skillId: personSkill.skillId,
        level,
        note: personSkill.note ?? null,
      });
    } catch (err) {
      setError(err.message || 'Failed to update level');
    }
  };

  const handleRemove = async (personSkill) => {
    setError('');
    try {
      await deletePersonSkill(live.id, personSkill.id);
    } catch (err) {
      setError(err.message || 'Failed to remove skill');
    }
  };

  return (
    <div className="mt-4">
      <div className="text-[10px] uppercase tracking-wider text-text-light font-semibold mb-2">Skills</div>

      {error && (
        <div className="text-xs text-danger bg-danger-bg p-2 rounded mb-2">{error}</div>
      )}

      {personSkills.length === 0 ? (
        <div className="text-xs text-text-light mb-3">No skills recorded yet.</div>
      ) : (
        <div className="space-y-3 mb-3">
          {grouped.map((group) => (
            <div key={group.category}>
              <div className="text-[10px] uppercase tracking-wider text-text-light font-semibold mb-1">
                {group.category}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {group.items.map(({ personSkill, skill }) => {
                  const lvl = SKILL_LEVELS[personSkill.level];
                  return (
                    <div
                      key={personSkill.id}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border bg-white"
                      title={personSkill.note || `${lvl?.label || ''}`}
                    >
                      <span className="text-xs font-semibold text-text">{skill.name}</span>
                      {canEdit ? (
                        <select
                          value={personSkill.level}
                          onChange={(e) => handleLevelChange(personSkill, parseInt(e.target.value, 10))}
                          className="text-[10px] font-bold border border-border rounded px-1 py-0.5 outline-none bg-white cursor-pointer"
                          style={{ color: lvl?.color }}
                        >
                          {SKILL_LEVEL_LIST.map((n) => (
                            <option key={n} value={n}>{SKILL_LEVELS[n].short} · {SKILL_LEVELS[n].label}</option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white"
                          style={{ backgroundColor: lvl?.color }}
                        >
                          {lvl?.short}
                        </span>
                      )}
                      {canEdit && (
                        <button
                          onClick={() => handleRemove(personSkill)}
                          className="text-[10px] text-text-light bg-transparent border-0 cursor-pointer hover:text-danger px-0.5"
                          title="Remove skill"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {canEdit && availableSkills.length > 0 && (
        <form onSubmit={handleAdd} className="flex gap-2 items-end pt-2 border-t border-border-light">
          <div className="flex-1">
            <label className="block text-[10px] font-semibold text-text-mid mb-1">Add skill</label>
            <select
              value={addingSkillId}
              onChange={(e) => setAddingSkillId(e.target.value)}
              className="w-full px-2 py-1 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white"
            >
              <option value="">Select a skill…</option>
              {availableSkills.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.category ? `${s.category} · ${s.name}` : s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-text-mid mb-1">Level</label>
            <select
              value={addingLevel}
              onChange={(e) => setAddingLevel(parseInt(e.target.value, 10))}
              className="px-2 py-1 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white"
            >
              {SKILL_LEVEL_LIST.map((n) => (
                <option key={n} value={n}>{SKILL_LEVELS[n].label}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={!addingSkillId}
            className="text-xs font-semibold text-primary bg-transparent border border-primary rounded px-3 py-1 cursor-pointer hover:bg-primary hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </form>
      )}

      {canEdit && skills.length === 0 && (
        <div className="text-[10px] text-text-light italic">
          No skills defined yet. Add them from Settings.
        </div>
      )}
    </div>
  );
}
