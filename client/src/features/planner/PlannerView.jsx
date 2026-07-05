import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UndoIcon } from '../../components/ui/icons';
import ResourcePool from './pool/ResourcePool';
import PlannerToolbar from './toolbar/PlannerToolbar';
import PlannerGrid from './grid/PlannerGrid';
import SuggestPopover from './SuggestPopover';
import FtePopover from '../../components/popovers/FtePopover';
import CustomerForm from '../../components/forms/CustomerForm';
import ProjectForm from '../../components/forms/ProjectForm';
import NeedForm from '../../components/forms/NeedForm';
import EmptyState from '../../components/ui/EmptyState';
import { useData } from '../../contexts/DataContext';
import { useOrg } from '../../contexts/OrgContext';
import { currentMonth, addMonths } from '../../lib/dateUtils';

/**
 * Smart auto-fill: per month, assign min(remaining gap on the need, the
 * person's remaining capacity). Returns null when nothing can be placed.
 */
function buildAutoFill(need, resource, assignments) {
  const needAllocs = need.monthAllocations || {};
  const needMonths = Object.keys(needAllocs).sort();
  if (needMonths.length === 0) return null;
  const needAssigns = assignments.filter((a) => a.needId === need.id);
  const resourceAssigns = assignments.filter((a) => a.resourceId === resource.id);
  const monthAllocations = {};
  let hasAny = false;
  for (const m of needMonths) {
    const needed = needAllocs[m] || 0;
    const filled = needAssigns.reduce((s, a) => s + ((a.monthAllocations || {})[m] || 0), 0);
    const gap = needed - filled;
    const used = resourceAssigns.reduce((s, a) => s + ((a.monthAllocations || {})[m] || 0), 0);
    const cap = Math.max(0, (resource.capacity ?? 1.0) - used);
    const fte = Math.round(Math.max(0, Math.min(gap, cap)) * 100) / 100;
    monthAllocations[m] = fte;
    if (fte > 0) hasAny = true;
  }
  return hasAny ? monthAllocations : null;
}

