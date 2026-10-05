import dayjs from 'dayjs';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { App, Dropdown, Table } from 'antd';
import { CopyOutlined, PlusOutlined, WarningOutlined } from '@ant-design/icons';
import D from '../data';
import { loadBoard, loadConfig, loadMods, loadRole, loadTags, loadUserName, roleDefault, saveBoard, saveConfig, saveTags } from '../board/store';
import { STATUS, STATUS_KEYS, canMove, canRun, isAdmin, isTerminal } from '../board/status';
import { rowPasses, sectionPasses } from '../board/filters';
import { BOARD_DAY0, BOARD_TODAY, SLOTS, conflicts, jobSvc, twins } from '../board/timeline';
import { PENDING, fmtMin, inWindow, locationOf, placeRow, pobMin, pobTitle, ticketId } from '../board/model.jsx';
import { Pob } from '../board/cells';
import Tip from './Tip';
import { Down, More } from '../board/icons';
import { acceptPatch, nowBusy, suggestBoard } from '../board/ai';
import AddServiceModal from './AddServiceModal';
import AssignModal from './AssignModal';
import BoardBar from './BoardBar';
import BoardSettings from './BoardSettings';
import FilterSheet, { filterChips } from './FilterSheet';
import FuelModal, { fmtFuel } from './FuelModal';
import NewTicketSheet from './NewTicketSheet';
import NotesModal from './NotesModal';
import ReasonModal from './ReasonModal';
import ServicesModal from './ServicesModal';
import TicketActionsModal from './TicketActionsModal';
import { TimelineCell, TimelineHeader } from './Timeline';

// Width the NOTE column needs for its longest shown note (internal first, else the client's), at the cell font.
let measureCtx;
function noteWidth(rows) {
  if (typeof document === 'undefined') return 0;
  measureCtx = measureCtx || document.createElement('canvas').getContext('2d');
  measureCtx.font = '11.5px ' + getComputedStyle(document.body).fontFamily;
  const w = rows.reduce((n, r) => Math.max(n, measureCtx.measureText(r.internal || r.note || '').width + (r.internal ? 14 : 0)), 0);
  return Math.ceil(w) + 14; // cell padding + border
}

// rowSpan per row for the merged PORT cell; pending rows never merge (they are an arrival queue).
function portSpans(rows, merge) {
  const spans = rows.map(() => 1);
  if (!merge) return spans;
  for (let i = 0; i < rows.length; ) {
    let j = i + 1;
    while (j < rows.length && rows[j].port && rows[j].port === rows[i].port) j++;
    spans[i] = j - i;
    for (let k = i + 1; k < j; k++) spans[k] = 0;
    i = j;
  }
  return spans;
}

const Lines = ({ lines }) => lines.map((l, i) => <div key={i}>{l}</div>);

