/**
 * Talent: a free-floating container for SFX.
 *
 * Deliberately has no die rating -- a Talent never adds a die of its own. It bends the
 * rules through its SFX, which manipulate the pool, the roll, or the result.
 */

import { sfxListField } from "./fields.mjs";

const fields = foundry.data.fields;

export class SSSTalent extends foundry.abstract.TypeDataModel {
  static LOCALIZATION_PREFIXES = ["SSS.Item.Talent"];

  /** @override */
  static defineSchema() {
    return {
      description: new fields.HTMLField({ required: true, blank: true, initial: "" }),
      sfx: sfxListField()
    };
  }
}
