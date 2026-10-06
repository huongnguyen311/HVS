// Phase 4 · Pricing & ledger (P1–P6): customers, agents, tax codes, price table and lookup, currencies and
// exchange rates, the ledger (A→P) with sub-tickets, export and its files, AI split rules and the approval
// queue, discounts. Only accountants and ADMIN reach these screens; clients never see a price.
(window.HVS_EXT = window.HVS_EXT || []).push(function (api) {
  'use strict';

  var D = api.D;
  var esc = api.esc;
  var emoji = api.emoji;
  var I = api.I;

  // ---------- state (sessionStorage, like the other admin lists) ----------

  var P = {};
  ['customers', 'agents', 'taxCodes', 'currencies', 'fxRates', 'priceRows', 'ledger', 'ledgerFiles', 'splitRules', 'splitProposals', 'discountTiers', 'discountScope'].forEach(function (k) {
    var src = { ledgerFiles: D.ledgerFiles, splitRules: D.splitRules, splitProposals: D.splitProposals, discountTiers: D.discountTiers, discountScope: D.discountScope }[k] || D[k];
    P[k] = api.store(k, JSON.parse(JSON.stringify(src)));
  });
  var keep = function (k) { api.save(k, P[k]); };
  // Highest sub number ever given per No., so a deleted sub's number is never handed out again.
  var subSeq = api.store('subSeq', {});

  var role = function () { return api.user.role; };
  // ADMIN, HEAD_ACCOUNTANT and ACCOUNTANT work the ledger, its tables and export; SUPPORT_ACCOUNTANT views them
  // (prices included). Nothing is ever blocked for ADMIN, and the billing status is for viewing only: it never
  // locks a line or stops an action.
  var canWork = function () { return /^(ADMIN|HEAD_ACCOUNTANT|ACCOUNTANT)$/.test(role()); };
  // AI suggestions: ADMIN or an accountant accepts or declines each one.
  var canApprove = canWork;
  // AI split rules: ADMIN writes them; accountants view them.
  var canRules = function () { return role() === 'ADMIN'; };
  // Read-only tables show this instead of the Add / Edit buttons.
  var viewOnly = function (what) { return '<p class="lg-ro">' + emoji('👁️') + 'View only · ' + what + '</p>'; };

  // ---------- helpers ----------

  // Tooltip text: a hover bubble on desktop, a tap bubble on a phone (app.js tap tips).
  var tip = function (text) { return ' data-tip="' + esc(text) + '"'; };

  var byId = function (list, id) { return list.filter(function (x) { return x.id === id; })[0] || null; };
  var cust = function (id) { return byId(P.customers, id); };
  var custName = function (id) { var c = cust(id); return c ? c.name : ''; };
  var svc = function (code) { return D.services.filter(function (s) { return s.code === code; })[0] || { name: code, code: code }; };
  var areaOf = function (port) { return D.portLocations[port] || ''; };
  var curOf = function (code) { return P.currencies.filter(function (c) { return c.code === code; })[0] || { code: code, decimals: 0 }; };

  // dd/MM/yyyy → yyyymmdd (sortable); '' → ''.
  function dkey(v) {
    var m = /(\d\d)\/(\d\d)\/(\d{4})/.exec(v || '');
    return m ? m[3] + m[2] + m[1] : '';
  }

  // "80k" = 80000, "1.2m" = 1200000, "18,500,000" = 18500000; '' → null; NaN → undefined.
  function parseNum(v) {
    var t = String(v == null ? '' : v).trim().toLowerCase().replace(/[\s,]/g, '');
    if (!t) return null;
    var m = /^(-?\d+(?:\.\d+)?)([km]?)$/.exec(t);
    if (!m) return undefined;
    return Number(m[1]) * (m[2] === 'k' ? 1e3 : m[2] === 'm' ? 1e6 : 1);
  }

  function num(n, decimals) {
    return Number(n).toLocaleString('en-US', { minimumFractionDigits: decimals || 0, maximumFractionDigits: decimals || 0 });
  }

  // Amounts carry their currency's decimals (VND 0, USD 2).
  function money(n, code) {
    return n == null ? '' : num(n, curOf(code).decimals) + ' ' + code;
  }

  // 125 ≤ LOA ≤ 150 · LOA ≤ 100 · LOA ≥ 251 · LOA - any (both ends included).
  function rangeText(label, min, max) {
    if (min == null && max == null) return label + ' - any';
    if (min == null) return label + ' ≤ ' + num(max, max % 1 ? 2 : 0);
    if (max == null) return label + ' ≥ ' + num(min, min % 1 ? 2 : 0);
    return num(min, min % 1 ? 2 : 0) + ' ≤ ' + label + ' ≤ ' + num(max, max % 1 ? 2 : 0);
  }

  var inRange = function (v, min, max) { return v != null && (min == null || v >= min) && (max == null || v <= max); };

  function sharedWith(c) {
    return P.customers.filter(function (x) { return x.taxCode === c.taxCode && x.id !== c.id; }).map(function (x) { return x.name; });
  }

  // A4: the customer as every picker shows it.
  function custItem(c) {
    var shared = sharedWith(c);
    return {
      value: c.id, label: c.name,
      sub: [c.short, 'Tax code ' + c.taxCode, 'VAT ' + c.vat + '%'].join(' · '),
      note: shared.length ? 'Shares tax code with ' + shared.join(', ') : '',
      title: c.name + ' · ' + c.short + ' · tax code ' + c.taxCode + ' · VAT ' + c.vat + '% · agents: ' + (c.agents || []).map(function (a) { return (byId(P.agents, a) || {}).name; }).join(', ')
    };
  }

  function fx(date, from) {
    if (from === 'VND') return 1;
    var rows = P.fxRates.filter(function (r) { return r.from === from && dkey(r.date) <= dkey(date); }).sort(function (a, b) { return dkey(b.date) < dkey(a.date) ? -1 : 1; });
    return rows.length ? rows[0].rate : null;
  }

  // 1 `from` = ? `to` on a day, through VND (the table holds X → VND rates); null when a rate is missing.
  function rateBetween(date, from, to) {
    if (from === to) return 1;
    var a = fx(date, from), b = fx(date, to);
    return a && b ? a / b : null;
  }

  // "1 USD = 25,470 VND", always written from the stronger currency so it never reads 0.00004.
  function rateText(rate, from, to) {
    if (rate == null) return '';
    return rate >= 1 ? '1 ' + from + ' = ' + num(rate, rate % 1 ? 2 : 0) + ' ' + to : '1 ' + to + ' = ' + num(1 / rate, (1 / rate) % 1 ? 2 : 0) + ' ' + from;
  }

  // ---------- price lookup (P2) ----------

  // Narrows the price table one condition at a time, so a miss says which step failed (never a 0 price).
  // The most specific row wins: customer, then port, then area, then bounded DWT / LOA ranges. A row has one
  // effective date and no end: among rows of the same conditions, the latest one on or before the day applies.
  function lookup(q) {
    var steps = [
      ['Customer', function (p) { return !p.customer || p.customer === q.customer; }, 'no price row for ' + (custName(q.customer) || 'this customer') + ' or for any customer'],
      ['Date', function (p) { return dkey(p.from) <= dkey(q.date); }, 'no price is in effect yet on ' + q.date],
      ['Service', function (p) { return p.service === q.service; }, 'no price for ' + svc(q.service).name],
      ['Area / port', function (p) { return (!p.port || p.port === q.port) && (!p.area || p.area === areaOf(q.port)); }, 'no price for port ' + q.port + (areaOf(q.port) ? ' (' + areaOf(q.port) + ')' : ' (port has no area)')],
      ['DWT', function (p) { return p.dwtMin == null && p.dwtMax == null || inRange(q.dwt, p.dwtMin, p.dwtMax); }, 'DWT ' + (q.dwt == null ? '(missing)' : num(q.dwt)) + ' is outside every DWT range'],
      ['LOA', function (p) { return p.loaMin == null && p.loaMax == null || inRange(q.loa, p.loaMin, p.loaMax); }, 'LOA ' + (q.loa == null ? '(missing)' : q.loa) + ' is outside every LOA range']
    ];
    var rows = P.priceRows;
    for (var i = 0; i < steps.length; i++) {
      var next = rows.filter(steps[i][1]);
      if (!next.length) return { step: steps[i][0], error: 'Step ' + (i + 1) + ' · ' + steps[i][0] + ': ' + steps[i][2] + '.' };
      rows = next;
    }
    var score = function (p) { return (p.customer ? 8 : 0) + (p.port ? 4 : 0) + (p.area ? 2 : 0) + (p.dwtMin != null || p.dwtMax != null ? 1 : 0) + (p.loaMin != null || p.loaMax != null ? 1 : 0); };
    rows = rows.slice().sort(function (a, b) { return score(b) - score(a) || (dkey(b.from) > dkey(a.from) ? 1 : dkey(b.from) < dkey(a.from) ? -1 : 0); });
    return { row: rows[0] };
  }

  // ---------- ledger line (P3) ----------

  function monthOf(l) { return l.date.slice(3); }

  // The demo's current month: the latest month that has ledger lines (mm/yyyy).
  function currentMonth() {
    var last = P.ledger.reduce(function (a, l) { return dkey(l.date) > dkey(a) ? l.date : a; }, '');
    return last ? last.slice(3) : '';
  }
  // The month the ledger opens on: the one just closed (accountants check and invoice it at the start of the next),
  // or the current month when the previous one has no lines.
  function ledgerMonth() {
    var now = currentMonth();
    var m = Number(now.slice(0, 2)), y = Number(now.slice(3));
    var prev = (m === 1 ? '12/' + (y - 1) : String(m - 1).padStart(2, '0') + '/' + y);
    return P.ledger.some(function (l) { return monthOf(l) === prev; }) ? prev : now;
  }

  // Moves of a customer in a month that count toward a discount tier (the demo's earlier moves included).
  // A move is one No.: the sub-tickets of a split ticket do not count as extra moves.
  function movesInMonth(customer, month) {
    var counted = P.discountScope.counted;
    var stts = {};
    P.ledger.forEach(function (l) { if (l.invoice === customer && monthOf(l) === month && counted.indexOf(l.service) >= 0) stts[l.stt] = true; });
    return ((D.monthCounts[month] || {})[customer] || 0) + Object.keys(stts).length;
  }

  function tierFor(customer, month) {
    var n = movesInMonth(customer, month);
    var t = P.discountTiers.filter(function (x) { return (!x.customer || x.customer === customer) && n >= x.fromCount && (x.toCount == null || n <= x.toCount); })
      .sort(function (a, b) { return b.percent - a.percent; })[0];
    return t ? { percent: t.percent, moves: n } : null;
  }

  // Everything the table shows for one line, and what is still missing (a warning only: nothing is blocked).
  // unitCur = the price's own currency (table or override); currency = the one the line is billed in, picked on
  // the line (default: unitCur). rate converts unitCur → currency on the service day. beforeVat is the price
  // after the discount (price currency), vat comes from the invoice customer, amount = total in the billed currency.
  function calc(l) {
    var out = { missing: [] };
    if (!l.invoice) out.missing.push('Invoice customer not set');
    if (l.dwt == null) out.missing.push('DWT missing');
    if (l.loa == null) out.missing.push('LOA missing');
    if (P.discountScope.countOnly.indexOf(l.service) >= 0) { out.countOnly = true; return out; }
    if (l.invoice) {
      var r = lookup({ customer: l.invoice, date: l.date, service: l.service, port: l.port, dwt: l.dwt, loa: l.loa });
      if (r.error) out.error = r.error; else { out.price = r.row.price; out.priceCur = r.row.currency; out.priceRow = r.row.id; }
    }
    var unit = l.override != null ? l.override : out.price;
    if (unit == null) {
      if (l.invoice && out.error) out.missing.push('No price: ' + out.error);
      return out;
    }
    out.unit = unit;
    out.unitCur = l.override != null ? l.overrideCurrency || out.priceCur || 'VND' : out.priceCur;
    out.currency = l.currency || out.unitCur;
    // share: a 1-tugboat line split by percent (e.g. 50% CGM) bills only its part.
    out.gross = unit * (l.tugs || 1) * (l.share != null ? l.share / 100 : 1);
    var t = l.invoice ? tierFor(l.invoice, monthOf(l)) : null;
    out.discount = t;
    var net = out.gross * (1 - (t ? t.percent : 0) / 100);
    // Price before VAT and VAT stay in the price's currency; the total = (price after VAT, else before VAT) × rate.
    var u = Math.pow(10, curOf(out.unitCur).decimals);
    out.beforeVat = Math.round(net * u) / u;
    var c = cust(l.invoice);
    out.vatPct = c ? c.vat : null;
    out.vat = c ? Math.round(out.beforeVat * c.vat / 100 * u) / u : null;
    out.rate = rateBetween(l.date, out.unitCur, out.currency);
    if (out.rate == null) { out.missing.push('No ' + out.unitCur + ' → ' + out.currency + ' rate on ' + l.date); return out; }
    var d = Math.pow(10, curOf(out.currency).decimals);
    out.amount = Math.round((out.vat != null ? out.beforeVat + out.vat : out.beforeVat) * out.rate * d) / d;
    return out;
  }

  // months: one or more months (mm/yyyy); a date range empties it and takes its place, lastMonths brings it back.
  var L = { months: [ledgerMonth()], lastMonths: [ledgerMonth()], customers: [], from: '', to: '', missing: false, sel: {} };

  // Nothing ticked: a hint. Something ticked: the count, clear, and the way to export it.
  function selBar(n) {
    if (!n) return '<span>Tick lines to export them, or <button data-action="l-export" data-arg="range">export by date range</button>.</span>';
    return '<span><b>' + n + '</b> selected · <button data-action="l-sel-clear">Clear</button></span>' +
      '<button class="lg-sel-go" data-action="l-export" data-arg="selected">Export ' + n + ' →</button>';
  }
  var lineKey = function (l) { return l.stt + '.' + l.sub; };
  // SUB column: {monthly order No.}_{sub number}, the original line being _1.
  var subNo = function (l) { return l.stt + '_' + l.sub; };
  var pendingAi = function () { return P.splitProposals.filter(function (p) { return p.status === 'pending'; }).length; };

  // The lines of the period on screen: the month, or the date range that takes its place.
  function inPeriod(l) {
    if (L.months.length && L.months.indexOf(monthOf(l)) < 0) return false;
    if (L.from && dkey(l.date) < L.from.replace(/-/g, '')) return false;
    if (L.to && dkey(l.date) > L.to.replace(/-/g, '')) return false;
    return true;
  }

  // A line belongs to a customer who ordered it or is invoiced for it.
  var ofCustomer = function (l, c) { return l.invoice === c || l.customer === c; };

  function ledgerRows() {
    return P.ledger.filter(function (l) {
      if (!inPeriod(l)) return false;
      if (L.customers.length && !L.customers.some(function (c) { return ofCustomer(l, c); })) return false;
      return api.matches([l.stt, l.vessel, l.port, custName(l.customer), custName(l.invoice), svc(l.service).name, l.note].join(' '));
    });
  }

  function statusPill(st) {
    var s = D.billingStatus[st] || D.billingStatus.pending;
    return api.pill(s.label, s.color);
  }

  function chip(label, on, action, arg) {
    return '<button class="' + (on ? 'on' : '') + '" data-action="' + action + '"' + (arg != null ? ' data-arg="' + esc(arg) + '"' : '') + '>' + label + '</button>';
  }

  function tabs(cur) {
    var t = [['ledger', 'Lines'], ['ledger/ai', 'AI suggestions', pendingAi()], ['ledger/export', 'Export'], ['ledger/files', 'Files']];
    if (!canWork()) t = t.filter(function (x) { return x[0] !== 'ledger/export'; });
    return '<div class="lg-tabs">' + t.map(function (x) {
      return '<button class="' + (x[0] === cur ? 'on' : '') + '" data-go="' + x[0] + '">' + esc(x[1]) + (x[2] ? '<em>' + x[2] + '</em>' : '') + '</button>';
    }).join('') + '</div>';
  }

  // Every ledger tab shares one frame: header, the tabs at the same height, then that tab's note.
  // Keeps the tab row still when switching (the note used to sit above it on some tabs only).
  function ledgerPage(cur, sub, body, cls) {
    return api.header() + '<div class="page dt-page lg-page' + (cls ? ' ' + cls : '') + '">' + tabs(cur) +
      (sub ? '<p class="section-sub lg-note">' + sub + '</p>' : '') + body + '</div>';
  }

  // On a narrow screen the table opens (and re-opens after each pick) scrolled to J, the one editable column,
  // right after the frozen No. column; a full-width table is left alone.
  function scrollToJ() {
    var wrap = document.querySelector('.dt-wrap');
    var j = wrap && wrap.querySelector('th.lg-c-j');
    var no = wrap && wrap.querySelector('th.lg-c-no');
    if (!j || !no || j.offsetLeft + j.offsetWidth <= wrap.clientWidth) return;
    wrap.scrollLeft = j.offsetLeft - (no.offsetLeft + no.offsetWidth);
  }

  api.views.ledger = function () {
    setTimeout(scrollToJ);
    var work = canWork();
    var rows = ledgerRows();
    var flagged = rows.filter(function (l) { return calc(l).missing.length; }).length;
    if (L.missing) rows = rows.filter(function (l) { return calc(l).missing.length; });
    var nSel = Object.keys(L.sel).length;
    var dm = function (v) { return v ? v.slice(8, 10) + '/' + v.slice(5, 7) : '…'; };
    var tools = '<div class="lg-tools"><div class="dt-chips">' +
      // One month: the month; several: the latest and how many more (all of them in the tooltip).
      (L.months.length ? '<button class="on" data-action="l-month" title="' + esc(sortMonths(L.months).join(', ')) + '">' + esc(sortMonths(L.months)[0]) +
        (L.months.length > 1 ? ' +' + (L.months.length - 1) : '') + ' ▾</button>' : chip('Month ▾', false, 'l-month')) +
      // One customer: its short name; several: the first and how many more. The ✕ clears them all, the rest reopens the picker.
      (L.customers.length ? '<button class="on" data-action="l-customer" title="' + esc(L.customers.map(custName).join(', ')) + '">' +
        esc((cust(L.customers[0]) || {}).short) + (L.customers.length > 1 ? ' +' + (L.customers.length - 1) : '') +
        '<span class="lg-chip-x" role="button" aria-label="Clear customers" data-action="l-customer-clear">✕</span></button>' :
        chip('Customer ▾', false, 'l-customer')) +
      (L.from || L.to ? '<button class="on" data-action="l-dates">' + dm(L.from) + ' – ' + dm(L.to) +
        '<span class="lg-chip-x" role="button" aria-label="Clear dates" data-action="l-dates-clear">✕</span></button>' :
        chip('Dates ▾', false, 'l-dates')) +
      (work ? '<button class="lg-ai" data-action="ai-run">' + emoji('✨') + 'AI suggest</button>' : '') + '</div>' +
      // The warning is the way to the lines: tap it to show only those, tap again to show all.
      (L.missing ? '<button class="lg-flag on" data-action="l-missing">' + emoji('⚠️') + '<span>Showing ' + rows.length + ' line' + (rows.length === 1 ? '' : 's') + ' missing data</span><b>Show all</b></button>' :
        flagged ? '<button class="lg-flag" data-action="l-missing">' + emoji('⚠️') + '<span>' + flagged + ' line' + (flagged > 1 ? 's' : '') + ' missing data</span><b>Show</b></button>' : '') +
      (pendingAi() ? '<button class="lg-ai-bar" data-go="ledger/ai">' + emoji('✨') + '<span><b>' + plural(pendingAi(), 'AI suggestion') + '</b> waiting for review</span><b>Review →</b></button>' : '') +
      (work ? '<div class="lg-sel" data-lsel-count>' + selBar(nSel) + '</div>' : '<p class="lg-ro">' + emoji('👁️') + 'View only · prices visible, no actions, no export.</p>') + '</div>';
    // A customer picked on the line: a button for those who work the ledger, plain text for the rest.
    var custPick = function (l, i, key, action) {
      var c = cust(l[key]);
      var name = c ? esc(c.name) : '<span class="lg-miss">Choose…</span>';
      var vat = key === 'invoice' && c ? '<small>VAT ' + c.vat + '%</small>' : '';
      if (work) return '<button class="lg-pick" data-action="' + action + '" data-arg="' + i + '"><span>' + name + ' ▾</span>' + vat + '</button>';
      return '<span class="lg-pick ro"><span>' + name + '</span>' + vat + '</span>';
    };
    var label = function (key) { var c = D.ledgerColumns.filter(function (x) { return x[1] === key; })[0]; return c[2]; };
    var cols = [];
    // No. (and the tick box) stay frozen while the table scrolls to the invoice customer, so the row being edited is always named.
    if (work) cols.push({ key: 'sel', label: '', cls: 'lg-c-sel', stick: 0, cell: function (l) { return '<label class="lg-tick"><input type="checkbox" data-lsel="' + lineKey(l) + '"' + (L.sel[lineKey(l)] ? ' checked' : '') + ' aria-label="Select line" /></label>'; } });
    cols = cols.concat([
      { key: 'stt', label: label('stt'), sort: 'number', cls: 'lg-c-no', stick: work ? 36 : 0, edge: true, cell: function (l) {
        var c = calc(l);
        return '<b>' + l.stt + '</b>' + (c.missing.length ? '<span class="lg-warn"' + tip('Missing: ' + c.missing.join(' · ')) + '>⚠</span>' : '');
      } },
      // SUB = {monthly order No.}_{sub number}; the original line is _1.
      { key: 'sub', label: label('sub'), sort: 'number', cell: function (l) { return '<span class="lg-subno' + (l.sub > 1 ? ' split' : '') + '">' + subNo(l) + '</span>'; } },
      { key: 'date', label: label('date'), sort: 'datetime' },
      { key: 'port', label: label('port'), sort: 'text' },
      { key: 'agent', label: label('agent'), sort: 'text', cell: function (l) { return api.dash((byId(P.agents, lineAgent(l)) || {}).name); } },
      { key: 'vessel', label: label('vessel'), sort: 'text', cls: 'clip', cell: function (l) { return '<b' + tip(l.vessel + ' · Trip #' + l.trip) + '>' + esc(l.vessel) + '</b>'; } },
      { key: 'dwt', label: label('dwt'), sort: 'number', cls: 'num', cell: function (l) { return l.dwt == null ? '<span class="lg-miss">missing</span>' : num(l.dwt); } },
      { key: 'loa', label: label('loa'), sort: 'number', cls: 'num', cell: function (l) { return l.loa == null ? '<span class="lg-miss">missing</span>' : num(l.loa, 2); } },
      { key: 'service', label: label('service'), sort: 'text', cell: function (l) { return esc(svc(l.service).name); } },
      { key: 'tugs', label: label('tugs'), sort: 'number', cls: 'num', cell: function (l) { return l.tugs + (l.share != null ? '<small class="lg-diff">' + l.share + '%</small>' : ''); } },
      { key: 'customer', label: label('customer'), sort: 'text', cell: function (l, i) { return custPick(l, i, 'customer', 'l-ordered'); } },
      { key: 'invoice', label: label('invoice'), cls: 'lg-c-j', cell: function (l, i) { return custPick(l, i, 'invoice', 'l-invoice'); } },
      { key: 'price', label: label('price'), cls: 'num', cell: function (l) {
        var c = calc(l);
        if (c.countOnly) return '<span class="dt-muted"' + tip('Counted toward the discount tier, never charged') + '>counted · no charge</span>';
        if (c.error) return '<span class="lg-err"' + tip('No price: ' + c.error) + '>⚠ no price</span>';
        return c.price == null ? api.dash('') : '<span' + (l.override != null ? ' class="lg-was"' : '') + '>' + money(c.price, c.priceCur) + '</span>';
      } },
      { key: 'override', label: label('override'), cls: 'num', cell: function (l) {
        if (l.override == null) return api.dash('');
        var c = calc(l);
        var diff = c.price != null && c.unitCur === c.priceCur ? l.override - c.price : null;
        return '<b' + (l.overrideReason ? tip('Override reason: ' + l.overrideReason) : '') + '>' + money(l.override, c.unitCur) + '</b>' +
          (diff != null ? '<small class="lg-diff">' + (diff >= 0 ? '+' : '') + num(diff, curOf(c.unitCur).decimals) + ' vs table</small>' : '<small class="lg-diff">table: none</small>');
      } },
      // The currency the line is billed in: picked on the line, the price's own currency by default.
      { key: 'currency', label: label('currency'), cell: function (l, i) {
        var c = calc(l);
        if (c.unit == null) return api.dash('');
        if (!work) return esc(c.currency);
        return '<select class="lg-cur" data-lcur="' + i + '" aria-label="Currency">' + P.currencies.map(function (x) {
          return '<option value="' + esc(x.code) + '"' + (x.code === c.currency ? ' selected' : '') + '>' + esc(x.code) + '</option>';
        }).join('') + '</select>';
      } },
      { key: 'fx', label: label('fx'), cls: 'num', cell: function (l) {
        var c = calc(l);
        if (c.unit == null) return api.dash('');
        if (c.rate == null) return '<span class="lg-err"' + tip('Add the rate in Currencies & Rates') + '>⚠ no rate</span>';
        if (c.unitCur === c.currency) return '<span class="dt-muted">1 · same currency</span>';
        return '<span' + tip('Rate of ' + l.date + ' (or the last one before it)') + '>' + esc(rateText(c.rate, c.unitCur, c.currency)) + '</span>';
      } },
      { key: 'beforeVat', label: label('beforeVat'), cls: 'num', cell: function (l) {
        var c = calc(l);
        if (c.beforeVat == null) return api.dash('');
        return money(c.beforeVat, c.unitCur) + (c.discount ? '<small class="lg-diff">−' + c.discount.percent + '% (' + c.discount.moves + ' moves this month)</small>' : '');
      } },
      { key: 'vat', label: label('vat'), cls: 'num', cell: function (l) {
        var c = calc(l);
        if (c.beforeVat == null) return api.dash('');
        if (c.vat == null) return '<span class="dt-muted"' + tip('Set the invoice customer to get its VAT') + '>-</span>';
        return money(c.vat, c.unitCur) + '<small class="lg-diff">' + c.vatPct + '%</small>';
      } },
      { key: 'amount', label: label('amount'), cls: 'num', cell: function (l) {
        var c = calc(l);
        return c.amount == null ? api.dash('') : '<b>' + money(c.amount, c.currency) + '</b>';
      } },
      { key: 'status', label: label('status'), sort: 'text', cell: function (l) { return statusPill(l.status); } }
    ]);
    return ledgerPage('ledger', '', api.dataTable({
      source: P.ledger, list: rows, noun: 'line', perPage: 20, placeholder: 'Search No., vessel, customer, note…', sort: ['stt', 1],
      empty: L.months.length === 1 ? 'No lines in this month' : L.months.length ? 'No lines in these months' : 'No lines in this period', tools: tools, cols: cols,
      actions: work ? function (l, i) { return api.btn('', 'data-action="l-more" data-arg="' + i + '"', '⋯'); } : null
    }));
  };

  // ---------- ledger actions ----------

  // mm/yyyy list, latest first.
  function sortMonths(list) {
    var ym = function (m) { return m.slice(3) + m.slice(0, 2); };
    return list.slice().sort(function (a, b) { return ym(b) < ym(a) ? -1 : 1; });
  }

  // Several months can be picked. The ledger is always read for a period: one or more months, or a date range
  // (which takes their place), so Done with nothing ticked keeps the months as they were.
  api.actions['l-month'] = function () {
    var months = sortMonths(P.ledger.map(monthOf).filter(function (m, i, a) { return a.indexOf(m) === i; }));
    var now = ledgerMonth();
    api.picker({
      title: 'Months', multi: true, value: L.months, placeholder: 'Search month, e.g. 09/2026',
      items: months.map(function (m) {
        var n = P.ledger.filter(function (l) { return monthOf(l) === m; }).length;
        return { value: m, label: m, sub: n + ' line' + (n === 1 ? '' : 's') };
      }),
      onPick: function (v) {
        if (!v.length) return api.toast('Pick at least one month');
        L.months = sortMonths(v); L.from = L.to = ''; api.render();
      },
      onReset: function () { L.months = [now]; L.from = L.to = ''; api.render(); }
    });
  };
  api.actions['l-customer'] = function () {
    // Customers with lines in the period come first, busiest first, each with its line count.
    var count = function (c) { return P.ledger.filter(function (l) { return inPeriod(l) && ofCustomer(l, c.id); }).length; };
    var items = P.customers.map(function (c) {
      var n = count(c);
      var it = custItem(c);
      it.sub = (n ? n + ' line' + (n > 1 ? 's' : '') : 'No lines') + ' · ' + it.sub;
      return { item: it, n: n };
    }).sort(function (a, b) { return b.n - a.n || a.item.label.localeCompare(b.item.label); }).map(function (x) { return x.item; });
    api.picker({
      title: 'Filter by customer', multi: true, items: items, value: L.customers,
      placeholder: 'Search name, short name, tax code',
      onPick: function (v) { L.customers = v; api.render(); },
      onReset: function () { L.customers = []; api.render(); }
    });
  };
  api.actions['l-customer-clear'] = function () {
    L.customers = [];
    api.render();
  };
  function clearDates() { L.from = L.to = ''; if (!L.months.length) L.months = L.lastMonths.slice(); }
  api.actions['l-dates-clear'] = function () { clearDates(); api.render(); };
  api.actions['l-dates'] = function () {
    api.editDialog({
      title: 'Date range', okLabel: 'Apply',
      // Reset: no range, back to the month it replaced.
      reset: { run: clearDates },
      fields: [{ label: 'From', type: 'html', html: '<input class="text-input" type="date" name="from" value="' + esc(L.from) + '" />', half: true }, { label: 'To', type: 'html', html: '<input class="text-input" type="date" name="to" value="' + esc(L.to) + '" />', half: true }],
      onSave: function () {
        var f = document.querySelector('.ed-dialog');
        if (!f.elements.from.value && !f.elements.to.value) return { error: 'Choose at least one day.' };
        L.from = f.elements.from.value; L.to = f.elements.to.value; if (L.months.length) L.lastMonths = L.months.slice(); L.months = [];
      }
    });
  };
  api.actions['l-sel-clear'] = function () { L.sel = {}; api.render(); };
  api.actions['l-missing'] = function () { L.missing = !L.missing; api.render(); };
  api.actions['l-export'] = function (el) { X.mode = el.dataset.arg; api.go('ledger/export'); };

  document.addEventListener('change', function (e) {
    if (!e.target.matches('[data-lsel]')) return;
    var k = e.target.dataset.lsel;
    if (e.target.checked) {
      if (Object.keys(L.sel).length >= 500) { e.target.checked = false; return api.toast('At most 500 lines per export'); }
      L.sel[k] = true;
    } else delete L.sel[k];
    var n = Object.keys(L.sel).length;
    var c = document.querySelector('[data-lsel-count]');
    if (c) c.innerHTML = selBar(n);
  });

  // The customer picker of a line (Ordered by, Invoice customer). Its "New customer" button opens the customer
  // form and, once saved, sets the new customer on the line, so a missing customer never sends anyone elsewhere.
  var newCustDone = null;
  function pickCustomer(l, what, value, onPick) {
    newCustDone = onPick;
    api.picker({
      title: what + ' · ' + subNo(l),
      head: '<div class="pk-head"><b>' + esc(l.vessel) + ' · ' + esc(svc(l.service).name) + '</b><span>Ticket note: ' + (l.note ? esc(l.note) : '-') + '</span>' +
        '<button type="button" class="pk-new" data-action="l-newcust">' + I.plus + 'New customer</button></div>',
      items: P.customers.map(custItem), value: value || '', placeholder: 'Search customer, short name, tax code', onPick: onPick
    });
  }
  api.actions['l-newcust'] = function () {
    var done = newCustDone;
    api.closeOverlay();
    customerDialog(null, function (c) { if (done) done(c.id); });
  };

  api.actions['l-invoice'] = function (el) {
    var l = P.ledger[Number(el.dataset.arg)];
    if (!canWork()) return;
    pickCustomer(l, 'Invoice customer', l.invoice, function (v) {
      l.invoice = v || null;
      if (v && l.status === 'pending') l.status = 'provisional';
      keep('ledger');
      api.render();
      api.toast(v ? 'Invoice customer · ' + custName(v) : 'Invoice customer cleared');
    });
  };
  api.actions['l-ordered'] = function (el) {
    var l = P.ledger[Number(el.dataset.arg)];
    if (!canWork()) return;
    pickCustomer(l, 'Ordered by', l.customer, function (v) {
      l.customer = v || null;
      keep('ledger');
      api.render();
      api.toast('Ordered by · ' + (custName(v) || 'none'));
    });
  };
  // The billing currency of a line; the price's own currency again clears the choice.
  document.addEventListener('change', function (e) {
    if (!e.target.matches('[data-lcur]')) return;
    var l = P.ledger[Number(e.target.dataset.lcur)];
    l.currency = e.target.value === calc(Object.assign({}, l, { currency: null })).unitCur ? null : e.target.value;
    keep('ledger');
    api.render();
  });

  // A sub-ticket: one more line on the same No. (sub 2, 3, …), priced for its own customer. Its tugboats
  // move over from the line it was split from, so the ticket's total stays the same.
  // Deleting a sub-ticket never renumbers the others, and its number is not given out again.
  // Moves tugboats (tugs) or, on a 1-tugboat line, a percent of it (share) to a new sub line.
  function createSub(from, customer, tugs, share) {
    var lines = P.ledger.filter(function (x) { return x.stt === from.stt; });
    var sub = Math.max(subSeq[from.stt] || 0, Math.max.apply(null, lines.map(function (x) { return x.sub; }))) + 1;
    subSeq[from.stt] = sub;
    api.save('subSeq', subSeq);
    if (share) from.share = (from.share != null ? from.share : 100) - share; else from.tugs -= tugs;
    var line = Object.assign({}, from, { sub: sub, invoice: customer, tugs: share ? from.tugs : tugs, share: share || null, override: null, overrideReason: '', overrideCurrency: null, status: 'provisional' });
    var at = P.ledger.indexOf(lines[lines.length - 1]);
    P.ledger.splice(at + 1, 0, line);
    keep('ledger');
    return line;
  }

  // amount (optional, from an AI suggestion): tugboats to move, or the percent on a 1-tugboat line.
  function splitDialog(l, preset, done, amount) {
    if ((l.tugs || 1) < 2) return shareDialog(l, preset, done, amount);
    api.editDialog({
      title: 'Split ' + subNo(l) + ' into a sub-ticket',
      text: l.vessel + ' · ' + svc(l.service).name + ' · ' + l.tugs + ' tugboats. The new line keeps its No., gets the next sub number, takes its tugboats from this line and is priced for its own customer.',
      values: { customer: preset || '', tugs: amount && amount < l.tugs ? amount : 1 },
      fields: [
        { name: 'customer', label: 'Invoice customer of the new line', type: 'one', req: true, options: P.customers.map(custItem) },
        { name: 'tugs', label: 'Tugboats moved to the new line', type: 'number', req: true, half: true, hint: l.tugs === 2 ? 'Only 1 can move' : '1 to ' + (l.tugs - 1) },
        { label: 'Ticket note', type: 'html', html: '<p class="ed-hint">' + esc(l.note || '-') + '</p>' }
      ],
      okLabel: 'Create sub-ticket',
      onSave: function (v) {
        var n = parseNum(v.tugs);
        if (!n || n < 1 || n % 1 || n >= l.tugs) return { error: (l.tugs === 2 ? 'Move 1 tugboat' : 'Move 1 to ' + (l.tugs - 1) + ' tugboats') + '; at least 1 stays on this line.' };
        var line = createSub(l, v.customer, n);
        api.toast('Sub-ticket ' + subNo(line) + ' created');
        if (done) done(line);
      }
    });
  }

  // A 1-tugboat line has no tugboat to move, so the new line takes a percent of it instead ("50% CGM").
  function shareDialog(l, preset, done, amount) {
    var left = l.share != null ? l.share : 100;
    if (left < 2) return api.toast('No. ' + l.stt + (l.sub > 1 ? ' sub ' + l.sub : '') + ' has 1% left · nothing to split off');
    var hint = (l.note || '').match(/(\d{1,2})\s*%/);
    api.editDialog({
      title: 'Split ' + subNo(l) + ' into a sub-ticket',
      text: l.vessel + ' · ' + svc(l.service).name + ' · 1 tugboat. The new line keeps its No., gets the next sub number and bills the percent below for its own customer; this line keeps the rest.',
      values: { customer: preset || '', share: amount || (hint ? hint[1] : 50) },
      fields: [
        { name: 'customer', label: 'Invoice customer of the new line', type: 'one', req: true, options: P.customers.map(custItem) },
        { name: 'share', label: 'Percent moved to the new line', type: 'number', req: true, half: true, hint: '1 to ' + (left - 1) + ' (of ' + left + '%)' },
        { label: 'Ticket note', type: 'html', html: '<p class="ed-hint">' + esc(l.note || '-') + '</p>' }
      ],
      okLabel: 'Create sub-ticket',
      onSave: function (v) {
        var n = parseNum(v.share);
        if (!n || n < 1 || n % 1 || n >= left) return { error: 'Move 1 to ' + (left - 1) + '%; some stays on this line.' };
        var line = createSub(l, v.customer, 0, n);
        api.toast('Sub-ticket ' + subNo(line) + ' created · ' + n + '%');
        if (done) done(line);
      }
    });
  }

  api.actions['l-more'] = function (el) {
    var i = Number(el.dataset.arg);
    var l = P.ledger[i];
    if (!canWork()) return;
    var items = [
      { label: 'Split into a sub-ticket…', icon: '➗', run: function () { splitDialog(l); } },
      { label: l.override != null ? 'Change override price…' : 'Override price…', icon: '✏️', run: function () { overrideDialog(l); } }
    ];
    if (l.override != null) items.push({ label: 'Remove override', icon: '↩️', run: function () { l.override = null; l.overrideReason = ''; l.overrideCurrency = null; keep('ledger'); api.render(); } });
    // The billing status is a label for viewing: any status can be set at any time, and none locks the line.
    items.push({ label: 'Billing status…', icon: '🏷️', run: function () {
      api.actionSheet('Billing status · ' + subNo(l), 'For viewing only · it never locks the line', Object.keys(D.billingStatus).map(function (k) {
        return { label: D.billingStatus[k].label + (l.status === k ? ' ✓' : ''), run: function () { l.status = k; keep('ledger'); api.render(); } };
      }));
    } });
    if (l.sub > 1) items.push({ label: 'Delete sub-ticket', icon: '🗑️', danger: true, run: function () {
      // Its tugboats go back to the first other line of the No.
      var back = P.ledger.filter(function (x) { return x.stt === l.stt && x !== l; })[0];
      if (l.share != null) back.share = Math.min(100, (back.share != null ? back.share : 100) + l.share); else back.tugs += l.tugs;
      P.ledger.splice(P.ledger.indexOf(l), 1); keep('ledger'); api.render();
      api.toast('Sub ' + l.sub + ' deleted · ' + (l.share != null ? l.share + '%' : l.tugs + ' tug' + (l.tugs > 1 ? 's' : '')) + ' back to sub ' + back.sub + ' · other lines keep their numbers');
    } });
    api.actionSheet(subNo(l) + ' · ' + l.vessel, esc(svc(l.service).name) + ' · ' + esc(l.date), items);
  };

  function overrideDialog(l) {
    var c = calc(l);
    api.editDialog({
      title: 'Override price · No. ' + l.stt,
      text: c.price != null ? 'Price table: ' + money(c.price, c.priceCur) + ' per tugboat. The override is shown next to it.' : 'The price table has no price for this line' + (c.error ? ' (' + c.error + ')' : '') + '.',
      values: { price: l.override == null ? '' : l.override, currency: l.overrideCurrency || c.priceCur || 'VND', reason: l.overrideReason || '' },
      fields: [
        { name: 'price', label: 'Price per tugboat', req: true, half: true, hint: '“80k” = 80,000' },
        { name: 'currency', label: 'Currency', type: 'select', half: true, options: P.currencies.map(function (x) { return { value: x.code, label: x.code }; }) },
        { name: 'reason', label: 'Reason', type: 'textarea', req: true, placeholder: 'e.g. Agreed by phone with the owner' }
      ],
      onSave: function (v) {
        var n = parseNum(v.price);
        if (n == null || n === undefined || n <= 0) return { error: 'Enter a price above 0 (e.g. 15500000 or 15.5m).' };
        l.override = n; l.overrideCurrency = v.currency; l.overrideReason = v.reason;
        keep('ledger');
        api.toast('Override saved');
      }
    });
  }

  // ---------- export (P4) ----------

  var X = { mode: 'selected', from: '', to: '', cols: D.ledgerColumns.map(function (c) { return c[1]; }) };

  // The lines the export would take right now: the ticked ones, or every line in the date range.
  function exportLines() {
    if (X.mode === 'selected') return P.ledger.filter(function (l) { return L.sel[lineKey(l)]; });
    if (!X.from || !X.to) return [];
    return P.ledger.filter(function (l) { var k = dkey(l.date); return k >= X.from.replace(/-/g, '') && k <= X.to.replace(/-/g, ''); });
  }
  var plural = function (n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); };

  api.views['ledger/export'] = function () {
    // SUPPORT_ACCOUNTANT reads the ledger but never exports, even when opening the route directly.
    if (!canWork()) return ledgerPage('ledger/export', '', '<p class="adm-empty">' + emoji('🔒') + 'Your role reads the ledger only; export is for the head accountant, accountants and admins.</p>', 'lx');
    var lines = exportLines();
    var bad = lines.map(function (l) { return { stt: l.stt, sub: l.sub, vessel: l.vessel, missing: calc(l).missing }; }).filter(function (e) { return e.missing.length; });
    var nCols = X.cols.length, all = D.ledgerColumns.length;

    // 1 · which lines
    var pick;
    if (X.mode === 'selected') {
      pick = lines.length
        ? '<div class="lx-sum"><span><b>' + plural(lines.length, 'line') + '</b> ticked on the Lines tab</span><button data-go="ledger">Change</button></div>'
        : '<div class="lx-sum empty"><span>No line ticked yet.</span><button data-go="ledger">Pick lines →</button></div>';
    } else {
      pick = '<div class="lx-range"><label>From<input class="text-input" type="date" data-lx="from" value="' + esc(X.from) + '" /></label><label>To<input class="text-input" type="date" data-lx="to" value="' + esc(X.to) + '" /></label></div>' +
        '<p class="lx-count">' + (X.from && X.to ? (lines.length ? '<b>' + plural(lines.length, 'line') + '</b> in this range' : 'No line in this range') : 'Choose both days.') + '</p>';
    }

    // 3 · a heads-up before the button: lines missing data still export
    var check;
    if (!lines.length) check = '<p class="lx-ok idle">Choose lines first. Lines missing data are listed here; they still export, with those cells blank.</p>';
    else if (bad.length) check = '<div class="lx-errors" role="alert"><b>' + emoji('⚠️') + plural(bad.length, 'line') + ' missing data · they export with those cells blank</b><ul>' + bad.map(function (e) {
      return '<li><button data-action="lx-goto" data-arg="' + e.stt + '">' + subNo(e) + ' · ' + esc(e.vessel) + '</button>: ' + esc(e.missing.join('; ')) + '</li>';
    }).join('') + '</ul></div>';
    else check = '<p class="lx-ok">' + I.check + 'All ' + plural(lines.length, 'line') + ' complete</p>';

    var block = !lines.length ? '' : X.mode === 'selected' && lines.length > 500 ? 'At most 500 ticked lines per export. Use a date range for more.' : !nCols ? 'Choose at least one column.' : '';
    var ready = lines.length && !block;
    return ledgerPage('ledger/export', 'An .xlsx file with the ledger’s A–' + D.ledgerColumns[D.ledgerColumns.length - 1][0] + ' columns. Amounts and dates are real numbers and dates.',
      '<section class="lx-step"><h3><i>1</i>Lines</h3><div class="cfg-seg lx-mode">' +
        chip('Ticked (' + Object.keys(L.sel).length + ')', X.mode === 'selected', 'lx-mode', 'selected') + chip('Date range', X.mode === 'range', 'lx-mode', 'range') + '</div>' + pick + '</section>' +
      // Columns as a checklist in sheet order (A→P), with the Excel header each one gets.
      '<section class="lx-step"><h3><i>2</i>Columns in the file<small>' + nCols + ' of ' + all + '</small><button data-action="lx-all">' + (nCols === all ? 'Clear all' : 'Select all') + '</button></h3><div class="lx-cols">' + D.ledgerColumns.map(function (c) {
        var on = X.cols.indexOf(c[1]) >= 0;
        return '<button class="lx-col' + (on ? ' on' : '') + '" role="checkbox" aria-checked="' + on + '" data-action="lx-col" data-arg="' + c[1] + '"><span class="lx-box">' + (on ? I.check : '') + '</span><b>' + c[0] + '</b><span class="lx-name">' + esc(c[2]) + '</span></button>';
      }).join('') + '</div></section>' +
      '<section class="lx-step"><h3><i>3</i>Missing data</h3>' + check + '</section>' +
      '<div class="lx-foot">' + (block ? '<p>' + esc(block) + '</p>' : '') +
        '<button class="pill-btn primary block lx-go" data-action="lx-run"' + (ready ? '' : ' disabled') + '>' + I.fileXls + 'Generate Excel' + (lines.length ? ' · ' + plural(lines.length, 'line') : '') + '</button></div>', 'lx');
  };

  api.actions['lx-mode'] = function (el) { X.mode = el.dataset.arg; api.render(); };
  api.actions['lx-col'] = function (el) {
    var k = el.dataset.arg;
    var at = X.cols.indexOf(k);
    if (at >= 0) X.cols.splice(at, 1); else X.cols.push(k);
    api.render();
  };
  api.actions['lx-all'] = function () { X.cols = X.cols.length === D.ledgerColumns.length ? [] : D.ledgerColumns.map(function (c) { return c[1]; }); api.render(); };
  // Opens the line's own month with the other filters cleared, so the line to fix is sure to show.
  api.actions['lx-goto'] = function (el) {
    var line = P.ledger.filter(function (l) { return String(l.stt) === String(el.dataset.arg); })[0];
    L.months = line ? [monthOf(line)] : L.months.length ? L.months : L.lastMonths.slice();
    L.customers = []; L.from = L.to = ''; L.missing = false; api.state.search = String(el.dataset.arg); api.go('ledger');
  };
  document.addEventListener('change', function (e) { if (e.target.matches('[data-lx]')) { X[e.target.dataset.lx] = e.target.value; api.render(); } });

  api.actions['lx-run'] = function () {
    if (!canWork()) return api.toast('Your role cannot export');
    var lines = exportLines();
    if (!lines.length) return api.toast(X.mode === 'selected' ? 'Tick lines on the Lines tab first' : 'No lines in this range');
    // The 500 cap is for lines ticked by hand; a date range exports every line in it.
    if (X.mode === 'selected' && lines.length > 500) return api.toast('At most 500 ticked lines per export');
    if (!X.cols.length) return api.toast('Choose at least one column');
    var d = new Date();
    var stamp = d.toLocaleDateString('en-GB') + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    P.ledgerFiles.unshift({ name: 'ledger_' + (X.mode === 'range' ? X.from + '_' + X.to : lines.length + '-lines') + '.xlsx', kind: 'manual', rows: lines.length, by: api.user.name, at: stamp });
    keep('ledgerFiles');
    api.toast('Excel file generated · ' + lines.length + ' lines');
    api.go('ledger/files');
  };

  // ---------- files (P4) ----------

  var fileKind = 'all';
  api.views['ledger/files'] = function () {
    var list = P.ledgerFiles.filter(function (f) { return (fileKind === 'all' || f.kind === fileKind) && api.matches(f.name + ' ' + f.by); });
    return ledgerPage('ledger/files', 'Exports made by hand and by the daily job (tickets DONE that day). Kept for 24 months.', api.dataTable({
      source: P.ledgerFiles, list: list, noun: 'file', placeholder: 'Search file or person…',
      tools: '<div class="lg-tools"><div class="dt-chips">' + [['all', 'All'], ['manual', 'Made by hand'], ['cron', 'Daily job']].map(function (k) {
        return chip(k[1], fileKind === k[0], 'lf-kind', k[0]);
      }).join('') + '</div></div>',
      cols: [
        { key: 'name', label: 'File', sort: 'text', cell: function (f) { return '<span class="dt-file">' + I.xls + '<b>' + esc(f.name) + '</b></span>'; } },
        { key: 'kind', label: 'Made by', sort: 'text', cell: function (f) { return f.kind === 'cron' ? 'Daily job' : 'Hand'; } },
        { key: 'rows', label: 'Lines', sort: 'number', cls: 'num' },
        { key: 'by', label: 'By', sort: 'text' },
        { key: 'at', label: 'Created', sort: 'datetime' }
      ],
      actions: canWork() ? function () { return api.btn('', 'data-action="download"', I.download + 'Download'); } : null
    }));
  };
  api.actions['lf-kind'] = function (el) { fileKind = el.dataset.arg; api.render(); };

  // ---------- AI suggestions (P5) ----------

  // ✨ AI suggest reads the notes of the lines on screen against the active rules and lists what it would change:
  // set the invoice customer ("Invoice to: …") or split off a sub-ticket ("50% CGM", "1 tug for HG/ONE").
  // It never changes a line by itself; ADMIN or an accountant accepts or declines each suggestion.
  // (Demo: a few note patterns stand in for the AI.)
  function findCust(text) {
    var t = String(text || '').trim().toUpperCase().replace(/[\s.,]+$/, '');
    if (!t) return null;
    return P.customers.filter(function (c) { return c.name.toUpperCase() === t || c.short.toUpperCase() === t; })[0] ||
      P.customers.filter(function (c) { return t.indexOf(c.name.toUpperCase()) === 0 || c.name.toUpperCase().indexOf(t) === 0; })[0] || null;
  }

  function suggestFor(l, rules) {
    var out = [];
    var note = l.note || '';
    var to = /invoice to\s*:?\s*([^\/\n]+)/i.exec(note);
    var c = to && findCust(to[1]);
    if (rules.r2 && c && c.id !== l.invoice) out.push({ kind: 'invoice', suggest: c.id, rule: 'r2', text: 'Set the invoice customer of ' + subNo(l) + ' · ' + l.vessel + ' to ' + c.name });
    var pc = /(\d{1,2})\s*%\s*([A-Z][A-Z&.\/ ]*)/i.exec(note);
    var tg = /(\d+)\s*tugs?\s+(?:for|to)\s+([A-Z][A-Z&.\/]*)/i.exec(note);
    var m = pc || tg;
    var s = m && findCust(m[2]);
    if (rules.r1 && s && s.id !== l.invoice) {
      var tugs = l.tugs || 1;
      var p = { kind: 'split', suggest: s.id, rule: 'r1' };
      if (tg) p.tugs = Math.min(Number(tg[1]), tugs - 1);
      else if (tugs > 1) p.tugs = Math.max(1, Math.round(tugs * Number(pc[1]) / 100));
      else p.share = Number(pc[1]);
      p.text = 'Split ' + subNo(l) + ' · ' + l.vessel + ': ' + (p.share ? p.share + '%' : p.tugs + ' of ' + tugs + ' tugboats') + ' to ' + s.name;
      if (p.share || (p.tugs >= 1 && p.tugs < tugs)) out.push(p);
    }
    return out;
  }

  api.actions['ai-run'] = function () {
    if (!canApprove()) return;
    var rules = {};
    P.splitRules.forEach(function (r) { if (r.active) rules[r.id] = true; });
    var lines = ledgerRows();
    var seen = function (l, x) { return P.splitProposals.some(function (p) { return p.stt === l.stt && p.sub === l.sub && p.kind === x.kind && p.suggest === x.suggest; }); };
    var stamp = new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    var added = 0;
    lines.forEach(function (l) {
      suggestFor(l, rules).forEach(function (x) {
        if (seen(l, x)) return;
        P.splitProposals.unshift(Object.assign(x, { id: 's' + Date.now() + '-' + added, stt: l.stt, sub: l.sub, status: 'pending', at: stamp }));
        added++;
      });
    });
    keep('splitProposals');
    api.toast(added ? 'AI read ' + plural(lines.length, 'note') + ' · ' + plural(added, 'new suggestion') : 'AI read ' + plural(lines.length, 'note') + ' · nothing new to suggest');
    if (added) api.go('ledger/ai'); else api.render();
  };

  api.views['ledger/ai'] = function () {
    var list = P.splitProposals.slice().sort(function (a, b) { return (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1); });
    var work = canApprove();
    var n = pendingAi();
    var bar = '<div class="ai-bar">' + (work ? '<button class="lg-ai" data-action="ai-run">' + emoji('✨') + 'AI suggest</button>' : '') +
      '<span>' + (n ? plural(n, 'suggestion') + ' waiting for review' : 'Nothing waiting for review') + ' · reads the ' + esc(L.months.length ? sortMonths(L.months).join(', ') : 'chosen period') + ' lines</span>' +
      (work && n ? '<button class="ai-all" data-action="ai-no-all">Decline all</button>' : '') + '</div>';
    return ledgerPage('ledger/ai', 'Press AI suggest: the AI reads the ticket notes against the AI split rules and lists what it would change. Nothing changes until you accept.',
      bar + (list.length ? list.map(function (p) {
        var l = P.ledger.filter(function (x) { return x.stt === p.stt && x.sub === (p.sub || 1); })[0] || P.ledger.filter(function (x) { return x.stt === p.stt; })[0] || {};
        var rule = byId(P.splitRules, p.rule) || {};
        return '<div class="card ai-card' + (p.status === 'pending' ? '' : ' done') + '"><div class="ai-top"><b>' + emoji(p.kind === 'invoice' ? '🧾' : '➗') + esc(p.text) + '</b>' +
          (p.status === 'pending' ? '<span class="ai-new">to review</span>' : '<span class="ai-st">' + (p.status === 'accepted' ? 'Accepted' : 'Declined') + (p.by ? ' · ' + esc(p.by) : '') + '</span>') + '</div>' +
          '<p class="ai-line">Ticket note: <i>' + esc(l.note || '-') + '</i></p><p class="ai-line">Matched rule: ' + esc(rule.text || '-') + '</p><p class="ai-line muted">Suggested ' + esc(p.at) + '</p>' +
          (p.status === 'pending' && !work ? '<p class="ai-line muted">Waiting for ADMIN or an accountant to accept or decline.</p>' : '') +
          (p.status === 'pending' && work ? '<div class="two-btns"><button class="pill-btn primary" data-action="ai-yes" data-arg="' + p.id + '">Accept</button><button class="pill-btn outline dark" data-action="ai-no" data-arg="' + p.id + '">Decline</button></div>' : '') + '</div>';
      }).join('') : '<p class="adm-empty">No suggestions yet.' + (work ? ' Press ✨ AI suggest to read the notes.' : '') + '</p>'));
  };

  function decide(p, status) {
    p.status = status;
    p.by = api.user.name;
    keep('splitProposals');
  }

  api.actions['ai-yes'] = function (el) {
    if (!canApprove()) return;
    var p = byId(P.splitProposals, el.dataset.arg);
    var l = P.ledger.filter(function (x) { return x.stt === p.stt && x.sub === (p.sub || 1); })[0] ||
      P.ledger.filter(function (x) { return x.stt === p.stt; }).sort(function (a, b) { return b.tugs - a.tugs; })[0];
    if (!l) return api.toast('No. ' + p.stt + ' is no longer on the ledger');
    if (p.kind === 'invoice') {
      l.invoice = p.suggest;
      if (l.status === 'pending') l.status = 'provisional';
      keep('ledger');
      decide(p, 'accepted');
      api.render();
      return api.toast('Invoice customer · ' + custName(p.suggest));
    }
    // A split opens the sub-ticket form filled in with the suggestion, to check before it is made.
    splitDialog(l, p.suggest, function () { decide(p, 'accepted'); }, p.tugs || p.share);
  };
  api.actions['ai-no'] = function (el) {
    if (!canApprove()) return;
    decide(byId(P.splitProposals, el.dataset.arg), 'rejected');
    api.render();
    api.toast('Suggestion declined');
  };
  api.actions['ai-no-all'] = function () {
    if (!canApprove()) return;
    P.splitProposals.forEach(function (p) { if (p.status === 'pending') decide(p, 'rejected'); });
    api.render();
    api.toast('All suggestions declined');
  };

  // ---------- admin: customers, agents, tax codes (P1) ----------

  var tagList = function (names) { return names.length ? '<span class="dt-tags">' + names.map(function (n) { return '<span>' + esc(n) + '</span>'; }).join('') + '</span>' : '<span class="dt-muted">-</span>'; };
  var agentItem = function (a) { return { value: a.id, label: a.name, sub: a.contact + ' · ' + a.phone, title: a.name + ' · ' + a.contact + ' · ' + a.phone }; };
  var taxItem = function (t) {
    var users = P.customers.filter(function (c) { return c.taxCode === t.code; }).map(function (c) { return c.short; });
    return { value: t.code, label: t.code, sub: t.legal + (users.length ? ' · used by ' + users.join(', ') : ''), title: t.legal + ' · ' + t.address };
  };
  var clientAccounts = function () { return api.state.users.filter(function (u) { return u.role === 'CLIENT'; }); };
  var linkedEmails = function () { return [].concat.apply([], P.customers.map(function (c) { return c.accounts || []; })); };

  // Other modules add to these tables (buoys-setup.js: the cargo-owner tabs on Customers, the PDA / FDA email
  // columns on Agents): api.tableExtra[route] = { tools() -> html, cols() -> [col], actions(row, i) -> html }.
  api.tableExtra = api.tableExtra || {};
  var extra = function (route) { return api.tableExtra[route] || {}; };

  api.views['admin/customers'] = function () {
    var ex = extra('admin/customers');
    var unlinked = clientAccounts().filter(function (u) { return linkedEmails().indexOf(u.email) < 0; });
    var table = api.dataTable({
      source: P.customers, noun: 'customer', placeholder: 'Search customer, short name, tax code…',
      list: P.customers.filter(function (c) { return api.matches([c.name, c.short, c.taxCode].join(' ')); }),
      add: canWork() ? { action: 'cu-new', label: 'Add customer' } : null,
      cols: [
        { key: 'name', label: 'Customer', sort: 'text', cell: function (c) { return '<b>' + esc(c.name) + '</b> <span class="dt-muted">· ' + esc(c.short) + '</span>'; } },
        { key: 'taxCode', label: 'Tax code', sort: 'text', cell: function (c) {
          var sw = sharedWith(c);
          return esc(c.taxCode) + (sw.length ? '<small class="lg-diff">shared with ' + esc(sw.join(', ')) + '</small>' : '');
        } },
        { key: 'vat', label: 'VAT', sort: 'number', cls: 'num', cell: function (c) { return c.vat + '%'; } },
        { key: 'agents', label: 'Agents', cell: function (c) { return tagList((c.agents || []).map(function (a) { return (byId(P.agents, a) || {}).name; })); } },
        { key: 'defaultAgent', label: 'Default agent', cell: function (c) { return api.dash((byId(P.agents, defaultAgent(c)) || {}).name); } },
        { key: 'accounts', label: 'Client accounts', cell: function (c) { return tagList(c.accounts || []); } }
      ],
      tools: (ex.tools ? ex.tools() : '') + (canWork() ? '' : viewOnly('customers are edited by ADMIN and accountants')),
      actions: canWork() ? function (c, i) { return api.btn('', 'data-action="cu-edit" data-arg="' + i + '"', 'Edit'); } : null
    });
    return api.deskPage('Customers', 'Who is invoiced. A linked client account gets its customer and default agent filled in on every ticket.', table +
      '<h3 class="files-title">Client accounts not linked (' + unlinked.length + ')</h3><p class="section-sub" style="margin:-6px 0 10px">Tickets from these accounts need the accountant to fill in the customer.</p>' +
      (unlinked.length ? '<div class="list">' + unlinked.map(function (u) {
        return '<div class="card lk-card"><div><b>' + esc(u.name) + '</b><span>' + esc(u.email) + '</span></div>' + (canWork() ? '<button class="pill-btn outline" data-action="cu-link" data-arg="' + esc(u.email) + '">Link…</button>' : '') + '</div>';
      }).join('') + '</div>' : '<p class="adm-empty">Every client account is linked.</p>'));
  };

  // P · Agent of a ledger line: the one on its ticket, else the ordering customer's default agent.
  function lineAgent(l) {
    return l.agent || defaultAgent(cust(l.customer) || {});
  }

  // P1: the agent a linked client's tickets get by default. Set explicitly on the customer; older records
  // without one fall back to their first agent.
  function defaultAgent(c) {
    var agents = c.agents || [];
    return c.defaultAgent && agents.indexOf(c.defaultAgent) >= 0 ? c.defaultAgent : agents[0] || '';
  }
  api.defaultAgent = defaultAgent;

  // onSaved(customer): called after a save (the ledger picker sets the new customer on its line).
  function customerDialog(index, onSaved) {
    var isNew = index == null;
    var c = isNew ? { vat: 10, agents: [], accounts: [] } : P.customers[index];
    api.editDialog({
      title: isNew ? 'New customer' : 'Edit ' + c.name, values: Object.assign({}, c, { vat: String(c.vat), defaultAgent: isNew ? '' : defaultAgent(c) }),
      fields: [
        { name: 'name', label: 'Customer name', req: true },
        { name: 'short', label: 'Short name', req: true, half: true },
        { name: 'vat', label: 'VAT', type: 'select', half: true, options: [0, 5, 8, 10].map(function (v) { return { value: String(v), label: v + '%' }; }) },
        { name: 'taxCode', label: 'Tax code (one per customer, may be shared)', type: 'one', req: true, options: P.taxCodes.map(taxItem) },
        { name: 'agents', label: 'Agents (also editable from Agents)', type: 'multi', options: P.agents.map(agentItem) },
        { name: 'defaultAgent', label: 'Default agent (filled in on this customer’s tickets)', type: 'one', options: [{ value: '', label: 'None', sub: 'The ticket leaves the agent empty' }].concat(P.agents.map(agentItem)), hint: 'Must be one of the agents ticked above.' },
        { name: 'accounts', label: 'Client accounts', type: 'multi', options: clientAccounts().map(function (u) { return { value: u.email, label: u.name, sub: u.email }; }) }
      ],
      onSave: function (v) {
        var taken = P.customers.filter(function (x) { return x !== c; }).filter(function (x) { return v.accounts.some(function (a) { return (x.accounts || []).indexOf(a) >= 0; }); });
        if (taken.length) return { error: 'An account can belong to one customer only; already linked to ' + taken[0].name + '.' };
        if (v.defaultAgent && v.agents.indexOf(v.defaultAgent) < 0) return { error: 'The default agent must be one of the agents ticked above.' };
        var row = Object.assign({}, c, { name: v.name, short: v.short, vat: Number(v.vat), taxCode: v.taxCode, agents: v.agents, accounts: v.accounts, defaultAgent: v.defaultAgent || null });
        if (isNew) { row.id = 'c' + Date.now(); P.customers.push(row); } else P.customers[index] = row;
        keep('customers');
        api.toast('Customer saved');
        if (onSaved) onSaved(row);
      }
    });
  }

  api.actions['cu-new'] = function () { customerDialog(); };
  api.actions['cu-edit'] = function (el) { customerDialog(Number(el.dataset.arg)); };
  api.actions['cu-link'] = function (el) {
    var email = el.dataset.arg;
    api.picker({ title: 'Link ' + email + ' to a customer', items: P.customers.map(custItem), value: '', onPick: function (id) {
      var c = cust(id);
      (c.accounts = c.accounts || []).push(email);
      keep('customers');
      api.render();
      api.toast('Linked to ' + c.name);
    } });
  };

  api.views['admin/agents'] = function () {
    var ex = extra('admin/agents');
    return api.deskPage('Agents', 'Who orders. An agent can work for several customers, and a customer can have several agents.' + (ex.sub || ''), api.dataTable({
      source: P.agents, noun: 'agent', placeholder: 'Search agent or contact…',
      list: P.agents.filter(function (a) { return api.matches(a.name + ' ' + a.contact); }),
      add: canWork() ? { action: 'ag-new', label: 'Add agent' } : null, tools: (ex.tools ? ex.tools() : '') + (canWork() ? '' : viewOnly('agents are edited by ADMIN and accountants')),
      cols: [
        { key: 'name', label: 'Agent', sort: 'text', cell: function (a) { return '<b>' + esc(a.name) + '</b>'; } },
        { key: 'contact', label: 'Contact', sort: 'text' },
        { key: 'phone', label: 'Phone', sort: 'text' },
        { key: 'customers', label: 'Customers', cell: function (a) { return tagList(P.customers.filter(function (c) { return (c.agents || []).indexOf(a.id) >= 0; }).map(function (c) { return c.short; })); } }
      ].concat(ex.cols ? ex.cols() : []),
      actions: !canWork() ? null : function (a, i) { return api.btn('', 'data-action="ag-edit" data-arg="' + i + '"', 'Edit') + (ex.actions ? ex.actions(a, i) : ''); }
    }));
  };

  function agentDialog(index) {
    var isNew = index == null;
    var a = isNew ? {} : P.agents[index];
    api.editDialog({
      title: isNew ? 'New agent' : 'Edit ' + a.name,
      values: Object.assign({}, a, { customers: isNew ? [] : P.customers.filter(function (c) { return (c.agents || []).indexOf(a.id) >= 0; }).map(function (c) { return c.id; }) }),
      fields: [
        { name: 'name', label: 'Agent name', req: true },
        { name: 'contact', label: 'Contact person', half: true },
        { name: 'phone', label: 'Phone', half: true },
        { name: 'customers', label: 'Customers (also editable from Customers)', type: 'multi', options: P.customers.map(custItem) }
      ],
      onSave: function (v) {
        var row = Object.assign({}, a, { name: v.name, contact: v.contact, phone: v.phone });
        if (isNew) { row.id = 'a' + Date.now(); P.agents.push(row); } else P.agents[index] = row;
        // The link lives on the customer, so both screens edit the same pairs.
        P.customers.forEach(function (c) {
          var list = (c.agents || []).filter(function (x) { return x !== row.id; });
          if (v.customers.indexOf(c.id) >= 0) list.push(row.id);
          c.agents = list;
        });
        keep('agents'); keep('customers');
        api.toast('Agent saved');
      }
    });
  }
  api.actions['ag-new'] = function () { agentDialog(); };
  api.actions['ag-edit'] = function (el) { agentDialog(Number(el.dataset.arg)); };

  api.views['admin/tax-codes'] = function () {
    return api.deskPage('Tax Codes', 'Each customer has one tax code; one tax code may be shared by several customers.', api.dataTable({
      source: P.taxCodes, noun: 'tax code', placeholder: 'Search tax code or legal name…',
      list: P.taxCodes.filter(function (t) { return api.matches(t.code + ' ' + t.legal); }),
      add: canWork() ? { action: 'tx-new', label: 'Add tax code' } : null, tools: canWork() ? '' : viewOnly('tax codes are edited by ADMIN and accountants'),
      cols: [
        { key: 'code', label: 'Tax code', sort: 'text', cell: function (t) { return '<b>' + esc(t.code) + '</b>'; } },
        { key: 'legal', label: 'Legal name', sort: 'text' },
        { key: 'address', label: 'Address', sort: 'text' },
        { key: 'used', label: 'Used by', cell: function (t) {
          var users = P.customers.filter(function (c) { return c.taxCode === t.code; }).map(function (c) { return c.name; });
          return tagList(users) + (users.length > 1 ? '<small class="lg-diff">shared by ' + users.length + ' customers</small>' : '');
        } }
      ],
      actions: !canWork() ? null : function (t, i) { return api.btn('', 'data-action="tx-edit" data-arg="' + i + '"', 'Edit'); }
    }));
  };
  function taxDialog(index) {
    var isNew = index == null;
    var t = isNew ? {} : P.taxCodes[index];
    api.editDialog({
      title: isNew ? 'New tax code' : 'Edit ' + t.code, values: t,
      fields: [{ name: 'code', label: 'Tax code', req: true }, { name: 'legal', label: 'Legal name', req: true }, { name: 'address', label: 'Address' }],
      onSave: function (v) {
        if (!/^\d{10}(-\d{3})?$/.test(v.code)) return { error: 'A tax code is 10 digits (or 10 digits-3 digits for a branch).' };
        if (P.taxCodes.some(function (x) { return x !== t && x.code === v.code; })) return { error: 'This tax code already exists.' };
        if (!isNew && v.code !== t.code) P.customers.forEach(function (c) { if (c.taxCode === t.code) c.taxCode = v.code; });
        var row = { code: v.code, legal: v.legal, address: v.address };
        if (isNew) P.taxCodes.push(row); else P.taxCodes[index] = row;
        keep('taxCodes'); keep('customers');
        api.toast('Tax code saved');
      }
    });
  }
  api.actions['tx-new'] = function () { taxDialog(); };
  api.actions['tx-edit'] = function (el) { taxDialog(Number(el.dataset.arg)); };

  // ---------- admin: price table (P2) ----------

  var anyText = '<span class="dt-muted">any</span>';
  api.views['admin/price-table'] = function () {
    return api.deskPage('Price Table', 'Customer × area / port × service × DWT × LOA. Each price has the day it takes effect, with no end: a new price is a new row with a later date, and the latest one on or before the service day applies. A blank condition matches anything.', api.dataTable({
      source: P.priceRows, noun: 'price row', placeholder: 'Search customer, port, service…',
      list: P.priceRows.filter(function (p) { return api.matches([custName(p.customer), p.area, p.port, svc(p.service).name].join(' ')); }),
      add: canWork() ? { action: 'pr-new', label: 'Add price' } : null,
      tools: '<div class="dt-chips"><button data-action="pr-test">' + emoji('🔎') + 'Test a lookup</button></div>' + (canWork() ? '' : viewOnly('prices are edited by ADMIN and accountants')),
      cols: [
        { key: 'customer', label: 'Customer', sort: 'text', cell: function (p) { return p.customer ? esc((cust(p.customer) || {}).short) : anyText; } },
        { key: 'port', label: 'Area / port', sort: 'text', cell: function (p) { return p.port ? esc(p.port) : p.area ? esc(p.area) : anyText; } },
        { key: 'service', label: 'Service', sort: 'text', cell: function (p) { return esc(svc(p.service).name); } },
        { key: 'dwt', label: 'DWT', cell: function (p) { return esc(rangeText('DWT', p.dwtMin, p.dwtMax)); } },
        { key: 'loa', label: 'LOA', cell: function (p) { return esc(rangeText('LOA', p.loaMin, p.loaMax)); } },
        { key: 'price', label: 'Price / tug', sort: 'number', cls: 'num', cell: function (p) { return '<b>' + money(p.price, p.currency) + '</b>'; } },
        { key: 'from', label: 'Effective from', sort: 'datetime', cell: function (p) {
          var later = P.priceRows.filter(function (o) { return o !== p && sameKey(o, p) && dkey(o.from) > dkey(p.from); }).length;
          return esc(p.from) + (later ? '<small class="lg-diff"' + tip('A row with the same conditions and a later date applies from that day') + '>replaced later</small>' : '');
        } }
      ],
      actions: !canWork() ? null : function (p, i) { return api.btn('', 'data-action="pr-edit" data-arg="' + i + '"', 'Edit') + api.btn('danger', 'data-action="pr-del" data-arg="' + i + '"', 'Delete'); }
    }));
  };

  // One dimension of two price rows: overlap (shared stretch), touch (one shared end), adjacent (no gap) or gap.
  function relation(aMin, aMax, bMin, bMax, step) {
    var lo = Math.max(aMin == null ? -Infinity : aMin, bMin == null ? -Infinity : bMin);
    var hi = Math.min(aMax == null ? Infinity : aMax, bMax == null ? Infinity : bMax);
    if (lo < hi) return 'overlap';
    if (lo === hi) return 'touch';
    return lo - hi <= step ? 'adjacent' : 'gap';
  }

  // Same customer, place and service: rows that compete on DWT / LOA.
  function sameKey(a, b) { return a.customer === b.customer && a.area === b.area && a.port === b.port && a.service === b.service; }

  // Real overlaps are blocked; a shared end or a gap only warns. Only rows taking effect on the same day compete:
  // a later date is a new version of the price, not an overlap.
  function checkRanges(row, others) {
    var warn = [];
    for (var i = 0; i < others.length; i++) {
      var o = others[i];
      if (!sameKey(o, row) || dkey(o.from) !== dkey(row.from)) continue;
      var d = relation(row.dwtMin, row.dwtMax, o.dwtMin, o.dwtMax, 1);
      var l = relation(row.loaMin, row.loaMax, o.loaMin, o.loaMax, 0.01);
      var desc = rangeText('DWT', o.dwtMin, o.dwtMax) + ', ' + rangeText('LOA', o.loaMin, o.loaMax) + ' (' + money(o.price, o.currency) + ')';
      if (d === 'overlap' && l === 'overlap') return { error: 'Overlaps an existing row: ' + desc + '. Change a range so they no longer share values.' };
      if ((d === 'touch' || l === 'touch') && d !== 'gap' && l !== 'gap' && d !== 'adjacent' && l !== 'adjacent') warn.push('shares an end value with ' + desc);
      else if ((d === 'gap' && l !== 'gap') || (l === 'gap' && d !== 'gap')) warn.push('leaves a gap next to ' + desc);
    }
    return warn.length ? { warn: 'Check: this row ' + warn.join('; ') + '. Save anyway if that is intended.' } : null;
  }

  function priceDialog(index) {
    var isNew = index == null;
    var p = isNew ? { currency: 'VND', service: 'mano_in', from: '' } : P.priceRows[index];
    var show = function (n) { return n == null ? '' : n; };
    var ports = Object.keys(D.portLocations);
    // The date picker works in yyyy-mm-dd; price rows keep dd/mm/yyyy.
    var iso = dkey(p.from);
    api.editDialog({
      title: isNew ? 'New price' : 'Edit price', cls: 'ed-tidy pr-dlg',
      values: Object.assign({}, p, { customer: p.customer || '', area: p.area || '', port: p.port || '', dwtMin: show(p.dwtMin), dwtMax: show(p.dwtMax), loaMin: show(p.loaMin), loaMax: show(p.loaMax),
        price: p.price == null ? '' : Number(p.price).toLocaleString('en-US', { maximumFractionDigits: 3 }), from: iso ? iso.slice(0, 4) + '-' + iso.slice(4, 6) + '-' + iso.slice(6) : '' }),
      fields: [
        { type: 'section', label: 'Applies to', hint: 'Blank = any' },
        { name: 'customer', label: 'Customer', type: 'pick', options: [{ value: '', label: 'Any customer', sub: 'The row applies to every customer' }].concat(P.customers.map(custItem)) },
        { name: 'service', label: 'Service', type: 'select', options: D.services.map(function (s) { return { value: s.code, label: s.name }; }) },
        { name: 'area', label: 'Area', type: 'select', half: true, options: [{ value: '', label: 'Any area' }].concat(D.boardLocations.map(function (a) { return { value: a, label: a }; })) },
        { name: 'port', label: 'Port', type: 'select', half: true, options: [{ value: '', label: 'Any port' }].concat(ports.map(function (x) { return { value: x, label: x + ' · ' + D.portLocations[x] }; })) },
        { type: 'section', label: 'Vessel size', hint: 'Both ends included' },
        { name: 'dwt', label: 'DWT', type: 'range', sep: '–', cls: 'ed-inline' },
        { name: 'loa', label: 'LOA (m)', type: 'range', sep: '–', cls: 'ed-inline' },
        { type: 'section', label: 'Price' },
        { name: 'price', label: 'Per tugboat', req: true, cls: 'ed-grow', placeholder: '18,500,000', hint: 'Type 80k for 80,000' },
        { name: 'currency', label: 'Currency', type: 'select', cls: 'ed-cur', options: P.currencies.map(function (c) { return { value: c.code, label: c.code }; }) },
        { name: 'from', label: 'Effective from', type: 'date', req: true, hint: 'No end date: a later row with the same conditions replaces it from its own date.' }
      ],
      onSave: function (v, force) {
        var ymd = /^(\d{4})-(\d\d)-(\d\d)$/.exec(v.from);
        v.from = ymd ? ymd[3] + '/' + ymd[2] + '/' + ymd[1] : '';
        var n = {};
        var bad = ['dwtMin', 'dwtMax', 'loaMin', 'loaMax', 'price'].filter(function (k) { n[k] = parseNum(v[k]); return n[k] === undefined; });
        if (bad.length) return { error: 'Not a number: ' + bad.join(', ') + '. Use digits, or 80k / 1.5m.' };
        if (!n.price || n.price <= 0) return { error: 'The price must be above 0.' };
        if (n.dwtMin != null && n.dwtMax != null && n.dwtMin > n.dwtMax) return { error: 'DWT: the minimum is above the maximum.' };
        if (n.loaMin != null && n.loaMax != null && n.loaMin > n.loaMax) return { error: 'LOA: the minimum is above the maximum.' };
        if (!dkey(v.from)) return { error: 'The date is dd/mm/yyyy.' };
        if (v.port && v.area && D.portLocations[v.port] !== v.area) return { error: 'Port ' + v.port + ' is not in ' + v.area + '. Set the port or the area, not both.' };
        var row = Object.assign({}, p, { customer: v.customer, area: v.port ? '' : v.area, port: v.port, service: v.service, currency: v.currency, from: v.from }, n);
        delete row.to;
        var check = checkRanges(row, P.priceRows.filter(function (x) { return x !== p; }));
        if (check && check.error) return check;
        if (check && check.warn && !force) return check;
        if (isNew) { row.id = 'p' + Date.now(); P.priceRows.push(row); } else P.priceRows[index] = row;
        keep('priceRows');
        api.toast('Price saved');
      }
    });
  }
  api.actions['pr-new'] = function () { priceDialog(); };
  api.actions['pr-edit'] = function (el) { priceDialog(Number(el.dataset.arg)); };
  api.actions['pr-del'] = function (el) {
    api.confirmDialog('Delete this price row?', 'Lookups that matched it will look for another row. This cannot be undone.', 'Delete', function () { P.priceRows.splice(Number(el.dataset.arg), 1); keep('priceRows'); api.render(); api.toast('Price row deleted'); });
  };
  api.actions['pr-test'] = function () {
    api.editDialog({
      title: 'Test a lookup', text: 'Finds the price a ledger line would get, or says which step does not match.', okLabel: 'Look up',
      values: { date: '01/10/2026', service: 'mano_in', port: 'GML', customer: 'c1', dwt: '42200', loa: '220.3' },
      fields: [
        { name: 'customer', label: 'Invoice customer', type: 'one', options: P.customers.map(custItem) },
        { name: 'service', label: 'Service', type: 'select', options: D.services.map(function (s) { return { value: s.code, label: s.name }; }) },
        { name: 'port', label: 'Port', type: 'select', half: true, options: Object.keys(D.portLocations).concat(['PVC-MS', 'CU LAO TAO']).map(function (x) { return { value: x, label: x }; }) },
        { name: 'date', label: 'Date', half: true },
        { name: 'dwt', label: 'DWT', half: true }, { name: 'loa', label: 'LOA', half: true },
        { label: 'Result', type: 'html', html: '<div class="pr-result" aria-live="polite">-</div>' }
      ],
      onSave: function (v) {
        var r = lookup({ customer: v.customer, service: v.service, port: v.port, date: v.date, dwt: parseNum(v.dwt), loa: parseNum(v.loa) });
        var out = document.querySelector('.pr-result');
        out.className = 'pr-result ' + (r.error ? 'err' : 'ok');
        out.textContent = r.error ? r.error : money(r.row.price, r.row.currency) + ' per tugboat · ' + [r.row.customer ? custName(r.row.customer) : 'any customer', r.row.port || r.row.area || 'any place', rangeText('DWT', r.row.dwtMin, r.row.dwtMax), rangeText('LOA', r.row.loaMin, r.row.loaMax), 'effective from ' + r.row.from].join(' · ');
        return { stay: true }; // the result shows in the dialog, which stays open
      }
    });
  };

  // ---------- admin: currencies & exchange rates (P2) ----------

  var rateTabs = function (cur) {
    return '<div class="dt-chips">' + chip('Currencies', cur === 'cur', 'go-rate', 'admin/currencies') + chip('Exchange rates', cur === 'fx', 'go-rate', 'admin/fx-rates') + '</div>';
  };
  api.actions['go-rate'] = function (el) { api.go(el.dataset.arg); };

  api.views['admin/currencies'] = function () {
    return api.deskPage('Currencies & Rates', 'Decimals follow the currency (VND 0, USD 2), in the app and in Excel.', api.dataTable({
      source: P.currencies, list: P.currencies.filter(function (c) { return api.matches(c.code + ' ' + c.name); }), noun: 'currency', placeholder: 'Search currency…',
      tools: rateTabs('cur') + (canWork() ? '' : viewOnly('edited by ADMIN and accountants')), add: canWork() ? { action: 'cur-new', label: 'Add currency' } : null,
      cols: [{ key: 'code', label: 'Code', sort: 'text', cell: function (c) { return '<b>' + esc(c.code) + '</b>'; } }, { key: 'name', label: 'Name', sort: 'text' }, { key: 'decimals', label: 'Decimals', sort: 'number', cls: 'num' },
        { key: 'ex', label: 'Example', cls: 'num', cell: function (c) { return money(1234567.891, c.code); } }],
      actions: !canWork() ? null : function (c, i) { return api.btn('', 'data-action="cur-edit" data-arg="' + i + '"', 'Edit'); }
    }));
  };
  api.views['admin/fx-rates'] = function () {
    return api.deskPage('Currencies & Rates', 'One rate per day; a line uses the rate of its service day (or the last one before it).', api.dataTable({
      source: P.fxRates, list: P.fxRates.filter(function (r) { return api.matches(r.date + ' ' + r.from); }), noun: 'rate', placeholder: 'Search date…', sort: ['date', -1],
      tools: rateTabs('fx') + (canWork() ? '' : viewOnly('edited by ADMIN and accountants')), add: canWork() ? { action: 'fx-new', label: 'Add rate' } : null,
      cols: [{ key: 'date', label: 'Date', sort: 'datetime' }, { key: 'pair', label: 'Pair', cell: function (r) { return esc(r.from + ' → ' + r.to); } },
        { key: 'rate', label: 'Rate', sort: 'number', cls: 'num', cell: function (r) { return '<b>' + num(r.rate) + '</b>'; } }],
      actions: !canWork() ? null : function (r, i) { return api.btn('danger', 'data-action="fx-del" data-arg="' + i + '"', 'Delete'); }
    }));
  };
  function currencyDialog(index) {
    var isNew = index == null;
    var c = isNew ? { decimals: '0' } : P.currencies[index];
    api.editDialog({
      title: isNew ? 'New currency' : 'Edit ' + c.code, values: Object.assign({}, c, { decimals: String(c.decimals) }),
      fields: [{ name: 'code', label: 'Code (ISO)', req: true, half: true }, { name: 'decimals', label: 'Decimals', type: 'select', half: true, options: ['0', '2', '3'].map(function (d) { return { value: d, label: d }; }) }, { name: 'name', label: 'Name', req: true }],
      onSave: function (v) {
        var code = v.code.toUpperCase();
        if (!/^[A-Z]{3}$/.test(code)) return { error: 'Use the 3-letter ISO code (e.g. EUR).' };
        if (P.currencies.some(function (x) { return x !== c && x.code === code; })) return { error: code + ' already exists.' };
        var row = { code: code, name: v.name, decimals: Number(v.decimals) };
        if (isNew) P.currencies.push(row); else P.currencies[index] = row;
        keep('currencies');
      }
    });
  }
  api.actions['cur-new'] = function () { currencyDialog(); };
  api.actions['cur-edit'] = function (el) { currencyDialog(Number(el.dataset.arg)); };
  api.actions['fx-new'] = function () {
    api.editDialog({
      title: 'New exchange rate', values: { date: '', from: 'USD', rate: '' },
      fields: [{ name: 'date', label: 'Date', req: true, half: true, placeholder: 'dd/mm/yyyy' },
        { name: 'from', label: 'From', type: 'select', half: true, options: P.currencies.filter(function (c) { return c.code !== 'VND'; }).map(function (c) { return { value: c.code, label: c.code }; }) },
        { name: 'rate', label: 'Rate (VND)', req: true, hint: 'e.g. 25,350 or 25.35k' }],
      onSave: function (v) {
        var r = parseNum(v.rate);
        if (!dkey(v.date)) return { error: 'Date is dd/mm/yyyy.' };
        if (!r || r <= 0) return { error: 'Enter a rate above 0.' };
        if (P.fxRates.some(function (x) { return x.date === v.date && x.from === v.from; })) return { error: 'There is already a ' + v.from + ' rate on ' + v.date + '.' };
        P.fxRates.push({ date: v.date, from: v.from, to: 'VND', rate: r });
        keep('fxRates');
      }
    });
  };
  api.actions['fx-del'] = function (el) {
    api.confirmDialog('Delete this exchange rate?', 'This cannot be undone.', 'Delete', function () { P.fxRates.splice(Number(el.dataset.arg), 1); keep('fxRates'); api.render(); api.toast('Exchange rate deleted'); });
  };

  // ---------- admin: AI split rules (P5) ----------

  api.views['admin/split-rules'] = function () {
    return api.deskPage('AI Split Rules', 'Write, in plain words, when an invoice line should be split. The ledger’s ✨ AI suggest button reads ticket notes against the active rules; ADMIN or an accountant accepts or declines each suggestion.', api.dataTable({
      source: P.splitRules, list: P.splitRules.filter(function (r) { return api.matches(r.text); }), noun: 'rule', placeholder: 'Search rules…',
      add: canRules() ? { action: 'ru-new', label: 'Add rule' } : null, tools: canRules() ? '' : viewOnly('ADMIN writes the rules; the ledger’s AI suggest button uses the active ones'),
      cols: [
        { key: 'n', label: '#', cell: function (r, i) { return 'R' + (i + 1); } },
        { key: 'text', label: 'Rule', cls: 'wrap', cell: function (r) { return esc(r.text); } },
        { key: 'active', label: 'Active', cell: function (r, i) { return '<button class="dt-toggle' + (r.active ? ' on' : '') + '"' + (canRules() ? '' : ' disabled') + ' data-action="ru-toggle" data-arg="' + i + '" aria-label="Active">' + (r.active ? 'On' : 'Off') + '</button>'; } }
      ],
      actions: !canRules() ? null : function (r, i) { return api.btn('', 'data-action="ru-edit" data-arg="' + i + '"', 'Edit') + api.btn('danger', 'data-action="ru-del" data-arg="' + i + '"', 'Delete'); }
    }));
  };
  function ruleDialog(index) {
    var isNew = index == null;
    var r = isNew ? { active: true } : P.splitRules[index];
    api.editDialog({
      title: isNew ? 'New rule' : 'Edit rule', values: r,
      fields: [{ name: 'text', label: 'When should a line be split?', type: 'textarea', req: true, placeholder: 'e.g. If the note says "50% CGM", split the line between the two companies.' }, { name: 'active', label: 'Active', type: 'checkbox' }],
      onSave: function (v) {
        var row = Object.assign({}, r, { text: v.text, active: v.active });
        if (isNew) { row.id = 'r' + Date.now(); P.splitRules.push(row); } else P.splitRules[index] = row;
        keep('splitRules');
      }
    });
  }
  api.actions['ru-new'] = function () { ruleDialog(); };
  api.actions['ru-edit'] = function (el) { ruleDialog(Number(el.dataset.arg)); };
  api.actions['ru-del'] = function (el) {
    api.confirmDialog('Delete this split rule?', 'The AI stops using it. This cannot be undone.', 'Delete', function () { P.splitRules.splice(Number(el.dataset.arg), 1); keep('splitRules'); api.render(); api.toast('Split rule deleted'); });
  };
  api.actions['ru-toggle'] = function (el) { if (!canRules()) return; var r = P.splitRules[Number(el.dataset.arg)]; r.active = !r.active; keep('splitRules'); api.render(); };

  // ---------- admin: discounts (P6) ----------

  api.views['admin/discounts'] = function () {
    var sc = P.discountScope;
    var table = api.dataTable({
      source: P.discountTiers, list: P.discountTiers.filter(function (t) { return api.matches(custName(t.customer) || 'all customers'); }), noun: 'tier', placeholder: 'Search customer…',
      add: canWork() ? { action: 'di-new', label: 'Add tier' } : null, tools: (canWork() ? '' : viewOnly('edited by ADMIN and accountants')),
      cols: [
        { key: 'customer', label: 'Customer', sort: 'text', cell: function (t) { return t.customer ? esc(custName(t.customer)) : anyText; } },
        { key: 'fromCount', label: 'Moves in the month', sort: 'number', cell: function (t) { return t.toCount == null ? t.fromCount + ' or more' : t.fromCount + ' – ' + t.toCount; } },
        { key: 'percent', label: 'Discount', sort: 'number', cls: 'num', cell: function (t) { return '<b>' + t.percent + '%</b>'; } },
        { key: 'now', label: 'This month', cls: 'num', cell: function (t) { return t.customer ? movesInMonth(t.customer, currentMonth()) + ' moves' : api.dash(''); } }
      ],
      actions: !canWork() ? null : function (t, i) { return api.btn('', 'data-action="di-edit" data-arg="' + i + '"', 'Edit') + api.btn('danger', 'data-action="di-del" data-arg="' + i + '"', 'Delete'); }
    });
    var svcChips = function (key) {
      return '<div class="col-chips">' + D.services.map(function (s) {
        return '<button class="' + (sc[key].indexOf(s.code) >= 0 ? '' : 'off') + '" data-action="di-scope" data-arg="' + key + ':' + s.code + '">' + esc(s.name) + '</button>';
      }).join('') + '</div>';
    };
    return api.deskPage('Discounts', 'A discount by the number of moves a customer makes in the month.', table +
      '<div class="card di-card"><h4>Moves that count</h4><p class="section-sub">Services counted toward a tier.</p>' + svcChips('counted') +
      '<h4 style="margin-top:14px">Counted, never charged</h4><p class="section-sub">These still count toward the tier but carry no price on the ledger.</p>' + svcChips('countOnly') + '</div>');
  };
  function tierDialog(index) {
    var isNew = index == null;
    var t = isNew ? { customer: '', fromCount: '', toCount: '', percent: '' } : P.discountTiers[index];
    api.editDialog({
      title: isNew ? 'New tier' : 'Edit tier', values: Object.assign({}, t, { toCount: t.toCount == null ? '' : t.toCount }),
      fields: [
        { name: 'customer', label: 'Customer', type: 'one', options: [{ value: '', label: 'All customers', sub: 'The tier applies to every customer' }].concat(P.customers.map(custItem)) },
        { name: 'fromCount', label: 'From (moves)', type: 'number', req: true, half: true },
        { name: 'toCount', label: 'To (empty = no limit)', type: 'number', half: true },
        { name: 'percent', label: 'Discount %', type: 'number', req: true, half: true }
      ],
      onSave: function (v) {
        var a = parseNum(v.fromCount); var b = parseNum(v.toCount); var pc = parseNum(v.percent);
        if (a == null || a < 0 || b === undefined || (b != null && b < a)) return { error: 'Check the move range.' };
        if (!pc || pc <= 0 || pc >= 100) return { error: 'The discount is between 0 and 100%.' };
        var clash = P.discountTiers.filter(function (x) { return x !== t && x.customer === v.customer && relation(a, b, x.fromCount, x.toCount, 1) !== 'gap' && relation(a, b, x.fromCount, x.toCount, 1) !== 'adjacent'; });
        if (clash.length) return { error: 'Overlaps the tier ' + clash[0].fromCount + (clash[0].toCount == null ? '+' : '–' + clash[0].toCount) + ' for this customer.' };
        var row = Object.assign({}, t, { customer: v.customer, fromCount: a, toCount: b, percent: pc });
        if (isNew) { row.id = 'd' + Date.now(); P.discountTiers.push(row); } else P.discountTiers[index] = row;
        keep('discountTiers');
      }
    });
  }
  api.actions['di-new'] = function () { tierDialog(); };
  api.actions['di-edit'] = function (el) { tierDialog(Number(el.dataset.arg)); };
  api.actions['di-del'] = function (el) {
    api.confirmDialog('Delete this discount tier?', 'This cannot be undone.', 'Delete', function () { P.discountTiers.splice(Number(el.dataset.arg), 1); keep('discountTiers'); api.render(); api.toast('Discount tier deleted'); });
  };
  api.actions['di-scope'] = function (el) {
    if (!canWork()) return;
    var p = el.dataset.arg.split(':');
    var list = P.discountScope[p[0]];
    var at = list.indexOf(p[1]);
    if (at >= 0) list.splice(at, 1); else list.push(p[1]);
    // Counted-only services must also be counted.
    if (p[0] === 'countOnly' && at < 0 && P.discountScope.counted.indexOf(p[1]) < 0) P.discountScope.counted.push(p[1]);
    if (p[0] === 'counted' && at >= 0) P.discountScope.countOnly = P.discountScope.countOnly.filter(function (x) { return x !== p[1]; });
    keep('discountScope');
    api.render();
  };
});
