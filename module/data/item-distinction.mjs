/**
 * Distinction: a prime-set trait rated d4-d8 that carries SFX.
 *
 * Always part of an action roll. A player may take d4 instead of the rated die to earn a
 * Plot Point -- that trade is universal, so it lives in the roll builder rather than being
 * written out as an SFX on every Distinction.
 */

import { SSS } from "../config.mjs";
import { dieField, sfxListField } from "./fields.mjs";

const fields = foundry.data.fields;

export class SSSDistinction extends foundry.abstract.TypeDataModel {
  static LOCALIZATION_PREFIXES = ["SSS.Item.Distinction"];

  /** @override */
  static defineSchema() {
    return {
      description: new fields.HTMLField({ required: true, blank: true, initial: "" }),
      die: dieField({ max: SSS.DISTINCTION_DIE_MAX, initial: SSS.DISTINCTION_DIE_MAX }),
      sfx: sfxListField()
    };
  }
}
