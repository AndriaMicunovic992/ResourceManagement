import Button from '../../../components/ui/Button';

export default function ResourcePoolHeader({ onAdd, canEdit }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-light">
      <span className="font-bold text-[15px] text-text">People</span>
      {canEdit && (
        <Button onClick={onAdd}>+ Add</Button>
      )}
    </div>
  );
}
