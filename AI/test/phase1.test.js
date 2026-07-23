// AI/test/phase1.test.js
// Phase 1 test suite — Foundation (Configuration, Security, Cache, APIProvider)
//
// Runs without live API keys. All external provider calls are stubbed.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

// ── helpers ────────────────────────────────────────────────────────────────

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
  console.log(`\n── ${title} ─────────────────────────────────────`);
}

// ── Configuration ──────────────────────────────────────────────────────────

section('Configuration');

const { default: config, validate, requireApiKey } = await import('../Configuration.js');

await test('loads default complexModel', () => {
  assert.equal(config.complexModel, 'gpt-4o-mini');
});

await test('loads default simpleModel', () => {
  assert.equal(config.simpleModel, 'gemini-1.5-flash');
});

await test('cacheEnabled defaults to true', () => {
  assert.equal(config.cacheEnabled, true);
});

await test('messageMinWords < messageMaxWords', () => {
  assert.ok(config.messageMinWords < config.messageMaxWords,
    `min (${config.messageMinWords}) must be < max (${config.messageMaxWords})`);
});

await test('validate() passes with default config', () => {
  // Should not throw with valid defaults
  validate();
});

await test('requireApiKey throws when key is missing', () => {
  // In test environment keys are not set — expect a clear error
  if (!process.env.OPENAI_API_KEY) {
    assert.throws(() => requireApiKey('openai'), /OPENAI_API_KEY/);
  }
  if (!process.env.GEMINI_API_KEY) {
    assert.throws(() => requireApiKey('gemini'), /GEMINI_API_KEY/);
  }
});

// ── Security ────────────────────────────────────────────────────────────────

section('Security');

const {
  buildSafePrompt,
  sanitiseInput,
  inspectResponse,
  safeRejectionMessage,
  auditLog,
  SYSTEM_CONSTRAINT_BLOCK,
} = await import('../Security.js');

await test('buildSafePrompt prepends system constraint block', () => {
  const prompt = buildSafePrompt('Question: {{question}}', 'What is the Vault?');
  assert.ok(prompt.startsWith(SYSTEM_CONSTRAINT_BLOCK),
    'System constraint block must be first');
});

await test('buildSafePrompt injects sanitised user input', () => {
  const prompt = buildSafePrompt('Q: {{question}}', 'How does fan gain work?');
  assert.ok(prompt.includes('How does fan gain work?'));
});

await test('buildSafePrompt replaces custom variables', () => {
  const prompt = buildSafePrompt('Topic: {{topic}} — Q: {{question}}', 'test', { topic: 'Miner' });
  assert.ok(prompt.includes('Topic: Miner'));
});

await test('sanitiseInput trims whitespace', () => {
  assert.equal(sanitiseInput('  hello  '), 'hello');
});

await test('sanitiseInput strips null bytes', () => {
  const result = sanitiseInput('hel\x00lo');
  assert.ok(!result.includes('\x00'));
});

await test('sanitiseInput caps at 2000 characters', () => {
  const long = 'a'.repeat(3000);
  assert.equal(sanitiseInput(long).length, 2000);
});

await test('sanitiseInput returns empty string for non-string', () => {
  assert.equal(sanitiseInput(null), '');
  assert.equal(sanitiseInput(undefined), '');
  assert.equal(sanitiseInput(42), '');
});

await test('inspectResponse: safe response passes', () => {
  const { safe, violations } = inspectResponse('The Vault stores extracted race data.');
  assert.equal(safe, true);
  assert.equal(violations.length, 0);
});

await test('inspectResponse: OpenAI key pattern is detected', () => {
  const { safe, violations } = inspectResponse('Here is your key: sk-abcdefghijklmnopqrstuvwx');
  assert.equal(safe, false);
  assert.ok(violations.some(v => v.includes('OpenAI')));
});

await test('inspectResponse: Google key pattern is detected', () => {
  const { safe, violations } = inspectResponse('AIza' + 'A'.repeat(35));
  assert.equal(safe, false);
  assert.ok(violations.some(v => v.includes('Google')));
});

await test('inspectResponse: Bearer token is detected', () => {
  const { safe, violations } = inspectResponse('Use: Bearer eyJhbGciOiJIUzI1NiJ9');
  assert.equal(safe, false);
  assert.ok(violations.some(v => v.includes('Bearer')));
});

await test('inspectResponse: non-string input is unsafe', () => {
  const { safe } = inspectResponse(null);
  assert.equal(safe, false);
});

