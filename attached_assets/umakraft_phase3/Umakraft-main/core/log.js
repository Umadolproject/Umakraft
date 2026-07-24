// core/log.js
// Structured logger — used by all pipeline stages and Operation.
// Backward-compatible with prior string-only usage, now with optional context.

function emit(level, message, context = {}) {
  const base = {
    timestamp: new Date().toISOString(),
    level,
  };

  let entry;
  if (typeof message === 'object' && message !== null) {
    entry = { ...base, ...message };
    if (!entry.message) entry.message = 'log-event';
  } else {
    entry = { ...base, message };
  }

  if (context && typeof context === 'object' && Object.keys(context).length > 0) {
    entry = { ...entry, ...context };
  }

  const line = JSON.stringify(entry);
  switch (level) {
    case 'error': console.error(line); break;
    case 'warn': console.warn(line); break;
    default: console.log(line); break;
  }
}

const log = {
  info: (message, context = {}) => emit('info', message, context),
  warn: (message, context = {}) => emit('warn', message, context),
  error: (message, context = {}) => emit('error', message, context),
  debug: (message, context = {}) => emit('debug', message, context),
};

export default log;
