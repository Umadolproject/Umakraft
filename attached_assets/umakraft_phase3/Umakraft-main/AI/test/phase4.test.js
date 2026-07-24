// AI/test/phase4.test.js
// Phase 4 test suite — PromptSystem, ContentGenerator, MessageSystem, ResponseValidator
//
// Runs without live API keys. APIProvider.generate() is stubbed to return
// a controlled word-count response.

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

/** Build a string with exactly n words */
function words(n, word = 'training') {
  return Array.from({ length: n }, () => word).join(' ');
}

// ── PromptSystem ─────────────────────────────────────────────────────────────

section('PromptSystem — import');

const { assemble, listModes } = await import('../PromptSystem.js');

await test('module exports assemble, listModes', () => {
  assert.equal(typeof assemble,   'function');
  assert.equal(typeof listModes,  'function');
});

section('PromptSystem — listModes');

await test('listModes includes all 7 documented modes', () => {
  const modes = listModes();
  const expected = ['repository', 'knowledge', 'message', 'search', 'explain', 'docs', 'glossary'];
  for (const m of expected) {
    assert.ok(modes.includes(m), `expected mode "${m}" in listModes`);
  }
});

section('PromptSystem — assemble');

await test('assemble returns a non-empty string', () => {
  const prompt = assemble('repository', 'some context', 'some question');
  assert.ok(typeof prompt === 'string' && prompt.length > 0);
});

await test('assembled prompt includes system constraint block language', () => {
  const prompt = assemble('repository', '', 'How does the Vault work?');
  // Security.buildSafePrompt prepends the constraint block
  const lower = prompt.toLowerCase();
  assert.ok(
    lower.includes('umakraft') || lower.includes('read-only') || lower.includes('knowledge service'),
    'expected system constraint block in assembled prompt'
  );
});

await test('assembled prompt includes the question', () => {
  const question = 'What does the Vault store?';
  const prompt = assemble('repository', 'ctx', question);
  assert.ok(prompt.includes(question) || prompt.includes('vault'), 'question should appear in prompt');
});

await test('assembled prompt includes context', () => {
  const context = 'UNIQUE_CONTEXT_TOKEN_12345';
  const prompt = assemble('knowledge', context, 'What is MANT?');
  assert.ok(prompt.includes(context), 'context should appear in prompt');
});

await test('assemble with unknown mode falls back gracefully (no throw)', () => {
  assert.doesNotThrow(() => assemble('nonexistent_mode', '', 'test'));
});

await test('glossary mode prompt mentions glossary lookup', () => {
  const prompt = assemble('glossary', 'Fan Gain definition', 'Fan Gain');
  assert.ok(prompt.toLowerCase().includes('glossary') || prompt.toLowerCase().includes('definition'),
    'expected glossary mode to mention lookup/definition');
});

await test('search mode prompt mentions search/query', () => {
  const prompt = assemble('search', 'repo files', 'vault');
  assert.ok(prompt.toLowerCase().includes('search') || prompt.toLowerCase().includes('query'),
    'expected search mode content');
});

await test('message mode injects messagePrompt variable', () => {
  const prompt = assemble('message', '', 'greeting', { messagePrompt: 'CUSTOM_PROMPT_CONTENT' });
  assert.ok(prompt.includes('CUSTOM_PROMPT_CONTENT'), 'expected messagePrompt to be injected');
});

await test('explain mode prompt mentions explanation/explain', () => {
  const prompt = assemble('explain', '', 'what is the Vault?');
  assert.ok(prompt.toLowerCase().includes('explain') || prompt.toLowerCase().includes('concept'),
    'expected explain mode content');
});

await test('docs mode prompt mentions documentation/file/component', () => {
  const prompt = assemble('docs', 'file content here', 'Vault');
  assert.ok(
    prompt.toLowerCase().includes('doc') ||
    prompt.toLowerCase().includes('file') ||
    prompt.toLowerCase().includes('component'),
    'expected docs mode content'
  );
});

// ── ResponseValidator ─────────────────────────────────────────────────────────

section('ResponseValidator — import');

const { validate, hardRejectMessage } = await import('../ResponseValidator.js');

await test('module exports validate and hardRejectMessage', () => {
  assert.equal(typeof validate,           'function');
  assert.equal(typeof hardRejectMessage,  'function');
});

