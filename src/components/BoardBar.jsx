import { Popover } from 'antd';
import { CloseOutlined, FilterOutlined } from '@ant-design/icons';
import D from '../data';
import { Gear, PLeft, PRight } from '../board/icons';
import { KIND, svcKind } from '../board/timeline';

// Legend colours come from the service catalogue (Admin › Service Types, editable at runtime), plus escort segments.
const legend = () => D.services.map((s) => ({ ...svcKind(s), label: s.name, short: s.short || s.name })).concat([KIND.escort]);
const BAR_KEYS = 4; // service keys shown on the bar itself
const MARKS = 7; // marks listed only in the popover (H7, = #, signed, hold, cancel?, #, blank)

// The board toolbar (.bbar): date window, filters, display settings, legend,
// and one chip per active filter (✕ clears it) so a filtered board never looks like missing data.
// live: the realtime connection (D1), a dot beside the dates (the toolbar has no room for a label at 390px):
// green = live, red = offline. Losing / regaining it also toasts; on reconnect the board reloads (PlanBoardTable).
export default function BoardBar({ filterCount, chips, range, live = true, onDay, onFilters, onSettings, onClearChip, onClearAll, onAI }) {
  const LEGEND = legend();
  return (
    <div className="bbar">
      <div className="bbar-row">
        <div className="bdate">
          <button type="button" onClick={() => onDay(-1)} aria-label="Previous day">
            <PLeft />
          </button>
          <span>{range}</span>
          <button type="button" onClick={() => onDay(1)} aria-label="Next day">
            <PRight />
          </button>
        </div>
        <span className={'blive' + (live ? '' : ' off')} role="status" title={live ? 'Live: changes from others appear at once' : 'Offline: reconnecting. The board reloads when the connection is back'} aria-label={live ? 'Live' : 'Offline'}>
          <i />
        </span>
        <span className="bgrow" style={{ flex: 1 }} />
        {onAI && (
          <button type="button" className="bai" onClick={onAI} aria-label="AI suggest">
            ✨ AI<span className="bai-x"> suggest</span>
          </button>
        )}
        <button type="button" className={'bgear bfilter' + (filterCount ? ' on' : '')} onClick={onFilters} aria-label="Filters">
          <FilterOutlined />
          {filterCount > 0 && <b>{filterCount}</b>}
        </button>
        <button type="button" className="bgear" onClick={onSettings} aria-label="Board display">
          <Gear />
        </button>
      </div>
      {chips.length > 0 && (
        <div className="bbar-row chips-row bchips">
          {chips.map((c) => (
            <span key={c.key} className="bchip">
              {c.label}
              <button type="button" onClick={() => onClearChip(c.key)} aria-label={'Clear ' + c.label}>
                <CloseOutlined />
              </button>
            </span>
          ))}
          {chips.length > 1 && (
            <button type="button" className="bchip-all" onClick={onClearAll}>
              Clear all
            </button>
          )}
        </div>
      )}
      {/* One-line legend: colour swatches with short names; ⓘ opens the full key. */}
      <Popover
        trigger="click"
        placement="bottomRight"
        title="Legend"
        overlayClassName="blegend-pop"
        content={
          <div className="blegend-help">
            <h5>Services</h5>
            <div className="blegend-grid">
              {LEGEND.map((k) => (
                <div key={k.label} title={k.label}>
                  <i style={{ background: k.bg, borderColor: k.bd }} />
                  <span>{k.label}</span>
                </div>
              ))}
            </div>
            <h5>Marks</h5>
            <div className="blegend-marks">
              <span className="lg plain">
                <u>H7</u>
              </span>
              <span>Tugboat double-booked</span>
              <span className="pb-twin-tag">= #1564</span>
              <span>Duplicate of that ticket</span>
              <span className="lg signed">0900 ✓</span>
              <span>POB signed by pilot</span>
              <b>⏸</b>
              <span>On hold</span>
              <b>cancel?</b>
              <span>Client asked to cancel</span>
              <b>#</b>
              <span>POB will not happen</span>
              <b>blank</b>
              <span>POB not decided yet</span>
            </div>
          </div>
        }
      >
        {/* Phone: the first few keys, "+N more" opens the full legend. Desktop (body.desk) shows every key
            and mark on the one line (.bsw-x) and drops "+N more"; a click still opens the full key. */}
        <button type="button" className="blegend" aria-label="Legend">
          {LEGEND.map((k, i) => (
            <span key={k.label} className={'bsw' + (i < BAR_KEYS ? '' : ' bsw-x')}>
              <i style={{ background: k.bg, borderColor: k.bd }} />
              {k.short}
            </span>
          ))}
          <span className="bsw bsw-x bsw-sep" />
          <span className="bsw bsw-x">
            <span className="lg plain">
              <u>H7</u>
            </span>
            Double-booked
          </span>
          <span className="bsw bsw-x">
            <span className="pb-twin-tag">= #</span>
            Dupe
          </span>
          <span className="bsw bsw-x">
            <span className="lg signed">✓</span>
            Signed
          </span>
          <span className="bsw bsw-x">
            <b>⏸</b>
            On hold
          </span>
          <span className="bsw bsw-x">
            <b>cancel?</b>
            Cancel req.
          </span>
          <span className="bsw bsw-x">
            <b>#</b>
            No POB
          </span>
          <span className="bsw bsw-x">
            <b>blank</b>
            POB TBD
          </span>
          <span className="blegend-more">+{LEGEND.length - BAR_KEYS + MARKS} more</span>
        </button>
      </Popover>
    </div>
  );
}
