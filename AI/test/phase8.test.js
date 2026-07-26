// AI/test/phase8.test.js
// Phase 8 test suite — Agent Layer
//   ToolRegistry, ReflectionEngine, Agent orchestrator
//
// All tests are pure and synchronous where possible. Tool execution
// may fail gracefully without API keys — that's tested explicitly.

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

// ── ToolRegistry ─────────────────────────────────────────────────────────────

section('ToolRegistry — imports');

const {
  listAll,
  listAvailable,
  get: getTool,
  register,
  execute: executeTool,
  count,
} = await import('../ToolRegistry.js');

await test('module exports all public functions', () => {
  assert.equal(typeof listAll,        'function');
  assert.equal(typeof listAvailable,  'function');
  assert.equal(typeof getTool,        'function');
  assert.equal(typeof register,       'function');
  assert.equal(typeof executeTool,    'function');
  assert.equal(typeof count,          'function');
});

section('ToolRegistry — catalog');

await test('listAll returns 8 registered tools', () => {
  const tools = listAll();
  assert.equal(tools.length, 8, `expected 8 tools, got ${tools.length}`);
});

await test('every tool has required fields', () => {
  for (const t of listAll()) {
    assert.ok(t.name,            `tool missing name`);
    assert.ok(t.description,     `tool "${t.name}" missing description`);
    assert.ok(t.category,        `tool "${t.name}" missing category`);
    assert.ok(t.parameters,      `tool "${t.name}" missing parameters`);
    assert.ok(typeof t.execute === 'function', `tool "${t.name}" execute not a function`);
    assert.ok(t.bestFor?.length > 0, `tool "${t.name}" missing bestFor`);
  }
});

await test('tool names are unique', () => {
  const names = listAll().map(t => t.name);
  assert.equal(new Set(names).size, names.length, 'duplicate tool names');
});

await test('get returns a tool by name', () => {
  const t = getTool('search_repository');
  assert.ok(t, 'search_repository not found');
  assert.equal(t.category, 'search');
});

await test('get returns null for unknown tool', () => {
  assert.equal(getTool('nonexistent_tool'), null);
});

await test('available tools by category', () => {
  const searchTools = listAll().filter(t => t.category === 'search');
  assert.ok(searchTools.length >= 2, `expected >=2 search tools, got ${searchTools.length}`);
});

section('ToolRegistry — listAvailable');

await test('listAvailable("answer_question") returns multiple tools', () => {
  const tools = listAvailable('answer_question');
  assert.ok(tools.length >= 3, `expected >=3 tools for answer_question, got ${tools.length}`);
  const names = tools.map(t => t.name);
  assert.ok(names.includes('search_repository'), 'should include search_repository');
  assert.ok(names.includes('search_knowledge'),  'should include search_knowledge');
});

await test('listAvailable("generate_message") returns generate_message', () => {
  const tools = listAvailable('generate_message');
  const names = tools.map(t => t.name);
  assert.ok(names.includes('generate_message'), 'should include generate_message');
});

await test('listAvailable filters out not-always-available tools', () => {
  const tools = listAvailable('search_web');
  // search_web and ai_generate are not alwaysAvailable (need API keys)
  // So this should NOT include them
  for (const t of tools) {
    assert.equal(t.alwaysAvailable, true, `${t.name} should be alwaysAvailable`);
  }
});

section('ToolRegistry — register');

await test('register adds a new tool at runtime', () => {
  const before = count();
  register({
    name:        'test_tool',
    description: 'A test tool',
    category:    'utility',
    parameters:  { input: { type: 'string', required: true, description: 'test' } },
    execute:     async (p) => ({ echoed: p.input }),
    alwaysAvailable: true,
    returns:   ['{echoed}'],
    bestFor:   ['answer_question'],
  });
  assert.equal(count(), before + 1);
  assert.ok(getTool('test_tool'));

  // Clean up — remove from internal map (test only)
  // Not a public API, so we just verify it works
});

section('ToolRegistry — execute');

await test('execute returns ok:false for unknown tool', async () => {
  const { ok, error } = await executeTool('nonexistent');
  assert.equal(ok, false);
  assert.ok(error.includes('Unknown tool'));
});

