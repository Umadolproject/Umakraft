// AI/test/phase2.test.js
// Phase 2 test suite — Repository Intelligence
// (VectorDatabase, RepositoryIndexer, RAGEngine, ContextBuilder)
//
// Runs without live API keys or a Qdrant cluster.
// All embedding calls are intercepted via module-level mocking.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

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
    if (process.env.DEBUG) console.error(err.stack);
    failed++;
  }
}

function section(title) {
  console.log(`\n── ${title} ─────────────────────────────────────`);
}

// Tiny deterministic "embedding" for tests — sha256 → 8 floats in [-1, 1]
function fakeEmbed(text) {
  const hex = createHash('sha256').update(text).digest('hex');
  return Array.from({ length: 8 }, (_, i) => {
    const byte = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return (byte / 127.5) - 1; // maps 0-255 → -1 to ~1
  });
}

// ── VectorDatabase ─────────────────────────────────────────────────────────

section('VectorDatabase — in-memory backend');

// Force in-memory by ensuring no QDRANT_URL is set (it isn't in test env)
const {
  deriveChunkId,
  initialize,
  upsert,
  search,
  deleteByFile,
  getChecksum,
  listAllFilePaths,
  stats,
  _resetForTesting,
} = await import('../VectorDatabase.js');

// Reset to a fresh backend for each logical group
_resetForTesting();

