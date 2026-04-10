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

  return (
    <div className="max-w-[1100px] mx-auto px-5 py-6">
      <StatsCards />
      <div className="flex items-center justify-between mb-4">
        <DashboardTabs activeTab={activeTab} onChange={setActiveTab} />
        <TimeRangePicker timeRange={timeRange} onChange={setTimeRange}
          minDate={currentOrg?.minPlanningDate} maxDate={currentOrg?.maxPlanningDate} />
      </div>
      {activeTab === 'clients' && <ClientHeatmap months={months} />}
      {activeTab === 'resources' && <ResourceCapacity months={months} onResourceClick={setProfileResource} />}
      {activeTab === 'free' && <FreeCapacity months={months} />}
      {profileResource && (
        <ResourceProfile resource={profileResource} onClose={() => setProfileResource(null)} />
      )}
    </div>
  );
}