await test('safeRejectionMessage returns a non-empty string', () => {
  const msg = safeRejectionMessage();
  assert.ok(typeof msg === 'string' && msg.length > 0);
});

await test('auditLog does not throw with valid fields', () => {
  auditLog({
    userId: 'u123', command: '/ask', query: 'What is MANT?',
    topicClassification: 'umamusume', providerCalled: true,
    provider: 'openai', model: 'gpt-4o-mini',
    responseTokens: 200, cacheHit: false, durationMs: 312,
  });
});

// ── Cache ────────────────────────────────────────────────────────────────────

section('Cache');

const {
  embeddingKey, responseKey,
  getEmbedding, setEmbedding,
  getResponse, setResponse,
  clearAll, stats,
} = await import('../Cache.js');

await test('embeddingKey is deterministic', () => {
  assert.equal(embeddingKey('What is the Vault?'), embeddingKey('What is the Vault?'));
});

await test('embeddingKey normalises case and whitespace', () => {
  assert.equal(embeddingKey('  Hello World  '), embeddingKey('hello world'));
});

await test('embeddingKey returns a 64-char hex string', () => {
  const key = embeddingKey('test');
  assert.match(key, /^[a-f0-9]{64}$/);
});

await test('responseKey is deterministic', () => {
  const k1 = responseKey('q', 'repository', { a: '1', b: '2' });
  const k2 = responseKey('q', 'repository', { b: '2', a: '1' });
  assert.equal(k1, k2, 'Variable order should not affect the key');
});

await test('embedding round-trip: set then get', () => {
  const vector = [0.1, 0.2, 0.3];
  setEmbedding('test query embedding', vector);
  const result = getEmbedding('test query embedding');
  assert.deepEqual(result, vector);
});

await test('embedding cache normalises the query key', () => {
  const vector = [1.0, 2.0];
  setEmbedding('  UPPER CASE  ', vector);
  const result = getEmbedding('upper case');
  assert.deepEqual(result, vector);
});

await test('response round-trip: set then get', () => {
  const resp = { text: 'answer', citations: ['umamoe/Vault/vault.js'], model: 'gpt-4o-mini', tokens: 100 };
  setResponse('my query', 'repository', resp);
  const result = getResponse('my query', 'repository');
  assert.deepEqual(result, resp);
});

await test('cache miss returns undefined', () => {
  assert.equal(getEmbedding('this was never stored zzz'), undefined);
  assert.equal(getResponse('never stored', 'unknown'), undefined);
});

await test('stats() returns non-negative counts', () => {
  const { embeddingSize, responseSize } = stats();
  assert.ok(embeddingSize >= 0);
  assert.ok(responseSize  >= 0);
});

await test('clearAll() empties both caches', () => {
  setEmbedding('to be cleared', [9, 8, 7]);
  setResponse('to be cleared', 'repo', { text: 'x', citations: [], model: 'm', tokens: 1 });
  clearAll();
  // Re-import stats to check (cache module is stateful singleton)
  const { embeddingSize, responseSize } = stats();
  assert.equal(embeddingSize, 0);
  assert.equal(responseSize, 0);
});

// ── APIProvider ──────────────────────────────────────────────────────────────

section('APIProvider');

const { generate, embed, rateLimiterStats } = await import('../APIProvider.js');

await test('rateLimiterStats returns expected shape', () => {
  const s = rateLimiterStats();
  assert.ok(typeof s.requestsInLastMinute === 'number');
  assert.ok(typeof s.limitRpm === 'number');
  assert.ok(s.limitRpm > 0);
});

await test('generate() throws a clear error when keys are missing', async () => {
  if (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) {
    await assert.rejects(
      () => generate('test prompt', { complexity: 'complex' }),
      (err) => {
        // Should mention the key or unavailability — not a cryptic internal error
        assert.ok(
          err.message.includes('API_KEY') ||
          err.message.includes('unavailable') ||
          err.message.includes('temporarily'),
          `Unexpected error message: ${err.message}`
        );
        return true;
      }
    );
  }
});

await test('embed() returns cached vector without calling API', async () => {
  // Pre-populate the cache
  const cachedVector = [0.5, 0.6, 0.7];
  setEmbedding('cached embed test', cachedVector);

  const result = await embed('cached embed test');
  assert.deepEqual(result, cachedVector);
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n─────────────────────────────────────────────────`);
console.log(`Phase 1 tests: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
