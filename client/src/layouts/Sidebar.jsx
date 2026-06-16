import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, Link, useNavigate } from 'react-router-dom';
import { useVisibility } from '../contexts/VisibilityContext';
import { useAuth } from '../contexts/AuthContext';
import { useOrg } from '../contexts/OrgContext';
import { api } from '../lib/api';
import { firstName } from '../lib/resourceUtils';

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

// Turn the top reminder into a compact nudge (title + one-line sub + link).
function reminderCopy(item) {
  if (!item) return null;
  if (item.type === 'oneOnOne') return {
    title: `1:1 with ${firstName(item.resourceName)} is due`,
    sub: item.lastAt ? `Last one ${Math.round((Date.now() - new Date(item.lastAt)) / 86400000)} days ago` : 'No 1:1 on record yet',
    to: `/people/${item.resourceId}/oneonones`,
  };
  if (item.type === 'pmUpdate') return {
    title: `PM update due · ${item.customerName}`,
    sub: item.lastAt ? `Last review ${Math.round((Date.now() - new Date(item.lastAt)) / 86400000)} days ago` : 'No review yet',
    to: `/customers/${item.customerId}/review`,
  };
  return {
    title: `Signal missing · ${item.customerName}`,
    sub: 'No signal logged this month',
    to: `/customers/${item.customerId}/review`,
  };
}

/** Brand mark + wordmark, top of the sidebar (was the top ribbon's logo). */
function Brand({ collapsed, to }) {
  return (
    <Link to={to} className="flex items-center gap-2.5 no-underline mb-4 px-1.5">
      <span className="w-9 h-9 rounded-xl bg-primary text-white font-extrabold flex items-center justify-center text-base shrink-0 shadow-[0_4px_12px_rgba(76,186,212,0.4)]">d</span>
      {!collapsed && (
        <span className="leading-tight">
          <span className="block text-[15px] font-extrabold text-text">databob</span>
          <span className="block text-[9.5px] text-text-light font-medium">People Hub</span>
        </span>
      )}
    </Link>
  );
}

