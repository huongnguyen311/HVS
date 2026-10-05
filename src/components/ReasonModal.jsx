import { useState } from 'react';
import { Input, Modal, Select, Typography } from 'antd';

const { Text } = Typography;

// A board action that needs a written reason: cancelling a ticket, rejecting a cancellation request.
// chips = quick reasons that fill the box; options = a required choice;
// optional = the reason may stay empty.
export default function ReasonModal({ title, head, text, label, placeholder, chips, options, optionLabel, okText, danger, optional, onOk, onClose }) {
  const [reason, setReason] = useState('');
  const [pick, setPick] = useState(undefined);
  const [tried, setTried] = useState(false);
  const ok = (optional || reason.trim()) && (!options || pick);

  return (
    <Modal
      open
      title={title}
      okText={okText}
      okButtonProps={{ danger }}
      onOk={() => {
        setTried(true);
        if (!ok) return;
        onOk(reason.trim(), pick);
        onClose();
      }}
      onCancel={onClose}
      destroyOnHidden
    >
      {head && <div className="pbm-head">{head}</div>}
      {text && <p className="pbm-hint">{text}</p>}
      {options && (
        <>
          <label className="pbm-label">{optionLabel}</label>
          <Select style={{ width: '100%' }} placeholder="Select" value={pick} onChange={setPick} options={options} status={tried && !pick ? 'error' : undefined} />
        </>
      )}
      <label className="pbm-label">
        {label}
        {optional ? <span className="opt"> (optional)</span> : <span className="req"> *</span>}
      </label>
      {chips && (
        <div className="reason-chips">
          {chips.map((c) => (
            <button key={c} type="button" className={reason === c ? 'on' : ''} onClick={() => setReason(c)}>
              {c}
            </button>
          ))}
        </div>
      )}
      <Input.TextArea rows={2} value={reason} placeholder={placeholder} status={tried && !optional && !reason.trim() ? 'error' : undefined} onChange={(e) => setReason(e.target.value)} />
      {tried && !ok && (
        <Text type="danger" className="pbm-err">
          {options && !pick ? 'Choose an option and write a reason.' : 'A reason is required.'}
        </Text>
      )}
    </Modal>
  );
}
