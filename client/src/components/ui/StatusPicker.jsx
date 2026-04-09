export default function StatusPicker({ value, onChange }) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onChange('realised')}
        className={`px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
          value === 'realised'
            ? 'bg-success text-white border-2 border-success'
            : 'bg-white text-text-light border border-border'
        }`}
      >
        Realised
      </button>
      <button
        type="button"
        onClick={() => onChange('potential')}
        className={`px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
          value === 'potential'
            ? 'bg-warning text-white border-2 border-warning'
            : 'bg-white text-text-light border border-border'
        }`}
      >
        Potential
      </button>
    </div>
  );
}
