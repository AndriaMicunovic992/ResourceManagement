import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';
import { useData } from '../../../contexts/DataContext';
import { useVisibility } from '../../../contexts/VisibilityContext';
import Avatar from '../../../components/ui/Avatar';
import { resourcePrimaryDomain, domainColor } from '../../../lib/resourceUtils';
import MiniThread, { ReplyToggle } from '../../../components/ui/MiniThread';
import SignalChart from '../../../components/ui/SignalChart';
import { LockIcon } from '../../../components/ui/icons';
import {
  LOG_KIND_COLORS,
  LOG_KIND_LABELS,
} from '../../../lib/constants';

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

function nextMonthKey() {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 7);
}

function lastMonthKeys(n) {
  const keys = [];
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - (n - 1));
  for (let i = 0; i < n; i++) {
    keys.push(d.toISOString().slice(0, 7));
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return keys;
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function toDateInput(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function Panel({ title, children, action }) {
  return (
    <div className="bg-white rounded-2xl border border-border-light shadow-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-bold text-text m-0">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function RatingPicker({ label, value, onChange }) {
  return (
    <div>
      <div className="text-[10px] font-semibold text-text-mid mb-1 uppercase tracking-wider">
        {label}
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(value === n ? null : n)}
            title={value === n ? 'Click again to clear' : `Set ${n}/5`}
            className={`w-8 h-8 rounded-lg border text-xs font-bold cursor-pointer ${
              value === n
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-text-mid border-border hover:border-primary'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The meeting record itself: pulse, satisfaction, summaries, private note. */
function MeetingPanel({ personId, record, onSaved }) {
  const [meetingDate, setMeetingDate] = useState(toDateInput(record.meetingDate));
  const [overallScore, setOverallScore] = useState(record.overallScore ?? null);
  const [wentWell, setWentWell] = useState(record.wentWell || '');
  const [wentBad, setWentBad] = useState(record.wentBad || '');
  const [privateNote, setPrivateNote] = useState(record.privateNote || '');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const updated = await api.updateOneOnOne(personId, record.id, {
        meetingDate,
        overallScore,
        wentWell: wentWell.trim() ? wentWell : null,
        wentBad: wentBad.trim() ? wentBad : null,
        privateNote: privateNote.trim() ? privateNote : null,
      });
      onSaved(updated);
      setSavedAt(new Date());
    } catch (err) {
      setError(err.message || 'Failed to save');
    }
    setSaving(false);
  };

  return (
    <Panel
      title="This 1:1"
      action={
        <div className="flex items-center gap-2">
          {savedAt && !saving && (
            <span className="text-[10px] text-success font-semibold">Saved ✓</span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-xs font-bold text-white bg-primary border-0 rounded-lg px-3 py-1.5 cursor-pointer hover:brightness-105 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      }
    >
      {error && <div className="text-xs text-danger bg-danger-bg p-2 rounded mb-3">{error}</div>}
      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-[10px] font-semibold text-text-mid mb-1 uppercase tracking-wider">
            Meeting date
          </div>
          <input
            type="date"
            value={meetingDate}
            onChange={(e) => setMeetingDate(e.target.value)}
            className="px-2 py-1.5 border border-border-light rounded-lg text-xs text-text outline-none focus:border-primary bg-white"
          />
        </div>
        <RatingPicker label="Overall score (pulse)" value={overallScore} onChange={setOverallScore} />
      </div>
      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        <div>
          <div className="text-[10px] font-semibold text-text-mid mb-1 uppercase tracking-wider">
            What went well
          </div>
          <textarea
            value={wentWell}
            onChange={(e) => setWentWell(e.target.value)}
            rows={4}
            maxLength={10000}
            className="w-full px-2 py-1.5 border border-border-light rounded-lg text-xs text-text outline-none focus:border-primary bg-white resize-y"
          />
        </div>
        <div>
          <div className="text-[10px] font-semibold text-text-mid mb-1 uppercase tracking-wider">
            What went bad
          </div>
          <textarea
            value={wentBad}
            onChange={(e) => setWentBad(e.target.value)}
            rows={4}
            maxLength={10000}
            className="w-full px-2 py-1.5 border border-border-light rounded-lg text-xs text-text outline-none focus:border-primary bg-white resize-y"
          />
        </div>
      </div>
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-amber-800 font-semibold mb-1">
          <LockIcon size={12} /> Private note (only you)
        </div>
        <textarea
          value={privateNote}
          onChange={(e) => setPrivateNote(e.target.value)}
          rows={2}
          maxLength={5000}
          className="w-full px-2 py-1.5 border border-amber-300 rounded text-xs text-text outline-none focus:border-amber-500 bg-white resize-y"
        />
      </div>
    </Panel>
  );
}

/** One box per active project — saved as project_checkin entries on this 1:1. */
function ProjectCheckins({ personId, oneOnOneId, activeProjects, checkins, onChanged }) {
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState({});
  const [errors, setErrors] = useState({});

  const existingFor = (projectId) => checkins.find((l) => l.projectId === projectId);

  const handleSave = async (project) => {
    const existing = existingFor(project.id);
    const text = (drafts[project.id] ?? existing?.content ?? '').trim();
    if (!text) return;
    setBusy((b) => ({ ...b, [project.id]: true }));
    setErrors((e) => ({ ...e, [project.id]: '' }));
    try {
      if (existing) {
        const updated = await api.updateLog(personId, existing.id, { content: text });
        onChanged((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      } else {
        const created = await api.createLog(personId, {
          content: text,
          kind: 'project_checkin',
          projectId: project.id,
          customerId: project.customerId || null,
          oneOnOneId,
        });
        onChanged((prev) => [...prev, created]);
      }
    } catch (err) {
      setErrors((e) => ({ ...e, [project.id]: err.message || 'Failed to save' }));
    }
    setBusy((b) => ({ ...b, [project.id]: false }));
  };

  if (activeProjects.length === 0) {
    return (
      <Panel title="Project check-ins">
        <div className="text-xs text-text-light">No active project assignments.</div>
      </Panel>
    );
  }

  return (
    <Panel title="Project check-ins">
      <div className="space-y-3">
        {activeProjects.map(({ project, customer, fte }) => {
          const existing = existingFor(project.id);
          const value = drafts[project.id] ?? existing?.content ?? '';
          const dirty = (drafts[project.id] ?? null) !== null && drafts[project.id] !== (existing?.content ?? '');
          return (
            <div key={project.id} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-xs font-semibold text-text">
                  {project.name}
                  <span className="text-text-light font-normal">
                    {' '}· {customer?.name || '—'} {fte ? `· ${fte.toFixed(1)} FTE` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {existing && !dirty && (
                    <span className="text-[10px] text-success font-semibold">Filled ✓</span>
                  )}
                  <button
                    onClick={() => handleSave({ ...project })}
                    disabled={busy[project.id] || !value.trim() || (!dirty && !!existing)}
                    className="text-[11px] font-bold text-white bg-primary border-0 rounded-lg px-2.5 py-1 cursor-pointer hover:brightness-105 disabled:opacity-40"
                  >
                    {busy[project.id] ? '…' : existing ? 'Update' : 'Save'}
                  </button>
                </div>
              </div>
              <textarea
                value={value}
                onChange={(e) => setDrafts((d) => ({ ...d, [project.id]: e.target.value }))}
                rows={2}
                maxLength={5000}
                placeholder="How is it going on this project?"
                className="w-full px-2 py-1.5 border border-border-light rounded-lg text-xs text-text outline-none focus:border-primary bg-white resize-y"
              />
              {errors[project.id] && (
                <div className="text-[10px] text-danger mt-1">{errors[project.id]}</div>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/** Open action items; resolvable into this 1:1. */
function FollowUpsPanel({ personId, oneOnOneId, followUps, setFollowUps }) {
  const [newContent, setNewContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const open = followUps.filter((f) => f.status === 'open');
  const resolvedHere = followUps.filter(
    (f) => f.status === 'resolved' && f.resolvedInOneOnOneId === oneOnOneId
  );

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newContent.trim()) return;
    setBusy(true);
    setError('');
    try {
      const created = await api.createFollowUp(personId, {
        content: newContent.trim(),
        oneOnOneId,
      });
      setFollowUps((prev) => [created, ...prev]);
      setNewContent('');
    } catch (err) {
      setError(err.message || 'Failed to add follow-up');
    }
    setBusy(false);
  };

  const handleResolve = async (id) => {
    try {
      const updated = await api.updateFollowUp(personId, id, {
        status: 'resolved',
        resolvedInOneOnOneId: oneOnOneId,
      });
      setFollowUps((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    } catch (err) {
      setError(err.message || 'Failed to resolve');
    }
  };

  const handleReopen = async (id) => {
    try {
      const updated = await api.updateFollowUp(personId, id, { status: 'open' });
      setFollowUps((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    } catch (err) {
      setError(err.message || 'Failed to reopen');
    }
  };

  return (
    <Panel title={`Follow-ups (${open.length} open)`}>
      {error && <div className="text-xs text-danger bg-danger-bg p-2 rounded mb-2">{error}</div>}
      <div className="space-y-1.5 mb-3">
        {open.length === 0 && resolvedHere.length === 0 && (
          <div className="text-xs text-text-light">Nothing open. 🎉</div>
        )}
        {open.map((f) => (
          <div key={f.id} className="flex items-start gap-2 py-1">
            <button
              onClick={() => handleResolve(f.id)}
              title="Mark resolved in this 1:1"
              className="mt-0.5 w-4 h-4 rounded border border-border bg-white cursor-pointer hover:border-success shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="text-xs text-text">{f.content}</div>
              <div className="text-[10px] text-text-light">
                {formatDate(f.createdAt)}
                {f.oneOnOne ? ` · from 1:1 on ${formatDate(f.oneOnOne.meetingDate)}` : ''}
              </div>
            </div>
          </div>
        ))}
        {resolvedHere.map((f) => (
          <div key={f.id} className="flex items-start gap-2 py-1 opacity-60">
            <span className="mt-0.5 w-4 h-4 rounded bg-success text-white text-[10px] font-bold flex items-center justify-center shrink-0">
              ✓
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-text line-through">{f.content}</div>
            </div>
            <button
              onClick={() => handleReopen(f.id)}
              className="text-[10px] text-text-light bg-transparent border-0 cursor-pointer hover:text-primary"
            >
              Reopen
            </button>
          </div>
        ))}
      </div>
      <form onSubmit={handleAdd} className="flex items-center gap-2">
        <input
          type="text"
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder="New follow-up…"
          maxLength={2000}
          className="flex-1 px-2 py-1.5 border border-border-light rounded-lg text-xs text-text outline-none focus:border-primary bg-white"
        />
        <button
          type="submit"
          disabled={busy || !newContent.trim()}
          className="text-[11px] font-bold text-white bg-primary border-0 rounded-lg px-3 py-1.5 cursor-pointer hover:brightness-105 disabled:opacity-40"
        >
          Add
        </button>
      </form>
    </Panel>
  );
}

const GOAL_STATUS_COLORS = {
  active: 'bg-primary-light text-primary',
  achieved: 'bg-success-bg text-success',
  dropped: 'bg-gray-100 text-gray-500',
};

/** Career thread spanning all 1:1s. */
function CareerPanel({ personId, oneOnOneId, entries, setEntries }) {
  const [newContent, setNewContent] = useState('');
  const [asGoal, setAsGoal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newContent.trim()) return;
    setBusy(true);
    setError('');
    try {
      const created = await api.createCareerEntry(personId, {
        content: newContent.trim(),
        kind: asGoal ? 'goal' : 'note',
        oneOnOneId,
      });
      setEntries((prev) => [created, ...prev]);
      setNewContent('');
      setAsGoal(false);
    } catch (err) {
      setError(err.message || 'Failed to add entry');
    }
    setBusy(false);
  };

  const handleGoalStatus = async (id, goalStatus) => {
    try {
      const updated = await api.updateCareerEntry(personId, id, { goalStatus });
      setEntries((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch (err) {
      setError(err.message || 'Failed to update goal');
    }
  };

  return (
    <Panel title="Career">
      {error && <div className="text-xs text-danger bg-danger-bg p-2 rounded mb-2">{error}</div>}
      <div className="space-y-2 mb-3 max-h-64 overflow-y-auto">
        {entries.length === 0 && (
          <div className="text-xs text-text-light">No career entries yet.</div>
        )}
        {entries.map((c) => (
          <div key={c.id} className="rounded-lg border border-border-light p-2">
            <div className="flex items-center gap-1.5 mb-0.5">
              {c.kind === 'goal' ? (
                <select
                  value={c.goalStatus || 'active'}
                  onChange={(e) => handleGoalStatus(c.id, e.target.value)}
                  className={`text-[10px] font-semibold rounded px-1 py-0.5 border-0 cursor-pointer ${
                    GOAL_STATUS_COLORS[c.goalStatus || 'active']
                  }`}
                >
                  <option value="active">Goal · active</option>
                  <option value="achieved">Goal · achieved</option>
                  <option value="dropped">Goal · dropped</option>
                </select>
              ) : (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 uppercase">
                  Note
                </span>
              )}
              <span className="text-[10px] text-text-light">{formatDate(c.createdAt)}</span>
            </div>
            <div className="text-xs text-text whitespace-pre-wrap">{c.content}</div>
          </div>
        ))}
      </div>
      <form onSubmit={handleAdd} className="space-y-1.5">
        <textarea
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          rows={2}
          maxLength={5000}
          placeholder="Career note or goal…"
          className="w-full px-2 py-1.5 border border-border-light rounded-lg text-xs text-text outline-none focus:border-primary bg-white resize-y"
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-[11px] text-text-mid cursor-pointer">
            <input type="checkbox" checked={asGoal} onChange={(e) => setAsGoal(e.target.checked)} />
            Track as goal
          </label>
          <button
            type="submit"
            disabled={busy || !newContent.trim()}
            className="text-[11px] font-bold text-white bg-primary border-0 rounded-lg px-3 py-1.5 cursor-pointer hover:brightness-105 disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </form>
    </Panel>
  );
}

export default function OneOnOneCockpit() {
  const { personId, oneOnOneId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { resources, projects, customers, needs, assignments, skills } = useData();
  const visibility = useVisibility();

  const person = resources.find((r) => r.id === personId);

  const [record, setRecord] = useState(null);
  const [allOneOnOnes, setAllOneOnOnes] = useState([]);
  const [attachedLogs, setAttachedLogs] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [careerEntries, setCareerEntries] = useState([]);
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // The cockpit is a manager/admin tool — subjects use their profile tabs.
  const isSelf = !visibility.loading && visibility.selfResourceId === personId && !visibility.isAdmin;

  useEffect(() => {
    if (isSelf) navigate(`/people/${personId}`, { replace: true });
  }, [isSelf, navigate, personId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([
      api.getOneOnOne(personId, oneOnOneId),
      api.listOneOnOnes(personId),
      api.listLogs(personId, { oneOnOneId }),
      api.listFollowUps(personId),
      api.listCareerEntries(personId),
      api.getPersonSignals(personId).catch(() => []),
    ])
      .then(([rec, all, attached, fups, career, sigs]) => {
        if (cancelled) return;
        setRecord(rec);
        setAllOneOnOnes(Array.isArray(all) ? all : []);
        setAttachedLogs(Array.isArray(attached) ? attached : []);
        setFollowUps(Array.isArray(fups) ? fups : []);
        setCareerEntries(Array.isArray(career) ? career : []);
        setSignals(Array.isArray(sigs) ? sigs : []);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Failed to load 1:1');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [personId, oneOnOneId]);

  // Previous meeting before this one → "entries since last 1:1" window.
  const previousMeetingDate = useMemo(() => {
    if (!record) return null;
    const before = allOneOnOnes
      .filter((o) => o.id !== record.id && new Date(o.meetingDate) < new Date(record.meetingDate))
      .sort((a, b) => new Date(b.meetingDate) - new Date(a.meetingDate));
    return before[0]?.meetingDate ?? null;
  }, [record, allOneOnOnes]);

  useEffect(() => {
    if (!record) return;
    let cancelled = false;
    const params = previousMeetingDate
      ? { from: toDateInput(previousMeetingDate) }
      : { limit: 30 };
    api
      .listLogs(personId, params)
      .then((data) => {
        if (!cancelled) setRecentLogs(Array.isArray(data) ? data : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [record, previousMeetingDate, personId]);

  // Projects with any allocation in the current or a future month, with this
  // month's and next month's planned FTE.
  const activeProjects = useMemo(() => {
    const nowKey = currentMonthKey();
    const nextKey = nextMonthKey();
    const byProject = new Map();
    for (const a of assignments) {
      if (a.resourceId !== personId) continue;
      const need = needs.find((n) => n.id === a.needId);
      if (!need) continue;
      const project = projects.find((p) => p.id === need.projectId);
      if (!project) continue;
      const alloc = a.monthAllocations || {};
      const months = Object.keys(alloc).filter((m) => m >= nowKey && alloc[m] > 0);
      if (months.length === 0) continue;
      const prev = byProject.get(project.id) || {
        project,
        customer: customers.find((c) => c.id === project.customerId),
        fte: 0,
        fteNext: 0,
      };
      prev.fte += alloc[nowKey] || 0;
      prev.fteNext += alloc[nextKey] || 0;
      byProject.set(project.id, prev);
    }
    return Array.from(byProject.values());
  }, [assignments, needs, projects, customers, personId]);

  const checkins = attachedLogs.filter((l) => l.kind === 'project_checkin');

  const personSkills = useMemo(() => {
    const list = person?.personSkills || [];
    return list
      .map((ps) => ({ ...ps, skill: skills.find((s) => s.id === ps.skillId) }))
      .filter((ps) => ps.skill);
  }, [person, skills]);

  // "Since last 1:1" entries grouped per customer, each group collapsible.
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());
  const [openReplies, setOpenReplies] = useState(() => new Set());
  const toggleReply = (id) =>
    setOpenReplies((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const recentGroups = useMemo(() => {
    const map = new Map();
    for (const log of recentLogs) {
      const key = log.customer?.name || 'No customer';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(log);
    }
    return Array.from(map.entries());
  }, [recentLogs]);

  const signalsByCustomer = useMemo(() => {
    const map = new Map();
    for (const s of signals) {
      const key = s.customer?.name || s.customerId;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    }
    for (const list of map.values()) list.sort((a, b) => (a.month < b.month ? -1 : 1));
    return Array.from(map.entries());
  }, [signals]);

  if (loading || visibility.loading) {
    return (
      <div className="max-w-[1200px] mx-auto px-5 py-10 text-center text-xs text-text-light">
        Loading cockpit…
      </div>
    );
  }
  if (error || !record) {
    return (
      <div className="max-w-[1200px] mx-auto px-5 py-10">
        <div className="text-xs text-danger bg-danger-bg p-3 rounded">
          {error || '1:1 not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-5 py-5">
      {/* Header — entity profile-card language */}
      <div
        className="flex items-center gap-4 border border-border-light rounded-[18px] p-[18px] mb-4 flex-wrap"
        style={{ background: 'linear-gradient(120deg, #F4FBFD, #fff)' }}
      >
        <Avatar
          name={person?.name || '?'}
          color={person ? domainColor(resourcePrimaryDomain(person)) : '#4CBAD4'}
          size={48}
          className="shadow-lg"
        />
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold tracking-tight text-text m-0 truncate">
            1:1 — {person?.name || 'Unknown'}
          </h2>
          <div className="flex flex-wrap gap-1.5 mt-1.5 items-center">
            <span className="text-[9.5px] font-mono font-semibold text-primary bg-primary-light rounded-[7px] px-2 py-0.5">
              {formatDate(record.meetingDate)}
            </span>
            <span className="text-[9.5px] font-mono font-semibold text-text-mid bg-[#EEF1F5] rounded-[7px] px-2 py-0.5">
              {previousMeetingDate ? `previous · ${formatDate(previousMeetingDate)}` : 'first recorded 1:1'}
            </span>
          </div>
        </div>
        <Link
          to={`/people/${personId}/oneonones`}
          className="ml-auto rounded-[11px] font-bold text-[11.5px] px-3.5 py-2.5 no-underline bg-white text-text-mid border border-border-light hover:bg-primary-bg"
        >
          ← All 1:1s
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-4">
          <MeetingPanel personId={personId} record={record} onSaved={setRecord} />
          <ProjectCheckins
            personId={personId}
            oneOnOneId={oneOnOneId}
            activeProjects={activeProjects}
            checkins={checkins}
            onChanged={setAttachedLogs}
          />
          <FollowUpsPanel
            personId={personId}
            oneOnOneId={oneOnOneId}
            followUps={followUps}
            setFollowUps={setFollowUps}
          />
          <CareerPanel
            personId={personId}
            oneOnOneId={oneOnOneId}
            entries={careerEntries}
            setEntries={setCareerEntries}
          />
        </div>

        {/* Context column — one unified sticky card (like the customer review). */}
        <div className="lg:sticky lg:top-4 self-start bg-white rounded-2xl border border-border-light shadow-card p-4">
          <h3 className="text-[13px] font-bold text-text m-0 mb-2">
            {previousMeetingDate ? 'Since the last 1:1' : 'Recent entries'}
          </h3>
          <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1 -mr-1">
              {recentLogs.length === 0 && (
                <div className="text-xs text-text-light">No entries in this window.</div>
              )}
              {recentGroups.map(([groupName, list]) => {
                const collapsed = collapsedGroups.has(groupName);
                return (
                  <div key={groupName}>
                    <button
                      onClick={() =>
                        setCollapsedGroups((prev) => {
                          const next = new Set(prev);
                          if (next.has(groupName)) next.delete(groupName);
                          else next.add(groupName);
                          return next;
                        })
                      }
                      className="w-full flex items-center justify-between text-[11px] font-bold text-text bg-transparent border-0 cursor-pointer px-0 py-1"
                    >
                      <span>{collapsed ? '▸' : '▾'} {groupName}</span>
                      <span className="text-text-light font-normal">{list.length}</span>
                    </button>
                    {!collapsed &&
                      list.map((log) => (
                        <div key={log.id} className="rounded-lg border border-border-light p-2 mb-1.5">
                          <div className="flex items-start gap-1.5 mb-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                              <span
                                className={`text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase ${
                                  LOG_KIND_COLORS[log.kind] || LOG_KIND_COLORS.note
                                }`}
                              >
                                {LOG_KIND_LABELS[log.kind] || log.kind}
                              </span>
                              {(log.categories || []).map((c) => (
                                <span
                                  key={c.id}
                                  className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-primary-light text-primary"
                                >
                                  {c.name}
                                </span>
                              ))}
                            </div>
                            <ReplyToggle open={openReplies.has(log.id)} onClick={() => toggleReply(log.id)} />
                          </div>
                          <div className="text-xs text-text whitespace-pre-wrap">{log.content}</div>
                          <div className="text-[10px] text-text-light mt-0.5">
                            {log.authorUser?.name || '—'} · {formatDate(log.createdAt)}
                          </div>
                          <MiniThread
                            personId={personId}
                            log={log}
                            open={openReplies.has(log.id)}
                            onToggle={() => toggleReply(log.id)}
                            onUpdated={(updated) =>
                              setRecentLogs((prev) =>
                                prev.map((l) => (l.id === updated.id ? updated : l))
                              )
                            }
                          />
                        </div>
                      ))}
                  </div>
                );
              })}
            </div>

          {signalsByCustomer.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border-light">
              <h3 className="text-[13px] font-bold text-text m-0 mb-2">Client signals (PM-perceived)</h3>
              <div className="space-y-3">
                {signalsByCustomer.map(([customerName, list]) => {
                  const byMonth = new Map(list.map((s) => [s.month, s.rating]));
                  const points = lastMonthKeys(12).map((m) => ({
                    label: m.slice(5),
                    value: byMonth.get(m) ?? null,
                  }));
                  return (
                    <div key={customerName}>
                      <div className="text-[11px] font-semibold text-text mb-1">{customerName}</div>
                      <SignalChart points={points} height={84} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-border-light">
            <h3 className="text-[13px] font-bold text-text m-0 mb-2">Planned allocation</h3>
            {activeProjects.length === 0 ? (
              <div className="text-xs text-text-light">No active assignments.</div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] text-text-mid uppercase tracking-wider">
                    <th className="text-left font-semibold pb-1">Project</th>
                    <th className="text-right font-semibold pb-1">This mo</th>
                    <th className="text-right font-semibold pb-1">Next mo</th>
                  </tr>
                </thead>
                <tbody>
                  {activeProjects.map(({ project, customer, fte, fteNext }) => (
                    <tr key={project.id} className="border-t border-border-light">
                      <td className="py-1 text-text truncate max-w-[160px]">
                        {project.name}
                        <span className="text-text-light"> · {customer?.name || '—'}</span>
                      </td>
                      <td className="py-1 font-mono text-right text-text-mid">
                        {fte > 0 ? fte.toFixed(1) : '—'}
                      </td>
                      <td className="py-1 font-mono text-right text-text-mid">
                        {fteNext > 0 ? fteNext.toFixed(1) : '—'}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-border">
                    <td className="py-1 font-bold text-text">Total</td>
                    <td className="py-1 font-mono text-right font-bold text-text">
                      {activeProjects.reduce((s, p) => s + p.fte, 0).toFixed(1)}
                    </td>
                    <td className="py-1 font-mono text-right font-bold text-text">
                      {activeProjects.reduce((s, p) => s + p.fteNext, 0).toFixed(1)}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-border-light">
            <h3 className="text-[13px] font-bold text-text m-0 mb-2">Skills</h3>
            {personSkills.length === 0 ? (
              <div className="text-xs text-text-light">No skills recorded.</div>
            ) : (
              <div className="flex gap-1.5 flex-wrap">
                {personSkills.map((ps) => (
                  <span
                    key={ps.id}
                    className="text-[10px] font-semibold px-2 py-1 rounded-full bg-primary-light text-primary"
                  >
                    {ps.skill.name} · {ps.level}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
