import { useNavigate, useLocation } from 'react-router-dom';

export default function HeaderTabs() {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { path: '/planner', label: 'Planner' },
    { path: '/dashboard', label: 'Dashboard' },
  ];

  return (
    <div className="flex gap-1">
      {tabs.map((tab) => {
        const active = location.pathname === tab.path;
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
