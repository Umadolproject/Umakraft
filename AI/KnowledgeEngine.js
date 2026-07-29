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
// Command Primer — bot commands, linking, and user guidance
// ---------------------------------------------------------------------------

/** @type {Array<{name:string, description:string, usage:string, permissions:string|null, examples:string[], relatedCommands:string[]}>} */
const COMMAND_PRIMER = [
  {
    name: 'Full Command Directory',
    description:
      'The AI has knowledge of ALL available Discord bot commands and can always direct users to the ' +
      'right one. When a user asks for help, mentions a task, or seems unsure what to do, proactively ' +
      'mention every relevant command they could use.\n\n' +
      '🔗 Account Linking: /link (admin-only, connects Discord user to uma.moe trainer), ' +
      '/unlink (admin-only, removes the link), /link_list (paginated list of all linked members).\n' +
      '📊 Stats & Profile: /fan_gain (daily/weekly/monthly fan gain with visual card), ' +
      '/profile (full profile card with history, PRs, milestones), /total_fan (total fan count), ' +
      '/leaderboard (top trainers by fan gain in a circle).\n' +
      '🔍 Searching: /search_trainer (look up any trainer by name across local DB and live API).\n' +
      '💾 Storage: /store (cache a trainer card for 72h), /keep (make a stored card permanent), ' +
      '/joindate (show when a trainer joined uma.moe).\n' +
      '❓ Help: /helps (list ALL bot commands), /ai (AI-powered Q&A about Umamusume and bot features), ' +
      '/ask (shortcut to ask the AI a question).\n\n' +
      'IMPORTANT: Always mention ALL available commands relevant to what the user is asking about — ' +
      'never assume they only want one. If a user asks "how do I get linked?", mention /link, /unlink, ' +
      'and /link_list — not just /link.',
    usage: '(AI knowledge entry — not a Discord command)',
    permissions: null,
    examples: [
      'User: "what commands do you have?" → AI: "Here\'s everything available: 🔗 Linking: /link, /unlink, /link_list. 📊 Stats: /fan_gain, /profile, /total_fan, /leaderboard. 🔍 Search: /search_trainer. 💾 Storage: /store, /keep, /joindate. ❓ Help: /helps, /ai, /ask."',
      'User: "how do I link?" → AI: "An admin can use /link to connect you to your uma.moe trainer. You can also use /link_list to see everyone already linked, and /unlink to remove a link."',
      'User: "help" → AI: "I can help with all of these commands: /link, /unlink, /link_list, /fan_gain, /profile, /total_fan, /leaderboard, /search_trainer, /store, /keep, /joindate, /helps, /ai, and /ask. What would you like to know about?"',
    ],
    relatedCommands: ['link', 'unlink', 'link_list', 'fan_gain', 'profile', 'total_fan', 'leaderboard', 'search_trainer', 'store', 'keep', 'joindate', 'helps', 'ai', 'ask'],
  },
  {
    name: 'Linking (critical — must be linked to use most commands)',
    description:
      'Every Discord user must be linked to their uma.moe trainer ID before they can use ' +
      'commands like /fan_gain, /profile, /search_trainer, or /leaderboard.  Without linking, ' +
      'the bot cannot identify which trainer the user is on uma.moe.\n\n' +
      'ONLY an admin (someone with Manage Guild permission) can link a user.  Users cannot link themselves.\n' +
      'Admins use the /link command to connect a Discord user to a trainer ID.\n' +
      'Users can check if they are linked by typing /fan_gain — if it works, they are linked.\n\n' +
      'Linking is per-guild — a user linked in one server is NOT automatically linked in another.',
    usage: '/link member:@User trainer:TrainerName  —  admin only',
    permissions: 'ManageGuild (admin only)',
    examples: [
      'Admin types: /link member:@Alice trainer:DaJuicyKEBAB',
      'User asks: "how do I get linked?" → Answer: Ask an admin to use /link for you.',
      'User asks: "please link me" → Answer: I cannot link you — only an admin can. Ask @AdminName.',
    ],
    relatedCommands: ['link', 'unlink', 'link_list'],
  },
  {
    name: 'Fan Gain (/fan_gain)',
    description:
      'Shows a trainer\'s daily, weekly, and monthly fan gain with a visual progress card. ' +
      'Requires the user to be linked to a trainer ID.  If the user is not linked, ' +
      'this command will fail with a message telling them to ask an admin to /link them.\n\n' +
      'The command accepts an optional trainer name to look up another trainer. ' +
      'If the trainer name does not match exactly (case-insensitive), the bot will not find them. ' +
      'Use the autocomplete dropdown for accurate results.  Never guess trainer names.',
    usage: '/fan_gain [trainer:TrainerName]',
    permissions: null,
    examples: [
      '/fan_gain  →  shows YOUR fan gain (must be linked)',
      '/fan_gain trainer:DaJuicyKEBAB  →  shows DaJuicyKEBAB\'s fan gain',
      'User asks: "how many fans do I have?" → Use /fan_gain to check.',
    ],
    relatedCommands: ['profile', 'total_fan', 'fan_gain'],
  },
  {
    name: 'Profile (/profile)',
    description:
      'Displays a full trainer profile card including fan gain history, personal records, ' +
      'milestones, and monthly progress.  Can look up yourself or another linked member.',
    usage: '/profile [member:@User] [trainer:TrainerName]',
    permissions: null,
    examples: [
      '/profile  →  your own profile',
      '/profile member:@Alice  →  Alice\'s profile (if linked)',
    ],
    relatedCommands: ['fan_gain', 'profile'],
  },
  {
    name: 'Leaderboard (/leaderboard)',
    description:
      'Shows the top trainers in your circle by fan gain for a given period (daily, weekly, monthly). ' +
      'The default circle is 974470619 (your configured circle).  Only trainers who are members of ' +
      'that circle appear on the leaderboard.',
    usage: '/leaderboard [scope:daily|weekly|monthly] [circle:CircleName] [date:YYYY-MM-DD]',
    permissions: null,
    examples: [
      '/leaderboard scope:monthly  →  this month\'s top trainers',
      'User asks: "who is winning this month?" → Check /leaderboard scope:monthly',
    ],
    relatedCommands: ['leaderboard', 'intercircleleaderboard', 'circle_master'],
  },
  {
    name: 'Search Trainer (/search_trainer)',
    description:
      'Searches for a trainer by name across stored cards, the local trainer database, ' +
      'and the live uma.moe API.  Returns trainer ID, fan count, rank, and white skills. ' +
      'Use the autocomplete dropdown on the trainer field for best results.',
    usage: '/search_trainer trainer:Name [rank:Number] [whiteskills:Number]',
    permissions: null,
    examples: [
      '/search_trainer trainer:DaJuicyKEBAB  →  finds that trainer\'s data',
      '/search_trainer trainer:Juicy rank:1  →  rank-1 trainers matching "Juicy"',
    ],
    relatedCommands: ['search_trainer', 'store', 'keep'],
  },
  {
    name: 'Store Trainer Card (/store)',
    description:
      'Stores a trainer card in the local database for faster lookups and rank/skill filtering. ' +
      'Stored cards are kept for 72 hours unless marked with /keep (permanent).',
    usage: '/store trainer:TrainerNameOrId',
    permissions: null,
    examples: [
      '/store trainer:DaJuicyKEBAB  →  stores card for 72h',
      '/keep trainer:DaJuicyKEBAB  →  makes it permanent',
    ],
    relatedCommands: ['store', 'keep', 'link_list'],
  },
  {
    name: 'AI Help (/ai help)',
    description:
      'Shows a list of available AI commands and what they do. ' +
      'The AI can answer questions about the repository, explain Umamusume mechanics, ' +
      'search documentation, and generate community messages.',
    usage: '/ai help',
    permissions: null,
    examples: [
      '/ai help  →  list all AI commands',
    ],
    relatedCommands: ['ask', 'ai'],
  },
  {
    name: 'When a user is NOT linked — how the AI should respond',
    description:
      'IMPORTANT RULES for the AI:\n' +
      '- If a user asks about their own fan gain / stats / profile and they are not linked, ' +
      '  tell them: "You are not linked to a trainer yet. Ask a server admin to use /link for you."\n' +
      '- If a user says "link me" or "please link" or "I want to link", ' +
      '  respond: "I cannot link you — only a server admin can do that. Ask @AdminName or any admin to ' +
      '  use /link member:@You trainer:YourTrainerName."\n' +
      '- If a user asks "how do I get linked?" explain the process: an admin runs /link with their Discord ' +
      '  username and their uma.moe trainer name.\n' +
      '- NEVER claim that the user can link themselves.  Always direct them to an admin.\n' +
      '- If the user tags a specific admin (e.g. "@RedHawk link me"), acknowledge the ping and ' +
      '  explain that the tagged admin has the permission to use /link.\n' +
      '- ALWAYS be helpful and encouraging.  Never scold the user for not being linked.',
    usage: '(AI response rules — not a Discord command)',
    permissions: null,
    examples: [
      'User: "how many fans do I have?" → AI: "Let me check... You need to be linked first! Ask an admin to use /link for you, then try /fan_gain."',
      'User: "please link me @AdminUser" → AI: "@AdminUser has permission to link you! An admin just needs to run /link member:@You trainer:YourTrainerName."',
      'User: "I want to check my profile" → AI: "First make sure you\'re linked. Try /profile — if it shows an error, ask an admin to /link you!"',
    ],
    relatedCommands: ['link', 'fan_gain', 'profile'],
  },
];

