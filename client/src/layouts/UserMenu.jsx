import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="w-8 h-8 rounded-full bg-white/20 text-white text-xs font-bold cursor-pointer border-0 hover:bg-white/30">
        {user.name?.charAt(0)?.toUpperCase() || '?'}
      </button>
      {open && (
        <div className="absolute right-0 top-10 bg-white rounded-lg shadow-lg border border-border py-1 min-w-[140px] z-50">
          <div className="px-3 py-2 text-xs text-text-mid border-b border-border-light">{user.email}</div>
          <button onClick={() => { navigate('/settings'); setOpen(false); }}
            className="w-full text-left px-3 py-2 text-xs text-text hover:bg-primary-bg cursor-pointer border-0 bg-transparent">
            Settings
          </button>
          <button onClick={() => { logout(); navigate('/login'); }}
            className="w-full text-left px-3 py-2 text-xs text-danger hover:bg-danger-bg cursor-pointer border-0 bg-transparent">
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
