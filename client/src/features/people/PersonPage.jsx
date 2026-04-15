import { useState } from 'react';
import { useParams, Outlet, Navigate } from 'react-router-dom';
import { useData } from '../../contexts/DataContext';
import { useOrg } from '../../contexts/OrgContext';
import { useVisibility } from '../../contexts/VisibilityContext';
import PersonPageHeader from './PersonPageHeader';
import PersonPageTabs from './PersonPageTabs';
import ResourceForm from '../../components/forms/ResourceForm';

export default function PersonPage() {
  const { id } = useParams();
  const { resources, loading, updateResource } = useData();
  const { canEdit } = useOrg();
  const { viewModeForPerson, loading: visLoading } = useVisibility();
  const [editing, setEditing] = useState(false);

  if (loading || visLoading) {
    return <div className="max-w-[1100px] mx-auto px-5 py-6 text-center text-text-light text-sm">Loading…</div>;
  }

  const viewMode = viewModeForPerson(id);
  if (viewMode === 'denied') return <Navigate to="/" replace />;

  const resource = resources.find((r) => r.id === id);
  if (!resource) return <Navigate to="/people" replace />;

  // In self mode, the person can't edit their own card (admin-only action).
  const effectiveCanEdit = canEdit && viewMode !== 'self';

  const handleSave = async (data) => {
    await updateResource(resource.id, data);
    setEditing(false);
  };

  return (
    <div className="max-w-[1100px] mx-auto px-5 py-6">
      <PersonPageHeader
        resource={resource}
        canEdit={effectiveCanEdit}
        onEdit={() => setEditing(true)}
      />
      <PersonPageTabs resourceId={resource.id} viewMode={viewMode} />
      <Outlet context={{ resource, viewMode }} />

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
