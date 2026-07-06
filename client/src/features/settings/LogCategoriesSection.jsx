import { useState, useMemo } from 'react';
import Button from '../../components/ui/Button';
import { useData } from '../../contexts/DataContext';

/**
 * Performance-log category management (admin). Self-contained: reads categories
 * and their CRUD helpers from DataContext and owns its own edit state. Extracted
 * from SettingsView to keep that view from being a single 1,500-line component.
 */
export default function LogCategoriesSection() {
  const { logCategories, addLogCategory, updateLogCategory, deleteLogCategory } = useData();

  const [catError, setCatError] = useState('');
  const [newCatGrouping, setNewCatGrouping] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [newCatDescription, setNewCatDescription] = useState('');
  const [newCatWeight, setNewCatWeight] = useState('0');
  const [editingCatId, setEditingCatId] = useState(null);
  const [editingCatGrouping, setEditingCatGrouping] = useState('');
  const [editingCatName, setEditingCatName] = useState('');
  const [editingCatDescription, setEditingCatDescription] = useState('');
  const [editingCatWeight, setEditingCatWeight] = useState('0');

  const groupedLogCategories = useMemo(() => {
    // Categories from DataContext are already sorted by grouping/sortOrder/name.
    // Preserve that order while bucketing by grouping.
    const groups = new Map();
    for (const c of logCategories) {
      const g = c.grouping || '';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(c);
    }
    return Array.from(groups.entries()).map(([grouping, categories]) => ({ grouping, categories }));
  }, [logCategories]);

  const activeWeightSum = useMemo(
    () => logCategories.filter((c) => c.active !== false).reduce((sum, c) => sum + (c.weight || 0), 0),
    [logCategories]
  );
  const weightSumIsExact = Math.abs(activeWeightSum - 100) < 0.0001;

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setCatError('');
    const weightNum = parseFloat(newCatWeight);
    try {
      await addLogCategory({
        name: newCatName.trim(),
        grouping: newCatGrouping.trim() || null,
        description: newCatDescription.trim() || null,
        weight: Number.isFinite(weightNum) && weightNum >= 0 ? weightNum : 0,
      });
      setNewCatName('');
      setNewCatGrouping('');
      setNewCatDescription('');
      setNewCatWeight('0');
    } catch (err) {
      setCatError(err.message || 'Failed to add category');
    }
  };

  const handleStartEditCategory = (cat) => {
    setEditingCatId(cat.id);
    setEditingCatName(cat.name);
    setEditingCatGrouping(cat.grouping || '');
    setEditingCatDescription(cat.description || '');
    setEditingCatWeight(String(cat.weight ?? 0));
    setCatError('');
  };

  const handleCancelEditCategory = () => {
    setEditingCatId(null);
    setEditingCatName('');
    setEditingCatGrouping('');
    setEditingCatDescription('');
    setEditingCatWeight('0');
  };

  const handleSaveEditCategory = async () => {
    if (!editingCatName.trim()) return;
    const weightNum = parseFloat(editingCatWeight);
    try {
      await updateLogCategory(editingCatId, {
        name: editingCatName.trim(),
        grouping: editingCatGrouping.trim() || null,
        description: editingCatDescription.trim() || null,
        weight: Number.isFinite(weightNum) && weightNum >= 0 ? weightNum : 0,
      });
      handleCancelEditCategory();
    } catch (err) {
      setCatError(err.message || 'Failed to update category');
    }
  };

  const handleToggleCategoryActive = async (cat) => {
    setCatError('');
    try {
      await updateLogCategory(cat.id, { active: !(cat.active !== false) });
    } catch (err) {
      setCatError(err.message || 'Failed to update category');
    }
  };

  const handleMoveCategory = async (cat, direction) => {
    const groupSiblings = logCategories.filter((c) => (c.grouping || '') === (cat.grouping || ''));
    const idx = groupSiblings.findIndex((c) => c.id === cat.id);
    const neighborIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (neighborIdx < 0 || neighborIdx >= groupSiblings.length) return;
    const neighbor = groupSiblings[neighborIdx];
    setCatError('');
    try {
      await Promise.all([
        updateLogCategory(cat.id, { sortOrder: neighbor.sortOrder ?? 0 }),
        updateLogCategory(neighbor.id, { sortOrder: cat.sortOrder ?? 0 }),
      ]);
    } catch (err) {
      setCatError(err.message || 'Failed to reorder categories');
    }
  };

  const handleDeleteCategory = async (cat) => {
    if (!confirm('Delete category "' + cat.name + '"? This is permanent. Consider deactivating instead — logs already tagged with this category will be unlinked.')) return;
    try {
      await deleteLogCategory(cat.id);
    } catch (err) {
      setCatError(err.message || 'Failed to delete category');
    }
  };

  return (
    <div id="categories" className="scroll-mt-4 bg-white rounded-2xl border border-border-light shadow-card p-5 mb-4">
      <h3 className="text-sm font-bold text-text mb-3">Performance log categories</h3>
      <p className="text-[10px] text-text-light mb-3">
        Categories tag performance logs so you can group and filter them. Optionally use a grouping (e.g. "Technical", "Soft skills") to organise related categories together.
      </p>

      <div
        className={`flex items-center justify-between gap-3 px-3 py-2 mb-3 rounded-lg border text-[11px] ${
          weightSumIsExact
            ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
            : 'border-amber-300 bg-amber-50 text-amber-800'
        }`}
      >
        <span className="font-semibold">
          Active weights sum: {Number.isInteger(activeWeightSum) ? activeWeightSum : activeWeightSum.toFixed(2)}
          {weightSumIsExact ? ' (100)' : ' / 100'}
        </span>
        <span className="text-[10px] opacity-80">
          Weights are guidance only — any sum is allowed.
        </span>
      </div>

      {catError && (
        <div className="text-xs text-danger bg-danger-bg p-2 rounded mb-3">{catError}</div>
      )}

      <div className="space-y-3 mb-3">
        {groupedLogCategories.map((group) => (
          <div key={group.grouping || '__none__'}>
            <div className="text-[10px] uppercase tracking-wider text-text-light font-semibold mb-1">
              {group.grouping || 'Ungrouped'}
            </div>
            <div className="space-y-1">
              {group.categories.map((cat, idx) => {
                const isEditing = editingCatId === cat.id;
                const isActive = cat.active !== false;
                const isFirst = idx === 0;
                const isLast = idx === group.categories.length - 1;
                return (
                  <div
                    key={cat.id}
                    className={`py-1.5 px-2 rounded-lg hover:bg-primary-bg/30 ${
                      isActive ? '' : 'opacity-60'
                    }`}
                  >
                    {isEditing ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <input
                            type="text"
                            value={editingCatGrouping}
                            onChange={(e) => setEditingCatGrouping(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEditCategory();
                              if (e.key === 'Escape') handleCancelEditCategory();
                            }}
                            placeholder="Grouping (optional)"
                            className="w-40 px-2 py-1 border border-border rounded text-xs text-text outline-none focus:border-primary"
                          />
                          <input
                            type="text"
                            value={editingCatName}
                            onChange={(e) => setEditingCatName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEditCategory();
                              if (e.key === 'Escape') handleCancelEditCategory();
                            }}
                            autoFocus
                            placeholder="Category name"
                            className="flex-1 min-w-[120px] px-2 py-1 border border-border rounded text-xs text-text outline-none focus:border-primary"
                          />
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            value={editingCatWeight}
                            onChange={(e) => setEditingCatWeight(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEditCategory();
                              if (e.key === 'Escape') handleCancelEditCategory();
                            }}
                            placeholder="Weight"
                            className="w-20 px-2 py-1 border border-border rounded text-xs text-text outline-none focus:border-primary font-mono"
                          />
                          <button
                            onClick={handleSaveEditCategory}
                            className="text-[10px] text-primary bg-transparent border-0 cursor-pointer hover:underline px-1"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancelEditCategory}
                            className="text-[10px] text-text-light bg-transparent border-0 cursor-pointer hover:text-text-mid px-1"
                          >
                            Cancel
                          </button>
                        </div>
                        <input
                          type="text"
                          value={editingCatDescription}
                          onChange={(e) => setEditingCatDescription(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEditCategory();
                            if (e.key === 'Escape') handleCancelEditCategory();
                          }}
                          placeholder="Description (optional)"
                          maxLength={500}
                          className="w-full px-2 py-1 border border-border rounded text-xs text-text outline-none focus:border-primary"
                        />
                      </div>
                    ) : (
                      <div className="flex items-start gap-2">
                        <div className="flex flex-col items-center gap-0.5 mr-1">
                          <button
                            onClick={() => handleMoveCategory(cat, 'up')}
                            disabled={isFirst}
                            className={`text-[10px] leading-none px-1 py-0.5 bg-transparent border-0 ${
                              isFirst ? 'text-text-light cursor-not-allowed opacity-40' : 'text-text-mid cursor-pointer hover:text-primary'
                            }`}
                            aria-label="Move up"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => handleMoveCategory(cat, 'down')}
                            disabled={isLast}
                            className={`text-[10px] leading-none px-1 py-0.5 bg-transparent border-0 ${
                              isLast ? 'text-text-light cursor-not-allowed opacity-40' : 'text-text-mid cursor-pointer hover:text-primary'
                            }`}
                            aria-label="Move down"
                          >
                            ▼
                          </button>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-text">{cat.name}</span>
                            <span className="text-[10px] font-mono text-text-mid bg-primary-bg/50 px-1.5 py-0.5 rounded">
                              w {cat.weight ?? 0}
                            </span>
                            {!isActive && (
                              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-text-light/20 text-text-mid">
                                Inactive
                              </span>
                            )}
                          </div>
                          {cat.description && (
                            <div className="text-[10px] text-text-light mt-0.5">{cat.description}</div>
                          )}
                        </div>
                        <button
                          onClick={() => handleToggleCategoryActive(cat)}
                          className={`text-[10px] font-semibold border rounded px-2 py-0.5 cursor-pointer ${
                            isActive
                              ? 'text-text-mid border-border bg-white hover:bg-primary-bg'
                              : 'text-primary border-primary bg-white hover:bg-primary hover:text-white'
                          }`}
                        >
                          {isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleStartEditCategory(cat)}
                          className="text-[10px] text-text-mid bg-transparent border-0 cursor-pointer hover:text-primary px-1"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(cat)}
                          className="text-[10px] text-text-light bg-transparent border-0 cursor-pointer hover:text-danger px-1"
                          title="Permanently delete (prefer Deactivate)"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {logCategories.length === 0 && (
          <p className="text-xs text-text-light py-2">No categories yet.</p>
        )}
      </div>

      <form onSubmit={handleAddCategory} className="space-y-2 pt-3 border-t border-border-light">
        <div className="flex gap-2 items-end flex-wrap">
          <div className="w-40">
            <label className="block text-[10px] font-semibold text-text-mid mb-1">Grouping</label>
            <input
              type="text" value={newCatGrouping} onChange={(e) => setNewCatGrouping(e.target.value)}
              placeholder="optional"
              className="w-full px-3 py-1.5 border border-border rounded-lg text-xs text-text outline-none focus:border-primary"
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] font-semibold text-text-mid mb-1">Category</label>
            <input
              type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
              placeholder="e.g. Technical skills" required
              className="w-full px-3 py-1.5 border border-border rounded-lg text-xs text-text outline-none focus:border-primary"
            />
          </div>
          <div className="w-24">
            <label className="block text-[10px] font-semibold text-text-mid mb-1">Weight</label>
            <input
              type="number" step="0.5" min="0" value={newCatWeight}
              onChange={(e) => setNewCatWeight(e.target.value)}
              className="w-full px-3 py-1.5 border border-border rounded-lg text-xs text-text outline-none focus:border-primary font-mono"
            />
          </div>
          <Button type="submit">Add</Button>
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-text-mid mb-1">Description</label>
          <input
            type="text" value={newCatDescription} onChange={(e) => setNewCatDescription(e.target.value)}
            placeholder="optional — what this category captures"
            maxLength={500}
            className="w-full px-3 py-1.5 border border-border rounded-lg text-xs text-text outline-none focus:border-primary"
          />
        </div>
      </form>
    </div>
  );
}
