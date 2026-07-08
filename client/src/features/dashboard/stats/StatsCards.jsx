import { useMemo } from 'react';
import StatCard from './StatCard';
import StackedPlanBar from '../StackedPlanBar';
import { useData } from '../../../contexts/DataContext';
import { useComputed } from '../../../hooks/useComputed';
import { currentMonth } from '../../../lib/dateUtils';
import { MONTHLY_HOURS_PER_FTE, WORK_TYPE_COLORS } from '../../../lib/constants';
import { availableHours } from '../../../lib/availability';
import { actualVsPlanColor } from '../../../lib/statusUtils';

export default function StatsCards({ months, includePotential, teamId, actuals }) {
  const { customers, projects, resources, needs } = useData();
  const { rURealised, rU, nF } = useComputed();

  const stats = useMemo(() => {
    const monthSet = new Set(months);
    const teamResources = teamId ? resources.filter((r) => (r.teams || []).some((t) => t.id === teamId)) : resources;
    const customerById = new Map(customers.map((c) => [c.id, c]));

    // Active projects that overlap with the selected time range. With potential
    // excluded the whole chain must be realised — a realised project under a
    // potential customer is still speculative (same rule as Unfilled below).
    const activeProjects = projects.filter((p) => {
      if (!includePotential && p.status !== 'realised') return false;
      if (!includePotential && customerById.get(p.customerId)?.status !== 'realised') return false;
      if (!p.startMonth || !p.endMonth) return false;
      return p.startMonth <= months[months.length - 1] && p.endMonth >= months[0];
    }).length;

    // Team size
    const teamSize = teamResources.length;

    // Utilization averaged across selected months
    let totalUsedFte = 0;
    let totalCapacity = 0;
    const rUsed = includePotential ? rU : rURealised;
    for (const r of teamResources) {
      for (const m of months) {
        totalCapacity += r.capacity;
        totalUsedFte += rUsed[r.id]?.[m] || 0;
      }
    }
    const utilPct = totalCapacity > 0 ? Math.round((totalUsedFte / totalCapacity) * 100) : 0;

    // Actual vs plan over the completed months of the window: logged Tempo
    // hours vs the absence-adjusted *expected* plan (realised planned FTE ×
    // each person's availability that month), counting only matched people
    // (linked to a Jira account) so untracked people don't drag the rate down.
    // The current month is excluded — it's still being logged, so comparing it
    // to a full-month plan would always read "under". 100% = delivered what
    // the plan could deliver given absences.
    const cur = currentMonth();
    let expectedFte = 0;
    let actualHours = 0;
    // Same population/months split by work type — the KPI's stacked bar
    // (client + internal count as worked; absences render but don't).
    const typed = { client: 0, internal: 0, absence: 0 };
    for (const r of teamResources) {
      if (!r.externalWorkId) continue;
      for (const m of months) {
        if (m >= cur) break; // months are ascending; completed months only
        // Absence eats slack first: the expectation is the plan capped at the
        // hours the person actually had left that month.
        const planFte = rURealised[r.id]?.[m] || 0;
        const availFte = availableHours(actuals?.byResourceType?.[r.id]?.[m], r.capacity) / MONTHLY_HOURS_PER_FTE;
        expectedFte += Math.min(planFte, availFte);
        actualHours += actuals?.byResource?.[r.id]?.[m] || 0;
        const t = actuals?.byResourceType?.[r.id]?.[m];
        if (t) {
          typed.client += t.client || 0;
          typed.internal += t.internal || 0;
          typed.absence += t.absence || 0;
        }
      }
    }
    const actualFte = actualHours / MONTHLY_HOURS_PER_FTE;
    const expectedHours = expectedFte * MONTHLY_HOURS_PER_FTE;
    const actualVsPlan =
      actualHours > 0 && expectedFte > 0 ? Math.round((actualFte / expectedFte) * 100) : null;

    // Unfilled needs within the selected time range
    let unfilled = 0;
    for (const n of needs) {
      if (!includePotential && n.status !== 'realised') continue;
      const project = projects.find((p) => p.id === n.projectId);
      if (!project) continue;
      if (!includePotential && project.status !== 'realised') continue;
      const customer = customerById.get(project.customerId);
      if (!customer) continue;
      if (!includePotential && customer.status !== 'realised') continue;

      const allocs = n.monthAllocations || {};
      const hasUnfilledMonth = Object.entries(allocs).some(([m, needed]) => {
        if (!monthSet.has(m)) return false;
        const filled = nF[n.id]?.[m]?.filled || 0;
        // Epsilon guard so floating-point dust (e.g. 0.1+0.2) doesn't flag a
        // fully-staffed need as unfilled — matching the home dashboard.
        return needed > 0 && filled < needed - 0.001;
      });
      if (hasUnfilledMonth) unfilled++;
    }

    return { activeProjects, teamSize, utilPct, unfilled, actualVsPlan, expectedHours, typed };
  }, [projects, resources, needs, customers, rURealised, rU, nF, months, includePotential, teamId, actuals]);

  const hasActualCard = stats.actualVsPlan != null;
  return (
    <div className={`grid grid-cols-2 ${hasActualCard ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-3.5 mb-5`}>
      <StatCard icon="▦" value={stats.activeProjects} label="Projects" color="#3B82F6"
        info="Projects overlapping the selected months. With “Include potential” off, only realised projects under realised customers count." />
      <StatCard icon="◑" value={stats.teamSize} label="People" color="#5BC68A"
        info="People in scope — the whole org, or the selected team." />
      <StatCard icon="◔" value={`${stats.utilPct}%`} label="Planned utilization" color="#F5A623"
        info="Planned utilization averaged over the selected months: Σ allocated FTE ÷ Σ capacity. “Allocated” is realised allocation, or all planned allocation when “Include potential” is on." />
      {hasActualCard && (
        <StatCard icon="⇄"
          value={`${stats.actualVsPlan - 100 >= 0 ? '+' : '−'}${Math.abs(stats.actualVsPlan - 100)}%`}
          label="Actual vs plan"
          color={actualVsPlanColor(stats.actualVsPlan, 100)}
          bar={
            <StackedPlanBar
              plan={stats.expectedHours}
              segments={[
                { value: stats.typed.client, color: WORK_TYPE_COLORS.client },
                { value: stats.typed.internal, color: WORK_TYPE_COLORS.internal },
                { value: stats.typed.absence, color: WORK_TYPE_COLORS.absence },
              ]}
            />
          }
          info="Deviation of logged Tempo hours from the expected plan, over the completed months of the window (the current month is still being logged): +10% = a tenth more hours than planned, −10% = a tenth less. Expected = the realised plan capped at each person's hours left after absences — absence eats free capacity first, so a leave that fits into slack doesn't lower the bar. Matched people only. The bar reads like the heatmap below: soft track with a tick = the expected plan, stacked fill = logged hours by type (green client, violet internal; slate absences render but don't count as worked time)." />
      )}
      <StatCard icon="◌" value={stats.unfilled} label="Unfilled" color="#E8636F"
        info="Needs with at least one selected month where filled < needed. “Include potential” off limits it to realised needs/projects/customers." />
    </div>
  );
}
