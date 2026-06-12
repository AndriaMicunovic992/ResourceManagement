import { useState } from 'react';
import { api } from '../../lib/api';
import { ReplyIcon } from './icons';

/** Compact reply thread on an entry (used in the 1:1 and PM review cockpits). */
export default function MiniThread({ personId, log, onUpdated }) {
  const [text, setText] = useState('');
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

  return (
    <div className="mt-1.5 pt-1.5 border-t border-border-light">
      {comments.map((c) => (
        <div key={c.id} className="text-[11px] text-text py-0.5">
          <span className="font-semibold text-text-mid">{c.authorUser?.name || '—'}:</span>{' '}
          {c.content}
        </div>
      ))}
      <form onSubmit={send} className="flex items-center gap-1 mt-1">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Reply…"
          maxLength={2000}
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
      {err && <div className="text-[10px] text-danger mt-0.5">{err}</div>}
    </div>
  );
}
