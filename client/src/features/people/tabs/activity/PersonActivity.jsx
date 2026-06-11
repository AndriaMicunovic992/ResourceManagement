import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../../../lib/api';
import { useAuth } from '../../../../contexts/AuthContext';
import { useOrg } from '../../../../contexts/OrgContext';
import { useData } from '../../../../contexts/DataContext';
import EmptyState from '../../../../components/ui/EmptyState';
import LogInlineEditor from '../oneonones/LogInlineEditor';
import NewLogModal from './NewLogModal';
import LogCard from './LogCard';
import { LOG_KIND_OPTIONS } from '../../../../lib/constants';

const KINDS = [{ value: '', label: 'All kinds' }, ...LOG_KIND_OPTIONS];

export default function PersonActivity() {
  const { resource } = useOutletContext();
  const { role } = useOrg();
  const { user } = useAuth();
  const { customers, projects, logCategories } = useData();
  const isAdmin = role === 'admin' || role === 'owner';

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

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingLogId, setEditingLogId] = useState(null);

  const [filterKind, setFilterKind] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const filters = useMemo(
    () => ({
      kind: filterKind,
      categoryId: filterCategory,
      customerId: filterCustomer,
      projectId: filterProject,
      from: filterFrom,
      to: filterTo,
    }),
    [filterKind, filterCategory, filterCustomer, filterProject, filterFrom, filterTo]
  );

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .listLogs(resource.id, filters)
      .then((data) => {
        if (cancelled) return;
        setLogs(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Failed to load logs');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, resource.id, filters]);

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-xl border border-border p-10 text-center">
        <div className="text-4xl mb-3">🔒</div>
        <div className="text-sm text-text-mid">
          Access restricted — activity logs are visible to admins only.
        </div>
      </div>
    );
  }

  const handleCreated = (created) => {
    setLogs((prev) => [created, ...prev]);
    setShowNewModal(false);
  };

  const handleUpdateLog = async (logId, data) => {
    const updated = await api.updateLog(resource.id, logId, data);
    setLogs((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    setEditingLogId(null);
  };

  const handleDeleteLog = async (logId) => {
    if (!window.confirm('Delete this log entry?')) return;
    try {
      await api.deleteLog(resource.id, logId);
      setLogs((prev) => prev.filter((l) => l.id !== logId));
    } catch (err) {
      setError(err.message || 'Failed to delete log');
    }
  };

  return (
    <div>
      <div className="bg-white rounded-xl border border-border p-3 mb-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={filterKind}
              onChange={(e) => setFilterKind(e.target.value)}
              className="px-2 py-1 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white"
            >
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-2 py-1 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white"
            >
              <option value="">All categories</option>
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
            <select
              value={filterCustomer}
              onChange={(e) => setFilterCustomer(e.target.value)}
              className="px-2 py-1 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white"
            >
              <option value="">All customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="px-2 py-1 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white"
            >
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="px-2 py-1 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white"
            />
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="px-2 py-1 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white"
            />
          </div>
          <button
            onClick={() => setShowNewModal(true)}
            className="text-xs font-semibold text-white bg-primary border-0 rounded px-3 py-1.5 cursor-pointer hover:opacity-90"
          >
            + New log
          </button>
        </div>
      </div>

      {error && (
        <div className="text-xs text-danger bg-danger-bg p-2 rounded mb-3">{error}</div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border border-border p-8 text-center text-xs text-text-light">
          Loading…
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-xl border border-border">
          <EmptyState icon="📜" message="No activity matching the current filters" />
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) =>
            editingLogId === log.id ? (
              <LogInlineEditor
                key={log.id}
                initial={log}
                customers={customers}
                projects={projects}
                onCancel={() => setEditingLogId(null)}
                onSave={(data) => handleUpdateLog(log.id, data)}
              />
            ) : (
              <LogCard
                key={log.id}
                log={log}
                currentUserId={user?.id}
                resourceId={resource.id}
                subjectUserId={resource.userId}
                canComment={isAdmin}
                onEdit={() => setEditingLogId(log.id)}
                onDelete={() => handleDeleteLog(log.id)}
              />
            )
          )}
        </div>
      )}

      {showNewModal && (
        <NewLogModal
          resourceId={resource.id}
          onCancel={() => setShowNewModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
