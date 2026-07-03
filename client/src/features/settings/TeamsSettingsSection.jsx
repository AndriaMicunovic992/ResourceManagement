import { useState, useEffect, useCallback } from 'react';
import Button from '../../components/ui/Button';
import { api } from '../../lib/api';
import { useOrg } from '../../contexts/OrgContext';

const inputCls = 'px-2 py-1.5 border border-border rounded-lg text-xs text-text outline-none focus:border-primary bg-white';

const TYPE_DEFS = [
  { key: 'oneOnOne', label: '1:1 overdue' },
  { key: 'pmUpdate', label: 'PM update due' },
  { key: 'clientSignal', label: 'Client signal missing' },
];

// Empty type filter = all types.
function parseTeamsTypes(csv) {
  const all = { oneOnOne: true, pmUpdate: true, clientSignal: true };
  if (!csv || !csv.trim()) return all;
  const set = new Set(csv.split(',').map((s) => s.trim()));
  return { oneOnOne: set.has('oneOnOne'), pmUpdate: set.has('pmUpdate'), clientSignal: set.has('clientSignal') };
}

const BROWSER_TZ = (() => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
})();
const TIMEZONES = (() => {
  try {
    const all = Intl.supportedValuesOf('timeZone');
    return all.includes('UTC') ? all : ['UTC', ...all];
  } catch {
    return ['UTC', 'Europe/Zurich', 'Europe/Berlin', 'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Los_Angeles', 'Asia/Singapore'];
  }
})();

/**
 * Settings → Microsoft Teams. Two parts: the per-org Azure Bot connection
 * (credentials, stored encrypted like the Jira/Tempo tokens) and the reminder
 * delivery preferences (kept on the Organization).
 */
