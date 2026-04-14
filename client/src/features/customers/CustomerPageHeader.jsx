import { useNavigate } from 'react-router-dom';
import StatusBadge from '../../components/ui/StatusBadge';

export default function CustomerPageHeader({ customer, responsiblePerson }) {
  const navigate = useNavigate();
  const color = '#6366f1';

  return (
    <div
      className="rounded-xl p-5 mb-4"
      style={{ background: `linear-gradient(135deg, ${color}15, ${color}08)` }}
    >
      <div className="flex items-start justify-between mb-3">
        <button
          onClick={() => navigate('/planner')}
          className="text-[11px] font-semibold text-text-mid bg-transparent border-0 cursor-pointer hover:text-primary p-0"
        >
          ← Planner
        </button>
      </div>
      <div className="flex items-center gap-4">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white shrink-0"
          style={{ background: color }}
        >
          {customer.name?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-2xl font-bold text-text flex items-center gap-2">
            <span className="truncate">{customer.name}</span>
            <StatusBadge status={customer.status} />
          </div>
          <div className="flex items-center gap-3 mt-2 text-[11px] text-text-light flex-wrap">
            <span className="font-semibold">
              Projects:{' '}
              <span className="font-mono text-text-mid">
                {Array.isArray(customer.projects) ? customer.projects.length : 0}
              </span>
            </span>
            {responsiblePerson && (
              <>
                <span className="text-border">|</span>
                <span className="font-semibold">
                  Responsible:{' '}
                  <span className="text-text-mid">{responsiblePerson.name}</span>
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
