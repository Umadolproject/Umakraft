// AI/Communication/test/communication.test.js
// Communication System — end-to-end tests
import assert from 'node:assert/strict';
let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (err) { console.error(`  ✗ ${name}\n    ${err.message}`); failed++; }
}
function section(title) { console.log(`\n── ${title} ──`); }

section('Part 6 — Composition');
const { createBlueprint, toResponseObject, addFact, cite, RESPONSE_PATTERNS, MESSAGE_STYLES } = await import('../composition/MessageBlueprint.js');

await test('MessageBlueprint exports', () => {
  assert.ok(createBlueprint && toResponseObject && addFact && cite);
  assert.ok(RESPONSE_PATTERNS.research && MESSAGE_STYLES.friendly);
});

await test('createBlueprint + addFact + cite', () => {
  const bp = createBlueprint({ pattern: 'question' });
  addFact(bp, { fact: 'test', provider: 'web', confidence: 0.9, source: 'u' }, 'source');
  addFact(bp, { fact: 'another', provider: 'web', confidence: 0.8, source: 'u2' }, 'source');
  assert.equal(bp.sections.length, 1);
  assert.equal(bp.sections[0].facts.length, 2);
  assert.equal(cite({ fact:'t', provider:'web', confidence:0.7, source:'s' }, 3).label, '[3]');
});

await test('toResponseObject', () => {
  const bp = createBlueprint();
  bp.overview = 'Test'; bp.summary = { keyPoints:['P1'], conclusion:'OK' };
  bp.sections = [{ id:'s1', heading:'T', type:'source', facts:[{ fact:'f1', provider:'web', confidence:0.9, source:'u' }], priority:0 }];
  bp.citations = [{ label:'[1]', source:'u', provider:'web', confidence:0.9 }];
  const ro = toResponseObject(bp);
  assert.equal(ro.metadata.totalFacts, 1);
  assert.equal(ro.summary.conclusion, 'OK');
});

const F = [
  { fact:'Vault manages secrets', provider:'repository', confidence:0.95, source:'v.js' },
  { fact:'MANT calculates fans', provider:'knowledge-base', confidence:0.9, source:'kb' },
  { fact:'Vault uses AES', provider:'repository', confidence:0.85, source:'v.js' },
  { fact:'Latest update', provider:'web', confidence:0.7, source:'g8' },
  { fact:'User asked MANT', provider:'memory', confidence:0.6, source:'conv' },
];

const { groupByProvider, deduplicateFacts } = await import('../composition/SourceGrouper.js');
await test('groupByProvider sorts by priority', () => {
  const g = groupByProvider(F);
  assert.ok(g.length === 4);
  assert.equal(g[0].provider, 'knowledge-base');
});
await test('deduplicateFacts', () => {
  const d = deduplicateFacts([
    { fact:'Vault manages secrets', provider:'repo', confidence:0.8, source:'a' },
    { fact:'Vault manages secrets', provider:'repo', confidence:0.9, source:'b' },
    { fact:'Other', provider:'repo', confidence:0.7, source:'c' },
  ]);
  assert.equal(d.length, 2);
  assert.equal(d.find(f=>f.fact.includes('Vault')).confidence, 0.9);
});

const { buildSections } = await import('../composition/SectionComposer.js');
await test('buildSections produces source sections', () => {
  const s = buildSections(groupByProvider(F), 'research');
  assert.ok(s.length >= 1 && s.some(x => x.type === 'source'));
});

const { buildSummary, buildConclusion } = await import('../composition/SummaryComposer.js');
await test('buildSummary + buildConclusion', () => {
  const { keyPoints, conclusion } = buildSummary(F, { maxPoints:3 });
  assert.ok(keyPoints.length >= 1 && conclusion.length > 0);
  assert.ok(buildSummary(F, { maxPoints:2 }).keyPoints.length <= 2);
  const { keyPoints: kp, conclusion: c } = buildSummary([]);
  assert.equal(kp.length, 0);
  assert.ok(c.includes('No verified'));
});

const { buildResponse, composeSimple } = await import('../composition/ResponseBuilder.js');
const TEST_RES = buildResponse({ facts:F, query:'what is MANT', pattern:'question' });
await test('buildResponse produces ResponseObject', () => {
  assert.ok(TEST_RES.overview.text.length > 0);
  assert.ok(TEST_RES.sections.length >= 1);
  assert.ok(TEST_RES.references.length >= 1);
});
await test('composeSimple', () => {
  assert.equal(composeSimple('Hello').overview.text, 'Hello');
});

section('Part 7 — Rendering');
const { splitMessage } = await import('../rendering/MessageSplitter.js');
await test('splitMessage', () => {
  const r = splitMessage('Hello');
  assert.ok(Array.isArray(r) && r.length === 1);
  const r2 = splitMessage('A'.repeat(100)+'\n\n'+'B'.repeat(4000), { maxLength:2000 });
  assert.ok(r2.length >= 2);
  r2.forEach(c => assert.ok(c.length <= 2000));
});

const { renderMarkdown, codeBlock, simpleTable } = await import('../rendering/MarkdownRenderer.js');
await test('MarkdownRenderer', () => {
  assert.ok(renderMarkdown(TEST_RES).length > 50);
  assert.ok(codeBlock({ fact:'console.log(1)', source:'t.js' }, 'javascript').includes('```javascript'));
  assert.ok(simpleTable(F.slice(0,2), ['provider','fact']).length > 0);
});

const { renderForDiscord, renderSimple } = await import('../rendering/DiscordRenderer.js');
await test('DiscordRenderer', () => {
  assert.ok(renderForDiscord(TEST_RES).messages.length >= 1);
  const rr = buildResponse({ facts:F, query:'compare', pattern:'research' });
  assert.ok(renderForDiscord(rr, { useEmbeds:true }).embeds.length >= 1);
  assert.ok(renderSimple('Hi').messages.length >= 1);
});

section('Part 8 — CommunicationManager');
const { process, processSimple, toolResultsToFacts } = await import('../integration/CommunicationManager.js');
await test('process', async () => {
  const r = await process({ query:'what is MANT', classification:{ topic:'umamusume', complexity:'simple' }, facts:F });
  assert.ok(r.success && r.responseObj.sections.length >= 1);
});
await test('processSimple', () => {
  assert.ok(processSimple('Test').success);
});
await test('toolResultsToFacts', () => {
  const f = toolResultsToFacts([{ tool:'search_repository', ok:true, data:{ chunks:[{ text:'Vault uses encryption', score:0.9, source:'v.js' }] } }]);
  assert.equal(f.length, 1);
  assert.equal(f[0].provider, 'repository');
});

console.log(`\n──────────────────────────────────`);
console.log(`Communication System: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
