/**
 * Scene Traits: named complications and assets shared by everyone in the current scene.
 *
 * Functionally these are the same "rated trait" shape as a Complication or Signature Asset
 * (a name plus a die), but they belong to nobody's sheet -- any PC or Challenge may add one
 * to their pool when it applies. So they are stored on the Scene, not on an Actor: different
 * scenes have different complications/assets, and switching scenes should switch what is
 * on offer without any GM bookkeeping.
 *
 * Stored in a Scene flag rather than as embedded Items, because Scenes don't support
 * embedded Items in v14 -- and a flag is enough for a name, a die, and a category tag. v1
 * ships without SFX, matching the project's habit of shipping the small version first.
 *
 * MODDERS: everything that mutates the list goes through this module, same convention as
 * dice/pool.mjs and apps/doom-pool.mjs.
 */

import { SSS } from "../config.mjs";

const SYSTEM_ID = "super-sword-serial";
const KEY = "traits";

/** Stable application id, so the scene-control button can toggle the open window. */
export const SCENE_TRAITS_APP_ID = "sss-scene-traits";

/* -------------------------------------------- */
/*  Store                                       */
/* -------------------------------------------- */

/**
 * @typedef SceneTrait
 * @property {string} id
 * @property {string} name
 * @property {number} faces
 * @property {string} category  "complication" | "asset" -- display only.
 */

/**
 * The scene these controls act on: whatever the current client has loaded, falling back to
 * the world's active scene if canvas isn't ready yet (e.g. a sheet rendering before login
 * finishes loading the canvas).
 * @returns {Scene|null}
 */
function currentScene() {
  return canvas?.scene ?? game.scenes?.active ?? null;
}

/**
 * Read a scene's traits.
 * @param {Scene} [scene]  Defaults to the current scene.
 * @returns {SceneTrait[]}
 */
export function getSceneTraits(scene = currentScene()) {
  return scene?.getFlag(SYSTEM_ID, KEY) ?? [];
}

/**
 * Only the GM may write scene traits. Guarded here rather than only in the UI, since a
 * disabled button is a hint and not a boundary -- matches the Doom Pool's write guard.
 */
function setSceneTraits(scene, traits) {
  if ( !game.user.isGM || !scene ) return Promise.resolve();
  return scene.setFlag(SYSTEM_ID, KEY, traits);
}

export function addSceneTrait(scene, { name, faces, category }) {
  const traits = getSceneTraits(scene);
  traits.push({
    id: foundry.utils.randomID(),
    name,
    faces: clampFaces(faces),
    category: SSS.SCENE_TRAIT_CATEGORIES.includes(category) ? category : SSS.SCENE_TRAIT_CATEGORIES[0]
  });
  return setSceneTraits(scene, traits);
}

export function stepSceneTrait(scene, id, steps) {
  const traits = getSceneTraits(scene);
  const trait = traits.find(t => t.id === id);
  if ( !trait ) return Promise.resolve();
  trait.faces = clampFaces(trait.faces + (steps * 2));
  return setSceneTraits(scene, traits);
}

export function removeSceneTrait(scene, id) {
  const traits = getSceneTraits(scene).filter(t => t.id !== id);
  return setSceneTraits(scene, traits);
}

function clampFaces(faces) {
  const even = Math.round((Number(faces) || SSS.DIE_MIN) / 2) * 2;
  return Math.min(SSS.DIE_MAX, Math.max(SSS.DIE_MIN, even));
}

