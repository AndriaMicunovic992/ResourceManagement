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
  const { customers, updateCustomer, deleteCustomer, updateProject, deleteProject, addNeed, updateNeed, deleteNeed, upsertAssignment } = useData();

  const [heldResource, setHeldResource] = useState(null);
  const [popover, setPopover] = useState(null);
  const [timeRange, setTimeRange] = useState({ start: currentMonth(), end: addMonths(currentMonth(), 11) });
  const [aggregation, setAggregation] = useState('M');
  const [editModal, setEditModal] = useState(null);

  const handleCellClick = useCallback((need, month, e) => {
    if (!heldResource) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setPopover({
      x: rect.left, y: rect.bottom + 4,
      needId: need.id, month,
      maxFte: (need.monthAllocations?.[month] || 1),
      type: 'place',
    });
  }, [heldResource]);

  const handleBarClick = useCallback((assignment, segment, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPopover({
      x: rect.left, y: rect.bottom + 4,
      assignmentId: assignment.id,
      needId: assignment.needId,
      resourceId: assignment.resourceId,
      month: segment.months[0],
      currentFte: segment.fte,
      maxFte: 2.0,
      type: 'edit',
    });
  }, []);

  const handleFteSave = async (fte) => {
    if (!popover) return;
    if (popover.type === 'place' && heldResource) {
      await upsertAssignment({ needId: popover.needId, resourceId: heldResource.id, month: popover.month, fte });
    } else if (popover.type === 'edit') {
      await upsertAssignment({ needId: popover.needId, resourceId: popover.resourceId, month: popover.month, fte });
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
