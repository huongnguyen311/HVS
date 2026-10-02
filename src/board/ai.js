import D from '../data';
import { busyBoats, clampSlot, layoutQueues, locationOf, minToSlot, norm, pobMin, unassigned, winText } from './model.jsx';
import { isBackground, isTerminal, jobSvc, svc } from './timeline';
import { serviceWindow } from '../components/AddServiceModal';

// AI suggest for the Plan Board: for every open ticket, the services it still needs (requested ones with no
// tugboat, ones its notes ask for, a POB with no job at all) and free tugboats for each. Suggestions are not
// on the board until an ADMIN / MOD accepts them.

// ---------- what the notes ask for ----------

// The ticket's client + internal note, as the dispatchers write them (English, or Vietnamese with accents
// optional), e.g. "4 tugs working - 1 tug esc Buoy 0", "3 TUG - ESC P.21", "keep H5 - H7", "Clash H7 with
// #08261533", "Arrival + Departure", "no POB out", "Tugboat on duty", "Special job". Null fields: the note
// says nothing about them.
export function readNote(r) {
  const raw = [r.note, r.internal].filter(Boolean).join(' · ');
  const t = norm(raw);
  const out = { raw, tugs: null, escort: null, escortTugs: null, point: null, keep: [], avoid: [], services: [], noOut: false };
  if (!t) return out;

  // "4 tugs", "3 TUG" = boats on the job; "1 tug esc", "1 TUG ESC" = escort boats.
  for (const m of t.matchAll(/(\d+)\s*(?:lai|tugs?|tau lai)\b(\s*(?:lam\s*)?esc)?/g)) {
    if (m[2]) out.escortTugs = (out.escortTugs || 0) + +m[1];
    else out.tugs = Math.max(out.tugs || 0, +m[1]);
  }
  if (/\besc(ort)?\b/.test(t)) out.escort = true;
  if (/(khong (co )?|\bno )esc(ort)?/.test(t)) (out.escort = false), (out.escortTugs = null);
  if (out.escort && !out.escortTugs) out.escortTugs = 1;
  const p = t.match(/\b(?:buoy|phao|p)\.?\s*(\d+)\b/);
  if (p) out.point = 'Buoy ' + p[1];

  // Boat codes: wanted unless the note says they clash ("clash H7", "xung đột H7"). An explicit keep
  // ("keep H5 - H7", usually written after the call that settled the clash) wins over the clash.
  const held = [];
  D.fleet
    .flatMap((g) => g.boats.map(([c]) => c))
    .forEach((c) => {
      for (const m of t.matchAll(new RegExp('\\b' + norm(c) + '\\b', 'g'))) {
        const before = t.slice(Math.max(0, m.index - 14), m.index);
        if (/\b(giu|keep)\b[^.]*$/.test(before)) held.push(c);
        else (/(xung dot|trung|clash) [^.]*$/.test(before) ? out.avoid : out.keep).push(c);
      }
    });
  out.avoid = [...new Set(out.avoid.filter((c) => !held.includes(c)))];
  out.keep = [...new Set(out.keep.concat(held).filter((c) => !out.avoid.includes(c)))];

  out.noOut = /(khong (co )?|\bno )pob out/.test(t);
  const add = (code) => !out.services.includes(code) && out.services.push(code);
  if (/\bcap\b|pob in|arrival/.test(t)) add('mano_in');
  if (!out.noOut && /\broi\b|pob out|departure/.test(t)) add('mano_out');
  if (/shifting|dich chuyen|di chuyen|doi ben/.test(t)) add('shifting');
  if (/truc ca|on duty/.test(t)) add('standby_duty');
  else if (/\btruc\b|standby/.test(t)) add('standby');
  if (/dac thu|special/.test(t)) add('special');
  if (/cuu ho|salvage/.test(t)) add('salvage');
  if (/buoc|coi day|mooring/.test(t)) add('mooring');
  return out;
}

// ---------- picking tugboats ----------

// Free boats only; the ones the note names first, then the port's own location, ★ boats, the least loaded.
function pickTugs({ r, s, n, busy, exclude, note, load }) {
  const home = locationOf(r.port);
  return D.fleet
    .flatMap((g) => g.boats.map(([code, star]) => ({ code, star: !!star, home: g.group === home, named: note.keep.includes(code) })))
    .filter((b) => !busy[b.code] && !exclude.includes(b.code) && !note.avoid.includes(b.code))
    .sort((a, b) => b.named - a.named || b.home - a.home || b.star - a.star || (load[a.code] || 0) - (load[b.code] || 0))
    .slice(0, n);
}

const overlap = (a, b) => a[0] < b[1] && b[0] < a[1];
const KIND_OF = { in: 'pobin', out: 'pobout', span: 'shift' };

