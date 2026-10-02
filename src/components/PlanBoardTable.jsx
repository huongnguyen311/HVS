import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { App, Dropdown, Table } from 'antd';
import { CopyOutlined, PlusOutlined, WarningOutlined } from '@ant-design/icons';
import D from '../data';
import { loadBoard, loadConfig, loadMods, loadRole, loadTags, loadUserName, roleDefault, saveBoard, saveConfig, saveTags } from '../board/store';
import { STATUS, STATUS_KEYS, canMove, canRun, isAdmin, isTerminal } from '../board/status';
import { rowPasses, sectionPasses } from '../board/filters';
import { SLOTS, conflicts, twins } from '../board/timeline';
import { PENDING, clientOf, fmtMin, inWindow, locationOf, placeRow, pobMin, rangeLabel, ticketId } from '../board/model.jsx';
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
import TicketActionsModal from './TicketActionsModal';
import { TimelineCell, TimelineHeader } from './Timeline';

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

// Status dropdown items per status and role (ADMIN / MOD run the board).
function statusItems(row, role) {
  const admin = isAdmin(role);
  if (isTerminal(row.status)) {
    return admin ? [{ key: 'override', label: 'Override status…' }] : [{ key: 'none', label: 'Closed. Only an admin can reopen it', disabled: true }];
  }
  // What a MOD may not do (canMove) is still listed, greyed out, so they see it exists and who does it.
  const can = (to) => canMove(role, row.status, to);
  const adminOnly = (key, label, extra) => (can(extra.to) ? { key, label, ...extra.item } : { key, label: label + ' · admin only', disabled: true });
  const items = [];
  if (row.cancelReq) {
    // Cancelling a CONFIRMED (or updated) ticket is approved by an admin only.
    items.push(adminOnly('approve', 'Approve cancellation', { to: 'CANCELLED' }), adminOnly('reject', 'Reject cancellation…', { to: 'CANCELLED' }), { type: 'divider' });
  }
  // Confirm needs the MOD on duty, which is picked in Ticket actions.
  if (row.status === 'CONFIRMED') items.push(adminOnly('done', 'Mark done', { to: 'DONE' }));
  else items.push(adminOnly('confirm', row.status === 'NEW_UPDATE' ? 'Re-confirm…' : 'Confirm…', { to: 'CONFIRMED' }));
  items.push(row.hold ? { key: 'unhold', label: 'Release hold' } : { key: 'hold', label: 'Hold…' });
  items.push(adminOnly('invalid', 'Mark not valid', { to: 'NOT_VALID', item: { danger: true } }));
  if (admin) items.push({ type: 'divider' }, { key: 'override', label: 'Override status…' });
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
  const [day, setDay] = useState(0); // first day of the 2-day window, 0 = BOARD_DAY0 (01/10/2026)
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
    patchRow(row.no, { status: 'CANCELLED', cancelReq: false, hold: null, cancelReason: row.cancelReqReason || '' }, 'Cancellation approved · client notified');
    push('✅', 'Cancellation approved ' + row.vessel, ['No. ' + ticketId(row.no) + ' is now cancelled', 'Client notified by push'], CLIENT_TOO, 'agency:' + row.agency);
  }

  function release(row) {
    patchRow(row.no, { hold: null }, 'Hold released · client notified');
    push('▶️', 'Ticket resumed ' + row.vessel, ['The hold was released', 'Client notified by push'], CLIENT_TOO, 'agency:' + row.agency);
  }

  function markDone(row) {
    modal.confirm({
      title: 'Mark this ticket as DONE?',
      content: row.hold ? `It is on hold (${row.hold.reason}). Marking it done releases the hold. Only an admin can reopen a closed ticket.` : 'Only an admin can reopen a closed ticket.',
      okText: 'Mark done',
      onOk: () => patchRow(row.no, { status: 'DONE', hold: null }, row.hold ? 'Ticket marked as done · hold released' : 'Ticket marked as done')
    });
  }

  function action(row, key) {
    if (key === 'approve') {
      modal.confirm({ title: 'Approve the cancellation?', content: 'The ticket becomes CANCELLED and the client is notified.', okText: 'Approve', onOk: () => approve(row) });
    }
    if (key === 'approve-now') approve(row);
    if (key === 'unhold') release(row);
    if (key === 'confirm') open('actions', row);
    if (key === 'done') markDone(row);
    if (key === 'hold' || key === 'reject' || key === 'override' || key === 'invalid') open('reason', row, { mode: key });
  }

  function onReason(row, mode, reason, to) {
    const by = loadUserName();
    if (mode === 'hold') {
      patchRow(row.no, { hold: { reason, by, at: Date.now() } }, 'On hold · client notified');
      push('⏸', 'Ticket on hold ' + row.vessel, ['Reason: ' + reason, 'Client notified by push'], CLIENT_TOO, 'agency:' + row.agency);
    }
    if (mode === 'reject') {
      patchRow(row.no, { cancelReq: false, cancelRejectNote: reason }, 'Cancellation rejected · client notified');
      push('↩️', 'Cancellation rejected ' + row.vessel, ['Note: ' + reason, 'The ticket keeps its status · client notified'], CLIENT_TOO, 'agency:' + row.agency);
    }
    if (mode === 'invalid') patchRow(row.no, { status: 'NOT_VALID', cancelReq: false, hold: null, invalidReason: reason }, 'Ticket marked as not valid');
    if (mode === 'override') {
      const entry = { from: row.status, to, reason, by, at: Date.now() };
      patchRow(
        row.no,
        (r) => ({ status: to, cancelReq: false, hold: isTerminal(to) ? null : r.hold, overrides: (r.overrides || []).concat([entry]) }),
        `Status overridden: ${statusLabel(row.status)} → ${statusLabel(to)}`
      );
    }
  }

  function createTicket(t) {
    const no = String(Math.max(...board.flatMap((s) => s.rows).map((r) => Number(r.no) || 0)) + 1);
    const row = { mod: '', internal: '', pobInNever: false, pobOutNever: false, pobInSigned: false, pobOutSigned: false, jobs: [], ship: [], hold: null, ...t, no, status: 'PENDING', cancelReq: false };
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

  const defs = D.boardColumns.filter((c) => visible.includes(c.key));
  const open = (type, row, extra) => setOverlay({ type, no: row.no, ...extra });

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
    agency: (row) => {
      if (!row.agency) return <span className="t" />;
      const c = clientOf(row.agency);
      return (
        <Tip
          title="Agency"
          content={
            <Info
              title={c ? c.agency : row.agency}
              rows={[
                ['Short name', c && c.agency !== row.agency ? row.agency : ''],
                ['On the board', count(allRows.filter((x) => x.agency === row.agency).length, 'ticket')]
              ]}
              hint={c ? null : 'Not in the client list'}
            />
          }
        >
          <span className="t">{row.agency}</span>
        </Tip>
      );
    },
    vessel: (row) =>
      row.vesselAlert ? (
        alertCell(row, 'vessel', 'Vessel')
      ) : twin[row.no] ? (
        twinCell(row)
      ) : (
        // Tapping the name opens its card; the card's button opens the fuel figure (same value as in Ticket actions).
        <Tip
          title="Vessel"
          action={run && !isTerminal(row.status) ? { label: row.fuel ? 'Edit fuel figure' : 'Enter fuel figure', onClick: () => open('fuel', row) } : null}
          content={
            <Info
              title={row.vessel}
              rows={[
                ['LOA', row.loa && row.loa + ' m'],
                ['DWT', row.dwt],
                ['Shipping line', tags[row.vessel]],
                ['Fuel figure', fmtFuel(row.fuel)],
                ['On the board', count(allRows.filter((x) => x.vessel === row.vessel).length, 'ticket')]
              ]}
            />
          }
        >
          <span className={'pb-vessel' + (run && !isTerminal(row.status) ? ' on' : '')}>
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
        <button type="button" className="spill" style={{ color: st.fg, background: st.bg, borderColor: st.bd }} disabled={!run}>
          {st.label}
          {row.cancelReq ? ' · cancel?' : ''}
          {run ? ' ▾' : ''}
        </button>
      );
      // Hold is a mark beside the status, never a status of its own.
      const hold = row.hold && (
        <Tip title="On hold" content={row.hold.reason}>
          <span className="hpill">⏸</span>
        </Tip>
      );
      return (
        <>
          {run ? (
            <Dropdown trigger={['click']} menu={{ items: statusItems(row, role), onClick: ({ key }) => action(row, key) }}>
              {pill}
            </Dropdown>
          ) : (
            pill
          )}
          {hold}
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
    pobIn: (row) => <Pob row={row} field="pobIn" />,
    pobOut: (row) => <Pob row={row} field="pobOut" />,
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
                // Closed tickets (done / cancelled / not valid) take no new services or tugboats.
                ...(isTerminal(row.status) ? [] : [{ key: 'service', label: 'Add service…' }])
              ]
            : [{ key: 'actions', label: 'View ticket…' }],
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
        range={rangeLabel(day)}
        live={live}
        onDay={(delta) => setDay((d) => d + delta)}
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
      {current && overlay.type === 'fuel' && <FuelModal row={current} onSave={(patch, msg) => patchRow(current.no, patch, msg)} onClose={close} />}
      {current && overlay.type === 'notes' && <NotesModal row={current} onSave={(patch, msg) => patchRow(current.no, patch, msg)} onClose={close} />}
      {current && overlay.type === 'service' && (
        <AddServiceModal row={current} preset={overlay.preset} onNext={(draft) => setTimeout(() => open('assign', current, { draft }), 0)} onClose={close} />
      )}
      {current && overlay.type === 'assign' && (
        <AssignModal
          key={overlay.draft ? 'new-' + overlay.draft.service : 'job-' + overlay.ji}
          row={current}
          rows={allRows}
          ji={overlay.ji}
          draft={overlay.draft}
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
  if (mode === 'hold') {
    return {
      title: 'Hold ticket',
      head,
      text: 'The ticket keeps its status, paused. The client gets a push notification with the reason.',
      label: 'Reason',
      chips: D.holdReasons,
      placeholder: 'e.g. Vessel delayed, ETA 14:00 tomorrow',
      okText: 'Hold'
    };
  }
  if (mode === 'invalid') {
    return {
      title: 'Mark as not valid',
      head,
      text: 'The ticket is closed. Only an admin can reopen a closed ticket.',
      label: 'Reason',
      placeholder: 'e.g. Duplicate of another ticket',
      okText: 'Not valid',
      danger: true,
      optional: true
    };
  }
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
    title: 'Admin override',
    head,
    text: `Current status: ${statusLabel(row.status)}. An override can move a ticket to any status, closed ones included. The reason is kept in the ticket's history.`,
    options: STATUS_KEYS.filter((k) => k !== row.status).map((k) => ({ value: k, label: statusLabel(k) })),
    optionLabel: 'New status',
    label: 'Reason',
    placeholder: 'Why this status is being changed',
    okText: 'Override',
    danger: true
  };
}
