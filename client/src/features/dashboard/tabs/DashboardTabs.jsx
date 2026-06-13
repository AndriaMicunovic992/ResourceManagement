export default function DashboardTabs({ activeTab, onChange }) {
  const tabs = [
    { id: 'clients', label: 'Client overview' },
    { id: 'resources', label: 'People capacity' },
    { id: 'free', label: 'Free capacity' },
  ];

  return (
    <div className="flex gap-0.5 border-b border-border-light">
      {tabs.map((tab) => (
        <button key={tab.id} onClick={() => onChange(tab.id)}
          className={`relative px-3.5 py-2 text-[11.5px] font-bold cursor-pointer border-0 bg-transparent rounded-t-[10px] transition-colors ${
            activeTab === tab.id
              ? 'text-primary after:absolute after:left-2.5 after:right-2.5 after:-bottom-px after:h-[2.5px] after:rounded after:bg-primary'
              : 'text-text-mid hover:text-text'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
