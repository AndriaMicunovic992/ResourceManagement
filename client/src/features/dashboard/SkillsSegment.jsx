import { useMemo, useState } from 'react';
import { useData } from '../../contexts/DataContext';
import CompanySkills from '../skills/company/CompanySkills';
import SkillsMatrix from '../skills/matrix/SkillsMatrix';

export default function SkillsSegment() {
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
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex gap-0.5 border-b border-border-light">
          {[{ key: 'company', label: 'Company' }, { key: 'individual', label: 'Individual' }].map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`relative px-3.5 py-2 text-[11.5px] font-bold cursor-pointer border-0 bg-transparent rounded-t-[10px] transition-colors ${
                mode === m.key
                  ? 'text-primary after:absolute after:left-2.5 after:right-2.5 after:-bottom-px after:h-[2.5px] after:rounded after:bg-primary'
                  : 'text-text-mid hover:text-text'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      {mode === 'company' && <CompanySkills resources={sortedResources} skills={sortedSkills} />}
      {mode === 'individual' && <SkillsMatrix resources={sortedResources} skills={sortedSkills} />}
    </div>
  );
}
