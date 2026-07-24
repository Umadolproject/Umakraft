// AI/test/phase3.test.js
// Phase 3 test suite — KnowledgeEngine
//
// Runs without live API keys. All tests are pure / synchronous.

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

// ── KnowledgeEngine ──────────────────────────────────────────────────────────

section('KnowledgeEngine — import');

const { lookup, search, getContext, isUmamusumeTopic, allTerms } =
  await import('../KnowledgeEngine.js');

await test('module exports lookup, search, getContext, isUmamusumeTopic, allTerms', () => {
  assert.equal(typeof lookup,            'function');
  assert.equal(typeof search,            'function');
  assert.equal(typeof getContext,        'function');
  assert.equal(typeof isUmamusumeTopic,  'function');
  assert.equal(typeof allTerms,          'function');
});

// ── lookup ───────────────────────────────────────────────────────────────────

section('KnowledgeEngine — lookup');

await test('exact match: MANT', () => {
  const result = lookup('MANT');
  assert.ok(result, 'expected a result');
  assert.equal(result.entry.term, 'MANT');
  assert.ok(result.score >= 0.9, `expected high score, got ${result.score}`);
});

await test('case-insensitive match: mant', () => {
  const result = lookup('mant');
  assert.ok(result, 'expected a result');
  assert.equal(result.entry.term, 'MANT');
});

await test('alias match: Monthly Average New Trainers', () => {
  const result = lookup('Monthly Average New Trainers');
  assert.ok(result, 'expected a result');
  assert.equal(result.entry.term, 'MANT');
});

await test('exact match: Fan Gain', () => {
  const result = lookup('Fan Gain');
  assert.ok(result, 'expected a result');
  assert.equal(result.entry.term, 'Fan Gain');
});

await test('alias match: fans gained', () => {
  const result = lookup('fans gained');
  assert.ok(result, 'expected a result');
  assert.equal(result.entry.term, 'Fan Gain');
});

await test('exact match: Circle Rank', () => {
  const result = lookup('Circle Rank');
  assert.ok(result, 'expected a result');
  assert.equal(result.entry.term, 'Circle Rank');
});

await test('exact match: Fan Deficit', () => {
  const result = lookup('Fan Deficit');
  assert.ok(result, 'expected a result');
  assert.equal(result.entry.term, 'Fan Deficit');
});

await test('match: Milestone', () => {
  const result = lookup('Milestone');
  assert.ok(result, 'expected a result');
  assert.equal(result.entry.term, 'Milestone');
});

await test('match: Blueprint', () => {
  const result = lookup('Blueprint');
  assert.ok(result, 'expected a result');
  assert.equal(result.entry.term, 'Blueprint');
});

await test('match: Vault', () => {
  const result = lookup('Vault');
  assert.ok(result, 'expected a result');
  assert.equal(result.entry.term, 'Vault');
});

await test('match: Depot', () => {
  const result = lookup('Depot');
  assert.ok(result, 'expected a result');
  assert.equal(result.entry.term, 'Depot');
});

await test('match: Trend', () => {
  const result = lookup('Trend');
  assert.ok(result, 'expected a result');
  assert.equal(result.entry.term, 'Trend');
});

await test('match: Gain Source (alias: delta)', () => {
  const result = lookup('delta');
  assert.ok(result, 'expected a result');
  assert.equal(result.entry.term, 'Gain Source');
});

await test('unknown term returns null', () => {
  const result = lookup('xyzzy not a term');
  assert.equal(result, null);
});

await test('glossary entry includes definition, category, relatedTerms, source', () => {
  const result = lookup('MANT');
  assert.ok(result, 'expected a result');
  assert.ok(typeof result.entry.definition === 'string' && result.entry.definition.length > 0);
  assert.ok(typeof result.entry.category   === 'string' && result.entry.category.length > 0);
  assert.ok(Array.isArray(result.entry.relatedTerms));
  assert.ok(typeof result.entry.source     === 'string');
});

// ── search ───────────────────────────────────────────────────────────────────

section('KnowledgeEngine — search');

await test('search("MANT") returns at least one chunk', () => {
  const chunks = search('MANT');
  assert.ok(chunks.length > 0, 'expected at least one chunk');
});

await test('top chunk for "MANT" has source=knowledge', () => {
  const chunks = search('MANT');
  assert.equal(chunks[0].source, 'knowledge');
});

