import { useState } from 'react';
import Modal from '../../../../components/ui/Modal';
import { useAuth } from '../../../../contexts/AuthContext';

function toDateInputValue(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

// Pre-cockpit fields: only shown when editing an old record that has content
// in them, so legacy 1:1s stay readable/editable. New records don't write them.
const LEGACY_FIELDS = [
  { key: 'generalStatus', label: 'General status (legacy)' },
  { key: 'personalNotes', label: 'Personal notes (legacy)' },
  { key: 'careerDevelopment', label: 'Career development (legacy)' },
  { key: 'managerPersonalNotes', label: 'My personal notes (legacy, private)' },
];

function RatingPicker({ label, hint, value, onChange }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-text-mid mb-1 uppercase tracking-wider">
        {label}
      </label>
      {hint && <div className="text-[10px] text-text-light mb-1">{hint}</div>}
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(value === n ? null : n)}
            className={`w-8 h-8 rounded-lg border text-xs font-bold cursor-pointer ${
              value === n
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-text-mid border-border hover:border-primary'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function OneOnOneForm({ initial, onCancel, onSave }) {
  const { user } = useAuth();
  const isEdit = !!initial;
  // On create, the current user will become the author, so they can always
  // set the private note. On edit, only the original author can.
  const isAuthor = !isEdit || (user?.id && initial?.authorUserId === user.id);

  const [meetingDate, setMeetingDate] = useState(toDateInputValue(initial?.meetingDate));
  const [overallScore, setOverallScore] = useState(initial?.overallScore ?? null);
  const [wentWell, setWentWell] = useState(initial?.wentWell || '');
  const [wentBad, setWentBad] = useState(initial?.wentBad || '');
  const [privateNote, setPrivateNote] = useState(initial?.privateNote || '');
  const [legacy, setLegacy] = useState(() => {
    const base = {};
    for (const f of LEGACY_FIELDS) base[f.key] = initial?.[f.key] || '';
    return base;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const legacyFieldsToShow = isEdit
    ? LEGACY_FIELDS.filter((f) => (initial?.[f.key] || '') !== '')
    : [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!meetingDate) {
      setError('Meeting date is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        meetingDate,
        overallScore,
        wentWell: wentWell.trim() ? wentWell : null,
        wentBad: wentBad.trim() ? wentBad : null,
      };
      for (const f of legacyFieldsToShow) {
        payload[f.key] = legacy[f.key].trim() ? legacy[f.key] : null;
      }
      if (isAuthor) {
        payload.privateNote = privateNote.trim() ? privateNote : null;
      }
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

        <RatingPicker
          label="Overall score (pulse)"
          hint="Your read on this period — distinct from formal evaluations."
          value={overallScore}
          onChange={setOverallScore}
        />

        <div>
          <label className="block text-[10px] font-semibold text-text-mid mb-1 uppercase tracking-wider">
            What went well
          </label>
          <textarea
            value={wentWell}
            onChange={(e) => setWentWell(e.target.value)}
            rows={3}
            maxLength={10000}
            className="w-full px-2 py-1.5 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white resize-y"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-text-mid mb-1 uppercase tracking-wider">
            What went bad
          </label>
          <textarea
            value={wentBad}
            onChange={(e) => setWentBad(e.target.value)}
            rows={3}
            maxLength={10000}
            className="w-full px-2 py-1.5 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white resize-y"
          />
        </div>

        {legacyFieldsToShow.map((f) => (
          <div key={f.key}>
            <label className="block text-[10px] font-semibold text-text-mid mb-1 uppercase tracking-wider">
              {f.label}
            </label>
            <textarea
              value={legacy[f.key]}
              onChange={(e) =>
                setLegacy((prev) => ({ ...prev, [f.key]: e.target.value }))
              }
              rows={3}
              maxLength={5000}
              className="w-full px-2 py-1.5 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white resize-y"
            />
          </div>
        ))}

        {isAuthor && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-amber-700">🔒</span>
              <label className="text-[10px] uppercase tracking-wider text-amber-800 font-semibold">
                Private note (only you)
              </label>
            </div>
            <div className="text-[10px] text-amber-800/80 mb-1">
              Visible only to you — not to other admins, and hidden during "view as".
            </div>
            <textarea
              value={privateNote}
              onChange={(e) => setPrivateNote(e.target.value)}
              rows={3}
              maxLength={5000}
              className="w-full px-2 py-1.5 border border-amber-300 rounded text-xs text-text outline-none focus:border-amber-500 bg-white resize-y"
            />
          </div>
        )}

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
