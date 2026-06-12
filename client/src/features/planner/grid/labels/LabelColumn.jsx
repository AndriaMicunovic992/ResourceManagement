import CustomerLabel from './CustomerLabel';
import ProjectLabel from './ProjectLabel';
import NeedLabel from './NeedLabel';
import EmptyProjectLabel from './EmptyProjectLabel';
import { LW } from '../../../../lib/constants';

export default function LabelColumn({ rows, onEditCustomer, onDeleteCustomer, onAddProject, onEditProject, onDeleteProject, onAddNeed, onEditNeed, onDeleteNeed, onSuggestNeed, canEdit, needHeights }) {
  return (
    <div className="sticky left-0 z-[5] bg-white" style={{ width: LW, minWidth: LW }}>
      {/* Frozen corner: matches the grid header's stickiness so labels never
          slide under it. */}
      <div className="sticky top-0 z-[7] bg-white border-b-2 border-border" style={{ height: 46 }} />
      {rows.map((row, i) => {
        if (row.type === 'customer') {
          return <CustomerLabel key={`c-${row.data.id}`} customer={row.data}
            index={i} onEdit={() => onEditCustomer(row.data)} onDelete={() => onDeleteCustomer(row.data.id)}
            onAddProject={() => onAddProject(row.data)} canEdit={canEdit} />;
        }
        if (row.type === 'project') {
          return <ProjectLabel key={`p-${row.data.id}`} project={row.data} customer={row.customer}
            onEdit={() => onEditProject(row.data)} onDelete={() => onDeleteProject(row.data.id)}
            onAddNeed={() => onAddNeed(row.data)} canEdit={canEdit} />;
        }
        if (row.type === 'need') {
          return <NeedLabel key={`n-${row.data.id}`} need={row.data} project={row.project} customer={row.customer}
            onEdit={() => onEditNeed(row.data, row.project)} onDelete={() => onDeleteNeed(row.data.id)}
            onSuggest={onSuggestNeed ? (e) => onSuggestNeed(row.data, row.project, row.customer, e) : undefined}
            canEdit={canEdit} height={needHeights?.[row.data.id]} />;
        }
        return <EmptyProjectLabel key={`e-${row.data.id}`} />;
      })}
    </div>
  );
}
