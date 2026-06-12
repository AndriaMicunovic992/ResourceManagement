import { useState } from 'react';
import Modal from '../ui/Modal';
import Field from '../ui/Field';
import Button from '../ui/Button';
import StatusPicker from '../ui/StatusPicker';
import { useData } from '../../contexts/DataContext';

export default function ProjectForm({ initial, onSave, onClose }) {
  const { customers, resources } = useData();
  const [name, setName] = useState(initial?.name || '');
  const [customerId, setCustomerId] = useState(initial?.customerId || customers[0]?.id || '');
  const [status, setStatus] = useState(initial?.status || 'realised');
  const [responsiblePersonId, setResponsiblePersonId] = useState(initial?.responsiblePersonId || '');

  const sortedResources = [...resources].sort((a, b) => a.name.localeCompare(b.name));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !customerId) return;
    // No start/end here — the project's range is inherited from its needs.
    onSave({ name: name.trim(), customerId, status, responsiblePersonId: responsiblePersonId || null });
  };

  return (
    <Modal title={initial ? 'Edit Project' : 'New Project'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm text-text outline-none focus:border-primary" autoFocus />
        </Field>
        <Field label="Customer">
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm text-text outline-none focus:border-primary bg-white">
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Responsible Person">
          <select value={responsiblePersonId} onChange={(e) => setResponsiblePersonId(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm text-text outline-none focus:border-primary bg-white">
            <option value="">None</option>
            {sortedResources.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
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
