import { useState, useMemo } from 'react';
import StatsCards from './stats/StatsCards';
import DashboardTabs from './tabs/DashboardTabs';
import ClientHeatmap from './clients/ClientHeatmap';
import ResourceCapacity from './resources/ResourceCapacity';
import FreeCapacity from './capacity/FreeCapacity';
import ResourceProfile from './profile/ResourceProfile';
import TimeRangePicker from '../planner/toolbar/TimeRangePicker';
import { currentMonth, addMonths, monthRange } from '../../lib/dateUtils';
import { useOrg } from '../../contexts/OrgContext';

export default function DashboardView() {
  const [activeTab, setActiveTab] = useState('clients');
  const [profileResource, setProfileResource] = useState(null);
  const { currentOrg } = useOrg();
  const [timeRange, setTimeRange] = useState({ start: currentMonth(), end: addMonths(currentMonth(), 11) });
  const months = useMemo(() => monthRange(timeRange.start, timeRange.end), [timeRange]);
  const [includePotential, setIncludePotential] = useState(false);

  return (
    <div className="max-w-[1100px] mx-auto px-5 py-6">
      <StatsCards months={months} includePotential={includePotential} />
      <div className="flex items-center justify-between mb-4">
        <DashboardTabs activeTab={activeTab} onChange={setActiveTab} />
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIncludePotential((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all active:scale-95 ${
              includePotential
                ? 'bg-[#F0F2F5] text-[#6B7280] border-[#D1D5DB]'
                : 'bg-white text-text-mid border-border hover:border-border-dark'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${includePotential ? 'bg-[#9CA3AF]' : 'bg-border'}`} />
            Include Potential
          </button>
          <TimeRangePicker timeRange={timeRange} onChange={setTimeRange}
            minDate={currentOrg?.minPlanningDate} maxDate={currentOrg?.maxPlanningDate} />
        </div>
      </div>
      {activeTab === 'clients' && <ClientHeatmap months={months} includePotential={includePotential} />}
      {activeTab === 'resources' && <ResourceCapacity months={months} includePotential={includePotential} onResourceClick={setProfileResource} />}
      {activeTab === 'free' && <FreeCapacity months={months} includePotential={includePotential} />}
      {profileResource && (
        <ResourceProfile resource={profileResource} onClose={() => setProfileResource(null)} />
      )}
    </div>
  );
}
