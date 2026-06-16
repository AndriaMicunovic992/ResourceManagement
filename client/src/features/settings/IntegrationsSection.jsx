import { useState, useEffect, useCallback, useMemo } from 'react';
import Button from '../../components/ui/Button';
import { api } from '../../lib/api';
import { useData } from '../../contexts/DataContext';

const inputCls = 'px-2 py-1.5 border border-border rounded-lg text-xs text-text outline-none focus:border-primary bg-white';

// Mapped Jira items shown as removable chips, plus a dropdown to add another
// (an entity can map to many Jira projects/epics). The add list is the pool of
// items not yet mapped to anything, grouped by kind.
function MappingControls({ mapped, unmapped, onAdd, onRemove }) {
  const byKind = (k) => unmapped.filter((i) => i.kind === k);
  const others = unmapped.filter((i) => i.kind !== 'project' && i.kind !== 'epic');
  const opt = (i) => <option key={i.id} value={i.id}>{i.externalKey} · {i.name}</option>;
  return (
    <div className="flex items-center gap-1.5 flex-wrap justify-end flex-1 min-w-0">
      {mapped.map((i) => (
        <span key={i.id} className="inline-flex items-center gap-1 text-[10px] font-semibold bg-primary-bg text-text-mid rounded-full pl-2 pr-1 py-0.5 shrink-0">
          <span className="text-[8px] uppercase tracking-wide text-text-light">{i.kind}</span>
          <span className="font-mono">{i.externalKey}</span>
          <button onClick={() => onRemove(i.id)} title="Remove" className="bg-transparent border-0 cursor-pointer text-text-light hover:text-danger leading-none">×</button>
        </span>
      ))}
      <select value="" onChange={(e) => { if (e.target.value) onAdd(e.target.value); }}
        className="px-2 py-1 border border-dashed border-border rounded-full text-[10px] text-text-mid outline-none focus:border-primary bg-white cursor-pointer shrink-0">
        <option value="">+ map Jira…</option>
        {byKind('project').length > 0 && <optgroup label="Jira projects">{byKind('project').map(opt)}</optgroup>}
        {byKind('epic').length > 0 && <optgroup label="Epics">{byKind('epic').map(opt)}</optgroup>}
        {others.length > 0 && <optgroup label="Other">{others.map(opt)}</optgroup>}
      </select>
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

  // Persist the form (incl. any newly-typed tokens) without a status message.
  // Test/Refresh act on the *saved* connection, so they save first.
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

  // ---- customer/project mapping (our entities → many Jira items) ----
  const projectsByCustomer = useMemo(() => {
    const m = {};
    for (const p of projects) (m[p.customerId] = m[p.customerId] || []).push(p);
    return m;
  }, [projects]);
  const unmappedItems = useMemo(() => items.filter((i) => !i.customerId && !i.projectId), [items]);
  const itemsForCustomer = (cId) => items.filter((i) => i.customerId === cId);
  const itemsForProject = (pId) => items.filter((i) => i.projectId === pId);
  const assign = (workItemId, target) => run(async () => {
    await api.updateJiraWorkItem(workItemId, { customerId: target.customerId ?? null, projectId: target.projectId ?? null });
    await loadRefs();
  })();
  const unassign = (workItemId) => run(async () => {
    await api.updateJiraWorkItem(workItemId, { customerId: null, projectId: null });
    await loadRefs();
  })();

  // Customers collapsed by default; expand to map their projects.
  const [expanded, setExpanded] = useState(() => new Set());
  const toggle = (id) => setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

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

      {/* Customer / project mapping (our hierarchy → many Jira items) */}
      <div className="bg-white rounded-2xl border border-border-light shadow-card p-5 mb-4">
        <h3 className="text-sm font-bold text-text mb-1">Customer / project mapping</h3>
        <p className="text-[10px] text-text-light mb-3">
          Map your customers and projects to one or more Jira projects/epics. Mapping a Jira project pulls in everything under it (its epics &amp; issues); a customer covers all its projects. {items.length === 0 && <span className="text-warning">Refresh from Jira to load projects &amp; epics.</span>}
        </p>

        <div className="space-y-0.5">
          {customers.map((c) => {
            const cProjects = projectsByCustomer[c.id] || [];
            const open = expanded.has(c.id);
            return (
              <div key={c.id} className="border-b border-border-light/50 last:border-0 pb-0.5">
                <div className="flex items-center gap-2 px-1 py-1.5">
                  <button onClick={() => toggle(c.id)} className="w-4 text-text-light bg-transparent border-0 cursor-pointer hover:text-primary text-[11px] shrink-0">{open ? '▾' : '▸'}</button>
                  <span className="text-xs font-bold text-text shrink-0">{c.name}</span>
                  <span className="text-[9px] text-text-light shrink-0">{cProjects.length === 1 ? '1 project' : `${cProjects.length} projects`}</span>
                  <MappingControls mapped={itemsForCustomer(c.id)} unmapped={unmappedItems} onAdd={(wid) => assign(wid, { customerId: c.id })} onRemove={unassign} />
                </div>
                {open && cProjects.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 px-1 py-1 pl-8">
                    <span className="text-text-light text-[11px] shrink-0">↳</span>
                    <span className="text-xs text-text shrink-0">{p.name}</span>
                    <MappingControls mapped={itemsForProject(p.id)} unmapped={unmappedItems} onAdd={(wid) => assign(wid, { projectId: p.id })} onRemove={unassign} />
                  </div>
                ))}
                {open && cProjects.length === 0 && <div className="pl-8 py-1 text-[10px] text-text-light">No projects.</div>}
              </div>
            );
          })}
          {customers.length === 0 && <p className="text-xs text-text-light py-1">No customers yet.</p>}
        </div>
      </div>
    </div>
  );
}