export default function TeamsSettingsSection() {
  const { currentOrg, updateOrg } = useOrg();
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  // ---- connection ----
  const [conn, setConn] = useState(null);
  const [form, setForm] = useState({ appType: 'SingleTenant', botAppId: '', tenantId: '' });
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState('');
  const loadConn = useCallback(async () => {
    const c = await api.getTeamsConnection().catch(() => null);
    if (c) { setConn(c); setForm({ appType: c.appType || 'SingleTenant', botAppId: c.botAppId || '', tenantId: c.tenantId || '' }); }
  }, []);
  useEffect(() => { loadConn(); }, [loadConn]);

  const usesSecret = form.appType !== 'UserAssignedMSI';
  const needsTenant = form.appType !== 'MultiTenant';

  const persistConn = async () => {
    await api.saveTeamsConnection({
      appType: form.appType,
      botAppId: form.botAppId || null,
      tenantId: form.tenantId || null,
      // Managed identity has no secret — never send one for that type.
      ...(usesSecret && password.trim() ? { botAppPassword: password.trim() } : {}),
    });
    setPassword('');
    await loadConn();
  };
  const saveConn = async () => {
    setError(''); setStatus('');
    try { await persistConn(); setStatus('Teams connection saved.'); }
    catch (e) { setError(e.message || 'Failed to save the Teams connection'); }
  };
  const testConn = async () => {
    setError(''); setStatus(''); setBusy('test');
    // Save first so the test validates exactly what's in the form.
    try { await persistConn(); const r = await api.testTeamsConnection(); setStatus(r?.message || 'Verified.'); }
    catch (e) { setError(e.message || 'Could not verify the credentials'); }
    finally { setBusy(''); }
  };

  // ---- reminder delivery (per-org) ----
  const [teamsEnabled, setTeamsEnabled] = useState(!!currentOrg?.teamsRemindersEnabled);
  const [teamsTypes, setTeamsTypes] = useState(() => parseTeamsTypes(currentOrg?.teamsReminderTypes));
  const [teamsMessage, setTeamsMessage] = useState(currentOrg?.teamsReminderMessage || '');
  const [teamsHour, setTeamsHour] = useState(currentOrg?.teamsReminderHour ?? 7);
  const [teamsTz, setTeamsTz] = useState(currentOrg?.teamsReminderTimezone || BROWSER_TZ);
  const [teamsSaving, setTeamsSaving] = useState(false);
  const [teamsSuccess, setTeamsSuccess] = useState(false);
  useEffect(() => {
    setTeamsEnabled(!!currentOrg?.teamsRemindersEnabled);
    setTeamsTypes(parseTeamsTypes(currentOrg?.teamsReminderTypes));
    setTeamsMessage(currentOrg?.teamsReminderMessage || '');
    setTeamsHour(currentOrg?.teamsReminderHour ?? 7);
    setTeamsTz(currentOrg?.teamsReminderTimezone || BROWSER_TZ);
  }, [currentOrg]);

  const saveReminders = async () => {
    setTeamsSaving(true); setTeamsSuccess(false); setError('');
    // All or none selected = "all" (null); a partial pick stores the subset.
    const keys = TYPE_DEFS.map((t) => t.key).filter((k) => teamsTypes[k]);
    const typesCsv = keys.length === 0 || keys.length === TYPE_DEFS.length ? null : keys.join(',');
    try {
      await updateOrg({
        teamsRemindersEnabled: teamsEnabled,
        teamsReminderTypes: typesCsv,
        teamsReminderMessage: teamsMessage.trim() || null,
        teamsReminderHour: teamsHour,
        teamsReminderTimezone: teamsTz || null,
      });
      setTeamsSuccess(true); setTimeout(() => setTeamsSuccess(false), 2000);
    } catch (e) {
      setError(e.message || 'Failed to save reminder settings');
    }
    setTeamsSaving(false);
  };

  // Send a labelled test DM to yourself — the true "are messages sending?" check.
  const sendTest = async () => {
    setError(''); setStatus(''); setBusy('testmsg');
    try { await api.sendTeamsTestMessage(); setStatus('Test message sent — check your Microsoft Teams chat with the bot.'); }
    catch (e) { setError(e.message || 'Could not send the test message'); }
    finally { setBusy(''); }
  };

  // Install the app for every Microsoft-linked person via Graph (no per-person action).
  const connectAll = async () => {
    setError(''); setStatus(''); setBusy('installall');
    try {
      const r = await api.installTeamsForAll();
      const parts = [`${r.installed} installed`, `${r.alreadyConnected} already connected`];
      if (r.skippedNoMicrosoft) parts.push(`${r.skippedNoMicrosoft} skipped (no Microsoft sign-in)`);
      if (r.failed) parts.push(`${r.failed} failed`);
      setStatus(`Connect all: ${parts.join(', ')}.${r.errors?.length ? ` First error: ${r.errors[0]}` : ''}`);
    } catch (e) {
      setError(e.message || 'Could not install for everyone');
    } finally { setBusy(''); }
  };

  // Run the real daily reminder push now (real due reminders, ignores the time gate).
  const pushNow = async () => {
    setError(''); setStatus(''); setBusy('pushnow');
    try {
      const r = await api.pushTeamsReminders();
      setStatus(`Sent ${r.sent} reminder DM${r.sent === 1 ? '' : 's'} to people with something due right now.`);
    } catch (e) {
      setError(e.message || 'Could not send reminders');
    } finally { setBusy(''); }
  };

  return (
    <div id="msteams" className="scroll-mt-4 bg-white rounded-2xl border border-border-light shadow-card p-5 mb-4">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-sm font-bold text-text">Microsoft Teams</h3>
        {conn && (
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${conn.configured ? 'bg-success-bg text-success' : 'bg-warning/10 text-warning'}`}>
            {conn.configured ? 'CONNECTED' : 'NOT CONFIGURED'}
          </span>
        )}
      </div>
      {error && <div className="text-xs text-danger bg-danger-bg p-2 rounded my-2">{error}</div>}
      {status && !error && <div className="text-xs text-success bg-success-bg p-2 rounded my-2">{status}</div>}

      {/* Connection credentials */}
      <p className="text-[10px] text-text-light mb-3">
        Azure Bot credentials for delivering reminders as private Teams messages. Pick the app type
        you chose when creating the bot. Secrets are encrypted at rest and never shown again — leave
        the field blank to keep the stored one.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-[10px] font-semibold text-text-mid mb-1">App type</span>
          <select value={form.appType} onChange={(e) => setForm((f) => ({ ...f, appType: e.target.value }))} className={`w-full ${inputCls}`}>
            <option value="SingleTenant">Single-tenant (client secret)</option>
            <option value="MultiTenant">Multi-tenant (client secret)</option>
            <option value="UserAssignedMSI">User-assigned managed identity</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-[10px] font-semibold text-text-mid mb-1">
            {form.appType === 'UserAssignedMSI' ? 'Managed identity client ID' : 'Bot App ID'}
          </span>
          <input value={form.botAppId} onChange={(e) => setForm((f) => ({ ...f, botAppId: e.target.value }))}
            placeholder="00000000-0000-0000-0000-000000000000" className={`w-full ${inputCls} font-mono`} />
        </label>
        {needsTenant && (
          <label className="block">
            <span className="block text-[10px] font-semibold text-text-mid mb-1">Tenant (directory) ID</span>
            <input value={form.tenantId} onChange={(e) => setForm((f) => ({ ...f, tenantId: e.target.value }))}
              placeholder="directory (Entra) id" className={`w-full ${inputCls} font-mono`} />
          </label>
        )}
        {usesSecret && (
          <label className="block col-span-2">
            <span className="block text-[10px] font-semibold text-text-mid mb-1">
              App password (client secret) {conn?.botAppPasswordSet && <span className="text-success">· set</span>}
            </span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password"
              placeholder={conn?.botAppPasswordSet ? '•••••••••• (leave blank to keep)' : 'Paste the client secret value'}
              className={`w-full ${inputCls} font-mono`} />
          </label>
        )}
      </div>
      {form.appType === 'UserAssignedMSI' && (
        <p className="text-[10px] text-text-light mt-2">
          Managed identity has no secret — the app authenticates via the identity at runtime. Works
          only when the server runs in Azure with this user-assigned identity attached to its compute.
        </p>
      )}
      <div className="flex justify-end gap-2 mt-3">
        <button onClick={testConn} disabled={!!busy}
          className="text-[11px] font-semibold text-text-mid bg-white border border-border-light rounded-lg px-2.5 py-1 cursor-pointer hover:bg-primary-bg disabled:opacity-50">
          {busy === 'test' ? 'Testing…' : 'Test connection'}
        </button>
        <Button type="button" onClick={saveConn}>Save connection</Button>
      </div>

      {/* Reminder delivery */}
      <div className="mt-4 pt-3 border-t border-border-light">
        <h4 className="text-xs font-bold text-text mb-1">Reminder delivery</h4>
        <p className="text-[10px] text-text-light mb-3">
          Deliver the in-app reminders as private Teams DMs — each person is messaged once a day when
          they have something open. {conn && !conn.configured && (
            <span className="text-warning">Add the bot credentials above to start sending.</span>
          )}
        </p>
        <label className="flex items-center gap-2 text-xs text-text-mid cursor-pointer mb-3">
          <input type="checkbox" checked={teamsEnabled} onChange={(e) => setTeamsEnabled(e.target.checked)} />
          Send reminders to Microsoft Teams
        </label>
        <div className={teamsEnabled ? '' : 'opacity-50 pointer-events-none'}>
          <div className="text-[10px] font-semibold text-text-mid mb-1">Which reminders to send</div>
          <div className="flex flex-wrap gap-4 mb-1">
            {TYPE_DEFS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-1.5 text-xs text-text-mid cursor-pointer">
                <input type="checkbox" checked={teamsTypes[key]}
                  onChange={(e) => setTeamsTypes((t) => ({ ...t, [key]: e.target.checked }))} />
                {label}
              </label>
            ))}
          </div>
          <div className="text-[10px] text-text-light">All types are sent unless you pick a subset.</div>
          <div className="mt-3">
            <div className="text-[10px] font-semibold text-text-mid mb-1">Send daily at</div>
            <div className="flex items-center gap-2 flex-wrap">
              <select value={teamsHour} onChange={(e) => setTeamsHour(Number(e.target.value))} className={inputCls}>
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                ))}
              </select>
              <span className="text-[11px] text-text-mid">in</span>
              <select value={teamsTz} onChange={(e) => setTeamsTz(e.target.value)} className={`${inputCls} max-w-[240px]`}>
                {(TIMEZONES.includes(teamsTz) ? TIMEZONES : [teamsTz, ...TIMEZONES]).map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="mt-3">
          <label className="block text-[10px] font-semibold text-text-mid mb-1">
            Message intro <span className="text-text-light font-normal">(optional — shown above the list of items)</span>
          </label>
          <textarea value={teamsMessage} onChange={(e) => setTeamsMessage(e.target.value)} rows={2}
            placeholder="Here are your open items in databob:" className={`w-full ${inputCls} resize-y`} />
        </div>
        <div className="flex justify-between items-center mt-3 gap-2 flex-wrap">
          <div className="flex gap-2 flex-wrap">
            <button onClick={sendTest} disabled={!!busy || (conn && !conn.configured)}
              title={conn && !conn.configured ? 'Configure the bot connection first' : 'Sends a test DM to you'}
              className="text-[11px] font-semibold text-primary bg-primary-light border border-primary/30 rounded-lg px-2.5 py-1 cursor-pointer hover:bg-primary hover:text-white disabled:opacity-50">
              {busy === 'testmsg' ? 'Sending…' : 'Send test message to me'}
            </button>
            <button onClick={connectAll} disabled={!!busy || (conn && !conn.configured)}
              title="Installs the databob app for every Microsoft-signed-in person (needs Graph permissions on the bot app)"
              className="text-[11px] font-semibold text-text-mid bg-white border border-border-light rounded-lg px-2.5 py-1 cursor-pointer hover:bg-primary-bg disabled:opacity-50">
              {busy === 'installall' ? 'Connecting…' : 'Connect all people'}
            </button>
            <button onClick={pushNow} disabled={!!busy || (conn && !conn.configured)}
              title="Send everyone their real due reminders now (the same push that runs daily)"
              className="text-[11px] font-semibold text-text-mid bg-white border border-border-light rounded-lg px-2.5 py-1 cursor-pointer hover:bg-primary-bg disabled:opacity-50">
              {busy === 'pushnow' ? 'Sending…' : 'Send reminders now'}
            </button>
          </div>
          <Button onClick={saveReminders} disabled={teamsSaving}>
            {teamsSaving ? 'Saving...' : teamsSuccess ? 'Saved!' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}
