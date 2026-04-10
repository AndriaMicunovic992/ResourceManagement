const OPTIONS = ['M', 'Q', 'Y'];

export default function AggregationToggle({ value, onChange }) {
  return (
    <div className="flex rounded-full border border-border overflow-hidden">
      {OPTIONS.map((opt) => (
        <button key={opt} onClick={() => onChange(opt)}
          className={`px-3 py-1 text-[10px] font-bold cursor-pointer border-0 transition-all duration-100 active:scale-95 ${
            value === opt ? 'bg-primary text-white' : 'bg-white text-text-mid hover:bg-primary-bg'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
