// tasks/minerTask.js
// Daily miner task — fetches fresh circle data from uma.moe for all configured
// circles. Scheduled twice: at 18:00 and 18:30 Europe/Amsterdam, which is when
// uma.moe finishes its daily fan-count update cycle.

import { fetchCircle } from '../umamoe/Miner/miner.js';
import { getConfiguredCircles } from '../Broadcast/Broker/broker.js';
import log from '../core/log.js';

/**
 * Fetch the latest circle data from uma.moe for every configured circle.
 * Called by the task scheduler — receives the Discord client but does not use it directly.
 *
 * @param {object|null} _client  Discord.js Client (unused here; available for future use)
 */
export async function runMinerCycle(_client) {
  const circles = getConfiguredCircles();

  if (circles.length === 0) {
    log.warn('[miner-task] No configured circles — skipping fetch');
    return;
  }

  log.info(`[miner-task] Daily fetch started for ${circles.length} circle(s): [${circles.join(', ')}]`);

  const results = [];
  for (const circleId of circles) {
    const result = await fetchCircle(circleId);

    if (!result.success) {
      log.error(`[miner-task] Failed to fetch circle ${circleId}: ${result.error} — ${result.message}`);
      results.push({ circleId, success: false, error: result.error });
      continue;
    }

    const circle  = result.data?.circle;
    const members = result.data?.members ?? [];

    log.info(
      `[miner-task] Fetched circle "${circle?.name}" (${circleId}) — ` +
      `${circle?.member_count} members | ` +
      `club_rank=${result.data?.club_rank ?? 'n/a'} | ` +
      `attempts=${result.metadata?.attempts ?? 1}`,
    );

    if (members.length > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const dayIndex = new Date().getDate() - 1; // 0-based day of month
      const totals = members.map(m => ({
        trainer: m.trainer_name,
        fans: m.daily_fans?.[dayIndex] ?? 0,
      }));
      log.info(
        `[miner-task] Circle ${circleId} member fan totals for ${today}: ` +
        totals.map(t => `${t.trainer}=${t.fans.toLocaleString()}`).join(', '),
      );
    }

    results.push({ circleId, success: true, name: circle?.name, memberCount: circle?.member_count });
  }

  const succeeded = results.filter(r => r.success).length;
  log.info(`[miner-task] Daily fetch complete — ${succeeded}/${circles.length} circles OK`);
}
