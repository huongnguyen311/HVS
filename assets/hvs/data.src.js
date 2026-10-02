// Sample data shown by the app. Values come from the design screenshots in /images
// and from the live HVS site; `tickets` is injected by tools/build-data.js.
window.HVS_DATA = {
  tickets: /*TICKETS*/[],
  ticketTotal: 2141,

  // ---------- Phase 4 · Dashboards (mock; from the hvs-prototype plan board fixture) ----------

  // Plan board sections and rows; injected by tools/build-data.js from board.json.
  board: /*BOARD*/[],
  boardWindow: { start: '01/10/2026', end: '02/10/2026', days: ['Thursday 01/10/2026', 'Friday 02/10/2026'] },
  boardLocations: ['Cai Mep - Thi Vai', 'Vung Tau', 'Dong Nai', 'Sai Gon'],
  // Plan board ticket statuses (label + tag colours); read by board.js and src/board.
  boardStatus: {
    PENDING: { label: 'Pending', fg: '#ea580c', bg: '#fff3e6', bd: '#ffbd87' },
    CONFIRMED: { label: 'Confirmed', fg: '#16a34a', bg: '#d3e3d6', bd: '#7bc990' },
    NEW_UPDATE: { label: 'New Update', fg: '#2563eb', bg: '#dbeafe', bd: '#93c5fd' },
    DONE: { label: 'Done', fg: '#6b7280', bg: '#f3f4f6', bd: '#d1d5db' },
    NOT_VALID: { label: 'Not Valid', fg: '#dc2626', bg: '#fee2e2', bd: '#fca5a5' },
    CANCELLED: { label: 'Cancelled', fg: '#6b7280', bg: '#f3f4f6', bd: '#d1d5db' }
  },
  sectionColors: {
    'NEW TICKET / PENDING': '#edd8e6',
    'Cai Mep - Thi Vai': '#e0e7ff',
    'Vung Tau': '#dcfce7',
    'Dong Nai': '#ffedd5',
    'Sai Gon': '#dbeafe',
    'Unassigned location': '#fee2e2'
  },

  // Info columns in board order (as on hvs-prototype.vercel.app/tugboat-plan-board);
  // widths are fixed (content truncates, never widens). name = the header tooltip, as on the prototype.
  boardColumns: [
    { key: 'port', label: 'PORT', name: 'PORT', width: 92 },
    { key: 'status', label: 'STATUS', name: 'Status', width: 144 },
    { key: 'no', label: 'NO.', name: 'No. (numbered per month)', width: 62 },
    { key: 'agency', label: 'AGENCY/OWNER', name: 'Agency/Owner', width: 112 },
    { key: 'mod', label: 'MOD', name: 'MOD', width: 96 },
    { key: 'vessel', label: 'VESSEL', name: 'VESSEL', width: 150, required: true },
    { key: 'loa', label: 'LOA', name: 'LOA', width: 56 },
    { key: 'dwt', label: 'DWT', name: 'DWT', width: 64 },
    { key: 'pobIn', label: 'POB IN', name: 'POB in', width: 104 },
    { key: 'pobOut', label: 'POB OUT', name: 'POB out', width: 104 },
    { key: 'note', label: 'NOTE', name: 'NOTE', width: 180 },
    { key: 'actions', label: '', width: 44, required: true }
  ],
  // Board display presets (D1): All / Compact / Minimum; any other column list is "Custom".
  columnPresets: {
    All: null,
    Compact: ['vessel', 'port', 'status', 'no', 'pobIn', 'pobOut', 'actions'],
    Minimum: ['vessel', 'status', 'actions']
  },
  // Admin-configured defaults per role (board_role_defaults). null = every column.
  // Board column defaults, set by an admin on Admin › Board Defaults only: a list of column keys,
  // 'All', or null = no default at this level. Applied: own choice on the device → per user → per role → global → every column.
  // Every role starts as Same as default; the default is every column, so ADMIN and MOD see all of them (A3).
  roleDefaults: { ADMIN: null, MOD: null, CAPTAIN: null },
  globalDefault: 'All',
  userDefaults: { 'Captain Tung': ['vessel', 'status', 'pobIn', 'pobOut', 'actions'] },

  // Admin-configured service catalogue: the one list the ticket form, the board and Admin › Service Types
  // all read. Each has an English name (name, shown in the app) and a Vietnamese one (vi, A2). Rendering comes
  // from these rows, never from code:
  //   render  block (1 cell per tugboat) · background (a strip behind the blocks, POB in → POB out) · end_pinned (no time, row end)
  //   at      where the window comes from: 'in' / 'out' (POB + mins), 'after' (right after Mano (arrival)), 'span' (POB in → out), 'end'
  //   orderIn / orderOut  place in the POB in / POB out queue · stack  overlap order (higher draws on top)
  //   width   per_boat (1 tugboat = 1 cell) · by_time (as long as its window, cut at midnight)
  //   escort  the assign window offers "include escort" · multi  may appear more than once on a ticket
  services: [
    { code: 'mano_in', short: 'In', name: 'Mano (arrival)', color: '#ffff00', text: '#4a4000', border: '#d4c500', render: 'block', anchor: 'in', at: 'in', mins: 90, grouping: 'one_block_all', width: 'per_boat', orderIn: 10, orderOut: null, stack: 30, escort: true, multi: false, fields: ['Shipping time (min)', 'Escort rule', 'Escort boats'], hint: 'Starts at POB in', desc: 'Tugboat work at POB in. The board’s default arrival job.' },
    { code: 'mano_out', short: 'Out', name: 'Mano (departure)', color: '#92d050', text: '#1f3d00', border: '#6ba336', render: 'block', anchor: 'out', at: 'out', mins: 90, grouping: 'one_block_all', width: 'per_boat', orderIn: null, orderOut: 10, stack: 30, escort: true, multi: false, fields: ['Escort rule', 'Escort boats'], hint: 'Starts at POB out', desc: 'Tugboat work at POB out. No shipping time, nobody boards on the way out.' },
    { code: 'shifting', short: 'Shifting', name: 'Shifting', color: '#00ffff', text: '#00494a', border: '#00c4c6', render: 'block', anchor: 'none', at: 'after', mins: 90, grouping: 'one_block_all', width: 'per_boat', orderIn: null, orderOut: null, stack: 40, escort: false, multi: true, fields: [], hint: 'Right after Mano (arrival)', desc: 'Moving the vessel between berths. Placed right after Mano (arrival), as long as a mano; with no POB in, it ends at POB out.' },
    { code: 'standby', short: 'Standby', name: 'Standby', color: '#fde68a', text: '#5b4300', border: '#e0b84a', render: 'block', anchor: 'none', at: 'after', mins: 180, grouping: 'one_block_all', width: 'by_time', orderIn: null, orderOut: null, stack: 20, escort: false, multi: true, fields: [], hint: 'Right after Mano (arrival)', desc: 'Held ready right after Mano (arrival); with no POB in, it ends at POB out. Sits after mano, before mooring.' },
    { code: 'special', short: 'Special', name: 'Special job', color: '#f0abfc', text: '#701a75', border: '#c026d3', render: 'block', anchor: 'in_out', at: 'pob', mins: 90, grouping: 'one_block_all', width: 'per_boat', orderIn: null, orderOut: null, stack: 40, escort: false, multi: true, fields: [], hint: 'Starts at POB in, else POB out', desc: 'Anything outside the catalogue. Starts at POB in, or at POB out when there is no POB in.' },
    { code: 'salvage', short: 'Salvage', name: 'Salvage', color: '#fecaca', text: '#7f1d1d', border: '#f87171', render: 'background', anchor: 'both', at: 'span', grouping: 'one_block_all', width: 'by_time', orderIn: null, orderOut: null, stack: 2, escort: false, multi: false, fields: [], hint: 'Spans POB in → POB out', desc: 'Runs the whole POB in → POB out span, behind the row’s other work.' },
    { code: 'standby_duty', short: 'Duty', name: 'Standby on duty', color: '#e3d7f2', text: '#2c1450', border: '#8b63c9', render: 'background', anchor: 'both', at: 'span', grouping: 'one_block_all', width: 'by_time', orderIn: null, orderOut: null, stack: 1, escort: false, multi: false, fields: [], hint: 'Spans POB in → POB out', desc: 'Continuous duty across the POB window. The tug is occupied, not tasked.' },
    { code: 'mooring', short: 'Mooring', name: 'Mooring', color: '#cbd5e1', text: '#1e293b', border: '#94a3b8', render: 'end_pinned', anchor: 'none', at: 'end', grouping: 'one_block_all', width: 'per_boat', orderIn: null, orderOut: null, stack: 10, escort: false, multi: false, fields: [], hint: 'No POB time, pinned to the row end', desc: 'Takes no time from POB in or POB out. Renders at the end of the row.' }
  ],
  // Fixture jobs carry a drawing kind instead of a service code; this maps them onto the catalogue.
  kindService: { pobin: 'mano_in', pobout: 'mano_out', special: 'special', shift: 'standby_duty' },

  // Tugboat fleet for the assign window, grouped by location group; [code, high priority ★].
  fleet: [
    { group: 'Cai Mep - Thi Vai', boats: [['SK1', true], ['H5', true], ['H7', true], ['SK3', true], ['H8'], ['H9'], ['H2'], ['H3'], ['H4'], ['H6'], ['H10'], ['H11'], ['H12'], ['H15'], ['TCA1'], ['TCA2'], ['TCA3'], ['TC01'], ['TC02'], ['TC03'], ['SK5'], ['SK6'], ['GM1'], ['GM2']] },
    { group: 'Vung Tau', boats: [['V3', true], ['V4'], ['V5'], ['V6'], ['V7'], ['V8'], ['V9'], ['KS'], ['KS2'], ['AWA'], ['AWB'], ['VT1'], ['VT2'], ['VT3']] },
    { group: 'Dong Nai', boats: [['A9'], ['A10'], ['MR']] },
    { group: 'Sai Gon', boats: [['SCP'], ['TM'], ['KIE'], ['TOA'], ['LUCAS']] }
  ],
  escortRules: [
    { key: 'ps0', label: 'From pilot station (PS0)', minutes: 120, anchor: 'in' },
    { key: 'pob-in-1h30', label: 'POB in − 1h30', minutes: 90, anchor: 'in' },
    { key: 'pob-out-1h30', label: 'POB out − 1h30', minutes: 90, anchor: 'out' }
  ],

  // Locations & clients: port → location group, and client nicknames that autofill the new-ticket row.
  portLocations: {
    'GML': 'Cai Mep - Thi Vai', 'SSIT': 'Cai Mep - Thi Vai', 'CMIT': 'Cai Mep - Thi Vai', 'TCTT': 'Cai Mep - Thi Vai', 'TCIT': 'Cai Mep - Thi Vai',
    'LONG SON': 'Vung Tau', 'BP01': 'Vung Tau', 'PHUOC AN': 'Dong Nai', 'LOTUS - K16': 'Sai Gon', 'TL11': 'Sai Gon'
  },
  boardClients: [
    { nick: 'CMA', agency: 'CMA CGM VIETNAM' },
    { nick: 'MSC', agency: 'MSC VIETNAM' },
    { nick: 'HG/ONE', agency: 'HUONG GIANG / ONE' },
    { nick: 'MORRIS', agency: 'MORRIS AGENCY' },
    { nick: 'DVHH', agency: 'MARITIME SERVICES' },
    { nick: 'PAMAR', agency: 'PAMAR SHIPPING' }
  ],
  boardVessels: ['CMA CGM JULES VERNE', 'CSCL LONG BEACH', 'SHUN LONG', 'LETO', 'MSC NEW YORK', 'MSC TRIESTE', 'OOCL VIOLET', 'MAERSK BOSTON', 'ONE IBIS', 'ONE FREEDOM', 'APOLLO DIGNITY', 'PORT OSHIMA', 'ZHENG RONG', 'GOLDEN HOPE', 'DAT VENUS', 'ORIENTAL BREEZE'],

  // ---------- Phase 4 · Pricing & ledger (mock) ----------

  // The demo CLIENT account: "my tickets" are the ones this person created (matched without diacritics).
  demoClient: 'Phat Dinh',
  // Their company on the plan board (Agency/Owner): History shows a CLIENT the closed tickets of this owner.
  demoClientAgency: 'POS',

  // P1 · tax codes, customers (who is invoiced) and agents (who orders). Agent ↔ customer is many-to-many;
  // each customer has one tax code, and one tax code may be shared by several customers.
  taxCodes: [
    { code: '0301234567', legal: 'CMA CGM VIETNAM CO., LTD', address: 'District 1, Ho Chi Minh City' },
    { code: '0309876543', legal: 'MSC VIETNAM CO., LTD', address: 'District 1, Ho Chi Minh City' },
    { code: '0312223334', legal: 'HUONG GIANG MARITIME JSC', address: 'District 4, Ho Chi Minh City' },
    { code: '3500111222', legal: 'VUNG TAU MARITIME SERVICES JSC', address: 'Vung Tau City' },
    { code: '0315556667', legal: 'D. & S. CO., LTD', address: 'District 7, Ho Chi Minh City' }
  ],
  customers: [
    { id: 'c1', name: 'CMA CGM VIETNAM', short: 'CMA', taxCode: '0301234567', vat: 8, agents: ['a1', 'a2'], defaultAgent: 'a2', accounts: ['phat.dinh@inapps.net'] },
    { id: 'c2', name: 'CGM LOGISTICS', short: 'CGM', taxCode: '0301234567', vat: 8, agents: ['a1'], accounts: [] },
    { id: 'c3', name: 'MSC VIETNAM', short: 'MSC', taxCode: '0309876543', vat: 10, agents: ['a3'], accounts: [] },
    { id: 'c4', name: 'HUONG GIANG / ONE', short: 'HG/ONE', taxCode: '0312223334', vat: 8, agents: ['a4', 'a2'], accounts: [] },
    { id: 'c5', name: 'HUONG GIANG / CSCL', short: 'HG/CSCL', taxCode: '0312223334', vat: 8, agents: ['a4'], accounts: [] },
    { id: 'c6', name: 'MARITIME SERVICES', short: 'DVHH', taxCode: '3500111222', vat: 10, agents: ['a5'], accounts: [] },
    { id: 'c7', name: 'D. & S. CO., LTD', short: 'D&S', taxCode: '0315556667', vat: 10, agents: ['a5'], accounts: [] }
  ],
  agents: [
    { id: 'a1', name: 'CMA CGM Agency', contact: 'Mr. Tung', phone: '0903 111 222' },
    { id: 'a2', name: 'Pacific Marine', contact: 'Mr. Sang', phone: '0975 382 001' },
    { id: 'a3', name: 'MSC Agency VN', contact: 'Mr. Long', phone: '0912 345 678' },
    { id: 'a4', name: 'Huong Giang Agency', contact: 'Mr. Hoang', phone: '0938 222 444' },
    { id: 'a5', name: 'VTB Hai Van', contact: 'Duty officer', phone: '0254 3856 999' }
  ],

  // P2 · currencies (decimals per currency), daily exchange rates, and the price table. A blank condition
  // (customer, area, port, DWT, LOA) matches anything; ranges include both ends; a contract renewal is a new row.
  currencies: [
    { code: 'VND', name: 'Vietnamese dong', decimals: 0 },
    { code: 'USD', name: 'US dollar', decimals: 2 }
  ],
  fxRates: [
    { date: '24/08/2026', from: 'USD', to: 'VND', rate: 25350 },
    { date: '25/08/2026', from: 'USD', to: 'VND', rate: 25380 },
    { date: '26/08/2026', from: 'USD', to: 'VND', rate: 25410 },
    { date: '01/09/2026', from: 'USD', to: 'VND', rate: 25420 },
    { date: '15/09/2026', from: 'USD', to: 'VND', rate: 25445 },
    { date: '30/09/2026', from: 'USD', to: 'VND', rate: 25460 },
    { date: '01/10/2026', from: 'USD', to: 'VND', rate: 25470 },
    { date: '02/10/2026', from: 'USD', to: 'VND', rate: 25480 }
  ],
  priceRows: [
    { id: 'p1', customer: '', area: 'Cai Mep - Thi Vai', port: '', service: 'mano_in', dwtMin: null, dwtMax: 80000, loaMin: null, loaMax: null, price: 18500000, currency: 'VND', from: '01/01/2026', to: '31/12/2026' },
    { id: 'p2', customer: '', area: 'Cai Mep - Thi Vai', port: '', service: 'mano_in', dwtMin: 80001, dwtMax: null, loaMin: null, loaMax: null, price: 26000000, currency: 'VND', from: '01/01/2026', to: '31/12/2026' },
    { id: 'p3', customer: 'c1', area: '', port: 'GML', service: 'mano_in', dwtMin: null, dwtMax: null, loaMin: 125, loaMax: 250, price: 720, currency: 'USD', from: '01/07/2026', to: '30/06/2027' },
    { id: 'p4', customer: 'c1', area: '', port: 'GML', service: 'mano_in', dwtMin: null, dwtMax: null, loaMin: 251, loaMax: null, price: 980, currency: 'USD', from: '01/07/2026', to: '30/06/2027' },
    { id: 'p5', customer: '', area: 'Cai Mep - Thi Vai', port: '', service: 'mano_out', dwtMin: null, dwtMax: null, loaMin: null, loaMax: null, price: 17000000, currency: 'VND', from: '01/01/2026', to: '31/12/2026' },
    { id: 'p6', customer: 'c3', area: '', port: '', service: 'mano_out', dwtMin: 100000, dwtMax: null, loaMin: null, loaMax: null, price: 1150, currency: 'USD', from: '01/01/2026', to: '31/12/2026' },
    { id: 'p7', customer: '', area: '', port: '', service: 'shifting', dwtMin: null, dwtMax: null, loaMin: null, loaMax: 200, price: 9500000, currency: 'VND', from: '01/01/2026', to: '31/12/2026' },
    { id: 'p8', customer: '', area: '', port: '', service: 'special', dwtMin: null, dwtMax: null, loaMin: null, loaMax: null, price: 12000000, currency: 'VND', from: '01/01/2026', to: '31/12/2026' }
  ],

  // P3 · ledger rows (one per priced service; sub > 1 = a sub-ticket split from the same No.).
  // date = service day; tugs = tugboats on the job; customer = who ordered; invoice = column J (null = not set);
  // override = a price typed by an accountant (null = use the price table); status pending · provisional · confirmed · invoiced.
  ledger: [
    { stt: 101, sub: 1, date: '24/08/2026', trip: '1570', vessel: 'LETO', dwt: 42200, loa: 220.3, port: 'GML', service: 'mano_in', tugs: 2, customer: 'c1', invoice: 'c1', override: null, status: 'confirmed', note: 'Confirmed by phone, keep H5 - H7.' },
    { stt: 102, sub: 1, date: '24/08/2026', trip: '1564', vessel: 'OOCL VIOLET', dwt: 165460, loa: 367, port: 'SSIT', service: 'mano_in', tugs: 4, customer: 'c6', invoice: 'c6', override: null, status: 'provisional', note: 'Client asked for 4 tugs.' },
    { stt: 103, sub: 1, date: '24/08/2026', trip: '1546', vessel: 'MAERSK BOSTON', dwt: 53634, loa: 293.85, port: 'GML', service: 'special', tugs: 2, customer: 'c4', invoice: 'c4', override: 15500000, overrideReason: 'Agreed by phone with the owner', status: 'provisional', note: 'Special job' },
    { stt: 104, sub: 1, date: '24/08/2026', trip: '1533', vessel: 'MSC NEW YORK', dwt: 189190, loa: 399, port: 'SSIT', service: 'mano_in', tugs: 2, customer: 'c3', invoice: null, override: null, status: 'pending', note: 'Invoice to: MSC / 50% CGM' },
    { stt: 105, sub: 1, date: '24/08/2026', trip: '1532', vessel: 'MSC TRIESTE', dwt: 182145, loa: 365.5, port: 'SSIT', service: 'mano_out', tugs: 2, customer: 'c3', invoice: 'c3', override: null, status: 'provisional', note: '' },
    { stt: 106, sub: 1, date: '24/08/2026', trip: '1545', vessel: 'ONE FREEDOM', dwt: 155928, loa: 366, port: 'TCIT', service: 'mano_out', tugs: 1, customer: 'c4', invoice: 'c4', override: null, status: 'invoiced', note: '' },
    { stt: 106, sub: 2, date: '24/08/2026', trip: '1545', vessel: 'ONE FREEDOM', dwt: 155928, loa: 366, port: 'TCIT', service: 'mano_out', tugs: 1, customer: 'c4', invoice: 'c5', override: null, status: 'provisional', note: 'Split 1 tug to CSCL' },
    { stt: 107, sub: 1, date: '24/08/2026', trip: '1534', vessel: 'CMA CGM JULES VERNE', dwt: 186796, loa: 396, port: 'PVC-MS', service: 'mano_in', tugs: 3, customer: 'c1', invoice: 'c1', override: null, status: 'pending', note: '3 tugs working - 2 tugs esc' },
    { stt: 108, sub: 1, date: '24/08/2026', trip: '1556', vessel: 'DAT VENUS', dwt: 39996, loa: 182.9, port: 'CU LAO TAO', service: 'shifting', tugs: 2, customer: 'c7', invoice: 'c7', override: null, status: 'provisional', note: 'Invoice to: D. & S. CO., LTD' },
    { stt: 109, sub: 1, date: '25/08/2026', trip: '1535', vessel: 'GOLDEN HOPE', dwt: 74910, loa: 225, port: 'GML', service: 'mano_in', tugs: 2, customer: 'c1', invoice: 'c2', override: null, status: 'provisional', note: '' },
    { stt: 110, sub: 1, date: '25/08/2026', trip: '1573', vessel: 'ONE IBIS', dwt: 139335, loa: 364.15, port: 'SSIT', service: 'standby_duty', tugs: 1, customer: 'c4', invoice: 'c4', override: null, status: 'provisional', note: 'On duty' },
    { stt: 111, sub: 1, date: '02/09/2026', trip: '1601', vessel: 'CMA CGM JULES VERNE', dwt: 186796, loa: 396, port: 'GML', service: 'mano_in', tugs: 3, customer: 'c1', invoice: 'c1', override: null, status: 'invoiced', note: '' },
    { stt: 112, sub: 1, date: '03/09/2026', trip: '1604', vessel: 'MSC NEW YORK', dwt: 189190, loa: 399, port: 'SSIT', service: 'mano_out', tugs: 2, customer: 'c3', invoice: 'c3', override: null, status: 'invoiced', note: '' },
    { stt: 113, sub: 1, date: '05/09/2026', trip: '1610', vessel: 'SHUN LONG', dwt: 32500, loa: 189.9, port: 'CU LAO TAO', service: 'shifting', tugs: 1, customer: 'c7', invoice: 'c7', override: null, status: 'invoiced', note: '' },
    { stt: 114, sub: 1, date: '08/09/2026', trip: '1615', vessel: 'ONE IBIS', dwt: 139335, loa: 364.15, port: 'TCIT', service: 'mano_in', tugs: 2, customer: 'c4', invoice: 'c4', override: null, status: 'invoiced', note: '' },
    { stt: 115, sub: 1, date: '11/09/2026', trip: '1622', vessel: 'LETO', dwt: 42200, loa: 220.3, port: 'GML', service: 'mano_out', tugs: 2, customer: 'c1', invoice: 'c1', override: null, status: 'invoiced', note: '' },
    { stt: 116, sub: 1, date: '14/09/2026', trip: '1628', vessel: 'MSC TRIESTE', dwt: 182145, loa: 365.5, port: 'SSIT', service: 'mano_in', tugs: 2, customer: 'c3', invoice: 'c3', override: null, status: 'confirmed', note: '' },
    { stt: 117, sub: 1, date: '18/09/2026', trip: '1633', vessel: 'GOLDEN HOPE', dwt: 74910, loa: 225, port: 'GML', service: 'mano_in', tugs: 1, customer: 'c1', invoice: 'c1', override: null, status: 'confirmed', note: '' },
    { stt: 117, sub: 2, date: '18/09/2026', trip: '1633', vessel: 'GOLDEN HOPE', dwt: 74910, loa: 225, port: 'GML', service: 'mano_in', tugs: 1, customer: 'c1', invoice: 'c2', override: null, status: 'confirmed', note: 'Split 1 tug to CGM' },
    { stt: 118, sub: 1, date: '21/09/2026', trip: '1640', vessel: 'CSCL LONG BEACH', dwt: 111787, loa: 336.67, port: 'TCIT', service: 'mano_in', tugs: 3, customer: 'c5', invoice: 'c5', override: null, status: 'confirmed', note: '' },
    { stt: 119, sub: 1, date: '24/09/2026', trip: '1646', vessel: 'MAERSK BOSTON', dwt: 53634, loa: 293.85, port: 'GML', service: 'special', tugs: 2, customer: 'c4', invoice: 'c4', override: null, status: 'confirmed', note: 'Special job' },
    { stt: 120, sub: 1, date: '26/09/2026', trip: '1651', vessel: 'ZHENG RONG', dwt: 81729, loa: 229, port: 'CMIT', service: 'mano_out', tugs: 2, customer: 'c6', invoice: 'c6', override: null, status: 'confirmed', note: '' },
    { stt: 121, sub: 1, date: '28/09/2026', trip: '1655', vessel: 'PORT OSHIMA', dwt: 64624, loa: 199.99, port: 'CU LAO TAO', service: 'shifting', tugs: 1, customer: 'c7', invoice: 'c7', override: null, status: 'provisional', note: '' },
    { stt: 122, sub: 1, date: '30/09/2026', trip: '1660', vessel: 'ORIENTAL BREEZE', dwt: 43673, loa: 189.94, port: 'SSIT', service: 'standby_duty', tugs: 1, customer: 'c4', invoice: 'c4', override: null, status: 'provisional', note: 'On duty' },
    { stt: 123, sub: 1, date: '01/10/2026', trip: '1662', vessel: 'APOLLO DIGNITY', dwt: 13507, loa: 122.92, port: 'GML', service: 'mano_in', tugs: 2, customer: 'c1', invoice: 'c1', override: null, status: 'provisional', note: '' },
    { stt: 124, sub: 1, date: '01/10/2026', trip: '1663', vessel: 'MSC NEW YORK', dwt: 189190, loa: 399, port: 'SSIT', service: 'mano_in', tugs: 2, customer: 'c3', invoice: null, override: null, status: 'pending', note: 'Waiting for the agent to name the invoice company' },
    { stt: 125, sub: 1, date: '02/10/2026', trip: '1665', vessel: 'CMA CGM JULES VERNE', dwt: 186796, loa: 396, port: 'GML', service: 'mano_out', tugs: 3, customer: 'c1', invoice: 'c1', override: null, status: 'pending', note: '' },
    { stt: 126, sub: 1, date: '02/10/2026', trip: '1667', vessel: 'ONE FREEDOM', dwt: 155928, loa: 366, port: 'TCIT', service: 'mano_in', tugs: 2, customer: 'c4', invoice: 'c4', override: null, status: 'pending', note: '' }
  ],
  // A→P: [letter, key, label (English, on the app and as the Excel header)]. P · Agent: who ordered on the customer's behalf (EXPORT.md's AGENT column).
  ledgerColumns: [
    ['A', 'stt', 'No.'], ['B', 'date', 'Date'], ['C', 'vessel', 'Vessel'], ['D', 'dwt', 'DWT'], ['E', 'loa', 'LOA'],
    ['F', 'port', 'Port'], ['G', 'service', 'Service'], ['H', 'tugs', 'Tugs'], ['I', 'customer', 'Ordered by'],
    ['J', 'invoice', 'Invoice customer'], ['K', 'price', 'Unit price'], ['L', 'override', 'Override'],
    ['M', 'currency', 'Currency'], ['N', 'amount', 'Amount'], ['O', 'status', 'Billing status'],
    ['P', 'agent', 'Agent']
  ],
  billingStatus: {
    pending: { label: 'Pending', color: '#ea580c' },
    provisional: { label: 'Provisional', color: '#2563eb' },
    confirmed: { label: 'Confirmed', color: '#16a34a' },
    invoiced: { label: 'Invoiced', color: '#6b7280' }
  },

  // P4 · export files: made by hand, or by the daily cron (tickets DONE that day). Kept 24 months.
  ledgerFiles: [
    { name: 'ledger_2026-10-01_daily.xlsx', kind: 'cron', rows: 1, by: 'Daily job', at: '01/10/2026 23:59' },
    { name: 'ledger_2026-09-30_daily.xlsx', kind: 'cron', rows: 1, by: 'Daily job', at: '30/09/2026 23:59' },
    { name: 'ledger_2026-09.xlsx', kind: 'manual', rows: 13, by: 'Ms. Hanh', at: '30/09/2026 16:40' },
    { name: 'ledger_CMA_2026-09.xlsx', kind: 'manual', rows: 3, by: 'Ms. Hanh', at: '25/09/2026 09:10' },
    { name: 'ledger_2026-08-24_daily.xlsx', kind: 'cron', rows: 7, by: 'Daily job', at: '24/08/2026 23:59' },
    { name: 'ledger_2026-08-23_daily.xlsx', kind: 'cron', rows: 12, by: 'Daily job', at: '23/08/2026 23:59' },
    { name: 'ledger_CMA_2026-08.xlsx', kind: 'manual', rows: 31, by: 'Ms. Hanh', at: '22/08/2026 10:15' },
    { name: 'ledger_2026-08-22_daily.xlsx', kind: 'cron', rows: 7, by: 'Daily job', at: '22/08/2026 23:59' }
  ],

  // P5 · rules the admin writes in plain words; the AI reads ticket notes and proposes a split, never splits by itself.
  splitRules: [
    { id: 'r1', text: 'If the note says the invoice goes to two companies (e.g. "50% CGM"), split the line between them.', active: true },
    { id: 'r2', text: 'If the note names a different company after "Invoice to", invoice that company instead of the ordering customer.', active: true },
    { id: 'r3', text: 'Escort boats ordered by the pilot station are invoiced to the vessel owner.', active: false }
  ],
  splitProposals: [
    { id: 's1', stt: 104, rule: 'r1', text: 'Split No. 104 · MSC NEW YORK: half to CGM LOGISTICS', suggest: 'c2', status: 'pending', at: '24/08/2026 21:05' }
  ],

  // P6 · discounts by number of moves in the month (per customer), and what counts.
  discountTiers: [
    { id: 'd1', customer: 'c1', fromCount: 20, toCount: 39, percent: 3 },
    { id: 'd2', customer: 'c1', fromCount: 40, toCount: null, percent: 5 },
    { id: 'd3', customer: 'c3', fromCount: 30, toCount: null, percent: 4 }
  ],
  // Services counted toward a tier, and among them the ones counted but never charged.
  discountScope: { counted: ['mano_in', 'mano_out', 'shifting', 'standby_duty'], countOnly: ['standby_duty'] },
  // Moves in each month that the demo ledger rows above do not list (they are a sample), per customer.
  monthCounts: {
    '08/2026': { c1: 21, c3: 12, c4: 18 },
    '09/2026': { c1: 24, c3: 9, c4: 15 },
    '10/2026': { c1: 1 }
  },

  shippingLines: ['CMA', 'MSC', 'ONE', 'MAERSK', 'HMM', 'COSCO', 'EVERGREEN'],
  holdReasons: ['Vessel delayed', 'Waiting for pilot', 'Weather', 'Berth not ready', 'Customer request'],

  statusColors: {
    'Confirmed': '#4caf50',
    'Pending': '#ff9800',
    'New Update': '#2563eb',
    'Done': '#6c757d',
    'Not Valid': '#dc3545',
    'Cancelled': '#6c757d'
  },

  contacts: {
    hotline: { label: 'Hotline:\n+84983383838', zalo: 'HVS Hotline', whatsapp: 'HVS Hotline' },
    tugDuty: { label: 'Tug duty 24/7', zalo: 'Tug duty 24/7', whatsapp: 'Tug duty 24/7' },
    list: [
      { name: 'Mr. Pham Van Quang', tel: '+84903112233' },
      { name: 'Ms. Thuy Trang', tel: '+84908445566' },
      { name: 'Ms. Ha Giang', tel: '+84913778899' },
      { name: 'Mr Dan', tel: '+84918223344' },
      { name: 'Mr Phi', tel: '+84935667788' },
      { name: 'Tug Duty 24/7', tel: '+84983383839' }
    ],
    visible: 3
  },

  // Admin › System settings (A1). Hotline / tug duty numbers feed the Contact us tab.
  settings: { company: 'HVS Group', hotline: '+84983383838', tugDuty: '+84983383839', timezone: 'GMT+7 (Ho Chi Minh)', currency: 'VND', exportTime: '00:30', retention: 24, push: true },

  notifications: {
    unread: 3316,
    total: 3410,
    items: [
      { icon: '✏️', title: 'New update DERYOUNG SUNFLOWER', lines: ['Port: My Xuan A', 'POB in: Oct 1, 2026, 01:00 GMT+7'], time: '42m ago' },
      { icon: '📝', title: 'New order ARAYA BHUM', lines: ['Port: CMIT', 'POB in: Oct 1, 2026, 02:00 GMT+7', 'POB out: Oct 2, 2026, 05:00 GMT+7'], time: '44m ago' },
      { icon: '✏️', title: 'New update NEHIR', lines: ['Port: PHUOC AN', 'POB in: Sep 26, 2026, 16:30 GMT+7', 'POB out: Sep 30, 2026, 03:00 GMT+7'], time: '1h ago' },
      { icon: '✏️', title: 'New update NORDATLANTIC', lines: ['Port: CMIT', 'POB in: Sep 29, 2026, 06:30 GMT+7'], time: '1h ago' },
      { icon: '📝', title: 'New order A CHAU 16', lines: ['Port: Baria', 'POB in: Sep 30, 2026, 05:00 GMT+7', 'POB out: Oct 7, 2026, 00:00 GMT+7'], time: '4d ago' }
    ]
  },

  adminGroups: [
    { key: 'people', label: 'People & access' },
    { key: 'fleet', label: 'Fleet & ports' },
    { key: 'reports', label: 'Tickets & reports' },
    { key: 'board', label: 'Plan board' },
    { key: 'pricing', label: 'Pricing & ledger' },
    { key: 'system', label: 'System' }
  ],

  admin: [
    { route: 'admin/users', group: 'people', icon: '👥', title: 'User Management', sub: 'Manage users, roles, and permissions', color: '#1463ff', tile: '#e3e9fb' },
    { route: 'admin/vessels', group: 'fleet', icon: '🚢', title: 'Vessel Management', sub: 'Manage vessel master data', color: '#16a34a', tile: '#dcfce7' },
    { route: 'admin/ports', group: 'fleet', icon: '⚓', title: 'Port Management', sub: 'Manage port and berth data', color: '#ea580c', tile: '#ffedd5' },
    { route: 'admin/user-requests', group: 'people', icon: '📝', title: 'User Requests', sub: 'Review and approve access requests', color: '#dc2626', tile: '#fee2e2' },
    { route: 'admin/locations', group: 'fleet', icon: '📍', title: 'Location Management', sub: 'Manage tugboat home locations', color: '#9333ea', tile: '#f3e8ff' },
    { route: 'admin/contact-persons', group: 'people', icon: '👤', title: 'Contact Person Management', sub: 'Contact list clients see on the Contact us tab', color: '#0891b2', tile: '#cffafe' },
    { route: 'admin/stickers', group: 'reports', icon: '🖋️', title: 'Sticker Management', sub: 'Manage signatures and stamps for attachment editing', color: '#c2410c', tile: '#ffedd5' },
    { route: 'admin/tugboats', group: 'fleet', icon: '⛵', title: 'Tugboat Management', sub: 'Manage tugboat fleet and specifications', color: '#0e7490', tile: '#cffafe' },
    { route: 'admin/export-tickets', group: 'reports', icon: '📊', title: 'Export Tickets', sub: 'Generate ticket reports by date range', color: '#0f766e', tile: '#ccfbf1' },
    { route: 'admin/contact-stats', group: 'reports', icon: '📈', title: 'Contact Statistics', sub: 'Hotline / Zalo / WhatsApp click tracking', color: '#e11d48', tile: '#ffe4e6' },
    { route: 'admin/board-defaults', group: 'board', icon: '🗓️', title: 'Board Defaults', sub: 'Plan board columns: default, per role, user exceptions', color: '#4f46e5', tile: '#e0e7ff' },
    { route: 'admin/customers', group: 'pricing', icon: '🏢', title: 'Customers', sub: 'Who is invoiced: tax code, VAT, agents, client accounts', color: '#0f766e', tile: '#ccfbf1' },
    { route: 'admin/agents', group: 'pricing', icon: '🤝', title: 'Agents', sub: 'Who orders, and for which customers', color: '#7c3aed', tile: '#ede9fe' },
    { route: 'admin/tax-codes', group: 'pricing', icon: '🧾', title: 'Tax Codes', sub: 'One per customer; may be shared', color: '#b45309', tile: '#fef3c7' },
    { route: 'admin/price-table', group: 'pricing', icon: '💲', title: 'Price Table', sub: 'Customer × area/port × service × DWT × LOA', color: '#15803d', tile: '#dcfce7' },
    { route: 'admin/currencies', group: 'pricing', icon: '💱', title: 'Currencies & Rates', sub: 'Decimals per currency, daily exchange rates', color: '#0369a1', tile: '#e0f2fe' },
    { route: 'admin/split-rules', group: 'pricing', icon: '✨', title: 'AI Split Rules', sub: 'When the AI proposes splitting an invoice line', color: '#9333ea', tile: '#f3e8ff' },
    { route: 'admin/discounts', group: 'pricing', icon: '🏷️', title: 'Discounts', sub: 'Tiers by moves per month, and what counts', color: '#be123c', tile: '#ffe4e6' },
    { route: 'ledger', group: 'pricing', icon: '📒', title: 'Ledger', sub: 'Priced lines, sub-tickets, export', color: '#334155', tile: '#e2e8f0' },
    { route: 'admin/settings', group: 'system', icon: '⚙️', title: 'System Settings', sub: 'Company, contact numbers, time zone, exports', color: '#475569', tile: '#e2e8f0' },
    { route: 'admin/services', group: 'board', icon: '🧩', title: 'Service Types', sub: 'Services the board and ticket form render from', color: '#0369a1', tile: '#e0f2fe' }
  ],

  users: [
    { name: 'Tai Le Huy Nhat', role: 'CLIENT', email: 'lehuynhattai1998@gmail.com', phone: 'N/A', company: 'N/A', status: 'ACTIVE' },
    { name: 'Ngoc Quy Mai', role: 'CLIENT', email: 'ngocquy.engineer@gmail.com', phone: 'N/A', company: 'N/A', status: 'ACTIVE' },
    { name: 'NGUYEN THANH SANG', role: 'CLIENT', email: 'sangnt@gemadept.com.vn', phone: '+84975382001', company: 'PACIFIC MARINE CO; LTD', status: 'ACTIVE' },
    { name: 'Phuc client', role: 'CLIENT', email: 'phuc.client@inapps.net', phone: 'N/A', company: 'N/A', status: 'ACTIVE' },
    { name: 'Phat Dinh', role: 'CLIENT', email: 'phat.dinh@inapps.net', phone: '+84123456789', company: 'Viet Nam', status: 'ACTIVE' },
    { name: 'Mr. Khoa', role: 'MOD', email: 'khoa.mod@hvs.vn', phone: '0903 775 617', company: 'HVS', status: 'ACTIVE' },
    { name: 'Mr. Vinh', role: 'MOD', email: 'vinh.mod@hvs.vn', phone: '0912 448 201', company: 'HVS', status: 'ACTIVE' },
    { name: 'Ms. Lan', role: 'MOD', email: 'lan.mod@hvs.vn', phone: '0987 330 155', company: 'HVS', status: 'ACTIVE' },
    { name: 'Mr. Dung', role: 'MOD', email: 'dung.mod@hvs.vn', phone: '0938 601 774', company: 'HVS', status: 'ACTIVE' },
    { name: 'Captain Tung', role: 'CAPTAIN', email: 'tung.captain@hvs.vn', phone: 'N/A', company: 'HVS', status: 'ACTIVE' },
    { name: 'Ms. Hanh', role: 'HEAD_ACCOUNTANT', email: 'hanh.acc@hvs.vn', phone: 'N/A', company: 'HVS', status: 'ACTIVE' },
    { name: 'Ms. Thao', role: 'ACCOUNTANT', email: 'thao.acc@hvs.vn', phone: 'N/A', company: 'HVS', status: 'ACTIVE' },
    { name: 'Mr. Binh', role: 'SUPPORT_ACCOUNTANT', email: 'binh.acc@hvs.vn', phone: 'N/A', company: 'HVS', status: 'ACTIVE' },
    { name: 'Admin User', role: 'ADMIN', email: 'admin@hvs.vn', phone: 'N/A', company: 'HVS', status: 'ACTIVE' }
  ],
  roleColors: { CLIENT: '#4caf50', MOD: '#1e90ff', ADMIN: '#f44336', CAPTAIN: '#0e7490', HEAD_ACCOUNTANT: '#7c3aed', ACCOUNTANT: '#9333ea', SUPPORT_ACCOUNTANT: '#a855f7' },
  // One role per account (Phase 4). home = the first screen after sign-in; routes = route prefixes the role
  // may open (profile and notifications are open to everyone). The server checks the same rules.
  roles: [
    { key: 'ADMIN', label: 'Admin', sub: 'Everything: accounts, master data, status override', home: 'tickets', routes: ['*'] },
    { key: 'MOD', label: 'Mod', sub: 'Runs the plan board: confirm, assign, hold, POB, done', home: 'board', routes: ['tickets', 'board', 'history'] },
    { key: 'CAPTAIN', label: 'Captain', sub: 'Views the whole plan board, read only', home: 'board', routes: ['board'] },
    { key: 'CLIENT', label: 'Client', sub: 'Own tickets: create, edit, request cancellation', home: 'tickets', routes: ['tickets', 'history'] },
    { key: 'HEAD_ACCOUNTANT', label: 'Head accountant', sub: 'Ledger: pricing, sub-tickets, AI split approval, export', home: 'ledger', routes: ['ledger'] },
    { key: 'ACCOUNTANT', label: 'Accountant', sub: 'Ledger: pricing, sub-tickets, AI split approval, export', home: 'ledger', routes: ['ledger'] },
    { key: 'SUPPORT_ACCOUNTANT', label: 'Support accountant', sub: 'Ledger, read only (prices included), no export', home: 'ledger', routes: ['ledger'] }
  ],

  vessels: [
    { name: '0100', grt: '0.00', dwt: '4,998.10', loa: '94.25 m' },
    { name: '0830', grt: '0.00', dwt: '3,200.00', loa: '90.00 m' },
    { name: '1130', grt: '0.00', dwt: '3,200.00', loa: '90.00 m' },
    { name: 'abcd', grt: '0.00', dwt: '40,000.00', loa: '180.00 m' },
    { name: 'A CHAU 16', grt: '0.00', dwt: '3,000.00', loa: '79.80 m' },
    { name: 'ARAYA BHUM', grt: '0.00', dwt: '66,940.00', loa: '280.00 m' }
  ],

  ports: [
    { name: 'Baria', berth: 'Cai Mep/Phu My - Vung Tau' },
    { name: 'Bason', berth: 'Cai Mep/Phu My - Vung Tau' },
    { name: 'BP1', location: 'CTY CPDV VTB HAI VAN' },
    { name: 'BP10', location: 'CTY CPDV VTB HAI VAN' },
    { name: 'BP12', berth: 'GG BUOY' },
    { name: 'CMIT', berth: 'Cai Mep/Phu My - Vung Tau' },
    { name: 'My Xuan A', berth: 'Cai Mep/Phu My - Vung Tau' }
  ],

  userRequests: [
    { name: 'QA Request User 1780046037984', email: 'qarequest+1780046037984@hvs-autotest.com', phone: '+84901234567', company: 'QA Test Company', requested: 'May 29, 2026' },
    { name: 'QA Request User 1780045788229', email: 'qarequest+1780045788229@hvs-autotest.com', phone: '+84901234567', company: 'QA Test Company', requested: 'May 29, 2026' },
    { name: 'QA Request User 1780045773183', email: 'qarequest+1780045773183@hvs-autotest.com', phone: '+84901234567', company: 'QA Test Company', requested: 'May 29, 2026' }
  ],

  locations: [
    { name: 'VUNGTAU - HCM', order: 1 },
    { name: 'HAI PHONG', order: 2 },
    { name: 'VAN PHONG', order: 3 },
    { name: 'NGHI SON', order: 4 }
  ],

  contactPersons: [
    { name: 'Mr Dan', order: 1 },
    { name: 'Mr Minh', order: 2 },
    { name: 'Mr Vuong', order: 3 },
    { name: 'Ms Phuong', order: 4 },
    { name: 'Mr Phi', order: 5 }
  ],

  stickers: [
    { name: 'Phi', order: 1, img: 'assets/hvs/img/sticker-phi.png' },
    { name: 'Dan', order: 2, img: 'assets/hvs/img/sticker-dan.png' },
    { name: 'Vuong', order: 3, img: 'assets/hvs/img/sticker-vuong.png' },
    { name: 'Minh', order: 4, img: 'assets/hvs/img/sticker-minh.png' }
  ],

  tugboats: [
    { name: 'MIRAI 59.H1', code: 'H1', location: 'VUNGTAU - HCM', size: 'H', hp: '5,912 HP', length: '41.55', breadth: '10.40', draft: '4.09', bollard: '72.00', gt: '498.00', propeller: 'Azimuth', order: 1, img: 'assets/hvs/img/tugboat-mirai.jpg' },
    { name: 'HVS 30.S1', code: 'S1', location: 'VUNGTAU - HCM', size: 'S', hp: '3,000 HP', length: '22.57', breadth: '8.50', draft: '3.70', bollard: '', gt: '210.00', propeller: 'Azimuth', order: 2, img: '' }
  ],

  exportColumns: ['Ticket ID', 'Service Type', 'Owner', 'Vessel', 'GRT/DWT/LOA', 'Port/Berth', 'POB In', 'POB Out', 'Status', 'Tugboats', 'Tugboat Note', 'Contact', 'Request Details', 'Created At'],
  exportFiles: [
    { name: 'tickets_2026-06-01_2026-09-08.xlsx', size: '83.1 KB', by: 'Admin User', at: '08/09/2026 11:11 AM' },
    { name: 'tickets_2026-08-01_2026-08-31.xlsx', size: '44.7 KB', by: 'Admin User', at: '08/09/2026 9:59 AM' },
    { name: 'tickets_2026-07-01_2026-07-31.xlsx', size: '47.8 KB', by: 'Admin User', at: '10/08/2026 1:48 PM' },
    { name: 'tickets_2026-06-19_2026-07-19.xlsx', size: '47.0 KB', by: 'Admin User', at: '19/07/2026 3:30 PM' },
    { name: 'tickets_2026-06-01_2026-06-30.xlsx', size: '38.6 KB', by: 'Admin User', at: '06/07/2026 6:21 PM' },
    { name: 'tickets_2026-05-01_2026-05-31.xlsx', size: '41.2 KB', by: 'Admin User', at: '02/06/2026 9:05 AM' },
    { name: 'tickets_2026-04-01_2026-04-30.xlsx', size: '36.9 KB', by: 'Admin User', at: '04/05/2026 2:17 PM' },
    { name: 'tickets_2026-03-01_2026-03-31.xlsx', size: '33.4 KB', by: 'Admin User', at: '02/04/2026 10:40 AM' }
  ],

  stats: {
    from: '30/08/2026', to: '28/09/2026', note: 'Aggregated nightly. Data is complete up to 27/09.',
    total: 25, mobile: 24, web: 1, phone: 12, zalo: 9, whatsapp: 4,
    // [day, phone, zalo, whatsapp]
    days: [['30/08', 1, 0, 0], ['31/08', 0, 0, 0], ['01/09', 0, 0, 0], ['02/09', 0, 1, 0], ['03/09', 0, 0, 0], ['04/09', 0, 0, 0], ['05/09', 0, 0, 0],
      ['06/09', 1, 0, 0], ['07/09', 3, 4, 3], ['08/09', 0, 0, 0], ['09/09', 0, 1, 0], ['10/09', 0, 1, 0], ['11/09', 0, 0, 0], ['12/09', 0, 0, 0]]
  }
};
