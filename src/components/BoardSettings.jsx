import { useState } from 'react';
import { Checkbox, Select, Typography } from 'antd';
import D from '../data';
import { ALL_KEYS, REQUIRED, colsOf, loadBoardUsers, loadDefaults, presetKeys, roleDefault, saveDefaults } from '../board/store';
import { isAdmin } from '../board/status';
import { norm } from '../board/model.jsx';
import { Sheet, SheetHead } from './ClassicSheet';

const { Text } = Typography;
const ROLES = ['ADMIN', 'MOD', 'CAPTAIN'];
const PRESETS = ['All', 'Compact', 'Minimum'];
const roleName = (r) => r.charAt(0) + r.slice(1).toLowerCase();

// A column list in board order, required columns in, so lists compare whatever order they were written in.
const inOrder = (list) => ALL_KEYS.filter((k) => list.includes(k) || REQUIRED.includes(k)).join();
// The preset a column list matches exactly, if any ('All' = every column).
const presetOf = (cols) => PRESETS.find((p) => inOrder(presetKeys(p)) === inOrder(cols)) || null;

// "Board display" sheet (D1): which columns to show. Everyone edits their own view (saved on this device).
// An admin can instead set the default columns of a role or of one user (Apply to); those are defaults, not
// permissions. Quick picks: Default (no columns of its own: follow the next level), All, Compact, Minimum;
// or tick columns by hand. Edits are drafts; nothing changes until Done.
export default function BoardSettings({ cfg, role, onApply, onDefaults, onClose }) {
  const admin = isAdmin(role);
  const users = admin ? loadBoardUsers() : [];
  const [defs] = useState(loadDefaults);
  const [target, setTarget] = useState('me'); // 'me' · 'role:MOD' · 'user:<name>'
  // Per target: its columns, or null = no columns of its own (falls back to the next level).
  const [drafts, setDrafts] = useState({});

  const [kind, key] = target === 'me' ? ['me', ''] : [target.slice(0, 4), target.slice(5)];
  const userRole = (name) => (users.find((u) => u.name === name) || {}).role;
  const stored = (t) => {
    if (t === 'me') return cfg.columns;
    const [k, v] = [t.slice(0, 4), t.slice(5)];
    return colsOf(k === 'role' ? defs.roles[v] : defs.users[v]);
  };
  const own = (t) => (t in drafts ? drafts[t] : stored(t));
  // What the target sees when it has no columns of its own.
  const fallback = (t) => {
    if (t === 'me') return roleDefault(role);
    const [k, v] = [t.slice(0, 4), t.slice(5)];
    if (k === 'role') return colsOf(defs.global) || ALL_KEYS.slice();
    return colsOf(defs.roles[userRole(v)]) || colsOf(defs.global) || ALL_KEYS.slice();
  };
  const cols = own(target) || fallback(target);
  const hasOwn = !!own(target);
  const preset = hasOwn ? presetOf(cols) : null;
  const all = cols.length === ALL_KEYS.length;
  const setCols = (next) => setDrafts((d) => ({ ...d, [target]: ALL_KEYS.filter((k) => next.includes(k) || REQUIRED.includes(k)) }));
  const useDefault = () => setDrafts((d) => ({ ...d, [target]: null }));

  function done() {
    let changedDefaults = false;
    const d = loadDefaults();
    Object.entries(drafts).forEach(([t, list]) => {
      if (t === 'me') return;
      const [k, v] = [t.slice(0, 4), t.slice(5)];
      const value = list && list.length === ALL_KEYS.length ? 'All' : list;
      if (k === 'role') d.roles[v] = value;
      else if (value) d.users[v] = value;
      else delete d.users[v];
      changedDefaults = true;
    });
    if (changedDefaults) {
      saveDefaults(d);
      onDefaults(Object.keys(drafts).filter((t) => t !== 'me').length);
    }
    if ('me' in drafts) {
      const mine = drafts.me;
      // Stored as null while it equals the default, so a changed default still applies.
      onApply({ ...cfg, columns: !mine || inOrder(mine) === inOrder(roleDefault(role)) ? null : mine });
    }
    onClose();
  }

  const who = kind === 'me' ? 'you, on this device' : kind === 'role' ? `every ${roleName(key)}` : key;
  // Where "Default" takes this target's columns from.
  const defaultFrom = kind === 'me' ? 'the defaults an admin set for you or your role' : kind === 'role' ? 'the global default' : 'their role default';
  const presetNote = !hasOwn
    ? `Default: follows ${defaultFrom} (${cols.length} columns).`
    : preset === 'Compact'
      ? 'Vessel, port, status, No., POB in / out.'
      : preset === 'Minimum'
        ? 'Vessel and status only.'
        : preset === 'All'
          ? 'Every column.'
          : 'Custom: the columns ticked below.';

  return (
    <Sheet className="tall" onClose={onClose}>
      <SheetHead title="Board display" onClose={onClose} />
      <div className="cfg-scroll">
        {admin && (
          <div className="cfg-sec">
            <label className="cfg-label" htmlFor="bd-target">
              Apply to
            </label>
            <Select
              id="bd-target"
              style={{ width: '100%' }}
              value={target}
              onChange={setTarget}
              showSearch
              // "tung" finds "Captain Tùng"
              filterOption={(input, o) => !o.options && norm(o.label).includes(norm(input))}
              options={[
                { value: 'me', label: 'Only me (this device)' },
                { label: 'Role default', options: ROLES.map((r) => ({ value: 'role:' + r, label: `${roleName(r)} (everyone with this role)` })) },
                { label: 'User default', options: users.map((u) => ({ value: 'user:' + u.name, label: `${u.name} · ${roleName(u.role)}` })) }
              ]}
            />
          </div>
        )}
        <div className="cfg-sec">
          <div className="cfg-title">Preset</div>
          <div className="cfg-seg">
            <button type="button" className={!hasOwn ? 'on' : ''} onClick={useDefault}>
              Default
            </button>
            {PRESETS.map((p) => (
              <button key={p} type="button" className={preset === p ? 'on' : ''} onClick={() => setCols(presetKeys(p))}>
                {p}
              </button>
            ))}
          </div>
          <p className="cfg-note">{presetNote}</p>
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
          {kind === 'me'
            ? 'Saved on this device only. It overrides the defaults an admin set for your role or for you.'
            : `Default columns for ${who}. A default, not a permission: they can still change their own view on their device.`}
        </p>
      </div>
      <div className="bsheet-btns">
        <button type="button" className="clear" disabled={!hasOwn} onClick={useDefault}>
          {kind === 'me' ? 'Reset columns' : 'Clear default'}
        </button>
        <button type="button" className="done" onClick={done}>
          Done
        </button>
      </div>
    </Sheet>
  );
}