// ---------------------------------------------------------------------------
// Umamusume Reference Sites — trusted external resources
// ---------------------------------------------------------------------------

/**
 * Curated registry of trusted Umamusume reference sites.
 * Injected into context when a query matches a site's expertise area.
 * The AI should proactively recommend the best site for the user's question.
 *
 * @type {Array<{name:string, url:string, description:string, bestFor:string[], keywords:string[]}>}
 */
const REFERENCES = [
  {
    name: 'uma.moe',
    url: 'https://uma.moe/',
    description:
      'Comprehensive Umamusume database and API. The source of truth for trainer stats, ' +
      'fan counts, rankings, skill data, and card information. Umakraft pulls all trainer ' +
      'data from here. Best for: looking up a specific trainer, checking ranks, fan counts, ' +
      'and detailed card/skill data.',
    bestFor: ['trainer lookup', 'fan count', 'rankings', 'card data', 'skill data', 'trainer stats', 'trainer search'],
    keywords: ['trainer', 'fan', 'rank', 'card', 'skill', 'stats', 'profile', 'search trainer', 'fan count'],
  },
  {
    name: 'Gametora — Umamusume',
    url: 'https://gametora.com/umamusume',
    description:
      'Well-organized game guides, tier lists, event guides, and training calculators. ' +
      'Clean UI, regularly updated. Best for: tier lists, event strategies, training builds, ' +
      'and character comparisons.',
    bestFor: ['tier list', 'event guide', 'training build', 'character comparison', 'game guide'],
    keywords: ['tier', 'event', 'training', 'build', 'comparison', 'guide', 'best', 'recommend'],
  },
  {
    name: 'Uma.Guide',
    url: 'https://uma.guide/',
    description:
      'Modern Umamusume wiki and guide hub. Covers game mechanics, scenarios, support cards, ' +
      'and character-specific builds. Good companion to Gametora. Best for: detailed mechanics ' +
      'explanations, scenario walkthroughs, and support card analysis.',
    bestFor: ['mechanics', 'scenario guide', 'support card', 'character build', 'wiki'],
    keywords: ['how does', 'mechanic', 'scenario', 'support card', 'build', 'guide', 'wiki', 'explain'],
  },
  {
    name: 'Umamusume.com (Official)',
    url: 'https://umamusume.com/',
    description:
      'Official Umamusume: Pretty Derby website. News, character profiles, media, and ' +
      'official announcements. Best for: official news, character lore, anime/manga info, ' +
      'and new release announcements.',
    bestFor: ['official news', 'character lore', 'anime', 'manga', 'new release', 'announcement'],
    keywords: ['official', 'news', 'character', 'anime', 'manga', 'release', 'lore', 'story'],
  },
  {
    name: 'Game8 — Umamusume',
    url: 'https://game8.co/games/Umamusume-Pretty-Derby',
    description:
      'Popular Japanese game strategy site. Detailed tier lists, reroll guides, event ' +
      'walkthroughs, and character rankings. Frequently updated with JP server meta. ' +
      'Best for: meta tier lists, reroll guides, step-by-step walkthroughs, and JP server info.',
    bestFor: ['meta tier list', 'reroll guide', 'walkthrough', 'jp server', 'strategy', 'ranking'],
    keywords: ['meta', 'reroll', 'jp', 'japan', 'walkthrough', 'strategy', 'best character', 'tier list'],
  },
  {
    name: 'Umamusume.run',
    url: 'https://umamusume.run',
    description:
      'Character and support card database with beginner guides. Good reference for looking up ' +
      'character stats, support card details, and getting started tips.',
    bestFor: ['character database', 'support card database', 'beginner guide', 'character stats'],
    keywords: ['character', 'support card', 'beginner', 'database', 'card stats'],
  },
  {
    name: 'UmamusumeDB',
    url: 'https://umamusumedb.com',
    description:
      'Comprehensive database with tools: factor calculator, training calculator, character ' +
      'comparison, and deck builder. Best for: number-crunching, comparing characters, ' +
      'calculating factors, and planning decks.',
    bestFor: ['factor calculator', 'training calculator', 'character comparison', 'deck builder', 'factor planning'],
    keywords: ['factor', 'calculator', 'compare', 'deck', 'training calc', 'factor calc'],
  },
  {
    name: 'Umamusume.gg',
    url: 'https://umamusume.gg',
    description:
      'Event guides, banner reviews, reroll guide, and training tips. Best for: current events, ' +
      'gacha banner advice, reroll recommendations, and quick training tips.',
    bestFor: ['event guide', 'banner review', 'reroll guide', 'training tips', 'gacha'],
    keywords: ['event', 'banner', 'gacha', 'reroll', 'pull', 'summon', 'training tip'],
  },
  {
    name: 'Umalator',
    url: 'https://umalator.app',
    description:
      'Simulation and planning tool for Umamusume training runs. Best for: simulating training ' +
      'outcomes, planning skill combinations, and optimising builds before committing.',
    bestFor: ['training simulation', 'skill planning', 'build optimisation', 'simulator'],
    keywords: ['simulate', 'simulation', 'optimise', 'optimize', 'planner', 'plan build'],
  },
  {
    name: 'UmaArchive',
    url: 'https://umaarchive.net',
    description:
      'Learn about the real-life racehorses that inspired each Umamusume character. Best for: ' +
      'lore, real horse history, character background, and inspiration behind each uma.',
    bestFor: ['real horse', 'character lore', 'horse history', 'inspiration', 'background'],
    keywords: ['real', 'history', 'lore', 'inspire', 'based on', 'origin', 'racehorse', 'archive'],
  },
  {
    name: 'r/UmaMusume Wiki',
    url: 'https://www.reddit.com/r/UmaMusume/wiki',
    description:
      'Community wiki on Reddit covering general game info, character guides, and community ' +
      'resources. Best for: community tips, FAQs, and quick overviews.',
    bestFor: ['community guide', 'faq', 'reddit guide', 'general info', 'community tips'],
    keywords: ['reddit', 'community', 'faq', 'wiki', 'general', 'overview', 'tip'],
  },
];

