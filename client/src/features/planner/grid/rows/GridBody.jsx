import CustomerGridRow from './CustomerGridRow';
import ProjectGridRow from './ProjectGridRow';
import NeedGridRow from './NeedGridRow';

export default function GridBody({ rows, months, heldResource, onCellClick, onBarClick }) {
  return (
    <div>
      {rows.map((row, i) => {
        if (row.type === 'customer') {
          return <CustomerGridRow key={`c-${row.data.id}`} customer={row.data} index={i} months={months} />;
        }
        if (row.type === 'project') {
          return <ProjectGridRow key={`p-${row.data.id}`} project={row.data} months={months} />;
        }
        if (row.type === 'need') {
          return (
            <NeedGridRow key={`n-${row.data.id}`} need={row.data} project={row.project}
              months={months} heldResource={heldResource}
              onCellClick={onCellClick} onBarClick={onBarClick} />
          );
        }
        // empty project placeholder
        return <div key={`e-${row.data.id}`} className="flex h-[30px]">
          {months.map((m) => <div key={m} className="shrink-0" style={{ width: 82 }} />)}
        </div>;
      })}
    </div>
  );
}
