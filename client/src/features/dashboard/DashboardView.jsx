import { useState } from 'react';
import PlanningSegment from './PlanningSegment';
import PerformanceSegment from './performance/PerformanceSegment';
import SkillsSegment from './SkillsSegment';
import { useOrg } from '../../contexts/OrgContext';

export default function DashboardView() {
  const { role } = useOrg();
  const isAdmin = role === 'admin' || role === 'owner';
  const [segment, setSegment] = useState('planning');

  const segments = [
    { key: 'planning', label: 'Planning' },
    ...(isAdmin ? [{ key: 'performance', label: 'Performance' }] : []),
    { key: 'skills', label: 'Skills' },
  ];

  return (
    <div className="max-w-[1400px] mx-auto px-5 py-6">
      <div className="flex items-center gap-1 mb-5 p-1 bg-bg-subtle rounded-lg border border-border w-fit">
        {segments.map((s) => (
          <button
            key={s.key}
            onClick={() => setSegment(s.key)}
            className={`px-4 py-1.5 rounded-md text-xs font-bold cursor-pointer border transition ${
              segment === s.key
                ? 'bg-white text-primary border-border shadow-sm'
                : 'bg-transparent text-text-mid border-transparent hover:text-text'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {segment === 'planning' && <PlanningSegment />}
      {isAdmin && segment === 'performance' && <PerformanceSegment />}
      {segment === 'skills' && <SkillsSegment />}
    </div>
  );
}
