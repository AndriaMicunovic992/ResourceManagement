import { useState, useMemo, useEffect, useRef } from 'react';
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

// The month window Insights opens with, from the org's saved default (Settings →
// Insights range). "custom" uses the fixed start/end; otherwise a rolling window
// of N months from the current month (default 12 — the previous hardcoded value).
export function insightsDefaultRange(org) {
  if (org?.insightsDefaultKind === 'custom' && org?.insightsDefaultStart && org?.insightsDefaultEnd) {
    return { start: org.insightsDefaultStart, end: org.insightsDefaultEnd };
  }
  const months = Math.min(120, Math.max(1, org?.insightsDefaultMonths ?? 12));
  const start = currentMonth();
  return { start, end: addMonths(start, months - 1) };
}

export default function PlanningSegment() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('clients');
  const { currentOrg } = useOrg();
  const { teams } = useData();
  const [timeRange, setTimeRange] = useState(() => insightsDefaultRange(currentOrg));
  // currentOrg may still be loading at first mount, so the initializer above can
  // miss the saved default; apply it once the org resolves — but never clobber a
  // range the user has already picked.
  const rangeTouched = useRef(false);
  const defaultApplied = useRef(!!currentOrg);
  useEffect(() => {
    if (defaultApplied.current || rangeTouched.current || !currentOrg) return;
    defaultApplied.current = true;
    setTimeRange(insightsDefaultRange(currentOrg));
  }, [currentOrg]);
  const changeTimeRange = (r) => { rangeTouched.current = true; setTimeRange(r); };
  const months = useMemo(() => monthRange(timeRange.start, timeRange.end), [timeRange]);
  const [includePotential, setIncludePotential] = useState(false);
  const [teamId, setTeamId] = useState('');

  return (
    <>
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
          <TimeRangePicker timeRange={timeRange} onChange={changeTimeRange}
            minDate={currentOrg?.minPlanningDate} maxDate={currentOrg?.maxPlanningDate} />
        </div>
      </div>
      {activeTab === 'clients' && <ClientHeatmap months={months} includePotential={includePotential} teamId={teamId} />}
      {activeTab === 'resources' && <ResourceCapacity months={months} includePotential={includePotential} teamId={teamId} onResourceClick={(r) => navigate(`/people/${r.id}`)} />}
      {activeTab === 'free' && <FreeCapacity months={months} includePotential={includePotential} teamId={teamId} />}
    </>
  );
}
