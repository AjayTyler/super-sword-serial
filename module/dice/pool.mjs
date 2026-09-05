/**
 * The pending dice pool: a staging area a player fills before rolling.
 *
 * Cortex pools are assembled, not computed. A player picks their prime traits, may add a
 * Signature Asset, and SFX can step individual dice up or down -- all before anything is
 * thrown. So the pool needs to exist as editable state, not as a value derived at roll time.
 *
 * State lives in an Actor flag rather than the data model, because a half-built pool is UI
 * state, not part of who the character is. Using a flag keeps the character schema clean
 * while still persisting across reloads and syncing to the GM.
 *
 * MODDERS: everything that mutates a pool goes through this module. If you add a new
 * source of dice, build a PoolEntry and call addDie.
 */

import { SSS } from "../config.mjs";

/** Flag scope. Matches the system id. */
const SCOPE = "super-sword-serial";

/** Flag key holding the pending pool. */
const KEY = "pool";

/**
 * @typedef PoolEntry
 * @property {string} id           Unique per entry, since the same trait may appear twice.
 * @property {number} faces        Current die size, after any stepping.
 * @property {number} baseFaces    Size when added, so stepping can be shown and reverted.
 * @property {string} traitName    Display label.
 * @property {string} [traitId]    Source trait key or Item id.
 * @property {string} [traitType]  "distinction" | "role" | "attribute" | "signature" | "scene" | "loose"
 */

/**
 * Read the pending pool.
 * @param {Actor} actor
 * @returns {{entries: PoolEntry[], keepCount: number}}
 */
export function getPool(actor) {
  const stored = actor.getFlag(SCOPE, KEY);
  return {
    entries: stored?.entries ?? [],
    keepCount: stored?.keepCount ?? SSS.DEFAULT_KEEP_COUNT
  };
}

/**
 * Overwrite the pending pool.
 * @param {Actor} actor
 * @param {{entries: PoolEntry[], keepCount: number}} pool
 * @returns {Promise<Actor>}
 */
function setPool(actor, pool) {
  return actor.setFlag(SCOPE, KEY, pool);
}

/**
 * Add a die to the pool.
 *
 * Duplicates are allowed on purpose: some SFX grant an extra die of a trait already in
 * the pool.
 *
 * @param {Actor} actor
 * @param {Omit<PoolEntry, "id"|"baseFaces">} entry
 * @returns {Promise<Actor>}
 */
export function addDie(actor, { faces, traitName, traitId = null, traitType = null }) {
  const pool = getPool(actor);
  pool.entries.push({
    id: foundry.utils.randomID(),
    faces: clampDie(faces),
    baseFaces: clampDie(faces),
    traitName,
    traitId,
    traitType
  });
  return setPool(actor, pool);
}

/**
 * Remove one die from the pool.
 * @param {Actor} actor
 * @param {string} entryId
 * @returns {Promise<Actor>}
 */
export function removeDie(actor, entryId) {
  const pool = getPool(actor);
  pool.entries = pool.entries.filter(e => e.id !== entryId);
  return setPool(actor, pool);
}

/**
 * Step a die in the pool up or down, for SFX that resize dice before the roll.
 *
 * Clamped to d4-d12 rather than wrapping or erroring, so holding the button down does
 * something predictable.
 *
 * @param {Actor} actor
 * @param {string} entryId
 * @param {number} steps  Positive steps up, negative steps down. One step is 2 faces.
 * @returns {Promise<Actor>}
 */
export function stepDie(actor, entryId, steps) {
  const pool = getPool(actor);
  const entry = pool.entries.find(e => e.id === entryId);
  if ( !entry ) return Promise.resolve(actor);
  entry.faces = clampDie(entry.faces + (steps * 2));
  return setPool(actor, pool);
}

/**
 * Set how many dice are summed for the Total. SFX may raise this above the default.
 * @param {Actor} actor
 * @param {number} keepCount
 * @returns {Promise<Actor>}
 */
export function setKeepCount(actor, keepCount) {
  const pool = getPool(actor);
  pool.keepCount = Math.max(1, Math.round(keepCount) || SSS.DEFAULT_KEEP_COUNT);
  return setPool(actor, pool);
}

/**
 * Empty the pool.
 * @param {Actor} actor
 * @returns {Promise<Actor>}
 */
export function clearPool(actor) {
  return setPool(actor, { entries: [], keepCount: SSS.DEFAULT_KEEP_COUNT });
}

/**
 * Snap a die size to a legal Cortex rating.
 * @param {number} faces
 * @returns {number}
 */
export function clampDie(faces) {
  const n = Number(faces) || SSS.DIE_MIN;
  const even = Math.round(n / 2) * 2;
  return Math.min(SSS.DIE_MAX, Math.max(SSS.DIE_MIN, even));
}