await test('chunks include content, filePath, heading, score, source', () => {
  const chunks = search('fan gain');
  assert.ok(chunks.length > 0, 'expected results');
  const c = chunks[0];
  assert.ok(typeof c.content  === 'string' && c.content.length > 0,  'content missing');
  assert.ok(typeof c.filePath === 'string' && c.filePath.length > 0,  'filePath missing');
  assert.ok(typeof c.score    === 'number' && c.score >= 0 && c.score <= 1, 'score out of range');
  assert.equal(c.source, 'knowledge');
});

await test('chunks are sorted by score descending', () => {
  const chunks = search('circle rank');
  for (let i = 1; i < chunks.length; i++) {
    assert.ok(chunks[i - 1].score >= chunks[i].score,
      `chunks not sorted: [${i-1}].score=${chunks[i-1].score} < [${i}].score=${chunks[i].score}`);
  }
});

await test('search("fan deficit calculation") returns mechanic catalog results', () => {
  const chunks = search('fan deficit calculation');
  assert.ok(chunks.length > 0, 'expected mechanic catalog results');
  const hasMechanic = chunks.some(c => c.filePath.includes('mechanics'));
  assert.ok(hasMechanic, 'expected a mechanics chunk');
});

await test('search("trend tier elite upward") returns mechanic catalog results', () => {
  const chunks = search('trend tier elite upward');
  assert.ok(chunks.length > 0, 'expected results for trend tier query');
});

await test('search("completely unrelated xyz") returns empty or low-score results', () => {
  const chunks = search('completely unrelated xyz no match at all');
  // Either empty or every chunk has a very low score
  const highScore = chunks.filter(c => c.score > 0.5);
  assert.equal(highScore.length, 0, 'expected no high-score results for unrelated query');
});

// ── getContext ────────────────────────────────────────────────────────────────

section('KnowledgeEngine — getContext');

await test('getContext returns same structure as search', () => {
  const ctx = getContext('MANT circle rank');
  const srch = search('MANT circle rank');
  assert.equal(ctx.length, srch.length);
});

// ── isUmamusumeTopic ──────────────────────────────────────────────────────────

section('KnowledgeEngine — isUmamusumeTopic');

await test('returns true for "What is MANT?"', () => {
  assert.equal(isUmamusumeTopic('What is MANT?'), true);
});

await test('returns true for "explain fan gain"', () => {
  assert.equal(isUmamusumeTopic('explain fan gain'), true);
});

await test('returns true for "umamusume circle rank"', () => {
  assert.equal(isUmamusumeTopic('umamusume circle rank'), true);
});

await test('returns true for "pretty derby trainer level"', () => {
  assert.equal(isUmamusumeTopic('pretty derby trainer level'), true);
});

await test('returns false for "how does the Vault work?"', () => {
  // "vault" is a repository term, not umamusume
  assert.equal(isUmamusumeTopic('how does the Vault store data?'), false);
});

await test('returns false for "what is the stock price of Nintendo"', () => {
  assert.equal(isUmamusumeTopic('what is the stock price of Nintendo'), false);
});

// ── allTerms ──────────────────────────────────────────────────────────────────

section('KnowledgeEngine — allTerms');

await test('allTerms returns an array of objects with term, category, aliases', () => {
  const terms = allTerms();
  assert.ok(Array.isArray(terms) && terms.length >= 12, `expected ≥12 terms, got ${terms.length}`);
  for (const t of terms) {
    assert.ok(typeof t.term     === 'string' && t.term.length > 0,  `term missing in ${JSON.stringify(t)}`);
    assert.ok(typeof t.category === 'string' && t.category.length > 0, `category missing in ${JSON.stringify(t)}`);
    assert.ok(Array.isArray(t.aliases),                             `aliases missing in ${JSON.stringify(t)}`);
  }
});

await test('allTerms includes MANT, Fan Gain, Circle Rank, Trend, Vault, Depot', () => {
  const terms = allTerms();
  const names = terms.map(t => t.term);
  for (const expected of ['MANT', 'Fan Gain', 'Circle Rank', 'Trend', 'Vault', 'Depot']) {
    assert.ok(names.includes(expected), `expected "${expected}" in allTerms`);
  }
});

// ── summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Phase 3: ${passed} passed, ${failed} failed`);

if (failed > 0) process.exit(1);
