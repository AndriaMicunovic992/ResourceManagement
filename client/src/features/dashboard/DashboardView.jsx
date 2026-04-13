import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import StatsCards from './stats/StatsCards';
import DashboardTabs from './tabs/DashboardTabs';
import ClientHeatmap from './clients/ClientHeatmap';
import ResourceCapacity from './resources/ResourceCapacity';
import FreeCapacity from './capacity/FreeCapacity';
import TimeRangePicker from '../planner/toolbar/TimeRangePicker';
import { currentMonth, addMonths, monthRange } from '../../lib/dateUtils';
import { useOrg } from '../../contexts/OrgContext';
import { useData } from '../../contexts/DataContext';

export default function DashboardView() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('clients');
  const { currentOrg } = useOrg();
  const { teams } = useData();
  const [timeRange, setTimeRange] = useState({ start: currentMonth(), end: addMonths(currentMonth(), 11) });
  const months = useMemo(() => monthRange(timeRange.start, timeRange.end), [timeRange]);
  const [includePotential, setIncludePotential] = useState(false);
  const [teamId, setTeamId] = useState('');

  return (
    <div className="max-w-[1100px] mx-auto px-5 py-6">
      <StatsCards months={months} includePotential={includePotential} teamId={teamId} />
      <div className="flex items-center justify-between mb-4">
        <DashboardTabs activeTab={activeTab} onChange={setActiveTab} />
        <div className="flex items-center gap-3">
          {teams.length > 0 && (
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-border bg-white text-text-mid outline-none focus:border-primary cursor-pointer"
            >
              <option value="">All teams</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
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
      {activeTab === 'clients' && <ClientHeatmap months={months} includePotential={includePotential} teamId={teamId} />}
      {activeTab === 'resources' && <ResourceCapacity months={months} includePotential={includePotential} teamId={teamId} onResourceClick={(r) => navigate(`/people/${r.id}`)} />}
      {activeTab === 'free' && <FreeCapacity months={months} includePotential={includePotential} teamId={teamId} />}
    </div>
  );
}
