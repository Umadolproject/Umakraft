// core/log.js
// Structured logger — used by all pipeline stages and Operation.
//
// Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
// Standard:  GOVERNANCE/PIPELINE_OPERATIONS.md (Logging Standards)
//
// All output is JSON to stdout/stderr so it can be parsed by external tooling.
// No console.log calls — use log.info / log.warn / log.error / log.debug.

/**
 * Emit one structured log entry.
 *
 * @param {'info'|'warn'|'error'|'debug'} level
 * @param {string} message
 */
function emit(level, message) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };
  const line = JSON.stringify(entry);
  switch (level) {
    case 'error': console.error(line); break;
    case 'warn':  console.warn(line);  break;
    default:      console.log(line);   break;
  }
}

const log = {
  info:  (message) => emit('info',  message),
  warn:  (message) => emit('warn',  message),
  error: (message) => emit('error', message),
  debug: (message) => emit('debug', message),
};

export default log;
