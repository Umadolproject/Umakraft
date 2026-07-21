/**
 * Validator — Validation Category 3: Blueprint Registration
 *
 * Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
 * Department: Validator — Stage 3, Workshop
 *
 * Confirms the deliverable's blueprintKey is registered in the Draftsman
 * blueprint registry and that name, trigger, and type match.
 */

import blueprints from '../../Draftsman/Blueprint/blueprint.js';

/**
 * @param {object} deliverable
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validateBlueprintRegistration(deliverable) {
  const { blueprintKey, blueprintName, trigger, type } = deliverable;
  const descriptor = blueprints[blueprintKey];

  if (!descriptor) {
    return { ok: false, reason: `blueprintKey "${blueprintKey}" is not registered in the Draftsman blueprint registry` };
  }

  if (descriptor.name !== blueprintName) {
    return {
      ok: false,
      reason: `blueprintName mismatch — registry has "${descriptor.name}", deliverable has "${blueprintName}"`,
    };
  }

  if (descriptor.trigger !== trigger) {
    return {
      ok: false,
      reason: `trigger mismatch for blueprintKey "${blueprintKey}" — registry has "${descriptor.trigger}", deliverable has "${trigger}"`,
    };
  }

  if (descriptor.type !== type) {
    return {
      ok: false,
      reason: `type mismatch for blueprintKey "${blueprintKey}" — registry has "${descriptor.type}", deliverable has "${type}"`,
    };
  }

  return { ok: true };
}
