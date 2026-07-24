// Distribution/Coordinator/utils/seedTrainerDb.js
// Fetches all members from every configured circle and upserts them into
// the local trainer DB so autocomplete works immediately on startup.
//
// The circle API returns members[].{ viewer_id, trainer_name } — viewer_id
// is the same numeric trainer ID used by all other Uma.moe endpoints.

import { fetchCircle } from '../../../umamoe/Miner/miner.js';
import { upsertTrainers } from './trainerDb.js';
import { CONFIGURED_CIRCLES } from '../../../core/botConfig.js';

function log(level, msg, ctx = {}) {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), level, component: 'trainerDb.seed', message: msg, ...ctx }));
}

/**
 * Seed the trainer DB from one circle.
 *
 * @param {string|number} circleId
 * @returns {Promise<number>} number of trainers upserted
 */
async function seedCircle(circleId) {
  const result = await fetchCircle(circleId);

  if (!result?.success) {
    log('warn', `circle fetch failed — skipping seed`, { circleId, error: result?.error });
    return 0;
  }

  const members = result.data?.members ?? [];
  const valid = members.filter(m => m?.viewer_id != null && m?.trainer_name);

  if (!valid.length) {
    log('warn', `no members found in circle response`, { circleId });
    return 0;
  }

  await upsertTrainers(valid.map(m => ({
    id:   String(m.viewer_id),
    name: String(m.trainer_name),
  })));

  log('info', `seeded ${valid.length} trainers from circle`, { circleId });
  return valid.length;
}

/**
 * Seed the trainer DB from all CONFIGURED_CIRCLES.
 * Safe to call on every startup — upsert is idempotent.
 *
 * @returns {Promise<void>}
 */
export async function seedTrainerDbFromCircles() {
  const circles = CONFIGURED_CIRCLES;
  if (!circles.length) {
    log('warn', 'no CONFIGURED_CIRCLES — skipping trainer DB seed');
    return;
  }

  log('info', `seeding trainer DB from ${circles.length} circle(s)`, { circles });

  let total = 0;
  for (const circleId of circles) {
    total += await seedCircle(circleId);
  }

  log('info', `trainer DB seed complete — ${total} trainer(s) upserted`);
}
