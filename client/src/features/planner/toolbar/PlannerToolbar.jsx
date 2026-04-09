import { useState } from 'react';
import Button from '../../../components/ui/Button';
import TimeRangePicker from './TimeRangePicker';
import AggregationToggle from './AggregationToggle';
import CustomerForm from '../../../components/forms/CustomerForm';
import ProjectForm from '../../../components/forms/ProjectForm';
import { useData } from '../../../contexts/DataContext';
import { useOrg } from '../../../contexts/OrgContext';

export default function PlannerToolbar({ timeRange, onTimeRangeChange, aggregation, onAggregationChange }) {
  const { customers, addCustomer, addProject } = useData();
  const { canEdit } = useOrg();
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border-light bg-white sticky top-0 z-10">
      {canEdit && (
        <>
          <Button onClick={() => setShowCustomerForm(true)}>+ Customer</Button>
          {customers.length > 0 && (
            <Button onClick={() => setShowProjectForm(true)}
              className="bg-[#6366f1] hover:bg-[#5558e8]">+ Project</Button>
          )}
        </>
      )}
      <div className="flex-1" />
      <TimeRangePicker timeRange={timeRange} onChange={onTimeRangeChange} />
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
