import { useState } from 'react';
import { Button, Checkbox, Flex, InputNumber, Modal, Popconfirm, Select, Tag, Typography } from 'antd';
import D from '../data';
import { busyBoats, clampSlot, fmtMin, jobLabel, jobWindow, layoutQueues, locationOf, minToSlot, pobMin, ticketId, winText } from '../board/model.jsx';
import { KIND, jobSvc, svc, svcKind } from '../board/timeline';
import { pobPatch, pobValue } from './PobField';

const { Text } = Typography;
const toggled = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

// Drawing kind of a new job, by where its window comes from (CSS classes and the fixture use these).
const KIND_OF = { in: 'pobin', out: 'pobout', span: 'shift' };

// What the window edits: an existing job (ji) or a new one from Add service (draft).
// s = its catalogue row (null for an escort segment, which is edited on its own).
function target(r, ji, draft) {
  if (draft) {
    const s = svc(draft.service);
    return { s, kind: KIND_OF[s.at] || 'special', label: s.name, win: draft.win, note: draft.note, tugs: [], job: null };
  }
  const j = r.jobs[ji];
  return { s: jobSvc(j), kind: j.kind, label: jobLabel(j), win: jobWindow(j), note: j.note, tugs: j.kind === 'escort' ? [j.text] : j.text.split('-'), job: j };
}

const SHOW = 12; // boats shown per location before "Show all"

