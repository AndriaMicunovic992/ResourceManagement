import { getImpersonation } from '../lib/auth';
import { stopViewingAs } from '../lib/impersonation';

export default function ImpersonationBanner() {
  const imp = getImpersonation();
  if (!imp) return null;

  const name = imp.target?.name || 'another user';
  const role = imp.target?.role;

  return (
    <div className="bg-warning text-white text-xs font-medium px-4 py-2 flex items-center justify-center gap-3">
      <span>
        Viewing as <strong>{name}</strong>
        {role ? ` (${role})` : ''} — read only
      </span>
      <button onClick={stopViewingAs} className="underline font-semibold hover:opacity-90">
        Stop
      </button>
    </div>
  );
}
