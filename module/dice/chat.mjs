/**
 * Interactivity for the Cortex roll card.
 *
 * The assignment step happens after the roll is already in chat, so the card has to be
 * interactive and the decision has to persist. Both fall out of updating the ChatMessage:
 * ChatMessage#_onUpdate re-renders the message for every connected client and even
 * preserves expand/collapse state, so there is no manual re-render or socket work.
 *
 * A delegated listener is used rather than registering actions on ChatLog, so everything
 * about this card stays in one place.
 */

import { CortexRoll } from "./cortex-roll.mjs";

/** Handlers keyed by the data-action values used in templates/chat/cortex-roll.hbs. */
const ACTIONS = {
  sssToggleTotal: (roll, dataset) => roll.toggleTotal(Number(dataset.dieIndex)),
  sssToggleEffect: (roll, dataset) => roll.toggleEffect(Number(dataset.dieIndex)),
  sssSuggest: roll => roll.suggestChoice(),
  sssCommit: roll => roll.lock()
};

/**
 * Persist a mutated roll back onto its message.
 *
 * `content` is kept as a bare number on purpose: ChatMessage skips roll rendering entirely
 * if `content` already contains an HTML element, which would bypass CHAT_TEMPLATE.
 *
 * @param {ChatMessage} message
 * @param {CortexRoll} roll
 */
async function persist(message, roll) {
  await message.update({
    rolls: [roll],
    content: String(roll.total)
  });
}

/**
 * Handle a click on a card control.
 * @param {ChatMessage} message
 * @param {HTMLElement} button
 */
async function onCardClick(message, button) {
  const handler = ACTIONS[button.dataset.action];
  if ( !handler ) return;

  const roll = message.rolls.find(r => r instanceof CortexRoll);
  if ( !roll ) return;

  // Re-check permission here, not just in the template: a disabled button is a hint, not
  // a security boundary.
  if ( roll.locked || !(message.isAuthor || game.user.isGM) ) return;

  handler(roll, button.dataset);
  await persist(message, roll);
}

/** Register the chat listener. Call once, during init. */
export function registerChatListeners() {
  Hooks.on("renderChatMessageHTML", (message, html) => {
    const card = html.querySelector(".sss-roll");
    if ( !card ) return;

    card.addEventListener("click", event => {
      const button = event.target.closest("[data-action^='sss']");
      if ( !button || button.disabled ) return;
      // The whole .dice-roll wrapper carries data-action="expandRoll"; without this the
      // card would collapse on every click.
      event.stopPropagation();
      onCardClick(message, button);
    });
  });
}
