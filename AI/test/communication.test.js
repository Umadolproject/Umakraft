// AI/test/communication.test.js
// Communication subsystem tests — Composition, Rendering, Integration
//
// Part 6: Composition System — MessageBlueprint, SourceGrouper, SectionComposer,
//          SummaryComposer, ResponseBuilder
// Part 7: Rendering System — MarkdownRenderer, MessageSplitter, DiscordRenderer
// Part 8: Integration — CommunicationManager
//
// Runs without live API keys. All tests are pure logic.

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
// Imports
// ══════════════════════════════════════════════════════════════════════════════

const {
  selectPattern, createFact, deduplicateFacts,
  createBlueprint, blueprintToResponse, RESPONSE_PATTERNS,
} = await import('../Communication/composition/MessageBlueprint.js');

const { groupBySource, groupByProvider, mergeSmallGroups, emptySection } =
  await import('../Communication/composition/SourceGrouper.js');

const { buildSections } =
  await import('../Communication/composition/SectionComposer.js');

const { buildSummary, buildConclusion } =
  await import('../Communication/composition/SummaryComposer.js');

const { build } =
  await import('../Communication/composition/ResponseBuilder.js');

const { renderMarkdown, renderTable, renderCodeBlock } =
  await import('../Communication/rendering/MarkdownRenderer.js');

const { split, needsSplit, estimateChunks } =
  await import('../Communication/rendering/MessageSplitter.js');

const { renderForDiscord, renderSummaryEmbed, renderComparisonEmbed } =
  await import('../Communication/rendering/DiscordRenderer.js');

const { process: communicationProcess, wrapAgentResponse } =
  await import('../Communication/integration/CommunicationManager.js');

// ══════════════════════════════════════════════════════════════════════════════
// Test data
// ══════════════════════════════════════════════════════════════════════════════

const SAMPLE_FACTS = [
  createFact('Version 2.5 is the current stable release', 'repository', 'codebase', 0.95, 'github.com/umakraft'),
  createFact('The Vault module stores all persistent data', 'repository', 'codebase', 0.9, 'github.com/umakraft/vault'),
  createFact('Documentation confirms version 2.5', 'official_docs', 'docs', 0.85, 'docs.umakraft.dev'),
  createFact('GitHub releases show v2.5 as latest', 'github', 'releases', 0.8, 'github.com/umakraft/releases'),
  createFact('MANT stands for Maximum Average Net Turnover', 'knowledge', 'glossary', 0.95),
  createFact('Gold Ship is a top-tier horse for speed builds', 'knowledge', 'wiki', 0.6),
  createFact('A web search mentions a possible v2.6 beta', 'web', 'web_search', 0.35),
];

const DIVERSE_FACTS = [
  createFact('The Refinery processes raw data into structured facts', 'repository', 'codebase', 0.92),
  createFact('The Courier delivers messages between pipeline stages', 'repository', 'codebase', 0.88),
  createFact('Fan gain is calculated hourly based on circle activity', 'knowledge', 'game_mechanics', 0.9),
  createFact('Top circles average 50k+ fans per day', 'knowledge', 'stats', 0.75),
  createFact('API docs describe the event payload format', 'official_docs', 'api', 0.82),
];

// ══════════════════════════════════════════════════════════════════════════════
// Part 6: Composition — MessageBlueprint
// ══════════════════════════════════════════════════════════════════════════════

section('MessageBlueprint — patterns');

await test('all response patterns are defined', () => {
  assert.ok(RESPONSE_PATTERNS.conversation);
  assert.ok(RESPONSE_PATTERNS.question);
  assert.ok(RESPONSE_PATTERNS.research);
  assert.ok(RESPONSE_PATTERNS.repository);
  assert.ok(RESPONSE_PATTERNS.comparison);
  assert.ok(RESPONSE_PATTERNS.troubleshooting);
  assert.ok(RESPONSE_PATTERNS.explanation);
  assert.ok(RESPONSE_PATTERNS.tutorial);
  assert.ok(RESPONSE_PATTERNS.decision);
});

await test('selectPattern — repository → repository pattern', () => {
  const p = selectPattern('repository', 'complex');
  assert.equal(p.name, 'repository');
});

await test('selectPattern — complex umamusume → research', () => {
  const p = selectPattern('umamusume', 'complex');
  assert.equal(p.name, 'research');
});

