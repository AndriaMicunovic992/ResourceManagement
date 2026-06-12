import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '../../components/ui/StatusBadge';
import CustomerForm from '../../components/forms/CustomerForm';
import { useData } from '../../contexts/DataContext';
import { useVisibility } from '../../contexts/VisibilityContext';
import { api } from '../../lib/api';
import { MONTHS } from '../../lib/constants';
import { currentMonth } from '../../lib/dateUtils';

function Stat({ value, label, color }) {
  return (
    <div className="text-center">
      <b className="block text-[17px] font-extrabold tracking-tight" style={color ? { color } : undefined}>{value}</b>
      <span className="text-[9.5px] font-semibold text-text-light">{label}</span>
    </div>
  );
}

/** Entity-detail profile card — the customer flavor of the person header. */
export default function CustomerPageHeader({ customer, responsiblePerson }) {
  const navigate = useNavigate();
  const { updateCustomer, projects, needs, assignments } = useData();
  const { isAdmin, responsibleCustomerIds } = useVisibility();
  const [editing, setEditing] = useState(false);
  const [starting, setStarting] = useState(false);
  const color = '#6366f1';
  const m0 = currentMonth();
  const monthShort = MONTHS[parseInt(m0.slice(5), 10) - 1];

  const stats = useMemo(() => {
    const projIds = new Set(projects.filter((p) => p.customerId === customer.id).map((p) => p.id));
    const needIds = new Set(needs.filter((n) => projIds.has(n.projectId)).map((n) => n.id));
    let planned = 0, needed = 0;
    for (const a of assignments) {
      if (needIds.has(a.needId)) planned += (a.monthAllocations || {})[m0] || 0;
    }
    for (const n of needs) {
      if (!needIds.has(n.id)) continue;
      needed += (n.monthAllocations || {})[m0] || 0;
    }
    return {
      projects: projIds.size,
      planned: Math.round(planned * 10) / 10,
      gap: Math.round(Math.max(0, needed - planned) * 10) / 10,
    };
  }, [projects, needs, assignments, customer.id, m0]);

  const canReview = isAdmin || responsibleCustomerIds.has(customer.id);

  const handleSave = async (data) => {
    await updateCustomer(customer.id, data);
    setEditing(false);
    // The page's detail payload (projects, responsible) is fetched separately —
    // reload so every tab reflects the new metadata.
    window.location.reload();
  };

  // Same flow as the People tab: open a review record and land in the cockpit.
  const handleStartReview = async () => {
    setStarting(true);
    try {
      const created = await api.createCustomerReview(customer.id);
      navigate(`/customers/${customer.id}/reviews/${created.id}/cockpit`);
    } catch {
      setStarting(false);
      navigate(`/customers/${customer.id}/people`);
    }
  };

  return (
    <div
      className="flex items-center gap-4 border border-border-light rounded-[18px] p-[18px] mb-4 flex-wrap"
      style={{ background: 'linear-gradient(120deg, #F4FBFD, #fff)' }}
    >
      <div
        className="w-[58px] h-[58px] rounded-2xl flex items-center justify-center text-lg font-bold text-white shrink-0 shadow-lg"
        style={{ background: color }}
      >
        {customer.name?.charAt(0)?.toUpperCase() || '?'}
      </div>
      <div className="min-w-0">
        <h2 className="text-lg font-extrabold tracking-tight text-text m-0 flex items-center gap-2">
          <span className="truncate">{customer.name}</span>
          <StatusBadge status={customer.status} />
        </h2>
        <div className="flex flex-wrap gap-1.5 mt-1.5 items-center">
          {responsiblePerson && (
            <span className="text-[9.5px] font-mono font-semibold text-text-mid bg-[#EEF1F5] rounded-[7px] px-2 py-0.5">
              Responsible · {responsiblePerson.name}
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-6 ml-auto items-start">
        <Stat value={stats.projects} label="projects" />
        <Stat value={stats.planned} label={`planned FTE · ${monthShort}`} />
        <Stat value={stats.gap} label={`open · ${monthShort}`} color={stats.gap > 0 ? '#E8636F' : '#5BC68A'} />
      </div>
      <div className="flex gap-2 lg:ml-4 items-center">
        {canReview && (
          <button
            onClick={handleStartReview}
            disabled={starting}
            className="border-0 rounded-[11px] font-bold text-[11.5px] px-3.5 py-2.5 cursor-pointer bg-primary text-white shadow-[0_3px_10px_rgba(76,186,212,0.35)] hover:brightness-105 disabled:opacity-60"
          >
            ▶ {starting ? 'Starting…' : 'Start PM review'}
          </button>
        )}
        {isAdmin && (
          <button
            onClick={() => setEditing(true)}
            className="rounded-[11px] font-bold text-[11.5px] px-3.5 py-2.5 cursor-pointer bg-white text-text-mid border border-border-light hover:bg-primary-bg"
          >
            ✎ Edit
          </button>
        )}
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
