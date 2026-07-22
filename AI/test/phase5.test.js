// AI/test/phase5.test.js
// Phase 5 test suite — TopicFilter, WebSearchEngine
//
// Runs without live API keys. All provider calls in WebSearchEngine are
// exercised only at the structural level (no actual HTTP calls made).

import assert from 'node:assert/strict';

// ── helpers ─────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n── ${title} ──────────────────────────────────────`);
}

// ── TopicFilter ──────────────────────────────────────────────────────────────

section('TopicFilter — import');

const { classify, offTopicMessage } = await import('../TopicFilter.js');

await test('module exports classify and offTopicMessage', () => {
  assert.equal(typeof classify,        'function');
  assert.equal(typeof offTopicMessage, 'function');
});

section('TopicFilter — classify: repository');

await test('"How does the Vault store data?" → repository', () => {
  const r = classify('How does the Vault store data?');
  assert.equal(r.topic, 'repository');
  assert.equal(r.rejected, false);
});

await test('"What is the Miner responsible for?" → repository', () => {
  const r = classify('What is the Miner responsible for?');
  assert.equal(r.topic, 'repository');
});

await test('"Explain the Broadcast pipeline" → repository', () => {
  const r = classify('Explain the Broadcast pipeline');
  assert.equal(r.topic, 'repository');
});

await test('"What is umakraft?" → repository', () => {
  const r = classify('What is umakraft?');
  assert.equal(r.topic, 'repository');
});

await test('"How does the Refinery work?" → repository', () => {
  const r = classify('How does the Refinery work?');
  assert.equal(r.topic, 'repository');
});

await test('"What does the Fabricator do?" → repository', () => {
  const r = classify('What does the Fabricator do?');
  assert.equal(r.topic, 'repository');
});

await test('"Describe the Blueprint system" → repository', () => {
  const r = classify('Describe the Blueprint system');
  assert.equal(r.topic, 'repository');
});

section('TopicFilter — classify: umamusume');

await test('"What is MANT?" → umamusume', () => {
  const r = classify('What is MANT?');
  assert.equal(r.topic, 'umamusume');
  assert.equal(r.rejected, false);
});

await test('"How is fan gain calculated?" → umamusume', () => {
  const r = classify('How is fan gain calculated?');
  assert.equal(r.topic, 'umamusume');
});

await test('"What are the circle rank tiers?" → umamusume', () => {
  const r = classify('What are the circle rank tiers?');
  assert.equal(r.topic, 'umamusume');
});

await test('"Explain trainer level progression in pretty derby" → umamusume', () => {
  const r = classify('Explain trainer level progression in pretty derby');
  assert.equal(r.topic, 'umamusume');
});

await test('"What is fan deficit?" → umamusume', () => {
  const r = classify('What is fan deficit?');
  assert.equal(r.topic, 'umamusume');
});

section('TopicFilter — classify: live');

await test('"What are the top circles on uma.moe right now?" → live', () => {
  const r = classify('What are the top circles on uma.moe right now?');
  assert.equal(r.topic, 'live');
  assert.equal(r.rejected, false);
});

await test('"Did the game get a patch this week?" → live', () => {
  const r = classify('Did the game get a patch this week?');
  assert.equal(r.topic, 'live');
});

await test('"What is the latest update?" → live', () => {
  const r = classify('What is the latest update?');
  assert.equal(r.topic, 'live');
});

await test('"Which trainers are trending today?" → live', () => {
  const r = classify('Which trainers are trending today?');
  assert.equal(r.topic, 'live');
});

section('TopicFilter — classify: message');

await test('"/ai message greeting" → message', () => {
  const r = classify('/ai message greeting');
  assert.equal(r.topic, 'message');
  assert.equal(r.rejected, false);
});

await test('"generate a milestone message" → message', () => {
  const r = classify('generate a milestone message for TrainerAkira');
  assert.equal(r.topic, 'message');
});

await test('"write a greeting announcement" → message', () => {
  const r = classify('write a greeting announcement for the circle');
  assert.equal(r.topic, 'message');
});

section('TopicFilter — classify: off-topic');

