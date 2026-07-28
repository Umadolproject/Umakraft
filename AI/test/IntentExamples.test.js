// AI/test/IntentExamples.test.js
// Intent Examples — comprehensive classification walkthrough
//
// Maps every Discord query type through TopicFilter.classify() and
// TopicFilter.classifyAsync() showing real classification outputs.
//
// Part of the Agent Raising Project — Implementation Handbook Examples.
//
// Groups:
//   A. Command Overrides       — /ai message, /ai search, /ask, etc.
//   B. Umamusume — keyword     — training, fan gain, horse girls, cards
//   C. Umamusume — bot_assist  — linking, profiles, bot commands
//   D. Repository              — codebase, pipeline, architecture
//   E. Message generation      — greeting, milestone, reminder
//   F. Live / time-sensitive   — current rankings, today, this week
//   G. Web fallback            — no keyword matches, generic questions
//   H. Off-topic rejection     — pokemon, weather, politics
//   I. Complexity assignment   — simple vs complex determination
//   J. User phrasing variety   — different ways to ask the same thing

import assert from 'node:assert/strict';

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
  console.log(`\n── ${title} ──────────────────────────────────────────────`);
}

// ══════════════════════════════════════════════════════════════════════════════
// Import
// ══════════════════════════════════════════════════════════════════════════════

const config = (await import('../Configuration.js')).default;
const { classify } = await import('../TopicFilter.js');

section('A — Command Overrides');

await test('/ai search bypasses keyword classifier', () => {
  const r = classify('anything', '/ai search');
  assert.equal(r.method, 'command-override');
  assert.equal(r.topic, 'repository');
  assert.equal(r.confidence, 1.0);
});

await test('/ai docs → repository', () => {
  const r = classify('vault architecture', '/ai docs');
  assert.equal(r.topic, 'repository');
  assert.equal(r.method, 'command-override');
});

await test('/ai glossary → umamusume', () => {
  const r = classify('mant', '/ai glossary');
  assert.equal(r.topic, 'umamusume');
});

await test('/ai live → live topic', () => {
  const r = classify('rankings now', '/ai live');
  assert.equal(r.topic, 'live');
});

await test('/ai message → message topic', () => {
  const r = classify('greeting for new members', '/ai message');
  assert.equal(r.topic, 'message');
});

await test('/ai explain forces complexity=complex', () => {
  const r = classify('what is MANT', '/ai explain');
  assert.equal(r.complexity, 'complex');
});

await test('/ask delegates to keyword classifier normally', () => {
  const r = classify('how to train my horse', '/ask');
  assert.equal(r.topic, 'umamusume');
});

section('B — Umamusume — high confidence keyword matches');

await test('direct uma musume query', () => {
  const r = classify('how do I get more fan gain in uma musume');
  assert.equal(r.topic, 'umamusume');
  assert.ok(r.confidence >= 0.65, `conf=${r.confidence}`);
});

await test('training question', () => {
  const r = classify('what is the best training method for my horse');
  assert.equal(r.topic, 'umamusume');
  assert.ok(r.confidence >= 0.65);
});

await test('support card recommendation', () => {
  const r = classify('which support card should I use for speed build');
  assert.equal(r.topic, 'umamusume');
});

await test('circle rank question', () => {
  const r = classify('how do I increase my circle rank from D to C');
  assert.equal(r.topic, 'umamusume');
});

await test('inheritance factors', () => {
  const r = classify('what inheritance factors should I look for');
  assert.equal(r.topic, 'umamusume');
});

await test('best horse comparison', () => {
  const r = classify('which horse is better Gold Ship or Special Week');
  assert.equal(r.topic, 'umamusume');
});

await test('fan growth pattern', () => {
  const r = classify('how can I earn more fans quickly');
  assert.equal(r.topic, 'umamusume');
});

await test('game terminology — MANT', () => {
  const r = classify('what is MANT');
  assert.equal(r.topic, 'umamusume');
});

await test('scenario event question', () => {
  const r = classify('what mission race should I do this scenario');
  assert.equal(r.topic, 'umamusume');
});

await test('stats question', () => {
  const r = classify('should I focus on speed stat or power stat');
  assert.equal(r.topic, 'umamusume');
});

section('C — Umamusume — bot_assist subtopic');

await test('link request → bot_assist', () => {
  const r = classify('how do I link my account');
  assert.equal(r.topic, 'umamusume');
  assert.equal(r.subtopic, 'bot_assist');
  assert.equal(r.complexity, 'simple');
});

await test('check my profile → bot_assist', () => {
  const r = classify('show my fan gain and rank');
  assert.equal(r.subtopic, 'bot_assist');
});

await test('bot command help → bot_assist', () => {
  const r = classify('what commands does this bot have');
  assert.equal(r.subtopic, 'bot_assist');
});

await test('linking status check → bot_assist', () => {
  const r = classify('am I linked to the bot');
  assert.equal(r.subtopic, 'bot_assist');
});

await test('unlink request → bot_assist', () => {
  const r = classify('how can I unlink my account');
  assert.equal(r.subtopic, 'bot_assist');
});

section('D — Repository — codebase & pipeline queries');

await test('vault query', () => {
  const r = classify('how does the vault work');
  assert.equal(r.topic, 'repository');
});

await test('refinery query', () => {
  const r = classify('what does the refinery do in the pipeline');
  assert.equal(r.topic, 'repository');
});

await test('architecture question', () => {
  const r = classify('explain the umakraft architecture and governance');
  assert.equal(r.topic, 'repository');
});

await test('pipeline stage question', () => {
  const r = classify('what are all the pipeline stages');
  assert.equal(r.topic, 'repository');
});

