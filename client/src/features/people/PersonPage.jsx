import { useState } from 'react';
import { useParams, Outlet, Navigate } from 'react-router-dom';
import { useData } from '../../contexts/DataContext';
import { useOrg } from '../../contexts/OrgContext';
import PersonPageHeader from './PersonPageHeader';
import PersonPageTabs from './PersonPageTabs';
import ResourceForm from '../../components/forms/ResourceForm';

export default function PersonPage() {
  const { id } = useParams();
  const { resources, loading, updateResource } = useData();
  const { canEdit } = useOrg();
  const [editing, setEditing] = useState(false);

  if (loading) {
    return <div className="max-w-[1100px] mx-auto px-5 py-6 text-center text-text-light text-sm">Loading…</div>;
  }

  const resource = resources.find((r) => r.id === id);
  if (!resource) return <Navigate to="/people" replace />;

  const handleSave = async (data) => {
    await updateResource(resource.id, data);
    setEditing(false);
  };

  return (
    <div className="max-w-[1100px] mx-auto px-5 py-6">
      <PersonPageHeader
        resource={resource}
        canEdit={canEdit}
        onEdit={() => setEditing(true)}
      />
      <PersonPageTabs resourceId={resource.id} />
      <Outlet context={{ resource }} />

      {editing && (
        <ResourceForm
          initial={resource}
          onSave={handleSave}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
