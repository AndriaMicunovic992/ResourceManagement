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

  // Build a customer → projects hierarchy for the person's allocations.
  const customerGroups = useMemo(() => {
    const map = new Map();
    const myAssignments = assignments.filter((a) => a.resourceId === resourceId);
    for (const a of myAssignments) {
      const need = needs.find((n) => n.id === a.needId);
      if (!need) continue;
      const project = projects.find((p) => p.id === need.projectId);
      if (!project) continue;
      const customer = customers.find((c) => c.id === project.customerId);
      if (!customer) continue;
      if (!map.has(customer.id)) {
        map.set(customer.id, { customer, projects: new Map() });
      }
      const group = map.get(customer.id);
      if (!group.projects.has(project.id)) {
        group.projects.set(project.id, project);
      }
    }
    return Array.from(map.values())
      .map((g) => ({
        customer: g.customer,
        projects: Array.from(g.projects.values()).sort((a, b) =>
          a.name.localeCompare(b.name)
        ),
      }))
      .sort((a, b) => a.customer.name.localeCompare(b.customer.name));
  }, [resourceId, assignments, needs, projects, customers]);

  const [expanded, setExpanded] = useState(() => new Set());
  const toggleExpand = (customerId) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(customerId)) next.delete(customerId);
      else next.add(customerId);
      return next;
    });
  };

  const isScopeSelected = (customerId, projectId) =>
    selected.some(
      (s) => s.customerId === customerId && (s.projectId || null) === (projectId || null)
    );

  const toggle = (customerId, projectId) => {
    setSelected((prev) => {
      const exists = prev.find(
        (s) => s.customerId === customerId && (s.projectId || null) === (projectId || null)
      );
      if (exists) {
        return prev.filter((s) => s !== exists);
      }
      return [...prev, { customerId, projectId: projectId || null }];
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
            className="px-2 py-1.5 border border-border-light rounded-lg text-xs text-text outline-none focus:border-primary bg-white"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-text-mid mb-1 uppercase tracking-wider">
            Scopes
          </label>
          {customerGroups.length === 0 ? (
            <div className="text-xs text-text-light italic">
              No allocations yet — assign this person to a project first.
            </div>
          ) : (
            <div className="space-y-0.5 max-h-[320px] overflow-y-auto border border-border-light rounded-lg p-2">
              {customerGroups.map((group) => {
                const isExpanded = expanded.has(group.customer.id);
                const wholeSelected = isScopeSelected(group.customer.id, null);
                const selectedProjectCount = group.projects.filter((p) =>
                  isScopeSelected(group.customer.id, p.id)
                ).length;
                return (
                  <div key={group.customer.id}>
                    <div className="flex items-center gap-1 text-xs text-text hover:bg-primary-bg rounded px-1 py-1">
                      <button
                        type="button"
                        onClick={() => toggleExpand(group.customer.id)}
                        className="w-5 h-5 flex items-center justify-center text-text-light bg-transparent border-0 cursor-pointer hover:text-primary shrink-0"
                        aria-label={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        {isExpanded ? '▾' : '▸'}
                      </button>
                      <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={wholeSelected}
                          onChange={() => toggle(group.customer.id, null)}
                        />
                        <span className="font-semibold truncate">{group.customer.name}</span>
                        <span className="text-[10px] text-text-light">
                          (whole customer)
                        </span>
                        {selectedProjectCount > 0 && !wholeSelected && (
                          <span className="text-[10px] text-primary font-semibold">
                            · {selectedProjectCount} project
                            {selectedProjectCount === 1 ? '' : 's'} selected
                          </span>
                        )}
                      </label>
                    </div>
                    {isExpanded && group.projects.length > 0 && (
                      <div className="ml-6 border-l border-border pl-2 space-y-0.5 py-0.5">
                        {group.projects.map((project) => {
                          const isOn = isScopeSelected(group.customer.id, project.id);
                          return (
                            <label
                              key={project.id}
                              className={`flex items-center gap-2 text-xs cursor-pointer rounded px-1.5 py-1 ${
                                wholeSelected
                                  ? 'text-text-light'
                                  : 'text-text hover:bg-primary-bg'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isOn}
                                disabled={wholeSelected}
                                onChange={() => toggle(group.customer.id, project.id)}
                              />
                              {project.name}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
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
            className="text-xs font-bold text-text-mid bg-white border border-border-light rounded-lg px-3 py-1.5 cursor-pointer hover:bg-primary-bg"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || selected.length === 0}
            className="text-xs font-bold text-white bg-primary border-0 rounded-lg px-4 py-1.5 cursor-pointer hover:brightness-105 disabled:opacity-50"
          >
            {saving ? 'Creating…' : `Create ${selected.length || ''} evaluation${selected.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
