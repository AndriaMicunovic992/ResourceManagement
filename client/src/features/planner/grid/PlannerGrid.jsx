import { useMemo } from 'react';
import GridHeader from './GridHeader';
import LabelColumn from './labels/LabelColumn';
import GridBody from './rows/GridBody';
import HeldCapacityFooter from './HeldCapacityFooter';
import { buildRows, isNeedOk, computeNeedFulfillment } from '../../../lib/gridUtils';
import { resourceMatchesNeed } from '../../../lib/resourceUtils';
import { monthRange, computePeriods, currentMonth } from '../../../lib/dateUtils';
import { useData } from '../../../contexts/DataContext';
import { useOrg } from '../../../contexts/OrgContext';
import { LW, CW } from '../../../lib/constants';

const BAR_H = 24;
const BAR_GAP = 2;

const STATUS_ORDER = { realised: 0, potential: 1 };

function sortCustomers(customers, sort) {
  const sorted = [...customers];
  switch (sort) {
    case 'name-asc': return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case 'name-desc': return sorted.sort((a, b) => b.name.localeCompare(a.name));
    case 'status': return sorted.sort((a, b) => (STATUS_ORDER[a.status] ?? 2) - (STATUS_ORDER[b.status] ?? 2) || a.name.localeCompare(b.name));
    case 'newest': return sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    case 'oldest': return sorted.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    default: return sorted;
  }
}

export default function PlannerGrid({ heldResource, timeRange, aggregation, showUnassignedOnly, customerSort, filterIds, onCellClick, onBarClick, onEditCustomer, onDeleteCustomer, onAddProject, onEditProject, onDeleteProject, onAddNeed, onEditNeed, onDeleteNeed, onSuggestNeed, onPaintNeed, onPaintAssign, onUndoable }) {
  const { customers, projects, needs, assignments } = useData();
  const { canEdit } = useOrg();

  const months = useMemo(() => monthRange(timeRange.start, timeRange.end), [timeRange]);
  const periods = useMemo(() => computePeriods(months, aggregation), [months, aggregation]);
  const sortedCustomers = useMemo(() => sortCustomers(customers, customerSort), [customers, customerSort]);
  const allRows = useMemo(() => buildRows(sortedCustomers, projects, needs), [sortedCustomers, projects, needs]);

  const filteredRows = useMemo(() => {
    if (!filterIds || filterIds.size === 0) return allRows;
    return allRows.filter((row) => {
      if (row.type === 'customer') return filterIds.has('c:' + row.data.id);
      if (row.type === 'project') return filterIds.has('p:' + row.data.id);
      if (row.type === 'need') return filterIds.has('p:' + row.project.id);
      return filterIds.has('p:' + row.data.id);
    });
  }, [allRows, filterIds]);

  const rows = useMemo(() => {
    if (!showUnassignedOnly) return filteredRows;
    const unfilledNeedIds = new Set();
    const unfilledProjectIds = new Set();
    const unfilledCustomerIds = new Set();
    for (const row of filteredRows) {
      if (row.type === 'need' && !isNeedOk(row.data, assignments)) {
        unfilledNeedIds.add(row.data.id);
        unfilledProjectIds.add(row.project.id);
        unfilledCustomerIds.add(row.customer.id);
      }
    }
    return filteredRows.filter((row) => {
      if (row.type === 'customer') return unfilledCustomerIds.has(row.data.id);
      if (row.type === 'project') return unfilledProjectIds.has(row.data.id);
      if (row.type === 'need') return unfilledNeedIds.has(row.data.id);
      return unfilledProjectIds.has(row.data.id);
    });
  }, [filteredRows, showUnassignedOnly, assignments]);

  // Compute need row heights centrally so labels and grid stay in sync
  const needHeights = useMemo(() => {
    const heights = {};
    for (const row of rows) {
      if (row.type !== 'need') continue;
      const need = row.data;
      const barCount = assignments.filter((a) => a.needId === need.id && Object.values(a.monthAllocations || {}).some((v) => v > 0)).length;
      const canHeldPlace = heldResource && resourceMatchesNeed(heldResource, need);
      const needsMore = !isNeedOk(need, assignments);
      const clickPad = canHeldPlace && needsMore ? BAR_H + 8 : 0;
      heights[need.id] = Math.max(42, barCount * (BAR_H + BAR_GAP) + 18 + clickPad);
    }
    return heights;
  }, [rows, assignments, heldResource]);

  // Unfilled FTE per month across all needs → "−X.X" gap chips in the header.
  const monthGaps = useMemo(() => {
    const map = {};
    for (const n of needs) {
      const nf = computeNeedFulfillment(n, assignments);
      for (const m of Object.keys(n.monthAllocations || {})) {
        const g = Math.max(0, (nf[m]?.needed || 0) - (nf[m]?.filled || 0));
        if (g > 0) map[m] = (map[m] || 0) + g;
      }
    }
    return map;
  }, [needs, assignments]);
  const periodGap = (periodMonths) =>
    periodMonths.reduce((s, m) => s + (monthGaps[m] || 0), 0);

  // Full-height "today" column: faint tint + a thin rule at its left edge.
  const todayOverlay = useMemo(() => {
    const cm = currentMonth();
    let left = 0;
    for (const p of periods) {
      const w = p.months.length * CW;
      if (p.months.includes(cm)) return { left, width: w };
      left += w;
    }
    return null;
  }, [periods]);

  const isPeriodFullyStaffed = (periodMonths) => {
    return needs.length > 0 && periodMonths.every((month) =>
      needs.every((n) => {
        const allocs = n.monthAllocations || {};
        if (!allocs[month] || allocs[month] <= 0) return true;
        return isNeedOk(n, assignments);
      })
    );
  };

  return (
    <div className="flex overflow-auto">
      <LabelColumn
        rows={rows} canEdit={canEdit} needHeights={needHeights}
        onEditCustomer={onEditCustomer} onDeleteCustomer={onDeleteCustomer}
        onAddProject={onAddProject} onEditProject={onEditProject} onDeleteProject={onDeleteProject}
        onAddNeed={onAddNeed} onEditNeed={onEditNeed} onDeleteNeed={onDeleteNeed}
        onSuggestNeed={onSuggestNeed}
      />
      <div className="flex-1 min-w-0 relative">
        {todayOverlay && (
          <div
            className="absolute top-0 bottom-0 pointer-events-none"
            style={{
              left: todayOverlay.left,
              width: todayOverlay.width,
              background: 'rgba(76,186,212,0.05)',
              borderLeft: '1.5px solid rgba(76,186,212,0.55)',
            }}
          />
        )}
        <GridHeader
          periods={periods}
          isPeriodFullyStaffed={isPeriodFullyStaffed}
          periodGap={periodGap}
        />
        <GridBody
          rows={rows} months={months} periods={periods}
          heldResource={heldResource} needHeights={needHeights}
          onCellClick={onCellClick} onBarClick={onBarClick}
          onPaintNeed={onPaintNeed} onPaintAssign={onPaintAssign} onUndoable={onUndoable}
        />
        {heldResource && <HeldCapacityFooter resource={heldResource} periods={periods} />}
      </div>
    </div>
  );
}
