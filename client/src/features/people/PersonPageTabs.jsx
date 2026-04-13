import { NavLink } from 'react-router-dom';

export default function PersonPageTabs({ resourceId }) {
  const tabs = [
    { to: `/people/${resourceId}`, label: 'Overview', end: true },
    { to: `/people/${resourceId}/allocation`, label: 'Allocation', end: false },
    { to: `/people/${resourceId}/skills`, label: 'Skills', end: false },
  ];

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
