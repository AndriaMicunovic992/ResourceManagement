/** Standard page header: big title, one-line (live) subtitle, actions right. */
export default function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex items-start mb-5 flex-wrap gap-3">
      <div>
        <h1 className="text-[22px] font-extrabold tracking-tight text-text m-0">{title}</h1>
        {subtitle && <p className="text-xs text-text-mid mt-1 m-0">{subtitle}</p>}
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
