/**
 * Signature Asset: narratively-justified equipment, allies, or features rated d6-d12.
 *
 * Bonus rather than prime -- added to a pool only when the player can justify relevance.
 * This hack has no d4 Signature Asset.
 */

import { SSS } from "../config.mjs";
import { ratedTraitSchema } from "./fields.mjs";

export class SSSSignature extends foundry.abstract.TypeDataModel {
  static LOCALIZATION_PREFIXES = ["SSS.Item.Signature"];

  /** @override */
  static defineSchema() {
    return ratedTraitSchema({ min: SSS.SIGNATURE_DIE_MIN, max: SSS.DIE_MAX });
  }
}
