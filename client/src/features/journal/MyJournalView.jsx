import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { isHttpUrl } from '../../lib/url';
import { useData } from '../../contexts/DataContext';
import EmptyState from '../../components/ui/EmptyState';
import {
  EMPLOYEE_LOG_KIND_OPTIONS,
  LOG_KIND_COLORS,
} from '../../lib/constants';
import CategoryMultiPicker, {
  CategoryChips,
} from '../../components/forms/CategoryMultiPicker';

const KINDS = EMPLOYEE_LOG_KIND_OPTIONS;
const KIND_COLORS = LOG_KIND_COLORS;

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function LogForm({ initial, customers, projects, logCategories, onCancel, onSave }) {
  const [content, setContent] = useState(initial?.content || '');
  const [kind, setKind] = useState(initial?.kind || 'strength');
  const [customerId, setCustomerId] = useState(initial?.customerId || '');
  const [projectId, setProjectId] = useState(initial?.projectId || '');
  const [jiraUrl, setJiraUrl] = useState(initial?.jiraUrl || '');
  const [categoryIds, setCategoryIds] = useState(
    (initial?.categories || []).map((c) => c.id)
  );
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
      await onSave({
        content: content.trim(),
        kind,
        customerId: customerId || null,
        projectId: projectId || null,
        jiraUrl: jiraUrl.trim() || null,
        categoryIds,
      });
    } catch (err) {
      setError(err.message || 'Failed to save');
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-primary rounded-xl p-3 bg-primary-bg space-y-2"
    >
      {error && (
        <div className="text-xs text-danger bg-danger-bg p-2 rounded">{error}</div>
      )}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={4}
        maxLength={5000}
        placeholder="What happened?"
        className="w-full px-2 py-1.5 border border-border rounded text-sm text-text outline-none focus:border-primary bg-white resize-y"
        required
      />
      <div className="grid grid-cols-2 gap-2">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="px-2 py-1.5 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white"
        >
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
        <div className="col-span-2">
          <CategoryMultiPicker
            logCategories={logCategories}
            value={categoryIds}
            onChange={setCategoryIds}
          />
        </div>
        <select
          value={customerId}
          onChange={handleCustomerChange}
          className="px-2 py-1.5 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white"
        >
          <option value="">Customer: None</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="px-2 py-1.5 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white"
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
          className="col-span-2 px-2 py-1.5 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white"
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="text-xs font-semibold text-text-mid bg-transparent border border-border rounded px-3 py-1.5 cursor-pointer hover:bg-white"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="text-xs font-semibold text-white bg-primary border-0 rounded px-4 py-1.5 cursor-pointer hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

function LogCard({ log, onEdit, onDelete }) {
  return (
    <div className="bg-white rounded-xl border border-border p-4">
      <div className="text-sm text-text whitespace-pre-wrap mb-2">{log.content}</div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        <span
          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase ${
            KIND_COLORS[log.kind] || 'bg-gray-100 text-gray-700'
          }`}
        >
          {log.kind}
        </span>
        <CategoryChips categories={log.categories} />
        {log.customer && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">
            🏢 {log.customer.name}
          </span>
        )}
        {log.project && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
            📁 {log.project.name}
          </span>
        )}
        {isHttpUrl(log.jiraUrl) && (
          <a
            href={log.jiraUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 no-underline"
          >
            🔗 Jira
          </a>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] text-text-light">{formatDate(log.createdAt)}</div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onEdit}
            className="text-[11px] font-semibold text-primary bg-transparent border border-primary rounded px-2 py-1 cursor-pointer hover:bg-primary hover:text-white"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="text-[11px] font-semibold text-danger bg-transparent border border-danger rounded px-2 py-1 cursor-pointer hover:bg-danger hover:text-white"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MyJournalView() {
  const { meResource, customers, projects, logCategories } = useData();

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterKind, setFilterKind] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    if (!meResource) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .listLogs(meResource.id, filterKind ? { kind: filterKind } : {})
      .then((data) => {
        if (cancelled) return;
        setLogs(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Failed to load');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [meResource, filterKind]);

  if (!meResource) {
    return (
      <div className="max-w-[780px] mx-auto px-5 py-6">
        <h2 className="text-xl font-bold text-text mb-4">My Journal</h2>
        <div className="bg-white rounded-xl border border-border p-10 text-center">
          <div className="text-4xl mb-3">📖</div>
          <div className="text-sm text-text-mid">
            You are not yet linked to a resource in this organisation. Ask an admin
            to link your user account to your profile so you can start journalling.
          </div>
        </div>
      </div>
    );
  }

  const handleCreate = async (data) => {
    const created = await api.createLog(meResource.id, data);
    setLogs((prev) => [created, ...prev]);
    setShowForm(false);
  };

  const handleUpdate = async (data) => {
    if (!editing) return;
    const updated = await api.updateLog(meResource.id, editing.id, data);
    setLogs((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    setEditing(null);
  };

  const handleDelete = async (log) => {
    if (!window.confirm('Delete this entry?')) return;
    try {
      await api.deleteLog(meResource.id, log.id);
      setLogs((prev) => prev.filter((l) => l.id !== log.id));
    } catch (err) {
      setError(err.message || 'Failed to delete');
    }
  };

  return (
    <div className="max-w-[780px] mx-auto px-5 py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-text">My Journal</h2>
          <p className="text-xs text-text-light mt-0.5">
            Log your own wins, downs and blockers. Visible to your manager.
          </p>
        </div>
        {!showForm && !editing && (
          <button
            onClick={() => setShowForm(true)}
            className="text-xs font-semibold text-white bg-primary border-0 rounded px-3 py-1.5 cursor-pointer hover:opacity-90"
          >
            + New entry
          </button>
        )}
      </div>

      {error && (
        <div className="text-xs text-danger bg-danger-bg p-2 rounded mb-3">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-border p-3 mb-4 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-text-light font-semibold">
          Filter
        </span>
        <select
          value={filterKind}
          onChange={(e) => setFilterKind(e.target.value)}
          className="px-2 py-1 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white"
        >
          <option value="">All kinds</option>
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </div>

      {showForm && (
        <div className="mb-4">
          <LogForm
            initial={null}
            customers={customers}
            projects={projects}
            logCategories={logCategories}
            onCancel={() => setShowForm(false)}
            onSave={handleCreate}
          />
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border border-border p-8 text-center text-xs text-text-light">
          Loading…
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-xl border border-border">
          <EmptyState icon="📖" message="No entries yet. Start by capturing a win or a blocker." />
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) =>
            editing?.id === log.id ? (
              <LogForm
                key={log.id}
                initial={log}
                customers={customers}
                projects={projects}
                logCategories={logCategories}
                onCancel={() => setEditing(null)}
                onSave={handleUpdate}
              />
            ) : (
              <LogCard
                key={log.id}
                log={log}
                onEdit={() => setEditing(log)}
                onDelete={() => handleDelete(log)}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}
