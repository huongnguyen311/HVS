import dayjs from 'dayjs';
import { Checkbox, DatePicker, Flex, Select, TimePicker } from 'antd';
import { fromDayjs, toDayjs } from '../board/model.jsx';

// POB time as the Ticket actions / Assign windows edit it: a mode (Time · Not set · # never), for Time the
// date-time, and whether the pilot signed it. value = { mode, t, signed } with t in the board's 'hhmm/dd.08' form.
export const pobValue = (row, field) => ({
  mode: row[field + 'Never'] ? 'never' : row[field] ? 'time' : 'unset',
  t: (row[field] || '').replace(/\s*✓$/, ''),
  signed: !!row[field + 'Signed']
});

export function pobPatch(field, v) {
  return { [field]: v.mode === 'time' ? v.t : '', [field + 'Never']: v.mode === 'never', [field + 'Signed']: v.mode === 'time' && !!v.signed };
}

// Time and date are two small pickers; each pick applies at once (no OK button).
export default function PobField({ value, onChange, disabled, fallback, noSign }) {
  const d = toDayjs(value.t);
  const put = (time, date) => {
    const n = dayjs(`${date}T${time}`);
    if (n.isValid()) onChange({ ...value, mode: 'time', t: fromDayjs(n) });
  };
  return (
    <Flex gap={6} wrap align="center">
      <Select
        style={{ width: 80, flex: 'none' }}
        value={value.mode}
        disabled={disabled}
        options={[
          { value: 'time', label: 'Time' },
          { value: 'unset', label: 'TBC' },
          { value: 'never', label: '#' }
        ]}
        onChange={(mode) => onChange({ mode, t: mode === 'time' ? value.t || fallback || '0800/24.08' : value.t, signed: mode === 'time' && value.signed })}
      />
      {value.mode === 'time' && (
        <>
          <TimePicker
            className="pob-in pob-time"
            placeholder="hh:mm"
            format="HH:mm"
            needConfirm={false}
            showNow={false}
            allowClear={false}
            suffixIcon={null}
            disabled={disabled}
            value={d}
            onChange={(t) => t && put(t.format('HH:mm'), (d || dayjs('2026-08-24')).format('YYYY-MM-DD'))}
          />
          <DatePicker
            className="pob-in pob-date"
            placeholder="dd/mm/yyyy"
            format="DD/MM/YYYY"
            needConfirm={false}
            showToday={false}
            allowClear={false}
            disabled={disabled}
            value={d}
            onChange={(t) => t && put(d ? d.format('HH:mm') : '08:00', t.format('YYYY-MM-DD'))}
          />
          {/* Signed = the pilot signed this time; the board draws it with a green border and ✓. noSign hides it
              (New ticket: nothing to sign yet); the value is kept as is. */}
          {!noSign && (
            <Checkbox className="pbm-signed" checked={value.signed} disabled={disabled} onChange={(e) => onChange({ ...value, signed: e.target.checked })}>
              Signed
            </Checkbox>
          )}
        </>
      )}
    </Flex>
  );
}