// Tugboat picker built for big fleets: picked boats stay on top (in block order, ✕ removes one), a
// "Free only" toggle narrows the list, and each location folds up with its own counts. The ticket's
// location comes first and opens; ★ boats lead each location, then free ones, busy ones last.
function Boats({ selected, busy, disabled, home, onToggle }) {
  const [freeOnly, setFreeOnly] = useState(false);
  const [open, setOpen] = useState(() => {
    const has = D.fleet.filter((g) => g.group === home || g.boats.some(([c]) => selected.includes(c))).map((g) => g.group);
    return has.length ? has : [D.fleet[0].group];
  });
  const [all, setAll] = useState([]);
  const isBusy = (c) => !!(busy && busy[c]);
  const isOff = (c) => !!(disabled && disabled.includes(c));
  const groups = [...D.fleet].sort((a, b) => (b.group === home) - (a.group === home));
  const total = D.fleet.reduce((n, g) => n + g.boats.length, 0);
  const flip = (list, set, g) => set(list.includes(g) ? list.filter((x) => x !== g) : [...list, g]);
  const clashes = selected.filter(isBusy);

  return (
    <div className="pbm-boats">
      <div className="pbm-picked">
        {selected.length ? (
          selected.map((c) => (
            <Tag key={c} closable color={isBusy(c) ? 'error' : 'blue'} onClose={(e) => (e.preventDefault(), onToggle(c))}>
              {c}
              {isBusy(c) ? ' ⚠' : ''}
            </Tag>
          ))
        ) : (
          <Text type="secondary">No tugboat picked yet</Text>
        )}
      </div>
      {clashes.length > 0 && (
        <Text type="danger" className="pbm-err">
          {clashes.join(', ')} already on another job at this time.
        </Text>
      )}
      {total > SHOW && (
        <Flex justify="flex-end" className="pbm-boatbar">
          <Checkbox checked={freeOnly} onChange={(e) => setFreeOnly(e.target.checked)}>
            Free only
          </Checkbox>
        </Flex>
      )}
      {groups.map((g) => {
        const boats = g.boats
          .filter(([c]) => !freeOnly || selected.includes(c) || (!isBusy(c) && !isOff(c)))
          .sort((a, b) => !!b[1] - !!a[1] || isBusy(a[0]) - isBusy(b[0]));
        const shut = !open.includes(g.group);
        const more = !all.includes(g.group) && boats.length > SHOW;
        const picked = g.boats.filter(([c]) => selected.includes(c)).length;
        const nBusy = g.boats.filter(([c]) => isBusy(c)).length;
        return (
          <div key={g.group} className="pbm-fleet">
            <button type="button" className={'pbm-loc' + (shut ? ' shut' : '')} onClick={() => flip(open, setOpen, g.group)} aria-expanded={!shut}>
              <i className="chev" />
              <b>{g.group}</b>
              {g.group === home && <Tag className="pbm-home">This port</Tag>}
              <span>
                {g.boats.length} boats
                {picked > 0 && <em className="on"> · {picked} picked</em>}
                {nBusy > 0 && <em> · {nBusy} busy</em>}
              </span>
            </button>
            {!shut && (
              <>
                <div className="pbm-grid">
                  {(more ? boats.slice(0, SHOW) : boats).map(([code, star]) => {
                    const on = selected.includes(code);
                    const off = isOff(code);
                    const b = isBusy(code);
                    return (
                      <button
                        key={code}
                        type="button"
                        className={'pbm-boat' + (on ? ' on' : '') + (b ? ' busy' : '') + (on && b ? ' clash' : '')}
                        disabled={off}
                        title={off ? 'Already on this job' : b ? 'Busy on ' + busy[code] : undefined}
                        onClick={() => onToggle(code)}
                      >
                        {star ? '★ ' : ''}
                        {code}
                        {b && !off ? ' ⚠' : ''}
                      </button>
                    );
                  })}
                  {!boats.length && <Text type="secondary">No free tugboat here.</Text>}
                </div>
                {more && (
                  <button type="button" className="pbm-more" onClick={() => flip(all, setAll, g.group)}>
                    Show all {boats.length}
                  </button>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

const timeOf = (v) => (v.mode === 'time' ? pobMin(v.t) : null);

// Assign tugboat: POB times, the window (services the MOD sets), the tugboats, and for POB services the
// escort (rule + boats) or the shipping time.
// escortOn: opened from Add service › Escort, so escort starts ticked.
export default function AssignModal({ row: r, rows, ji, draft, escortOn = false, onSave, onClose }) {
  const t = target(r, ji, draft);
  const s = t.s;
  const anchor = s && (s.at === 'in' || s.at === 'out') ? s.at : null;
  const main = !!anchor;
  const escortJobs = main && !draft ? r.jobs.map((j, i) => [j, i]).filter(([j]) => j.kind === 'escort' && j.anchor === anchor) : [];
  const rules = D.escortRules.filter((x) => x.anchor === anchor);

  // POB times are edited in Ticket actions; here they only place the job.
  const pobIn = pobValue(r, 'pobIn');
  const pobOut = pobValue(r, 'pobOut');
  const [tugs, setTugs] = useState(t.tugs);
  // The typed shipping time survives ticking escort on and off (and is kept on the job for next time).
  const [ship, setShip] = useState(() => {
    if (anchor !== 'in') return 0;
    if (t.job && t.job.shipMins != null) return t.job.shipMins;
    if ((r.ship || []).length) return r.ship[0].mins || r.ship[0].span * 30;
    return draft ? 30 : 0;
  });
  const [escort, setEscort] = useState(escortJobs.length > 0 || escortOn);
  const [rule, setRule] = useState((t.job && t.job.escortRule) || (rules[0] || {}).key);
  const [escortTugs, setEscortTugs] = useState(escortJobs.map(([j]) => j.text));

  // The window: POB services move with their POB, spanning ones follow POB in → out.
  const now = anchor ? timeOf(anchor === 'out' ? pobOut : pobIn) : null;
  let win = t.win;
  if (anchor) {
    const before = pobMin(anchor === 'out' ? r.pobOut : r.pobIn);
    const shift = before != null && now != null ? now - before : 0;
    win = [t.win[0] + shift, t.win[1] + shift];
  } else if (s && s.at === 'span') {
    const a = timeOf(pobIn);
    const b = timeOf(pobOut);
    if (a != null && b != null && b > a) win = [a, b];
  }

  const skip = ji == null ? [] : [ji].concat(escortJobs.map(([, i]) => i));
  const busy = busyBoats(rows, r, win, skip);
  const k = s ? svcKind(s) : KIND.escort;
  const useEscort = main && s.escort && escort;
  const escRule = rules.find((x) => x.key === rule);
  const escStart = now != null && escRule ? now - escRule.minutes : null;
  const cells = s && s.width === 'by_time' ? Math.max(1, minToSlot(win[1]) - minToSlot(win[0])) : Math.max(1, tugs.length);

  function save() {
    const out = { ...pobPatch('pobIn', pobIn), ...pobPatch('pobOut', pobOut) };
    const next = { ...r, ...out };
    const span = s ? cells : t.job.span;
    const slot = s && s.at === 'end' ? clampSlot(96 - span, span) : !s ? t.job.slot : minToSlot(win[0]);
    const job = { ...(t.job || {}), text: tugs.join('-'), kind: t.kind, slot, span, win: winText(win), contL: false, contR: false };
    delete job.dup;
    if (s) job.svc = s.code;
    if (t.note) job.note = t.note;
    if (main) {
      job.escortRule = rule;
      if (anchor === 'in') job.shipMins = ship;
    }
    const esc = useEscort ? escortTugs : [];
    const escWin = winText([escStart != null ? escStart : win[0], now != null ? now : win[0]]);
    const jobs = layoutQueues(
      next,
      r.jobs.filter((_, i) => !skip.includes(i)).concat([job], esc.map((code) => ({ text: code, kind: 'escort', anchor, slot: 0, span: 1, win: escWin })))
    );
    if (anchor === 'in') {
      // Shipping time is the gap before the first POB in block; with an escort the escort fills it.
      const first = Math.min(...jobs.filter((j) => j.kind !== 'escort' && (jobSvc(j) || {}).at === 'in').map((j) => j.slot));
      const n = Math.ceil(ship / 30);
      out.ship = ship > 0 && !esc.length ? [{ slot: Math.max(0, first - n), span: n, mins: ship }] : [];
    }
    out.jobs = jobs;
    onSave(out, 'Tugboat assignment updated');
    onClose();
  }

  function remove() {
    const patch = { jobs: layoutQueues(r, r.jobs.filter((_, i) => !skip.includes(i))) };
    if (anchor === 'in') patch.ship = [];
    onSave(patch, `${t.label} removed`);
    onClose();
  }

  return (
    <Modal
      open
      title="Assign tugboat"
      className="pbm-sticky"
      onCancel={onClose}
      destroyOnHidden
      width={620}
      footer={
        <>
          {ji != null && (
            <Popconfirm
              title={`Remove ${t.label}?`}
              description={escortJobs.length ? 'Its escort segments are removed too.' : 'The block leaves the board.'}
              okText="Remove"
              okButtonProps={{ danger: true }}
              onConfirm={remove}
            >
              <Button danger>Remove</Button>
            </Popconfirm>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" disabled={!tugs.length} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="pbm-head">
        <b>
          {[r.vessel, r.port, ticketId(r.no)].filter(Boolean).join(' · ')}
        </b>
        <span>
          <Tag className="pbm-kind" style={{ background: k.bg, color: k.fg, borderColor: k.bd }}>
            {t.label}
          </Tag>
        </span>
        <Text type="secondary">
          Job: {fmtMin(win[0])} → {fmtMin(win[1])}
        </Text>
        {s && s.at === 'span' && <Text type="secondary">Runs POB in → POB out.</Text>}
      </div>

      <label className="pbm-label">Tugboats, grouped by location, ★ = high priority{s && s.width === 'by_time' ? '' : '. The block widens with each one added.'}</label>
      <Boats selected={tugs} busy={busy} home={locationOf(r.port)} onToggle={(code) => (setTugs(toggled(tugs, code)), setEscortTugs(escortTugs.filter((x) => x !== code)))} />

      {main && s.escort && (
        <Checkbox className="pbm-check" checked={escort} onChange={(e) => setEscort(e.target.checked)}>
          Include escort tugboat
        </Checkbox>
      )}
      {useEscort && (
        <>
          <label className="pbm-label">Escort rule</label>
          <Flex gap={8} align="center" wrap>
            <Select style={{ width: 240 }} value={rule} onChange={setRule} options={rules.map((x) => ({ value: x.key, label: x.label }))} />
            <Text type="secondary">→ escort starts {escStart != null ? fmtMin(escStart) : '-'}</Text>
          </Flex>
          <label className="pbm-label">Escort boats: one cell per boat, drawn {anchor === 'in' ? 'between POB in and the block' : 'after the block'}</label>
          <Boats selected={escortTugs} disabled={tugs} home={locationOf(r.port)} onToggle={(code) => setEscortTugs(toggled(escortTugs, code))} />
        </>
      )}
      {anchor === 'in' && !useEscort && (
        <>
          <label className="pbm-label">Shipping time: the gap before the block (minutes)</label>
          <InputNumber min={0} step={15} value={ship} onChange={(v) => setShip(v || 0)} style={{ width: 120 }} />
        </>
      )}
    </Modal>
  );
}
