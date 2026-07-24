// core/pipelineLogger.js
// Shared logger helper for pipeline components.

import log from './log.js';

export function createLogger(component, baseContext = {}) {
  return {
    info(message, context = {}) {
      log.info(message, { component, ...baseContext, ...context });
    },
    warn(message, context = {}) {
      log.warn(message, { component, ...baseContext, ...context });
    },
    error(message, context = {}) {
      log.error(message, { component, ...baseContext, ...context });
    },
    debug(message, context = {}) {
      log.debug(message, { component, ...baseContext, ...context });
    },
  };
}
