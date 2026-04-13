import { useState } from 'react';
import Modal from '../../../../components/ui/Modal';

function toDateInputValue(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

const TEXTAREA_FIELDS = [
  { key: 'generalStatus', label: 'General status' },
  { key: 'personalNotes', label: 'Personal notes' },
  { key: 'careerDevelopment', label: 'Career development' },
];

export default function OneOnOneForm({ initial, onCancel, onSave }) {
  const isEdit = !!initial;
  const [meetingDate, setMeetingDate] = useState(toDateInputValue(initial?.meetingDate));
  const [fields, setFields] = useState(() => {
    const base = {};
    for (const f of TEXTAREA_FIELDS) base[f.key] = initial?.[f.key] || '';
    return base;
  });
  const [managerPersonalNotes, setManagerPersonalNotes] = useState(
    initial?.managerPersonalNotes || ''
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleFieldChange = (key) => (e) => {
    setFields((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!meetingDate) {
      setError('Meeting date is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = { meetingDate };
      for (const f of TEXTAREA_FIELDS) {
        payload[f.key] = fields[f.key].trim() ? fields[f.key] : null;
      }
      payload.managerPersonalNotes = managerPersonalNotes.trim()
        ? managerPersonalNotes
        : null;
      await onSave(payload);
    } catch (err) {
      setError(err.message || 'Failed to save 1:1 meeting');
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? 'Edit 1:1 meeting' : 'New 1:1 meeting'} onClose={onCancel} wide>
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <div className="text-xs text-danger bg-danger-bg p-2 rounded">{error}</div>
        )}

        <div>
          <label className="block text-[10px] font-semibold text-text-mid mb-1 uppercase tracking-wider">
            Meeting date
          </label>
          <input
            type="date"
            value={meetingDate}
            onChange={(e) => setMeetingDate(e.target.value)}
            className="px-2 py-1.5 border border-border rounded text-sm text-text outline-none focus:border-primary bg-white"
            required
          />
        </div>

        {TEXTAREA_FIELDS.map((f) => (
          <div key={f.key}>
            <label className="block text-[10px] font-semibold text-text-mid mb-1 uppercase tracking-wider">
              {f.label}
            </label>
            <textarea
              value={fields[f.key]}
              onChange={handleFieldChange(f.key)}
              rows={3}
              maxLength={5000}
              className="w-full px-2 py-1.5 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white resize-y"
            />
          </div>
        ))}

        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-amber-700">🔒</span>
            <label className="text-[10px] uppercase tracking-wider text-amber-800 font-semibold">
              My personal notes (private to me)
            </label>
          </div>
          <div className="text-[10px] text-amber-800/80 mb-1">
            Only you can see this. Other admins will not.
          </div>
          <textarea
            value={managerPersonalNotes}
            onChange={(e) => setManagerPersonalNotes(e.target.value)}
            rows={3}
            maxLength={5000}
            className="w-full px-2 py-1.5 border border-amber-300 rounded text-xs text-text outline-none focus:border-amber-500 bg-white resize-y"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="text-xs font-semibold text-text-mid bg-transparent border border-border rounded px-3 py-1.5 cursor-pointer hover:bg-primary-bg"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="text-xs font-semibold text-white bg-primary border-0 rounded px-4 py-1.5 cursor-pointer hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
