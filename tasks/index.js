// tasks/index.js
// Task scheduler — registers named cron tasks and runs them on a setInterval timer.
// Wraps each execution with safeRun() and records stats in core/taskRegistry.js
// so Operation/Investigator can observe scheduler health.
//
// Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
// Usage:
//   import { schedule, start } from './tasks/index.js';
//   schedule('operation', '*/5 * * * *', runOperationCycle);
//   start(client);  // called once from Distribution/Discord/events/ready.js

import { registerTask, recordTaskStart, recordTaskEnd } from '../core/taskRegistry.js';
import { safeRun } from '../core/errors.js';
import log from '../core/log.js';

/** @type {Map<string, { cronExpr: string, fn: Function, intervalId: NodeJS.Timeout|null }>} */
const _tasks = new Map();

// ─── Cron helpers ─────────────────────────────────────────────────────────────

/**
 * Estimate interval in milliseconds from a cron expression.
 * Supports the subset of cron expressions used in this project.
 *
 * Recognised patterns:
 *   "*\/N * * * *"  → every N minutes
 *   "0 *\/N * * *"  → every N hours
 *   "0 * * * *"    → every hour
 *
 * Falls back to 30 minutes for anything else.
 *
 * @param {string} cronExpr
 * @returns {number}  milliseconds
 */
function cronToMs(cronExpr) {
  if (!cronExpr) return 30 * 60 * 1000;
  const parts = cronExpr.trim().split(/\s+/);
  const minuteField = parts[0] ?? '*';
  const hourField   = parts[1] ?? '*';

  // */N in the minute field → every N minutes
  const minuteStep = minuteField.match(/^\*\/(\d+)$/);
  if (minuteStep) return parseInt(minuteStep[1], 10) * 60 * 1000;

  // */N in the hour field → every N hours
  const hourStep = hourField.match(/^\*\/(\d+)$/);
  if (hourStep) return parseInt(hourStep[1], 10) * 60 * 60 * 1000;

  // "0 * * * *" → hourly
  if (minuteField === '0' && hourField === '*') return 60 * 60 * 1000;

  // Default: 30 minutes
  return 30 * 60 * 1000;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Register a named scheduled task.
 * Must be called before start() — tasks registered after start() are not auto-started.
 *
 * @param {string}   name      — unique task identifier (appears in taskRegistry)
 * @param {string}   cronExpr  — cron expression (e.g. "*\/5 * * * *")
 * @param {Function} fn        — async function; receives the Discord client as its first arg
 */
export function schedule(name, cronExpr, fn) {
  if (_tasks.has(name)) {
    log.warn(`[tasks] task "${name}" already registered — skipping duplicate`);
    return;
  }
  registerTask(name, cronExpr);
  _tasks.set(name, { cronExpr, fn, intervalId: null });
  log.info(`[tasks] registered "${name}" (${cronExpr})`);
}

/**
 * Start all registered tasks.
 * Each task fires once immediately, then repeats on the cron interval.
 *
 * @param {object|null} client  — Discord.js Client, passed as first arg to every task fn
 */
export function start(client = null) {
  for (const [name, task] of _tasks) {
    if (task.intervalId) {
      log.warn(`[tasks] task "${name}" already running — skipping start`);
      continue;
    }

    const intervalMs = cronToMs(task.cronExpr);
    log.info(`[tasks] starting "${name}" — interval=${intervalMs}ms`);

    const run = async () => {
      log.info(`[tasks] tick — task="${name}"`);
      recordTaskStart(name);
      const { success, error } = await safeRun(() => task.fn(client), name);
      recordTaskEnd(name, { success, error });
    };

    // Fire immediately so the first health check happens at startup,
    // then repeat on the configured interval. run() is async — attach a catch
    // so a synchronous throw or unhandled rejection doesn't leak.
    run().catch((err) => log.error(`[tasks] first-run of "${name}" failed`, err));
    task.intervalId = setInterval(
      () => { run().catch((err) => log.error(`[tasks] scheduled run of "${name}" failed`, err)); },
      intervalMs
    );
  }
}

/**
 * Stop all running tasks.
 * Useful for graceful shutdown or in tests.
 */
export function stopAll() {
  for (const [name, task] of _tasks) {
    if (task.intervalId) {
      clearInterval(task.intervalId);
      task.intervalId = null;
      log.info(`[tasks] stopped "${name}"`);
    }
  }
}
