/**
 * The Doom Pool: the GM's growing reserve of dice.
 *
 * Unlike Plot Points, a Doom Pool is a COLLECTION OF DICE, not a number -- a pool of
 * [d8, d6, d6] is meaningfully different from one d12. So it is stored as an array and
 * every die is individually steppable and spendable.
 *
 * It grows when players roll hitches (the GM's alternative to handing out a Plot Point)
 * and by GM fiat for pacing. It is spent to complicate scenes and to oppose rolls.
 *
 * Stored in a world setting rather than on an Actor, because it belongs to the table.
 */

import { SSS } from "../config.mjs";
import { rollCortexPool } from "../dice/_module.mjs";

const SYSTEM_ID = "super-sword-serial";
const SETTING = "doomPool";

/** Stable application id, so the scene-control button can toggle the open window. */
export const DOOM_POOL_APP_ID = "sss-doom-pool";

/* -------------------------------------------- */
/*  Store                                      */
/* -------------------------------------------- */

/** Register the setting. Call during init. */
export function registerDoomPoolSetting() {
  game.settings.register(SYSTEM_ID, SETTING, {
    scope: "world",
    config: false,
    type: Object,
    default: { dice: SSS.DOOM_POOL_START.map(faces => ({ id: foundry.utils.randomID(), faces })) },
    onChange: () => foundry.applications.instances.get(DOOM_POOL_APP_ID)?.render()
  });
}

/** @returns {{dice: {id: string, faces: number}[]}} */
export function getDoomPool() {
  const stored = game.settings.get(SYSTEM_ID, SETTING);
  return { dice: stored?.dice ?? [] };
}

/**
 * Only the GM may write the pool. Guarded here rather than only in the UI, since a
 * disabled button is a hint and not a boundary.
 */
function setDoomPool(pool) {
  if ( !game.user.isGM ) return Promise.resolve();
  return game.settings.set(SYSTEM_ID, SETTING, pool);
}

export function addDoomDie(faces) {
  const pool = getDoomPool();
  pool.dice.push({ id: foundry.utils.randomID(), faces: clampDoom(faces) });
  return setDoomPool(pool);
}

export function stepDoomDie(id, steps) {
  const pool = getDoomPool();
  const die = pool.dice.find(d => d.id === id);
  if ( !die ) return Promise.resolve();
  die.faces = clampDoom(die.faces + (steps * 2));
  return setDoomPool(pool);
}

export function removeDoomDie(id) {
  const pool = getDoomPool();
  pool.dice = pool.dice.filter(d => d.id !== id);
  return setDoomPool(pool);
}

export function resetDoomPool() {
  return setDoomPool({
    dice: SSS.DOOM_POOL_START.map(faces => ({ id: foundry.utils.randomID(), faces }))
  });
}

function clampDoom(faces) {
  const even = Math.round((Number(faces) || SSS.DIE_MIN) / 2) * 2;
  return Math.min(SSS.DIE_MAX, Math.max(SSS.DIE_MIN, even));
}

/* -------------------------------------------- */
/*  Application                                 */
/* -------------------------------------------- */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class DoomPoolApp extends HandlebarsApplicationMixin(ApplicationV2) {

  /** @override */
  static DEFAULT_OPTIONS = {
    id: DOOM_POOL_APP_ID,
    classes: ["sss", "sss-doom-pool"],
    tag: "div",
    position: { width: 340, height: "auto" },
    window: { title: "SSS.Doom.Title", icon: "fa-solid fa-skull", resizable: false },
    actions: {
      addDoomDie: DoomPoolApp.#onAddDie,
      stepDoomDie: { handler: DoomPoolApp.#onStepDie, buttons: [0, 2] },
      removeDoomDie: DoomPoolApp.#onRemoveDie,
      resetDoomPool: DoomPoolApp.#onReset,
      rollDoomPool: DoomPoolApp.#onRoll
    }
  };

  /** @override */
  static PARTS = {
    body: {
      template: "systems/super-sword-serial/templates/apps/doom-pool.hbs",
      templates: ["systems/super-sword-serial/templates/parts/die-shape.hbs"]
    }
  };

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const pool = getDoomPool();
    context.dice = pool.dice;
    context.count = pool.dice.length;
    context.isGM = game.user.isGM;
    context.dieRatings = SSS.DIE_RATINGS;
    return context;
  }

  /** @inheritDoc */
  async _onRender(context, options) {
    await super._onRender(context, options);
    for ( const el of this.element.querySelectorAll("[data-action='stepDoomDie']") ) {
      el.addEventListener("contextmenu", event => event.preventDefault());
    }
  }

  /* -------------------------------------------- */

  static async #onAddDie(event, target) {
    // Read the picker rather than a fixed size, so the GM can grow the pool by any die.
    const select = this.element.querySelector("[name='doomDieSize']");
    await addDoomDie(Number(target.dataset.faces ?? select?.value) || SSS.DIE_MIN);
  }

  static async #onStepDie(event, target) {
    await stepDoomDie(target.dataset.dieId, event.button === 2 ? -1 : 1);
  }

  static async #onRemoveDie(event, target) {
    await removeDoomDie(target.dataset.dieId);
  }

  static async #onReset() {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("SSS.Doom.ResetTitle") },
      content: `<p>${game.i18n.localize("SSS.Doom.ResetConfirm")}</p>`
    });
    if ( confirmed ) await resetDoomPool();
  }

  /**
   * Roll the whole Doom Pool as opposition.
   *
   * Uses the same CortexRoll as players, so the GM gets the same Total/Effect assignment
   * step. Spending dice out of the pool stays a manual decision -- which dice a roll
   * consumes is a GM call, not something to guess.
   */
  static async #onRoll() {
    const { dice } = getDoomPool();
    if ( !dice.length ) {
      ui.notifications.warn(game.i18n.localize("SSS.Doom.Empty"));
      return;
    }
    await rollCortexPool(dice.map(d => ({
      faces: d.faces,
      traitName: game.i18n.localize("SSS.Doom.DieLabel"),
      traitType: "doom"
    })), {
      flavor: game.i18n.localize("SSS.Doom.RollFlavor"),
      messageMode: "public"
    });
  }
}

/**
 * Add the GM-only toggle to the token scene controls.
 * Call during init.
 */
export function registerDoomPoolControl() {
  Hooks.on("getSceneControlButtons", controls => {
    if ( !controls.tokens ) return;
    controls.tokens.tools.sssDoomPool = {
      name: "sssDoomPool",
      title: "SSS.Doom.Title",
      icon: "fa-solid fa-skull",
      order: Object.keys(controls.tokens.tools).length,
      button: true,
      // Visible to everyone: players can watch the Doom Pool grow, which is most of its
      // dramatic value. Write access is denied in the store, and every control is hidden
      // from non-GMs in the template, so this stays read-only for them.
      visible: true,
      onChange: () => {
        const existing = foundry.applications.instances.get(DOOM_POOL_APP_ID);
        if ( existing ) existing.close();
        else new DoomPoolApp().render({ force: true });
      }
    };
  });
}
