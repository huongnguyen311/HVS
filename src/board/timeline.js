import D from '../data';

// Two-day window of half-hour cells. Day 0 is the first day of the demo data (the board opens on BOARD_TODAY,
// 02/10/2026); every board time is counted from day 0's midnight. The year is the demo's, 2026.
export const SLOTS = 96;
export const BOARD_DAY0 = '2026-10-01';
// The demo's "today": the date picker's default and its Today button (the board opens on today → tomorrow).
export const BOARD_TODAY = '2026-10-02';
const DAY_CELLS = 48;
const ORIGIN = Date.UTC(2026, 9, 1);
const pad = (n) => String(n).padStart(2, '0');

// Minutes since day 0 00:00 for a day of 2026 (month 1–12); UTC, so no daylight-saving hour slips in.
export const minutesAt = (day, month, h = 0, min = 0) => (Date.UTC(2026, month - 1, day, h, min) - ORIGIN) / 60000;

// '0900/01.10' (a signed time carries a trailing ✓) → minutes since day 0 00:00 (any day), or null.
export function sheetMin(t) {
  const m = /^(\d\d)(\d\d)\/(\d\d)\.(\d\d)$/.exec((t || '').replace(/\s*✓$/, ''));
  return m ? minutesAt(Number(m[3]), Number(m[4]), Number(m[1]), Number(m[2])) : null;
}

// Same, in half-hour cells.
export function absSlot(t) {
  const min = sheetMin(t);
  return min == null ? null : Math.floor(min / 30);
}

// Same, but only inside the opening 2-day window; null outside it.
export function slotOf(t) {
  const s = absSlot(t);
  return s != null && s >= 0 && s < SLOTS ? s : null;
}

// { time: 'HH:MM', day: 0|1 } ↔ 'hhmm/dd.mm'
export function sheetTime(v) {
  if (!v || !/^\d\d:\d\d$/.test(v.time)) return '';
  const d = new Date(ORIGIN + v.day * 864e5);
  return v.time.replace(':', '') + '/' + pad(d.getUTCDate()) + '.' + pad(d.getUTCMonth() + 1);
}

export function parseSheet(t) {
  const min = sheetMin(t);
  return min == null ? { time: '', day: 0 } : { time: t.slice(0, 2) + ':' + t.slice(2, 4), day: Math.floor(min / 1440) };
}

// Colours that are not services: escort segments and AI suggestions. Services take theirs from the catalogue.
export const KIND = {
  escort: { bg: '#ffc000', fg: '#4a3000', bd: '#d19c00', label: 'Escort', short: 'Escort' }
};

// ---------- service catalogue (D.services, edited on Admin › Service Types) ----------

export const svc = (code) => D.services.find((s) => s.code === code) || null;

// The catalogue row behind a job: its own code, else the fixture's drawing kind mapped onto the catalogue.
// Escort segments and AI suggestions have none.
export const jobSvc = (j) => (j.kind === 'escort' || j.kind === 'suggest' ? null : svc(j.svc || D.kindService[j.kind]));

export function svcKind(s) {
  return s ? { bg: s.color, fg: s.text, bd: s.border } : KIND.escort;
}

export const jobColors = (j) => (j.kind === 'escort' ? KIND.escort : svcKind(jobSvc(j) || D.services[0]));

export const isBackground = (j) => {
  const s = jobSvc(j);
  return !!s && s.render === 'background';
};

// Services as wide as their window (width: by_time) are cut at midnight and drawn again on each day.
export const byTime = (j) => {
  const s = jobSvc(j);
  return !!s && s.width === 'by_time';
};

// [slot, slot + span) → pieces that never cross midnight: [{ slot, span, cutL, cutR }].
export function daySplit(slot, span) {
  const out = [];
  let a = slot;
  const end = slot + span;
  while (a < end) {
    const b = Math.min(end, (Math.floor(a / DAY_CELLS) + 1) * DAY_CELLS);
    out.push({ slot: a, span: b - a, cutL: a !== slot, cutR: b !== end });
    a = b;
  }
  return out;
}

export const isTerminal = (st) => st === 'DONE' || st === 'NOT_VALID' || st === 'CANCELLED';

// A tugboat on two overlapping blocks of different trips → { 'no:code': true } for both.
// Background strips (standby on duty, salvage) sit behind the work and are not counted.
export function conflicts(rows) {
  const uses = {};
  rows.forEach((r) => {
    if (isTerminal(r.status)) return;
    (r.jobs || []).forEach((j) => {
      if (j.kind === 'suggest' || isBackground(j)) return;
      j.text.split('-').forEach((code) => {
        (uses[code] = uses[code] || []).push({ no: r.no, from: j.slot, to: j.slot + j.span });
      });
    });
  });
  const dup = {};
  Object.keys(uses).forEach((code) => {
    const list = uses[code];
    for (let a = 0; a < list.length; a++) {
      for (let b = a + 1; b < list.length; b++) {
        if (list[a].no !== list[b].no && list[a].from < list[b].to && list[b].from < list[a].to) {
          dup[list[a].no + ':' + code] = true;
          dup[list[b].no + ':' + code] = true;
        }
      }
    }
  });
  return dup;
}

// Two open tickets for the same vessel at the same POB in (or POB out) time are likely one job booked twice.
// → { no: [{ no, field }] }, flagged on both tickets.
export function twins(rows) {
  const norm = (v) => (v || '').replace(/\s*✓$/, '').trim();
  const open = rows.filter((r) => !isTerminal(r.status) && norm(r.vessel));
  const out = {};
  open.forEach((a, i) =>
    open.slice(i + 1).forEach((b) => {
      if (norm(a.vessel).toUpperCase() !== norm(b.vessel).toUpperCase()) return;
      const field = ['pobIn', 'pobOut'].find((f) => norm(a[f]) && norm(a[f]) === norm(b[f]));
      if (!field) return;
      (out[a.no] = out[a.no] || []).push({ no: b.no, field });
      (out[b.no] = out[b.no] || []).push({ no: a.no, field });
    })
  );
  return out;
}
