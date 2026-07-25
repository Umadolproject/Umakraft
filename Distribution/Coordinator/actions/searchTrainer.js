// Distribution/Coordinator/actions/searchTrainer.js
// Searches the local trainer card database AND the live uma.moe API.
//
// Priority:
//   1. Local stored cards (trainerCards) — enriched via /store, has fan/rank/skill data
//   2. Local trainer DB (trainerDb) — seeded from circle members, name+ID only
//   3. Live uma.moe search API (Miner.searchTrainers) — always up to date
//
// For name-only searches, results from all three sources are merged and
// deduplicated by trainer ID. Rank and white-skill filters are local-card-only.

import { searchCards, getCard } from '../utils/trainerCards.js';
import { searchByName, getById } from '../utils/trainerDb.js';
import { searchTrainers } from '../../../umamoe/Miner/miner.js';

export async function searchTrainer(payload) {
  const { interaction, options } = payload;
  const { trainer, trainerId, rank, whiteskills } = options;

  if (!trainer && !trainerId && rank == null && whiteskills == null) {
    return {
      success:   false,
      failedAt:  'Commands',
      error:     'PIPELINE_STAGE_ERROR',
      message:   'Please provide at least one search filter: a trainer name, rank, or white-skill count.',
      retriable: false,
      interaction,
    };
  }

  // ── 0. Direct ID lookup (autocomplete selection or trainer_id parameter) ──
  let idLookupResult = null;
  if (trainerId) {
    const card = await getCard(trainerId).catch(() => null);
    const dbEntry = await getById(trainerId);
    if (card || dbEntry) {
      idLookupResult = {
        trainerId,
        name:        card?.name        ?? dbEntry?.trainer_name ?? trainerId,
        fans:        card?.fans        ?? '?',
        rank:        card?.rank        ?? null,
        whiteSkills: card?.whiteSkills ?? 0,
        kept:        card?.kept        ?? false,
        source:      card ? 'card'     : 'db',
      };
    }
  }

  // ── 1. Local stored cards (has rich data: fans, rank, whiteSkills) ───────
  const { results: cardResults } = await searchCards({
    name:        trainer  ?? undefined,
    rank:        rank     ?? undefined,
    whiteSkills: whiteskills ?? undefined,
    limit:       20,
  });

  const cardIds = new Set(cardResults.map(c => c.trainerId));
  if (idLookupResult) cardIds.add(idLookupResult.trainerId);

  // ── 2. Local trainer DB — fast name lookup seeded from circle members ────
  let dbResults = [];
  if (trainer && !rank && whiteskills == null) {
    // Only relevant for name-only searches; rank/skill filters need card data.
    const dbRows = await searchByName(trainer, 10);
    dbResults = dbRows
      .filter(r => !cardIds.has(r.trainer_id))
      .map(r => ({ trainerId: r.trainer_id, name: r.trainer_name, source: 'db' }));
  }

  // ── 3. Live uma.moe API — fallback when local results are thin ───────────
  let liveResults = [];
  const localCount = cardResults.length + dbResults.length;
  if (trainer && localCount < 5) {
    try {
      const apiResult = await searchTrainers({ q: trainer, limit: 10 });
      if (apiResult?.success && Array.isArray(apiResult.data)) {
        liveResults = apiResult.data
          .filter(item => {
            const id = String(item?.id ?? item?.viewer_id ?? item?.trainer_id ?? '');
            return id && !cardIds.has(id) && !dbResults.some(d => d.trainerId === id);
          })
          .map(item => ({
            trainerId: String(item.id ?? item.viewer_id ?? item.trainer_id ?? ''),
            name:      String(item.name ?? item.trainer_name ?? ''),
            fans:      item.fans ?? '?',
            rank:      item.rank ?? null,
            source:    'live',
          }));
      }
    } catch {
      // Live search is best-effort; silently ignore failures.
    }
  }

  // ── 4. Assemble combined results ─────────────────────────────────────────
  // Prefer the ID lookup at position 0; skip any duplicate from cardResults.
  const allResults = [
    ...(idLookupResult ? [idLookupResult] : []),
    ...cardResults
      .filter(c => c.trainerId !== idLookupResult?.trainerId)
      .map(c => ({
      trainerId:   c.trainerId,
      name:        c.name,
      fans:        typeof c.fans === 'number' ? c.fans.toLocaleString() : (c.fans ?? '?'),
      rank:        c.rank,
      whiteSkills: c.whiteSkills,
      kept:        c.kept,
      source:      'card',
    })),
    ...dbResults.map(r => ({
      trainerId:   r.trainerId,
      name:        r.name,
      fans:        '?',
      rank:        null,
      whiteSkills: 0,
      kept:        false,
      source:      r.source,
    })),
    ...liveResults.map(r => ({
      trainerId:   r.trainerId,
      name:        r.name,
      fans:        typeof r.fans === 'number' ? r.fans.toLocaleString() : (r.fans ?? '?'),
      rank:        r.rank,
      whiteSkills: 0,
      kept:        false,
      source:      r.source,
    })),
  ];

  if (allResults.length === 0) {
    return {
      success:  true,
      type:     'embed',
      ephemeral: true,
      result: {
        title:       '🔍 No results found',
        description: `No trainers matching your search were found in stored cards, the local trainer database, or on uma.moe.\n\nTry using a different name, or use \`/fan_gain\` with the autocomplete to look up a specific trainer.`,
      },
      interaction,
    };
  }

  const lines = allResults.slice(0, 20).map((r, i) => {
    const rankStr = r.rank ? ` | Rank: ${r.rank}` : '';
    const skillStr = r.source === 'card' && r.whiteSkills > 0 ? ` | ⬜ ${r.whiteSkills}` : '';
    const keptStr = r.kept ? ' 📌' : '';
    const sourceStr = r.source === 'live' ? ' 🌐' : r.source === 'db' ? ' 💾' : '';
    return `**${i + 1}.** ${r.name} — ID \`${r.trainerId}\` | Fans: ${r.fans}${rankStr}${skillStr}${keptStr}${sourceStr}`;
  });

  const sourceLegend = [
    ...(cardResults.length > 0 ? ['📌 = permanently kept'] : []),
    ...(liveResults.length > 0 ? ['🌐 = live uma.moe data'] : []),
    ...(dbResults.length > 0 ? ['💾 = local trainer DB'] : []),
    ...(cardResults.length > 0 ? ['Cards without 📌 expire after 72 hours'] : []),
  ];

  return {
    success:  true,
    type:     'embed',
    ephemeral: true,
    result: {
      title:       `🔍 Search results (${allResults.length})`,
      description: lines.join('\n'),
      footer:      sourceLegend.join('  •  ') || undefined,
    },
    interaction,
  };
}
