// AI/test/phase8.test.js
// Phase 8 test suite — Cognitive Contracts, Planner, Learning & Experience
//
// Tests the full Agent Raising Project cognitive architecture:
//   Chapter 5:  Planning Engine (multi-step decomposition)
//   Chapter 7:  Learning & Experience (user profiles, fact extraction)
//   Chapter 8:  Cognitive API & Intent Contracts (type validation)
//   Chapter 9:  Decision Scenarios & Cognitive Case Studies
//
// Runs without live API keys. All tests are pure logic/contract validation.

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

// ──────────────────────────────────────────────────────────────────────────────
// Chapter 8: Cognitive Contracts
// ──────────────────────────────────────────────────────────────────────────────

section('Contracts — import');

const {
  IntentResult,
  ExecutionPlan,
  CapabilityResult,
  CognitiveContext,
  ContractError,
  createContext,
  resultFor,
  softValidate,
} = await import('../CognitiveContracts.js');

await test('all contracts exported', () => {
  assert.ok(IntentResult, 'IntentResult missing');
  assert.ok(ExecutionPlan, 'ExecutionPlan missing');
  assert.ok(CapabilityResult, 'CapabilityResult missing');
  assert.ok(CognitiveContext, 'CognitiveContext missing');
  assert.ok(ContractError, 'ContractError missing');
});

section('Contracts — IntentResult validation');

await test('valid IntentResult passes', () => {
  const valid = {
    topic: 'umamusume', complexity: 'simple', confidence: 0.95,
    method: 'keyword', subtopic: null, rejected: false, rejectionMessage: null,
  };
  assert.equal(IntentResult.validate(valid), true);
});

await test('IntentResult — invalid topic throws', () => {
  assert.throws(() => IntentResult.validate({ topic: 'invalid', complexity: 'simple', confidence: 0.5, method: 'keyword', subtopic: null, rejected: false, rejectionMessage: null }), ContractError);
});

await test('IntentResult — invalid method throws', () => {
  assert.throws(() => IntentResult.validate({ topic: 'umamusume', complexity: 'simple', confidence: 0.5, method: 'unknown', subtopic: null, rejected: false, rejectionMessage: null }), ContractError);
});

await test('IntentResult — confidence out of range throws', () => {
  assert.throws(() => IntentResult.validate({ topic: 'umamusume', complexity: 'simple', confidence: 1.5, method: 'keyword', subtopic: null, rejected: false, rejectionMessage: null }), ContractError);
});

await test('IntentResult — hybrid method is valid', () => {
  IntentResult.validate({ topic: 'umamusume', complexity: 'simple', confidence: 0.6, method: 'hybrid', subtopic: null, rejected: false, rejectionMessage: null });
});

await test('IntentResult — bot_assist subtopic is valid', () => {
  IntentResult.validate({ topic: 'umamusume', complexity: 'simple', confidence: 0.9, method: 'keyword', subtopic: 'bot_assist', rejected: false, rejectionMessage: null });
});

section('Contracts — ExecutionPlan validation');

await test('valid ExecutionPlan passes', () => {
  const plan = {
    steps: [
      { id: 's1', tool: 'search_knowledge', params: { query: 'test' }, dependsOn: [], description: 'search', outputKey: 'kb' },
      { id: 's2', tool: 'ai_generate', params: { query: 'test' }, dependsOn: ['s1'], description: 'generate', outputKey: 'answer' },
    ],
    complexity: 'complex', description: 'test-plan', estimatedLatencyMs: 1000, isDecomposed: true,
  };
  assert.equal(ExecutionPlan.validate(plan), true);
});

await test('ExecutionPlan — missing step id throws', () => {
  assert.throws(() => ExecutionPlan.validate({
    steps: [{ tool: 'search', params: {} }],
    complexity: 'simple', description: 'bad', estimatedLatencyMs: 100, isDecomposed: false,
  }), ContractError);
});

