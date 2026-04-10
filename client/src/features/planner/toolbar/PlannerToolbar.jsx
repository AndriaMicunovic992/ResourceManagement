import { useState } from 'react';
import Button from '../../../components/ui/Button';
import TimeRangePicker from './TimeRangePicker';
import AggregationToggle from './AggregationToggle';
import CustomerForm from '../../../components/forms/CustomerForm';
import ProjectForm from '../../../components/forms/ProjectForm';
import { useData } from '../../../contexts/DataContext';
import { useOrg } from '../../../contexts/OrgContext';

export default function PlannerToolbar({ timeRange, onTimeRangeChange, aggregation, onAggregationChange, showUnassignedOnly, onToggleUnassigned }) {
  const { customers, addCustomer, addProject } = useData();
  const { canEdit, currentOrg } = useOrg();
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border-light bg-white sticky top-0 z-10">
      {canEdit && (
        <>
          <Button onClick={() => setShowCustomerForm(true)}>+ Customer</Button>
          {customers.length > 0 && (
            <Button onClick={() => setShowProjectForm(true)}>+ Project</Button>
          )}
        </>
      )}
      <div className="flex-1" />
      <button
        onClick={onToggleUnassigned}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all active:scale-95 ${
          showUnassignedOnly
            ? 'bg-warning-bg text-warning border-warning-border'
            : 'bg-white text-text-mid border-border hover:border-border-dark'
        }`}
      >
        <span className={`w-2 h-2 rounded-full ${showUnassignedOnly ? 'bg-warning' : 'bg-border'}`} />
        Unassigned
      </button>
      <TimeRangePicker timeRange={timeRange} onChange={onTimeRangeChange}
        minDate={currentOrg?.minPlanningDate} maxDate={currentOrg?.maxPlanningDate} />
      <AggregationToggle value={aggregation} onChange={onAggregationChange} />

      {showCustomerForm && (
        <CustomerForm
          onSave={async (data) => { await addCustomer(data); setShowCustomerForm(false); }}
          onClose={() => setShowCustomerForm(false)}
        />
      )}
      {showProjectForm && (
        <ProjectForm
          onSave={async (data) => { await addProject(data); setShowProjectForm(false); }}
          onClose={() => setShowProjectForm(false)}
        />
      )}
    </div>
  );
}
