import { useMemo, useState } from 'react';

const DIMENSION_CODES = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'];

export default function LogInlineEditor({ initial, customers, projects, onCancel, onSave }) {
  const [content, setContent] = useState(initial?.content || '');
  const [customerId, setCustomerId] = useState(initial?.customerId || '');
  const [projectId, setProjectId] = useState(initial?.projectId || '');
  const [jiraUrl, setJiraUrl] = useState(initial?.jiraUrl || '');
  const [dimensionCode, setDimensionCode] = useState(initial?.dimensionCode || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const availableProjects = useMemo(() => {
    if (!projects) return [];
    if (!customerId) return projects;
    return projects.filter((p) => p.customerId === customerId);
  }, [projects, customerId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) {
      setError('Content is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({
        content: content.trim(),
        customerId: customerId || null,
        projectId: projectId || null,
        jiraUrl: jiraUrl.trim() || null,
        dimensionCode: dimensionCode || null,
      });
    } catch (err) {
      setError(err.message || 'Failed to save log');
      setSaving(false);
    }
  };

  const handleCustomerChange = (e) => {
    const newId = e.target.value;
    setCustomerId(newId);
    // Clear project if it no longer belongs to the chosen customer.
    if (projectId) {
      const proj = projects?.find((p) => p.id === projectId);
      if (newId && proj && proj.customerId !== newId) {
        setProjectId('');
      }
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-primary rounded-lg p-2.5 bg-primary-bg space-y-2"
    >
      {error && (
        <div className="text-[11px] text-danger bg-danger-bg p-1.5 rounded">{error}</div>
      )}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        maxLength={5000}
        placeholder="What happened?"
        className="w-full px-2 py-1.5 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white resize-y"
        required
      />
      <div className="grid grid-cols-2 gap-2">
        <select
          value={customerId}
          onChange={handleCustomerChange}
          className="px-2 py-1 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white"
        >
          <option value="">Customer: None</option>
          {customers?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="px-2 py-1 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white"
        >
          <option value="">Project: None</option>
          {availableProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          type="url"
          value={jiraUrl}
          onChange={(e) => setJiraUrl(e.target.value)}
          placeholder="Jira URL (optional)"
          maxLength={500}
          className="px-2 py-1 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white"
        />
        <select
          value={dimensionCode}
          onChange={(e) => setDimensionCode(e.target.value)}
          className="px-2 py-1 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white"
        >
          <option value="">Dimension: None</option>
          {DIMENSION_CODES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="text-[11px] font-semibold text-text-mid bg-transparent border border-border rounded px-2 py-1 cursor-pointer hover:bg-white"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="text-[11px] font-semibold text-white bg-primary border-0 rounded px-3 py-1 cursor-pointer hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
