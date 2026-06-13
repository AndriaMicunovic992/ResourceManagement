import { useMemo } from 'react';
import OneOnOneCard from './OneOnOneCard';

export default function OneOnOneList({ oneOnOnes, onEdit, onDelete, readOnly = false }) {
  const sorted = useMemo(() => {
    return [...oneOnOnes].sort(
      (a, b) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime()
    );
  }, [oneOnOnes]);

  return (
    <div className="bg-white rounded-2xl border border-border-light shadow-card p-2">
      {sorted.map((record) => (
        <OneOnOneCard
          key={record.id}
          record={record}
          onEdit={() => onEdit(record.id)}
          onDelete={() => onDelete(record.id)}
          readOnly={readOnly}
        />
      ))}
    </div>
  );
}
