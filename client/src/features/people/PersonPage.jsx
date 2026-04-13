import { useParams, Outlet, Navigate } from 'react-router-dom';
import { useData } from '../../contexts/DataContext';
import PersonPageHeader from './PersonPageHeader';
import PersonPageTabs from './PersonPageTabs';

export default function PersonPage() {
  const { id } = useParams();
  const { resources, loading } = useData();

  if (loading) {
    return <div className="max-w-[1100px] mx-auto px-5 py-6 text-center text-text-light text-sm">Loading…</div>;
  }

  const resource = resources.find((r) => r.id === id);
  if (!resource) return <Navigate to="/people" replace />;

  return (
    <div className="max-w-[1100px] mx-auto px-5 py-6">
      <PersonPageHeader resource={resource} />
      <PersonPageTabs resourceId={resource.id} />
      <Outlet context={{ resource }} />
    </div>
  );
}
