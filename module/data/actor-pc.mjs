/**
 * Player character data model.
 *
 * Roles and Attributes live here because they are plain rated dice with fixed names.
 * Distinctions, Signature Assets, and Talents are embedded Items instead -- they carry
 * descriptions and SFX, so they need their own sheets and compendium reuse.
 */

import { SSS } from "../config.mjs";
import { ratedTraitsField } from "./fields.mjs";

const fields = foundry.data.fields;

export class SSSActorPC extends foundry.abstract.TypeDataModel {
  static LOCALIZATION_PREFIXES = ["SSS.Actor.PC"];

  /** @override */
  static defineSchema() {
    return {
      plotPoints: new fields.NumberField({
        required: true,
        nullable: false,
        integer: true,
        min: 0,
        initial: SSS.STARTING_PLOT_POINTS
      }),
      roles: ratedTraitsField(SSS.ROLES),
      attributes: ratedTraitsField(SSS.ATTRIBUTES),
      biography: new fields.HTMLField({ required: true, blank: true, initial: "" })
    };
  }

  /* -------------------------------------------- */

  /** Distinction Items owned by this actor. */
  get distinctions() {
    return this.parent.itemTypes.distinction;
  }

  /** Signature Asset Items owned by this actor. */
  get signatures() {
    return this.parent.itemTypes.signature;
  }

  /** Talent Items owned by this actor. */
  get talents() {
    return this.parent.itemTypes.talent;
  }

  /* -------------------------------------------- */

  /**
   * Give brand-new PCs their blank Distinctions so the sheet is never empty.
   *
   * Skipped when the incoming data already carries Items, which is how duplicates,
   * compendium imports, and JSON imports arrive -- those already have their own.
   *
   * @override
   */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if ( allowed === false ) return false;
    if ( data.items?.length ) return;

    const label = game.i18n.localize("SSS.Item.Distinction.NewName");
    const distinctions = Array.fromRange(SSS.DEFAULT_DISTINCTION_COUNT).map(() => ({
      name: label,
      type: "distinction"
    }));
    this.parent.updateSource({ items: distinctions });
  }
}
