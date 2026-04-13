import { useOutletContext } from 'react-router-dom';
import ProfileUtilization from '../../dashboard/profile/ProfileUtilization';
import ProfileAssignments from '../../dashboard/profile/ProfileAssignments';

export default function PersonAllocation() {
  const { resource } = useOutletContext();
  return (
    <div>
      <ProfileUtilization resource={resource} />
      <ProfileAssignments resource={resource} />
    </div>
  );
}
