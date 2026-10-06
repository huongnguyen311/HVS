// Buoys (Cầu phao) · setup (SPEC-1): areas and buoys, cranes and crane types, cargo owners and colour groups,
// ship agents' email setup, service and cargo types, companies with bank accounts and the tug provider.
// Only ADMIN edits; MOD (the specs' Operator) sees the lists read only. A record in use is deactivated, never
// deleted, after a warning listing what uses it; a record nothing uses can be deleted (R-11).
(window.HVS_EXT = window.HVS_EXT || []).push(function (api) {
  'use strict';

  var B = api.buoys, P = api.buoyPrice;
  if (!B) return;
  var D = api.D, M = B.M, S = B.S, esc = api.esc, emoji = api.emoji;
  var fmtN = B.fmtN, num = B.num, on = B.on;
  var canEdit = function () { return B.role() === 'ADMIN'; };
  var save = function () { B.keepMaster(); };
  var same = function (a, b) { return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase(); };
  var tab = {};
  var st = api.state;
  var isAdmin = canEdit;
  var key = function (v) { return api.norm(String(v || '')).replace(/[^a-z0-9]/g, ''); };
  api.tableExtra = api.tableExtra || {};

  // ---------- shared pieces ----------

  // On a phone the tabs are a segmented control (as Towage | Buoys): every tab in view, a short name and, under it,
  // the unit and the count. Desktop keeps the chips. Rows: [key, label, count, short name, unit].
  var seg = function (list, isOn, attrs) {
    return '<div class="by-seg one" role="tablist">' + list.map(function (x) {
      var on = isOn(x);
      return '<button type="button" role="tab" aria-selected="' + on + '" class="' + (on ? 'on' : '') + '" ' + attrs(x) + ' title="' + esc(x[1]) + '">' +
        '<b>' + esc(x[3] || x[1]) + '</b><small>' + esc((x[4] ? x[4] + ' · ' : '') + (x[2] != null ? x[2] : '')) + '</small></button>';
    }).join('') + '</div>';
  };
  var tabs = function (key, list) {
    var cur = tab[key] || list[0][0];
    if (!api.desk()) return seg(list, function (x) { return x[0] === cur; }, function (x) { return 'data-action="bs-tab" data-arg="' + key + ':' + x[0] + '"'; });
    return '<div class="dt-chips by-tabs">' + list.map(function (x) {
      return '<button class="' + (x[0] === cur ? 'on' : '') + '" data-action="bs-tab" data-arg="' + key + ':' + x[0] + '">' + esc(x[1]) + '<em>' + x[2] + '</em></button>';
    }).join('') + '</div>';
  };
  api.actions['bs-tab'] = function (el) { var p = el.dataset.arg.split(':'); tab[p[0]] = p[1]; api.render(); };
  var statusCell = function (x) { return on(x) ? '<span class="dt-status ok">Active</span>' : '<span class="dt-status">Inactive</span>'; };
  var ro = function () { return canEdit() ? '' : '<p class="lg-ro">' + emoji('👁️') + 'View only · the admin edits master data</p>'; };
  var lifeBtns = function (kind, i, x) {
    if (!canEdit()) return '';
    // Two buttons, like every other admin table: Edit, then the one lifecycle step that applies (R-11):
    // inactive → Reactivate; in use → Deactivate (it can't be deleted); unused → Delete.
    var arg = 'data-arg="' + kind + ':' + i + '"';
    var second = x.active !== undefined && !on(x) ? api.btn('success', 'data-action="bs-on" ' + arg, 'Reactivate')
      : USES[kind](x).length ? api.btn('danger', 'data-action="bs-off" ' + arg, 'Deactivate')
        : api.btn('danger', 'data-action="bs-del" ' + arg, 'Delete');
    return api.btn('', 'data-action="bs-edit" ' + arg, 'Edit') + second;
  };

  // What uses a record (tickets, prices, other records): shown before deactivating, and blocks deleting.
  var tix = function (f) { return S.tickets.filter(f).map(function (t) { return 'Ticket #' + t.id + ' ' + t.vessel; }); };
  var priceRows = function (f, k) { return P ? P.rows[k].filter(f).map(function (r) { return (k === 'port' ? 'Port price' : 'Cargo price') + ' #' + r.id; }) : []; };
  var USES = {
    area: function (a) {
      return M.buoys.filter(function (b) { return b.area === a.id; }).map(function (b) { return 'Buoy ' + b.code; })
        .concat(tix(function (t) { var b = B.byCode(t.port); return b && b.area === a.id; }), priceRows(function (r) { return r.area === a.id; }, 'port'), priceRows(function (r) { return r.area === a.id; }, 'cargo'));
    },
    buoy: function (b) {
      return tix(function (t) { return t.port === b.code; }).concat(priceRows(function (r) { return r.port === b.code; }, 'port'),
        S.blocks.filter(function (k) { return k.port === b.code; }).map(function (k) { return 'Blocked period ' + k.reason; }));
    },
    craneType: function (c) { return M.cranes.filter(function (x) { return x.type === c.name; }).map(function (x) { return 'Crane ' + x.name; }); },
    crane: function (c) { return tix(function (t) { return t.crane === c.name; }); },
    owner: function (o) {
      return tix(function (t) { return t.owners.some(function (x) { return x.name === o.name; }); }).concat(priceRows(function (r) { return r.owner === o.name; }, 'cargo'),
        P ? P.rows.opening.filter(function (x) { return x.owner === o.name; }).map(function (x) { return 'Opening tonnage ' + x.year; }) : []);
    },
    group: function (g) { return M.owners.filter(function (o) { return o.group === g.name; }).map(function (o) { return 'Cargo owner ' + o.name; }); },
    service: function (s) { return tix(function (t) { return t.services.indexOf(s.name) >= 0; }); },
    cargoType: function (c) { return tix(function (t) { return t.cargo === c.name; }).concat(priceRows(function (r) { return r.cargo === c.name; }, 'cargo')); },
    company: function (c) {
      return M.buoys.filter(function (b) { return b.owner === c.name; }).map(function (b) { return 'Owner of ' + b.code; }).concat(M.tugProvider === c.name ? ['Tug provider'] : []);
    }
  };
  var LIST = { area: 'areas', buoy: 'buoys', craneType: 'craneTypes', crane: 'cranes', owner: 'owners', group: 'groups', service: 'services', cargoType: 'cargoTypes', company: 'companies' };
  var NOUN = { area: 'area', buoy: 'buoy', craneType: 'crane type', crane: 'crane', owner: 'cargo owner', group: 'colour group', service: 'service type', cargoType: 'cargo type', company: 'company' };
  var nameOf = function (kind, x) { return kind === 'buoy' ? x.code : x.name; };
  var rec = function (el) { var p = el.dataset.arg.split(':'); return { kind: p[0], i: Number(p[1]), x: M[LIST[p[0]]][Number(p[1])] }; };
  var usesText = function (u) { return u.slice(0, 8).join(' · ') + (u.length > 8 ? ' · and ' + (u.length - 8) + ' more' : ''); };

  api.actions['bs-off'] = function (el) {
    var r = rec(el);
    if (!canEdit() || !r.x) return;
    var u = USES[r.kind](r.x);
    var extra = r.kind === 'area' ? M.buoys.filter(function (b) { return b.area === r.x.id && on(b); }) : [];
    var go = function () {
      r.x.active = false;
      extra.forEach(function (b) { b.active = false; });
      save(); api.render(); api.toast(NOUN[r.kind] + ' deactivated');
    };
    if (!u.length) return go();
    // R-11 / R-18: warn with what uses it; the admin confirms or cancels. Deactivating an area also deactivates its buoys.
    api.confirmDialog('Deactivate ' + NOUN[r.kind] + ' ' + nameOf(r.kind, r.x) + '?', 'In use by: ' + usesText(u) + '. It stays on those, but can no longer be picked on a new ticket' +
      (r.kind === 'area' || r.kind === 'buoy' ? ' (towage too, the list is shared)' : '') + (extra.length ? '. Its active buoys (' + extra.map(function (b) { return b.code; }).join(', ') + ') are deactivated too' : '') + '.', 'Deactivate', go);
  };
  api.actions['bs-on'] = function (el) {
    var r = rec(el);
    if (!canEdit() || !r.x) return;
    r.x.active = true;
    save(); api.render(); api.toast(NOUN[r.kind] + ' reactivated');
  };
  api.actions['bs-del'] = function (el) {
    var r = rec(el);
    if (!canEdit() || !r.x) return;
    var u = USES[r.kind](r.x);
    if (u.length) return api.confirmDialog('Can\'t delete ' + nameOf(r.kind, r.x), 'It is in use by: ' + usesText(u) + '. Deactivate it instead.', 'OK', function () {}, true);
    api.confirmDialog('Delete ' + NOUN[r.kind] + ' ' + nameOf(r.kind, r.x) + '?', 'Nothing uses it. This cannot be undone.', 'Delete', function () {
      M[LIST[r.kind]].splice(r.i, 1); save(); api.render(); api.toast('Deleted');
    });
  };
  api.actions['bs-edit'] = function (el) { var r = rec(el); if (canEdit() && r.x) EDIT[r.kind](r.x, false); };
  api.actions['bs-add'] = function (el) { if (canEdit()) EDIT[el.dataset.arg](null, true); };

  // ---------- edit dialogs ----------

  var dup = function (list, x, key, v) { return list.some(function (y) { return y !== x && same(y[key], v); }); };
  var companyOpts = function () { return M.companies.map(function (c) { return { value: c.name, label: c.name + (c.full ? ' · ' + c.full : '') }; }); };
  var EDIT = {
    area: function (x, isNew) {
      api.editDialog({
        title: isNew ? 'New area' : 'Area · ' + x.name, text: 'An area is the towage Location; renaming it renames it for towage too.',
        values: { name: x ? x.name : '' }, fields: [{ name: 'name', label: 'Name', req: true }],
        onSave: function (v) {
          if (dup(M.areas, x, 'name', v.name)) return { error: 'An area named "' + v.name + '" already exists' };
          if (isNew) M.areas.push({ id: 'a' + Date.now(), name: v.name });
          else {
            st.locations.forEach(function (l) { if (key(l.name) === key(x.name)) l.name = v.name; });
            api.save('locations', st.locations);
            x.name = v.name;
          }
          save();
        }
      });
    },
    buoy: function (x, isNew) {
      var core = '<p class="ed-hint">Code, max LOA and max draft belong to Core: an existing buoy\'s values are edited by Core\'s admin (Admin › Ports).</p>';
      var fields = isNew ? [
        { name: 'code', label: 'Code', req: true, half: true, placeholder: 'e.g. BP12' },
        { name: 'name', label: 'Name', req: true, half: true },
        { name: 'draft', label: 'Max draft (< m)', type: 'number', half: true },
        { name: 'loa', label: 'Max LOA (< m)', type: 'number', half: true }
      ] : [{ name: 'core', label: 'Core fields', type: 'html', html: '<p class="by-core"><b>' + esc(x.code) + '</b> · draft < ' + (x.draft || '—') + ' m · LOA < ' + (x.loa || '—') + ' m</p>' + core },
        { name: 'name', label: 'Name', req: true }];
      fields = fields.concat([
        { name: 'area', label: 'Area', type: 'select', half: true, options: M.areas.filter(function (a) { return on(a) || (x && a.id === x.area); }).map(function (a) { return { value: a.id, label: a.name }; }) },
        { name: 'owner', label: 'Owner company', type: 'select', half: true, options: companyOpts() },
        { name: 'dwt', label: 'Max DWT (< t)', type: 'number', half: true }
      ]);
      api.editDialog({
        title: isNew ? 'New buoy (port in Core)' : 'Buoy · ' + x.code, values: x ? { name: x.name, area: x.area, owner: x.owner, dwt: x.dwt == null ? '' : x.dwt } : { area: M.areas[0].id, owner: 'HVS' }, fields: fields,
        onSave: function (v) {
          var lim = {};
          var bad = ['draft', 'loa', 'dwt'].filter(function (k) { if (!(k in v)) return false; lim[k] = num(v[k]); return lim[k] === undefined || (lim[k] != null && lim[k] <= 0); });
          if (bad.length) return { error: 'Limits must be above 0 (or empty): ' + bad.join(', ') };
          if (isNew) {
            var ports = api.store('ports', D.ports);
            var hit = M.buoys.filter(function (b) { return same(b.code, v.code); })[0] || ports.filter(function (p) { return same(p.name, v.code); })[0];
            if (hit) return { error: 'Port ' + (hit.code || hit.name) + ' already exists in Core; codes are unique (names may repeat)' };
            M.buoys.push({ code: v.code.toUpperCase(), name: v.name, area: v.area, owner: v.owner, draft: lim.draft, loa: lim.loa, dwt: lim.dwt });
          } else Object.assign(x, { name: v.name, area: v.area, owner: v.owner, dwt: lim.dwt });
          save();
        }
      });
    },
    craneType: function (x, isNew) {
      api.editDialog({
        title: isNew ? 'New crane type' : 'Crane type', values: { name: x ? x.name : '' }, fields: [{ name: 'name', label: 'Name', req: true, placeholder: 'e.g. Crawler crane' }],
        onSave: function (v) {
          if (dup(M.craneTypes, x, 'name', v.name)) return { error: 'This crane type already exists' };
          if (x) { M.cranes.forEach(function (c) { if (c.type === x.name) c.type = v.name; }); x.name = v.name; } else M.craneTypes.push({ name: v.name });
          save();
        }
      });
    },
    crane: function (x, isNew) {
      api.editDialog({
        title: isNew ? 'New crane unit' : 'Crane · ' + x.name, values: x ? { name: x.name, type: x.type } : {},
        fields: [{ name: 'name', label: 'Name', req: true, half: true, placeholder: 'e.g. FAN 3' },
          { name: 'type', label: 'Crane type', type: 'select', req: true, half: true, options: [{ value: '', label: 'Choose a type' }].concat(M.craneTypes.filter(on).map(function (c) { return { value: c.name, label: c.name }; })) }],
        onSave: function (v) {
          if (!v.type) return { error: 'Every crane unit has a crane type' };
          if (dup(M.cranes, x, 'name', v.name)) return { error: 'A crane named "' + v.name + '" already exists' };
          if (x) { S.tickets.forEach(function (t) { if (t.crane === x.name) t.crane = v.name; }); Object.assign(x, v); B.keep(); } else M.cranes.push({ name: v.name, type: v.type });
          save();
        }
      });
    },
    owner: function (x, isNew) {
      api.editDialog({
        title: isNew ? 'New cargo owner' : 'Cargo owner · ' + x.name,
        text: isNew ? 'A company found by tax code in Core is reused, not created twice.' : '',
        values: x ? { name: x.name, tax: x.tax, address: x.address, emails: (x.emails || []).join(', '), group: x.group || '', ownColor: !!x.color, color: x.color || '#ffffff' } : { group: '', color: '#ffffff' },
        fields: [
          { name: 'name', label: 'Company name', req: true },
          { name: 'tax', label: 'Tax code', half: true, req: true },
          { name: 'group', label: 'Colour group', type: 'select', half: true, options: [{ value: '', label: 'No group (default colour)' }].concat(M.groups.map(function (g) { return { value: g.name, label: g.name }; })) },
          { name: 'address', label: 'Address' },
          { name: 'emails', label: 'Emails for its settlement', placeholder: 'ketoan@company.vn, ops@company.vn', hint: 'Optional; with none, the settlement review shows a warning.' },
          { name: 'ownColor', label: 'Own colour on the board (overrides the group colour)', type: 'checkbox' },
          { name: 'color', label: 'Own colour', type: 'color' }
        ],
        onSave: function (v) {
          var emails = v.emails.split(/[,;\s]+/).filter(Boolean);
          if (emails.some(function (e) { return !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e); })) return { error: 'Check the email addresses' };
          var twin = M.owners.filter(function (o) { return o !== x && same(o.tax, v.tax); })[0];
          if (twin) return { error: 'Tax code ' + v.tax + ' is already ' + twin.name + ' (one company per tax code)' };
          var val = { name: v.name, tax: v.tax, address: v.address, emails: emails, group: v.group, color: v.ownColor ? v.color : '' };
          if (x) {
            if (x.name !== v.name) {
              S.tickets.forEach(function (t) { t.owners.forEach(function (o) { if (o.name === x.name) o.name = v.name; }); });
              if (P) {
                P.rows.cargo.forEach(function (r) { if (r.owner === x.name) r.owner = v.name; });
                P.rows.opening.forEach(function (r) { if (r.owner === x.name) r.owner = v.name; });
                api.save('buoyCargoRows', P.rows.cargo); api.save('buoyOpening', P.rows.opening);
              }
            }
            Object.assign(x, val); B.keep();
          } else M.owners.push(val);
          save();
        }
      });
    },
    group: function (x, isNew) {
      api.editDialog({
        title: isNew ? 'New colour group' : 'Colour group · ' + x.name, values: x ? { name: x.name, color: x.color } : { color: '#bfdbfe' },
        fields: [{ name: 'name', label: 'Name', req: true, half: true }, { name: 'color', label: 'Colour', type: 'color', half: true }],
        onSave: function (v) {
          if (dup(M.groups, x, 'name', v.name)) return { error: 'This group already exists' };
          if (x) { M.owners.forEach(function (o) { if (o.group === x.name) o.group = v.name; }); Object.assign(x, v); } else M.groups.push({ name: v.name, color: v.color });
          save();
        }
      });
    },
    service: function (x, isNew) {
      api.editDialog({
        title: isNew ? 'New service type' : 'Service type · ' + x.name, text: 'A name the Operator logs on a ticket (no quantity). Its price comes from the tariff charge it maps to.',
        values: x ? { name: x.name, charge: x.charge } : { charge: '' },
        fields: [{ name: 'name', label: 'Name', req: true, half: true }, { name: 'charge', label: 'Tariff charge', type: 'select', half: true, options: [{ value: '', label: 'None (no price)' }].concat(Object.keys(B.CHARGES).filter(function (k) { return k !== 'buoy_due'; }).map(function (k) { return { value: k, label: B.CHARGES[k] }; })) }],
        onSave: function (v) {
          if (dup(M.services, x, 'name', v.name)) return { error: 'This service type already exists' };
          if (x) { S.tickets.forEach(function (t) { t.services = t.services.map(function (s) { return s === x.name ? v.name : s; }); }); Object.assign(x, v); B.keep(); } else M.services.push({ name: v.name, charge: v.charge });
          save();
        }
      });
    },
    cargoType: function (x, isNew) {
      api.editDialog({
        title: isNew ? 'New cargo type' : 'Cargo type', values: { name: x ? x.name : '' }, fields: [{ name: 'name', label: 'Name', req: true }],
        onSave: function (v) {
          if (dup(M.cargoTypes, x, 'name', v.name)) return { error: 'This cargo type already exists' };
          if (x) { S.tickets.forEach(function (t) { if (t.cargo === x.name) t.cargo = v.name; }); x.name = v.name; B.keep(); } else M.cargoTypes.push({ name: v.name });
          save();
        }
      });
    },
    company: function (x, isNew) {
      api.editDialog({
        title: isNew ? 'New company' : 'Company · ' + x.name, values: x ? { name: x.name, full: x.full, tax: x.tax } : {},
        fields: [{ name: 'name', label: 'Short name', req: true, half: true }, { name: 'tax', label: 'Tax code', half: true }, { name: 'full', label: 'Legal name' }],
        onSave: function (v) {
          if (dup(M.companies, x, 'name', v.name)) return { error: 'This company already exists' };
          if (x) { M.buoys.forEach(function (b) { if (b.owner === x.name) b.owner = v.name; }); if (M.tugProvider === x.name) M.tugProvider = v.name; Object.assign(x, v); }
          else M.companies.push({ name: v.name, full: v.full, tax: v.tax, banks: [] });
          save();
        }
      });
    }
  };

  // ---------- screens ----------

  var page = function (title, sub, table) { return api.deskPage(title, sub, table) + ro(); };
  var addBtn = function (kind, label) { return canEdit() ? { action: 'bs-add" data-arg="' + kind, label: label } : null; };
  var srcOf = function (kind) { return M[LIST[kind]]; };

  // Areas and buoys are not a Buoys list of their own (SPEC-1 T-01, T-02, R-18): an area is a towage Location and a
  // buoy is a port in Core. So they show on Admin › Location Management and Admin › Port Management, one list each,
  // next to the towage records. The towage rows keep their own actions; only ADMIN edits (MOD views, P-05).
  var portRows = function () {
    // A towage port with a buoy's code is that buoy (one record in Core).
    return st.ports.filter(function (p) { return !B.byCode(p.name); }).map(function (p) {
      return { kind: 'port', i: st.ports.indexOf(p), code: p.name, name: p.berth || '', area: p.location || '', owner: '', draft: null, loa: null, dwt: null, active: true };
    }).concat(M.buoys.map(function (b, i) {
      return { kind: 'buoy', i: i, x: b, code: b.code, name: b.name, area: B.areaName(b.area), owner: b.owner, draft: b.draft, loa: b.loa, dwt: b.dwt, active: on(b) };
    }));
  };
  var basePorts = api.views['admin/ports'];
  api.views['admin/ports'] = function () {
    if (!api.manageTable()) return basePorts();
    var rows = portRows();
    var cur = tab.ports || 'all';
    var n = function (k) { return rows.filter(function (r) { return k === 'all' || r.kind === k; }).length; };
    var lim = function (k, u) { return function (r) { return r[k] ? '< ' + esc(fmtN(r[k])) + u : api.dash(''); }; };
    return api.deskPage('Port Management', 'Ports and berths, buoy berths included (each buoy is a port in Core). A vessel fits a buoy only below its limits ("Draft < 14.5 m"); code, max LOA and max draft of an existing buoy are edited in Core.', api.dataTable({
      source: rows, noun: 'port', placeholder: 'Search by port, berth, area or owner...',
      list: rows.filter(function (r) { return (cur === 'all' || r.kind === cur) && api.matches([r.code, r.name, r.area, r.owner].join(' ')); }),
      tools: tabs('ports', [['all', 'All', n('all'), 'All'], ['buoy', 'Buoy berths', n('buoy'), 'Buoys'], ['port', 'Other ports', n('port'), 'Other ports']]),
      // One green add button, as on every admin table: on the Buoy berths tab it adds a buoy berth.
      add: !isAdmin() ? null : cur === 'buoy' ? addBtn('buoy', 'Add buoy berth') : { action: 'new-port', label: 'Add port' },
      cols: [
        { key: 'code', label: 'Port', sort: 'text', cell: function (r) { return '<b>' + esc(r.code) + '</b>'; } },
        { key: 'name', label: 'Name / berth', sort: 'text' },
        { key: 'area', label: 'Location / area', sort: 'text' },
        { key: 'owner', label: 'Buoy owner', sort: 'text' },
        { key: 'draft', label: 'Max draft', cls: 'num', cell: lim('draft', ' m') },
        { key: 'loa', label: 'Max LOA', cls: 'num', cell: lim('loa', ' m') },
        { key: 'dwt', label: 'Max DWT', cls: 'num', cell: lim('dwt', '') },
        { key: 'active', label: 'Status', cell: statusCell }
      ],
      actions: isAdmin() ? function (r) {
        return r.kind === 'buoy' ? lifeBtns('buoy', r.i, r.x) : api.btn('', 'data-edit-port="' + r.i + '"', 'Edit') + api.btn('danger', 'data-del="ports:' + r.i + '"', 'Delete');
      } : null
    })) + ro();
  };

  var baseLocations = api.views['admin/locations'];
  api.views['admin/locations'] = function () {
    if (!api.manageTable()) return baseLocations();
    // A buoy area with a towage location's name is that location (one list, SPEC-1 T-01).
    var areaOf = function (name) { return M.areas.filter(function (x) { return key(x.name) === key(name); })[0]; };
    var rows = st.locations.filter(function (l) { return !areaOf(l.name); }).map(function (l) {
      return { kind: 'loc', i: st.locations.indexOf(l), order: l.order, name: l.name, buoys: '', active: true };
    }).concat(M.areas.map(function (x, i) {
      var loc = st.locations.filter(function (l) { return key(l.name) === key(x.name); })[0];
      var codes = M.buoys.filter(function (b) { return b.area === x.id; }).map(function (b) { return b.code; });
      return { kind: 'area', i: i, x: x, order: loc ? loc.order : null, name: x.name, buoys: codes.join(', '), active: on(x) };
    }));
    // An area with no towage location of its own is numbered after the locations, so every row has an order.
    var top = rows.reduce(function (m, r) { return r.order != null ? Math.max(m, Number(r.order)) : m; }, 0);
    rows.forEach(function (r) { if (r.order == null) r.order = ++top; });
    var cur = tab.locs || 'all';
    var n = function (k) { return rows.filter(function (r) { return k === 'all' || r.kind === k; }).length; };
    return api.deskPage('Location Management', 'Tugboat home locations and buoy areas: one list for towage and buoys. Renaming or deactivating an area changes it for towage too; deactivating it also deactivates its buoys.', api.dataTable({
      source: rows, noun: 'location', placeholder: 'Search by location or buoy...', sort: ['order', 1],
      list: rows.filter(function (r) { return (cur === 'all' || r.kind === cur) && api.matches(r.name + ' ' + r.buoys); }),
      tools: tabs('locs', [['all', 'All', n('all'), 'All'], ['area', 'Buoy areas', n('area'), 'Buoy areas'], ['loc', 'Tugboat locations', n('loc'), 'Tug bases']]),
      // Same as Port Management: one green add button that follows the tab.
      add: !isAdmin() ? null : cur === 'area' ? addBtn('area', 'Add buoy area') : { action: 'new-location', label: 'Add location' },
      cols: [
        { key: 'order', label: 'Order', sort: 'number', cls: 'num narrow', cell: function (r) { return String(r.order); } },
        { key: 'name', label: 'Location', sort: 'text', cell: function (r) { return emoji('📍') + ' <b>' + esc(String(r.name).toUpperCase()) + '</b>'; } },
        { key: 'buoys', label: 'Buoy berths', cell: function (r) { return r.buoys ? esc(r.buoys) : api.dash(''); } },
        { key: 'active', label: 'Status', cell: statusCell }
      ],
      actions: isAdmin() ? function (r) {
        return r.kind === 'area' ? lifeBtns('area', r.i, r.x) : api.btn('', 'data-edit="locations:' + r.i + '"', 'Edit') + api.btn('danger', 'data-del="locations:' + r.i + '"', 'Delete');
      } : null
    })) + ro();
  };

  api.views['admin/buoy-cranes'] = function () {
    var t = tab.cranes || 'cranes';
    var head = tabs('cranes', [['cranes', 'Crane units', M.cranes.length, 'Units'], ['types', 'Crane types', M.craneTypes.length, 'Types']]);
    if (t === 'types') {
      return page('Buoy Cranes', 'Crane types are named by the admin; each crane unit has one.', api.dataTable({
        source: M.craneTypes, list: M.craneTypes.filter(function (c) { return api.matches(c.name); }), noun: 'crane type', tools: head, add: addBtn('craneType', 'Add crane type'),
        cols: [{ key: 'name', label: 'Crane type', sort: 'text', cell: function (c) { return '<b>' + esc(c.name) + '</b>'; } },
          { key: 'n', label: 'Units', cls: 'num', cell: function (c) { return String(M.cranes.filter(function (x) { return x.type === c.name; }).length); } },
          { key: 'active', label: 'Status', cell: statusCell }],
        actions: canEdit() ? function (c, i) { return lifeBtns('craneType', i, c); } : null
      }));
    }
    return page('Buoy Cranes', 'Named crane units the Operator assigns to a buoy ticket.', api.dataTable({
      source: M.cranes, list: M.cranes.filter(function (c) { return api.matches(c.name + ' ' + c.type); }), noun: 'crane', tools: head, add: addBtn('crane', 'Add crane'),
      cols: [{ key: 'name', label: 'Crane unit', sort: 'text', cell: function (c) { return '<b>' + esc(c.name) + '</b>'; } }, { key: 'type', label: 'Type', sort: 'text' },
        { key: 'n', label: 'Tickets', cls: 'num', cell: function (c) { return String(USES.crane(c).length); } }, { key: 'active', label: 'Status', cell: statusCell }],
      actions: canEdit() ? function (c, i) { return lifeBtns('crane', i, c); } : null
    }));
  };

  // Cargo owners are customers (SPEC-1 T-07): companies with the customer role in Buoys. They are tabs of
  // Admin › Customers, next to the towage customers invoiced through the ledger.
  var custTabs = function () {
    return tabs('cust', [['customers', 'Towage customers', api.store('customers', D.customers).length, 'Towage'], ['owners', 'Cargo owners (Buoys)', M.owners.length, 'Cargo owners'], ['groups', 'Colour groups', M.groups.length, 'Colours']]);
  };
  api.tableExtra['admin/customers'] = { tools: custTabs };
  var baseCustomers = api.views['admin/customers'];
  api.views['admin/customers'] = function () {
    tab.cust = tab.cust || (B.role() === 'MOD' ? 'owners' : 'customers');
    var t = tab.cust;
    if (t === 'customers') return baseCustomers();
    var head = custTabs();
    var sw = function (c) { return '<i class="by-dot" style="background:' + c + '"></i>'; };
    if (t === 'groups') {
      return page('Customers', 'A block on the buoy board takes its first cargo owner\'s own colour, else its group\'s colour, else the default.', api.dataTable({
        source: M.groups, list: M.groups.filter(function (g) { return api.matches(g.name); }), noun: 'group', add: addBtn('group', 'Add group'),
        tools: head + (canEdit() ? '<button class="dt-btn by-defcol" data-action="bs-defcolor">' + sw(M.defaultColor) + 'Default colour</button>' : '<span class="by-defcol">' + sw(M.defaultColor) + 'Default colour</span>'),
        cols: [{ key: 'name', label: 'Group', sort: 'text', cell: function (g) { return sw(g.color) + '<b>' + esc(g.name) + '</b>'; } },
          { key: 'n', label: 'Cargo owners', cell: function (g) { return esc(M.owners.filter(function (o) { return o.group === g.name; }).map(function (o) { return o.name; }).join(', ')) || api.dash(''); } }],
        actions: canEdit() ? function (g, i) { return api.btn('', 'data-action="bs-edit" data-arg="group:' + i + '"', 'Edit') + api.btn('danger', 'data-action="bs-del" data-arg="group:' + i + '"', 'Delete'); } : null
      }));
    }
    return page('Customers', 'Customers of the cargo handling (chủ hàng). The app keeps no contracts: prices carry effective dates.', api.dataTable({
      source: M.owners, list: M.owners.filter(function (o) { return api.matches([o.name, o.tax, o.group].join(' ')); }), noun: 'cargo owner', tools: head, add: addBtn('owner', 'Add cargo owner'),
      cols: [
        { key: 'name', label: 'Cargo owner', sort: 'text', cell: function (o) { return sw(B.ownerColor(o.name)) + '<b>' + esc(o.name) + '</b>'; } },
        { key: 'tax', label: 'Tax code', sort: 'text' },
        { key: 'group', label: 'Colour group', sort: 'text', cell: function (o) { return o.group ? esc(o.group) + (o.color ? ' <small class="dt-muted">· own colour</small>' : '') : '<span class="dt-muted">Default</span>'; } },
        { key: 'emails', label: 'Settlement emails', cell: function (o) { return o.emails && o.emails.length ? esc(o.emails.join(', ')) : '<span class="by-miss">None</span>'; } },
        { key: 'active', label: 'Status', cell: statusCell }
      ],
      actions: canEdit() ? function (o, i) { return lifeBtns('owner', i, o); } : null
    }));
  };
  api.actions['bs-defcolor'] = function () {
    if (!canEdit()) return;
    api.editDialog({
      title: 'Default colour', text: 'For cargo owners with no own colour and no group, and tickets with no cargo owner yet.',
      values: { color: M.defaultColor }, fields: [{ name: 'color', label: 'Colour', type: 'color' }],
      onSave: function (v) { M.defaultColor = v.color; save(); }
    });
  };

  // Ship agents are one list for towage and Buoys (SPEC-1 R-15): the buoy email setup is extra columns on Admin › Agents.
  var info = function (a) { return M.agentInfo[a.name] || {}; };
  api.tableExtra['admin/agents'] = {
    sub: ' Buoys: where PDA / FDA emails go, each agent\'s own email text, and who confirms the mother vessel and alongside FDAs together.',
    tools: function () { return isAdmin() ? '<button class="dt-btn" data-action="bs-format">Default PDA / FDA email text</button>' : ''; },
    cols: function () {
      return [
        { key: 'emails', label: 'PDA / FDA emails', cell: function (a) { var e = info(a).emails || []; return e.length ? esc(e.join(', ')) : '<span class="dt-muted">None</span>'; } },
        { key: 'format', label: 'Email text', cell: function (a) { return info(a).format ? 'Own text' : '<span class="dt-muted">Default</span>'; } },
        { key: 'extra', label: 'Extra info', cls: 'clip', cell: function (a) { return info(a).extra ? '<span title="' + esc(info(a).extra) + '">' + esc(info(a).extra) + '</span>' : api.dash(''); } },
        { key: 'together', label: 'Confirms FDAs together', cell: function (a) { return info(a).together ? 'Yes' : '<span class="dt-muted">No</span>'; } }
      ];
    },
    actions: function (a) { return isAdmin() ? api.btn('', 'data-action="bs-agent" data-arg="' + esc(a.name) + '"', 'PDA / FDA emails') : ''; }
  };
  api.actions['bs-agent'] = function (el) {
    if (!canEdit()) return;
    var name = el.dataset.arg;
    var x = M.agentInfo[name] || { emails: [], format: '', extra: '', together: false };
    api.editDialog({
      title: 'Buoy email setup · ' + name, text: 'Tokens: {agent} {doc} {vessel} {buoy}. Leave the text empty to use the default.',
      values: { emails: x.emails.join(', '), format: x.format, extra: x.extra, together: x.together },
      fields: [
        { name: 'emails', label: 'Emails (at least one)', req: true },
        { name: 'format', label: 'Own email text', type: 'textarea' },
        { name: 'extra', label: 'Extra information added to the email', placeholder: 'e.g. Ops: ops@agent.com' },
        { name: 'together', label: 'Confirms the mother vessel FDA and the alongside FDA together (as Viet Thuan)', type: 'checkbox' }
      ],
      onSave: function (v) {
        var emails = v.emails.split(/[,;\s]+/).filter(Boolean);
        if (!emails.length || emails.some(function (e) { return !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e); })) return { error: 'Enter at least one valid email address' };
        M.agentInfo[name] = { emails: emails, format: v.format, extra: v.extra, together: v.together };
        save();
      }
    });
  };
  api.actions['bs-format'] = function () {
    if (!canEdit()) return;
    api.editDialog({
      title: 'Default email text', text: 'Used for agents with no text of their own, and for every settlement email. Tokens: {agent} {doc} {vessel} {buoy}.',
      values: { format: M.emailFormat }, fields: [{ name: 'format', label: 'Text', type: 'textarea', req: true }],
      onSave: function (v) { M.emailFormat = v.format; save(); }
    });
  };

  api.views['admin/buoy-lists'] = function () {
    var t = tab.lists || 'services';
    var head = tabs('lists', [['services', 'Service types', M.services.length, 'Services'], ['cargo', 'Cargo types', M.cargoTypes.length, 'Cargo types']]);
    if (t === 'cargo') {
      return page('Buoy Services & Cargo', 'Cargo types picked on tickets and cargo-handling prices.', api.dataTable({
        source: M.cargoTypes, list: M.cargoTypes.filter(function (c) { return api.matches(c.name); }), noun: 'cargo type', tools: head, add: addBtn('cargoType', 'Add cargo type'),
        cols: [{ key: 'name', label: 'Cargo type', sort: 'text', cell: function (c) { return '<b>' + esc(c.name) + '</b>'; } }, { key: 'active', label: 'Status', cell: statusCell }],
        actions: canEdit() ? function (c, i) { return lifeBtns('cargoType', i, c); } : null
      }));
    }
    return page('Buoy Services & Cargo', 'Services the Operator logs on a ticket (no quantity); each maps to one tariff charge or none.', api.dataTable({
      source: M.services, list: M.services.filter(function (s) { return api.matches(s.name); }), noun: 'service type', tools: head, add: addBtn('service', 'Add service type'),
      cols: [{ key: 'name', label: 'Service type', sort: 'text', cell: function (s) { return '<b>' + esc(s.name) + '</b>'; } },
        { key: 'charge', label: 'Tariff charge', cell: function (s) { return s.charge ? esc(B.CHARGES[s.charge]) : '<span class="dt-muted">None · line has no price</span>'; } },
        { key: 'active', label: 'Status', cell: statusCell }],
      actions: canEdit() ? function (s, i) { return lifeBtns('service', i, s); } : null
    }));
  };

  // "1 bank account · USD" / "No bank account yet" for the tug provider card and its picker.
  var bankLine = function (c) {
    var n = c ? c.banks.length : 0;
    if (!n) return 'No bank account yet';
    var cur = c.banks.map(function (a) { return a.currency; }).filter(function (x, i, a) { return x && a.indexOf(x) === i; });
    return n + ' bank account' + (n > 1 ? 's' : '') + (cur.length ? ' · ' + cur.join(', ') : '');
  };
  var tugCard = function () {
    var c = M.companies.filter(function (x) { return x.name === M.tugProvider; })[0];
    var inner = '<span class="by-tugp-ic">' + emoji('⛴️') + '</span><span class="by-tugp-t"><small>Tug provider</small><b>' + esc(M.tugProvider || 'Not set') + '</b>' +
      '<em class="' + (c && c.banks.length ? '' : 'warn') + '">' + esc(bankLine(c)) + '</em></span>';
    return canEdit() ? '<button type="button" class="by-tugp" data-action="bs-tugp" title="Change the tug provider">' + inner + '<span class="by-tugp-go">Change' + api.I.pRight + '</span></button>'
      : '<div class="by-tugp">' + inner + '</div>';
  };

  api.views['admin/buoy-companies'] = function () {
    return page('Buoy Companies & Banks', 'Bank accounts printed on PDA / FDA: the buoy owner\'s, plus the tug provider\'s for tug charges (each company once).', api.dataTable({
      source: M.companies, list: M.companies.filter(function (c) { return api.matches(c.name + ' ' + c.full); }), noun: 'record', add: addBtn('company', 'Add company'),
      tools: tugCard(),
      cols: [
        { key: 'name', label: 'Company', sort: 'text', cell: function (c) { return '<b>' + esc(c.name) + '</b><small class="by-sub">' + esc(c.full || '') + '</small>'; } },
        { key: 'tax', label: 'Tax code' },
        { key: 'banks', label: 'Bank accounts', cell: function (c) {
          return c.banks.length ? c.banks.map(function (a, j) {
            // Two short lines (account, then bank) so the cell never runs under the sticky action buttons.
            return '<div class="by-bank"><b>' + esc(a.number + ' · ' + a.currency) + '</b>' + (a.swift ? ' · ' + esc(a.swift) : '') +
              (canEdit() ? ' <a data-action="bs-bank" data-arg="' + M.companies.indexOf(c) + ':' + j + '">Edit</a>' : '') +
              '<small>' + esc(a.bank + ', ' + a.branch) + '</small></div>';
          }).join('') : '<span class="dt-muted">None</span>';
        } },
        { key: 'use', label: 'Used as', cls: 'by-wrap', cell: function (c) { return esc(USES.company(c).join(', ')) || api.dash(''); } }
      ],
      actions: canEdit() ? function (c, i) {
        return api.btn('', 'data-action="bs-bank" data-arg="' + i + ':new"', '+ Bank account') + api.btn('', 'data-action="bs-edit" data-arg="company:' + i + '"', 'Edit') + api.btn('danger', 'data-action="bs-del" data-arg="company:' + i + '"', 'Delete');
      } : null
    }));
  };
  api.actions['bs-tugp'] = function () {
    if (!canEdit()) return;
    api.editDialog({
      title: 'Tug provider', text: 'The company whose bank accounts print on PDA / FDA for tug charges.', cls: 'ed-tidy by-tugdlg', okLabel: 'Set provider',
      values: { tug: M.tugProvider },
      fields: [{ name: 'tug', label: 'Company', type: 'one', req: true, search: M.companies.length > 6, options: M.companies.map(function (c) {
        var has = c.banks.length > 0;
        return { value: c.name, label: c.name, title: c.full || '',
          html: '<i class="by-tug-av">' + esc(c.name.split(' ')[0].slice(0, 4).toUpperCase()) + '</i><span class="by-tug-n"><b>' + esc(c.name) + (c.name === M.tugProvider ? '<u>Current</u>' : '') + '</b>' +
            '<small>' + esc(c.full || '') + '</small><em class="' + (has ? '' : 'warn') + '">' + esc(bankLine(c)) + '</em></span>' };
      }) }],
      onSave: function (v) { if (v.tug !== M.tugProvider) { M.tugProvider = v.tug; save(); api.toast('Tug provider: ' + v.tug); } }
    });
  };
  api.actions['bs-bank'] = function (el) {
    if (!canEdit()) return;
    var p = el.dataset.arg.split(':');
    var c = M.companies[Number(p[0])];
    var isNew = p[1] === 'new';
    var a = isNew ? { currency: 'USD' } : c.banks[Number(p[1])];
    api.editDialog({
      title: (isNew ? 'New bank account · ' : 'Bank account · ') + c.name,
      values: a,
      fields: [
        { name: 'beneficiary', label: 'Beneficiary name', req: true },
        { name: 'number', label: 'Account number', req: true, half: true },
        { name: 'currency', label: 'Currency', type: 'select', half: true, options: [{ value: 'USD', label: 'USD' }, { value: 'VND', label: 'VND' }] },
        { name: 'bank', label: 'Bank', req: true, half: true },
        { name: 'branch', label: 'Branch', req: true, half: true },
        { name: 'swift', label: 'SWIFT', hint: 'Optional (VND accounts usually have none)' }
      ],
      reset: isNew ? null : { label: 'Delete account', run: function () { c.banks.splice(Number(p[1]), 1); save(); } },
      onSave: function (v) {
        if (isNew) c.banks.push(v); else Object.assign(a, v);
        save();
      }
    });
  };
});
