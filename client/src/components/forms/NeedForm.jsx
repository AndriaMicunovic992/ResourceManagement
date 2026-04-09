import { useState } from 'react';
import Modal from '../ui/Modal';
import Field from '../ui/Field';
import Button from '../ui/Button';
import StatusPicker from '../ui/StatusPicker';
import { DOMAINS, SENIORITIES } from '../../lib/constants';

export default function NeedForm({ initial, project, onSave, onClose }) {
  const [domain, setDomain] = useState(initial?.domain || 'Web');
  const [role, setRole] = useState(initial?.role || 'FE');
  const [seniority, setSeniority] = useState(initial?.seniority || 'Medior');
  const [label, setLabel] = useState(initial?.label || '');
  const [startMonth, setStartMonth] = useState(initial?.startMonth || project?.startMonth || '');
  const [endMonth, setEndMonth] = useState(initial?.endMonth || project?.endMonth || '');
  const [ftePerMonth, setFtePerMonth] = useState(initial ? 1.0 : 1.0);
  const [status, setStatus] = useState(initial?.status || 'realised');

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
              min={project?.startMonth} max={project?.endMonth}
              className="px-3 py-2 border border-border rounded-lg text-sm text-text outline-none focus:border-primary" />
          </Field>
          <Field label="End">
            <input type="month" value={endMonth} onChange={(e) => setEndMonth(e.target.value)}
              min={project?.startMonth} max={project?.endMonth}
              className="px-3 py-2 border border-border rounded-lg text-sm text-text outline-none focus:border-primary" />
          </Field>
        </div>
        <Field label={`FTE per month: ${ftePerMonth}`}>
          <input type="range" min="0.1" max="2.0" step="0.1" value={ftePerMonth}
            onChange={(e) => setFtePerMonth(e.target.value)}
            className="w-full" />
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