// Where a suggested job would sit on the timeline. A block never lands on cells already drawn on that row
// (the trip's own blocks, or an earlier suggestion for it): it moves right to the first free run of cells,
// the way a POB queue lines blocks up. Background strips do not count, blocks are drawn over them.
function place(s, win, tugs, used) {
  const span = s.width === 'by_time' ? Math.max(1, minToSlot(win[1]) - minToSlot(win[0])) : Math.max(1, tugs.length);
  let slot = s.at === 'end' ? clampSlot(96 - span, span) : minToSlot(win[0]);
  if (s.render !== 'background') {
    for (let hit = true; hit; ) {
      hit = false;
      for (const [a, b] of used) {
        if (slot < b && a < slot + span) {
          slot = b;
          hit = true;
        }
      }
    }
    used.push([slot, slot + span]);
  }
  return { span, slot };
}

// Every suggestion for the open tickets: [{ id, no, code, win, slot, span, tugs, escort, why }].
export function suggestBoard(rows) {
  const out = [];
  const taken = []; // boats already used by earlier suggestions in this run: { codes, win }
  const load = {};
  rows.forEach((o) => (o.jobs || []).forEach((j) => j.text.split('-').forEach((c) => (load[c] = (load[c] || 0) + 1))));

  rows.forEach((r) => {
    if (isTerminal(r.status) || r.portAlert || r.vesselAlert) return;
    const note = readNote(r);
    const has = new Set((r.jobs || []).map((j) => (jobSvc(j) || {}).code).filter(Boolean));
    const want = [...unassigned(r)];
    // Cells this row already draws on: its blocks and escort cells (not background strips).
    const used = (r.jobs || []).filter((j) => !isBackground(j)).map((j) => [Math.floor(j.slot), j.slot + j.span]);
    const why0 = {};
    unassigned(r).forEach((c) => (why0[c] = 'requested by the client'));
    note.services.forEach((c) => !has.has(c) && !want.includes(c) && (want.push(c), (why0[c] = 'asked for in the note')));
    if (!(r.jobs || []).length) {
      if (pobMin(r.pobIn) != null && !want.includes('mano_in')) want.push('mano_in'), (why0.mano_in = 'POB in has no tugboat');
      if (pobMin(r.pobOut) != null && !note.noOut && !want.includes('mano_out')) want.push('mano_out'), (why0.mano_out = 'POB out has no tugboat');
    }

    want.forEach((code) => {
      const s = svc(code);
      const win = s && serviceWindow(s, r);
      if (!win) return;
      const busy = busyBoats(rows, r, win, []);
      taken.filter((x) => overlap(x.win, win)).forEach((x) => x.codes.forEach((c) => (busy[c] = busy[c] || 'another suggestion')));
      const pob = s.at === 'in' || s.at === 'out';
      const loa = parseFloat(r.loa) || 0;
      const n = (pob && note.tugs) || (pob ? (loa >= 250 ? 3 : loa >= 150 ? 2 : 1) : 1);
      const tugs = pickTugs({ r, s, n, busy, exclude: [], note, load }).map((b) => b.code);
      if (!tugs.length) return;
      let escort = [];
      if (pob && s.escort && note.escort) escort = pickTugs({ r, s, n: note.escortTugs, busy, exclude: tugs, note, load }).map((b) => b.code);

      const why = [why0[code]];
      why.push(pob && note.tugs ? `${n} tug${n === 1 ? '' : 's'} (note)` : pob && loa ? `LOA ${r.loa} m → ${n} tug${n === 1 ? '' : 's'}` : `${n} tug`);
      const named = tugs.filter((c) => note.keep.includes(c));
      if (named.length) why.push(`${named.join(', ')} named in the note`);
      if (note.avoid.length) why.push(`avoids ${note.avoid.join(', ')} (clash in the note)`);
      if (escort.length) why.push(`escort ${escort.join(', ')}${note.point ? ' at ' + note.point : ''} (note)`);
      why.push('all free in this window');

      taken.push({ codes: tugs.concat(escort), win });
      tugs.concat(escort).forEach((c) => (load[c] = (load[c] || 0) + 1));
      out.push({ id: r.no + ':' + code, no: r.no, code, win, ...place(s, win, tugs, used), tugs, escort, why, note: note.raw });
    });
  });
  return out;
}

// The ticket patch that puts an accepted suggestion on the board (as Assign tugboat would save it).
export function acceptPatch(r, x) {
  const s = svc(x.code);
  const job = { text: x.tugs.join('-'), kind: KIND_OF[s.at] || 'special', slot: x.slot, span: x.span, win: winText(x.win), svc: s.code, contL: false, contR: false };
  const extra = [];
  if (x.escort.length && (s.at === 'in' || s.at === 'out')) {
    const rule = D.escortRules.find((e) => e.anchor === s.at);
    const at = pobMin(s.at === 'in' ? r.pobIn : r.pobOut);
    job.escortRule = rule && rule.key;
    const escWin = winText([rule && at != null ? at - rule.minutes : x.win[0], at != null ? at : x.win[0]]);
    x.escort.forEach((code) => extra.push({ text: code, kind: 'escort', anchor: s.at, slot: 0, span: 1, win: escWin }));
  }
  return { jobs: layoutQueues(r, (r.jobs || []).concat([job], extra)) };
}

// Boats of a suggestion that became busy since it was made (someone assigned them meanwhile).
export const nowBusy = (rows, r, x) => {
  const busy = busyBoats(rows, r, x.win, []);
  return x.tugs.concat(x.escort).filter((c) => busy[c]);
};
