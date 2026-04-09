import HeaderLogo from './HeaderLogo';
import HeaderTabs from './HeaderTabs';
import OrgSwitcher from './OrgSwitcher';
import UserMenu from './UserMenu';

export default function Header() {
  return (
    <header className="h-[52px] bg-primary flex items-center justify-between px-5 shrink-0">
      <HeaderLogo />
      <div className="flex items-center gap-3">
        <OrgSwitcher />
        <HeaderTabs />
        <UserMenu />
      </div>
    </header>
  );
}