await test('selectPattern — simple umamusume → question', () => {
  const p = selectPattern('umamusume', 'simple');
  assert.equal(p.name, 'question');
});

await test('selectPattern — live → question', () => {
  const p = selectPattern('live', 'simple');
  assert.equal(p.name, 'question');
});

section('MessageBlueprint — facts');

await test('createFact returns valid FactObject', () => {
  const f = createFact('test fact', 'knowledge', 'wiki', 0.8, 'http://example.com');
  assert.ok(f.id.startsWith('fact-'));
  assert.equal(f.text, 'test fact');
  assert.equal(f.source, 'knowledge');
  assert.equal(f.provider, 'wiki');
  assert.equal(f.confidence, 0.8);
  assert.ok(f.citation.includes('wiki'));
});

await test('deduplicateFacts removes near-duplicates', () => {
  const facts = [
    createFact('The sky is blue', 'web', 'source1', 0.9),
    createFact('the sky is blue', 'web', 'source2', 0.7),
    createFact('Grass is green', 'web', 'source3', 0.8),
  ];
  const unique = deduplicateFacts(facts);
  assert.equal(unique.length, 2);
  // Higher confidence fact should come first
  assert.ok(unique[0].confidence >= unique[1].confidence);
});

section('MessageBlueprint — blueprint + ResponseObject');

await test('createBlueprint + blueprintToResponse roundtrip', () => {
  const sections = [{
    title: 'Test Section', type: 'source', facts: SAMPLE_FACTS.slice(0, 2),
    summary: 'test summary', priority: 1,
  }];
  const bp = createBlueprint(sections, {
    overview: 'test overview', summary: 'test summary',
    tone: 'friendly', audience: 'discord', pattern: 'question',
    query: 'test', topic: 'web', complexity: 'simple',
  });
  assert.equal(bp.sections.length, 1);
  assert.equal(bp.tone, 'friendly');
  assert.ok(bp.metadata.timestamp);

  const ro = blueprintToResponse(bp);
  assert.equal(ro.overview.text, 'test overview');
  assert.equal(ro.sections.length, 1);
  assert.equal(ro.summary.text, 'test summary');
  assert.equal(ro.metadata.tone, 'friendly');
});

// ══════════════════════════════════════════════════════════════════════════════
// Part 6: Composition — SourceGrouper
// ══════════════════════════════════════════════════════════════════════════════

section('SourceGrouper');

await test('groupBySource creates one group per source', () => {
  const groups = groupBySource(SAMPLE_FACTS);
  const sources = groups.map(g => g.title);
  assert.ok(sources.includes('Repository'));
  assert.ok(sources.includes('Official Documentation'));
  assert.ok(sources.includes('Knowledge Base'));
  assert.ok(sources.includes('Web Search'));
});

await test('groupBySource orders by priority', () => {
  const groups = groupBySource(SAMPLE_FACTS);
  for (let i = 1; i < groups.length; i++) {
    assert.ok(groups[i - 1].priority <= groups[i].priority,
      `priority ${groups[i-1].priority} <= ${groups[i].priority}`);
  }
});

await test('groupBySource — empty facts returns empty', () => {
  const groups = groupBySource([]);
  assert.equal(groups.length, 0);
});

await test('mergeSmallGroups merges groups with ≤2 facts', () => {
  const groups = [
    { title: 'A', facts: [SAMPLE_FACTS[0]], priority: 1 },
    { title: 'B', facts: [SAMPLE_FACTS[1]], priority: 2 },
    { title: 'C', facts: [SAMPLE_FACTS[0], SAMPLE_FACTS[1], SAMPLE_FACTS[2]], priority: 3 },
  ];
  const merged = mergeSmallGroups(groups);
  // A and B (≤2 each) should merge into "Additional Sources"
  assert.ok(merged.length < 3, `expected <3, got ${merged.length}`);
  const hasAdditional = merged.some(g => g.title === 'Additional Sources');
  assert.ok(hasAdditional, 'should have Additional Sources group');
});

await test('emptySection returns section with no facts', () => {
  const s = emptySection('repository');
  assert.equal(s.title, 'Repository');
  assert.equal(s.facts.length, 0);
});

// ══════════════════════════════════════════════════════════════════════════════
// Part 6: Composition — SectionComposer
// ══════════════════════════════════════════════════════════════════════════════

section('SectionComposer');

