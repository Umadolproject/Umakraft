// Distribution/Coordinator/actions/status.js
// Returns live bot health — uptime, last sync time, active circle count.
// Phase 4: includes pipeline stage throughput metrics.

import config            from '../../../AI/Configuration.js';
import { getServiceStatus } from '../../../AI/aiService.js';
import * as archive      from '../../../Broadcast/Archive/archive.js';
import { getMetrics }    from '../../../core/pipelineMetrics.js';

export async function status(payload) {
  const { interaction, client } = payload;

  const uptimeMs  = process.uptime() * 1000;
  const uptimeStr = formatUptime(uptimeMs);
  const guildCount = client?.guilds.cache.size ?? 0;
  const memoryMb   = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
  const aiStatus   = getServiceStatus();
  const archiveStats = await archive.getStats();

  const aiHealth = aiStatus.degraded
    ? `Degraded (${aiStatus.degradedReason ?? 'temporary'})`
    : aiStatus.model?.ready
      ? 'Ready'
      : 'Idle / lazy';

  const cacheSummary = `${aiStatus.cache.size}/${aiStatus.cache.maxSize} • H:${aiStatus.cache.hits} M:${aiStatus.cache.misses}`;
  const perfSummary  = [
    aiStatus.averageRetrievalMs  != null ? `retrieval ${aiStatus.averageRetrievalMs}ms avg`  : null,
    aiStatus.averageGenerationMs != null ? `generation ${aiStatus.averageGenerationMs}ms avg` : null,
    `timeouts ${aiStatus.generationTimeouts}`,
  ].filter(Boolean).join('\n');

  const broadcastSummary = archiveStats?.success
    ? [
        `total ${archiveStats.total}`,
        `incomplete ${archiveStats.incomplete}`,
        `dead letters ${archiveStats.deadLetters}`,
        `history ${archiveStats.historyEntries}`,
      ].join('\n')
    : 'Archive stats unavailable';

  // ── Phase 4: pipeline stage metrics ────────────────────────────────────────
  const metrics = getMetrics();
  const stageEntries = Object.entries(metrics);
  const pipelineSummary = stageEntries.length > 0
    ? stageEntries
        .map(([stage, m]) =>
          `${stage}: ${m.runs} runs · ${m.failures} failures · ${m.avgMs}ms avg`)
        .join('\n')
    : 'No pipeline runs since last restart';

  return {
    success: true,
    type: 'embed',
    ephemeral: true,
    result: {
      title: '🤖 Bot Status',
      fields: [
        { name: 'Uptime',    value: uptimeStr,         inline: true },
        { name: 'Guilds',    value: String(guildCount), inline: true },
        { name: 'Memory',    value: `${memoryMb} MB`,  inline: true },
        { name: 'AI Provider', value: config.aiProvider,       inline: true },
        { name: 'AI Health',   value: aiHealth,                inline: true },
        { name: 'AI Model',    value: aiStatus.model?.modelId ?? 'n/a', inline: false },
        { name: 'AI Cache',       value: cacheSummary,                    inline: false },
        { name: 'AI Performance', value: perfSummary || 'No AI requests yet', inline: false },
        {
          name: 'AI Runtime',
          value: [
            `requests ${aiStatus.requests}`,
            `validation failures ${aiStatus.validationFailures}`,
            `docs-only fallbacks ${aiStatus.docsOnlyFallbacks}`,
            `consecutive failures ${aiStatus.consecutiveFailures}`,
          ].join('\n'),
          inline: false,
        },
        { name: 'Broadcast Archive', value: broadcastSummary, inline: false },
        { name: 'Pipeline Stages',   value: pipelineSummary,  inline: false },
        { name: 'Last Sync', value: 'Pending (scheduler not wired)', inline: false },
        { name: 'Next Sync', value: 'Pending (scheduler not wired)', inline: false },
      ],
    },
    interaction,
  };
}

function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`;
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
