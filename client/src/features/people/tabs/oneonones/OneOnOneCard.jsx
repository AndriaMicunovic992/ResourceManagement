import { useEffect, useState } from 'react';
import { api } from '../../../../lib/api';
import { useAuth } from '../../../../contexts/AuthContext';
import { useData } from '../../../../contexts/DataContext';
import LogInlineEditor from './LogInlineEditor';

const OBSERVER_SECTIONS = [
  { kind: 'good', label: 'Good sides' },
  { kind: 'bad', label: 'Bad sides' },
  { kind: 'incident', label: 'Incidents' },
  { kind: 'observation', label: 'Observations' },
];

const EMPLOYEE_SECTIONS = [
  { kind: 'win', label: 'Wins' },
  { kind: 'down', label: 'Downs' },
  { kind: 'blocker', label: 'Blockers' },
];

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

function Section({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-text-light font-semibold mb-1">
        {label}
      </div>
      <div className="text-xs text-text whitespace-pre-wrap">{value}</div>
    </div>
  );
}

function LogEntry({ log, currentUserId, onEdit, onDelete }) {
  const isAuthor = log.authorUserId === currentUserId;
  return (
    <div className="border border-border-light rounded-lg p-2.5 bg-white">
      <div className="text-xs text-text whitespace-pre-wrap mb-1.5">{log.content}</div>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {log.category && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary-light text-primary">
            {log.category.grouping ? `${log.category.grouping} · ${log.category.name}` : log.category.name}
          </span>
        )}
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
        {log.jiraUrl && (
          <a
            href={log.jiraUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 no-underline"
            onClick={(e) => e.stopPropagation()}
          >
            🔗 Jira
          </a>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] text-text-light">
          {log.authorUser?.name || log.authorUser?.email || 'Unknown'} ·{' '}
          {formatDate(log.createdAt)}
        </div>
        {isAuthor && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={onEdit}
              className="text-[10px] font-semibold text-primary bg-transparent border border-primary rounded px-1.5 py-0.5 cursor-pointer hover:bg-primary hover:text-white"
            >
              Edit
            </button>
            <button
              onClick={onDelete}
              className="text-[10px] font-semibold text-danger bg-transparent border border-danger rounded px-1.5 py-0.5 cursor-pointer hover:bg-danger hover:text-white"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OneOnOneCard({ record, onEdit, onDelete, readOnly = false }) {
  const [expanded, setExpanded] = useState(false);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState('');
  const [addingKind, setAddingKind] = useState(null);
  const [editingLogId, setEditingLogId] = useState(null);
  const { user } = useAuth();
  const { customers, projects } = useData();

  const author = record.authorUser;
  const authorName = author?.name || author?.email || 'Unknown';
  const hasPrivate = record.managerPersonalNotes != null && record.managerPersonalNotes !== '';
  const hasPrivateNote = record.privateNote != null && record.privateNote !== '';

  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    setLogsLoading(true);
    setLogsError('');
    api
      .listLogs(record.resourceId, { oneOnOneId: record.id })
      .then((data) => {
        if (cancelled) return;
        setLogs(Array.isArray(data) ? data : []);
        setLogsLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setLogsError(err.message || 'Failed to load logs');
        setLogsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [expanded, record.id, record.resourceId]);

  const byKind = {
    good: logs.filter((l) => l.kind === 'good'),
    bad: logs.filter((l) => l.kind === 'bad'),
    incident: logs.filter((l) => l.kind === 'incident'),
    observation: logs.filter((l) => l.kind === 'observation'),
    win: logs.filter((l) => l.kind === 'win'),
    down: logs.filter((l) => l.kind === 'down'),
    blocker: logs.filter((l) => l.kind === 'blocker'),
  };

  const handleCreateLog = async (data) => {
    const payload = {
      ...data,
      kind: addingKind,
      oneOnOneId: record.id,
    };
    const created = await api.createLog(record.resourceId, payload);
    setLogs((prev) => [...prev, created]);
    setAddingKind(null);
  };

  const handleUpdateLog = async (logId, data) => {
    const updated = await api.updateLog(record.resourceId, logId, data);
    setLogs((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    setEditingLogId(null);
  };

  const handleDeleteLog = async (logId) => {
    if (!window.confirm('Delete this log entry?')) return;
    try {
      await api.deleteLog(record.resourceId, logId);
      setLogs((prev) => prev.filter((l) => l.id !== logId));
    } catch (err) {
      setLogsError(err.message || 'Failed to delete log');
    }
  };

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-primary-bg"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-lg">{expanded ? '▾' : '▸'}</div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-text">
              {formatDate(record.meetingDate)}
            </div>
            <div className="text-[11px] text-text-light truncate">by {authorName}</div>
          </div>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={onEdit}
              className="text-xs font-semibold text-primary bg-transparent border border-primary rounded px-2 py-1 cursor-pointer hover:bg-primary hover:text-white"
            >
              Edit
            </button>
            <button
              onClick={onDelete}
              className="text-xs font-semibold text-danger bg-transparent border border-danger rounded px-2 py-1 cursor-pointer hover:bg-danger hover:text-white"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-border-light space-y-4">
          <Section label="General status" value={record.generalStatus} />
          {!readOnly && <Section label="Personal notes" value={record.personalNotes} />}
          <Section label="Career development" value={record.careerDevelopment} />

          {logsError && (
            <div className="text-xs text-danger bg-danger-bg p-2 rounded">{logsError}</div>
          )}

          {!readOnly && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-text-mid font-bold mb-2">
              Manager / customer perspective
            </div>
            <div className="space-y-3">
              {OBSERVER_SECTIONS.map(({ kind, label }) => (
                <div key={kind}>
                  <div className="text-[10px] uppercase tracking-wider text-text-light font-semibold mb-1.5">
                    {label}
                  </div>
                  {logsLoading ? (
                    <div className="text-[11px] text-text-light italic">Loading…</div>
                  ) : (
                    <div className="space-y-1.5">
                      {byKind[kind].length === 0 && addingKind !== kind && (
                        <div className="text-[11px] text-text-light italic">No entries.</div>
                      )}
                      {byKind[kind].map((log) =>
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
                          <LogEntry
                            key={log.id}
                            log={log}
                            currentUserId={user?.id}
                            onEdit={() => setEditingLogId(log.id)}
                            onDelete={() => handleDeleteLog(log.id)}
                          />
                        )
                      )}
                      {addingKind === kind ? (
                        <LogInlineEditor
                          initial={null}
                          customers={customers}
                          projects={projects}
                          onCancel={() => setAddingKind(null)}
                          onSave={handleCreateLog}
                        />
                      ) : (
                        <button
                          onClick={() => {
                            setEditingLogId(null);
                            setAddingKind(kind);
                          }}
                          className="text-[11px] font-semibold text-primary bg-transparent border border-primary rounded px-2 py-1 cursor-pointer hover:bg-primary hover:text-white"
                        >
                          + Add
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          )}

          <div>
            <div className="text-[10px] uppercase tracking-wider text-text-mid font-bold mb-2">
              Employee perspective
            </div>
            <div className="space-y-3">
              {EMPLOYEE_SECTIONS.map(({ kind, label }) => (
                <div key={kind}>
                  <div className="text-[10px] uppercase tracking-wider text-text-light font-semibold mb-1.5">
                    {label}
                  </div>
                  {logsLoading ? (
                    <div className="text-[11px] text-text-light italic">Loading…</div>
                  ) : (
                    <div className="space-y-1.5">
                      {byKind[kind].length === 0 && addingKind !== kind && (
                        <div className="text-[11px] text-text-light italic">No entries.</div>
                      )}
                      {byKind[kind].map((log) =>
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
                          <LogEntry
                            key={log.id}
                            log={log}
                            currentUserId={user?.id}
                            onEdit={() => setEditingLogId(log.id)}
                            onDelete={() => handleDeleteLog(log.id)}
                          />
                        )
                      )}
                      {addingKind === kind ? (
                        <LogInlineEditor
                          initial={null}
                          customers={customers}
                          projects={projects}
                          onCancel={() => setAddingKind(null)}
                          onSave={handleCreateLog}
                        />
                      ) : (
                        <button
                          onClick={() => {
                            setEditingLogId(null);
                            setAddingKind(kind);
                          }}
                          className="text-[11px] font-semibold text-primary bg-transparent border border-primary rounded px-2 py-1 cursor-pointer hover:bg-primary hover:text-white"
                        >
                          + Add
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {hasPrivate && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-amber-700">🔒</span>
                <div className="text-[10px] uppercase tracking-wider text-amber-800 font-semibold">
                  My personal notes (private to me)
                </div>
              </div>
              <div className="text-xs text-text whitespace-pre-wrap">
                {record.managerPersonalNotes}
              </div>
            </div>
          )}

          {hasPrivateNote && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-amber-700">🔒</span>
                <div className="text-[10px] uppercase tracking-wider text-amber-800 font-semibold">
                  Private note (author only)
                </div>
              </div>
              <div className="text-xs text-text whitespace-pre-wrap">
                {record.privateNote}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
