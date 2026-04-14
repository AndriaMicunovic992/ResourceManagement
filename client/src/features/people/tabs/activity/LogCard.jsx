import { Link } from 'react-router-dom';

const KIND_COLORS = {
  good: 'bg-green-100 text-green-700',
  bad: 'bg-red-100 text-red-700',
  incident: 'bg-orange-100 text-orange-700',
  observation: 'bg-gray-100 text-gray-700',
  win: 'bg-emerald-100 text-emerald-700',
  down: 'bg-amber-100 text-amber-700',
  blocker: 'bg-rose-100 text-rose-700',
};

// Employee-reported kinds (the subject logging their own wins/downs/blockers).
// Anything else is an observer entry (manager / admin / responsible).
const EMPLOYEE_KINDS = new Set(['win', 'down', 'blocker']);

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

export default function LogCard({ log, currentUserId, resourceId, onEdit, onDelete }) {
  const isAuthor = log.authorUserId === currentUserId;
  const showActions = isAuthor && (onEdit || onDelete);
  const isEmployeeInput = EMPLOYEE_KINDS.has(log.kind);
  const sourceBorder = isEmployeeInput ? 'border-l-blue-400' : 'border-l-purple-400';
  const sourceBadge = isEmployeeInput
    ? 'bg-blue-50 text-blue-700 border border-blue-200'
    : 'bg-purple-50 text-purple-700 border border-purple-200';
  const sourceLabel = isEmployeeInput ? 'Employee' : 'Manager';
  return (
    <div className={`bg-white rounded-xl border border-border border-l-4 ${sourceBorder} p-4`}>
      <div className="flex flex-wrap gap-1.5 mb-2">
        <span
          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase ${sourceBadge}`}
        >
          {sourceLabel} input
        </span>
        <span
          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase ${
            KIND_COLORS[log.kind] || KIND_COLORS.observation
          }`}
        >
          {log.kind}
        </span>
      </div>
      <div className="text-sm text-text whitespace-pre-wrap mb-2">{log.content}</div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {log.category && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary-light text-primary">
            {log.category.grouping
              ? `${log.category.grouping} · ${log.category.name}`
              : log.category.name}
          </span>
        )}
        {log.customer && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">
            🏢 {log.customer.name}
          </span>
        )}
        {log.project && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
            📁 {log.project.name}
          </span>
        )}
        {log.jiraUrl && (
          <a
            href={log.jiraUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 no-underline"
          >
            🔗 Jira
          </a>
        )}
        {log.oneOnOne && resourceId && (
          <Link
            to={`/people/${resourceId}/oneonones`}
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 no-underline"
          >
            💬 From 1:1 on {formatDate(log.oneOnOne.meetingDate)}
          </Link>
        )}
        {log.evaluationId && resourceId && (
          <Link
            to={`/people/${resourceId}/performance`}
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 no-underline"
          >
            📊 Tied to evaluation
          </Link>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] text-text-light">
          {log.authorUser?.name || log.authorUser?.email || 'Unknown'} ·{' '}
          {formatDate(log.createdAt)}
        </div>
        {showActions && (
          <div className="flex items-center gap-1.5">
            {onEdit && (
              <button
                onClick={onEdit}
                className="text-[11px] font-semibold text-primary bg-transparent border border-primary rounded px-2 py-1 cursor-pointer hover:bg-primary hover:text-white"
              >
                Edit
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="text-[11px] font-semibold text-danger bg-transparent border border-danger rounded px-2 py-1 cursor-pointer hover:bg-danger hover:text-white"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
