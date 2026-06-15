import { useState } from 'react';
import Modal from '../ui/Modal';
import Field from '../ui/Field';
import Button from '../ui/Button';
import StatusPicker from '../ui/StatusPicker';
import { useData } from '../../contexts/DataContext';

export default function CustomerForm({ initial, onSave, onClose }) {
  const { members } = useData();
  const [name, setName] = useState(initial?.name || '');
  const [status, setStatus] = useState(initial?.status || 'realised');
  const [responsibleUserId, setResponsibleUserId] = useState(
    initial?.responsibleUserId || ''
  );

  // Responsible person can be any org member (not only staffable people).
  // Viewers can't act on responsibilities, so they're excluded.
  const eligible = members.filter(
    (m) => m.role !== 'viewer' || m.user?.id === initial?.responsibleUserId,
  );
  const sorted = [...eligible].sort((a, b) =>
    (a.user?.name || a.user?.email || '').localeCompare(b.user?.name || b.user?.email || ''),
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      status,
      responsibleUserId: responsibleUserId || null,
    });
  };

  return (
    <Modal title={initial ? 'Edit Customer' : 'New Customer'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="Name">
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm text-text outline-none focus:border-primary"
            autoFocus
          />
        </Field>
        <Field label="Responsible Person">
          <select
            value={responsibleUserId}
            onChange={(e) => setResponsibleUserId(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm text-text outline-none focus:border-primary bg-white"
          >
            <option value="">None</option>
            {sorted.map((m) => (
              <option key={m.user?.id} value={m.user?.id}>{m.user?.name || m.user?.email}</option>
            ))}
          </select>
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
