/**
 * The Cortex dice pool roll.
 *
 * Cortex resolution does not map onto a dice formula, because which dice count is a player
 * decision made AFTER seeing the results, not a rule the engine can apply. So this class
 * rolls everything, then exposes an assignment step:
 *
 *   - Dice showing 1 are hitches. They are out; they can never be assigned.
 *   - The player picks `keepCount` dice (2 by default) whose values sum to the Total.
 *   - The player picks exactly one other die as the Effect Die. Its SIZE is what matters,
 *     not its rolled value.
 *   - Everything else is unused.
 *
 * Because assignment is free, taking your d12 as the Effect Die means it is not in your
 * Total. That tension is the interesting decision, so the system must not resolve it for
 * the player -- it only suggests a sensible default.
 *
 * IMPLEMENTATION NOTES for anyone extending this:
 *
 * Foundry's keep/drop machinery is not privileged. `DiceTerm#total` is a live getter that
 * sums results whose `active` flag is true, and the built-in `kh`/`kl` modifiers do nothing
 * more than set `active` and `discarded`. So we set those flags directly from player input
 * and recompute. See DiceTerm#total in client/dice/terms/dice.mjs.
 *
 * Roll#toJSON does NOT serialize `roll.data`, so all state that must survive a chat message
 * round-trip lives in `roll.options.cortex` or as extra properties on the result objects
 * (which are serialized by reference, so arbitrary keys persist).
 */

import { SSS } from "../config.mjs";

/** Assignment buckets a die can occupy. */
export const ASSIGNMENT = {
  UNUSED: null,
  TOTAL: "total",
  EFFECT: "effect"
};

export class CortexRoll extends foundry.dice.Roll {
  static CHAT_TEMPLATE = "systems/super-sword-serial/templates/chat/cortex-roll.hbs";

  /* -------------------------------------------- */
  /*  Construction                                */
  /* -------------------------------------------- */

  /**
   * Build a roll from a described pool.
   *
   * One Die per trait with `number: 1` is required, not stylistic: a Die with number > 1
   * shares a single options object across all its results, so per-die trait metadata would
   * be impossible.
   *
   * @param {CortexPoolEntry[]} pool         Dice to roll, each tied to a trait.
   * @param {object} [options]
   * @param {number} [options.keepCount]     Dice summed for the Total. SFX may raise this.
   * @param {string} [options.actorUuid]     Owner, so the card can award Plot Points.
   * @returns {CortexRoll}
   */
  static fromPool(pool, { keepCount = SSS.DEFAULT_KEEP_COUNT, actorUuid = null } = {}) {
    const { Die, OperatorTerm } = foundry.dice.terms;
    if ( !pool?.length ) throw new Error("Cannot build a Cortex roll from an empty pool.");

    const terms = [];
    for ( const [i, entry] of pool.entries() ) {
      if ( i ) terms.push(new OperatorTerm({ operator: "+" }));
      terms.push(new Die({
        number: 1,
        faces: entry.faces,
        options: {
          // Rendered by Foundry's default tooltip for free. Sanitised because flavor is
          // emitted into the formula as `1d8[flavor]`, and Roll.fromData re-parses that
          // formula when a chat message is rehydrated -- a trait named "Hero [of Legend]"
          // would otherwise corrupt the roll on reload.
          flavor: this.sanitizeFlavor(entry.traitName),
          // The unsanitised name, for display. Term options survive serialization.
          cortex: {
            traitId: entry.traitId ?? null,
            traitType: entry.traitType ?? null,
            label: entry.traitName ?? ""
          }
        }
      }));
    }

    // Assigning terms onto an empty roll avoids Roll.fromTerms, which round-trips the
    // generated formula through the parser -- a trait name containing [ ] or @ would
    // corrupt or throw there.
    const roll = new this("");
    roll.terms = terms;
    roll.resetFormula();
    roll.options.cortex = { keepCount, actorUuid, locked: false, effectFaces: null };
    return roll;
  }

  /**
   * Strip characters that carry meaning in a roll formula.
   *
   * `[` and `]` delimit flavor text; `@` introduces a data reference that would be
   * substituted away. Any of them inside a trait name breaks formula re-parsing.
   *
   * @param {string} name
   * @returns {string}
   */
  static sanitizeFlavor(name) {
    return String(name ?? "").replace(/[[\]@]/g, "").trim();
  }

