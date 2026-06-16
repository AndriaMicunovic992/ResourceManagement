import { useState } from 'react';
import Button from '../../components/ui/Button';
import { useData } from '../../contexts/DataContext';

// Settings: manage the editable role taxonomy — domains (with a planner color)
// and the roles nested under them, plus the seniority ladder. Renames cascade
// to people & needs server-side; terms still in use can't be deleted.
export default function TaxonomySection() {
  const {
    domains, seniorities,
    addDomain, updateDomain, deleteDomain,
    addJobRole, updateJobRole, deleteJobRole,
    addSeniority, updateSeniority, moveSeniority, deleteSeniority,
  } = useData();
  const [error, setError] = useState('');
  const run = (fn) => async (...args) => {
    setError('');
    try { await fn(...args); return true; } catch (e) { setError(e.message || 'Something went wrong'); return false; }
  };

  // --- domain add / edit ---
  const [newDomainName, setNewDomainName] = useState('');
  const [newDomainColor, setNewDomainColor] = useState('#4CBAD4');
  const [editDomainId, setEditDomainId] = useState(null);
  const [editDomainName, setEditDomainName] = useState('');
  const [editDomainColor, setEditDomainColor] = useState('');

  // --- role add / rename ---
  const [newRoleByDomain, setNewRoleByDomain] = useState({});
  const [editRoleId, setEditRoleId] = useState(null);
  const [editRoleName, setEditRoleName] = useState('');

  // --- seniority add / edit ---
  const [newSenName, setNewSenName] = useState('');
  const [newSenShort, setNewSenShort] = useState('');
  const [editSenId, setEditSenId] = useState(null);
  const [editSenName, setEditSenName] = useState('');
  const [editSenShort, setEditSenShort] = useState('');

  const startEditDomain = (d) => { setEditDomainId(d.id); setEditDomainName(d.name); setEditDomainColor(d.color); };
  const saveEditDomain = async () => {
    if (!editDomainName.trim()) return;
    if (await run(updateDomain)(editDomainId, { name: editDomainName.trim(), color: editDomainColor })) setEditDomainId(null);
  };
  const addNewDomain = async () => {
    if (!newDomainName.trim()) return;
    if (await run(addDomain)({ name: newDomainName.trim(), color: newDomainColor })) { setNewDomainName(''); setNewDomainColor('#4CBAD4'); }
  };
  const addRole = async (domainId) => {
    const name = (newRoleByDomain[domainId] || '').trim();
    if (!name) return;
    if (await run(addJobRole)(domainId, name)) setNewRoleByDomain((p) => ({ ...p, [domainId]: '' }));
  };
  const saveEditRole = async () => {
    if (!editRoleName.trim()) return;
    if (await run(updateJobRole)(editRoleId, editRoleName.trim())) setEditRoleId(null);
  };
  const addNewSeniority = async () => {
    if (!newSenName.trim() || !newSenShort.trim()) return;
    if (await run(addSeniority)({ name: newSenName.trim(), shortLabel: newSenShort.trim() })) { setNewSenName(''); setNewSenShort(''); }
  };
  const startEditSen = (s) => { setEditSenId(s.id); setEditSenName(s.name); setEditSenShort(s.shortLabel); };
  const saveEditSen = async () => {
    if (!editSenName.trim() || !editSenShort.trim()) return;
    if (await run(updateSeniority)(editSenId, { name: editSenName.trim(), shortLabel: editSenShort.trim() })) setEditSenId(null);
  };

  const inputCls = 'px-2 py-1 border border-border rounded text-xs text-text outline-none focus:border-primary';

  return (
    <div id="taxonomy" className="scroll-mt-4">
      {error && (
        <div className="text-xs text-danger bg-danger-bg p-2 rounded mb-3">{error}</div>
      )}

      {/* Domains & roles */}
      <div className="bg-white rounded-2xl border border-border-light shadow-card p-5 mb-4">
        <h3 className="text-sm font-bold text-text mb-1">Domains &amp; roles</h3>
        <p className="text-[10px] text-text-light mb-3">
          Domains group the roles people and needs can use. Each domain has a color used on the planner bars. Renaming a domain or role updates everyone already using it.
        </p>

        <div className="space-y-2 mb-3">
          {domains.map((d) => (
            <div key={d.id} className="border border-border-light rounded-xl p-2.5">
              {editDomainId === d.id ? (
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <input type="color" value={editDomainColor} onChange={(e) => setEditDomainColor(e.target.value)}
                    className="w-7 h-7 rounded cursor-pointer border border-border bg-white p-0" />
                  <input value={editDomainName} onChange={(e) => setEditDomainName(e.target.value)} autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') saveEditDomain(); if (e.key === 'Escape') setEditDomainId(null); }}
                    className={`flex-1 min-w-[120px] ${inputCls}`} />
                  <button onClick={saveEditDomain} className="text-[10px] text-primary bg-transparent border-0 cursor-pointer hover:underline px-1">Save</button>
                  <button onClick={() => setEditDomainId(null)} className="text-[10px] text-text-light bg-transparent border-0 cursor-pointer hover:text-text-mid px-1">Cancel</button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3.5 h-3.5 rounded shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-xs font-bold text-text flex-1">{d.name}</span>
                  <button onClick={() => startEditDomain(d)} className="text-[10px] text-text-mid bg-transparent border-0 cursor-pointer hover:text-primary px-1">Edit</button>
                  <button onClick={() => run(deleteDomain)(d.id)} className="text-[10px] text-danger bg-transparent border-0 cursor-pointer hover:text-danger/80 px-1">Delete</button>
                </div>
              )}

              {/* roles */}
              <div className="flex flex-wrap items-center gap-1.5 pl-1">
                {d.roles.map((r) => (
                  editRoleId === r.id ? (
                    <input key={r.id} value={editRoleName} autoFocus onChange={(e) => setEditRoleName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEditRole(); if (e.key === 'Escape') setEditRoleId(null); }}
                      onBlur={saveEditRole}
                      className={`w-24 ${inputCls}`} />
                  ) : (
                    <span key={r.id} className="inline-flex items-center gap-1 text-[10px] font-semibold bg-primary-bg text-text-mid rounded-full pl-2.5 pr-1 py-0.5">
                      <button onClick={() => { setEditRoleId(r.id); setEditRoleName(r.name); }}
                        className="bg-transparent border-0 cursor-pointer text-text-mid hover:text-primary p-0">{r.name}</button>
                      <button onClick={() => run(deleteJobRole)(r.id)} title="Remove role"
                        className="bg-transparent border-0 cursor-pointer text-text-light hover:text-danger leading-none">×</button>
                    </span>
                  )
                ))}
                <input
                  value={newRoleByDomain[d.id] || ''}
                  onChange={(e) => setNewRoleByDomain((p) => ({ ...p, [d.id]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRole(d.id); } }}
                  placeholder="+ role"
                  className="w-20 px-2 py-0.5 border border-dashed border-border rounded-full text-[10px] text-text outline-none focus:border-primary"
                />
              </div>
            </div>
          ))}
          {domains.length === 0 && <p className="text-xs text-text-light py-2">No domains yet.</p>}
        </div>

        <div className="flex gap-2 items-end pt-3 border-t border-border-light flex-wrap">
          <div>
            <label className="block text-[10px] font-semibold text-text-mid mb-1">Color</label>
            <input type="color" value={newDomainColor} onChange={(e) => setNewDomainColor(e.target.value)}
              className="w-9 h-8 rounded cursor-pointer border border-border bg-white p-0" />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] font-semibold text-text-mid mb-1">New domain</label>
            <input value={newDomainName} onChange={(e) => setNewDomainName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNewDomain(); } }}
              placeholder="e.g. Design" className={`w-full ${inputCls} py-1.5`} />
          </div>
          <Button type="button" onClick={addNewDomain}>Add domain</Button>
        </div>
      </div>

      {/* Seniorities */}
      <div className="bg-white rounded-2xl border border-border-light shadow-card p-5 mb-4">
        <h3 className="text-sm font-bold text-text mb-1">Seniority levels</h3>
        <p className="text-[10px] text-text-light mb-3">
          Listed from most junior to most senior. The order is the seniority rank — a person can fill a need at their level or below.
        </p>

        <div className="space-y-1 mb-3">
          {seniorities.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-primary-bg/30">
              {editSenId === s.id ? (
                <>
                  <input value={editSenShort} onChange={(e) => setEditSenShort(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveEditSen(); if (e.key === 'Escape') setEditSenId(null); }}
                    className={`w-14 ${inputCls}`} placeholder="Sr" />
                  <input value={editSenName} autoFocus onChange={(e) => setEditSenName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveEditSen(); if (e.key === 'Escape') setEditSenId(null); }}
                    className={`flex-1 ${inputCls}`} placeholder="Senior" />
                  <button onClick={saveEditSen} className="text-[10px] text-primary bg-transparent border-0 cursor-pointer hover:underline px-1">Save</button>
                  <button onClick={() => setEditSenId(null)} className="text-[10px] text-text-light bg-transparent border-0 cursor-pointer hover:text-text-mid px-1">Cancel</button>
                </>
              ) : (
                <>
                  <span className="text-[10px] font-mono font-bold bg-primary-bg text-text-mid rounded px-1.5 py-0.5 w-10 text-center shrink-0">{s.shortLabel}</span>
                  <span className="text-xs font-semibold text-text flex-1">{s.name}</span>
                  <button disabled={i === 0} onClick={() => run(moveSeniority)(s.id, 'up')}
                    className="text-text-light bg-transparent border-0 cursor-pointer hover:text-primary disabled:opacity-30 disabled:cursor-default px-1" title="More junior">↑</button>
                  <button disabled={i === seniorities.length - 1} onClick={() => run(moveSeniority)(s.id, 'down')}
                    className="text-text-light bg-transparent border-0 cursor-pointer hover:text-primary disabled:opacity-30 disabled:cursor-default px-1" title="More senior">↓</button>
                  <button onClick={() => startEditSen(s)} className="text-[10px] text-text-mid bg-transparent border-0 cursor-pointer hover:text-primary px-1">Edit</button>
                  <button onClick={() => run(deleteSeniority)(s.id)} className="text-[10px] text-danger bg-transparent border-0 cursor-pointer hover:text-danger/80 px-1">Delete</button>
                </>
              )}
            </div>
          ))}
          {seniorities.length === 0 && <p className="text-xs text-text-light py-2">No seniority levels yet.</p>}
        </div>

        <div className="flex gap-2 items-end pt-3 border-t border-border-light flex-wrap">
          <div>
            <label className="block text-[10px] font-semibold text-text-mid mb-1">Short</label>
            <input value={newSenShort} onChange={(e) => setNewSenShort(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNewSeniority(); } }}
              placeholder="Ld" className={`w-16 ${inputCls} py-1.5`} />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] font-semibold text-text-mid mb-1">New seniority</label>
            <input value={newSenName} onChange={(e) => setNewSenName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNewSeniority(); } }}
              placeholder="e.g. Lead" className={`w-full ${inputCls} py-1.5`} />
          </div>
          <Button type="button" onClick={addNewSeniority}>Add seniority</Button>
        </div>
      </div>
    </div>
  );
}
