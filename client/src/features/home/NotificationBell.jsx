import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { LOG_KIND_LABELS } from '../../lib/constants';
import { firstName } from '../../lib/resourceUtils';

function timeAgo(date) {
  const d = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (d <= 0) return 'today';
  if (d === 1) return '1d ago';
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

function Row({ icon, iconBg, title, sub, meta, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-2.5 px-3 py-2 text-left cursor-pointer border-0 bg-transparent hover:bg-primary-bg/60"
    >
      <span className="w-7 h-7 rounded-lg flex items-center justify-center text-[12px] shrink-0 mt-0.5" style={{ background: iconBg }}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-text leading-snug">{title}</span>
        {sub && <span className="block text-[10.5px] text-text-mid truncate">{sub}</span>}
      </span>
      {meta && <span className="text-[9.5px] text-text-light shrink-0 mt-0.5">{meta}</span>}
    </button>
  );
}

function Group({ label, children }) {
  return (
    <div className="py-1">
      <div className="px-3 pt-1.5 pb-1 text-[9px] font-bold uppercase tracking-wider text-text-light">{label}</div>
      {children}
    </div>
  );
}

/** Header bell: thread replies + performance-review reminders + cadence reminders. */
export default function NotificationBell() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    let dead = false;
    api.getNotifications().then((d) => { if (!dead) setData(d); }).catch(() => {});
    return () => { dead = true; };
  }, []);

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const replies = data?.replies || [];
  const reviews = data?.reviews || [];
  const reminders = data?.reminders || [];
  const total = replies.length + reviews.length + reminders.length;

  const go = (to) => { setOpen(false); navigate(to); };

  const reminderTarget = (r) =>
    r.type === 'oneOnOne' ? `/people/${r.resourceId}/oneonones` : `/customers/${r.customerId}/review`;
  const reminderText = (r) =>
    r.type === 'oneOnOne'
      ? `1:1 with ${firstName(r.resourceName)} is due`
      : `PM review due · ${r.customerName}`;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative w-9 h-9 rounded-xl bg-white border border-border-light flex items-center justify-center cursor-pointer hover:bg-primary-bg text-text-mid"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M10.3 21a1.9 1.9 0 0 0 3.4 0" /></svg>
        {total > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-danger text-white text-[9px] font-bold flex items-center justify-center">
            {total > 9 ? '9+' : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-[320px] max-h-[460px] overflow-y-auto bg-white rounded-2xl border border-border-light shadow-lg z-50">
          <div className="px-3 py-2.5 border-b border-border-light flex items-center">
            <span className="text-[13px] font-bold text-text">Notifications</span>
            <span className="flex-1" />
            {total > 0 && <span className="text-[10px] text-text-light">{total} new</span>}
          </div>

          {total === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-text-light">You're all caught up 🎉</div>
          ) : (
            <div className="divide-y divide-border-light">
              {replies.length > 0 && (
                <Group label="Replies">
                  {replies.map((r) => (
                    <Row
                      key={r.id}
                      icon="💬"
                      iconBg="#EEF1F5"
                      title={<><b>{firstName(r.author)}</b> replied on a {LOG_KIND_LABELS[r.logKind] || 'note'}</>}
                      sub={r.content}
                      meta={timeAgo(r.createdAt)}
                      onClick={() => go(r.resourceId ? `/people/${r.resourceId}/activity` : '/journal')}
                    />
                  ))}
                </Group>
              )}

              {reviews.length > 0 && (
                <Group label="Performance reviews">
                  {reviews.map((r) => (
                    <Row
                      key={r.id}
                      icon="◔"
                      iconBg="#EAFAF0"
                      title={r.title}
                      sub={r.sub}
                      onClick={() => go(r.resourceId ? `/people/${r.resourceId}/performance` : '/people')}
                    />
                  ))}
                </Group>
              )}

              {reminders.length > 0 && (
                <Group label="Reminders">
                  {reminders.map((r, i) => (
                    <Row
                      key={`${r.type}-${r.resourceId || r.customerId}-${i}`}
                      icon="🔔"
                      iconBg="#FDE8EA"
                      title={reminderText(r)}
                      sub={r.lastAt ? `Last activity ${timeAgo(r.lastAt)}` : 'Nothing on record yet'}
                      onClick={() => go(reminderTarget(r))}
                    />
                  ))}
                </Group>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
