/**
 * Trauma: a lasting consequence, rated d6-d12.
 *
 * Mechanically identical to a Complication -- deliberately a separate type rather than a
 * flag, so the sheet can list lasting harm apart from what a character picked up this
 * scene, and so a recovery roll cannot clear it by accident.
 *
 * ASSUMPTION worth revisiting: SSS has no named stress tracks, so Trauma is what a
 * Complication becomes when it would step past d12. If Trauma should instead have its own
 * source, only that trigger changes -- the schema stays as it is.
 */

import { SSS } from "../config.mjs";
import { ratedTraitSchema } from "./fields.mjs";

export class SSSTrauma extends foundry.abstract.TypeDataModel {
  static LOCALIZATION_PREFIXES = ["SSS.Item.Trauma"];

  /** @override */
  static defineSchema() {
    return ratedTraitSchema({ min: SSS.COMPLICATION_DIE_MIN, max: SSS.DIE_MAX });
  }
}