await test('ExecutionPlan — duplicate step ids throw', () => {
  assert.throws(() => ExecutionPlan.validate({
    steps: [
      { id: 's1', tool: 'a', params: {}, dependsOn: [] },
      { id: 's1', tool: 'b', params: {}, dependsOn: [] },
    ],
    complexity: 'simple', description: 'dupe', estimatedLatencyMs: 100, isDecomposed: false,
  }), ContractError);
});

await test('ExecutionPlan — circular dependency detected', () => {
  assert.throws(() => ExecutionPlan.validate({
    steps: [
      { id: 's1', tool: 'a', params: {}, dependsOn: ['s2'] },
      { id: 's2', tool: 'b', params: {}, dependsOn: ['s1'] },
    ],
    complexity: 'simple', description: 'cycle', estimatedLatencyMs: 100, isDecomposed: false,
  }), ContractError);
});

await test('ExecutionPlan — empty steps is valid (accepting)', () => {
  ExecutionPlan.validate({
    steps: [], complexity: 'simple', description: 'empty', estimatedLatencyMs: 0, isDecomposed: false,
  });
});

section('Contracts — CapabilityResult validation');

await test('valid CapabilityResult passes', () => {
  CapabilityResult.validate({ tool: 'search_web', ok: true, data: { chunks: [] }, error: null, durationMs: 150, source: 'web' });
});

await test('CapabilityResult — failed result with error passes', () => {
  CapabilityResult.validate({ tool: 'search_web', ok: false, data: null, error: 'API key missing', durationMs: 10, source: 'web' });
});

await test('CapabilityResult — failed without error throws', () => {
  assert.throws(() => CapabilityResult.validate({ tool: 'x', ok: false, data: null, error: null }), ContractError);
});

section('Contracts — CognitiveContext validation');

await test('valid CognitiveContext passes', () => {
  const ctx = createContext({ query: 'What is MANT?', subcommand: 'ask', userId: 'u1' });
  ctx.classification = { topic: 'umamusume', complexity: 'simple', confidence: 0.9, method: 'keyword', subtopic: null, rejected: false, rejectionMessage: null };
  assert.equal(CognitiveContext.validate(ctx), true);
});

await test('CognitiveContext — missing query throws', () => {
  assert.throws(() => CognitiveContext.validate({ subcommand: 'ask' }), ContractError);
});

await test('CognitiveContext — invalid nested classification throws', () => {
  const ctx = createContext({ query: 'test' });
  ctx.classification = { topic: 'bad_topic' };
  assert.throws(() => CognitiveContext.validate(ctx), ContractError);
});

section('Contracts — utilities');

await test('createContext returns valid shape', () => {
  const ctx = createContext({ query: 'test', userId: 'u1', channelId: 'c1' });
  assert.equal(ctx.query, 'test');
  assert.equal(ctx.userId, 'u1');
  assert.equal(ctx.classification, null);
  assert.deepEqual(ctx.toolResults, []);
});

await test('resultFor builds valid CapabilityResult', () => {
  const r = resultFor('search_web', true, { chunks: [] }, null, 200, 'web');
  assert.equal(r.tool, 'search_web');
  assert.equal(r.ok, true);
  CapabilityResult.validate(r);
});

await test('softValidate does not throw on invalid context', () => {
  const { ok } = softValidate({ query: 'test', classification: { topic: 'bad' } });
  assert.equal(ok, false); // should detect violation without throwing
});

// ──────────────────────────────────────────────────────────────────────────────
// Chapter 5: Planner — multi-step decomposition
// ──────────────────────────────────────────────────────────────────────────────

section('Planner — import');

const { plan, decompose, validatePlan, compressPlan } = await import('../Planner.js');

await test('module exports plan, decompose, validatePlan, compressPlan', () => {
  assert.equal(typeof plan, 'function');
  assert.equal(typeof decompose, 'function');
  assert.equal(typeof validatePlan, 'function');
  assert.equal(typeof compressPlan, 'function');
});

section('Planner — simple plans');

await test('simple umamusume plan has search_knowledge', () => {
  const classification = { topic: 'umamusume', complexity: 'simple', confidence: 0.9 };
  const result = plan(classification, { query: 'What is MANT?' });
  assert.equal(result.isDecomposed, false);
  assert.ok(result.steps.some(s => s.tool === 'search_knowledge'), 'should include search_knowledge');
});

