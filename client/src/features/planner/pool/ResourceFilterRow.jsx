export default function ResourceFilterRow({ label, options, value, onChange }) {
  return (
    <div className="mb-2">
      <div className="text-[10px] uppercase tracking-wider text-text-light font-semibold mb-1">{label}</div>
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => (
          <button key={opt} onClick={() => onChange(opt)}
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold cursor-pointer border-0 transition ${
              value === opt
                ? 'bg-primary text-white'
                : 'bg-white text-text-mid hover:bg-primary-bg'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
