import { useMemo } from 'react';
import GridHeader from './GridHeader';
import LabelColumn from './labels/LabelColumn';
import GridBody from './rows/GridBody';
import { buildRows, isNeedOk } from '../../../lib/gridUtils';
import { resourceMatchesNeed } from '../../../lib/resourceUtils';
import { monthRange, computePeriods } from '../../../lib/dateUtils';
import { useData } from '../../../contexts/DataContext';
import { useOrg } from '../../../contexts/OrgContext';
import { LW } from '../../../lib/constants';

const BAR_H = 24;
const BAR_GAP = 2;

export default function PlannerGrid({ heldResource, timeRange, aggregation, showUnassignedOnly, onCellClick, onBarClick, onEditCustomer, onDeleteCustomer, onEditProject, onDeleteProject, onAddNeed, onEditNeed, onDeleteNeed }) {
  const { customers, projects, needs, assignments } = useData();
  const { canEdit } = useOrg();

  const months = useMemo(() => monthRange(timeRange.start, timeRange.end), [timeRange]);
  const periods = useMemo(() => computePeriods(months, aggregation), [months, aggregation]);
  const allRows = useMemo(() => buildRows(customers, projects, needs), [customers, projects, needs]);

  const rows = useMemo(() => {
    if (!showUnassignedOnly) return allRows;
    const unfilledNeedIds = new Set();
    const unfilledProjectIds = new Set();
    const unfilledCustomerIds = new Set();
    for (const row of allRows) {
      if (row.type === 'need' && !isNeedOk(row.data, assignments)) {
        unfilledNeedIds.add(row.data.id);
        unfilledProjectIds.add(row.project.id);
        unfilledCustomerIds.add(row.customer.id);
      }
    }
    return allRows.filter((row) => {
      if (row.type === 'customer') return unfilledCustomerIds.has(row.data.id);
      if (row.type === 'project') return unfilledProjectIds.has(row.data.id);
      if (row.type === 'need') return unfilledNeedIds.has(row.data.id);
      return unfilledProjectIds.has(row.data.id);
    });
  }, [allRows, showUnassignedOnly, assignments]);

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
        onEditProject={onEditProject} onDeleteProject={onDeleteProject}
        onAddNeed={onAddNeed} onEditNeed={onEditNeed} onDeleteNeed={onDeleteNeed}
      />
      <div className="flex-1 min-w-0">
        <GridHeader periods={periods} isPeriodFullyStaffed={isPeriodFullyStaffed} />
        <GridBody
          rows={rows} months={months} periods={periods}
          heldResource={heldResource} needHeights={needHeights}
          onCellClick={onCellClick} onBarClick={onBarClick}
        />
      </div>
    </div>
  );
}