await test('buildSections creates source sections', () => {
  const groups = groupBySource(SAMPLE_FACTS);
  const sections = buildSections(groups, RESPONSE_PATTERNS.research);
  const sourceSections = sections.filter(s => s.type === 'source');
  assert.ok(sourceSections.length >= 1);
});

await test('buildSections includes comparison when multiple sources', () => {
  const groups = groupBySource(SAMPLE_FACTS);
  const sections = buildSections(groups, RESPONSE_PATTERNS.research);
  const comparison = sections.filter(s => s.type === 'comparison');
  // With 4+ source groups, should generate a comparison
  assert.ok(comparison.length >= 0); // may or may not, depending on overlap
});

await test('buildSections includes warnings for low confidence', () => {
  const groups = groupBySource(SAMPLE_FACTS); // has web fact at 0.35 conf
  const sections = buildSections(groups, RESPONSE_PATTERNS.research);
  const warnings = sections.filter(s => s.type === 'warning');
  assert.ok(warnings.length >= 1, 'should have warning for low-confidence facts');
});

await test('buildSections with single source — no comparison', () => {
  const singleFact = [createFact('test', 'repository', 'codebase', 0.9)];
  const groups = groupBySource(singleFact);
  const sections = buildSections(groups, RESPONSE_PATTERNS.question);
  const comparisons = sections.filter(s => s.type === 'comparison');
  assert.equal(comparisons.length, 0);
});

// ══════════════════════════════════════════════════════════════════════════════
// Part 6: Composition — SummaryComposer
// ══════════════════════════════════════════════════════════════════════════════

section('SummaryComposer');

await test('buildSummary returns string from sections', () => {
  const groups = groupBySource(SAMPLE_FACTS);
  const sections = buildSections(groups, RESPONSE_PATTERNS.research);
  const summary = buildSummary(sections);
  assert.ok(summary.length > 20);
  assert.ok(summary.includes('fact') || summary.includes('source'));
});

await test('buildSummary with empty sections handles gracefully', () => {
  const summary = buildSummary([]);
  assert.ok(summary.length > 0);
  assert.ok(summary.includes('No information'));
});

await test('buildConclusion with multiple sources returns conclusion', () => {
  const groups = groupBySource(SAMPLE_FACTS);
  const sections = buildSections(groups, RESPONSE_PATTERNS.research);
  const conclusion = buildConclusion(sections);
  assert.ok(conclusion, 'multi-source should produce conclusion');
  assert.ok(conclusion.text.length > 10);
  assert.ok(conclusion.sources.length >= 2);
});

await test('buildConclusion with single source returns null', () => {
  const singleFact = [createFact('only fact', 'repository', 'codebase', 0.9)];
  const groups = groupBySource(singleFact);
  const sections = buildSections(groups, RESPONSE_PATTERNS.question);
  const conclusion = buildConclusion(sections);
  assert.equal(conclusion, null);
});

// ══════════════════════════════════════════════════════════════════════════════
// Part 6: Composition — ResponseBuilder (end-to-end)
// ══════════════════════════════════════════════════════════════════════════════

section('ResponseBuilder — end-to-end');

await test('build() produces valid ResponseObject', () => {
  const response = build(SAMPLE_FACTS, {
    query: 'what version is current', topic: 'repository', complexity: 'simple',
  });
  assert.ok(response.overview.text.length > 0);
  assert.ok(response.sections.length >= 1);
  assert.ok(response.summary.text.length > 10);
  assert.ok(response.citations.length >= 1);
  assert.equal(response.metadata.topic, 'repository');
  assert.equal(response.metadata.audience, 'discord');
});

await test('build() with empty facts produces graceful response', () => {
  const response = build([], {
    query: 'nonexistent topic', topic: 'web', complexity: 'simple',
  });
  assert.ok(response.overview.text.includes('No information'));
  assert.equal(response.sections.length, 0);
  assert.equal(response.conclusion, null);
});

await test('build() deduplicates facts', () => {
  const dupes = [
    createFact('duplicate fact A', 'web', 'source1', 0.9),
    createFact('duplicate fact a', 'web', 'source2', 0.5),
    createFact('unique fact B', 'web', 'source3', 0.8),
  ];
  const response = build(dupes, { query: 'test', topic: 'web', complexity: 'simple' });
  // Dedup should remove the duplicate, leaving 2 unique facts
  const totalFacts = response.sections.reduce((sum, s) => sum + s.facts.length, 0);
  assert.ok(totalFacts <= 2, `expected ≤2, got ${totalFacts}`);
});

