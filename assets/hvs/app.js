(function () {
  'use strict';

  var D = window.HVS_DATA;
  var app = document.getElementById('app');
  var overlayRoot = document.getElementById('overlay-root');
  var USER_KEY = 'hvs_clone_user';
  var BG = '#f5f5f5';

  // ---------- helpers ----------

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function emoji(e) {
    return '<i class="emoji">' + e + '</i>';
  }

  function store(key, fallback) {
    try {
      var v = sessionStorage.getItem('hvs_' + key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function save(key, value) {
    try { sessionStorage.setItem('hvs_' + key, JSON.stringify(value)); } catch (e) { /* storage blocked */ }
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY) || 'null');
    } catch (e) {
      return null;
    }
  }

  function initials(name) {
    var parts = String(name || '?').trim().split(/\s+/);
    return (parts[0].charAt(0) + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : '')).toUpperCase();
  }

  function go(route) {
    location.hash = '#/' + route;
  }

  // The device frame (device.html) paints the status bar; tell it which colour to use.
  function statusBar(bg) {
    try { window.parent.postMessage({ type: 'hvs-statusbar', bg: bg }, '*'); } catch (e) { /* no parent */ }
  }

  var toastTimer;
  function toast(msg) {
    var t = document.querySelector('.toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1800);
  }

  // ---------- state ----------

  var user = getUser() || { name: 'User', email: '', phone: 'N/A', company: 'N/A', role: 'ADMIN' };
  var state = {
    tickets: store('tickets', D.tickets),
    users: store('users', D.users),
    vessels: store('vessels', D.vessels),
    ports: store('ports', D.ports),
    requests: store('requests', D.userRequests),
    locations: store('locations', D.locations),
    persons: store('persons', D.contactPersons),
    stickers: store('stickers', D.stickers),
    tugboats: store('tugboats', D.tugboats),
    files: store('files', D.exportFiles),
    notifs: store('notifs', D.notifications.items),
    comments: store('comments', {}),
    ticketFilter: 'All',
    ticketPage: 1,
    userTab: 'ACTIVE',
    search: '',
    formTab: 'towage',
    showAllContacts: false,
    exportCols: D.exportColumns.slice()
  };

  // ---------- icons ----------

  var I = {
    back: '<svg width="9" height="15" viewBox="0 0 9 15"><path d="M7.5 1.5 1.8 7.5l5.7 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    bell: '<svg width="23" height="23" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>',
    menu: '<svg width="22" height="16" viewBox="0 0 22 16" fill="currentColor"><rect y="0" width="22" height="2.3" rx="1"/><rect y="6.9" width="22" height="2.3" rx="1"/><rect y="13.7" width="22" height="2.3" rx="1"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>',
    filter: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"/></svg>',
    info: '<svg viewBox="64 64 896 896" fill="currentColor"><path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372z"/><path d="M464 336a48 48 0 1 0 96 0 48 48 0 1 0-96 0zm72 112h-48c-4.4 0-8 3.6-8 8v272c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8V456c0-4.4-3.6-8-8-8z"/></svg>',
    clear: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 9 7 7 7-7"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 15 7-7 7 7"/></svg>',
    right: '<svg viewBox="0 0 9 14"><path d="M1.5 1.5 7 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    pLeft: '<svg width="8" height="13" viewBox="0 0 8 13"><path d="M6.5 1.5 1.5 6.5l5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    pRight: '<svg width="8" height="13" viewBox="0 0 8 13"><path d="m1.5 1.5 5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    clip: '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 0 1 5 0v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5a2.5 2.5 0 0 0 5 0V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/></svg>',
    more: '<svg width="4" height="16" viewBox="0 0 4 16" fill="currentColor"><circle cx="2" cy="2" r="1.8"/><circle cx="2" cy="8" r="1.8"/><circle cx="2" cy="14" r="1.8"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35A7.958 7.958 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>',
    bellSm: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>',
    lockReset: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 3a9 9 0 0 0-9 9H1l4 3.99L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.9 0-3.63-.77-4.88-2.03l-1.42 1.42A8.96 8.96 0 0 0 13 21a9 9 0 0 0 0-18zm2 8v-1c0-1.1-.9-2-2-2s-2 .9-2 2v1c-.55 0-1 .45-1 1v3c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-3c0-.55-.45-1-1-1zm-1 0h-2v-1c0-.55.45-1 1-1s1 .45 1 1v1z"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm5.13 12A8.84 8.84 0 0 1 12 20.92 8.84 8.84 0 0 1 6.87 17c-.34-.5-.63-1-.87-1.53 0-1.65 2.71-3 6-3s6 1.32 6 3c-.24.53-.53 1.03-.87 1.53z"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5"/><path d="M15 8l4 4-4 4M9 12h10"/></svg>',
    eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c5 0 9 4.5 10 7-.4 1-1.3 2.4-2.6 3.8M6.6 6.6C4.4 8 2.8 10.2 2 12c1 2.5 5 7 10 7 1.9 0 3.6-.6 5.1-1.5"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    inbox: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 12h-4a3 3 0 0 1-6 0H5V5h14v10z"/></svg>',
    infoFill: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5l5 5 10-11"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>',
    xls: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.17 3.25c.46 0 .83.37.83.83v15.84c0 .46-.37.83-.83.83H7.83a.83.83 0 0 1-.83-.83V17H2.83A.83.83 0 0 1 2 16.17V7.83c0-.46.37-.83.83-.83H7V4.08c0-.46.37-.83.83-.83h13.34zM7 13.06l1.18 2.22h1.79L8 12.06l1.93-3.17H8.22l-1.09 2.01-.07.13c-.26-.53-.56-1.07-.84-1.61-.25-.53-.53-1.06-.81-1.6H4.16l1.89 3.19L4 15.28h1.78L7 13.06zm6.88 6.44V17H8.25v2.5h5.63zm0-3.75v-3.12H12v3.12h1.88zm0-4.37V8.25H12v3.13h1.88zm0-4.38V4.5H8.25V7h5.63zm6.87 12.5V17h-5.62v2.5h5.62zm0-3.75v-3.12h-5.62v3.12h5.62zm0-4.37V8.25h-5.62v3.13h5.62zm0-4.38V4.5h-5.62V7h5.62z"/></svg>',
    fileXls: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm1.8 18H14l-2-3.4-2 3.4H8.2l2.9-4.5L8.2 11H10l2 3.4 2-3.4h1.8l-2.9 4.5 2.9 4.5zM13 9V3.5L18.5 9H13z"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>',
    assign: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="6" cy="6" r="2.6"/><circle cx="18" cy="6" r="2.6"/><circle cx="6" cy="18" r="2.6"/><circle cx="18" cy="18" r="2.6"/><path d="M6 8.6v6.8M18 8.6v6.8" stroke-dasharray="2 2"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 5l14 14M19 5 5 19"/></svg>',
    plus: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M10 2.5v15M2.5 10h15"/></svg>'
  };

  // ---------- shared pieces ----------

  function header(opts) {
    opts = opts || {};
    var left = opts.logo
      ? '<img class="hdr-logo" src="assets/appicon.png" alt="HVS Group" data-go="tickets" />'
      : '<button class="hdr-back" data-action="back" aria-label="Back">' + I.back + '</button>';
    var bell = opts.noBell ? '' :
      '<button class="hdr-bell" data-go="notifications" aria-label="Notifications">' + I.bell +
      '<span class="hdr-badge">99+</span></button>';
    return '<header class="hdr">' + left + bell +
      '<button class="hdr-menu" data-action="drawer" aria-label="Menu">' + I.menu + '</button>' +
      '<h1 class="hdr-title">Order &amp; Update</h1></header>';
  }

  function search(placeholder, cls) {
    return '<label class="search' + (cls ? ' ' + cls : '') + '">' + I.search +
      '<input type="search" data-search placeholder="' + esc(placeholder) + '" value="' + esc(state.search) + '" /></label>';
  }

  function fab(route, extra, style) {
    return '<button class="fab ' + (extra || '') + '" style="' + style + '" data-action="' + route + '" aria-label="Add">' + I.plus + '</button>';
  }

  function pager(total, perPage, page) {
    var pages = Math.ceil(total / perPage);
    var nums = [1, 2, 3, 4];
    var html = '<div class="pager"><div class="pager-total">' + total + ' items total</div><div class="pager-row">' +
      '<button class="arrow' + (page === 1 ? ' off' : '') + '" data-page="' + (page - 1) + '">' + I.pLeft + '</button>';
    nums.forEach(function (n) {
      html += '<button class="' + (n === page ? 'on' : '') + '" data-page="' + n + '">' + n + '</button>';
    });
    html += '<span class="dots">...</span><button data-page="' + pages + '">' + pages + '</button>' +
      '<button class="arrow" data-page="' + (page + 1) + '">' + I.pRight + '</button></div></div>';
    return html;
  }

  function matches(text) {
    var q = state.search.trim().toLowerCase();
    return !q || String(text).toLowerCase().indexOf(q) >= 0;
  }

  // ---------- views ----------

  var views = {};

  views.tickets = function () {
    var filters = ['All', 'Pending', 'Confirmed', 'New Update', 'Done', 'Not Valid', 'Cancelled'];
    var list = state.tickets.filter(function (t) {
      return state.ticketFilter === 'All' || t.status === state.ticketFilter;
    });
    var total = state.ticketFilter === 'All' ? D.ticketTotal : list.length;
    var page = list.slice(0, 20);
    return header({ logo: true }) +
      '<div class="strip"><div class="strip-filters" data-action="filters">' + I.filter + 'Filters</div>' +
      '<div class="chips">' + filters.map(function (f) {
        return '<button class="chip' + (f === state.ticketFilter ? ' on' : '') + '" data-filter="' + f + '">' + f + '</button>';
      }).join('') + '</div></div>' +
      '<div class="tickets">' + page.map(ticketCard).join('') + '</div>' +
      fab('new-ticket', '', 'right:28px;bottom:117px') +
      pager(total, 20, state.ticketPage);
  };

  function ticketCard(t) {
    var lines = [];
    lines.push(['🚢', t.vessel]);
    lines.push(['📍', t.port]);
    if (t.berth) lines.push(['📅', 'ET Berth: ' + t.berth]);
    if (t.unberth) lines.push(['📅', 'ET Unberth: ' + t.unberth]);
    lines.push(['🕒', 'Created: ' + t.created]);
    lines.push(['👤', 'By: ' + t.by]);
    lines.push(['👨‍✈️', 'Assignee: ' + (t.assignee || 'N/A')]);
    if (t.assignedBy) lines.push(['🛡️', 'Assigned by: ' + t.assignedBy]);
    var meta = lines.map(function (l) { return '<div>' + emoji(l[0]) + esc(l[1]) + '</div>'; }).join('');
    if (t.files) meta += '<div class="gap">' + emoji('📎') + t.files + ' file' + (t.files > 1 ? 's' : '') + ' attached</div>';
    return '<div class="card ticket" data-go="tickets/' + t.id + '">' +
      '<div class="ticket-top"><span class="ticket-no">#' + t.id + '</span>' +
      '<span class="tag" style="background:' + (D.statusColors[t.status] || '#6c757d') + '">' + esc(t.status) + '</span></div>' +
      '<div class="ticket-meta">' + meta + '</div>' +
      (t.note ? '<div class="ticket-note">' + esc(t.note) + '</div>' : '') + '</div>';
  }

  views.ticket = function (id) {
    var t = id === 'new' ? null : state.tickets.filter(function (x) { return x.id === id; })[0];
    var tab = state.formTab;
    var tabs = '<div class="tabs">' +
      '<button class="tab' + (tab === 'towage' ? ' on' : '') + '" data-tab="towage">Towage</button>' +
      '<button class="tab contact' + (tab === 'contact' ? ' on' : '') + '" data-tab="contact">Contact us</button>' +
      '<button class="tab' + (tab === 'comment' ? ' on' : '') + '" data-tab="comment">Comment</button></div>';
    var body = tab === 'contact' ? contactPane() : tab === 'comment' ? commentPane(id) : towagePane(t);
    return header() + '<div class="form-card">' + tabs + body + '</div>';
  };

  function towagePane(t) {
    t = t || {};
    var editing = !!t.id;
    var customer = t.customer || (editing ? t.by : user.name);
    var files = t.attachments || [];
    return '<form class="box" data-form="ticket">' +
      (editing ? '<div class="box-title">Editing Ticket #' + t.id + '</div>' : '') +
      '<div class="fld" style="padding-top:15px;padding-bottom:11px">' +
      '<div class="fld-row first"><span class="fld-label">1. Vessel<span class="req">*</span>:</span>' +
      '<input class="fld-input" name="vessel" value="' + esc(t.vessel || '') + '" placeholder="........................" /></div>' +
      '<div class="fld-row navy"><span class="fld-label">Dwt:</span><input class="fld-input" name="dwt" value="' + esc(t.dwt || '') + '" placeholder="................................................" /></div>' +
      '<div class="fld-row navy"><span class="fld-label">Loa:</span><input class="fld-input" name="loa" value="' + esc(t.loa || '') + '" placeholder="................................................" /></div>' +
      '<span class="fld-info">' + I.info + '</span></div>' +
      '<div class="fld" style="padding-top:7px;padding-bottom:8px"><div class="fld-row"><span class="fld-label">2. Port<span class="req">*</span>:</span>' +
      '<input class="fld-input" name="port" value="' + esc(t.port || '') + '" placeholder="............................................................" /></div>' +
      '<span class="fld-info">' + I.info + '</span></div>' +
      '<div class="fld" style="padding-top:9px;padding-bottom:10px"><div class="fld-row"><span class="fld-label">3. POB in</span></div>' +
      pob('pobIn', t.pobIn) +
      '<div class="fld-row fld-sub"><span class="fld-label">POB out</span></div>' +
      pob('pobOut', t.pobOut) +
      '<span class="fld-info">' + I.info + '</span></div>' +
      '<div class="fld fld-note"><div class="fld-row"><span class="fld-label" style="margin-top:2px">4. Note:</span>' +
      '<textarea name="note" placeholder="..............................">' + esc(t.note || '') + '</textarea></div></div>' +
      '<div class="fld fld-cust"><div class="fld-row"><span class="chev" data-action="cc">' + I.down + '</span>' +
      '<span class="fld-label">5. Customer/Agent:</span><input class="fld-input" name="customer" value="' + esc(customer) + '" /></div></div>' +
      '<div class="fld" style="padding-top:10px;padding-bottom:10px"><div class="fld-row"><span class="fld-label">6. Attachments:</span></div>' +
      '<div class="attach">' + files.map(function (f) {
        return '<div class="attach-file"><span class="attach-clip">' + I.clip + '</span><span class="attach-name"><b>' + esc(f.name) + '</b><span>' +
          esc(f.size) + ' · By ' + esc(f.by) + '</span></span><span class="attach-more">' + I.more + '</span></div>';
      }).join('') + (files.length ? '<div class="attach-line"></div>' : '') +
      '<button type="button" class="attach-btn" data-action="attach">' + I.clip + 'Attach files</button>' +
      '<input type="file" multiple hidden accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" /></div></div>' +
      '<button class="submit" type="submit">' + (editing ? 'Update Order' : 'Send New Order') + '</button>' +
      '</form>';
  }

  function pob(name, value) {
    return '<div class="pob"><input name="' + name + '" value="' + esc(value || '') + '" placeholder="hh:mm - dd/MM/yyyy" />' +
      (value ? '<span class="clear" data-action="clear-pob">' + I.clear + '</span>' : '') +
      '<span class="cal">' + I.cal + '</span></div>';
  }

  function contactPane() {
    var c = D.contacts;
    var people = state.showAllContacts ? c.list : c.list.slice(0, c.visible);
    var hidden = c.list.length - c.visible;
    function pair(label) {
      return '<div class="c-row"><div class="c-item"><img src="assets/zalo.png" alt="Zalo" /><span>' + esc(label.zalo) + '</span></div>' +
        '<div class="c-item"><img src="assets/whatsapp.png" alt="WhatsApp" /><span>' + esc(label.whatsapp) + '</span></div></div>';
    }
    return '<div class="contact-pane">' +
      '<div class="c-block"><span class="c-pill hot">' + esc(c.hotline.label) + '</span>' + pair(c.hotline) + '</div>' +
      '<div class="c-block"><span class="c-pill">' + esc(c.tugDuty.label) + '</span>' + pair(c.tugDuty) + '</div>' +
      '<div class="c-block list"><span class="c-pill blue">Contact List</span>' +
      people.map(function (p) {
        return '<div class="c-name">' + esc(p.name) + '</div><div class="c-icons">' +
          '<img src="assets/phone.png" alt="Phone" /><img src="assets/zalo.png" alt="Zalo" /><img src="assets/whatsapp.png" alt="WhatsApp" /></div>';
      }).join('') +
      '<button class="c-more" data-action="more-contacts">' + (state.showAllContacts ? 'Show less' : 'Show more (' + hidden + ')') + '</button></div></div>';
  }

  function commentPane(id) {
    var list = state.comments[id] || [];
    return '<div class="comment-pane"><div class="comment-head"><h4>Comments</h4><button data-action="refresh-comments" aria-label="Refresh">' + I.refresh + '</button></div>' +
      (list.length ? '<div class="comment-list">' + list.map(function (c) {
        return '<div class="comment-item"><b>' + esc(c.by) + '</b> <span>' + esc(c.at) + '</span><p>' + esc(c.text) + '</p></div>';
      }).join('') + '</div>' : '<div class="comment-empty">No comments yet</div>') +
      '<input class="comment-input" data-comment placeholder="Write a comment..." />' +
      '<button class="comment-btn" data-action="comment">Comment</button></div>';
  }

  views.profile = function () {
    return header() +
      '<div class="card profile-card"><div class="profile-top"><div class="avatar">' + esc(initials(user.name).charAt(0)) + '</div>' +
      '<div class="profile-id"><h2>' + esc(user.name) + '</h2><p>' + esc(user.email) + '</p><span class="role-badge">' + esc(user.role || 'ADMIN') + '</span></div></div>' +
      '<div class="kv"><span>Phone</span><b>' + esc(user.phone || 'N/A') + '</b></div>' +
      '<div class="kv"><span>Company</span><b>' + esc(user.company || 'N/A') + '</b></div></div>' +
      '<div class="card nav-card"><h3>Navigation</h3>' +
      '<button class="nav-btn" data-go="notifications">' + I.bellSm + 'Notifications</button>' +
      '<button class="nav-btn" data-action="change-password">' + I.lockReset + 'Change Password</button>' +
      '<button class="nav-btn" data-go="admin">' + I.shield + 'Admin Panel</button></div>' +
      '<button class="logout-btn" data-action="logout">' + I.logout + 'Logout</button>';
  };

  views.notifications = function () {
    var unread = D.notifications.unread - state.notifs.filter(function (n) { return n.read; }).length;
    return header({ noBell: true }) +
      '<div class="notif-strip"><span>' + unread + ' unread notifications</span><button data-action="read-all">Mark all as read</button></div>' +
      '<div class="page" style="padding-top:15px;padding-bottom:130px">' + state.notifs.map(function (n, i) {
        return '<div class="notif' + (n.read ? ' read' : '') + '" data-notif="' + i + '">' + emoji(n.icon) +
          '<div class="notif-body"><h4>' + esc(n.title) + '</h4>' + n.lines.map(function (l) { return '<div>' + esc(l) + '</div>'; }).join('') +
          '<div class="notif-foot"><span>' + esc(n.time) + '</span><button data-del-notif="' + i + '">Delete</button></div></div></div>';
      }).join('') + '</div>' + pager(D.notifications.total, 20, 1);
  };

  views.admin = function () {
    return header({ logo: true }) + '<div class="page"><div class="admin-head"><h2 class="section-title">Administration</h2>' +
      '<p class="section-sub">Manage system data and settings</p></div>' +
      D.admin.map(function (a) {
        return '<div class="admin-item" style="--accent:' + a.color + '" data-go="' + a.route + '">' +
          '<span class="admin-tile" style="background:' + a.tile + '">' + emoji(a.icon) + '</span>' +
          '<div class="admin-text"><h4 style="color:' + a.color + '">' + esc(a.title) + '</h4><p>' + esc(a.sub) + '</p></div>' + I.right + '</div>';
      }).join('') + '</div>';
  };

  views['admin/users'] = function () {
    var list = state.users.filter(function (u) {
      return (state.userTab === 'ALL' || u.status === state.userTab) && matches(u.name + ' ' + u.email);
    });
    return header() + '<div class="page">' + search('Search by name or email', 'sm') +
      '<div class="seg">' + ['ACTIVE', 'BANNED', 'ALL'].map(function (s) {
        return '<button class="' + (s === state.userTab ? 'on' : '') + '" data-usertab="' + s + '">' + s + '</button>';
      }).join('') + '</div><div class="list">' +
      list.map(function (u) {
        var i = state.users.indexOf(u);
        return '<div class="card user-card"><div class="user-name">' + esc(u.name) +
          '<span class="role" style="background:' + (D.roleColors[u.role] || '#4caf50') + '">' + u.role + '</span></div>' +
          '<div class="user-lines"><div>' + emoji('📧') + esc(u.email) + '</div><div>' + emoji('📞') + esc(u.phone) + '</div><div>' + emoji('🏢') + esc(u.company) + '</div></div>' +
          '<div class="two-btns"><button class="pill-btn edit" data-edit-user="' + i + '">Edit</button><button class="pill-btn del" data-del="users:' + i + '">Delete</button></div></div>';
      }).join('') + '</div></div>' + fab('new-user', '', 'right:28px;bottom:61px');
  };

  views['admin/users/new'] = function (editIndex) {
    var u = editIndex != null ? state.users[editIndex] : {};
    var role = u.role || 'CLIENT';
    return '<div class="sheet-page"><div class="sheet-bar"><h2>' + (editIndex != null ? 'Edit User' : 'Create User') + '</h2><button data-action="back">Cancel</button></div>' +
      '<form class="sheet-body tight" data-form="user"' + (editIndex != null ? ' data-index="' + editIndex + '"' : '') + '>' +
      '<label class="field-label">Name *</label><input class="text-input" name="name" required value="' + esc(u.name || '') + '" />' +
      '<label class="field-label">Email *</label><input class="text-input" name="email" type="email" required value="' + esc(u.email || '') + '" />' +
      '<label class="field-label">Password *</label><div class="pw-wrap"><input class="text-input" name="password" type="password" ' + (editIndex != null ? '' : 'required') + ' />' +
      '<button type="button" data-action="toggle-pw" aria-label="Show password">' + I.eyeOff + '</button></div>' +
      '<label class="field-label" style="margin-top:3px">Phone *</label><input class="text-input" name="phone" required value="' + esc(u.phone && u.phone !== 'N/A' ? u.phone : '') + '" />' +
      '<label class="field-label">Company *</label><input class="text-input" name="company" required value="' + esc(u.company && u.company !== 'N/A' ? u.company : '') + '" />' +
      '<label class="field-label" style="margin-top:14px">Role *</label><input type="hidden" name="role" value="' + role + '" />' +
      '<div class="role-seg">' + ['CLIENT', 'STAFF', 'ADMIN'].map(function (r) {
        return '<button type="button" class="' + (r === role ? 'on' : '') + '" data-role="' + r + '">' + r + '</button>';
      }).join('') + '</div>' +
      '<button class="sheet-submit" type="submit">' + (editIndex != null ? 'Save Changes' : 'Create User') + '</button></form></div>';
  };

  views['admin/vessels'] = function () {
    var list = state.vessels.filter(function (v) { return matches(v.name); });
    return header() + '<div class="page">' + search('Search vessels by name...') + '<div class="list">' +
      list.map(function (v) {
        var i = state.vessels.indexOf(v);
        return '<div class="card vessel-card"><h4>' + emoji('🚢') + esc(v.name) + '</h4><div class="vessel-stats">' +
          '<div><span>GRT:</span><b>' + esc(v.grt) + '</b></div><div><span>DWT:</span><b>' + esc(v.dwt) + '</b></div><div><span>LOA:</span><b>' + esc(v.loa) + '</b></div></div>' +
          '<button class="pill-btn block" data-del="vessels:' + i + '">Delete</button></div>';
      }).join('') + '</div></div>' + fab('new-vessel', '', 'right:15px;bottom:47px');
  };

  views['admin/vessels/new'] = function () {
    return '<div class="sheet-page"><div class="sheet-bar"><h2>Create Vessel</h2><button data-action="back">Cancel</button></div>' +
      '<form class="sheet-body" data-form="vessel">' +
      '<label class="field-label">Vessel Name<span class="req">*</span></label><input class="text-input" name="name" required />' +
      '<label class="field-label">GRT (Gross Register Tonnage)<span class="req">*</span></label><input class="text-input" name="grt" required placeholder="e.g., 5000" inputmode="decimal" />' +
      '<label class="field-label">DWT (Deadweight Tonnage)<span class="req">*</span></label><input class="text-input" name="dwt" required placeholder="e.g., 7500" inputmode="decimal" />' +
      '<label class="field-label">LOA (Length Overall)<span class="req">*</span></label><input class="text-input" name="loa" required placeholder="e.g., 120 meters" inputmode="decimal" />' +
      '<button class="sheet-submit" type="submit" style="margin-top:38px">Create Vessel</button></form></div>';
  };

  views['admin/ports'] = function () {
    var list = state.ports.filter(function (p) { return matches(p.name + ' ' + (p.berth || '') + ' ' + (p.location || '')); });
    return header() + '<div class="page">' + search('Search by port or berth name...') + '<div class="list">' +
      list.map(function (p) {
        var i = state.ports.indexOf(p);
        var sub = p.location
          ? '<div class="sub loc">' + emoji('📍') + esc(p.location) + '</div>'
          : '<div class="sub">' + esc(p.berth || '') + '</div>';
        return '<div class="card row-card port-card"><span class="lead emoji">⚓</span><div class="main"><h4>' + esc(p.name) + '</h4>' + sub +
          '<div class="actions"><button class="pill-btn danger" data-del="ports:' + i + '">Delete</button></div></div></div>';
      }).join('') + '</div></div>' + fab('new-port', '', 'right:15px;bottom:47px');
  };

  views['admin/user-requests'] = function () {
    var list = state.requests.filter(function (r) { return matches(r.name + ' ' + r.email); });
    return header() + '<div class="info-banner">' + I.infoFill + '<p>Upon approval, credentials will be sent to the user\'s email automatically.</p></div>' +
      '<div class="page">' + search('Search by email or name...') +
      (list.length ? '<div class="list">' + list.map(function (r) {
        var i = state.requests.indexOf(r);
        return '<div class="card req-card"><div class="req-top"><h4>' + esc(r.name).replace(/ (\d+)$/, '<br />$1') + '</h4><span class="tag">PENDING</span></div>' +
          '<div class="req-lines"><div>' + emoji('📧') + esc(r.email) + '</div><div>' + emoji('📱') + esc(r.phone) + '</div><div>' + emoji('🏢') + esc(r.company) + '</div></div>' +
          '<div class="req-date">Requested: ' + esc(r.requested) + '</div>' +
          '<div class="actions"><button class="pill-btn success" data-request="approve:' + i + '">Approve</button>' +
          '<button class="pill-btn danger" data-request="reject:' + i + '">Reject</button></div></div>';
      }).join('') + '</div>'
        : '<div class="empty">' + I.inbox + '<h4>No user requests found</h4><p>No pending access requests</p></div>') + '</div>';
  };

  function orderedList(key, lead, placeholder, fabAction) {
    var list = state[key].filter(function (x) { return matches(x.name); });
    return header() + '<div class="page">' + search(placeholder) + '<div class="list">' +
      list.map(function (x) {
        var i = state[key].indexOf(x);
        return '<div class="card row-card"><span class="lead emoji">' + lead + '</span><div class="main"><h4>' + esc(x.name) + '</h4>' +
          '<div class="sub">Order: ' + x.order + '</div><div class="actions">' +
          '<button class="pill-btn outline" data-edit="' + key + ':' + i + '">Edit</button>' +
          '<button class="pill-btn danger" data-del="' + key + ':' + i + '">Delete</button></div></div></div>';
      }).join('') + '</div></div>' + fab(fabAction, '', 'right:15px;bottom:47px');
  }

  views['admin/locations'] = function () {
    return orderedList('locations', '📍', 'Search by location name...', 'new-location');
  };

  views['admin/contact-persons'] = function () {
    return orderedList('persons', '👤', 'Search by name...', 'new-person');
  };

  views['admin/stickers'] = function () {
    var list = state.stickers.filter(function (x) { return matches(x.name); });
    return header() + '<div class="page">' + search('Search by name...') + '<div class="list">' +
      list.map(function (x) {
        var i = state.stickers.indexOf(x);
        return '<div class="card row-card sticker-card"><span class="lead">' + (x.img ? '<img src="' + x.img + '" alt="" />' : '') + '</span>' +
          '<div class="main"><h4>' + esc(x.name) + '</h4><div class="sub">Order: ' + x.order + '</div><div class="actions">' +
          '<button class="pill-btn outline" data-edit="stickers:' + i + '">Edit</button>' +
          '<button class="pill-btn danger" data-del="stickers:' + i + '">Delete</button></div></div></div>';
      }).join('') + '</div></div>' + fab('new-sticker', '', 'right:15px;bottom:47px');
  };

  views['admin/tugboats'] = function () {
    var list = state.tugboats.filter(function (x) { return matches(x.name); });
    return header() + '<div class="page">' + search('Search tugboats by name...') +
      '<div class="tug-links"><button data-action="assign-locations">' + I.assign + 'Assign locations</button>' +
      '<button data-go="admin/locations">' + I.pin + 'Manage locations</button></div>' +
      list.map(function (x) {
        var i = state.tugboats.indexOf(x);
        var specs = [['Length', x.length ? Number(x.length) + ' m' : ''], ['Breadth', x.breadth ? Number(x.breadth) + ' m' : ''], ['Draft', x.draft ? Number(x.draft) + ' m' : '']];
        var row2 = [];
        if (x.bollard) row2.push(['Bollard Pull', Number(x.bollard) + ' T']);
        if (x.gt) row2.push(['GRT', Number(x.gt) + ' GT']);
        if (x.propeller) row2.push(['Propeller', x.propeller]);
        var grid = specs.concat(row2).map(function (s) { return '<div><span>' + s[0] + '</span><b>' + esc(s[1]) + '</b></div>'; }).join('');
        if (x.order != null && x.bollard) grid += '<div><span>Order</span><b>' + x.order + '</b></div>';
        return '<div class="card tug-card">' + (x.img ? '<img class="tug-img" src="' + x.img + '" alt="" />' : '<div class="tug-ph">' + emoji('⚓') + '</div>') +
          '<div class="tug-body"><div class="tug-top"><div><h4>' + esc(x.name) + '</h4><p>' + esc(x.hp) + '</p></div>' +
          '<div class="btns"><button class="ring edit" data-edit-tug="' + i + '">Edit</button><button class="ring del" data-del="tugboats:' + i + '">Delete</button></div></div>' +
          '<div class="tug-specs">' + grid + '</div></div></div>';
      }).join('') + '</div>' + fab('new-tugboat', 'blue', 'right:19px;bottom:23px');
  };

  views['admin/export-tickets'] = function () {
    return header() + '<div class="page"><div><h2 class="section-title">Export Tickets</h2>' +
      '<p class="section-sub">Generate ticket reports by date range</p></div>' +
      '<div class="card export-card"><label>Start date</label><div class="date-input"><span>30/08/2026</span>' + I.cal + '</div>' +
      '<label>End date</label><div class="date-input"><span>29/09/2026</span>' + I.cal + '</div>' +
      '<label>Service type</label><div class="date-input disabled"><span>Towage</span></div>' +
      '<label style="margin-top:13px">Columns</label><div class="col-chips">' + D.exportColumns.map(function (c) {
        var on = state.exportCols.indexOf(c) >= 0;
        return '<button class="col-chip' + (on ? '' : ' off') + '" data-col="' + esc(c) + '">' + I.check + esc(c) + '</button>';
      }).join('') + '</div>' +
      '<button class="gen-btn" data-action="generate">' + I.fileXls + 'Generate Excel</button></div>' +
      '<h3 class="files-title">Generated files (' + state.files.length + ')</h3><div class="list">' +
      state.files.map(function (f, i) {
        return '<div class="card file-card"><span class="xls">' + I.xls + '</span><div class="main"><h4>' + esc(f.name) + '</h4>' +
          '<p>' + esc(f.size) + ' · ' + esc(f.by) + ' · ' + esc(f.at) + '</p><div class="actions">' +
          '<button class="pill-btn outline" data-action="download">' + I.download + 'Download</button>' +
          '<button class="pill-btn danger" data-del="files:' + i + '">' + I.trash + 'Delete</button></div></div></div>';
      }).join('') + '</div></div>';
  };

  views['admin/contact-stats'] = function () {
    var s = D.stats;
    var max = 0;
    s.days.forEach(function (d) { max = Math.max(max, d[1] + d[2] + d[3]); });
    var unit = 144 / max;
    var bars = s.days.map(function (d) {
      var h = function (n, c) { return n ? '<i style="height:' + (n * unit) + 'px;background:' + c + '"></i>' : ''; };
      return '<div class="chart-col"><div class="chart-bar">' + h(d[3], '#16a34a') + h(d[2], '#1e90ff') + h(d[1], '#dc143c') + '</div></div>';
    }).join('');
    return header() + '<div class="page"><div><h2 class="section-title">Contact Statistics</h2>' +
      '<p class="section-sub" style="margin-top:8px;font-size:12.5px">' + esc(s.note) + '</p></div>' +
      '<div class="stats-grid" style="margin-top:10px"><div class="stat-box"><span>From</span><b>' + s.from + '</b></div><div class="stat-box"><span>To</span><b>' + s.to + '</b></div></div>' +
      '<div class="stats-grid"><div class="kpi"><span>Total clicks</span><b>' + s.total + '</b><small>MOBILE: ' + s.mobile + ' · WEB: ' + s.web + '</small></div>' +
      '<div class="kpi"><span style="color:#dc143c">Phone</span><b>' + s.phone + '</b></div>' +
      '<div class="kpi short"><span style="color:#1e90ff">Zalo</span><b>' + s.zalo + '</b></div>' +
      '<div class="kpi short"><span style="color:#16a34a">WhatsApp</span><b>' + s.whatsapp + '</b></div></div>' +
      '<div class="card chart-card"><h4>Clicks per day</h4><div class="chart">' + bars + '</div>' +
      '<div class="chart-labels">' + s.days.map(function (d) { return '<span>' + d[0] + '</span>'; }).join('') + '</div>' +
      '<div class="legend"><span><i style="background:#dc143c"></i>Phone</span><span><i style="background:#1e90ff"></i>Zalo</span><span><i style="background:#16a34a"></i>WhatsApp</span></div></div>' +
      '<button class="csv-btn" data-action="csv">Export CSV</button></div>';
  };

  // ---------- overlays ----------

  var overlay = null;

  function openOverlay(html, kind, statusColor) {
    closeOverlay(true);
    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    overlayRoot.appendChild(wrap);
    overlay = { el: wrap, kind: kind };
    document.body.classList.add('no-scroll');
    statusBar(statusColor);
    // Animation frames can be paused in a background iframe, so a timer backs them up.
    var shown = false;
    function show() {
      if (shown) return;
      shown = true;
      wrap.getBoundingClientRect();
      wrap.querySelectorAll('.mask,.drawer,.dialog,.bsheet,.ios-sheet').forEach(function (el) { el.classList.add('show'); });
    }
    requestAnimationFrame(function () { requestAnimationFrame(show); });
    setTimeout(show, 40);
    return wrap;
  }

  function closeOverlay(immediate) {
    if (!overlay) return;
    var o = overlay;
    overlay = null;
    document.body.classList.remove('no-scroll');
    statusBar(BG);
    if (immediate) { o.el.remove(); return; }
    o.el.querySelectorAll('.show').forEach(function (el) { el.classList.remove('show'); });
    setTimeout(function () { o.el.remove(); }, 320);
  }

  function openDrawer() {
    var route = currentRoute();
    var items = [['🎫', 'All Tickets', 'tickets'], ['👤', 'Profile', 'profile'], ['🔔', 'Notifications', 'notifications'], ['⚙️', 'Admin Panel', 'admin']];
    openOverlay('<div class="mask" data-action="close"></div><aside class="drawer">' +
      '<div class="drawer-head"><div class="avatar">' + esc(initials(user.name)) + '</div><h3>' + esc(user.name) + '</h3><p>' + esc(user.email) + '</p>' +
      '<span class="role-badge">' + esc(user.role || 'ADMIN') + '</span></div><div class="drawer-sep"></div>' +
      items.map(function (it) {
        var on = route === it[2] || (it[2] === 'tickets' && /^tickets/.test(route)) || (it[2] === 'admin' && /^admin/.test(route));
        return '<div class="drawer-item' + (on ? ' on' : '') + '" data-go="' + it[2] + '">' + emoji(it[0]) + it[1] + '</div>';
      }).join('') + '<div class="drawer-sep"></div>' +
      '<div class="drawer-foot"><div class="drawer-item" data-action="logout">' + emoji('🚪') + 'Logout</div></div></aside>', 'drawer', '#7a7a7a');
  }

  function formDialog(title, fields, submitLabel, onSubmit, extraTop) {
    var html = '<div class="mask light" data-action="close"></div><form class="dialog" data-dialog>' +
      '<h3>' + esc(title) + '</h3>' + (extraTop || '') +
      fields.map(function (f) {
        return '<label class="field-label">' + esc(f.label) + (f.required ? '<span class="req">*</span>' : '') + '</label>' +
          '<input class="text-input" name="' + f.name + '" value="' + esc(f.value == null ? '' : f.value) + '"' + (f.required ? ' required' : '') + (f.type ? ' inputmode="' + f.type + '"' : '') + ' />';
      }).join('') +
      '<div class="actions"><button type="button" class="pill-btn outline dark" data-action="close">Cancel</button>' +
      '<button type="submit" class="pill-btn primary">' + esc(submitLabel) + '</button></div></form>';
    var wrap = openOverlay(html, 'dialog', '#a8a8a8');
    var dlg = wrap.querySelector('.dialog');
    dlg.style.top = Math.max(60, (window.innerHeight - dlg.offsetHeight) / 2 - 20) + 'px';
    dlg.addEventListener('submit', function (e) {
      e.preventDefault();
      onSubmit(Object.fromEntries(new FormData(dlg)));
      closeOverlay();
      render();
    });
  }

  // The live app reuses its location dialog for contact persons, title included.
  function editOrdered(key, index) {
    var x = index == null ? { name: '', order: state[key].length + 1 } : state[key][index];
    var isNew = index == null;
    formDialog(isNew ? 'Add New Location' : 'Edit Location', [
      { label: 'Location Name', name: 'name', value: x.name, required: true },
      { label: 'Order', name: 'order', value: x.order, type: 'numeric' }
    ], isNew ? 'Create' : 'Save', function (v) {
      var item = { name: v.name, order: Number(v.order) || 0 };
      if (isNew) state[key].push(item); else Object.assign(state[key][index], item);
      state[key].sort(function (a, b) { return a.order - b.order; });
      save(key, state[key]);
    });
  }

  function editSticker(index) {
    var isNew = index == null;
    var x = isNew ? { name: '', order: state.stickers.length + 1, img: '' } : state.stickers[index];
    var thumb = '<div class="sticker-edit"><span class="thumb">' + (x.img ? '<img src="' + x.img + '" alt="" />' : '') + '</span>' +
      '<div class="main"><button type="button" class="pill-btn" data-action="sticker-image">' + (isNew ? 'Choose image' : 'Replace image') + '</button>' +
      '<p>' + (isNew ? 'PNG or JPG, transparent background works best' : 'Leave empty to keep the current image') + '</p></div></div>';
    formDialog(isNew ? 'Add New Sticker' : 'Edit Sticker', [{ label: 'Sticker Name', name: 'name', value: x.name, required: true }], isNew ? 'Create' : 'Save', function (v) {
      var item = { name: v.name, order: Number(v.order) || 0 };
      if (isNew) state.stickers.push(Object.assign({ img: '' }, item)); else Object.assign(state.stickers[index], item);
      state.stickers.sort(function (a, b) { return a.order - b.order; });
      save('stickers', state.stickers);
    });
    // Sticker dialog order: name, image, order.
    var dlg = overlayRoot.querySelector('.dialog');
    dlg.querySelector('.actions').insertAdjacentHTML('beforebegin',
      '<label class="field-label" style="margin-top:11px">Order</label><input class="text-input" name="order" inputmode="numeric" value="' + esc(x.order) + '" />');
    dlg.querySelector('.text-input').insertAdjacentHTML('afterend', thumb);
    dlg.style.top = Math.max(60, (window.innerHeight - dlg.offsetHeight) / 2 - 20) + 'px';
  }

  function addPort() {
    formDialog('Add New Port', [
      { label: 'Port Name', name: 'name', required: true },
      { label: 'Berth Name (Optional)', name: 'berth' },
      { label: 'Location (Optional)', name: 'location' }
    ], 'Create', function (v) {
      state.ports.push({ name: v.name, berth: v.berth, location: v.location });
      save('ports', state.ports);
    });
  }

  function editTugboat(index) {
    var isNew = index == null;
    var x = isNew ? { name: '', code: '', location: state.locations[0] ? state.locations[0].name : '', size: 'H', hp: '', length: '', breadth: '', draft: '', bollard: '', gt: '', propeller: '', order: state.tugboats.length + 1, img: '' } : state.tugboats[index];
    function fld(label, name, value) {
      return '<label class="field-label">' + label + '</label><input class="text-input" name="' + name + '" value="' + esc(value) + '" />';
    }
    var html = '<div class="ios-sheet"><div class="ios-sheet-inner"><div class="sheet-bar"><h2>' + (isNew ? 'Create Tugboat' : 'Edit Tugboat') + '</h2>' +
      '<button data-action="close">Cancel</button></div><form class="sheet-body" data-tug-form>' +
      fld('Name *', 'name', x.name) + fld('Code', 'code', x.code) +
      '<label class="small-label">Location</label><div class="select-box">' + esc(x.location) + '</div>' +
      '<span class="muted-label">Size class</span><input type="hidden" name="size" value="' + x.size + '" /><div class="size-seg">' +
      ['H', 'V', 'S', 'T'].map(function (s) { return '<button type="button" class="' + (s === x.size ? 'on' : '') + '" data-size="' + s + '">' + s + '</button>'; }).join('') + '</div>' +
      fld('Main Engines', 'hp', x.hp) + fld('Length (m)', 'length', x.length) + fld('Breadth (m)', 'breadth', x.breadth) + fld('Draft (m)', 'draft', x.draft) +
      fld('Bollard Pull (T)', 'bollard', x.bollard) + fld('Gross Tonnage (GT)', 'gt', x.gt) + fld('Propeller Type', 'propeller', x.propeller) +
      fld('Order (lower shows first)', 'order', x.order) +
      (x.img ? '<img class="sheet-img" src="' + x.img + '" alt="" />' : '') +
      '<button type="button" class="outline-block" data-action="tug-image">' + (x.img ? 'Replace Image' : 'Choose Image') + '</button>' +
      '<p class="gallery-note">Gallery (0) · multiple images, not cropped</p>' +
      '<button type="button" class="outline-block" style="margin-top:0" data-action="tug-gallery">Add Images</button>' +
      '<button type="submit" class="sheet-submit" style="margin-top:12px">' + (isNew ? 'Create Tugboat' : 'Save Changes') + '</button></form></div></div>';
    var wrap = openOverlay(html, 'sheet', '#000000');
    var form = wrap.querySelector('[data-tug-form]');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = Object.fromEntries(new FormData(form));
      v.order = Number(v.order) || 0;
      if (isNew) state.tugboats.push(Object.assign({ location: x.location, img: '' }, v)); else Object.assign(state.tugboats[index], v);
      state.tugboats.sort(function (a, b) { return a.order - b.order; });
      save('tugboats', state.tugboats);
      closeOverlay();
      render();
      toast(isNew ? 'Tugboat created' : 'Changes saved');
    });
  }

  function openFilters() {
    var html = '<div class="mask light" data-action="close"></div><div class="bsheet"><div class="bsheet-head"><h3>Filters</h3>' +
      '<button data-action="close" aria-label="Close">' + I.close + '</button></div>' +
      '<label class="field-label">User</label><input class="text-input" placeholder="Filter by user" />' +
      '<label class="field-label">Vessel</label><input class="text-input" placeholder="Filter by vessel name" />' +
      '<label class="field-label">Port</label><input class="text-input" placeholder="Filter by port name" />' +
      '<label class="field-label">Created date</label><input class="text-input soft" placeholder="Filter by date created" />' +
      '<label class="check"><input type="checkbox" />Has files</label>' +
      '<div class="bsheet-btns"><button class="clear" data-action="clear-filters">Clear all</button><button class="done" data-action="close">Done</button></div></div>';
    openOverlay(html, 'sheet', '#a8a8a8');
  }

  // ---------- routing ----------

  var history = [];

  function currentRoute() {
    return (location.hash.replace(/^#\/?/, '') || 'tickets').replace(/\/$/, '');
  }

  function render() {
    var route = currentRoute();
    var view;
    var m;
    if ((m = route.match(/^tickets\/(.+)$/))) view = views.ticket(m[1]);
    else if ((m = route.match(/^admin\/users\/edit\/(\d+)$/))) view = views['admin/users/new'](Number(m[1]));
    else if (views[route]) view = views[route]();
    else { go('tickets'); return; }
    app.innerHTML = view;
    statusBar(BG);
    var q = app.querySelector('[data-search]');
    if (q && document.activeElement !== q && state._focusSearch) {
      q.focus();
      q.setSelectionRange(q.value.length, q.value.length);
      state._focusSearch = false;
    }
  }

  window.addEventListener('hashchange', function () {
    var route = currentRoute();
    if (history[history.length - 1] !== route) history.push(route);
    closeOverlay(true);
    state.search = '';
    if (!/^tickets\//.test(route)) state.formTab = 'towage';
    window.scrollTo(0, 0);
    render();
  });

  // ---------- events ----------

  function deleteItem(spec) {
    var parts = spec.split(':');
    state[parts[0]].splice(Number(parts[1]), 1);
    save(parts[0], state[parts[0]]);
    render();
    toast('Deleted');
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    var el;

    if ((el = t.closest('[data-del-notif]'))) {
      e.stopPropagation();
      state.notifs.splice(Number(el.dataset.delNotif), 1);
      save('notifs', state.notifs);
      return render();
    }
    if ((el = t.closest('[data-go]'))) {
      closeOverlay(true);
      return go(el.dataset.go);
    }
    if ((el = t.closest('[data-filter]'))) {
      state.ticketFilter = el.dataset.filter;
      state.ticketPage = 1;
      var x = app.querySelector('.chips').scrollLeft;
      render();
      app.querySelector('.chips').scrollLeft = x;
      return;
    }
    if ((el = t.closest('[data-page]'))) {
      var p = Number(el.dataset.page);
      if (p >= 1 && p <= 4) { state.ticketPage = p; render(); }
      return;
    }
    if ((el = t.closest('[data-tab]'))) {
      state.formTab = el.dataset.tab;
      return render();
    }
    if ((el = t.closest('[data-usertab]'))) {
      state.userTab = el.dataset.usertab;
      return render();
    }
    if ((el = t.closest('[data-role]'))) {
      var seg = el.parentElement;
      seg.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b === el); });
      seg.parentElement.querySelector('[name=role]').value = el.dataset.role;
      return;
    }
    if ((el = t.closest('[data-size]'))) {
      el.parentElement.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b === el); });
      el.closest('form').querySelector('[name=size]').value = el.dataset.size;
      return;
    }
    if ((el = t.closest('[data-col]'))) {
      var c = el.dataset.col;
      var at = state.exportCols.indexOf(c);
      if (at >= 0) state.exportCols.splice(at, 1); else state.exportCols.push(c);
      el.classList.toggle('off', at >= 0);
      return;
    }
    if ((el = t.closest('[data-del]'))) return deleteItem(el.dataset.del);
    if ((el = t.closest('[data-edit]'))) {
      var sp = el.dataset.edit.split(':');
      return sp[0] === 'stickers' ? editSticker(Number(sp[1])) : editOrdered(sp[0], Number(sp[1]));
    }
    if ((el = t.closest('[data-edit-user]'))) return go('admin/users/edit/' + el.dataset.editUser);
    if ((el = t.closest('[data-edit-tug]'))) return editTugboat(Number(el.dataset.editTug));
    if ((el = t.closest('[data-request]'))) {
      var rp = el.dataset.request.split(':');
      var r = state.requests.splice(Number(rp[1]), 1)[0];
      if (rp[0] === 'approve') {
        state.users.unshift({ name: r.name, role: 'CLIENT', email: r.email, phone: r.phone, company: r.company, status: 'ACTIVE' });
        save('users', state.users);
      }
      save('requests', state.requests);
      render();
      return toast(rp[0] === 'approve' ? 'Request approved' : 'Request rejected');
    }
    if ((el = t.closest('[data-notif]'))) {
      state.notifs[Number(el.dataset.notif)].read = true;
      save('notifs', state.notifs);
      return render();
    }

    if (!(el = t.closest('[data-action]'))) return;
    switch (el.dataset.action) {
      case 'back':
        history.pop();
        if (history.length) { location.hash = '#/' + history.pop(); } else { go('tickets'); }
        break;
      case 'drawer': openDrawer(); break;
      case 'close': closeOverlay(); break;
      case 'logout':
        try { localStorage.removeItem(USER_KEY); sessionStorage.removeItem(USER_KEY); } catch (err) { /* storage blocked */ }
        location.href = 'index.html';
        break;
      case 'filters': openFilters(); break;
      case 'clear-filters':
        overlayRoot.querySelectorAll('.bsheet input').forEach(function (i) { if (i.type === 'checkbox') i.checked = false; else i.value = ''; });
        break;
      case 'new-ticket': state.formTab = 'towage'; go('tickets/new'); break;
      case 'new-user': go('admin/users/new'); break;
      case 'new-vessel': go('admin/vessels/new'); break;
      case 'new-port': addPort(); break;
      case 'new-location': editOrdered('locations'); break;
      case 'new-person': editOrdered('persons'); break;
      case 'new-sticker': editSticker(); break;
      case 'new-tugboat': editTugboat(); break;
      case 'more-contacts': state.showAllContacts = !state.showAllContacts; render(); break;
      case 'cc': toggleCc(el); break;
      case 'clear-pob':
        el.parentElement.querySelector('input').value = '';
        el.remove();
        break;
      case 'attach': el.parentElement.querySelector('input[type=file]').click(); break;
      case 'comment': addComment(); break;
      case 'refresh-comments': render(); break;
      case 'read-all':
        state.notifs.forEach(function (n) { n.read = true; });
        save('notifs', state.notifs);
        render();
        break;
      case 'toggle-pw': {
        var input = el.parentElement.querySelector('input');
        var show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        el.innerHTML = show ? I.eye : I.eyeOff;
        break;
      }
      case 'generate': {
        var d = new Date();
        state.files.unshift({ name: 'tickets_2026-08-30_2026-09-29.xlsx', size: '52.4 KB', by: user.name, at: d.toLocaleDateString('en-GB') + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) });
        save('files', state.files);
        render();
        toast('Excel file generated');
        break;
      }
      case 'download': toast('Download started'); break;
      case 'csv': toast('CSV exported'); break;
      case 'change-password': toast('A reset link was sent to ' + user.email); break;
      case 'assign-locations': toast('Assign locations'); break;
      default: break;
    }
  });

  function toggleCc(chev) {
    var fld = chev.closest('.fld');
    var extra = fld.querySelector('.cc-extra');
    if (extra) {
      extra.remove();
      chev.innerHTML = I.down;
    } else {
      fld.insertAdjacentHTML('beforeend', '<div class="cc-extra"><span class="fld-label">Email in cc:</span><input placeholder=".................." /></div>');
      chev.innerHTML = I.up;
    }
  }

  function addComment() {
    var input = app.querySelector('[data-comment]');
    var text = input && input.value.trim();
    if (!text) return;
    var id = currentRoute().split('/')[1];
    var d = new Date();
    (state.comments[id] = state.comments[id] || []).push({ by: user.name, text: text, at: d.toLocaleString('en-GB') });
    save('comments', state.comments);
    render();
  }

  document.addEventListener('input', function (e) {
    if (e.target.matches('[data-search]')) {
      state.search = e.target.value;
      state._focusSearch = true;
      render();
    }
    if (e.target.matches('[data-comment]')) {
      app.querySelector('.comment-btn').classList.toggle('ready', !!e.target.value.trim());
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeOverlay();
    if (e.key === 'Enter' && e.target.matches('[data-comment]')) addComment();
  });

  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (form.hasAttribute('data-dialog') || form.hasAttribute('data-tug-form')) return;
    e.preventDefault();
    var v = Object.fromEntries(new FormData(form));
    switch (form.dataset.form) {
      case 'ticket':
        toast(currentRoute() === 'tickets/new' ? 'New order sent' : 'Order updated');
        break;
      case 'user': {
        var u = { name: v.name, email: v.email, phone: v.phone || 'N/A', company: v.company || 'N/A', role: v.role, status: 'ACTIVE' };
        if (form.dataset.index != null) Object.assign(state.users[Number(form.dataset.index)], u); else state.users.unshift(u);
        save('users', state.users);
        go('admin/users');
        break;
      }
      case 'vessel':
        state.vessels.unshift({ name: v.name, grt: Number(v.grt).toFixed(2), dwt: Number(v.dwt).toLocaleString('en-US', { minimumFractionDigits: 2 }), loa: Number(v.loa).toFixed(2) + ' m' });
        save('vessels', state.vessels);
        go('admin/vessels');
        break;
      default: break;
    }
  });

  history.push(currentRoute());
  render();
  // The frame may attach its listener late; repeat the colour once everything has loaded.
  window.addEventListener('load', function () { if (!overlay) statusBar(BG); });
})();
