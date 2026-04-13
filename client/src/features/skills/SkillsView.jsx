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
        <div className="flex gap-1">
          <button
            onClick={() => setMode('company')}
            className={`px-5 py-2.5 text-sm font-semibold cursor-pointer border-0 rounded-t-lg transition ${
              mode === 'company'
                ? 'text-primary border-b-2 border-primary bg-white'
                : 'text-text-mid bg-transparent hover:bg-primary-bg'
            }`}
          >
            🏢 Company
          </button>
          <button
            onClick={() => setMode('individual')}
            className={`px-5 py-2.5 text-sm font-semibold cursor-pointer border-0 rounded-t-lg transition ${
              mode === 'individual'
                ? 'text-primary border-b-2 border-primary bg-white'
                : 'text-text-mid bg-transparent hover:bg-primary-bg'
            }`}
          >
            👤 Individual
          </button>
        </div>
      </div>
      {mode === 'company' && <CompanySkills resources={sortedResources} skills={sortedSkills} />}
      {mode === 'individual' && <SkillsMatrix resources={sortedResources} skills={sortedSkills} />}
    </div>
  );
}
