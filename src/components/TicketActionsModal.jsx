import dayjs from 'dayjs';
import { useState } from 'react';
import { Alert, AutoComplete, Button, Flex, Input, Modal, Popconfirm, Select, Space, Tag } from 'antd';
import { CheckCircleOutlined, CopyOutlined, CloseCircleOutlined, ExclamationCircleFilled, FlagOutlined, PlusOutlined, SwapOutlined } from '@ant-design/icons';
import { clientItems, ctxFilter, ctxOptions, fmtLoa, fmtMin, fromDayjs, pobMin, portItems, ticketId, vesselItems } from '../board/model.jsx';
import { BOARD_DAY0, twins } from '../board/timeline';
import D from '../data';
import { STATUS, canMove, canRun, isAdmin, isTerminal } from '../board/status';
import PobField, { pobPatch, pobValue } from './PobField';
import { FuelInput, fuelDigits } from './FuelModal';


// "Port / Vessel not found": point the ticket to an existing record, or add the typed name as a new one.
// newSub: what the new record would be created with (e.g. the ticket's LOA / DWT).
function Unrecognised({ what, value, options, newSub, onResolve }) {
  const [pick, setPick] = useState(undefined);
  const noun = what.toLowerCase();
  return (
    <div className="pbm-unrec">
      <div className="pbm-unrec-head">
        <ExclamationCircleFilled />
        <b>
          {what} “{value}” not found
        </b>
      </div>
      {/* Use existing: pick + Update on one row. Create new: one link line below. */}
      <Space.Compact block className="pbm-unrec-use">
        <Select
          style={{ flex: 1, minWidth: 0 }}
          value={pick}
          options={ctxOptions(options)}
          placeholder={`Use existing ${noun}`}
          showSearch={{ filterOption: ctxFilter }}
          labelRender={({ value: v }) => v}
          onChange={setPick}
        />
        <Button type="primary" icon={<SwapOutlined />} disabled={!pick} onClick={() => onResolve(pick)}>
          Update
        </Button>
      </Space.Compact>
      <div className="pbm-unrec-new">
        <span>or</span>
        <Button type="link" size="small" icon={<PlusOutlined />} onClick={() => onResolve(value)}>
          Create “{value}”
        </Button>
        {newSub && <small>{newSub}</small>}
      </div>
    </div>
  );
}

const Field = ({ label, children, style }) => (
  <div className="pbm-field" style={style}>
    <label className="pbm-label">{label}</label>
    {children}
  </div>
);