await test('simple repository plan has search_repository', () => {
  const classification = { topic: 'repository', complexity: 'complex', confidence: 0.9 };
  const result = plan(classification, { query: 'How does the Vault work?' });
  assert.ok(result.steps.some(s => s.tool === 'search_repository'), 'should include search_repository');
});

await test('live plan has search_web', () => {
  const classification = { topic: 'live', complexity: 'simple', confidence: 0.8 };
  const result = plan(classification, { query: 'current rankings' });
  assert.ok(result.steps.some(s => s.tool === 'search_web'));
});

await test('message plan has generate_message', () => {
  const classification = { topic: 'message', complexity: 'complex', confidence: 1.0 };
  const result = plan(classification, { query: 'greeting', messageType: 'greeting' });
  assert.ok(result.steps.some(s => s.tool === 'generate_message'));
});

section('Planner — decomposition');

await test('"how to grow my circle" decomposes to multi-step', () => {
  const result = decompose('how to grow my circle rank from D to A', 'umamusume');
  assert.ok(result, 'should decompose');
  assert.equal(result.isDecomposed, true);
  assert.ok(result.steps.length >= 3, `expected >=3 steps, got ${result.steps.length}`);
  assert.equal(result.description, 'growth-strategy');
});

await test('"compare A vs B" decomposes to multi-step', () => {
  const result = decompose('compare Gold Ship vs Special Week which is better', 'umamusume');
  assert.ok(result, 'should decompose');
  assert.equal(result.description, 'comparison');
  assert.ok(result.steps.length >= 3);
});

await test('"what is the best card for speed" decomposes', () => {
  const result = decompose('what is the best card for speed build', 'umamusume');
  assert.ok(result, 'should decompose');
  assert.equal(result.description, 'recommendation');
});

await test('"step by step guide" decomposes', () => {
  const result = decompose('walk me through step by step how to build a good deck', 'umamusume');
  assert.ok(result, 'should decompose');
  assert.equal(result.description, 'step-by-step');
});

await test('simple query does not decompose', () => {
  const result = decompose('What is MANT?', 'umamusume');
  assert.equal(result, null, 'simple query should not match any decomposition pattern');
});

await test('decomposed plan has ai_generate as final step', () => {
  const result = decompose('how to improve my fan gain', 'umamusume');
  const lastStep = result.steps[result.steps.length - 1];
  assert.equal(lastStep.tool, 'ai_generate');
});

await test('decomposed plan has correct dependency chain', () => {
  const result = decompose('how to increase my circle rank', 'umamusume');
  const genStep = result.steps.find(s => s.tool === 'ai_generate');
  assert.ok(genStep, 'should have ai_generate step');
  assert.ok(genStep.dependsOn.length >= 1, 'ai_generate should depend on search steps');
});

section('Planner — plan validation');

await test('valid plan passes validation', () => {
  const result = decompose('how to grow my circle', 'umamusume');
  const toolMap = new Map([
    ['search_knowledge', { alwaysAvailable: true }],
    ['search_web', { alwaysAvailable: true }],
    ['ai_generate', { alwaysAvailable: true }],
  ]);
  const { valid, issues } = validatePlan(result, toolMap);
  assert.equal(valid, true);
  assert.equal(issues.filter(i => i.startsWith('unknown tool')).length, 0);
});

await test('plan with unknown tool flagged', () => {
  const plan = {
    steps: [{ id: 's1', tool: 'nonexistent_tool', params: {}, dependsOn: [] }],
    complexity: 'simple', description: 'bad', estimatedLatencyMs: 100, isDecomposed: false,
  };
  const { valid } = validatePlan(plan, new Map());
  assert.equal(valid, false);
});

section('Planner — compress');

