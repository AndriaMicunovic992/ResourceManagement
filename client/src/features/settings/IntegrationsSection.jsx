import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Button from '../../components/ui/Button';
import { api } from '../../lib/api';
import { useData } from '../../contexts/DataContext';

const inputCls = 'px-2 py-1.5 border border-border rounded-lg text-xs text-text outline-none focus:border-primary bg-white';

// A dropdown you can tick multiple Jira items in. Jira projects are expandable
// to reveal their epics (nested by parentId). Items already mapped to another
// customer/project show their owner and are locked to avoid moving them.
function JiraMultiSelect({ items, selectedIds, onToggle, ownerName }) {
  const [open, setOpen] = useState(false);
  const [openProjects, setOpenProjects] = useState(() => new Set());
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const projects = items.filter((i) => i.kind === 'project');
  const projectIds = new Set(projects.map((p) => p.id));
  const epicsByParent = {};
  for (const e of items.filter((i) => i.kind === 'epic')) {
    const k = e.parentId && projectIds.has(e.parentId) ? e.parentId : '__loose__';
    (epicsByParent[k] = epicsByParent[k] || []).push(e);
  }
  const looseEpics = epicsByParent.__loose__ || [];
  const others = items.filter((i) => i.kind !== 'project' && i.kind !== 'epic');

  const selected = items.filter((i) => selectedIds.has(i.id));
  const summary = selected.length ? selected.map((i) => i.externalKey).join(', ') : 'Select Jira…';
  const toggleProject = (id) => setOpenProjects((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const checkRow = (item, indent = 0) => {
    const checked = selectedIds.has(item.id);
    const owner = ownerName(item);
    const locked = owner && !checked;
    return (
      <label className={`flex items-center gap-2 py-1 pr-2 rounded ${locked ? 'opacity-60' : 'hover:bg-primary-bg/40 cursor-pointer'}`} style={{ paddingLeft: 8 + indent }}>
        <input type="checkbox" checked={checked} disabled={locked} onChange={() => onToggle(item, !checked)} />
        <span className="font-mono text-[10px] text-text-mid shrink-0">{item.externalKey}</span>
        <span className="text-[11px] text-text truncate">{item.name}</span>
        {locked && <span className="text-[9px] text-text-light ml-auto shrink-0 whitespace-nowrap">→ {owner}</span>}
      </label>
    );
  };

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-2 py-1.5 border border-border rounded-lg text-xs bg-white hover:border-primary">
        <span className={`truncate ${selected.length ? 'text-text font-medium' : 'text-text-light'}`}>{summary}</span>
        <span className="text-text-light text-[9px] shrink-0">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-[300px] max-h-72 overflow-auto bg-white border border-border rounded-lg shadow-xl p-1">
          {items.length === 0 && <div className="px-2 py-2 text-[11px] text-text-light">No Jira items — Refresh from Jira first.</div>}
          {projects.map((p) => {
            const epics = epicsByParent[p.id] || [];
            const pOpen = openProjects.has(p.id);
            return (
              <div key={p.id}>
                <div className="flex items-stretch">
                  {epics.length > 0 ? (
                    <button type="button" onClick={() => toggleProject(p.id)} title={pOpen ? 'Collapse' : 'Expand epics'}
                      className="w-5 shrink-0 text-text-light hover:text-primary text-[10px] bg-transparent border-0 cursor-pointer">{pOpen ? '▾' : '▸'}</button>
                  ) : <span className="w-5 shrink-0" />}
                  <div className="flex-1 min-w-0">{checkRow(p)}</div>
                </div>
                {pOpen && epics.map((e) => <div key={e.id}>{checkRow(e, 22)}</div>)}
              </div>
            );
          })}
          {looseEpics.length > 0 && (
            <div>
              <div className="px-2 pt-1.5 pb-0.5 text-[9px] font-bold uppercase tracking-wide text-text-light">Epics</div>
              {looseEpics.map((e) => <div key={e.id}>{checkRow(e)}</div>)}
            </div>
          )}
          {others.map((e) => <div key={e.id}>{checkRow(e)}</div>)}
        </div>
      )}
    </div>
  );
}

