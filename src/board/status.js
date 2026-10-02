import D from '../data';

export const STATUS = D.boardStatus;
export const STATUS_KEYS = Object.keys(D.boardStatus);
export { isTerminal } from './timeline';
// ADMIN and MOD run the board; CAPTAIN only reads it.
export const canRun = (role) => role === 'ADMIN' || role === 'MOD';
export const isAdmin = (role) => role === 'ADMIN';

// Status changes (§12): a MOD changes a status only from PENDING (Confirm, Not valid, approving a cancellation)
// and CONFIRMED → DONE. Everything else (re-confirming a NEW_UPDATE, CONFIRMED → NOT_VALID, cancelling a
// CONFIRMED ticket, reopening a closed one) is ADMIN only. Hold is a mark, not a status: MOD keeps it.
export function canMove(role, from, to) {
  if (role === 'ADMIN') return true;
  if (role !== 'MOD') return false;
  if (from === 'PENDING') return to === 'CONFIRMED' || to === 'NOT_VALID' || to === 'CANCELLED';
  return from === 'CONFIRMED' && to === 'DONE';
}
