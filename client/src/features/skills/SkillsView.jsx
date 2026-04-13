import { useMemo, useState } from 'react';
import { useData } from '../../contexts/DataContext';
import CompanySkills from './company/CompanySkills';
import SkillsMatrix from './matrix/SkillsMatrix';

export default function SkillsView() {
  const { resources, skills } = useData();
  const [mode, setMode] = useState('company');

  const sortedSkills = useMemo(
    () => [...skills].sort((a, b) => {
      const ca = a.category || 'Uncategorized';
      const cb = b.category || 'Uncategorized';
      if (ca !== cb) return ca.localeCompare(cb);
      return a.name.localeCompare(b.name);
    }),
    [skills]
  );

  const sortedResources = useMemo(
    () => [...resources].sort((a, b) => a.name.localeCompare(b.name)),
    [resources]
  );

  return (
    <div className="max-w-[1400px] mx-auto px-5 py-6">
      <div className="flex items-center justify-between mb-5">
        <div className="text-2xl font-bold text-text">Skills</div>
        <div className="inline-flex bg-white border border-border rounded-full p-1 shadow-card">
          <button
            onClick={() => setMode('company')}
            className={`px-6 py-2 rounded-full text-sm font-bold cursor-pointer border-0 transition ${
              mode === 'company'
                ? 'bg-primary-light text-primary'
                : 'bg-transparent text-text hover:text-primary'
            }`}
          >
            Company
          </button>
          <button
            onClick={() => setMode('individual')}
            className={`px-6 py-2 rounded-full text-sm font-bold cursor-pointer border-0 transition ${
              mode === 'individual'
                ? 'bg-primary-light text-primary'
                : 'bg-transparent text-text hover:text-primary'
            }`}
          >
            Individual
          </button>
        </div>
      </div>
      {mode === 'company' && <CompanySkills resources={sortedResources} skills={sortedSkills} />}
      {mode === 'individual' && <SkillsMatrix resources={sortedResources} skills={sortedSkills} />}
    </div>
  );
}
