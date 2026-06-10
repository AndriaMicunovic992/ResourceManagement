import { Outlet } from 'react-router-dom';
import Header from './Header';
import ImpersonationBanner from './ImpersonationBanner';

export default function AppLayout() {
  return (
    <div className="h-screen flex flex-col bg-primary-bg">
      <ImpersonationBanner />
      <Header />
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