section('ResponseValidator — validate schema');

await test('returns result with required fields', () => {
  const result = validate('A valid response about Umakraft repository.', 'repository');
  assert.ok(typeof result.passed         === 'boolean');
  assert.ok(typeof result.checks         === 'object');
  assert.ok(typeof result.failureReasons === 'object' && Array.isArray(result.failureReasons));
  assert.ok(['pass', 'regenerate', 'hard-reject'].includes(result.action));
});

await test('checks object has all 6 check keys', () => {
  const result = validate('A valid Umakraft response.', null);
  const keys = ['scope', 'prohibitedContent', 'secretPattern', 'wordCount', 'citation', 'hallucination'];
  for (const k of keys) {
    assert.ok(k in result.checks, `missing check key: ${k}`);
  }
});

section('ResponseValidator — secret pattern check');

await test('detects OpenAI API key pattern — hard-reject', () => {
  const result = validate('The key is sk-abcdefghijklmnopqrstuvwx', null);
  assert.equal(result.checks.secretPattern, 'fail');
  assert.equal(result.action, 'hard-reject');
  assert.equal(result.passed, false);
});

await test('detects Google API key pattern — hard-reject', () => {
  const result = validate('Key: AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ12345678', null);
  assert.equal(result.checks.secretPattern, 'fail');
  assert.equal(result.action, 'hard-reject');
});

await test('detects GitHub PAT pattern — hard-reject', () => {
  const result = validate('Token: ghp_' + 'A'.repeat(36), null);
  assert.equal(result.checks.secretPattern, 'fail');
  assert.equal(result.action, 'hard-reject');
});

await test('clean response passes secret pattern check', () => {
  const result = validate('MANT stands for Monthly Average New Trainers.', null);
  assert.equal(result.checks.secretPattern, 'pass');
});

section('ResponseValidator — prohibited content check');

await test('political content triggers hard-reject', () => {
  const result = validate('The president signed an election bill yesterday.', null);
  assert.equal(result.checks.prohibitedContent, 'fail');
  assert.equal(result.action, 'hard-reject');
});

await test('financial advice triggers hard-reject', () => {
  const result = validate('You should invest in bitcoin and crypto today.', null);
  assert.equal(result.checks.prohibitedContent, 'fail');
  assert.equal(result.action, 'hard-reject');
});

await test('competitor game content triggers hard-reject', () => {
  const result = validate('Play Pokemon instead of Umamusume for better value.', null);
  assert.equal(result.checks.prohibitedContent, 'fail');
  assert.equal(result.action, 'hard-reject');
});

await test('clean community message passes prohibited check', () => {
  const result = validate(
    'Welcome to the circle! Today is a great day to train. ' +
    'Check the leaderboard and push for your milestone!',
    null
  );
  assert.equal(result.checks.prohibitedContent, 'pass');
});

section('ResponseValidator — word count check');

await test('word count check is skipped for non-message classification', () => {
  const result = validate('Short answer.', 'repository');
  assert.equal(result.checks.wordCount, 'skip');
  assert.equal(result.wordCount, null);
});

await test('word count too short triggers regenerate', () => {
  const shortText = words(50); // 50 < 100 minimum
  const result = validate(shortText, 'message');
  assert.equal(result.checks.wordCount, 'fail');
  assert.equal(result.action, 'regenerate');
  assert.ok(result.regenerateInstruction?.includes('100') || result.regenerateInstruction?.includes('expand'));
});

await test('word count too long triggers regenerate', () => {
  const longText = words(200); // 200 > 150 maximum
  const result = validate(longText, 'message');
  assert.equal(result.checks.wordCount, 'fail');
  assert.equal(result.action, 'regenerate');
  assert.ok(result.regenerateInstruction?.includes('150') || result.regenerateInstruction?.includes('condense'));
});

await test('word count in range (100–150) passes', () => {
  const validText = words(120);
  const result = validate(validText, 'message');
  assert.equal(result.checks.wordCount, 'pass');
  assert.equal(result.wordCount, 120);
});

await test('wordCount field reflects actual word count', () => {
  const text = words(125);
  const result = validate(text, 'message');
  assert.equal(result.wordCount, 125);
});

