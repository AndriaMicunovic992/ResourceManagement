import { useEffect, useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import Field from '../ui/Field';
import Button from '../ui/Button';
import RolePicker from './RolePicker';
import { fteToHours, hoursToFte } from '../../lib/constants';
import { useData } from '../../contexts/DataContext';
import { useOrg } from '../../contexts/OrgContext';
import { api } from '../../lib/api';

export default function ResourceForm({ initial, onSave, onClose }) {
  const { teams, resources } = useData();
  const { role } = useOrg();
  const isAdmin = role === 'admin' || role === 'owner';
  const [name, setName] = useState(initial?.name || '');
  const [capacity, setCapacity] = useState(initial?.capacity ?? 1);
  const [capacityHours, setCapacityHours] = useState(fteToHours(initial?.capacity ?? 1));
  const [teamIds, setTeamIds] = useState(
    Array.isArray(initial?.teams) ? initial.teams.map((t) => t.id) : []
  );
  const [directManagerUserIds, setDirectManagerUserIds] = useState(
    Array.isArray(initial?.managerLinks)
      ? initial.managerLinks.map((l) => l.managerUserId || l.managerUser?.id).filter(Boolean)
      : []
  );
  const [userId, setUserId] = useState(initial?.userId || '');
  const [members, setMembers] = useState([]);
  const [roles, setRoles] = useState(
    initial?.roles?.length ? initial.roles.map((r) => ({ domain: r.domain, role: r.role, seniority: r.seniority }))
      : [{ domain: 'Web', role: 'FE', seniority: 'Medior' }]
  );

  useEffect(() => {
    if (!isAdmin) return;
    api.getMembers().then(setMembers).catch(() => setMembers([]));
  }, [isAdmin]);

  const linkedUserIds = useMemo(() => {
    const set = new Set();
    for (const r of resources) {
      if (r.userId && r.id !== initial?.id) set.add(r.userId);
    }
    return set;
  }, [resources, initial?.id]);

  // Managers are login users now (the person's own linked user can't manage
  // themselves). Inherited manager ids are user ids drawn from selected teams.
  const inheritedManagerIds = useMemo(() => {
    const ids = new Set();
    const selectedTeams = teams.filter((t) => teamIds.includes(t.id));
    for (const t of selectedTeams) {
      const mid = t.managerUserId || t.managerUser?.id;
      if (mid && mid !== initial?.userId) ids.add(mid);
    }
    return ids;
  }, [teams, teamIds, initial?.userId]);

  // Managers are picked from org members. Viewers can't manage (backend
  // rejects them), and a person can't be their own manager.
  const managerCandidates = useMemo(
    () =>
      members.filter(
        (m) => m.role !== 'viewer' && m.user?.id !== initial?.userId,
      ),
    [members, initial?.userId]
  );

  const toggleTeam = (id) => {
    setTeamIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleManager = (id) => {
    setDirectManagerUserIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const payload = {
      name: name.trim(),
      capacity: parseFloat(capacity),
      teamIds,
      directManagerUserIds,
      roles,
    };
    if (isAdmin) payload.userId = userId || null;
    onSave(payload);
  };

  return (
    <Modal title={initial ? 'Edit Person' : 'New Person'} onClose={onClose} wide>
      <form onSubmit={handleSubmit}>
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm text-text outline-none focus:border-primary" autoFocus />
        </Field>
        <Field label="FTE Capacity">
          <div className="flex items-center gap-2">
            <input type="number" step="0.1" min="0.1" max="1" value={capacity}
              onChange={(e) => {
                setCapacity(e.target.value);
                const n = parseFloat(e.target.value);
                if (!isNaN(n)) setCapacityHours(fteToHours(n));
              }}
              className="w-24 px-3 py-2 border border-border rounded-lg text-sm text-text outline-none focus:border-primary font-mono" />
            <span className="text-[10px] text-text-light">FTE</span>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <input type="number" step="1" min="0" value={capacityHours}
              onChange={(e) => {
                setCapacityHours(e.target.value);
                const n = parseFloat(e.target.value);
                if (!isNaN(n)) setCapacity(hoursToFte(n));
              }}
              className="w-24 px-3 py-2 border border-border rounded-lg text-sm text-text outline-none focus:border-primary font-mono" />
            <span className="text-[10px] text-text-light">hours / month</span>
          </div>
        </Field>
        <Field label="Teams">
          {teams.length === 0 ? (
            <div className="text-xs text-text-light italic">No teams defined yet.</div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {teams.map((t) => {
                const active = teamIds.includes(t.id);
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => toggleTeam(t.id)}
                    className={`text-xs font-semibold px-2 py-1 rounded-full border cursor-pointer ${
                      active
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-text border-border hover:border-primary'
                    }`}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
          )}
          <div className="text-[10px] text-text-light mt-1">
            A person can belong to multiple teams.
          </div>
        </Field>
        {isAdmin && (
          <Field label="Direct managers">
            {managerCandidates.length === 0 ? (
              <div className="text-xs text-text-light italic">No eligible members available.</div>
            ) : (
              <div className="max-h-40 overflow-y-auto border border-border rounded-lg p-2 bg-white">
                <div className="flex flex-wrap gap-1.5">
                  {managerCandidates.map((m) => {
                    const active = directManagerUserIds.includes(m.user.id);
                    return (
                      <button
                        type="button"
                        key={m.user.id}
                        onClick={() => toggleManager(m.user.id)}
                        className={`text-xs font-semibold px-2 py-1 rounded-full border cursor-pointer ${
                          active
                            ? 'bg-primary text-white border-primary'
                            : 'bg-white text-text border-border hover:border-primary'
                        }`}
                      >
                        {m.user.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {inheritedManagerIds.size > 0 && (
              <div className="text-[10px] text-text-light mt-1">
                Inherited from selected teams:{' '}
                {Array.from(inheritedManagerIds)
                  .map((id) => members.find((m) => m.user.id === id)?.user.name)
                  .filter(Boolean)
                  .join(', ')}
              </div>
            )}
            <div className="text-[10px] text-text-light mt-1">
              A person can have multiple direct managers, in addition to those inherited from teams.
            </div>
          </Field>
        )}
        {isAdmin && (
          <Field label="Linked user account">
            <select value={userId} onChange={(e) => setUserId(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm text-text outline-none focus:border-primary bg-white">
              <option value="">Not linked</option>
              {members.map((m) => {
                const isLinkedElsewhere = linkedUserIds.has(m.user.id);
                return (
                  <option key={m.user.id} value={m.user.id} disabled={isLinkedElsewhere}>
                    {m.user.name} ({m.user.email}){isLinkedElsewhere ? ' — already linked' : ''}
                  </option>
                );
              })}
            </select>
            <div className="text-[10px] text-text-light mt-1">
              Linking a user account lets this person log their own wins, downs and blockers.
            </div>
          </Field>
        )}
        <Field label="Roles">
          <RolePicker roles={roles} onChange={setRoles} />
        </Field>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit">Save</Button>
        </div>
      </form>
    </Modal>
  );
}
