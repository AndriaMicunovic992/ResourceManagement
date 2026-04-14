import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../../lib/api';

const STATE_LABELS = {
  draft: 'Draft (employee)',
  employee_submitted: 'Awaiting responsible',
  responsible_submitted: 'Awaiting manager',
  finalized: 'Finalized',
};

const STATE_COLORS = {
  draft: 'bg-gray-100 text-gray-700',
  employee_submitted: 'bg-blue-100 text-blue-700',
  responsible_submitted: 'bg-amber-100 text-amber-700',
  finalized: 'bg-emerald-100 text-emerald-700',
};

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function ScoreInput({ value, disabled, onChange }) {
  // 1.0 → 5.0 in 0.5 steps
  return (
    <input
      type="number"
      step="0.5"
      min="1"
      max="5"
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => {
        const v = e.target.value === '' ? null : parseFloat(e.target.value);
        onChange(v);
      }}
      className="w-16 px-1.5 py-1 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white disabled:bg-gray-50 disabled:text-text-light"
    />
  );
}

export default function EvaluationDetail({ evaluation, currentUserId, onChange, onClose, onDeleted }) {
  const [eval_, setEval] = useState(evaluation);
  const [scoresLocal, setScoresLocal] = useState({}); // snapshotId -> {field: value}
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [overrideFinal, setOverrideFinal] = useState(eval_.overrideFinal ?? '');
  const [overrideReason, setOverrideReason] = useState(eval_.overrideReason ?? '');

  useEffect(() => {
    setEval(evaluation);
    setOverrideFinal(evaluation.overrideFinal ?? '');
    setOverrideReason(evaluation.overrideReason ?? '');
    setScoresLocal({});
  }, [evaluation]);

  const viewerKind = eval_._viewerKind;
  const isAdmin = viewerKind === 'admin';
  const isManager = viewerKind === 'manager' || isAdmin;
  const isResponsible = viewerKind === 'responsible' || isAdmin;
  const isSubject = viewerKind === 'subject';
  const state = eval_.state;
  const finalized = state === 'finalized';

  const allowEmployeeEdit = state === 'draft' && (isSubject || isAdmin);
  const allowResponsibleEdit = state === 'employee_submitted' && (isResponsible || isAdmin);
  const allowManagerEdit = state === 'responsible_submitted' && (isManager || isAdmin);

  // Subjects only see numbers (no comments/logs) when finalized.
  const subjectFinalizedView = isSubject && finalized;

  const snapshots = useMemo(() => eval_.categorySnapshots || [], [eval_]);
  const scoresById = useMemo(() => {
    const map = new Map();
    for (const s of eval_.scores || []) map.set(s.categorySnapshotId, s);
    return map;
  }, [eval_]);

  const computedFinal = eval_.computedFinal;
  const finalNumber = eval_.overrideFinal ?? computedFinal;

  const getLocal = (snapshotId, field) => {
    if (scoresLocal[snapshotId] && field in scoresLocal[snapshotId]) {
      return scoresLocal[snapshotId][field];
    }
    return scoresById.get(snapshotId)?.[field] ?? null;
  };

  const setLocal = (snapshotId, field, value) => {
    setScoresLocal((prev) => ({
      ...prev,
      [snapshotId]: { ...(prev[snapshotId] || {}), [field]: value },
    }));
  };

  const persistScore = async (snapshotId, patch) => {
    setSaving(true);
    setError('');
    try {
      await api.updateEvaluationScore(eval_.id, snapshotId, patch);
      const fresh = await api.getEvaluation(eval_.id);
      setEval(fresh);
      setScoresLocal((prev) => {
        const next = { ...prev };
        delete next[snapshotId];
        return next;
      });
      onChange?.(fresh);
    } catch (err) {
      setError(err.message || 'Failed to save');
    }
    setSaving(false);
  };

  const handleSubmit = async (transition) => {
    setSaving(true);
    setError('');
    try {
      let updated;
      if (transition === 'employee') updated = await api.submitEmployeeEvaluation(eval_.id);
      else if (transition === 'responsible') updated = await api.submitResponsibleEvaluation(eval_.id);
      else if (transition === 'finalize') {
        const payload = {};
        if (overrideFinal !== '' && overrideFinal != null) {
          payload.overrideFinal = parseFloat(overrideFinal);
          payload.overrideReason = overrideReason;
        }
        updated = await api.finalizeEvaluation(eval_.id, payload);
      }
      if (updated) {
        setEval(updated);
        onChange?.(updated);
      }
    } catch (err) {
      setError(err.message || 'Failed to transition');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this evaluation? This cannot be undone.')) return;
    setSaving(true);
    try {
      await api.deleteEvaluation(eval_.id);
      onDeleted?.(eval_.id);
    } catch (err) {
      setError(err.message || 'Failed to delete');
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-border p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-sm font-bold text-text">
            {eval_.customerNameSnapshot}
            {eval_.projectNameSnapshot ? ` · ${eval_.projectNameSnapshot}` : ''}
          </div>
          <div className="text-[11px] text-text-light mt-0.5">
            {formatDate(eval_.periodStart)} → {formatDate(eval_.periodEnd)}
            {eval_.createdByUser ? ` · created by ${eval_.createdByUser.name}` : ''}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase ${STATE_COLORS[state] || 'bg-gray-100 text-gray-700'}`}>
            {STATE_LABELS[state] || state}
          </span>
          {finalNumber != null && (
            <div className="text-2xl font-bold text-primary leading-none">
              {finalNumber.toFixed(1)}
            </div>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="text-[11px] text-text-light bg-transparent border border-border rounded px-2 py-1 cursor-pointer hover:bg-primary-bg"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="text-xs text-danger bg-danger-bg p-2 rounded mb-3">{error}</div>
      )}

      <table className="w-full text-xs">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-text-light border-b border-border">
            <th className="text-left py-1.5 font-semibold">Category</th>
            <th className="text-left py-1.5 font-semibold">Weight</th>
            {!subjectFinalizedView && <th className="text-left py-1.5 font-semibold">Self</th>}
            <th className="text-left py-1.5 font-semibold">Responsible</th>
            {!subjectFinalizedView && <th className="text-left py-1.5 font-semibold">Manager note</th>}
          </tr>
        </thead>
        <tbody>
          {snapshots.map((snap) => {
            const sc = scoresById.get(snap.id);
            return (
              <tr key={snap.id} className="border-b border-border last:border-b-0 align-top">
                <td className="py-2 pr-2">
                  <div className="font-semibold text-text">
                    {snap.categoryGroupingSnapshot
                      ? `${snap.categoryGroupingSnapshot} · ${snap.categoryNameSnapshot}`
                      : snap.categoryNameSnapshot}
                  </div>
                </td>
                <td className="py-2 pr-2 text-text-light">{snap.weightSnapshot}</td>
                {!subjectFinalizedView && (
                  <td className="py-2 pr-2">
                    <ScoreInput
                      value={getLocal(snap.id, 'employeeScore')}
                      disabled={!allowEmployeeEdit || saving}
                      onChange={(v) => {
                        setLocal(snap.id, 'employeeScore', v);
                        persistScore(snap.id, { employeeScore: v });
                      }}
                    />
                    {allowEmployeeEdit && (
                      <textarea
                        rows={2}
                        placeholder="Comment"
                        value={getLocal(snap.id, 'employeeComment') ?? ''}
                        onChange={(e) => setLocal(snap.id, 'employeeComment', e.target.value)}
                        onBlur={(e) => persistScore(snap.id, { employeeComment: e.target.value || null })}
                        className="mt-1 w-full px-1.5 py-1 border border-border rounded text-[11px] text-text outline-none focus:border-primary bg-white resize-y"
                      />
                    )}
                    {!allowEmployeeEdit && sc?.employeeComment && (
                      <div className="mt-1 text-[11px] text-text-light italic whitespace-pre-wrap">{sc.employeeComment}</div>
                    )}
                  </td>
                )}
                <td className="py-2 pr-2">
                  <ScoreInput
                    value={getLocal(snap.id, 'responsibleScore')}
                    disabled={!allowResponsibleEdit || saving}
                    onChange={(v) => {
                      setLocal(snap.id, 'responsibleScore', v);
                      persistScore(snap.id, { responsibleScore: v });
                    }}
                  />
                  {!subjectFinalizedView && allowResponsibleEdit && (
                    <textarea
                      rows={2}
                      placeholder="Comment"
                      value={getLocal(snap.id, 'responsibleComment') ?? ''}
                      onChange={(e) => setLocal(snap.id, 'responsibleComment', e.target.value)}
                      onBlur={(e) => persistScore(snap.id, { responsibleComment: e.target.value || null })}
                      className="mt-1 w-full px-1.5 py-1 border border-border rounded text-[11px] text-text outline-none focus:border-primary bg-white resize-y"
                    />
                  )}
                  {!subjectFinalizedView && !allowResponsibleEdit && sc?.responsibleComment && (
                    <div className="mt-1 text-[11px] text-text-light italic whitespace-pre-wrap">{sc.responsibleComment}</div>
                  )}
                </td>
                {!subjectFinalizedView && (
                  <td className="py-2">
                    {allowManagerEdit ? (
                      <textarea
                        rows={2}
                        placeholder="Notes"
                        value={getLocal(snap.id, 'managerComment') ?? ''}
                        onChange={(e) => setLocal(snap.id, 'managerComment', e.target.value)}
                        onBlur={(e) => persistScore(snap.id, { managerComment: e.target.value || null })}
                        className="w-full px-1.5 py-1 border border-border rounded text-[11px] text-text outline-none focus:border-primary bg-white resize-y"
                      />
                    ) : (
                      sc?.managerComment ? (
                        <div className="text-[11px] text-text-light italic whitespace-pre-wrap">{sc.managerComment}</div>
                      ) : (
                        <span className="text-[11px] text-text-light">—</span>
                      )
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {!subjectFinalizedView && (
        <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
          <div className="text-[11px] text-text-light">
            Computed: <span className="text-text font-semibold">{computedFinal != null ? computedFinal.toFixed(1) : '—'}</span>
            {eval_.overrideFinal != null && (
              <>
                {' · '}
                Override: <span className="text-text font-semibold">{eval_.overrideFinal.toFixed(1)}</span>
                {eval_.overrideReason && (
                  <span className="ml-1 italic text-text-light">({eval_.overrideReason})</span>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {allowEmployeeEdit && (
              <button
                onClick={() => handleSubmit('employee')}
                disabled={saving}
                className="text-xs font-semibold text-white bg-primary border-0 rounded px-3 py-1.5 cursor-pointer hover:opacity-90 disabled:opacity-50"
              >
                Submit self-assessment
              </button>
            )}
            {allowResponsibleEdit && (
              <button
                onClick={() => handleSubmit('responsible')}
                disabled={saving}
                className="text-xs font-semibold text-white bg-primary border-0 rounded px-3 py-1.5 cursor-pointer hover:opacity-90 disabled:opacity-50"
              >
                Submit responsible scores
              </button>
            )}
            {allowManagerEdit && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="5"
                  placeholder="Override"
                  value={overrideFinal}
                  onChange={(e) => setOverrideFinal(e.target.value)}
                  className="w-20 px-1.5 py-1 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white"
                />
                <input
                  type="text"
                  placeholder="Reason (required if override)"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-56 px-1.5 py-1 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white"
                />
                <button
                  onClick={() => handleSubmit('finalize')}
                  disabled={saving}
                  className="text-xs font-semibold text-white bg-primary border-0 rounded px-3 py-1.5 cursor-pointer hover:opacity-90 disabled:opacity-50"
                >
                  Finalize
                </button>
              </div>
            )}
            {isAdmin && (
              <button
                onClick={handleDelete}
                disabled={saving}
                className="text-xs font-semibold text-danger bg-transparent border border-danger rounded px-3 py-1.5 cursor-pointer hover:bg-danger hover:text-white disabled:opacity-50"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      )}

      {!subjectFinalizedView && eval_.logs && eval_.logs.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <div className="text-[10px] uppercase tracking-wider text-text-light font-semibold mb-1.5">
            Tied logs ({eval_.logs.length})
          </div>
          <div className="space-y-1">
            {eval_.logs.map((l) => (
              <div key={l.id} className="text-[11px] text-text">
                <span className="text-text-light">{formatDate(l.createdAt)}</span> · <span className="uppercase font-semibold">{l.kind}</span> · {l.content}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