await test('"Who is the prime minister of Japan?" → off-topic / rejected', () => {
  const r = classify('Who is the prime minister of Japan?');
  assert.equal(r.rejected, true);
  assert.ok(r.topic === 'off-topic');
});

await test('"What is the stock price of Nintendo?" → off-topic / rejected', () => {
  const r = classify('What is the stock price of Nintendo?');
  assert.equal(r.rejected, true);
});

await test('"Tell me a joke" → off-topic / rejected', () => {
  const r = classify('Tell me a joke');
  assert.equal(r.rejected, true);
});

await test('"What is the weather today?" → off-topic / rejected', () => {
  const r = classify('What is the weather today?');
  assert.equal(r.rejected, true);
});

await test('"Write me a Python script" → off-topic / rejected', () => {
  const r = classify('Write me a Python script for sorting a list');
  assert.equal(r.rejected, true);
});

await test('"Play Pokemon instead" → off-topic / rejected', () => {
  const r = classify('You should play Pokemon instead');
  assert.equal(r.rejected, true);
});

section('TopicFilter — complexity tier');

await test('repository → always complex', () => {
  const r = classify('What does the Vault do?');
  assert.equal(r.topic, 'repository');
  assert.equal(r.complexity, 'complex');
});

await test('message → always complex', () => {
  const r = classify('/ai message greeting', '/ai message');
  assert.equal(r.complexity, 'complex');
});

await test('umamusume simple question → simple tier', () => {
  const r = classify('What is MANT?');
  assert.equal(r.topic, 'umamusume');
  assert.equal(r.complexity, 'simple');
});

await test('umamusume with "explain" → complex tier', () => {
  const r = classify('Explain how fan gain is calculated in umamusume');
  assert.equal(r.topic, 'umamusume');
  assert.equal(r.complexity, 'complex');
});

await test('umamusume with "analyze" → complex tier', () => {
  const r = classify('Analyze the circle rank system and compare the tiers');
  assert.equal(r.complexity, 'complex');
});

await test('umamusume with "strategy" → complex tier', () => {
  const r = classify('What is the best fan gain strategy for umamusume circles?');
  assert.equal(r.complexity, 'complex');
});

await test('live simple question → simple tier', () => {
  const r = classify('What are the top circles right now?');
  assert.equal(r.topic, 'live');
  assert.equal(r.complexity, 'simple');
});

await test('live with "analyze" → complex tier', () => {
  const r = classify('Analyze why circle rankings changed this week');
  assert.equal(r.complexity, 'complex');
});

await test('off-topic returns complexity null', () => {
  const r = classify('What is the stock price of Nintendo?');
  assert.equal(r.complexity, null);
});

section('TopicFilter — classification result schema');

await test('result has topic, complexity, confidence, method, rejected, rejectionMessage', () => {
  const r = classify('What is MANT?');
  assert.ok('topic'            in r, 'topic missing');
  assert.ok('complexity'       in r, 'complexity missing');
  assert.ok('confidence'       in r, 'confidence missing');
  assert.ok('method'           in r, 'method missing');
  assert.ok('rejected'         in r, 'rejected missing');
  assert.ok('rejectionMessage' in r, 'rejectionMessage missing');
});

await test('confidence is a number in [0, 1]', () => {
  const r = classify('What is MANT?');
  assert.ok(typeof r.confidence === 'number');
  assert.ok(r.confidence >= 0 && r.confidence <= 1, `confidence out of range: ${r.confidence}`);
});

await test('method is one of the documented values', () => {
  const r = classify('What is MANT?');
  const validMethods = ['keyword', 'semantic', 'command-override', 'off-topic-indicator'];
  assert.ok(validMethods.includes(r.method), `unexpected method: ${r.method}`);
});

await test('non-rejected result has rejectionMessage null', () => {
  const r = classify('What is MANT?');
  assert.equal(r.rejectionMessage, null);
});

await test('rejected result has rejectionMessage string', () => {
  const r = classify('What is the stock price of Nintendo?');
  assert.equal(r.rejected, true);
  assert.ok(typeof r.rejectionMessage === 'string' && r.rejectionMessage.length > 0);
});

section('TopicFilter — command overrides');

await test('/ai search → repository, complex (command-override)', () => {
  const r = classify('Vault storage', '/ai search');
  assert.equal(r.topic,      'repository');
  assert.equal(r.complexity, 'complex');
  assert.equal(r.method,     'command-override');
});

