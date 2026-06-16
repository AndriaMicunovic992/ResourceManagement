import { useState, useEffect, useCallback } from 'react';
import Button from '../../components/ui/Button';
import { api } from '../../lib/api';
import { useData } from '../../contexts/DataContext';

const KINDS = ['project', 'epic', 'issue', 'other'];
const inputCls = 'px-2 py-1.5 border border-border rounded-lg text-xs text-text outline-none focus:border-primary bg-white';

// Order a flat work-item list into a parent→child tree with depth for indenting.
function flattenTree(items) {
  const byParent = new Map();
  const ids = new Set(items.map((i) => i.id));
  for (const it of items) {
    const key = it.parentId && ids.has(it.parentId) ? it.parentId : null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(it);
  }
  const out = [];
  const walk = (parentKey, depth) => {
    for (const it of byParent.get(parentKey) || []) {
      out.push({ item: it, depth });
      walk(it.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

// Encode/parse the combined customer|project mapping for a single <select>.
const targetValue = (it) => (it.customerId ? 'c:' + it.customerId : it.projectId ? 'p:' + it.projectId : '');
function parseTarget(v) {
  if (v.startsWith('c:')) return { customerId: v.slice(2), projectId: null };
  if (v.startsWith('p:')) return { projectId: v.slice(2), customerId: null };
  return { customerId: null, projectId: null };
}

function TargetSelect({ value, onChange, customers, projects }) {
  return (
    <select value={value} onChange={(e) => onChange(parseTarget(e.target.value))} className={inputCls}>
      <option value="">— unmapped —</option>
      <optgroup label="Customers">
        {customers.map((c) => <option key={c.id} value={'c:' + c.id}>{c.name}</option>)}
      </optgroup>
      <optgroup label="Projects">
        {projects.map((p) => <option key={p.id} value={'p:' + p.id}>{p.name}</option>)}
      </optgroup>
    </select>
  );
}

export default function IntegrationsSection() {
  const { resources, customers, projects, updateResource } = useData();
  const [error, setError] = useState('');
  const run = (fn) => async (...a) => { setError(''); try { await fn(...a); return true; } catch (e) { setError(e.message || 'Something went wrong'); return false; } };

  // ---- connection ----
  const [conn, setConn] = useState(null);
  const [form, setForm] = useState({ baseUrl: '', jiraEmail: '', enabled: false });
  const [jiraToken, setJiraToken] = useState('');
  const [tempoToken, setTempoToken] = useState('');
  const loadConn = useCallback(async () => {
    const c = await api.getJiraConnection().catch(() => null);
    if (c) { setConn(c); setForm({ baseUrl: c.baseUrl || '', jiraEmail: c.jiraEmail || '', enabled: !!c.enabled }); }
  }, []);

  // ---- members (for the person → user dropdown) ----
  const [members, setMembers] = useState([]);
  // ---- work items ----
  const [items, setItems] = useState([]);
  const loadItems = useCallback(async () => { setItems(await api.getJiraWorkItems().catch(() => [])); }, []);

  useEffect(() => {
    loadConn();
    loadItems();
    api.getMembers().then(setMembers).catch(() => setMembers([]));
  }, [loadConn, loadItems]);

  const saveConn = (extra = {}) => run(async () => {
    await api.saveJiraConnection({
      baseUrl: form.baseUrl || null,
      jiraEmail: form.jiraEmail || null,
      enabled: form.enabled,
      ...(jiraToken.trim() ? { jiraApiToken: jiraToken.trim() } : {}),
      ...(tempoToken.trim() ? { tempoApiToken: tempoToken.trim() } : {}),
      ...extra,
    });
    setJiraToken(''); setTempoToken('');
    await loadConn();
  })();

  // ---- people mapping (external work id, edited locally then committed) ----
  const [extEdits, setExtEdits] = useState({});
  const commitExt = (r) => {
    const v = extEdits[r.id];
    if (v === undefined || v === (r.externalWorkId || '')) return;
    run(updateResource)(r.id, { externalWorkId: v.trim() || null });
  };

  // ---- work item add form ----
  const [nw, setNw] = useState({ kind: 'project', externalKey: '', name: '', parentId: '', target: '' });
  const addItem = run(async () => {
    if (!nw.externalKey.trim() || !nw.name.trim()) return;
    await api.createJiraWorkItem({
      kind: nw.kind, externalKey: nw.externalKey.trim(), name: nw.name.trim(),
      parentId: nw.parentId || null, ...parseTarget(nw.target),
    });
    setNw({ kind: 'project', externalKey: '', name: '', parentId: '', target: '' });
    await loadItems();
  });
  const patchItem = (id, data) => run(async () => { await api.updateJiraWorkItem(id, data); await loadItems(); })();
  const removeItem = (id) => run(async () => { await api.deleteJiraWorkItem(id); await loadItems(); })();

  const tree = flattenTree(items);

  return (
    <div id="integrations" className="scroll-mt-4">
      {error && <div className="text-xs text-danger bg-danger-bg p-2 rounded mb-3">{error}</div>}

      {/* Connection */}
      <div className="bg-white rounded-2xl border border-border-light shadow-card p-5 mb-4">
        <h3 className="text-sm font-bold text-text mb-1">Jira / Tempo connection</h3>
        <p className="text-[10px] text-text-light mb-3">
          Credentials for the actual-hours source. API tokens are encrypted at rest and never shown again — leave a token field blank to keep the stored one.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[10px] font-semibold text-text-mid mb-1">Jira base URL</span>
            <input value={form.baseUrl} onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
              placeholder="https://acme.atlassian.net" className={`w-full ${inputCls}`} />
          </label>
          <label className="block">
            <span className="block text-[10px] font-semibold text-text-mid mb-1">Jira account email</span>
            <input value={form.jiraEmail} onChange={(e) => setForm((f) => ({ ...f, jiraEmail: e.target.value }))}
              placeholder="ops@acme.io" className={`w-full ${inputCls}`} />
          </label>
          <label className="block">
            <span className="block text-[10px] font-semibold text-text-mid mb-1">
              Jira API token {conn?.jiraApiTokenSet && <span className="text-success">· set</span>}
            </span>
            <input type="password" value={jiraToken} onChange={(e) => setJiraToken(e.target.value)} autoComplete="new-password"
              placeholder={conn?.jiraApiTokenSet ? '•••••••••• (leave blank to keep)' : 'Paste token'} className={`w-full ${inputCls} font-mono`} />
          </label>
          <label className="block">
            <span className="block text-[10px] font-semibold text-text-mid mb-1">
              Tempo API token {conn?.tempoApiTokenSet && <span className="text-success">· set</span>}
            </span>
            <input type="password" value={tempoToken} onChange={(e) => setTempoToken(e.target.value)} autoComplete="new-password"
              placeholder={conn?.tempoApiTokenSet ? '•••••••••• (leave blank to keep)' : 'Paste token'} className={`w-full ${inputCls} font-mono`} />
          </label>
        </div>
        <div className="flex items-center justify-between mt-3">
          <label className="flex items-center gap-2 text-xs text-text-mid cursor-pointer">
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} />
            Enabled
          </label>
          <div className="flex gap-2">
            {(conn?.jiraApiTokenSet || conn?.tempoApiTokenSet) && (
              <button onClick={() => saveConn({ jiraApiToken: null, tempoApiToken: null })}
                className="text-[11px] text-text-mid bg-white border border-border-light rounded-lg px-2.5 py-1 cursor-pointer hover:bg-primary-bg">Clear tokens</button>
            )}
            <Button type="button" onClick={() => saveConn()}>Save connection</Button>
          </div>
        </div>
      </div>

      {/* People mapping */}
      <div className="bg-white rounded-2xl border border-border-light shadow-card p-5 mb-4">
        <h3 className="text-sm font-bold text-text mb-1">People mapping</h3>
        <p className="text-[10px] text-text-light mb-3">
          Connect each person to their login account and their id in the actual-hours system.
        </p>
        <div className="grid grid-cols-[1.2fr_1.2fr_1fr] gap-2 text-[10px] font-semibold text-text-light uppercase tracking-wider px-1 mb-1">
          <span>Person</span><span>Registered user</span><span>Actual-hours id</span>
        </div>
        <div className="space-y-1">
          {resources.map((r) => (
            <div key={r.id} className="grid grid-cols-[1.2fr_1.2fr_1fr] gap-2 items-center px-1 py-1 rounded hover:bg-primary-bg/20">
              <span className="text-xs font-semibold text-text truncate">{r.name}</span>
              <select value={r.user?.id || ''} onChange={(e) => run(updateResource)(r.id, { userId: e.target.value || null })} className={inputCls}>
                <option value="">— not linked —</option>
                {members.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name} ({m.user.email})</option>)}
              </select>
              <input
                value={extEdits[r.id] ?? r.externalWorkId ?? ''}
                onChange={(e) => setExtEdits((p) => ({ ...p, [r.id]: e.target.value }))}
                onBlur={() => commitExt(r)}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                placeholder="e.g. Jira accountId"
                className={`${inputCls} font-mono`}
              />
            </div>
          ))}
          {resources.length === 0 && <p className="text-xs text-text-light py-2">No people yet.</p>}
        </div>
      </div>

      {/* Customer / project (Jira work item) mapping */}
      <div className="bg-white rounded-2xl border border-border-light shadow-card p-5 mb-4">
        <h3 className="text-sm font-bold text-text mb-1">Customer / project mapping</h3>
        <p className="text-[10px] text-text-light mb-3">
          Map the Jira work hierarchy onto your customers and projects. A Jira project might be a whole customer, while its epics map to individual projects — nest items with a parent and map each to one of your records.
        </p>

        <div className="space-y-1 mb-3">
          {tree.map(({ item, depth }) => (
            <div key={item.id} className="flex items-center gap-2 px-1 py-1.5 rounded hover:bg-primary-bg/20">
              <div className="flex items-center gap-2 min-w-0" style={{ flex: '1 1 0', paddingLeft: depth * 18 }}>
                {depth > 0 && <span className="text-text-light text-[11px]">↳</span>}
                <span className="text-[9px] font-bold uppercase tracking-wide text-text-light bg-border-light rounded px-1.5 py-0.5 shrink-0">{item.kind}</span>
                <span className="text-[11px] font-mono font-bold text-text-mid shrink-0">{item.externalKey}</span>
                <span className="text-xs text-text truncate">{item.name}</span>
              </div>
              <select value={item.parentId || ''} onChange={(e) => patchItem(item.id, { parentId: e.target.value || null })}
                className={`${inputCls} shrink-0 max-w-[150px]`} title="Parent">
                <option value="">— no parent —</option>
                {items.filter((i) => i.id !== item.id).map((i) => <option key={i.id} value={i.id}>{i.externalKey}</option>)}
              </select>
              <TargetSelect value={targetValue(item)} customers={customers} projects={projects}
                onChange={(t) => patchItem(item.id, t)} />
              <button onClick={() => removeItem(item.id)} className="text-[10px] text-danger bg-transparent border-0 cursor-pointer hover:text-danger/80 px-1 shrink-0">Delete</button>
            </div>
          ))}
          {items.length === 0 && <p className="text-xs text-text-light py-2">No Jira work items mapped yet.</p>}
        </div>

        <div className="flex gap-2 items-end pt-3 border-t border-border-light flex-wrap">
          <div>
            <label className="block text-[10px] font-semibold text-text-mid mb-1">Type</label>
            <select value={nw.kind} onChange={(e) => setNw((s) => ({ ...s, kind: e.target.value }))} className={inputCls}>
              {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-text-mid mb-1">Jira key</label>
            <input value={nw.externalKey} onChange={(e) => setNw((s) => ({ ...s, externalKey: e.target.value }))} placeholder="ACME-12" className={`w-24 ${inputCls}`} />
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="block text-[10px] font-semibold text-text-mid mb-1">Name</label>
            <input value={nw.name} onChange={(e) => setNw((s) => ({ ...s, name: e.target.value }))} placeholder="Billing epic" className={`w-full ${inputCls}`} />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-text-mid mb-1">Parent</label>
            <select value={nw.parentId} onChange={(e) => setNw((s) => ({ ...s, parentId: e.target.value }))} className={inputCls}>
              <option value="">— none —</option>
              {items.map((i) => <option key={i.id} value={i.id}>{i.externalKey}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-text-mid mb-1">Maps to</label>
            <TargetSelect value={nw.target} customers={customers} projects={projects} onChange={(t) => setNw((s) => ({ ...s, target: t.customerId ? 'c:' + t.customerId : t.projectId ? 'p:' + t.projectId : '' }))} />
          </div>
          <Button type="button" onClick={addItem}>Add item</Button>
        </div>
      </div>
    </div>
  );
}
