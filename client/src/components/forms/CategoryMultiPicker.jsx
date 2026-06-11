import { useMemo } from 'react';

/**
 * Toggleable chips for picking one or more performance categories
 * (dimensions). An entry can evidence several — e.g. one incident spanning
 * delivery and communication.
 */
export default function CategoryMultiPicker({ logCategories, value = [], onChange }) {
  const selected = new Set(value);

  const visible = useMemo(() => {
    // Active categories, plus any inactive ones still selected on this entry.
    return logCategories.filter((c) => c.active !== false || selected.has(c.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logCategories, value]);

  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  };

  if (visible.length === 0) {
    return <div className="text-[10px] text-text-light">No categories configured.</div>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((c) => {
        const on = selected.has(c.id);
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => toggle(c.id)}
            title={c.grouping ? `${c.grouping} · ${c.name}` : c.name}
            className={`text-[10px] font-semibold px-2 py-1 rounded-full border cursor-pointer ${
              on
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-text-mid border-border hover:border-primary'
            }`}
          >
            {c.name}
          </button>
        );
      })}
    </div>
  );
}

/** Render an entry's categories as static chips. */
export function CategoryChips({ categories }) {
  if (!categories || categories.length === 0) return null;
  return (
    <>
      {categories.map((c) => (
        <span
          key={c.id}
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary-light text-primary"
        >
          {c.grouping ? `${c.grouping} · ${c.name}` : c.name}
        </span>
      ))}
    </>
  );
}
