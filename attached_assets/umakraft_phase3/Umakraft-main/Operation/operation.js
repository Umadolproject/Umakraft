// Operation/operation.js
// Entry point for the Operation health supervisor.
// Exports runOperationCycle() — registered in tasks/index.js on a 5-minute cron.
//
// Internal pipeline:
//   Investigator (observe) → Logger (format) → Manager (evaluate + route)
//
// Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
// Registry:  GOVERNANCE/PIPELINE_REGISTRY.md
// Version:   2.0.0

import { investigate } from './Investigator/investigator.js';
import { formatLogs }  from './Logger/logger.js';
import { evaluate }    from './Manager/manager.js';
import log             from '../core/log.js';

/**
 * Runs one complete Operation evaluation cycle:
 *   Investigator → Logger → Manager
 *
 * Called by the task scheduler every 5 minutes via tasks/index.js.
 *
 * @returns {Promise<import('./Manager/manager.js').HealthDecision|undefined>}
 */
export async function runOperationCycle() {
  log.info('[Operation] Evaluation cycle started.');

  try {
    const records  = await investigate();  // Investigator: collect facts
    const entries  = formatLogs(records);  // Logger: format + emit
    const decision = evaluate(entries);    // Manager: decide + route

    log.info(
      `[Operation] Cycle complete. decision=${decision.decision}` +
      ` subjects=[${decision.affectedSubjects.join(', ') || 'none'}]`
    );
    return decision;
  } catch (err) {
    log.error(`[Operation] Cycle failed with uncaught error: ${err.message}`);
  }
}
