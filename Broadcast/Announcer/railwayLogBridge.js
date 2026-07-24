// Broadcast/Announcer/railwayLogBridge.js
// Railway deployment webhook + log-drain delivery to the configured Discord
// operations channel. This module deliberately has no dependency on the
// Railway SDK: Railway sends ordinary HTTP requests to the public service.

const MAX_DISCORD_CONTENT = 1900;
const MAX_LOG_LINES_PER_BATCH = 24;
const LOG_FLUSH_MS = 2_000;
const MAX_QUEUE_SIZE = 500;

const logQueue = [];
let flushTimer = null;

const REDACTIONS = [
  [/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, '$1[REDACTED]'],
  [/(token|secret|password|api[_-]?key)(\s*[:=]\s*)[^\s,}"']+/gi, '$1$2[REDACTED]'],
  [/([?&](?:token|secret|key|password|signature)=)[^&\s]+/gi, '$1[REDACTED]'],
];

export function redactLogText(value) {
  let text = String(value ?? '');
  for (const [pattern, replacement] of REDACTIONS) {
    text = text.replace(pattern, replacement);
  }
  return text;
}

function _stringify(value) {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function _payloadText(payload) {
  if (payload == null) return '';
  if (typeof payload === 'string') return payload;
  if (Array.isArray(payload)) return payload.map(_payloadText).join('\n');

  const preferred = [
    payload.message,
    payload.text,
    payload.log,
    payload.line,
    payload.body,
    payload.data?.message,
    payload.data?.text,
    payload.data?.log,
  ].find(value => typeof value === 'string' && value.trim());

  return preferred ?? _stringify(payload);
}

function _firstValue(payload, keys, fallback = '') {
  for (const key of keys) {
    const value = key.split('.').reduce((current, part) => current?.[part], payload);
    if (value !== undefined && value !== null && String(value).trim()) return String(value);
  }
  return fallback;
}

function _isError(payload, text) {
  const level = _firstValue(payload, ['level', 'severity', 'data.level']).toLowerCase();
  return ['error', 'fatal', 'critical', 'panic'].includes(level)
    || /\b(fatal|critical|uncaught|unhandled|exception|error)\b/i.test(text);
}

function _formatLogLine(payload) {
  const text = redactLogText(_payloadText(payload)).trim();
  if (!text) return null;
  const service = _firstValue(payload, ['service', 'serviceName', 'data.service'], 'railway');
  const environment = _firstValue(payload, ['environment', 'environmentName', 'data.environment']);
  const prefix = _isError(payload, text) ? 'ERROR' : 'LOG';
  const scope = [service, environment].filter(Boolean).join('/');
  return `[${prefix}${scope ? ` ${scope}` : ''}] ${text}`;
}

function _splitContent(content) {
  const chunks = [];
  let remaining = content;
  while (remaining.length > MAX_DISCORD_CONTENT) {
    let cut = remaining.lastIndexOf('\n', MAX_DISCORD_CONTENT);
    if (cut < 1) cut = MAX_DISCORD_CONTENT;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).replace(/^\n/, '');
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

async function _send(client, channelId, content) {
  if (!client || !channelId) return { sent: false, reason: 'discord-not-configured' };
  const channel = await client.channels.fetch(channelId);
  for (const chunk of _splitContent(content)) {
    await channel.send({ content: chunk });
  }
  return { sent: true };
}

function _scheduleFlush(client, channelId) {
  if (flushTimer) return;
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    const lines = logQueue.splice(0, MAX_LOG_LINES_PER_BATCH);
    if (logQueue.length > 0) _scheduleFlush(client, channelId);
    if (lines.length === 0) return;

    try {
      await _send(client, channelId, `\`\`\`\n${lines.join('\n')}\n\`\`\``);
    } catch (error) {
      // Do not requeue indefinitely or write another log line that a Railway
      // drain could feed back into this endpoint.
      console.error(`[railway-log-bridge] Discord delivery failed: ${error.message}`);
    }
  }, LOG_FLUSH_MS);
  flushTimer.unref?.();
}

export function queueRailwayLog(payload, client, channelId) {
  const line = _formatLogLine(payload);
  if (!line) return { accepted: false, reason: 'empty-log' };

  if (logQueue.length >= MAX_QUEUE_SIZE) {
    logQueue.shift();
  }
  logQueue.push(line);
  _scheduleFlush(client, channelId);
  return { accepted: true, error: line.startsWith('[ERROR') };
}

function _eventValue(payload, keys, fallback = 'unknown') {
  return _firstValue(payload, keys, fallback);
}

export function formatRailwayDeployment(payload) {
  const status = _eventValue(payload, [
    'status',
    'deployment.status',
    'data.status',
    'event',
    'type',
  ]);
  const service = _eventValue(payload, [
    'service.name',
    'serviceName',
    'service',
    'data.service.name',
    'data.service',
  ]);
  const deploymentId = _eventValue(payload, [
    'deployment.id',
    'deploymentId',
    'id',
    'data.deployment.id',
  ], '');
  const environment = _eventValue(payload, [
    'environment.name',
    'environmentName',
    'environment',
    'data.environment.name',
  ], '');
  const commit = _eventValue(payload, [
    'commitSha',
    'commit.sha',
    'commit',
    'data.commitSha',
  ], '');
  const details = _payloadText(payload);

  return [
    `**[RAILWAY DEPLOYMENT] ${redactLogText(status).toUpperCase()}**`,
    `Service: ${redactLogText(service)}`,
    environment ? `Environment: ${redactLogText(environment)}` : '',
    deploymentId ? `Deployment: ${redactLogText(deploymentId)}` : '',
    commit ? `Commit: ${redactLogText(commit).slice(0, 12)}` : '',
    details && details !== _stringify(payload) ? `Details: ${redactLogText(details)}` : '',
  ].filter(Boolean).join('\n');
}

export async function announceRailwayDeployment(payload, client, channelId) {
  return _send(client, channelId, formatRailwayDeployment(payload));
}

export function getRailwayLogBridgeStats() {
  return {
    queuedLogs: logQueue.length,
    maxQueueSize: MAX_QUEUE_SIZE,
  };
}