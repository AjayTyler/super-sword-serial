/**
 * Player character sheet.
 *
 * Layout is a tabbed body plus a persistent pool tray pinned to the bottom. The tray sits
 * outside the tab sections so a player can add dice from any tab without losing sight of
 * what they have assembled.
 *
 * MODDERS: sections are one PART each, so you can replace or reorder a section by swapping
 * a template path. The repeated units -- a trait row, a die selector -- are partials in
 * templates/parts/, so a restyle usually means editing one file.
 */

import { SSS } from "../config.mjs";
import { rollCortexPool } from "../dice/_module.mjs";
import * as Pool from "../dice/pool.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export class SSSActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  /** @override */
  static DEFAULT_OPTIONS = {
    // Appended to ["application", "sheet"] -- DEFAULT_OPTIONS arrays concatenate up the
    // inheritance chain rather than replacing.
    classes: ["sss", "sss-actor"],
    position: { width: 620, height: 720 },
    window: { contentClasses: ["standard-form"], resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      addTraitDie: SSSActorSheet.#onAddTraitDie,
      addDistinctionAsD4: SSSActorSheet.#onAddDistinctionAsD4,
      addLooseDie: SSSActorSheet.#onAddLooseDie,
      // buttons: [0, 2] is required for right-click to reach the handler at all --
      // ApplicationV2 dispatches only button 0 unless an action opts in.
      stepPoolDie: { handler: SSSActorSheet.#onStepPoolDie, buttons: [0, 2] },
      removePoolDie: SSSActorSheet.#onRemovePoolDie,
      clearPool: SSSActorSheet.#onClearPool,
      rollPool: SSSActorSheet.#onRollPool,
      adjustPlotPoints: { handler: SSSActorSheet.#onAdjustPlotPoints, buttons: [0, 2] },
      createItem: SSSActorSheet.#onCreateItem,
      editItem: SSSActorSheet.#onEditItem,
      deleteItem: SSSActorSheet.#onDeleteItem
    }
  };

  /** @override */
  static PARTS = {
    header: { template: "systems/super-sword-serial/templates/actor/header.hbs" },
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    traits: {
      template: "systems/super-sword-serial/templates/actor/traits.hbs",
      templates: [
        "systems/super-sword-serial/templates/parts/trait-row.hbs",
        "systems/super-sword-serial/templates/parts/item-trait-row.hbs"
      ],
      scrollable: [""]
    },
    biography: {
      template: "systems/super-sword-serial/templates/actor/biography.hbs",
      scrollable: [""]
    },
    pool: {
      template: "systems/super-sword-serial/templates/actor/pool-tray.hbs",
      templates: ["systems/super-sword-serial/templates/parts/die-shape.hbs"]
    }
  };

  /** @override */
  static TABS = {
    primary: {
      tabs: [
        { id: "traits", icon: "fa-solid fa-dice-d10" },
        { id: "biography", icon: "fa-solid fa-feather" }
      ],
      initial: "traits",
      labelPrefix: "SSS.Tabs"
    }
  };

  /* -------------------------------------------- */
  /*  Context                                     */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;

    // super provides `fields` for the DOCUMENT schema only; system fields must be added.
    context.system = actor.system;
    context.systemFields = actor.system.schema.fields;

    context.dieRatings = SSS.DIE_RATINGS;

    context.roles = this.#ratedTraits("roles", SSS.ROLES);
    context.attributes = this.#ratedTraits("attributes", SSS.ATTRIBUTES);

    context.distinctions = actor.itemTypes.distinction;
    context.signatures = actor.itemTypes.signature;
    context.talents = actor.itemTypes.talent;
    context.complications = actor.itemTypes.complication;
    context.traumas = actor.itemTypes.trauma;

    context.pool = Pool.getPool(actor);
    context.poolCount = context.pool.entries.length;

    context.enrichedBiography = await foundry.applications.ux.TextEditor.implementation
      .enrichHTML(actor.system.biography, { relativeTo: actor, secrets: actor.isOwner });

    return context;
  }

  /** @inheritDoc */
  async _preparePartContext(partId, context, options) {
    const partContext = await super._preparePartContext(partId, context, options);
    if ( partId in (partContext.tabs ?? {}) ) partContext.tab = partContext.tabs[partId];
    return partContext;
  }

  /**
   * Shape a rated-trait block for rendering.
   * @param {string} group  Schema key, "roles" or "attributes".
   * @param {string[]} keys
   * @returns {object[]}
   */
  #ratedTraits(group, keys) {
    const fields = this.actor.system.schema.fields[group].fields;
    return keys.map(key => ({
      key,
      path: `system.${group}.${key}.die`,
      die: this.actor.system[group][key].die,
      label: game.i18n.localize(fields[key].fields.die.label)
        // Fall back to the group label when a modder adds a key without a die label.
        || key,
      name: game.i18n.localize(`SSS.Actor.PC.FIELDS.${group}.${key}.label`)
    }));
  }

  /* -------------------------------------------- */
  /*  Submission                                  */
  /* -------------------------------------------- */

  /**
   * Route embedded Item edits away from the Actor update.
   *
   * The sheet renders die selectors for Distinctions and Signature Assets, which are Items.
   * Those inputs are named `items.<id>.system.die` so they arrive here nested under `items`,
   * but that is not valid Actor update syntax -- an Actor's `items` collection is readonly
   * and has to be changed through updateEmbeddedDocuments.
   *
   * @inheritDoc
   */
  async _processSubmitData(event, form, submitData, options = {}) {
    const itemChanges = submitData.items;
    delete submitData.items;

    if ( itemChanges ) {
      const updates = Object.entries(itemChanges)
        .filter(([id]) => this.actor.items.has(id))
        .map(([id, changes]) => ({ _id: id, ...foundry.utils.flattenObject(changes) }));
      if ( updates.length ) await this.actor.updateEmbeddedDocuments("Item", updates);
    }

    if ( !foundry.utils.isEmpty(submitData) ) {
      await super._processSubmitData(event, form, submitData, options);
    }
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onRender(context, options) {
    // super disables inputs for users without edit permission -- do not skip it.
    await super._onRender(context, options);
    this._dragDrop.bind(this.element);

    // Right-click steps dice down and spends Plot Points. The browser would also open its
    // own context menu on those controls, so suppress it where we use button 2.
    for ( const el of this.element.querySelectorAll("[data-action='stepPoolDie'], [data-action='adjustPlotPoints']") ) {
      el.addEventListener("contextmenu", event => event.preventDefault());
    }
  }

  /* -------------------------------------------- */
  /*  Pool actions                                */
  /* -------------------------------------------- */

  /** Add a rated trait, or an Item's rated die, to the pending pool. */
  static async #onAddTraitDie(event, target) {
    const { faces, traitName, traitId, traitType } = target.dataset;
    await Pool.addDie(this.actor, {
      faces: Number(faces),
      traitName,
      traitId: traitId ?? null,
      traitType: traitType ?? null
    });
  }

  /**
   * Add a Distinction at d4 and award a Plot Point.
   *
   * The trade is universal in this hack, so it lives here rather than as an SFX written
   * out on every Distinction.
   */
  static async #onAddDistinctionAsD4(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    if ( !item ) return;
    await Pool.addDie(this.actor, {
      faces: SSS.DIE_MIN,
      traitName: item.name,
      traitId: item.id,
      traitType: "distinction"
    });
    await this.actor.update({ "system.plotPoints": this.actor.system.plotPoints + 1 });
    ui.notifications.info(game.i18n.format("SSS.Pool.TookD4", { name: item.name }));
  }

  /** Add a die not tied to any trait, for SFX that simply grant one. */
  static async #onAddLooseDie(event, target) {
    await Pool.addDie(this.actor, {
      faces: Number(target.dataset.faces) || SSS.DIE_MIN,
      traitName: game.i18n.localize("SSS.Pool.LooseDie"),
      traitType: "loose"
    });
  }

  /** Step a pooled die up or down. Left click steps up, right click steps down. */
  static async #onStepPoolDie(event, target) {
    const steps = event.button === 2 ? -1 : 1;
    await Pool.stepDie(this.actor, target.dataset.entryId, steps);
  }

  static async #onRemovePoolDie(event, target) {
    await Pool.removeDie(this.actor, target.dataset.entryId);
  }

  static async #onClearPool() {
    await Pool.clearPool(this.actor);
  }

  /** Roll the pending pool, then empty it. */
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
      flavor: game.i18n.localize("SSS.Pool.RollFlavor")
    });

    await Pool.clearPool(this.actor);
  }

  /* -------------------------------------------- */
  /*  Other actions                               */
  /* -------------------------------------------- */

  /** Adjust Plot Points. Left click adds, right click spends. */
  static async #onAdjustPlotPoints(event) {
    const delta = event.button === 2 ? -1 : 1;
    const next = Math.max(0, this.actor.system.plotPoints + delta);
    await this.actor.update({ "system.plotPoints": next });
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
