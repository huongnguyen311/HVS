import { useState } from 'react';
import { Input, Modal, Typography } from 'antd';
import { ticketId } from '../board/model.jsx';

const { Text } = Typography;

// Notes…: the client's note and the board's internal note. NOTE shows the internal one when set.
export default function NotesModal({ row: r, onSave, onClose }) {
  const [note, setNote] = useState(r.note || '');
  const [internal, setInternal] = useState(r.internal || '');
  return (
    <Modal
      open
      title="Notes"
      okText="Save"
      onOk={() => {
        onSave({ note: note.trim(), internal: internal.trim() }, 'Note updated');
        onClose();
      }}
      onCancel={onClose}
      destroyOnHidden
    >
      <div className="pbm-head">
        <b>
          {r.vessel} · {r.port}
        </b>
        <Text type="secondary">
          No. {ticketId(r.no)}
        </Text>
      </div>
      <label className="pbm-label">Client note: what was requested</label>
      <Input.TextArea rows={2} value={note} placeholder="What the client asked for" onChange={(e) => setNote(e.target.value)} />
      <label className="pbm-label">Internal note: visible to admin, mod and captain only</label>
      <Input.TextArea rows={2} value={internal} placeholder="What the board decided, never shown to the client" onChange={(e) => setInternal(e.target.value)} />
      <p className="pbm-hint">The board's NOTE column shows the internal note when there is one, and falls back to the client's.</p>
    </Modal>
  );
}
