import { useState, useEffect, useCallback } from 'react';
import Button from '../../components/ui/Button';
import { api } from '../../lib/api';
import { useData } from '../../contexts/DataContext';

const inputCls = 'px-2 py-1.5 border border-border rounded-lg text-xs text-text outline-none focus:border-primary bg-white';

// A select over pulled Jira work items, grouped by kind.
function WorkItemSelect({ value, items, onChange }) {
  const byKind = (k) => items.filter((i) => i.kind === k);
  const others = items.filter((i) => i.kind !== 'project' && i.kind !== 'epic');
  const opt = (i) => <option key={i.id} value={i.id}>{i.externalKey} · {i.name}</option>;
  return (
    <select value={value} onChange={(e) => onChange(e.target.value || null)} className={`${inputCls} max-w-[260px]`}>
      <option value="">— not mapped —</option>
      {byKind('project').length > 0 && <optgroup label="Jira projects">{byKind('project').map(opt)}</optgroup>}
      {byKind('epic').length > 0 && <optgroup label="Epics">{byKind('epic').map(opt)}</optgroup>}
      {others.length > 0 && <optgroup label="Other">{others.map(opt)}</optgroup>}
    </select>
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
  // Test/Refresh act on the *saved* connection, so they save first — otherwise
  // typing creds and hitting Test would act on stale stored values.
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

  // ---- people mapping (external work id, edited locally) ----
  const accountOptions = (current) => {
    const opts = accounts.map((a) => ({ value: a.accountId, label: a.email ? `${a.displayName} (${a.email})` : a.displayName }));
    if (current && !opts.some((o) => o.value === current)) opts.unshift({ value: current, label: `${current} (unknown)` });
    return opts;
  };

  // ---- customer/project mapping (our-entity side) ----
  const itemForCustomer = (cId) => items.find((i) => i.customerId === cId)?.id || '';
  const itemForProject = (pId) => items.find((i) => i.projectId === pId)?.id || '';
  const mapEntity = (target, workItemId) => run(async () => { setItems(await api.setJiraMapping({ ...target, workItemId })); })();

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
        <div className="grid grid-cols-[1.2fr_1.4fr_1.4fr] gap-2 text-[10px] font-semibold text-text-light uppercase tracking-wider px-1 mb-1">
          <span>Person</span><span>Registered user</span><span>Account</span>
        </div>
        <div className="space-y-1">
          {resources.map((r) => (
            <div key={r.id} className="grid grid-cols-[1.2fr_1.4fr_1.4fr] gap-2 items-center px-1 py-1 rounded hover:bg-primary-bg/20">
              <span className="text-xs font-semibold text-text truncate">{r.name}</span>
              <select value={r.user?.id || ''} onChange={(e) => run(updateResource)(r.id, { userId: e.target.value || null })} className={inputCls}>
                <option value="">— not linked —</option>
                {members.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name} ({m.user.email})</option>)}
              </select>
              <select value={r.externalWorkId || ''} onChange={(e) => run(updateResource)(r.id, { externalWorkId: e.target.value || null })} className={inputCls}>
                <option value="">— not mapped —</option>
                {accountOptions(r.externalWorkId).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          ))}
          {resources.length === 0 && <p className="text-xs text-text-light py-2">No people yet.</p>}
        </div>
      </div>

      {/* Customer / project mapping (our entities → Jira) */}
      <div className="bg-white rounded-2xl border border-border-light shadow-card p-5 mb-4">
        <h3 className="text-sm font-bold text-text mb-1">Customer / project mapping</h3>
        <p className="text-[10px] text-text-light mb-3">
          Map each of your customers and projects to a Jira project or epic. {items.length === 0 && <span className="text-warning">Refresh from Jira to load projects &amp; epics.</span>}
        </p>

        <div className="text-[10px] font-bold text-text-mid uppercase tracking-wider mb-1">Customers</div>
        <div className="space-y-1 mb-3">
          {customers.map((c) => (
            <div key={c.id} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-primary-bg/20">
              <span className="text-xs font-semibold text-text flex-1 truncate">{c.name}</span>
              <WorkItemSelect value={itemForCustomer(c.id)} items={items} onChange={(wid) => mapEntity({ customerId: c.id }, wid)} />
            </div>
          ))}
          {customers.length === 0 && <p className="text-xs text-text-light py-1">No customers yet.</p>}
        </div>

        <div className="text-[10px] font-bold text-text-mid uppercase tracking-wider mb-1">Projects</div>
        <div className="space-y-1">
          {projects.map((p) => (
            <div key={p.id} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-primary-bg/20">
              <span className="text-xs font-semibold text-text flex-1 truncate">{p.name}</span>
              <WorkItemSelect value={itemForProject(p.id)} items={items} onChange={(wid) => mapEntity({ projectId: p.id }, wid)} />
            </div>
          ))}
          {projects.length === 0 && <p className="text-xs text-text-light py-1">No projects yet.</p>}
        </div>
      </div>
    </div>
  );
}
