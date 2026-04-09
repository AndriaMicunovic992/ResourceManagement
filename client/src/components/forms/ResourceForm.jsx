import { useState } from 'react';
import Modal from '../ui/Modal';
import Field from '../ui/Field';
import Button from '../ui/Button';
import RolePicker from './RolePicker';

export default function ResourceForm({ initial, onSave, onClose }) {
  const [name, setName] = useState(initial?.name || '');
  const [capacity, setCapacity] = useState(initial?.capacity ?? 1);
  const [roles, setRoles] = useState(
    initial?.roles?.length ? initial.roles.map((r) => ({ domain: r.domain, role: r.role, seniority: r.seniority }))
      : [{ domain: 'Web', role: 'FE', seniority: 'Medior' }]
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), capacity: parseFloat(capacity), roles });
  };

  return (
    <Modal title={initial ? 'Edit Resource' : 'New Resource'} onClose={onClose} wide>
      <form onSubmit={handleSubmit}>
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm text-text outline-none focus:border-primary" autoFocus />
        </Field>
        <Field label="FTE Capacity">
          <input type="number" step="0.1" min="0.1" max="1" value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm text-text outline-none focus:border-primary font-mono" />
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
