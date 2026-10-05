import { useState } from 'react';
import { Alert, Input, Modal, Typography } from 'antd';
import D from '../data';
import { fmtMin, pobMin, ticketId } from '../board/model.jsx';
import { KIND, svc, svcKind } from '../board/timeline';

const { Text } = Typography;

const END_PINNED = [42 * 60, 48 * 60]; // day 1 18:00 → day 2 00:00, the row end

// Why a service cannot go on this ticket yet (a POB it needs has no time), or null.
export function serviceBlock(s, r) {
  const a = pobMin(r.pobIn) == null;
  const b = pobMin(r.pobOut) == null;
  if (s.at === 'in' && a) return 'POB in has no time on this ticket.';
  if (s.at === 'out' && b) return 'POB out has no time on this ticket.';
  if (s.at === 'span' && (a || b)) return (a ? 'POB in' : 'POB out') + ' has no time. This service spans POB in → POB out.';
  if (s.at === 'pob' && a && b) return 'POB in and POB out have no time on this ticket. This service starts at one of them.';
  if (s.at === 'after' && a && b) return 'POB in and POB out have no time on this ticket. This service goes right after Mano (arrival), or before POB out.';
  return null;
}

// Window a service takes from the ticket, in minutes since day 0 00:00; null when the ticket lacks the POB.
export function serviceWindow(s, r) {
  if (serviceBlock(s, r)) return null;
  const a = pobMin(r.pobIn);
  const b = pobMin(r.pobOut);
  const len = s.mins || 90;
  if (s.at === 'in') return [a, a + len];
  if (s.at === 'out') return [b, b + len];
  if (s.at === 'span') return [a, b];
  if (s.at === 'end') return END_PINNED;
  if (s.at === 'after') {
    // Right after Mano (arrival); with no POB in, it ends at POB out.
    if (a == null) return [b - len, b];
    const mano = D.services.find((x) => x.at === 'in');
    const from = a + ((mano && mano.mins) || 90);
    return [from, from + len];
  }
  const from = a != null ? a : b != null ? b : 8 * 60;
  return [from, from + len];
}

// Timing label on each catalogue row, by where the service takes its window.
const TIMING = { in: 'Starts at POB in', out: 'Starts at POB out', span: 'Spans POB in → POB out', after: 'Right after Mano (arrival)', pob: 'Starts at POB in, else POB out', end: 'No POB time, pinned to the row end' };

// Escort is not a catalogue service: it rides on the Mano block at POB in or POB out (escort boats, one cell
// each, drawn before / after it). Picking it takes POB in (else POB out); the assign window then opens on that Mano block
// (or a new one) with escort ticked.
const ESCORT = 'escort';
const escortAnchors = () => [...new Set(D.escortRules.map((x) => x.anchor))].filter((a) => D.services.some((x) => x.at === a && x.escort));
const manoAt = (a) => D.services.find((x) => x.at === a && x.escort);

// Add service…: pick a service from the admin catalogue (or Escort); tugboats come next in the assign window.
export default function AddServiceModal({ row: r, preset, onNext, onClose }) {
  const [code, setCode] = useState(preset || null);
  const [win, setWin] = useState(() => (preset && svc(preset) ? serviceWindow(svc(preset), r) : null));
  const [note, setNote] = useState('');
  const anchors = escortAnchors();
  // No choice to make: the escort goes with POB in when the ticket has that time, else with POB out.
  const at = anchors.find((a) => pobMin(a === 'in' ? r.pobIn : r.pobOut) != null) || anchors[0];
  const isEscort = code === ESCORT;
  const s = isEscort ? manoAt(at) : svc(code);
  const block = s ? serviceBlock(s, r) : null;
  // The ticket's POB times, shown under the title when it has them.
  const pobs = [
    ['POB in', pobMin(r.pobIn)],
    ['POB out', pobMin(r.pobOut)]
  ]
    .filter(([, m]) => m != null)
    .map(([l, m]) => `${l}: ${fmtMin(m)}`);

  const pick = (x) => {
    setCode(x.code);
    setWin(serviceWindow(x, r));
  };

  return (
    <Modal
      open
      title="Add service"
      className="pbm-sticky"
      okText={isEscort ? 'Add escort' : 'Add service'}
      okButtonProps={{ disabled: !s || !!block }}
      onOk={() => {
        onClose();
        onNext(isEscort ? { service: s.code, win: serviceWindow(s, r), note: note.trim(), escort: at } : { service: s.code, win, note: note.trim() });
      }}
      onCancel={onClose}
      width={620}
      destroyOnHidden
    >
      <div className="pbm-head">
        <b>
          {[r.vessel, r.port, ticketId(r.no)].filter(Boolean).join(' · ')}
        </b>
        {pobs.length > 0 && <Text type="secondary">{pobs.join(' · ')}</Text>}
      </div>
      <div className="pbm-svcs">
        {D.services.map((x) => {
          const on = x.code === code;
          const c = svcKind(x);
          const why = serviceBlock(x, r);
          const btn = (
            <button
              key={x.code}
              type="button"
              className={'pbm-svc' + (on ? ' on' : '') + (why ? ' off' : '')}
              style={on ? { background: c.bg, borderColor: c.bd, color: c.fg } : undefined}
              onClick={() => pick(x)}
            >
              <span>
                <b>{x.name}</b>
              </span>
              <em>{TIMING[x.at]}</em>
            </button>
          );
          // A blocked service still picks: the warning under the list says why.
          return btn;
        })}
        {anchors.length > 0 && (
          <button
            type="button"
            className={'pbm-svc' + (isEscort ? ' on' : '')}
            style={isEscort ? { background: KIND.escort.bg, borderColor: KIND.escort.bd, color: KIND.escort.fg } : undefined}
            onClick={() => setCode(ESCORT)}
          >
            <span>
              <b>Escort</b>
            </span>
            <em>Escort boats with Mano at POB in / out</em>
          </button>
        )}
      </div>

      {s && (
        block ? (
          <Alert className="pbm-alert" type="warning" showIcon message={`${isEscort ? 'Escort' : s.name} cannot be added yet`} description={block} />
        ) : (
          <>
            <label className="pbm-label">Note (optional)</label>
            <Input size="small" value={note} placeholder="Shown on the block’s card" onChange={(e) => setNote(e.target.value)} />
          </>
        )
      )}
    </Modal>
  );
}
