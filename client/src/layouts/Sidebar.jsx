import { useEffect, useState } from 'react';
import { NavLink, useLocation, Link } from 'react-router-dom';
import { useVisibility } from '../contexts/VisibilityContext';
import { api } from '../lib/api';

const ICONS = {
  home: <path d="M3 12 12 3l9 9M5 10v10h14V10" />,
  people: (
    <>
      <circle cx="9" cy="7" r="4" />
      <path d="M2 21v-2a7 7 0 0 1 14 0v2M16 3.1a4 4 0 0 1 0 7.8M22 21v-2a7 7 0 0 0-4-6.3" />
    </>
  ),
  customers: (
    <>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22v-4h6v4M9 7h.01M15 7h.01M9 12h.01M15 12h.01" />
    </>
  ),
  planner: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M8 2v4M16 2v4M3 9h18M8 14h3" />
    </>
  ),
  insights: (
    <>
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <path d="m7 14 4-4 4 4 5-6" />
    </>
  ),
  journal: <path d="M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a8 8 0 0 0 .1-6l-2.1.6a6 6 0 0 0-1.6-1.6l.6-2.1a8 8 0 0 0-6 .1l.6 2a6 6 0 0 0-1.7 1.7l-2-.6a8 8 0 0 0-.1 6l2.1-.6a6 6 0 0 0 1.6 1.6l-.6 2.1a8 8 0 0 0 6-.1l-.6-2a6 6 0 0 0 1.7-1.7Z" />
    </>
  ),
};

function NavIcon({ name }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      {ICONS[name]}
    </svg>
  );
}

/**
 * App navigation sidebar. Collapses to an icon rail on the width-hungry
 * planner. The old header promo-slot idea becomes a live "Due" queue fed by
 * the reminder engine.
 */
export default function Sidebar() {
  const { isAdmin, role, loading } = useVisibility();
  const location = useLocation();
  const collapsed = location.pathname.startsWith('/planner');
  const [due, setDue] = useState([]);

  useEffect(() => {
    if (loading || role === 'viewer') return;
    let cancelled = false;
    api.getMyReminders().then((d) => { if (!cancelled) setDue(Array.isArray(d) ? d : []); }).catch(() => {});
    return () => { cancelled = true; };
  }, [loading, role, location.pathname]);

  if (loading) {
    // Hold the slot so content doesn't jump once visibility resolves.
    return <aside className={`shrink-0 bg-white border-r border-border-light ${collapsed ? 'w-[64px]' : 'w-[210px]'}`} />;
  }
  if (role === 'viewer') return null; // viewers live on their profile

  const items = [
    { to: '/home', label: 'Dashboard', icon: 'home' },
    { to: '/people', label: 'People', icon: 'people' },
    { to: '/customers', label: 'Customers', icon: 'customers' },
    ...(isAdmin ? [{ to: '/planner', label: 'Planner', icon: 'planner' }] : []),
    { to: '/dashboard', label: 'Insights', icon: 'insights' },
    { to: '/journal', label: 'My journal', icon: 'journal' },
    { to: '/settings', label: 'Settings', icon: 'settings' },
  ];

  const counts = due.reduce((m, i) => { m[i.type] = (m[i.type] || 0) + 1; return m; }, {});

  return (
    <aside
      className={`shrink-0 bg-white border-r border-border-light flex flex-col transition-all ${
        collapsed ? 'w-[64px] px-2' : 'w-[210px] px-3'
      } py-4`}
    >
      <nav className="flex flex-col gap-0.5">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            title={it.label}
            className={({ isActive }) =>
              `relative flex items-center gap-2.5 rounded-xl text-xs font-semibold no-underline transition-colors ${
                collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2'
              } ${
                isActive
                  ? 'text-primary bg-primary-light before:absolute before:-left-2 before:top-2 before:bottom-2 before:w-[3px] before:rounded before:bg-primary'
                  : 'text-text-mid hover:bg-primary-bg/60'
              }`
            }
          >
            <NavIcon name={it.icon} />
            {!collapsed && it.label}
          </NavLink>
        ))}
      </nav>
      <div className="flex-1" />
      {due.length > 0 && !collapsed && (
        <div className="rounded-2xl border border-border-light bg-gradient-to-b from-[#F4FBFD] to-white p-3 mb-1">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-text mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-danger" />
            Due now
          </div>
          {counts.oneOnOne > 0 && (
            <div className="text-[10.5px] text-text-mid py-0.5"><b className="text-text">{counts.oneOnOne}×</b> 1:1 overdue</div>
          )}
          {counts.pmUpdate > 0 && (
            <div className="text-[10.5px] text-text-mid py-0.5"><b className="text-text">{counts.pmUpdate}×</b> PM update due</div>
          )}
          {counts.clientSignal > 0 && (
            <div className="text-[10.5px] text-text-mid py-0.5"><b className="text-text">{counts.clientSignal}×</b> signal missing</div>
          )}
          <Link
            to="/people"
            className="block text-center mt-2 bg-primary text-white rounded-lg text-[10.5px] font-bold py-1.5 no-underline hover:opacity-90"
          >
            Open queue
          </Link>
        </div>
      )}
      {due.length > 0 && collapsed && (
        <Link to="/people" title={`${due.length} reminders due`} className="mx-auto mb-1 w-8 h-8 rounded-xl bg-danger-bg text-danger text-[10px] font-bold flex items-center justify-center no-underline">
          {due.length}
        </Link>
      )}
    </aside>
  );
}
