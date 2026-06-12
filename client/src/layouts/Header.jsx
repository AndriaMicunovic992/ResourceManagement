import HeaderLogo from './HeaderLogo';
import OrgSwitcher from './OrgSwitcher';
import UserMenu from './UserMenu';

// Slim top bar: identity + org/user controls. Navigation lives in the sidebar.
export default function Header() {
  return (
    <header className="h-[48px] bg-primary flex items-center justify-between px-5 shrink-0">
      <HeaderLogo />
      <div className="flex items-center gap-3">
        <OrgSwitcher />
        <UserMenu />
      </div>
    </header>
  );
}
