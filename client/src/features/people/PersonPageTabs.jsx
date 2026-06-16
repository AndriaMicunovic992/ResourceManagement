import { NavLink } from 'react-router-dom';
import { useVisibility } from '../../contexts/VisibilityContext';

const TAB_CLASS = ({ isActive }) =>
  `relative px-4 py-2.5 text-sm font-bold no-underline rounded-t-[10px] transition-colors ${
    isActive
      ? 'text-primary after:absolute after:left-2.5 after:right-2.5 after:-bottom-px after:h-[2.5px] after:rounded after:bg-primary'
      : 'text-text-mid hover:text-text'
  }`;

/**
 * Tabs for the person detail page. viewMode controls which tabs render:
 *   - 'admin'   → everything
 *   - 'manager' → everything (same as admin; backend enforces fine-grained access)
 *   - 'self'    → Overview + Performance + Allocation + (restricted) 1:1s + Skills
 *                 (no Activity)
 *   - 'denied'  → nothing (PersonPage should not render at all)
 */
export default function PersonPageTabs({ resourceId, viewMode }) {
  const { canViewArea } = useVisibility();
  if (viewMode === 'denied') return null;

  // Each tab requires its area's view permission, so a role can't reach (say)
  // 1:1s just because it can view People records. 'self' always sees their own.
  const can = (seg) => viewMode === 'self' || canViewArea(seg);

  const tabs = [{ to: `/people/${resourceId}`, label: 'Overview', end: true }];
  if (can('evaluations')) tabs.push({ to: `/people/${resourceId}/performance`, label: 'Performance', end: false });
  if (can('planner')) tabs.push({ to: `/people/${resourceId}/allocation`, label: 'Allocation', end: false });
  if (can('oneOnOne')) tabs.push({ to: `/people/${resourceId}/oneonones`, label: '1:1s', end: false });
  if (viewMode !== 'self' && can('activity')) tabs.push({ to: `/people/${resourceId}/activity`, label: 'Activity', end: false });
  if (can('skills')) tabs.push({ to: `/people/${resourceId}/skills`, label: 'Skills', end: false });

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
