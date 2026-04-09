export default function EmptyState({ icon = '📅', message = 'No data yet' }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-text-light">
      <div className="text-4xl mb-3">{icon}</div>
      <div className="text-sm">{message}</div>
    </div>
  );
}