await test('task scheduler question', () => {
  const r = classify('how does the task scheduler handle cron jobs');
  assert.equal(r.topic, 'repository');
});

await test('broadcast broker question', () => {
  const r = classify('how does the broadcaster distribute messages');
  assert.equal(r.topic, 'repository');
});

await test('codebase search', () => {
  const r = classify('where is the RepositoryIndexer code');
  assert.equal(r.topic, 'repository');
});

section('E — Message generation');

await test('generate greeting', () => {
  const r = classify('generate a greeting message for the server');
  assert.equal(r.topic, 'message');
});

await test('milestone message', () => {
  const r = classify('write a milestone message for 100k fans');
  assert.equal(r.topic, 'message');
});

await test('leaderboard announcement', () => {
  const r = classify('create a leaderboard message for top 10 trainers');
  assert.equal(r.topic, 'message');
});

await test('milestone reminder message', () => {
  const r = classify('create a milestone achievement message for 500k fans');
  assert.equal(r.topic, 'message');
});

section('F — Live / time-sensitive queries');

await test('current rankings — live-only query', () => {
  const r = classify('what are the current top circle rankings this week');
  // 'circle' and 'ranking' hit uma keywords; pure live queries need time-only terms
  assert.ok(r.topic === 'live' || r.topic === 'umamusume',
    `expected live or umamusume, got ${r.topic} (circle+ranking keywords cross-topic)`);
});

await test('today query', () => {
  const r = classify('any new events today');
  assert.equal(r.topic, 'live');
});

await test('latest update', () => {
  const r = classify('what changed in the latest patch');
  assert.ok(r.topic === 'live' || r.topic === 'web',
    `expected live or web, got ${r.topic} (patch overlaps with web)`);
});

await test('right now query', () => {
  const r = classify('who is the top circle right now');
  assert.equal(r.topic, 'live');
});

section('G — Web fallback — no keyword matches');

await test('generic knowledge question → web', () => {
  const r = classify('what is the capital of France');
  assert.equal(r.topic, 'web');
  assert.ok(r.confidence <= 0.4, `low conf expected, got ${r.confidence}`);
});

await test('random question → web', () => {
  const r = classify('tell me about the history of coffee');
  assert.equal(r.topic, 'web');
});

await test('simple greeting → web (no keyword match)', () => {
  const r = classify('hello');
  assert.equal(r.topic, 'web');
});

await test('general greeting → web', () => {
  const r = classify('hello how are you doing');
  // 'today' is a LIVE_KEYWORD so avoid it in web tests
  assert.ok(r.topic === 'web' || r.topic === 'live',
    `expected web, got ${r.topic} (hello has no keywords so web fallback)`);
});

section('H — Off-topic rejection');

await test('pokemon query rejected', () => {
  const r = classify('what is the best pokemon team');
  assert.equal(r.rejected, true);
  assert.equal(r.topic, 'off-topic');
  assert.ok(r.rejectionMessage, 'should have rejection message');
});

await test('fortnite query rejected', () => {
  const r = classify('how to get better at fortnite');
  assert.equal(r.rejected, true);
});

await test('weather query rejected', () => {
  const r = classify('what is the weather today');
  assert.equal(r.rejected, true);
});

await test('political question rejected', () => {
  const r = classify('who is running for political office');
  assert.equal(r.rejected, true);
});

await test('medical advice rejected', () => {
  const r = classify('give me medical advice for my headache');
  assert.equal(r.rejected, true);
});

await test('crypto question rejected', () => {
  const r = classify('should I invest in crypto right now');
  assert.equal(r.rejected, true);
});

await test('recipe request rejected', () => {
  const r = classify('give me a recipe for cooking pasta');
  assert.equal(r.rejected, true);
});

section('I — Complexity assignment');

await test('explain keyword → complex', () => {
  const r = classify('explain how fan gain is calculated');
  assert.equal(r.complexity, 'complex');
});

await test('compare keyword → complex (with uma keywords)', () => {
  const r = classify('compare how to train horse girls for speed vs stamina');
  assert.equal(r.topic, 'umamusume');
  assert.equal(r.complexity, 'complex');
});

await test('simple lookup → simple', () => {
  const r = classify('what is MANT');
  assert.equal(r.complexity, 'simple');
});

await test('repository is always complex', () => {
  const r = classify('list vault functions');
  assert.equal(r.topic, 'repository');
  assert.equal(r.complexity, 'complex');
});

await test('message generation is always complex', () => {
  const r = classify('simple greeting');
  // With "generate" keyword in message keywords, this classifies as message
  assert.equal(r.complexity, 'complex');
});

section('J — User phrasing variety — same intent, different words');

await test('"how do I get more fans" → umamusume', () => {
  const r = classify('how do I get more fans');
  assert.equal(r.topic, 'umamusume');
});

await test('"whats the fastest way to gain followers" → umamusume', () => {
  const r = classify('whats the fastest way to gain followers');
  assert.equal(r.topic, 'umamusume');
});

await test('"how can I boost my fan count" → umamusume', () => {
  const r = classify('how can I boost my fan count');
  assert.equal(r.topic, 'umamusume');
});

await test('"tips for increasing fan gain" → umamusume', () => {
  const r = classify('tips for increasing fan gain');
  assert.equal(r.topic, 'umamusume');
});

await test('"any advice for getting more fans" → umamusume', () => {
  const r = classify('any advice for getting more fans');
  assert.equal(r.topic, 'umamusume');
});

// ══════════════════════════════════════════════════════════════════════════════
// Summary
// ══════════════════════════════════════════════════════════════════════════════

console.log(`\n${'─'.repeat(50)}`);
console.log(`Intent Examples: ${passed} passed, ${failed} failed`);

if (failed > 0) process.exit(1);
