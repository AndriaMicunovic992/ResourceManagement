import { useMemo, useState } from 'react';
import { useData } from '../../contexts/DataContext';
import SkillsSubTabs from './SkillsSubTabs';
import SkillsFilters from './SkillsFilters';
import SkillsMatrix from './matrix/SkillsMatrix';
import SkillsCoverage from './coverage/SkillsCoverage';

export default function SkillsView() {
  const { resources, skills, teams } = useData();
  const [activeTab, setActiveTab] = useState('matrix');
  const [filters, setFilters] = useState({ search: '', teamId: '', category: '' });

  const categories = useMemo(() => {
    const set = new Set();
    for (const s of skills) if (s.category) set.add(s.category);
    return Array.from(set).sort();
  }, [skills]);

  const filteredSkills = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return skills
      .filter((s) => !filters.category || s.category === filters.category)
      .filter((s) => !q || s.name.toLowerCase().includes(q) || (s.category || '').toLowerCase().includes(q))
      .sort((a, b) => {
        const ca = a.category || 'Uncategorized';
        const cb = b.category || 'Uncategorized';
        if (ca !== cb) return ca.localeCompare(cb);
        return a.name.localeCompare(b.name);
      });
  }, [skills, filters.category, filters.search]);

  const filteredResources = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return resources
      .filter((r) => !filters.teamId || r.teamId === filters.teamId)
      .filter((r) => {
        if (!q) return true;
        if (r.name.toLowerCase().includes(q)) return true;
        for (const ps of r.personSkills || []) {
          const s = skills.find((x) => x.id === ps.skillId);
          if (s && s.name.toLowerCase().includes(q)) return true;
        }
        return false;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [resources, skills, filters.teamId, filters.search]);

  return (
    <div className="max-w-[1400px] mx-auto px-5 py-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <SkillsSubTabs activeTab={activeTab} onChange={setActiveTab} />
        <SkillsFilters
          filters={filters}
          onChange={setFilters}
          teams={teams}
          categories={categories}
        />
      </div>
      {activeTab === 'matrix' && (
        <SkillsMatrix resources={filteredResources} skills={filteredSkills} />
      )}
      {activeTab === 'coverage' && (
        <SkillsCoverage resources={filteredResources} skills={filteredSkills} />
      )}
    </div>
  );
}
