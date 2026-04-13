import { useState } from 'react';

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

function Section({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-text-light font-semibold mb-1">
        {label}
      </div>
      <div className="text-xs text-text whitespace-pre-wrap">{value}</div>
    </div>
  );
}

export default function OneOnOneCard({ record, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  const author = record.authorUser;
  const authorName = author?.name || author?.email || 'Unknown';
  const canEdit = !!record.authorUserId; // server decides; button hidden if update fails
  const hasPrivate = record.managerPersonalNotes != null && record.managerPersonalNotes !== '';

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-primary-bg"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-lg">{expanded ? '▾' : '▸'}</div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-text">
              {formatDate(record.meetingDate)}
            </div>
            <div className="text-[11px] text-text-light truncate">
              by {authorName}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {canEdit && (
            <button
              onClick={onEdit}
              className="text-xs font-semibold text-primary bg-transparent border border-primary rounded px-2 py-1 cursor-pointer hover:bg-primary hover:text-white"
            >
              Edit
            </button>
          )}
          <button
            onClick={onDelete}
            className="text-xs font-semibold text-danger bg-transparent border border-danger rounded px-2 py-1 cursor-pointer hover:bg-danger hover:text-white"
          >
            Delete
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-border-light space-y-3">
          <Section label="General status" value={record.generalStatus} />
          <Section label="Good sides" value={record.goodSides} />
          <Section label="Bad sides" value={record.badSides} />
          <Section label="Suggestions" value={record.suggestions} />
          <Section label="Personal notes" value={record.personalNotes} />
          <Section label="Career development" value={record.careerDevelopment} />

          {hasPrivate && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-amber-700">🔒</span>
                <div className="text-[10px] uppercase tracking-wider text-amber-800 font-semibold">
                  My personal notes (private to me)
                </div>
              </div>
              <div className="text-xs text-text whitespace-pre-wrap">
                {record.managerPersonalNotes}
              </div>
            </div>
          )}

          {!record.generalStatus &&
            !record.goodSides &&
            !record.badSides &&
            !record.suggestions &&
            !record.personalNotes &&
            !record.careerDevelopment &&
            !hasPrivate && (
              <div className="text-xs text-text-light italic">No notes recorded.</div>
            )}
        </div>
      )}
    </div>
  );
}
