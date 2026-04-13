import { useMemo, useState } from 'react';
import Modal from '../../../../components/ui/Modal';
import { api } from '../../../../lib/api';
import { useData } from '../../../../contexts/DataContext';

const DIMENSION_CODES = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'];
const KINDS = [
  { value: 'observation', label: 'Observation' },
  { value: 'good', label: 'Good' },
  { value: 'bad', label: 'Bad' },
  { value: 'suggestion', label: 'Suggestion' },
];

export default function NewLogModal({ resourceId, onCancel, onCreated }) {
  const { customers, projects } = useData();
  const [content, setContent] = useState('');
  const [kind, setKind] = useState('observation');
  const [customerId, setCustomerId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [jiraUrl, setJiraUrl] = useState('');
  const [dimensionCode, setDimensionCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const availableProjects = useMemo(() => {
    if (!customerId) return projects;
    return projects.filter((p) => p.customerId === customerId);
  }, [projects, customerId]);

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
        dimensionCode: dimensionCode || null,
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
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-text-mid mb-1 uppercase tracking-wider">
              Dimension
            </label>
            <select
              value={dimensionCode}
              onChange={(e) => setDimensionCode(e.target.value)}
              className="w-full px-2 py-1.5 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white"
            >
              <option value="">None</option>
              {DIMENSION_CODES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
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
