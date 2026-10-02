// Board filters (location band, port, vessel, POB window), set from the toolbar.
import { pobMin } from './model.jsx';

export const sectionPasses = (s, f) => !f.location || s.label === f.location;

export function rowPasses(r, f) {
  if (f.port && r.port !== f.port) return false;
  if (f.vessel && r.vessel !== f.vessel) return false;
  if (f.pobFrom) {
    const m = pobMin(r.pobIn);
    if (m == null || m < pobMin(f.pobFrom)) return false;
  }
  if (f.pobTo) {
    const m = pobMin(r.pobOut);
    if (m == null || m > pobMin(f.pobTo)) return false;
  }
  return true;
}

export const hasFilters = (f) => Object.values(f).some(Boolean);
