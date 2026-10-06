// Buoys (Cầu phao) · documents (SPEC-4): the PDA, the FDA, the alongside FDA and one settlement (BBQT) per cargo
// owner. A Draft follows the ticket and the prices; a finished (Final) document is locked; a correction makes a
// new version. Only MOD (the specs' Operator) and ADMIN see documents; agents and owners get them by email only.
(window.HVS_EXT = window.HVS_EXT || []).push(function (api) {
  'use strict';

  var B = api.buoys, P = api.buoyPrice;
  if (!B || !P) return;
  var M = B.M, S = B.S, esc = api.esc, emoji = api.emoji, I = api.I;
  var fmtN = B.fmtN, fmtD = B.fmtD, fmtDT = B.fmtDT, num = B.num, dayNo = B.dayNo;
  var canDocs = function () { return /^(MOD|ADMIN)$/.test(B.role()); };

  var KIND = {
    pda: { label: 'PDA', title: 'PROFORMA DISBURSEMENT ACCOUNT', code: 'PDA', to: 'agent' },
    fda: { label: 'FDA', title: 'FINAL DISBURSEMENT ACCOUNT', code: 'FDA', to: 'agent' },
    along: { label: 'Alongside FDA', title: 'FINAL DISBURSEMENT ACCOUNT · VESSEL ALONGSIDE', code: 'AFDA', to: 'agent' },
    settle: { label: 'Settlement', title: 'CARGO HANDLING SETTLEMENT (BBQT)', code: 'BBQT', to: 'owner' }
  };
  var STATE = { draft: ['Draft', '#6b7280'], final: ['Final', '#16a34a'], superseded: ['Superseded', '#9ca3af'] };

  var Dz = { docs: api.store('buoyDocs', null) };
  var keep = function () { api.save('buoyDocs', Dz.docs); };

  // ---------- helpers ----------

  var r2 = function (v) { return Math.round(v * 100) / 100; };
  var money = function (v, cur) { return v == null ? '' : cur === 'USD' ? Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : fmtN(Math.round(v), 0); };
  var hoursBetween = function (a, b) { return a && b ? (new Date(b) - new Date(a)) / 36e5 : null; };
  var docById = function (id) { return Dz.docs.filter(function (d) { return d.id === id; })[0] || null; };
  var series = function (t, kind, owner) {
    return Dz.docs.filter(function (d) { return d.ticket === t.id && d.kind === kind && (d.owner || '') === (owner || ''); }).sort(function (a, b) { return a.version - b.version; });
  };
  var current = function (t, kind, owner) { var s = series(t, kind, owner); return s[s.length - 1] || null; };
  function nextNo(kind) {
    var code = KIND[kind].code, y = B.TODAY.slice(0, 4);
    var seq = Dz.docs.filter(function (d) { return d.kind === kind; }).length + 1;
    return code + '/' + y + '/' + ('000' + seq).slice(-4);
  }
  function makeDoc(t, kind, owner, base) {
    var d = {
      id: 'd' + (Dz.docs.reduce(function (m, x) { return Math.max(m, Number(x.id.slice(1))); }, 0) + 1),
      no: base ? base.no : nextNo(kind), ticket: t.id, kind: kind, owner: owner || '', version: base ? base.version + 1 : 1, state: 'draft',
      created: B.nowStamp(), custom: [], removed: [], opt: {}, took: {}, hours: null, prefund: null,
      confirmedAt: '', confirmedBy: '', sentAt: '', sentBy: '', sentMethod: '', snap: null
    };
    if (base) ['custom', 'removed', 'opt', 'took', 'hours', 'prefund'].forEach(function (k) { d[k] = JSON.parse(JSON.stringify(base[k])); });
    Dz.docs.push(d);
    return d;
  }

  // The pricing date (R-08): a PDA uses the ETA while none is entered; FDAs and settlements need it.
  var priceDate = function (t, kind) { return t.pricingDate || (kind === 'pda' ? t.eta : '') || t.eta || B.TODAY; };

  // ---------- computing a document (R-02 … R-09) ----------

  function compute(d) {
    if (d.state !== 'draft' && d.snap) return d.snap;
    var t = B.byId(d.ticket);
    var date = priceDate(t, d.kind);
    var out = { lines: [], date: date, problems: [], hours: null, hoursNote: '' };
    var rate = P.fx(date);
    out.fx = rate;

    if (d.kind === 'settle') settleLines(t, d, date, out);
    else portLines(t, d, date, out);

    // Custom lines (R-05) after the priced ones.
    d.custom.forEach(function (c) {
      out.lines.push({ key: c.key, desc: c.desc, cur: c.cur, unit: c.amount, qty: 1, qtyText: '', amount: c.amount, vat: c.vat, custom: true });
    });
    var vatRate = t.vat;
    var anyVat = false, anyUsd = false;
    out.lines.forEach(function (l) {
      var o = d.opt[l.key];
      l.optional = !!o;
      l.note = o ? o.note : '';
      l.took = d.kind === 'pda' ? null : (d.took[l.key] == null ? null : d.took[l.key]);
      // R-06: a PDA counts its optional lines; an FDA counts only the ones that took effect.
      l.counts = d.kind === 'pda' || !l.optional || l.took === true;
      if (l.amount != null && l.cur === 'USD') l.amount = r2(l.amount);
      if (l.amount != null && l.cur === 'VND') l.amount = Math.round(l.amount);
      if (!l.counts) return;
      if (l.cur === 'USD') anyUsd = true;
      if (l.vat) anyVat = true;
    });
    // R-07 / R-08: USD → VND per line before VAT, VAT per line on the VND amount, then summed.
    var tot = { usd: 0, usdVat: 0, vnd: 0, vat: 0 };
    out.lines.forEach(function (l) {
      if (l.amount == null) return;
      l.vnd = l.cur === 'USD' ? (rate ? Math.round(l.amount * rate.rate) : null) : l.amount;
      l.vatVnd = l.vat && vatRate != null && l.vnd != null ? Math.round(l.vnd * vatRate / 100) : 0;
      l.vatUsd = l.cur === 'USD' && l.vat && vatRate != null ? r2(l.amount * vatRate / 100) : 0;
      if (!l.counts) return;
      if (l.cur === 'USD') { tot.usd += l.amount; tot.usdVat += l.vatUsd; }
      tot.vnd += l.vnd || 0;
      tot.vat += l.vatVnd;
    });
    tot.usd = r2(tot.usd); tot.usdVat = r2(tot.usdVat);
    tot.total = tot.vnd + tot.vat;
    tot.prefund = d.prefund ? d.prefund.amount : 0;
    tot.balance = tot.total - tot.prefund;
    out.totals = tot;

    // R-12: what blocks finishing.
    out.lines.forEach(function (l) {
      // An FDA optional line must be set to took effect yes / no; one set to "no" may stay unpriced.
      if (d.kind !== 'pda' && l.optional && l.took == null) { out.problems.push('Set "took effect" (yes / no) on the optional line "' + l.desc + '"'); return; }
      if (l.counts && l.amount == null) out.problems.push('"' + l.desc + '" has no amount: ' + (l.error || 'no price') + '. Replace it with a custom line or remove it');
    });
    if (anyVat && vatRate == null) out.problems.push('Enter the ticket\'s VAT rate (a line has "VAT applies")');
    if (d.kind !== 'pda' && !t.pricingDate) out.problems.push('Enter the ticket\'s pricing date');
    if (anyUsd && !rate) out.problems.push('No USD rate on or before ' + fmtD(date) + ' (Admin › Currencies & Rates)');
    out.banks = banks(t, d.kind);
    return out;
  }

  function portLines(t, d, date, out) {
    var sheet = d.kind === 'along' ? 'trans' : 'mother';
    var cur = sheet === 'mother' ? 'USD' : 'VND';
    // R-03: PDA hours = planned end − start (or typed); FDA hours = unberthing − berthing.
    var h = null;
    if (d.kind === 'pda') {
      if (t.start && t.end) { h = (dayNo(t.end) - dayNo(t.start)) * 24; out.hoursNote = 'planned ' + fmtD(t.start) + ' → ' + fmtD(t.end); }
      else if (d.hours != null) { h = d.hours; out.hoursNote = 'typed by the operator'; }
      else out.hoursNote = 'no planned dates: type the estimated hours';
    } else {
      h = hoursBetween(t.berthed, t.unberthed);
      out.hoursNote = h != null ? 'berthed ' + fmtDT(t.berthed) + ' → unberthed ' + fmtDT(t.unberthed) : 'needs berthing and unberthing times';
    }
    if (h === 0) h = null;
    out.hours = h;
    // "Buoy services included" on an owner's cargo price drops buoy due and mooring from the mother FDA (R-02).
    var incl = d.kind === 'fda' && t.owners.some(function (o) { var r = P.lookupCargo(t, o, date); return r.row && r.row.buoyIncl; });
    var q = function (charge) { return P.lookupPort({ sheet: sheet, charge: charge, port: t.port, dwt: t.dwt, loa: t.loa, agent: t.agent, date: date }); };
    var add = function (key, charge, desc, isDue) {
      if (d.removed.indexOf(key) >= 0) return;
      var r = charge ? q(charge) : { error: 'no tariff charge for this service' };
      var l = { key: key, charge: charge, desc: desc, cur: cur, rowId: r.row ? r.row.id : null, vat: r.row ? r.row.vat : false, error: r.error || '' };
      if (r.row) {
        l.unit = r.price;
        if (isDue) {
          if (!t.grt) { l.error = 'GRT missing on the ticket'; }
          else if (h == null) { l.error = 'hours unknown (' + out.hoursNote + ')'; }
          else { l.qty = t.grt * h; l.qtyText = fmtN(t.grt) + ' GRT × ' + fmtN(h, 2) + ' h'; l.amount = r.price * t.grt * h; }
        } else { l.qty = 1; l.qtyText = '1'; l.amount = r.price; }
      }
      out.lines.push(l);
    };
    if (!(incl)) add('buoy_due', 'buoy_due', 'Buoy due', true);
    t.services.forEach(function (name) {
      var s = M.services.filter(function (x) { return x.name === name; })[0] || { name: name, charge: '' };
      if (d.kind === 'along' && !/^(tug|mooring)$/.test(s.charge)) return; // the transshipment sheet has only these (R-02)
      if (incl && s.charge === 'mooring') return;
      add('svc:' + name, s.charge, s.charge ? B.CHARGES[s.charge] : s.name);
    });
  }

  function settleLines(t, d, date, out) {
    var o = t.owners.filter(function (x) { return x.name === d.owner; })[0];
    if (!o) { out.problems.push(d.owner + ' is no longer on the ticket'); return; }
    var key = 'handling';
    if (d.removed.indexOf(key) >= 0) return;
    var base = { key: key, cur: 'VND', desc: 'Cargo handling · ' + (t.cargo || 'cargo') + ' · ' + M.methods[o.method] };
    if (o.tons == null) { out.lines.push(Object.assign(base, { error: 'tonnage of ' + o.name + ' not entered' })); return; }
    var r = P.lookupCargo(t, o, date);
    if (!r.row) { out.lines.push(Object.assign(base, { error: r.error })); return; }
    var sp = P.split(r.row, o.name, t, o.tons);
    if (sp.error) { out.lines.push(Object.assign(base, { error: sp.error, rowId: r.row.id })); return; }
    out.start = sp.start;
    var sum = 0;
    sp.parts.forEach(function (p, i) {
      var amt = Math.round(p.tons * p.price);
      sum += amt;
      out.lines.push({ key: key + (i ? ':' + i : ''), desc: base.desc + (sp.parts.length > 1 || r.row.tiersOn ? ' · ' + p.label : ''), cur: 'VND', unit: p.price, qty: p.tons, qtyText: fmtN(p.tons) + ' t', amount: amt, vat: r.row.vat, rowId: r.row.id });
    });
    // R-04: the amount before VAT is at least the price row's minimum charge.
    if (r.row.min && sum < r.row.min && d.removed.indexOf('minimum') < 0) {
      out.lines.push({ key: 'minimum', desc: 'Minimum charge top-up (minimum ' + fmtN(r.row.min) + ')', cur: 'VND', unit: r.row.min - sum, qty: 1, qtyText: '', amount: r.row.min - sum, vat: r.row.vat, rowId: r.row.id });
    }
  }

  // R-11: the buoy owner's accounts plus the tug provider's (each company once); settlements: HVS.
  function banks(t, kind) {
    var b = B.byCode(t.port);
    var names = kind === 'settle' ? ['HVS'] : [b ? b.owner : 'HVS', M.tugProvider].filter(function (x, i, a) { return x && a.indexOf(x) === i; });
    return names.map(function (n) { return M.companies.filter(function (c) { return c.name === n; })[0]; }).filter(Boolean).map(function (c, i) {
      return { company: c, why: kind === 'settle' ? 'Cargo handling' : i === 0 && (b && b.owner) === c.name ? (c.name === M.tugProvider ? 'Buoy owner and tug provider' : 'Buoy owner') : 'Tug charges (tug provider)' };
    });
  }

  // Price rows used by a Final or Superseded document are locked (SPEC-3 R-07).
  api.buoyUsedRows = function () {
    var map = {};
    Dz.docs.forEach(function (d) { if (d.state !== 'draft' && d.snap) d.snap.lines.forEach(function (l) { if (l.rowId) map[l.rowId] = true; }); });
    return map;
  };
  api.buoyAlongFinal = function (t) { var d = current(t, 'along'); return !!(d && d.state === 'final'); };

  // ---------- keeping drafts in step with the ticket (R-16) ----------

  function sync(t) {
    var fda = current(t, 'fda');
    if (!fda) return;
    var al = current(t, 'along');
    if (t.alongside && !al) makeDoc(t, 'along');
    if (!t.alongside && al && al.state === 'draft') Dz.docs = Dz.docs.filter(function (x) { return !(x.ticket === t.id && x.kind === 'along' && x.state === 'draft'); });
    t.owners.forEach(function (o) { if (!current(t, 'settle', o.name)) makeDoc(t, 'settle', o.name); });
    Dz.docs = Dz.docs.filter(function (x) { return !(x.ticket === t.id && x.kind === 'settle' && x.state === 'draft' && !t.owners.some(function (o) { return o.name === x.owner; })); });
    keep();
  }

  function finish(d, quiet) {
    var c = compute(d);
    if (c.problems.length) return c.problems;
    d.snap = JSON.parse(JSON.stringify(c));
    d.state = 'final';
    d.finishedAt = B.nowStamp();
    keep();
    if (!quiet) {
      var t = B.byId(d.ticket);
      B.logIt(t, docName(d) + ' finished (' + d.no + ' v' + d.version + ')');
      B.keep();
    }
    return null;
  }
  var docName = function (d) { return KIND[d.kind].label + (d.owner ? ' · ' + d.owner : ''); };

  // ---------- demo documents (the stages reached by the seeded tickets) ----------

  // A line the tariff can't price (e.g. a 0–60k DWT band that needs LOA < 180 m, and the vessel is 189.9 m) is
  // replaced by a custom line at the agreed price, as the Operator would do (R-05).
  var AGREED = { tug: 4400, mooring: 400, esc_ng3: 3300, esc_p21: 3300, cano_com: 330, cano_pp: 500 };
  function seedFix(d) {
    var fixed = false;
    compute(d).lines.forEach(function (l) {
      if (l.amount != null || l.custom || !AGREED[l.charge]) return;
      d.removed.push(l.key);
      d.custom.push({ key: 'u' + d.id + l.key, desc: l.desc + ' (agreed price)', cur: l.cur, amount: AGREED[l.charge], vat: true });
      fixed = true;
    });
    return fixed;
  }

  if (!Dz.docs) {
    Dz.docs = [];
    S.tickets.forEach(function (t) {
      if (t.cancel) return;
      var i = B.stageIx(t.stage);
      var stamp = function (at) { return at || t.created; };
      if (i >= B.stageIx('pda_sent')) {
        var p = makeDoc(t, 'pda');
        p.created = t.created;
        if (!(t.start && t.end)) p.hours = 72; // no planned dates yet: the Operator typed an estimate
        if (!finish(p, true) || (seedFix(p) && !finish(p, true))) { p.sentAt = stamp(t.pdaAt || t.created); p.sentBy = t.pdaBy || 'Ms. Lan'; p.sentMethod = 'system'; }
      }
      if (i >= B.stageIx('op_closed')) {
        makeDoc(t, 'fda');
        sync(t);
        if (i >= B.stageIx('fda_sent')) {
          Dz.docs.filter(function (d) { return d.ticket === t.id && d.kind !== 'pda'; }).forEach(function (d) {
            if (finish(d, true) && (!seedFix(d) || finish(d, true))) return;
            d.sentAt = t.unberthed ? t.unberthed.slice(0, 10) + 'T16:00' : t.created; d.sentBy = t.pdaBy || 'Ms. Lan'; d.sentMethod = 'system';
            if (i >= B.stageIx('invoiced')) { d.confirmedAt = d.sentAt.slice(0, 10) + 'T17:30'; d.confirmedBy = t.pdaBy || 'Ms. Lan'; }
          });
        }
      }
    });
    keep();
  }

  // ---------- ticket page card ----------

  api.buoyDocsCard = function (t, section) {
    if (!canDocs()) return '';
    sync(t);
    var rows = [];
    var item = function (kind, owner, to) {
      var d = current(t, kind, owner);
      if (!d) return;
      var c = compute(d);
      var st = STATE[d.state];
      rows.push('<li class="due" data-go="buoy-docs/' + d.id + '"><b>' + esc(docName(d)) + '</b><span class="by-doc-meta">' +
        '<em style="background:' + st[1] + '">' + st[0] + '</em>' + (d.version > 1 ? ' v' + d.version : '') +
        (d.sentAt ? ' · sent' : '') + (d.confirmedAt ? ' · confirmed' : '') + (d.kind === 'pda' && t.pdaAt ? ' · confirmed' : '') +
        ' · ' + esc(money(c.totals.total, 'VND')) + ' VND' + (d.state === 'draft' && c.problems.length ? ' · <i class="by-miss">' + c.problems.length + ' to fix</i>' : '') + '</span></li>');
    };
    item('pda');
    item('fda');
    item('along');
    t.owners.forEach(function (o) { item('settle', o.name); });
    var acts = '';
    if (!B.cancelled(t)) {
      if (!current(t, 'pda')) acts += '<button class="dt-btn" data-action="bd-new" data-arg="' + t.id + ':pda">Draft PDA</button>';
      if (!current(t, 'fda') && B.stageIx(t.stage) >= B.stageIx('in_op')) acts += '<button class="dt-btn" data-action="bd-new" data-arg="' + t.id + ':fda">Draft FDA' + (t.alongside ? 's' : '') + ' & settlements</button>';
    }
    return section('Documents', [], acts,
      (rows.length ? '<ul class="by-docs">' + rows.join('') + '</ul>' : '<p class="by-hint sm">No document yet. The PDA can be drafted any time; the FDAs and settlements once the vessel is at the buoy.</p>') +
      '<p class="by-hint sm">PDA / FDA go to the agent (' + esc(t.agent || 'not picked yet') + '); each settlement to its cargo owner. Nothing is sent automatically, and sending never moves the ticket.</p>', 'by-sec-docs');
  };

  api.actions['bd-new'] = function (el) {
    var p = el.dataset.arg.split(':');
    var t = B.byId(p[0]);
    if (!t || !canDocs()) return;
    var d = makeDoc(t, p[1]);
    if (p[1] === 'fda') sync(t);
    keep();
    B.logIt(t, KIND[p[1]].label + ' drafted');
    B.keep();
    api.go('buoy-docs/' + d.id);
  };

  // ---------- document page ----------

  api.views['buoy-docs/:id'] = function (id) {
    var d = docById(id);
    var t = d && B.byId(d.ticket);
    if (!d || !t || !canDocs()) { setTimeout(function () { api.toast('Document not available'); api.go('tickets'); }); return ''; }
    if (d.state === 'draft') sync(t);
    var c = compute(d);
    var k = KIND[d.kind];
    var draft = d.state === 'draft';
    var st = STATE[d.state];
    var versions = series(t, d.kind, d.owner);
    var head = '<section class="card by-head by-dochead">' +
      '<div class="by-head-top"><div class="by-head-id"><h2>' + esc(docName(d)) + ' · ' + esc(t.vessel) + '</h2>' +
      '<p>' + esc(d.no) + ' · version ' + d.version + ' · <a data-go="buoys/t/' + t.id + '">ticket #' + esc(t.id) + '</a> · ' + esc(t.port) + ' · pricing date ' + esc(fmtD(c.date)) + (t.pricingDate || d.kind !== 'pda' ? '' : ' (ETA)') + '</p></div>' +
      '<div class="by-head-pills"><span class="by-stage" style="--c:' + st[1] + '">' + st[0] + '</span></div></div>' +
      (versions.length > 1 ? '<div class="by-versions">Versions: ' + versions.map(function (v) {
        return '<a class="' + (v === d ? 'on' : '') + '" data-go="buoy-docs/' + v.id + '">v' + v.version + ' · ' + STATE[v.state][0] + '</a>';
      }).join('') + '</div>' : '') +
      (api.desk() ? '<div class="by-acts">' + docActions(d, t, c) + '</div>' : '') +
      (draft && c.problems.length ? '<div class="by-warn">' + emoji('⚠️') + '<div><b>Before it can be finished</b>' + c.problems.map(function (p) { return '<span>' + esc(p) + '</span>'; }).join('') + '</div></div>' : '') +
      (d.state === 'superseded' ? '<div class="by-banner nu">' + emoji('🗂️') + '<div><b>Superseded</b><span>Kept as history; the corrected version is v' + versions[versions.length - 1].version + '.</span></div></div>' : '') +
      (draft ? '<p class="by-note">A draft follows the ticket and the prices: changing a service, the GRT, the times or a price updates it. Your custom lines, removed lines and notes are kept.</p>' : '') +
      '</section>';
    if (!api.desk()) {
      return api.header({ title: k.label + ' ' + d.no }) + '<div class="page by-page">' + head +
        '<div class="card by-desk-only">' + emoji('🖥️') + '<b>Documents are edited on desktop</b><span>Total ' + esc(money(c.totals.total, 'VND')) + ' VND. Open the desktop design to edit, finish or send.</span></div></div>';
    }
    return api.header({ title: k.label + ' ' + d.no }) + '<div class="page dt-page by-page">' + head +
      '<div class="by-docgrid"><div>' + linesTable(d, t, c) + '</div><div>' + totalsCard(d, t, c) + '</div></div>' +
      '<h3 class="by-pdf-h">PDF preview</h3>' + paper(d, t, c) + '</div>';
  };

  function docActions(d, t, c) {
    var a = '';
    var btn = function (cls, action, label) { return '<button class="pill-btn ' + cls + '" data-action="' + action + '" data-arg="' + d.id + '">' + label + '</button>'; };
    if (d.state === 'draft') {
      a += btn('primary', 'bd-finish', 'Finish');
      a += btn('outline dark', 'bd-custom', '+ Custom line');
      if (d.kind === 'pda' && !(t.start && t.end)) a += btn('outline dark', 'bd-hours', 'Estimated hours');
      if (d.kind !== 'pda' && d.kind !== 'settle') a += btn('outline dark', 'bd-prefund', 'Prefunding received');
      if (d.removed.length) a += btn('outline dark', 'bd-restore', 'Restore removed lines (' + d.removed.length + ')');
    }
    if (d.state === 'final') {
      a += btn('primary', 'bd-send', d.sentAt ? 'Review & send again' : 'Review & send');
      if (d.kind !== 'pda') a += btn('outline dark', 'bd-confirm', d.confirmedAt ? 'Confirmed ✓' : 'Record confirmation');
      a += btn('outline dark', 'bd-correct', 'Correct (new version)');
      a += btn('outline dark', 'bd-pdf', 'Download PDF');
    }
    if (d.state === 'superseded') a += btn('outline dark', 'bd-pdf', 'Download PDF');
    return a;
  }

  function linesTable(d, t, c) {
    var draft = d.state === 'draft';
    var rows = c.lines.map(function (l, i) {
      var opt = l.optional ? '<span class="by-opt">If any' + (l.note ? ' · ' + esc(l.note) : '') + '</span>' : '';
      var took = d.kind !== 'pda' && l.optional ? (draft ?
        '<span class="by-took"><button class="' + (l.took === true ? 'on' : '') + '" data-action="bd-took" data-arg="' + d.id + '|' + l.key + '|1">Yes</button><button class="' + (l.took === false ? 'on' : '') + '" data-action="bd-took" data-arg="' + d.id + '|' + l.key + '|0">No</button></span>' :
        '<span class="dt-muted">' + (l.took ? 'Took effect' : 'Did not happen') + '</span>') : '';
      var acts = draft ? '<button class="dt-btn" data-action="bd-opt" data-arg="' + d.id + '|' + l.key + '">' + (l.optional ? 'Optional…' : 'Mark optional') + '</button>' +
        (l.custom ? '<button class="dt-btn" data-action="bd-custom-edit" data-arg="' + d.id + '|' + l.key + '">Edit</button><button class="dt-btn danger" data-action="bd-custom-del" data-arg="' + d.id + '|' + l.key + '">Delete</button>' :
          '<button class="dt-btn danger" data-action="bd-remove" data-arg="' + d.id + '|' + l.key + '">Remove</button>') : '';
      return '<tr class="' + (l.counts ? '' : 'off') + (l.amount == null ? ' bad' : '') + '"><td>' + (i + 1) + '</td><td><b>' + esc(l.desc) + '</b>' + (l.custom ? ' <span class="by-tag">custom</span>' : '') + opt +
        (l.amount == null ? '<small class="by-err">' + emoji('⚠️') + esc(l.error || 'no price') + '</small>' : '') + '</td>' +
        '<td class="r">' + esc(l.qtyText || '') + '</td><td class="r">' + (l.unit != null ? esc(fmtN(l.unit, 4)) : '') + '</td>' +
        '<td class="r"><b>' + esc(money(l.amount, l.cur)) + '</b> <small>' + esc(l.cur) + '</small></td>' +
        '<td class="r">' + (l.cur === 'USD' ? esc(money(l.vnd, 'VND')) : '') + '</td><td class="r">' + (l.vat ? esc(money(l.vatVnd, 'VND')) : '<span class="dt-muted">—</span>') + '</td>' +
        '<td>' + took + '</td><td class="r by-lacts">' + acts + '</td></tr>';
    }).join('');
    return '<section class="card by-sec"><div class="by-sec-h"><h3>Lines</h3><span class="dt-muted">' + (d.kind === 'settle' ? 'Tonnage × price per tier' : (c.hours != null ? fmtN(c.hours, 2) + ' h at buoy · ' : '') + esc(c.hoursNote)) + '</span></div>' +
      '<div class="by-tblwrap"><table class="by-tbl by-lines"><thead><tr><th>#</th><th>Description</th><th class="r">Quantity</th><th class="r">Unit price</th><th class="r">Amount</th><th class="r">VND</th><th class="r">VAT (VND)</th><th>' + (d.kind === 'pda' ? '' : 'Took effect') + '</th><th></th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="9" class="dt-muted">No lines</td></tr>') + '</tbody></table></div>' +
      (d.kind === 'pda' ? '<p class="by-hint sm">Optional ("If any") lines count on the PDA. On the FDA you set whether each one took effect.</p>' : '') + '</section>';
  }

  function totalsCard(d, t, c) {
    var x = c.totals;
    var row = function (k, v, cls) { return '<dt>' + k + '</dt><dd class="' + (cls || '') + '">' + v + '</dd>'; };
    var to = recipients(d, t);
    return '<section class="card by-sec"><div class="by-sec-h"><h3>Totals</h3></div><dl class="by-kv by-tot">' +
      (x.usd ? row('Subtotal USD', esc(money(x.usd, 'USD'))) + row('Exchange rate', c.fx ? esc(fmtN(c.fx.rate) + ' VND/USD · ' + fmtD(c.fx.date)) : '<span class="by-miss">missing</span>') : '') +
      row('Amount (VND)', esc(money(x.vnd, 'VND'))) + row('VAT ' + (t.vat != null ? t.vat + ' %' : '(rate not set)'), esc(money(x.vat, 'VND'))) +
      row('<b>Total</b>', '<b>' + esc(money(x.total, 'VND')) + '</b>') +
      (d.kind !== 'pda' && d.kind !== 'settle' ? row('Prefunding received', d.prefund ? esc(money(d.prefund.amount, 'VND') + ' · ' + fmtD(d.prefund.date)) : '<span class="dt-muted">none</span>') + row('<b>Balance due</b>', '<b>' + esc(money(x.balance, 'VND')) + '</b>') : '') +
      (d.kind === 'settle' && c.start != null ? row('Owner\'s tonnage before this ticket', esc(fmtN(c.start) + ' t')) : '') +
      '</dl></section>' +
      '<section class="card by-sec"><div class="by-sec-h"><h3>Sending</h3></div><dl class="by-kv">' +
      row('To', to.emails.length ? esc(to.name + ' · ' + to.emails.join(', ')) : '<span class="by-miss">' + esc(to.name || 'No recipient') + ' has no email address</span>') +
      row('Sent', d.sentAt ? esc(fmtDT(d.sentAt) + ' · ' + d.sentBy + ' · ' + (d.sentMethod === 'system' ? 'from the app' : 'own mail app')) : '<span class="dt-muted">not sent</span>') +
      row('Confirmed', d.kind === 'pda' ? (t.pdaAt ? esc(fmtDT(t.pdaAt) + ' · ' + t.pdaBy) + ' <small class="dt-muted">(on the ticket)</small>' : '<span class="dt-muted">recorded on the ticket ("Record PDA confirmation")</span>') :
        d.confirmedAt ? esc(fmtDT(d.confirmedAt) + ' · ' + d.confirmedBy) : '<span class="dt-muted">not yet</span>') +
      '</dl></section>';
  }

  function recipients(d, t) {
    if (d.kind === 'settle') {
      var o = B.ownerRec(d.owner);
      return { name: d.owner, emails: o.emails || [], format: M.emailFormat, extra: '' };
    }
    var info = M.agentInfo[t.agent] || {};
    return { name: t.agent, emails: info.emails || [], format: info.format || M.emailFormat, extra: info.extra || '' };
  }

  // The PDF in the sample PDA / FDA / BBQT layout (R-10, R-11).
  function paper(d, t, c) {
    var k = KIND[d.kind];
    var settle = d.kind === 'settle';
    var x = c.totals;
    var party = settle ? d.owner : t.agent || '—';
    var arr = d.kind === 'pda' ? fmtD(t.start) || fmtD(t.eta) : fmtDT(t.berthed);
    var dep = d.kind === 'pda' ? fmtD(t.end) : fmtDT(t.unberthed);
    var o = settle ? t.owners.filter(function (y) { return y.name === d.owner; })[0] : null;
    var info = [
      ['Messrs', party], ['Vessel', 'MV ' + t.vessel + (d.kind === 'along' ? ' · vessel alongside' : '')],
      ['GRT / DWT / LOA', [fmtN(t.grt), fmtN(t.dwt), t.loa ? fmtN(t.loa) + ' m' : ''].join(' / ')], ['Buoy', t.port + ' · ' + B.areaOfPort(t.port)],
      [d.kind === 'pda' ? 'Expected berthing' : 'Berthed', arr], [d.kind === 'pda' ? 'Expected unberthing' : 'Unberthed', dep],
      ['Cargo', t.qty ? fmtN(t.qty) + ' t ' + t.cargo : t.cargo]
    ].concat(settle ? [['Crane method', o ? M.methods[o.method] : ''], ['Tonnage', o && o.tons != null ? fmtN(o.tons) + ' t' : '']] : [['Hours at buoy', c.hours != null ? fmtN(c.hours, 2) + ' h' : '']]);
    var lines = c.lines.filter(function (l) { return l.counts || d.kind === 'pda'; });
    return '<div class="by-paper"><div class="by-paper-top"><div><b>HAI VAN SHIPPING CORPORATION</b><span>Buoys & Cargo Handling Dept. · Go Gia – Thieng Lieng</span></div><div class="r"><b>' + esc(d.no) + '</b><span>Version ' + d.version + ' · ' + esc(fmtD((d.finishedAt || d.created).slice(0, 10))) + '</span></div></div>' +
      '<h4>' + esc(k.title) + (d.state === 'draft' ? ' <i>DRAFT</i>' : '') + '</h4>' +
      '<div class="by-paper-info">' + info.map(function (p) { return '<div><span>' + esc(p[0]) + '</span><b>' + esc(p[1] || '—') + '</b></div>'; }).join('') + '</div>' +
      '<table><thead><tr><th>No.</th><th>Description</th><th>Quantity</th><th>Unit price</th>' + (settle ? '' : '<th>USD</th>') + '<th>VND</th><th>VAT</th><th>Remark</th></tr></thead><tbody>' +
      lines.map(function (l, i) {
        return '<tr><td>' + (i + 1) + '</td><td>' + esc(l.desc) + '</td><td>' + esc(l.qtyText || '') + '</td><td>' + esc(l.unit != null ? fmtN(l.unit, 4) : '') + '</td>' +
          (settle ? '' : '<td>' + (l.cur === 'USD' ? esc(money(l.amount, 'USD')) : '') + '</td>') + '<td>' + esc(money(l.vnd, 'VND')) + '</td><td>' + (l.vat ? esc(money(l.vatVnd, 'VND')) : '') + '</td><td>' + (l.optional ? 'If any' + (l.note ? ' · ' + esc(l.note) : '') : '') + '</td></tr>';
      }).join('') + '</tbody></table>' +
      '<div class="by-paper-tot">' + (x.usd ? '<div><span>Subtotal (USD)</span><b>' + esc(money(x.usd, 'USD')) + '</b></div><div><span>Exchange rate (Vietcombank, ' + esc(c.fx ? fmtD(c.fx.date) : '—') + ')</span><b>' + esc(c.fx ? fmtN(c.fx.rate) : '—') + '</b></div>' : '') +
      '<div><span>Amount (VND)</span><b>' + esc(money(x.vnd, 'VND')) + '</b></div><div><span>VAT' + (t.vat != null ? ' ' + t.vat + '%' : '') + '</span><b>' + esc(money(x.vat, 'VND')) + '</b></div>' +
      '<div class="big"><span>Total (VND)</span><b>' + esc(money(x.total, 'VND')) + '</b></div>' +
      (d.kind === 'fda' || d.kind === 'along' ? '<div><span>Prefunding received' + (d.prefund ? ' ' + esc(fmtD(d.prefund.date)) : '') + '</span><b>' + esc(money(x.prefund, 'VND')) + '</b></div><div class="big"><span>Balance due (VND)</span><b>' + esc(money(x.balance, 'VND')) + '</b></div>' : '') + '</div>' +
      '<div class="by-paper-banks">' + c.banks.map(function (b) {
        return '<div><span>' + esc(b.why) + '</span>' + (b.company.banks.length ? b.company.banks.map(function (a) {
          return '<p><b>' + esc(a.beneficiary) + '</b><br />' + esc(a.number + ' (' + a.currency + ') · ' + a.bank + ', ' + a.branch) + (a.swift ? '<br />SWIFT ' + esc(a.swift) : '') + '</p>';
        }).join('') : '<p class="by-miss">' + esc(b.company.name) + ' has no bank account (Admin › Buoy companies)</p>') + '</div>';
      }).join('') + '</div>' +
      '<div class="by-paper-sign"><span>Prepared by</span><span>Confirmed by ' + esc(settle ? 'the cargo owner' : 'the agent') + '</span></div></div>';
  }

  // ---------- document actions ----------

  var parts = function (el) { return el.dataset.arg.split('|'); };
  var draftDoc = function (id) { var d = docById(id); return d && d.state === 'draft' && canDocs() ? d : null; };
  var touch = function (d) { keep(); api.render(); };

  api.actions['bd-finish'] = function (el) {
    var d = draftDoc(el.dataset.arg);
    if (!d) return;
    var c = compute(d);
    if (c.problems.length) return api.toast('Fix ' + c.problems.length + ' item' + (c.problems.length > 1 ? 's' : '') + ' first (see the list)');
    api.confirmDialog('Finish ' + docName(d) + '?', 'It is locked once finished; a change then needs a correction (a new version). Total ' + money(c.totals.total, 'VND') + ' VND.', 'Finish', function () {
      finish(d);
      api.toast(docName(d) + ' finished');
      api.render();
    }, true);
  };

  api.actions['bd-correct'] = function (el) {
    var d = docById(el.dataset.arg);
    if (!d || d.state !== 'final' || !canDocs()) return;
    api.confirmDialog('Correct ' + docName(d) + '?', 'Version ' + d.version + ' is kept as Superseded. Version ' + (d.version + 1) + ' starts as a draft with the same custom lines, removed lines, notes and prefunding; its sent and confirmation records start empty.', 'Correct', function () {
      d.state = 'superseded';
      var t = B.byId(d.ticket);
      var nd = makeDoc(t, d.kind, d.owner, d);
      keep();
      B.logIt(t, docName(d) + ' corrected: v' + nd.version + ' drafted');
      B.keep();
      api.go('buoy-docs/' + nd.id);
    }, true);
  };

  function customDialog(d, line) {
    api.editDialog({
      title: line ? 'Custom line' : 'Add a custom line',
      text: 'For a charge with no price in the table (e.g. crane hire by the day, a night tug), entered by hand.',
      values: line ? { desc: line.desc, cur: line.cur, amount: line.amount, vat: line.vat } : { cur: d.kind === 'pda' || d.kind === 'fda' ? 'USD' : 'VND', vat: true },
      fields: [
        { name: 'desc', label: 'Description', req: true },
        { name: 'cur', label: 'Currency', type: 'select', half: true, options: [{ value: 'USD', label: 'USD' }, { value: 'VND', label: 'VND' }] },
        { name: 'amount', label: 'Amount', type: 'number', half: true, req: true },
        { name: 'vat', label: 'VAT applies', type: 'checkbox' }
      ],
      onSave: function (v) {
        var a = num(v.amount);
        if (a == null || a === undefined || a < 0) return { error: 'Enter an amount' };
        if (line) Object.assign(line, { desc: v.desc, cur: v.cur, amount: a, vat: v.vat });
        else d.custom.push({ key: 'u' + Date.now(), desc: v.desc, cur: v.cur, amount: a, vat: v.vat });
        keep();
      }
    });
  }
  api.actions['bd-custom'] = function (el) { var d = draftDoc(el.dataset.arg); if (d) customDialog(d, null); };
  api.actions['bd-custom-edit'] = function (el) {
    var p = parts(el), d = draftDoc(p[0]);
    if (d) customDialog(d, d.custom.filter(function (c) { return c.key === p[1]; })[0]);
  };
  api.actions['bd-custom-del'] = function (el) {
    var p = parts(el), d = draftDoc(p[0]);
    if (!d) return;
    d.custom = d.custom.filter(function (c) { return c.key !== p[1]; });
    delete d.opt[p[1]]; delete d.took[p[1]];
    touch(d);
  };
  api.actions['bd-remove'] = function (el) {
    var p = parts(el), d = draftDoc(p[0]);
    if (!d) return;
    d.removed.push(p[1].replace(/:\d+$/, ''));
    touch(d);
    api.toast('Line removed · it stays removed when the draft updates');
  };
  api.actions['bd-restore'] = function (el) { var d = draftDoc(el.dataset.arg); if (d) { d.removed = []; touch(d); } };
  api.actions['bd-opt'] = function (el) {
    var p = parts(el), d = draftDoc(p[0]);
    if (!d) return;
    var cur = d.opt[p[1]];
    api.editDialog({
      title: 'Optional line ("If any")',
      text: 'Shown as "If any" on the PDA and counted there. On the FDA you set whether it took effect; only lines that took effect count.',
      values: { optional: true, note: cur ? cur.note : '' },
      fields: [{ name: 'optional', label: 'This line is optional', type: 'checkbox' }, { name: 'note', label: 'Note', placeholder: 'e.g. night passage only' }],
      onSave: function (v) {
        if (v.optional) d.opt[p[1]] = { note: v.note }; else { delete d.opt[p[1]]; delete d.took[p[1]]; }
        keep();
      }
    });
  };
  api.actions['bd-took'] = function (el) {
    var p = parts(el), d = draftDoc(p[0]);
    if (!d) return;
    d.took[p[1]] = p[2] === '1';
    touch(d);
  };
  api.actions['bd-hours'] = function (el) {
    var d = draftDoc(el.dataset.arg);
    if (!d) return;
    api.editDialog({
      title: 'Estimated hours at the buoy', text: 'The ticket has no planned dates, so type the hours the PDA uses.',
      values: { hours: d.hours == null ? '' : d.hours },
      fields: [{ name: 'hours', label: 'Hours', type: 'number', req: true }],
      onSave: function (v) { var h = num(v.hours); if (!h || h <= 0) return { error: 'Enter the hours' }; d.hours = h; keep(); }
    });
  };
  api.actions['bd-prefund'] = function (el) {
    var d = draftDoc(el.dataset.arg);
    if (!d) return;
    api.editDialog({
      title: 'Prefunding received', text: 'The balance due is the total minus the prefunding.',
      values: d.prefund ? { amount: d.prefund.amount, date: d.prefund.date } : { date: B.TODAY },
      fields: [{ name: 'amount', label: 'Amount (VND)', type: 'number', half: true }, { name: 'date', label: 'Received on', type: 'date', half: true }],
      onSave: function (v) {
        var a = num(v.amount);
        if (a === undefined || (a != null && a < 0)) return { error: 'Check the amount' };
        d.prefund = a ? { amount: a, date: v.date } : null;
        keep();
      }
    });
  };
  api.actions['bd-pdf'] = function (el) { var d = docById(el.dataset.arg); if (d) api.toast(d.no.replace(/\//g, '-') + '_v' + d.version + '.pdf downloaded'); };

  // R-13: only a Final document is reviewed and sent; system email or the user's own mail app.
  api.actions['bd-send'] = function (el) {
    var d = docById(el.dataset.arg);
    if (!d || !canDocs()) return;
    if (d.state !== 'final') return api.toast('Only a finished document can be sent');
    var t = B.byId(d.ticket);
    var to = recipients(d, t);
    var fill = function (s) {
      return s.replace(/\{agent\}/g, to.name || '').replace(/\{doc\}/g, KIND[d.kind].label + ' ' + d.no).replace(/\{vessel\}/g, t.vessel).replace(/\{buoy\}/g, t.port);
    };
    var body = fill(to.format) + (to.extra ? '\n\n' + to.extra : '');
    var subject = KIND[d.kind].label + ' ' + d.no + ' · MV ' + t.vessel + ' · ' + t.port;
    var file = d.no.replace(/\//g, '-') + '_v' + d.version + '.pdf';
    var html = '<div class="mask light" data-action="close"></div><div class="dialog ed-dialog by-mail" role="dialog" aria-modal="true"><h3>Review email</h3>' +
      '<p class="dlg-text">' + (d.kind === 'settle' ? 'A settlement goes to its cargo owner only.' : 'PDA and FDA go to the ship agent only, never to the cargo owner or the ship owner.') + ' Nothing changes the ticket\'s stage.</p>' +
      (to.emails.length ? '' : '<div class="by-warn">' + emoji('⚠️') + '<div><b>' + esc(to.name || 'This recipient') + ' has no email address</b><span>Add one in Admin › ' + (d.kind === 'settle' ? 'Buoy cargo owners' : 'Buoy agents') + ', or open it in your mail app and type it.</span></div></div>') +
      '<dl class="by-kv"><dt>To</dt><dd>' + esc(to.emails.join(', ') || '—') + '</dd><dt>Subject</dt><dd>' + esc(subject) + '</dd><dt>Attachment</dt><dd><span class="by-file">' + I.clip + esc(file) + '</span></dd></dl>' +
      '<pre class="by-mail-body">' + esc(body) + '</pre>' +
      '<div class="actions"><button type="button" class="pill-btn outline dark" data-action="close">Cancel</button>' +
      '<button type="button" class="pill-btn outline dark" data-mail="client">Open in my mail app</button>' +
      '<button type="button" class="pill-btn primary" data-mail="system"' + (to.emails.length ? '' : ' disabled') + '>Send from the app</button></div></div>';
    var wrap = api.openOverlay(html, 'dialog', '#a8a8a8');
    var dlg = wrap.querySelector('.dialog');
    dlg.style.top = Math.max(24, (window.innerHeight - dlg.offsetHeight) / 2) + 'px';
    dlg.addEventListener('click', function (e) {
      var b = e.target.closest('[data-mail]');
      if (!b || b.disabled) return;
      d.sentAt = B.nowStamp(); d.sentBy = api.user.name; d.sentMethod = b.dataset.mail;
      keep();
      B.logIt(t, docName(d) + ' ' + (b.dataset.mail === 'system' ? 'emailed to ' : 'opened in the mail app for ') + (to.name || ''));
      B.keep();
      api.closeOverlay();
      api.toast(b.dataset.mail === 'system' ? 'Email sent with ' + file : 'Draft opened in your mail app · ' + file + ' downloaded');
      api.render();
    });
  };

  // R-14: the Operator records each FDA / settlement confirmation; "confirms together" agents cover both FDAs.
  api.actions['bd-confirm'] = function (el) {
    var d = docById(el.dataset.arg);
    if (!d || d.state !== 'final' || d.kind === 'pda' || !canDocs()) return;
    var t = B.byId(d.ticket);
    if (d.confirmedAt) return api.toast('Confirmed ' + fmtDT(d.confirmedAt) + ' by ' + d.confirmedBy);
    var together = d.kind !== 'settle' && (M.agentInfo[t.agent] || {}).together;
    var sib = together ? current(t, d.kind === 'fda' ? 'along' : 'fda') : null;
    api.confirmDialog('Record confirmation', (d.kind === 'settle' ? d.owner : t.agent) + ' confirmed ' + docName(d) + ' ' + d.no + '.' +
      (sib && sib.state === 'final' ? ' ' + t.agent + ' confirms the mother vessel and alongside FDAs together, so ' + docName(sib) + ' is confirmed too.' : '') + ' The ticket stage does not change.', 'Record', function () {
      [d].concat(sib && sib.state === 'final' ? [sib] : []).forEach(function (x) { x.confirmedAt = B.nowStamp(); x.confirmedBy = api.user.name; });
      keep();
      B.logIt(t, docName(d) + ' confirmed' + (sib && sib.state === 'final' ? ' (with ' + docName(sib) + ')' : ''));
      B.keep();
      api.render();
    }, true);
  };
});