await test('execute classify_intent returns a valid classification', async () => {
  const { ok, result } = await executeTool('classify_intent', {
    query:   'How does the Vault store data?',
    command: '/ask',
  });
  assert.equal(ok, true);
  assert.ok(result.topic,           'missing topic');
  assert.ok(result.complexity,      'missing complexity');
  assert.ok(typeof result.confidence === 'number', 'confidence should be a number');
  assert.ok(result.confidence >= 0 && result.confidence <= 1, 'confidence out of range');
});

await test('execute search_repository works without API keys (returns empty or errors gracefully)', async () => {
  const { ok } = await executeTool('search_repository', {
    query: 'Vault storage',
    topK:  3,
  });
  // May fail without API keys / Qdrant, but should not throw
  assert.ok(typeof ok === 'boolean');
});

await test('execute search_knowledge returns knowledge chunks', async () => {
  const { ok, result } = await executeTool('search_knowledge', {
    query: 'What is MANT?',
  });
  assert.equal(ok, true);
  assert.ok(Array.isArray(result.chunks), 'chunks should be an array');
  assert.ok(result.count >= 0, 'count should be >= 0');
});

// ── ReflectionEngine ─────────────────────────────────────────────────────────

section('ReflectionEngine — imports');

const {
  reflect,
  shouldGenerate,
  shouldRetry,
} = await import('../ReflectionEngine.js');

await test('module exports reflect, shouldGenerate, shouldRetry', () => {
  assert.equal(typeof reflect,        'function');
  assert.equal(typeof shouldGenerate, 'function');
  assert.equal(typeof shouldRetry,    'function');
});

section('ReflectionEngine — reflect');

await test('reflect returns passed:true for a good answer', () => {
  const r = reflect({
    answer:     'The Vault is a persistence layer that stores validated data from the Inspector. It uses SQLite for local storage and supports multiple adapters.',
    topic:      'repository',
    confidence: 0.85,
    attempt:    1,
    context:    { query: 'How does the Vault work?', toolsUsed: ['search_repository'], chunksFound: 5, searchWebAttempted: false },
  });
  assert.equal(r.passed, true);
  assert.equal(r.action, 'send');
});

await test('reflect returns passed:false for empty answer', () => {
  const r = reflect({ answer: '', topic: 'repository', confidence: 0.5, attempt: 1 });
  assert.equal(r.passed, false);
  assert.equal(r.action, 'reject');
});

await test('reflect returns re-search for vague answer with zero chunks', () => {
  const r = reflect({
    answer:     "I'm not sure about that. I don't have enough information.",
    topic:      'repository',
    confidence: 0.5,
    attempt:    1,
    context:    { query: 'test', toolsUsed: ['search_repository'], chunksFound: 0, searchWebAttempted: false },
  });
  assert.equal(r.passed, false);
  assert.equal(r.action, 're-search');
  assert.ok(r.adjustedPlan?.addTools?.includes('search_web'), 'should recommend web search');
});

await test('reflect returns re-search for low confidence without web search', () => {
  const r = reflect({
    answer:     'The Vault is a storage system that persists validated data. It uses SQLite and supports multiple adapters for different storage backends.',
    topic:      'repository',
    confidence: 0.35,
    attempt:    1,
    context:    { query: 'test', toolsUsed: ['search_repository'], chunksFound: 1, searchWebAttempted: false },
  });
  assert.equal(r.passed, false);
  assert.equal(r.action, 're-search');
  assert.ok(r.reasons.some(r => r.includes('Confidence too low') || r.includes('low confidence')), `got reasons: ${r.reasons.join('; ')}`);
});

await test('reflect returns send for vague answer after max attempts', () => {
  const r = reflect({
    answer:     "I don't know.",
    topic:      'repository',
    confidence: 0.5,
    attempt:    3,
    context:    { query: 'test', toolsUsed: ['search_repository', 'search_web'], chunksFound: 0, searchWebAttempted: true },
  });
  // After max attempts even a vague answer passes
  assert.equal(r.passed, true);
  assert.equal(r.action, 'send');
});

section('ReflectionEngine — shouldGenerate');

