// Distribution/Discord/events/ready.js
// Fires once when the bot connects to the Discord gateway and is ready.
// Registers all scheduled tasks and starts the task runner.

import { Events } from 'discord.js';
import { schedule, scheduleDailyAt, start } from '../../../tasks/index.js';
import { runOperationCycle } from '../../../Operation/operation.js';
import { runMinerCycle } from '../../../tasks/minerTask.js';
import { runGreetingAI } from '../../../tasks/greetingAI.js';
import { runSyncReminder } from '../../../tasks/reminder.js';
import { runAchievementCycle } from '../../../fantracking/achievements/achievements.js';
import { runMilestoneCycle } from '../../../fantracking/milestone/milestones.js';
import { runLeaderboardCycle } from '../../../fantracking/leaderboard/leaderboard.js';
import { runWarningCycle } from '../../../fantracking/warnings/warnings.js';
import { seedTrainerDbFromCircles } from '../../Coordinator/utils/seedTrainerDb.js';

export const name = Events.ClientReady;
export const once = true;

const MINER_TIMEZONE    = process.env.MINER_TIMEZONE    || 'Europe/Amsterdam';
const GREETING_TIMEZONE = process.env.GREETING_TIMEZONE || 'Asia/Tokyo';

export async function execute(client) {
  console.log(`[ready] Logged in as ${client.user.tag} (${client.user.id})`);
  console.log(`[ready] Serving ${client.guilds.cache.size} guild(s)`);

  // Register AI tasks in the taskRegistry for Operation health observation.
  // Cache warming runs asynchronously — fire-and-forget.
  try {
    const { registerAiTasks, warmEmbeddingCache } = await import('../../../AI/AIObserver.js');
    registerAiTasks();
    warmEmbeddingCache().catch(err =>
      console.warn('[ready] AI cache warming failed (non-fatal):', err?.message ?? err),
    );
  } catch (err) {
    console.warn('[ready] AI module not available — skipping AI health registration:', err?.message ?? err);
  }

  console.log('[ready] AI initialization is deferred until the first AI command.');

  // ── LearningManager — cognitive memory & learning layer ────────────────
  // Initialised lazily on first use via the global accessor.
  // Fire-and-forget — failure here must never prevent the bot from starting.
  try {
    const { LearningManager } = await import('../../../../LearningManager/src/LearningManager.js');
    const lmConfig = (await import('../../../AI/knowledge/learningManagerConfig.js')).default;
    global.__learningManager = new LearningManager(lmConfig);
    await global.__learningManager.init();
    console.log('[ready] LearningManager initialised');
  } catch (err) {
    console.warn('[ready] LearningManager not available (non-fatal):', err?.message ?? err);
    global.__learningManager = null;
  }

  // Seed the local trainer DB from circle members so autocomplete works immediately.
  // Fire-and-forget — a failure here must never prevent the bot from starting.
  seedTrainerDbFromCircles().catch(err =>
    console.warn('[ready] Trainer DB seed failed (non-fatal):', err?.message ?? err),
  );

  // Health / ops check every 5 minutes
  schedule('operation', '*/5 * * * *', runOperationCycle);

  // Daily uma.moe data fetch — 18:00 and 18:30 Amsterdam (uma.moe finishes updating by then)
  scheduleDailyAt('miner-1800', 18, 0,  MINER_TIMEZONE, runMinerCycle);
  scheduleDailyAt('miner-1830', 18, 30, MINER_TIMEZONE, runMinerCycle);

  // Milestone detection — every 10 minutes, checks all trainers' daily/monthly
  // fan gains against configured tiers and broadcasts via Announcer
  schedule('milestone', '*/10 * * * *', runMilestoneCycle);

  // Achievement detection — every 15 minutes, checks all trainers for
  // fan/sync/streak achievements (lifetime — each fires once ever)
  schedule('achievement', '*/15 * * * *', runAchievementCycle);

  // Leaderboard announcements — end-of-period, scope-specific tone
  // Daily: just before midnight so the day's board is final
  scheduleDailyAt('leaderboard-daily',   23, 55, GREETING_TIMEZONE, (c) => runLeaderboardCycle('daily', c));
  // Weekly: Sunday night — the week is done (JST-aware weekday check)
  scheduleDailyAt('leaderboard-weekly',  23, 55, GREETING_TIMEZONE, (c) => {
    const jstDay = new Date(Date.now() + 9 * 3600000).getUTCDay(); // JST weekday
    if (jstDay === 0) runLeaderboardCycle('weekly', c);            // Sunday
  });
  // Monthly: 1st of the month at 00:05 — recap of the previous month (JST-aware date check)
  scheduleDailyAt('leaderboard-monthly',  0,  5, GREETING_TIMEZONE, (c) => {
    const jstDate = new Date(Date.now() + 9 * 3600000).getUTCDate(); // JST day-of-month
    if (jstDate === 1) runLeaderboardCycle('monthly', c);
  });

  // Sync reminders — fire during active hours to nudge trainers to sync
  scheduleDailyAt('reminder-sync-10', 10, 0, GREETING_TIMEZONE, runSyncReminder);
  scheduleDailyAt('reminder-sync-18', 18, 0, GREETING_TIMEZONE, runSyncReminder);

  // Warning detection — every 30 minutes, checks all trainers for fan deficits.
  // DM-ONLY delivery. Per-trainer dedup (one warning per tier group per day).
  schedule('warning', '*/30 * * * *', runWarningCycle);

  // AI greetings — 4 time slots per day, each with a slot-specific tone.
  // Times are in the configured GREETING_TIMEZONE (default: Asia/Tokyo).
  // Each slot calls ContentGenerator with a different timeSlot variable.
  scheduleDailyAt('greeting-morning',   9, 0, GREETING_TIMEZONE, (c) => runGreetingAI(c, 'morning'));
  scheduleDailyAt('greeting-noon',     12, 0, GREETING_TIMEZONE, (c) => runGreetingAI(c, 'noon'));
  scheduleDailyAt('greeting-night',    21, 0, GREETING_TIMEZONE, (c) => runGreetingAI(c, 'night'));
  scheduleDailyAt('greeting-midnight',  0, 0, GREETING_TIMEZONE, (c) => runGreetingAI(c, 'midnight'));

  start(client);
}
