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

  // opts.reset = { label, run }: a filter's sheet gets a Reset above Cancel.
  function actionSheet(title, sub, items, opts) {
    var reset = opts && opts.reset;
    var html = '<div class="mask light" data-action="close"></div><div class="bsheet asheet"><div class="asheet-head"><h3>' + esc(title) + '</h3>' +
      (sub ? '<p>' + sub + '</p>' : '') + '</div>' + items.map(function (it, i) {
        if (it.sep) return '<div class="asheet-sep">' + esc(it.sep) + '</div>';
        return '<button class="asheet-item' + (it.danger ? ' danger' : '') + (it.muted ? ' muted' : '') + '" data-i="' + i + '">' + (it.icon ? emoji(it.icon) : '') + esc(it.label) + '</button>';
      }).join('') + (reset ? '<button class="asheet-reset" data-reset>' + esc(reset.label || 'Reset') + '</button>' : '') +
      '<button class="asheet-cancel" data-action="close">Cancel</button></div>';
    var wrap = api.openOverlay(html, 'sheet', '#a8a8a8');
    wrap.querySelector('.asheet').addEventListener('click', function (e) {
      if (reset && e.target.closest('[data-reset]')) { api.closeOverlay(true); return reset.run(); }
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

  // The one place an admin sets which columns people start from on the Plan Board, in three levels read top
  // down: the Plan board default → per role (same as the default, or its own) → exceptions for single users.
  // The board applies: own choice on the device → user exception → role → Plan board default
  // (src/board/store.js). Defaults, not permissions: anyone can still change their own view.
  // Edits are a draft until Save, like the board's own Board display sheet.
  var REQUIRED_COLS = D.boardColumns.filter(function (c) { return c.required; }).map(function (c) { return c.key; });
  var BOARD_ROLES = ['ADMIN', 'MOD', 'CAPTAIN'];
  var PRESETS = ['All', 'Compact', 'Minimum'];
  var bdDraft = null; // the edited copy; null = nothing changed

  function bdState() {
    return api.store('boardDefaults2', { global: D.globalDefault, roles: D.roleDefaults, users: D.userDefaults });
  }
  function bdCopy(d) { return { global: d.global, roles: Object.assign({}, d.roles), users: Object.assign({}, d.users) }; }
  function bdWork() { return bdDraft || bdCopy(bdState()); }
  function bdDirty() { return !!bdDraft && JSON.stringify(bdDraft) !== JSON.stringify(bdCopy(bdState())); }

  // A stored default → its column keys in board order (required ones always in), or null when the level has none.
  function colsFrom(v) {
    if (v == null || v === '') return null;
    if (Array.isArray(v)) return columnKeys().filter(function (k) { return v.indexOf(k) >= 0 || REQUIRED_COLS.indexOf(k) >= 0; });
    return presetColumns(v); // 'All' or a preset name
  }
  var toStored = function (cols) { return cols.length === columnKeys().length ? 'All' : cols; };

  function boardUsers() {
    return state.users.filter(function (u) { return BOARD_ROLES.indexOf(u.role) >= 0 && u.status !== 'BANNED'; });
  }
  var roleName = function (r) { return r.charAt(0) + r.slice(1).toLowerCase(); };
  var plural = function (n) { return n + ' column' + (n === 1 ? '' : 's'); };

  // The Plan board default (no value = every column), a role's columns, and where a user's columns come from.
  function globalCols(d) { return colsFrom(d.global) || columnKeys(); }
  function roleCols(d, role) { return colsFrom(d.roles[role]) || globalCols(d); }
  function userSource(d, u) {
    if (colsFrom(d.users[u.name])) return { cols: colsFrom(d.users[u.name]), text: 'personal exception' };
    if (colsFrom(d.roles[u.role])) return { cols: roleCols(d, u.role), text: roleName(u.role) + ' default' };
    return { cols: globalCols(d), text: 'Plan board default' };
  }

  var LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  var bdPeek = [];   // the people picked under "Who sees what" (names)

  // One chip per column: on (✓), off (dashed), or always shown (🔒, not tappable). Without a scope it is a
  // read-only list of just the columns shown.
  function colChips(cols, scope, key) {
    var attrs = scope ? ' data-scope="' + scope + '" data-key="' + esc(key) + '"' : '';
    return '<div class="bd-cols' + (scope ? '' : ' ro') + '">' + D.boardColumns.filter(function (c) { return c.label && (scope || cols.indexOf(c.key) >= 0); }).map(function (c) {
      var on = cols.indexOf(c.key) >= 0;
      var req = REQUIRED_COLS.indexOf(c.key) >= 0;
      var tap = scope && !req;
      return '<span' + (tap ? ' role="button" data-action="bd-col" data-bdcol="' + c.key + '"' + attrs : '') +
        ' class="' + (on ? 'on' : '') + (req ? ' req' : '') + '"' + (req ? ' title="Always shown"' : '') + '>' +
        (req ? LOCK : on ? I.check : '') + esc(c.label) + '</span>';
    }).join('') + '</div>';
  }

  // Preset buttons (the one matching the columns lights up) and the chips for a level.
  function colPicker(scope, key, cols) {
    var attrs = ' data-scope="' + scope + '" data-key="' + esc(key) + '"';
    var match = PRESETS.filter(function (p) { return colsFrom(presetColumns(p)).join() === colsFrom(cols).join(); })[0];
    return '<div class="cfg-seg sm bd-presets">' + PRESETS.map(function (p) {
        return '<button type="button" class="' + (p === match ? 'on' : '') + '" data-action="bd-preset" data-value="' + p + '"' + attrs + '>' + p + '</button>';
      }).join('') + '</div>' + colChips(cols, scope, key);
  }

  // "Who sees what": pick one or more people on the board and see the columns each starts from, with unsaved
  // edits included. The ✕ on the picker clears them; the rest of it reopens the picker.
  function peekCard(d) {
    var us = bdPeek.map(function (n) { return boardUsers().filter(function (x) { return x.name === n; })[0]; }).filter(Boolean);
    var head = !us.length ? '<span>Choose people…</span>' : us.length === 1 ? '<b>' + esc(us[0].name) + '</b><small>' + esc(roleName(us[0].role)) + '</small>' :
      '<b>' + esc(us[0].name) + ' +' + (us.length - 1) + '</b><small>' + us.length + ' people</small>';
    return '<div class="card bd-card bd-peek"><div class="bd-top"><h4>Who sees what</h4></div>' +
      '<button type="button" class="bd-pick" data-action="bd-peek"' + (us.length ? ' title="' + esc(us.map(function (u) { return u.name; }).join(', ')) + '"' : '') + '>' + head +
        (us.length ? '<span class="bd-pick-x" role="button" aria-label="Clear people" data-action="bd-peek-clear">' + I.close + '</span>' : I.down) + '</button>' +
      us.map(function (u) {
        var s = userSource(d, u);
        return '<div class="bd-peek-one">' + (us.length > 1 ? '<h5>' + esc(u.name) + ' <small>' + esc(roleName(u.role)) + '</small></h5>' : '') +
          '<p class="bd-hint bd-peek-src">Starts with ' + plural(s.cols.length) + ', from <b>' + esc(s.text) + '</b>.</p>' + colChips(s.cols) + '</div>';
      }).join('') + '</div>';
  }

  api.views['admin/board-defaults'] = function () {
    var d = bdWork();
    var exceptions = boardUsers().filter(function (u) { return colsFrom(d.users[u.name]); });
    var g = globalCols(d);
    return api.header() + '<div class="page bd-page' + (bdDirty() ? ' dirty' : '') + '">' +
      '<p class="bd-order">Starting columns only: anyone can change their own view. Applied: person → role → default.</p>' +
      peekCard(d) +
      // 1 · the Plan board default
      '<div class="card bd-card"><div class="bd-top"><h4>Plan board default</h4><span>' + plural(g.length) + '</span></div>' +
        '<p class="bd-hint">Everyone starts from this, unless their role has custom columns or they have a personal exception. Tap a column to show or hide it; locked ones are always shown.</p>' + colPicker('global', '', g) + '</div>' +
      // 2 · per role
      '<h3 class="files-title">By role</h3>' + BOARD_ROLES.map(function (role) {
        var own = colsFrom(d.roles[role]);
        var cols = roleCols(d, role);
        var attrs = ' data-key="' + role + '"';
        return '<div class="card bd-card"><div class="bd-top"><h4>' + roleName(role) + '</h4><span>' + (own ? 'Custom · ' : 'Same as default · ') + plural(cols.length) + '</span></div>' +
          '<div class="cfg-seg sm"><button type="button" class="' + (own ? '' : 'on') + '" data-action="bd-role" data-value="same"' + attrs + '>Same as default</button>' +
          '<button type="button" class="' + (own ? 'on' : '') + '" data-action="bd-role" data-value="own"' + attrs + '>Custom for this role</button></div>' +
          (own ? colPicker('role', role, cols) : '') + '</div>';
      }).join('') +
      // 3 · exceptions for single users
      '<div class="bd-sec-head" id="bd-users"><h3 class="files-title">User exceptions (' + exceptions.length + ')</h3>' +
        '<button type="button" class="bd-add-sm" data-action="bd-adduser">' + I.plus + 'Add</button></div>' +
      '<p class="section-sub bd-sub">For someone who needs other columns than their role.</p>' +
      (exceptions.length ? exceptions.map(function (u) {
        var cols = colsFrom(d.users[u.name]);
        return '<div class="card bd-card" data-bd-user="' + esc(u.name) + '"><div class="bd-top"><h4>' + esc(u.name) + ' <small>' + esc(roleName(u.role)) + '</small></h4><span>' + plural(cols.length) + '</span></div>' +
          '<p class="bd-hint">Instead of the ' + esc(roleName(u.role)) + ' columns (' + plural(roleCols(d, u.role).length) + ').</p>' + colPicker('user', u.name, cols) +
          '<button type="button" class="bd-remove" data-action="bd-unuser" data-key="' + esc(u.name) + '">Remove exception</button></div>';
      }).join('') : '<p class="adm-empty">No exceptions: everyone follows their role.</p>') +
      (bdDirty() ? '<div class="bd-save"><p>Unsaved changes</p><div class="bd-save-btns"><button type="button" class="pill-btn outline dark" data-action="bd-discard">Discard</button>' +
        '<button type="button" class="pill-btn primary" data-action="bd-save">Save</button></div></div>' : '') +
      '</div>';
  };

  // Admin › Edit user: a read-only line saying where this person's board columns come from, with the way to
  // change them (Board Defaults is the only place they are edited).
  api.boardDefaultsField = function (u) {
    if (BOARD_ROLES.indexOf(u.role) < 0 || !u.name) return '';
    var s = userSource(bdState(), u);
    return '<label class="field-label" style="margin-top:14px">Plan Board columns</label>' +
      '<div class="bd-line"><span>' + plural(s.cols.length) + ' · ' + esc(s.text) + '</span><button type="button" data-go="admin/board-defaults">Edit in Board Defaults ›</button></div>';
  };

  function setLevel(d, scope, key, value) {
    if (scope === 'global') d.global = value;
    else if (scope === 'role') d.roles[key] = value;
    else if (value) d.users[key] = value;
    else delete d.users[key];
  }
  function edit(fn) {
    var y = window.scrollY;
    bdDraft = bdWork();
    fn(bdDraft);
    api.render();
    window.scrollTo(0, y);
  }
  function levelCols(d, scope, key) {
    if (scope === 'global') return globalCols(d);
    if (scope === 'role') return roleCols(d, key);
    return colsFrom(d.users[key]);
  }

  api.actions['bd-preset'] = function (el) {
    edit(function (d) { setLevel(d, el.dataset.scope, el.dataset.key, toStored(presetColumns(el.dataset.value))); });
  };
  api.actions['bd-col'] = function (el) {
    edit(function (d) {
      var cols = levelCols(d, el.dataset.scope, el.dataset.key).slice();
      var at = cols.indexOf(el.dataset.bdcol);
      if (at >= 0) cols.splice(at, 1); else cols.push(el.dataset.bdcol);
      setLevel(d, el.dataset.scope, el.dataset.key, toStored(colsFrom(cols)));
    });
  };
  // A role follows the Plan board default, or gets custom columns (starting from the default's).
  api.actions['bd-role'] = function (el) {
    edit(function (d) { d.roles[el.dataset.key] = el.dataset.value === 'same' ? null : toStored(globalCols(d)); });
  };
  // People with their own exception first (they differ from their role), then by role (Admin, Mod, Captain) and name.
  api.actions['bd-peek'] = function () {
    var d = bdWork();
    var rank = function (u) { return (colsFrom(d.users[u.name]) ? 0 : 10) + BOARD_ROLES.indexOf(u.role); };
    var peek = function (names) {
      var y = window.scrollY;
      bdPeek = names;
      api.render();
      window.scrollTo(0, y);
    };
    api.picker({
      title: 'Who sees what', multi: true, placeholder: 'Search name or role',
      items: boardUsers().slice().sort(function (a, b) { return rank(a) - rank(b) || a.name.localeCompare(b.name); }).map(function (u) {
        var s = userSource(d, u);
        return { value: u.name, label: u.name, sub: roleName(u.role) + ' · ' + plural(s.cols.length) + ', ' + s.text };
      }),
      value: bdPeek, onPick: peek, onReset: function () { peek([]); }
    });
  };
  api.actions['bd-peek-clear'] = function () {
    var y = window.scrollY;
    bdPeek = [];
    api.render();
    window.scrollTo(0, y);
  };
  api.actions['bd-adduser'] = function () {
    var d = bdWork();
    var free = boardUsers().filter(function (u) { return !colsFrom(d.users[u.name]); });
    if (!free.length) return api.toast('Everyone on the board already has an exception');
    // Several people at once, listed by role (Admin, Mod, Captain) then name; each starts from their role's columns.
    api.picker({
      title: 'Set columns for', multi: true, placeholder: 'Search name or role',
      items: free.slice().sort(function (a, b) { return BOARD_ROLES.indexOf(a.role) - BOARD_ROLES.indexOf(b.role) || a.name.localeCompare(b.name); }).map(function (u) {
        return { value: u.name, label: u.name, sub: roleName(u.role) + ' · now ' + plural(roleCols(d, u.role).length) + ', ' + userSource(d, u).text };
      }),
      value: [], onPick: function (names) {
        if (!names.length) return;
        edit(function (w) {
          names.forEach(function (name) {
            var u = free.filter(function (x) { return x.name === name; })[0];
            w.users[name] = toStored(roleCols(w, u.role));
          });
        });
        var card = document.querySelector('[data-bd-user="' + CSS.escape(names[0]) + '"]');
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (names.length > 1) api.toast(names.length + ' exceptions added');
      }
    });
  };
  api.actions['bd-unuser'] = function (el) { edit(function (d) { delete d.users[el.dataset.key]; }); };
  api.actions['bd-discard'] = function () { bdDraft = null; api.render(); };
  api.actions['bd-save'] = function () {
    api.save('boardDefaults2', bdDraft);
    bdDraft = null;
    api.render();
    api.toast('Board defaults saved');
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
      list: D.services.filter(function (s) { return !q || api.norm(s.name + ' ' + s.code).indexOf(q) >= 0; }),
      noun: 'service type', placeholder: 'Search by name or code...',
      add: { action: 'svc-new', label: 'Add service type' },
      cols: [
        { key: 'name', label: 'Service', sort: 'text', cell: function (s) {
          return '<span class="dt-svc"><i style="background:' + s.color + ';border-color:' + s.border + '"></i><b>' + esc(s.name) + '</b></span>';
        } },
        { key: 'code', label: 'Code', sort: 'text', cell: function (s) { return '<code>' + esc(s.code) + '</code>'; } },
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
          code: code, name: v.name, short: v.short || v.name, render: v.render, at: v.at, anchor: v.anchor,
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
