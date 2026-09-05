/**
 * Challenge sheet: mobs, challenges, and crisis pools.
 *
 * Shares the pool tray and the roll card with the PC sheet. The pool store keys off any
 * Actor, so a challenge assembles and rolls exactly the way a player does -- which means
 * the GM gets the same Total/Effect assignment step and needs no separate mental model.
 *
 * MODDERS: the die-notation box is the fast path. `parseDiceNotation` accepts "3d6",
 * "2d8 + d10", and similar, so a challenge can be built mid-scene without clicking.
 */

import { SSS } from "../config.mjs";
import { rollCortexPool } from "../dice/_module.mjs";
import * as Pool from "../dice/pool.mjs";
import { parseDiceNotation, formatDiceNotation, snapDie } from "../dice/notation.mjs";
import { getSceneTraits } from "../apps/scene-traits.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export class SSSChallengeSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["sss", "sss-challenge"],
    position: { width: 560, height: 640 },
    window: { contentClasses: ["standard-form"], resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      applyNotation: SSSChallengeSheet.#onApplyNotation,
      addCoreDie: SSSChallengeSheet.#onAddCoreDie,
      stepCoreDie: { handler: SSSChallengeSheet.#onStepCoreDie, buttons: [0, 2] },
      removeCoreDie: SSSChallengeSheet.#onRemoveCoreDie,
      addCoreToPool: SSSChallengeSheet.#onAddCoreToPool,
      addTraitDie: SSSChallengeSheet.#onAddTraitDie,
      stepPoolDie: { handler: SSSChallengeSheet.#onStepPoolDie, buttons: [0, 2] },
      removePoolDie: SSSChallengeSheet.#onRemovePoolDie,
      clearPool: SSSChallengeSheet.#onClearPool,
      rollPool: SSSChallengeSheet.#onRollPool,
      advanceRound: { handler: SSSChallengeSheet.#onAdvanceRound, buttons: [0, 2] },
      createItem: SSSChallengeSheet.#onCreateItem,
      editItem: SSSChallengeSheet.#onEditItem,
      deleteItem: SSSChallengeSheet.#onDeleteItem
    }
  };

  /** @override */
  static PARTS = {
    header: { template: "systems/super-sword-serial/templates/actor/challenge-header.hbs" },
    body: {
      template: "systems/super-sword-serial/templates/actor/challenge-body.hbs",
      templates: [
        "systems/super-sword-serial/templates/parts/item-trait-row.hbs",
        "systems/super-sword-serial/templates/parts/scene-trait-row.hbs",
        "systems/super-sword-serial/templates/parts/die-shape.hbs"
      ],
      scrollable: [""]
    },
    pool: {
      template: "systems/super-sword-serial/templates/actor/pool-tray.hbs",
      templates: ["systems/super-sword-serial/templates/parts/die-shape.hbs"]
    }
  };

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;

    context.system = actor.system;
    context.systemFields = actor.system.schema.fields;
    context.dieRatings = SSS.DIE_RATINGS;

    context.coreDice = actor.system.dice;
    context.duration = actor.system.duration;
    context.difficulty = actor.system.difficulty;
    context.notation = formatDiceNotation(actor.system.dice.map(d => d.faces));
    context.typicalSize = SSS.CHALLENGE_DICE_TYPICAL;

    context.signatures = actor.itemTypes.signature;
    context.sceneTraits = getSceneTraits();

    context.pool = Pool.getPool(actor);
    context.poolCount = context.pool.entries.length;

    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation
      .enrichHTML(actor.system.description, { relativeTo: actor, secrets: actor.isOwner });

    return context;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _processSubmitData(event, form, submitData, options = {}) {
    // Same reason as the PC sheet: an Actor's items collection is readonly.
    const itemChanges = submitData.items;
    delete submitData.items;

    if ( itemChanges ) {
      const updates = Object.entries(itemChanges)
        .filter(([id]) => this.actor.items.has(id))
        .map(([id, changes]) => ({ _id: id, ...foundry.utils.flattenObject(changes) }));
      if ( updates.length ) await this.actor.updateEmbeddedDocuments("Item", updates);
    }

    // The notation box is a UI control, not stored data -- applyNotation writes the dice.
    delete submitData.diceNotation;

    if ( !foundry.utils.isEmpty(submitData) ) {
      await super._processSubmitData(event, form, submitData, options);
    }
  }

  /** @inheritDoc */
  async _onRender(context, options) {
    await super._onRender(context, options);
    this._dragDrop.bind(this.element);

    for ( const el of this.element.querySelectorAll(
      "[data-action='stepCoreDie'], [data-action='stepPoolDie'], [data-action='advanceRound']"
    ) ) {
      el.addEventListener("contextmenu", event => event.preventDefault());
    }

    // Enter in the notation box applies it, rather than submitting the whole form.
    const notation = this.element.querySelector("[name='diceNotation']");
    notation?.addEventListener("keydown", event => {
      if ( event.key !== "Enter" ) return;
      event.preventDefault();
      SSSChallengeSheet.#applyNotation.call(this, notation.value);
    });
  }

  /* -------------------------------------------- */
  /*  Core pool                                   */
  /* -------------------------------------------- */

  /** Replace the whole core pool from shorthand. */
  static async #applyNotation(value) {
    const faces = parseDiceNotation(value);
    if ( !faces.length ) {
      ui.notifications.warn(game.i18n.localize("SSS.Challenge.BadNotation"));
      return;
    }
    await this.actor.update({
      "system.dice": faces.map(f => ({ id: foundry.utils.randomID(), faces: f }))
    });
  }

  static async #onApplyNotation(event, target) {
    const input = target.closest(".sss-notation")?.querySelector("[name='diceNotation']");
    await SSSChallengeSheet.#applyNotation.call(this, input?.value ?? "");
  }

  static async #onAddCoreDie(event, target) {
    const dice = foundry.utils.deepClone(this.actor.system.dice);
    dice.push({ id: foundry.utils.randomID(), faces: snapDie(Number(target.dataset.faces) || 6) });
    await this.actor.update({ "system.dice": dice });
  }

  /** Step a core die. Left click steps up, right click steps down. */
  static async #onStepCoreDie(event, target) {
    const steps = event.button === 2 ? -1 : 1;
    const dice = foundry.utils.deepClone(this.actor.system.dice);
    const die = dice.find(d => d.id === target.dataset.dieId);
    if ( !die ) return;
    die.faces = Math.min(SSS.DIE_MAX, Math.max(SSS.DIE_MIN, die.faces + (steps * 2)));
    await this.actor.update({ "system.dice": dice });
  }

  /** Remove a core die -- this is how players wear a challenge down. */
  static async #onRemoveCoreDie(event, target) {
    const dice = this.actor.system.dice.filter(d => d.id !== target.dataset.dieId);
    await this.actor.update({ "system.dice": dice });
  }

  /** Load every core die into the pending pool, the usual start of a challenge's roll. */
  static async #onAddCoreToPool() {
    for ( const die of this.actor.system.dice ) {
      await Pool.addDie(this.actor, {
        faces: die.faces,
        traitName: game.i18n.localize("SSS.Challenge.CoreDie"),
        traitId: die.id,
        traitType: "challenge"
      });
    }
  }

  /* -------------------------------------------- */
  /*  Shared pool controls                        */
  /* -------------------------------------------- */

  static async #onAddTraitDie(event, target) {
    const { faces, traitName, traitId, traitType } = target.dataset;
    await Pool.addDie(this.actor, {
      faces: Number(faces),
      traitName,
      traitId: traitId ?? null,
      traitType: traitType ?? null
    });
  }

  static async #onStepPoolDie(event, target) {
    await Pool.stepDie(this.actor, target.dataset.entryId, event.button === 2 ? -1 : 1);
  }

  static async #onRemovePoolDie(event, target) {
    await Pool.removeDie(this.actor, target.dataset.entryId);
  }

  static async #onClearPool() {
    await Pool.clearPool(this.actor);
  }

  static async #onRollPool() {
    const { entries, keepCount } = Pool.getPool(this.actor);
    if ( !entries.length ) {
      ui.notifications.warn(game.i18n.localize("SSS.Pool.Empty"));
      return;
    }
    await rollCortexPool(entries.map(e => ({
      faces: e.faces,
      traitName: e.traitName,
      traitId: e.traitId,
      traitType: e.traitType
    })), {
      actor: this.actor,
      keepCount,
      flavor: game.i18n.format("SSS.Challenge.RollFlavor", { name: this.actor.name })
    });
    await Pool.clearPool(this.actor);
  }

  /* -------------------------------------------- */

  /** Advance the round. Right click steps back, for miscounts. */
  static async #onAdvanceRound(event) {
    const delta = event.button === 2 ? -1 : 1;
    await this.actor.update({ "system.round": Math.max(1, this.actor.system.round + delta) });
  }

  static async #onCreateItem(event, target) {
    const type = target.dataset.itemType;
    const created = await getDocumentClass("Item").create({
      name: game.i18n.localize(`SSS.Item.${type.capitalize()}.NewName`),
      type
    }, { parent: this.actor });
    created?.sheet.render({ force: true });
  }

  static #onEditItem(event, target) {
    const id = target.closest("[data-item-id]")?.dataset.itemId;
    this.actor.items.get(id)?.sheet.render({ force: true });
  }

  static async #onDeleteItem(event, target) {
    const id = target.closest("[data-item-id]")?.dataset.itemId;
    const item = this.actor.items.get(id);
    if ( !item ) return;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("SSS.Item.DeleteTitle") },
      content: `<p>${game.i18n.format("SSS.Item.DeleteConfirm", { name: item.name })}</p>`
    });
    if ( confirmed ) await item.delete();
  }
}
