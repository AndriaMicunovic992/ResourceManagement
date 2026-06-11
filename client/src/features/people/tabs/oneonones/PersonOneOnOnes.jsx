import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { api } from '../../../../lib/api';
import EmptyState from '../../../../components/ui/EmptyState';
import OneOnOneList from './OneOnOneList';
import OneOnOneForm from './OneOnOneForm';

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
        <h2 className="text-base font-bold text-text m-0">1:1 Meetings</h2>
        {!isSelfView && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleStartCockpit}
              disabled={starting}
              className="text-xs font-semibold text-white bg-primary border-0 rounded px-3 py-1.5 cursor-pointer hover:opacity-90 disabled:opacity-50"
            >
              {starting ? 'Starting…' : '▶ Start 1:1'}
            </button>
            <button
              onClick={handleCreate}
              className="text-xs font-semibold text-primary bg-transparent border border-primary rounded px-3 py-1.5 cursor-pointer hover:bg-primary hover:text-white"
            >
              + Quick add
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="text-xs text-danger bg-danger-bg p-2 rounded mb-3">{error}</div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border border-border p-8 text-center text-xs text-text-light">
          Loading…
        </div>
      ) : oneOnOnes.length === 0 ? (
        <div className="bg-white rounded-xl border border-border">
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
