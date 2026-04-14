import { useMemo, useState } from 'react';
import Modal from '../../../../components/ui/Modal';
import { api } from '../../../../lib/api';
import { useData } from '../../../../contexts/DataContext';

/**
 * Batch evaluation creation. Pick one or more {customer, optional project}
 * scopes that the target person is allocated to and a shared periodEnd.
 */
export default function NewEvaluationModal({ resourceId, onCancel, onCreated }) {
  const { customers, projects, needs, assignments } = useData();
  const [selected, setSelected] = useState([]); // [{customerId, projectId|null}]
  const [periodEnd, setPeriodEnd] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Compute the {customer, project} scopes the person is allocated to.
  const availableScopes = useMemo(() => {
    const map = new Map();
    const myAssignments = assignments.filter((a) => a.resourceId === resourceId);
    for (const a of myAssignments) {
      const need = needs.find((n) => n.id === a.needId);
      if (!need) continue;
      const project = projects.find((p) => p.id === need.projectId);
      if (!project) continue;
      const customer = customers.find((c) => c.id === project.customerId);
      if (!customer) continue;
      const customerKey = `c:${customer.id}`;
      if (!map.has(customerKey)) {
        map.set(customerKey, {
          key: customerKey,
          customerId: customer.id,
          projectId: null,
          label: `${customer.name} (whole customer)`,
        });
      }
      const projectKey = `p:${customer.id}:${project.id}`;
      if (!map.has(projectKey)) {
        map.set(projectKey, {
          key: projectKey,
          customerId: customer.id,
          projectId: project.id,
          label: `${customer.name} · ${project.name}`,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [resourceId, assignments, needs, projects, customers]);

  const toggle = (scope) => {
    setSelected((prev) => {
      const exists = prev.find(
        (s) => s.customerId === scope.customerId && (s.projectId || null) === (scope.projectId || null)
      );
      if (exists) {
        return prev.filter((s) => s !== exists);
      }
      return [...prev, { customerId: scope.customerId, projectId: scope.projectId }];
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selected.length === 0) {
      setError('Pick at least one scope');
      return;
    }
    if (!periodEnd) {
      setError('Pick a period end');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const created = await api.createEvaluationBatch({
        resourceId,
        scopes: selected,
        periodEnd,
      });
      onCreated(Array.isArray(created) ? created : []);
    } catch (err) {
      setError(err.message || 'Failed to create evaluations');
      setSaving(false);
    }
  };

  return (
    <Modal title="New evaluations" onClose={onCancel} wide>
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <div className="text-xs text-danger bg-danger-bg p-2 rounded">{error}</div>
        )}
        <div>
          <label className="block text-[10px] font-semibold text-text-mid mb-1 uppercase tracking-wider">
            Period end
          </label>
          <input
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className="px-2 py-1.5 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-text-mid mb-1 uppercase tracking-wider">
            Scopes
          </label>
          {availableScopes.length === 0 ? (
            <div className="text-xs text-text-light italic">
              No allocations yet — assign this person to a project first.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[280px] overflow-y-auto border border-border rounded p-2">
              {availableScopes.map((scope) => {
                const isOn = selected.some(
                  (s) => s.customerId === scope.customerId && (s.projectId || null) === (scope.projectId || null)
                );
                return (
                  <label
                    key={scope.key}
                    className="flex items-center gap-2 text-xs text-text cursor-pointer hover:bg-primary-bg rounded px-1.5 py-1"
                  >
                    <input
                      type="checkbox"
                      checked={isOn}
                      onChange={() => toggle(scope)}
                    />
                    {scope.label}
                  </label>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="text-xs font-semibold text-text-mid bg-transparent border border-border rounded px-3 py-1.5 cursor-pointer hover:bg-primary-bg"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || selected.length === 0}
            className="text-xs font-semibold text-white bg-primary border-0 rounded px-4 py-1.5 cursor-pointer hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Creating…' : `Create ${selected.length || ''} evaluation${selected.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
