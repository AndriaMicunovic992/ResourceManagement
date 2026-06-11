import { useMemo, useState } from 'react';
import Modal from '../../../../components/ui/Modal';
import { api } from '../../../../lib/api';
import { useData } from '../../../../contexts/DataContext';
import {
  LOG_KIND_OPTIONS,
  EMPLOYEE_LOG_KIND_OPTIONS,
} from '../../../../lib/constants';

export default function NewLogModal({ resourceId, onCancel, onCreated }) {
  const { customers, projects, logCategories } = useData();
  const [content, setContent] = useState('');
  const [perspective, setPerspective] = useState('observer');
  const [kind, setKind] = useState('strength');
  const [customerId, setCustomerId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [jiraUrl, setJiraUrl] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const availableProjects = useMemo(() => {
    if (!customerId) return projects;
    return projects.filter((p) => p.customerId === customerId);
  }, [projects, customerId]);

  const groupedCategories = useMemo(() => {
    const active = logCategories.filter((c) => c.active !== false);
    const groups = new Map();
    for (const c of active) {
      const g = c.grouping || '';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(c);
    }
    return Array.from(groups.entries()).map(([grouping, categories]) => ({ grouping, categories }));
  }, [logCategories]);

  const kindOptions =
    perspective === 'employee' ? EMPLOYEE_LOG_KIND_OPTIONS : LOG_KIND_OPTIONS;

  const handlePerspectiveChange = (next) => {
    setPerspective(next);
    setKind('strength');
  };

  const handleCustomerChange = (e) => {
    const newId = e.target.value;
    setCustomerId(newId);
    if (projectId) {
      const proj = projects.find((p) => p.id === projectId);
      if (newId && proj && proj.customerId !== newId) setProjectId('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) {
      setError('Content is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const created = await api.createLog(resourceId, {
        content: content.trim(),
        kind,
        customerId: customerId || null,
        projectId: projectId || null,
        jiraUrl: jiraUrl.trim() || null,
        categoryId: categoryId || null,
      });
      onCreated(created);
    } catch (err) {
      setError(err.message || 'Failed to create log');
      setSaving(false);
    }
  };

  return (
    <Modal title="New log" onClose={onCancel} wide>
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <div className="text-xs text-danger bg-danger-bg p-2 rounded">{error}</div>
        )}

        <div>
          <label className="block text-[10px] font-semibold text-text-mid mb-1 uppercase tracking-wider">
            Logged from
          </label>
          <div className="inline-flex rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => handlePerspectiveChange('observer')}
              className={`px-3 py-1.5 text-xs font-semibold border-0 cursor-pointer ${
                perspective === 'observer'
                  ? 'bg-primary text-white'
                  : 'bg-white text-text-mid hover:bg-primary-bg'
              }`}
            >
              Manager / customer perspective
            </button>
            <button
              type="button"
              onClick={() => handlePerspectiveChange('employee')}
              className={`px-3 py-1.5 text-xs font-semibold border-0 border-l border-border cursor-pointer ${
                perspective === 'employee'
                  ? 'bg-primary text-white'
                  : 'bg-white text-text-mid hover:bg-primary-bg'
              }`}
            >
              Employee perspective
            </button>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-text-mid mb-1 uppercase tracking-wider">
            Content
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            maxLength={5000}
            className="w-full px-2 py-1.5 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white resize-y"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-semibold text-text-mid mb-1 uppercase tracking-wider">
              Kind
            </label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="w-full px-2 py-1.5 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white"
            >
              {kindOptions.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-text-mid mb-1 uppercase tracking-wider">
              Category
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-2 py-1.5 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white"
            >
              <option value="">None</option>
              {groupedCategories.map((group) => (
                group.grouping ? (
                  <optgroup key={group.grouping} label={group.grouping}>
                    {group.categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </optgroup>
                ) : (
                  group.categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))
                )
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-text-mid mb-1 uppercase tracking-wider">
              Customer
            </label>
            <select
              value={customerId}
              onChange={handleCustomerChange}
              className="w-full px-2 py-1.5 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white"
            >
              <option value="">None</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-text-mid mb-1 uppercase tracking-wider">
              Project
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-2 py-1.5 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white"
            >
              <option value="">None</option>
              {availableProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-text-mid mb-1 uppercase tracking-wider">
            Jira URL
          </label>
          <input
            type="url"
            value={jiraUrl}
            onChange={(e) => setJiraUrl(e.target.value)}
            maxLength={500}
            className="w-full px-2 py-1.5 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white"
          />
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
            disabled={saving}
            className="text-xs font-semibold text-white bg-primary border-0 rounded px-4 py-1.5 cursor-pointer hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
