import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '../../components/ui/StatusBadge';
import CustomerForm from '../../components/forms/CustomerForm';
import { useData } from '../../contexts/DataContext';
import { useVisibility } from '../../contexts/VisibilityContext';

export default function CustomerPageHeader({ customer, responsiblePerson }) {
  const navigate = useNavigate();
  const { updateCustomer } = useData();
  const { isAdmin } = useVisibility();
  const [editing, setEditing] = useState(false);
  const color = '#6366f1';

  const handleSave = async (data) => {
    await updateCustomer(customer.id, data);
    setEditing(false);
    // The page's detail payload (projects, responsible) is fetched separately —
    // reload so every tab reflects the new metadata.
    window.location.reload();
  };

  return (
    <div
      className="rounded-xl p-5 mb-4"
      style={{ background: `linear-gradient(135deg, ${color}15, ${color}08)` }}
    >
      <div className="flex items-start justify-between mb-3">
        <button
          onClick={() => navigate('/customers')}
          className="text-[11px] font-semibold text-text-mid bg-transparent border-0 cursor-pointer hover:text-primary p-0"
        >
          ← Customers
        </button>
        {isAdmin && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs font-semibold text-primary bg-white/70 border border-primary rounded px-2 py-1 cursor-pointer hover:bg-primary hover:text-white"
          >
            Edit
          </button>
        )}
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

      {editing && (
        <CustomerForm
          initial={customer}
          onSave={handleSave}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
