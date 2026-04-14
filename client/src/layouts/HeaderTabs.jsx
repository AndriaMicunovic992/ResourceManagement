import { useNavigate, useLocation } from 'react-router-dom';
import { useData } from '../contexts/DataContext';

export default function HeaderTabs() {
  const navigate = useNavigate();
  const location = useLocation();
  const { meResource } = useData();

  const tabs = [
    { path: '/planner', label: 'Planner' },
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/people', label: 'People' },
    { path: '/skills', label: 'Skills' },
  ];
  if (meResource) {
    tabs.push({ path: '/journal', label: 'My Journal' });
  }

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
