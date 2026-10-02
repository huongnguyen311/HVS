// Ticket, time and section helpers shared by the board table and its windows.
import dayjs from 'dayjs';
import D from '../data';
import { BOARD_DAY0, SLOTS, absSlot, isTerminal, jobSvc, minutesAt, sheetMin, slotOf, svc } from './timeline';

export const PENDING = 'NEW TICKET / PENDING';
export const UNASSIGNED = 'Unassigned location';

// No. as the board prints it: #1847 (numbered per month).
export const ticketId = (no) => '#' + no;
export const locationOf = (port) => D.portLocations[port] || UNASSIGNED;
export const knownPorts = () => Object.keys(D.portLocations);
export const clientOf = (nick) => D.boardClients.find((c) => c.nick === nick);

// Status key as the Ticket actions window prints it: NOT_VALID → not-valid.
export const statusKey = (st) => st.toLowerCase().replace('_', '-');

// ---------- times ----------
// The board stores POB times as the client's spreadsheet does: 'hhmm/dd.mm'.

export function toDayjs(t) {
  const m = /^(\d\d)(\d\d)\/(\d\d)\.(\d\d)$/.exec((t || '').replace(/\s*✓$/, ''));
  return m ? dayjs(`2026-${m[4]}-${m[3]}T${m[1]}:${m[2]}`) : null;
}

export const fromDayjs = (d) => (d ? d.format('HHmm/DD.MM') : '');

// 'Thursday 01/10/2026 09:00' for the POB cell tooltip.
export function pobTitle(t) {
  const d = toDayjs(t);
  return d ? d.format('dddd DD/MM/YYYY HH:mm') : '';
}

// Minutes since day 0 00:00 ↔ '01/10 08:00'.
export function fmtMin(min) {
  return dayjs(BOARD_DAY0 + 'T00:00').add(min, 'minute').format('DD/MM HH:mm');
}

export function parseMin(s) {
  const m = /^(\d\d)\/(\d\d) (\d\d):(\d\d)$/.exec((s || '').trim());
  return m ? minutesAt(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])) : null;
}

export const pobMin = sheetMin;

// A job's real window [from, to] in minutes: the fixture's `win`, else its cells on the timeline.
export function jobWindow(j) {
  if (j.win) {
    const [a, b] = j.win.split('→').map(parseMin);
    if (a != null && b != null) return [a, b];
  }
  return [j.slot * 30, (j.slot + Math.max(j.span, 0.5)) * 30];
}

export const winText = ([a, b]) => fmtMin(a) + ' → ' + fmtMin(b);

// ---------- the 2-day window (the day arrows move it; day 0 = BOARD_DAY0) ----------

const dayOf = (d) => dayjs(BOARD_DAY0).add(d, 'day');
export const dayLabel = (d) => dayOf(d).format('dddd DD/MM/YYYY');
// Short enough for the phone toolbar; the year is in the timeline's day labels.
export const rangeLabel = (d) => dayOf(d).format('DD/MM') + ' – ' + dayOf(d + 1).format('DD/MM');

// A ticket belongs to the window when a POB time or a job falls inside it; tickets with no time at
// all yet (just created, nothing decided) show in every window.
export function inWindow(r, d) {
  const from = d * 1440;
  const to = from + 2 * 1440;
  const times = [pobMin(r.pobIn), pobMin(r.pobOut)].filter((m) => m != null);
  const jobs = (r.jobs || []).map(jobWindow);
  if (!times.length && !jobs.length) return true;
  return times.some((m) => m >= from && m < to) || jobs.some(([a, b]) => a < to && b > from);
}

// ---------- jobs ----------

// What a block is called on its tooltip and in the assign window: the catalogue name, or Escort.
export const jobLabel = (j) => (j.kind === 'escort' ? 'Escort' : (jobSvc(j) || {}).name || 'Service');

export const isEscort = (j) => j.kind === 'escort';

// Tugboats already on another job that overlaps [from, to] → { code: vessel }.
export function busyBoats(rows, self, win, skip) {
  const busy = {};
  rows.forEach((o) => {
    if (isTerminal(o.status)) return;
    (o.jobs || []).forEach((j, ji) => {
      if (j.kind === 'suggest') return;
      if (o.no === self.no && skip && skip.includes(ji)) return;
      const [a, b] = jobWindow(j);
      if (a < win[1] && win[0] < b) j.text.split('-').forEach((c) => (busy[c] = o.vessel));
    });
  });
  return busy;
}

export const clampSlot = (s, span = 1) => Math.max(0, Math.min(s, SLOTS - span));

