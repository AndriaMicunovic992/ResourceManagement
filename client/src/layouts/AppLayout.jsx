import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import ImpersonationBanner from './ImpersonationBanner';

export default function AppLayout() {
  return (
    <div className="h-screen flex flex-col bg-[#EEF1F5]">
      <ImpersonationBanner />
      <Header />
      <div className="flex-1 min-h-0 flex">
        <Sidebar />
        <div className="flex-1 min-w-0 overflow-auto scroll-smooth">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
