// core/storageBackend.js
// Shared storage backend resolution helpers.

function envKey(component, suffix) {
  return `${component.toUpperCase()}_${suffix}`;
}

export function resolveStorageBackend(component, fallback = 'sqlite') {
  return (
    process.env[envKey(component, 'STORAGE_BACKEND')] ||
    process.env.UMAKRAFT_STORAGE_BACKEND ||
    (process.env.NODE_ENV === 'test' ? 'memory' : fallback)
  ).toLowerCase();
}

export function resolveSqlitePath(component) {
  return (
    process.env[envKey(component, 'SQLITE_PATH')] ||
    process.env.UMAKRAFT_SQLITE_PATH ||
    '/data/umakraft.sqlite'
  );
}