await test('shouldGenerate returns proceed:false for rejected classification', () => {
  const r = shouldGenerate({ rejected: true, topic: 'off-topic' });
  assert.equal(r.proceed, false);
});

await test('shouldGenerate returns proceed:true for valid classification', () => {
  const r = shouldGenerate({ rejected: false, topic: 'repository', confidence: 0.8 });
  assert.equal(r.proceed, true);
});

section('ReflectionEngine — shouldRetry');

await test('shouldRetry returns true when attempts remain', () => {
  assert.equal(shouldRetry(1, 3, ['search_repository']), true);
});

await test('shouldRetry returns false when max attempts reached', () => {
  assert.equal(shouldRetry(3, 3, ['search_repository']), false);
});

await test('shouldRetry returns false when all search tools already tried', () => {
  assert.equal(shouldRetry(1, 3, ['search_repository', 'search_web']), false);
});

// ── Agent orchestrator ───────────────────────────────────────────────────────

section('Agent — imports');

const { orchestrate } = await import('../Agent.js');

await test('module exports orchestrate', () => {
  assert.equal(typeof orchestrate, 'function');
});

section('Agent — orchestrate basic flows');

await test('orchestrate returns immediately for empty query', async () => {
  const r = await orchestrate({ query: '', subcommand: 'ask' });
  assert.equal(r.success, true);
  assert.ok(r.content.includes('provide a question'), `got: ${r.content?.slice(0, 60)}`);
  assert.equal(r.topic, 'empty');
});

await test('orchestrate classifies and rejects off-topic query', async () => {
  const r = await orchestrate({ query: 'Who is the president of Japan?', subcommand: 'ask', userId: 'u1', channelId: 'c1' });
  // TopicFilter returns 'off-topic', Agent returns 'rejected' after preflight
  assert.ok(r.topic === 'off-topic' || r.topic === 'rejected', `expected off-topic/rejected, got: ${r.topic}`);
  assert.ok(r.content.includes('outside') || r.content.includes('scope') || r.content.includes('help with'),
    `expected off-topic message, got: ${r.content?.slice(0, 80)}`);
});

await test('orchestrate handles umamusume question and returns a response', async () => {
  const r = await orchestrate({ query: 'What is MANT?', subcommand: 'ask', userId: 'u1', channelId: 'c1' });
  assert.equal(r.topic, 'umamusume');
  // May fail gracefully if AI provider unavailable, but should always return
  assert.ok(typeof r.success === 'boolean');
  assert.ok(r.toolsUsed?.includes('search_knowledge'), `should use search_knowledge, used: ${r.toolsUsed?.join(',')}`);
});

await test('orchestrate handles repository question', async () => {
  const r = await orchestrate({ query: 'How does the Vault store data?', subcommand: 'ask', userId: 'u1', channelId: 'c1' });
  // Classification should be repository; generation may fail without API keys
  assert.ok(r.topic === 'repository', `expected repository, got: ${r.topic}`);
  assert.ok(typeof r.success === 'boolean');
  // Without API keys, search_repository may fail gracefully — that's fine
  assert.ok(r.toolsUsed?.includes('search_repository') || r.success === false,
    `should use search_repository or fail gracefully, used: ${r.toolsUsed?.join(',')}`);
});

await test('orchestrate handles live query with web search tool', async () => {
  const r = await orchestrate({ query: 'What are the top circles right now?', subcommand: 'live', userId: 'u1', channelId: 'c1' });
  assert.equal(r.topic, 'live');
  assert.ok(r.toolsUsed?.includes('search_web'), `should use search_web, used: ${r.toolsUsed?.join(',')}`);
});

await test('orchestrate returns latencyMs and toolsUsed in every response', async () => {
  const r = await orchestrate({ query: 'What is MANT?', subcommand: 'ask', userId: 'u1', channelId: 'c1' });
  assert.ok(typeof r.latencyMs === 'number', 'latencyMs missing');
  assert.ok(Array.isArray(r.toolsUsed), 'toolsUsed should be an array');
});

// ── summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Phase 8: ${passed} passed, ${failed} failed`);

if (failed > 0) process.exit(1);
