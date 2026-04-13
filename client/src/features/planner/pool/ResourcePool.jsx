import { useState } from 'react';
import ResourcePoolHeader from './ResourcePoolHeader';
import HeldResourceBanner from './HeldResourceBanner';
import ResourceFilters from './ResourceFilters';
import ResourceList from './ResourceList';
import ResourceForm from '../../../components/forms/ResourceForm';
import { useData } from '../../../contexts/DataContext';
import { useOrg } from '../../../contexts/OrgContext';

export default function ResourcePool({ heldResource, onHold, timeRange }) {
  const { resources, teams, addResource, updateResource, deleteResource } = useData();
  const { canEdit } = useOrg();
  const [filters, setFilters] = useState({ domain: 'All', role: 'All', seniority: 'All', team: 'All' });
  const [modal, setModal] = useState(null);

  const handleSave = async (data) => {
    if (modal?.id) {
      await updateResource(modal.id, data);
    } else {
      await addResource(data);
    }
    setModal(null);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this resource?')) return;
    await deleteResource(id);
    if (heldResource?.id === id) onHold(null);
  };

  return (
    <div className="w-[260px] bg-white border-r border-border flex flex-col shrink-0">
      <ResourcePoolHeader onAdd={() => setModal({})} canEdit={canEdit} />
      {heldResource && (
        <HeldResourceBanner resource={heldResource} onDeselect={() => onHold(null)} />
      )}
      <ResourceFilters filters={filters} onChange={setFilters} teams={teams} />
      <ResourceList
        resources={resources} filters={filters}
        heldResource={heldResource} onHold={onHold}
        onEdit={(r) => setModal(r)} onDelete={handleDelete}
        timeRange={timeRange} canEdit={canEdit}
      />
      {modal && (
        <ResourceForm
          initial={modal.id ? modal : null}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
