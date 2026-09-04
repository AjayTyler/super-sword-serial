/**
 * Complication: a freeform negative trait attached to a character, rated d6-d12.
 *
 * SSS uses Complications in place of Cortex's named stress tracks, so they carry the whole
 * consequence load. They are created and stepped up by hitches and effect dice, stepped
 * down or removed by a successful recovery roll, and may be added to a roll when an SFX
 * says so -- hence the same shape as a Signature Asset.
 *
 * A Complication that would step past d12 becomes Trauma. See item-trauma.mjs.
 */

import { SSS } from "../config.mjs";
import { ratedTraitSchema } from "./fields.mjs";

export class SSSComplication extends foundry.abstract.TypeDataModel {
  static LOCALIZATION_PREFIXES = ["SSS.Item.Complication"];

  /** @override */
  static defineSchema() {
    return ratedTraitSchema({ min: SSS.COMPLICATION_DIE_MIN, max: SSS.DIE_MAX });
  }
}
