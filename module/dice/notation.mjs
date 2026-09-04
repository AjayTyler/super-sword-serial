/**
 * Shorthand die-pool notation, for building challenges at the table without clicking.
 *
 * A challenge's pool is written the way a GM says it out loud: "3d6", "2d8 + 1d10".
 * Count is duration, size is difficulty -- so 3d6 is a short, easy problem and 5d12 is a
 * long, brutal one.
 *
 * MODDERS: this is intentionally permissive. Whitespace, commas, and a missing leading
 * count are all accepted, because a GM typing mid-scene should not have to be precise.
 */

import { SSS } from "../config.mjs";

/** Matches one term: an optional count, then dN. "3d6", "d8", "2 d 10". */
const TERM = /(\d*)\s*d\s*(\d+)/gi;

/**
 * Parse shorthand notation into a list of die sizes.
 *
 * Sizes are snapped to legal Cortex ratings rather than rejected, so "3d7" yields three
 * d6 instead of an error a GM has to stop and read.
 *
 * @param {string} notation  e.g. "3d6", "2d8 + d10"
 * @returns {number[]}       Die sizes, one entry per die. "3d6" gives [6, 6, 6].
 */
export function parseDiceNotation(notation) {
  const faces = [];
  for ( const [, count, size] of String(notation ?? "").matchAll(TERM) ) {
    const n = Math.min(20, Math.max(1, Number(count) || 1));
    const f = snapDie(Number(size));
    for ( let i = 0; i < n; i++ ) faces.push(f);
  }
  return faces;
}

/**
 * Render a list of die sizes back into shorthand, grouping like sizes.
 * @param {number[]} faces
 * @returns {string}  e.g. "3d6 + 1d10"
 */
export function formatDiceNotation(faces) {
  const counts = new Map();
  for ( const f of faces ) counts.set(f, (counts.get(f) ?? 0) + 1);
  return [...counts.entries()]
    .sort(([a], [b]) => a - b)
    .map(([f, n]) => `${n}d${f}`)
    .join(" + ");
}

/**
 * Snap an arbitrary number to the nearest legal die rating.
 * @param {number} size
 * @returns {number}
 */
export function snapDie(size) {
  const n = Number(size) || SSS.DIE_MIN;
  return SSS.DIE_RATINGS.reduce((best, r) =>
    Math.abs(r - n) < Math.abs(best - n) ? r : best, SSS.DIE_RATINGS[0]);
}
