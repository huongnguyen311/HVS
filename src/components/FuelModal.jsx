import { useState } from 'react';
import { Input, Modal, Typography } from 'antd';
import { ticketId } from '../board/model.jsx';

const { Text } = Typography;

// Fuel figure is a whole number of litres: keep the digits only, show it with thousands separators.
export const fuelDigits = (v) => String(v || '').replace(/\D/g, '');
export const fmtFuel = (v) => (fuelDigits(v) ? Number(fuelDigits(v)).toLocaleString('en-US') + ' L' : '');

// The litres input shared by this window and Ticket actions.
export const FuelInput = ({ value, onChange, ...rest }) => (
  <Input {...rest} value={value} inputMode="numeric" placeholder="e.g. 12000" suffix="L" onChange={(e) => onChange(fuelDigits(e.target.value))} />
);

// Fuel figure (click the vessel name on the board): the vessel's fuel for this trip, in litres.
// The same value is edited in Ticket actions.
export default function FuelModal({ row: r, onSave, onClose }) {
  const [fuel, setFuel] = useState(fuelDigits(r.fuel));
  const save = () => {
    onSave({ fuel }, fuel ? 'Fuel figure saved' : 'Fuel figure cleared');
    onClose();
  };
  return (
    <Modal open title="Fuel figure" okText="Save" onOk={save} onCancel={onClose} destroyOnHidden>
      <div className="pbm-head">
        <b>
          {r.vessel} · {r.port}
        </b>
        <Text type="secondary">No. {ticketId(r.no)}</Text>
      </div>
      <label className="pbm-label">Fuel figure (litres)</label>
      <FuelInput autoFocus value={fuel} onChange={setFuel} onPressEnter={save} />
    </Modal>
  );
}
