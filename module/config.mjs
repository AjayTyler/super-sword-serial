/**
 * System constants.
 *
 * MODDERS: this is the first file to edit. Renaming or adding a Role or Attribute here
 * updates the data model, the sheet, and the roll builder together. After changing a key,
 * add a matching label in lang/en.json under SSS.Actor.PC.FIELDS.
 */

export const SSS = {};

/**
 * Prime set: Roles. Always part of an action roll.
 * Keys are stored in the data model; labels come from lang/en.json.
 * @type {string[]}
 */
SSS.ROLES = ["warrior", "sage", "rogue", "bard"];

/**
 * Prime set: Attributes. Always part of an action roll.
 * @type {string[]}
 */
SSS.ATTRIBUTES = ["agility", "might", "grits", "savvy", "wits", "cool"];

/**
 * Valid die ratings, in step order. Cortex steps dice by 2 (d4 -> d6 -> d8 -> d10 -> d12).
 *
 * Note the data model constrains dice with {min, max, step} rather than {choices}. That is
 * deliberate: Active Effects re-validate their result against the field and silently revert
 * if it fails, so a choices-constrained field would break any SFX that steps a die.
 * @type {number[]}
 */
SSS.DIE_RATINGS = [4, 6, 8, 10, 12];

/** Narrowest and widest die any trait may use. */
SSS.DIE_MIN = 4;
SSS.DIE_MAX = 12;

/**
 * Font Awesome glyph per die size, used wherever a die is drawn as a shape.
 *
 * These are font glyphs rather than the SVGs in Foundry's icons/svg/, so they inherit
 * colour and scale with font size -- which means they follow the user's theme and font
 * scale for free.
 *
 * MODDERS: adding a die size means adding a glyph here. Anything missing falls back to
 * the d6 shape rather than rendering nothing.
 */
SSS.DIE_ICONS = {
  4: "fa-dice-d4",
  6: "fa-dice-d6",
  8: "fa-dice-d8",
  10: "fa-dice-d10",
  12: "fa-dice-d12"
};

/** Distinctions are rated d4-d8. A d4 Distinction earns a Plot Point (see the profile, section 5). */
SSS.DISTINCTION_DIE_MAX = 8;

/** Signature Assets are rated d6-d12 -- this hack has no d4 Signature. */
SSS.SIGNATURE_DIE_MIN = 6;

/** Complications and Trauma are rated d6-d12, as in core Cortex. */
SSS.COMPLICATION_DIE_MIN = 6;

/** Starting dice in a fresh Doom Pool. Two d6 is the common Cortex opener. */
SSS.DOOM_POOL_START = [6, 6];

/**
 * Scene-wide complications and assets are tagged with one of these for display only --
 * mechanically both are just a die any actor may add to their pool, so there is no separate
 * schema or logic per category.
 * @type {string[]}
 */
SSS.SCENE_TRAIT_CATEGORIES = ["complication", "asset"];

/**
 * Starting pool for a new Challenge. Count is duration, size is difficulty, so 3d6 is a
 * short, easy problem -- a sensible blank slate.
 */
SSS.CHALLENGE_START = [6, 6, 6];

/** Typical challenge size range, for the sheet's hint text. */
SSS.CHALLENGE_DICE_TYPICAL = "3-5";

/** Number of blank Distinctions a new PC starts with. */
SSS.DEFAULT_DISTINCTION_COUNT = 3;

/** Plot Points a new PC starts with. */
SSS.STARTING_PLOT_POINTS = 1;

/** Dice kept and summed for the Total by default. SFX may raise this. */
SSS.DEFAULT_KEEP_COUNT = 2;
