import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { api } from '../../../../lib/api';
import EmptyState from '../../../../components/ui/EmptyState';
import OneOnOneList from './OneOnOneList';
import OneOnOneForm from './OneOnOneForm';
import { PlayIcon } from '../../../../components/ui/icons';

export default function PersonOneOnOnes() {
  const { resource, viewMode } = useOutletContext();
  const navigate = useNavigate();
  const isSelfView = viewMode === 'self';

  const [oneOnOnes, setOneOnOnes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.listOneOnOnes(resource.id);
      setOneOnOnes(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load 1:1 meetings');
    } finally {
      setLoading(false);
    }
  }, [resource.id]);

  useEffect(() => {
    load();
  }, [load]);

  const editing =
    editingId && editingId !== 'new'
      ? oneOnOnes.find((o) => o.id === editingId) || null
      : null;

  const handleCreate = () => setEditingId('new');
  const handleEdit = (id) => setEditingId(id);
  const handleCancel = () => setEditingId(null);

  // "Start 1:1": create a meeting dated today and jump straight to the cockpit.
  const handleStartCockpit = async () => {
    setStarting(true);
    setError('');
    try {
      const created = await api.createOneOnOne(resource.id, {
        meetingDate: new Date().toISOString().slice(0, 10),
      });
      navigate(`/people/${resource.id}/oneonones/${created.id}/cockpit`);
    } catch (err) {
      setError(err.message || 'Failed to start 1:1');
      setStarting(false);
    }
  };

  const handleSave = async (data) => {
    if (editingId === 'new') {
      const created = await api.createOneOnOne(resource.id, data);
      setOneOnOnes((prev) => [created, ...prev]);
    } else {
      const updated = await api.updateOneOnOne(resource.id, editingId, data);
      setOneOnOnes((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    }
    setEditingId(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this 1:1 meeting? This cannot be undone.')) return;
    try {
      await api.deleteOneOnOne(resource.id, id);
      setOneOnOnes((prev) => prev.filter((o) => o.id !== id));
    } catch (err) {
      setError(err.message || 'Failed to delete 1:1 meeting');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[13px] font-bold text-text m-0">1:1 meetings</h2>
        {!isSelfView && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleStartCockpit}
              disabled={starting}
              className="inline-flex items-center gap-1.5 border-0 rounded-[11px] font-bold text-[11.5px] px-3.5 py-2 cursor-pointer bg-primary text-white shadow-[0_3px_10px_rgba(76,186,212,0.35)] hover:brightness-105 disabled:opacity-50"
            >
              <PlayIcon size={11} /> {starting ? 'Starting…' : 'Start 1:1'}
            </button>
            <button
              onClick={handleCreate}
              className="rounded-[11px] font-bold text-[11.5px] px-3.5 py-2 cursor-pointer bg-white text-text-mid border border-border-light hover:bg-primary-bg"
            >
              ＋ Quick add
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="text-xs text-danger bg-danger-bg p-2 rounded mb-3">{error}</div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl border border-border-light p-8 text-center text-xs text-text-light">
          Loading…
        </div>
      ) : oneOnOnes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border-light">
          <EmptyState icon="💬" message="No 1:1 meetings recorded yet." />
        </div>
      ) : (
        <OneOnOneList
          oneOnOnes={oneOnOnes}
          onEdit={handleEdit}
          onDelete={handleDelete}
          readOnly={isSelfView}
        />
      )}

      {editingId && !isSelfView && (
        <OneOnOneForm
          initial={editing}
          onCancel={handleCancel}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
