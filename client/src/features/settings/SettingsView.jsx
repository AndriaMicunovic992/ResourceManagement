import { useState, useEffect, useCallback, useMemo } from 'react';
import { useOrg } from '../../contexts/OrgContext';
import { useData } from '../../contexts/DataContext';
import { api } from '../../lib/api';
import { DEFAULT_SKILLS } from '../../lib/defaultSkills';
import Button from '../../components/ui/Button';
import Avatar from '../../components/ui/Avatar';

const ROLES = ['viewer', 'member', 'admin'];

export default function SettingsView() {
  const { currentOrg, role, updateOrg } = useOrg();
  const { teams, resources, addTeam, updateTeam, deleteTeam, skills, addSkill, updateSkill, deleteSkill } = useData();
  const [members, setMembers] = useState([]);
  const [email, setEmail] = useState('');
  const [newRole, setNewRole] = useState('member');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamError, setTeamError] = useState('');
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [editingTeamName, setEditingTeamName] = useState('');
  const [skillsError, setSkillsError] = useState('');
  const [seedingSkills, setSeedingSkills] = useState(false);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillCategory, setNewSkillCategory] = useState('');
  const [editingSkillId, setEditingSkillId] = useState(null);
  const [editingSkillName, setEditingSkillName] = useState('');
  const [editingSkillCategory, setEditingSkillCategory] = useState('');
  const isAdmin = role === 'admin' || role === 'owner';

  const skillsByCategory = useMemo(() => {
    const groups = {};
    for (const s of skills) {
      const cat = s.category || 'Uncategorized';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(s);
    }
    for (const cat of Object.keys(groups)) {
      groups[cat].sort((a, b) => a.name.localeCompare(b.name));
    }
    const sorted = Object.keys(groups).sort((a, b) => {
      if (a === 'Uncategorized') return 1;
      if (b === 'Uncategorized') return -1;
      return a.localeCompare(b);
    });
    return sorted.map((cat) => ({ category: cat, skills: groups[cat] }));
  }, [skills]);

  const [minDate, setMinDate] = useState(currentOrg?.minPlanningDate || '');
  const [maxDate, setMaxDate] = useState(currentOrg?.maxPlanningDate || '');
  const [dateSaving, setDateSaving] = useState(false);
  const [dateSuccess, setDateSuccess] = useState(false);

  useEffect(() => {
    setMinDate(currentOrg?.minPlanningDate || '');
    setMaxDate(currentOrg?.maxPlanningDate || '');
  }, [currentOrg]);

  const handleSaveDates = async () => {
    setDateSaving(true);
    setDateSuccess(false);
    try {
      await updateOrg({
        minPlanningDate: minDate || null,
        maxPlanningDate: maxDate || null,
      });
      setDateSuccess(true);
      setTimeout(() => setDateSuccess(false), 2000);
    } catch (err) {
      setError(err.message || 'Failed to save planning dates');
    }
    setDateSaving(false);
  };

  const loadMembers = useCallback(async () => {
    try {
      const data = await api.getMembers();
      setMembers(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError('');
    setLoading(true);
    try {
      await api.addMember(email.trim(), newRole);
      setEmail('');
      setNewRole('member');
      await loadMembers();
    } catch (err) {
      setError(err.message || 'Failed to add member');
    }
    setLoading(false);
  };

  const handleRoleChange = async (memberId, role) => {
    try {
      await api.updateMemberRole(memberId, role);
      await loadMembers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddTeam = async (e) => {
    e.preventDefault();
    if (!teamName.trim()) return;
    setTeamError('');
    try {
      await addTeam({ name: teamName.trim() });
      setTeamName('');
    } catch (err) {
      setTeamError(err.message || 'Failed to add team');
    }
  };

  const handleStartEditTeam = (team) => {
    setEditingTeamId(team.id);
    setEditingTeamName(team.name);
    setTeamError('');
  };

  const handleSaveEditTeam = async () => {
    if (!editingTeamName.trim()) return;
    try {
      await updateTeam(editingTeamId, { name: editingTeamName.trim() });
      setEditingTeamId(null);
      setEditingTeamName('');
    } catch (err) {
      setTeamError(err.message || 'Failed to update team');
    }
  };

  const handleDeleteTeam = async (team) => {
    const count = resources.filter((r) => r.teamId === team.id).length;
    const msg = count > 0
      ? `Delete team "${team.name}"? ${count} person(s) will be unassigned.`
      : `Delete team "${team.name}"?`;
    if (!confirm(msg)) return;
    try {
      await deleteTeam(team.id);
    } catch (err) {
      setTeamError(err.message || 'Failed to delete team');
    }
  };

  const handleAddSkill = async (e) => {
    e.preventDefault();
    if (!newSkillName.trim()) return;
    setSkillsError('');
    try {
      await addSkill({ name: newSkillName.trim(), category: newSkillCategory.trim() || null });
      setNewSkillName('');
      setNewSkillCategory('');
    } catch (err) {
      setSkillsError(err.message || 'Failed to add skill');
    }
  };

  const handleStartEditSkill = (skill) => {
    setEditingSkillId(skill.id);
    setEditingSkillName(skill.name);
    setEditingSkillCategory(skill.category || '');
    setSkillsError('');
  };

  const handleSaveEditSkill = async () => {
    if (!editingSkillName.trim()) return;
    try {
      await updateSkill(editingSkillId, {
        name: editingSkillName.trim(),
        category: editingSkillCategory.trim() || null,
      });
      setEditingSkillId(null);
      setEditingSkillName('');
      setEditingSkillCategory('');
    } catch (err) {
      setSkillsError(err.message || 'Failed to update skill');
    }
  };

  const handleCancelEditSkill = () => {
    setEditingSkillId(null);
    setEditingSkillName('');
    setEditingSkillCategory('');
  };

  const handleDeleteSkill = async (skill) => {
    if (!confirm('Delete skill "' + skill.name + '"?')) return;
    try {
      await deleteSkill(skill.id);
    } catch (err) {
      setSkillsError(err.message || 'Failed to delete skill');
    }
  };

  const handleSeedSkills = async () => {
    setSeedingSkills(true);
    setSkillsError('');
    try {
      const existing = new Set(skills.map((s) => s.name.toLowerCase()));
      for (const seed of DEFAULT_SKILLS) {
        if (existing.has(seed.name.toLowerCase())) continue;
        await addSkill(seed);
        existing.add(seed.name.toLowerCase());
      }
    } catch (err) {
      setSkillsError(err.message || 'Failed to seed skills');
    } finally {
      setSeedingSkills(false);
    }
  };

  const handleRemove = async (memberId, name) => {
    if (!confirm(`Remove ${name} from this organization?`)) return;
    try {
      await api.removeMember(memberId);
      await loadMembers();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-[600px] mx-auto px-5 py-6">
      <h2 className="text-xl font-bold text-text mb-6">Settings</h2>

      <div className="bg-white rounded-xl border border-border shadow-card p-5 mb-4">
        <h3 className="text-sm font-bold text-text mb-3">Organization</h3>
        <div className="text-xs text-text-mid">
          <p><strong>Name:</strong> {currentOrg?.name}</p>
          <p className="mt-1"><strong>Your role:</strong> {role}</p>
        </div>
      </div>

      {isAdmin && (
        <div className="bg-white rounded-xl border border-border shadow-card p-5 mb-4">
          <h3 className="text-sm font-bold text-text mb-3">Planning Date Range</h3>
          <p className="text-[10px] text-text-light mb-3">
            Set the minimum and maximum months available for planning. Leave empty for no restriction.
          </p>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-[10px] font-semibold text-text-mid mb-1">Min Date</label>
              <input
                type="month" value={minDate} onChange={(e) => setMinDate(e.target.value)}
                max={maxDate || undefined}
                className="w-full px-3 py-1.5 border border-border rounded-lg text-xs font-mono text-text outline-none focus:border-primary"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-semibold text-text-mid mb-1">Max Date</label>
              <input
                type="month" value={maxDate} onChange={(e) => setMaxDate(e.target.value)}
                min={minDate || undefined}
                className="w-full px-3 py-1.5 border border-border rounded-lg text-xs font-mono text-text outline-none focus:border-primary"
              />
            </div>
            <Button onClick={handleSaveDates} disabled={dateSaving}>
              {dateSaving ? 'Saving...' : dateSuccess ? 'Saved!' : 'Save'}
            </Button>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="bg-white rounded-xl border border-border shadow-card p-5 mb-4">
          <h3 className="text-sm font-bold text-text mb-3">Teams</h3>
          <p className="text-[10px] text-text-light mb-3">
            Group people into teams. Each person can belong to one team.
          </p>

          {teamError && (
            <div className="text-xs text-danger bg-danger-bg p-2 rounded mb-3">{teamError}</div>
          )}

          <div className="space-y-1 mb-3">
            {teams.map((t) => {
              const count = resources.filter((r) => r.teamId === t.id).length;
              const isEditing = editingTeamId === t.id;
              return (
                <div key={t.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-primary-bg/30">
                  {isEditing ? (
                    <>
                      <input
                        type="text"
                        value={editingTeamName}
                        onChange={(e) => setEditingTeamName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEditTeam();
                          if (e.key === 'Escape') { setEditingTeamId(null); setEditingTeamName(''); }
                        }}
                        autoFocus
                        className="flex-1 px-2 py-1 border border-border rounded text-xs text-text outline-none focus:border-primary"
                      />
                      <button
                        onClick={handleSaveEditTeam}
                        className="text-[10px] text-primary bg-transparent border-0 cursor-pointer hover:underline px-1"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => { setEditingTeamId(null); setEditingTeamName(''); }}
                        className="text-[10px] text-text-light bg-transparent border-0 cursor-pointer hover:text-text-mid px-1"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-xs font-semibold text-text">{t.name}</span>
                      <span className="text-[10px] text-text-light">{count === 1 ? '1 person' : `${count} people`}</span>
                      <button
                        onClick={() => handleStartEditTeam(t)}
                        className="text-[10px] text-text-mid bg-transparent border-0 cursor-pointer hover:text-primary px-1"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteTeam(t)}
                        className="text-[10px] text-danger bg-transparent border-0 cursor-pointer hover:text-danger/80 px-1"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              );
            })}
            {teams.length === 0 && (
              <p className="text-xs text-text-light py-2">No teams yet.</p>
            )}
          </div>

          <form onSubmit={handleAddTeam} className="flex gap-2 items-end pt-3 border-t border-border-light">
            <div className="flex-1">
              <label className="block text-[10px] font-semibold text-text-mid mb-1">Team name</label>
              <input
                type="text" value={teamName} onChange={(e) => setTeamName(e.target.value)}
                placeholder="e.g. Data Platform" required
                className="w-full px-3 py-1.5 border border-border rounded-lg text-xs text-text outline-none focus:border-primary"
              />
            </div>
            <Button type="submit">Add Team</Button>
          </form>
        </div>
      )}

      {isAdmin && (
        <div className="bg-white rounded-xl border border-border shadow-card p-5 mb-4">
          <h3 className="text-sm font-bold text-text mb-3">Skills</h3>
          <p className="text-[10px] text-text-light mb-3">
            Define the skill vocabulary for your organization. Skills can later be assigned to people with proficiency levels.
          </p>

          {skillsError && (
            <div className="text-xs text-danger bg-danger-bg p-2 rounded mb-3">{skillsError}</div>
          )}

          {skills.length === 0 ? (
            <div className="text-center py-6 mb-3">
              <p className="text-xs text-text-light mb-3">
                No skills defined yet. Get started with a recommended set of {DEFAULT_SKILLS.length} common engineering skills, or add your own below.
              </p>
              <Button onClick={handleSeedSkills} disabled={seedingSkills}>
                {seedingSkills ? 'Seeding...' : 'Seed default skills'}
              </Button>
            </div>
          ) : (
            <div className="space-y-3 mb-3">
              {skillsByCategory.map((group) => (
                <div key={group.category}>
                  <div className="text-[10px] uppercase tracking-wider text-text-light font-semibold mb-1">
                    {group.category}
                  </div>
                  <div className="space-y-1">
                    {group.skills.map((skill) => {
                      const isEditing = editingSkillId === skill.id;
                      return (
                        <div key={skill.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-primary-bg/30">
                          {isEditing ? (
                            <>
                              <input
                                type="text"
                                value={editingSkillName}
                                onChange={(e) => setEditingSkillName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEditSkill();
                                  if (e.key === 'Escape') handleCancelEditSkill();
                                }}
                                autoFocus
                                className="flex-1 px-2 py-1 border border-border rounded text-xs text-text outline-none focus:border-primary"
                              />
                              <input
                                type="text"
                                value={editingSkillCategory}
                                onChange={(e) => setEditingSkillCategory(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEditSkill();
                                  if (e.key === 'Escape') handleCancelEditSkill();
                                }}
                                placeholder="Category"
                                className="w-32 px-2 py-1 border border-border rounded text-xs text-text outline-none focus:border-primary"
                              />
                              <button
                                onClick={handleSaveEditSkill}
                                className="text-[10px] text-primary bg-transparent border-0 cursor-pointer hover:underline px-1"
                              >
                                Save
                              </button>
                              <button
                                onClick={handleCancelEditSkill}
                                className="text-[10px] text-text-light bg-transparent border-0 cursor-pointer hover:text-text-mid px-1"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <span className="flex-1 text-xs font-semibold text-text">{skill.name}</span>
                              {skill.category && (
                                <span className="text-[10px] text-text-light">{skill.category}</span>
                              )}
                              <button
                                onClick={() => handleStartEditSkill(skill)}
                                className="text-[10px] text-text-mid bg-transparent border-0 cursor-pointer hover:text-primary px-1"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteSkill(skill)}
                                className="text-[10px] text-danger bg-transparent border-0 cursor-pointer hover:text-danger/80 px-1"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleAddSkill} className="flex gap-2 items-end pt-3 border-t border-border-light">
            <div className="flex-1">
              <label className="block text-[10px] font-semibold text-text-mid mb-1">Skill name</label>
              <input
                type="text" value={newSkillName} onChange={(e) => setNewSkillName(e.target.value)}
                placeholder="e.g. Kubernetes" required
                className="w-full px-3 py-1.5 border border-border rounded-lg text-xs text-text outline-none focus:border-primary"
              />
            </div>
            <div className="w-40">
              <label className="block text-[10px] font-semibold text-text-mid mb-1">Category</label>
              <input
                type="text" value={newSkillCategory} onChange={(e) => setNewSkillCategory(e.target.value)}
                placeholder="optional"
                className="w-full px-3 py-1.5 border border-border rounded-lg text-xs text-text outline-none focus:border-primary"
              />
            </div>
            <Button type="submit">Add Skill</Button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-border shadow-card p-5">
        <h3 className="text-sm font-bold text-text mb-4">Members</h3>

        {error && (
          <div className="text-xs text-danger bg-danger-bg p-2 rounded mb-3">{error}</div>
        )}

        {/* Member list */}
        <div className="space-y-2 mb-4">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-primary-bg/30">
              <Avatar name={m.user.name} color="#4CBAD4" size={32} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-text truncate">{m.user.name}</div>
                <div className="text-[10px] text-text-light truncate">{m.user.email}</div>
              </div>
              {m.role === 'owner' ? (
                <span className="text-[10px] font-bold text-primary bg-primary-light px-2 py-0.5 rounded-full">Owner</span>
              ) : isAdmin ? (
                <select
                  value={m.role}
                  onChange={(e) => handleRoleChange(m.id, e.target.value)}
                  className="text-[10px] px-2 py-1 border border-border rounded-lg bg-white text-text-mid"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                  ))}
                </select>
              ) : (
                <span className="text-[10px] text-text-light capitalize">{m.role}</span>
              )}
              {isAdmin && m.role !== 'owner' && (
                <button
                  onClick={() => handleRemove(m.id, m.user.name)}
                  className="text-[10px] text-danger bg-transparent border-0 cursor-pointer hover:text-danger/80 px-1"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          {members.length === 0 && (
            <p className="text-xs text-text-light py-2">No members yet.</p>
          )}
        </div>

        {/* Add member form */}
        {isAdmin && (
          <form onSubmit={handleAdd} className="flex gap-2 items-end pt-3 border-t border-border-light">
            <div className="flex-1">
              <label className="block text-[10px] font-semibold text-text-mid mb-1">Email</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@company.com" required
                className="w-full px-3 py-1.5 border border-border rounded-lg text-xs text-text outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-text-mid mb-1">Role</label>
              <select
                value={newRole} onChange={(e) => setNewRole(e.target.value)}
                className="px-2 py-1.5 border border-border rounded-lg text-xs text-text bg-white"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
