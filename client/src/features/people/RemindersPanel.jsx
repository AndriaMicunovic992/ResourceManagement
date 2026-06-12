import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { ChatIcon, PencilIcon, SignalIcon, XIcon } from '../../components/ui/icons';

const TYPE_META = {
  oneOnOne: { Icon: ChatIcon, iconClass: 'text-primary', badge: 'bg-primary-light text-primary', label: '1:1 due' },
  pmUpdate: { Icon: PencilIcon, iconClass: 'text-warning', badge: 'bg-warning-bg text-warning', label: 'Update due' },
  clientSignal: { Icon: SignalIcon, iconClass: 'text-danger', badge: 'bg-danger-bg text-danger', label: 'Signal missing' },
};

function daysAgo(iso) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function describe(item) {
  if (item.type === 'oneOnOne') {
    return item.lastAt
      ? `last 1:1 was ${daysAgo(item.lastAt)} days ago`
      : 'no 1:1 recorded yet';
  }
  if (item.type === 'pmUpdate') {
    return item.lastAt
      ? `your last update was ${daysAgo(item.lastAt)} days ago · ${item.customerName}`
      : `no updates from you yet · ${item.customerName}`;
  }
  return `no rating for this month yet · ${item.customerName}`;
}

function linkFor(item) {
  if (item.type === 'oneOnOne') return `/people/${item.resourceId}/oneonones`;
  // PM duties land in the customer review cockpit, where both are entered.
  return `/customers/${item.customerId}/review`;
}

/**
 * In-app due queue: overdue 1:1s for people YOU manage, stale updates and
 * missing monthly signals for customers YOU are responsible for. Items can be
 * dismissed (e.g. the person was on leave) — cadence items re-arm after
 * another cadence window, signals re-arm next month.
 */
export default function RemindersPanel() {
  const [items, setItems] = useState([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getMyReminders()
      .then((data) => {
        if (!cancelled) setItems(Array.isArray(data) ? data : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (items.length === 0) return null;

  const shown = expanded ? items : items.slice(0, 5);

  const handleDismiss = async (item) => {
    // Optimistic: remove locally, fire-and-forget the dismissal.
    setItems((prev) => prev.filter((x) => x !== item));
    try {
      await api.dismissReminder({
        type: item.type,
        resourceId: item.resourceId,
        customerId: item.customerId || null,
      });
    } catch {
      /* it will simply reappear on next load */
    }
  };

  return (
    <div className="bg-white rounded-xl border border-border shadow-card p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-text uppercase tracking-wider m-0">
          Due ({items.length})
        </h3>
        {items.length > 5 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[11px] font-semibold text-primary bg-transparent border-0 cursor-pointer hover:underline"
          >
            {expanded ? 'Show less' : `Show all ${items.length}`}
          </button>
        )}
      </div>
      <div className="space-y-1">
        {shown.map((item, i) => {
          const meta = TYPE_META[item.type] || TYPE_META.oneOnOne;
          return (
            <div
              key={`${item.type}-${item.resourceId}-${item.customerId || ''}-${i}`}
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-primary-bg/50"
            >
              <Link to={linkFor(item)} className="flex items-center gap-2.5 min-w-0 flex-1 no-underline">
                <meta.Icon size={14} className={meta.iconClass} />
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${meta.badge}`}
                >
                  {meta.label}
                </span>
                <span className="text-xs font-semibold text-text truncate">{item.resourceName}</span>
                <span className="text-2xs text-text-mid truncate">{describe(item)}</span>
              </Link>
              <button
                onClick={() => handleDismiss(item)}
                title="Dismiss (e.g. on leave) — re-arms after the next cadence window"
                aria-label="Dismiss reminder"
                className="text-text-light hover:text-danger bg-transparent border-0 cursor-pointer leading-none shrink-0"
              >
                <XIcon size={13} />
              </button>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-text-light mt-2 mb-0">
        1:1s: people you manage · updates &amp; signals: customers you're responsible for.
        Configure cadences in Settings → Reminders.
      </p>
    </div>
  );
}
