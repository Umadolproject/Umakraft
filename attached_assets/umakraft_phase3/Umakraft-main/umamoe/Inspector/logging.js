/**
 * Inspector — Logging
 *
 * Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
 * Department: Inspector — Stage 1, Umamoe
 *
 * Consistent structured log output for all Inspector events.
 */

const COMPONENT = 'inspector';

export function logAccepted(dataId) {
  console.log(
    `[${new Date().toISOString()}] INFO  ${COMPONENT}: data accepted — id=${dataId ?? 'unknown'}`
  );
}

export function logRejected(error, message) {
  console.warn(
    `[${new Date().toISOString()}] WARN  ${COMPONENT}: data rejected — ${error}: ${message}`
  );
}

export function logPassthrough(reason) {
  console.log(
    `[${new Date().toISOString()}] INFO  ${COMPONENT}: passing through failure envelope — ${reason}`
  );
}

export function logError(message) {
  console.error(
    `[${new Date().toISOString()}] ERROR ${COMPONENT}: ${message}`
  );
}