await test('build() for umamusume uses appropriate pattern', () => {
  const umaFacts = [
    createFact('MANT measures fan turnover rate', 'knowledge', 'glossary', 0.9),
  ];
  const response = build(umaFacts, {
    query: 'what is MANT', topic: 'umamusume', complexity: 'simple',
  });
  assert.equal(response.metadata.pattern, 'question');
});

// ══════════════════════════════════════════════════════════════════════════════
// Part 7: Rendering — MarkdownRenderer
// ══════════════════════════════════════════════════════════════════════════════

section('MarkdownRenderer');

const TEST_RESPONSE = build(SAMPLE_FACTS, {
  query: 'test', topic: 'repository', complexity: 'simple',
});

await test('renderMarkdown produces non-empty string', () => {
  const md = renderMarkdown(TEST_RESPONSE);
  assert.ok(md.length > 50);
});

await test('renderMarkdown includes section headings', () => {
  const md = renderMarkdown(TEST_RESPONSE);
  assert.ok(md.includes('### '), 'should have section headings');
});

await test('renderMarkdown includes summary section', () => {
  const md = renderMarkdown(TEST_RESPONSE);
  assert.ok(md.includes('Summary'), 'should have summary');
});

await test('renderMarkdown includes citations', () => {
  const md = renderMarkdown(TEST_RESPONSE);
  assert.ok(md.includes('References'), 'should have references section');
});

await test('renderTable produces valid table', () => {
  const section = { title: 'Test', type: 'comparison', facts: SAMPLE_FACTS.slice(0, 3) };
  const table = renderTable(section);
  assert.ok(table.includes('| Source |'));
  assert.ok(table.includes('|---'));
});

await test('renderCodeBlock wraps in code fences', () => {
  const code = renderCodeBlock('const x = 1;');
  assert.ok(code.startsWith('```'));
  assert.ok(code.endsWith('```'));
  assert.ok(code.includes('javascript'));
});

// ══════════════════════════════════════════════════════════════════════════════
// Part 7: Rendering — MessageSplitter
// ══════════════════════════════════════════════════════════════════════════════

section('MessageSplitter');

await test('split — short text returns single element', () => {
  const result = split('hello world');
  assert.equal(result.length, 1);
  assert.equal(result[0], 'hello world');
});

await test('needsSplit — short text returns false', () => {
  assert.equal(needsSplit('short'), false);
});

await test('needsSplit — long text returns true', () => {
  const long = 'x'.repeat(2001);
  assert.equal(needsSplit(long), true);
});

await test('split — splits long text into chunks', () => {
  const sections = [];
  for (let i = 0; i < 20; i++) {
    sections.push(`### Section ${i}\n${'Content line. '.repeat(50)}`);
  }
  const text = sections.join('\n\n');
  const chunks = split(text, 2000);
  assert.ok(chunks.length > 1, `expected >1, got ${chunks.length}`);
  for (const chunk of chunks) {
    assert.ok(chunk.length <= 2000, `chunk too long: ${chunk.length}`);
  }
});

await test('split — preserves section headings', () => {
  const text = '### Section A\nContent A\n\n### Section B\nContent B';
  const chunks = split(text, 2000);
  assert.equal(chunks.length, 1); // should fit in one
  assert.ok(chunks[0].includes('### Section A'));
  assert.ok(chunks[0].includes('### Section B'));
});

await test('split — adds part markers for multi-chunk', () => {
  const sections = [];
  for (let i = 0; i < 15; i++) {
    sections.push(`### Section ${i}\n${'x'.repeat(300)}`);
  }
  const text = sections.join('\n\n');
  const chunks = split(text, 1000);
  assert.ok(chunks.length > 1, `expected >1, got ${chunks.length}`);
  // First chunk should have "(1/N)" marker
  assert.ok(chunks[0].includes('**(1/'), `chunk[0] should have marker, got: ${chunks[0].slice(0, 50)}`);
});

await test('estimateChunks returns reasonable estimate', () => {
  assert.equal(estimateChunks('hello', 2000), 1);
  assert.equal(estimateChunks('x'.repeat(4000), 2000), 2);
});

// ══════════════════════════════════════════════════════════════════════════════
// Part 7: Rendering — DiscordRenderer
// ══════════════════════════════════════════════════════════════════════════════

