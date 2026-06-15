import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import ImpersonationBanner from './ImpersonationBanner';

// No top ribbon: the sidebar is the app's only chrome (brand, nav, profile).
export default function AppLayout() {
  return (
    <div className="h-screen flex flex-col bg-[#EEF1F5]">
      <ImpersonationBanner />
      <div className="flex-1 min-h-0 flex">
        <Sidebar />
        <div className="flex-1 min-w-0 overflow-auto scroll-smooth">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
