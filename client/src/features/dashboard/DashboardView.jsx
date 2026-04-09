import { useState } from 'react';
import StatsCards from './stats/StatsCards';
import DashboardTabs from './tabs/DashboardTabs';
import ClientHeatmap from './clients/ClientHeatmap';
import ResourceCapacity from './resources/ResourceCapacity';
import ResourceProfile from './profile/ResourceProfile';

export default function DashboardView() {
  const [activeTab, setActiveTab] = useState('clients');
  const [profileResource, setProfileResource] = useState(null);

  return (
    <div className="max-w-[1100px] mx-auto px-5 py-6">
      <StatsCards />
      <DashboardTabs activeTab={activeTab} onChange={setActiveTab} />
      {activeTab === 'clients' ? (
        <ClientHeatmap />
      ) : (
        <ResourceCapacity onResourceClick={setProfileResource} />
      )}
      {profileResource && (
        <ResourceProfile resource={profileResource} onClose={() => setProfileResource(null)} />
      )}
    </div>
  );
}
