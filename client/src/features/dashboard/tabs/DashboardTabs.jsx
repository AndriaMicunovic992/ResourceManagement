export default function DashboardTabs({ activeTab, onChange }) {
  const tabs = [
    { id: 'clients', icon: '🏢', label: 'Client Overview' },
    { id: 'resources', icon: '👤', label: 'Resource Capacity' },
  ];

  return (
    <div className="flex gap-1 mb-6">
      {tabs.map((tab) => (
        <button key={tab.id} onClick={() => onChange(tab.id)}
          className={`px-5 py-2.5 text-sm font-semibold cursor-pointer border-0 rounded-t-lg transition ${
            activeTab === tab.id
              ? 'text-primary border-b-2 border-primary bg-white'
              : 'text-text-mid bg-transparent hover:bg-primary-bg'
          }`}
        >
          {tab.icon} {tab.label}
        </button>
      ))}
    </div>
  );
}