export default function PlannerView() {
  const { customers, needs, assignments, updateCustomer, deleteCustomer, addProject, updateProject, deleteProject, addNeed, updateNeed, deleteNeed, upsertAssignment, deleteAssignment } = useData();
  const { currentOrg } = useOrg();

  const [heldResource, setHeldResource] = useState(null);

  // --- Undo: every grid mutation pushes an inverse op; Ctrl+Z or the toast
  // button pops it. Esc releases the held resource. ---
  const historyRef = useRef([]);
  const toastTimerRef = useRef(null);
  const [undoToast, setUndoToast] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const errorTimerRef = useRef(null);

  // Surface a failed write instead of swallowing the rejection — the planner
  // used to fail silently (a click that did nothing, or a stuck popover).
  const notifyError = useCallback((e) => {
    setErrorMsg((e && e.message) || 'That change could not be saved');
    clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setErrorMsg(null), 5000);
  }, []);

  const pushUndo = useCallback((label, undoFn) => {
    historyRef.current.push({ label, undoFn });
    if (historyRef.current.length > 30) historyRef.current.shift();
    setUndoToast(label);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setUndoToast(null), 6000);
  }, []);

  const handleUndo = useCallback(async () => {
    const entry = historyRef.current.pop();
    setUndoToast(null);
    if (entry) {
      try {
        await entry.undoFn();
      } catch {
        /* state refreshes on next load if the inverse fails */
      }
    }
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        handleUndo();
      } else if (e.key === 'Escape') {
        setHeldResource(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo]);
  const [popover, setPopover] = useState(null);
  const [timeRange, setTimeRange] = useState({ start: currentMonth(), end: addMonths(currentMonth(), 11) });
  // Monthly grid. The M/Q/Y aggregation toggle was removed; periods are always
  // one-per-month (computePeriods(months, 'M')).
  const aggregation = 'M';
  const [editModal, setEditModal] = useState(null);
  const [showUnassignedOnly, setShowUnassignedOnly] = useState(false);
  const [resourceFilterIds, setResourceFilterIds] = useState(() => new Set());
  const [myProjectsOnly, setMyProjectsOnly] = useState(false);
  const [customerSort, setCustomerSort] = useState('name-asc');
  const [searchParams, setSearchParams] = useSearchParams();
  const [filterIds, setFilterIds] = useState(() => {
    // Seed from ?customerId= / ?projectId= URL params so deep-links from
    // customer/project pages land with the planner already filtered.
    const initial = new Set();
    const customerId = searchParams.get('customerId');
    const projectId = searchParams.get('projectId');
    if (customerId) initial.add(`c:${customerId}`);
    if (projectId) initial.add(`p:${projectId}`);
    return initial;
  });

  // Clear the seeded params so the filter stays local state afterwards
  // (e.g. the user can remove the filter without leaving a stale URL).
  useEffect(() => {
    if (searchParams.get('customerId') || searchParams.get('projectId')) {
      const next = new URLSearchParams(searchParams);
      next.delete('customerId');
      next.delete('projectId');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clamp timeRange when org planning limits change
  useEffect(() => {
    const minDate = currentOrg?.minPlanningDate;
    const maxDate = currentOrg?.maxPlanningDate;
    if (!minDate && !maxDate) return;
    setTimeRange((prev) => ({
      start: minDate && prev.start < minDate ? minDate : prev.start,
      end: maxDate && prev.end > maxDate ? maxDate : prev.end,
    }));
  }, [currentOrg?.minPlanningDate, currentOrg?.maxPlanningDate]);

  const handleCellClick = useCallback((need, month, periodMonths, e) => {
    if (heldResource) {
      const existing = assignments.find((a) => a.needId === need.id && a.resourceId === heldResource.id);

      // Auto-fill the still-open months of this need with the held person.
      const monthAllocations = buildAutoFill(need, heldResource, assignments);
      if (!monthAllocations) return;

      const heldName = heldResource.name;

      if (existing) {
        // The person is already on this need for some months (e.g. earlier in
        // the year, before someone else covered a gap). Extend them into the
        // remaining open months. buildAutoFill returns the *incremental* FTE
        // that still fits; the server merges per-month by replacement, so we
        // must send the TARGET value (their current month FTE + the increment),
        // never the bare increment — otherwise a partially-filled month would
        // be reduced to just the gap. Only positive increments are applied, so
        // existing months (and anyone else's) are never wiped.
        const own = existing.monthAllocations || {};
        const additions = {};
        const undoAllocs = {};
        for (const [m, inc] of Object.entries(monthAllocations)) {
          if (inc > 0) {
            const prev = own[m] || 0;
            additions[m] = Math.round((prev + inc) * 100) / 100;
            undoAllocs[m] = prev; // restore the real prior value, not zero
          }
        }
        if (Object.keys(additions).length === 0) return;
        Promise.resolve(
          upsertAssignment({ needId: need.id, resourceId: heldResource.id, monthAllocations: additions })
        ).then(() => {
          pushUndo(`Assigned ${heldName}`, () =>
            upsertAssignment({ needId: need.id, resourceId: heldResource.id, monthAllocations: undoAllocs })
          );
        }).catch(notifyError);
        return;
      }

      Promise.resolve(
        upsertAssignment({ needId: need.id, resourceId: heldResource.id, monthAllocations })
      ).then((created) => {
        if (created?.id) {
          pushUndo(`Assigned ${heldName}`, () => deleteAssignment(created.id));
        }
      }).catch(notifyError);
      return;
    }

    // No held resource: edit this need's per-month FTE
    const rect = e.currentTarget.getBoundingClientRect();
    const needAllocs = need.monthAllocations || {};
    setPopover({
      x: rect.left, y: rect.bottom + 4,
      needId: need.id, month, periodMonths,
      currentFte: needAllocs[month] || 0,
      maxFte: 2.0,
      type: 'editNeed',
    });
  }, [heldResource, assignments, upsertAssignment, notifyError]);

  const handleBarClick = useCallback((assignment, segment, clickedMonth, e) => {
    const need = needs.find((n) => n.id === assignment.needId);
    const needAllocs = need?.monthAllocations || {};
    const month = clickedMonth;
    const needed = needAllocs[month] || 1;
    const currentFte = (assignment.monthAllocations || {})[month] || segment.fte;

    // maxFte = need requirement minus other assignments' FTE for this month
    const otherFilled = assignments
      .filter((a) => a.needId === assignment.needId && a.id !== assignment.id)
      .reduce((s, a) => s + ((a.monthAllocations || {})[month] || 0), 0);
    const maxFte = Math.max(0.01, needed - otherFilled);

    const rect = e.currentTarget.getBoundingClientRect();
    setPopover({
      x: rect.left, y: rect.bottom + 4,
      assignmentId: assignment.id,
      needId: assignment.needId,
      resourceId: assignment.resourceId,
      month,
      months: [month],
      currentFte,
      needFte: needed,
      maxFte,
      type: 'edit',
    });
  }, [needs, assignments]);

  const handleFteSave = async (fte) => {
    if (!popover) return;
    try {
      await handleFteSaveInner(fte);
    } catch (e) {
      notifyError(e);
    } finally {
      setPopover(null);
    }
  };

  const handleFteSaveInner = async (fte) => {
    if (popover.type === 'edit') {
      // Snapshot the previous value so the change is undoable.
      const prev = assignments.find((a) => a.id === popover.assignmentId);
      const prevFte = prev ? (prev.monthAllocations || {})[popover.month] || 0 : 0;
      await upsertAssignment({
        needId: popover.needId, resourceId: popover.resourceId,
        months: popover.months, fte,
      });
      if (prevFte !== fte) {
        const { needId, resourceId, months } = popover;
        pushUndo(`FTE ${prevFte.toFixed(1)} → ${fte.toFixed(1)}`, () =>
          upsertAssignment({ needId, resourceId, months, fte: prevFte })
        );
      }
    } else if (popover.type === 'paintNeed') {
      const prevNeed = needs.find((n) => n.id === popover.needId);
      const prevAllocs = { ...(prevNeed?.monthAllocations || {}) };
      const merged = { ...prevAllocs };
      for (const m of popover.months) merged[m] = fte;
      await updateNeed(popover.needId, { monthAllocations: merged });
      // Restore map zeroes painted months that didn't exist before.
      const restore = { ...prevAllocs };
      for (const m of popover.months) if (!(m in restore)) restore[m] = 0;
      const { needId } = popover;
      pushUndo(`Painted need × ${popover.months.length}`, () =>
        updateNeed(needId, { monthAllocations: restore })
      );
    } else if (popover.type === 'paintAssign') {
      const { needId, months, resource } = popover;
      const existing = assignments.find(
        (a) => a.needId === needId && a.resourceId === resource.id
      );
      const prevAllocs = existing ? { ...(existing.monthAllocations || {}) } : null;
      const created = await upsertAssignment({ needId, resourceId: resource.id, months, fte });
      if (prevAllocs) {
        pushUndo(`Painted ${resource.name} × ${months.length}`, () =>
          upsertAssignment({ needId, resourceId: resource.id, monthAllocations: prevAllocs })
        );
      } else if (created?.id) {
        pushUndo(`Painted ${resource.name} × ${months.length}`, () =>
          deleteAssignment(created.id)
        );
      }
    } else if (popover.type === 'editNeed') {
      const prevNeed = needs.find((n) => n.id === popover.needId);
      const prevAllocs = { ...(prevNeed?.monthAllocations || {}) };
      const monthAllocs = {};
      const months = popover.periodMonths || [popover.month];
      for (const m of months) monthAllocs[m] = fte;
      await updateNeed(popover.needId, { monthAllocations: monthAllocs });
      const { needId } = popover;
      pushUndo('Need FTE changed', () =>
        updateNeed(needId, { monthAllocations: prevAllocs })
      );
    }
  };

  const handleNeedFteSave = async (fte) => {
    if (!popover) return;
    try {
      await updateNeed(popover.needId, { monthAllocations: { [popover.month]: fte } });
    } catch (e) {
      notifyError(e);
    } finally {
      setPopover(null);
    }
  };

  // Paint-fill: a drag across months opens the popover once for the range.
  const handlePaintNeed = useCallback((need, months, pos) => {
    setPopover({
      x: pos.x, y: pos.y,
      type: 'paintNeed', needId: need.id, months,
      currentFte: (need.monthAllocations || {})[months[0]] || 0.5,
      maxFte: 2.0,
      title: `Need FTE × ${months.length} month${months.length > 1 ? 's' : ''}`,
    });
  }, []);

  const handlePaintAssign = useCallback((need, months, pos) => {
    if (!heldResource) return;
    const existing = assignments.find(
      (a) => a.needId === need.id && a.resourceId === heldResource.id
    );
    setPopover({
      x: pos.x, y: pos.y,
      type: 'paintAssign', needId: need.id, months,
      resource: { id: heldResource.id, name: heldResource.name, capacity: heldResource.capacity ?? 1 },
      currentFte: existing ? (existing.monthAllocations || {})[months[0]] || 0.5 : 0.5,
      maxFte: heldResource.capacity ?? 1,
      title: `${heldResource.name} × ${months.length} month${months.length > 1 ? 's' : ''}`,
    });
  }, [heldResource, assignments]);

  // "Suggest people" popover for an unfilled need.
  const [suggest, setSuggest] = useState(null);
  const handleSuggestNeed = useCallback((need, project, customer, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setSuggest({ need, project, customer, x: rect.right + 8, y: rect.top });
  }, []);

  const handleSuggestAssign = async (resource) => {
    if (!suggest) return;
    const alloc = buildAutoFill(suggest.need, resource, assignments);
    setSuggest(null);
    if (!alloc) return;
    try {
      const created = await upsertAssignment({
        needId: suggest.need.id,
        resourceId: resource.id,
        monthAllocations: alloc,
      });
      if (created?.id) {
        pushUndo(`Assigned ${resource.name}`, () => deleteAssignment(created.id));
      }
    } catch (e) {
      notifyError(e);
    }
  };

  const handleEditCustomer = (customer) => setEditModal({ type: 'customer', data: customer });
  const handleDeleteCustomer = async (id) => { if (confirm('Delete this customer?')) await deleteCustomer(id); };
  const handleAddProject = (customer) => setEditModal({ type: 'project', customer });
  const handleEditProject = (project) => setEditModal({ type: 'project', data: project });
  const handleDeleteProject = async (id) => { if (confirm('Delete this project?')) await deleteProject(id); };
  const handleAddNeed = (project) => setEditModal({ type: 'need', project });
  const handleEditNeed = (need, project) => setEditModal({ type: 'need', data: need, project });
  const handleDeleteNeed = async (id) => { if (confirm('Delete this need?')) await deleteNeed(id); };

  return (
    <div className="flex h-full gap-3 p-3">
      <div className="flex rounded-2xl bg-white border border-border-light shadow-card overflow-hidden">
        <ResourcePool heldResource={heldResource} onHold={setHeldResource} timeRange={timeRange} />
      </div>
      <div className="flex-1 min-w-0 flex flex-col rounded-2xl bg-white border border-border-light shadow-card overflow-hidden" onClick={() => setPopover(null)}>
        <PlannerToolbar
          timeRange={timeRange} onTimeRangeChange={setTimeRange}
          showUnassignedOnly={showUnassignedOnly}
          onToggleUnassigned={() => setShowUnassignedOnly((v) => !v)}
          customerSort={customerSort} onCustomerSortChange={setCustomerSort}
          filterIds={filterIds} onFilterChange={setFilterIds}
          resourceFilterIds={resourceFilterIds} onResourceFilterChange={setResourceFilterIds}
          myProjectsOnly={myProjectsOnly} onToggleMyProjects={() => setMyProjectsOnly((v) => !v)}
        />
        {customers.length === 0 ? (
          <EmptyState icon="📅" message="Create a customer to start planning" />
        ) : (
          <PlannerGrid
            heldResource={heldResource} timeRange={timeRange} aggregation={aggregation}
            showUnassignedOnly={showUnassignedOnly} customerSort={customerSort} filterIds={filterIds}
            resourceFilterIds={resourceFilterIds} myProjectsOnly={myProjectsOnly}
            onCellClick={handleCellClick} onBarClick={handleBarClick}
            onSuggestNeed={handleSuggestNeed}
            onPaintNeed={handlePaintNeed} onPaintAssign={handlePaintAssign}
            onUndoable={pushUndo}
            onEditCustomer={handleEditCustomer} onDeleteCustomer={handleDeleteCustomer}
            onAddProject={handleAddProject} onEditProject={handleEditProject} onDeleteProject={handleDeleteProject}
            onAddNeed={handleAddNeed} onEditNeed={handleEditNeed} onDeleteNeed={handleDeleteNeed}
          />
        )}
      </div>

      {popover && (
        <FtePopover
          x={popover.x} y={popover.y}
          maxFte={popover.maxFte} currentFte={popover.currentFte}
          title={popover.type === 'editNeed' ? 'Need FTE (max 2.0)' : undefined}
          showRemove={popover.type === 'edit'}
          showNeedEdit={popover.type === 'edit'}
          needFte={popover.needFte}
          onSave={handleFteSave}
          onSaveNeed={handleNeedFteSave}
          onClose={() => setPopover(null)}
        />
      )}

      {suggest && (
        <SuggestPopover
          need={suggest.need}
          customer={suggest.customer}
          x={suggest.x}
          y={suggest.y}
          onAssign={handleSuggestAssign}
          onClose={() => setSuggest(null)}
        />
      )}

      {undoToast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[9500] flex items-center gap-3 bg-text text-white rounded-xl px-4 py-2.5 shadow-2xl">
          <span className="text-xs font-semibold">{undoToast}</span>
          <button
            onClick={handleUndo}
            className="inline-flex items-center gap-1 text-xs font-bold text-primary-light bg-white/10 border border-white/20 rounded-lg px-2.5 py-1 cursor-pointer hover:bg-white/20"
          >
            <UndoIcon size={12} /> Undo
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[9600] flex items-center gap-3 bg-danger text-white rounded-xl px-4 py-2.5 shadow-2xl">
          <span className="text-xs font-semibold">{errorMsg}</span>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-xs font-bold text-white/90 bg-white/10 border border-white/20 rounded-lg px-2 py-1 cursor-pointer hover:bg-white/20"
          >
            Dismiss
          </button>
        </div>
      )}

      {editModal?.type === 'customer' && (
        <CustomerForm initial={editModal.data}
          onSave={async (data) => { await updateCustomer(editModal.data.id, data); setEditModal(null); }}
          onClose={() => setEditModal(null)} />
      )}
      {editModal?.type === 'project' && (
        <ProjectForm initial={editModal.data || (editModal.customer ? { customerId: editModal.customer.id } : undefined)}
          onSave={async (data) => {
            if (editModal.data?.id) await updateProject(editModal.data.id, data);
            else await addProject(data);
            setEditModal(null);
          }}
          onClose={() => setEditModal(null)} />
      )}
      {editModal?.type === 'need' && (
        <NeedForm initial={editModal.data} project={editModal.project || editModal.data?.project}
          onSave={async (data) => {
            if (editModal.data?.id) await updateNeed(editModal.data.id, data);
            else await addNeed(data);
            setEditModal(null);
          }}
          onClose={() => setEditModal(null)} />
      )}
    </div>
  );
}
