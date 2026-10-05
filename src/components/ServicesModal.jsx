import { Button, Modal, Popconfirm, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { jobLabel, jobWindow, layoutQueues, ticketId, winText } from '../board/model.jsx';
import { jobColors, jobSvc } from '../board/timeline';

const { Text } = Typography;

// Services… (⋮ menu): every service on the ticket with its window and tugboats. Edit opens Assign tugboat for
// that block; Remove takes it off the board (with its escort segments and, at POB in, the shipping time);
// Add service opens the service picker. Escort segments are listed under their service, not on their own.
// ro: a closed ticket or a CAPTAIN, view only.
export default function ServicesModal({ row: r, ro, onEdit, onAdd, onSave, onClose }) {
  // One row per service: pieces of one job (same service, window and tugboats, split per day) list once.
  const same = (a, b) => a.kind === b.kind && a.svc === b.svc && a.win === b.win && a.text === b.text;
  const jobs = (r.jobs || [])
    .map((j, i) => [j, i])
    .filter(([j]) => j.kind !== 'escort')
    .filter(([j, i], _, all) => !all.some(([x, k]) => k < i && same(x, j)));
  const pieces = (j) => (r.jobs || []).map((x, i) => [x, i]).filter(([x]) => same(x, j)).map(([, i]) => i);
  const escortsOf = (j) => {
    const at = (jobSvc(j) || {}).at;
    return (r.jobs || []).map((x, i) => [x, i]).filter(([x]) => x.kind === 'escort' && x.anchor === at && (at === 'in' || at === 'out'));
  };

  function remove(j) {
    const drop = pieces(j).concat(escortsOf(j).map(([, i]) => i));
    const patch = { jobs: layoutQueues(r, r.jobs.filter((_, i) => !drop.includes(i))) };
    if ((jobSvc(j) || {}).at === 'in') patch.ship = [];
    onSave(patch, `${jobLabel(j)} removed`);
  }

  return (
    <Modal
      open
      title="Services"
      onCancel={onClose}
      destroyOnHidden
      width={560}
      footer={
        ro ? null : (
          <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>
            Add service
          </Button>
        )
      }
    >
      <div className="pbm-head">
        <b>
          {r.vessel} · {r.port}
        </b>
        <Text type="secondary">No. {ticketId(r.no)}</Text>
      </div>
      {jobs.length ? (
        <ul className="pbm-svcs">
          {jobs.map(([j, ji]) => {
            const k = jobColors(j);
            const esc = escortsOf(j).map(([x]) => x.text);
            return (
              <li key={ji}>
                <i style={{ background: k.bg, borderColor: k.bd }} />
                <div>
                  <b>{jobLabel(j)}</b>
                  <span>{winText(jobWindow(j))}</span>
                  <span>
                    Tugboats: {j.text || 'none yet'}
                    {esc.length > 0 && ' · escort ' + esc.join(', ')}
                  </span>
                  {j.note && <small>{j.note}</small>}
                </div>
                {!ro && (
                  <span className="pbm-svc-acts">
                    <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(ji)}>
                      Edit
                    </Button>
                    <Popconfirm
                      title={`Remove ${jobLabel(j)}?`}
                      description={esc.length ? 'Its escort segments are removed too.' : 'The block leaves the board.'}
                      okText="Remove"
                      okButtonProps={{ danger: true }}
                      onConfirm={() => remove(j)}
                    >
                      <Button size="small" danger icon={<DeleteOutlined />} aria-label={'Remove ' + jobLabel(j)} />
                    </Popconfirm>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="pbm-hint">No services on this ticket yet.</p>
      )}
    </Modal>
  );
}
