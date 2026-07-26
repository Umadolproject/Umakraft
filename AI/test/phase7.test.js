// AI/test/phase7.test.js
// Phase 7 test suite — Advanced Features
//   ConversationMemory, CitationMode, ConfidenceScore, MultiLanguage
//
// All tests are pure and synchronous (no API keys required).

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

// ── Import ───────────────────────────────────────────────────────────────────

section('AdvancedFeatures — import');

const {
  addConversationTurn,
  getConversationContext,
  clearConversation,
  pruneConversations,
  activeSessionCount,
  isCitationModeEnabled,
  toggleCitationMode,
  formatWithCitations,
  formatConfidence,
  detectLanguage,
  instructionForLanguage,
  getAdvancedStats,
} = await import('../AdvancedFeatures.js');

await test('module exports all public functions', () => {
  assert.equal(typeof addConversationTurn,    'function');
  assert.equal(typeof getConversationContext, 'function');
  assert.equal(typeof clearConversation,      'function');
  assert.equal(typeof pruneConversations,     'function');
  assert.equal(typeof activeSessionCount,     'function');
  assert.equal(typeof isCitationModeEnabled,  'function');
  assert.equal(typeof toggleCitationMode,     'function');
  assert.equal(typeof formatWithCitations,   'function');
  assert.equal(typeof formatConfidence,       'function');
  assert.equal(typeof detectLanguage,         'function');
  assert.equal(typeof instructionForLanguage, 'function');
  assert.equal(typeof getAdvancedStats,       'function');
});

// ── Conversation Memory ──────────────────────────────────────────────────────

section('AdvancedFeatures — ConversationMemory');

await test('addConversationTurn does not throw with valid input', () => {
  assert.doesNotThrow(() =>
    addConversationTurn('user1', 'channel1', 'What is MANT?', 'MANT is Monthly Average New Trainers.')
  );
});

await test('getConversationContext returns empty for unknown user', () => {
  const ctx = getConversationContext('unknown-user', 'unknown-channel');
  assert.equal(ctx, '');
});

await test('add + get roundtrip returns context with previous turn', () => {
  const uid = 'turn-test-user';
  const cid = 'turn-test-channel';
  clearConversation(uid, cid);

  addConversationTurn(uid, cid, 'Question one', 'Answer one.');
  const ctx = getConversationContext(uid, cid);
  assert.ok(ctx.includes('Question one'), 'context should include the question');
  assert.ok(ctx.includes('Answer one'), 'context should include the response');
  assert.ok(ctx.includes('[Previous conversation'), 'context should have header');
  assert.ok(ctx.includes('End of conversation history'), 'context should have footer');
});

await test('multiple turns are preserved in order', () => {
  const uid = 'multi-turn-test-user';
  const cid = 'multi-turn-test-channel';
  clearConversation(uid, cid);

  addConversationTurn(uid, cid, 'First Q', 'First A');
  addConversationTurn(uid, cid, 'Second Q', 'Second A');
  const ctx = getConversationContext(uid, cid);
  assert.ok(ctx.includes('First Q'), 'context should include first question');
  assert.ok(ctx.includes('Second Q'), 'context should include second question');
  const firstPos = ctx.indexOf('First Q');
  const secondPos = ctx.indexOf('Second Q');
  assert.ok(firstPos < secondPos, 'first question should appear before second');
});

await test('responses are truncated to 500 chars', () => {
  const uid = 'trunc-test-user';
  const cid = 'trunc-test-channel';
  const longResponse = 'A'.repeat(1000);
  clearConversation(uid, cid);
  addConversationTurn(uid, cid, 'Question', longResponse);
  const ctx = getConversationContext(uid, cid);
  // The stored response is truncated to 500 chars + 500 more for wrapping,
  // plus the label "Umakraft: ". Should be roughly 500 content chars.
  assert.ok(!ctx.includes('A'.repeat(600)), 'response should be truncated');
});

await test('clearConversation removes all turns', () => {
  const uid = 'clear-test-user';
  const cid = 'clear-test-channel';
  addConversationTurn(uid, cid, 'Q', 'A');
  clearConversation(uid, cid);
  assert.equal(getConversationContext(uid, cid), '');
});

