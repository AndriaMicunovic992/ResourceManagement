import { useState } from 'react';
import PlanningSegment from './PlanningSegment';
import PerformanceSegment from './performance/PerformanceSegment';
import SkillsSegment from './SkillsSegment';
import PageHeader from '../../components/ui/PageHeader';
import { useOrg } from '../../contexts/OrgContext';

const SUBTITLES = {
  planning: 'staffing, capacity and gaps across the window',
  performance: 'evaluation scores across people and dimensions',
  skills: 'company skill coverage and individual levels',
};

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
      <PageHeader title="Insights" subtitle={SUBTITLES[segment]}>
        <span className="flex bg-[#EEF1F5] rounded-[11px] p-[3px]">
          {segments.map((s) => (
            <button
              key={s.key}
              onClick={() => setSegment(s.key)}
              className={`text-[10.5px] font-bold px-3.5 py-1.5 rounded-lg transition-colors ${
                segment === s.key
                  ? 'bg-white text-primary shadow-[0_1px_4px_rgba(34,49,63,0.12)]'
                  : 'text-text-mid hover:text-text'
              }`}
            >
              {s.label}
            </button>
          ))}
        </span>
      </PageHeader>
      {segment === 'planning' && <PlanningSegment />}
      {isAdmin && segment === 'performance' && <PerformanceSegment />}
      {segment === 'skills' && <SkillsSegment />}
    </div>
  );
}
