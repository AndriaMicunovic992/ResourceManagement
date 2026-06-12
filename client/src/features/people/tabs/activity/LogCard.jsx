import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../../lib/api';
import { LOG_KIND_COLORS, LOG_KIND_LABELS } from '../../../../lib/constants';
import { CategoryChips } from '../../../../components/forms/CategoryMultiPicker';
import {
  BuildingIcon,
  FolderIcon,
  LinkIcon,
  ChatIcon,
  ChartIcon,
} from '../../../../components/ui/icons';

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

export default function LogCard({
  log,
  currentUserId,
  resourceId,
  subjectUserId,
  canComment = false,
  onEdit,
  onDelete,
}) {
  const isAuthor = log.authorUserId === currentUserId;
  const showActions = isAuthor && (onEdit || onDelete);
  // Kinds are shared between self-journal and observer entries, so the source
  // badge is authorship-based: did the subject write this about themselves?
  const isEmployeeInput = !!subjectUserId && log.authorUserId === subjectUserId;
  const sourceBorder = isEmployeeInput ? 'border-l-blue-400' : 'border-l-purple-400';
  const sourceBadge = isEmployeeInput
    ? 'bg-blue-50 text-blue-700 border border-blue-200'
    : 'bg-purple-50 text-purple-700 border border-purple-200';
  const sourceLabel = isEmployeeInput ? 'Employee' : 'Manager';

  const [comments, setComments] = useState(log.comments || []);
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [commentError, setCommentError] = useState('');

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setPosting(true);
    setCommentError('');
    try {
      const created = await api.addLogComment(resourceId, log.id, newComment.trim());
      setComments((prev) => [...prev, created]);
      setNewComment('');
    } catch (err) {
      setCommentError(err.message || 'Failed to comment');
    }
    setPosting(false);
  };

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
            LOG_KIND_COLORS[log.kind] || LOG_KIND_COLORS.note
          }`}
        >
          {LOG_KIND_LABELS[log.kind] || log.kind}
        </span>
      </div>
      <div className="text-sm text-text whitespace-pre-wrap mb-2">{log.content}</div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        <CategoryChips categories={log.categories} />
        {log.customer && (
          <span className="text-2xs font-semibold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 inline-flex items-center gap-1">
            <BuildingIcon size={11} /> {log.customer.name}
          </span>
        )}
        {log.project && (
          <span className="text-2xs font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 inline-flex items-center gap-1">
            <FolderIcon size={11} /> {log.project.name}
          </span>
        )}
        {log.jiraUrl && (
          <a
            href={log.jiraUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-2xs font-semibold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 no-underline inline-flex items-center gap-1"
          >
            <LinkIcon size={11} /> Jira
          </a>
        )}
        {log.oneOnOne && resourceId && (
          <Link
            to={`/people/${resourceId}/oneonones`}
            className="text-2xs font-semibold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 no-underline inline-flex items-center gap-1"
          >
            <ChatIcon size={11} /> From 1:1 on {formatDate(log.oneOnOne.meetingDate)}
          </Link>
        )}
        {log.evaluationId && resourceId && (
          <Link
            to={`/people/${resourceId}/performance`}
            className="text-2xs font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 no-underline inline-flex items-center gap-1"
          >
            <ChartIcon size={11} /> Tied to evaluation
          </Link>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="text-2xs text-text-mid">
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

      {/* Thread: PM ↔ manager correspondence about this entry. */}
      {(comments.length > 0 || canComment) && (
        <div className="mt-3 pt-2 border-t border-border-light">
          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2 py-1.5">
              <div className="w-1 self-stretch rounded bg-border-light" />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] text-text-light">
                  {c.authorUser?.name || c.authorUser?.email || 'Unknown'} ·{' '}
                  {formatDate(c.createdAt)}
                </div>
                <div className="text-xs text-text whitespace-pre-wrap">{c.content}</div>
              </div>
            </div>
          ))}
          {canComment && (
            <form onSubmit={handleAddComment} className="flex items-center gap-2 mt-1">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Reply…"
                maxLength={2000}
                className="flex-1 px-2 py-1.5 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white"
              />
              <button
                type="submit"
                disabled={posting || !newComment.trim()}
                className="text-[11px] font-semibold text-white bg-primary border-0 rounded px-3 py-1.5 cursor-pointer hover:opacity-90 disabled:opacity-50"
              >
                {posting ? '…' : 'Reply'}
              </button>
            </form>
          )}
          {commentError && (
            <div className="text-[10px] text-danger mt-1">{commentError}</div>
          )}
        </div>
      )}
    </div>
  );
}
