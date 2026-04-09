import Button from '../../../components/ui/Button';

export default function ResourcePoolHeader({ onAdd, canEdit }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="font-bold text-[15px] text-text">Team</span>
      {canEdit && (
        <Button onClick={onAdd} className="text-[10px] px-3 py-1">+ Add</Button>
      )}
    </div>
  );
}