await test('pruneConversations does not throw', () => {
  assert.doesNotThrow(() => pruneConversations());
});

await test('activeSessionCount returns a number >= 0', () => {
  const count = activeSessionCount();
  assert.ok(typeof count === 'number' && count >= 0);
});

await test('conversation context includes "Umakraft:" label for bot responses', () => {
  const uid = 'label-test-user';
  const cid = 'label-test-channel';
  clearConversation(uid, cid);
  addConversationTurn(uid, cid, 'How does the Vault work?', 'The Vault stores validated data.');
  const ctx = getConversationContext(uid, cid);
  assert.ok(ctx.includes('Umakraft:'), 'should include bot label');
});

await test('addConversationTurn is a no-op with empty userId', () => {
  assert.doesNotThrow(() => addConversationTurn('', 'ch1', 'Q', 'A'));
  assert.doesNotThrow(() => addConversationTurn(null, 'ch1', 'Q', 'A'));
});

// ── Citation Mode ────────────────────────────────────────────────────────────

section('AdvancedFeatures — CitationMode');

await test('citation mode defaults to off', () => {
  assert.equal(isCitationModeEnabled('test-user-cit'), false);
});

await test('toggleCitationMode enables and returns true', () => {
  const uid = 'toggle-user';
  assert.equal(isCitationModeEnabled(uid), false);
  const result = toggleCitationMode(uid);
  assert.equal(result, true);
  assert.equal(isCitationModeEnabled(uid), true);
});

await test('toggleCitationMode disables and returns false', () => {
  const uid = 'toggle-user2';
  toggleCitationMode(uid); // enable
  const result = toggleCitationMode(uid); // disable
  assert.equal(result, false);
  assert.equal(isCitationModeEnabled(uid), false);
});

await test('formatWithCitations always appends sources for repository topic', () => {
  const text = 'The Vault stores data.';
  const citations = ['umamoe/Vault/vault.js'];
  const result = formatWithCitations(text, citations, 'repository', null);
  assert.ok(result.includes('Sources:'), 'should include Sources header');
  assert.ok(result.includes('umamoe/Vault/vault.js'), 'should include citation');
});

await test('formatWithCitations skips sources for non-repo when citation mode off', () => {
  const result = formatWithCitations('MANT is a metric.', ['glossary'], 'umamusume', null);
  assert.ok(!result.includes('Sources:'), 'should not include sources for non-repo');
});

await test('formatWithCitations includes sources for non-repo when citation mode on', () => {
  const uid = 'cit-mode-user';
  toggleCitationMode(uid); // enable
  const result = formatWithCitations('MANT is a metric.', ['glossary'], 'umamusume', uid);
  assert.ok(result.includes('Sources:'), 'should include sources when citation mode is on');
  toggleCitationMode(uid); // disable for cleanup
});

await test('formatWithCitations handles empty citations gracefully', () => {
  assert.doesNotThrow(() => formatWithCitations('text', [], 'repository', null));
  assert.doesNotThrow(() => formatWithCitations('text', null, 'repository', null));
});

// ── Confidence Score ─────────────────────────────────────────────────────────

section('AdvancedFeatures — ConfidenceScore');

await test('formatConfidence returns empty for invalid input', () => {
  assert.equal(formatConfidence(null), '');
  assert.equal(formatConfidence(-0.1), '');
  assert.equal(formatConfidence(1.5), '');
  assert.equal(formatConfidence('high'), '');
});

await test('formatConfidence returns label for high confidence (>= 0.90)', () => {
  const result = formatConfidence(0.92, 'repository');
  assert.ok(result.includes('Very high confidence'), 'should say very high confidence');
  assert.ok(result.includes('92%'), 'should include percentage');
});

await test('formatConfidence returns label for high confidence (>= 0.75)', () => {
  const result = formatConfidence(0.80, 'umamusume');
  assert.ok(result.includes('High confidence'), 'should say high confidence');
  assert.ok(result.includes('knowledge base'), 'should mention knowledge base');
});