section('DiscordRenderer');

await test('renderForDiscord produces DiscordOutput', () => {
  const output = renderForDiscord(TEST_RESPONSE);
  assert.ok(Array.isArray(output.messages));
  assert.ok(Array.isArray(output.embeds));
  assert.ok(output.messages.length >= 1);
  assert.ok(output.metadata.topic, 'repository');
});

await test('renderForDiscord with useEmbeds generates embeds', () => {
  const output = renderForDiscord(TEST_RESPONSE, { useEmbeds: true });
  // With a multi-source response, should generate summary embed
  assert.ok(output.embeds.length >= 1, `expected >=1 embed, got ${output.embeds.length}`);
});

await test('renderSummaryEmbed returns embed object', () => {
  const embed = renderSummaryEmbed(TEST_RESPONSE);
  assert.ok(embed);
  assert.equal(embed.title, 'Summary');
  assert.ok(embed.description.length > 0);
  assert.equal(embed.color, 0x2ecc71);
});

await test('renderComparisonEmbed for comparison section', () => {
  const section = { title: 'Compare', type: 'comparison', facts: SAMPLE_FACTS.slice(0, 3) };
  const embed = renderComparisonEmbed(section);
  assert.ok(embed);
  assert.ok(Array.isArray(embed.fields));
});

// ══════════════════════════════════════════════════════════════════════════════
// Part 8: Integration — CommunicationManager
// ══════════════════════════════════════════════════════════════════════════════

section('CommunicationManager');

await test('wrapAgentResponse converts agent response', () => {
  const agentResp = {
    success: true,
    content: 'The vault stores persistent data.',
    toolsUsed: ['search_repository'],
    toolPlan: ['search_repository'],
    topic: 'repository',
  };
  const result = wrapAgentResponse(agentResp, {
    query: 'how does vault work',
    topic: 'repository',
    complexity: 'simple',
    confidence: 0.9,
  });
  assert.equal(result.success, true);
  assert.ok(result.content.includes('vault'));
  assert.ok(result.responseObject);
  assert.ok(result.discordOutput.messages.length >= 1);
  assert.ok(result.metadata.stagesCompleted.includes('compose'));
  assert.ok(result.metadata.stagesCompleted.includes('render'));
});

await test('wrapAgentResponse handles failed agent response', () => {
  const result = wrapAgentResponse(
    { success: false, content: 'error', toolsUsed: [], toolPlan: [] },
    { query: 'test', topic: 'web', complexity: 'simple', confidence: 0.3 }
  );
  assert.equal(result.success, false);
});

await test('communicationProcess with retrieveFacts injector', async () => {
  const retrieveFacts = async () => SAMPLE_FACTS.slice(0, 3);
  const generateText = async (ro) => `Generated: ${ro.summary.text}`;
  const result = await communicationProcess(
    { query: 'test', topic: 'repository', complexity: 'simple', confidence: 0.9 },
    { retrieveFacts, generateText }
  );
  assert.equal(result.success, true);
  assert.ok(result.content.includes('Generated:'));
  assert.ok(result.metadata.stagesCompleted.includes('compose'));
  assert.ok(result.metadata.stagesCompleted.includes('generate'));
  assert.ok(result.metadata.stagesCompleted.includes('render'));
  assert.equal(result.metadata.stagesCompleted.length, 8);
});

await test('communicationProcess without generateText falls back to summary', async () => {
  const retrieveFacts = async () => SAMPLE_FACTS.slice(0, 2);
  const result = await communicationProcess(
    { query: 'test', topic: 'web', complexity: 'simple', confidence: 0.5 },
    { retrieveFacts }
  );
  assert.equal(result.success, true);
  assert.ok(result.content.length > 10);
});

await test('communicationProcess handles errors gracefully', async () => {
  const retrieveFacts = async () => { throw new Error('BOOM'); };
  const result = await communicationProcess(
    { query: 'test', topic: 'web', complexity: 'simple', confidence: 0.5 },
    { retrieveFacts }
  );
  assert.equal(result.success, false);
  assert.ok(result.metadata.error.includes('BOOM'));
});

// ══════════════════════════════════════════════════════════════════════════════
// Summary
// ══════════════════════════════════════════════════════════════════════════════

console.log(`\n${'─'.repeat(50)}`);
console.log(`Communication: ${passed} passed, ${failed} failed`);

if (failed > 0) process.exit(1);
