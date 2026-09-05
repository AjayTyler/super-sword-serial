/**
 * Super Sword Serial — a Cortex Prime hack for Foundry VTT v14.
 *
 * Entry point. Registration happens here; the things being registered live in module/.
 */

import { SSS } from "./module/config.mjs";
import { actorDataModels, itemDataModels } from "./module/data/_module.mjs";
import { CortexRoll, registerChatListeners, rollCortexPool } from "./module/dice/_module.mjs";
import * as Pool from "./module/dice/pool.mjs";
import { SSSActorSheet } from "./module/sheets/actor-sheet.mjs";
import { SSSItemSheet } from "./module/sheets/item-sheet.mjs";
import { SSSChallengeSheet } from "./module/sheets/challenge-sheet.mjs";
import { parseDiceNotation, formatDiceNotation } from "./module/dice/notation.mjs";
import {
  DoomPoolApp, registerDoomPoolSetting, registerDoomPoolControl, getDoomPool
} from "./module/apps/doom-pool.mjs";
import {
  SceneTraitsApp, registerSceneTraitsControl, registerSceneTraitsHooks, getSceneTraits
} from "./module/apps/scene-traits.mjs";

export const SYSTEM_ID = "super-sword-serial";

/** Prefix for console output, so system messages are easy to filter. */
const LOG_PREFIX = "Super Sword Serial |";

Hooks.once("init", () => {
  console.log(`${LOG_PREFIX} initializing`);

  // Expose constants for macros, modules, and console poking.
  CONFIG.SSS = SSS;

  /**
   * Die shape glyph for a given size: {{sssDieIcon faces}}.
   * Falls back to the d6 shape so an unmapped size still renders something.
   */
  Handlebars.registerHelper("sssDieIcon", faces => SSS.DIE_ICONS[faces] ?? "fa-dice-d6");

  // Data models. Subtype keys must match the documentTypes block in system.json.
  Object.assign(CONFIG.Actor.dataModels, actorDataModels);
  Object.assign(CONFIG.Item.dataModels, itemDataModels);

  CONFIG.Item.typeIcons.distinction = "fa-solid fa-masks-theater";
  CONFIG.Item.typeIcons.signature = "fa-solid fa-wand-sparkles";
  CONFIG.Item.typeIcons.talent = "fa-solid fa-star";

  // Dice. Registering the class is what lets Roll.fromData rebuild a CortexRoll when a
  // chat message is rehydrated -- the lookup matches on constructor name.
  CONFIG.Dice.rolls.push(CortexRoll);
  registerChatListeners();

  // Sheets. Unregister the core defaults so ours become the only option.
  const { DocumentSheetConfig } = foundry.applications.apps;
  DocumentSheetConfig.unregisterSheet(Actor, "core", foundry.applications.sheets.ActorSheetV2);
  DocumentSheetConfig.registerSheet(Actor, SYSTEM_ID, SSSActorSheet, {
    types: ["pc"],
    makeDefault: true,
    label: "SSS.Sheets.Actor"
  });
  DocumentSheetConfig.registerSheet(Actor, SYSTEM_ID, SSSChallengeSheet, {
    types: ["challenge"],
    makeDefault: true,
    label: "SSS.Sheets.Challenge"
  });

  DocumentSheetConfig.unregisterSheet(Item, "core", foundry.applications.sheets.ItemSheetV2);
  DocumentSheetConfig.registerSheet(Item, SYSTEM_ID, SSSItemSheet, {
    types: ["distinction", "signature", "talent", "complication", "trauma"],
    makeDefault: true,
    label: "SSS.Sheets.Item"
  });

  // Doom Pool: a world setting plus a GM-only toggle on the token controls.
  registerDoomPoolSetting();
  registerDoomPoolControl();

  // Scene Traits: a per-scene flag plus a GM-only toggle, kept in sync with open sheets.
  registerSceneTraitsControl();
  registerSceneTraitsHooks();

  // Public API for macros and modules.
  game.sss = {
    CortexRoll,
    rollCortexPool,
    Pool,
    getDoomPool,
    openDoomPool: () => new DoomPoolApp().render({ force: true }),
    getSceneTraits,
    openSceneTraits: () => new SceneTraitsApp().render({ force: true }),
    parseDiceNotation,
    formatDiceNotation,

    /**
     * Create a challenge in one call, for building opposition mid-scene.
     * @example game.sss.createChallenge("Rogue Goblins", "3d6")
     */
    createChallenge: async (name, notation = "3d6") => {
      const faces = parseDiceNotation(notation);
      const actor = await getDocumentClass("Actor").create({
        name,
        type: "challenge",
        system: { dice: faces.map(f => ({ id: foundry.utils.randomID(), faces: f })) }
      });
      actor?.sheet.render({ force: true });
      return actor;
    }
  };
});

Hooks.once("ready", () => {
  console.log(`${LOG_PREFIX} ready`);
});
