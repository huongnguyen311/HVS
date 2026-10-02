import { useState } from 'react';
import { AutoComplete, Flex, Input, Select } from 'antd';
import D from '../data';
import { clientItems, ctxFilter, ctxOptions, knownPorts, portItems, vesselItems } from '../board/model.jsx';
import { Sheet, SheetHead } from './ClassicSheet';
import PobField, { pobPatch } from './PobField';

const opts = (list) => list.map((v) => ({ value: v }));
const EMPTY = { port: '', vessel: '', loa: '', dwt: '', agency: '', mod: '', note: '', cc: '' };

// POB in / out open on Time with the pickers empty; left empty they save as not set (TBC).
const NO_POB = { mode: 'time', t: '', signed: false };

const Field = ({ label, req, children }) => (
  <label className="fs-field">
    <span className="cfg-label">
      {label}
      {req && <span className="req"> *</span>}
    </span>
    {children}
  </label>
);

// New ticket (the green + on the board): the prototype's create row, laid out as a phone sheet.
// Services: pick at least one, nothing pre-selected; each one becomes a block on the board.
// The ticket lands at the top of the pending band.
export default function NewTicketSheet({ rows = [], mods = [], onCreate, onError, onClose }) {
  const [f, setF] = useState(EMPTY);
  const [pobIn, setPobIn] = useState(NO_POB);
  const [pobOut, setPobOut] = useState(NO_POB);
  const [services, setServices] = useState([]);
  const [tried, setTried] = useState(false);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const toggle = (code) => setServices((l) => (l.includes(code) ? l.filter((c) => c !== code) : [...l, code]));

  function create() {
    setTried(true);
    if (!f.vessel.trim() || !f.port.trim()) return onError('Vessel and port are required');
    if (!services.length) return onError('Choose at least one service');
    onCreate({
      port: f.port.trim(),
      portAlert: !knownPorts().includes(f.port.trim()),
      vessel: f.vessel.trim(),
      vesselAlert: !D.boardVessels.includes(f.vessel.trim()),
      loa: f.loa.trim(),
      dwt: f.dwt.trim(),
      agency: f.agency.trim(),
      mod: f.mod,
      ...pobPatch('pobIn', pobIn),
      ...pobPatch('pobOut', pobOut),
      note: f.note.trim(),
      cc: f.cc.trim(),
      services: D.services.map((s) => s.code).filter((code) => services.includes(code))
    });
    onClose();
  }

  return (
    <Sheet className="tall" onClose={onClose}>
      <SheetHead title="New ticket" onClose={onClose} />
      <div className="cfg-scroll">
        <Flex vertical gap={12} className="cfg-sec">
          <Flex gap={10}>
            <Field label="Port" req>
              <AutoComplete style={{ width: '100%' }} popupMatchSelectWidth={260} value={f.port} options={ctxOptions(portItems())} placeholder="Port" onChange={(port) => set({ port })} filterOption={ctxFilter} />
            </Field>
            <Field label="Vessel" req>
              <AutoComplete style={{ width: '100%' }} popupMatchSelectWidth={260} value={f.vessel} options={ctxOptions(vesselItems(rows))} placeholder="Vessel" onChange={(vessel) => set({ vessel })} filterOption={ctxFilter} />
            </Field>
          </Flex>
          <Flex gap={10}>
            <Field label="LOA (m)">
              <Input value={f.loa} placeholder="LOA" inputMode="decimal" onChange={(e) => set({ loa: e.target.value })} />
            </Field>
            <Field label="DWT">
              <Input value={f.dwt} placeholder="DWT" inputMode="numeric" onChange={(e) => set({ dwt: e.target.value })} />
            </Field>
          </Flex>
          <Flex gap={10}>
            <Field label="Agency/Owner">
              <AutoComplete
                style={{ width: '100%' }}
                value={f.agency}
                popupMatchSelectWidth={280}
                options={ctxOptions(clientItems())}
                placeholder="Agency/Owner"
                onChange={(agency) => set({ agency })}
                onSelect={(agency) => set({ agency })}
                filterOption={ctxFilter}
              />
            </Field>
            {/* A div, not a <label>, so the Select opens on its own click. */}
            <div className="fs-field">
              <span className="cfg-label">Assign MOD</span>
              <Select
                style={{ width: '100%' }}
                allowClear
                placeholder="MOD on duty"
                popupMatchSelectWidth={240}
                value={f.mod || undefined}
                onChange={(mod) => set({ mod: mod || '' })}
                options={mods.map((u) => ({ value: u.name, label: `${u.name} · ${u.phone}` }))}
              />
            </div>
          </Flex>
          {/* A div, not a <label>: a label would send every click inside it to the first picker. */}
          <div className="fs-field">
            <span className="cfg-label">POB in</span>
            <PobField value={pobIn} onChange={setPobIn} noSign />
          </div>
          <div className="fs-field">
            <span className="cfg-label">POB out</span>
            <PobField value={pobOut} onChange={setPobOut} noSign fallback={pobIn.mode === 'time' ? pobIn.t : undefined} />
          </div>
          <div className={'fs-field' + (tried && !services.length ? ' invalid' : '')}>
            <span className="cfg-label">
              Services<span className="req"> *</span>
            </span>
            <div className="svc-chips" style={{ marginTop: 0 }}>
              {D.services.map((s) => (
                <button key={s.code} type="button" className={'svc-chip' + (services.includes(s.code) ? ' on' : '')} onClick={() => toggle(s.code)}>
                  <i style={{ background: s.color, borderColor: s.border }} />
                  {s.name}
                </button>
              ))}
            </div>
            {tried && !services.length && <div className="svc-error">Choose at least one service</div>}
          </div>
          <Field label="Note">
            <Input.TextArea rows={2} value={f.note} placeholder="What the client asked for" onChange={(e) => set({ note: e.target.value })} />
          </Field>
          <Field label="CC email (optional)">
            <Input value={f.cc} type="email" placeholder="name@company.com" onChange={(e) => set({ cc: e.target.value })} />
          </Field>
        </Flex>
      </div>
      <div className="bsheet-btns">
        <button type="button" className="clear" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="done" onClick={create}>
          Create
        </button>
      </div>
    </Sheet>
  );
}