export const minToSlot = (min) => Math.floor(min / 30);

export function anchorSlot(row, anchor) {
  return slotOf(anchor === 'out' ? row.pobOut : row.pobIn);
}

// ---------- sections ----------

// Blank PORT cells in the fixture continue the port above; give every row its own port so rows
// can move between sections.
export function normalizeBoard(board) {
  return board.map((s) => {
    let last = '';
    return {
      ...s,
      rows: s.rows.map((r) => {
        if (r.port) last = r.port;
        return { ...r, port: s.label === PENDING ? r.port : r.port || last, internal: r.internal || '' };
      })
    };
  });
}

// The pending band holds PENDING tickets only; any other status sits in its port's location band,
// next to the rows of the same port.
export function placeRow(board, row) {
  const target = row.status === 'PENDING' ? PENDING : locationOf(row.port);
  const without = board.map((s) => ({ ...s, rows: s.rows.filter((r) => r.no !== row.no) }));
  return without.map((s) => {
    if (s.label !== target) return s;
    const rows = s.rows.slice();
    if (target === PENDING) return { ...s, rows: [row].concat(rows) };
    let at = -1;
    rows.forEach((r, i) => {
      if (r.port === row.port) at = i;
    });
    rows.splice(at < 0 ? rows.length : at + 1, 0, row);
    return { ...s, rows };
  });
}

// ---------- POB queues ----------

// Blocks anchored to a POB follow each other in the catalogue's queue order (orderIn / orderOut), starting
// at their POB time. Escort segments are one cell per boat: on arrival they fill the gap between POB in and
// the first block (so that gap equals the escort width); on departure they follow the queue.
export function layoutQueues(row, jobs) {
  const out = jobs.map((j) => ({ ...j }));
  [
    ['in', row.pobIn, 'orderIn'],
    ['out', row.pobOut, 'orderOut']
  ].forEach(([anchor, pob, order]) => {
    const start = absSlot(pob);
    if (start == null) return;
    const rank = (j) => {
      const v = (jobSvc(j) || {})[order];
      return v == null ? 999 : v;
    };
    const blocks = out.filter((j) => j.kind !== 'escort' && j.kind !== 'suggest' && (jobSvc(j) || {}).at === anchor).sort((a, b) => rank(a) - rank(b));
    const escorts = out.filter((j) => j.kind === 'escort' && j.anchor === anchor);
    let at = start;
    const put = (j) => {
      j.slot = at;
      at += j.span;
    };
    if (anchor === 'in') escorts.forEach((e) => put(Object.assign(e, { span: 1 })));
    blocks.forEach((b) => {
      put(b);
      const mins = (jobSvc(b) || {}).mins || 90;
      b.win = winText([b.slot * 30, b.slot * 30 + mins]);
    });
    if (anchor === 'out') escorts.forEach((e) => put(Object.assign(e, { span: 1 })));
  });
  return out;
}

// ---------- pickers with context (A4) ----------

// Vietnamese-aware match: "cu lao tao" finds "CÙ LAO TÀO".
export const norm = (t) => String(t == null ? '' : t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

// AutoComplete / Select options whose label carries the fields that tell look-alikes apart, with the whole
// record on hover; search runs on name + context, without diacritics.
export function ctxOptions(items) {
  return items.map(({ value, sub, title }) => ({
    value,
    search: norm(value + ' ' + (sub || '')),
    label: (
      <span className="pb-opt" title={title || [value, sub].filter(Boolean).join(' · ')}>
        <b>{value}</b>
        {sub && <small>{sub}</small>}
      </span>
    )
  }));
}

export const ctxFilter = (input, option) => option.search.includes(norm(input));

// Vessels with their LOA / DWT (from the tickets on the board), ports with their location group, client nicknames.
export const vesselItems = (rows) =>
  D.boardVessels.map((v) => {
    const r = rows.find((x) => x.vessel === v && (x.loa || x.dwt));
    return { value: v, sub: r ? `LOA ${r.loa || '-'} · DWT ${r.dwt || '-'}` : 'No size on file' };
  });
export const portItems = () => knownPorts().map((p) => ({ value: p, sub: locationOf(p) }));
export const clientItems = () => D.boardClients.map((c) => ({ value: c.nick, sub: c.agency }));

// Requested services (ticket form / new ticket) that no block on the row covers yet.
export const unassigned = (r) => (r.services || []).filter((code) => svc(code) && !(r.jobs || []).some((j) => (jobSvc(j) || {}).code === code));