/* -------------------------------------------- */
/*  Application                                 */
/* -------------------------------------------- */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class SceneTraitsApp extends HandlebarsApplicationMixin(ApplicationV2) {

  /** @override */
  static DEFAULT_OPTIONS = {
    id: SCENE_TRAITS_APP_ID,
    classes: ["sss", "sss-scene-traits"],
    tag: "div",
    position: { width: 360, height: "auto" },
    window: { title: "SSS.SceneTraits.Title", icon: "fa-solid fa-clapperboard", resizable: false },
    actions: {
      addSceneTrait: SceneTraitsApp.#onAddTrait,
      stepSceneTrait: { handler: SceneTraitsApp.#onStepTrait, buttons: [0, 2] },
      removeSceneTrait: SceneTraitsApp.#onRemoveTrait
    }
  };

  /** @override */
  static PARTS = {
    body: {
      template: "systems/super-sword-serial/templates/apps/scene-traits.hbs",
      templates: ["systems/super-sword-serial/templates/parts/die-shape.hbs"]
    }
  };

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const scene = currentScene();
    context.sceneName = scene?.name ?? null;
    context.traits = getSceneTraits(scene);
    context.isGM = game.user.isGM;
    context.dieRatings = SSS.DIE_RATINGS;
    context.categories = SSS.SCENE_TRAIT_CATEGORIES;
    return context;
  }

  /** @inheritDoc */
  async _onRender(context, options) {
    await super._onRender(context, options);
    for ( const el of this.element.querySelectorAll("[data-action='stepSceneTrait']") ) {
      el.addEventListener("contextmenu", event => event.preventDefault());
    }
  }

  /* -------------------------------------------- */

  static async #onAddTrait() {
    const form = this.element;
    const nameInput = form.querySelector("[name='sceneTraitName']");
    const name = nameInput?.value.trim();
    if ( !name ) {
      ui.notifications.warn(game.i18n.localize("SSS.SceneTraits.NeedName"));
      return;
    }
    await addSceneTrait(currentScene(), {
      name,
      faces: Number(form.querySelector("[name='sceneTraitFaces']")?.value),
      category: form.querySelector("[name='sceneTraitCategory']")?.value
    });
  }

  static async #onStepTrait(event, target) {
    await stepSceneTrait(currentScene(), target.dataset.traitId, event.button === 2 ? -1 : 1);
  }

  static async #onRemoveTrait(event, target) {
    await removeSceneTrait(currentScene(), target.dataset.traitId);
  }
}

/**
 * Add the toggle to the token scene controls, visible to everyone.
 *
 * Read access is fine for players -- knowing what is complicating the scene is most of the
 * point. Write access is denied in the store and every edit control is hidden from non-GMs
 * in the template, so this stays read-only for them, same pattern as the Doom Pool.
 *
 * Call during init.
 */
export function registerSceneTraitsControl() {
  Hooks.on("getSceneControlButtons", controls => {
    if ( !controls.tokens ) return;
    controls.tokens.tools.sssSceneTraits = {
      name: "sssSceneTraits",
      title: "SSS.SceneTraits.Title",
      icon: "fa-solid fa-clapperboard",
      order: Object.keys(controls.tokens.tools).length,
      button: true,
      visible: true,
      onChange: () => {
        const existing = foundry.applications.instances.get(SCENE_TRAITS_APP_ID);
        if ( existing ) existing.close();
        else new SceneTraitsApp().render({ force: true });
      }
    };
  });
}

/**
 * Keep the app and every open PC/Challenge sheet in sync with the current scene's traits.
 *
 * A sheet reads scene traits fresh on every render (see actor-sheet.mjs / challenge-sheet.mjs
 * _prepareContext), so the fix here is just triggering that render at the right moments:
 * when this client's scene changes, and when the traits on this client's current scene change.
 *
 * Call during init.
 */
export function registerSceneTraitsHooks() {
  const rerenderOpenApps = () => {
    for ( const app of foundry.applications.instances.values() ) {
      if ( app instanceof SceneTraitsApp || app instanceof foundry.applications.sheets.ActorSheetV2 ) {
        app.render();
      }
    }
  };

  Hooks.on("updateScene", (scene, changes) => {
    if ( scene.id !== currentScene()?.id ) return;
    if ( !foundry.utils.hasProperty(changes, `flags.${SYSTEM_ID}.${KEY}`) ) return;
    rerenderOpenApps();
  });

  Hooks.on("canvasReady", rerenderOpenApps);
}