  /* -------------------------------------------- */
  /*  Accessors                                   */
  /* -------------------------------------------- */

  /** Roll-level Cortex state. Lives in options because Roll#toJSON drops `data`. */
  get cortex() {
    return this.options.cortex ??= {
      keepCount: SSS.DEFAULT_KEEP_COUNT,
      actorUuid: null,
      locked: false,
      effectFaces: null
    };
  }

  /** The Die terms, in stable index order. Indices are the card's die identifiers. */
  get dieTerms() {
    return this.terms.filter(t => t instanceof foundry.dice.terms.Die);
  }

  /** Dice that rolled a 1 and are therefore out of play. */
  get hitches() {
    return this.dieTerms.filter(t => t.results[0]?.cortexHitch);
  }

  /** Dice eligible for assignment. */
  get eligible() {
    return this.dieTerms.filter(t => !t.results[0]?.cortexHitch);
  }

  /** Size of the chosen Effect Die, or null if none is assigned. */
  get effectFaces() {
    return this.cortex.effectFaces;
  }

  /** Whether the assignment has been committed and can no longer be changed. */
  get locked() {
    return this.cortex.locked === true;
  }

  /* -------------------------------------------- */
  /*  Resolution                                  */
  /* -------------------------------------------- */

  /**
   * Flag hitches and clear all assignments. Call once, immediately after evaluate().
   * @returns {this}
   */
  applyHitches() {
    for ( const term of this.dieTerms ) {
      const result = term.results[0];
      result.cortexHitch = result.result === 1;
      result.discarded = result.cortexHitch;
      result.active = false;
      result.cortexRole = ASSIGNMENT.UNUSED;
    }
    this.cortex.effectFaces = null;
    this._total = 0;
    return this;
  }

  /**
   * Suggest the common-case assignment: the highest values for the Total, then the largest
   * remaining die as the Effect Die.
   *
   * Note the two criteria differ. Total cares about rolled values; Effect cares about die
   * size. That is the rule, not an inconsistency.
   *
   * @returns {this}
   */
  suggestChoice() {
    const indexed = this.dieTerms
      .map((term, index) => ({ index, term, result: term.results[0] }))
      .filter(d => !d.result.cortexHitch);

    const byValue = [...indexed].sort((a, b) =>
      (b.result.result - a.result.result) || (b.term.faces - a.term.faces));
    const totalIndices = byValue.slice(0, this.cortex.keepCount).map(d => d.index);

    const remaining = indexed.filter(d => !totalIndices.includes(d.index));
    const byFaces = remaining.sort((a, b) =>
      (b.term.faces - a.term.faces) || (b.result.result - a.result.result));
    const effectIndex = byFaces.length ? byFaces[0].index : null;

    return this.setChoice({ totalIndices, effectIndex });
  }

  /**
   * Apply an explicit assignment, then recompute the Total.
   *
   * Silently ignores hitches, indices that do not exist, and Total picks beyond keepCount,
   * so a malformed request degrades rather than corrupting the roll.
   *
   * @param {object} choice
   * @param {number[]} [choice.totalIndices]  Die indices summed for the Total.
   * @param {number|null} [choice.effectIndex]  Die index used as the Effect Die.
   * @returns {this}
   */
  setChoice({ totalIndices = [], effectIndex = null } = {}) {
    const dice = this.dieTerms;

    for ( const term of dice ) {
      term.results[0].active = false;
      term.results[0].cortexRole = ASSIGNMENT.UNUSED;
    }
    this.cortex.effectFaces = null;

    const assignable = i => {
      const result = dice[i]?.results[0];
      return result && !result.cortexHitch ? result : null;
    };

    let kept = 0;
    for ( const i of totalIndices ) {
      if ( kept >= this.cortex.keepCount ) break;
      if ( i === effectIndex ) continue;
      const result = assignable(i);
      if ( !result ) continue;
      result.active = true;
      result.cortexRole = ASSIGNMENT.TOTAL;
      kept++;
    }

    if ( effectIndex !== null ) {
      const result = assignable(effectIndex);
      if ( result ) {
        // Deliberately left inactive: the Effect Die contributes its size, not its value,
        // so it must not be summed into the Total.
        result.active = false;
        result.cortexRole = ASSIGNMENT.EFFECT;
        this.cortex.effectFaces = dice[effectIndex].faces;
      }
    }

    this.#recomputeTotal();
    return this;
  }