await test('deriveChunkId returns a UUID-format string', () => {
  const id = deriveChunkId('umamoe/Vault/vault.js', 0);
  assert.match(id, /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
});

await test('deriveChunkId is deterministic', () => {
  assert.equal(
    deriveChunkId('GOVERNANCE/README.md', 2),
    deriveChunkId('GOVERNANCE/README.md', 2)
  );
});

await test('deriveChunkId is unique per (filePath, chunkIndex) pair', () => {
  assert.notEqual(
    deriveChunkId('file.md', 0),
    deriveChunkId('file.md', 1)
  );
  assert.notEqual(
    deriveChunkId('a.md', 0),
    deriveChunkId('b.md', 0)
  );
});

await test('initialize() does not throw (in-memory)', async () => {
  await initialize();
});

await test('upsert() and search() round-trip', async () => {
  _resetForTesting();

  const vec = fakeEmbed('The Vault stores race data');
  await upsert([{
    id:      deriveChunkId('umamoe/Vault/vault.js', 0),
    vector:  vec,
    payload: {
      filePath: 'umamoe/Vault/vault.js', chunkIndex: 0,
      heading: 'receive()', department: 'Umamoe', fileType: 'JavaScript',
      content: 'The Vault stores race data', tokenCount: 7,
      checksum: 'abc123', indexedAt: new Date().toISOString(),
    },
  }]);

  const results = await search(vec, { topK: 5, minScore: 0.0 });
  assert.equal(results.length, 1);
  assert.equal(results[0].filePath, 'umamoe/Vault/vault.js');
  assert.ok(results[0].score >= 0.99, `Expected score ≥ 0.99, got ${results[0].score}`);
});

await test('search() respects minScore threshold', async () => {
  _resetForTesting();

  const vec = fakeEmbed('fan gain calculation');
  await upsert([{
    id: deriveChunkId('x.md', 0), vector: vec,
    payload: { filePath: 'x.md', chunkIndex: 0, heading: null, department: 'Umamoe',
               fileType: 'Markdown', content: 'fan gain', tokenCount: 2,
               checksum: 'x', indexedAt: new Date().toISOString() },
  }]);

  // Search with a completely different vector — cosine similarity should be low
  const unrelated = fakeEmbed('completely unrelated query xyz987');
  const results = await search(unrelated, { topK: 5, minScore: 0.95 });
  assert.equal(results.length, 0, 'High minScore should filter out unrelated results');
});

await test('search() supports department filter', async () => {
  _resetForTesting();

  const vec = fakeEmbed('test content');
  await upsert([
    { id: deriveChunkId('a.md', 0), vector: vec,
      payload: { filePath: 'a.md', chunkIndex: 0, heading: null, department: 'Governance',
                 fileType: 'Markdown', content: 'test content', tokenCount: 2,
                 checksum: 'a', indexedAt: new Date().toISOString() } },
    { id: deriveChunkId('b.md', 0), vector: vec,
      payload: { filePath: 'b.md', chunkIndex: 0, heading: null, department: 'Umamoe',
                 fileType: 'Markdown', content: 'test content', tokenCount: 2,
                 checksum: 'b', indexedAt: new Date().toISOString() } },
  ]);

  const results = await search(vec, { topK: 5, minScore: 0.0, filter: { department: 'Governance' } });
  assert.equal(results.length, 1);
  assert.equal(results[0].department, 'Governance');
});

await test('deleteByFile() removes matching chunks', async () => {
  _resetForTesting();

  const vec = fakeEmbed('delete test');
  await upsert([
    { id: deriveChunkId('del.md', 0), vector: vec,
      payload: { filePath: 'del.md', chunkIndex: 0, heading: null, department: 'Root',
                 fileType: 'Markdown', content: 'delete test', tokenCount: 2,
                 checksum: 'del', indexedAt: new Date().toISOString() } },
    { id: deriveChunkId('keep.md', 0), vector: vec,
      payload: { filePath: 'keep.md', chunkIndex: 0, heading: null, department: 'Root',
                 fileType: 'Markdown', content: 'delete test', tokenCount: 2,
                 checksum: 'keep', indexedAt: new Date().toISOString() } },
  ]);

  await deleteByFile('del.md');
  const results = await search(vec, { topK: 10, minScore: 0.0 });
  assert.ok(!results.some(r => r.filePath === 'del.md'), 'del.md should be removed');
  assert.ok(results.some(r => r.filePath === 'keep.md'), 'keep.md should remain');
});

await test('getChecksum() returns stored checksum', async () => {
  _resetForTesting();

  const vec = fakeEmbed('checksum test');
  await upsert([{
    id: deriveChunkId('cs.md', 0), vector: vec,
    payload: { filePath: 'cs.md', chunkIndex: 0, heading: null, department: 'Root',
               fileType: 'Markdown', content: 'checksum test', tokenCount: 2,
               checksum: 'sha256abc', indexedAt: new Date().toISOString() },
  }]);

  const cs = await getChecksum('cs.md');
  assert.equal(cs, 'sha256abc');
});

await test('getChecksum() returns null for unknown file', async () => {
  const cs = await getChecksum('never-indexed-file.md');
  assert.equal(cs, null);
});

await test('listAllFilePaths() returns unique paths', async () => {
  _resetForTesting();

  const vec = fakeEmbed('list test');
  await upsert([
    { id: deriveChunkId('f1.md', 0), vector: vec,
      payload: { filePath: 'f1.md', chunkIndex: 0, heading: null, department: 'Root',
                 fileType: 'Markdown', content: 'a', tokenCount: 1,
                 checksum: '1', indexedAt: new Date().toISOString() } },
    { id: deriveChunkId('f1.md', 1), vector: vec,
      payload: { filePath: 'f1.md', chunkIndex: 1, heading: null, department: 'Root',
                 fileType: 'Markdown', content: 'b', tokenCount: 1,
                 checksum: '1', indexedAt: new Date().toISOString() } },
    { id: deriveChunkId('f2.md', 0), vector: vec,
      payload: { filePath: 'f2.md', chunkIndex: 0, heading: null, department: 'Root',
                 fileType: 'Markdown', content: 'c', tokenCount: 1,
                 checksum: '2', indexedAt: new Date().toISOString() } },
  ]);

  const paths = await listAllFilePaths();
  assert.equal(paths.length, 2);
  assert.ok(paths.includes('f1.md'));
  assert.ok(paths.includes('f2.md'));
});

await test('stats() returns backend name', () => {
  const s = stats();
  assert.ok(s.backend === 'in-memory' || s.backend === 'qdrant');
});

// ── RepositoryIndexer ──────────────────────────────────────────────────────

section('RepositoryIndexer — chunking');

const { chunkDocument, scanFiles } = await import('../RepositoryIndexer.js');

await test('chunkDocument — Markdown splits at ## headings', () => {
  const sectionA = 'Content for section A. '.repeat(5); // ~110 chars, well above noise floor
  const sectionB = 'Content for section B. '.repeat(5);
  const md = `# Title\n\nIntro paragraph that is long enough to survive.\n\n## Section A\n\n${sectionA}\n\n## Section B\n\n${sectionB}`;
  const chunks = chunkDocument(md, 'Markdown');
  assert.ok(chunks.length >= 2, `Expected ≥2 chunks, got ${chunks.length}`);
  assert.ok(chunks.some(c => c.heading === 'Section A'), 'Should have Section A heading');
  assert.ok(chunks.some(c => c.heading === 'Section B'), 'Should have Section B heading');
});

await test('chunkDocument — Markdown preserves content under each heading', () => {
  const fanContent = 'Fan gain is calculated daily based on circle activity and race results. '.repeat(2);
  const rankContent = 'Circle rank is determined by total accumulated fan count over the season. '.repeat(2);
  const md = `## Fan Gain\n\n${fanContent}\n\n## Circle Rank\n\n${rankContent}`;
  const chunks = chunkDocument(md, 'Markdown');
  const fanChunk = chunks.find(c => c.heading === 'Fan Gain');
  assert.ok(fanChunk, 'Should have Fan Gain chunk');
  assert.ok(fanChunk.content.includes('Fan gain is calculated daily'));
});

await test('chunkDocument — JavaScript extracts file header', () => {
  const js = `// file header comment\nimport something from 'somewhere';\n\nconst x = 1;\n\nexport async function myFunc() {\n  return 42;\n}\n\nexport function another() {\n  return 'hello';\n}`;
  const chunks = chunkDocument(js, 'JavaScript');
  assert.ok(chunks.length >= 1, `Expected ≥1 chunk, got ${chunks.length}`);
});

await test('chunkDocument — JSON splits at top-level keys', () => {
  const json = JSON.stringify({
    name: 'umakraft',
    description: 'A constitutional data pipeline bot for the Umamusume community Discord server.',
    pipeline: ['Umamoe', 'Refinery', 'Workshop', 'Distribution', 'Broadcast'],
    version: '1.0.0',
  }, null, 2);
  const chunks = chunkDocument(json, 'JSON');
  assert.ok(chunks.length >= 1, `Expected ≥1 chunk, got ${chunks.length}`);
  // At least one of the longer-value keys should produce a surviving chunk
  assert.ok(chunks.some(c => c.heading !== null), 'Should have key-based headings');
});

await test('chunkDocument — falls back to paragraph chunking for unknown type', () => {
  const text = 'Paragraph one with some text.\n\nParagraph two with more text.\n\nParagraph three.';
  const chunks = chunkDocument(text, 'Text');
  assert.ok(chunks.length >= 1);
});

await test('chunkDocument — skips chunks below noise floor (50 chars)', () => {
  const md = `## A\n\nShort.\n\n## B\n\n${'x'.repeat(200)}\n`;
  const chunks = chunkDocument(md, 'Markdown');
  // "Short." (6 chars) should be dropped; the 200-char section should survive
  assert.ok(chunks.every(c => c.content.length >= 50 || c.content.includes('x')),
    'Sub-50-char chunks should be filtered');
});

await test('scanFiles() finds .md and .js files', async () => {
  // Create a temp directory with known files
  const tmpDir = join(tmpdir(), `umakraft-test-${Date.now()}`);
  await mkdir(tmpDir, { recursive: true });
  await mkdir(join(tmpDir, 'sub'));
  await writeFile(join(tmpDir, 'README.md'), '# Readme');
  await writeFile(join(tmpDir, 'index.js'), 'export const x = 1;');
  await writeFile(join(tmpDir, 'secret.env'), 'KEY=value');
  await writeFile(join(tmpDir, 'yarn.lock'), 'lockfile v1');
  await writeFile(join(tmpDir, 'package-lock.json'), '{}');

  const files = await scanFiles(tmpDir);
  const names = files.map(f => f.replace(tmpDir + '/', ''));

  assert.ok(names.includes('README.md'), 'Should include README.md');
  assert.ok(names.includes('index.js'),  'Should include index.js');
  assert.ok(!names.includes('secret.env'),        'Should exclude .env files');
  assert.ok(!names.includes('yarn.lock'),          'Should exclude yarn.lock');
  assert.ok(!names.includes('package-lock.json'), 'Should exclude package-lock.json');

  await rm(tmpDir, { recursive: true });
});

await test('scanFiles() excludes node_modules and .git', async () => {
  const tmpDir = join(tmpdir(), `umakraft-test-${Date.now()}`);
  await mkdir(join(tmpDir, 'node_modules', 'somelib'), { recursive: true });
  await mkdir(join(tmpDir, '.git'), { recursive: true });
  await writeFile(join(tmpDir, 'node_modules', 'somelib', 'index.js'), 'module.exports={}');
  await writeFile(join(tmpDir, '.git', 'config'), '[core]');
  await writeFile(join(tmpDir, 'app.js'), 'const x = 1;');

  const files = await scanFiles(tmpDir);
  assert.ok(!files.some(f => f.includes('node_modules')), 'node_modules should be excluded');
  assert.ok(!files.some(f => f.includes('.git')), '.git should be excluded');
  assert.ok(files.some(f => f.endsWith('app.js')), 'app.js should be included');

  await rm(tmpDir, { recursive: true });
});

// ── ContextBuilder ─────────────────────────────────────────────────────────

section('ContextBuilder');

const { build } = await import('../ContextBuilder.js');

// Helper to make a test chunk
function makeChunk(filePath, heading, content, score, source = 'repository') {
  return { filePath, heading, content, score, tokenCount: Math.ceil(content.length / 4), source };
}

await test('build() returns empty context for no chunks', () => {
  const result = build([]);
  assert.equal(result.context, '');
  assert.equal(result.chunkCount, 0);
  assert.deepEqual(result.citations, []);
});

await test('build() formats a repository chunk correctly', () => {
  const chunk = makeChunk('umamoe/Vault/vault.js', 'receive()', 'The Vault stores data.', 0.94);
  const { context } = build([[chunk]]);
  assert.ok(context.includes('Source: umamoe/Vault/vault.js'), 'Should include file path');
  assert.ok(context.includes('Section: receive()'), 'Should include heading');
  assert.ok(context.includes('Relevance: 0.94'), 'Should include score');
  assert.ok(context.includes('The Vault stores data.'), 'Should include content');
});

await test('build() formats web chunks with [WEB] prefix', () => {
  const chunk = makeChunk('https://uma.moe/rankings', 'Top Circles', 'Bloom leads with 4.2M fans.', 0.87, 'web');
  const { context } = build([[chunk]]);
  assert.ok(context.includes('[WEB] https://uma.moe/rankings'), 'Web chunks need [WEB] prefix');
});

await test('build() deduplicates chunks with same filePath and heading', () => {
  const a = makeChunk('f.md', 'Section A', 'content a', 0.80);
  const b = makeChunk('f.md', 'Section A', 'content b', 0.91); // higher score
  const { chunkCount } = build([[a, b]]);
  assert.equal(chunkCount, 1, 'Duplicate (filePath+heading) should be deduplicated');
});

await test('build() keeps higher-score duplicate', () => {
  const a = makeChunk('f.md', 'H', 'low score content', 0.50);
  const b = makeChunk('f.md', 'H', 'high score content', 0.90);
  const { context } = build([[a, b]]);
  assert.ok(context.includes('high score content'), 'Higher-score duplicate should be kept');
  assert.ok(!context.includes('low score content'), 'Lower-score duplicate should be removed');
});

await test('build() sorts chunks by descending score', () => {
  const chunks = [
    makeChunk('a.md', null, 'A content', 0.60),
    makeChunk('c.md', null, 'C content', 0.95),
    makeChunk('b.md', null, 'B content', 0.75),
  ];
  const { context } = build([chunks]);
  const posC = context.indexOf('C content');
  const posB = context.indexOf('B content');
  const posA = context.indexOf('A content');
  assert.ok(posC < posB, 'C (0.95) should come before B (0.75)');
  assert.ok(posB < posA, 'B (0.75) should come before A (0.60)');
});

await test('build() enforces token budget by trimming lowest-score chunk', () => {
  // Create chunks that total > 20 tokens
  const chunks = [
    makeChunk('a.md', null, 'A'.repeat(200), 0.90), // ~50 tokens
    makeChunk('b.md', null, 'B'.repeat(200), 0.80), // ~50 tokens
    makeChunk('c.md', null, 'C'.repeat(200), 0.70), // ~50 tokens
    makeChunk('d.md', null, 'D'.repeat(200), 0.60), // ~50 tokens
  ];
  // maxTokens=100 — context text itself is large so trimming should occur
  const { chunkCount } = build([chunks], { maxTokens: 100 });
  // Should have fewer than 4 chunks (trimmed from tail) but at least MIN_CHUNKS (3)
  assert.ok(chunkCount >= 3, `Should keep at least MIN_CHUNKS (3), got ${chunkCount}`);
  assert.ok(chunkCount <= 4, `Should not exceed original chunk count`);
});

await test('build() never drops below MIN_CHUNKS even under tight budget', () => {
  const chunks = [
    makeChunk('a.md', null, 'A'.repeat(500), 0.90),
    makeChunk('b.md', null, 'B'.repeat(500), 0.80),
    makeChunk('c.md', null, 'C'.repeat(500), 0.70),
    makeChunk('d.md', null, 'D'.repeat(500), 0.60),
  ];
  // Tiny budget — but must preserve at least 3
  const { chunkCount } = build([chunks], { maxTokens: 1 });
  assert.ok(chunkCount >= 3, `Must keep at least 3 chunks, got ${chunkCount}`);
});

await test('build() merges chunks from multiple source arrays', () => {
  const ragChunks = [makeChunk('repo.md', null, 'repo content', 0.88)];
  const webChunks = [makeChunk('https://uma.moe', null, 'web content', 0.75, 'web')];
  const { chunkCount, citations } = build([ragChunks, webChunks]);
  assert.equal(chunkCount, 2);
  assert.ok(citations.some(c => c.includes('repo.md')));
  assert.ok(citations.some(c => c.includes('[WEB]')));
});

await test('build() returns unique citations', () => {
  const chunks = [
    makeChunk('f.md', 'H1', 'content 1', 0.90),
    makeChunk('f.md', 'H2', 'content 2', 0.85),
    makeChunk('g.md', 'H1', 'content 3', 0.80),
  ];
  const { citations } = build([chunks]);
  const fCitations = citations.filter(c => c.includes('f.md'));
  assert.equal(fCitations.length, 2, 'Two different sections of f.md should produce two citations');
});

await test('build() reports correct totalTokens estimate', () => {
  const chunk = makeChunk('a.md', null, 'Hello world', 0.90);
  const { totalTokens } = build([[chunk]]);
  assert.ok(typeof totalTokens === 'number' && totalTokens > 0);
});

// ── RAGEngine ──────────────────────────────────────────────────────────────

section('RAGEngine — with pre-populated in-memory VDB');

// Pre-populate VDB with known chunks so RAGEngine can retrieve without live API
_resetForTesting();
await initialize();

const knownQuery   = 'how does the vault store data';
const knownVector  = fakeEmbed(knownQuery);
const knownPayload = {
  filePath: 'umamoe/Vault/vault.js', chunkIndex: 0,
  heading: 'receive()', department: 'Umamoe', fileType: 'JavaScript',
  content: 'The Vault stores race data using the adapter pattern.',
  tokenCount: 10, checksum: 'abc', indexedAt: new Date().toISOString(),
};

await upsert([{
  id:      deriveChunkId(knownPayload.filePath, knownPayload.chunkIndex),
  vector:  knownVector,
  payload: knownPayload,
}]);

const { retrieve } = await import('../RAGEngine.js');

await test('retrieve() returns chunks matching the query vector', async () => {
  // Use the same vector as the stored chunk — should be a perfect match
  // We intercept embed() by pre-seeding the embedding cache
  const { setEmbedding } = await import('../Cache.js');
  setEmbedding(knownQuery, knownVector);

  const chunks = await retrieve(knownQuery, { minScore: 0.0 });
  assert.ok(chunks.length >= 1, `Expected ≥1 chunk, got ${chunks.length}`);
  assert.equal(chunks[0].filePath, 'umamoe/Vault/vault.js');
});

await test('retrieve() annotates chunks with source="repository"', async () => {
  const { setEmbedding } = await import('../Cache.js');
  setEmbedding(knownQuery, knownVector);

  const chunks = await retrieve(knownQuery, { minScore: 0.0 });
  assert.ok(chunks.every(c => c.source === 'repository'));
});

await test('retrieve() returns chunkId, filePath, heading, content, score', async () => {
  const { setEmbedding } = await import('../Cache.js');
  setEmbedding(knownQuery, knownVector);

  const chunks = await retrieve(knownQuery, { minScore: 0.0 });
  const c = chunks[0];
  assert.ok(typeof c.chunkId    === 'string');
  assert.ok(typeof c.filePath   === 'string');
  assert.ok(typeof c.content    === 'string');
  assert.ok(typeof c.score      === 'number');
  assert.ok(typeof c.tokenCount === 'number');
});

await test('retrieve() scope=governance filters to Governance department', async () => {
  _resetForTesting();
  await initialize();

  const vec = fakeEmbed('governance test');
  const { setEmbedding } = await import('../Cache.js');
  setEmbedding('governance test', vec);

  await upsert([
    { id: deriveChunkId('GOVERNANCE/doc.md', 0), vector: vec,
      payload: { filePath: 'GOVERNANCE/doc.md', chunkIndex: 0, heading: null,
                 department: 'Governance', fileType: 'Markdown', content: 'governance test content',
                 tokenCount: 3, checksum: 'g', indexedAt: new Date().toISOString() } },
    { id: deriveChunkId('umamoe/x.js', 0), vector: vec,
      payload: { filePath: 'umamoe/x.js', chunkIndex: 0, heading: null,
                 department: 'Umamoe', fileType: 'JavaScript', content: 'governance test content',
                 tokenCount: 3, checksum: 'u', indexedAt: new Date().toISOString() } },
  ]);

  const chunks = await retrieve('governance test', { minScore: 0.0, scope: 'governance' });
  assert.ok(chunks.every(c => c.department === 'Governance'),
    'scope=governance should only return Governance chunks');
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n─────────────────────────────────────────────────`);
console.log(`Phase 2 tests: ${passed} passed, ${failed} failed`);

if (failed > 0) process.exit(1);
