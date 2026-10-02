import { Fragment } from 'react';
import { Button, Flex, Popover } from 'antd';
import D from '../data';
import { dayLabel, jobLabel, jobWindow, winText } from '../board/model.jsx';
import Tip from './Tip';
import { SLOTS, absSlot, byTime, daySplit, isBackground, jobColors, jobSvc, svc } from '../board/timeline';

// A block at absolute cells [slot, slot + span) inside the window starting at cell `from`:
// { left, width } in cells, clipped to the window, and which edges continue outside; null when outside.
function clip(slot, span, from) {
  const a = slot - from;
  const b = a + span;
  if (b <= 0 || a >= SLOTS) return null;
  return { left: Math.max(a, 0), width: Math.min(b, SLOTS) - Math.max(a, 0), l: a < 0, r: b > SLOTS };
}

// Header of the timeline column: one band per day, then an hour label every other half-hour cell.
export function TimelineHeader({ C, day }) {
  return (
    <div className="bh-time" style={{ width: SLOTS * C }}>
      <div className="bh-days">
        {[day, day + 1].map((d) => (
          <span key={d} style={{ width: 48 * C }}>
            <b>{dayLabel(d)}</b>
          </span>
        ))}
      </div>
      <div className="bh-hours">
        {Array.from({ length: SLOTS }, (_, i) => (
          <span key={i} className={i % 48 === 47 ? 'dayend' : ''} style={{ width: C }}>
            {i % 2 === 0 ? (i / 2) % 24 : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

const Lines = ({ lines }) => (
  <>
    {lines.filter(Boolean).map((l, i) => (
      <div key={i}>{l}</div>
    ))}
  </>
);

const ruleLabel = (key) => (D.escortRules.find((x) => x.key === key) || {}).label;

// Tap card of a job block.
function jobTip(r, j, doubled) {
  const win = winText(jobWindow(j));
  if (j.kind === 'escort') {
    const main = r.jobs.find((x) => x.kind !== 'escort' && (jobSvc(x) || {}).at === j.anchor);
    return [`Tugboats: ${j.text}`, win, main && main.escortRule ? 'Rule: ' + ruleLabel(main.escortRule) : null, 'One cell per escort boat.'];
  }
  const s = jobSvc(j) || {};
  const escorted = r.jobs.some((x) => x.kind === 'escort' && x.anchor === s.at);
  const ship = (r.ship || [])[0];
  const shipLine = s.at === 'in' ? (escorted ? 'Shipping time: covered by the escort' : ship ? `Shipping time: ${ship.mins || ship.span * 30} min` : null) : null;
  return ['Tugboats: ' + j.text, win, doubled ? '⚠ Tugboat double-booked at this time' : shipLine, j.note];
}

// Overlapping blocks draw in the catalogue's stack order (higher on top).
const zOf = (j) => 1 + Math.round(((jobSvc(j) || {}).stack || 30) / 10);

// One AI suggestion on the timeline; its popover says why and takes the decision.
function SugBlock({ x, C, from, canRun, onAccept, onReject }) {
  const s = svc(x.code);
  const pos = clip(x.slot, x.span, from);
  if (!s || !pos) return null;
  const body = (
    <div className="bsug-pop">
      <b>{s.name}</b>
      <span>{winText(x.win)}</span>
      <span>
        Tugboats <b>{x.tugs.join('-')}</b>
        {x.escort.length > 0 && (
          <>
            {' '}
            · escort <b>{x.escort.join(', ')}</b>
          </>
        )}
      </span>
      <ul>
        {x.why.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
      {x.note && <i>Note: “{x.note}”</i>}
      {canRun && (
        <Flex gap={6} justify="flex-end">
          <Button size="small" onClick={() => onReject(x)}>
            Delete
          </Button>
          <Button size="small" type="primary" onClick={() => onAccept(x)}>
            Accept
          </Button>
        </Flex>
      )}
    </div>
  );
  return (
    <Popover trigger={['hover', 'click']} title="AI suggestion" content={body}>
      <button type="button" className="bsug" style={{ left: pos.left * C + 1, width: Math.max(pos.width * C - 2, C - 2), '--sbg': s.color, '--sbd': s.border, color: s.text }}>
        <span>✨ {x.tugs.join('-')}</span>
      </button>
    </Popover>
  );
}

// One trip's timeline: background strips, shipping time, job blocks, AI suggestions (only after AI suggest),
// POB "+" buttons.
export function TimelineCell({ row: r, C, from, dup, term, canRun, onJob, onAdd, sugs = [], onAccept, onReject }) {
  // Cells with a block (or an AI suggestion waiting for accept / reject): no POB "+" is drawn under them.
  const covered = {};
  (r.jobs || []).concat(sugs.map((x) => ({ ...x, svc: x.code }))).forEach((j) => {
    if (isBackground(j)) return;
    for (let k = Math.floor(j.slot); k < j.slot + j.span; k++) covered[k] = true;
  });
  const codesOf = (j) =>
    j.text.split('-').map((code, i) => (
      <Fragment key={i}>
        {i > 0 && '-'}
        {/* No wrapper per code: .bjob span clips overflow, which would hide the underline. */}
        {dup[r.no + ':' + code] || (j.dup && j.dup.includes(code)) ? <u>{code}</u> : code}
      </Fragment>
    ));

  return (
    <div className="bt" style={{ width: SLOTS * C, height: '100%' }}>
      {/* Snap points for the horizontal swipe: every 3 hours, landing just right of the frozen VESSEL column. */}
      {Array.from({ length: SLOTS / 6 }, (_, i) => (
        <i key={'snap' + i} className="bsnap" style={{ left: i * 6 * C }} />
      ))}
      {(r.ship || []).map((sp, i) => {
        const x = clip(sp.slot, sp.span, from);
        return (
          x && (
            <Tip key={'s' + i} title="Shipping time" content={`${sp.mins || sp.span * 30} min`}>
              <div className="bship" style={{ left: x.left * C + 1, width: x.width * C - 2 }} />
            </Tip>
          )
        );
      })}
      {(r.jobs || []).map((j, ji) => {
        const k = jobColors(j);
        const doubled = j.text.split('-').some((code) => dup[r.no + ':' + code] || (j.dup && j.dup.includes(code)));
        const tip = <Lines lines={jobTip(r, j, doubled)} />;
        const click = canRun ? () => onJob(ji) : undefined;
        // Time-wide services are cut at midnight and drawn again, with their label, on each day.
        const pieces = byTime(j) ? daySplit(j.slot, j.span) : [{ slot: j.slot, span: j.span, cutL: false, cutR: false }];
        return pieces.map((p, pi) => {
          const x = clip(p.slot, p.span, from);
          if (!x) return null;
          const contl = j.contL || x.l || p.cutL;
          const contr = j.contR || x.r || p.cutR;
          if (isBackground(j)) {
            // A strip behind the row's blocks (salvage, standby on duty), POB in → POB out.
            return (
              <Tip key={ji + ':' + pi} title={jobLabel(j)} content={tip}>
                <div
                  className={'bband' + (contl ? ' contl' : '') + (contr ? ' contr' : '') + (term ? ' dim' : '')}
                  style={{ left: x.left * C, width: x.width * C, background: k.bg, borderColor: k.bd, color: k.fg, cursor: click ? 'pointer' : undefined }}
                  onClick={click}
                >
                  <span>
                    {jobLabel(j)} · {codesOf(j)}
                  </span>
                </div>
              </Tip>
            );
          }
          return (
            <Tip key={ji + ':' + pi} title={jobLabel(j)} content={tip}>
              <div
                className={'bjob ' + j.kind + (contl ? ' contl' : '') + (contr ? ' contr' : '') + (term ? ' dim' : '')}
                style={{ left: x.left * C + 1, width: x.width * C - 2, background: k.bg, color: k.fg, borderColor: k.bd, zIndex: zOf(j), cursor: click ? 'pointer' : undefined }}
                onClick={click}
              >
                {j.kind === 'shift' && <i className="duty" />}
                <span>{codesOf(j)}</span>
              </div>
            </Tip>
          );
        });
      })}
      {/* AI suggestions: dashed until an ADMIN / MOD accepts or rejects them (tap for the reasons). */}
      {sugs.map((x) => <SugBlock key={x.id} x={x} C={C} from={from} canRun={canRun} onAccept={onAccept} onReject={onReject} />)}
      {[
        ['pobIn', 'in', 'POB in', 'mano_in'],
        ['pobOut', 'out', 'POB out', 'mano_out']
      ].map(([field, anchor, label, code]) => {
        const abs = absSlot(r[field]);
        const s = abs == null ? null : abs - from;
        // A CAPTAIN only views the board, so the assign "+" is not drawn for them at all.
        if (!canRun || term || s == null || s < 0 || s >= SLOTS || covered[abs]) return null;
        return (
          <Tip key={anchor} title={label} content="No tugboat assigned yet.">
            <button
              type="button"
              className={'bph ' + anchor}
              style={{ left: s * C + (C - 20) / 2 }}
              onClick={() => onAdd(code)}
              aria-label={`Assign tugboat at POB ${anchor}`}
            >
              +
            </button>
          </Tip>
        );
      })}
    </div>
  );
}
