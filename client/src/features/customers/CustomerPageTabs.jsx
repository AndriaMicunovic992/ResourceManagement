import { NavLink } from 'react-router-dom';
import { useOrg } from '../../contexts/OrgContext';

export default function CustomerPageTabs({ customerId }) {
  const { role } = useOrg();
  const isAdmin = role === 'admin' || role === 'owner';

  const tabs = [
    { to: `/customers/${customerId}`, label: 'Overview', end: true },
    { to: `/customers/${customerId}/projects`, label: 'Projects', end: false },
    { to: `/customers/${customerId}/people`, label: 'People', end: false },
    { to: `/customers/${customerId}/activity`, label: 'Activity', end: false },
  ];
  if (isAdmin) {
    tabs.push({ to: `/customers/${customerId}/performance`, label: 'Performance', end: false });
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
