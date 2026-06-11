import { Link } from 'react-router-dom';

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

/**
 * Flat 1:1 row — all detail work happens in the cockpit. No expansion, no
 * inline entry editing here.
 */
export default function OneOnOneCard({ record, onEdit, onDelete, readOnly = false }) {
  const author = record.authorUser;
  const authorName = author?.name || author?.email || 'Unknown';

  return (
    <div className="bg-white rounded-xl border border-border px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-text">
            {formatDate(record.meetingDate)}
          </div>
          <div className="text-[11px] text-text-light truncate">by {authorName}</div>
        </div>
        {record.overallScore != null && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-light text-primary shrink-0">
            Pulse {record.overallScore}/5
          </span>
        )}
        {record.wentWell && (
          <span className="text-[11px] text-text-light truncate hidden sm:inline">
            {record.wentWell.slice(0, 80)}
            {record.wentWell.length > 80 ? '…' : ''}
          </span>
        )}
      </div>
      {!readOnly && (
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to={`/people/${record.resourceId}/oneonones/${record.id}/cockpit`}
            className="text-xs font-semibold text-white bg-primary border border-primary rounded px-2 py-1 no-underline hover:opacity-90"
          >
            Cockpit
          </Link>
          <button
            onClick={onEdit}
            className="text-xs font-semibold text-primary bg-transparent border border-primary rounded px-2 py-1 cursor-pointer hover:bg-primary hover:text-white"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="text-xs font-semibold text-danger bg-transparent border border-danger rounded px-2 py-1 cursor-pointer hover:bg-danger hover:text-white"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
