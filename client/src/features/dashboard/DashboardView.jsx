import { useState } from 'react';
import PlanningSegment from './PlanningSegment';
import PerformanceSegment from './performance/PerformanceSegment';
import { useOrg } from '../../contexts/OrgContext';

export default function DashboardView() {
  const { role } = useOrg();
  const isAdmin = role === 'admin' || role === 'owner';
  const [segment, setSegment] = useState('planning');

  return (
    <div className="max-w-[1100px] mx-auto px-5 py-6">
      {isAdmin && (
        <div className="flex items-center gap-1 mb-5 p-1 bg-bg-subtle rounded-lg border border-border w-fit">
          <button
            onClick={() => setSegment('planning')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold cursor-pointer border transition ${
              segment === 'planning'
                ? 'bg-white text-primary border-border shadow-sm'
                : 'bg-transparent text-text-mid border-transparent hover:text-text'
            }`}
          >
            Planning
          </button>
          <button
            onClick={() => setSegment('performance')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold cursor-pointer border transition ${
              segment === 'performance'
                ? 'bg-white text-primary border-border shadow-sm'
                : 'bg-transparent text-text-mid border-transparent hover:text-text'
            }`}
          >
            Performance
          </button>
        </div>
      )}
      {(!isAdmin || segment === 'planning') && <PlanningSegment />}
      {isAdmin && segment === 'performance' && <PerformanceSegment />}
    </div>
  );
}