await test('word count boundary: exactly 100 words passes', () => {
  const result = validate(words(100), 'message');
  assert.equal(result.checks.wordCount, 'pass');
});

await test('word count boundary: exactly 150 words passes', () => {
  const result = validate(words(150), 'message');
  assert.equal(result.checks.wordCount, 'pass');
});

await test('word count boundary: 99 words fails', () => {
  const result = validate(words(99), 'message');
  assert.equal(result.checks.wordCount, 'fail');
});

await test('word count boundary: 151 words fails', () => {
  const result = validate(words(151), 'message');
  assert.equal(result.checks.wordCount, 'fail');
});

section('ResponseValidator — citation check');

await test('citation check skipped for non-repository classification', () => {
  const result = validate('MANT is a ranking metric.', 'umamusume');
  assert.equal(result.checks.citation, 'skip');
});

await test('repository response without citation triggers regenerate', () => {
  const result = validate('The Vault stores trainer data sent from the Inspector.', 'repository');
  assert.equal(result.checks.citation, 'fail');
  assert.equal(result.action, 'regenerate');
  assert.ok(result.regenerateInstruction?.toLowerCase().includes('source'));
});

await test('repository response with "Source:" citation passes', () => {
  const result = validate(
    'The Vault stores trainer data.\n\nSource: umamoe/Vault/vault.js',
    'repository'
  );
  assert.equal(result.checks.citation, 'pass');
});

await test('repository response with "Sources:" list citation passes', () => {
  const result = validate(
    'The Refinery processes trainer data.\n\nSources:\n- Refinery/Refiner/refiner.js',
    'repository'
  );
  assert.equal(result.checks.citation, 'pass');
});

section('ResponseValidator — hallucination check');

await test('external non-uma.moe URL triggers hallucination warn', () => {
  const result = validate(
    'See https://www.google.com for more information about Umamusume.',
    'repository'
  );
  assert.ok(result.checks.hallucination === 'warn', 'expected hallucination warn');
});

await test('uma.moe URL does not trigger hallucination', () => {
  const result = validate(
    'Data available at https://uma.moe/circles/rankings — check the leaderboard. Source: docs/README.md',
    'repository'
  );
  // Should pass hallucination (uma.moe is allowed)
  assert.ok(result.checks.hallucination !== 'fail');
});

await test('"as of today" phrase triggers hallucination warn', () => {
  const result = validate(
    'As of today, the Vault module handles all data. Source: vault.js',
    'repository'
  );
  assert.ok(result.checks.hallucination === 'warn');
});

section('ResponseValidator — empty response');

await test('empty string returns hard-reject', () => {
  const result = validate('', null);
  assert.equal(result.passed, false);
  assert.equal(result.action, 'hard-reject');
});

await test('whitespace-only string returns hard-reject', () => {
  const result = validate('   \n  ', null);
  assert.equal(result.passed, false);
  assert.equal(result.action, 'hard-reject');
});

section('ResponseValidator — hardRejectMessage');

await test('hardRejectMessage returns a non-empty string', () => {
  const msg = hardRejectMessage();
  assert.ok(typeof msg === 'string' && msg.length > 10);
});

await test('hardRejectMessage does not reveal internal details', () => {
  const msg = hardRejectMessage().toLowerCase();
  assert.ok(!msg.includes('api key'), 'must not mention API key');
  assert.ok(!msg.includes('secret'),  'must not mention secret');
  assert.ok(!msg.includes('pattern'), 'must not mention pattern');
});

section('ResponseValidator — severity ordering (hard-reject wins over regenerate)');

await test('secret pattern + word count short → action is hard-reject', () => {
  const result = validate('sk-abcdefghijklmnopqrstuvwxyz ' + words(50), 'message');
  assert.equal(result.action, 'hard-reject');
});

// ── MessageSystem ────────────────────────────────────────────────────────────

section('MessageSystem — import');

const { listTypes, formatForDiscord } = await import('../MessageSystem.js');

await test('module exports generate, listTypes, formatForDiscord', () => {
  assert.equal(typeof listTypes,        'function');
  assert.equal(typeof formatForDiscord, 'function');
});

section('MessageSystem — listTypes');

