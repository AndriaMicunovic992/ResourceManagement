import { Link } from 'react-router-dom';
import Avatar from '../../../components/ui/Avatar';
import SkillsMatrixCell from './SkillsMatrixCell';
import { resourcePrimaryDomain, domainColor } from '../../../lib/resourceUtils';

export default function SkillsMatrixRow({ resource, skills }) {
  const color = domainColor(resourcePrimaryDomain(resource));
  const levelBySkillId = {};
  for (const ps of resource.personSkills || []) {
    levelBySkillId[ps.skillId] = ps.level;
  }

  return (
    <div className="flex hover:bg-primary-bg/30">
      <Link
        to={`/people/${resource.id}`}
        className="sticky left-0 z-10 bg-white hover:bg-primary-bg/30 border-r border-b border-border-light flex items-center gap-2 px-3 no-underline"
        style={{ width: 220, minWidth: 220, height: 36 }}
      >
        <Avatar name={resource.name} color={color} size={24} />
        <span className="text-xs font-semibold text-text truncate">{resource.name}</span>
      </Link>
      {skills.map((skill) => (
        <SkillsMatrixCell key={skill.id} level={levelBySkillId[skill.id]} />
      ))}
    </div>
  );
}
