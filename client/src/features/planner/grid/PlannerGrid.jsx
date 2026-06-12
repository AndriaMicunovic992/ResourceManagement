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
import { useVisibility } from '../../../contexts/VisibilityContext';
import { LW, CW } from '../../../lib/constants';

const BAR_H = 28;
const BAR_GAP = 3;

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

export default function PlannerGrid({ heldResource, timeRange, aggregation, showUnassignedOnly, customerSort, filterIds, resourceFilterIds, myProjectsOnly, onCellClick, onBarClick, onEditCustomer, onDeleteCustomer, onAddProject, onEditProject, onDeleteProject, onAddNeed, onEditNeed, onDeleteNeed, onSuggestNeed, onPaintNeed, onPaintAssign, onUndoable }) {
  const { customers, projects, needs, assignments } = useData();
  const { canEdit } = useOrg();
  const { selfResourceId } = useVisibility();

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

  // "My projects": only projects where I'm the responsible person (directly,
  // or via being the customer's responsible).
  const myRows = useMemo(() => {
    if (!myProjectsOnly || !selfResourceId) return filteredRows;
    const isMine = (project, customer) =>
      project?.responsiblePersonId === selfResourceId ||
      customer?.responsiblePersonId === selfResourceId;
    const keptProjectIds = new Set();
    const keptCustomerIds = new Set();
    for (const row of filteredRows) {
      // A customer I'm responsible for is mine wholesale (all its projects).
      if (row.type === 'customer' && row.data.responsiblePersonId === selfResourceId) {
        keptCustomerIds.add(row.data.id);
      }
      if (row.type === 'project' && isMine(row.data, row.customer)) {
        keptProjectIds.add(row.data.id);
        keptCustomerIds.add(row.customer.id);
      }
    }
    return filteredRows.filter((row) => {
      if (row.type === 'customer') return keptCustomerIds.has(row.data.id);
      if (row.type === 'project') return keptProjectIds.has(row.data.id);
      if (row.type === 'need') return keptProjectIds.has(row.project.id);
      return keptProjectIds.has(row.data.id);
    });
  }, [filteredRows, myProjectsOnly, selfResourceId]);

  // Employee filter: only needs the selected people are assigned to.
  const peopleRows = useMemo(() => {
    if (!resourceFilterIds || resourceFilterIds.size === 0) return myRows;
    const keptNeedIds = new Set();
    const keptProjectIds = new Set();
    const keptCustomerIds = new Set();
    for (const row of myRows) {
      if (row.type !== 'need') continue;
      const hit = assignments.some(
        (a) =>
          a.needId === row.data.id &&
          resourceFilterIds.has(a.resourceId) &&
          Object.values(a.monthAllocations || {}).some((v) => v > 0)
      );
      if (hit) {
        keptNeedIds.add(row.data.id);
        keptProjectIds.add(row.project.id);
        keptCustomerIds.add(row.customer.id);
      }
    }
    return myRows.filter((row) => {
      if (row.type === 'customer') return keptCustomerIds.has(row.data.id);
      if (row.type === 'project') return keptProjectIds.has(row.data.id);
      if (row.type === 'need') return keptNeedIds.has(row.data.id);
      return keptProjectIds.has(row.data.id);
    });
  }, [myRows, resourceFilterIds, assignments]);

  const rows = useMemo(() => {
    if (!showUnassignedOnly) return peopleRows;
    const unfilledNeedIds = new Set();
    const unfilledProjectIds = new Set();
    const unfilledCustomerIds = new Set();
    for (const row of peopleRows) {
      if (row.type === 'need' && !isNeedOk(row.data, assignments)) {
        unfilledNeedIds.add(row.data.id);
        unfilledProjectIds.add(row.project.id);
        unfilledCustomerIds.add(row.customer.id);
      }
    }
    return peopleRows.filter((row) => {
      if (row.type === 'customer') return unfilledCustomerIds.has(row.data.id);
      if (row.type === 'project') return unfilledProjectIds.has(row.data.id);
      if (row.type === 'need') return unfilledNeedIds.has(row.data.id);
      return unfilledProjectIds.has(row.data.id);
    });
  }, [peopleRows, showUnassignedOnly, assignments]);

  // Compute need row heights centrally so labels and grid stay in sync
  const needHeights = useMemo(() => {
    const heights = {};
    for (const row of rows) {
      if (row.type !== 'need') continue;
      const need = row.data;
      // Only assignments with FTE inside the visible window count — off-window
      // ones render no bar and must not reserve a slot or suppress gap pills.
      const monthSet = new Set(months);
      const barCount = assignments.filter(
        (a) =>
          a.needId === need.id &&
          Object.entries(a.monthAllocations || {}).some(([m, v]) => v > 0 && monthSet.has(m))
      ).length;
      // The dashed gap bar occupies its own stack slot whenever any visible
      // month is under-filled (the held-mode click padding is obsolete now).
      const nf = computeNeedFulfillment(need, assignments);
      const hasVisibleGap = Object.keys(need.monthAllocations || {}).some(
        (m) => monthSet.has(m) && (nf[m]?.needed || 0) - (nf[m]?.filled || 0) > 0.001
      );
      const slots = barCount + (hasVisibleGap ? 1 : 0);
      heights[need.id] = Math.max(56, slots * (BAR_H + BAR_GAP) + 18);
    }
    return heights;
  }, [rows, assignments, months]);

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

  // Full-height "today" marker: faint column tint plus a precise line at the
  // current day's position within the month, with a floating Today pill.
  const todayOverlay = useMemo(() => {
    const cm = currentMonth();
    let left = 0;
    for (const p of periods) {
      const w = p.months.length * CW;
      if (p.months.includes(cm)) {
        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const monthIdx = p.months.indexOf(cm);
        const lineX = left + monthIdx * CW + ((now.getDate() - 1) / daysInMonth) * CW;
        return { left, width: w, lineX };
      }
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
    <div className="flex-1 min-h-0 overflow-auto flex">
      <LabelColumn
        rows={rows} canEdit={canEdit} needHeights={needHeights}
        onEditCustomer={onEditCustomer} onDeleteCustomer={onDeleteCustomer}
        onAddProject={onAddProject} onEditProject={onEditProject} onDeleteProject={onDeleteProject}
        onAddNeed={onAddNeed} onEditNeed={onEditNeed} onDeleteNeed={onDeleteNeed}
        onSuggestNeed={onSuggestNeed}
      />
      <div
        className="flex-1 min-w-0 relative"
        style={
          todayOverlay
            ? {
                // The today line is painted as a background, not an overlay —
                // backgrounds span the element's full height by definition, so
                // no stacking context or row quirk can ever cut it short.
                backgroundImage: `linear-gradient(to right, transparent ${todayOverlay.lineX}px, rgba(76,186,212,0.65) ${todayOverlay.lineX}px, rgba(76,186,212,0.65) ${todayOverlay.lineX + 1.5}px, transparent ${todayOverlay.lineX + 1.5}px)`,
                backgroundRepeat: 'no-repeat',
              }
            : undefined
        }
      >
        {todayOverlay && (
          <div
            className="absolute pointer-events-none z-[25]"
            style={{ left: todayOverlay.lineX, top: 44 }}
          >
            <span
              className="absolute w-[7px] h-[7px] rounded-full bg-primary"
              style={{ top: 0, left: -2.7 }}
            />
            <span
              className="absolute -translate-x-1/2 whitespace-nowrap rounded-full bg-white text-primary text-[9px] font-bold px-2.5 py-[2px]"
              style={{ top: 10, left: 1, border: '1.5px solid #4CBAD4', boxShadow: '0 2px 8px rgba(76,186,212,0.3)' }}
            >
              Today
            </span>
          </div>
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
