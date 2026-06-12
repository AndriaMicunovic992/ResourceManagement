/** Shimmering placeholder blocks — the one loading pattern for panels/tables. */
export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded bg-border-light ${className}`} />;
}

export function SkeletonRows({ rows = 4 }) {
  return (
    <div className="space-y-2 p-1">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-3 w-1/4" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}

export default Skeleton;
