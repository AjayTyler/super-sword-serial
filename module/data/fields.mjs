/**
 * Reusable schema building blocks.
 *
 * MODDERS: compose these rather than hand-rolling fields, so die constraints and the SFX
 * shape stay consistent everywhere.
 */

import { SSS } from "../config.mjs";

const fields = foundry.data.fields;

/**
 * A Cortex step die rating.
 *
 * Constrained with {min, max, step} rather than {choices} on purpose -- see config.mjs.
 *
 * @param {object} [options]
 * @param {number} [options.min]      Narrowest allowed die. Defaults to d4.
 * @param {number} [options.max]      Widest allowed die. Defaults to d12.
 * @param {number} [options.initial]  Starting rating. Defaults to `min`.
 * @returns {NumberField}
 */
export function dieField({ min = SSS.DIE_MIN, max = SSS.DIE_MAX, initial } = {}) {
  return new fields.NumberField({
    required: true,
    nullable: false,
    integer: true,
    min,
    max,
    step: 2,
    initial: initial ?? min
  });
}

/**
 * A single SFX: a named special effect that bends the rules when its trigger is met.
 *
 * SFX are text that players and the GM apply by hand. The system stores and displays them
 * but does not execute them -- Cortex SFX are too open-ended to automate generically, and
 * adding a new one should only require typing.
 *
 * @returns {SchemaField}
 */
export function sfxField() {
  return new fields.SchemaField({
    name: new fields.StringField({ required: true, blank: false, initial: "New SFX" }),
    trigger: new fields.StringField({ required: true, blank: true, initial: "" }),
    cost: new fields.NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 0 }),
    // Plain text, not HTML, on purpose. The manifest's htmlFields option builds a nested
    // object of paths server-side, so it cannot reach inside an ArrayField -- declaring
    // "sfx.effect" there would silently sanitize nothing. Rules text needs no markup.
    effect: new fields.StringField({ required: true, blank: true, initial: "" })
  });
}

/**
 * An ordered list of SFX, as carried by Distinctions, Signature Assets, and Talents.
 * @returns {ArrayField}
 */
export function sfxListField() {
  return new fields.ArrayField(sfxField());
}

/**
 * The schema shared by every freeform rated trait: Signature Assets, Complications, and
 * Trauma. Each is a named thing with a die rating, a description, and optional SFX; they
 * differ only in their die range and in what the fiction calls them.
 *
 * MODDERS: a new freeform rated trait type is a three-line data model calling this.
 *
 * @param {object} [options]
 * @param {number} [options.min]  Narrowest allowed die.
 * @param {number} [options.max]  Widest allowed die.
 * @returns {DataSchema}
 */
export function ratedTraitSchema({ min = SSS.DIE_MIN, max = SSS.DIE_MAX } = {}) {
  return {
    description: new fields.HTMLField({ required: true, blank: true, initial: "" }),
    die: dieField({ min, max }),
    sfx: sfxListField()
  };
}

/**
 * Build a SchemaField holding one rated trait per key in `keys`.
 * Used for the Roles and Attributes blocks on the Actor.
 *
 * @param {string[]} keys  Trait keys, e.g. SSS.ATTRIBUTES
 * @returns {SchemaField}
 */
export function ratedTraitsField(keys) {
  return new fields.SchemaField(Object.fromEntries(
    keys.map(key => [key, new fields.SchemaField({ die: dieField() })])
  ));
}