export default function IntegrationsSection() {
  const { resources, customers, projects, updateResource } = useData();
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const run = (fn) => async (...a) => { setError(''); try { await fn(...a); return true; } catch (e) { setError(e.message || 'Something went wrong'); return false; } };

  // ---- connection ----
  const [conn, setConn] = useState(null);
  const [form, setForm] = useState({ baseUrl: '', jiraEmail: '', enabled: false });
  const [jiraToken, setJiraToken] = useState('');
  const [tempoToken, setTempoToken] = useState('');
  const [busy, setBusy] = useState('');
  const loadConn = useCallback(async () => {
    const c = await api.getJiraConnection().catch(() => null);
    if (c) { setConn(c); setForm({ baseUrl: c.baseUrl || '', jiraEmail: c.jiraEmail || '', enabled: !!c.enabled }); }
  }, []);

  // ---- pulled reference data + mappings ----
  const [accounts, setAccounts] = useState([]);
  const [items, setItems] = useState([]);
  const [members, setMembers] = useState([]);
  const loadRefs = useCallback(async () => {
    setAccounts(await api.getJiraAccounts().catch(() => []));
    setItems(await api.getJiraWorkItems().catch(() => []));
  }, []);

  useEffect(() => {
    loadConn();
    loadRefs();
    api.getMembers().then(setMembers).catch(() => setMembers([]));
  }, [loadConn, loadRefs]);

  const persist = async () => {
    await api.saveJiraConnection({
      baseUrl: form.baseUrl || null, jiraEmail: form.jiraEmail || null, enabled: form.enabled,
      ...(jiraToken.trim() ? { jiraApiToken: jiraToken.trim() } : {}),
      ...(tempoToken.trim() ? { tempoApiToken: tempoToken.trim() } : {}),
    });
    setJiraToken(''); setTempoToken('');
    await loadConn();
  };
  const saveConn = () => run(async () => { await persist(); setStatus('Connection saved.'); })();
  const testConn = () => run(async () => {
    setBusy('test'); setStatus('');
    try { await persist(); const r = await api.testJiraConnection(); setStatus(`Connected to Jira as ${r.user?.displayName || 'user'}.`); }
    finally { setBusy(''); }
  })();
  const refresh = () => run(async () => {
    setBusy('refresh'); setStatus('');
    try {
      await persist();
      const c = await api.refreshJira();
      setStatus(`Pulled ${c.projects} projects, ${c.epics} epics, ${c.accounts} accounts from Jira.`);
      await loadRefs();
    } finally { setBusy(''); }
  })();

  // ---- people mapping ----
  const accountOptions = (current) => {
    const opts = accounts.map((a) => ({ value: a.accountId, label: a.email ? `${a.displayName} (${a.email})` : a.displayName }));
    if (current && !opts.some((o) => o.value === current)) opts.unshift({ value: current, label: `${current} (unknown)` });
    return opts;
  };

  // ---- customer/project mapping (our hierarchy → many Jira items) ----
  const projectsByCustomer = useMemo(() => {
    const m = {};
    for (const p of projects) (m[p.customerId] = m[p.customerId] || []).push(p);
    return m;
  }, [projects]);
  const itemsForCustomer = (cId) => items.filter((i) => i.customerId === cId);
  const itemsForProject = (pId) => items.filter((i) => i.projectId === pId);
  // The entity a Jira item is currently mapped to (for the "→ owner" lock).
  const custName = useMemo(() => new Map(customers.map((c) => [c.id, c.name])), [customers]);
  const projName = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);
  const ownerName = (i) => (i.customerId ? custName.get(i.customerId) || 'a customer' : i.projectId ? projName.get(i.projectId) || 'a project' : null);
  const assign = (workItemId, target) => run(async () => {
    await api.updateJiraWorkItem(workItemId, { customerId: target.customerId ?? null, projectId: target.projectId ?? null });
    await loadRefs();
  })();
  const unassign = (workItemId) => run(async () => {
    await api.updateJiraWorkItem(workItemId, { customerId: null, projectId: null });
    await loadRefs();
  })();

  const [expanded, setExpanded] = useState(() => new Set());
  const toggle = (id) => setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const COLS = 'grid grid-cols-[1fr_280px] gap-3';

  return (
    <div id="integrations" className="scroll-mt-4">
      {error && <div className="text-xs text-danger bg-danger-bg p-2 rounded mb-3">{error}</div>}
      {status && !error && <div className="text-xs text-success bg-success-bg p-2 rounded mb-3">{status}</div>}

      {/* Connection */}
      <div className="bg-white rounded-2xl border border-border-light shadow-card p-5 mb-4">
        <h3 className="text-sm font-bold text-text mb-1">Jira / Tempo connection</h3>
        <p className="text-[10px] text-text-light mb-3">
          Credentials for the actual-hours source. API tokens are encrypted at rest and never shown again — leave a token field blank to keep the stored one. Jira (email + token) powers the mapping dropdowns; Tempo powers the hours.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[10px] font-semibold text-text-mid mb-1">Jira base URL</span>
            <input value={form.baseUrl} onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))} placeholder="https://acme.atlassian.net" className={`w-full ${inputCls}`} />
          </label>
          <label className="block">
            <span className="block text-[10px] font-semibold text-text-mid mb-1">Jira account email</span>
            <input value={form.jiraEmail} onChange={(e) => setForm((f) => ({ ...f, jiraEmail: e.target.value }))} placeholder="ops@acme.io" className={`w-full ${inputCls}`} />
          </label>
          <label className="block">
            <span className="block text-[10px] font-semibold text-text-mid mb-1">Jira API token {conn?.jiraApiTokenSet && <span className="text-success">· set</span>}</span>
            <input type="password" value={jiraToken} onChange={(e) => setJiraToken(e.target.value)} autoComplete="new-password" placeholder={conn?.jiraApiTokenSet ? '•••••••••• (leave blank to keep)' : 'Paste token'} className={`w-full ${inputCls} font-mono`} />
          </label>
          <label className="block">
            <span className="block text-[10px] font-semibold text-text-mid mb-1">Tempo API token {conn?.tempoApiTokenSet && <span className="text-success">· set</span>}</span>
            <input type="password" value={tempoToken} onChange={(e) => setTempoToken(e.target.value)} autoComplete="new-password" placeholder={conn?.tempoApiTokenSet ? '•••••••••• (leave blank to keep)' : 'Paste token'} className={`w-full ${inputCls} font-mono`} />
          </label>
        </div>
        <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
          <label className="flex items-center gap-2 text-xs text-text-mid cursor-pointer">
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} /> Enabled
          </label>
          <div className="flex gap-2">
            <button onClick={testConn} disabled={!!busy} className="text-[11px] font-semibold text-text-mid bg-white border border-border-light rounded-lg px-2.5 py-1 cursor-pointer hover:bg-primary-bg disabled:opacity-50">{busy === 'test' ? 'Testing…' : 'Test connection'}</button>
            <button onClick={refresh} disabled={!!busy} className="text-[11px] font-semibold text-primary bg-primary-light border border-primary/30 rounded-lg px-2.5 py-1 cursor-pointer hover:bg-primary hover:text-white disabled:opacity-50">{busy === 'refresh' ? 'Refreshing…' : 'Refresh from Jira'}</button>
            <Button type="button" onClick={() => saveConn()}>Save connection</Button>
          </div>
        </div>
      </div>

      {/* People mapping */}
      <div className="bg-white rounded-2xl border border-border-light shadow-card p-5 mb-4">
        <h3 className="text-sm font-bold text-text mb-1">People mapping</h3>
        <p className="text-[10px] text-text-light mb-3">
          Connect each person to their login account and their Jira account. {accounts.length === 0 && <span className="text-warning">Refresh from Jira to load accounts.</span>}
        </p>
        <div className="grid grid-cols-[2fr_1fr_1fr] gap-2 text-[10px] font-semibold text-text-light uppercase tracking-wider px-1 mb-1">
          <span>Person</span><span>Registered user</span><span>Account</span>
        </div>
        <div className="space-y-1">
          {resources.map((r) => (
            <div key={r.id} className="grid grid-cols-[2fr_1fr_1fr] gap-2 items-center px-1 py-1 rounded hover:bg-primary-bg/20">
              <span className="text-xs font-semibold text-text truncate">{r.name}</span>
              <select value={r.user?.id || ''} onChange={(e) => run(updateResource)(r.id, { userId: e.target.value || null })} className={`${inputCls} min-w-0`}>
                <option value="">— not linked —</option>
                {members.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name} ({m.user.email})</option>)}
              </select>
              <select value={r.externalWorkId || ''} onChange={(e) => run(updateResource)(r.id, { externalWorkId: e.target.value || null })} className={`${inputCls} min-w-0`}>
                <option value="">— not mapped —</option>
                {accountOptions(r.externalWorkId).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          ))}
          {resources.length === 0 && <p className="text-xs text-text-light py-2">No people yet.</p>}
        </div>
      </div>

      {/* Customer / project mapping — a table; expand a customer to its projects */}
      <div className="bg-white rounded-2xl border border-border-light shadow-card p-5 mb-4">
        <h3 className="text-sm font-bold text-text mb-1">Customer / project mapping</h3>
        <p className="text-[10px] text-text-light mb-3">
          Pick one or more Jira projects/epics for each customer or project. A Jira project pulls in everything under it (epics &amp; issues); a customer covers all its projects. {items.length === 0 && <span className="text-warning">Refresh from Jira to load projects &amp; epics.</span>}
        </p>

        <div className={`${COLS} text-[10px] font-semibold text-text-light uppercase tracking-wider px-2 pb-1 border-b border-border-light`}>
          <span>Customer / project</span><span>Jira mapping</span>
        </div>
        <div className="divide-y divide-border-light/60">
          {customers.map((c) => {
            const cProjects = projectsByCustomer[c.id] || [];
            const open = expanded.has(c.id);
            const cSel = new Set(itemsForCustomer(c.id).map((i) => i.id));
            return (
              <div key={c.id}>
                <div className={`${COLS} items-center px-2 py-1.5`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <button onClick={() => toggle(c.id)} className="w-4 text-text-light bg-transparent border-0 cursor-pointer hover:text-primary text-[11px] shrink-0">{open ? '▾' : '▸'}</button>
                    <span className="text-xs font-bold text-text truncate">{c.name}</span>
                    <span className="text-[9px] text-text-light shrink-0">{cProjects.length === 1 ? '1 project' : `${cProjects.length} projects`}</span>
                  </div>
                  <JiraMultiSelect items={items} selectedIds={cSel} ownerName={ownerName}
                    onToggle={(o, checked) => (checked ? assign(o.id, { customerId: c.id }) : unassign(o.id))} />
                </div>
                {open && cProjects.map((p) => {
                  const pSel = new Set(itemsForProject(p.id).map((i) => i.id));
                  return (
                    <div key={p.id} className={`${COLS} items-center px-2 py-1 bg-[#FAFBFD]`}>
                      <div className="flex items-center gap-2 min-w-0 pl-7">
                        <span className="text-text-light text-[11px] shrink-0">↳</span>
                        <span className="text-xs text-text truncate">{p.name}</span>
                      </div>
                      <JiraMultiSelect items={items} selectedIds={pSel} ownerName={ownerName}
                        onToggle={(o, checked) => (checked ? assign(o.id, { projectId: p.id }) : unassign(o.id))} />
                    </div>
                  );
                })}
                {open && cProjects.length === 0 && <div className="px-2 py-1 pl-9 text-[10px] text-text-light">No projects.</div>}
              </div>
            );
          })}
          {customers.length === 0 && <p className="text-xs text-text-light py-2">No customers yet.</p>}
        </div>
      </div>
    </div>
  );
}
