import { useState } from 'react';
import Modal from '../ui/Modal';
import Field from '../ui/Field';
import Button from '../ui/Button';
import StatusPicker from '../ui/StatusPicker';
import { DOMAINS, SENIORITIES, fteToHours, hoursToFte } from '../../lib/constants';

export default function NeedForm({ initial, project, onSave, onClose }) {
  const [domain, setDomain] = useState(initial?.domain || 'Web');
  const [role, setRole] = useState(initial?.role || 'FE');
  const [seniority, setSeniority] = useState(initial?.seniority || 'Medior');
  const [label, setLabel] = useState(initial?.label || '');
  const [startMonth, setStartMonth] = useState(initial?.startMonth || project?.startMonth || '');
  const [endMonth, setEndMonth] = useState(initial?.endMonth || project?.endMonth || '');
  const initialFte = (() => {
    if (!initial?.monthAllocations) return 1.0;
    const vals = Object.values(initial.monthAllocations).filter((v) => v > 0);
    return vals.length > 0 ? vals[0] : 1.0;
  })();
  const [ftePerMonth, setFtePerMonth] = useState(initialFte);
  const [hoursPerMonth, setHoursPerMonth] = useState(fteToHours(initialFte));
  const [status, setStatus] = useState(initial?.status || 'realised');

  const handleFteChange = (v) => {
    setFtePerMonth(v);
    const n = parseFloat(v);
    if (!isNaN(n)) setHoursPerMonth(fteToHours(n));
  };

  const handleHoursChange = (e) => {
    const v = e.target.value;
    setHoursPerMonth(v);
    const n = parseFloat(v);
    if (!isNaN(n)) setFtePerMonth(hoursToFte(n));
  };

  const handleDomainChange = (d) => {
    setDomain(d);
    setRole(DOMAINS[d].roles[0]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      projectId: project?.id,
      domain, role, seniority,
      label: label.trim() || null,
      startMonth: startMonth || null,
      endMonth: endMonth || null,
      ftePerMonth: parseFloat(ftePerMonth),
      status,
    });
  };

  return (
    <Modal title={initial ? 'Edit Need' : 'New Need'} onClose={onClose} wide>
      <form onSubmit={handleSubmit}>
        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-text-mid mb-1">Domain</label>
            <select value={domain} onChange={(e) => handleDomainChange(e.target.value)}
              className="w-full px-2 py-1.5 border border-border rounded-lg text-xs text-text bg-white">
              {Object.keys(DOMAINS).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-semibold text-text-mid mb-1">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}
              className="w-full px-2 py-1.5 border border-border rounded-lg text-xs text-text bg-white">
              {DOMAINS[domain].roles.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-semibold text-text-mid mb-1">Seniority</label>
            <select value={seniority} onChange={(e) => setSeniority(e.target.value)}
              className="w-full px-2 py-1.5 border border-border rounded-lg text-xs text-text bg-white">
              {SENIORITIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <Field label="Label (optional)">
          <input value={label} onChange={(e) => setLabel(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm text-text outline-none focus:border-primary"
            placeholder="e.g. Lead FE" />
        </Field>
        <div className="flex gap-4">
          <Field label="Start">
            <input type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)}
             
              className="px-3 py-2 border border-border rounded-lg text-sm text-text outline-none focus:border-primary" />
          </Field>
          <Field label="End">
            <input type="month" value={endMonth} onChange={(e) => setEndMonth(e.target.value)}
             
              className="px-3 py-2 border border-border rounded-lg text-sm text-text outline-none focus:border-primary" />
          </Field>
        </div>
        <Field label="FTE per month">
          <div className="flex items-center gap-3">
            <input type="range" min="0.1" max="2.0" step="0.1" value={ftePerMonth}
              onChange={(e) => handleFteChange(e.target.value)}
              className="flex-1" />
            <input type="number" min="0.01" max="2.0" step="0.01" value={ftePerMonth}
              onChange={(e) => handleFteChange(e.target.value)}
              className="w-20 px-2 py-1 border border-border rounded-lg text-sm font-mono text-text outline-none focus:border-primary text-center" />
            <span className="text-[10px] text-text-light">FTE</span>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <input type="number" min="0" step="1" value={hoursPerMonth}
              onChange={handleHoursChange}
              className="w-24 px-2 py-1 border border-border rounded-lg text-sm font-mono text-text outline-none focus:border-primary text-center" />
            <span className="text-[10px] text-text-light">hours / month</span>
          </div>
        </Field>
        <Field label="Status">
          <StatusPicker value={status} onChange={setStatus} />
        </Field>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit">Save</Button>
        </div>
      </form>
    </Modal>
  );
}
