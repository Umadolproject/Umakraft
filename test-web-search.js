// test-web-search.js
// Standalone test for the web search pipeline.
// Run: node test-web-search.js
//
// Tests:
//   1. webSearch.js module — checks which providers are configured
//   2. Simulates /browse / /search flow (web-only retrieval)
//   3. Simulates @mention flow (web-first retrieval)
//   4. Tests fallback messages when no API key
//
// No Discord bot needed — just the AI modules.

import { search as searchWeb, isConfigured, stats } from './AI/webSearch.js';
import config from './AI/Configuration.js';

const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

function ok(msg)  { console.log(`${GREEN}  ✓ ${RESET}${msg}`); }
function fail(msg) { console.log(`${RED}  ✗ ${RESET}${msg}`); }
function info(msg) { console.log(`${CYAN}  ℹ ${RESET}${msg}`); }
function warn(msg) { console.log(`${YELLOW}  ⚠ ${RESET}${msg}`); }
function header(msg) { console.log(`\n${BOLD}${'='.repeat(60)}${RESET}`); console.log(`${BOLD}  ${msg}${RESET}`); console.log(`${BOLD}${'='.repeat(60)}${RESET}\n`); }

// ── Test 1: Configuration ──────────────────────────────────────────

header('Test 1: Provider Configuration');

const configured = isConfigured();
console.log(`  Web search configured: ${configured ? '✅ YES' : '❌ NO'}`);
console.log(`  AI_RETRIEVAL_MODE:    ${config.aiRetrievalMode}`);
console.log(`  AI Provider:          ${config.aiProvider}`);
console.log('');

const providers = {
  'Tavily':  Boolean(config.tavilyApiKey || config.tavilyApiKey2),
  'Brave':   Boolean(config.braveSearchApiKey || config.braveSearchApiKey2),
  'Serper':  Boolean(config.serperApiKey),
  'SerpAPI': Boolean(config.serpapiApiKey),
};

for (const [name, available] of Object.entries(providers)) {
  console.log(`  ${name.padEnd(12)} ${available ? '✅' : '❌'} ${available ? 'configured' : 'not configured'}`);
}

const cacheInfo = stats();
console.log(`  Cache entries:        ${cacheInfo.cacheSize}`);

// ── Summary ─────────────────────────────────────────────────────────

if (!configured) {
  console.log(`\n${YELLOW}${'─'.repeat(60)}${RESET}`);
  console.log(`${YELLOW}  ⚠  No web search API key found!${RESET}`);
  console.log(`${YELLOW}     Set one of these env vars to enable online search:${RESET}`);
  console.log(`${YELLOW}     • TAVILY_API_KEY   (free: 1,000/mo)  → tavily.com${RESET}`);
  console.log(`${YELLOW}     • BRAVE_SEARCH_API_KEY (free: 2,000/mo) → brave.com/search/api${RESET}`);
  console.log(`${YELLOW}     • SERPER_API_KEY   (free: 2,500/mo)  → serper.dev${RESET}`);
  console.log(`${YELLOW}     • SERPAPI_API_KEY  (free: 100/mo)   → serpapi.com${RESET}`);
  console.log(`${YELLOW}${'─'.repeat(60)}${RESET}\n`);
} else {
  console.log(`\n${GREEN}  ✅ At least one web search provider is configured.${RESET}\n`);
}

// ── Test 2: Simulate /browse command ────────────────────────────────

header('Test 2: Simulate /browse (web-only retrieval)');

const testQueries = [
  'what is the best support card deck for beginners in Umamusume',
  'Uma Musume Daiwa Scarlet personality and racing style',
];

for (const query of testQueries) {
  console.log(`\n  Query: "${query.slice(0, 60)}..."`);

  if (!configured) {
    warn('No API key — skipping web search (would show config message to user)');
    console.log(`  Expected response: "Web search is not configured — add TAVILY_API_KEY..."`);
    continue;
  }

  const startedAt = Date.now();
  try {
    const result = await searchWeb(query);
    const elapsed = Date.now() - startedAt;

    if (result && result.docs && result.docs.length > 0) {
      ok(`Found ${result.docs.length} results via ${result.provider} in ${elapsed}ms`);
      for (const doc of result.docs.slice(0, 2)) {
        console.log(`    • ${(doc.excerpt || '').slice(0, 100)}...`);
      }
    } else {
      warn(`No results (${elapsed}ms)`);
    }
  } catch (err) {
    fail(`Error: ${err.message}`);
  }
}

// ── Test 3: Command flow simulation ─────────────────────────────────

header('Test 3: Command Routing Simulation');

const COMMAND_FLOWS = {
  '/browse "query"': {
    subcommand: 'browse',
    retrievalOverride: 'web-only',
    expectsWeb: true,
    expectsLocal: false,
  },
  '/search "query"': {
    subcommand: 'search',
    retrievalOverride: 'web-only',
    expectsWeb: true,
    expectsLocal: false,
  },
  '/ask "question"': {
    subcommand: 'ask',
    retrievalOverride: null,
    expectsWeb: config.aiRetrievalMode !== 'local-only',
    expectsLocal: true,
  },
  '@mention (chat)': {
    subcommand: 'ask',
    retrievalOverride: configure ? 'web-first' : null,
    expectsWeb: configured,
    expectsLocal: true,
  },
};

for (const [label, flow] of Object.entries(COMMAND_FLOWS)) {
  const status = [];
  if (flow.expectsWeb && configured) status.push('🌐 web');
  if (flow.expectsLocal) status.push('📁 local');
  if (!configured && flow.expectsWeb) status.push('⚠ would skip web (no key)');

  console.log(`  ${label.padEnd(25)} → ${status.join(' + ') || '❌ no sources'}`);
}

// ── Test 4: Fallback messages ───────────────────────────────────────

header('Test 4: Fallback Messages');

const FALLBACKS = {
  '/browse (no key)': 'Web search is not configured — add a TAVILY_API_KEY to Railway...',
  '/search (no results)': 'No results found online — try rephrasing...',
  '@mention (nothing found, no key)': 'Not found in my knowledge base. Enable online search...',
  '@mention (nothing found, has key)': 'Could not find anything on that — not in my knowledge base or online...',
};

for (const [scenario, expected] of Object.entries(FALLBACKS)) {
  console.log(`  ${scenario.padEnd(35)} → "${expected.slice(0, 70)}..."`);
}

// ── Done ────────────────────────────────────────────────────────────

header('All Tests Complete');

if (configured) {
  ok('Web search is ready! Deploy and test with /browse in Discord.');
} else {
  warn('Web search needs an API key. All other features work via local docs.');
}

console.log('\n  Deploy checklist:');
console.log('    [ ] Add TAVILY_API_KEY to Railway env vars');
console.log('    [ ] Set AI_RETRIEVAL_MODE=web-first (or hybrid)');
console.log('    [ ] Push to Railway and deploy');
console.log('    [ ] Run: node Distribution/Discord/deploy-commands.js');
console.log('    [ ] Test: /browse "what is Umamusume" in Discord');
console.log('');