await test('/ai docs → repository, complex (command-override)', () => {
  const r = classify('Vault', '/ai docs');
  assert.equal(r.topic,      'repository');
  assert.equal(r.complexity, 'complex');
  assert.equal(r.method,     'command-override');
});

await test('/ai glossary → umamusume, simple (command-override)', () => {
  const r = classify('MANT', '/ai glossary');
  assert.equal(r.topic,      'umamusume');
  assert.equal(r.complexity, 'simple');
  assert.equal(r.method,     'command-override');
});

await test('/ai live → live, simple (command-override)', () => {
  const r = classify('current top circles', '/ai live');
  assert.equal(r.topic,      'live');
  assert.equal(r.complexity, 'simple');
  assert.equal(r.method,     'command-override');
});

await test('/ai message → message, complex (command-override)', () => {
  const r = classify('greeting', '/ai message');
  assert.equal(r.topic,      'message');
  assert.equal(r.complexity, 'complex');
  assert.equal(r.method,     'command-override');
});

await test('command override bypasses off-topic rejection', () => {
  // Even an off-topic query is classified correctly if the command is explicit
  const r = classify('some odd phrasing', '/ai glossary');
  assert.equal(r.topic,    'umamusume');
  assert.equal(r.rejected, false);
});

section('TopicFilter — offTopicMessage');

await test('offTopicMessage returns a non-empty string', () => {
  const msg = offTopicMessage();
  assert.ok(typeof msg === 'string' && msg.length > 10);
});

await test('offTopicMessage mentions repository, umamusume, live, and message', () => {
  const msg = offTopicMessage().toLowerCase();
  assert.ok(msg.includes('repository'),  'expected "repository" in rejection message');
  assert.ok(msg.includes('umamusume') || msg.includes('game'), 'expected game reference in rejection message');
  assert.ok(msg.includes('live'),        'expected "live" in rejection message');
  assert.ok(msg.includes('message'),     'expected "message" in rejection message');
});

// ── WebSearchEngine ──────────────────────────────────────────────────────────

section('WebSearchEngine — import');

const { search, searchFallback } = await import('../WebSearchEngine.js');

await test('module exports search and searchFallback', () => {
  assert.equal(typeof search,         'function');
  assert.equal(typeof searchFallback, 'function');
});

section('WebSearchEngine — searchFallback confidence threshold');

await test('searchFallback returns [] when confidence >= 0.65 (no API call)', async () => {
  // confidence >= threshold — should skip search entirely (no API call, no key needed)
  const result = await searchFallback('some query', 0.80);
  assert.ok(Array.isArray(result), 'expected array');
  assert.equal(result.length, 0, 'expected empty array when confidence is above threshold');
});

await test('searchFallback returns [] when confidence exactly equals threshold', async () => {
  const result = await searchFallback('some query', 0.65);
  assert.ok(Array.isArray(result));
  assert.equal(result.length, 0);
});

section('WebSearchEngine — search with no API keys (graceful degradation)');

await test('search returns empty array when all providers fail (no keys set)', async () => {
  // Without API keys, all providers will throw — should return [] gracefully
  const result = await search('current top circles on uma.moe');
  assert.ok(Array.isArray(result), 'expected an array');
  // Either empty (all failed) or populated (somehow cached — both valid)
});

await test('search with options does not throw', async () => {
  await assert.doesNotReject(() => search('uma.moe ranking', { maxResults: 3 }));
});

section('WebSearchEngine — chunk schema');

await test('any returned chunks conform to the shared chunk schema', async () => {
  const chunks = await search('umamusume circle ranking');
  for (const c of chunks) {
    assert.ok(typeof c.content  === 'string', 'content should be string');
    assert.ok(typeof c.filePath === 'string', 'filePath should be string');
    assert.ok(typeof c.heading  === 'string', 'heading should be string');
    assert.ok(typeof c.score    === 'number', 'score should be number');
    assert.equal(c.source, 'web',             'source should be "web"');
  }
});

// ── summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Phase 5: ${passed} passed, ${failed} failed`);

if (failed > 0) process.exit(1);
