import { useState } from 'react';
import { DatePicker, Flex, Select } from 'antd';
import D from '../data';
import { UNASSIGNED, fromDayjs, pobTitle, toDayjs } from '../board/model.jsx';
import { Sheet, SheetHead } from './ClassicSheet';

const opts = (list) => list.map((v) => ({ value: v, label: v }));

const NAMES = { location: 'Location', port: 'Port', vessel: 'Vessel', pobFrom: 'POB in from', pobTo: 'POB out to' };

// One chip per active filter, for the toolbar row.
export function filterChips(f) {
  return Object.keys(NAMES)
    .filter((k) => f[k])
    .map((k) => ({ key: k, label: `${NAMES[k]}: ${k === 'pobFrom' || k === 'pobTo' ? pobTitle(f[k]).replace(/^\w+ /, '') : f[k]}` }));
}

// The board filters: location band, port, vessel, POB window.
export function FilterFields({ f, set, ports, vessels }) {
  const pick = (key, options) => (
    <label className="fs-field">
      <span className="cfg-label">{NAMES[key]}</span>
      <Select
        style={{ width: '100%' }}
        placeholder={`Any ${NAMES[key].toLowerCase()}`}
        allowClear
        showSearch
        options={opts(options)}
        value={f[key] || undefined}
        onChange={(v) => set({ [key]: v || '' })}
      />
    </label>
  );

  const when = (key) => (
    <label className="fs-field">
      <span className="cfg-label">{NAMES[key]}</span>
      <DatePicker
        style={{ width: '100%' }}
        showTime={{ format: 'HH:mm' }}
        format="HH:mm - DD/MM/YYYY"
        placeholder="hh:mm - dd/mm/yyyy"
        value={toDayjs(f[key])}
        onChange={(d) => set({ [key]: fromDayjs(d) })}
      />
    </label>
  );

  return (
    <Flex vertical gap={12}>
      {pick('location', D.boardLocations.concat(UNASSIGNED))}
      {pick('port', ports)}
      {pick('vessel', vessels)}
      {when('pobFrom')}
      {when('pobTo')}
    </Flex>
  );
}

// "Filters" sheet (the funnel beside the gear): only the board filters. Edits a draft; nothing changes until Done.
export default function FilterSheet({ filters, ports, vessels, onApply, onClose }) {
  const [f, setF] = useState({ ...filters });
  return (
    <Sheet onClose={onClose}>
      <SheetHead title="Filters" onClose={onClose} />
      <div className="cfg-scroll">
        <div className="cfg-sec">
          <FilterFields f={f} set={(patch) => setF((x) => ({ ...x, ...patch }))} ports={ports} vessels={vessels} />
        </div>
        <p className="cfg-note">Active filters show as chips above the board; tap ✕ on a chip to clear it.</p>
      </div>
      <div className="bsheet-btns">
        <button type="button" className="clear" onClick={() => setF({})}>
          Clear all
        </button>
        <button
          type="button"
          className="done"
          onClick={() => {
            onApply(Object.fromEntries(Object.entries(f).filter(([, v]) => v)));
            onClose();
          }}
        >
          Done
        </button>
      </div>
    </Sheet>
  );
}
