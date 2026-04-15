import { NavLink } from 'react-router-dom';

/**
 * Tabs for the person detail page. viewMode controls which tabs render:
 *   - 'admin'   → everything
 *   - 'manager' → everything (same as admin; backend enforces fine-grained access)
 *   - 'self'    → Overview + Allocation + Skills + (restricted) 1:1s + Performance
 *                 (no Activity)
 *   - 'denied'  → nothing (PersonPage should not render at all)
 */
export default function PersonPageTabs({ resourceId, viewMode }) {
  if (viewMode === 'denied') return null;

  const tabs = [
    { to: `/people/${resourceId}`, label: 'Overview', end: true },
    { to: `/people/${resourceId}/allocation`, label: 'Allocation', end: false },
    { to: `/people/${resourceId}/skills`, label: 'Skills', end: false },
    { to: `/people/${resourceId}/oneonones`, label: '1:1s', end: false },
  ];

  if (viewMode !== 'self') {
    tabs.push({ to: `/people/${resourceId}/activity`, label: 'Activity', end: false });
  }

  // Performance is visible to everyone who can see the page, but in self mode
  // the tab content is restricted to the first two charts (Overall + Trend).
  tabs.push({ to: `/people/${resourceId}/performance`, label: 'Performance', end: false });

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
