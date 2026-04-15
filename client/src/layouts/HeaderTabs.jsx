import { useNavigate, useLocation } from 'react-router-dom';
import { useVisibility } from '../contexts/VisibilityContext';

export default function HeaderTabs() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, role } = useVisibility();

  // Admin/owner: every tab. Member: no planner. Viewer: no global tabs
  // (they only land on their own person page).
  const allTabs = [
    { path: '/people', label: 'People' },
    { path: '/planner', label: 'Planner' },
    { path: '/dashboard', label: 'Insights' },
  ];
  let tabs;
  if (isAdmin) {
    tabs = allTabs;
  } else if (role === 'viewer') {
    tabs = [];
  } else {
    tabs = allTabs.filter((t) => t.path !== '/planner');
  }

  if (tabs.length === 0) return null;

  return (
    <div className="flex gap-1">
      {tabs.map((tab) => {
        const active = location.pathname === tab.path || location.pathname.startsWith(tab.path + '/');
        return (
          <button key={tab.path} onClick={() => navigate(tab.path)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold cursor-pointer border transition ${
              active
                ? 'bg-white text-primary border-white'
                : 'bg-transparent text-white/80 border-white/20 hover:bg-white/10'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
