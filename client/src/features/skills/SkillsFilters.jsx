export default function SkillsFilters({ filters, onChange, teams, categories }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        value={filters.search}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
        placeholder="Search people or skills…"
        className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-border bg-white text-text outline-none focus:border-primary min-w-[220px]"
      />
      {teams.length > 0 && (
        <select
          value={filters.teamId}
          onChange={(e) => onChange({ ...filters, teamId: e.target.value })}
          className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-border bg-white text-text-mid outline-none focus:border-primary cursor-pointer"
        >
          <option value="">All teams</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      )}
      {categories.length > 0 && (
        <select
          value={filters.category}
          onChange={(e) => onChange({ ...filters, category: e.target.value })}
          className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-border bg-white text-text-mid outline-none focus:border-primary cursor-pointer"
        >
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      )}
    </div>
  );
}
