import { useState, useCallback } from 'react';
import ResourcePool from './pool/ResourcePool';
import PlannerToolbar from './toolbar/PlannerToolbar';
import PlannerGrid from './grid/PlannerGrid';
import FtePopover from '../../components/popovers/FtePopover';
import CustomerForm from '../../components/forms/CustomerForm';
import ProjectForm from '../../components/forms/ProjectForm';
import NeedForm from '../../components/forms/NeedForm';
import EmptyState from '../../components/ui/EmptyState';
import { useData } from '../../contexts/DataContext';
import { currentMonth, addMonths } from '../../lib/dateUtils';

export default function PlannerView() {
  const { customers, needs, assignments, updateCustomer, deleteCustomer, updateProject, deleteProject, addNeed, updateNeed, deleteNeed, upsertAssignment } = useData();

  const [heldResource, setHeldResource] = useState(null);
  const [popover, setPopover] = useState(null);
  const [timeRange, setTimeRange] = useState({ start: currentMonth(), end: addMonths(currentMonth(), 11) });
  const [aggregation, setAggregation] = useState('M');
  const [editModal, setEditModal] = useState(null);

  const handleCellClick = useCallback((need, month, periodMonths, e) => {
    if (heldResource) {
      // Auto-assign resource to ALL need months with smart default FTE
      const needAllocs = need.monthAllocations || {};
      const needMonths = Object.keys(needAllocs).sort();
      if (needMonths.length === 0) return;

      // Skip if already assigned
      const existing = assignments.find((a) => a.needId === need.id && a.resourceId === heldResource.id);
      if (existing) return;

      const needAssigns = assignments.filter((a) => a.needId === need.id);
      const resourceAssigns = assignments.filter((a) => a.resourceId === heldResource.id);

      // Compute smart default FTE: min across all months of min(gap, resource capacity)
      let minAvail = Infinity;
      for (const m of needMonths) {
        const needed = needAllocs[m] || 0;
        const filled = needAssigns.reduce((s, a) => s + ((a.monthAllocations || {})[m] || 0), 0);
        const gap = needed - filled;
        const resourceUsed = resourceAssigns.reduce((s, a) => s + ((a.monthAllocations || {})[m] || 0), 0);
        const cap = Math.max(0, 1.0 - resourceUsed);
        minAvail = Math.min(minAvail, gap, cap);
      }

      const fte = Math.max(0.01, Math.round(Math.min(minAvail, needAllocs[needMonths[0]] || 1) * 100) / 100);
      if (minAvail <= 0) return;

      upsertAssignment({ needId: need.id, resourceId: heldResource.id, fte });
      return;
    }

    // No held resource: edit this need's per-month FTE
    const rect = e.currentTarget.getBoundingClientRect();
    const needAllocs = need.monthAllocations || {};
    setPopover({
      x: rect.left, y: rect.bottom + 4,
      needId: need.id, month, periodMonths,
      currentFte: needAllocs[month] || 0,
      maxFte: 2.0,
      type: 'editNeed',
    });
  }, [heldResource, assignments, upsertAssignment]);

  const handleBarClick = useCallback((assignment, segment, e) => {
    const need = needs.find((n) => n.id === assignment.needId);
    const needAllocs = need?.monthAllocations || {};
    const month = segment.months[0];
    const needed = needAllocs[month] || 1;

    // maxFte = need requirement minus other assignments' FTE for this month
    const otherFilled = assignments
      .filter((a) => a.needId === assignment.needId && a.id !== assignment.id)
      .reduce((s, a) => s + ((a.monthAllocations || {})[month] || 0), 0);
    const maxFte = Math.max(0.01, needed - otherFilled);

    const rect = e.currentTarget.getBoundingClientRect();
    setPopover({
      x: rect.left, y: rect.bottom + 4,
      assignmentId: assignment.id,
      needId: assignment.needId,
      resourceId: assignment.resourceId,
      month,
      months: segment.months,
      currentFte: segment.fte,
      maxFte,
      type: 'edit',
    });
  }, [needs, assignments]);

  const handleFteSave = async (fte) => {
    if (!popover) return;
    if (popover.type === 'edit') {
      await upsertAssignment({
        needId: popover.needId, resourceId: popover.resourceId,
        months: popover.months, fte,
      });
    } else if (popover.type === 'editNeed') {
      const monthAllocs = {};
      const months = popover.periodMonths || [popover.month];
      for (const m of months) monthAllocs[m] = fte;
      await updateNeed(popover.needId, { monthAllocations: monthAllocs });
    }
    setPopover(null);
  };

  const handleEditCustomer = (customer) => setEditModal({ type: 'customer', data: customer });
  const handleDeleteCustomer = async (id) => { if (confirm('Delete this customer?')) await deleteCustomer(id); };
  const handleEditProject = (project) => setEditModal({ type: 'project', data: project });
  const handleDeleteProject = async (id) => { if (confirm('Delete this project?')) await deleteProject(id); };
  const handleAddNeed = (project) => setEditModal({ type: 'need', project });
  const handleEditNeed = (need, project) => setEditModal({ type: 'need', data: need, project });
  const handleDeleteNeed = async (id) => { if (confirm('Delete this need?')) await deleteNeed(id); };

  return (
    <div className="flex h-[calc(100vh-52px)] bg-[#FAFBFD]">
      <ResourcePool heldResource={heldResource} onHold={setHeldResource} timeRange={timeRange} />
      <div className="flex-1 overflow-auto flex flex-col" onClick={() => setPopover(null)}>
        <PlannerToolbar
          timeRange={timeRange} onTimeRangeChange={setTimeRange}
          aggregation={aggregation} onAggregationChange={setAggregation}
        />
        {customers.length === 0 ? (
          <EmptyState icon="📅" message="Create a customer to start planning" />
        ) : (
          <PlannerGrid
            heldResource={heldResource} timeRange={timeRange} aggregation={aggregation}
            onCellClick={handleCellClick} onBarClick={handleBarClick}
            onEditCustomer={handleEditCustomer} onDeleteCustomer={handleDeleteCustomer}
            onEditProject={handleEditProject} onDeleteProject={handleDeleteProject}
            onAddNeed={handleAddNeed} onEditNeed={handleEditNeed} onDeleteNeed={handleDeleteNeed}
          />
        )}
      </div>

      {popover && (
        <FtePopover
          x={popover.x} y={popover.y}
          maxFte={popover.maxFte} currentFte={popover.currentFte}
          title={popover.type === 'editNeed' ? 'Need FTE (max 2.0)' : undefined}
          onSave={handleFteSave} onClose={() => setPopover(null)}
        />
      )}

      {editModal?.type === 'customer' && (
        <CustomerForm initial={editModal.data}
          onSave={async (data) => { await updateCustomer(editModal.data.id, data); setEditModal(null); }}
          onClose={() => setEditModal(null)} />
      )}
      {editModal?.type === 'project' && (
        <ProjectForm initial={editModal.data}
          onSave={async (data) => { await updateProject(editModal.data.id, data); setEditModal(null); }}
          onClose={() => setEditModal(null)} />
      )}
      {editModal?.type === 'need' && (
        <NeedForm initial={editModal.data} project={editModal.project || editModal.data?.project}
          onSave={async (data) => {
            if (editModal.data?.id) await updateNeed(editModal.data.id, data);
            else await addNeed(data);
            setEditModal(null);
          }}
          onClose={() => setEditModal(null)} />
      )}
    </div>
  );
}
