import { useState, useEffect, useCallback, useMemo } from 'react';
import { useOrg } from '../../contexts/OrgContext';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { api } from '../../lib/api';
import { viewAs } from '../../lib/impersonation';
import { DEFAULT_SKILLS } from '../../lib/defaultSkills';
import Button from '../../components/ui/Button';
import Avatar from '../../components/ui/Avatar';
import PageHeader from '../../components/ui/PageHeader';
import RolesSection from './RolesSection';
import TaxonomySection from './TaxonomySection';
import IntegrationsSection from './IntegrationsSection';


export default function SettingsView() {
  const { currentOrg, role, updateOrg } = useOrg();
  const { user } = useAuth();
  const { teams, resources, addTeam, updateTeam, deleteTeam, skills, addSkill, updateSkill, deleteSkill, logCategories, addLogCategory, updateLogCategory, deleteLogCategory } = useData();
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [memberNotice, setMemberNotice] = useState('');
  const [authConfig, setAuthConfig] = useState({ microsoftEnabled: false });
  const [accountError, setAccountError] = useState('');
  // Set when we land back here after a successful Microsoft account link.
  const justLinkedMicrosoft = useMemo(
    () => new URLSearchParams(window.location.search).get('microsoft') === 'linked',
    []
  );
  const [email, setEmail] = useState('');
  const [newRole, setNewRole] = useState('member');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState('account');
  const [teamName, setTeamName] = useState('');
  const [teamManagerId, setTeamManagerId] = useState('');
  const [teamError, setTeamError] = useState('');
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [editingTeamName, setEditingTeamName] = useState('');
  const [editingTeamManagerId, setEditingTeamManagerId] = useState('');
  const [skillsError, setSkillsError] = useState('');
  const [seedingSkills, setSeedingSkills] = useState(false);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillCategory, setNewSkillCategory] = useState('');
  const [editingSkillId, setEditingSkillId] = useState(null);
  const [editingSkillName, setEditingSkillName] = useState('');
  const [editingSkillCategory, setEditingSkillCategory] = useState('');
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

  const [perfTrendKind, setPerfTrendKind] = useState(
    currentOrg?.performanceTrendDefaultKind || 'rolling_months'
  );
  const [perfTrendMonths, setPerfTrendMonths] = useState(
    String(currentOrg?.performanceTrendDefaultMonths ?? 12)
  );
  const [perfTrendFrom, setPerfTrendFrom] = useState(currentOrg?.performanceTrendDefaultFrom || '');
  const [perfTrendTo, setPerfTrendTo] = useState(currentOrg?.performanceTrendDefaultTo || '');
  const [perfTrendSaving, setPerfTrendSaving] = useState(false);
  const [perfTrendSuccess, setPerfTrendSuccess] = useState(false);
  const scheduleFromOrg = (org, prefix) => ({
    every: org?.[`${prefix}Every`] != null ? String(org[`${prefix}Every`]) : '',
    unit: org?.[`${prefix}Unit`] || 'weekly',
    start: org?.[`${prefix}Start`] || '',
  });
  const [oneOnOneSched, setOneOnOneSched] = useState(() =>
    scheduleFromOrg(currentOrg, 'oneOnOneReminder')
  );
  const [pmLogSched, setPmLogSched] = useState(() => scheduleFromOrg(currentOrg, 'pmLogReminder'));
  const [reminderSaving, setReminderSaving] = useState(false);
  const [reminderSuccess, setReminderSuccess] = useState(false);

  useEffect(() => {
    setMinDate(currentOrg?.minPlanningDate || '');
    setMaxDate(currentOrg?.maxPlanningDate || '');
    setPerfTrendKind(currentOrg?.performanceTrendDefaultKind || 'rolling_months');
    setPerfTrendMonths(String(currentOrg?.performanceTrendDefaultMonths ?? 12));
    setPerfTrendFrom(currentOrg?.performanceTrendDefaultFrom || '');
    setPerfTrendTo(currentOrg?.performanceTrendDefaultTo || '');
    setOneOnOneSched(scheduleFromOrg(currentOrg, 'oneOnOneReminder'));
    setPmLogSched(scheduleFromOrg(currentOrg, 'pmLogReminder'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg]);

  const handleSaveReminders = async () => {
    setReminderSaving(true);
    setReminderSuccess(false);
    // A schedule is "on" only when both every and start are set.
    const pack = (s, prefix) => ({
      [`${prefix}Every`]: s.every && s.start ? parseInt(s.every, 10) : null,
      [`${prefix}Unit`]: s.every && s.start ? s.unit : null,
      [`${prefix}Start`]: s.every && s.start ? s.start : null,
    });
    try {
      await updateOrg({
        ...pack(oneOnOneSched, 'oneOnOneReminder'),
        ...pack(pmLogSched, 'pmLogReminder'),
      });
      setReminderSuccess(true);
      setTimeout(() => setReminderSuccess(false), 2000);
    } catch (err) {
      setError(err.message || 'Failed to save reminder settings');
    }
    setReminderSaving(false);
  };

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

  const handleSavePerfTrend = async () => {
    const update = { performanceTrendDefaultKind: perfTrendKind };
    if (perfTrendKind === 'rolling_months') {
      const n = parseInt(perfTrendMonths, 10);
      if (!Number.isFinite(n) || n < 1 || n > 120) {
        setError('Performance trend months must be between 1 and 120');
        return;
      }
      update.performanceTrendDefaultMonths = n;
    }
    if (perfTrendKind === 'custom') {
      if (!perfTrendFrom) {
        setError('Custom performance trend needs at least a "From" date');
        return;
      }
      if (perfTrendTo && perfTrendTo < perfTrendFrom) {
        setError('"To" date must be after "From" date');
        return;
      }
      update.performanceTrendDefaultFrom = perfTrendFrom;
      update.performanceTrendDefaultTo = perfTrendTo || null;
    }
    setPerfTrendSaving(true);
    setPerfTrendSuccess(false);
    try {
      await updateOrg(update);
      setPerfTrendSuccess(true);
      setTimeout(() => setPerfTrendSuccess(false), 2000);
    } catch (err) {
      setError(err.message || 'Failed to save performance trend default');
    }
    setPerfTrendSaving(false);
  };

  const loadMembers = useCallback(async () => {
    try {
      const data = await api.getMembers();
      setMembers(data);
    } catch { /* ignore */ }
  }, []);

  // Assignable roles (system + custom, excluding owner) for the member dropdowns.
  const [roleOptions, setRoleOptions] = useState([]);
  const loadRoleOptions = useCallback(() => {
    if (!isAdmin) return;
    api.getRoles()
      .then((d) => setRoleOptions((d.roles || []).filter((r) => r.key !== 'owner').map((r) => ({ key: r.key, name: r.name }))))
      .catch(() => {});
  }, [isAdmin]);
  useEffect(() => { loadRoleOptions(); }, [loadRoleOptions]);

  const loadInvites = useCallback(async () => {
    try {
      setInvites(await api.getInvites());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadMembers(); }, [loadMembers]);
  useEffect(() => { if (isAdmin) loadInvites(); }, [isAdmin, loadInvites]);
  useEffect(() => { api.getAuthConfig().then(setAuthConfig).catch(() => {}); }, []);

  const handleConnectMicrosoft = async () => {
    setAccountError('');
    try {
      const { url } = await api.startMicrosoftLink();
      window.location.href = url;
    } catch (err) {
      setAccountError(err.message || 'Could not start Microsoft linking');
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError('');
    setMemberNotice('');
    setLoading(true);
    try {
      const res = await api.addMember(email.trim(), newRole);
      setEmail('');
      setNewRole('member');
      // The server adds existing accounts directly, but invites unknown emails —
      // tell the admin which happened.
      if (res && res.type === 'invited') {
        setMemberNotice(`Invitation created for ${res.invite.email}. They'll get access the first time they sign in.`);
      } else if (res && res.member) {
        setMemberNotice(`${res.member.user.name} added to the organization.`);
      }
      await loadMembers();
      await loadInvites();
    } catch (err) {
      setError(err.message || 'Failed to add member');
    }
    setLoading(false);
  };

  const handleViewAs = async (userId) => {
    setError('');
    try {
      await viewAs(userId, user?.name || 'Admin');
    } catch (err) {
      setError(err.message || 'Could not start view-as');
    }
  };

  const handleRevokeInvite = async (id) => {
    try {
      await api.revokeInvite(id);
      await loadInvites();
    } catch (err) {
      setError(err.message);
    }
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
      await addTeam({ name: teamName.trim(), managerUserId: teamManagerId || null });
      setTeamName('');
      setTeamManagerId('');
    } catch (err) {
      setTeamError(err.message || 'Failed to add team');
    }
  };

  const handleStartEditTeam = (team) => {
    setEditingTeamId(team.id);
    setEditingTeamName(team.name);
    setEditingTeamManagerId(team.managerUserId || team.managerUser?.id || '');
    setTeamError('');
  };

  const handleCancelEditTeam = () => {
    setEditingTeamId(null);
    setEditingTeamName('');
    setEditingTeamManagerId('');
  };

  const handleSaveEditTeam = async () => {
    if (!editingTeamName.trim()) return;
    try {
      await updateTeam(editingTeamId, {
        name: editingTeamName.trim(),
        managerUserId: editingTeamManagerId || null,
      });
      handleCancelEditTeam();
    } catch (err) {
      setTeamError(err.message || 'Failed to update team');
    }
  };

  const handleDeleteTeam = async (team) => {
    const count = resources.filter((r) => (r.teams || []).some((t) => t.id === team.id)).length;
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

  const handleRemove = async (memberId, name) => {
    if (!confirm(`Remove ${name} from this organization?`)) return;
    try {
      await api.removeMember(memberId);
      await loadMembers();
    } catch (err) {
      setError(err.message);
    }
  };

  const NAV_SECTIONS = [
    { id: 'account', label: 'Your account' },
    { id: 'organization', label: 'Organization' },
    ...(isAdmin
      ? [
          { id: 'planning', label: 'Planning range' },
          { id: 'reminders', label: 'Reminders' },
          { id: 'trend', label: 'Performance trend' },
          { id: 'teams', label: 'Teams' },
          { id: 'taxonomy', label: 'Roles taxonomy' },
          { id: 'skills', label: 'Skills' },
          { id: 'categories', label: 'Log categories' },
        ]
      : []),
    { id: 'members', label: 'Members' },
    ...(isAdmin ? [{ id: 'roles', label: 'Roles & permissions' }] : []),
    ...(isAdmin ? [{ id: 'integrations', label: 'Integrations' }] : []),
  ];

  // Scroll-spy: highlight the section currently near the top of the viewport.
  useEffect(() => {
    const ids = NAV_SECTIONS.map((s) => s.id);
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean);
    if (els.length === 0) return;
    const seen = {};
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen[e.target.id] = e.isIntersecting;
        const top = ids.find((id) => seen[id]);
        if (top) setActiveSection(top);
      },
      { rootMargin: '-12% 0px -78% 0px', threshold: 0 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  return (
    <div className="max-w-[920px] mx-auto px-5 py-6">
      <PageHeader title="Settings" subtitle={`${currentOrg?.name || ''} · organization`} />
      <div className="flex gap-6 items-start">
        {/* section anchor nav */}
        <nav className="hidden md:flex flex-col gap-0.5 w-[150px] shrink-0 sticky top-4">
          {NAV_SECTIONS.map((sec) => (
            <a
              key={sec.id}
              href={`#${sec.id}`}
              onClick={() => setActiveSection(sec.id)}
              className={`text-[11px] font-bold rounded-lg px-3 py-2 no-underline transition-colors ${
                activeSection === sec.id ? 'text-primary bg-primary-light' : 'text-text-mid hover:bg-white'
              }`}
            >
              {sec.label}
            </a>
          ))}
        </nav>

        <div className="flex-1 min-w-0">
      {/* Your account — sign-in methods for the current user (all roles). */}
      <div id="account" className="scroll-mt-4 bg-white rounded-2xl border border-border-light shadow-card p-5 mb-4">
        <h3 className="text-sm font-bold text-text mb-1">Your account</h3>
        <p className="text-xs text-text-mid mb-3">{user?.email}</p>
        {justLinkedMicrosoft && (
          <div className="text-xs text-success bg-success-bg p-2 rounded mb-3">
            Microsoft account connected. You can now use "Sign in with Microsoft".
          </div>
        )}
        {accountError && (
          <div className="text-xs text-danger bg-danger-bg p-2 rounded mb-3">{accountError}</div>
        )}
        {authConfig.microsoftEnabled ? (
          user?.microsoftLinked ? (
            <p className="text-xs font-semibold text-success">✓ Microsoft sign-in connected</p>
          ) : (
            <div>
              <Button onClick={handleConnectMicrosoft}>Connect Microsoft account</Button>
              <p className="text-[10px] text-text-light mt-2">
                Links your Microsoft work account to this profile so you can use "Sign in with Microsoft".
              </p>
            </div>
          )
        ) : (
          <p className="text-[10px] text-text-light">Microsoft sign-in is not enabled on this deployment.</p>
        )}
      </div>

      <div id="organization" className="scroll-mt-4 bg-white rounded-2xl border border-border-light shadow-card p-5 mb-4">
        <h3 className="text-sm font-bold text-text mb-3">Organization</h3>
        <div className="text-xs text-text-mid">
          <p><strong>Name:</strong> {currentOrg?.name}</p>
          <p className="mt-1"><strong>Your role:</strong> {role}</p>
        </div>
      </div>

      {isAdmin && (
        <div id="planning" className="scroll-mt-4 bg-white rounded-2xl border border-border-light shadow-card p-5 mb-4">
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
        <div id="reminders" className="scroll-mt-4 bg-white rounded-2xl border border-border-light shadow-card p-5 mb-4">
          <h3 className="text-sm font-bold text-text mb-3">Reminders</h3>
          <p className="text-[10px] text-text-light mb-3">
            In-app reminders shown to managers and responsible people on the People page. A
            reminder fires on every Nth day/week/month from the start date; it clears once the
            1:1 / update happens. Leave "every" or the start date empty to turn a reminder off.
            Monthly client signals are always flagged when missing for the current month.
          </p>
          <div className="space-y-3">
            {[
              { label: '1:1 reminder', sched: oneOnOneSched, set: setOneOnOneSched },
              { label: 'PM update reminder', sched: pmLogSched, set: setPmLogSched },
            ].map(({ label, sched, set }) => (
              <div key={label} className="flex gap-3 items-end flex-wrap">
                <div className="w-[140px]">
                  <label className="block text-[10px] font-semibold text-text-mid mb-1">
                    {label}: every
                  </label>
                  <input
                    type="number" min="1" max="365" value={sched.every}
                    onChange={(e) => set((s) => ({ ...s, every: e.target.value }))}
                    placeholder="N"
                    className="w-full px-3 py-1.5 border border-border rounded-lg text-xs font-mono text-text outline-none focus:border-primary"
                  />
                </div>
                <div className="w-[120px]">
                  <label className="block text-[10px] font-semibold text-text-mid mb-1">
                    Frequency
                  </label>
                  <select
                    value={sched.unit}
                    onChange={(e) => set((s) => ({ ...s, unit: e.target.value }))}
                    className="w-full px-2 py-1.5 border border-border rounded-lg text-xs text-text outline-none focus:border-primary bg-white"
                  >
                    <option value="daily">days</option>
                    <option value="weekly">weeks</option>
                    <option value="monthly">months</option>
                  </select>
                </div>
                <div className="w-[160px]">
                  <label className="block text-[10px] font-semibold text-text-mid mb-1">
                    Starting on
                  </label>
                  <input
                    type="date" value={sched.start}
                    onChange={(e) => set((s) => ({ ...s, start: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-border rounded-lg text-xs font-mono text-text outline-none focus:border-primary"
                  />
                </div>
              </div>
            ))}
            <div className="flex justify-end">
              <Button onClick={handleSaveReminders} disabled={reminderSaving}>
                {reminderSaving ? 'Saving...' : reminderSuccess ? 'Saved!' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {isAdmin && (
        <div id="trend" className="scroll-mt-4 bg-white rounded-2xl border border-border-light shadow-card p-5 mb-4">
          <h3 className="text-sm font-bold text-text mb-3">Performance Trend</h3>
          <p className="text-[10px] text-text-light mb-3">
            Default time window used on the Person Performance tab for the overall grade, trend chart, and category breakdown. Choose a rolling window or a calendar-aligned period. Viewers can still override this on the tab.
          </p>
          <div className="flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-[180px] max-w-[240px]">
              <label className="block text-[10px] font-semibold text-text-mid mb-1">Default type</label>
              <select
                value={perfTrendKind}
                onChange={(e) => setPerfTrendKind(e.target.value)}
                className="w-full px-2 py-1.5 border border-border rounded-lg text-xs text-text outline-none focus:border-primary bg-white"
              >
                <option value="rolling_months">Rolling months</option>
                <option value="calendar_quarter">Current calendar quarter</option>
                <option value="calendar_half">Current calendar half-year</option>
                <option value="calendar_year">Current calendar year</option>
                <option value="custom">Custom (from / to)</option>
              </select>
            </div>
            {perfTrendKind === 'rolling_months' && (
              <div className="flex-1 max-w-[140px]">
                <label className="block text-[10px] font-semibold text-text-mid mb-1">Months</label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={perfTrendMonths}
                  onChange={(e) => setPerfTrendMonths(e.target.value)}
                  className="w-full px-3 py-1.5 border border-border rounded-lg text-xs font-mono text-text outline-none focus:border-primary"
                />
              </div>
            )}
            {perfTrendKind === 'custom' && (
              <>
                <div className="flex-1 max-w-[170px]">
                  <label className="block text-[10px] font-semibold text-text-mid mb-1">From</label>
                  <input
                    type="date"
                    value={perfTrendFrom}
                    onChange={(e) => setPerfTrendFrom(e.target.value)}
                    className="w-full px-2 py-1.5 border border-border rounded-lg text-xs font-mono text-text outline-none focus:border-primary"
                  />
                </div>
                <div className="flex-1 max-w-[170px]">
                  <label className="block text-[10px] font-semibold text-text-mid mb-1">
                    To <span className="text-text-light font-normal">(optional)</span>
                  </label>
                  <input
                    type="date"
                    value={perfTrendTo}
                    onChange={(e) => setPerfTrendTo(e.target.value)}
                    min={perfTrendFrom || undefined}
                    className="w-full px-2 py-1.5 border border-border rounded-lg text-xs font-mono text-text outline-none focus:border-primary"
                  />
                </div>
              </>
            )}
            <Button onClick={handleSavePerfTrend} disabled={perfTrendSaving}>
              {perfTrendSaving ? 'Saving...' : perfTrendSuccess ? 'Saved!' : 'Save'}
            </Button>
          </div>
        </div>
      )}

      {isAdmin && (
        <div id="teams" className="scroll-mt-4 bg-white rounded-2xl border border-border-light shadow-card p-5 mb-4">
          <h3 className="text-sm font-bold text-text mb-3">Teams</h3>
          <p className="text-[10px] text-text-light mb-3">
            Group people into teams. A person can belong to multiple teams. Each team can have a manager whose ownership is inherited by all team members.
          </p>

          {teamError && (
            <div className="text-xs text-danger bg-danger-bg p-2 rounded mb-3">{teamError}</div>
          )}

          <div className="space-y-1 mb-3">
            {teams.map((t) => {
              const count = resources.filter((r) => (r.teams || []).some((rt) => rt.id === t.id)).length;
              const isEditing = editingTeamId === t.id;
              const managerName = t.managerUser?.name || members.find((m) => m.user.id === t.managerUserId)?.user.name;
              return (
                <div key={t.id} className="py-1.5 px-2 rounded-lg hover:bg-primary-bg/30">
                  {isEditing ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="text"
                        value={editingTeamName}
                        onChange={(e) => setEditingTeamName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEditTeam();
                          if (e.key === 'Escape') handleCancelEditTeam();
                        }}
                        autoFocus
                        className="flex-1 min-w-[120px] px-2 py-1 border border-border rounded text-xs text-text outline-none focus:border-primary"
                      />
                      <select
                        value={editingTeamManagerId}
                        onChange={(e) => setEditingTeamManagerId(e.target.value)}
                        className="px-2 py-1 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white"
                      >
                        <option value="">No manager</option>
                        {members.filter((m) => m.role !== 'viewer').map((m) => (
                          <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={handleSaveEditTeam}
                        className="text-[10px] text-primary bg-transparent border-0 cursor-pointer hover:underline px-1"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEditTeam}
                        className="text-[10px] text-text-light bg-transparent border-0 cursor-pointer hover:text-text-mid px-1"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="flex-1 text-xs font-semibold text-text">{t.name}</span>
                      {managerName && (
                        <span className="text-[10px] text-text-light">Manager: {managerName}</span>
                      )}
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
                    </div>
                  )}
                </div>
              );
            })}
            {teams.length === 0 && (
              <p className="text-xs text-text-light py-2">No teams yet.</p>
            )}
          </div>

          <form onSubmit={handleAddTeam} className="flex gap-2 items-end pt-3 border-t border-border-light flex-wrap">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-[10px] font-semibold text-text-mid mb-1">Team name</label>
              <input
                type="text" value={teamName} onChange={(e) => setTeamName(e.target.value)}
                placeholder="e.g. Data Platform" required
                className="w-full px-3 py-1.5 border border-border rounded-lg text-xs text-text outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-text-mid mb-1">Manager</label>
              <select
                value={teamManagerId}
                onChange={(e) => setTeamManagerId(e.target.value)}
                className="px-2 py-1.5 border border-border rounded-lg text-xs text-text outline-none focus:border-primary bg-white"
              >
                <option value="">No manager</option>
                {members.filter((m) => m.role !== 'viewer').map((m) => (
                  <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
                ))}
              </select>
            </div>
            <Button type="submit">Add Team</Button>
          </form>
        </div>
      )}

      {isAdmin && <TaxonomySection />}

      {isAdmin && (
        <div id="skills" className="scroll-mt-4 bg-white rounded-2xl border border-border-light shadow-card p-5 mb-4">
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

      {isAdmin && (
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
      )}

      <div id="members" className="scroll-mt-4 bg-white rounded-2xl border border-border-light shadow-card p-5 mb-4">
        <h3 className="text-sm font-bold text-text mb-4">Members</h3>

        {error && (
          <div className="text-xs text-danger bg-danger-bg p-2 rounded mb-3">{error}</div>
        )}
        {memberNotice && (
          <div className="text-xs text-primary bg-primary-light p-2 rounded mb-3">{memberNotice}</div>
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
                  {roleOptions.map((r) => (
                    <option key={r.key} value={r.key}>{r.name}</option>
                  ))}
                </select>
              ) : (
                <span className="text-[10px] text-text-light capitalize">{m.role}</span>
              )}
              {isAdmin && m.user.id !== user?.id && (
                <button
                  onClick={() => handleViewAs(m.user.id)}
                  className="text-[10px] text-primary bg-transparent border-0 cursor-pointer hover:text-primary/80 px-1"
                  title="See the app exactly as this person does (read-only)"
                >
                  View as
                </button>
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

        {/* Pending invites */}
        {isAdmin && invites.length > 0 && (
          <div className="mb-4 pt-3 border-t border-border-light">
            <h4 className="text-[11px] font-bold text-text-mid uppercase tracking-wide mb-2">Pending invites</h4>
            <div className="space-y-2">
              {invites.map((inv) => (
                <div key={inv.id} className="flex items-center gap-3 py-1.5 px-3 rounded-lg bg-primary-bg/30">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-text truncate">{inv.email}</div>
                    <div className="text-[10px] text-text-light">Invited as {inv.role} — awaiting first sign-in</div>
                  </div>
                  <button
                    onClick={() => handleRevokeInvite(inv.id)}
                    className="text-[10px] text-danger bg-transparent border-0 cursor-pointer hover:text-danger/80 px-1"
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

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
                {roleOptions.map((r) => (
                  <option key={r.key} value={r.key}>{r.name}</option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add'}
            </Button>
          </form>
        )}
      </div>

      {isAdmin && (
        <div id="roles" className="scroll-mt-4 bg-white rounded-2xl border border-border-light shadow-card p-5 mb-4">
          <h3 className="text-sm font-bold text-text mb-4">Roles &amp; permissions</h3>
          <RolesSection onRolesChanged={loadRoleOptions} />
        </div>
      )}

      {isAdmin && <IntegrationsSection />}
        </div>
      </div>
    </div>
  );
}
