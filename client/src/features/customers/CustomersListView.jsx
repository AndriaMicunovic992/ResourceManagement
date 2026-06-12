import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import StatusBadge from '../../components/ui/StatusBadge';
import CustomerForm from '../../components/forms/CustomerForm';
import { useData } from '../../contexts/DataContext';
import { useVisibility } from '../../contexts/VisibilityContext';

export default function CustomersListView() {
  const { customers, projects, resources, addCustomer } = useData();
  const { isAdmin } = useVisibility();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers
      .filter((c) => !q || c.name.toLowerCase().includes(q))
      .map((c) => ({
        customer: c,
        projectCount: projects.filter((p) => p.customerId === c.id).length,
        responsible: resources.find((r) => r.id === c.responsiblePersonId) || null,
      }))
      .sort((a, b) => a.customer.name.localeCompare(b.customer.name));
  }, [customers, projects, resources, search]);

  const handleCreate = async (data) => {
    const created = await addCustomer(data);
    setAdding(false);
    if (created?.id) navigate(`/customers/${created.id}`);
  };

  return (
    <div className="max-w-[1100px] mx-auto px-5 py-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <div className="text-lg font-bold text-text">Customers</div>
          <div className="text-[11px] text-text-light">
            {rows.length} {rows.length === 1 ? 'customer' : 'customers'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers…"
            className="px-3 py-1.5 border border-border rounded-lg text-xs text-text outline-none focus:border-primary bg-white"
          />
          {isAdmin && <Button onClick={() => setAdding(true)}>+ New customer</Button>}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg-subtle">
            <tr className="text-left text-[11px] text-text-mid uppercase tracking-wider">
              <th className="px-4 py-2 font-semibold">Customer</th>
              <th className="px-4 py-2 font-semibold">Status</th>
              <th className="px-4 py-2 font-semibold">Responsible</th>
              <th className="px-4 py-2 font-semibold text-right">Projects</th>
              <th className="px-4 py-2 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-xs text-text-light">
                  No customers yet.
                </td>
              </tr>
            )}
            {rows.map(({ customer, projectCount, responsible }) => (
              <tr key={customer.id} className="border-t border-border hover:bg-primary-bg/30">
                <td className="px-4 py-2 font-semibold text-text">{customer.name}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={customer.status} />
                </td>
                <td className="px-4 py-2 text-xs text-text-mid">{responsible?.name || '—'}</td>
                <td className="px-4 py-2 font-mono text-right text-text-mid">{projectCount}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => navigate(`/customers/${customer.id}`)}
                    className="text-xs font-semibold text-primary bg-transparent border border-primary rounded px-2 py-1 cursor-pointer hover:bg-primary hover:text-white"
                  >
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adding && <CustomerForm onSave={handleCreate} onClose={() => setAdding(false)} />}
    </div>
  );
}
