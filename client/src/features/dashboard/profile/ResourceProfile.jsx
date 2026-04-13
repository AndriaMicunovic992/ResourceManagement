import Modal from '../../../components/ui/Modal';
import ProfileHeader from './ProfileHeader';
import ProfileUtilization from './ProfileUtilization';
import ProfileAssignments from './ProfileAssignments';
import ProfileSkills from './ProfileSkills';

export default function ResourceProfile({ resource, onClose }) {
  return (
    <Modal title="" onClose={onClose} wide>
      <ProfileHeader resource={resource} />
      <ProfileUtilization resource={resource} />
      <ProfileAssignments resource={resource} />
      <ProfileSkills resource={resource} />
    </Modal>
  );
}
