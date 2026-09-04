/**
 * Dice barrel, plus the convenience entry point the sheet will call in Phase 3.
 */

import { CortexRoll } from "./cortex-roll.mjs";
import { registerChatListeners } from "./chat.mjs";

export { CortexRoll, registerChatListeners };

/**
 * Roll a Cortex pool and post it to chat with NOTHING assigned.
 *
 * The assignment is deliberately left blank rather than pre-filled. Choosing which dice
 * make the Total and which becomes the Effect Die is the interesting decision in Cortex,
 * and a pre-filled answer both anchors the choice and makes an unconsidered roll look
 * identical to a considered one. The Suggest button is still there for when the obvious
 * split is wanted.
 *
 * @param {CortexPoolEntry[]} pool      Dice to roll.
 * @param {object} [options]
 * @param {Actor} [options.actor]       Rolling actor, used for the chat speaker.
 * @param {string} [options.flavor]     Card heading.
 * @param {number} [options.keepCount]  Dice summed for the Total.
 * @param {string} [options.messageMode]  A key of CONFIG.ChatMessage.modes. Note v14
 *                                        replaced the old `rollMode` with this.
 * @returns {Promise<ChatMessage>}
 */
export async function rollCortexPool(pool, { actor, flavor, keepCount, messageMode = "public" } = {}) {
  const roll = CortexRoll.fromPool(pool, {
    keepCount,
    actorUuid: actor?.uuid ?? null
  });

  await roll.evaluate();
  roll.applyHitches();

  return roll.toMessage({
    flavor,
    speaker: actor ? ChatMessage.getSpeaker({ actor }) : undefined
  }, { messageMode });
}
