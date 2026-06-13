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
    <div className="px-3.5 py-2.5 rounded-xl hover:bg-[#F7FAFC] flex items-center justify-between gap-3 transition">
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0 w-[140px]">
          <div className="text-[12.5px] font-bold text-text">
            {formatDate(record.meetingDate)}
          </div>
          <div className="text-[9.5px] font-mono text-text-light truncate mt-0.5">by {authorName}</div>
        </div>
        {record.overallScore != null && (
          <span className="text-[9.5px] font-bold px-2.5 py-1 rounded-full bg-primary-light text-primary shrink-0">
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
        <div className="flex items-center gap-1.5 shrink-0">
          <Link
            to={`/people/${record.resourceId}/oneonones/${record.id}/cockpit`}
            className="text-[11px] font-bold text-white bg-primary border-0 rounded-lg px-3 py-1.5 no-underline hover:brightness-105"
          >
            Cockpit
          </Link>
          <button
            onClick={onEdit}
            className="text-[11px] font-bold text-text-mid bg-white border border-border-light rounded-lg px-3 py-1.5 cursor-pointer hover:bg-primary-bg"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="text-[11px] font-bold text-danger bg-danger-bg border-0 rounded-lg px-3 py-1.5 cursor-pointer hover:brightness-95"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
