import { NavLink } from 'react-router-dom';
import { useOrg } from '../../contexts/OrgContext';

const TAB_CLASS = ({ isActive }) =>
  `relative px-3.5 py-2 text-[11.5px] font-bold no-underline rounded-t-[10px] transition-colors ${
    isActive
      ? 'text-primary after:absolute after:left-2.5 after:right-2.5 after:-bottom-px after:h-[2.5px] after:rounded after:bg-primary'
      : 'text-text-mid hover:text-text'
  }`;

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
    <div className="flex gap-0.5 border-b border-border-light mb-4">
      {tabs.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end={tab.end} className={TAB_CLASS}>
          {tab.label}
        </NavLink>
      ))}
    </div>
  );
}
