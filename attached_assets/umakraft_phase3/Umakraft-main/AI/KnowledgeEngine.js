// AI/KnowledgeEngine.js
// Umamusume domain knowledge authority — glossary, mechanic catalog, and context assembly.
//
// Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
// Spec:      AI/KNOWLEDGE_ENGINE.md
//
// Public API:
//   lookup(term)        — exact/fuzzy glossary term lookup
//   search(query)       — keyword search across glossary + mechanic catalog
//   getContext(query)   — returns ContextBuilder-compatible chunks for a query
//   isUmamusumeTopic(q) — lightweight heuristic used by Topic Filter

import log from '../core/log.js';

// ---------------------------------------------------------------------------
// Glossary
// ---------------------------------------------------------------------------

/** @type {Array<{term:string, aliases:string[], definition:string, category:string, relatedTerms:string[], source:string}>} */
const GLOSSARY = [
  {
    term: 'MANT',
    aliases: ['monthly average new trainers', 'monthly average'],
    definition:
      'Monthly Average New Trainers — the primary circle health metric. It measures the ' +
      'average number of new trainers added to a circle each month. A higher MANT indicates ' +
      'a healthier, more competitive circle that attracts new members.',
    category: 'Ranking',
    relatedTerms: ['circle rank', 'fan gain', 'circle'],
    source: 'uma.moe API',
  },
  {
    term: 'Fan Gain',
    aliases: ['fangain', 'fan gains', 'fans gained'],
    definition:
      'The number of new fans a trainer earns within a time period (daily, weekly, monthly, ' +
      'or lifetime). Fan gain is tracked by the Umamoe pipeline via the uma.moe API and ' +
      'compiled by the Refinery into standardised products.',
    category: 'Mechanic',
    relatedTerms: ['fan deficit', 'trend', 'gain source', 'milestone'],
    source: 'game mechanic',
  },
  {
    term: 'Circle Rank',
    aliases: ['circle ranking', 'club rank'],
    definition:
      "A circle's standing in the game, determined by the aggregate fan gain of all its " +
      'members. Circles compete for rank within the game ranking system. ' +
      'Higher circle rank reflects stronger collective trainer performance.',
    category: 'Social',
    relatedTerms: ['MANT', 'circle', 'fan gain'],
    source: 'game mechanic',
  },
  {
    term: 'Trainer Level',
    aliases: ['trainer rank', 'level'],
    definition:
      "A trainer's progression level within Uma Musume: Pretty Derby. Higher trainer levels " +
      'unlock additional game features and are reflected in a trainer\'s uma.moe profile. ' +
      'Trainer level is stored in the Vault and surfaced in profile cards.',
    category: 'Mechanic',
    relatedTerms: ['fan gain', 'circle rank'],
    source: 'game mechanic',
  },
  {
    term: 'Fan Deficit',
    aliases: ['deficit', 'fan shortfall'],
    definition:
      "The gap between a trainer's actual fan count and their projected fan count based on " +
      'historical growth rate. If a trainer typically gains 10,000 fans per month but has only ' +
      'gained 6,000, they have a deficit of 4,000. The Broadcast stage monitors deficits and ' +
      'triggers warning announcements when a trainer falls significantly behind projection.',
    category: 'Mechanic',
    relatedTerms: ['fan gain', 'gain source', 'trend'],
    source: 'game mechanic',
  },
  {
    term: 'Milestone',
    aliases: ['fan milestone', 'milestone threshold'],
    definition:
      'A fan count threshold that triggers a special celebration announcement. ' +
      'Standard milestones are: 1M, 5M, 10M, 50M, and 100M fans. ' +
      'When a trainer crosses a milestone the Broadcast stage issues a milestone card via the Workshop.',
    category: 'Achievement',
    relatedTerms: ['fan gain', 'broadcast', 'workshop'],
    source: 'game mechanic',
  },
  {
    term: 'Blueprint',
    aliases: ['card blueprint', 'blueprint key', 'blueprint template'],
    definition:
      'A Workshop rendering template for a specific Discord card type. Each blueprint is ' +
      'identified by a camelCase key (e.g. `fanGain`, `profile`, `leaderboard`) registered in ' +
      '`Workshop/Draftsman/Blueprint/blueprint.js`. The Fabricator resolves the blueprint ' +
      'to render the correct HTML layout and the Validator confirms the deliverable matches it.',
    category: 'Repository',
    relatedTerms: ['fabricator', 'draftsman', 'validator', 'workshop'],
    source: 'repository',
  },
  {
    term: 'Circle',
    aliases: ['club', 'training circle'],
    definition:
      'A group of trainers competing together as a team. Circles accumulate fan gain from ' +
      'all members and are ranked by MANT. Members of the same circle share a leaderboard ' +
      'and can track each other\'s progress via the Umakraft Discord bot.',
    category: 'Social',
    relatedTerms: ['MANT', 'circle rank', 'fan gain'],
    source: 'game mechanic',
  },
  {
    term: 'Depot',
    aliases: ['refinery depot', 'product depot'],
    definition:
      'The Refinery\'s internal storage for compiled trainer products. API: `store()`, ' +
      '`retrieve()`, `search()`. The Depot is the boundary between Refinery (Stage 2) and ' +
      'Workshop (Stage 3) — the Fabricator reads compiled products from the Depot.',
    category: 'Repository',
    relatedTerms: ['vault', 'refinery', 'workshop', 'fabricator'],
    source: 'repository',
  },
  {
    term: 'Vault',
    aliases: ['umamoe vault', 'data vault'],
    definition:
      'Umamoe\'s internal storage for validated raw trainer data extracted from the uma.moe API. ' +
      'API: `receive()`, `retrieve()`, `update()`, `remove()`. The Vault is the boundary ' +
      'between Umamoe (Stage 1) and Refinery (Stage 2). Only Inspector-approved envelopes enter.',
    category: 'Repository',
    relatedTerms: ['depot', 'umamoe', 'inspector', 'refinery'],
    source: 'repository',
  },
  {
    term: 'Trend',
    aliases: ['trainer trend', 'trend tier', 'momentum'],
    definition:
      'A trainer\'s momentum tier derived from their current uma.moe rank by the Refiner ' +
      '(`Refinery/Refiner/refiner.js`). Tiers: `elite` (ranks 1–10), `upward` (11–50), ' +
      '`stable` (51–200), `emerging` (201+). Trend reflects growth velocity, not absolute fan count.',
    category: 'Mechanic',
    relatedTerms: ['fan gain', 'gain source', 'refinery'],
    source: 'repository',
  },
  {
    term: 'Gain Source',
    aliases: ['gainsource', 'fan gain source', 'delta', 'projected'],
    definition:
      "Indicates whether a trainer's fan gain figures are real historical deltas (`delta`) or " +
      "rank-based projections (`projected`). When the Vault has historical snapshots, the Refiner " +
      'uses real deltas. Without history it produces rank-weighted projections. ' +
      'Always note the gain source when quoting fan gain numbers.',
    category: 'Mechanic',
    relatedTerms: ['fan gain', 'trend', 'vault', 'refinery'],
    source: 'repository',
  },
];

