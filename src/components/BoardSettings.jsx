import { useState } from 'react';
import { Checkbox, Typography } from 'antd';
import D from '../data';
import { ALL_KEYS, REQUIRED, defaultSource, presetKeys, roleDefault } from '../board/store';
import { isAdmin } from '../board/status';
import { Sheet, SheetHead } from './ClassicSheet';

const { Text } = Typography;
const PRESETS = ['All', 'Compact', 'Minimum'];
const roleName = (r) => r.charAt(0) + r.slice(1).toLowerCase();

// A column list in board order, required columns in, so lists compare whatever order they were written in.
const inOrder = (list) => ALL_KEYS.filter((k) => list.includes(k) || REQUIRED.includes(k)).join();
// The preset a column list matches exactly, if any ('All' = every column).
const presetOf = (cols) => PRESETS.find((p) => inOrder(presetKeys(p)) === inOrder(cols)) || null;

// "Board display" sheet (D1): your own columns on this device. It starts from your default, which an admin
// sets on Admin › Board Defaults (Plan board default → your role → an exception for you); the first line says
// which one applies. Pick Default, a preset (All / Compact / Minimum) or tick columns. A draft until Done.
export default function BoardSettings({ cfg, role, onApply, onClose }) {
  const [draft, setDraft] = useState(cfg.columns); // null = follow your default
  const def = roleDefault(role);
  const cols = draft || def;
  const preset = draft ? presetOf(draft) : null;
  const all = cols.length === ALL_KEYS.length;
  const setCols = (next) => setDraft(ALL_KEYS.filter((k) => next.includes(k) || REQUIRED.includes(k)));
  const source = defaultSource(role);
  const from = source === 'user' ? 'set for you by an admin' : source === 'role' ? `the ${roleName(role)} default` : 'the Plan board default';

  function done() {
    // Stored as null while it equals the default, so a later change of the default still applies.
    onApply({ ...cfg, columns: !draft || inOrder(draft) === inOrder(def) ? null : draft });
    onClose();
  }

  return (
    <Sheet className="tall" onClose={onClose}>
      <SheetHead title="Board display" onClose={onClose} />
      <div className="cfg-scroll">
        <p className="cfg-source">
          Your default: <b>{`${def.length} columns`}</b>, {from}.
        </p>
        <div className="cfg-sec">
          <div className="cfg-title">Show</div>
          <div className="cfg-seg">
            <button type="button" className={!draft ? 'on' : ''} onClick={() => setDraft(null)}>
              Default
            </button>
            {PRESETS.map((p) => (
              <button key={p} type="button" className={preset === p ? 'on' : ''} onClick={() => setCols(presetKeys(p))}>
                {p}
              </button>
            ))}
          </div>
          {draft && !preset && <p className="cfg-note">Custom: the columns ticked below.</p>}
        </div>
        <div className="cfg-sec">
          <div className="cfg-title">
            Columns <span>{`${cols.length} of ${ALL_KEYS.length}`}</span>
          </div>
          <Checkbox
            className="cfg-all"
            checked={all}
            indeterminate={!all && cols.length > REQUIRED.length}
            onChange={(e) => setCols(e.target.checked ? ALL_KEYS.slice() : REQUIRED.slice())}
          >
            All
          </Checkbox>
          <Checkbox.Group
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}
            value={cols}
            onChange={setCols}
            options={D.boardColumns.map((c) => ({
              value: c.key,
              disabled: c.required,
              label: (
                <>
                  {c.label || 'ACTIONS'} {c.required && <Text type="secondary" style={{ fontSize: 11 }}>always shown</Text>}
                </>
              )
            }))}
          />
        </div>
        <p className="cfg-note">
          Saved on this device only.
          {isAdmin(role) && ' To set the columns other people start from, use Admin › Board Defaults.'}
        </p>
      </div>
      <div className="bsheet-btns">
        <button type="button" className="clear" disabled={!draft} onClick={() => setDraft(null)}>
          Back to default
        </button>
        <button type="button" className="done" onClick={done}>
          Done
        </button>
      </div>
    </Sheet>
  );
}