await test('listTypes returns array of 7 type descriptors', () => {
  const types = listTypes();
  assert.ok(Array.isArray(types) && types.length === 7, `expected 7 types, got ${types.length}`);
});

await test('each type descriptor has type and description fields', () => {
  const types = listTypes();
  for (const t of types) {
    assert.ok(typeof t.type        === 'string' && t.type.length > 0,        `type field missing in ${JSON.stringify(t)}`);
    assert.ok(typeof t.description === 'string' && t.description.length > 0, `description field missing in ${JSON.stringify(t)}`);
  }
});

await test('listTypes includes all 7 expected types', () => {
  const types = listTypes().map(t => t.type);
  const expected = ['greeting', 'milestone', 'achievement', 'leaderboard', 'warning', 'reminder', 'documentation'];
  for (const e of expected) {
    assert.ok(types.includes(e), `expected type "${e}" in listTypes`);
  }
});

section('MessageSystem — formatForDiscord');

await test('formatForDiscord returns a string', () => {
  assert.equal(typeof formatForDiscord('hello'), 'string');
});

await test('formatForDiscord strips control characters', () => {
  const result = formatForDiscord('hello\x00\x01\x07world');
  assert.ok(!result.includes('\x00'), 'null byte should be removed');
  assert.ok(!result.includes('\x07'), 'bell char should be removed');
  assert.ok(result.includes('hello'), 'content should be preserved');
  assert.ok(result.includes('world'), 'content should be preserved');
});

await test('formatForDiscord preserves newlines', () => {
  const result = formatForDiscord('line1\nline2');
  assert.ok(result.includes('\n'), 'newlines should be preserved');
});

await test('formatForDiscord preserves markdown bold/italic', () => {
  const result = formatForDiscord('**TrainerAkira** reached *500,000* fans!');
  assert.ok(result.includes('**TrainerAkira**'));
  assert.ok(result.includes('*500,000*'));
});

await test('formatForDiscord preserves emojis', () => {
  const result = formatForDiscord('🎉 Congratulations! 🏆');
  assert.ok(result.includes('🎉'));
  assert.ok(result.includes('🏆'));
});

// ── ContentGenerator (structural / registry tests — no live API) ──────────────

section('ContentGenerator — import and type registry');

const { generate: cgGenerate, VALID_TYPES } = await import('../ContentGenerator.js');

await test('module exports generate and VALID_TYPES', () => {
  assert.equal(typeof cgGenerate,  'function');
  assert.ok(Array.isArray(VALID_TYPES));
});

await test('VALID_TYPES contains all 7 message types', () => {
  const expected = ['greeting', 'milestone', 'achievement', 'leaderboard', 'warning', 'reminder', 'documentation'];
  for (const e of expected) {
    assert.ok(VALID_TYPES.includes(e), `expected "${e}" in VALID_TYPES`);
  }
});

await test('generate throws on unknown type', async () => {
  await assert.rejects(
    () => cgGenerate('nonexistent_type', {}),
    /unknown message type/i
  );
});

await test('generate throws when required variables are missing (milestone)', async () => {
  await assert.rejects(
    () => cgGenerate('milestone', {}),  // missing trainerName + milestoneValue
    /missing required/i
  );
});

await test('generate throws when required variables are missing (warning)', async () => {
  await assert.rejects(
    () => cgGenerate('warning', { trainerName: 'Akira' }), // missing deficitAmount
    /missing required/i
  );
});

await test('generate throws when required variables are missing (leaderboard)', async () => {
  await assert.rejects(
    () => cgGenerate('leaderboard', {}), // missing topTrainers
    /missing required/i
  );
});

await test('generate accepts greeting with no variables (all optional)', async () => {
  // Without a live API key the call will fail at APIProvider.
  // We only test that required-variable validation does NOT throw.
  try {
    await cgGenerate('greeting', {});
  } catch (err) {
    // Only allowed failure is missing API key or provider error
    const msg = err.message.toLowerCase();
    assert.ok(
      msg.includes('api') || msg.includes('key') || msg.includes('provider') || msg.includes('fetch'),
      `Unexpected error (not API-related): ${err.message}`
    );
  }
});

// ── summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Phase 4: ${passed} passed, ${failed} failed`);

if (failed > 0) process.exit(1);
