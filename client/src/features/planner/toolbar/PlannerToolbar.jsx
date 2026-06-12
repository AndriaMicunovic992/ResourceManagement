import { useState } from 'react';
import Button from '../../../components/ui/Button';
import TimeRangePicker from './TimeRangePicker';
import AggregationToggle from './AggregationToggle';
import CustomerForm from '../../../components/forms/CustomerForm';
import { useData } from '../../../contexts/DataContext';
import { useOrg } from '../../../contexts/OrgContext';
import EntityFilter from './EntityFilter';
import ResourceFilter from './ResourceFilter';

const SORT_OPTIONS = [
  { value: 'name-asc', label: 'Name A–Z' },
  { value: 'name-desc', label: 'Name Z–A' },
  { value: 'status', label: 'Status' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
];

export default function PlannerToolbar({ timeRange, onTimeRangeChange, aggregation, onAggregationChange, showUnassignedOnly, onToggleUnassigned, customerSort, onCustomerSortChange, filterIds, onFilterChange, resourceFilterIds, onResourceFilterChange, myProjectsOnly, onToggleMyProjects }) {
  const { customers, addCustomer } = useData();
  const { canEdit, currentOrg } = useOrg();
  const [showCustomerForm, setShowCustomerForm] = useState(false);

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border-light bg-white sticky top-0 z-20">
      <div className="flex items-center gap-2 p-1 rounded-xl bg-[#FAFBFD] border border-border-light">
        <AggregationToggle value={aggregation} onChange={onAggregationChange} />
        <TimeRangePicker timeRange={timeRange} onChange={onTimeRangeChange}
          minDate={currentOrg?.minPlanningDate} maxDate={currentOrg?.maxPlanningDate} />
      </div>
      <div className="flex items-center gap-1 p-1 rounded-xl bg-[#FAFBFD] border border-border-light">
        <button
          onClick={onToggleUnassigned}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all active:scale-95 ${
            showUnassignedOnly
              ? 'bg-warning-bg text-warning border-warning-border'
              : 'bg-transparent text-text-mid border-transparent hover:bg-white'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${showUnassignedOnly ? 'bg-warning' : 'bg-border'}`} />
          Unassigned
        </button>
        <button
          onClick={onToggleMyProjects}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all active:scale-95 ${
            myProjectsOnly
              ? 'bg-primary-light text-primary border-primary/30'
              : 'bg-transparent text-text-mid border-transparent hover:bg-white'
          }`}
          title="Only projects where you are the responsible person"
        >
          My projects
        </button>
        <EntityFilter selectedIds={filterIds} onChange={onFilterChange} />
        <ResourceFilter selectedIds={resourceFilterIds} onChange={onResourceFilterChange} />
        <select
          value={customerSort}
          onChange={(e) => onCustomerSortChange(e.target.value)}
          className="px-2 py-1.5 rounded-lg text-[11px] font-semibold border-0 bg-transparent text-text-mid outline-none hover:bg-white cursor-pointer"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div className="flex-1" />
      {canEdit && <Button onClick={() => setShowCustomerForm(true)}>+ Customer</Button>}

      {showCustomerForm && (
        <CustomerForm
          onSave={async (data) => { await addCustomer(data); setShowCustomerForm(false); }}
          onClose={() => setShowCustomerForm(false)}
        />
      )}
    </div>
  );
}