  /**
   * Toggle one die's membership in the Total, leaving the Effect Die alone.
   * @param {number} index
   * @returns {this}
   */
  toggleTotal(index) {
    const current = this.#currentChoice();
    const set = new Set(current.totalIndices);

    if ( set.has(index) ) set.delete(index);
    else {
      if ( index === current.effectIndex ) current.effectIndex = null;
      // Dropping the oldest pick keeps clicking productive once the slots are full,
      // rather than silently doing nothing.
      if ( set.size >= this.cortex.keepCount ) set.delete([...set][0]);
      set.add(index);
    }

    return this.setChoice({ totalIndices: [...set], effectIndex: current.effectIndex });
  }

  /**
   * Set, or clear, the Effect Die.
   * @param {number} index
   * @returns {this}
   */
  toggleEffect(index) {
    const current = this.#currentChoice();
    const effectIndex = current.effectIndex === index ? null : index;
    const totalIndices = current.totalIndices.filter(i => i !== effectIndex);
    return this.setChoice({ totalIndices, effectIndex });
  }

  /** Freeze the assignment. @returns {this} */
  lock() {
    this.cortex.locked = true;
    return this;
  }

  /* -------------------------------------------- */
  /*  Internals                                   */
  /* -------------------------------------------- */

  /** Read the assignment back off the result objects. */
  #currentChoice() {
    const totalIndices = [];
    let effectIndex = null;
    this.dieTerms.forEach((term, index) => {
      const role = term.results[0].cortexRole;
      if ( role === ASSIGNMENT.TOTAL ) totalIndices.push(index);
      else if ( role === ASSIGNMENT.EFFECT ) effectIndex = index;
    });
    return { totalIndices, effectIndex };
  }

  /**
   * Roll#total is a cached value, not a getter over the terms, so it must be recomputed
   * whenever `active` flags change. _evaluateTotal joins term totals and evaluates them,
   * which throws on an empty expression -- hence the guard.
   */
  #recomputeTotal() {
    this._total = this.terms.length ? this._evaluateTotal() : 0;
  }

  /* -------------------------------------------- */
  /*  Chat rendering                              */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareChatRenderContext({ flavor, isPrivate = false, message, ...options } = {}) {
    const context = await super._prepareChatRenderContext({ flavor, isPrivate, ...options });

    const dice = this.dieTerms.map((term, index) => {
      const result = term.results[0];
      return {
        index,
        faces: term.faces,
        value: result.result,
        // Prefer the unsanitised label; fall back to flavor for rolls built by hand.
        trait: term.options.cortex?.label || term.options.flavor || "",
        traitType: term.options.cortex?.traitType ?? null,
        hitch: !!result.cortexHitch,
        role: result.cortexRole ?? null,
        inTotal: result.cortexRole === ASSIGNMENT.TOTAL,
        isEffect: result.cortexRole === ASSIGNMENT.EFFECT
      };
    });

    const keptCount = dice.filter(d => d.inTotal).length;

    return Object.assign(context, {
      dice,
      hitchCount: dice.filter(d => d.hitch).length,
      keptCount,
      keepCount: this.cortex.keepCount,
      cortexTotal: this.total,
      effectFaces: this.effectFaces,
      locked: this.locked,
      messageId: message?.id ?? null,
      // Only the roller and the GM may reassign, and only before it is committed.
      canChoose: !isPrivate && !this.locked && !!message
        && (message.isAuthor || game.user.isGM)
    });
  }
}

/**
 * @typedef CortexPoolEntry
 * @property {number} faces        Die size, e.g. 8 for a d8.
 * @property {string} traitName    Display label shown on the die.
 * @property {string} [traitId]    Source trait key or Item id, for later reference.
 * @property {string} [traitType]  "distinction" | "role" | "attribute" | "signature"
 */
