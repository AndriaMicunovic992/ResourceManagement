import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useOrg } from '../../../../contexts/OrgContext';
import { api } from '../../../../lib/api';
import EmptyState from '../../../../components/ui/EmptyState';
import OneOnOneList from './OneOnOneList';
import OneOnOneForm from './OneOnOneForm';

export default function PersonOneOnOnes() {
  const { resource } = useOutletContext();
  const { role } = useOrg();
  const isAdmin = role === 'admin' || role === 'owner';

  const [oneOnOnes, setOneOnOnes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);

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
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    load();
  }, [isAdmin, load]);

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-xl border border-border p-10 text-center">
        <div className="text-4xl mb-3">🔒</div>
        <div className="text-sm text-text-mid">
          Access restricted — 1:1 meetings are visible to admins only.
        </div>
      </div>
    );
  }

  const editing =
    editingId && editingId !== 'new'
      ? oneOnOnes.find((o) => o.id === editingId) || null
      : null;

  const handleCreate = () => setEditingId('new');
  const handleEdit = (id) => setEditingId(id);
  const handleCancel = () => setEditingId(null);

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
        <button
          onClick={handleCreate}
          className="text-xs font-semibold text-white bg-primary border-0 rounded px-3 py-1.5 cursor-pointer hover:opacity-90"
        >
          + New 1:1
        </button>
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
        />
      )}

      {editingId && (
        <OneOnOneForm
          initial={editing}
          onCancel={handleCancel}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