// Ticket actions…: fix unrecognised reference data, edit the ticket, and confirm / close it.
// ADMIN and MOD act; CAPTAIN opens the same window read only; closed tickets are locked.
// Cancellation requests (the ticket is on hold meanwhile) and any other status live in the row's status menu.
// history: opened from History (D4), operational data only, so no fuel figure (fuel feeds pricing).
// needMod: opened from the status menu's Confirmed on a ticket with no MOD yet; the MOD field is flagged.
export default function TicketActionsModal({ row: r, rows = [], role, mods, tag = '', onTag, history = false, needMod = false, onPatch, onStatus, onClose }) {
  const term = isTerminal(r.status);
  const run = canRun(role);
  const ro = term || !run;
  const initial = {
    vessel: r.vessel,
    loa: r.loa || '',
    dwt: r.dwt || '',
    port: r.port || '',
    agency: r.agency || '',
    fuel: fuelDigits(r.fuel),
    tag, // P6: shipping-line tag, kept on the vessel (every ticket of that vessel shows it)
    pobIn: pobValue(r, 'pobIn'),
    pobOut: pobValue(r, 'pobOut'),
    note: r.note || '',
    internal: r.internal || ''
  };
  const [f, setF] = useState(initial);
  const [mod, setMod] = useState(r.mod || undefined); // the MOD on duty: picked on New ticket or here, changeable any time
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  // Any edit, including picking a different MOD on duty, enables Save.
  const dirty = JSON.stringify(f) !== JSON.stringify(initial) || (mod || '') !== (r.mod || '');

  function save() {
    if (onTag && f.tag.trim() !== tag) onTag(f.tag.trim().toUpperCase());
    onPatch(
      {
        vessel: f.vessel.trim(),
        loa: f.loa.trim(),
        dwt: f.dwt.trim(),
        port: f.port.trim(),
        agency: f.agency.trim(),
        fuel: f.fuel,
        ...pobPatch('pobIn', f.pobIn),
        ...pobPatch('pobOut', f.pobOut),
        note: f.note.trim(),
        internal: f.internal.trim(),
        mod: mod || ''
      },
      'Ticket saved'
    );
    onClose();
  }

  const status = (patch, msg) => {
    onStatus(patch, msg);
    onClose();
  };

  const twin = twins(rows)[r.no];
  const open = r.status === 'PENDING' || r.status === 'NEW_UPDATE';
  // §12: what this role may do from the current status (a MOD: from PENDING, and CONFIRMED → DONE).
  const can = (to) => canMove(role, r.status, to);
  const st = STATUS[r.status] || STATUS.PENDING;

  return (
    <Modal open title={run && !term ? 'Ticket actions' : 'Ticket'} footer={null} onCancel={onClose} destroyOnHidden width={720}>
      <div className="pbm-hero">
        <div className="pbm-hero-main">
          <b>{r.vessel}</b>
          <span>
            {ticketId(r.no)} · {r.port} · {r.agency}
          </span>
        </div>
      </div>
      {term && <p className="pbm-lock">🔒 Closed{isAdmin(role) ? '. Reopen from the status menu' : '. Only admin can reopen'}</p>}
      {!run && !term && <p className="pbm-lock">View only</p>}

      {run && !term && r.portAlert && (
        <Unrecognised what="Port" value={r.port} options={portItems()} onResolve={(port) => (set({ port }), onPatch({ port, portAlert: false }, port === r.port ? `Port "${port}" created` : `Port updated to "${port}"`))} />
      )}
      {run && !term && r.vesselAlert && (
        <Unrecognised
          what="Vessel"
          value={r.vessel}
          options={vesselItems(rows)}
          newSub={`LOA ${r.loa ? fmtLoa(r.loa) : '-'} · DWT ${r.dwt || '-'}`}
          onResolve={(vessel) => (set({ vessel }), onPatch({ vessel, vesselAlert: false }, vessel === r.vessel ? `Vessel "${vessel}" created` : `Vessel updated to "${vessel}"`))}
        />
      )}
      {!term && twin && (
        <Alert
          className="pbm-alert"
          type="warning"
          icon={<CopyOutlined />}
          showIcon
          message="Possible duplicate ticket"
          description={twin.map((x) => `${ticketId(x.no)} has the same vessel and the same ${x.field === 'pobIn' ? 'POB in' : 'POB out'} (${fmtMin(pobMin(r[x.field]))}). Keep one and cancel or mark the other not valid.`).join(' ')}
        />
      )}

      <div className="pbm-form">
        <Flex gap={10} wrap>
          <Field label="Vessel" style={{ flex: '3 1 250px' }}>
            <AutoComplete style={{ width: '100%' }} value={f.vessel} options={ctxOptions(vesselItems(rows))} disabled={ro} onChange={(vessel) => set({ vessel })} filterOption={ctxFilter} />
          </Field>
          <Field label="LOA" style={{ flex: '1 1 80px' }}>
            <Input value={f.loa} disabled={ro} suffix="m" onChange={(e) => set({ loa: e.target.value })} />
          </Field>
          <Field label="DWT" style={{ flex: '1 1 80px' }}>
            <Input value={f.dwt} disabled={ro} suffix="t" onChange={(e) => set({ dwt: e.target.value })} />
          </Field>
          <Field label="Port" style={{ flex: '2 1 110px' }}>
            <AutoComplete style={{ width: '100%' }} value={f.port} options={ctxOptions(portItems())} disabled={ro} onChange={(port) => set({ port })} filterOption={ctxFilter} />
          </Field>
        </Flex>
        <Flex gap={10} wrap>
          <Field label="POB in" style={{ flex: '1 1 260px' }}>
            <PobField value={f.pobIn} disabled={ro} onChange={(pobIn) => set({ pobIn })} />
          </Field>
          <Field label="POB out" style={{ flex: '1 1 260px' }}>
            <PobField value={f.pobOut} disabled={ro} fallback={fromDayjs(dayjs(BOARD_DAY0 + 'T08:00').add(1, 'day'))} onChange={(pobOut) => set({ pobOut })} />
          </Field>
        </Flex>
        <Flex gap={10} wrap>
          <Field label={needMod && !mod ? 'MOD on duty * (needed to confirm)' : 'MOD on duty'} style={{ flex: '1 1 200px' }}>
            <Select
              style={{ width: '100%' }}
              value={mod}
              disabled={ro}
              placeholder="Select the MOD on duty"
              allowClear
              status={needMod && !mod ? 'warning' : undefined}
              options={mods.map((u) => ({ value: u.name, label: `${u.name} · ${u.phone}` }))}
              onChange={setMod}
            />
          </Field>
          <Field label="Agency" style={{ flex: '1 1 200px' }}>
            <AutoComplete
              style={{ width: '100%' }}
              value={f.agency}
              options={ctxOptions(clientItems())}
              disabled={ro}
              onChange={(agency) => set({ agency })}
              filterOption={ctxFilter}
            />
          </Field>
        </Flex>
        {/* P6 special case: the vessel's shipping-line tag (shown on every ticket of that vessel) and this
            ticket's fuel figure (empty ≠ 0). */}
        <div className="pbm-special">
          <h4 className="pbm-special-title">Special case</h4>
          <Flex gap={10} wrap>
            {/* Only the shipping lines the pricing supports (D.shippingLines). */}
            <Field label="Shipping line tag (vessel)" style={{ flex: '1 1 140px' }}>
              <Select
                style={{ width: '100%' }}
                value={f.tag || undefined}
                disabled={ro}
                placeholder="None"
                allowClear
                options={D.shippingLines.map((x) => ({ value: x, label: x }))}
                onChange={(v) => set({ tag: v || '' })}
              />
            </Field>
            {!history && (
              <Field label="Fuel figure" style={{ flex: '1 1 200px' }}>
                <FuelInput value={f.fuel} disabled={ro} onChange={(fuel) => set({ fuel })} />
              </Field>
            )}
          </Flex>
        </div>
        <Field label="Client note">
          <Input.TextArea rows={2} value={f.note} disabled={ro} onChange={(e) => set({ note: e.target.value })} />
        </Field>
        {role !== 'CLIENT' && (
          <Field label="Internal note 🔒">
            <Input.TextArea rows={2} value={f.internal} disabled={ro} placeholder="Not shown to the client" onChange={(e) => set({ internal: e.target.value })} />
          </Field>
        )}

      </div>

      <div className="pbm-sec">
        <div className="pbm-sec-head">
          <h4>Status</h4>
          {r.mod && <small className="pbm-sec-note">MOD: {r.mod}</small>}
        </div>
        {/* The ticket as it is now (status, plus the on-hold mark while the client asks to cancel). */}
        <Flex gap={4} wrap className="pbm-status-now">
          <Tag style={{ color: st.fg, background: st.bg, borderColor: st.bd, marginInlineEnd: 0 }}>{st.label}</Tag>
          {r.cancelReq && <Tag color="gold">Cancel requested</Tag>}
        </Flex>
      </div>

      {/* Sticky footer: status actions on the left, Save on the right. */}
      {!ro && (
        <div className="pbm-savebar">
          {open && !can('CONFIRMED') && <small className="pbm-bar-note">Updated by the client · an admin confirms it</small>}
          <div className="pbm-bar-btns">
            {can('NOT_VALID') && (
            <Popconfirm
              title="Mark as not valid?"
              description="The ticket closes. Only an admin can reopen it."
              okText="Not valid"
              okButtonProps={{ danger: true }}
              onConfirm={() => status({ status: 'NOT_VALID', cancelReq: false }, 'Marked not valid')}
            >
              <Button danger icon={<CloseCircleOutlined />}>
                Not valid
              </Button>
            </Popconfirm>
            )}
            <Button disabled={!dirty} onClick={save}>
              Save
            </Button>
            {open ? (
              can('CONFIRMED') && (
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => (mod ? status({ status: 'CONFIRMED', cancelReq: false, mod }, 'Ticket confirmed') : onStatus(null, 'Select the MOD on duty to confirm'))}
              >
                Confirm
              </Button>
              )
            ) : (
              can('DONE') && (
              <Popconfirm
                title="Mark as done?"
                okText="Done"
                onConfirm={() => status({ status: 'DONE' }, 'Marked done')}
              >
                <Button type="primary" icon={<FlagOutlined />}>
                  Done
                </Button>
              </Popconfirm>
              )
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
