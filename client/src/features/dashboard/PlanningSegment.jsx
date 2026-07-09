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
import { useWindowActuals } from './useWindowActuals';

// The month window Insights opens with, from the org's saved default (Settings →
// Insights range). Same option set as the Performance-trend default, but as a
// planning window of "YYYY-MM" months:
//  - calendar_quarter / _half / _year: the current calendar period
//  - custom: the fixed start/end months
//  - rolling_months (default): N months, reaching 3 months back so the
//    planned-vs-actual comparison is visible without touching the range picker
//    (windows under 6 months stay forward-looking — too short to give slots
//    away to the past). Default 12.
export function insightsDefaultRange(org) {
  const kind = org?.insightsDefaultKind || 'rolling_months';
  const cur = currentMonth(); // "YYYY-MM"
  const [y, m] = cur.split('-').map(Number); // m: 1-12
  const monthStr = (yr, mo) => `${yr}-${String(mo).padStart(2, '0')}`;
  if (kind === 'calendar_quarter') {
    const start = monthStr(y, Math.floor((m - 1) / 3) * 3 + 1);
    return { start, end: addMonths(start, 2) };
  }
  if (kind === 'calendar_half') {
    const start = monthStr(y, m <= 6 ? 1 : 7);
    return { start, end: addMonths(start, 5) };
  }
  if (kind === 'calendar_year') {
    return { start: monthStr(y, 1), end: monthStr(y, 12) };
  }
  if (kind === 'custom' && org?.insightsDefaultStart && org?.insightsDefaultEnd) {
    return { start: org.insightsDefaultStart, end: org.insightsDefaultEnd };
  }
  const months = Math.min(120, Math.max(1, org?.insightsDefaultMonths ?? 12));
  let start = months >= 6 ? addMonths(cur, -3) : cur;
  // Respect the org's planning floor if one is set.
  if (org?.minPlanningDate && start < org.minPlanningDate) start = org.minPlanningDate;
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
  // Which logged hours the People-capacity actual layer shows: worked time
  // (client + internal, the default), a single work type, or absences.
  const [workTypeFilter, setWorkTypeFilter] = useState('work');
  // Synced Tempo hours for the elapsed part of the window — the tables and
  // KPI row show them next to the plan so both are comparable at a glance.
  // The per-customer/project slices follow the team lens.
  const actuals = useWindowActuals(months, teamId);

  return (
    <>
      <StatsCards months={months} includePotential={includePotential} teamId={teamId} actuals={actuals} />
      <div className="flex items-center justify-between mb-4">
        <DashboardTabs activeTab={activeTab} onChange={setActiveTab} />
        <div className="flex items-center gap-3">
          {activeTab === 'resources' && actuals.hasActuals && (
            <select
              value={workTypeFilter}
              onChange={(e) => setWorkTypeFilter(e.target.value)}
              title="Which logged hours the actual bar shows"
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-border bg-white text-text-mid outline-none focus:border-primary cursor-pointer"
            >
              <option value="work">Hours: all work</option>
              <option value="client">Hours: client only</option>
              <option value="internal">Hours: internal only</option>
              <option value="absence">Hours: absences</option>
            </select>
          )}
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
      {activeTab === 'clients' && <ClientHeatmap months={months} includePotential={includePotential} teamId={teamId} actuals={actuals} />}
      {activeTab === 'resources' && <ResourceCapacity months={months} includePotential={includePotential} teamId={teamId} actuals={actuals} workTypeFilter={workTypeFilter} onResourceClick={(r) => navigate(`/people/${r.id}`)} />}
      {activeTab === 'free' && <FreeCapacity months={months} includePotential={includePotential} teamId={teamId} />}
    </>
  );
}
