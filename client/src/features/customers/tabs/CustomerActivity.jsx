import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { api } from '../../../lib/api';
import { useData } from '../../../contexts/DataContext';
import LogCard from '../../people/tabs/activity/LogCard';

const KIND_OPTIONS = [
  { value: '', label: 'All kinds' },
  { value: 'good', label: 'Good' },
  { value: 'bad', label: 'Bad' },
  { value: 'incident', label: 'Incident' },
  { value: 'observation', label: 'Observation' },
  { value: 'win', label: 'Win' },
  { value: 'down', label: 'Down' },
  { value: 'blocker', label: 'Blocker' },
];

export default function CustomerActivity() {
  const { customer } = useOutletContext();
  const { projects, resources } = useData();
  const navigate = useNavigate();

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState('');
  const [projectId, setProjectId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const custProjects = useMemo(
    () => projects.filter((p) => p.customerId === customer.id),
    [customer.id, projects]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = {};
    if (kind) params.kind = kind;
    if (projectId) params.projectId = projectId;
    if (from) params.from = from;
    if (to) params.to = to;
    api
      .getCustomerActivity(customer.id, params)
      .then((data) => {
        if (cancelled) return;
        setLogs(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (cancelled) return;
        setLogs([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customer.id, kind, projectId, from, to]);

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-border shadow-card p-3 flex items-center gap-2 flex-wrap">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="px-2 py-1 border border-border rounded-lg text-xs text-text outline-none focus:border-primary"
        >
          {KIND_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="px-2 py-1 border border-border rounded-lg text-xs text-text outline-none focus:border-primary"
        >
          <option value="">All projects</option>
          {custProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="px-2 py-1 border border-border rounded-lg text-xs text-text outline-none focus:border-primary"
        />
        <span className="text-text-light text-xs">→</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="px-2 py-1 border border-border rounded-lg text-xs text-text outline-none focus:border-primary"
        />
      </div>

      {loading ? (
        <div className="text-center text-sm text-text-light py-8">Loading…</div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-xl border border-border shadow-card p-8 text-center text-sm text-text-light">
          No activity matches these filters.
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const person = resources.find((r) => r.id === log.resourceId);
            return (
              <div key={log.id}>
                {person && (
                  <div className="text-[11px] text-text-light mb-1">
                    on{' '}
                    <button
                      onClick={() => navigate(`/people/${person.id}`)}
                      className="font-semibold text-primary bg-transparent border-0 cursor-pointer hover:underline p-0"
                    >
                      {person.name}
                    </button>
                  </div>
                )}
                <LogCard log={log} resourceId={log.resourceId} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
