import D from '../data';
import { normalizeBoard } from './model.jsx';

// Board rows live in the app's sessionStorage. v9: bumped so the English sample data reaches open tabs.
const BOARD_KEY = 'hvs_board_v9';
// Per-device display config: { columns, filters }.
const CFG_KEY = 'hvs.planBoard.display.v1';

function read(storage, key, fallback) {
  try {
    const v = storage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch (e) {
    return fallback;
  }
}

function write(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch (e) {
    /* storage blocked */
  }
}

export const loadBoard = () => normalizeBoard(read(sessionStorage, BOARD_KEY, D.board));
export const saveBoard = (board) => write(sessionStorage, BOARD_KEY, board);

export const ALL_KEYS = D.boardColumns.map((c) => c.key);
export const REQUIRED = D.boardColumns.filter((c) => c.required).map((c) => c.key);

export function presetKeys(name) {
  const keys = D.columnPresets[name];
  return keys ? keys.slice() : ALL_KEYS.slice();
}

// Admin-configured column defaults (set in Board display by an admin, or on Admin › Board Defaults; both save
// hvs_boardDefaults = { global, roles: { ROLE: cols }, users: { name: cols } }). A value is a list of column keys,
// 'All', or null / missing for "no default at this level". Applied: per user → per role → global → every column;
// the device's own choice (loadConfig) sits on top. Defaults, not permissions: anyone can still change their view.
export function loadDefaults() {
  const d = read(sessionStorage, 'hvs_boardDefaults', null) || { global: D.globalDefault, roles: D.roleDefaults, users: D.userDefaults };
  return { global: d.global == null ? null : d.global, roles: { ...(d.roles || {}) }, users: { ...(d.users || {}) } };
}

export const saveDefaults = (d) => write(sessionStorage, 'hvs_boardDefaults', d);

// A stored default → its column keys (required ones always in), or null when the level has none.
export function colsOf(v) {
  if (v == null || v === '') return null;
  if (Array.isArray(v)) return ALL_KEYS.filter((k) => v.includes(k) || REQUIRED.includes(k));
  return presetKeys(v); // older saved preset names ('All', 'Compact', …)
}

export function roleDefault(role, name = loadUserName()) {
  const d = loadDefaults();
  return colsOf(d.users[name]) || colsOf(d.roles[role]) || colsOf(d.global) || ALL_KEYS.slice();
}

// People who use the board (ADMIN, MOD, CAPTAIN), for per-user defaults (Board display › Apply to).
export function loadBoardUsers() {
  return read(sessionStorage, 'hvs_users', D.users).filter((u) => /^(ADMIN|MOD|CAPTAIN)$/.test(u.role) && u.status === 'ACTIVE');
}

// Density and empty bands are fixed now (the Display section is gone); older saved values are ignored.
const DEFAULT_CFG = { columns: null, filters: {}, density: 'comfortable', showEmpty: true };

export function loadConfig() {
  const raw = read(localStorage, CFG_KEY, null);
  const cfg = { ...DEFAULT_CFG, filters: {} };
  if (!raw || typeof raw !== 'object') return cfg;
  if (Array.isArray(raw.columns)) cfg.columns = ALL_KEYS.filter((k) => raw.columns.includes(k) || REQUIRED.includes(k));
  if (raw.filters && typeof raw.filters === 'object') cfg.filters = raw.filters;
  return cfg;
}

export const saveConfig = (cfg) => write(localStorage, CFG_KEY, cfg);

// The signed-in user (hvs_clone_user in app.js). Its role is the one picked in the demo role picker.
function signedIn() {
  return read(localStorage, 'hvs_clone_user', null) || read(sessionStorage, 'hvs_clone_user', null) || {};
}

// ADMIN, MOD or CAPTAIN; other roles never reach the board (app.js guards the route).
export function loadRole() {
  const role = String(signedIn().role || '').toUpperCase();
  return ['ADMIN', 'MOD', 'CAPTAIN'].includes(role) ? role : 'CAPTAIN';
}

export const loadUserName = () => signedIn().name || 'User';

// The demo role as picked, any of the seven (History is open to CLIENT too).
export const loadAppRole = () => String(signedIn().role || '').toUpperCase();

// MOD on duty for Confirm: users with role MOD (Admin › User Management, app.js keeps them in hvs_users).
export function loadMods() {
  return read(sessionStorage, 'hvs_users', D.users).filter((u) => u.role === 'MOD' && u.status === 'ACTIVE');
}

// P6 special case: shipping-line tag per vessel ({ vessel: tag }).
export const loadTags = () => read(sessionStorage, 'hvs_vesselTags', {});
export const saveTags = (tags) => write(sessionStorage, 'hvs_vesselTags', tags);
