// Sample data shown by the app. Values come from the design screenshots in /images
// and from the live HVS site; `tickets` is injected by tools/build-data.js.
window.HVS_DATA = {
  tickets: /*TICKETS*/[],
  ticketTotal: 2141,

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
      { name: 'Mr. Pham Van Quang', phone: true, zalo: true, whatsapp: true },
      { name: 'Ms. Thuy Trang', phone: true, zalo: true, whatsapp: true },
      { name: 'Ms. Ha Giang', phone: true, zalo: true, whatsapp: true },
      { name: 'Mr Dan', phone: true, zalo: true, whatsapp: true },
      { name: 'Mr Phi', phone: true, zalo: true, whatsapp: true },
      { name: 'Tug Duty 24/7', phone: true, zalo: true, whatsapp: true }
    ],
    visible: 3
  },

  notifications: {
    unread: 3316,
    total: 3410,
    items: [
      { icon: '✏️', title: 'New update DERYOUNG SUNFLOWER', lines: ['Port: Mỹ Xuân A', 'POB in: Oct 1, 2026, 01:00 GMT+7'], time: '42m ago' },
      { icon: '📝', title: 'New order ARAYA BHUM', lines: ['Port: CMIT', 'POB in: Oct 1, 2026, 02:00 GMT+7', 'POB out: Oct 2, 2026, 05:00 GMT+7'], time: '44m ago' },
      { icon: '✏️', title: 'New update NEHIR', lines: ['Port: PHƯỚC AN', 'POB in: Sep 26, 2026, 16:30 GMT+7', 'POB out: Sep 30, 2026, 03:00 GMT+7'], time: '1h ago' },
      { icon: '✏️', title: 'New update NORDATLANTIC', lines: ['Port: CMIT', 'POB in: Sep 29, 2026, 06:30 GMT+7'], time: '1h ago' },
      { icon: '📝', title: 'New order A CHAU 16', lines: ['Port: Baria', 'POB in: Sep 30, 2026, 05:00 GMT+7', 'POB out: Oct 7, 2026, 00:00 GMT+7'], time: '4d ago' }
    ]
  },

  admin: [
    { route: 'admin/users', icon: '👥', title: 'User Management', sub: 'Manage users, roles, and permissions', color: '#1463ff', tile: '#e3e9fb' },
    { route: 'admin/vessels', icon: '🚢', title: 'Vessel Management', sub: 'Manage vessel master data', color: '#16a34a', tile: '#dcfce7' },
    { route: 'admin/ports', icon: '⚓', title: 'Port Management', sub: 'Manage port and berth data', color: '#ea580c', tile: '#ffedd5' },
    { route: 'admin/user-requests', icon: '📝', title: 'User Requests', sub: 'Review and approve access requests', color: '#dc2626', tile: '#fee2e2' },
    { route: 'admin/locations', icon: '📍', title: 'Location Management', sub: 'Manage tugboat home locations', color: '#9333ea', tile: '#f3e8ff' },
    { route: 'admin/contact-persons', icon: '👤', title: 'Contact Person Management', sub: 'Manage contact persons for ticket confirmation', color: '#0891b2', tile: '#cffafe' },
    { route: 'admin/stickers', icon: '🖋️', title: 'Sticker Management', sub: 'Manage signatures and stamps for attachment editing', color: '#c2410c', tile: '#ffedd5' },
    { route: 'admin/tugboats', icon: '⛵', title: 'Tugboat Management', sub: 'Manage tugboat fleet and specifications', color: '#0e7490', tile: '#cffafe' },
    { route: 'admin/export-tickets', icon: '📊', title: 'Export Tickets', sub: 'Generate ticket reports by date range', color: '#0f766e', tile: '#ccfbf1' },
    { route: 'admin/contact-stats', icon: '📈', title: 'Contact Statistics', sub: 'Hotline / Zalo / WhatsApp click tracking', color: '#e11d48', tile: '#ffe4e6' }
  ],

  users: [
    { name: 'Tài Lê Huy Nhật', role: 'CLIENT', email: 'lehuynhattai1998@gmail.com', phone: 'N/A', company: 'N/A', status: 'ACTIVE' },
    { name: 'Ngọc Quý Mai', role: 'CLIENT', email: 'ngocquy.engineer@gmail.com', phone: 'N/A', company: 'N/A', status: 'ACTIVE' },
    { name: 'NGUYỄN THANH SANG', role: 'CLIENT', email: 'sangnt@gemadept.com.vn', phone: '+84975382001', company: 'PACIFIC MARINE CO; LTD', status: 'ACTIVE' },
    { name: 'Phuc client', role: 'CLIENT', email: 'phuc.client@inapps.net', phone: 'N/A', company: 'N/A', status: 'ACTIVE' },
    { name: 'Phat Dinh', role: 'STAFF', email: 'phat.dinh@inapps.net', phone: '+84123456789', company: 'Viet Nam', status: 'ACTIVE' },
    { name: 'Admin User', role: 'ADMIN', email: 'admin@hvs.vn', phone: 'N/A', company: 'HVS', status: 'ACTIVE' }
  ],
  roleColors: { CLIENT: '#4caf50', STAFF: '#1e90ff', ADMIN: '#f44336' },

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
    { name: 'Mỹ Xuân A', berth: 'Cai Mep/Phu My - Vung Tau' }
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
    { name: 'Mr Đán', order: 1 },
    { name: 'Mr Minh', order: 2 },
    { name: 'Mr Vương', order: 3 },
    { name: 'Ms Phương', order: 4 },
    { name: 'Mr Phi', order: 5 }
  ],

  stickers: [
    { name: 'Phi', order: 1, img: 'assets/hvs/img/sticker-phi.png' },
    { name: 'Đán', order: 2, img: 'assets/hvs/img/sticker-dan.png' },
    { name: 'Vương', order: 3, img: 'assets/hvs/img/sticker-vuong.png' },
    { name: 'Minh', order: 4, img: 'assets/hvs/img/sticker-minh.png' }
  ],

  tugboats: [
    { name: 'MIRAI 59.H1', code: 'H1', location: 'VUNGTAU - HCM', size: 'H', hp: '5,912 HP', length: '41.55', breadth: '10.40', draft: '4.09', bollard: '72.00', gt: '498.00', propeller: 'Azimuth', order: 1, img: 'assets/hvs/img/tugboat-mirai.jpg' },
    { name: 'HVS 30.S1', code: 'S1', location: 'VUNGTAU - HCM', size: 'S', hp: '3,000 HP', length: '22.57', breadth: '8.50', draft: '3.70', bollard: '', gt: '210.00', propeller: 'Azimuth', order: 2, img: '' }
  ],

  exportColumns: ['Ticket ID', 'Service Type', 'Owner', 'Vessel', 'GRT/DWT/LOA', 'Port/Berth', 'POB In', 'POB Out', 'Status', 'Tugboats', 'Tugboat Note', 'Assigned Tug', 'Contact', 'Request Details', 'Created At'],
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
    from: '30/08/2026', to: '28/09/2026', note: 'Aggregated nightly — data is complete up to 27/09.',
    total: 25, mobile: 24, web: 1, phone: 12, zalo: 9, whatsapp: 4,
    // [day, phone, zalo, whatsapp]
    days: [['30/08', 1, 0, 0], ['31/08', 0, 0, 0], ['01/09', 0, 0, 0], ['02/09', 0, 1, 0], ['03/09', 0, 0, 0], ['04/09', 0, 0, 0], ['05/09', 0, 0, 0],
      ['06/09', 1, 0, 0], ['07/09', 3, 4, 3], ['08/09', 0, 0, 0], ['09/09', 0, 1, 0], ['10/09', 0, 1, 0], ['11/09', 0, 0, 0], ['12/09', 0, 0, 0]]
  }
};
