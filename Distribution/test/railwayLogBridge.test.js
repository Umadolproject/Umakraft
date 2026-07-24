import assert from 'node:assert/strict';
import {
  redactLogText,
  formatRailwayDeployment,
  queueRailwayLog,
  getRailwayLogBridgeStats,
} from '../../Broadcast/Announcer/railwayLogBridge.js';

assert.equal(
  redactLogText('Authorization: Bearer abc123 secret=hidden api_key=xyz'),
  'Authorization: Bearer [REDACTED] secret=[REDACTED] api_key=[REDACTED]',
);

const deployment = formatRailwayDeployment({
  status: 'SUCCESS',
  service: { name: 'umakraft' },
  deployment: { id: 'dep-123' },
  commitSha: 'abcdef1234567890',
});
assert.match(deployment, /\[RAILWAY DEPLOYMENT\] SUCCESS/);
assert.match(deployment, /Service: umakraft/);
assert.match(deployment, /Deployment: dep-123/);
assert.match(deployment, /Commit: abcdef123456/);

const queued = queueRailwayLog(
  { level: 'error', service: 'umakraft', message: 'database connection error' },
  null,
  'channel-1',
);
assert.equal(queued.accepted, true);
assert.equal(queued.error, true);
assert.equal(getRailwayLogBridgeStats().queuedLogs >= 1, true);

console.log('Railway log bridge tests passed');