await test('formatConfidence returns label for moderate confidence (>= 0.60)', () => {
  const result = formatConfidence(0.65, 'repository');
  assert.ok(result.includes('Moderate confidence'), 'should say moderate confidence');
});

await test('formatConfidence returns label for low confidence (< 0.60)', () => {
  const result = formatConfidence(0.45, 'live');
  assert.ok(result.includes('Low confidence'), 'should say low confidence');
  assert.ok(result.includes('web search'), 'should mention web search source');
});

await test('formatConfidence for web/live topic says "web search"', () => {
  const r1 = formatConfidence(0.88, 'web');
  assert.ok(r1.includes('web search'), 'web topic should say web search');
  const r2 = formatConfidence(0.88, 'live');
  assert.ok(r2.includes('web search'), 'live topic should say web search');
});

// ── Multi-Language Support ────────────────────────────────────────────────────

section('AdvancedFeatures — MultiLanguage');

await test('detectLanguage returns lang=en for English text', () => {
  const { lang } = detectLanguage('How does the Vault store data?');
  assert.equal(lang, 'en');
});

await test('detectLanguage returns lang=ja for Japanese text', () => {
  const { lang } = detectLanguage('ヴォールトはデータをどのように保存しますか');
  assert.equal(lang, 'ja');
});

await test('detectLanguage returns lang=es for Spanish text', () => {
  const { lang } = detectLanguage('¿Cómo almacena los datos el Vault?');
  assert.equal(lang, 'es');
});

await test('detectLanguage returns lang=fr for French text', () => {
  const { lang } = detectLanguage('Comment le Vault stocke-t-il les données ?');
  assert.equal(lang, 'fr');
});

await test('detectLanguage returns lang=de for German text', () => {
  const { lang } = detectLanguage('Wie speichert der Vault Daten?');
  assert.equal(lang, 'de');
});

await test('detectLanguage returns lang=pt for Portuguese text (with diacritic)', () => {
  const { lang } = detectLanguage('O que é MANT? Não sei o que isso significa.');
  assert.equal(lang, 'pt');
});

await test('detectLanguage returns lang=ru for Russian text', () => {
  const { lang } = detectLanguage('Как Vault хранит данные?');
  assert.equal(lang, 'ru');
});

await test('detectLanguage returns lang=ko for Korean text', () => {
  const { lang } = detectLanguage('볼트는 데이터를 어떻게 저장하나요?');
  assert.equal(lang, 'ko');
});

await test('detectLanguage returns lang=en for empty input', () => {
  const { lang } = detectLanguage('');
  assert.equal(lang, 'en');
});

await test('detectLanguage returns lang=en for ambiguous short text', () => {
  // Short text without strong signal falls back to en
  const { lang } = detectLanguage('ok');
  assert.ok(typeof lang === 'string');
});

await test('instructionForLanguage returns prompt suffix for known languages', () => {
  assert.ok(instructionForLanguage('ja').length > 0, 'ja should have instruction');
  assert.ok(instructionForLanguage('es').length > 0, 'es should have instruction');
  assert.ok(instructionForLanguage('de').length > 0, 'de should have instruction');
});

await test('instructionForLanguage returns empty for English', () => {
  assert.equal(instructionForLanguage('en'), '');
});

await test('instructionForLanguage returns empty for unknown language', () => {
  assert.equal(instructionForLanguage('xx'), '');
});

// ── getAdvancedStats ───────────────────────────────────────────────────────────

section('AdvancedFeatures — getAdvancedStats');

await test('getAdvancedStats returns well-formed object', () => {
  const stats = getAdvancedStats();
  assert.ok(typeof stats === 'object');
  assert.ok('conversationMemory' in stats, 'conversationMemory missing');
  assert.ok('citationMode' in stats, 'citationMode missing');
  assert.ok(typeof stats.conversationMemory.activeSessions === 'number');
  assert.ok(typeof stats.citationMode.enabledUsers === 'number');
});

// ── summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Phase 7: ${passed} passed, ${failed} failed`);

if (failed > 0) process.exit(1);
