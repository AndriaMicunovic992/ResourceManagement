import { useState } from 'react';
import Modal from '../ui/Modal';
import Field from '../ui/Field';
import Button from '../ui/Button';
import RolePicker from './RolePicker';
import { fteToHours, hoursToFte } from '../../lib/constants';
import { useData } from '../../contexts/DataContext';

export default function ResourceForm({ initial, onSave, onClose }) {
  const { teams } = useData();
  const [name, setName] = useState(initial?.name || '');
  const [capacity, setCapacity] = useState(initial?.capacity ?? 1);
  const [capacityHours, setCapacityHours] = useState(fteToHours(initial?.capacity ?? 1));
  const [teamId, setTeamId] = useState(initial?.teamId || '');
  const [roles, setRoles] = useState(
    initial?.roles?.length ? initial.roles.map((r) => ({ domain: r.domain, role: r.role, seniority: r.seniority }))
      : [{ domain: 'Web', role: 'FE', seniority: 'Medior' }]
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), capacity: parseFloat(capacity), teamId: teamId || null, roles });
  };

  return (
    <Modal title={initial ? 'Edit Person' : 'New Person'} onClose={onClose} wide>
      <form onSubmit={handleSubmit}>
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm text-text outline-none focus:border-primary" autoFocus />
        </Field>
        <Field label="FTE Capacity">
          <div className="flex items-center gap-2">
            <input type="number" step="0.1" min="0.1" max="1" value={capacity}
              onChange={(e) => {
                setCapacity(e.target.value);
                const n = parseFloat(e.target.value);
                if (!isNaN(n)) setCapacityHours(fteToHours(n));
              }}
              className="w-24 px-3 py-2 border border-border rounded-lg text-sm text-text outline-none focus:border-primary font-mono" />
            <span className="text-[10px] text-text-light">FTE</span>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <input type="number" step="1" min="0" value={capacityHours}
              onChange={(e) => {
                setCapacityHours(e.target.value);
                const n = parseFloat(e.target.value);
                if (!isNaN(n)) setCapacity(hoursToFte(n));
              }}
              className="w-24 px-3 py-2 border border-border rounded-lg text-sm text-text outline-none focus:border-primary font-mono" />
            <span className="text-[10px] text-text-light">hours / month</span>
          </div>
        </Field>
        <Field label="Team">
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm text-text outline-none focus:border-primary bg-white">
            <option value="">No team</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        <Field label="Roles">
          <RolePicker roles={roles} onChange={setRoles} />
        </Field>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit">Save</Button>
        </div>
      </form>
    </Modal>
  );
}
