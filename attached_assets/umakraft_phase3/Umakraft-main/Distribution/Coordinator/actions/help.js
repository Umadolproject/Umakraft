// Distribution/Coordinator/actions/help.js
// Renders the help image via Workshop using the 'help' blueprint.
// No trainer lookup — passes a static payload directly to Workshop/produce().

import { produce, claimDeliverable } from '../../../Workshop/pipeline.js';

export async function help(payload) {
  const { interaction } = payload;

  const fabricatorInput = {
    blueprintKey: 'help',
    meta: {
      generatedAt: new Date().toISOString(),
    },
    // The help blueprint renders a static command list — no dynamic data needed.
    // If the blueprint template requires a command list, pass it here.
  };

  const produced = await produce(fabricatorInput);
  if (!produced.success) {
    return {
      success:   false,
      failedAt:  'Workshop',
      error:     produced.error ?? 'FABRICATOR_RENDER_ERROR',
      message:   produced.message ?? 'Help image render failed',
      retriable: false,
      interaction,
    };
  }

  const claimed = await claimDeliverable(produced.terminalId);
  if (!claimed.success) {
    return {
      success:   false,
      failedAt:  'Terminal',
      error:     claimed.error ?? 'TERMINAL_NOT_FOUND',
      message:   claimed.message ?? 'Terminal claim failed',
      retriable: false,
      interaction,
    };
  }

  return {
    success:      true,
    terminalId:   produced.terminalId,
    blueprintKey: 'help',
    png:          claimed.deliverable.png,
    meta:         claimed.deliverable.meta,
    interaction,
  };
}
