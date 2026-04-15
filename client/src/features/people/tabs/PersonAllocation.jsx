import { useOutletContext } from 'react-router-dom';
import ProfileUtilization from '../../dashboard/profile/ProfileUtilization';
import ProfileAssignments from '../../dashboard/profile/ProfileAssignments';
import SelfAllocation from './SelfAllocation';

export default function PersonAllocation() {
  const { resource, viewMode } = useOutletContext();

  // In self mode the user can't read the org-wide customers/projects/needs
  // the default components rely on, so we render a dedicated view that
  // pulls from /me/allocations instead.
  if (viewMode === 'self') {
    return <SelfAllocation resource={resource} />;
  }

  return (
    <div>
      <ProfileUtilization resource={resource} />
      <ProfileAssignments resource={resource} />
    </div>
  );
}
