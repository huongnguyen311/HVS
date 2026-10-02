// Phase 4 · Dashboards: plan board route, history dashboard, board column defaults, service types,
// and the ticket hold dialog used by the tickets screens.
(window.HVS_EXT = window.HVS_EXT || []).push(function (api) {
  'use strict';

  var D = api.D;
  var state = api.state;
  var esc = api.esc;
  var emoji = api.emoji;
  var I = api.I;

  // ---------- plan board ----------

  // The board itself is React + antd (src/board → assets/board/board.js); app.js mounts it into #board-root.
  api.views.board = function () {
    return api.header() + '<div id="board-root"></div>';
  };

  // ---------- column presets (admin board defaults) ----------

  function columnKeys() { return D.boardColumns.map(function (c) { return c.key; }); }

  function presetColumns(name) {
    var p = D.columnPresets[name];
    return p ? p.slice() : columnKeys();
  }

  // ---------- action sheet ----------

  function actionSheet(title, sub, items) {
    var html = '<div class="mask light" data-action="close"></div><div class="bsheet asheet"><div class="asheet-head"><h3>' + esc(title) + '</h3>' +
      (sub ? '<p>' + sub + '</p>' : '') + '</div>' + items.map(function (it, i) {
        if (it.sep) return '<div class="asheet-sep">' + esc(it.sep) + '</div>';
        return '<button class="asheet-item' + (it.danger ? ' danger' : '') + (it.muted ? ' muted' : '') + '" data-i="' + i + '">' + (it.icon ? emoji(it.icon) : '') + esc(it.label) + '</button>';
      }).join('') + '<button class="asheet-cancel" data-action="close">Cancel</button></div>';
    var wrap = api.openOverlay(html, 'sheet', '#a8a8a8');
    wrap.querySelector('.asheet').addEventListener('click', function (e) {
      var b = e.target.closest('[data-i]');
      if (!b) return;
      api.closeOverlay(true);
      items[Number(b.dataset.i)].run();
    });
  }

  api.actionSheet = actionSheet;

  // ---------- ticket hold (H1–H7) ----------

  function holdDialog(key, label, done) {
    var html = '<div class="mask light" data-action="close"></div><form class="dialog" data-hold-form><h3>Hold ticket</h3>' +
      '<p class="dlg-text">' + esc(label) + ' stays in its current status, paused. The client gets a push notification with the reason.</p>' +
      '<label class="field-label">Reason<span class="req">*</span></label><div class="reason-chips">' + D.holdReasons.map(function (r) {
        return '<button type="button" data-reason="' + esc(r) + '">' + esc(r) + '</button>';
      }).join('') + '</div>' +
      '<textarea class="text-area" name="reason" placeholder="e.g. Vessel delayed, ETA 14:00 tomorrow" required></textarea>' +
      '<div class="hold-err" hidden>A hold needs a reason</div>' +
      '<div class="actions"><button type="button" class="pill-btn outline dark" data-action="close">Cancel</button><button type="submit" class="pill-btn primary">Hold</button></div></form>';
    var wrap = api.openOverlay(html, 'dialog', '#a8a8a8');
    var form = wrap.querySelector('[data-hold-form]');
    form.style.top = Math.max(60, (window.innerHeight - form.offsetHeight) / 2 - 30) + 'px';
    form.addEventListener('click', function (e) {
      var b = e.target.closest('[data-reason]');
      if (!b) return;
      form.reason.value = b.dataset.reason;
      form.querySelectorAll('[data-reason]').forEach(function (x) { x.classList.toggle('on', x === b); });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var reason = form.reason.value.trim();
      form.querySelector('.hold-err').hidden = !!reason;
      if (!reason) return;
      state.holds[key] = { reason: reason, by: api.user.name, at: Date.now() };
      api.save('holds', state.holds);
      notify('⏸', 'Ticket on hold ' + label.replace(/^#\S+ · /, ''), ['Reason: ' + reason, 'Client notified by push'], key);
      api.closeOverlay();
      (done || api.render)();
      api.toast('On hold · client notified');
    });
  }

  function releaseHold(key, label, done) {
    delete state.holds[key];
    api.save('holds', state.holds);
    notify('▶️', 'Ticket resumed ' + label, ['The hold was released', 'Client notified by push'], key);
    (done || api.render)();
    api.toast('Hold released · client notified');
  }

  // Hold / release reach the client who owns the ticket ('t:<id>' → its creator), and the operations side.
  function notify(icon, title, lines, key) {
    var t = state.tickets.filter(function (x) { return 't:' + x.id === key; })[0];
    api.notify(icon, title, lines, ['ADMIN', 'MOD', 'CLIENT'], t ? 'by:' + t.by : '');
  }

  // Hold / release from the ticket form (tickets list keys are 't:<id>').
  api.actions['hold-ticket'] = function (el) {
    holdDialog(el.dataset.holdKey, el.dataset.holdLabel);
  };
  api.actions['release-hold'] = function (el) {
    releaseHold(el.dataset.holdKey, el.dataset.holdLabel);
  };

  // ---------- history dashboard (D4) ----------

  // The plan board's closed tickets, as a React island like the board (src/components/HistoryTable.jsx).
  api.views.history = function () {
    return api.header() + '<div id="board-root" data-view="history"></div>';
  };

  // ---------- admin: board column defaults (A3) ----------

  // Defaults, not permissions: global, per role and per user, each a list of columns (or none). The board applies
  // own choice on the device → per user → per role → global → every column (src/board/store.js). Admins can set
  // the same defaults from the board's Board display sheet (Apply to).
  var REQUIRED_COLS = D.boardColumns.filter(function (c) { return c.required; }).map(function (c) { return c.key; });

  function bdState() {
    return api.store('boardDefaults', { global: D.globalDefault, roles: D.roleDefaults, users: D.userDefaults });
  }

  // A stored default → its column keys (required ones always in), or null when the level has none.
  function colsFrom(v) {
    if (v == null || v === '') return null;
    if (Array.isArray(v)) return columnKeys().filter(function (k) { return v.indexOf(k) >= 0 || REQUIRED_COLS.indexOf(k) >= 0; });
    return presetColumns(v); // a preset name saved by an earlier version
  }

  function levelOf(d, scope, key) {
    return scope === 'global' ? d.global : scope === 'role' ? d.roles[key] : d.users[key];
  }

  // What a level shows when it has no columns of its own.
  function fallbackOf(d, scope, key) {
    var global = colsFrom(d.global) || columnKeys();
    if (scope === 'global') return columnKeys();
    if (scope === 'role') return global;
    var u = state.users.filter(function (x) { return x.name === key; })[0] || {};
    return colsFrom(d.roles[u.role]) || global;
  }

  // "No default" / "All columns", then one chip per column: tap to show or hide it at this level.
  function level(d, scope, key, sm) {
    var own = colsFrom(levelOf(d, scope, key));
    var cols = own || fallbackOf(d, scope, key);
    var all = own && own.length === columnKeys().length;
    var attrs = ' data-scope="' + scope + '" data-key="' + esc(key) + '"';
    return '<div class="cfg-seg' + (sm ? ' sm' : '') + '">' +
      '<button type="button" class="' + (!own ? 'on' : '') + '" data-action="bd-set" data-value="none"' + attrs + '>No default</button>' +
      '<button type="button" class="' + (all ? 'on' : '') + '" data-action="bd-set" data-value="all"' + attrs + '>All columns</button>' +
      '<button type="button" class="' + (own && !all ? 'on' : '') + '" tabindex="-1" disabled>' + (own && !all ? 'Custom · ' + own.length : 'Custom') + '</button></div>' +
      '<div class="bd-cols' + (own ? '' : ' inherited') + '">' + D.boardColumns.filter(function (c) { return c.label; }).map(function (c) {
        var on = cols.indexOf(c.key) >= 0;
        var req = REQUIRED_COLS.indexOf(c.key) >= 0;
        return '<span role="button" class="' + (on ? 'on' : '') + (req ? ' req' : '') + '"' + (req ? '' : ' data-action="bd-col" data-bdcol="' + c.key + '"' + attrs) + '>' + esc(c.label) + '</span>';
      }).join('') + '</div>';
  }

  api.views['admin/board-defaults'] = function () {
    var d = bdState();
    var people = state.users.filter(function (u) { return /^(ADMIN|MOD|CAPTAIN)$/.test(u.role); });
    var count = function (scope, key) {
      var own = colsFrom(levelOf(d, scope, key));
      return own ? own.length + ' of ' + D.boardColumns.length + ' columns' : scope === 'global' ? 'every column' : scope === 'role' ? 'uses global' : 'uses role default';
    };
    return api.header() + '<div class="page"><div><p class="section-sub">The columns people start from. A default, not a permission: anyone can still turn a column back on, on their own device.</p></div>' +
      '<p class="bd-order">Applied in this order: own choice on the device → per user → per role → global → every column. Tap a column to show or hide it at that level.</p>' +
      '<div class="card bd-card"><div class="bd-top"><h4>Global</h4><span>' + count('global', '') + '</span></div>' + level(d, 'global', '') + '</div>' +
      '<h3 class="files-title">Per role</h3>' +
      ['ADMIN', 'MOD', 'CAPTAIN'].map(function (role) {
        return '<div class="card bd-card"><div class="bd-top"><h4>' + role.charAt(0) + role.slice(1).toLowerCase() + '</h4><span>' + count('role', role) + '</span></div>' + level(d, 'role', role) + '</div>';
      }).join('') +
      '<h3 class="files-title">Per user</h3><p class="section-sub" style="margin:-6px 0 12px">Overrides the role default for one person.</p>' +
      people.map(function (u) {
        return '<div class="card bd-card"><div class="bd-top"><h4>' + esc(u.name) + ' <small>' + esc(u.role) + '</small></h4><span>' + count('user', u.name) + '</span></div>' + level(d, 'user', u.name, true) + '</div>';
      }).join('') + '</div>';
  };

  // D21: the same per-user chips inside Admin › Edit user. They save at once and redraw in place, so the
  // rest of the user form (unsaved typing) is kept.
  api.boardDefaultsField = function (u) {
    if (!/^(ADMIN|MOD|CAPTAIN)$/.test(u.role)) return '';
    return '<label class="field-label" style="margin-top:14px">Board columns (default for this user)</label>' +
      '<div class="bd-host" data-bd-host>' + level(bdState(), 'user', u.name, true) + '</div>';
  };
  function redraw(el) {
    var host = el.closest('[data-bd-host]');
    if (!host) { var y = window.scrollY; api.render(); window.scrollTo(0, y); return; }
    host.innerHTML = level(bdState(), el.dataset.scope, el.dataset.key, true);
  }

  function setLevel(d, scope, key, value) {
    if (scope === 'global') d.global = value;
    else if (scope === 'role') d.roles[key] = value;
    else if (value) d.users[key] = value;
    else delete d.users[key];
  }

  api.actions['bd-set'] = function (el) {
    var d = bdState();
    var scope = el.dataset.scope;
    var key = el.dataset.key;
    var value = el.dataset.value === 'all' ? 'All' : null;
    setLevel(d, scope, key, value);
    api.save('boardDefaults', d);
    redraw(el);
    api.toast((scope === 'global' ? 'Global' : key) + (value ? ' · all columns' : ' · default cleared'));
  };

  api.actions['bd-col'] = function (el) {
    var d = bdState();
    var scope = el.dataset.scope;
    var key = el.dataset.key;
    var cols = (colsFrom(levelOf(d, scope, key)) || fallbackOf(d, scope, key)).slice();
    var at = cols.indexOf(el.dataset.bdcol);
    if (at >= 0) cols.splice(at, 1); else cols.push(el.dataset.bdcol);
    cols = columnKeys().filter(function (k) { return cols.indexOf(k) >= 0; });
    setLevel(d, scope, key, cols.length === columnKeys().length ? 'All' : cols);
    api.save('boardDefaults', d);
    redraw(el);
  };

  // ---------- admin: service types (A2) ----------

  var RENDERS = [['block', 'Block (1 cell per tugboat)'], ['background', 'Background strip (POB in → out)'], ['end_pinned', 'End of row (no time)']];
  var ATS = [['in', 'Starts at POB in'], ['out', 'Starts at POB out'], ['span', 'Spans POB in → POB out'], ['after', 'Right after Mano (arrival)'], ['pob', 'Starts at POB in, else POB out'], ['end', 'No POB time (row end)']];
  var ANCHORS = { in: 'in', out: 'out', span: 'both', set: 'none', pob: 'in_out', after: 'in', end: 'none' };
  // §11.4: which POB time the service hangs on, set explicitly (Window / POB only suggests it).
  var ANCHOR_OPTS = [['in', 'POB in'], ['out', 'POB out'], ['in_out', 'POB in, else POB out'], ['both', 'POB in and POB out'], ['none', 'None']];
  var WIDTHS = [['per_boat', '1 cell per tugboat'], ['by_time', 'As long as its window']];
  var GROUPS = [['one_block_all', 'One block for all tugboats'], ['block_per_boat', 'One block per tugboat']];
  var label = function (list, v) { return (list.filter(function (x) { return x[0] === v; })[0] || [v, v])[1]; };
  var yes = function (b) { return b ? '✓' : '<span class="dt-muted">-</span>'; };

  function saveServices() { api.save('services', D.services); }

  api.views['admin/services'] = function () {
    var q = api.norm(state.search.trim());
    return api.deskPage('Service Types', 'The board and the ticket form render every service from these rows. Adding one needs no deploy.', api.dataTable({
      source: D.services,
      list: D.services.filter(function (s) { return !q || api.norm(s.name + ' ' + (s.vi || '') + ' ' + s.code).indexOf(q) >= 0; }),
      noun: 'service type', placeholder: 'Search by name (EN / VI) or code...',
      add: { action: 'svc-new', label: 'Add service type' },
      cols: [
        { key: 'name', label: 'Service', sort: 'text', cell: function (s) {
          return '<span class="dt-svc"><i style="background:' + s.color + ';border-color:' + s.border + '"></i><b>' + esc(s.name) + '</b></span>';
        } },
        { key: 'code', label: 'Code', sort: 'text', cell: function (s) { return '<code>' + esc(s.code) + '</code>'; } },
        { key: 'vi', label: 'Name (Vietnamese)', sort: 'text' },
        { key: 'short', label: 'Legend label', sort: 'text' },
        { key: 'render', label: 'Drawn as', sort: 'text', cell: function (s) { return esc(label(RENDERS, s.render)); } },
        { key: 'at', label: 'Window / POB', sort: 'text', cell: function (s) { return esc(label(ATS, s.at)); } },
        { key: 'anchor', label: 'POB anchor', sort: 'text', cell: function (s) { return esc(label(ANCHOR_OPTS, s.anchor || ANCHORS[s.at] || 'none')); } },
        { key: 'mins', label: 'Length (min)', sort: 'number', cls: 'num' },
        { key: 'orderIn', label: 'Queue in', sort: 'number', cls: 'num', cell: function (s) { return api.dash(s.orderIn); } },
        { key: 'orderOut', label: 'Queue out', sort: 'number', cls: 'num', cell: function (s) { return api.dash(s.orderOut); } },
        { key: 'stack', label: 'Stack', sort: 'number', cls: 'num' },
        { key: 'grouping', label: 'Boats', sort: 'text', cell: function (s) { return esc(label(GROUPS, s.grouping)); } },
        { key: 'width', label: 'Width', sort: 'text', cell: function (s) { return esc(label(WIDTHS, s.width)); } },
        { key: 'escort', label: 'Escort', cell: function (s) { return yes(s.escort); } },
        { key: 'multi', label: 'Repeatable', cell: function (s) { return yes(s.multi); } },
        { key: 'colors', label: 'Colours', cell: function (s) {
          return '<span class="dt-swatches" title="fill ' + s.color + ' · text ' + s.text + ' · border ' + s.border + '"><i style="background:' + s.color + '"></i><i style="background:' + s.text + '"></i><i style="background:' + s.border + '"></i></span>';
        } },
        { key: 'fields', label: 'Fields to fill', cell: function (s) {
          return s.fields.length ? '<span class="dt-tags">' + s.fields.map(function (f) { return '<span>' + esc(f) + '</span>'; }).join('') + '</span>' : '<span class="dt-muted">None</span>';
        } }
      ],
      actions: function (s, i) { return api.btn('', 'data-action="svc-edit" data-arg="' + i + '"', 'Edit'); }
    }));
  };

  function serviceDialog(index) {
    var isNew = index == null;
    var s = isNew ? { render: 'block', at: 'after', grouping: 'one_block_all', width: 'per_boat', stack: 30, mins: 90, color: '#e0f2fe', text: '#0c4a6e', border: '#38bdf8', fields: [] } : D.services[index];
    var opts = function (list) { return list.map(function (x) { return { value: x[0], label: x[1] }; }); };
    api.editDialog({
      title: isNew ? 'New service type' : 'Edit ' + s.name,
      values: Object.assign({}, s, { anchor: s.anchor || ANCHORS[s.at] || 'none', fields: s.fields.join(', '), orderIn: s.orderIn == null ? '' : s.orderIn, orderOut: s.orderOut == null ? '' : s.orderOut }),
      fields: [
        { name: 'name', label: 'Name', req: true, half: true },
        { name: 'vi', label: 'Name (Vietnamese)', req: true, half: true, hint: 'e.g. Mano vào' },
        { name: 'code', label: 'Code', req: true, half: true, hint: isNew ? 'Lowercase, no spaces; cannot change later.' : 'Fixed once created.' },
        { name: 'short', label: 'Legend label', half: true },
        { name: 'render', label: 'Drawn as', type: 'select', options: opts(RENDERS) },
        { name: 'at', label: 'Window / POB', type: 'select', options: opts(ATS) },
        { name: 'anchor', label: 'POB anchor', type: 'select', options: opts(ANCHOR_OPTS) },
        { name: 'orderIn', label: 'Queue order at POB in', type: 'number', half: true, hint: 'Empty = not in the queue' },
        { name: 'orderOut', label: 'Queue order at POB out', type: 'number', half: true },
        { name: 'stack', label: 'Stack order (overlaps)', type: 'number', half: true, hint: 'Higher draws on top' },
        { name: 'mins', label: 'Default length (min)', type: 'number', half: true },
        { name: 'grouping', label: 'Tugboats', type: 'select', options: opts(GROUPS) },
        { name: 'width', label: 'Block width', type: 'select', options: opts(WIDTHS) },
        { name: 'escort', label: 'Offers "include escort"', type: 'checkbox' },
        { name: 'multi', label: 'Allowed more than once on a ticket', type: 'checkbox' },
        { name: 'color', label: 'Fill', type: 'color', half: true },
        { name: 'text', label: 'Text', type: 'color', half: true },
        { name: 'border', label: 'Border', type: 'color', half: true },
        { name: 'fields', label: 'Fields to fill', placeholder: 'e.g. Escort rule, Escort boats', hint: 'Comma separated' }
      ],
      onSave: function (v) {
        var code = isNew ? v.code.toLowerCase().replace(/[^a-z0-9_]/g, '_') : s.code;
        if (isNew && D.services.some(function (x) { return x.code === code; })) return { error: 'Code "' + code + '" is already used.' };
        var num = function (x) { return x === '' ? null : Number(x); };
        var row = Object.assign({}, s, {
          code: code, name: v.name, vi: v.vi, short: v.short || v.name, render: v.render, at: v.at, anchor: v.anchor,
          orderIn: num(v.orderIn), orderOut: num(v.orderOut), stack: num(v.stack) || 0, mins: num(v.mins) || 90,
          grouping: v.grouping, width: v.width, escort: v.escort, multi: v.multi, color: v.color, text: v.text, border: v.border,
          fields: v.fields ? v.fields.split(',').map(function (x) { return x.trim(); }).filter(Boolean) : [], hint: label(ATS, v.at), desc: s.desc || ''
        });
        if (isNew) D.services.push(row); else D.services[index] = row;
        saveServices();
        api.toast(isNew ? 'Service type added · no deploy needed' : 'Service type saved');
      }
    });
  }

  api.actions['svc-edit'] = function (el) { serviceDialog(Number(el.dataset.arg)); };
  api.actions['svc-new'] = function () { serviceDialog(); };
});
