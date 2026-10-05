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
    // Long enough to read: 3.5s, plus 60ms a character past the first 40, at most 8s.
    var ms = Math.min(8000, 3500 + Math.max(0, msg.length - 40) * 60);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, ms);
  }

  // A push to the client, shown in the notification list (demo: everyone sees the same list).
  // Who gets a notification: 'to' lists roles; none = the operations side (ADMIN, MOD). owner = the ticket's
  // client ('by:<name>' on the tickets list, 'agency:<nick>' on the board): a CLIENT only sees their own.
  var OPS = ['ADMIN', 'MOD'];
  function notify(icon, title, lines, to, owner) {
    state.notifs.unshift({ icon: icon, title: title, lines: lines, time: 'just now', to: to || OPS, owner: owner || '' });
    save('notifs', state.notifs);
  }
  function ownsNotif(n) {
    var o = n.owner || '';
    return o.indexOf('by:') === 0 ? norm(o.slice(3)) === norm(D.demoClient) : o.indexOf('agency:') === 0 && o.slice(7) === D.demoClientAgency;
  }
  // Where tapping a notification goes: its ticket ("Ticket #id", or the vessel in the title), else the
  // plan board for a board ticket ('agency:' owner) when this role may open it.
  function notifTarget(n) {
    var text = (n.lines || []).join(' ');
    var m = text.match(/Ticket #(\w+)/);
    var tk = m ? ticketById(m[1]) : myTickets().filter(function (x) { return x.vessel && n.title.indexOf(x.vessel) >= 0; })[0];
    if (tk && myTickets().indexOf(tk) >= 0) return 'tickets/' + tk.id;
    return /^agency:/.test(n.owner || '') && allowed('board') ? 'board' : '';
  }
  function seesNotif(n) { return (n.to || OPS).indexOf(user.role) >= 0 && (user.role !== 'CLIENT' || ownsNotif(n)); }
  // Every role counts only what is meant for it (no fixed server count).
  function unreadCount() {
    return state.notifs.filter(function (n) { return seesNotif(n) && !n.read; }).length;
  }
  function bellBadge() {
    var n = unreadCount();
    return n > 0 ? '<span class="hdr-badge">' + (n > 99 ? '99+' : n) + '</span>' : '';
  }

  // ---------- state ----------

  var user = getUser() || { name: 'User', email: '', phone: 'N/A', company: 'N/A', role: '' };

  // ---------- roles (demo: the role is picked once per session, right after sign-in) ----------

  var ROLE_KEY = 'hvs_demo_role';

  function roleOf(key) {
    return D.roles.filter(function (r) { return r.key === key; })[0] || null;
  }

  function pickedRole() {
    try { return sessionStorage.getItem(ROLE_KEY); } catch (e) { return null; }
  }

  // The board (src/board/store.js) reads the role from the signed-in user, so it is written there too.
  function setRole(key) {
    user.role = key;
    try {
      sessionStorage.setItem(ROLE_KEY, key);
      (localStorage.getItem(USER_KEY) ? localStorage : sessionStorage).setItem(USER_KEY, JSON.stringify(user));
    } catch (e) { /* storage blocked */ }
  }

  user.role = roleOf(pickedRole()) ? pickedRole() : '';

  // Route prefixes per role (D.roles); profile and notifications are open to every role.
  function allowed(route) {
    var r = roleOf(user.role);
    if (!r) return false;
    if (/^(profile|notifications)$/.test(route)) return true;
    return r.routes.some(function (p) { return p === '*' || route === p || route.indexOf(p + '/') === 0; });
  }

  function homeRoute() {
    var r = roleOf(user.role);
    return r ? r.home : 'tickets';
  }
  var state = {
    tickets: store('tickets', D.tickets),
    users: store('users', D.users),
    vessels: store('vessels', D.vessels),
    ports: store('ports', D.ports),
    requests: store('requests', D.userRequests),
    locations: store('locations', D.locations),
    persons: store('persons', D.contactPersons),
    settings: store('settings', D.settings),
    stickers: store('stickers', D.stickers),
    tugboats: store('tugboats', D.tugboats),
    files: store('files', D.exportFiles),
    notifs: store('notifs', D.notifications.items),
    comments: store('comments', {}),
    ticketFilter: 'All',
    tf: {}, // Filters sheet: user, vessel, port, date (yyyy-mm-dd, created day), files
    ticketPage: 1,
    notifPage: 1,
    userTab: 'ACTIVE',
    search: '',
    formTab: 'towage',
    showAllContacts: false,
    exportCols: D.exportColumns.slice(),
    // Client cancellation requests on the ticket list: { 't:<id>': { reason, by, at } }.
    cancelReqs: store('cancelReqs', {}),
    ticketServices: store('ticketServices', {})
  };

  // Access requests sent from login.html (Request access) join the admin's User Requests list.
  (function () {
    var fresh = store('requestsNew', []);
    if (!fresh.length) return;
    state.requests = fresh.concat(state.requests);
    save('requests', state.requests);
    try { sessionStorage.removeItem('hvs_requestsNew'); } catch (e) { /* storage blocked */ }
  })();

  // Service Types edited by the admin replace the catalogue in place, so the board bundle (which shares
  // this D object) renders from the edited rows too.
  (function () {
    var saved = store('services', null);
    if (saved && saved.length) { D.services.length = 0; Array.prototype.push.apply(D.services, saved); }
    // 'set' (MOD picks POB in / POB out) was retired: those services now go right after Mano (arrival).
    D.services.forEach(function (s) { if (s.at === 'set') s.at = 'after'; });
  })();

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

  // The header names the screen; the ticket list and ticket form keep the module name "Order & Update".
  var TITLES = {
    board: 'Plan Board', history: 'History', profile: 'Profile', notifications: 'Notifications', admin: 'Administration',
    ledger: 'Ledger', 'ledger/ai': 'AI Suggestions', 'ledger/export': 'Export Ledger', 'ledger/files': 'Ledger Files',
    'admin/fx-rates': 'Currencies & Rates'
  };

  function screenTitle() {
    var r = currentRoute();
    if (/^tickets(\/|$)/.test(r)) return 'Order & Update';
    if (TITLES[r]) return TITLES[r];
    var a = D.admin.filter(function (x) { return x.route === r; })[0];
    return a ? a.title : 'Order & Update';
  }

  function header(opts) {
    opts = opts || {};
    if (desk()) return deskTop(opts);
    var left = opts.logo
      ? '<img class="hdr-logo" src="assets/appicon.png" alt="HVS Group" data-go="tickets" />'
      : '<button class="hdr-back" data-action="back" aria-label="Back">' + I.back + '</button>';
    var bell = opts.noBell ? '' :
      '<button class="hdr-bell" data-go="notifications" aria-label="Notifications">' + I.bell + bellBadge() + '</button>';
    return '<header class="hdr">' + left + bell +
      '<button class="hdr-menu" data-action="drawer" aria-label="Menu">' + I.menu + '</button>' +
      '<h1 class="hdr-title">' + esc(opts.title || screenTitle()) + '</h1></header>';
  }

  function search(placeholder, cls) {
    return '<label class="search' + (cls ? ' ' + cls : '') + '">' + I.search +
      '<input type="search" data-search placeholder="' + esc(placeholder) + '" value="' + esc(state.search) + '" /></label>';
  }

  function fab(route, extra, style) {
    if (desk()) return ''; // dataTable() shows an Add button instead
    return '<button class="fab ' + (extra || '') + '" style="' + style + '" data-action="' + route + '" aria-label="Add">' + I.plus + '</button>';
  }

  // The list pager (same look as the live app). key names the list (state[key + 'Page'] holds its page);
  // up to 5 pages all show, more show 1 … around the current one … last.
  function pager(total, perPage, page, key) {
    var pages = Math.max(1, Math.ceil(total / perPage));
    page = Math.min(Math.max(1, page), pages);
    var nums = [];
    if (pages <= 5) for (var n = 1; n <= pages; n++) nums.push(n);
    else {
      var a = Math.max(2, Math.min(page - 1, pages - 3)), b = Math.min(pages - 1, a + 2);
      nums.push(1);
      if (a > 2) nums.push('…');
      for (var m = a; m <= b; m++) nums.push(m);
      if (b < pages - 1) nums.push('…');
      nums.push(pages);
    }
    var go = function (n) { return ' data-page="' + key + ':' + n + '"'; };
    return '<div class="pager" data-pages="' + pages + '"><div class="pager-total">' + total + ' items total</div><div class="pager-row">' +
      '<button class="arrow' + (page === 1 ? ' off' : '') + '"' + go(page - 1) + ' aria-label="Previous page">' + I.pLeft + '</button>' +
      nums.map(function (n) {
        return n === '…' ? '<span class="dots">...</span>' : '<button class="' + (n === page ? 'on' : '') + '"' + go(n) + '>' + n + '</button>';
      }).join('') +
      '<button class="arrow' + (page === pages ? ' off' : '') + '"' + go(page + 1) + ' aria-label="Next page">' + I.pRight + '</button></div></div>';
  }

  // Vietnamese-aware search: "phat dinh" finds "Phát Đinh".
  function norm(text) {
    return String(text == null ? '' : text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  }

  function matches(text) {
    var q = norm(state.search.trim());
    return !q || norm(text).indexOf(q) >= 0;
  }

  // ---------- picker sheet (every linked-data picker) ----------

  /*
   * A bottom sheet to pick one or several records, with search (no diacritics needed) and, under each
   * option, the fields that tell look-alikes apart; holding / hovering an option shows the whole record.
   *   items   [{ value, label, sub, title, note }]   value    current value (array when multi)
   *   multi   several values, confirmed with Done     none     label of a "no value" option (single only)
   *   head    html above the search box (e.g. the ticket note next to an invoice-customer pick)
   */
  function picker(opts) {
    var multi = !!opts.multi;
    var chosen = multi ? (opts.value || []).slice() : opts.value;
    var item = function (x) {
      var on = multi ? chosen.indexOf(x.value) >= 0 : chosen === x.value;
      return '<button type="button" class="pk-item' + (on ? ' on' : '') + '" data-pk="' + esc(x.value) + '" title="' + esc(x.title || '') + '">' +
        '<span class="pk-text"><b>' + esc(x.label) + '</b>' + (x.sub ? '<small>' + esc(x.sub) + '</small>' : '') + (x.note ? '<em>' + esc(x.note) + '</em>' : '') + '</span>' +
        '<i class="pk-mark">' + (on ? I.check : '') + '</i></button>';
    };
    var html = '<div class="mask light" data-action="close"></div><div class="bsheet pk-sheet" role="dialog" aria-modal="true"><div class="bsheet-head"><h3>' + esc(opts.title) + '</h3>' +
      '<button data-action="close" aria-label="Close">' + I.close + '</button></div>' + (opts.head || '') +
      '<label class="search sm pk-search">' + I.search + '<input type="search" data-pk-q placeholder="' + esc(opts.placeholder || 'Search') + '" /></label>' +
      '<div class="pk-list">' + (opts.none && !multi ? item({ value: '', label: opts.none }) : '') + opts.items.map(item).join('') +
      '<p class="pk-empty" hidden>Nothing matches</p></div>' +
      (multi ? '<div class="bsheet-btns">' + (opts.onReset ? '<button class="clear" data-pk-reset>Reset</button>' : '<button class="clear" data-pk-clear>Clear</button>') +
        '<button class="done" data-pk-done>Done</button></div>' : '') + '</div>';
    var wrap = openOverlay(html, 'sheet', '#a8a8a8');
    var list = wrap.querySelector('.pk-list');
    var byValue = {};
    opts.items.forEach(function (x) { byValue[x.value] = x; });
    wrap.querySelector('[data-pk-q]').addEventListener('input', function (e) {
      var q = norm(e.target.value.trim());
      var shown = 0;
      list.querySelectorAll('.pk-item').forEach(function (b) {
        var x = byValue[b.dataset.pk];
        var hit = !q || !x || norm([x.label, x.sub, x.title].join(' ')).indexOf(q) >= 0;
        b.hidden = !hit;
        if (hit) shown++;
      });
      list.querySelector('.pk-empty').hidden = shown > 0;
    });
    wrap.querySelector('.pk-sheet').addEventListener('click', function (e) {
      var b = e.target.closest('[data-pk]');
      if (b) {
        if (!multi) { closeOverlay(); return opts.onPick(b.dataset.pk); }
        var v = b.dataset.pk;
        var at = chosen.indexOf(v);
        if (at >= 0) chosen.splice(at, 1); else chosen.push(v);
        b.classList.toggle('on', at < 0);
        b.querySelector('.pk-mark').innerHTML = at < 0 ? I.check : '';
        return;
      }
      if (e.target.closest('[data-pk-clear]')) {
        chosen = [];
        list.querySelectorAll('.pk-item').forEach(function (x) { x.classList.remove('on'); x.querySelector('.pk-mark').innerHTML = ''; });
      }
      if (e.target.closest('[data-pk-done]')) { closeOverlay(); opts.onPick(chosen); }
      // Reset (a filter's picker): clears the filter and closes, no Done needed.
      if (e.target.closest('[data-pk-reset]')) { closeOverlay(); opts.onReset(); }
    });
    return wrap;
  }

  /*
   * The edit dialog of the management and pricing screens (A1: edits happen in a modal).
   *   fields  [{ name, label, type, options, req, hint, placeholder, half }]
   *           type: text · number · textarea · date · select · checkbox · color · range (name+'Min' / name+'Max')
   *                 one / multi (an inline list with search, options [{ value, label, sub, title }]) · html (static)
   *   onSave(values, force) -> nothing (saved) · { error } (stays open) · { warn } (asks to save anyway, then force = true)
   *                            · { stay } (stays open, e.g. a tool showing its result in the dialog)
   */
  function editDialog(o) {
    var v = o.values || {};
    var val = function (k) { return v[k] == null ? '' : v[k]; };
    var field = function (f) {
      var lab = '<label class="field-label">' + esc(f.label) + (f.req ? '<span class="req">*</span>' : '') + '</label>';
      var hint = f.hint ? '<p class="ed-hint">' + esc(f.hint) + '</p>' : '';
      var ph = ' placeholder="' + esc(f.placeholder || '') + '"';
      var body;
      if (f.type === 'html') return '<div class="ed-f' + (f.half ? ' half' : '') + '">' + (f.label ? lab : '') + f.html + '</div>';
      if (f.type === 'textarea') body = '<textarea class="text-area" name="' + f.name + '"' + ph + '>' + esc(val(f.name)) + '</textarea>';
      else if (f.type === 'select') {
        body = '<select class="text-input" name="' + f.name + '">' + f.options.map(function (x) {
          return '<option value="' + esc(x.value) + '"' + (String(x.value) === String(val(f.name)) ? ' selected' : '') + '>' + esc(x.label) + '</option>';
        }).join('') + '</select>';
      } else if (f.type === 'checkbox') {
        return '<label class="check ed-check"><input type="checkbox" name="' + f.name + '"' + (v[f.name] ? ' checked' : '') + ' />' + esc(f.label) + '</label>' + hint;
      } else if (f.type === 'color') body = '<input class="ed-color" type="color" name="' + f.name + '" value="' + esc(val(f.name) || '#ffffff') + '" />';
      else if (f.type === 'range') {
        body = '<div class="ed-range"><input class="text-input" name="' + f.name + 'Min" inputmode="decimal" placeholder="min (any)" value="' + esc(val(f.name + 'Min')) + '" />' +
          '<span>≤ ' + esc(f.unit || '') + ' ≤</span><input class="text-input" name="' + f.name + 'Max" inputmode="decimal" placeholder="max (any)" value="' + esc(val(f.name + 'Max')) + '" /></div>';
      } else if (f.type === 'one' || f.type === 'multi') {
        var cur = f.type === 'multi' ? (v[f.name] || []) : [val(f.name)];
        body = '<div class="ed-list"><input class="ed-q" type="search" placeholder="Search" />' + '<div class="ed-opts">' + f.options.map(function (x) {
          return '<label class="ed-opt" title="' + esc(x.title || '') + '"><input type="' + (f.type === 'multi' ? 'checkbox' : 'radio') + '" name="' + f.name + '" value="' + esc(x.value) + '"' +
            (cur.indexOf(x.value) >= 0 ? ' checked' : '') + ' /><span><b>' + esc(x.label) + '</b>' + (x.sub ? '<small>' + esc(x.sub) + '</small>' : '') + (x.note ? '<em>' + esc(x.note) + '</em>' : '') + '</span></label>';
        }).join('') + '</div></div>';
      } else {
        body = '<input class="text-input" name="' + f.name + '"' + (f.type === 'number' ? ' inputmode="decimal"' : '') + ph + ' value="' + esc(val(f.name)) + '" />';
      }
      return '<div class="ed-f' + (f.half ? ' half' : '') + '">' + lab + body + hint + '</div>';
    };
    var html = '<div class="mask light" data-action="close"></div><form class="dialog ed-dialog" data-dialog novalidate><h3>' + esc(o.title) + '</h3>' +
      (o.text ? '<p class="dlg-text">' + esc(o.text) + '</p>' : '') + '<div class="ed-grid">' + o.fields.map(field).join('') + '</div>' +
      '<div class="ed-msg" hidden></div>' +
      '<div class="actions">' + (o.reset ? '<button type="button" class="ed-reset" data-ed-reset>' + esc(o.reset.label || 'Reset') + '</button>' : '') +
      '<button type="button" class="pill-btn outline dark" data-action="close">Cancel</button><button type="submit" class="pill-btn primary">' + esc(o.okLabel || 'Save') + '</button></div></form>';
    var wrap = openOverlay(html, 'dialog', '#a8a8a8');
    var form = wrap.querySelector('form');
    form.style.top = Math.max(24, (window.innerHeight - form.offsetHeight) / 2) + 'px';
    if (o.reset) form.querySelector('[data-ed-reset]').addEventListener('click', function () { closeOverlay(); o.reset.run(); render(); });
    var force = false;
    form.addEventListener('input', function (e) {
      if (e.target.classList.contains('ed-q')) {
        var q = norm(e.target.value.trim());
        e.target.parentElement.querySelectorAll('.ed-opt').forEach(function (l) { l.hidden = !!q && norm(l.textContent + ' ' + l.title).indexOf(q) < 0; });
        return;
      }
      force = false; // a changed value has to be checked again
      form.querySelector('[type=submit]').textContent = o.okLabel || 'Save';
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var out = {};
      o.fields.forEach(function (f) {
        if (f.type === 'html') return;
        if (f.type === 'checkbox') out[f.name] = form.elements[f.name].checked;
        else if (f.type === 'range') { out[f.name + 'Min'] = form.elements[f.name + 'Min'].value.trim(); out[f.name + 'Max'] = form.elements[f.name + 'Max'].value.trim(); }
        else if (f.type === 'multi') out[f.name] = Array.prototype.map.call(form.querySelectorAll('[name="' + f.name + '"]:checked'), function (x) { return x.value; });
        else if (f.type === 'one') { var c = form.querySelector('[name="' + f.name + '"]:checked'); out[f.name] = c ? c.value : ''; }
        else out[f.name] = form.elements[f.name].value.trim();
      });
      var missing = o.fields.filter(function (f) { return f.req && (out[f.name] === '' || (Array.isArray(out[f.name]) && !out[f.name].length)); });
      var msg = form.querySelector('.ed-msg');
      if (missing.length) {
        msg.hidden = false; msg.className = 'ed-msg err';
        msg.textContent = 'Required: ' + missing.map(function (f) { return f.label; }).join(', ');
        return;
      }
      var r = o.onSave(out, force) || {};
      if (r.stay) { msg.hidden = true; return; }
      if (r.error) { msg.hidden = false; msg.className = 'ed-msg err'; msg.textContent = r.error; return; }
      if (r.warn) {
        msg.hidden = false; msg.className = 'ed-msg warn'; msg.textContent = r.warn;
        force = true;
        form.querySelector('[type=submit]').textContent = 'Save anyway';
        return;
      }
      closeOverlay();
      render();
    });
    return wrap;
  }

  // A dialog asking for a required reason / note; onOk(text).
  function reasonDialog(title, text, label, placeholder, okLabel, onOk) {
    var html = '<div class="mask light" data-action="close"></div><form class="dialog" data-dialog><h3>' + esc(title) + '</h3>' +
      (text ? '<p class="dlg-text">' + esc(text) + '</p>' : '') +
      '<label class="field-label">' + esc(label) + '<span class="req">*</span></label>' +
      '<textarea class="text-area" name="reason" placeholder="' + esc(placeholder) + '"></textarea><div class="hold-err" hidden>Please write a reason</div>' +
      '<div class="actions"><button type="button" class="pill-btn outline dark" data-action="close">Cancel</button><button type="submit" class="pill-btn primary">' + esc(okLabel) + '</button></div></form>';
    var wrap = openOverlay(html, 'dialog', '#a8a8a8');
    var form = wrap.querySelector('form');
    form.style.top = Math.max(60, (window.innerHeight - form.offsetHeight) / 2 - 30) + 'px';
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = form.reason.value.trim();
      form.querySelector('.hold-err').hidden = !!v;
      if (!v) return;
      closeOverlay();
      onOk(v);
    });
  }

  // Asks before something that cannot be undone (delete, mark not valid); onOk() runs on confirm.
  // safe: the OK button is blue (Approve, …) instead of red (Delete, Reject, …).
  function confirmDialog(title, text, okLabel, onOk, safe) {
    var html = '<div class="mask light" data-action="close"></div><form class="dialog" data-dialog><h3>' + esc(title) + '</h3>' +
      (text ? '<p class="dlg-text">' + esc(text) + '</p>' : '') +
      '<div class="actions"><button type="button" class="pill-btn outline dark" data-action="close">Cancel</button><button type="submit" class="pill-btn ' + (safe ? 'primary' : 'danger') + '">' + esc(okLabel || 'Delete') + '</button></div></form>';
    var wrap = openOverlay(html, 'dialog', '#a8a8a8');
    var form = wrap.querySelector('form');
    form.style.top = Math.max(60, (window.innerHeight - form.offsetHeight) / 2 - 30) + 'px';
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      closeOverlay();
      onOk();
    });
  }

  // ---------- desktop tables ----------
  // At desktop width every list screen renders through dataTable() instead of its stacked cards;
  // the 390px device frame keeps the cards, except management screens (see manageTable()).

  var DESK = window.matchMedia('(min-width: 1024px)');
  var tables = {}; // per route: { sort, dir, page, size }

  // The mobile design (device frame) stays the default; index.html's "Desktop design" sets hvs_view=desktop
  // and app.html adds html.desk-mode, which renders the desktop shell (sidebar + top bar) at any width.
  var DESKTOP_ENABLED = document.documentElement.classList.contains('desk-mode');

  function desk() { return DESKTOP_ENABLED; }

  // Management (admin list) screens use the table at every width, the 390px frame included.
  var MANAGEMENT_TABLES = true;

  function manageTable() { return MANAGEMENT_TABLES || desk(); }

  function toNum(v) {
    var n = parseFloat(String(v == null ? '' : v).replace(/,/g, ''));
    return isNaN(n) ? -Infinity : n;
  }

  // 'dd/MM/yyyy', 'dd/MM/yyyy HH:mm' or 'dd/MM/yyyy h:mm AM'; empty sorts first.
  function stamp(v) {
    var m = /^(\d\d)\/(\d\d)\/(\d{4})(?: (\d\d?):(\d\d)(?: ?(AM|PM))?)?/.exec(v || '');
    if (!m) return -Infinity;
    var h = Number(m[4] || 0) % (m[6] ? 12 : 24) + (m[6] === 'PM' ? 12 : 0);
    return Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]), h, Number(m[5] || 0));
  }

  var SORTERS = {
    text: function (a, b) { return String(a == null ? '' : a).localeCompare(String(b == null ? '' : b), 'vi', { sensitivity: 'base', numeric: true }); },
    number: function (a, b) { return toNum(a) - toNum(b); },
    date: function (a, b) { return (Date.parse(a) || 0) - (Date.parse(b) || 0); },
    datetime: function (a, b) { return stamp(a) - stamp(b); }
  };

  function dash(v) {
    return v === '' || v == null || v === 'N/A' ? '<span class="dt-muted">-</span>' : esc(v);
  }

  function pageList(page, pages) {
    if (pages <= 7) return Array.from({ length: pages }, function (_, n) { return n + 1; });
    var out = [1];
    var from = Math.max(2, Math.min(page - 1, pages - 4));
    var to = Math.min(pages - 1, Math.max(page + 1, 5));
    if (from > 2) out.push('…');
    for (var n = from; n <= to; n++) out.push(n);
    if (to < pages - 1) out.push('…');
    return out.concat(pages);
  }

  /*
   * One table for every list screen.
   *   source   the state array (row actions get the index into it)
   *   list     the rows to show, already filtered by search / chips
   *   cols     [{ key, label, sort: 'text'|'number'|'date'|'datetime', cell(x) -> html, cls }]
   *   actions  (x, i) -> html for the last column
   *   go       (x) -> route, makes whole rows open it
   *   tools    html left of the search box (filter chips, links)
   *   add      { action, label } for the Add button (the phone's FAB)
   *   sort     [key, 1 | -1] initial sort; perPage (default 10); noun; empty; placeholder
   */
  function dataTable(cfg) {
    var ts = tables[currentRoute()] || (tables[currentRoute()] = {
      sort: cfg.sort ? cfg.sort[0] : null, dir: cfg.sort ? cfg.sort[1] : 1, page: 1, size: cfg.perPage || 10
    });
    var rows = cfg.list.slice();
    var sc = cfg.cols.filter(function (c) { return c.key === ts.sort && c.sort; })[0];
    if (sc) {
      // Stable sort: ties keep the stored order.
      rows = rows.map(function (x, n) { return [x, n]; }).sort(function (a, b) {
        return SORTERS[sc.sort](a[0][sc.key], b[0][sc.key]) * ts.dir || a[1] - b[1];
      }).map(function (p) { return p[0]; });
    }
    var total = rows.length;
    var pages = Math.max(1, Math.ceil(total / ts.size));
    if (ts.page > pages) ts.page = pages;
    var from = (ts.page - 1) * ts.size;
    var shown = rows.slice(from, from + ts.size);
    var noun = cfg.noun || 'item';

    // A column with 'stick' (its left offset in px) stays frozen while the table scrolls sideways; 'edge' on
    // the last frozen one draws the shadow.
    var stick = function (c) { return c.stick == null ? '' : ' dt-stick' + (c.edge ? ' dt-stick-edge' : ''); };
    var stickAt = function (c) { return c.stick == null ? '' : ' style="--stick:' + c.stick + 'px"'; };
    var head = cfg.cols.map(function (c) {
      if (!c.sort) return '<th class="' + (c.cls || '') + stick(c) + '"' + stickAt(c) + '>' + esc(c.label) + '</th>';
      var on = c.key === ts.sort;
      return '<th class="sortable ' + (c.cls || '') + stick(c) + (on ? ' on' : '') + '"' + stickAt(c) + ' data-tsort="' + c.key + '" aria-sort="' +
        (on ? (ts.dir > 0 ? 'ascending' : 'descending') : 'none') + '"><span>' + esc(c.label) +
        '<i class="dt-arrow ' + (on ? (ts.dir > 0 ? 'asc' : 'desc') : '') + '"></i></span></th>';
    }).join('') + (cfg.actions ? '<th class="dt-act"></th>' : '');

    var body = shown.map(function (x) {
      var i = cfg.source.indexOf(x);
      return '<tr' + (cfg.go ? ' class="go" data-go="' + esc(cfg.go(x)) + '"' : '') + '>' + cfg.cols.map(function (c) {
        return '<td class="' + (c.cls || '') + stick(c) + '"' + stickAt(c) + '>' + (c.cell ? c.cell(x, i) : dash(x[c.key])) + '</td>';
      }).join('') + (cfg.actions ? '<td class="dt-act">' + actCell(cfg.actions(x, i)) + '</td>' : '') + '</tr>';
    }).join('');
    if (!total) {
      body = '<tr class="dt-empty"><td colspan="' + (cfg.cols.length + (cfg.actions ? 1 : 0)) + '">' + I.inbox + '<span>' + esc(cfg.empty || 'No ' + noun + 's found') + '</span></td></tr>';
    }

    var nums = pageList(ts.page, pages).map(function (n) {
      return n === '…' ? '<span class="dt-gap">…</span>' : '<button class="' + (n === ts.page ? 'on' : '') + '" data-tpage="' + n + '">' + n + '</button>';
    }).join('');
    var foot = '<div class="dt-foot"><span class="dt-total">' +
      (total ? (from + 1) + '–' + (from + shown.length) + ' of ' + total + ' ' + noun + (total === 1 ? '' : 's') : '0 ' + noun + 's') + '</span>' +
      '<div class="dt-pages"><button class="arrow" data-tpage="' + (ts.page - 1) + '"' + (ts.page === 1 ? ' disabled' : '') + ' aria-label="Previous page">' + I.pLeft + '</button>' + nums +
      '<button class="arrow" data-tpage="' + (ts.page + 1) + '"' + (ts.page === pages ? ' disabled' : '') + ' aria-label="Next page">' + I.pRight + '</button></div>' +
      '<label class="dt-size">Rows per page <select data-tsize>' + [10, 20, 50].concat(cfg.perPage && [10, 20, 50].indexOf(cfg.perPage) < 0 ? [cfg.perPage] : []).map(function (n) {
        return '<option' + (n === ts.size ? ' selected' : '') + '>' + n + '</option>';
      }).join('') + '</select></label></div>';

    return '<div class="dt">' +
      '<div class="dt-bar"><div class="dt-tools">' + (cfg.tools || '') + '</div><div class="dt-bar-r">' + search(cfg.placeholder || 'Search...', 'dt-search') +
      (cfg.add ? '<button class="dt-add" data-action="' + cfg.add.action + '">' + I.plus + esc(cfg.add.label) + '</button>' : '') + '</div></div>' +
      '<div class="dt-wrap"><table class="dt-table"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>' + foot + '</div>';
  }

  // The action cell. On a phone the column stays frozen on the right, so several buttons (Edit · Delete…) fold
  // into one ⋯ that opens them in an action sheet; the real buttons stay in the cell, hidden, and the sheet
  // clicks them. One button, or a desktop, shows the buttons as they are.
  function actCell(html) {
    if (desk() || (html.match(/<button/g) || []).length < 2) return '<div class="dt-btns">' + html + '</div>';
    return '<button class="dt-more" data-dt-more aria-label="Actions">⋯</button><div class="dt-btns" hidden>' + html + '</div>';
  }

  function openRowActions(more) {
    var row = more.closest('tr');
    var title = row.querySelector('td:not(.lg-c-sel)');
    var items = Array.prototype.map.call(more.nextElementSibling.querySelectorAll('button'), function (b) {
      return { label: b.textContent.trim() || b.getAttribute('aria-label') || 'Open', danger: b.classList.contains('danger'), run: function () { b.click(); } };
    });
    api.actionSheet(title ? title.textContent.trim() : 'Actions', '', items);
  }

  // Search and filter changes start the current table over at page 1.
  function firstPage() {
    var ts = tables[currentRoute()];
    if (ts) ts.page = 1;
  }

  function deskPage(title, sub, table) {
    return header({ title: title }) + '<div class="page dt-page">' + (sub ? '<div class="dt-head"><p class="section-sub">' + esc(sub) + '</p></div>' : '') + table + '</div>';
  }

  function pill(text, bg) {
    return '<span class="dt-pill" style="background:' + bg + '">' + esc(text) + '</span>';
  }

  function btn(cls, attr, label) {
    return '<button class="dt-btn ' + cls + '" ' + attr + '>' + label + '</button>';
  }

  // ---------- views ----------

  var views = {};

  // The demo CLIENT account's own tickets (CLIENT sees only these; other roles see all).
  function myTickets() {
    if (user.role !== 'CLIENT') return state.tickets;
    var me = norm(D.demoClient);
    return state.tickets.filter(function (t) { return norm(t.by) === me; });
  }

  // While its client asks to cancel, a ticket shows "Cancel requested" in place of its status (one pill, amber).
  var CANCEL_REQ = 'Cancel requested';
  function held(t) { return !!state.cancelReqs['t:' + t.id]; }

  // The ticket list's Filters sheet (state.tf). Text filters match without accents; date = the created day.
  function sheetPasses(t) {
    var f = state.tf;
    if (f.user && norm(t.by).indexOf(norm(f.user)) < 0) return false;
    if (f.vessel && norm(t.vessel).indexOf(norm(f.vessel)) < 0) return false;
    if (f.port && norm(t.port).indexOf(norm(f.port)) < 0) return false;
    if (f.date) {
      var m = String(t.created || '').match(/^(\d{2})\/(\d{2})\/(\d{4})/);
      if (!m || m[3] + '-' + m[2] + '-' + m[1] !== f.date) return false;
    }
    return !f.files || t.files > 0;
  }
  function tfCount() { return Object.keys(state.tf).filter(function (k) { return state.tf[k]; }).length; }

  views.tickets = function () {
    var filters = ['All', CANCEL_REQ, 'Pending', 'Confirmed', 'New Update', 'Done', 'Not Valid', 'Cancelled'];
    var mine = myTickets();
    var list = mine.filter(function (t) {
      if (!sheetPasses(t)) return false;
      if (state.ticketFilter === CANCEL_REQ) return held(t);
      return state.ticketFilter === 'All' || t.status === state.ticketFilter;
    });
    if (desk()) {
      var count = function (f) {
        return mine.filter(function (t) { return f === CANCEL_REQ ? held(t) : f === 'All' || t.status === f; }).length;
      };
      return header({ logo: true }) + '<div class="page dt-page">' + dataTable({
        source: state.tickets,
        list: list.filter(function (t) { return matches([t.id, t.vessel, t.port, t.by, t.note].join(' ')); }),
        noun: 'ticket',
        perPage: 20,
        placeholder: 'Search ticket, vessel, port or user...',
        empty: 'No tickets match this filter',
        add: { action: 'new-ticket', label: 'New order' },
        go: function (t) { return 'tickets/' + t.id; },
        tools: '<div class="dt-chips">' + filters.map(function (f) {
          return '<button class="' + (f === state.ticketFilter ? 'on' : '') + '" data-filter="' + f + '">' + f + '<em>' + count(f) + '</em></button>';
        }).join('') + '</div>',
        cols: [
          { key: 'id', label: 'Ticket', sort: 'number', cell: function (t) {
            return '<b>#' + esc(t.id) + '</b>' + (t.files ? '<span class="dt-files" title="' + t.files + ' file' + (t.files > 1 ? 's' : '') + ' attached">📎' + t.files + '</span>' : '');
          } },
          { key: 'status', label: 'Status', sort: 'text', cell: function (t) { return held(t) ? pill(CANCEL_REQ, '#f59e0b') : pill(t.status, D.statusColors[t.status] || '#6c757d'); } },
          { key: 'vessel', label: 'Vessel', sort: 'text', cls: 'clip', cell: function (t) { return '<b title="' + esc(t.vessel) + '">' + esc(t.vessel) + '</b>'; } },
          { key: 'port', label: 'Port', sort: 'text', cls: 'clip', cell: function (t) { return '<span title="' + esc(t.port) + '">' + esc(t.port) + '</span>'; } },
          { key: 'berth', label: 'ET Berth / Unberth', sort: 'datetime', cell: function (t) {
            return '<div class="dt-2l"><span>' + dash(t.berth) + '</span>' + (t.unberth ? '<span>→ ' + esc(t.unberth) + '</span>' : '') + '</div>';
          } },
          { key: 'created', label: 'Created', sort: 'datetime' },
          // No Assignee: STAFF is gone in Phase 4, nobody is assigned to a ticket.
          { key: 'by', label: 'By', sort: 'text' },
          { key: 'note', label: 'Note', cls: 'note', cell: function (t) { return t.note ? '<span title="' + esc(t.note) + '">' + esc(t.note) + '</span>' : dash(''); } }
        ]
      }) + '</div>';
    }
    // Paged for real: 20 cards per page of the filtered list.
    var total = list.length;
    state.ticketPage = Math.min(state.ticketPage, Math.max(1, Math.ceil(total / 20)));
    var page = list.slice((state.ticketPage - 1) * 20, state.ticketPage * 20);
    return header({ logo: true }) +
      '<div class="strip"><div class="strip-filters' + (tfCount() ? ' on' : '') + '" data-action="filters">' + I.filter + 'Filters' + (tfCount() ? ' · ' + tfCount() : '') + '</div>' +
      '<div class="chips">' + filters.map(function (f) {
        return '<button class="chip' + (f === state.ticketFilter ? ' on' : '') + '" data-filter="' + f + '">' + f + '</button>';
      }).join('') + '</div></div>' +
      '<div class="tickets">' + page.map(ticketCard).join('') + '</div>' +
      fab('new-ticket', '', 'right:28px;bottom:117px') +
      pager(total, 20, state.ticketPage, 'ticket');
  };

  function ticketCard(t) {
    var lines = [];
    lines.push(['🚢', t.vessel]);
    lines.push(['📍', t.port]);
    if (t.berth) lines.push(['📅', 'ET Berth: ' + t.berth]);
    if (t.unberth) lines.push(['📅', 'ET Unberth: ' + t.unberth]);
    lines.push(['🕒', 'Created: ' + t.created]);
    lines.push(['👤', 'By: ' + t.by]);
    var meta = lines.map(function (l) { return '<div>' + emoji(l[0]) + esc(l[1]) + '</div>'; }).join('');
    if (t.files) meta += '<div class="gap">' + emoji('📎') + t.files + ' file' + (t.files > 1 ? 's' : '') + ' attached</div>';
    return '<div class="card ticket" data-go="tickets/' + t.id + '">' +
      '<div class="ticket-top"><span class="ticket-no">#' + t.id + '</span>' +
      '<span class="ticket-tags">' + (held(t) ? '<span class="tag" style="background:#f59e0b">' + CANCEL_REQ + '</span>' :
      '<span class="tag" style="background:' + (D.statusColors[t.status] || '#6c757d') + '">' + esc(t.status) + '</span>') + '</span></div>' +
      '<div class="ticket-meta">' + meta + '</div>' +
      (t.note ? '<div class="ticket-note">' + esc(t.note) + '</div>' : '') + '</div>';
  }

  views.ticket = function (id) {
    var t = id === 'new' ? null : myTickets().filter(function (x) { return x.id === id; })[0];
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
    var link = !editing && linkedCustomer();
    var customer = t.customer || (editing ? t.by : link ? link.label : user.name);
    var files = t.attachments || [];
    // DONE / NOT_VALID / CANCELLED are locked for everyone; only an admin override on the plan board reopens one.
    var closed = /^(Done|Not Valid|Cancelled)$/.test(t.status || '');
    return '<form class="box" data-form="ticket"' + (closed ? ' data-locked' : '') + '>' +
      (editing ? '<div class="box-title">' + (closed ? 'Ticket #' + t.id : 'Editing Ticket #' + t.id) + cancelButton(t) + '</div>' + cancelBanner(t) : '') +
      (closed ? '<div class="hold-banner lock-banner">' + emoji('🔒') + '<div><b>' + esc(t.status) + ' · read only</b><span>Closed tickets are locked. Only an admin can reopen one, from the plan board.</span></div></div>' : '') +
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
      '<span class="fld-label">5. Customer/Agent:</span><input class="fld-input" name="customer" value="' + esc(customer) + '" /></div>' + customerHint(link) + '</div>' +
      (link ? '<input type="hidden" name="customerId" value="' + esc(link.customer.id) + '" /><input type="hidden" name="agentId" value="' + esc(link.agent ? link.agent.id : '') + '" />' : '') +
      '<div class="fld" style="padding-top:10px;padding-bottom:10px"><div class="fld-row"><span class="fld-label">6. Attachments:</span></div>' +
      '<div class="attach">' + files.map(attachFile).join('') + (files.length ? '<div class="attach-line"></div>' : '') +
      '<button type="button" class="attach-btn" data-action="attach">' + I.clip + 'Attach files</button>' +
      '<input type="file" data-attach-input multiple hidden accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" /></div></div>' +
      servicesField(t) +
      (closed ? '' : '<button class="submit" type="submit">' + (editing ? 'Update Order' : 'Send New Order') + '</button>') +
      '</form>';
  }

  // A client never cancels directly: they ask, and the MOD / admin approves or rejects (D5).
  function cancelButton(t) {
    if (user.role !== 'CLIENT' || !/^(Pending|Confirmed|New Update)$/.test(t.status) || state.cancelReqs['t:' + t.id]) return '';
    return '<button type="button" class="hold-link cancel-link" data-action="cancel-request" data-arg="' + esc(t.id) + '">Request cancellation</button>';
  }

  function cancelBanner(t) {
    var c = state.cancelReqs['t:' + t.id];
    if (!c) return '';
    // §12: a MOD decides on a PENDING ticket only; cancelling a Confirmed / updated ticket is the admin's call.
    var byMod = t.status === 'Pending';
    var canDecide = user.role === 'ADMIN' || (user.role === 'MOD' && byMod);
    var decide = canDecide ? '<div class="cancel-acts"><button type="button" class="pill-btn primary" data-action="cancel-approve" data-arg="' + esc(t.id) + '">Approve</button>' +
      '<button type="button" class="pill-btn outline dark" data-action="cancel-reject" data-arg="' + esc(t.id) + '">Reject…</button></div>' : '';
    return '<div class="hold-banner cancel-banner">' + emoji('✋') + '<div><b>Client asked to cancel · waiting for ' + (byMod ? 'the MOD' : 'an admin') + '</b><span>Reason: ' + esc(c.reason) + ' · ' + esc(heldFor(c.at).replace('held', 'sent')) + ' ago</span>' + decide + '</div></div>';
  }

  // P1: a client account linked to a customer gets its customer and default agent filled in on a new ticket.
  function linkedCustomer() {
    if (user.role !== 'CLIENT') return null;
    var customers = store('customers', D.customers);
    var c = customers.filter(function (x) { return (x.accounts || []).indexOf(user.email) >= 0; })[0];
    if (!c) return null;
    var agents = store('agents', D.agents);
    var def = c.defaultAgent && (c.agents || []).indexOf(c.defaultAgent) >= 0 ? c.defaultAgent : (c.agents || [])[0];
    var a = agents.filter(function (x) { return x.id === def; })[0];
    return { customer: c, agent: a, label: c.name + (a ? ' / ' + a.name : '') };
  }
  function customerHint(link) {
    if (user.role !== 'CLIENT') return '';
    link = link || linkedCustomer();
    if (!link) return '<p class="cust-hint">Your account is not linked to a customer yet; the accountant fills it in.</p>';
    return '<p class="cust-hint">Linked customer: <b>' + esc(link.customer.name) + '</b>' + (link.agent ? ' · default agent ' + esc(link.agent.name) : '') + '</p>';
  }

  // One attachment row. The file's details ride on data-* so the form saves exactly the rows shown.
  function attachFile(f) {
    return '<div class="attach-file" data-file-name="' + esc(f.name) + '" data-file-size="' + esc(f.size) + '" data-file-by="' + esc(f.by) + '">' +
      '<span class="attach-clip">' + I.clip + '</span><span class="attach-name"><b>' + esc(f.name) + '</b><span>' +
      esc(f.size) + ' · By ' + esc(f.by) + '</span></span><span class="attach-more" data-action="attach-remove">' + I.more + '</span></div>';
  }
  function fileSize(n) {
    return n < 1024 ? n + ' B' : n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
  }

  function ticketById(id) {
    return state.tickets.filter(function (x) { return x.id === id; })[0];
  }

  function heldFor(at) {
    var mins = Math.max(1, Math.round((Date.now() - at) / 60000));
    if (mins < 60) return 'held ' + mins + ' min';
    var h = Math.round(mins / 60);
    return h < 24 ? 'held ' + h + ' h' : 'held ' + Math.round(h / 24) + ' days';
  }

  // Service selection: at least one, nothing pre-selected (B24).
  function servicesField(t) {
    // A new ticket starts empty; an existing one shows what it already has (its saved pick, or for the cloned
    // tickets, which carry no service list, Mano in plus Mano out when it has an unberth time).
    var chosen = state.ticketServices[t.id || 'new'] || (t.id ? t.services || ['mano_in'].concat(t.unberth ? ['mano_out'] : []) : []);
    return '<div class="fld fld-services" data-services-for="' + esc(t.id || 'new') + '"><div class="fld-row"><span class="fld-label">7. Services<span class="req">*</span>:</span></div>' +
      '<div class="svc-chips">' + D.services.map(function (sv) {
        var on = chosen.indexOf(sv.code) >= 0;
        return '<button type="button" class="svc-chip' + (on ? ' on' : '') + '" data-svc="' + sv.code + '"><i style="background:' + sv.color + ';border-color:' + sv.border + '"></i>' + esc(sv.name) + '</button>';
      }).join('') + '</div><div class="svc-error" hidden>Choose at least one service</div></div>';
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
    var set = state.settings;
    // Each icon opens the app for that number: phone dialer, Zalo, WhatsApp.
    var digits = function (tel) { return String(tel || '').replace(/[^0-9]/g, ''); };
    var link = function (kind, tel, inner, cls) {
      var href = kind === 'phone' ? 'tel:' + tel : kind === 'zalo' ? 'https://zalo.me/' + digits(tel).replace(/^84/, '0') : 'https://wa.me/' + digits(tel);
      return '<a class="' + cls + '" href="' + esc(href) + '"' + (kind === 'phone' ? '' : ' target="_blank" rel="noopener"') + '>' + inner + '</a>';
    };
    function pair(label, tel) {
      return '<div class="c-row">' + link('zalo', tel, '<img src="assets/zalo.png" alt="Zalo" /><span>' + esc(label.zalo) + '</span>', 'c-item') +
        link('whatsapp', tel, '<img src="assets/whatsapp.png" alt="WhatsApp" /><span>' + esc(label.whatsapp) + '</span>', 'c-item') + '</div>';
    }
    return '<div class="contact-pane">' +
      '<div class="c-block">' + link('phone', set.hotline, 'Hotline:\n' + esc(set.hotline), 'c-pill hot') + pair(c.hotline, set.hotline) + '</div>' +
      '<div class="c-block">' + link('phone', set.tugDuty, esc(c.tugDuty.label), 'c-pill') + pair(c.tugDuty, set.tugDuty) + '</div>' +
      '<div class="c-block list"><span class="c-pill blue">Contact List</span>' +
      people.map(function (p) {
        return '<div class="c-name">' + esc(p.name) + '</div><div class="c-icons">' +
          link('phone', p.tel, '<img src="assets/phone.png" alt="Phone" />', 'c-ic') + link('zalo', p.tel, '<img src="assets/zalo.png" alt="Zalo" />', 'c-ic') +
          link('whatsapp', p.tel, '<img src="assets/whatsapp.png" alt="WhatsApp" />', 'c-ic') + '</div>';
      }).join('') +
      '<button class="c-more" data-action="more-contacts">' + (state.showAllContacts ? 'Show less' : 'Show more (' + hidden + ')') + '</button></div></div>';
  }

  // A closed ticket (Done / Not Valid / Cancelled) is locked for everyone, comments included; a ticket that is
  // not created yet has nothing to comment on.
  function commentPane(id) {
    var list = state.comments[id] || [];
    var t = id && id !== 'new' ? ticketById(id) : null;
    var locked = !t ? 'Comments open once the order is sent.' : /^(Done|Not Valid|Cancelled)$/.test(t.status) ? 'This ticket is closed · comments are locked.' : '';
    return '<div class="comment-pane"><div class="comment-head"><h4>Comments</h4><button data-action="refresh-comments" aria-label="Refresh">' + I.refresh + '</button></div>' +
      (list.length ? '<div class="comment-list">' + list.map(function (c) {
        return '<div class="comment-item"><b>' + esc(c.by) + '</b> <span>' + esc(c.at) + '</span><p>' + esc(c.text) + '</p></div>';
      }).join('') + '</div>' : '<div class="comment-empty">No comments yet</div>') +
      (locked ? '<p class="comment-locked">' + emoji('🔒') + esc(locked) + '</p></div>' :
        '<input class="comment-input" data-comment placeholder="Write a comment..." />' +
        '<button class="comment-btn" data-action="comment">Comment</button></div>');
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
      (allowed('admin') ? '<button class="nav-btn" data-go="admin">' + I.shield + 'Admin Panel</button>' : '') + '</div>' +
      '<button class="logout-btn" data-action="logout">' + I.logout + 'Logout</button>';
  };

  views.notifications = function () {
    var unread = unreadCount();
    return header({ noBell: true }) +
      '<div class="notif-strip"><span>' + unread + ' unread notifications</span><button data-action="read-all">Mark all as read</button></div>' +
      '<div class="page" style="padding-top:15px;padding-bottom:130px">' + notifPage().map(function (i) {
        var n = state.notifs[i];
        return '<div class="notif' + (n.read ? ' read' : '') + '" data-notif="' + i + '">' + emoji(n.icon) +
          '<div class="notif-body"><h4>' + esc(n.title) + '</h4>' + n.lines.map(function (l) { return '<div>' + esc(l) + '</div>'; }).join('') +
          '<div class="notif-foot"><span>' + esc(n.time) + '</span><button data-del-notif="' + i + '">Delete</button></div></div></div>';
      }).join('') + (state.notifs.some(seesNotif) ? '' : '<p class="notif-empty">No notifications yet</p>') + '</div>' +
      pager(state.notifs.filter(seesNotif).length, 20, state.notifPage, 'notif');
  };

  // Indexes (into state.notifs) of the notifications on the current page, for this role.
  function notifPage() {
    var mine = [];
    state.notifs.forEach(function (n, i) { if (seesNotif(n)) mine.push(i); });
    state.notifPage = Math.min(state.notifPage, Math.max(1, Math.ceil(mine.length / 20)));
    return mine.slice((state.notifPage - 1) * 20, state.notifPage * 20);
  }

  // Admin hub: tools grouped by area, each row showing how many records it holds.
  views.admin = function () {
    var count = {
      'admin/users': state.users.length, 'admin/user-requests': state.requests.length,
      'admin/contact-persons': state.persons.length, 'admin/vessels': state.vessels.length,
      'admin/tugboats': state.tugboats.length, 'admin/ports': state.ports.length,
      'admin/locations': state.locations.length, 'admin/stickers': state.stickers.length,
      'admin/export-tickets': state.files.length, 'admin/services': (D.services || []).length
    };
    var pending = state.requests.length;
    var active = state.users.filter(function (u) { return u.status === 'ACTIVE'; }).length;
    var stats = [[active, 'Active users', 'admin/users'], [state.vessels.length, 'Vessels', 'admin/vessels'], [state.tugboats.length, 'Tugboats', 'admin/tugboats']];
    var groups = D.adminGroups.map(function (g) {
      var rows = D.admin.filter(function (a) { return a.group === g.key && matches(a.title + ' ' + a.sub); });
      if (!rows.length) return '';
      return '<h3 class="adm-group">' + esc(g.label) + '</h3><div class="adm-list">' + rows.map(function (a) {
        var n = count[a.route];
        var alert = a.route === 'admin/user-requests' && pending;
        return '<button class="adm-row" data-go="' + a.route + '">' +
          '<span class="adm-tile" style="background:' + a.tile + '">' + emoji(a.icon) + '</span>' +
          '<span class="adm-text"><b>' + esc(a.title) + '</b><small>' + esc(a.sub) + '</small></span>' +
          (n == null ? '' : '<span class="adm-count' + (alert ? ' alert' : '') + '">' + n + '</span>') + I.right + '</button>';
      }).join('') + '</div>';
    }).join('');
    return header({ logo: true }) + '<div class="page adm"><div class="admin-head"><p class="section-sub">Manage system data and settings</p></div>' +
      '<div class="adm-stats">' + stats.map(function (s) {
        return '<button data-go="' + s[2] + '"><b>' + s[0] + '</b><span>' + s[1] + '</span></button>';
      }).join('') + '</div>' +
      (pending ? '<button class="adm-alert" data-go="admin/user-requests">' + emoji('📝') +
        '<span><b>' + pending + ' access request' + (pending > 1 ? 's' : '') + ' waiting</b><small>Review and approve new users</small></span>' + I.right + '</button>' : '') +
      search('Search admin tools', 'adm-search') +
      (groups || '<p class="adm-empty">No admin tool matches “' + esc(state.search) + '”.</p>') + '</div>';
  };

  views['admin/users'] = function () {
    var list = state.users.filter(function (u) {
      return (state.userTab === 'ALL' || u.status === state.userTab) && matches(u.name + ' ' + u.email);
    });
    if (manageTable()) {
      return deskPage('User Management', 'Manage users, roles, and permissions', dataTable({
        source: state.users, list: list, noun: 'user', placeholder: 'Search by name or email',
        add: { action: 'new-user', label: 'Add user' },
        tools: '<div class="dt-chips">' + ['ACTIVE', 'BANNED', 'ALL'].map(function (s) {
          return '<button class="' + (s === state.userTab ? 'on' : '') + '" data-usertab="' + s + '">' + s + '</button>';
        }).join('') + '</div>',
        cols: [
          { key: 'name', label: 'Name', sort: 'text', cell: function (u) { return '<b>' + esc(u.name) + '</b>'; } },
          { key: 'email', label: 'Email', sort: 'text' },
          // The app prints N/A for a missing phone or company, so the table does too.
          { key: 'phone', label: 'Phone', sort: 'text', cell: function (u) { return esc(u.phone || 'N/A'); } },
          { key: 'company', label: 'Company', sort: 'text', cell: function (u) { return esc(u.company || 'N/A'); } },
          { key: 'role', label: 'Role', sort: 'text', cell: function (u) { return pill(u.role, D.roleColors[u.role] || '#4caf50'); } },
          { key: 'status', label: 'Status', sort: 'text', cell: function (u) { return '<span class="dt-status ' + (u.status === 'ACTIVE' ? 'ok' : '') + '">' + esc(u.status) + '</span>'; } }
        ],
        actions: function (u, i) { return btn('', 'data-edit-user="' + i + '"', 'Edit') + btn('danger', 'data-del="users:' + i + '"', 'Delete'); }
      }));
    }
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
      '<label class="field-label" style="margin-top:3px">Phone</label><input class="text-input" name="phone" value="' + esc(u.phone && u.phone !== 'N/A' ? u.phone : '') + '" />' +
      '<label class="field-label">Company</label><input class="text-input" name="company" value="' + esc(u.company && u.company !== 'N/A' ? u.company : '') + '" />' +
      '<label class="field-label" style="margin-top:14px">Role *</label><input type="hidden" name="role" value="' + role + '" />' +
      '<div class="role-seg many">' + D.roles.map(function (r) {
        return '<button type="button" class="' + (r.key === role ? 'on' : '') + '" data-role="' + r.key + '">' + esc(r.label) + '</button>';
      }).join('') + '</div>' +
      // Status only when editing: a new account starts ACTIVE; BANNED blocks sign-in.
      (editIndex != null ? '<label class="field-label" style="margin-top:14px">Status *</label><input type="hidden" name="status" value="' + esc(u.status || 'ACTIVE') + '" />' +
        '<div class="role-seg">' + ['ACTIVE', 'BANNED'].map(function (st) {
          return '<button type="button" class="' + (st === (u.status || 'ACTIVE') ? 'on' : '') + '" data-ustatus="' + st + '">' + (st === 'ACTIVE' ? 'Active' : 'Banned') + '</button>';
        }).join('') + '</div>' + (api.boardDefaultsField ? api.boardDefaultsField(u) : '') : '') +
      '<button class="sheet-submit" type="submit">' + (editIndex != null ? 'Save Changes' : 'Create User') + '</button></form></div>';
  };

  views['admin/vessels'] = function () {
    var list = state.vessels.filter(function (v) { return matches(v.name); });
    if (manageTable()) {
      return deskPage('Vessel Management', 'Manage vessel master data', dataTable({
        source: state.vessels, list: list, noun: 'vessel', placeholder: 'Search vessels by name...',
        add: { action: 'new-vessel', label: 'Add vessel' },
        cols: [
          { key: 'name', label: 'Vessel', sort: 'text', cell: function (v) { return '<b>' + esc(v.name) + '</b>'; } },
          { key: 'grt', label: 'GRT', sort: 'number', cls: 'num' },
          { key: 'dwt', label: 'DWT', sort: 'number', cls: 'num' },
          { key: 'loa', label: 'LOA', sort: 'number', cls: 'num' }
        ],
        actions: function (v, i) { return btn('', 'data-edit-vessel="' + i + '"', 'Edit') + btn('danger', 'data-del="vessels:' + i + '"', 'Delete'); }
      }));
    }
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
    if (manageTable()) {
      return deskPage('Port Management', 'Manage port and berth data', dataTable({
        source: state.ports, list: list, noun: 'port', placeholder: 'Search by port or berth name...',
        add: { action: 'new-port', label: 'Add port' },
        cols: [
          { key: 'name', label: 'Port', sort: 'text', cell: function (p) { return '<b>' + esc(p.name) + '</b>'; } },
          { key: 'berth', label: 'Berth', sort: 'text' },
          { key: 'location', label: 'Location', sort: 'text' }
        ],
        actions: function (p, i) { return btn('', 'data-edit-port="' + i + '"', 'Edit') + btn('danger', 'data-del="ports:' + i + '"', 'Delete'); }
      }));
    }
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
    if (manageTable()) {
      return deskPage('User Requests', 'Upon approval, credentials will be sent to the user\'s email automatically.', dataTable({
        source: state.requests, list: list, noun: 'request', placeholder: 'Search by email or name...',
        empty: 'No pending access requests', sort: ['requested', -1],
        cols: [
          { key: 'name', label: 'Name', sort: 'text', cell: function (r) { return '<b>' + esc(r.name) + '</b>'; } },
          { key: 'email', label: 'Email', sort: 'text' },
          { key: 'phone', label: 'Phone', sort: 'text' },
          { key: 'company', label: 'Company', sort: 'text' },
          { key: 'requested', label: 'Requested', sort: 'date' },
          { key: 'status', label: 'Status', cell: function () { return '<span class="dt-status wait">PENDING</span>'; } }
        ],
        actions: function (r, i) { return btn('success', 'data-request="approve:' + i + '"', 'Approve') + btn('danger', 'data-request="reject:' + i + '"', 'Reject'); }
      }));
    }
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

  function orderedList(key, lead, placeholder, fabAction, desktop) {
    var list = state[key].filter(function (x) { return matches(x.name); });
    if (manageTable()) {
      return deskPage(desktop.title, desktop.sub, dataTable({
        source: state[key], list: list, noun: desktop.noun, placeholder: placeholder, sort: ['order', 1],
        add: { action: fabAction, label: 'Add ' + desktop.noun },
        cols: [
          { key: 'order', label: 'Order', sort: 'number', cls: 'num narrow' },
          { key: 'name', label: desktop.label, sort: 'text', cell: function (x) { return emoji(lead) + ' <b>' + esc(x.name) + '</b>'; } }
        ],
        actions: function (x, i) { return btn('', 'data-edit="' + key + ':' + i + '"', 'Edit') + btn('danger', 'data-del="' + key + ':' + i + '"', 'Delete'); }
      }));
    }
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
    return orderedList('locations', '📍', 'Search by location name...', 'new-location',
      { title: 'Location Management', sub: 'Manage tugboat home locations', noun: 'location', label: 'Location' });
  };

  views['admin/contact-persons'] = function () {
    return orderedList('persons', '👤', 'Search by name...', 'new-person',
      { title: 'Contact Person Management', sub: 'Manage contact persons for ticket confirmation', noun: 'contact person', label: 'Contact person' });
  };

  views['admin/stickers'] = function () {
    var list = state.stickers.filter(function (x) { return matches(x.name); });
    if (manageTable()) {
      return deskPage('Sticker Management', 'Manage signatures and stamps for attachment editing', dataTable({
        source: state.stickers, list: list, noun: 'sticker', placeholder: 'Search by name...', sort: ['order', 1],
        add: { action: 'new-sticker', label: 'Add sticker' },
        cols: [
          { key: 'order', label: 'Order', sort: 'number', cls: 'num narrow' },
          { key: 'img', label: 'Image', cell: function (x) { return '<span class="dt-thumb">' + (x.img ? '<img src="' + esc(x.img) + '" alt="" />' : '') + '</span>'; } },
          { key: 'name', label: 'Sticker', sort: 'text', cell: function (x) { return '<b>' + esc(x.name) + '</b>'; } }
        ],
        actions: function (x, i) { return btn('', 'data-edit="stickers:' + i + '"', 'Edit') + btn('danger', 'data-del="stickers:' + i + '"', 'Delete'); }
      }));
    }
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
    if (manageTable()) {
      var unit = function (key, u) { return function (x) { return x[key] === '' || x[key] == null ? dash('') : esc(Number(x[key]) + ' ' + u); }; };
      return deskPage('Tugboat Management', 'Manage tugboat fleet and specifications', dataTable({
        source: state.tugboats, list: list, noun: 'tugboat', placeholder: 'Search tugboats by name...', sort: ['order', 1],
        add: { action: 'new-tugboat', label: 'Add tugboat' },
        tools: '<div class="dt-links"><button data-action="assign-locations">' + I.assign + 'Assign locations</button>' +
          '<button data-go="admin/locations">' + I.pin + 'Manage locations</button></div>',
        cols: [
          { key: 'order', label: 'Order', sort: 'number', cls: 'num narrow' },
          { key: 'img', label: '', cell: function (x) { return '<span class="dt-thumb wide">' + (x.img ? '<img src="' + esc(x.img) + '" alt="" />' : emoji('⚓')) + '</span>'; } },
          { key: 'name', label: 'Tugboat', sort: 'text', cell: function (x) { return '<b>' + esc(x.name) + '</b>'; } },
          { key: 'code', label: 'Code', sort: 'text', cell: function (x) { return dash(x.code); } },
          { key: 'location', label: 'Location', sort: 'text' },
          { key: 'size', label: 'Size', sort: 'text', cls: 'center' },
          { key: 'hp', label: 'Main engines', sort: 'number', cls: 'num' },
          { key: 'length', label: 'Length', sort: 'number', cls: 'num', cell: unit('length', 'm') },
          { key: 'breadth', label: 'Breadth', sort: 'number', cls: 'num', cell: unit('breadth', 'm') },
          { key: 'draft', label: 'Draft', sort: 'number', cls: 'num', cell: unit('draft', 'm') },
          { key: 'bollard', label: 'Bollard pull', sort: 'number', cls: 'num', cell: unit('bollard', 'T') },
          { key: 'gt', label: 'GRT', sort: 'number', cls: 'num', cell: unit('gt', 'GT') },
          { key: 'propeller', label: 'Propeller', sort: 'text' }
        ],
        actions: function (x, i) { return btn('', 'data-edit-tug="' + i + '"', 'Edit') + btn('danger', 'data-del="tugboats:' + i + '"', 'Delete'); }
      }));
    }
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
    return header() + '<div class="page' + (desk() ? ' dt-page' : '') + '"><div>' +
      '<p class="section-sub">Generate ticket reports by date range</p></div>' +
      '<div class="card export-card"><label>Start date</label><div class="date-input"><span>30/08/2026</span>' + I.cal + '</div>' +
      '<label>End date</label><div class="date-input"><span>29/09/2026</span>' + I.cal + '</div>' +
      '<label>Service type</label><div class="date-input disabled"><span>Towage</span></div>' +
      '<label style="margin-top:13px">Columns</label><div class="col-chips">' + D.exportColumns.map(function (c) {
        var on = state.exportCols.indexOf(c) >= 0;
        return '<button class="col-chip' + (on ? '' : ' off') + '" data-col="' + esc(c) + '">' + I.check + esc(c) + '</button>';
      }).join('') + '</div>' +
      '<button class="gen-btn" data-action="generate">' + I.fileXls + 'Generate Excel</button></div>' +
      // The file list is a management table at every width (A1), like the other admin lists.
      '<h3 class="files-title">Generated files (' + state.files.length + ')</h3>' + (manageTable() ? dataTable({
        source: state.files, list: state.files.filter(function (f) { return matches(f.name + ' ' + f.by); }),
        noun: 'file', placeholder: 'Search files...', sort: ['at', -1],
        cols: [
          { key: 'name', label: 'File', sort: 'text', cell: function (f) { return '<span class="dt-file">' + I.xls + '<b>' + esc(f.name) + '</b></span>'; } },
          { key: 'size', label: 'Size', sort: 'number', cls: 'num' },
          { key: 'by', label: 'Generated by', sort: 'text' },
          { key: 'at', label: 'Generated at', sort: 'datetime' }
        ],
        // Icon + label; on a phone only the icon shows (.dt-lbl), so the frozen action column stays narrow.
        actions: function (f, i) { return btn('', 'data-action="download" aria-label="Download"', I.download + '<span class="dt-lbl">Download</span>') + btn('danger', 'data-del="files:' + i + '" aria-label="Delete"', I.trash + '<span class="dt-lbl">Delete</span>'); }
      }) : '<div class="list">' + state.files.map(function (f, i) {
        return '<div class="card file-card"><span class="xls">' + I.xls + '</span><div class="main"><h4>' + esc(f.name) + '</h4>' +
          '<p>' + esc(f.size) + ' · ' + esc(f.by) + ' · ' + esc(f.at) + '</p><div class="actions">' +
          '<button class="pill-btn outline" data-action="download">' + I.download + 'Download</button>' +
          '<button class="pill-btn danger" data-del="files:' + i + '">' + I.trash + 'Delete</button></div></div></div>';
      }).join('') + '</div>') + '</div>';
  };

  // A1: system-wide settings, one card; Edit opens the usual dialog. Hotline / tug duty feed Contact us.
  var SETTINGS = [
    ['company', 'Company name'], ['hotline', 'Hotline number'], ['tugDuty', 'Tug duty 24/7 number'], ['timezone', 'Time zone'],
    ['currency', 'Default currency'], ['exportTime', 'Daily ledger export (cron)'], ['retention', 'Keep export files (months)'], ['push', 'Push notifications']
  ];
  views['admin/settings'] = function () {
    var v = state.settings;
    var show = function (k) { return k === 'push' ? (v.push ? 'On' : 'Off') : esc(String(v[k] == null ? '' : v[k])); };
    return header() + '<div class="page"><p class="section-sub">Settings shared by every user and screen.</p>' +
      '<div class="card set-card">' + SETTINGS.map(function (x) {
        return '<div class="set-row"><span>' + esc(x[1]) + '</span><b>' + show(x[0]) + '</b></div>';
      }).join('') + '<button class="pill-btn primary block" data-action="settings-edit">Edit settings</button></div></div>';
  };
  function editSettings() {
    editDialog({
      title: 'System settings',
      values: state.settings,
      fields: [
        { name: 'company', label: 'Company name', req: true },
        { name: 'hotline', label: 'Hotline number', req: true, half: true },
        { name: 'tugDuty', label: 'Tug duty 24/7 number', req: true, half: true },
        { name: 'timezone', label: 'Time zone', type: 'select', options: [{ value: 'GMT+7 (Ho Chi Minh)', label: 'GMT+7 (Ho Chi Minh)' }] },
        { name: 'currency', label: 'Default currency', type: 'select', half: true, options: [{ value: 'VND', label: 'VND' }, { value: 'USD', label: 'USD' }] },
        { name: 'exportTime', label: 'Daily ledger export (hh:mm)', req: true, half: true },
        { name: 'retention', label: 'Keep export files (months)', type: 'number', req: true, half: true },
        { name: 'push', label: 'Send push notifications', type: 'checkbox' }
      ],
      onSave: function (x) {
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(x.exportTime)) return { error: 'Export time must be hh:mm, e.g. 00:30.' };
        var months = Number(x.retention);
        if (!months || months < 1 || months % 1) return { error: 'Keep files for a whole number of months.' };
        state.settings = Object.assign({}, state.settings, x, { retention: months });
        save('settings', state.settings);
        render();
        toast('Settings saved');
      }
    });
  }

  views['admin/contact-stats'] = function () {
    var s = D.stats;
    var max = 0;
    s.days.forEach(function (d) { max = Math.max(max, d[1] + d[2] + d[3]); });
    var unit = 144 / max;
    var bars = s.days.map(function (d) {
      var h = function (n, c) { return n ? '<i style="height:' + (n * unit) + 'px;background:' + c + '"></i>' : ''; };
      return '<div class="chart-col"><div class="chart-bar">' + h(d[3], '#16a34a') + h(d[2], '#1e90ff') + h(d[1], '#dc143c') + '</div></div>';
    }).join('');
    return header() + '<div class="page"><div>' +
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

  // Demo only: which role to view the app as. It cannot be dismissed; picking one opens that role's home.
  function openRolePicker() {
    if (overlay && overlay.kind === 'role') return;
    var wrap = openOverlay('<div class="mask light"></div><div class="dialog role-pick" role="dialog" aria-modal="true" aria-labelledby="role-pick-t">' +
      '<h3 id="role-pick-t">Choose a role</h3><p class="dlg-text">Demo only. Screens, menus and actions follow the role you pick; switch any time from ' + (desk() ? 'the DEMO tag at the top' : 'the menu') + '.</p>' +
      '<div class="role-list">' + D.roles.map(function (r) {
        return '<button type="button" class="role-opt" data-pick-role="' + r.key + '"><span class="role" style="background:' + (D.roleColors[r.key] || '#6b7280') + '">' + esc(r.key.replace(/_/g, ' ')) + '</span>' +
          '<b>' + esc(r.label) + '</b><small>' + esc(r.sub) + '</small></button>';
      }).join('') + '</div></div>', 'role', '#a8a8a8');
    var dlg = wrap.querySelector('.dialog');
    dlg.style.top = Math.max(24, (window.innerHeight - dlg.offsetHeight) / 2) + 'px';
  }

  // The drawer's menu, which is also the desktop sidebar: [emoji, label, route], filtered by role.
  function navItems() {
    return [['🎫', 'All Tickets', 'tickets'], ['🗓️', 'Plan Board', 'board'], ['🗂️', 'History', 'history'], ['📒', 'Ledger', 'ledger'], ['👤', 'Profile', 'profile'], ['🔔', 'Notifications', 'notifications'], ['⚙️', 'Admin Panel', 'admin']]
      .filter(function (it) { return allowed(it[2]); });
  }

  // A role without the Admin Panel still gets the admin tables its routes allow (accountants: customers, agents,
  // tax codes, prices, rates, discounts, split rules), listed in the menu by permission: [emoji, label, route].
  function tableItems() {
    if (allowed('admin')) return [];
    return D.admin.filter(function (a) { return /^admin\//.test(a.route) && allowed(a.route); }).map(function (a) { return [a.icon, a.title, a.route]; });
  }

  function navOn(route, it) {
    if (it[2] === 'admin/currencies' && route === 'admin/fx-rates') return true;
    return route === it[2] || (it[2] === 'tickets' && /^tickets/.test(route)) || (it[2] === 'admin' && /^admin/.test(route)) ||
      (it[2] === 'ledger' && /^ledger/.test(route));
  }

  // ---------- desktop shell (desk() only; the phone keeps its header + drawer) ----------

  function deskSide() {
    var route = currentRoute();
    var tables = tableItems();
    var admin = /^admin/.test(route) ? D.adminGroups.map(function (g) {
      var rows = D.admin.filter(function (a) { return a.group === g.key && allowed(a.route); });
      if (!rows.length) return '';
      var here = rows.some(function (a) { return route === a.route || route.indexOf(a.route + '/') === 0; });
      return '<div class="dk-sub-h' + (here ? ' on' : '') + '">' + esc(g.label) + '</div>' + rows.map(function (a) {
        return '<a class="dk-sub' + (route === a.route || route.indexOf(a.route + '/') === 0 ? ' on' : '') + '" data-go="' + esc(a.route) + '">' + esc(a.title) + '</a>';
      }).join('');
    }).join('') : '';
    return '<aside class="dk-side">' +
      '<div class="dk-brand" data-go="' + homeRoute() + '"><img src="assets/appicon.png" alt="HVS Group" /><span>Order &amp; Update</span></div>' +
      '<nav class="dk-nav">' + navItems().map(function (it) {
        var on = navOn(route, it);
        return '<a class="dk-item' + (on ? ' on' : '') + '" data-go="' + it[2] + '">' + emoji(it[0]) + '<span>' + it[1] + '</span></a>' +
          (it[2] === 'admin' && admin ? '<div class="dk-subs">' + admin + '</div>' : '');
      }).join('') + (tables.length ? '<div class="dk-subs dk-tables"><div class="dk-sub-h' + (tables.some(function (it) { return navOn(route, it); }) ? ' on' : '') + '">Ledger tables</div>' + tables.map(function (it) {
        return '<a class="dk-sub' + (navOn(route, it) ? ' on' : '') + '" data-go="' + esc(it[2]) + '">' + esc(it[1]) + '</a>';
      }).join('') + '</div>' : '') + '</nav>' +
      '<div class="dk-foot">' +
      '<div class="dk-user"><div class="avatar">' + esc(initials(user.name)) + '</div>' +
      '<div class="dk-user-id"><b>' + esc(user.name) + '</b><small>' + esc(user.email) + '</small>' +
      '<span class="role" style="background:' + (D.roleColors[user.role] || '#6b7280') + '">' + esc(String(user.role).replace(/_/g, ' ')) + '</span></div>' +
      '<button class="dk-logout" data-action="logout" title="Logout" aria-label="Logout">' + I.logout + '</button></div></div></aside>';
  }

  // Demo-only role switch, kept apart from the app's own menu (a ribbon hanging from the top edge)
  // so a client reviewing the design doesn't read it as a product feature.
  function deskDemo() {
    var r = roleOf(user.role);
    return '<button type="button" class="dk-demo" data-action="switch-role" title="Demo only: not part of the app">' +
      '<b>DEMO</b><span>Viewing as ' + esc(r ? r.label : user.role) + '</span><em>Switch role</em></button>';
  }

  function deskTop(opts) {
    var route = currentRoute();
    var top = navItems().some(function (it) { return it[2] === route; });
    var parent = navItems().filter(function (it) { return !top && navOn(route, it); })[0];
    var crumb = parent ? '<a data-go="' + parent[2] + '">' + esc(parent[1]) + '</a><i>/</i>' : '';
    return '<header class="dk-top">' +
      (top || opts.logo ? '' : '<button class="dk-back" data-action="back" aria-label="Back">' + I.back + '</button>') +
      '<div class="dk-title">' + (crumb ? '<div class="dk-crumb">' + crumb + '<span>' + esc(opts.title || screenTitle()) + '</span></div>' : '') +
      '<h1>' + esc(opts.title || screenTitle()) + '</h1></div>' +
      '<div class="dk-top-r"><button type="button" class="dk-view" data-action="view-mobile" title="Open the same screen in the mobile design">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6.5" y="2.5" width="11" height="19" rx="2" /><path d="M11 18.5h2" /></svg>Mobile design</button>' +
      (opts.noBell ? '' : '<button class="dk-bell" data-go="notifications" aria-label="Notifications">' + I.bell + bellBadge() + '</button>') +
      '<div class="avatar sm" title="' + esc(user.name) + '" data-go="profile">' + esc(initials(user.name)) + '</div></div></header>';
  }

  function openDrawer() {
    var route = currentRoute();
    var items = navItems();
    openOverlay('<div class="mask" data-action="close"></div><aside class="drawer">' +
      '<div class="drawer-head"><div class="avatar">' + esc(initials(user.name)) + '</div><h3>' + esc(user.name) + '</h3><p>' + esc(user.email) + '</p>' +
      '<span class="role-badge">' + esc(user.role || 'ADMIN') + '</span></div><div class="drawer-sep"></div>' +
      items.map(function (it) {
        var on = route === it[2] || (it[2] === 'tickets' && /^tickets/.test(route)) || (it[2] === 'admin' && /^admin/.test(route));
        return '<div class="drawer-item' + (on ? ' on' : '') + '" data-go="' + it[2] + '">' + emoji(it[0]) + it[1] + '</div>';
      }).join('') + (tableItems().length ? '<div class="drawer-sep"></div><div class="drawer-h">Ledger tables</div>' + tableItems().map(function (it) {
        return '<div class="drawer-item' + (navOn(route, it) ? ' on' : '') + '" data-go="' + it[2] + '">' + emoji(it[0]) + it[1] + '</div>';
      }).join('') : '') + '<div class="drawer-sep"></div>' +
      '<div class="drawer-item" data-action="switch-role">' + emoji('🔁') + 'Switch role (demo)</div>' +
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

  // Locations and contact persons share one ordered-list dialog (the live app showed "Location" on both).
  function editOrdered(key, index) {
    var x = index == null ? { name: '', order: state[key].length + 1 } : state[key][index];
    var isNew = index == null;
    var noun = key === 'persons' ? 'Contact Person' : 'Location';
    formDialog(isNew ? 'Add New ' + noun : 'Edit ' + noun, [
      { label: noun + ' Name', name: 'name', value: x.name, required: true },
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
    var picked = ''; // a newly chosen image; empty keeps the current one
    var thumb = '<div class="sticker-edit"><span class="thumb">' + (x.img ? '<img src="' + x.img + '" alt="" />' : '') + '</span>' +
      '<div class="main"><button type="button" class="pill-btn" data-sticker-pick>' + (isNew ? 'Choose image' : 'Replace image') + '</button>' +
      '<p>' + (isNew ? 'PNG or JPG, transparent background works best' : 'Leave empty to keep the current image') + '</p></div></div>';
    formDialog(isNew ? 'Add New Sticker' : 'Edit Sticker', [{ label: 'Sticker Name', name: 'name', value: x.name, required: true }], isNew ? 'Create' : 'Save', function (v) {
      var item = { name: v.name, order: Number(v.order) || 0 };
      if (picked) item.img = picked;
      if (isNew) state.stickers.push(Object.assign({ img: '' }, item)); else Object.assign(state.stickers[index], item);
      state.stickers.sort(function (a, b) { return a.order - b.order; });
      save('stickers', state.stickers);
    });
    // Sticker dialog order: name, image, order.
    var dlg = overlayRoot.querySelector('.dialog');
    dlg.querySelector('.actions').insertAdjacentHTML('beforebegin',
      '<label class="field-label" style="margin-top:11px">Order</label><input class="text-input" name="order" inputmode="numeric" value="' + esc(x.order) + '" />');
    dlg.querySelector('.text-input').insertAdjacentHTML('afterend', thumb);
    dlg.querySelector('[data-sticker-pick]').addEventListener('click', function (e) {
      pickImage(false, function (src) {
        picked = src;
        dlg.querySelector('.sticker-edit .thumb').innerHTML = '<img src="' + src + '" alt="" />';
        e.target.textContent = 'Replace image';
      });
    });
    dlg.style.top = Math.max(60, (window.innerHeight - dlg.offsetHeight) / 2 - 20) + 'px';
  }

  function addPort() { editPort(null); }

  function editPort(index) {
    var isNew = index == null;
    var x = isNew ? {} : state.ports[index];
    formDialog(isNew ? 'Add New Port' : 'Edit Port', [
      { label: 'Port Name', name: 'name', value: x.name, required: true },
      { label: 'Berth Name (Optional)', name: 'berth', value: x.berth },
      { label: 'Location (Optional)', name: 'location', value: x.location }
    ], isNew ? 'Create' : 'Save', function (v) {
      var item = { name: v.name, berth: v.berth, location: v.location };
      if (isNew) state.ports.push(item); else Object.assign(state.ports[index], item);
      save('ports', state.ports);
      if (!isNew) toast('Port updated');
    });
  }

  // Vessels are stored formatted ('4,998.10', '94.25 m'); the form edits the plain numbers and saves the whole record.
  function editVessel(index) {
    var x = state.vessels[index];
    var plain = function (val) { return String(val == null ? '' : val).replace(/,/g, '').replace(/\s*m$/, ''); };
    formDialog('Edit Vessel', [
      { label: 'Vessel Name', name: 'name', value: x.name, required: true },
      { label: 'GRT (Gross Register Tonnage)', name: 'grt', value: plain(x.grt), required: true, type: 'decimal' },
      { label: 'DWT (Deadweight Tonnage)', name: 'dwt', value: plain(x.dwt), required: true, type: 'decimal' },
      { label: 'LOA (Length Overall, m)', name: 'loa', value: plain(x.loa), required: true, type: 'decimal' }
    ], 'Save', function (v) {
      Object.assign(x, vesselRecord(v));
      save('vessels', state.vessels);
      toast('Vessel updated');
    });
  }

  function vesselRecord(v) {
    return { name: v.name, grt: Number(v.grt).toFixed(2), dwt: Number(v.dwt).toLocaleString('en-US', { minimumFractionDigits: 2 }), loa: Number(v.loa).toFixed(2) + ' m' };
  }

  // Picks image file(s) and hands back data URLs, scaled to at most 640px so they fit in local storage.
  function pickImage(multiple, done) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = !!multiple;
    input.onchange = function () {
      Array.prototype.forEach.call(input.files, function (file) {
        var reader = new FileReader();
        reader.onload = function () {
          var img = new Image();
          img.onload = function () {
            var k = Math.min(1, 640 / Math.max(img.width, img.height));
            var c = document.createElement('canvas');
            c.width = Math.round(img.width * k);
            c.height = Math.round(img.height * k);
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            done(c.toDataURL(/png/.test(file.type) ? 'image/png' : 'image/jpeg', 0.85));
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
    };
    input.click();
  }

  // Assign locations: every tugboat's home location in one dialog (one row per boat).
  function assignLocations() {
    if (!state.locations.length) return toast('Add a location first (Manage locations)');
    var opts = state.locations.map(function (l) { return { value: l.name, label: l.name }; });
    var values = {};
    state.tugboats.forEach(function (b, i) { values['loc' + i] = b.location; });
    editDialog({
      title: 'Assign locations',
      text: 'Home location of each tugboat.',
      values: values,
      fields: state.tugboats.map(function (b, i) {
        // A boat whose location is no longer in the list keeps it as an option, so saving does not move it by accident.
        var own = b.location && !opts.some(function (o) { return o.value === b.location; }) ? [{ value: b.location, label: b.location }] : [];
        return { label: b.name + (b.code ? ' · ' + b.code : ''), name: 'loc' + i, type: 'select', options: own.concat(opts), half: true };
      }),
      onSave: function (v) {
        var moved = 0;
        state.tugboats.forEach(function (b, i) {
          if (v['loc' + i] && v['loc' + i] !== b.location) { b.location = v['loc' + i]; moved++; }
        });
        save('tugboats', state.tugboats);
        toast(moved ? moved + ' tugboat' + (moved > 1 ? 's' : '') + ' moved' : 'No change');
      }
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
      '<label class="small-label">Location</label><select class="text-input" name="location">' + state.locations.map(function (l) {
        return '<option' + (l.name === x.location ? ' selected' : '') + '>' + esc(l.name) + '</option>';
      }).join('') + '</select>' +
      '<span class="muted-label">Size class</span><input type="hidden" name="size" value="' + x.size + '" /><div class="size-seg">' +
      ['H', 'V', 'S', 'T'].map(function (s) { return '<button type="button" class="' + (s === x.size ? 'on' : '') + '" data-size="' + s + '">' + s + '</button>'; }).join('') + '</div>' +
      fld('Main Engines', 'hp', x.hp) + fld('Length (m)', 'length', x.length) + fld('Breadth (m)', 'breadth', x.breadth) + fld('Draft (m)', 'draft', x.draft) +
      fld('Bollard Pull (T)', 'bollard', x.bollard) + fld('Gross Tonnage (GT)', 'gt', x.gt) + fld('Propeller Type', 'propeller', x.propeller) +
      fld('Order (lower shows first)', 'order', x.order) +
      '<input type="hidden" name="img" value="' + esc(x.img || '') + '" /><img class="sheet-img" data-tug-img src="' + esc(x.img || '') + '" alt=""' + (x.img ? '' : ' hidden') + ' />' +
      '<button type="button" class="outline-block" data-tug-pick>' + (x.img ? 'Replace Image' : 'Choose Image') + '</button>' +
      '<p class="gallery-note" data-tug-gcount></p><div class="tug-gallery" data-tug-gallery></div>' +
      '<button type="button" class="outline-block" style="margin-top:0" data-tug-add>Add Images</button>' +
      '<button type="submit" class="sheet-submit" style="margin-top:12px">' + (isNew ? 'Create Tugboat' : 'Save Changes') + '</button></form></div></div>';
    var wrap = openOverlay(html, 'sheet', '#000000');
    var form = wrap.querySelector('[data-tug-form]');
    var gallery = (x.gallery || []).slice();
    function drawGallery() {
      form.querySelector('[data-tug-gcount]').textContent = 'Gallery (' + gallery.length + ') · multiple images, not cropped';
      form.querySelector('[data-tug-gallery]').innerHTML = gallery.map(function (src, i) {
        return '<span><img src="' + esc(src) + '" alt="" /><button type="button" data-tug-gdel="' + i + '" aria-label="Remove image">×</button></span>';
      }).join('');
    }
    drawGallery();
    form.addEventListener('click', function (e) {
      var b = e.target.closest('[data-tug-pick],[data-tug-add],[data-tug-gdel]');
      if (!b) return;
      if (b.hasAttribute('data-tug-gdel')) { gallery.splice(Number(b.dataset.tugGdel), 1); return drawGallery(); }
      if (b.hasAttribute('data-tug-add')) return pickImage(true, function (src) { gallery.push(src); drawGallery(); });
      pickImage(false, function (src) {
        form.img.value = src;
        var im = form.querySelector('[data-tug-img]');
        im.src = src;
        im.hidden = false;
        b.textContent = 'Replace Image';
      });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = Object.fromEntries(new FormData(form));
      v.order = Number(v.order) || 0;
      v.gallery = gallery;
      if (isNew) state.tugboats.push(v); else Object.assign(state.tugboats[index], v);
      state.tugboats.sort(function (a, b) { return a.order - b.order; });
      save('tugboats', state.tugboats);
      closeOverlay();
      render();
      toast(isNew ? 'Tugboat created' : 'Changes saved');
    });
  }

  function openFilters() {
    var f = state.tf;
    var html = '<div class="mask light" data-action="close"></div><div class="bsheet"><div class="bsheet-head"><h3>Filters</h3>' +
      '<button data-action="close" aria-label="Close">' + I.close + '</button></div>' +
      (user.role === 'CLIENT' ? '' : '<label class="field-label">User</label><input class="text-input" name="user" placeholder="Filter by user" value="' + esc(f.user || '') + '" />') +
      '<label class="field-label">Vessel</label><input class="text-input" name="vessel" placeholder="Filter by vessel name" value="' + esc(f.vessel || '') + '" />' +
      '<label class="field-label">Port</label><input class="text-input" name="port" placeholder="Filter by port name" value="' + esc(f.port || '') + '" />' +
      '<label class="field-label">Created date</label><input class="text-input soft" type="date" name="date" value="' + esc(f.date || '') + '" />' +
      '<label class="check"><input type="checkbox" name="files"' + (f.files ? ' checked' : '') + ' />Has files</label>' +
      '<div class="bsheet-btns"><button class="clear" data-action="clear-filters">Clear all</button><button class="done" data-action="apply-filters">Done</button></div></div>';
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
    document.body.classList.toggle('desk', desk());
    if (!roleOf(user.role)) {
      if (window.HVSBoard) window.HVSBoard.unmount();
      app.innerHTML = '';
      return openRolePicker();
    }
    if (!allowed(route)) { go(homeRoute()); return; }
    // A ticket opens only if it is one this role may see (a CLIENT: their own), not by typing another id.
    if ((m = route.match(/^tickets\/(.+)$/)) && m[1] !== 'new' && !myTickets().filter(function (x) { return x.id === m[1]; }).length) {
      toast('Ticket #' + m[1] + ' is not available');
      go('tickets');
      return;
    }
    if (m) view = views.ticket(m[1]);
    else if ((m = route.match(/^admin\/users\/edit\/(\d+)$/))) view = views['admin/users/new'](Number(m[1]));
    else if (views[route]) view = views[route]();
    else { go('tickets'); return; }
    // The plan board and History are React islands (window.HVSBoard, built from src/board); they own #board-root.
    if (window.HVSBoard) window.HVSBoard.unmount();
    app.innerHTML = desk() ? '<div class="dk">' + deskSide() + '<main class="dk-main">' + view + '</main>' + deskDemo() + '</div>' : view;
    app.querySelectorAll('form[data-locked] input, form[data-locked] textarea, form[data-locked] button').forEach(function (el) { el.disabled = true; });
    var boardRoot = app.querySelector('#board-root');
    if (boardRoot && window.HVSBoard) window.HVSBoard.mount(boardRoot, { toast: toast, notify: notify, view: boardRoot.dataset.view });
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
    firstPage(); // sort order is kept per screen; the page and search are not
    if (!/^tickets\//.test(route)) state.formTab = 'towage';
    window.scrollTo(0, 0);
    render();
  });

  // ---------- events ----------

  var NOUNS = { users: 'user', vessels: 'vessel', ports: 'port', tugboats: 'tugboat', files: 'file', locations: 'location', persons: 'contact person', stickers: 'sticker' };

  function deleteItem(spec) {
    var parts = spec.split(':');
    var x = state[parts[0]][Number(parts[1])] || {};
    var noun = NOUNS[parts[0]] || 'item';
    confirmDialog('Delete this ' + noun + '?', (x.name ? '"' + x.name + '" will be removed. ' : '') + 'This cannot be undone.', 'Delete', function () {
      state[parts[0]].splice(Number(parts[1]), 1);
      save(parts[0], state[parts[0]]);
      render();
      toast('Deleted');
    });
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    var el;

    if ((el = t.closest('[data-dt-more]'))) return openRowActions(el);

    if ((el = t.closest('[data-pick-role]'))) {
      setRole(el.dataset.pickRole);
      closeOverlay(true);
      var home = homeRoute();
      if (currentRoute() === home) render(); else go(home);
      return toast('Viewing as ' + roleOf(user.role).label);
    }
    // Closed tickets: nothing in the locked form reacts (clear POB, attach, services, CC).
    if (t.closest('form[data-locked]')) return;
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
      firstPage();
      var chips = app.querySelector('.chips');
      var x = chips && chips.scrollLeft;
      render();
      if (chips) app.querySelector('.chips').scrollLeft = x;
      return;
    }
    if ((el = t.closest('[data-tsort]'))) {
      var ts = tables[currentRoute()];
      var key = el.dataset.tsort;
      // First click sorts ascending, the next flips it.
      ts.dir = ts.sort === key ? -ts.dir : 1;
      ts.sort = key;
      ts.page = 1;
      return render();
    }
    if ((el = t.closest('[data-tpage]'))) {
      if (el.disabled) return;
      tables[currentRoute()].page = Number(el.dataset.tpage);
      render();
      var top = app.querySelector('.dt');
      if (top && top.getBoundingClientRect().top < 0) top.scrollIntoView();
      return;
    }
    if ((el = t.closest('[data-page]'))) {
      var pg = el.dataset.page.split(':');
      var p = Number(pg[1]);
      var last = Number(el.closest('.pager').dataset.pages);
      if (p >= 1 && p <= last && p !== state[pg[0] + 'Page']) {
        state[pg[0] + 'Page'] = p;
        render();
        window.scrollTo(0, 0);
      }
      return;
    }
    if ((el = t.closest('[data-tab]'))) {
      state.formTab = el.dataset.tab;
      return render();
    }
    if ((el = t.closest('[data-usertab]'))) {
      state.userTab = el.dataset.usertab;
      firstPage();
      return render();
    }
    if ((el = t.closest('[data-role]'))) {
      var seg = el.parentElement;
      seg.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b === el); });
      seg.parentElement.querySelector('[name=role]').value = el.dataset.role;
      return;
    }
    if ((el = t.closest('[data-ustatus]'))) {
      el.parentElement.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b === el); });
      el.closest('form').querySelector('[name=status]').value = el.dataset.ustatus;
      return;
    }
    if ((el = t.closest('[data-size]'))) {
      el.parentElement.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b === el); });
      el.closest('form').querySelector('[name=size]').value = el.dataset.size;
      return;
    }
    if ((el = t.closest('[data-svc]'))) {
      var holder = el.closest('[data-services-for]');
      el.classList.toggle('on');
      var codes = Array.prototype.map.call(holder.querySelectorAll('.svc-chip.on'), function (c) { return c.dataset.svc; });
      state.ticketServices[holder.dataset.servicesFor] = codes;
      save('ticketServices', state.ticketServices);
      holder.querySelector('.svc-error').hidden = codes.length > 0;
      holder.classList.toggle('invalid', !codes.length);
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
    if ((el = t.closest('[data-edit-vessel]'))) return editVessel(Number(el.dataset.editVessel));
    if ((el = t.closest('[data-edit-port]'))) return editPort(Number(el.dataset.editPort));
    if ((el = t.closest('[data-request]'))) {
      // Approving creates a CLIENT account and rejecting drops the request for good: both ask first.
      var rp = el.dataset.request.split(':');
      var ok = rp[0] === 'approve';
      var rq = state.requests[Number(rp[1])];
      return confirmDialog(ok ? 'Approve request' : 'Reject request',
        ok ? 'Creates a CLIENT account for ' + rq.name + ' (' + rq.email + ').' : rq.name + ' (' + rq.email + ') is removed from the list and gets no account.',
        ok ? 'Approve' : 'Reject', function () {
          state.requests.splice(state.requests.indexOf(rq), 1);
          if (ok) {
            state.users.unshift({ name: rq.name, role: 'CLIENT', email: rq.email, phone: rq.phone, company: rq.company, status: 'ACTIVE' });
            save('users', state.users);
          }
          save('requests', state.requests);
          render();
          toast(ok ? 'Request approved' : 'Request rejected');
        }, ok);
    }
    if ((el = t.closest('[data-notif]'))) {
      var nf = state.notifs[Number(el.dataset.notif)];
      nf.read = true;
      save('notifs', state.notifs);
      var dest = notifTarget(nf);
      return dest ? go(dest) : render();
    }

    if (!(el = t.closest('[data-action]'))) return;
    switch (el.dataset.action) {
      case 'back':
        history.pop();
        if (history.length) { location.hash = '#/' + history.pop(); } else { go('tickets'); }
        break;
      case 'drawer': openDrawer(); break;
      case 'close': closeOverlay(); break;
      case 'cancel-request': {
        var ct = ticketById(el.dataset.arg);
        reasonDialog('Request cancellation', 'The ticket keeps its status until ' + (ct.status === 'Pending' ? 'the MOD on duty' : 'an admin') + ' approves or rejects the request.', 'Reason', 'e.g. The vessel changed its schedule', 'Send request', function (reason) {
          state.cancelReqs['t:' + ct.id] = { reason: reason, by: user.name, at: Date.now() };
          save('cancelReqs', state.cancelReqs);
          render();
          toast('Cancellation requested');
        });
        break;
      }
      case 'cancel-approve': {
        var at = ticketById(el.dataset.arg);
        if (user.role !== 'ADMIN' && at.status !== 'Pending') { toast('Only an admin can cancel a ' + at.status + ' ticket'); break; }
        at.status = 'Cancelled';
        delete state.cancelReqs['t:' + at.id];
        save('tickets', state.tickets); save('cancelReqs', state.cancelReqs);
        notify('✅', 'Cancellation approved ' + at.vessel, ['Ticket #' + at.id + ' is now cancelled', 'Client notified by push'], OPS.concat('CLIENT'), 'by:' + at.by);
        render();
        toast('Cancellation approved · client notified');
        break;
      }
      case 'cancel-reject': {
        var rt = ticketById(el.dataset.arg);
        if (user.role !== 'ADMIN' && rt.status !== 'Pending') { toast('Only an admin can decide on a ' + rt.status + ' ticket'); break; }
        reasonDialog('Reject cancellation', 'The ticket keeps its status (' + rt.status + '). The client sees your note.', 'Note to the client', 'e.g. The tugboats are already on the way', 'Reject', function (note) {
          delete state.cancelReqs['t:' + rt.id];
          save('cancelReqs', state.cancelReqs);
          notify('↩️', 'Cancellation rejected ' + rt.vessel, ['Note: ' + note, 'Client notified by push'], OPS.concat('CLIENT'), 'by:' + rt.by);
          render();
          toast('Cancellation rejected · client notified');
        });
        break;
      }
      case 'switch-role':
        closeOverlay(true);
        try { sessionStorage.removeItem(ROLE_KEY); } catch (err) { /* storage blocked */ }
        user.role = '';
        render();
        break;
      // Desktop → the same screen in the phone frame (device.html's "Desktop design" goes the other way).
      case 'view-mobile':
        try { sessionStorage.setItem('hvs_view', 'mobile'); } catch (err) { /* the query string carries it */ }
        location.href = 'app.html?view=mobile' + location.hash;
        break;
      case 'logout':
        try { localStorage.removeItem(USER_KEY); sessionStorage.removeItem(USER_KEY); sessionStorage.removeItem(ROLE_KEY); } catch (err) { /* storage blocked */ }
        location.href = 'login.html';
        break;
      case 'filters': openFilters(); break;
      case 'apply-filters': {
        var tf = {};
        overlayRoot.querySelectorAll('.bsheet input[name]').forEach(function (i) {
          var v = i.type === 'checkbox' ? i.checked : i.value.trim();
          if (v) tf[i.name] = v;
        });
        state.tf = tf;
        state.ticketPage = 1;
        closeOverlay();
        render();
        break;
      }
      case 'clear-filters':
        overlayRoot.querySelectorAll('.bsheet input').forEach(function (i) { if (i.type === 'checkbox') i.checked = false; else i.value = ''; });
        break;
      case 'new-ticket':
        // A new order starts blank: no services picked from an earlier, unsent form (B24).
        delete state.ticketServices.new;
        save('ticketServices', state.ticketServices);
        state.formTab = 'towage';
        go('tickets/new');
        break;
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
      case 'attach-remove': {
        var row = el.closest('.attach-file');
        confirmDialog('Remove file', row.dataset.fileName + ' is removed from this order when you send it.', 'Remove', function () {
          var box = row.parentElement;
          row.remove();
          if (!box.querySelector('.attach-file') && box.querySelector('.attach-line')) box.querySelector('.attach-line').remove();
        });
        break;
      }
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
      case 'assign-locations': assignLocations(); break;
      default:
        if (actions[el.dataset.action]) actions[el.dataset.action](el, e);
        break;
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
    // A new comment rings the bell (and pushes) for MOD + ADMIN.
    var ct = ticketById(id);
    notify('💬', 'New comment ' + (ct ? ct.vessel : '#' + id), [user.name + ': ' + text, 'Ticket #' + id]);
    render();
  }

  // Send New Order / Update Order: stores the ticket and tells the operations side (bell + push for MOD / ADMIN).
  function saveTicket(form, v) {
    var id = (currentRoute().match(/^tickets\/(.+)$/) || [])[1];
    var edited = id !== 'new' ? ticketById(id) : null;
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var now = new Date();
    var day = pad(now.getDate()) + '/' + pad(now.getMonth() + 1) + '/' + now.getFullYear();
    // "hh:mm - dd/MM/yyyy" (POB) → "dd/MM/yyyy hh:mm" (ET Berth / Unberth on the card).
    var et = function (p) { var m = String(p || '').match(/^(\d{1,2}:\d{2})\s*-\s*(\d{2}\/\d{2}\/\d{4})$/); return m ? m[2] + ' ' + m[1] : ''; };
    var files = Array.prototype.map.call(form.querySelectorAll('.attach-file'), function (r) {
      return { name: r.dataset.fileName, size: r.dataset.fileSize, by: r.dataset.fileBy };
    });
    var fields = {
      vessel: v.vessel.trim(), port: v.port.trim(), dwt: v.dwt || '', loa: v.loa || '', note: v.note || '',
      pobIn: v.pobIn || '', pobOut: v.pobOut || '', berth: et(v.pobIn), unberth: et(v.pobOut), customer: v.customer || '',
      services: Array.prototype.map.call(form.querySelectorAll('.svc-chip.on'), function (c) { return c.dataset.svc; }),
      attachments: files, files: files.length
    };
    if (v.customerId) { fields.customerId = v.customerId; fields.agentId = v.agentId || ''; }
    var lines = ['Port: ' + fields.port].concat(fields.pobIn ? ['POB in: ' + fields.pobIn] : [], fields.pobOut ? ['POB out: ' + fields.pobOut] : []);
    var t, msg;
    if (edited) {
      t = edited;
      Object.keys(fields).forEach(function (k) { t[k] = fields[k]; });
      // A client changing a Confirmed order sends it back to be confirmed again.
      if (user.role === 'CLIENT' && t.status === 'Confirmed') { t.status = 'New Update'; msg = 'Order updated · status New Update'; }
      else msg = 'Order updated';
      notify('✏️', 'Order updated ' + t.vessel, lines.concat('Ticket #' + t.id), null, 'by:' + t.by);
    } else {
      // Ticket number = the day (ddMMyyyy) + that day's running number.
      var prefix = day.replace(/\//g, '');
      var seq = state.tickets.reduce(function (n, x) { return x.id.indexOf(prefix) === 0 ? Math.max(n, Number(x.id.slice(prefix.length)) || 0) : n; }, 0) + 1;
      t = { id: prefix + seq, status: 'Pending', created: day + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()),
        by: user.role === 'CLIENT' ? D.demoClient : user.name };
      Object.keys(fields).forEach(function (k) { t[k] = fields[k]; });
      state.tickets.unshift(t);
      msg = 'New order sent · Ticket #' + t.id;
      notify('📝', 'New order ' + t.vessel, lines.concat('Ticket #' + t.id), null, 'by:' + t.by);
    }
    save('tickets', state.tickets);
    // The pick now lives on the ticket; the next new order starts with nothing selected.
    delete state.ticketServices[id];
    save('ticketServices', state.ticketServices);
    toast(msg);
    if (edited) render(); else go('tickets/' + t.id);
  }

  // Picked files show as attachment rows right away (no re-render, so typed fields stay); Send / Update saves them.
  document.addEventListener('change', function (e) {
    if (!e.target.matches('[data-attach-input]')) return;
    var box = e.target.closest('.attach');
    var btn = box.querySelector('.attach-btn');
    if (e.target.files.length && !box.querySelector('.attach-line')) btn.insertAdjacentHTML('beforebegin', '<div class="attach-line"></div>');
    var line = box.querySelector('.attach-line');
    Array.prototype.forEach.call(e.target.files, function (f) {
      line.insertAdjacentHTML('beforebegin', attachFile({ name: f.name, size: fileSize(f.size), by: user.name }));
    });
    e.target.value = '';
  });

  document.addEventListener('change', function (e) {
    if (!e.target.matches('[data-tsize]')) return;
    var ts = tables[currentRoute()];
    ts.size = Number(e.target.value);
    ts.page = 1;
    render();
  });

  // Crossing the desktop breakpoint swaps cards and tables.
  DESK.addEventListener('change', function () { render(); });

  document.addEventListener('input', function (e) {
    if (e.target.matches('[data-search]')) {
      state.search = e.target.value;
      state._focusSearch = true;
      firstPage();
      render();
    }
    if (e.target.matches('[data-comment]')) {
      app.querySelector('.comment-btn').classList.toggle('ready', !!e.target.value.trim());
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !(overlay && overlay.kind === 'role')) closeOverlay();
    if (e.key === 'Enter' && e.target.matches('[data-comment]')) addComment();
  });

  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (form.hasAttribute('data-dialog') || form.hasAttribute('data-tug-form')) return;
    e.preventDefault();
    var v = Object.fromEntries(new FormData(form));
    switch (form.dataset.form) {
      case 'ticket': {
        // Vessel and Port are required (*), like Services.
        var empty = ['vessel', 'port'].filter(function (k) {
          var fld = form.elements[k].closest('.fld');
          var bad = !form.elements[k].value.trim();
          fld.classList.toggle('invalid', bad);
          var err = fld.querySelector('.fld-error');
          if (bad && !err) fld.insertAdjacentHTML('beforeend', '<div class="fld-error">' + (k === 'vessel' ? 'Enter the vessel name' : 'Enter the port') + '</div>');
          if (!bad && err) err.remove();
          return bad;
        });
        if (empty.length) { form.elements[empty[0]].focus(); break; }
        var box = form.querySelector('.fld-services');
        var picked = form.querySelectorAll('.svc-chip.on').length;
        box.querySelector('.svc-error').hidden = picked > 0;
        box.classList.toggle('invalid', !picked);
        if (!picked) { box.scrollIntoView({ behavior: 'smooth', block: 'center' }); break; }
        saveTicket(form, v);
        break;
      }
      case 'user': {
        // Phone and company are optional (many accounts have none: N/A). Editing keeps the account's status.
        var u = { name: v.name, email: v.email, phone: v.phone || 'N/A', company: v.company || 'N/A', role: v.role };
        if (form.dataset.index != null) Object.assign(state.users[Number(form.dataset.index)], u, { status: v.status || 'ACTIVE' });
        else state.users.unshift(Object.assign(u, { status: 'ACTIVE' }));
        save('users', state.users);
        go('admin/users');
        break;
      }
      case 'vessel':
        state.vessels.unshift(vesselRecord(v));
        save('vessels', state.vessels);
        go('admin/vessels');
        break;
      default: break;
    }
  });

  // ---------- extensions (Phase 4 screens live in board.js) ----------

  var actions = { 'settings-edit': editSettings };
  var api = {
    D: D, state: state, user: user, views: views, actions: actions, I: I,
    esc: esc, emoji: emoji, store: store, save: save, go: go, toast: toast, statusBar: statusBar,
    header: header, search: search, fab: fab, pager: pager, render: function () { render(); },
    desk: desk, manageTable: manageTable, dataTable: dataTable, deskPage: deskPage, dash: dash, pill: pill, btn: btn,
    openOverlay: openOverlay, closeOverlay: closeOverlay, currentRoute: currentRoute, heldFor: heldFor, allowed: allowed, roleOf: roleOf,
    norm: norm, matches: matches, picker: picker, editDialog: editDialog, reasonDialog: reasonDialog, confirmDialog: confirmDialog, notify: notify, myTickets: myTickets
  };
  (window.HVS_EXT || []).forEach(function (ext) { ext(api); });

  // ---------- tap tips ----------
  // Details kept in a tooltip are given as data-tip. Desktop (body.desk): the bubble shows under the element on
  // hover. Phone (no hover): tapping the element shows it; tapping anywhere else (or scrolling) closes it.
  function closeTip() {
    var old = document.querySelector('.tap-tip');
    if (old) old.remove();
    return old;
  }
  function showTip(el) {
    var tip = document.createElement('div');
    tip.className = 'tap-tip';
    tip.setAttribute('role', 'tooltip');
    tip.textContent = el.dataset.tip;
    tip.owner = el;
    document.body.appendChild(tip);
    var r = el.getBoundingClientRect();
    var w = tip.offsetWidth;
    tip.style.left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 8)) + 'px';
    var below = r.bottom + 6;
    tip.style.top = (below + tip.offsetHeight > window.innerHeight - 8 ? r.top - tip.offsetHeight - 6 : below) + 'px';
  }
  var onDesk = function () { return document.body.classList.contains('desk'); };
  document.addEventListener('click', function (e) {
    if (onDesk()) return;
    var el = e.target.closest('[data-tip]');
    var old = closeTip();
    if (el && !(old && old.owner === el)) showTip(el);
  });
  document.addEventListener('mouseover', function (e) {
    if (!onDesk()) return;
    var el = e.target.closest('[data-tip]');
    var old = document.querySelector('.tap-tip');
    if (old && old.owner === el) return;
    closeTip();
    if (el) showTip(el);
  });
  window.addEventListener('scroll', closeTip, true);

  // ---------- sideways-scroll cue ----------
  // Scrollbars are hidden (iOS style), so a table wider than the screen fades out on the right while columns
  // remain there. Under a management table (.dt-wrap) a 3px bar also shows how much is there and where you are;
  // nothing sits over the data (the old › button covered a column).
  var SX = ['.dt-wrap', '.pb-table .ant-table-body', '.pb-hist .ant-table-content'];
  function sxUpdate(el) {
    var box = el.closest('.ant-table-container') || el;
    var more = el.scrollWidth - el.clientWidth;
    var on = more > 1 && el.scrollLeft < more - 1;
    box.classList.toggle('sx-r', on);
    if (!el.classList.contains('dt-wrap')) return;
    var bar = el.nextElementSibling;
    if (!bar || !bar.classList.contains('sx-bar')) {
      if (more <= 1) return;
      bar = document.createElement('div');
      bar.className = 'sx-bar';
      bar.innerHTML = '<i></i>';
      el.after(bar);
    }
    bar.hidden = more <= 1;
    bar.firstChild.style.width = (el.clientWidth / el.scrollWidth * 100) + '%';
    bar.firstChild.style.left = (el.scrollLeft / el.scrollWidth * 100) + '%';
  }
  function sxScan() {
    document.querySelectorAll(SX.join(',')).forEach(sxUpdate);
  }
  var sxQueued = 0;
  function sxQueue() {
    if (!sxQueued) sxQueued = requestAnimationFrame(function () { sxQueued = 0; sxScan(); });
  }
  document.addEventListener('scroll', function (e) {
    if (e.target.matches && e.target.matches(SX.join(','))) sxUpdate(e.target);
  }, true);
  new MutationObserver(sxQueue).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('resize', sxQueue);

  history.push(currentRoute());
  render();
  // The frame may attach its listener late; repeat the colour once everything has loaded.
  window.addEventListener('load', function () { if (!overlay) statusBar(BG); });
})();