/**
 * Match relevant reference sites for a user query.
 * Returns sites that match the query's topic area.
 *
 * @param {string} query
 * @returns {Array<{name:string, url:string, description:string, bestFor:string[], score:number}>}
 */
export function getReferences(query) {
  const results = [];
  const q = normalise(query);

  for (const ref of REFERENCES) {
    let score = 0;

    // Check keyword matches
    for (const kw of ref.keywords) {
      if (q.includes(normalise(kw))) {
        score += 0.25;
      }
    }

    // Check bestFor matches (more specific = higher weight)
    for (const bf of ref.bestFor) {
      const s = fuzzyScore(q, bf);
      if (s > 0.4) score += s * 0.5;
    }

    if (score > 0) {
      results.push({
        name: ref.name,
        url: ref.url,
        description: ref.description,
        bestFor: ref.bestFor,
        score: Math.min(score, 1.0),
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

/**
 * Return all reference sites — used for listing/reference commands.
 * @returns {Array<{name:string, url:string, description:string, bestFor:string[]}>}
 */
export function getAllReferences() {
  return REFERENCES.map(r => ({
    name: r.name,
    url: r.url,
    description: r.description,
    bestFor: r.bestFor,
  }));
}

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

  // Search reference sites — helps the AI recommend the right external resource
  const refs = getReferences(query);
  for (const ref of refs.slice(0, 3)) {
    chunks.push({
      filePath: `AI/KnowledgeEngine (references) — ${ref.url}`,
      heading: `Umamusume Reference: ${ref.name}`,
      content:
        `🔗 **Recommended site: ${ref.name}**\n` +
        `<${ref.url}>\n` +
        `${ref.description}\n` +
        `Best for: ${ref.bestFor.join(', ')}`,
      score: ref.score,
      source: 'knowledge',
    });
  }

  // Search command primer — helps the AI answer "how do I..." questions
  for (const cmd of COMMAND_PRIMER) {
    const candidates = [cmd.name, cmd.description, cmd.usage, ...cmd.examples];
    const maxScore = Math.max(...candidates.map(c => fuzzyScore(query, c)));
    if (maxScore >= 0.25) {
      chunks.push({
        filePath: 'AI/KnowledgeEngine (commands)',
        heading:  cmd.name,
        content:
          `**${cmd.name}**\n` +
          `${cmd.description}\n` +
          `Usage: ${cmd.usage}\n` +
          (cmd.permissions ? `Permissions: ${cmd.permissions}\n` : '') +
          (cmd.examples.length ? `Examples:\n${cmd.examples.map(e => '  - ' + e).join('\n')}` : ''),
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

/**
 * Return all reference sites — re-export for external use.
 * @returns {Array<{name:string, url:string, description:string, bestFor:string[]}>}
 */
export { getAllReferences as references };