// Tap card for PORT / VESSEL / AGENCY cells: a bold name, then label · value lines (empty values are skipped),
// and an optional hint under a rule.
const Info = ({ title, rows, hint }) => (
  <div className="pb-info">
    <b>{title}</b>
    <dl>
      {rows
        .filter(([, v]) => v != null && v !== '')
        .map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
    </dl>
    {hint && <small>{hint}</small>}
  </div>
);
const count = (n, one) => `${n} ${one}${n === 1 ? '' : 's'}`;

// Status dropdown items per status and role (ADMIN / MOD run the board): every other status, picked directly.
// Only Cancelled asks for a reason. What a MOD may not do (canMove) is still listed, greyed out, so they see
// it exists and who does it. Hold is not a board action: a ticket is on hold only while its client asks to cancel.
function statusItems(row, role) {
  if (isTerminal(row.status) && !isAdmin(role)) return [{ key: 'none', label: 'Closed. Only an admin can reopen it', disabled: true }];
  const can = (to) => canMove(role, row.status, to);
  const items = [];
  if (row.cancelReq) {
    // Cancelling a CONFIRMED (or updated) ticket is approved by an admin only.
    const gate = (key, label) => (can('CANCELLED') ? { key, label } : { key, label: label + ' · admin only', disabled: true });
    items.push(gate('approve', 'Approve cancellation'), gate('reject', 'Reject cancellation…'), { type: 'divider' });
  }
  STATUS_KEYS.filter((k) => k !== row.status).forEach((k) => {
    const label = k === 'CANCELLED' ? 'Cancelled…' : statusLabel(k);
    items.push(can(k) ? { key: 'to:' + k, label, danger: k === 'NOT_VALID' || k === 'CANCELLED' } : { key: 'to:' + k, label: label + ' · admin only', disabled: true });
  });
  return items;
}

// Board notifications the client who owns the ticket also gets (hold, cancellation decisions); the row's agency says which client.
const CLIENT_TOO = ['ADMIN', 'MOD', 'CLIENT'];

const statusLabel = (st) => (STATUS[st] || STATUS.PENDING).label;

export default function PlanBoardTable({ toast, notify }) {
  const { message, modal } = App.useApp();
  // The app's toast / push notifications when mounted by app.js; antd's message otherwise.
  const say = toast || ((msg) => message.success(msg, Math.min(8, 3.5 + Math.max(0, msg.length - 40) * 0.06)));
  const push = notify || (() => {});
  const [board, setBoard] = useState(loadBoard);
  const [cfg, setCfg] = useState(loadConfig);
  const [role] = useState(loadRole); // from the signed-in user (the demo role picker)
  const [collapsed, setCollapsed] = useState([]);
  const [overlay, setOverlay] = useState(null); // { type, no, ...props }
  const [settings, setSettings] = useState(null); // null | 'columns' (Board display) | 'filters'
  const [newOpen, setNewOpen] = useState(false);
  // First day of the 2-day window, counted from BOARD_DAY0 (01/10/2026); opens on today (BOARD_TODAY).
  const [day, setDay] = useState(() => dayjs(BOARD_TODAY).diff(dayjs(BOARD_DAY0), 'day'));
  const [tags, setTags] = useState(loadTags); // P6: shipping-line tag per vessel
  const [sugs, setSugs] = useState(null); // AI suggestions waiting for accept / reject; null = AI not run

  useEffect(() => saveConfig(cfg), [cfg]);

  // D1/D3: the VESSEL column must show when the board opens. On a narrow screen the columns before it
  // (PORT … MOD) push it off screen until the user scrolls, so the board opens scrolled to it; it then stays frozen.
  const wrapRef = useRef(null);
  useEffect(() => {
    const body = wrapRef.current && wrapRef.current.querySelector('.ant-table-body, .ant-table-content');
    const cell = wrapRef.current && wrapRef.current.querySelector('th.pb-c-vessel');
    if (!body || !cell) return;
    const left = cell.offsetLeft;
    if (left + cell.offsetWidth > body.clientWidth) body.scrollLeft = left;
  }, []);

  // The header never scrolls on its own: a wheel / trackpad swipe over it scrolls the body instead, and the
  // header follows the body (antd keeps them in step). Captured on the wrap so antd's own header wheel
  // handler, which moved the header past a body that then snapped back, never runs.
  // Hovering the timeline lights up the row and the half-hour column under the pointer (--hs, CSS .hov).
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;
    const wheel = (e) => {
      if (!e.target.closest('.ant-table-header')) return;
      const body = wrap.querySelector('.ant-table-body');
      e.preventDefault();
      e.stopPropagation();
      if (body) body.scrollBy({ left: e.shiftKey ? e.deltaY : e.deltaX, top: e.shiftKey ? 0 : e.deltaY });
    };
    const move = (e) => {
      const bt = e.target.closest && e.target.closest('.pb-c-timeline .bt');
      if (!bt) return wrap.classList.remove('hov');
      const slot = Math.floor(((e.clientX - bt.getBoundingClientRect().left) / bt.offsetWidth) * SLOTS);
      wrap.style.setProperty('--hs', Math.max(0, Math.min(SLOTS - 1, slot)));
      wrap.classList.add('hov');
    };
    const leave = () => wrap.classList.remove('hov');
    wrap.addEventListener('wheel', wheel, { capture: true, passive: false });
    wrap.addEventListener('mousemove', move);
    wrap.addEventListener('mouseleave', leave);
    return () => {
      wrap.removeEventListener('wheel', wheel, { capture: true });
      wrap.removeEventListener('mousemove', move);
      wrap.removeEventListener('mouseleave', leave);
    };
  }, []);

  // The table body runs down to the bottom of the screen, measured rather than calc(100vh - …): on a phone
  // 100vh is the height with the browser bars hidden, so the board came out taller than the screen and the
  // whole page scrolled (toolbar gone, a blank band above the table). innerHeight follows the bars, and the
  // observer catches a toolbar that wraps or gains filter chips.
  const [bodyH, setBodyH] = useState(null);
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;
    const fit = () => {
      const body = wrap.querySelector('.ant-table-body');
      if (!body) return;
      const top = body.getBoundingClientRect().top + window.scrollY;
      const gap = document.body.classList.contains('desk') ? 24 : 12;
      setBodyH(Math.max(240, Math.floor(window.innerHeight - top - gap)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    [wrap.previousElementSibling, wrap.querySelector('.ant-table-header')].forEach((el) => el && ro.observe(el));
    window.addEventListener('resize', fit);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, []);

  // D1: realtime connection state. Losing it shows Offline; coming back reloads the board from the store.
  const [live, setLive] = useState(() => navigator.onLine !== false);
  useEffect(() => {
    const down = () => {
      setLive(false);
      say('Connection lost · reconnecting…');
    };
    const up = () => {
      setLive(true);
      setBoard(loadBoard());
      say('Reconnected · board reloaded');
    };
    window.addEventListener('offline', down);
    window.addEventListener('online', up);
    return () => {
      window.removeEventListener('offline', down);
      window.removeEventListener('online', up);
    };
  }, []);

  const C = cfg.density === 'compact' ? 36 : 40;
  const run = canRun(role);
  // Personal choice > role default > every column.
  const visible = cfg.columns || roleDefault(role);
  const f = cfg.filters;
  const chips = filterChips(f);
  const close = () => setOverlay(null);

  // ---------- board mutations (persisted to the shared hvs_board) ----------

  // Every edit is one user action, so computing from the rendered board is safe (and keeps side
  // effects such as counters out of a state updater, which React may run twice).
  function updateBoard(fn, msg) {
    const next = fn(board);
    setBoard(next);
    saveBoard(next);
    if (msg) say(msg);
  }

  const findRow = (b, no) => b.flatMap((s) => s.rows).find((r) => r.no === no);

  // Patch one ticket; a status change moves it between the pending band and its location band.
  const patchRow = (no, patch, msg) =>
    updateBoard((b) => {
      const old = findRow(b, no);
      const next = { ...old, ...(typeof patch === 'function' ? patch(old) : patch) };
      if (next.status !== old.status || next.port !== old.port) return placeRow(b, next);
      return b.map((s) => ({ ...s, rows: s.rows.map((r) => (r.no === no ? next : r)) }));
    }, msg);

  // ---------- status actions (status dropdown and Ticket actions) ----------

  const tag = (row) => `${row.vessel} · No. ${ticketId(row.no)}`;

  function approve(row) {
    patchRow(row.no, { status: 'CANCELLED', cancelReq: false, cancelReason: row.cancelReqReason || '' }, 'Cancellation approved · client notified');
    push('✅', 'Cancellation approved ' + row.vessel, ['No. ' + ticketId(row.no) + ' is now cancelled', 'Client notified by push'], CLIENT_TOO, 'agency:' + row.agency);
  }

  // A status picked from the menu. Confirmed needs the MOD on duty (Ticket actions asks for one when the
  // ticket has none); Cancelled needs a reason; the rest apply at once. Every change is kept in statusLog.
  function setStatus(row, to, extra = {}) {
    const entry = { from: row.status, to, by: loadUserName(), at: Date.now(), ...(extra.cancelReason ? { reason: extra.cancelReason } : {}) };
    patchRow(row.no, (r) => ({ status: to, cancelReq: false, ...extra, statusLog: (r.statusLog || []).concat([entry]) }), `Status: ${statusLabel(row.status)} → ${statusLabel(to)}`);
  }

  function action(row, key) {
    if (key === 'approve') {
      modal.confirm({ title: 'Approve the cancellation?', content: 'The ticket becomes CANCELLED and the client is notified.', okText: 'Approve', onOk: () => approve(row) });
    }
    if (key === 'approve-now') approve(row);
    if (key === 'reject') open('reason', row, { mode: 'reject' });
    if (!key.startsWith('to:')) return;
    const to = key.slice(3);
    if (to === 'CANCELLED') return open('reason', row, { mode: 'cancel' });
    if (to === 'CONFIRMED' && !row.mod) return open('actions', row, { needMod: true });
    setStatus(row, to);
  }

  function onReason(row, mode, reason) {
    if (mode === 'reject') {
      patchRow(row.no, { cancelReq: false, cancelRejectNote: reason }, 'Cancellation rejected · client notified');
      push('↩️', 'Cancellation rejected ' + row.vessel, ['Note: ' + reason, 'The ticket keeps its status · client notified'], CLIENT_TOO, 'agency:' + row.agency);
    }
    if (mode === 'cancel') {
      setStatus(row, 'CANCELLED', { cancelReason: reason });
      push('🚫', 'Ticket cancelled ' + row.vessel, ['Reason: ' + reason, 'Client notified by push'], CLIENT_TOO, 'agency:' + row.agency);
    }
  }

  function createTicket(t) {
    const no = String(Math.max(...board.flatMap((s) => s.rows).map((r) => Number(r.no) || 0)) + 1);
    const row = { mod: '', internal: '', pobInNever: false, pobOutNever: false, pobInSigned: false, pobOutSigned: false, jobs: [], ship: [], ...t, no, status: 'PENDING', cancelReq: false };
    updateBoard((b) => placeRow(b, row), `Ticket ${ticketId(no)} created`);
  }

  // ---------- data ----------

  const allRows = useMemo(() => board.flatMap((s) => s.rows), [board]);

  // ---------- AI suggest (services + tugboats), accepted or rejected on the board ----------

  function runAI() {
    const list = suggestBoard(allRows);
    setSugs(list);
    if (!list.length) return say('AI found nothing to suggest: every open ticket has its tugboats.');
    const tickets = new Set(list.map((x) => x.no)).size;
    say(
      `AI found ${list.length} suggestion${list.length === 1 ? '' : 's'} on ${tickets} ticket${tickets === 1 ? '' : 's'}: open each dashed block to accept or delete it.`
    );
  }

  // Accepting several at once goes ticket by ticket on one board update, so later ones see earlier ones.
  function accept(list) {
    let b = board;
    const done = [];
    const stale = [];
    list.forEach((x) => {
      const rows = b.flatMap((sec) => sec.rows);
      const r = rows.find((o) => o.no === x.no);
      if (!r) return;
      const clash = nowBusy(rows, r, x);
      if (clash.length) return stale.push(clash.join(', '));
      const next = { ...r, ...acceptPatch(r, x) };
      b = b.map((sec) => ({ ...sec, rows: sec.rows.map((o) => (o.no === x.no ? next : o)) }));
      done.push(x.id);
    });
    if (done.length) updateBoard(() => b, done.length === 1 ? 'AI suggestion accepted' : done.length + ' AI suggestions accepted');
    if (stale.length) message.warning(`${stale.join('; ')} became busy meanwhile: run AI suggest again.`);
    setSugs((cur) => (cur || []).filter((x) => !done.includes(x.id)));
  }
  const reject = (list) => {
    setSugs((cur) => (cur || []).filter((x) => !list.some((y) => y.id === x.id)));
    say('AI suggestion deleted');
  };
  const dup = useMemo(() => conflicts(allRows), [allRows]);
  const twin = useMemo(() => twins(allRows), [allRows]);
  const current = overlay ? findRow(board, overlay.no) : null;

  const dataSource = useMemo(() => {
    const groups = board
      .map((s, si) => {
        const rows = sectionPasses(s, f) ? s.rows.filter((r) => inWindow(r, day) && rowPasses(r, f)) : [];
        const tint = D.sectionColors[s.label] || '#f3f4f6';
        const key = 'sec:' + si;
        const spans = portSpans(rows, s.label !== PENDING);
        const children = rows.map((r, i) => ({ ...r, key: 'trip:' + r.no, portSpan: spans[i], tint }));
        if (!rows.length) children.push({ key: key + ':empty', isEmpty: true, tint, text: 'No tickets match the current filters' });
        return { key, isGroup: true, pending: s.label === PENDING, label: s.label, total: s.rows.length, count: rows.length, tint, children };
      })
      // Only bands with no tickets at all are hidden when empty bands are off.
      .filter((g) => cfg.showEmpty || g.total > 0 || g.count > 0);
    return groups;
  }, [board, f, cfg.showEmpty, day]);

  const toggle = (key) => setCollapsed((c) => (c.includes(key) ? c.filter((k) => k !== key) : [...c, key]));

  // NOTE is never clipped: the column widens to its longest note, kept on one line.
  const noteW = useMemo(() => noteWidth(allRows), [allRows]);
  const defs = D.boardColumns.filter((c) => visible.includes(c.key)).map((c) => (c.key === 'note' ? { ...c, width: Math.max(c.width, noteW) } : c));
  const open = (type, row, extra) => setOverlay({ type, no: row.no, ...extra });
  // After Add service: the assign window for the new block. Escort opens the ticket's Mano block at that POB
  // (a new one when it has none) with escort ticked.
  const nextAssign = (row, draft) => {
    if (!draft.escort) return open('assign', row, { draft });
    const ji = (row.jobs || []).findIndex((j) => j.kind !== 'escort' && (jobSvc(j) || {}).at === draft.escort);
    open('assign', row, ji >= 0 ? { ji, escortOn: true } : { draft, escortOn: true });
  };

  const alertCell = (row, field, what) => (
    <Tip title={`${what} not recognised`} content={`“${row[field]}” is not recognised by the system. An ADMIN or MOD can create it or map it to an existing one.`}>
      <span className="pb-alert-t" onClick={run ? () => open('actions', row) : undefined}>
        <WarningOutlined /> <span className="t">{row[field]}</span>
      </span>
    </Tip>
  );

  // Same vessel, same POB time as another open ticket: flagged on both, the MOD cancels or marks one not valid.
  // Each side names its partner ("= #1564"); clicking the badge scrolls to that ticket and flashes it.
  const goTo = (no) => {
    const tr = document.querySelector(`tr[data-row-key="trip:${no}"]`);
    if (!tr) return say(`${ticketId(no)} is hidden by the current filters or day`);
    tr.scrollIntoView({ block: 'center', behavior: 'smooth' });
    tr.classList.remove('pb-flash');
    void tr.offsetWidth;
    tr.classList.add('pb-flash');
  };
  const twinCell = (row) => (
    <span className="pb-twin-t">
      <Tip
        title="Possible duplicate ticket"
        content={<Lines lines={twin[row.no].map((x) => `${ticketId(x.no)}: same vessel, same ${x.field === 'pobIn' ? 'POB in' : 'POB out'} (${fmtMin(pobMin(row[x.field]))})`)} />}
      >
        <span className="pb-twin-name" onClick={run ? () => open('actions', row) : undefined}>
          <CopyOutlined /> <span className="t">{row.vessel}</span>
        </span>
      </Tip>
      {twin[row.no].map((x) => (
        <button key={x.no} type="button" className="pb-twin-tag" onClick={() => goTo(x.no)} aria-label={`Jump to ${ticketId(x.no)}`}>
          = {ticketId(x.no)}
        </button>
      ))}
    </span>
  );

  const mods = loadMods();
  const pobCell = (row, field, label) => {
    const body = (
      <span>
        <Pob row={row} field={field} bare />
      </span>
    );
    const value = (row[field] || '').replace(/\s*✓$/, '');
    if (row[field + 'Never']) return <Tip desk title={label} content="This POB will not happen.">{body}</Tip>;
    if (!value) return body;
    return (
      <Tip desk title={label} content={<Info title={pobTitle(value)} rows={[['Signed by pilot', row[field + 'Signed'] ? 'Yes' : 'No']]} />}>
        {body}
      </Tip>
    );
  };

  // The vessel card: on hover (desktop) / tap (CAPTAIN), and at the top of the Vessel window, where the fuel
  // figure is typed in instead of listed.
  const vesselInfo = (row, withFuel) => (
    <Info
      title={row.vessel}
      rows={[
        ['LOA', row.loa && row.loa + ' m'],
        ['DWT', row.dwt],
        ['Shipping line', tags[row.vessel]],
        ['Fuel figure', withFuel ? fmtFuel(row.fuel) : ''],
        ['On the board', count(allRows.filter((x) => x.vessel === row.vessel).length, 'ticket')]
      ]}
    />
  );

  const cell = {
    port: (row) =>
      row.portAlert ? (
        alertCell(row, 'port', 'Port')
      ) : (
        <Tip
          title="Port"
          content={
            <Info
              title={row.port}
              rows={[
                ['Location', locationOf(row.port)],
                ['On the board', count(allRows.filter((x) => x.port === row.port).length, 'ticket')]
              ]}
            />
          }
        >
          <span className="t">{row.port}</span>
        </Tip>
      ),
    // No., Agency / Owner, LOA and DWT are plain text: no hover card (user, 05/10).
    agency: (row) => <span className="t">{row.agency}</span>,
    vessel: (row) =>
      row.vesselAlert ? (
        alertCell(row, 'vessel', 'Vessel')
      ) : twin[row.no] ? (
        twinCell(row)
      ) : (
        // ADMIN / MOD: tapping the name opens the Vessel window with the fuel figure input right in it (same value
        // as in Ticket actions); desktop also shows the card on hover. Others get the card only.
        <Tip
          title="Vessel"
          content={vesselInfo(row, true)}
        >
          <span className={'pb-vessel' + (run && !isTerminal(row.status) ? ' on' : '')} onClick={run && !isTerminal(row.status) ? () => open('fuel', row) : undefined}>
            <span className="t">{row.vessel}</span>
            {row.fuel && <span className="pb-fuel">⛽</span>}
            {tags[row.vessel] && <span className="pb-vtag">{tags[row.vessel]}</span>}
          </span>
        </Tip>
      ),
    no: (row) => <span className="t">{ticketId(row.no)}</span>,
    status: (row) => {
      const st = STATUS[row.status] || STATUS.PENDING;
      const pill = (
        // The client asked to cancel: the pill says "Cancel requested" in place of the status (amber frame) until
        // the request is approved or rejected; the status itself shows in the tip.
        <button
          type="button"
          className={'spill' + (row.cancelReq ? ' creq' : '')}
          style={{ color: st.fg, background: st.bg, borderColor: row.cancelReq ? undefined : st.bd }}
          disabled={!run}
        >
          {row.cancelReq ? 'Cancel requested' : st.label}
          {run ? ' ▾' : ''}
        </button>
      );
      const last = (row.statusLog || []).slice(-1)[0];
      const tip = (
        <Info
          title={st.label}
          rows={[
            ['Cancel requested', row.cancelReq ? row.cancelReqReason || 'Yes' : ''],
            ['MOD', row.mod],
            ['Changed by', last && last.by],
            ['Reason', row.status === 'CANCELLED' ? row.cancelReason : row.status === 'NOT_VALID' ? row.invalidReason : '']
          ]}
          hint={isTerminal(row.status) ? 'Closed. Only an admin can reopen it' : null}
        />
      );
      return (
        <>
          <Tip desk title="Status" content={tip}>
            {run ? (
              <Dropdown trigger={['click']} menu={{ items: statusItems(row, role), onClick: ({ key }) => action(row, key) }}>
                {pill}
              </Dropdown>
            ) : (
              pill
            )}
          </Tip>
        </>
      );
    },
    note: (row) => {
      const text = row.internal ? (
        <>
          <i className="pb-edited">✎</i>
          <span className="t">{row.internal}</span>
        </>
      ) : (
        <span className="t">{row.note}</span>
      );
      const body = (
        <span className="pb-note" onClick={run && !isTerminal(row.status) ? () => open('notes', row) : undefined}>
          {text}
        </span>
      );
      if (!row.note && !row.internal) return body;
      return (
        <Tip
          title="Notes"
          content={
            <div className="tip-notes">
              <b>Client note</b>
              <p>{row.note || '-'}</p>
              <b>Internal note</b>
              <small>Not visible to the client</small>
              <p>{row.internal || '-'}</p>
            </div>
          }
        >
          {body}
        </Tip>
      );
    },
    pobIn: (row) => pobCell(row, 'pobIn', 'POB in'),
    pobOut: (row) => pobCell(row, 'pobOut', 'POB out'),
    mod: (row) => {
      if (!row.mod) return <span className="t" />;
      const m = mods.find((u) => u.name === row.mod);
      return (
        <Tip desk title="MOD on duty" content={<Info title={row.mod} rows={[['Phone', m && m.phone], ['Email', m && m.email]]} />}>
          <span className="t">{row.mod}</span>
        </Tip>
      );
    },
    loa: (row) => <span className="t">{row.loa}</span>,
    dwt: (row) => <span className="t">{row.dwt}</span>,
    // Always shown; a captain gets the ticket read only.
    actions: (row) => (
      <Dropdown
        trigger={['click']}
        placement="bottomRight"
        // The ⋮ column can sit half past the window's right edge; shift the menu back on screen.
        autoAdjustOverflow={{ adjustX: true, adjustY: true, shiftX: true }}
        menu={{
          items: run
            ? [
                { key: 'actions', label: 'Ticket actions…' },
                { key: 'notes', label: 'Notes…', disabled: isTerminal(row.status) },
                { key: 'services', label: 'Services…' },
                // Closed tickets (done / cancelled / not valid) take no new services or tugboats.
                ...(isTerminal(row.status) ? [] : [{ key: 'service', label: 'Add service…' }])
              ]
            : [
                { key: 'actions', label: 'View ticket…' },
                { key: 'services', label: 'Services…' }
              ],
          onClick: ({ key }) => open(key, row)
        }}
      >
        <button type="button" className="pb-act" aria-label="Row actions">
          <More />
        </button>
      </Dropdown>
    )
  };

  const spanAll = defs.length + 1; // info columns + timeline

  const columns = defs
    .map((c, i) => ({
      key: c.key,
      dataIndex: c.key,
      title: c.label,
      width: c.width,
      className: 'pb-c-' + c.key,
      onHeaderCell: () => ({ title: c.name }),
      onCell: (row) => {
        // Section and empty rows span the whole board from their first cell.
        if (row.isGroup || row.isEmpty) return { colSpan: i === 0 ? spanAll : 0 };
        if (c.key === 'port') return { rowSpan: row.portSpan, className: row.portAlert ? 'pb-alert' : undefined };
        if (c.key === 'vessel') return { className: row.vesselAlert ? 'pb-alert' : twin[row.no] ? 'pb-twin' : undefined };
        // A POB in / POB out cell opens Add service with Mano (arrival / departure) picked.
        if ((c.key === 'pobIn' || c.key === 'pobOut') && run && !isTerminal(row.status))
          return { className: 'pb-click', onClick: () => open('service', row, { preset: c.key === 'pobIn' ? 'mano_in' : 'mano_out' }) };
        return {};
      },
      render: (v, row) => {
        if (row.isEmpty) return <span className="pb-empty-t">{row.text}</span>;
        if (row.isGroup) {
          const openBand = !collapsed.includes(row.key);
          return (
            <span className="b-sec-label">
              {!row.pending && row.total > 0 && (
                <i className={'chev' + (openBand ? '' : ' shut')}>
                  <Down />
                </i>
              )}
              {row.label}
              <em>
                {row.count} ticket{row.count === 1 ? '' : 's'}
              </em>
            </span>
          );
        }
        return cell[c.key] ? cell[c.key](row) : <span className="t">{v}</span>;
      }
    }))
    .concat([
      {
        key: 'timeline',
        title: <TimelineHeader C={C} day={day} />,
        width: SLOTS * C,
        className: 'pb-c-timeline',
        onCell: (row) => (row.isGroup || row.isEmpty ? { colSpan: 0 } : {}),
        render: (_, row) =>
          row.isGroup || row.isEmpty ? null : (
            <TimelineCell
              row={row}
              C={C}
              from={day * 48}
              dup={dup}
              term={isTerminal(row.status)}
              canRun={run && !isTerminal(row.status)}
              onJob={(ji) => open('assign', row, { ji })}
              onAdd={(preset) => open('service', row, { preset })}
              sugs={(sugs || []).filter((x) => x.no === row.no)}
              onAccept={(x) => accept([x])}
              onReject={(x) => reject([x])}
            />
          )
      }
    ]);

  const tableWidth = defs.reduce((n, c) => n + c.width, 0) + SLOTS * C;
  const reasonProps = current && overlay.type === 'reason' ? reasonCopy(overlay.mode, current) : null;

  return (
    <>
      <BoardBar
        filterCount={chips.length}
        chips={chips}
        day={day}
        live={live}
        onDay={(delta) => setDay((d) => d + delta)}
        onDate={setDay}
        onFilters={() => setSettings('filters')}
        onSettings={() => setSettings('columns')}
        onClearChip={(key) => setCfg((c) => ({ ...c, filters: Object.fromEntries(Object.entries(c.filters).filter(([k]) => k !== key)) }))}
        onClearAll={() => setCfg((c) => ({ ...c, filters: {} }))}
        onAI={run ? runAI : undefined}
      />
      {/* --vessel-w: the frozen VESSEL column, which timeline snap points keep clear of. */}
      <div className="pb-wrap" ref={wrapRef} style={{ '--c': C + 'px', '--vessel-w': (visible.includes('vessel') ? D.boardColumns.find((c) => c.key === 'vessel').width : 0) + 'px' }}>
        <Table
          className={'pb-table' + (cfg.density === 'compact' ? ' compact' : '')}
          tableLayout="fixed"
          columns={columns}
          dataSource={dataSource}
          rowKey="key"
          rowClassName={(r) =>
            r.isGroup
              ? 'pb-sec' + (r.pending ? ' pending' : '')
              : r.isEmpty
                ? 'pb-empty'
                : 'pb-row' + (isTerminal(r.status) ? ' pb-term' : '') + (r.status === 'CANCELLED' || r.status === 'NOT_VALID' ? ' pb-struck' : '')
          }
          onRow={(r) => ({
            style: { '--pb-tint': r.tint },
            onClick: r.isGroup && !r.pending && r.total > 0 ? () => toggle(r.key) : undefined
          })}
          expandable={{
            // Section rows draw their own chevron (see render); trip rows get no expander or indent.
            expandedRowKeys: dataSource.filter((g) => g.isGroup && (g.pending || !collapsed.includes(g.key))).map((g) => g.key),
            expandIcon: () => null,
            indentSize: 0
          }}
          pagination={false}
          scroll={{ x: tableWidth, y: bodyH || `calc(100vh - 85px - 75px - 24px - 45px - ${chips.length ? 34 : 0}px)` }}
        />
      </div>

      {current && overlay.type === 'actions' && (
        <TicketActionsModal
          row={current}
          rows={allRows}
          role={role}
          mods={loadMods()}
          needMod={!!overlay.needMod}
          onPatch={(patch, msg) => patchRow(current.no, patch, msg)}
          onStatus={(patch, msg) => (patch ? patchRow(current.no, patch, msg) : message.warning(msg))}
          onAction={(key) => action(current, key === 'approve' ? 'approve-now' : key)}
          tag={tags[current.vessel] || ''}
          onTag={(tag) => {
            const next = { ...tags, [current.vessel]: tag };
            if (!tag) delete next[current.vessel];
            setTags(next);
            saveTags(next);
          }}
          onClose={close}
        />
      )}
      {current && overlay.type === 'fuel' && <FuelModal row={current} info={vesselInfo(current, false)} onSave={(patch, msg) => patchRow(current.no, patch, msg)} onClose={close} />}
      {current && overlay.type === 'notes' && <NotesModal row={current} onSave={(patch, msg) => patchRow(current.no, patch, msg)} onClose={close} />}
      {current && overlay.type === 'services' && (
        <ServicesModal
          row={current}
          ro={!run || isTerminal(current.status)}
          onEdit={(ji) => setTimeout(() => open('assign', current, { ji }), 0)}
          onAdd={() => setTimeout(() => open('service', current), 0)}
          onSave={(patch, msg) => patchRow(current.no, patch, msg)}
          onClose={close}
        />
      )}
      {current && overlay.type === 'service' && (
        <AddServiceModal row={current} preset={overlay.preset} onNext={(draft) => setTimeout(() => nextAssign(current, draft), 0)} onClose={close} />
      )}
      {current && overlay.type === 'assign' && (
        <AssignModal
          key={overlay.draft ? 'new-' + overlay.draft.service : 'job-' + overlay.ji}
          row={current}
          rows={allRows}
          ji={overlay.ji}
          draft={overlay.draft}
          escortOn={!!overlay.escortOn}
          onSave={(patch, msg) => patchRow(current.no, patch, msg)}
          onClose={close}
        />
      )}
      {reasonProps && <ReasonModal {...reasonProps} onOk={(reason, to) => onReason(current, overlay.mode, reason, to)} onClose={close} />}
      {run && (
        <button type="button" className="fab pb-fab" onClick={() => setNewOpen(true)} aria-label="New ticket">
          <PlusOutlined />
        </button>
      )}
      {newOpen && <NewTicketSheet rows={allRows} mods={loadMods()} onCreate={createTicket} onError={(msg) => message.error(msg)} onClose={() => setNewOpen(false)} />}
      {settings === 'filters' && (
        <FilterSheet
          filters={f}
          ports={[...new Set(allRows.map((r) => r.port).filter(Boolean))].sort()}
          vessels={[...new Set(allRows.map((r) => r.vessel))].sort()}
          onApply={(filters) => setCfg((c) => ({ ...c, filters }))}
          onClose={() => setSettings(null)}
        />
      )}
      {settings === 'columns' && (
        <BoardSettings
          cfg={cfg}
          role={role}
          onClose={() => setSettings(null)}
          onApply={setCfg}
        />
      )}
    </>
  );
}

// Wording of the reason window for each action.
function reasonCopy(mode, row) {
  const head = (
    <b>
      {row.vessel} · {row.port} · No. {ticketId(row.no)}
    </b>
  );
  if (mode === 'reject') {
    return {
      title: 'Reject cancellation',
      head,
      text: `The ticket keeps its status (${statusLabel(row.status)}). The client is notified with your note.${row.cancelReqReason ? ' Client’s reason: ' + row.cancelReqReason : ''}`,
      label: 'Note to the client',
      placeholder: 'e.g. The tugboats are already on the way',
      okText: 'Reject request'
    };
  }
  return {
    title: 'Cancel ticket',
    head,
    text: `Current status: ${statusLabel(row.status)}. The ticket closes as CANCELLED and the client is notified with the reason. Only an admin can reopen a closed ticket.`,
    label: 'Reason',
    placeholder: 'e.g. Vessel changed its schedule',
    okText: 'Cancel ticket',
    danger: true
  };
}
