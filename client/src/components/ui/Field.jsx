export default function Field({ label, children }) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-semibold text-text-mid mb-1.5 tracking-wide">{label}</label>
      {children}
    </div>
  );
}
