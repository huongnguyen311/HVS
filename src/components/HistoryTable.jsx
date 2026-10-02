import { useMemo, useState } from 'react';
import { DatePicker, Flex, Select, Table } from 'antd';
import { CloseOutlined, FilterOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import D from '../data';
import { loadAppRole, loadBoard, loadMods } from '../board/store';
import { STATUS, isTerminal } from '../board/status';
import { jobSvc, svc } from '../board/timeline';
import Tip from './Tip';
import { clientOf, locationOf, norm, pobMin, ticketId, toDayjs } from '../board/model.jsx';
import { Pob } from '../board/cells';
import { Sheet, SheetHead } from './ClassicSheet';
import TicketActionsModal from './TicketActionsModal';

// History (D4): the plan board's closed tickets (DONE, NOT_VALID, CANCELLED), read from the same board store,
// so a ticket closed on the board shows here at once. Operational data only, never prices. ADMIN / MOD see every
// ticket, a CLIENT only their own company's (the Agency/Owner of the demo client account). Same table look as the board, without the timeline.

const STATUSES = ['All', 'DONE', 'NOT_VALID', 'CANCELLED'];
const PER = 20;

// Services asked for on the ticket plus the ones its blocks carry, in catalogue order.
function servicesOf(r) {
  const codes = new Set((r.services || []).concat((r.jobs || []).map((j) => (jobSvc(j) || {}).code).filter(Boolean)));
  return D.services.filter((s) => codes.has(s.code));
}

const boatsOf = (r) => [...new Set((r.jobs || []).filter((j) => j.kind !== 'suggest').flatMap((j) => j.text.split('-')))];

// The ticket's day: POB in, else POB out (YYYY-MM-DD, for the date filter).
const dayOf = (r) => {
  const d = toDayjs(r.pobIn) || toDayjs(r.pobOut);
  return d ? d.format('YYYY-MM-DD') : '';
};

const when = (r) => {
  const m = pobMin(r.pobIn);
  return m == null ? pobMin(r.pobOut) ?? -1e9 : m;
};

const text = (a, b) => String(a || '').localeCompare(String(b || ''), 'vi', { numeric: true });
const num = (v) => Number(String(v || '').replace(/,/g, '')) || 0;

const NAMES = { agency: 'Agency/Owner', mod: 'MOD', port: 'Port', vessel: 'Vessel', service: 'Service', from: 'From', to: 'To' };

function chipsOf(f) {
  return Object.keys(NAMES)
    .filter((k) => f[k])
    .map((k) => ({
      key: k,
      label: `${NAMES[k]}: ${k === 'service' ? (svc(f[k]) || {}).name || f[k] : k === 'from' || k === 'to' ? dayjs(f[k]).format('DD/MM/YYYY') : f[k]}`
    }));
}

function passes(r, f, q) {
  if (f.agency && r.agency !== f.agency) return false;
  if (f.mod && r.mod !== f.mod) return false;
  if (f.port && r.port !== f.port) return false;
  if (f.vessel && r.vessel !== f.vessel) return false;
  if (f.service && !servicesOf(r).some((s) => s.code === f.service)) return false;
  if (f.from && dayOf(r) < f.from) return false;
  if (f.to && dayOf(r) > f.to) return false;
  if (!q) return true;
  const c = clientOf(r.agency);
  return norm([r.vessel, ticketId(r.no), r.no, r.port, r.agency, c && c.agency, r.mod, r.note].join(' ')).includes(q);
}

// Same sheet as the board's Filters (funnel): edits a draft, nothing changes until Done.
function HistoryFilterSheet({ filters, rows, onApply, onClose }) {
  const [f, setF] = useState({ ...filters });
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const uniq = (k) => [...new Set(rows.map((r) => r[k]).filter(Boolean))].sort(text).map((v) => ({ value: v, label: v }));
  const pick = (key, options) => (
    <label className="fs-field">
      <span className="cfg-label">{NAMES[key]}</span>
      <Select
        style={{ width: '100%' }}
        placeholder={`Any ${NAMES[key].toLowerCase()}`}
        allowClear
        showSearch={{ optionFilterProp: 'label' }}
        options={options}
        value={f[key] || undefined}
        onChange={(v) => set({ [key]: v || '' })}
      />
    </label>
  );
  const date = (key) => (
    <label className="fs-field" style={{ flex: 1, minWidth: 0 }}>
      <span className="cfg-label">{NAMES[key]}</span>
      <DatePicker
        style={{ width: '100%' }}
        format="DD/MM/YYYY"
        placeholder="dd/mm/yyyy"
        inputReadOnly
        value={f[key] ? dayjs(f[key]) : null}
        onChange={(d) => set({ [key]: d ? d.format('YYYY-MM-DD') : '' })}
      />
    </label>
  );
  const bad = f.from && f.to && f.from > f.to;
  return (
    <Sheet onClose={onClose}>
      <SheetHead title="Filters" onClose={onClose} />
      <div className="cfg-scroll">
        <div className="cfg-sec">
          <Flex vertical gap={12}>
            <Flex gap={10}>
              {date('from')}
              {date('to')}
            </Flex>
            {bad && <div className="hist-err">The first day must be before the last.</div>}
            {pick('agency', uniq('agency'))}
            {pick('mod', uniq('mod'))}
            {pick('port', uniq('port'))}
            {pick('vessel', uniq('vessel'))}
            {pick('service', D.services.map((s) => ({ value: s.code, label: s.name })))}
          </Flex>
        </div>
        <p className="cfg-note">Dates are the ticket’s POB in day (both included). Active filters show as chips above the list.</p>
      </div>
      <div className="bsheet-btns">
        <button type="button" className="clear" onClick={() => setF({})}>
          Clear all
        </button>
        <button
          type="button"
          className="done"
          disabled={bad}
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

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
  </svg>
);

export default function HistoryTable() {
  const [role] = useState(loadAppRole);
  const [board] = useState(loadBoard);
  const [status, setStatus] = useState('All');
  const [q, setQ] = useState('');
  const [f, setF] = useState({});
  const [page, setPage] = useState(1);
  const [sheet, setSheet] = useState(false);
  const [openNo, setOpenNo] = useState(null);

  const client = role === 'CLIENT';
  const allRows = useMemo(() => board.flatMap((s) => s.rows), [board]);
  // Closed tickets this user may see.
  const closed = useMemo(
    () => allRows.filter((r) => isTerminal(r.status) && (!client || norm(r.agency) === norm(D.demoClientAgency))),
    [allRows, client]
  );
  const rows = useMemo(() => {
    const nq = norm(q.trim());
    return closed
      .filter((r) => (status === 'All' || r.status === status) && passes(r, f, nq))
      .map((r) => ({ ...r, key: r.no, tint: D.sectionColors[locationOf(r.port)] || '#fff' }));
  }, [closed, status, f, q]);
  const chips = chipsOf(f);
  const current = openNo ? allRows.find((r) => r.no === openNo) : null;

  const reset = (fn) => (v) => {
    fn(v);
    setPage(1);
  };

  const col = (key) => D.boardColumns.find((c) => c.key === key);
  // Board widths, plus room for the sort arrows on sortable columns.
  const base = (key, extra = {}) => ({ key, dataIndex: key, title: col(key).label, width: col(key).width + (extra.sorter ? 22 : 0), className: 'pb-c-' + key, ...extra });
  const plain = (v) => <span className="t">{v}</span>;

  const columns = [
    base('port', { sorter: (a, b) => text(a.port, b.port), render: plain }),
    base('status', {
      width: 112,
      sorter: (a, b) => text(a.status, b.status),
      render: (st, r) => {
        const s = STATUS[st] || STATUS.DONE;
        // The reason is not on the ticket window: tapping the pill shows it (the rest of the row opens the ticket).
        const why = r.cancelReason || (r.overrides && r.overrides.length ? r.overrides[r.overrides.length - 1].reason : '');
        return (
          <Tip title={s.label} content={why}>
            <span className="spill" style={{ color: s.fg, background: s.bg, borderColor: s.bd }}>
              {s.label}
            </span>
          </Tip>
        );
      }
    }),
    base('no', { sorter: (a, b) => num(a.no) - num(b.no), render: (v) => plain(ticketId(v)) }),
    base('agency', {
      sorter: (a, b) => text(a.agency, b.agency),
      render: plain
    }),
    base('mod', { sorter: (a, b) => text(a.mod, b.mod), render: plain }),
    base('vessel', { sorter: (a, b) => text(a.vessel, b.vessel), render: plain }),
    base('loa', { sorter: (a, b) => num(a.loa) - num(b.loa), render: plain }),
    base('dwt', { sorter: (a, b) => num(a.dwt) - num(b.dwt), render: plain }),
    base('pobIn', { sorter: (a, b) => when(a) - when(b), defaultSortOrder: 'descend', render: (_, r) => <Pob row={r} field="pobIn" /> }),
    base('pobOut', { sorter: (a, b) => (pobMin(a.pobOut) ?? -1e9) - (pobMin(b.pobOut) ?? -1e9), render: (_, r) => <Pob row={r} field="pobOut" /> }),
    {
      key: 'services',
      title: 'SERVICES',
      width: 150,
      className: 'pb-c-services',
      render: (_, r) => {
        const list = servicesOf(r);
        return (
          <span className="hist-svcs">
            {list.map((s) => (
              <i key={s.code} style={{ background: s.color, color: s.text, borderColor: s.border }}>
                {s.short || s.name}
              </i>
            ))}
          </span>
        );
      }
    },
    {
      key: 'boats',
      title: 'TUGBOATS',
      width: 120,
      className: 'pb-c-boats',
      render: (_, r) => plain(boatsOf(r).join(' · ') || '-')
    },
    base('note', { render: (v) => plain(v || '') })
  ];
  const width = columns.reduce((n, c) => n + c.width, 0);

  return (
    <>
      <div className="bbar hbar">
        <div className="bbar-row">
          <label className="search sm hsearch">
            <SearchIcon />
            <input type="search" placeholder="Search vessel, trip no, port, agency…" value={q} onChange={(e) => reset(setQ)(e.target.value)} />
          </label>
          <button type="button" className={'bgear bfilter' + (chips.length ? ' on' : '')} onClick={() => setSheet(true)} aria-label="Filters">
            <FilterOutlined />
            {chips.length > 0 && <b>{chips.length}</b>}
          </button>
        </div>
        <div className="chips hchips">
          {STATUSES.map((s) => (
            <button key={s} type="button" className={'chip' + (status === s ? ' on' : '')} onClick={() => reset(setStatus)(s)}>
              {s === 'All' ? 'All' : STATUS[s].label}
            </button>
          ))}
        </div>
        {chips.length > 0 && (
          <div className="bbar-row chips-row bchips">
            {chips.map((c) => (
              <span key={c.key} className="bchip">
                {c.label}
                <button
                  type="button"
                  onClick={() => reset(setF)(Object.fromEntries(Object.entries(f).filter(([k]) => k !== c.key)))}
                  aria-label={'Clear ' + c.label}
                >
                  <CloseOutlined />
                </button>
              </span>
            ))}
            {chips.length > 1 && (
              <button type="button" className="bchip-all" onClick={() => reset(setF)({})}>
                Clear all
              </button>
            )}
          </div>
        )}
      </div>
      <div className="hist-note">{client ? 'Your closed tickets' : 'Closed tickets from the plan board'} · operational data only, no prices · read-only</div>
      <div className="pb-wrap hist-wrap" style={{ '--vessel-w': col('vessel').width + 22 + 'px' }}>
        <Table
          className="pb-table pb-hist"
          tableLayout="fixed"
          columns={columns}
          dataSource={rows}
          rowKey="key"
          rowClassName={(r) => 'pb-row' + (r.status === 'CANCELLED' || r.status === 'NOT_VALID' ? ' pb-struck' : '')}
          onRow={(r) => ({ style: { '--pb-tint': r.tint }, onClick: () => setOpenNo(r.no) })}
          showSorterTooltip={false}
          locale={{ emptyText: <span className="hist-empty">No tickets match these filters</span> }}
          pagination={{
            current: page,
            pageSize: PER,
            size: 'small',
            showSizeChanger: false,
            hideOnSinglePage: false,
            showTotal: (n) => `${n} ticket${n === 1 ? '' : 's'}`,
            onChange: setPage
          }}
          onChange={(p, _f, _s, extra) => extra.action === 'sort' && setPage(1)}
          scroll={{ x: width }}
        />
      </div>
      {sheet && <HistoryFilterSheet filters={f} rows={closed} onApply={reset(setF)} onClose={() => setSheet(false)} />}
      {current && (
        <TicketActionsModal
          row={current}
          rows={allRows}
          role={role}
          mods={loadMods()}
          history
          onPatch={() => {}}
          onStatus={() => {}}
          onAction={() => {}}
          onClose={() => setOpenNo(null)}
        />
      )}
    </>
  );
}
