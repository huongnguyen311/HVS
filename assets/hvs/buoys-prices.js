// Buoys (Cầu phao) · prices (SPEC-3): the port-services tariff (mother vessel USD / transshipment VND), the
// cargo-handling prices with annual-volume tiers, opening tonnage, and the price lookup used by the documents.
// MOD (the specs' Operator) and ADMIN edit prices; only ADMIN enters opening tonnage; nobody else sees them.
(window.HVS_EXT = window.HVS_EXT || []).push(function (api) {
  'use strict';

  var B = api.buoys;
  if (!B) return;
  var D = api.D, M = B.M, esc = api.esc, emoji = api.emoji, I = api.I;
  var fmtN = B.fmtN, fmtD = B.fmtD, num = B.num, dayNo = B.dayNo;

  var canPrice = function () { return /^(MOD|ADMIN)$/.test(B.role()); };
  var canOpening = function () { return B.role() === 'ADMIN'; };

  // ---------- seed: the department's barem (SRC-4, SRC-5), effective 01/01/2026 ----------

  var n = 0;
  var id = function (p) { return p + (++n); };
  function prow(o) {
    return Object.assign({ id: id('p'), sheet: 'mother', area: 'gg', port: '', dwtFrom: null, dwtBelow: null, loaFrom: null, loaBelow: null, agent: '', charge: '', price: 0, vat: true, from: '2026-01-01' }, o);
  }
  var PORT_SEED = [];
  // Gò Gia mother vessels, common price (Giá chung), 4 DWT bands; the first one also needs LOA < 180 m.
  [[0, 60000, 4400, 3300, 400], [60000, 80000, 7700, 4400, 500], [80000, 100000, 13200, 5500, 500], [100000, 150000, 15000, 6600, 700]].forEach(function (r, i) {
    var band = { dwtFrom: r[0] || null, dwtBelow: r[1], loaBelow: i === 0 ? 180 : null };
    PORT_SEED.push(prow(Object.assign({ charge: 'tug', price: r[2] }, band)));
    PORT_SEED.push(prow(Object.assign({ charge: 'esc_ng3', price: r[3] }, band)));
    PORT_SEED.push(prow(Object.assign({ charge: 'esc_p21', price: r[3] }, band)));
    PORT_SEED.push(prow(Object.assign({ charge: 'mooring', price: r[4] }, band)));
  });
  // The tug in & out fee is priced per agent: Viet Thuan Shipping has its own rows (C-05, C-25).
  [[0, 60000, 3600], [60000, 80000, 6300], [80000, 100000, 10800], [100000, 150000, 13200]].forEach(function (r) {
    PORT_SEED.push(prow({ charge: 'tug', agent: 'Viet Thuan Shipping', dwtFrom: r[0] || null, dwtBelow: r[1], price: r[2] }));
  });
  PORT_SEED.push(prow({ charge: 'cano_com', price: 330 }), prow({ charge: 'cano_pp', price: 500 }), prow({ charge: 'buoy_due', price: 0.0013 }));
  // BP17 (LBMC) has its own mooring price: the exact buoy beats the whole area (AC-05).
  PORT_SEED.push(prow({ port: 'BP17', charge: 'mooring', dwtFrom: 60000, dwtBelow: 80000, price: 615 }));
  // Thiềng Liềng mother vessels.
  [[0, 40000, 5800], [40000, 60000, 6800], [60000, 80000, 7800]].forEach(function (r) {
    PORT_SEED.push(prow({ area: 'tl', charge: 'tug', dwtFrom: r[0] || null, dwtBelow: r[1], price: r[2] }));
  });
  PORT_SEED.push(prow({ area: 'tl', charge: 'mooring', price: 1000 }), prow({ area: 'tl', charge: 'buoy_due', price: 0.0013 }));
  // Transshipment sheet (VND), Gò Gia: used for the alongside vessel with the mother vessel's data (C-15).
  [[5000, 7000, 16000000, 1000000], [7000, 10000, 32000000, 2000000], [10000, 20000, 44000000, 4000000], [20000, null, 48000000, 4000000]].forEach(function (r) {
    PORT_SEED.push(prow({ sheet: 'trans', charge: 'tug', dwtFrom: r[0], dwtBelow: r[1], price: r[2] }));
    PORT_SEED.push(prow({ sheet: 'trans', charge: 'mooring', dwtFrom: r[0], dwtBelow: r[1], price: r[3] }));
  });
  // The barem has a second 5–7k tug row (30,000,000): kept so the "two prices match" alert can be seen (AC-08).
  PORT_SEED.push(prow({ sheet: 'trans', charge: 'tug', dwtFrom: 5000, dwtBelow: 7000, price: 30000000 }));
  PORT_SEED.push(prow({ sheet: 'trans', charge: 'buoy_due', price: 7.5 }));
  PORT_SEED.push(prow({ sheet: 'trans', area: 'tl', charge: 'buoy_due', price: 7.5 }));

  function crow(o) {
    return Object.assign({ id: id('c'), owner: '', vessel: '', cargo: 'Coal', area: 'gg', method: 'floating', price: 0, min: null, buoyIncl: false, vat: true, from: '2026-01-01', tiersOn: false, tiers: [] }, o);
  }
  var TIERS = [{ from: 1000000, below: 2000000, price: 25000 }, { from: 2000000, below: null, price: 23000 }];
  var CARGO_SEED = [
    crow({ owner: 'Thuan Hai Commodities', price: 27000, buoyIncl: true, tiersOn: true, tiers: TIERS }),
    crow({ owner: 'Thuan Hai Commodities', method: 'ship', price: 7000, buoyIncl: true }),
    crow({ owner: 'Thuan Minh', price: 27000, tiers: TIERS }),
    crow({ owner: 'Thuan Minh', method: 'ship', price: 7000 }),
    crow({ owner: 'Nang Luong Tan Thuan', price: 27000, tiersOn: true, tiers: TIERS }),
    crow({ owner: 'Nang Luong Tan Thuan', method: 'ship', price: 7000 }),
    crow({ owner: 'Viet Thuan Transport', price: 34000 }),
    crow({ owner: 'Viet Thuan Transport', method: 'ship', price: 11000 }),
    crow({ owner: 'Duyen Hai 2 Power', price: 26000, min: 50000000 }),
    crow({ owner: 'Vedan Vietnam', price: 27000 }),
    crow({ price: 28000 }),
    crow({ method: 'ship', price: 8000 }),
    crow({ cargo: 'Steel', method: 'ship', price: 12000 }),
    crow({ cargo: 'Steel', area: 'tl', method: 'ship', price: 12000 }),
    crow({ cargo: 'Rice', area: 'tl', method: 'ship', price: 9000 }),
    crow({ cargo: 'Wood pellets', area: 'tl', method: 'ship', price: 10000 })
  ];
  var OPENING_SEED = [
    { owner: 'Thuan Hai Commodities', year: 2026, tons: 600000 },
    { owner: 'Thuan Minh', year: 2026, tons: 850000 },
    { owner: 'Nang Luong Tan Thuan', year: 2026, tons: 420000 }
  ];

  var T = {
    port: api.store('buoyPortRows', PORT_SEED),
    cargo: api.store('buoyCargoRows', CARGO_SEED),
    opening: api.store('buoyOpening', OPENING_SEED),
    sheet: 'mother',
    cargoTab: 'cargo',
    tab: 'mother'
  };
  var keep = function (k) { api.save({ port: 'buoyPortRows', cargo: 'buoyCargoRows', opening: 'buoyOpening' }[k], T[k]); };
  var nextId = function (p, list) { return p + (list.reduce(function (m, r) { return Math.max(m, Number(String(r.id).slice(1)) || 0); }, 0) + 1); };

  // A price row used on a Final or Superseded document is locked (R-07); a Draft does not lock it.
  var used = function (r) { return api.buoyUsedRows ? api.buoyUsedRows()[r.id] : false; };

  // ---------- lookup (SPEC-3 F-01) ----------

  // from ≤ value < below; an empty end is open; a band with an end needs a value (R-02).
  function inBand(v, from, below) {
    if (from == null && below == null) return true;
    if (v == null) return false;
    return (from == null || v >= from) && (below == null || v < below);
  }
  // Written like the Price Table's ranges ("DWT - any", "60,000 ≤ DWT < 80,000"); a band is from ≤ value < below.
  var bandText = function (label, from, below, unit) {
    if (from == null && below == null) return label + ' - any';
    var u = unit || '';
    return (from == null ? '' : fmtN(from) + u + ' ≤ ') + label + (below == null ? '' : ' < ' + fmtN(below) + u);
  };
  var keyOf = function (r, keys) { return keys.map(function (k) { return r[k] == null ? '' : r[k]; }).join('|'); };
  // R-03: per key combination, only the newest row in effect on the date (all of them when they share the date).
  function inEffect(rows, keys, date) {
    var by = {};
    rows.forEach(function (r) { (by[keyOf(r, keys)] = by[keyOf(r, keys)] || []).push(r); });
    var out = [];
    Object.keys(by).forEach(function (k) {
      var live = by[k].filter(function (r) { return r.from <= date; });
      if (!live.length) return;
      var top = live.reduce(function (m, r) { return r.from > m ? r.from : m; }, '');
      live.forEach(function (r) { if (r.from === top) out.push(r); });
    });
    return out;
  }
  var PORT_KEYS = ['sheet', 'area', 'port', 'dwtFrom', 'dwtBelow', 'loaFrom', 'loaBelow', 'agent', 'charge'];
  var CARGO_KEYS = ['owner', 'vessel', 'cargo', 'area', 'method'];
  var rowName = function (r) { return '#' + r.id + ' (' + fmtN(r.price) + ', from ' + fmtD(r.from) + ')'; };

  /* One port-services charge for a ticket: { row, price } or { error }.
     q = { sheet, charge, port, dwt, loa, agent, date }; the alongside FDA passes the mother vessel's data. */
  function lookupPort(q) {
    var b = B.byCode(q.port);
    var area = b ? b.area : '';
    var label = B.CHARGES[q.charge];
    var rows = T.port.filter(function (r) { return r.sheet === q.sheet && r.area === area && (!r.port || r.port === q.port); });
    if (!rows.length) return { error: 'No price row for ' + (B.areaName(area) || 'this area') + ' / ' + q.port };
    rows = rows.filter(function (r) { return r.charge === q.charge; });
    if (!rows.length) return { error: 'No ' + label + ' price for ' + B.areaName(area) };
    var dwtRows = rows.filter(function (r) { return inBand(q.dwt, r.dwtFrom, r.dwtBelow); });
    if (!dwtRows.length) return { error: q.dwt == null ? 'DWT missing on the ticket' : 'No DWT band for ' + fmtN(q.dwt) + ' t (' + label + ')' };
    var loaRows = dwtRows.filter(function (r) { return inBand(q.loa, r.loaFrom, r.loaBelow); });
    if (!loaRows.length) return { error: q.loa == null ? 'LOA missing on the ticket' : 'No LOA band for ' + fmtN(q.loa) + ' m (' + label + ')' };
    var agRows = loaRows.filter(function (r) { return !r.agent || r.agent === q.agent; });
    if (!agRows.length) return { error: 'No common ' + label + ' price and none for ' + (q.agent || 'this agent') };
    var live = inEffect(agRows, PORT_KEYS, q.date);
    if (!live.length) {
      var first = agRows.reduce(function (m, r) { return !m || r.from < m ? r.from : m; }, '');
      return { error: label + ': not yet effective on ' + fmtD(q.date) + ' (starts ' + fmtD(first) + ')' };
    }
    // R-04: the exact buoy beats the whole area, then the agent's own row beats the common price.
    if (live.some(function (r) { return r.port; })) live = live.filter(function (r) { return r.port; });
    if (live.some(function (r) { return r.agent; })) live = live.filter(function (r) { return r.agent; });
    if (live.length > 1) return { error: 'Two prices match for ' + label + ': ' + live.map(rowName).join(' and ') };
    return { row: live[0], price: live[0].price };
  }

  /* The cargo-handling price row of one cargo owner on a ticket: { row } or { error }. */
  function lookupCargo(t, owner, date) {
    var b = B.byCode(t.port);
    var area = b ? b.area : '';
    var method = owner.method;
    var rows = T.cargo.filter(function (r) { return r.area === area && r.cargo === t.cargo && r.method === method; });
    if (!t.cargo) return { error: 'No cargo on the ticket' };
    if (!rows.length) return { error: 'No ' + t.cargo + ' price for ' + B.areaName(area) + ' (' + M.methods[method] + ')' };
    rows = rows.filter(function (r) { return (!r.owner || r.owner === owner.name) && (!r.vessel || r.vessel === t.vessel); });
    if (!rows.length) return { error: 'No common price and none for ' + owner.name };
    var live = inEffect(rows, CARGO_KEYS, date);
    if (!live.length) return { error: t.cargo + ' price: not yet effective on ' + fmtD(date) };
    // R-04: the owner's own row beats the common price, then a named vessel beats all vessels.
    if (live.some(function (r) { return r.owner; })) live = live.filter(function (r) { return r.owner; });
    if (live.some(function (r) { return r.vessel; })) live = live.filter(function (r) { return r.vessel; });
    if (live.length > 1) return { error: 'Two prices match: ' + live.map(rowName).join(' and ') };
    return { row: live[0] };
  }

  // USD → VND: the newest rate on or before the date, from the towage rate table (R-13).
  function fx(date) {
    var key = function (d) { var m = /(\d\d)\/(\d\d)\/(\d{4})/.exec(d); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; };
    var rows = api.store('fxRates', D.fxRates).filter(function (r) { return r.from === 'USD' && key(r.date) <= date; });
    if (!rows.length) return null;
    var best = rows.reduce(function (m, r) { return key(r.date) > key(m.date) ? r : m; });
    return { rate: best.rate, date: key(best.date) };
  }

  // ---------- annual-volume tiers (R-08 … R-10) ----------

  var yearOf = function (t) { return Number((t.pricingDate || t.eta || B.TODAY).slice(0, 4)); };
  // R-10: opening tonnage + the owner's tonnage on its other non-cancelled tickets of the year entered before this one.
  function startTonnage(owner, t) {
    var y = yearOf(t);
    var open = T.opening.filter(function (o) { return o.owner === owner && Number(o.year) === y; }).reduce(function (s, o) { return s + Number(o.tons); }, 0);
    return B.S.tickets.reduce(function (s, x) {
      if (x === t || B.cancelled(x) || yearOf(x) !== y || x.created >= t.created) return s;
      return s + x.owners.filter(function (o) { return o.name === owner && o.tons; }).reduce(function (a, o) { return a + o.tons; }, 0);
    }, open);
  }

  /* Split an owner's tonnage across the price row and its tiers: { parts: [{ tons, price, label }] } or { error }. */
  function split(row, owner, t, tons) {
    if (!row.tiersOn || !row.tiers.length) return { parts: [{ tons: tons, price: row.price, label: 'Unit price' }], start: null };
    var tiers = row.tiers.slice().sort(function (a, b) { return a.from - b.from; });
    var segs = [{ from: 0, below: tiers[0].from, price: row.price, label: 'Below ' + fmtN(tiers[0].from) + ' t' }].concat(tiers.map(function (x) {
      return { from: x.from, below: x.below, price: x.price, label: fmtN(x.from) + (x.below ? '–' + fmtN(x.below) : '+') + ' t' };
    }));
    for (var i = 0; i < segs.length - 1; i++) {
      if (segs[i].below == null || segs[i + 1].from < segs[i].below) return { error: 'Two tiers cover the same tonnage on price row #' + row.id };
    }
    var start = startTonnage(owner, t), cur = start, left = tons, parts = [];
    while (left > 1e-9) {
      var seg = segs.filter(function (s) { return cur >= s.from && (s.below == null || cur < s.below); })[0];
      if (!seg) return { error: 'No tier covers ' + fmtN(cur) + ' t (gap or past the last tier) on price row #' + row.id };
      var take = seg.below == null ? left : Math.min(left, seg.below - cur);
      parts.push({ tons: Math.round(take * 1000) / 1000, price: seg.price, label: seg.label });
      cur += take; left -= take;
    }
    return { parts: parts, start: start };
  }

  api.buoyPrice = { lookupPort: lookupPort, lookupCargo: lookupCargo, fx: fx, split: split, startTonnage: startTonnage, rows: T };

  // ---------- screen: Admin › Buoys › Prices (scope rows 18-20: port services barem, cargo handling with tiers) ----------

  var lockMark = function (r) { return used(r) ? '<span class="by-lock" data-tip="Used on a finished document: add a new row with a new effective date instead">🔒</span>' : ''; };
  var yes = function (v) { return v ? 'Yes' : '<span class="dt-muted">No</span>'; };
  // On a phone the tabs are a segmented control (as Towage | Buoys): every tab in view, a short name and, under it,
  // the unit and the count. Desktop keeps the chips. Rows: [key, label, count, short name, unit].
  var seg = function (list, isOn, attrs) {
    return '<div class="by-seg" role="tablist">' + list.map(function (x) {
      var on = isOn(x);
      return '<button type="button" role="tab" aria-selected="' + on + '" class="' + (on ? 'on' : '') + '" ' + attrs(x) + ' title="' + esc(x[1]) + '">' +
        '<b>' + esc(x[3] || x[1]) + '</b><small>' + esc((x[4] ? x[4] + ' · ' : '') + (x[2] != null ? x[2] : '')) + '</small></button>';
    }).join('') + '</div>';
  };
  var tabs = function (cur, list, action) {
    if (!api.desk()) return seg(list, function (x) { return x[0] === cur; }, function (x) { return 'data-action="' + action + '" data-arg="' + x[0] + '"'; });
    return '<div class="dt-chips by-tabs">' + list.map(function (x) {
      return '<button class="' + (x[0] === cur ? 'on' : '') + '" data-action="' + action + '" data-arg="' + x[0] + '">' + esc(x[1]) + (x[2] != null ? '<em>' + x[2] + '</em>' : '') + '</button>';
    }).join('') + '</div>';
  };
  var areaOpts = function () { return M.areas.map(function (a) { return { value: a.id, label: a.name }; }); };
  var portOpts = function () {
    return [{ value: '', label: 'Whole area (every buoy)' }].concat(M.buoys.map(function (b) { return { value: b.code, label: b.code + ' · ' + B.areaName(b.area) }; }));
  };

  // One page, one tab bar: the two port-services sheets, cargo handling, and the opening tonnage its tiers count from.
  var priceTabs = function () {
    var cnt = function (s) { return T.port.filter(function (r) { return r.sheet === s; }).length; };
    return tabs(T.tab, [['mother', 'Mother vessel (USD)', cnt('mother'), 'Mother', 'USD'], ['trans', 'Transshipment (VND)', cnt('trans'), 'Transship.', 'VND'],
      ['cargo', 'Cargo handling (VND/t)', T.cargo.length, 'Cargo', 'VND/t'], ['opening', 'Opening tonnage', T.opening.length, 'Opening', 'tonnage']], 'bp-tab');
  };
  api.actions['bp-tab'] = function (el) {
    T.tab = el.dataset.arg;
    if (T.tab === 'mother' || T.tab === 'trans') T.sheet = T.tab; else T.cargoTab = T.tab;
    api.render();
  };
  // One subtitle for every tab, so the table stays put when the tab changes; each tab's own rules go under its table.
  var SUB = 'Port services (barem) and cargo handling. Every price has an effective date; one used on a finished document is locked.';
  var note = function (text) { return '<p class="bp-note">' + esc(text) + '</p>'; };
  api.views['admin/buoy-prices'] = function () { return T.tab === 'mother' || T.tab === 'trans' ? portView() : cargoView(); };

  function portView() {
    var rows = T.port.filter(function (r) { return r.sheet === T.sheet; });
    var cur = T.sheet === 'mother' ? 'USD' : 'VND';
    var PRICE_COL = function () {
      return { key: 'price', label: 'Price (' + cur + ')', sort: 'number', cls: 'num', cell: function (r) { return '<b>' + esc(fmtN(r.price, 4)) + '</b>' + (r.charge === 'buoy_due' ? '<small class="dt-muted"> /GRT/h</small>' : ''); } };
    };
    return api.deskPage('Buoy Prices', SUB, api.dataTable({
      source: T.port,
      list: rows.filter(function (r) { return api.matches([B.areaName(r.area), r.port, r.agent, B.CHARGES[r.charge], r.price].join(' ')); }),
      noun: 'price row', perPage: 20, placeholder: 'Search area, buoy, agent or charge...',
      add: canPrice() ? { action: 'bp-port-add', label: 'Add price' } : null,
      tools: priceTabs(),
      cols: [
        { key: 'charge', label: 'Charge', sort: 'text', cell: function (r) { return esc(B.CHARGES[r.charge]); } },
        PRICE_COL(),
        { key: 'area', label: 'Area', sort: 'text', cell: function (r) { return esc(B.areaName(r.area)); } },
        { key: 'port', label: 'Buoy', sort: 'text', cell: function (r) { return r.port ? '<b>' + esc(r.port) + '</b>' : '<span class="dt-muted">Whole area</span>'; } },
        { key: 'dwtFrom', label: 'DWT', sort: 'number', cell: function (r) { return esc(bandText('DWT', r.dwtFrom, r.dwtBelow)); } },
        { key: 'loaBelow', label: 'LOA', cell: function (r) { return esc(bandText('LOA', r.loaFrom, r.loaBelow, ' m')); } },
        { key: 'agent', label: 'Agent', sort: 'text', cell: function (r) { return r.charge === 'tug' ? (r.agent ? esc(r.agent) : '<span class="dt-muted">Common price</span>') : api.dash(''); } },
        { key: 'vat', label: 'VAT', cell: function (r) { return yes(r.vat); } },
        { key: 'from', label: 'Effective from', sort: 'text', cls: 'by-nw', cell: function (r) { return esc(fmtD(r.from)) + lockMark(r); } }
      ],
      actions: canPrice() ? function (r) {
        return api.btn('', 'data-action="bp-port-edit" data-arg="' + r.id + '"', used(r) ? 'View' : 'Edit') +
          api.btn('', 'data-action="bp-port-copy" data-arg="' + r.id + '"', 'New price') +
          api.btn('danger', (used(r) ? 'disabled title="Used on a finished document: it stays"' : 'data-action="bp-port-del" data-arg="' + r.id + '"'), 'Delete');
      } : null
    }) + note('One shared table for every customer, by area, buoy, DWT and LOA.') + (canPrice() ? '' : '<p class="lg-ro">' + emoji('👁️') + 'View only</p>'));
  }

  function portDialog(r, isNew) {
    var locked = !isNew && used(r);
    var charges = Object.keys(B.CHARGES).filter(function (k) { return r.sheet === 'mother' || /^(tug|mooring|buoy_due)$/.test(k); });
    api.editDialog({
      title: (locked ? 'Price row #' + r.id + ' · locked' : isNew ? 'New price · ' : 'Edit price · ') + (r.sheet === 'mother' ? 'mother vessel (USD)' : 'transshipment (VND)'),
      text: locked ? 'Used on a finished document, so it cannot change. Use "New price" with a new effective date.' : 'Bands read "from ≤ value < below"; leave an end empty for no limit.',
      values: { area: r.area, port: r.port, charge: r.charge || charges[0], dwtFrom: r.dwtFrom == null ? '' : r.dwtFrom, dwtBelow: r.dwtBelow == null ? '' : r.dwtBelow, loaFrom: r.loaFrom == null ? '' : r.loaFrom, loaBelow: r.loaBelow == null ? '' : r.loaBelow, agent: r.agent, price: r.price, vat: r.vat, from: r.from },
      fields: [
        { name: 'area', label: 'Area', type: 'select', half: true, options: areaOpts() },
        { name: 'port', label: 'Buoy', type: 'select', half: true, options: portOpts() },
        { name: 'charge', label: 'Charge', type: 'select', half: true, options: charges.map(function (k) { return { value: k, label: B.CHARGES[k] }; }) },
        { name: 'agent', label: 'Ship agent (tug in & out only)', type: 'select', half: true, options: [{ value: '', label: 'Common price (all agents)' }].concat(B.agents().map(function (a) { return { value: a.name, label: a.name }; })) },
        { name: 'dwtFrom', label: 'DWT from (≥)', type: 'number', half: true },
        { name: 'dwtBelow', label: 'DWT below (<)', type: 'number', half: true },
        { name: 'loaFrom', label: 'LOA from (≥ m)', type: 'number', half: true },
        { name: 'loaBelow', label: 'LOA below (< m)', type: 'number', half: true },
        { name: 'price', label: 'Price (' + (r.sheet === 'mother' ? 'USD' : 'VND') + ')', type: 'number', req: true, half: true, hint: 'Buoy due: per GRT per hour' },
        { name: 'from', label: 'Effective from', type: 'date', req: true, half: true },
        { name: 'vat', label: 'VAT applies (the ticket\'s VAT rate)', type: 'checkbox' }
      ],
      okLabel: locked ? 'Close' : 'Save',
      onSave: function (v) {
        if (locked) return;
        var x = {};
        var bad = ['dwtFrom', 'dwtBelow', 'loaFrom', 'loaBelow', 'price'].filter(function (k) { x[k] = num(v[k]); return x[k] === undefined || (x[k] != null && x[k] < 0); });
        if (bad.length) return { error: 'Check the numbers: ' + bad.join(', ') };
        if (x.price == null) return { error: 'Enter a price' };
        if (x.dwtFrom != null && x.dwtBelow != null && x.dwtFrom >= x.dwtBelow) return { error: 'DWT "from" must be below "below"' };
        if (x.loaFrom != null && x.loaBelow != null && x.loaFrom >= x.loaBelow) return { error: 'LOA "from" must be below "below"' };
        if (v.port && B.byCode(v.port).area !== v.area) return { error: v.port + ' is not in ' + B.areaName(v.area) };
        Object.assign(r, x, { area: v.area, port: v.port, charge: v.charge, agent: v.charge === 'tug' ? v.agent : '', vat: v.vat, from: v.from });
        if (isNew) T.port.push(r);
        keep('port');
        api.toast('Price saved');
      }
    });
  }
  var portRow = function (el) { return T.port.filter(function (r) { return r.id === el.dataset.arg; })[0]; };
  api.actions['bp-port-add'] = function () { if (canPrice()) portDialog({ id: nextId('p', T.port), sheet: T.sheet, area: 'gg', port: '', agent: '', charge: '', price: '', vat: true, from: B.TODAY }, true); };
  api.actions['bp-port-edit'] = function (el) { var r = portRow(el); if (r && canPrice()) portDialog(r, false); };
  // A new price for the same keys with a later effective date (how a used price changes, R-07).
  api.actions['bp-port-copy'] = function (el) {
    var r = portRow(el);
    if (r && canPrice()) portDialog(Object.assign({}, r, { id: nextId('p', T.port), from: B.TODAY }), true);
  };
  api.actions['bp-port-del'] = function (el) {
    var r = portRow(el);
    if (!r || used(r) || !canPrice()) return;
    api.confirmDialog('Delete price row #' + r.id + '?', B.CHARGES[r.charge] + ' · ' + fmtN(r.price) + ' from ' + fmtD(r.from) + '. Not used on any finished document.', 'Delete', function () {
      T.port.splice(T.port.indexOf(r), 1); keep('port'); api.render(); api.toast('Deleted');
    });
  };

  // ---------- cargo handling and opening tonnage ----------

  var tierText = function (r) {
    if (!r.tiers.length) return '<span class="dt-muted">None</span>';
    return (r.tiersOn ? '<b class="by-on">On</b> ' : '<span class="dt-muted">Off</span> ') + esc(r.tiers.map(function (x) { return '≥ ' + fmtN(x.from) + (x.below ? ' < ' + fmtN(x.below) : '') + ' → ' + fmtN(x.price); }).join(' · '));
  };
  var tierInput = function (r) { return r.tiers.map(function (x) { return fmtN(x.from) + '-' + (x.below ? fmtN(x.below) : '') + ' = ' + fmtN(x.price); }).join('; '); };
  function parseTiers(text) {
    var out = [];
    var bad = String(text || '').split(/[;\n]/).map(function (s) { return s.trim(); }).filter(Boolean).some(function (s) {
      var m = /^([\d,.\s]+)\s*-\s*([\d,.\s]*)=\s*([\d,.\s]+)$/.exec(s);
      if (!m) return true;
      var t = { from: num(m[1]), below: num(m[2]), price: num(m[3]) };
      if (!t.from || t.from <= 0 || t.price == null || t.price <= 0 || (t.below != null && t.below <= t.from)) return true;
      out.push(t);
      return false;
    });
    return bad ? null : out;
  }

  function cargoView() {
    var head = priceTabs();
    if (T.cargoTab === 'opening') {
      return api.deskPage('Buoy Prices', SUB, api.dataTable({
        source: T.opening, list: T.opening.filter(function (o) { return api.matches(o.owner + ' ' + o.year); }), noun: 'record', placeholder: 'Search cargo owner...',
        add: canOpening() ? { action: 'bp-open-add', label: 'Add opening tonnage' } : null, tools: head,
        cols: [
          { key: 'owner', label: 'Cargo owner', sort: 'text', cell: function (o) { return '<b>' + esc(o.owner) + '</b>'; } },
          { key: 'tons', label: 'Opening tonnage', sort: 'number', cls: 'num', cell: function (o) { return esc(fmtN(o.tons) + ' t'); } },
          { key: 'year', label: 'Year', sort: 'number' },
          { key: 'now', label: 'Counted so far (with tickets)', cls: 'num', cell: function (o) { return esc(fmtN(startTonnage(o.owner, { created: '9999', pricingDate: o.year + '-12-31', owners: [] })) + ' t'); } }
        ],
        actions: canOpening() ? function (o, i) { return api.btn('', 'data-action="bp-open-edit" data-arg="' + i + '"', 'Edit') + api.btn('danger', 'data-action="bp-open-del" data-arg="' + i + '"', 'Delete'); } : null
      }) + note('Each cargo owner\'s tonnage before go-live, per year. Tiers count it with the owner\'s tickets of the same year (year of the pricing date).') + (canOpening() ? '' : '<p class="lg-ro">' + emoji('👁️') + 'View only · the admin enters opening tonnage</p>'));
    }
    return api.deskPage('Buoy Prices', SUB, api.dataTable({
      source: T.cargo,
      list: T.cargo.filter(function (r) { return api.matches([r.owner || 'common', r.vessel, r.cargo, B.areaName(r.area), M.methods[r.method]].join(' ')); }),
      noun: 'price row', perPage: 20, placeholder: 'Search cargo owner, vessel or cargo...',
      add: canPrice() ? { action: 'bp-cargo-add', label: 'Add price' } : null, tools: head,
      cols: [
        { key: 'owner', label: 'Cargo owner', sort: 'text', cell: function (r) { return r.owner ? '<b>' + esc(r.owner) + '</b>' : '<span class="dt-muted">Common price</span>'; } },
        { key: 'price', label: 'VND / t', sort: 'number', cls: 'num', cell: function (r) { return '<b>' + esc(fmtN(r.price)) + '</b>'; } },
        // a phone shows the short name (the full one on tap)
        { key: 'method', label: 'Method', sort: 'text', cell: function (r) { return api.desk() ? esc(M.methods[r.method]) : '<span data-tip="' + esc(M.methods[r.method]) + '">' + (r.method === 'ship' ? 'Ship\'s' : 'Floating') + '</span>'; } },
        { key: 'vessel', label: 'Vessel', sort: 'text', cell: function (r) { return r.vessel ? esc(r.vessel) : '<span class="dt-muted">All</span>'; } },
        { key: 'cargo', label: 'Cargo', sort: 'text' },
        { key: 'area', label: 'Area', sort: 'text', cell: function (r) { return esc(B.areaName(r.area)); } },
        { key: 'tiers', label: 'Annual-volume tiers', cell: tierText },
        { key: 'min', label: 'Minimum', cls: 'num', cell: function (r) { return r.min ? esc(fmtN(r.min)) : api.dash(''); } },
        { key: 'buoyIncl', label: 'Buoy services incl.', cell: function (r) { return yes(r.buoyIncl); } },
        { key: 'vat', label: 'VAT', cell: function (r) { return yes(r.vat); } },
        { key: 'from', label: 'Effective from', sort: 'text', cls: 'by-nw', cell: function (r) { return esc(fmtD(r.from)) + lockMark(r); } }
      ],
      actions: canPrice() ? function (r) {
        return api.btn('', 'data-action="bp-cargo-edit" data-arg="' + r.id + '"', used(r) ? 'View' : 'Edit') +
          api.btn('', 'data-action="bp-cargo-copy" data-arg="' + r.id + '"', 'New price') +
          api.btn('danger', (used(r) ? 'disabled title="Used on a finished document: it stays"' : 'data-action="bp-cargo-del" data-arg="' + r.id + '"'), 'Delete');
      } : null
    }) + note('Price per tonne per cargo owner (or a common price), by cargo, area and crane method. Crane hire by the day goes on the document as a custom line. Tiers replace the unit price once the owner\'s yearly tonnage passes a threshold; a ticket crossing one is split.') + (canPrice() ? '' : '<p class="lg-ro">' + emoji('👁️') + 'View only</p>'));
  }

  function cargoDialog(r, isNew) {
    var locked = !isNew && used(r);
    api.editDialog({
      title: locked ? 'Price row #' + r.id + ' · locked' : isNew ? 'New cargo-handling price' : 'Edit cargo-handling price',
      text: locked ? 'Used on a finished document (tiers included), so it cannot change. Use "New price" with a new effective date; it starts with a copy of these tiers.' : '',
      values: { owner: r.owner, vessel: r.vessel, cargo: r.cargo, area: r.area, method: r.method, price: r.price, min: r.min == null ? '' : r.min, buoyIncl: r.buoyIncl, vat: r.vat, from: r.from, tiersOn: r.tiersOn, tiers: tierInput(r) },
      fields: [
        { name: 'owner', label: 'Cargo owner', type: 'select', half: true, options: [{ value: '', label: 'Common price (Giá chung)' }].concat(M.owners.map(function (o) { return { value: o.name, label: o.name }; })) },
        { name: 'vessel', label: 'Vessel', half: true, placeholder: 'Empty = all vessels' },
        { name: 'cargo', label: 'Cargo', type: 'select', half: true, options: M.cargoTypes.map(function (c) { return { value: c.name, label: c.name }; }) },
        { name: 'area', label: 'Area', type: 'select', half: true, options: areaOpts() },
        { name: 'method', label: 'Crane method', type: 'select', half: true, options: [{ value: 'floating', label: M.methods.floating }, { value: 'ship', label: M.methods.ship }] },
        { name: 'price', label: 'Unit price (VND/t)', type: 'number', req: true, half: true },
        { name: 'min', label: 'Minimum charge (VND)', type: 'number', half: true },
        { name: 'from', label: 'Effective from', type: 'date', req: true, half: true },
        { name: 'buoyIncl', label: 'Buoy services included (no buoy due / mooring on the mother FDA)', type: 'checkbox' },
        { name: 'vat', label: 'VAT applies (the ticket\'s VAT rate)', type: 'checkbox' },
        { name: 'tiersOn', label: 'Annual-volume tiers on', type: 'checkbox' },
        { name: 'tiers', label: 'Tiers', placeholder: '1,000,000-2,000,000 = 25,000; 2,000,000- = 23,000', hint: '"from-below = price", separated by ";". Below the first tier the unit price applies.' }
      ],
      okLabel: locked ? 'Close' : 'Save',
      onSave: function (v) {
        if (locked) return;
        var price = num(v.price), min = num(v.min), tiers = parseTiers(v.tiers);
        if (!price || price <= 0) return { error: 'The unit price must be above 0' };
        if (min === undefined || (min != null && min < 0)) return { error: 'Check the minimum charge' };
        if (tiers === null) return { error: 'Tiers: write them as "1,000,000-2,000,000 = 25,000; 2,000,000- = 23,000"' };
        if (v.tiersOn && !tiers.length) return { error: 'Add at least one tier, or turn tiers off' };
        Object.assign(r, { owner: v.owner, vessel: v.vessel.toUpperCase(), cargo: v.cargo, area: v.area, method: v.method, price: price, min: min, buoyIncl: v.buoyIncl, vat: v.vat, from: v.from, tiersOn: v.tiersOn, tiers: tiers });
        if (isNew) T.cargo.push(r);
        keep('cargo');
        api.toast('Price saved');
      }
    });
  }
  var cargoRow = function (el) { return T.cargo.filter(function (r) { return r.id === el.dataset.arg; })[0]; };
  api.actions['bp-cargo-add'] = function () { if (canPrice()) cargoDialog({ id: nextId('c', T.cargo), owner: '', vessel: '', cargo: 'Coal', area: 'gg', method: 'floating', price: '', min: null, buoyIncl: false, vat: true, from: B.TODAY, tiersOn: false, tiers: [] }, true); };
  api.actions['bp-cargo-edit'] = function (el) { var r = cargoRow(el); if (r && canPrice()) cargoDialog(r, false); };
  // R-08: a new row for the same keys starts with a copy of the previous row's tiers.
  api.actions['bp-cargo-copy'] = function (el) {
    var r = cargoRow(el);
    if (r && canPrice()) cargoDialog(Object.assign(JSON.parse(JSON.stringify(r)), { id: nextId('c', T.cargo), from: B.TODAY }), true);
  };
  api.actions['bp-cargo-del'] = function (el) {
    var r = cargoRow(el);
    if (!r || used(r) || !canPrice()) return;
    api.confirmDialog('Delete price row #' + r.id + '?', (r.owner || 'Common price') + ' · ' + r.cargo + ' · ' + fmtN(r.price) + ' VND/t', 'Delete', function () {
      T.cargo.splice(T.cargo.indexOf(r), 1); keep('cargo'); api.render(); api.toast('Deleted');
    });
  };

  function openingDialog(o, isNew) {
    api.editDialog({
      title: isNew ? 'Opening tonnage' : 'Opening tonnage · ' + o.owner,
      text: 'Tonnage the cargo owner already had in the year before go-live.',
      values: { owner: o.owner, year: o.year, tons: o.tons },
      fields: [
        { name: 'owner', label: 'Cargo owner', type: 'select', options: M.owners.map(function (x) { return { value: x.name, label: x.name }; }) },
        { name: 'year', label: 'Year', type: 'number', half: true, req: true },
        { name: 'tons', label: 'Tonnage (t)', type: 'number', half: true, req: true }
      ],
      onSave: function (v) {
        var y = num(v.year), tons = num(v.tons);
        if (!y || y < 2000) return { error: 'Enter a year' };
        if (tons == null || tons === undefined || tons < 0) return { error: 'Enter the tonnage' };
        if (T.opening.some(function (x) { return x !== o && x.owner === v.owner && Number(x.year) === y; })) return { error: v.owner + ' already has opening tonnage for ' + y };
        Object.assign(o, { owner: v.owner, year: y, tons: tons });
        if (isNew) T.opening.push(o);
        keep('opening');
      }
    });
  }
  api.actions['bp-open-add'] = function () { if (canOpening()) openingDialog({ owner: M.owners[0].name, year: Number(B.TODAY.slice(0, 4)), tons: '' }, true); };
  api.actions['bp-open-edit'] = function (el) { if (canOpening()) openingDialog(T.opening[Number(el.dataset.arg)], false); };
  api.actions['bp-open-del'] = function (el) {
    if (!canOpening()) return;
    var o = T.opening[Number(el.dataset.arg)];
    api.confirmDialog('Delete opening tonnage?', o.owner + ' · ' + o.year, 'Delete', function () { T.opening.splice(T.opening.indexOf(o), 1); keep('opening'); api.render(); });
  };
});