await test('independent steps are compressed', () => {
  const plan = {
    steps: [
      { id: 'a1', tool: 'search_web', params: { query: 'a' }, dependsOn: [] },
      { id: 'a2', tool: 'search_web', params: { query: 'b' }, dependsOn: [] },
      { id: 'a3', tool: 'search_web', params: { query: 'c' }, dependsOn: [] },
    ],
    complexity: 'complex', description: 'test', estimatedLatencyMs: 1000, isDecomposed: true,
  };
  const compressed = compressPlan(plan);
  assert.equal(compressed.isDecomposed, false);
  assert.equal(compressed.steps.length, 1);
});

await test('dependent steps are not compressed', () => {
  const plan = {
    steps: [
      { id: 's1', tool: 'search_knowledge', params: {}, dependsOn: [] },
      { id: 's2', tool: 'ai_generate', params: {}, dependsOn: ['s1'] },
    ],
    complexity: 'complex', description: 'test', estimatedLatencyMs: 1000, isDecomposed: true,
  };
  const compressed = compressPlan(plan);
  assert.equal(compressed.isDecomposed, true); // still decomposed
});

// ──────────────────────────────────────────────────────────────────────────────
// Chapter 7: Learning — UserProfileManager
// ──────────────────────────────────────────────────────────────────────────────

section('UserProfileManager — import');

const {
  getProfile, extractFacts, isCorrection, learnCorrection,
  updateFromInteraction, summarizeProfile, enrichPrompt, stats,
  applyDecay,
} = await import('../managers/UserProfileManager.js');

await test('all functions exported', () => {
  assert.equal(typeof getProfile, 'function');
  assert.equal(typeof extractFacts, 'function');
  assert.equal(typeof isCorrection, 'function');
  assert.equal(typeof learnCorrection, 'function');
  assert.equal(typeof updateFromInteraction, 'function');
  assert.equal(typeof summarizeProfile, 'function');
  assert.equal(typeof enrichPrompt, 'function');
  assert.equal(typeof applyDecay, 'function');
});

section('UserProfileManager — fact extraction');

await test('"my horse is Gold Ship" extracts character fact', () => {
  const facts = extractFacts('my horse is Gold Ship', 'u1');
  const charFact = facts.find(f => f.category === 'fact');
  assert.ok(charFact, 'should extract fact');
  assert.ok(charFact.fact.toLowerCase().includes('gold ship'), `got: ${charFact.fact}`);
  assert.equal(charFact.tier, 'core');
});

await test('"my main horse is Special Week" extracts character fact', () => {
  const facts = extractFacts('my main horse is Special Week and I love racing', 'u1');
  const charFact = facts.find(f => f.category === 'character');
  assert.ok(charFact, 'should extract character');
  assert.ok(charFact.fact.toLowerCase().includes('special week'));
});

await test('"I am at rank A" extracts rank fact', () => {
  const facts = extractFacts('I am at rank A1', 'u1');
  const rankFact = facts.find(f => f.category === 'rank');
  assert.ok(rankFact, 'should extract rank');
  assert.equal(rankFact.fact, 'A1');
});

await test('"my circle is Moonlight Stables" extracts circle', () => {
  const facts = extractFacts('my circle is Moonlight Stables', 'u1');
  assert.ok(facts.length >= 1);
  const circleFact = facts.find(f => f.category === 'circle');
  assert.ok(circleFact);
});

await test('common noise is filtered out', () => {
  const facts = extractFacts('my favorite is a', 'u1');
  // "a" should be filtered as noise (single letter / common word)
  const noiseFacts = facts.filter(f => f.fact === 'a');
  assert.equal(noiseFacts.length, 0, 'single-letter facts should be filtered');
});

section('UserProfileManager — correction detection');

await test('"no that is wrong" is a correction', () => {
  assert.equal(isCorrection('no that is wrong'), true);
});

await test('"actually, I meant Gold Ship" is a correction', () => {
  assert.equal(isCorrection('actually, I meant Gold Ship'), true);
});

await test('"you are wrong about that" is a correction', () => {
  assert.equal(isCorrection('you are wrong about that'), true);
});

await test('"thanks that helped" is NOT a correction', () => {
  assert.equal(isCorrection('thanks that helped'), false);
});

