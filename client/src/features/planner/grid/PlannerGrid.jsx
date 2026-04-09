import { useMemo } from 'react';
import GridHeader from './GridHeader';
import LabelColumn from './labels/LabelColumn';
import GridBody from './rows/GridBody';
import { buildRows, isNeedOk } from '../../../lib/gridUtils';
import { monthRange } from '../../../lib/dateUtils';
import { useData } from '../../../contexts/DataContext';
import { useOrg } from '../../../contexts/OrgContext';
import { LW } from '../../../lib/constants';

export default function PlannerGrid({ heldResource, timeRange, aggregation, onCellClick, onBarClick, onEditCustomer, onDeleteCustomer, onEditProject, onDeleteProject, onAddNeed, onEditNeed, onDeleteNeed }) {
  const { customers, projects, needs, assignments } = useData();
  const { canEdit } = useOrg();

  const months = useMemo(() => monthRange(timeRange.start, timeRange.end), [timeRange]);
  const rows = useMemo(() => buildRows(customers, projects, needs), [customers, projects, needs]);

  const isColumnFullyStaffed = (month) => {
    return needs.length > 0 && needs.every((n) => {
      const allocs = n.monthAllocations || {};
      if (!allocs[month] || allocs[month] <= 0) return true;
      return isNeedOk(n, assignments);
    });
  };

  return (
    <div className="flex overflow-auto">
      <LabelColumn
        rows={rows} canEdit={canEdit}
        onEditCustomer={onEditCustomer} onDeleteCustomer={onDeleteCustomer}
        onEditProject={onEditProject} onDeleteProject={onDeleteProject}
        onAddNeed={onAddNeed} onEditNeed={onEditNeed} onDeleteNeed={onDeleteNeed}
      />
      <div className="flex-1 min-w-0">
        <GridHeader months={months} isColumnFullyStaffed={isColumnFullyStaffed} />
        <GridBody
          rows={rows} months={months}
          heldResource={heldResource}
          onCellClick={onCellClick} onBarClick={onBarClick}
        />
      </div>
    </div>
  );
}