// ---------------------------------------------------------------------------
// Mechanic Catalog
// ---------------------------------------------------------------------------

/** @type {Array<{name:string, description:string, formula:string|null, thresholds:object|null, examples:string[], relatedMechanics:string[]}>} */
const MECHANIC_CATALOG = [
  {
    name: 'Fan Gain Calculation',
    description:
      'Fan gain is computed as the difference between a trainer\'s current fan count and their ' +
      'fan count at a previous snapshot. The Refiner in `Refinery/Refiner/refiner.js` calculates ' +
      'daily, weekly, and monthly gains from Vault snapshots. When no prior snapshot exists, ' +
      'rank-weighted projections are used (`gainsSource: "projected"`).',
    formula: 'gain = currentFans - previousFans (delta mode) | rank-weighted estimate (projected mode)',
    thresholds: null,
    examples: [
      'Trainer has 1,200,000 fans today and had 1,100,000 a week ago → weekly gain = +100,000',
      'No prior snapshot → gain is estimated from uma.moe rank position',
    ],
    relatedMechanics: ['Fan Deficit', 'Trend', 'Gain Source'],
  },
  {
    name: 'Trainer Trend Tiers',
    description:
      'The Refiner derives a trend tier from a trainer\'s current uma.moe rank. ' +
      'Trend reflects momentum (growth velocity), not absolute fan count.',
    formula: null,
    thresholds: {
      elite:    { range: '1–10',   meaning: 'Top performers; very high fan velocity' },
      upward:   { range: '11–50',  meaning: 'Strong upward momentum' },
      stable:   { range: '51–200', meaning: 'Consistent, steady growth' },
      emerging: { range: '201+',   meaning: 'Early stage or slow-growth trainers' },
    },
    examples: [
      'Rank #5 trainer → trend: elite',
      'Rank #120 trainer → trend: stable',
    ],
    relatedMechanics: ['Fan Gain Calculation', 'Gain Source'],
  },
  {
    name: 'Fan Deficit',
    description:
      'Fan deficit is the shortfall between a trainer\'s projected fan count and their actual ' +
      'count. The Broadcast stage monitors deficits and triggers warning announcements when a ' +
      'trainer falls significantly below projection.',
    formula: 'deficit = projectedFans - actualFans',
    thresholds: {
      low:      { range: '< 10,000',        tone: 'Gentle nudge' },
      medium:   { range: '10,000–50,000',   tone: 'Clear heads-up' },
      high:     { range: '50,000–100,000',  tone: 'More direct' },
      critical: { range: '> 100,000',       tone: 'Urgent but supportive' },
    },
    examples: [
      'Projected: 500,000 | Actual: 475,000 → deficit: 25,000',
    ],
    relatedMechanics: ['Fan Gain Calculation', 'Milestone'],
  },
  {
    name: 'Milestone System',
    description:
      'Standard fan count thresholds that trigger a celebration broadcast. The Workshop ' +
      'renders a milestone card and the Broadcast stage delivers it to the Discord channel.',
    formula: null,
    thresholds: {
      '1M':   1_000_000,
      '5M':   5_000_000,
      '10M':  10_000_000,
      '50M':  50_000_000,
      '100M': 100_000_000,
    },
    examples: [
      'Trainer crosses 1,000,000 fans → milestone card generated and posted',
    ],
    relatedMechanics: ['Fan Gain Calculation', 'Fan Deficit'],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalise a string for comparison: lowercase, strip punctuation, collapse whitespace */
function normalise(str) {
  return str.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Score how well a haystack string matches a needle (0.0 – 1.0) */
function fuzzyScore(needle, haystack) {
  const n = normalise(needle);
  const h = normalise(haystack);
  if (h === n) return 1.0;
  if (h.includes(n)) return 0.9;
  const words = n.split(' ');
  const matchCount = words.filter(w => h.includes(w)).length;
  return matchCount / words.length * 0.8;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Look up a glossary term by exact match or alias.
 * Returns the best-matching entry or null.
 *
 * @param {string} term
 * @returns {{ entry: object, score: number } | null}
 */
export function lookup(term) {
  let best = null;
  let bestScore = 0;

  for (const entry of GLOSSARY) {
    const candidates = [entry.term, ...entry.aliases];
    for (const candidate of candidates) {
      const score = fuzzyScore(term, candidate);
      if (score > bestScore) {
        bestScore = score;
        best = entry;
      }
    }
  }

  if (bestScore < 0.4) return null;
  log.debug(`[AI/KnowledgeEngine] lookup("${term}") → ${best?.term ?? 'null'} (score=${bestScore.toFixed(2)})`);
  return best ? { entry: best, score: bestScore } : null;
}

/**
 * Keyword search across the glossary and mechanic catalog.
 * Returns ranked matches as ContextBuilder-compatible chunks.
 *
 * @param {string} query
 * @returns {Array<{ filePath:string, heading:string|null, content:string, score:number, source:'knowledge' }>}
 */
export function search(query) {
  const chunks = [];

  // Search glossary
  for (const entry of GLOSSARY) {
    const candidates = [entry.term, ...entry.aliases, entry.definition, entry.category];
    const maxScore = Math.max(...candidates.map(c => fuzzyScore(query, c)));
    if (maxScore >= 0.3) {
      chunks.push({
        filePath: 'AI/KnowledgeEngine (glossary)',
        heading:  entry.term,
        content:
          `**${entry.term}** (${entry.category})\n` +
          `${entry.definition}\n` +
          (entry.relatedTerms.length ? `Related: ${entry.relatedTerms.join(', ')}` : ''),
        score:  maxScore,
        source: 'knowledge',
      });
    }
  }

  // Search mechanic catalog
  for (const mechanic of MECHANIC_CATALOG) {
    const candidates = [mechanic.name, mechanic.description];
    const maxScore = Math.max(...candidates.map(c => fuzzyScore(query, c)));
    if (maxScore >= 0.3) {
      const thresholdText = mechanic.thresholds
        ? '\nThresholds: ' + JSON.stringify(mechanic.thresholds)
        : '';
      const formulaText = mechanic.formula ? `\nFormula: ${mechanic.formula}` : '';
      chunks.push({
        filePath: 'AI/KnowledgeEngine (mechanics)',
        heading:  mechanic.name,
        content:
          `**${mechanic.name}**\n` +
          mechanic.description +
          formulaText +
          thresholdText +
          (mechanic.examples.length ? `\nExamples: ${mechanic.examples.join(' | ')}` : ''),
        score:  maxScore,
        source: 'knowledge',
      });
    }
  }

  // Sort descending by score
  chunks.sort((a, b) => b.score - a.score);

  log.info(
    `[AI/KnowledgeEngine] search("${query.slice(0, 60)}") → ${chunks.length} chunk(s)`
  );

  return chunks;
}

/**
 * Return ContextBuilder-compatible knowledge chunks for a user query.
 * Called by the AI command handlers for `umamusume`-classified requests.
 *
 * @param {string} query
 * @returns {Array<{ filePath:string, heading:string|null, content:string, score:number, source:'knowledge' }>}
 */
export function getContext(query) {
  return search(query);
}

/**
 * Lightweight heuristic: does the query appear to be about Umamusume?
 * Used as a secondary check by the Topic Filter's semantic fallback.
 *
 * @param {string} query
 * @returns {boolean}
 */
export function isUmamusumeTopic(query) {
  const UMA_TERMS = [
    'uma musume', 'umamusume', 'pretty derby', 'mant', 'fan gain', 'fan count',
    'circle rank', 'trainer level', 'trainer rank', 'skill card', 'race',
    'fan deficit', 'projected fans', 'leaderboard', 'circle', 'horse girl',
    'milestone', 'trend tier', 'gain source',
  ];
  const q = query.toLowerCase();
  return UMA_TERMS.some(t => q.includes(t));
}

/**
 * Return all glossary entries — used by the /ai glossary listing command.
 * @returns {object[]}
 */
export function allTerms() {
  return GLOSSARY.map(e => ({ term: e.term, category: e.category, aliases: e.aliases }));
}
