import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';

const TYPE_META = {
  oneOnOne: { icon: '💬', badge: 'bg-primary-light text-primary', label: '1:1 due' },
  pmUpdate: { icon: '📝', badge: 'bg-warning-bg text-warning', label: 'Update due' },
  clientSignal: { icon: '📡', badge: 'bg-danger-bg text-danger', label: 'Signal missing' },
};

function describe(item) {
  if (item.type === 'oneOnOne') {
    return item.lastAt
      ? `Last 1:1 ${new Date(item.lastAt).toLocaleDateString()}`
      : 'No 1:1 recorded yet';
  }
  if (item.type === 'pmUpdate') {
    return item.lastAt
      ? `Last update ${new Date(item.lastAt).toLocaleDateString()} · ${item.customerName}`
      : `No updates yet · ${item.customerName}`;
  }
  return `No client signal this month · ${item.customerName}`;
}

function linkFor(item) {
  if (item.type === 'oneOnOne') return `/people/${item.resourceId}/oneonones`;
  if (item.type === 'pmUpdate') return `/people/${item.resourceId}/activity`;
  return `/customers/${item.customerId}/people`;
}

/** In-app due queue: overdue 1:1s, stale PM updates, missing client signals. */
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
            <Link
              key={`${item.type}-${item.resourceId}-${item.customerId || ''}-${i}`}
              to={linkFor(item)}
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg no-underline hover:bg-primary-bg/50"
            >
              <span className="text-sm">{meta.icon}</span>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${meta.badge}`}
              >
                {meta.label}
              </span>
              <span className="text-xs font-semibold text-text truncate">{item.resourceName}</span>
              <span className="text-[11px] text-text-light truncate">{describe(item)}</span>
              {item.daysOverdue != null && item.daysOverdue > 0 && (
                <span className="text-[10px] text-danger font-semibold ml-auto shrink-0">
                  {item.daysOverdue}d overdue
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
