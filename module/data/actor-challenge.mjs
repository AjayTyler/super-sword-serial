/**
 * Challenge: the opposition. One type covers mobs, challenges, and crisis pools, because
 * mechanically they are the same thing.
 *
 * A challenge is a name plus a pool of core dice, where COUNT IS DURATION and SIZE IS
 * DIFFICULTY. A band of rogue goblins at 3d6 is three rounds of easy trouble; 5d12 is a
 * long, dangerous problem. Players wear a challenge down by removing and stepping down its
 * dice, so both numbers move during play.
 *
 * Signature Assets are embedded Items, exactly as on a PC -- a challenge rolls its core
 * dice plus any relevant Signature. Reusing the existing type means a Signature can be
 * dragged between a PC and a challenge and behaves identically.
 *
 * Rounds: players each act against the challenge, then it acts against one player, then a
 * new round begins. Only the round number is tracked here; who has acted is left to the
 * table, since it changes faster than it is worth clicking.
 *
 * Dice are NOT spent from the Doom Pool automatically. Challenges also arise as narrative
 * consequences, and other things feed them, so what goes into one is a GM decision.
 */

import { SSS } from "../config.mjs";

const fields = foundry.data.fields;

export class SSSActorChallenge extends foundry.abstract.TypeDataModel {
  static LOCALIZATION_PREFIXES = ["SSS.Actor.Challenge"];

  /** @override */
  static defineSchema() {
    return {
      description: new fields.HTMLField({ required: true, blank: true, initial: "" }),

      // An array rather than a keyed object: order is meaningless, the whole pool is
      // rewritten on every change anyway, and ids only need to be unique within it.
      dice: new fields.ArrayField(new fields.SchemaField({
        id: new fields.StringField({ required: true, blank: false }),
        faces: new fields.NumberField({
          required: true, nullable: false, integer: true,
          min: SSS.DIE_MIN, max: SSS.DIE_MAX, step: 2, initial: 6
        })
      })),

      round: new fields.NumberField({
        required: true, nullable: false, integer: true, min: 1, initial: 1
      })
    };
  }

  /* -------------------------------------------- */

  /** Signature Assets owned by this challenge. */
  get signatures() {
    return this.parent.itemTypes.signature;
  }

  /** Total dice remaining, which is what "duration" means in play. */
  get duration() {
    return this.dice.length;
  }

  /** Largest die, which is what "difficulty" means in play. */
  get difficulty() {
    return this.dice.reduce((max, d) => Math.max(max, d.faces), 0);
  }

  /* -------------------------------------------- */

  /**
   * Give new challenges a starter pool so the sheet is never blank.
   * Skipped for imports and duplicates, which bring their own.
   *
   * @override
   */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if ( allowed === false ) return false;
    if ( data.system?.dice?.length ) return;

    this.parent.updateSource({
      "system.dice": SSS.CHALLENGE_START.map(faces => ({
        id: foundry.utils.randomID(),
        faces
      }))
    });
  }
}