/** User identity + menu (org switch / settings / logout), bottom of the sidebar. */
function SidebarProfile({ collapsed }) {
  const { user, logout } = useAuth();
  const { currentOrg, orgs, switchOrg, role } = useOrg();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  if (!user) return null;
  const initials = (user.name || user.email || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const menu = open && (
    <div className={`absolute bottom-full mb-2 bg-white rounded-xl shadow-lg border border-border-light py-1 z-50 ${collapsed ? 'left-0 w-[180px]' : 'left-0 right-0'}`}>
      <div className="px-3 py-1.5 text-[10px] text-text-light truncate border-b border-border-light">{user.email}</div>
      {orgs.length > 1 && (
        <>
          <div className="px-3 pt-1.5 pb-0.5 text-[9px] uppercase tracking-wider text-text-light font-bold">Organization</div>
          {orgs.map((o) => (
            <button
              key={o.id}
              onClick={() => { if (o.id !== currentOrg?.id) switchOrg(o.id); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-xs cursor-pointer border-0 bg-transparent hover:bg-primary-bg ${o.id === currentOrg?.id ? 'text-primary font-bold' : 'text-text'}`}
            >
              {o.name}
            </button>
          ))}
          <div className="border-t border-border-light my-1" />
        </>
      )}
      <button onClick={() => { navigate('/settings'); setOpen(false); }} className="w-full text-left px-3 py-1.5 text-xs text-text hover:bg-primary-bg cursor-pointer border-0 bg-transparent">
        Settings
      </button>
      <button onClick={() => { logout(); navigate('/login'); }} className="w-full text-left px-3 py-1.5 text-xs text-danger hover:bg-danger-bg cursor-pointer border-0 bg-transparent">
        Logout
      </button>
    </div>
  );

  if (collapsed) {
    return (
      <div className="relative mt-1" ref={ref}>
        <button
          onClick={() => setOpen((o) => !o)}
          title={user.name}
          className="mx-auto w-9 h-9 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center cursor-pointer border-0"
        >
          {initials}
        </button>
        {menu}
      </div>
    );
  }

  return (
    <div className="relative border-t border-border-light pt-2.5 mt-1" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-1.5 py-1.5 rounded-lg cursor-pointer border-0 bg-transparent hover:bg-primary-bg"
      >
        <span className="w-8 h-8 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center shrink-0">{initials}</span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block text-xs font-bold text-text truncate">{user.name}</span>
          <span className="block text-[10px] text-text-light truncate">{currentOrg?.name}{role ? ` · ${role}` : ''}</span>
        </span>
        <span className="text-text-light font-bold tracking-wider leading-none">⋮</span>
      </button>
      {menu}
    </div>
  );
}

/**
 * App navigation sidebar — now the app's only chrome (the top ribbon is gone):
 * brand at the top, nav, the live reminder nudge, and the user profile at the
 * bottom. Collapses to an icon rail on the width-hungry planner.
 */
export default function Sidebar() {
  const { isAdmin, role, loading, selfResourceId, canViewArea } = useVisibility();
  const location = useLocation();
  const collapsed = location.pathname.startsWith('/planner');
  const [due, setDue] = useState([]);

  const isViewer = role === 'viewer';

  useEffect(() => {
    if (loading || isViewer) return;
    let cancelled = false;
    api.getMyReminders().then((d) => { if (!cancelled) setDue(Array.isArray(d) ? d : []); }).catch(() => {});
    return () => { cancelled = true; };
  }, [loading, isViewer, location.pathname]);

  if (loading) {
    // Hold the slot so content doesn't jump once visibility resolves.
    return <aside className={`shrink-0 bg-white border-r border-border-light ${collapsed ? 'w-[64px]' : 'w-[210px]'}`} />;
  }

  const items = [
    { to: '/home', label: 'Dashboard', icon: 'home' },
    ...(canViewArea('people') ? [{ to: '/people', label: 'People', icon: 'people' }] : []),
    ...(canViewArea('customers') ? [{ to: '/customers', label: 'Customers', icon: 'customers' }] : []),
    ...(isAdmin ? [{ to: '/planner', label: 'Planner', icon: 'planner' }] : []),
    { to: '/dashboard', label: 'Insights', icon: 'insights' },
    { to: '/journal', label: 'My journal', icon: 'journal' },
    { to: '/settings', label: 'Settings', icon: 'settings' },
  ];

  const callout = reminderCopy(due[0]);
  const brandTo = isViewer ? (selfResourceId ? `/people/${selfResourceId}` : '/people') : '/home';

  return (
    <aside
      className={`shrink-0 bg-white border-r border-border-light flex flex-col transition-all ${
        collapsed ? 'w-[64px] px-2' : 'w-[210px] px-3'
      } py-4`}
    >
      <Brand collapsed={collapsed} to={brandTo} />

      {!isViewer && (
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
      )}

      <div className="flex-1" />

      {!isViewer && callout && !collapsed && (
        <Link
          to={callout.to}
          className="block no-underline rounded-xl p-2.5 text-white shadow-card mb-1.5"
          style={{ background: 'linear-gradient(135deg, #2E7D8F, #4CBAD4)' }}
        >
          <div className="flex items-center gap-1 mb-1 opacity-90">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M10.3 21a1.9 1.9 0 0 0 3.4 0" /></svg>
            <span className="text-[8.5px] font-bold uppercase tracking-wider">Due now</span>
          </div>
          <b className="block text-[11px] leading-snug">{callout.title}</b>
          <p className="text-[9px] opacity-85 mt-0.5 mb-0 leading-snug">{callout.sub}</p>
        </Link>
      )}
      {!isViewer && due.length > 0 && !collapsed && (
        <Link
          to="/people"
          className="block text-center text-[10px] font-bold text-text-mid bg-white border border-border-light rounded-lg py-1.5 no-underline hover:bg-primary-bg mb-2"
        >
          Open queue · {due.length}
        </Link>
      )}
      {!isViewer && due.length > 0 && collapsed && (
        <Link to="/people" title={`${due.length} reminders due`} className="mx-auto mb-2 w-8 h-8 rounded-xl bg-danger-bg text-danger text-[10px] font-bold flex items-center justify-center no-underline">
          {due.length}
        </Link>
      )}

      <SidebarProfile collapsed={collapsed} />
    </aside>
  );
}
