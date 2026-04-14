import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { useOrg } from '../../contexts/OrgContext';
import { useData } from '../../contexts/DataContext';

export default function PersonPageTabs({ resourceId }) {
  const { role } = useOrg();
  const { resources, meResource } = useData();
  const isAdmin = role === 'admin' || role === 'owner';

  const { isManager, isSelf } = useMemo(() => {
    const person = resources.find((r) => r.id === resourceId);
    if (!person || !meResource) return { isManager: false, isSelf: false };
    const direct = Array.isArray(person.managerLinks)
      ? person.managerLinks.some(
          (l) => (l.managerId || l.manager?.id) === meResource.id
        )
      : false;
    const viaTeam = Array.isArray(person.teams)
      ? person.teams.some((t) => t.managerId === meResource.id)
      : false;
    return {
      isManager: direct || viaTeam,
      isSelf: meResource.id === person.id,
    };
  }, [resources, resourceId, meResource]);

  const canSeePerformance = isAdmin || isManager || isSelf;

  const tabs = [
    { to: `/people/${resourceId}`, label: 'Overview', end: true },
    { to: `/people/${resourceId}/allocation`, label: 'Allocation', end: false },
    { to: `/people/${resourceId}/skills`, label: 'Skills', end: false },
  ];
  if (isAdmin) {
    tabs.push({ to: `/people/${resourceId}/oneonones`, label: '1:1s', end: false });
    tabs.push({ to: `/people/${resourceId}/activity`, label: 'Activity', end: false });
  }
  if (canSeePerformance) {
    tabs.push({ to: `/people/${resourceId}/performance`, label: 'Performance', end: false });
  }

  return (
    <div className="flex gap-1 border-b border-border mb-4">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            `px-5 py-2.5 text-sm font-semibold cursor-pointer rounded-t-lg transition no-underline ${
              isActive
                ? 'text-primary border-b-2 border-primary bg-white -mb-px'
                : 'text-text-mid bg-transparent hover:bg-primary-bg'
            }`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </div>
  );
}