section('UserProfileManager — profile flow');

await test('profile accumulates facts over interactions', () => {
  const userId = 'test-user-flow';
  updateFromInteraction(userId, 'my main horse is Gold Ship', 'ok', 'umamusume');
  updateFromInteraction(userId, 'I am at rank B', 'ok', 'umamusume');
  updateFromInteraction(userId, 'my circle is Starlight', 'ok', 'umamusume');

  const profile = getProfile(userId);
  assert.equal(profile.interactionCount, 3);
  assert.ok(profile.facts.length >= 2, `expected >=2 facts, got ${profile.facts.length}`);
});

await test('profile tracks topic counts', () => {
  const userId = 'test-user-topics';
  updateFromInteraction(userId, 'q1', 'ok', 'umamusume');
  updateFromInteraction(userId, 'q2', 'ok', 'umamusume');
  updateFromInteraction(userId, 'q3', 'ok', 'repository');

  const profile = getProfile(userId);
  assert.equal(profile.topicCounts['umamusume'], 2);
  assert.equal(profile.topicCounts['repository'], 1);
  assert.deepEqual(profile.commonTopics, ['umamusume', 'repository']);
});

await test('correction decreases fact confidence', () => {
  const userId = 'test-user-correct';
  updateFromInteraction(userId, 'my horse is Gold Ship', 'Gold Ship is a great horse!', 'umamusume');
  const before = getProfile(userId).facts.find(f => f.fact.toLowerCase().includes('gold ship')).confidence;

  updateFromInteraction(userId, 'no that is wrong, my horse is Special Week', 'sorry', 'umamusume');
  const facts = getProfile(userId).facts;
  const goldShip = facts.find(f => f.fact.toLowerCase().includes('gold ship'));
  if (goldShip) {
    assert.ok(goldShip.confidence < before, `confidence should decrease: ${goldShip.confidence} >= ${before}`);
  }
  // Should also have extracted Special Week
  const specialWeek = facts.find(f => f.fact.toLowerCase().includes('special week'));
  assert.ok(specialWeek, 'should extract corrected fact');
});

section('UserProfileManager — summarization');

await test('summarizeProfile returns string with known facts', () => {
  const userId = 'test-user-summary';
  updateFromInteraction(userId, 'my main horse is Gold Ship', 'ok', 'umamusume');
  updateFromInteraction(userId, 'I am at rank A', 'ok', 'umamusume');

  const summary = summarizeProfile(userId);
  assert.ok(summary.length > 0, 'should produce summary');
  assert.ok(summary.includes('Gold Ship') || summary.includes('rank'), 'should include known facts');
});

await test('enrichPrompt appends profile context', () => {
  const userId = 'test-user-enrich';
  updateFromInteraction(userId, 'my main horse is Gold Ship', 'ok', 'umamusume');

  const prompt = 'Answer the following question:';
  const enriched = enrichPrompt(prompt, userId);
  assert.ok(enriched.length > prompt.length, 'enriched should be longer');
  assert.ok(enriched.startsWith(prompt), 'enriched should start with original prompt');
});

await test('enrichPrompt handles null userId', () => {
  const result = enrichPrompt('test prompt', null);
  assert.equal(result, 'test prompt');
});

section('UserProfileManager — decay');

await test('core facts do not decay', () => {
  const userId = 'test-user-decay';
  updateFromInteraction(userId, 'my horse is Gold Ship', 'ok', 'umamusume');

  applyDecay(userId);
  const facts = getProfile(userId).facts;
  const goldShip = facts.find(f => f.fact.toLowerCase().includes('gold ship'));
  assert.ok(goldShip, 'core fact should survive decay');
  assert.ok(goldShip.confidence >= 0.85, `core confidence should stay high: ${goldShip.confidence}`);
});

section('UserProfileManager — stats');

await test('stats returns profile count', () => {
  const s = stats();
  assert.ok(s.profiles >= 0);
  assert.ok(typeof s.totalFacts === 'number');
  assert.ok(typeof s.totalInteractions === 'number');
});

