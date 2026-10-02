import { pobTitle } from './model.jsx';

// POB in / POB out cell, shared by the plan board and History: '#' = will not happen, blank = not decided yet,
// a blue frame and ✓ = signed by the pilot.
export function Pob({ row, field }) {
  if (row[field + 'Never']) {
    return (
      <span className="never" title="This POB will not happen">
        #
      </span>
    );
  }
  const value = (row[field] || '').replace(/\s*✓$/, ''); // fixture times carry a trailing "✓"
  if (!value) return <span className="pob-empty" title="Not decided yet" />;
  return (
    <span title={pobTitle(value) + (row[field + 'Signed'] ? ' · signed' : '')}>
      <span className={'t' + (row[field + 'Signed'] ? ' signed-t' : '')}>{value}</span>
      {row[field + 'Signed'] && (
        <i className="ok" title="Signed">
          ✓
        </i>
      )}
    </span>
  );
}
