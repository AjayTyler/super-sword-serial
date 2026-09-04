/**
 * Data model barrel.
 *
 * MODDERS: register a new Actor or Item subtype by adding it here and to the
 * documentTypes block in system.json. Both are required -- Foundry validates subtypes
 * declared in the manifest against the models registered in code.
 */

import { SSSActorPC } from "./actor-pc.mjs";
import { SSSActorChallenge } from "./actor-challenge.mjs";
import { SSSDistinction } from "./item-distinction.mjs";
import { SSSSignature } from "./item-signature.mjs";
import { SSSTalent } from "./item-talent.mjs";
import { SSSComplication } from "./item-complication.mjs";
import { SSSTrauma } from "./item-trauma.mjs";

export { SSSActorPC, SSSActorChallenge, SSSDistinction, SSSSignature, SSSTalent, SSSComplication, SSSTrauma };

/** Actor subtype -> data model. Keys must match system.json documentTypes.Actor. */
export const actorDataModels = {
  pc: SSSActorPC,
  challenge: SSSActorChallenge
};

/** Item subtype -> data model. Keys must match system.json documentTypes.Item. */
export const itemDataModels = {
  distinction: SSSDistinction,
  signature: SSSSignature,
  talent: SSSTalent,
  complication: SSSComplication,
  trauma: SSSTrauma
};