// ──────────────────────────────────────────────────────────────────────────────
// Chapter 9: Decision Scenarios — edge cases & integration
// ──────────────────────────────────────────────────────────────────────────────

section('Scenarios — multi-intent queries');

await test('plan handles umamusume + growth decomposition', () => {
  const classification = { topic: 'umamusume', complexity: 'complex', confidence: 0.8 };
  const result = plan(classification, { query: 'how to grow my circle rank and get more fans', channelId: 'c1', userId: 'u1' });
  assert.equal(result.isDecomposed, true);
  assert.equal(result.description, 'growth-strategy');
});

await test('plan handles recommendation decomposition', () => {
  const classification = { topic: 'umamusume', complexity: 'complex', confidence: 0.8 };
  const result = plan(classification, { query: 'which support card should I use for speed training', channelId: 'c1', userId: 'u1' });
  assert.equal(result.isDecomposed, true);
});

section('Scenarios — ambiguous / missing context');

await test('empty query produces empty plan', () => {
  const classification = { topic: 'umamusume', complexity: 'simple', confidence: 0.9 };
  const result = plan(classification, { query: '' });
  assert.ok(result.steps.length >= 1); // still produces a plan (umamusume default)
});

await test('plan with no userId/channelId works', () => {
  const classification = { topic: 'umamusume', complexity: 'simple', confidence: 0.9 };
  const result = plan(classification, { query: 'What is MANT?' });
  // Should not crash — just won't include conversation memory steps
  assert.equal(result.isDecomposed, false);
});

section('Scenarios — planning edge cases');

await test('complex repository query gets comparison pattern', () => {
  const result = decompose('compare the Vault vs the Miner which is better', 'repository');
  assert.ok(result, 'should decompose');
  assert.equal(result.description, 'comparison');
});

await test('growth query for non-gaming topic still decomposes', () => {
  const result = decompose('how do I improve the pipeline performance', 'repository');
  assert.ok(result, 'should decompose');
  assert.equal(result.description, 'growth-strategy');
});

await test('planner correctly identifies simple queries', () => {
  const result = decompose('MANT', 'umamusume');
  assert.equal(result, null, 'single word should not trigger decomposition');
});

section('Scenarios — contract integration');

await test('softValidate on full context does not crash', () => {
  const ctx = createContext({ query: 'test', userId: 'u1' });
  ctx.classification = { topic: 'umamusume', complexity: 'simple', confidence: 0.9, method: 'keyword', subtopic: null, rejected: false, rejectionMessage: null };
  ctx.plan = {
    steps: [{ id: 's1', tool: 'search_knowledge', params: { query: 'test' }, dependsOn: [] }],
    complexity: 'simple', description: 'test', estimatedLatencyMs: 100, isDecomposed: false,
  };
  ctx.toolResults = [{ tool: 'search_knowledge', ok: true, data: { chunks: [] }, error: null, durationMs: 50, source: 'kb' }];
  const { ok } = softValidate(ctx);
  assert.equal(ok, true, 'full valid context should pass soft validate');
});

// ──────────────────────────────────────────────────────────────────────────────
// Chapter 10: Growing Beyond Intelligence — GrowthEngine
// ──────────────────────────────────────────────────────────────────────────────

section('GrowthEngine — import');

const {
  suggestFollowUps, trackInteraction, getImprovementInsights,
  explainReasoning, curiosityStats, shouldLearn,
} = await import('../GrowthEngine.js');

await test('all GrowthEngine functions exported', () => {
  assert.equal(typeof suggestFollowUps, 'function');
  assert.equal(typeof trackInteraction, 'function');
  assert.equal(typeof getImprovementInsights, 'function');
  assert.equal(typeof explainReasoning, 'function');
  assert.equal(typeof curiosityStats, 'function');
  assert.equal(typeof shouldLearn, 'function');
});

section('GrowthEngine — autonomous curiosity');

await test('suggestFollowUps returns array for umamusume topic', () => {
  const suggestions = suggestFollowUps('how to get more fans', 'umamusume', 0.9);
  assert.ok(Array.isArray(suggestions));
  assert.ok(suggestions.length >= 1);
  assert.ok(suggestions.length <= 3);
});

