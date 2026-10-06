// Buoys (Cầu phao) · batch 1: the Buoys tab of the ticket list, the client's buoy order, the ticket page with
// its stages (SPEC-2) and the month buoy board (SPEC-5). Source: Drive HVS_CauPhao, BRIEF-1 3.0.0, SPEC-1..5.
// Roles: the specs' Operator is MOD here; ADMIN can do every Operator step; only CLIENT orders a ticket.
// Documents (PDA/FDA/settlements), prices and the setup screens are later batches; their master data is
// seeded below and read only for now.
(window.HVS_EXT = window.HVS_EXT || []).push(function (api) {
  'use strict';

  var D = api.D;
  var esc = api.esc;
  var emoji = api.emoji;
  var I = api.I;

  var TODAY = '2026-10-02'; // demo today (the plan board's BOARD_TODAY)
  var role = function () { return api.user.role; };
  var isOps = function () { return /^(MOD|ADMIN)$/.test(role()); };
  var isClient = function () { return role() === 'CLIENT'; };
  var OPS = ['MOD', 'ADMIN'];

  // ---------- master data (SPEC-1): edited on Admin › Buoys (buoys-setup.js), kept in session storage ----------

  // Tariff charges (SPEC-3 T-03); a service type maps to one of them, or none.
  var CHARGES = {
    tug: 'Tug in & out', esc_ng3: 'Escort Nga 3 Go Gia', esc_p21: 'Escort Buoy 21', mooring: 'Mooring & unmooring',
    cano_com: 'Cano (commercial)', cano_pp: 'Cano (power plant)', buoy_due: 'Buoy due (per GRT per hour)'
  };
  var on = function (x) { return x.active !== false; };
  var MASTER_SEED = {
    areas: [
      { id: 'gg', name: 'Go Gia' },
      { id: 'tl', name: 'Thieng Lieng' },
      { id: 'vp', name: 'Van Phong' }
    ],
    // Limits are "strictly below" (R-04): a vessel fits only when its value is under the limit. owner = a company.
    buoys: [
      { code: 'BP10', name: 'Buoy 10', area: 'gg', owner: 'HVS', draft: 14.5, loa: 266, dwt: 150000 },
      { code: 'BP17', name: 'Buoy 17', area: 'gg', owner: 'LBMC', draft: 17.16, loa: 290, dwt: 150000 },
      { code: 'BP4', name: 'Buoy 4', area: 'gg', owner: 'HVS', draft: 15.9, loa: null, dwt: 150000 },
      { code: 'BP1', name: 'Buoy 1', area: 'gg', owner: 'HVS', draft: 15.2, loa: null, dwt: 150000 },
      { code: 'BP2-VNL', name: 'Buoy 2 (VNL)', area: 'gg', owner: 'VNL', draft: null, loa: null, dwt: 150000 },
      { code: 'TL10', name: 'Thieng Lieng 10', area: 'tl', owner: 'HVS', draft: 13.5, loa: null, dwt: 80000 },
      { code: 'TL11', name: 'Thieng Lieng 11', area: 'tl', owner: 'HVS', draft: 12.5, loa: null, dwt: 80000 },
      { code: 'BOT VP 1', name: 'Van Phong 1 power plant', area: 'vp', owner: 'BOT Van Phong Power', draft: null, loa: null, dwt: null }
    ],
    craneTypes: [{ name: 'Floating crane 1200T' }, { name: 'Floating crane 800T' }],
    cranes: [
      { name: 'FAN 1', type: 'Floating crane 1200T' },
      { name: 'FAN 2', type: 'Floating crane 1200T' },
      { name: 'LUCAS', type: 'Floating crane 800T' },
      { name: 'VT11-02', type: 'Floating crane 800T' }
    ],
    // Colour groups and the default colour (R-21): own colour, else group colour, else default.
    groups: [
      { name: 'LONG THUAN', color: '#fed7aa' },
      { name: 'THUAN HAI', color: '#bfdbfe' },
      { name: 'POWER PLANT', color: '#fecdd3' },
      { name: 'OTHER CUSTOMERS', color: '#bbf7d0' },
      { name: 'VEDAN', color: '#ddd6fe' }
    ],
    defaultColor: '#e2e8f0',
    owners: [
      { name: 'Thuan Hai Commodities', tax: '0316815023', address: 'District 1, Ho Chi Minh City', emails: ['ketoan@thuanhai.vn'], group: 'THUAN HAI', color: '#93c5fd' },
      { name: 'Thuan Minh', tax: '0317112204', address: 'Thu Duc, Ho Chi Minh City', emails: ['ketoan@thuanminh.vn', 'ops@thuanminh.vn'], group: 'THUAN HAI' },
      { name: 'Nang Luong Tan Thuan', tax: '0316552970', address: 'District 7, Ho Chi Minh City', emails: ['finance@nltt.vn'], group: 'THUAN HAI' },
      { name: 'Long Thuan Coal', tax: '3502298871', address: 'Vung Tau', emails: ['acc@longthuan.vn'], group: 'LONG THUAN' },
      { name: 'Viet Thuan Transport', tax: '5700562451', address: 'Ha Long, Quang Ninh', emails: ['ketoan@vietthuan.vn'], group: 'LONG THUAN' },
      { name: 'Duyen Hai 2 Power', tax: '2100563114', address: 'Duyen Hai, Tra Vinh', emails: ['tc@duyenhai2.vn'], group: 'POWER PLANT' },
      { name: 'Vedan Vietnam', tax: '3600239811', address: 'Long Thanh, Dong Nai', emails: ['ap@vedan.com.vn'], group: 'VEDAN' },
      { name: 'Meridian Foods', tax: '0310991456', address: 'District 4, Ho Chi Minh City', emails: ['finance@meridian.vn'], group: 'OTHER CUSTOMERS' },
      { name: 'Dong A Pellets', tax: '3901238874', address: 'Tay Ninh', emails: [], group: 'OTHER CUSTOMERS' },
      { name: 'Atta Steel', tax: '3502411209', address: 'Phu My, Ba Ria - Vung Tau', emails: ['acc@attasteel.vn'], group: 'OTHER CUSTOMERS' },
      { name: 'SEAL', tax: '0315771230', address: 'District 3, Ho Chi Minh City', emails: [] }
    ],
    // Each service type maps to one tariff charge, or none (SPEC-1 R-22); no quantities are logged.
    services: [
      { name: 'Tug', charge: 'tug' },
      { name: 'Escort Nga 3 Go Gia', charge: 'esc_ng3' },
      { name: 'Escort Buoy 21', charge: 'esc_p21' },
      { name: 'Mooring & unmooring', charge: 'mooring' },
      { name: 'Cano', charge: 'cano_com' },
      { name: 'Cano (power plant)', charge: 'cano_pp' },
      { name: 'Barge', charge: '' }
    ],
    cargoTypes: [{ name: 'Coal' }, { name: 'Bulk coal' }, { name: 'Rice' }, { name: 'Steel' }, { name: 'Wood pellets' }],
    // Companies: buoy owners and the tug provider, with the bank accounts printed on PDA/FDA (SPEC-1 R-19, R-24).
    companies: [
      { name: 'HVS', full: 'HAI VAN SHIPPING CORPORATION', tax: '0303422110', banks: [
        { beneficiary: 'HAI VAN SHIPPING CORPORATION', number: '0071001234567', currency: 'USD', bank: 'Vietcombank', branch: 'Ho Chi Minh City Branch', swift: 'BFTVVNVX007' },
        { beneficiary: 'CONG TY CP DICH VU VAN TAI BIEN HAI VAN', number: '0071000765432', currency: 'VND', bank: 'Vietcombank', branch: 'Ho Chi Minh City Branch', swift: '' }] },
      { name: 'LBMC', full: 'LONG BEACH MARINE SALVAGE CORPORATION', tax: '0305998123', banks: [
        { beneficiary: 'LONG BEACH MARINE SALVAGE CORPORATION', number: '2111126868', currency: 'USD', bank: 'Vietcombank', branch: 'Sai Gon South Branch', swift: 'BFTVVNVX018' }] },
      { name: 'VNL', full: 'VINALINES LOGISTICS', tax: '0101112223', banks: [] },
      { name: 'BOT Van Phong Power', full: 'BOT VAN PHONG 1 POWER COMPANY', tax: '4201778899', banks: [] }
    ],
    tugProvider: 'LBMC',
    emailFormat: 'Dear {agent},\n\nPlease find attached the {doc} for MV {vessel} at {buoy}.\nKindly review and confirm by reply.\n\nBest regards,\nHVS Buoys & Cargo Handling',
    // Buoys email setup per ship agent (the agents themselves are the shared towage list): addresses, own
    // format, extra info, and whether it confirms the mother vessel and alongside FDAs together (R-17, R-25).
    agentInfo: {
      'SEAC': { emails: ['ops@seac.com.vn', 'agency@seac.com.vn'], format: 'Kinh gui SEAC,\n\nHVS gui kem {doc} cho tau {vessel} tai {buoy}.\nVui long xac nhan qua email.\n\nTran trong,\nHVS', extra: 'Ops: ops@seac.com.vn · Mob/WhatsApp +84 903 724 229', together: false },
      'Viet Thuan Shipping': { emails: ['agency@vietthuan.vn'], format: '', extra: '', together: true },
      'Falcon Shipping': { emails: ['ops@falconship.vn'], format: '', extra: '', together: false }
    }
  };
  var M = api.store('buoyMaster', JSON.parse(JSON.stringify(MASTER_SEED)));
  M.methods = { floating: 'Floating crane', ship: "Ship's crane" };
  // A session saved before the 06/10 palette keeps the old sheet colours; move untouched ones to the new set.
  (function () {
    var OLD = { '#f9cb9c': '#fed7aa', '#a4c2f4': '#bfdbfe', '#ea9999': '#fecdd3', '#b6d7a8': '#bbf7d0', '#d5a6bd': '#ddd6fe', '#8fb8f0': '#93c5fd', '#d9d9d9': '#e2e8f0' };
    var fix = function (c) { return OLD[String(c || '').toLowerCase()] || c; };
    M.groups.forEach(function (g) { g.color = fix(g.color); });
    M.owners.forEach(function (o) { if (o.color) o.color = fix(o.color); });
    M.defaultColor = fix(M.defaultColor);
  })();
  var keepMaster = function () { api.save('buoyMaster', M); };

  // ---------- stages (SPEC-2): only MOD / ADMIN move a ticket, one step at a time, never automatically ----------

  var STAGES = [
    { k: 'noa', label: 'NOA entered', status: 'PENDING', next: 'Mark PDA sent' },
    { k: 'pda_sent', label: 'PDA sent', status: 'PENDING', next: 'Record PDA confirmation' },
    { k: 'pda_ok', label: 'PDA confirmed', status: 'CONFIRMED', next: 'Mark planned' },
    { k: 'planned', label: 'Planned', status: 'CONFIRMED', next: 'Start operation' },
    { k: 'in_op', label: 'In operation', status: 'CONFIRMED', next: 'Close operation' },
    { k: 'op_closed', label: 'Operation closed', status: 'CONFIRMED', next: 'Mark FDA sent' },
    { k: 'fda_sent', label: 'FDA sent', status: 'CONFIRMED', next: 'Record invoice' },
    { k: 'invoiced', label: 'Invoiced', status: 'CONFIRMED', next: 'Mark done' },
    { k: 'done', label: 'Done', status: 'DONE' }
  ];
  var STATUS_LABEL = { PENDING: 'Pending', CONFIRMED: 'Confirmed', NEW_UPDATE: 'New Update', DONE: 'Done', CANCELLED: 'Cancelled' };

  var stageIx = function (k) { for (var i = 0; i < STAGES.length; i++) if (STAGES[i].k === k) return i; return -1; };
  var stageOf = function (t) { return STAGES[stageIx(t.stage)] || STAGES[0]; };
  var cancelled = function (t) { return !!t.cancel; };
  // R-01: stage → status; the NEW_UPDATE flag is set and cleared by hand (any stage move clears it).
  var statusOf = function (t) { return cancelled(t) ? 'CANCELLED' : t.newUpdate ? 'NEW_UPDATE' : stageOf(t).status; };
  var stageLabel = function (t) { return cancelled(t) ? 'Cancelled' : stageOf(t).label; };
  var stageColor = function (t) { return D.statusColors[STATUS_LABEL[statusOf(t)]] || '#6c757d'; };
  // R-18 / R-05 / R-06: data changes stop at "FDA sent" (only the invoice fields stay open).
  var beforeFda = function (t) { return !cancelled(t) && stageIx(t.stage) < stageIx('fda_sent'); };
  // R-13: not yet accepted = NOA entered or PDA sent.
  var notAccepted = function (t) { return !cancelled(t) && stageIx(t.stage) <= stageIx('pda_sent'); };

  // ---------- demo tickets (sample vessels from the 09/2026 buoy schedule, SRC-7; today 02/10/2026) ----------

  function tk(o) {
    var base = {
      agent: '', dwt: null, grt: null, loa: null, draft: null, cargo: '', qty: null, eta: '', request: '', owners: [],
      crane: '', start: '', end: '', services: [], alongside: false, berthed: '', unberthed: '', bl: null, survey: null, sof: '',
      pricingDate: '', vat: null, invoiceNo: '', invoiceDate: '', cancel: null, newUpdate: false, pdaAt: '', pdaBy: '', log: []
    };
    Object.keys(o).forEach(function (k) { base[k] = o[k]; });
    return base;
  }
  var own = function (name, tons, method) { return { name: name, tons: tons == null ? null : tons, method: method || 'floating' }; };

  var SEED = [
    tk({ id: 'B2601', created: '2026-09-02T08:12', by: 'Viet Thuan Ops', port: 'BP10', vessel: 'VIET THUAN 56-06', agent: 'Viet Thuan Shipping', dwt: 55557, grt: 30651, loa: 189.9, draft: 12.4, cargo: 'Coal', qty: 55000, eta: '2026-09-10', owners: [own('Viet Thuan Transport', 55000)], crane: 'VT11-02', start: '2026-09-10', end: '2026-09-12', services: ['Tug', 'Mooring & unmooring'], alongside: true, berthed: '2026-09-10T09:00', unberthed: '2026-09-13T16:00', bl: 55000, survey: 54912.4, sof: 'SOF_VIET_THUAN_56-06.pdf', pricingDate: '2026-09-10', vat: 8, invoiceNo: '0000731', invoiceDate: '2026-09-25', stage: 'done', pdaAt: '2026-09-04T10:20', pdaBy: 'Ms. Lan' }),
    tk({ id: 'B2602', created: '2026-08-20T14:40', by: 'SEAC Ops', port: 'BP17', vessel: 'OCEAN CHANGXI', agent: 'SEAC', dwt: 88233, grt: 48025, loa: 229.9, draft: 14.2, cargo: 'Coal', qty: 86000, eta: '2026-08-28', owners: [own('Thuan Hai Commodities', 86000)], crane: 'FAN 1', start: '2026-08-28', end: '2026-09-03', services: ['Tug', 'Mooring & unmooring', 'Escort Nga 3 Go Gia'], berthed: '2026-08-28T10:00', unberthed: '2026-09-04T18:00', bl: 86000, survey: 85870, sof: 'SOF_OCEAN_CHANGXI.pdf', pricingDate: '2026-08-28', vat: 8, invoiceNo: '0000702', invoiceDate: '2026-09-12', stage: 'done', pdaAt: '2026-08-22T09:05', pdaBy: 'Mr. Dung' }),
    tk({ id: 'B2603', created: '2026-09-08T11:02', by: 'Viet Thuan Ops', port: 'BP17', vessel: 'VIET THUAN 80-03', agent: 'Viet Thuan Shipping', dwt: 74269, grt: 38732, loa: 225, draft: 13.9, cargo: 'Coal', qty: 74000, eta: '2026-09-18', owners: [own('Long Thuan Coal', 74000)], crane: 'LUCAS', start: '2026-09-18', end: '2026-09-20', services: ['Tug', 'Mooring & unmooring'], alongside: true, berthed: '2026-09-18T08:00', unberthed: '2026-09-21T12:00', bl: 74000, survey: 73950.12, sof: 'SOF_VIET_THUAN_80-03.pdf', pricingDate: '2026-09-18', vat: 8, invoiceNo: '0000748', invoiceDate: '2026-09-30', stage: 'invoiced', pdaAt: '2026-09-10T15:30', pdaBy: 'Ms. Lan' }),
    tk({ id: 'B2604', created: '2026-09-15T09:30', by: 'Phat Dinh', port: 'BP17', vessel: 'CATALINA', agent: 'SEAC', dwt: 74288, grt: 40636, loa: 225, draft: 14.0, cargo: 'Coal', qty: 72005, eta: '2026-09-28', owners: [own('Thuan Minh', 72005)], crane: 'FAN 2', start: '2026-09-28', end: '2026-10-03', services: ['Tug', 'Mooring & unmooring', 'Cano'], berthed: '2026-09-28T10:00', pricingDate: '2026-09-28', vat: 8, stage: 'in_op', pdaAt: '2026-09-17T08:45', pdaBy: 'Ms. Lan' }),
    tk({ id: 'B2605', created: '2026-09-10T16:05', by: 'Phat Dinh', port: 'BP10', vessel: 'WEI YE FU YUN', agent: 'SEAC', dwt: 73901, grt: 40230, loa: 225, draft: 14.075, cargo: 'Coal', qty: 72000, eta: '2026-09-23', request: 'Discharge 72,000 MT coal; arrange a suitable buoy upon arrival.', owners: [own('Thuan Hai Commodities', 40000), own('Nang Luong Tan Thuan', 32000, 'ship')], crane: 'FAN 1', start: '2026-09-23', end: '2026-09-29', services: ['Tug', 'Mooring & unmooring'], alongside: true, berthed: '2026-09-23T14:00', unberthed: '2026-09-29T14:00', bl: 72000, survey: 71850.235, sof: 'SOF_WEI_YE_FU_YUN.pdf', pricingDate: '2026-09-23', vat: 8, stage: 'fda_sent', pdaAt: '2026-09-12T10:00', pdaBy: 'Ms. Lan' }),
    tk({ id: 'B2606', created: '2026-09-20T10:15', by: 'Falcon Ops', port: 'BP10', vessel: 'CATHARINA OLDENDORFF', agent: 'Falcon Shipping', dwt: 95479, grt: 50689, loa: 235, draft: 14.3, cargo: 'Coal', qty: 88000, eta: '2026-09-30', owners: [own('Duyen Hai 2 Power', 88000)], crane: 'FAN 1', start: '2026-09-30', end: '2026-10-04', services: ['Tug', 'Mooring & unmooring', 'Escort Buoy 21'], berthed: '2026-09-30T15:00', pricingDate: '2026-09-30', vat: 8, stage: 'in_op', pdaAt: '2026-09-22T14:10', pdaBy: 'Mr. Dung' }),
    tk({ id: 'B2607', created: '2026-09-03T08:00', by: 'Falcon Ops', port: 'BP1', vessel: 'ANDREAS K', agent: 'Falcon Shipping', dwt: 56729, grt: 33044, loa: 189.9, draft: 11.8, cargo: 'Steel', qty: 8700, eta: '2026-09-11', owners: [own('Atta Steel', 8700, 'ship')], start: '2026-09-11', end: '2026-09-13', services: ['Tug', 'Mooring & unmooring'], berthed: '2026-09-11T07:00', unberthed: '2026-09-13T20:00', bl: 8700, survey: 8698.5, sof: 'SOF_ANDREAS_K.pdf', pricingDate: '2026-09-11', vat: 8, invoiceNo: '0000729', invoiceDate: '2026-09-22', stage: 'done', pdaAt: '2026-09-05T11:00', pdaBy: 'Mr. Dung' }),
    tk({ id: 'B2608', created: '2026-09-06T13:20', by: 'SEAC Ops', port: 'BP1', vessel: 'LMZ CERES', agent: 'SEAC', dwt: 75092, grt: 41074, loa: 225, draft: 14.1, cargo: 'Coal', qty: 72000, eta: '2026-09-15', owners: [own('Long Thuan Coal', 72000)], crane: 'FAN 1', start: '2026-09-15', end: '2026-09-20', services: ['Tug', 'Mooring & unmooring'], berthed: '2026-09-15T08:30', unberthed: '2026-09-20T22:00', bl: 72000, survey: 71920.6, sof: 'SOF_LMZ_CERES.pdf', pricingDate: '2026-09-15', vat: 8, stage: 'op_closed', pdaAt: '2026-09-08T09:40', pdaBy: 'Ms. Lan' }),
    tk({ id: 'B2609', created: '2026-09-12T10:10', by: 'SEAC Ops', port: 'BP1', vessel: 'TIGER SOUTH', agent: 'SEAC', dwt: 76255, grt: 42144, loa: 225, draft: 14.2, cargo: 'Coal', qty: 72000, eta: '2026-09-23', owners: [own('Vedan Vietnam', 72000)], crane: 'FAN 2', start: '2026-09-24', end: '2026-09-27', services: ['Tug', 'Mooring & unmooring'], berthed: '2026-09-24T06:00', unberthed: '2026-09-27T18:00', bl: 72000, survey: 71988, sof: 'SOF_TIGER_SOUTH.pdf', pricingDate: '2026-09-24', vat: 8, stage: 'fda_sent', pdaAt: '2026-09-14T16:20', pdaBy: 'Mr. Dung' }),
    tk({ id: 'B2610', created: '2026-09-26T09:00', by: 'Viet Thuan Ops', port: 'BP17', vessel: 'HONG BANG', agent: 'Viet Thuan Shipping', dwt: 74107, grt: 41500, loa: 225, draft: 14.1, cargo: 'Coal', qty: 70000, eta: '2026-10-05', owners: [own('Thuan Minh', 70000)], crane: 'FAN 2', start: '2026-10-05', end: '2026-10-09', services: ['Tug', 'Mooring & unmooring'], vat: 8, stage: 'pda_sent' }),
    tk({ id: 'B2611', created: '2026-09-24T15:45', by: 'SEAC Ops', port: 'BP4', vessel: 'STAR LYDIA', agent: 'SEAC', dwt: 63500, grt: 35800, loa: 199.9, draft: 13.2, cargo: 'Coal', qty: 60000, eta: '2026-10-07', owners: [own('Long Thuan Coal', 60000)], crane: 'LUCAS', start: '2026-10-07', end: '2026-10-11', services: ['Tug', 'Mooring & unmooring', 'Escort Buoy 21'], vat: 8, stage: 'planned', pdaAt: '2026-09-27T10:30', pdaBy: 'Ms. Lan' }),
    tk({ id: 'B2612', created: '2026-09-29T11:25', by: 'Falcon Ops', port: 'BP1', vessel: 'SEA HARMONY', agent: 'Falcon Shipping', dwt: 82000, grt: 44800, loa: 229, draft: 14.6, cargo: 'Coal', qty: 80000, eta: '2026-10-14', owners: [own('Duyen Hai 2 Power')], vat: 8, stage: 'pda_ok', pdaAt: '2026-10-01T15:00', pdaBy: 'Mr. Dung' }),
    tk({ id: 'B2613', created: '2026-10-02T08:05', by: 'Phat Dinh', port: 'BP10', vessel: 'OCEAN DREAM', stage: 'noa' }),
    tk({ id: 'B2614', created: '2026-09-25T09:50', by: 'SEAC Ops', port: 'BP17', vessel: 'GOLDEN ACE', agent: 'SEAC', dwt: 180000, grt: 92000, loa: 292, draft: 17.4, cargo: 'Coal', qty: 160000, eta: '2026-10-06', stage: 'pda_sent', cancel: { reason: 'Vessel refused: draft 17.4 m and LOA 292 m are over BP17 limits.', by: 'Ms. Lan', at: '2026-09-26T08:30' } }),
    tk({ id: 'B2615', created: '2026-08-25T10:00', by: 'Falcon Ops', port: 'TL10', vessel: 'CL XIANGTAN', agent: 'Falcon Shipping', dwt: 64726, grt: 36162, loa: 199.9, draft: 12.9, cargo: 'Rice', qty: 55000, eta: '2026-09-01', owners: [own('Meridian Foods', 55000, 'ship')], start: '2026-09-01', end: '2026-09-04', services: ['Tug', 'Mooring & unmooring'], berthed: '2026-09-01T08:00', unberthed: '2026-09-05T17:00', bl: 55000, survey: 54990, sof: 'SOF_CL_XIANGTAN.pdf', pricingDate: '2026-09-01', vat: 8, invoiceNo: '0000715', invoiceDate: '2026-09-15', stage: 'done', pdaAt: '2026-08-27T09:00', pdaBy: 'Mr. Dung' }),
    tk({ id: 'B2616', created: '2026-09-05T14:30', by: 'SEAC Ops', port: 'TL11', vessel: 'BELORIENT', agent: 'SEAC', dwt: 64263, grt: 36760, loa: 199.9, draft: 12.1, cargo: 'Wood pellets', qty: 50000, eta: '2026-09-14', owners: [own('Dong A Pellets', 50000, 'ship')], start: '2026-09-14', end: '2026-09-17', services: ['Tug', 'Mooring & unmooring'], berthed: '2026-09-14T09:00', unberthed: '2026-09-18T11:00', bl: 50000, survey: 49980, sof: 'SOF_BELORIENT.pdf', pricingDate: '2026-09-14', vat: 8, invoiceNo: '0000736', invoiceDate: '2026-09-26', stage: 'done', pdaAt: '2026-09-07T10:00', pdaBy: 'Ms. Lan' }),
    tk({ id: 'B2617', created: '2026-09-15T08:40', by: 'Falcon Ops', port: 'TL10', vessel: 'SSI ENDEAVOUR', agent: 'Falcon Shipping', dwt: 37910, grt: 23232, loa: 180, draft: 10.5, cargo: 'Steel', qty: 3700, eta: '2026-09-23', owners: [own('Atta Steel', 3700, 'ship')], start: '2026-09-23', end: '2026-09-25', services: ['Tug'], berthed: '2026-09-23T09:00', unberthed: '2026-09-25T15:00', bl: 3700, survey: 3699.2, sof: 'SOF_SSI_ENDEAVOUR.pdf', pricingDate: '2026-09-23', vat: 8, invoiceNo: '0000751', invoiceDate: '2026-10-01', stage: 'invoiced', pdaAt: '2026-09-17T13:15', pdaBy: 'Mr. Dung' }),
    tk({ id: 'B2618', created: '2026-09-30T16:20', by: 'Phat Dinh', port: 'TL11', vessel: 'CL YELLOW RIVER', agent: 'SEAC', dwt: 64000, grt: 35900, loa: 199.9, draft: 12.0, cargo: 'Rice', qty: 50000, eta: '2026-10-12', owners: [own('Meridian Foods')], vat: 8, stage: 'pda_sent' }),
    tk({ id: 'B2619', created: '2026-09-27T10:05', by: 'Viet Thuan Ops', port: 'TL10', vessel: 'PACIFIC GRACE', agent: 'Viet Thuan Shipping', dwt: 58000, grt: 32400, loa: 190, draft: 13.8, cargo: 'Rice', qty: 45000, eta: '2026-10-03', owners: [own('SEAL', 45000, 'ship')], start: '2026-10-03', end: '2026-10-06', services: ['Tug', 'Mooring & unmooring'], vat: 8, stage: 'planned', pdaAt: '2026-09-29T09:20', pdaBy: 'Mr. Dung' })
  ];
  // A short, believable history per ticket (who moved it, when).
  SEED.forEach(function (t) {
    t.log = [{ at: t.created, by: t.by, text: 'Ordered: ' + t.vessel + ' at ' + t.port }];
    if (t.pdaAt) t.log.push({ at: t.pdaAt, by: t.pdaBy, text: 'PDA confirmed by ' + (t.agent || 'the agent') });
    if (t.berthed) t.log.push({ at: t.berthed, by: t.pdaBy || 'Ms. Lan', text: 'Berthed · In operation' });
    if (t.unberthed) t.log.push({ at: t.unberthed, by: t.pdaBy || 'Ms. Lan', text: 'Unberthed · Operation closed' });
    if (t.invoiceNo) t.log.push({ at: t.invoiceDate + 'T09:00', by: t.pdaBy || 'Ms. Lan', text: 'Invoice ' + t.invoiceNo + ' recorded' });
    if (t.cancel) t.log.push({ at: t.cancel.at, by: t.cancel.by, text: 'Cancelled: ' + t.cancel.reason });
  });

  // Buoy-blocked periods (SPEC-5 R-07): grey on the board, a planning warning when a ticket overlaps one.
  var BLOCKS_SEED = [
    { id: 'k1', port: 'BP4', start: '2026-09-13', end: '2026-09-20', reason: 'Class survey' },
    { id: 'k2', port: 'BP10', start: '2026-09-14', end: '2026-09-16', reason: 'Waiting for equipment' },
    { id: 'k3', port: 'TL11', start: '2026-10-20', end: '2026-10-24', reason: 'Buoy maintenance' }
  ];

  var S = {
    tickets: api.store('buoyTickets', JSON.parse(JSON.stringify(SEED))),
    blocks: api.store('buoyBlocks', JSON.parse(JSON.stringify(BLOCKS_SEED))),
    kind: api.store('ticketKind', 'towage'),
    filter: 'All',
    month: TODAY.slice(0, 7)
  };
  var keep = function () { api.save('buoyTickets', S.tickets); };
  var keepBlocks = function () { api.save('buoyBlocks', S.blocks); };

  // ---------- helpers ----------

  var byCode = function (code) { return M.buoys.filter(function (b) { return b.code === code; })[0] || null; };
  var areaName = function (id) { var a = M.areas.filter(function (x) { return x.id === id; })[0]; return a ? a.name : ''; };
  // Buoy choices on a ticket: active buoys (SPEC-1 R-11), plus the one already picked.
  function buoyOptions(cur) {
    return M.buoys.filter(function (b) { return on(b) || b.code === cur; }).map(function (b) { return { value: b.code, label: b.code + ' · ' + b.name + ' (' + areaName(b.area) + ')' + (on(b) ? '' : ' · inactive') }; });
  }
  var areaOfPort = function (code) { var b = byCode(code); return b ? areaName(b.area) : ''; };
  var ownerRec = function (name) { return M.owners.filter(function (o) { return o.name === name; })[0] || { name: name }; };
  var groupRec = function (name) { return M.groups.filter(function (g) { return g.name === name; })[0] || null; };
  // R-21 / SPEC-5 R-05: own colour, else group colour, else the default.
  function ownerColor(name) {
    var o = ownerRec(name);
    var g = o.group && groupRec(o.group);
    return o.color || (g && g.color) || M.defaultColor;
  }
  var blockColor = function (t) { return t.owners.length ? ownerColor(t.owners[0].name) : M.defaultColor; };
  // The ship agents are the towage list (SPEC-1 R-15), as edited on Admin › Agents.
  function agents() {
    var list = api.store('agents', D.agents);
    D.agents.forEach(function (a) { if (!list.some(function (x) { return x.id === a.id; })) list = list.concat(a); });
    return list;
  }

  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  function fmtD(v) { var m = /^(\d{4})-(\d\d)-(\d\d)/.exec(v || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; }
  function fmtDT(v) { var m = /T(\d\d:\d\d)/.exec(v || ''); return v ? fmtD(v) + (m ? ' ' + m[1] : '') : ''; }
  var short = function (v) { return v ? fmtD(v).slice(0, 5) : ''; };
  var dayNo = function (v) { var m = /^(\d{4})-(\d\d)-(\d\d)/.exec(v || ''); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5 : null; };
  function fmtN(n, dec) {
    if (n == null || n === '') return '';
    return Number(n).toLocaleString('en-US', { maximumFractionDigits: dec == null ? 3 : dec });
  }
  function num(v) {
    var t = String(v == null ? '' : v).replace(/[\s,]/g, '');
    if (!t) return null;
    var n = Number(t);
    return isNaN(n) ? undefined : n;
  }
  var nowStamp = function () { var d = new Date(); return TODAY + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  var dash = api.dash;

  function visible() {
    if (isOps()) return S.tickets;
    var me = api.norm(D.demoClient);
    return S.tickets.filter(function (t) { return api.norm(t.by) === me; });
  }
  var byId = function (id) { return S.tickets.filter(function (t) { return t.id === id; })[0] || null; };
  function logIt(t, text) { t.log.push({ at: nowStamp(), by: api.user.name, text: text }); }
  function tell(t, title) {
    api.notify('⚓', title + ' ' + t.vessel, ['Ticket #' + t.id + ' · ' + t.port + ' (' + areaOfPort(t.port) + ')', 'Stage: ' + stageLabel(t)], OPS, 'by:' + t.by);
  }

  // The days a ticket occupies (SPEC-5 R-03): planned start→end; once berthed, berthing→unberthing (or today).
  function span(t) {
    if (cancelled(t)) return null;
    if (t.berthed) return { from: t.berthed.slice(0, 10), to: (t.unberthed || TODAY).slice(0, 10) };
    if (t.start && t.end) return { from: t.start, to: t.end };
    return null;
  }
  var overlaps = function (a, b) { return a && b && dayNo(a.from) <= dayNo(b.to) && dayNo(b.from) <= dayNo(a.to); };

  // Planning warnings (SPEC-2 R-05, SPEC-5 R-07): shown, never blocking.
  function planWarnings(t, v) {
    v = v || t;
    var out = [];
    var b = byCode(v.port);
    if (b) {
      var lim = function (val, max, label, unit) {
        if (val != null && max != null && val >= max) out.push(label + ' ' + fmtN(val) + unit + ' is not below ' + b.code + "'s limit (< " + fmtN(max) + unit + ')');
      };
      lim(t.draft, b.draft, 'Draft', ' m');
      lim(t.loa, b.loa, 'LOA', ' m');
      lim(t.dwt, b.dwt, 'DWT', ' t');
    }
    var mine = v.start && v.end ? { from: v.start, to: v.end } : null;
    if (mine) {
      S.tickets.forEach(function (o) {
        if (o.id === t.id || cancelled(o) || !(o.start && o.end)) return;
        var their = { from: o.start, to: o.end };
        if (!overlaps(mine, their)) return;
        if (o.port === v.port) out.push(v.port + ' is also planned for ' + o.vessel + ' (#' + o.id + ', ' + short(o.start) + '–' + short(o.end) + ')');
        if (v.crane && o.crane === v.crane) out.push(v.crane + ' is also on ' + o.vessel + ' (#' + o.id + ', ' + short(o.start) + '–' + short(o.end) + ')');
      });
      S.blocks.forEach(function (k) {
        if (k.port === v.port && overlaps(mine, { from: k.start, to: k.end })) out.push(v.port + ' is blocked ' + short(k.start) + '–' + short(k.end) + ': ' + k.reason);
      });
    }
    return out;
  }

  function stagePill(t) {
    return '<span class="by-stage" style="--c:' + stageColor(t) + '">' + esc(stageLabel(t)) + '</span>';
  }
  function ownersText(t) { return t.owners.map(function (o) { return o.name; }).join(', '); }

  // ---------- ticket list: Towage | Buoys (C-09: Buoys is the second tab) ----------

  api.kindTabs = function () {
    if (!api.allowed('buoys')) return '';
    return '<div class="kind-tabs" role="tablist">' + [['towage', 'Towage'], ['buoys', 'Buoys']].map(function (k) {
      return '<button type="button" role="tab" class="' + (S.kind === k[0] ? 'on' : '') + '" aria-selected="' + (S.kind === k[0]) + '" data-action="by-kind" data-arg="' + k[0] + '">' + k[1] + '</button>';
    }).join('') + '</div>';
  };
  api.actions['by-kind'] = function (el) {
    S.kind = el.dataset.arg;
    api.save('ticketKind', S.kind);
    api.render();
  };

  var FILTERS = {
    'All': function () { return true; },
    'Not yet accepted': notAccepted,
    'In progress': function (t) { var i = stageIx(t.stage); return !cancelled(t) && i >= stageIx('pda_ok') && i <= stageIx('op_closed'); },
    'Billing': function (t) { return !cancelled(t) && /^(fda_sent|invoiced)$/.test(t.stage); },
    'Done': function (t) { return !cancelled(t) && t.stage === 'done'; },
    'Cancelled': cancelled
  };
  api.actions['by-filter'] = function (el) { S.filter = el.dataset.arg; api.state.buoyTicketPage = 1; api.render(); };

  // Returns the Buoys list when that tab is on, else null (app.js then draws the towage list).
  api.kindView = function () {
    if (S.kind !== 'buoys' || !api.allowed('buoys')) return null;
    var mine = visible().slice().sort(function (a, b) { return b.created < a.created ? -1 : b.created > a.created ? 1 : 0; });
    var list = mine.filter(FILTERS[S.filter] || FILTERS.All);
    var count = function (f) { return mine.filter(FILTERS[f]).length; };
    var names = Object.keys(FILTERS);
    if (api.desk()) {
      return api.header({ logo: true }) + '<div class="page dt-page">' + api.kindTabs() + api.dataTable({
        source: S.tickets,
        list: list.filter(function (t) { return api.matches([t.id, t.vessel, t.port, t.agent, t.by, ownersText(t)].join(' ')); }),
        noun: 'ticket',
        perPage: 20,
        placeholder: 'Search ticket, vessel, buoy, agent or cargo owner...',
        empty: 'No buoy tickets match this filter',
        add: isClient() ? { action: 'by-new', label: 'New buoy order' } : null,
        go: function (t) { return 'buoys/t/' + t.id; },
        tools: '<div class="dt-chips">' + names.map(function (f) {
          return '<button class="' + (f === S.filter ? 'on' : '') + '" data-action="by-filter" data-arg="' + f + '">' + f + '<em>' + count(f) + '</em></button>';
        }).join('') + '</div>',
        cols: [
          { key: 'id', label: 'Ticket', sort: 'text', cell: function (t) { return '<b>#' + esc(t.id) + '</b>'; } },
          { key: 'stage', label: 'Stage', cell: function (t) { return stagePill(t) + (t.newUpdate ? ' ' + api.pill('New Update', D.statusColors['New Update']) : ''); } },
          { key: 'vessel', label: 'Vessel', sort: 'text', cls: 'clip', cell: function (t) { return '<b title="' + esc(t.vessel) + '">' + esc(t.vessel) + '</b>'; } },
          { key: 'port', label: 'Buoy', sort: 'text', cell: function (t) { return '<div class="dt-2l"><span>' + esc(t.port) + '</span><span class="dt-muted">' + esc(areaOfPort(t.port)) + '</span></div>'; } },
          { key: 'agent', label: 'Agent', sort: 'text', cell: function (t) { return dash(t.agent); } },
          { key: 'qty', label: 'Cargo', sort: 'number', cell: function (t) { return t.qty ? esc(fmtN(t.qty) + ' t ' + t.cargo) : dash(''); } },
          { key: 'owners', label: 'Cargo owners', cls: 'clip', cell: function (t) { return t.owners.length ? '<span title="' + esc(ownersText(t)) + '">' + ownerDots(t) + esc(ownersText(t)) + '</span>' : dash(''); } },
          { key: 'eta', label: 'ETA', sort: 'text', cell: function (t) { return dash(fmtD(t.eta)); } },
          { key: 'start', label: 'Planned / at buoy', cell: function (t) { var s = span(t); return s ? esc(short(s.from) + ' → ' + short(s.to)) : dash(''); } },
          { key: 'by', label: 'By', sort: 'text' }
        ]
      }) + '</div>';
    }
    // Same layout as the towage list: the white strip (Filters + chips), 20 cards a page, the pager.
    list = list.filter(function (t) {
      return Object.keys(TF).every(function (k) { return !TF[k] || api.norm(TF_FIELD[k](t)).indexOf(api.norm(TF[k])) >= 0; });
    });
    var nf = Object.keys(TF).filter(function (k) { return TF[k]; }).length;
    var st = api.state;
    st.buoyTicketPage = Math.min(st.buoyTicketPage || 1, Math.max(1, Math.ceil(list.length / 20)));
    var page = list.slice((st.buoyTicketPage - 1) * 20, st.buoyTicketPage * 20);
    return api.header({ logo: true }) + api.kindTabs() +
      '<div class="strip"><div class="strip-filters' + (nf ? ' on' : '') + '" data-action="by-filters">' + api.I.filter + 'Filters' + (nf ? ' · ' + nf : '') + '</div>' +
      '<div class="chips">' + names.map(function (f) {
        return '<button class="chip' + (f === S.filter ? ' on' : '') + '" data-action="by-filter" data-arg="' + f + '">' + f + '</button>';
      }).join('') + '</div></div>' +
      '<div class="tickets by-list">' + (page.length ? page.map(card).join('') : '<p class="by-empty">No buoy tickets here yet</p>') + '</div>' +
      (isClient() ? api.fab('by-new', '', 'right:28px;bottom:117px') : '') +
      api.pager(list.length, 20, st.buoyTicketPage, 'buoyTicket');
  };

  // Mobile Filters sheet of the Buoys tab (the towage one filters by user, port and files, which buoys don't have).
  var TF = {};
  var TF_FIELD = {
    vessel: function (t) { return t.vessel; },
    buoy: function (t) { return t.port + ' ' + areaOfPort(t.port); },
    agent: function (t) { return t.agent || ''; },
    owner: function (t) { return ownersText(t); }
  };
  api.actions['by-filters'] = function () {
    var field = function (k, label, ph) {
      return '<label class="field-label">' + label + '</label><input class="text-input" name="' + k + '" placeholder="' + ph + '" value="' + esc(TF[k] || '') + '" />';
    };
    api.openOverlay('<div class="mask light" data-action="close"></div><div class="bsheet"><div class="bsheet-head"><h3>Filters</h3>' +
      '<button data-action="close" aria-label="Close">' + api.I.close + '</button></div>' +
      field('vessel', 'Vessel', 'Filter by vessel name') + field('buoy', 'Buoy', 'Filter by buoy or area') +
      field('agent', 'Ship agent', 'Filter by agent') + field('owner', 'Cargo owner', 'Filter by cargo owner') +
      '<div class="bsheet-btns"><button class="clear" data-action="by-filters-clear">Clear all</button><button class="done" data-action="by-filters-apply">Done</button></div></div>', 'sheet', '#a8a8a8');
  };
  api.actions['by-filters-apply'] = function () {
    TF = {};
    document.querySelectorAll('.bsheet input[name]').forEach(function (i) { if (i.value.trim()) TF[i.name] = i.value.trim(); });
    api.state.buoyTicketPage = 1;
    api.closeOverlay(); api.render();
  };
  api.actions['by-filters-clear'] = function () { TF = {}; api.state.buoyTicketPage = 1; api.closeOverlay(); api.render(); };

  function ownerDots(t) {
    return t.owners.slice(0, 3).map(function (o) { return '<i class="by-dot" style="background:' + ownerColor(o.name) + '"></i>'; }).join('');
  }

  function card(t) {
    var s = span(t);
    var lines = [['🚢', t.vessel], ['⚓', t.port + ' · ' + areaOfPort(t.port)]];
    if (t.qty) lines.push(['📦', fmtN(t.qty) + ' t ' + t.cargo + (t.owners.length ? ' · ' + ownersText(t) : '')]);
    if (t.eta) lines.push(['📅', 'ETA: ' + fmtD(t.eta)]);
    if (s) lines.push(['🗓️', (t.berthed ? 'At buoy: ' : 'Planned: ') + fmtD(s.from) + ' → ' + fmtD(s.to)]);
    if (t.agent) lines.push(['🏢', 'Agent: ' + t.agent]);
    lines.push(['👤', 'By: ' + t.by]);
    return '<div class="card ticket" data-go="buoys/t/' + t.id + '">' +
      '<div class="ticket-top"><span class="ticket-no">#' + t.id + '</span><span class="ticket-tags"><span class="tag" style="background:' + stageColor(t) + '">' + esc(stageLabel(t)) + '</span></span></div>' +
      '<div class="ticket-meta">' + lines.map(function (l) { return '<div>' + emoji(l[0]) + esc(l[1]) + '</div>'; }).join('') + '</div>' +
      (t.cancel ? '<div class="ticket-note">' + esc(t.cancel.reason) + '</div>' : '') + '</div>';
  }

  // ---------- client order (C-07: only the client creates a ticket; it enters the buoy and the vessel) ----------

  api.actions['by-new'] = function () { api.go('buoys/new'); };

  function portOptions(cur) {
    return M.areas.filter(on).map(function (a) {
      var rows = M.buoys.filter(function (b) { return b.area === a.id && (on(b) || b.code === cur); });
      return '<optgroup label="' + esc(a.name) + '">' + rows.map(function (b) {
        return '<option value="' + esc(b.code) + '"' + (b.code === cur ? ' selected' : '') + '>' + esc(b.code + ' · ' + b.name) + '</option>';
      }).join('') + '</optgroup>';
    }).join('');
  }
  function vesselList() {
    var names = D.vessels.map(function (v) { return v.name; }).concat(S.tickets.map(function (t) { return t.vessel; }));
    return '<datalist id="by-vessels">' + names.filter(function (n, i) { return names.indexOf(n) === i; }).map(function (n) {
      return '<option value="' + esc(n) + '"></option>';
    }).join('') + '</datalist>';
  }

  api.views['buoys/new'] = function () {
    if (!isClient()) { setTimeout(function () { api.toast('Only a client orders a buoy ticket'); api.go('tickets'); }); return ''; }
    return api.header({ title: 'New Buoy Order' }) + '<div class="form-card by-order">' +
      '<form class="box" data-form="buoy-order">' +
      '<div class="box-title">Buoy order</div>' +
      '<div class="fld by-fld"><div class="fld-row"><span class="fld-label">1. Vessel<span class="req">*</span>:</span>' +
      '<input class="fld-input" name="vessel" list="by-vessels" autocomplete="off" placeholder="........................" /></div>' + vesselList() + '</div>' +
      '<div class="fld by-fld"><div class="fld-row"><span class="fld-label">2. Buoy<span class="req">*</span>:</span>' +
      '<select class="fld-input by-select" name="port"><option value="">Choose a buoy</option>' + portOptions('') + '</select></div></div>' +
      '<p class="by-hint">' + emoji('ℹ️') + 'HVS fills in the rest from your agent\'s NOA (cargo, quantity, ETA, ship particulars) and sends the PDA to your agent.</p>' +
      '<button class="submit" type="submit">Send Buoy Order</button></form></div>';
  };

  api.forms['buoy-order'] = function (form, v) {
    var bad = ['vessel', 'port'].filter(function (k) {
      var miss = !String(v[k] || '').trim();
      form.elements[k].closest('.fld').classList.toggle('invalid', miss);
      return miss;
    });
    if (bad.length) return api.toast('Vessel and buoy are required');
    var nextNo = S.tickets.reduce(function (m, t) { return Math.max(m, Number(t.id.slice(1)) || 0); }, 2600) + 1;
    var t = tk({ id: 'B' + nextNo, created: nowStamp(), by: D.demoClient, port: v.port, vessel: v.vessel.trim().toUpperCase(), stage: 'noa' });
    t.log = [{ at: t.created, by: t.by, text: 'Ordered: ' + t.vessel + ' at ' + t.port }];
    S.tickets.unshift(t);
    keep();
    tell(t, 'New buoy order');
    api.toast('Buoy order #' + t.id + ' sent');
    api.go('buoys/t/' + t.id);
  };

  // ---------- ticket page ----------

  api.views['buoys/t/:id'] = function (id) {
    var t = byId(id);
    if (!t || visible().indexOf(t) < 0) {
      setTimeout(function () { api.toast('Ticket #' + id + ' is not available'); api.go('tickets'); });
      return '';
    }
    S.kind = 'buoys';
    return api.header({ title: 'Buoy Ticket #' + t.id }) + '<div class="page by-page' + (api.desk() ? ' dt-page' : '') + '">' +
      head(t) + (isOps() ? opsBody(t) : clientBody(t)) + '</div>';
  };

  function head(t) {
    var i = stageIx(t.stage);
    var steps = STAGES.map(function (s, n) {
      var cls = cancelled(t) ? (n <= i ? 'past' : '') : n < i ? 'past' : n === i ? 'now' : '';
      return '<li class="' + cls + '"><i>' + (n < i || (n === i && t.stage === 'done') ? I.check : n + 1) + '</i><span>' + esc(s.label) + '</span></li>';
    }).join('');
    var nx = isOps() && !cancelled(t) && stageOf(t).next;
    var next = nx ? '<button class="pill-btn primary" data-action="by-next" data-arg="' + t.id + '">' + esc(nx) + '</button>' : '';
    var nu = '', stop = '';
    if (isOps() && !cancelled(t)) {
      if (stageIx(t.stage) >= stageIx('pda_ok') && stageIx(t.stage) <= stageIx('invoiced')) {
        nu = '<button class="pill-btn outline dark" data-action="by-nu" data-arg="' + t.id + '">' + (t.newUpdate ? 'Clear New Update' : 'Set New Update') + '</button>';
      }
      if (stageIx(t.stage) <= stageIx('planned')) stop = '<button class="pill-btn outline by-danger" data-action="by-cancel" data-arg="' + t.id + '">' + (api.desk() ? 'Cancel ticket' : 'Cancel') + '</button>';
    }
    if (isClient() && !cancelled(t) && t.stage === 'noa') stop = '<button class="pill-btn outline by-danger" data-action="by-cancel" data-arg="' + t.id + '">Cancel order</button>';
    var note = nx ? '<p class="by-note">Stages move only when you press the button: sending a PDA or FDA email never moves the ticket.</p>' : '';
    var phone = !api.desk();
    // A desktop: the stepper, then one button row (Cancel, New Update, next step). A phone has no stepper (the
    // stage is in the pill; scope #11 asks only that the Operator moves each stage): one row of small
    // pills, New Update and Cancel (outline) on the left, the next step on the right.
    var acts = phone ? nu + stop + next : stop + nu + next;
    return '<section class="by-head card">' +
      '<div class="by-head-top"><div class="by-head-id"><h2>' + esc(t.vessel) + '</h2><p>#' + esc(t.id) + ' · ' + esc(t.port) + ' · ' + esc(areaOfPort(t.port)) + ' · ordered ' + esc(fmtDT(t.created)) + ' by ' + esc(t.by) + '</p></div>' +
      '<div class="by-head-pills">' + stagePill(t) + (t.newUpdate ? api.pill('New Update', D.statusColors['New Update']) : '') + '</div></div>' +
      (t.cancel ? '<div class="by-banner cancel">' + emoji('⛔') + '<div><b>Cancelled at "' + esc(stageOf(t).label) + '"</b><span>' + esc(t.cancel.reason) + ' · ' + esc(t.cancel.by) + ', ' + esc(fmtDT(t.cancel.at)) + '</span></div></div>' : '') +
      (t.newUpdate ? '<div class="by-banner nu">' + emoji('✏️') + '<div><b>New Update</b><span>The client changed this order. Clear the flag once you have checked it; any stage move clears it too.</span></div></div>' : '') +
      (phone ? (acts ? '<div class="by-acts">' + acts + '</div>' : '') :
        '<ol class="by-steps' + (cancelled(t) ? ' off' : '') + '">' + steps + '</ol>' + (acts ? '<div class="by-acts">' + acts + '</div>' : '') + note) +
      '</section>';
  }

  // One section card: title, an Edit button when allowed, and label/value rows.
  function section(title, rows, edit, extra, cls) {
    return '<section class="card by-sec' + (cls ? ' ' + cls : '') + '"><div class="by-sec-h"><h3>' + esc(title) + '</h3>' + (edit || '') + '</div>' +
      (rows.length ? '<dl class="by-kv">' + rows.map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + (r[1] === '' || r[1] == null ? '<span class="dt-muted">-</span>' : r[1]) + '</dd>'; }).join('') + '</dl>' : '') +
      (extra || '') + '</section>';
  }
  var editBtn = function (action, id, label) { return '<button class="dt-btn" data-action="' + action + '" data-arg="' + id + '">' + (label || 'Edit') + '</button>'; };

  function clientBody(t) {
    var open = beforeFda(t);
    var s = span(t);
    return '<div class="by-grid">' + section('Your order', [
      ['Vessel', esc(t.vessel)], ['Buoy', esc(t.port + ' · ' + (byCode(t.port) || {}).name + ' (' + areaOfPort(t.port) + ')')],
      ['ETA', esc(fmtD(t.eta))], ['Ship agent', esc(t.agent)], [t.berthed ? 'At buoy' : 'Planned', s ? esc(fmtD(s.from) + ' → ' + fmtD(s.to)) : '']
    ], open ? editBtn('by-edit-order', t.id, 'Change buoy / vessel') : '',
    '<p class="by-hint">' + emoji('ℹ️') + 'Prices, the PDA and the FDA are handled by HVS and emailed to your ship agent; they are not shown here.' +
      (open && stageIx(t.stage) >= stageIx('pda_ok') ? ' A change now alerts the HVS operator.' : '') + '</p>') + '</div>';
  }

  function opsBody(t) {
    var open = beforeFda(t) && isOps();
    var b = byCode(t.port) || {};
    var hours = t.berthed && t.unberthed ? (new Date(t.unberthed) - new Date(t.berthed)) / 36e5 : null;
    var warn = planWarnings(t);
    var limits = [b.draft ? 'Draft < ' + b.draft + ' m' : '', b.loa ? 'LOA < ' + b.loa + ' m' : '', b.dwt ? 'DWT < ' + fmtN(b.dwt) : ''].filter(Boolean).join(' · ');

    var noa = section('NOA · vessel and cargo', [
      ['Ship agent', t.agent ? esc(t.agent) : '<span class="by-miss">Pick the agent before the PDA is sent</span>'],
      ['ETA', esc(fmtD(t.eta))], ['DWT', esc(fmtN(t.dwt))], ['GRT', esc(fmtN(t.grt))], ['LOA', t.loa ? esc(fmtN(t.loa) + ' m') : ''], ['Draft', t.draft ? esc(fmtN(t.draft) + ' m') : ''],
      ['Cargo', t.qty ? esc(fmtN(t.qty) + ' t ' + t.cargo) : esc(t.cargo)], ['Service request', esc(t.request)]
    ], open ? editBtn('by-edit-noa', t.id) : '');

    var ownersTbl = '<table class="by-tbl by-owners"><thead><tr><th>Cargo owner</th><th class="r">Tonnage</th><th>Crane method</th>' + (open ? '<th></th>' : '') + '</tr></thead><tbody>' +
      (t.owners.length ? t.owners.map(function (o, n) {
        return '<tr><td><i class="by-dot" style="background:' + ownerColor(o.name) + '"></i>' + esc(o.name) + (n === 0 ? ' <small class="dt-muted">· board colour</small>' : '') + '</td>' +
          '<td class="r">' + (o.tons == null ? '<span class="by-miss">not entered</span>' : esc(fmtN(o.tons) + ' t')) + '</td><td>' + esc(M.methods[o.method]) + '</td>' +
          (open ? '<td class="r"><button class="dt-btn" data-action="by-owner" data-arg="' + t.id + ':' + n + '">Edit</button> <button class="dt-btn danger" data-action="by-owner-del" data-arg="' + t.id + ':' + n + '">Remove</button></td>' : '') + '</tr>';
      }).join('') : '<tr><td colspan="4" class="dt-muted">No cargo owner yet</td></tr>') + '</tbody></table>' +
      '<p class="by-hint sm">Tonnages don\'t have to add up to the cargo quantity.</p>';
    var owners = section('Cargo owners', [], open ? editBtn('by-owner', t.id + ':new', 'Add owner') : '', ownersTbl);

    var plan = section('Planning', [
      ['Buoy', esc(t.port + ' · ' + (b.name || '')) + (limits ? '<small class="by-sub">' + esc(limits) + ' · owner ' + esc(b.owner) + '</small>' : '')],
      ['Crane', esc(t.crane)], ['Planned', t.start || t.end ? esc(fmtD(t.start) + ' → ' + fmtD(t.end)) : ''],
      ['Services', t.services.length ? t.services.map(function (s) { return '<span class="by-tag">' + esc(s) + '</span>'; }).join('') : ''],
      ['Vessel alongside', t.alongside ? '<b>Yes</b> · gets its own FDA' : 'No']
    ], open ? editBtn('by-edit-plan', t.id) : '',
    warn.length ? '<div class="by-warn">' + emoji('⚠️') + '<div><b>Planning warnings</b>' + warn.map(function (w) { return '<span>' + esc(w) + '</span>'; }).join('') + '<em>Warnings never block a save.</em></div></div>' : '');

    var opRows = [['Berthed', esc(fmtDT(t.berthed))], ['Unberthed', esc(fmtDT(t.unberthed))], ['Hours at buoy', hours ? esc(fmtN(hours, 1) + ' h') : ''],
      ['B/L quantity', t.bl != null ? esc(fmtN(t.bl) + ' t') : ''], ['Draft survey', t.survey != null ? esc(fmtN(t.survey) + ' t') : ''],
      ['SOF', t.sof ? '<span class="by-file">' + I.clip + esc(t.sof) + '</span>' : '']];
    var op = section('Operation', opRows, open && stageIx(t.stage) >= stageIx('planned') ? editBtn('by-edit-op', t.id) : '');

    var pricing = section('Pricing', [
      ['Pricing date', t.pricingDate ? esc(fmtD(t.pricingDate)) : (t.eta ? '<span class="dt-muted">not set · the PDA uses the ETA ' + esc(fmtD(t.eta)) + '</span>' : '')],
      ['VAT rate', t.vat != null ? esc(t.vat + ' %') : '']
    ], open ? editBtn('by-edit-price', t.id) : '');

    // PDA, FDA, alongside FDA and settlements (buoys-docs.js).
    var docs = api.buoyDocsCard ? api.buoyDocsCard(t, section) : '';

    var inv = stageIx(t.stage) >= stageIx('fda_sent') && !cancelled(t);
    var invoice = section('Invoice', [['Invoice number', esc(t.invoiceNo)], ['Invoice date', esc(fmtD(t.invoiceDate))]],
      inv && t.invoiceNo && isOps() ? editBtn('by-invoice', t.id, 'Correct') : '',
      '<p class="by-hint sm">The app records the invoice; it doesn\'t create one.</p>');

    var log = section('Activity', [], '', '<ul class="by-log">' + t.log.slice().reverse().map(function (l) {
      return '<li><b>' + esc(l.text) + '</b><span>' + esc(l.by) + ' · ' + esc(fmtDT(l.at)) + '</span></li>';
    }).join('') + '</ul>');

    return '<div class="by-grid">' + '<div class="by-col">' + noa + owners + plan + op + '</div>' +
      '<div class="by-col">' + pricing + docs + invoice + log + '</div></div>';
  }

  // ---------- ticket edits (MOD / ADMIN before "FDA sent"; the client: buoy and vessel only) ----------

  var arg = function (el) { return el.dataset.arg; };
  function opsTicket(id) {
    var t = byId(id);
    return t && isOps() && beforeFda(t) ? t : null;
  }
  function saved(t, text) { logIt(t, text); keep(); api.toast('Saved'); }
  var pos = function (v) { return v == null || v > 0; };

  // Ticket popups get one frame: a header (icon, title, which ticket, close), a scrolling body, a footer.
  // look: { icon, tone: 'blue' | 'green' | 'red', move: true shows "current stage → next stage" }
  function dress(wrap, t, look) {
    var form = wrap && wrap.querySelector('form.dialog');
    if (!form) return wrap;
    look = look || {};
    form.classList.add('by-dlg', 'tone-' + (look.tone || 'blue'));
    var h3 = form.querySelector('h3');
    var acts = form.querySelector('.actions');
    var body = document.createElement('div');
    body.className = 'by-dlg-b';
    Array.prototype.slice.call(form.children).forEach(function (n) {
      if (n === h3 || n === acts) return;
      if (n.classList.contains('dlg-text')) n.className = 'by-dlg-note';
      body.appendChild(n);
    });
    if (look.move) {
      var nx = STAGES[stageIx(t.stage) + 1];
      body.insertAdjacentHTML('afterbegin', '<div class="by-dlg-move"><span>' + esc(stageLabel(t)) + '</span>' + I.right + '<b>' + esc(nx.label) + '</b></div>');
    }
    var head = document.createElement('div');
    head.className = 'by-dlg-h';
    head.innerHTML = '<span class="by-dlg-ic">' + emoji(look.icon || '✏️') + '</span><div class="by-dlg-t"></div>' +
      '<button type="button" class="by-dlg-x" data-action="close" aria-label="Close">' + I.close + '</button>';
    head.querySelector('.by-dlg-t').appendChild(h3);
    head.querySelector('.by-dlg-t').insertAdjacentHTML('beforeend', '<p>' + esc(t.vessel) + ' · #' + esc(t.id) + ' · ' + esc(t.port) + '</p>');
    form.insertBefore(head, form.firstChild);
    form.insertBefore(body, acts);
    form.style.top = Math.max(24, (window.innerHeight - form.offsetHeight) / 2) + 'px';
    return wrap;
  }
  // A group title inside an edit dialog.
  var sec = function (title) { return { type: 'html', html: '<h4 class="by-dlg-sec">' + esc(title) + '</h4>' }; };

  api.actions['by-edit-order'] = function (el) {
    var t = byId(arg(el));
    if (!t || !beforeFda(t)) return;
    dress(api.editDialog({
      title: 'Change buoy / vessel',
      text: stageIx(t.stage) >= stageIx('pda_ok') ? 'The PDA is already confirmed: HVS is alerted about this change.' : '',
      values: { vessel: t.vessel, port: t.port },
      fields: [
        { name: 'vessel', label: 'Vessel', req: true },
        { name: 'port', label: 'Buoy', type: 'select', req: true, options: buoyOptions(t.port) }
      ],
      onSave: function (v) {
        var what = [];
        if (v.vessel.toUpperCase() !== t.vessel) what.push('vessel ' + t.vessel + ' → ' + v.vessel.toUpperCase());
        if (v.port !== t.port) what.push('buoy ' + t.port + ' → ' + v.port);
        if (!what.length) return;
        t.vessel = v.vessel.toUpperCase();
        t.port = v.port;
        saved(t, 'Client changed ' + what.join(', '));
        // SPEC-2 R-17: every client edit notifies MOD / ADMIN; the stage and status don't change.
        tell(t, 'Client changed');
      }
    }), t, { icon: '🚢' });
  };

  api.actions['by-edit-noa'] = function (el) {
    var t = opsTicket(arg(el));
    if (!t) return;
    dress(api.editDialog({
      title: 'NOA · vessel and cargo',
      values: { agent: t.agent, eta: t.eta, dwt: fmtN(t.dwt), grt: fmtN(t.grt), loa: t.loa, draft: t.draft, cargo: t.cargo, qty: t.qty, request: t.request },
      fields: [
        sec('Agent and arrival'),
        { name: 'agent', label: 'Ship agent (one per ticket)', type: 'select', half: true, options: [{ value: '', label: 'Not picked yet' }].concat(agents().map(function (a) { return { value: a.name, label: a.name }; })) },
        { name: 'eta', label: 'ETA', type: 'date', half: true },
        sec('Cargo'),
        { name: 'cargo', label: 'Cargo', type: 'select', half: true, options: [{ value: '', label: '—' }].concat(M.cargoTypes.filter(function (c) { return on(c) || c.name === t.cargo; }).map(function (c) { return { value: c.name, label: c.name }; })) },
        { name: 'qty', label: 'Quantity (t)', type: 'number', half: true },
        sec('Vessel particulars'),
        { name: 'dwt', label: 'DWT (t)', type: 'number', half: true, cls: 'q' },
        { name: 'grt', label: 'GRT', type: 'number', half: true, cls: 'q' },
        { name: 'loa', label: 'LOA (m)', type: 'number', half: true, cls: 'q' },
        { name: 'draft', label: 'Draft (m)', type: 'number', half: true, cls: 'q' },
        sec('Request'),
        { name: 'request', label: 'Service request', type: 'textarea', placeholder: 'What the agent asked for' }
      ],
      onSave: function (v) {
        var n = { qty: num(v.qty), dwt: num(v.dwt), grt: num(v.grt), loa: num(v.loa), draft: num(v.draft) };
        var bad = Object.keys(n).filter(function (k) { return n[k] === undefined || !pos(n[k]); });
        if (bad.length) return { error: 'Numbers must be above 0: ' + bad.join(', ') };
        if (!v.agent && stageIx(t.stage) >= stageIx('pda_sent')) return { error: 'The ship agent is required once the PDA is sent' };
        Object.keys(n).forEach(function (k) { t[k] = n[k]; });
        t.agent = v.agent; t.eta = v.eta; t.cargo = v.cargo; t.request = v.request;
        saved(t, 'NOA data updated');
      }
    }), t, { icon: '📋' });
  };

  api.actions['by-owner'] = function (el) {
    var p = arg(el).split(':');
    var t = opsTicket(p[0]);
    if (!t) return;
    var isNew = p[1] === 'new';
    var o = isNew ? { name: '', tons: null, method: t.crane ? 'floating' : 'ship' } : t.owners[Number(p[1])];
    var taken = t.owners.filter(function (x) { return x !== o; }).map(function (x) { return x.name; });
    dress(api.editDialog({
      title: isNew ? 'Add cargo owner' : 'Cargo owner',
      text: isNew && t.crane ? 'A crane unit is assigned, so the method starts as floating crane.' : '',
      values: { name: o.name, tons: o.tons == null ? '' : o.tons, method: o.method },
      fields: [
        { name: 'name', label: 'Cargo owner', type: 'one', req: true, options: M.owners.filter(function (x) { return taken.indexOf(x.name) < 0 && (on(x) || x.name === o.name); }).map(function (x) { return { value: x.name, label: x.name, sub: x.group || 'No colour group' }; }) },
        { name: 'tons', label: 'Tonnage (t)', type: 'number', half: true, hint: 'Can be entered later' },
        { name: 'method', label: 'Crane method', type: 'select', half: true, options: [{ value: 'floating', label: M.methods.floating }, { value: 'ship', label: M.methods.ship }] }
      ],
      onSave: function (v) {
        var tons = num(v.tons);
        if (tons === undefined || (tons != null && tons <= 0)) return { error: 'Tonnage must be above 0 (or left empty)' };
        var rec = { name: v.name, tons: tons, method: v.method };
        if (isNew) t.owners.push(rec); else t.owners[Number(p[1])] = rec;
        saved(t, (isNew ? 'Cargo owner added: ' : 'Cargo owner updated: ') + v.name);
      }
    }), t, { icon: '📦' });
  };
  api.actions['by-owner-del'] = function (el) {
    var p = arg(el).split(':');
    var t = opsTicket(p[0]);
    if (!t) return;
    var o = t.owners[Number(p[1])];
    dress(api.confirmDialog('Remove ' + o.name + '?', 'It is taken off this ticket only.', 'Remove', function () {
      t.owners.splice(Number(p[1]), 1);
      saved(t, 'Cargo owner removed: ' + o.name);
      api.render();
    }), t, { icon: '🗑️', tone: 'red' });
  };

  api.actions['by-edit-plan'] = function (el) {
    var t = opsTicket(arg(el));
    if (!t) return;
    dress(api.editDialog({
      title: 'Planning',
      text: 'Over-limit vessels, double bookings and blocked buoys give a warning; you can still save.',
      values: { port: t.port, crane: t.crane, start: t.start, end: t.end, services: t.services.slice(), alongside: t.alongside },
      fields: [
        sec('Buoy and crane'),
        { name: 'port', label: 'Buoy', type: 'select', half: true, options: buoyOptions(t.port) },
        { name: 'crane', label: 'Crane unit', type: 'select', half: true, options: [{ value: '', label: 'None' }].concat(M.cranes.filter(function (c) { return on(c) || c.name === t.crane; }).map(function (c) { return { value: c.name, label: c.name + ' · ' + c.type }; })) },
        sec('Schedule'),
        { name: 'start', label: 'Planned start', type: 'date', half: true },
        { name: 'end', label: 'Planned end', type: 'date', half: true },
        sec('Services'),
        { name: 'services', label: 'Services used', type: 'multi', options: M.services.filter(function (s) { return on(s) || t.services.indexOf(s.name) >= 0; }).map(function (s) { return { value: s.name, label: s.name, sub: s.charge ? 'Priced as ' + CHARGES[s.charge] : 'No tariff charge' }; }) },
        { name: 'alongside', label: 'Vessel alongside (gets its own FDA)', type: 'checkbox' }
      ],
      onSave: function (v, force) {
        if (v.start && v.end && dayNo(v.end) < dayNo(v.start)) return { error: 'The planned end is before the start' };
        if (t.alongside && !v.alongside && api.buoyAlongFinal && api.buoyAlongFinal(t)) return { error: 'The alongside FDA is finished: correct it before turning the flag off' };
        var w = planWarnings(t, v);
        if (w.length && !force) return { warn: w.join(' · ') };
        // SPEC-2 R-19: with a crane unit assigned, a newly added owner's method starts as floating crane (by-owner).
        t.port = v.port; t.crane = v.crane; t.start = v.start; t.end = v.end; t.services = v.services; t.alongside = v.alongside;
        saved(t, 'Planning updated' + (w.length ? ' (saved with ' + w.length + ' warning' + (w.length > 1 ? 's' : '') + ')' : ''));
      }
    }), t, { icon: '🗓️' });
  };

  function opDialog(t, title, closing, done, look) {
    var wrap = dress(api.editDialog({
      title: title, okLabel: look ? title : 'Save',
      values: { berthed: t.berthed, unberthed: t.unberthed, bl: t.bl == null ? '' : t.bl, survey: t.survey == null ? '' : t.survey, sof: t.sof },
      fields: [
        sec('Berthing'),
        { name: 'berthed', label: 'Berthed', type: 'datetime', half: true, req: true },
        { name: 'unberthed', label: 'Unberthed', type: 'datetime', half: true, req: closing },
        sec('Quantities'),
        { name: 'bl', label: 'B/L quantity (t)', type: 'number', half: true },
        { name: 'survey', label: 'Draft survey (t)', type: 'number', half: true },
        sec('Statement of facts'),
        { name: 'sof', label: 'SOF file', placeholder: 'No file yet', cls: 'by-sof' },
        { name: 'sofPick', type: 'html', cls: 'by-sof-btn', html: '<label class="dt-btn by-sof-pick">' + I.clip + 'Attach SOF<input type="file" accept=".pdf,.jpg,.jpeg,.png" hidden data-sof-pick /></label>' }
      ],
      onSave: function (v) {
        if (v.unberthed && v.berthed && v.unberthed <= v.berthed) return { error: 'Unberthing must be after berthing' };
        var bl = num(v.bl), sv = num(v.survey);
        if (bl === undefined || sv === undefined || !pos(bl) || !pos(sv)) return { error: 'Quantities must be above 0' };
        t.berthed = v.berthed; t.unberthed = v.unberthed; t.bl = bl; t.survey = sv; t.sof = v.sof;
        done();
      }
    }), t, look || { icon: '⚓' });
    var pick = wrap.querySelector('[data-sof-pick]');
    pick.addEventListener('change', function () {
      if (pick.files[0]) wrap.querySelector('[name=sof]').value = pick.files[0].name;
    });
  }
  api.actions['by-edit-op'] = function (el) {
    var t = opsTicket(arg(el));
    if (t) opDialog(t, 'Operation records', false, function () { saved(t, 'Operation records updated'); });
  };

  api.actions['by-edit-price'] = function (el) {
    var t = opsTicket(arg(el));
    if (!t) return;
    dress(api.editDialog({
      title: 'Pricing',
      text: 'The pricing date picks the prices in force that day; until it is set the PDA uses the ETA.',
      values: { pricingDate: t.pricingDate, vat: t.vat == null ? '' : t.vat },
      fields: [
        { name: 'pricingDate', label: 'Pricing date', type: 'date', half: true },
        { name: 'vat', label: 'VAT rate (%)', type: 'number', half: true }
      ],
      onSave: function (v) {
        var vat = num(v.vat);
        if (vat === undefined || (vat != null && (vat < 0 || vat > 100))) return { error: 'VAT is a percentage from 0 to 100' };
        t.pricingDate = v.pricingDate; t.vat = vat;
        saved(t, 'Pricing date / VAT updated');
      }
    }), t, { icon: '💰' });
  };

  function invoiceDialog(t, title, done, look) {
    dress(api.editDialog({
      title: title, okLabel: look ? title : 'Save',
      values: { invoiceNo: t.invoiceNo, invoiceDate: t.invoiceDate || TODAY },
      fields: [
        { name: 'invoiceNo', label: 'Invoice number', req: true, half: true },
        { name: 'invoiceDate', label: 'Invoice date', type: 'date', req: true, half: true }
      ],
      onSave: function (v) { t.invoiceNo = v.invoiceNo; t.invoiceDate = v.invoiceDate; done(); }
    }), t, look || { icon: '🧾' });
  }
  api.actions['by-invoice'] = function (el) {
    var t = byId(arg(el));
    if (t && isOps()) invoiceDialog(t, 'Correct invoice', function () { saved(t, 'Invoice corrected: ' + t.invoiceNo); });
  };

  // ---------- stage moves ----------

  function move(t, text) {
    var from = stageLabel(t);
    t.stage = STAGES[stageIx(t.stage) + 1].k;
    t.newUpdate = false; // any stage move clears the flag (R-01)
    logIt(t, text || from + ' → ' + stageLabel(t));
    keep();
    tell(t, stageLabel(t) + ':');
    api.toast(stageLabel(t));
    api.render();
  }

  // A stage move's popup: green, with "current stage → next stage" on top.
  var step = function (icon) { return { icon: icon, tone: 'green', move: true }; };

  api.actions['by-next'] = function (el) {
    var t = byId(arg(el));
    if (!t || !isOps() || cancelled(t)) return;
    var k = t.stage;
    var ask = function (title, text, ok, fn, icon) { return dress(api.confirmDialog(title, text, ok, fn, true), t, step(icon)); };
    if (k === 'noa') {
      if (!t.agent) { api.toast('Pick the ship agent first'); return api.actions['by-edit-noa'](el); }
      return ask('Mark PDA sent?', 'Do this once the PDA has gone to ' + t.agent + '. Emailing it from the app does not move the ticket.', 'Mark PDA sent', function () { move(t); }, '📤');
    }
    if (k === 'pda_sent') {
      return ask('Record PDA confirmation', t.agent + ' confirmed the PDA. Recorded as ' + api.user.name + ', now. Nothing is deployed before this.', 'Record confirmation', function () {
        t.pdaAt = nowStamp(); t.pdaBy = api.user.name;
        move(t, 'PDA confirmed by ' + t.agent);
      }, '✅');
    }
    if (k === 'pda_ok') {
      var w = planWarnings(t);
      var gaps = [!t.start || !t.end ? 'no planned dates' : '', !t.crane ? 'no crane unit' : ''].filter(Boolean);
      return ask('Mark planned?', (gaps.length ? 'Note: ' + gaps.join(', ') + '. ' : '') + (w.length ? w.length + ' planning warning' + (w.length > 1 ? 's' : '') + ' (see Planning). ' : '') + 'You can still change the plan until the FDA is sent.', 'Mark planned', function () { move(t); }, '🗓️');
    }
    if (k === 'planned') {
      return dress(api.editDialog({
        title: 'Start operation', text: 'Record when ' + t.vessel + ' berthed at ' + t.port + '.',
        okLabel: 'Start operation',
        values: { berthed: t.berthed || TODAY + 'T08:00' },
        fields: [{ name: 'berthed', label: 'Berthed', type: 'datetime', req: true }],
        onSave: function (v) { t.berthed = v.berthed; setTimeout(function () { move(t, 'Berthed ' + fmtDT(v.berthed) + ' · In operation'); }); }
      }), t, step('⚓'));
    }
    if (k === 'in_op') return opDialog(t, 'Close operation', true, function () { setTimeout(function () { move(t, 'Unberthed ' + fmtDT(t.unberthed) + ' · Operation closed'); }); }, step('🏁'));
    if (k === 'op_closed') {
      return ask('Mark FDA sent?', 'Do this once the FDA' + (t.alongside ? 's (mother vessel and alongside)' : '') + ' and the settlements have been sent. From here only the invoice can change.', 'Mark FDA sent', function () { move(t); }, '📨');
    }
    if (k === 'fda_sent') return invoiceDialog(t, 'Record invoice', function () { setTimeout(function () { move(t, 'Invoice ' + t.invoiceNo + ' recorded'); }); }, step('🧾'));
    if (k === 'invoiced') return ask('Mark done?', 'Closes the job. A done ticket is read only, except its invoice number and date.', 'Mark done', function () { move(t); }, '🎉');
  };

  api.actions['by-nu'] = function (el) {
    var t = byId(arg(el));
    if (!t || !isOps()) return;
    t.newUpdate = !t.newUpdate;
    saved(t, t.newUpdate ? 'New Update set' : 'New Update cleared');
    api.render();
  };

  // R-10: MOD / ADMIN up to "Planned" with a reason; the client only at "NOA entered".
  api.actions['by-cancel'] = function (el) {
    var t = byId(arg(el));
    if (!t || cancelled(t)) return;
    var ok = isOps() ? stageIx(t.stage) <= stageIx('planned') : isClient() && t.stage === 'noa';
    if (!ok) return api.toast('This ticket can no longer be cancelled');
    dress(api.reasonDialog(isClient() ? 'Cancel this order?' : 'Cancel ticket', isClient() ? '' : 'A refused vessel is cancelled this way. A cancelled ticket cannot be reopened.',
      'Reason', isClient() ? 'Why are you cancelling?' : 'e.g. Vessel refused: buoy not available', isClient() ? 'Cancel order' : 'Cancel ticket', function (reason) {
        t.cancel = { reason: reason, by: api.user.name, at: nowStamp() };
        t.newUpdate = false;
        logIt(t, 'Cancelled: ' + reason);
        keep();
        tell(t, 'Cancelled');
        api.toast('Ticket cancelled');
        api.render();
      }), t, { icon: '⛔', tone: 'red' });
  };

  // ---------- buoy board (SPEC-5; MOD / ADMIN, desktop only) ----------

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Same look as the Plan Board: its toolbar (.bbar / .bdate / .blegend, shared CSS) and its Excel skin
  // (Calibri 10pt, grey header, 1px column lines, dotted row lines, cyan section labels, tinted bands).
  var AREA_TINT = { gg: '#f5f8ff', tl: '#f2fbfe', vp: '#f4fbf7' };
  var LEFT_DESK = [['No.', 34, 'bb-c0'], ['BUOY', 92, 'bb-c1'], ['DRAFT <', 58, 'bb-c2'], ['LOA <', 58, 'bb-c3'], ['MAX DWT', 70, 'bb-c4'], ['', 70, 'bb-c5']];
  var LEFT_PHONE = [['BUOY', 84, 'bb-c1'], ['', 50, 'bb-c5']];

  api.views['buoy-board'] = function () {
    // A phone gets the same board, narrower: the frozen block is BUOY + row label, the days scroll sideways.
    var phone = !api.desk();
    var LEFT = phone ? LEFT_PHONE : LEFT_DESK;
    var DAY_W = phone ? 40 : 44;
    var at = [];
    LEFT.reduce(function (x, c) { at.push(x); return x + c[1]; }, 0);
    var leftW = at[at.length - 1] + LEFT[LEFT.length - 1][1];
    var stick = function (i) { return ' style="left:' + at[i] + 'px"'; };
    var labAt = LEFT.length - 1;
    var y = Number(S.month.slice(0, 4)), mo = Number(S.month.slice(5, 7));
    var days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    var first = S.month + '-01', last = S.month + '-' + pad(days);
    var mStart = dayNo(first), mEnd = dayNo(last);
    var todayCol = TODAY.slice(0, 7) === S.month ? Number(TODAY.slice(8)) : 0;
    var cols = LEFT.length + days;
    var wd = function (d) { return new Date(Date.UTC(y, mo - 1, d)).getUTCDay(); };
    var dcls = function (d) { return (wd(d) === 0 ? ' sun' : '') + (d === todayCol ? ' today' : ''); };
    var clip = function (s) {
      var a = Math.max(dayNo(s.from), mStart), b = Math.min(dayNo(s.to), mEnd);
      return a > b ? null : { a: a - mStart + 1, b: b - mStart + 1, cutL: dayNo(s.from) < mStart, cutR: dayNo(s.to) > mEnd };
    };
    // Lanes: items that overlap on the same row are stacked on extra lines.
    function lanes(items) {
      var out = [];
      items.sort(function (p, q) { return p.c.a - q.c.a; }).forEach(function (it) {
        for (var n = 0; n < out.length; n++) if (out[n][out[n].length - 1].c.b < it.c.a) { out[n].push(it); return; }
        out.push([it]);
      });
      return out.length ? out : [[]];
    }
    function laneRow(lane, cellOf, cls, label, lead, tint) {
      var html = '', d = 1;
      lane.forEach(function (it) {
        for (; d < it.c.a; d++) html += '<td class="bb-d' + dcls(d) + '"></td>';
        html += '<td class="bb-span" colspan="' + (it.c.b - it.c.a + 1) + '">' + cellOf(it) + '</td>';
        d = it.c.b + 1;
      });
      for (; d <= days; d++) html += '<td class="bb-d' + dcls(d) + '"></td>';
      return '<tr class="' + cls + '" style="--tint:' + tint + '">' + (lead || '') + '<td class="bb-lab"' + stick(labAt) + '>' + label + '</td>' + html + '</tr>';
    }
    // The Excel cell text: "VESSEL DWT: 73,901 GRT: 40,230 LOA: 225 72,000 t Coal …".
    function details(t) {
      return [t.dwt ? 'DWT: ' + fmtN(t.dwt) : '', t.grt ? 'GRT: ' + fmtN(t.grt) : '', t.loa ? 'LOA: ' + fmtN(t.loa) : '', t.qty ? fmtN(t.qty) + ' t ' + t.cargo : '',
        ownersText(t), t.eta ? 'ETA: ' + short(t.eta) : '', t.agent].filter(Boolean).join(' · ');
    }
    // The stage as a small solid tag in its status colour (readable on any owner colour).
    var stageTxt = function (t) { return '<em class="bb-st" style="background:' + stageColor(t) + '">' + esc(stageLabel(t)) + '</em>'; };

    var tix = S.tickets.filter(function (t) { return !cancelled(t); });
    // SPEC-5 R-02: an inactive buoy (or area) shows, marked inactive, only in months where it has tickets or blocks.
    var busy = function (code) {
      return tix.some(function (t) { return t.port === code && span(t) && clip(span(t)); }) ||
        S.blocks.some(function (k) { return k.port === code && clip({ from: k.start, to: k.end }); });
    };
    var body = M.areas.map(function (area) {
      var tint = AREA_TINT[area.id] || '#fff';
      var ports = M.buoys.filter(function (b) { return b.area === area.id && (on(b) && on(area) || busy(b.code)); });
      if (!ports.length && !on(area)) return '';
      var rows = '<tr class="bb-sec"><td colspan="' + cols + '"><span class="bb-sec-label">' + esc(area.name.toUpperCase()) + ' <em>' + ports.length + (ports.length === 1 ? ' buoy' : ' buoys') + '</em></span></td></tr>';
      // R-08: the area's waiting list (a work queue), whatever month is shown. It sits first under the area band,
      // like the Plan Board's NEW TICKET / PENDING band, so it is in view without scrolling past every buoy.
      var waiting = tix.filter(function (t) {
        if (areaOfPort(t.port) !== area.name || t.stage === 'done') return false;
        return notAccepted(t) || (!(t.start && t.end) && !t.berthed);
      });
      rows += '<tr class="bb-wait"><td colspan="' + LEFT.length + '" class="bb-wait-h">NOT YET ACCEPTED / NOT PLANNED</td><td colspan="' + days + '" class="bb-wait-l"><div style="left:' + (leftW + 8) + 'px">' +
        (waiting.length ? waiting.map(function (t) {
          return '<button class="bb-w" data-go="buoys/t/' + t.id + '"><i style="background:' + blockColor(t) + '"></i><b>' + esc(t.vessel) + '</b> ' + stageTxt(t) +
            '<span>' + esc([t.port, t.eta ? 'ETA: ' + short(t.eta) : '', t.agent].filter(Boolean).join(' · ')) + '</span></button>';
        }).join('') : '<span class="bb-none">None</span>') + '</div></td></tr>';
      ports.forEach(function (b, bi) {
        var items = [];
        tix.forEach(function (t) {
          if (t.port !== b.code) return;
          var c = span(t) && clip(span(t));
          if (c) items.push({ t: t, c: c });
        });
        S.blocks.forEach(function (k) {
          if (k.port !== b.code) return;
          var c = clip({ from: k.start, to: k.end });
          if (c) items.push({ k: k, c: c });
        });
        var vLanes = lanes(items.slice());
        var cLanes = lanes(items.filter(function (it) { return it.t && it.t.crane; }));
        var aLanes = lanes(items.filter(function (it) { return it.t && it.t.alongside; }));
        var n = vLanes.length + cLanes.length + aLanes.length;
        var lim = [b.draft ? 'D < ' + fmtN(b.draft) : '', b.loa ? 'L < ' + fmtN(b.loa) : '', b.dwt ? fmtN(b.dwt / 1000) + 'k' : ''].filter(Boolean).join(' · ');
        var lead = phone ?
          '<td class="bb-c1 bb-mbuoy" rowspan="' + n + '"' + stick(0) + '>' + esc(b.code) + '<small>' + esc(on(b) ? b.owner : 'inactive') + '</small>' + (lim ? '<small class="bb-lim">' + esc(lim) + '</small>' : '') + '</td>' :
          '<td class="bb-c0" rowspan="' + n + '"' + stick(0) + '>' + (bi + 1) + '</td>' +
          '<td class="bb-c1" rowspan="' + n + '"' + stick(1) + ' data-tip="' + esc(b.name + ' · owner ' + b.owner) + '">' + esc(b.code) + '<small>' + esc(on(b) ? b.owner : 'inactive') + '</small></td>' +
          '<td class="bb-c2" rowspan="' + n + '"' + stick(2) + '>' + (b.draft ? esc(fmtN(b.draft)) : '') + '</td>' +
          '<td class="bb-c3" rowspan="' + n + '"' + stick(3) + '>' + (b.loa ? esc(fmtN(b.loa)) : '') + '</td>' +
          '<td class="bb-c4" rowspan="' + n + '"' + stick(4) + '>' + (b.dwt ? esc(fmtN(b.dwt / 1000)) + 'k' : '') + '</td>';
        vLanes.forEach(function (lane, li) {
          rows += laneRow(lane, function (it) {
            if (it.k) {
              return '<button class="bb-blk" data-action="by-block" data-arg="' + it.k.id + '" data-tip="' + esc(it.k.reason + ' · ' + fmtD(it.k.start) + ' → ' + fmtD(it.k.end)) + '">' + esc(it.k.reason.toUpperCase()) + '</button>';
            }
            var t = it.t;
            var cls = 'bb-tk' + (notAccepted(t) ? ' wait' : '') + (t.stage === 'done' ? ' done' : '') + (it.c.cutL ? ' cutl' : '') + (it.c.cutR ? ' cutr' : '');
            return '<button class="' + cls + '" style="--bc:' + blockColor(t) + '" data-go="buoys/t/' + t.id + '" data-tip="' + esc(t.vessel + ' · ' + details(t) + ' · ' + stageLabel(t)) + '">' +
              '<b>' + esc(t.vessel) + (notAccepted(t) || (t.berthed && !t.unberthed) ? ' ' + stageTxt(t) : '') + '</b><span>' + esc(details(t)) + '</span></button>';
          }, 'bb-v' + (li === 0 ? ' first' : ''), li === 0 ? 'Vessel' : '', li === 0 ? lead : '', tint);
        });
        cLanes.forEach(function (lane, li) {
          rows += laneRow(lane, function (it) { return '<span class="bb-crane">' + esc(it.t.crane) + '</span>'; }, 'bb-c', li === 0 ? 'Crane' : '', '', tint);
        });
        aLanes.forEach(function (lane, li) {
          rows += laneRow(lane, function () { return '<span class="bb-along">Alongside</span>'; }, 'bb-a', li === 0 ? (phone ? 'Along.' : 'Alongside') : '', '', tint);
        });
      });
      return rows;
    }).join('');

    var colgroup = '<colgroup>' + LEFT.map(function (c) { return '<col style="width:' + c[1] + 'px" />'; }).join('') +
      new Array(days + 1).join('<col style="width:' + DAY_W + 'px" />') + '</colgroup>';
    var headDays = '';
    for (var d = 1; d <= days; d++) headDays += '<th class="bb-dh' + dcls(d) + '">' + d + '<small>' + WEEK[wd(d)] + '</small></th>';
    var head = '<tr>' + LEFT.map(function (c, i) { return '<th rowspan="2" class="' + c[2] + '"' + stick(i) + '>' + c[0] + '</th>'; }).join('') +
      '<th colspan="' + days + '" class="bb-title">BUOY SCHEDULE ' + MONTHS[mo - 1].toUpperCase() + ' ' + y + '</th></tr><tr>' + headDays + '</tr>';
    // The Plan Board's legend line: every key on a desktop; on a phone the first BAR_KEYS and "+N more"
    // (.bsw-x keys show on body.desk only); the whole line opens the full legend.
    var keys = legendKeys();
    var BAR_KEYS = 3; // the group names are longer than the Plan Board's service names
    var legend = keys.owners.map(function (k, n) { return '<span class="bsw' + (n < BAR_KEYS ? '' : ' bsw-x') + '"><i' + k.sw + '></i>' + esc(k.label) + '</span>'; }).join('') +
      '<span class="bsw bsw-x bsw-sep"></span>' + keys.marks.map(function (k) { return '<span class="bsw bsw-x"><i' + k.sw + '></i>' + esc(k.label) + '</span>'; }).join('') +
      '<span class="blegend-more">+' + (keys.owners.length + keys.marks.length - BAR_KEYS) + ' more</span>';
    var width = leftW + days * DAY_W;
    return api.header() + '<div class="bb-page' + (phone ? ' bb-phone' : '') + '">' +
      '<div class="bbar"><div class="bbar-row">' +
      '<div class="bdate"><button type="button" data-action="by-month" data-arg="-1" aria-label="Previous month">' + I.pLeft + '</button>' +
      '<span>' + MONTHS[mo - 1] + ' ' + y + '</span><button type="button" data-action="by-month" data-arg="1" aria-label="Next month">' + I.pRight + '</button></div>' +
      (S.month !== TODAY.slice(0, 7) ? '<button type="button" class="bb-tool" data-action="by-month" data-arg="0">Today</button>' : '') +
      '<span class="bgrow"></span>' +
      '<button type="button" class="bb-tool" data-action="by-block" data-arg="new">' + I.plus + (phone ? 'Block' : 'Blocked period') + '</button></div>' +
      '<button type="button" class="blegend" data-action="by-legend" aria-label="Legend">' + legend + '</button></div>' +
      '<div class="bb-wrap"><table class="bb" style="width:' + width + 'px">' + colgroup + '<thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>' +
      '</div>';
  };

  // Legend keys: colour groups in title case (as the Plan Board's service names), the default colour, then marks.
  var title = function (s) { return String(s).toLowerCase().replace(/(^|[\s-])(\S)/g, function (m, a, c) { return a + c.toUpperCase(); }); };
  function legendKeys() {
    return {
      owners: M.groups.map(function (g) { return { label: title(g.name), sw: ' style="background:' + g.color + '"' }; })
        .concat([{ label: 'Default', sw: ' style="background:' + M.defaultColor + '"' }]),
      marks: [
        { label: 'Blocked', sw: ' class="blk"', help: 'Buoy blocked (e.g. class survey)' },
        { label: 'Not yet accepted', sw: ' class="dashed"', help: 'NOA entered or PDA sent' },
        { label: 'Crane', sw: ' style="background:#fef3c7"', help: 'Crane unit on the ticket' },
        { label: 'Alongside', sw: ' style="background:#e0f2fe"', help: 'Vessel alongside (own FDA)' }
      ]
    };
  }
  api.actions['by-legend'] = function () {
    var keys = legendKeys();
    var grid = function (list, sub) {
      return '<div class="blegend-grid' + (sub ? ' one' : '') + '">' + list.map(function (k) { return '<div title="' + esc(k.help || k.label) + '"><i' + k.sw + '></i><span>' + esc(sub && k.help ? k.label + ' · ' + k.help : k.label) + '</span></div>'; }).join('') + '</div>';
    };
    api.openOverlay('<div class="mask light" data-action="close"></div><div class="bsheet by-legend" role="dialog" aria-modal="true"><div class="bsheet-head"><h3>Legend</h3>' +
      '<button data-action="close" aria-label="Close">' + I.close + '</button></div><div class="blegend-help">' +
      '<h5>Cargo owner colours</h5>' + grid(keys.owners) + '<h5>Marks</h5>' + grid(keys.marks, true) +
      '<p class="by-hint sm">A block takes its first cargo owner\'s own colour, else its group\'s colour, else the default.</p></div></div>', 'sheet', '#a8a8a8');
  };

  api.actions['by-month'] = function (el) {
    var step = Number(arg(el));
    if (!step) S.month = TODAY.slice(0, 7);
    else {
      var y = Number(S.month.slice(0, 4)), m = Number(S.month.slice(5, 7)) - 1 + step;
      y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
      S.month = y + '-' + pad(m + 1);
    }
    api.render();
  };

  // Blocked periods: add, edit, delete (MOD / ADMIN). Saving over planned tickets warns, then saves.
  api.actions['by-block'] = function (el) {
    if (!isOps()) return;
    var isNew = arg(el) === 'new';
    var k = isNew ? { id: 'k' + Date.now(), port: M.buoys.filter(on)[0].code, start: TODAY, end: TODAY, reason: '' } : S.blocks.filter(function (x) { return x.id === arg(el); })[0];
    if (!k) return;
    var wrap = api.editDialog({
      title: isNew ? 'Block a buoy' : 'Blocked period',
      text: 'The buoy shows grey with the reason; planning a ticket over it gives a warning.',
      values: { port: k.port, start: k.start, end: k.end, reason: k.reason },
      fields: [
        { name: 'port', label: 'Buoy', type: 'select', options: buoyOptions(k.port) },
        { name: 'start', label: 'From', type: 'date', req: true, half: true },
        { name: 'end', label: 'To', type: 'date', req: true, half: true },
        { name: 'reason', label: 'Reason', req: true, placeholder: 'e.g. Class survey' }
      ],
      reset: isNew ? null : { label: 'Delete', run: function () { S.blocks.splice(S.blocks.indexOf(k), 1); keepBlocks(); api.toast('Blocked period deleted'); } },
      onSave: function (v, force) {
        if (dayNo(v.end) < dayNo(v.start)) return { error: 'The end is before the start' };
        var hit = S.tickets.filter(function (t) {
          return !cancelled(t) && t.port === v.port && t.start && t.end && overlaps({ from: v.start, to: v.end }, { from: t.start, to: t.end });
        });
        if (hit.length && !force) return { warn: 'Planned here: ' + hit.map(function (t) { return t.vessel + ' (#' + t.id + ')'; }).join(', ') };
        k.port = v.port; k.start = v.start; k.end = v.end; k.reason = v.reason;
        if (isNew) S.blocks.push(k);
        keepBlocks();
        api.toast('Blocked period saved');
      }
    });
    return wrap;
  };

  api.buoys = {
    S: S, M: M, CHARGES: CHARGES, TODAY: TODAY, STAGES: STAGES, on: on, keep: keep, keepMaster: keepMaster,
    isOps: isOps, isClient: isClient, role: role, stageIx: stageIx, stageLabel: stageLabel, cancelled: cancelled, beforeFda: beforeFda,
    byId: byId, byCode: byCode, areaName: areaName, areaOfPort: areaOfPort, ownerRec: ownerRec, ownerColor: ownerColor, agents: agents,
    fmtD: fmtD, fmtDT: fmtDT, fmtN: fmtN, num: num, dayNo: dayNo, nowStamp: nowStamp, logIt: logIt, tell: tell
  };

  // Notifications about a buoy ticket open it.
  api.notifTarget = function (n) {
    var m = (n.lines || []).join(' ').match(/Ticket #(B\d+)/);
    var t = m && byId(m[1]);
    return t && visible().indexOf(t) >= 0 ? 'buoys/t/' + t.id : '';
  };
});
