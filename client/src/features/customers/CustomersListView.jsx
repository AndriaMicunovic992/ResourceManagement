import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import CustomerForm from '../../components/forms/CustomerForm';
import { useData } from '../../contexts/DataContext';
import { useVisibility } from '../../contexts/VisibilityContext';
import { currentMonth } from '../../lib/dateUtils';
import { MONTHS } from '../../lib/constants';

const AVATAR_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const colorFor = (name) => AVATAR_COLORS[(name || '').split('').reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_COLORS.length];

export default function CustomersListView() {
  const { customers, projects, resources, needs, assignments, addCustomer } = useData();
  const { isAdmin } = useVisibility();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);

  const m0 = currentMonth();
  const monthShort = MONTHS[parseInt(m0.slice(5), 10) - 1];

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers
      .filter((c) => !q || c.name.toLowerCase().includes(q))
      .map((c) => {
        const projIds = new Set(projects.filter((p) => p.customerId === c.id).map((p) => p.id));
        const custNeeds = needs.filter((n) => projIds.has(n.projectId));
        const needIds = new Set(custNeeds.map((n) => n.id));
        let planned = 0, needed = 0;
        for (const a of assignments) {
          if (needIds.has(a.needId)) planned += (a.monthAllocations || {})[m0] || 0;
        }
        for (const n of custNeeds) needed += (n.monthAllocations || {})[m0] || 0;
        return {
          customer: c,
          projectCount: projIds.size,
          planned: Math.round(planned * 10) / 10,
          gap: Math.round(Math.max(0, needed - planned) * 10) / 10,
          responsible: resources.find((r) => r.id === c.responsiblePersonId) || null,
        };
      })
      .sort((a, b) => a.customer.name.localeCompare(b.customer.name));
  }, [customers, projects, resources, needs, assignments, search, m0]);

  const openTotal = rows.reduce((s, r) => s + r.gap, 0);

  const handleCreate = async (data) => {
    const created = await addCustomer(data);
    setAdding(false);
    if (created?.id) navigate(`/customers/${created.id}`);
  };

  return (
    <div className="max-w-[1100px] mx-auto px-5 py-6">
      <PageHeader
        title="Customers"
        subtitle={`${customers.length} ${customers.length === 1 ? 'customer' : 'customers'} · ${
          openTotal > 0 ? `${Math.round(openTotal * 10) / 10} FTE open in ${monthShort}` : `fully staffed in ${monthShort}`
        }`}
      >
        <div className="flex items-center gap-2 border border-border-light bg-white rounded-xl px-3 py-2 min-w-[200px]">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-light shrink-0"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers…"
            className="text-[11.5px] font-medium text-text outline-none bg-transparent w-full placeholder:text-text-light"
          />
        </div>
        {isAdmin && <Button onClick={() => setAdding(true)}>＋ Customer</Button>}
      </PageHeader>

      {rows.length === 0 ? (
        <div className="text-center text-text-light text-sm py-10 bg-white rounded-2xl border border-border-light">
          No customers yet.
        </div>
      ) : (
        <div className="bg-white border border-border-light rounded-2xl shadow-card p-2">
          {rows.map(({ customer, projectCount, planned, gap, responsible }) => (
            <Link
              key={customer.id}
              to={`/customers/${customer.id}`}
              className={`flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl no-underline mb-1 last:mb-0 transition ${
                gap > 0 ? 'border border-border-light shadow-[0_8px_22px_rgba(34,49,63,0.10)]' : 'hover:bg-[#F7FAFC]'
              }`}
            >
              <span
                className="w-[34px] h-[34px] rounded-xl flex items-center justify-center text-[12px] font-bold text-white shrink-0"
                style={{ background: colorFor(customer.name) }}
              >
                {customer.name?.charAt(0)?.toUpperCase() || '?'}
              </span>
              <span className="w-[220px] min-w-0 shrink-0">
                <span className="flex items-center text-[12.5px] font-bold text-text">
                  <span className="truncate">{customer.name}</span>
                  <StatusBadge status={customer.status} small />
                </span>
                <span className="block text-[9.5px] font-mono text-text-light truncate mt-0.5">
                  {responsible ? `Responsible · ${responsible.name}` : 'No responsible person'}
                </span>
              </span>
              <span className="text-[9.5px] font-semibold text-text-mid bg-[#EEF1F5] rounded-full px-2.5 py-1 shrink-0">
                {projectCount} project{projectCount === 1 ? '' : 's'}
              </span>
              <span className="ml-auto text-[10px] font-mono text-text-mid shrink-0">
                {planned} FTE · {monthShort}
              </span>
              {gap > 0 ? (
                <span className="text-[9.5px] font-bold rounded-full px-2.5 py-1 bg-danger-bg text-danger shrink-0">{gap} FTE open</span>
              ) : (
                <span className="text-[9.5px] font-bold rounded-full px-2.5 py-1 bg-success-bg text-success shrink-0">staffed</span>
              )}
            </Link>
          ))}
        </div>
      )}

      {adding && <CustomerForm onSave={handleCreate} onClose={() => setAdding(false)} />}
    </div>
  );
}