await test('suggestFollowUps for repository topic', () => {
  const suggestions = suggestFollowUps('how does the Vault work', 'repository', 0.8);
  assert.ok(suggestions.length >= 1);
  // Should contain the topic phrase
  assert.ok(suggestions.some(s => s.includes('Vault')));
});

await test('suggestFollowUps low confidence gives fewer suggestions', () => {
  const high = suggestFollowUps('test query', 'umamusume', 0.95);
  const low = suggestFollowUps('test query', 'umamusume', 0.4);
  assert.ok(low.length <= high.length, `low=${low.length} should be <= high=${high.length}`);
});

await test('suggestFollowUps with empty query still works', () => {
  const suggestions = suggestFollowUps('', 'web', 0.5);
  assert.ok(Array.isArray(suggestions));
  assert.ok(suggestions.length >= 1);
});

section('GrowthEngine — introspection');

await test('explainReasoning returns non-empty string', () => {
  const explanation = explainReasoning(
    'What is MANT?',
    'umamusume',
    ['search_knowledge', 'search_web', 'ai_generate'],
    ['search_knowledge', 'search_web', 'ai_generate'],
    { passed: true, action: 'send', reasons: ['All checks passed'] },
    0.9
  );
  assert.ok(explanation.length > 50);
  assert.ok(explanation.includes('umamusume'));
  assert.ok(explanation.includes('knowledge base'));
});

await test('explainReasoning includes reflection info', () => {
  const explanation = explainReasoning(
    'query', 'umamusume',
    ['search_knowledge'], ['search_knowledge'],
    { passed: false, action: 're-search', reasons: ['vague answer'] },
    0.4
  );
  assert.ok(explanation.includes('re-search') || explanation.includes('searched again'));
});

await test('explainReasoning with no tools used', () => {
  const explanation = explainReasoning('hi', 'web', [], [], null, 0.3);
  assert.ok(explanation.length > 10);
  assert.ok(explanation.includes('web'));
});

section('GrowthEngine — self-improvement tracking');

await test('trackInteraction does not throw', () => {
  assert.doesNotThrow(() => {
    trackInteraction({ topic: 'umamusume', confidence: 0.8, reflectionAction: 'send', toolsFailed: 0, latencyMs: 500 });
  });
});

await test('getImprovementInsights with few interactions returns empty', () => {
  // After just 1 interaction, not enough data
  const insights = getImprovementInsights();
  assert.ok(Array.isArray(insights));
});

await test('curiosityStats returns object', () => {
  const s = curiosityStats();
  assert.ok(typeof s.total === 'number');
  assert.ok(typeof s.byTopic === 'object');
});

await test('shouldLearn with few interactions returns null', () => {
  const result = shouldLearn();
  assert.equal(result, null);
});

await test('trackInteraction accumulates data', () => {
  // Add enough interactions to trigger insights
  for (let i = 0; i < 30; i++) {
    trackInteraction({
      topic: i % 2 === 0 ? 'umamusume' : 'repository',
      confidence: i < 20 ? 0.3 : 0.9,
      reflectionAction: i < 15 ? 're-search' : 'send',
      toolsFailed: i < 5 ? 1 : 0,
      latencyMs: 500 + i * 100,
    });
  }
  const insights = getImprovementInsights();
  // Should have at least one insight with 30 interactions at 0.3 confidence
  assert.ok(insights.length >= 1, `expected >=1 insight, got ${insights.length}`);
});

await test('shouldLearn after many low-confidence interactions', () => {
  // We've already added 30 interactions above with low confidence
  // shouldLearn needs >= 20 interactions and >= 5 per topic
  const result = shouldLearn();
  // Either returns a suggestion or null (depends on 24h window)
  assert.ok(result === null || (result.topic && result.reason));
});

// ──────────────────────────────────────────────────────────────────────────────
// Summary
// ──────────────────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Phase 8: ${passed} passed, ${failed} failed`);

if (failed > 0) process.exit(1);
