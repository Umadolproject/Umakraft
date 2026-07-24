// core/health.js
// Aggregated runtime health snapshot — read by Operation/Investigator.
//
// Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
// Spec:      Operation/Investigator/Investigator.md

import { getAllTaskStats } from './taskRegistry.js';

/**
 * Returns the current runtime health snapshot.
 *
 * @returns {{
 *   uptime: number,
 *   heapUsed: number,
 *   heapTotal: number,
 *   rss: number,
 *   tasks: import('./taskRegistry.js').TaskStats[]
 * }}
 */
export function getHealth() {
  const mem = process.memoryUsage();
  return {
    uptime:    process.uptime(),
    heapUsed:  mem.heapUsed,
    heapTotal: mem.heapTotal,
    rss:       mem.rss,
    tasks:     getAllTaskStats(),
  };
}
