import { useState } from 'react';
import { api } from '../../lib/api';
import { ReplyIcon } from './icons';

/** Compact reply thread on an entry (used in the 1:1 and PM review cockpits).
 * The composer is collapsed behind a reply icon until you click it. */
export default function MiniThread({ personId, log, onUpdated }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const comments = log.comments || [];

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setErr('');
    try {
      const created = await api.addLogComment(personId, log.id, text.trim());
      onUpdated({ ...log, comments: [...comments, created] });
      setText('');
    } catch (error) {
      setErr(error.message || 'Failed to reply');
    }
    setBusy(false);
  };

  const hasContent = comments.length > 0 || open;

  return (
    <div className={hasContent ? 'mt-1.5 pt-1.5 border-t border-border-light' : 'mt-1'}>
      {comments.map((c) => (
        <div key={c.id} className="text-[11px] text-text py-0.5">
          <span className="font-semibold text-text-mid">{c.authorUser?.name || '—'}:</span>{' '}
          {c.content}
        </div>
      ))}
      {open ? (
        <form onSubmit={send} className="flex items-center gap-1 mt-1">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Reply…"
            maxLength={2000}
            autoFocus
            onBlur={() => { if (!text.trim()) setOpen(false); }}
            className="flex-1 min-w-0 px-2 py-1 border border-border rounded text-[11px] text-text outline-none focus:border-primary bg-white"
          />
          <button
            type="submit"
            disabled={busy || !text.trim()}
            aria-label="Send reply"
            className="text-white bg-primary border-0 rounded px-2 py-1 cursor-pointer hover:opacity-90 disabled:opacity-40"
          >
            <ReplyIcon size={12} />
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Reply"
          title="Reply"
          className="mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-md text-text-light bg-transparent border-0 cursor-pointer p-0 hover:text-primary hover:bg-primary-bg"
        >
          <ReplyIcon size={13} />
        </button>
      )}
      {err && <div className="text-[10px] text-danger mt-0.5">{err}</div>}
    </div>
  );
}
