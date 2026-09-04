/**
 * Sheet for all three SFX-carrying Item types.
 *
 * One class rather than three: Distinctions, Signature Assets, and Talents differ only in
 * whether they have a die rating and what their die range is. A modder overriding one type
 * should not have to fork three near-identical classes.
 */

import { SSS } from "../config.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

/** Item types that carry a die rating, and the range each allows. */
const DIE_RANGES = {
  distinction: { min: SSS.DIE_MIN, max: SSS.DISTINCTION_DIE_MAX },
  signature: { min: SSS.SIGNATURE_DIE_MIN, max: SSS.DIE_MAX },
  complication: { min: SSS.COMPLICATION_DIE_MIN, max: SSS.DIE_MAX },
  trauma: { min: SSS.COMPLICATION_DIE_MIN, max: SSS.DIE_MAX }
};

export class SSSItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["sss", "sss-item"],
    position: { width: 500, height: 600 },
    window: { contentClasses: ["standard-form"], resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      addSFX: SSSItemSheet.#onAddSFX,
      deleteSFX: SSSItemSheet.#onDeleteSFX
    }
  };

  /** @override */
  static PARTS = {
    header: { template: "systems/super-sword-serial/templates/item/header.hbs" },
    // Details and SFX are one PART on purpose. Each PART gets its own scrollable region,
    // so splitting them gave the window two competing scrollbars.
    body: {
      template: "systems/super-sword-serial/templates/item/body.hbs",
      templates: ["systems/super-sword-serial/templates/parts/sfx-row.hbs"],
      scrollable: [""]
    }
  };

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item = this.item;

    context.system = item.system;
    context.systemFields = item.system.schema.fields;

    const range = DIE_RANGES[item.type];
    context.hasDie = !!range;
    context.dieRatings = range
      ? SSS.DIE_RATINGS.filter(f => f >= range.min && f <= range.max)
      : [];

    context.sfx = item.system.sfx ?? [];

    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation
      .enrichHTML(item.system.description, { relativeTo: item, secrets: item.isOwner });

    return context;
  }

  /* -------------------------------------------- */

  /**
   * Rebuild the SFX array from the submitted form.
   *
   * Inputs are named `system.sfx.0.name`, so expandObject turns them into an object keyed
   * by index rather than an array. ArrayField expects an actual array, so convert here.
   * Ordering is by numeric index, not object key order, because the latter is not reliable
   * once there are ten or more entries.
   *
   * @inheritDoc
   */
  _processFormData(event, form, formData) {
    const data = super._processFormData(event, form, formData);
    const sfx = data.system?.sfx;
    if ( sfx && !Array.isArray(sfx) ) {
      data.system.sfx = Object.entries(sfx)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([, value]) => value);
    }
    return data;
  }

  /* -------------------------------------------- */

  static async #onAddSFX() {
    const sfx = foundry.utils.deepClone(this.item.system.sfx ?? []);
    sfx.push({
      name: game.i18n.localize("SSS.SFX.NewName"),
      trigger: "",
      cost: 0,
      effect: ""
    });
    await this.item.update({ "system.sfx": sfx });
  }

  static async #onDeleteSFX(event, target) {
    const index = Number(target.dataset.sfxIndex);
    const sfx = foundry.utils.deepClone(this.item.system.sfx ?? []);
    if ( !(index in sfx) ) return;
    sfx.splice(index, 1);
    await this.item.update({ "system.sfx": sfx });
  }
}
