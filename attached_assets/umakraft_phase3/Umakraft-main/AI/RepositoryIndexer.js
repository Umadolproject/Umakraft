// AI/RepositoryIndexer.js
// Scans the repository, classifies documents, chunks them, and stores embeddings.
//
// Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
// Spec:      AI/REPOSITORY_INDEXER.md
//
// Public API:
//   fullIndex(rootDir)        — scan all non-excluded files; embed and upsert all chunks
//   incrementalIndex(rootDir) — same but skips files whose checksum hasn't changed
//   scanFiles(rootDir)        — returns list of eligible file paths (no embedding)

import { createHash }    from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, extname, basename } from 'node:path';
import log from '../core/log.js';
import config from './Configuration.js';
import { embed } from './APIProvider.js';
import { upsert, getChecksum, deleteByFile, listAllFilePaths } from './VectorDatabase.js';
import { deriveChunkId } from './VectorDatabase.js';

// ---------------------------------------------------------------------------
// Exclusion rules
// ---------------------------------------------------------------------------

const EXCLUDED_DIRS = new Set([
  'node_modules', '.git', '.local', 'attached_assets', 'dist', 'coverage',
]);

const EXCLUDED_EXTENSIONS = new Set([
  '.log', '.lock', '.key', '.pem',
]);

const EXCLUDED_BASENAME_PATTERNS = [
  /^\.env$/,
  /^\.env\..+$/,
  /^package-lock\.json$/,
  /^yarn\.lock$/,
  /^pnpm-lock\.yaml$/,
  /^composer\.lock$/,
  /^Gemfile\.lock$/,
];

/**
 * Return true if the given path should be skipped.
 * @param {string} absPath
 * @param {string} rootDir
 * @returns {boolean}
 */
function isExcluded(absPath, rootDir) {
  const rel = relative(rootDir, absPath);
  const parts = rel.split('/');

  // Excluded directory anywhere in the path
  for (const part of parts) {
    if (EXCLUDED_DIRS.has(part)) return true;
  }

  const base = basename(absPath);
  const ext  = extname(absPath).toLowerCase();

  if (EXCLUDED_EXTENSIONS.has(ext)) return true;
  if (EXCLUDED_BASENAME_PATTERNS.some(p => p.test(base))) return true;

  return false;
}

// ---------------------------------------------------------------------------
// File type detection
// ---------------------------------------------------------------------------

const FILE_TYPE_MAP = {
  '.md':   'Markdown',
  '.js':   'JavaScript',
  '.ts':   'TypeScript',
  '.json': 'JSON',
  '.yaml': 'YAML',
  '.yml':  'YAML',
  '.sql':  'SQL',
  '.txt':  'Text',
};

/** @returns {string|null} */
function detectFileType(filePath) {
  return FILE_TYPE_MAP[extname(filePath).toLowerCase()] ?? null;
}

// ---------------------------------------------------------------------------
// Department classification
// ---------------------------------------------------------------------------

const DEPARTMENT_PREFIXES = [
  ['umamoe/',        'Umamoe'],
  ['Refinery/',      'Refinery'],
  ['Workshop/',      'Workshop'],
  ['Distribution/',  'Distribution'],
  ['Broadcast/',     'Broadcast'],
  ['Operation/',     'Operation'],
  ['AI/',            'AI'],
  ['GOVERNANCE/',    'Governance'],
  ['INFRASTRUCTURE/','Infrastructure'],
  ['core/',          'Core'],
  ['tasks/',         'Core'],
];

/** @param {string} relPath — relative from repo root */
function classifyDepartment(relPath) {
  for (const [prefix, dept] of DEPARTMENT_PREFIXES) {
    if (relPath.startsWith(prefix)) return dept;
  }
  return 'Root';
}

// ---------------------------------------------------------------------------
// Checksum
// ---------------------------------------------------------------------------

/** @param {string} content */
function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

// ---------------------------------------------------------------------------
// Chunking strategies
// ---------------------------------------------------------------------------

const MIN_CHARS    = config.indexerChunkMinChars;    // noise floor
const TARGET_CHARS = config.indexerChunkTargetChars; // ~800
const MAX_CHARS    = config.indexerChunkMaxChars;    // 1200
const OVERLAP      = config.indexerChunkOverlapChars; // 100

/**
 * Split text at paragraph boundaries (blank lines).
 * Merges short paragraphs until TARGET_CHARS is reached, then emits a chunk.
 *
 * @param {string} text
 * @returns {{ content: string, heading: string|null }[]}
 */
function chunkByParagraph(text, heading = null) {
  const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 0);
  const chunks = [];
  let buffer = '';
  let bufferHeading = heading;

  for (const para of paragraphs) {
    if (buffer.length + para.length + 2 > MAX_CHARS && buffer.length >= MIN_CHARS) {
      chunks.push({ content: buffer.trim(), heading: bufferHeading });
      // Carry overlap from tail of previous buffer
      buffer = buffer.slice(-OVERLAP) + '\n\n' + para;
    } else {
      buffer = buffer ? buffer + '\n\n' + para : para;
    }
  }
  if (buffer.trim().length >= MIN_CHARS) {
    chunks.push({ content: buffer.trim(), heading: bufferHeading });
  }
  return chunks;
}

/**
 * Chunk a Markdown document by ## and ### headings.
 * Each section is a heading + its content. Long sections are further split by paragraph.
 *
 * @param {string} text
 * @returns {{ content: string, heading: string|null }[]}
 */
function chunkMarkdown(text) {
  const lines   = text.split('\n');
  const chunks  = [];
  let heading   = null;
  let buffer    = '';

  const flush = () => {
    if (buffer.trim().length < MIN_CHARS) return;
    if (buffer.length <= MAX_CHARS) {
      chunks.push({ content: buffer.trim(), heading });
    } else {
      // Section too large — split by paragraph
      chunks.push(...chunkByParagraph(buffer, heading));
    }
    buffer = '';
  };

  for (const line of lines) {
    const h2 = line.match(/^## (.+)/);
    const h3 = line.match(/^### (.+)/);

    if (h2 || h3) {
      flush();
      heading = (h2 || h3)[1].trim();
      buffer  = line + '\n';
    } else {
      buffer += line + '\n';
    }
  }
  flush();
  return chunks;
}

/**
 * Chunk a JavaScript file by function/class boundaries.
 * Includes the JSDoc block immediately preceding each declaration.
 *
 * @param {string} text
 * @returns {{ content: string, heading: string|null }[]}
 */
function chunkJavaScript(text) {
  const chunks = [];
  // Split on lines that start a top-level function, class, or export declaration
  const declarationRe = /^(?:\/\*\*[\s\S]*?\*\/\s*)?(?:export\s+)?(?:async\s+)?(?:function\s+\w+|class\s+\w+|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=)/m;

  // Find all declaration start positions
  const positions = [];
  let search = text;
  let offset = 0;
  const re = /^(?:\/\*\*[\s\S]*?\*\/\n)?(?:export\s+)?(?:async\s+)?(?:function\s+\w+|class\s+\w+|(?:export\s+)?const\s+\w+\s*=)/gm;
  let match;
  while ((match = re.exec(text)) !== null) {
    positions.push(match.index);
  }

  if (positions.length === 0) {
    // No declarations found — fall back to paragraph chunking
    return chunkByParagraph(text);
  }

  for (let i = 0; i < positions.length; i++) {
    const start = positions[i];
    const end   = positions[i + 1] ?? text.length;
    let section = text.slice(start, end).trim();

    // Extract a heading from the first line of the declaration
    const firstLine = section.split('\n').find(l => !l.startsWith('*') && !l.startsWith('/'));
    const heading   = firstLine ? firstLine.slice(0, 80).trim() : null;

    if (section.length < MIN_CHARS) continue;

    if (section.length <= MAX_CHARS) {
      chunks.push({ content: section, heading });
    } else {
      // Large function body — split by paragraph, preserve heading
      chunks.push(...chunkByParagraph(section, heading));
    }
  }

  // Capture anything before the first declaration (imports, file header)
  if (positions[0] > 0) {
    const header = text.slice(0, positions[0]).trim();
    if (header.length >= MIN_CHARS) {
      chunks.unshift({ content: header, heading: 'File header' });
    }
  }

  return chunks;
}

/**
 * Chunk a JSON file at top-level key boundaries.
 *
 * @param {string} text
 * @returns {{ content: string, heading: string|null }[]}
 */
function chunkJSON(text) {
  try {
    const obj = JSON.parse(text);
    if (typeof obj !== 'object' || obj === null) return chunkByParagraph(text);

    const chunks = [];
    for (const [key, value] of Object.entries(obj)) {
      const content = JSON.stringify({ [key]: value }, null, 2);
      if (content.length < MIN_CHARS) continue;
      if (content.length <= MAX_CHARS) {
        chunks.push({ content, heading: key });
      } else {
        chunks.push(...chunkByParagraph(content, key));
      }
    }
    return chunks;
  } catch {
    // Not valid JSON — fall back to paragraph chunking
    return chunkByParagraph(text);
  }
}

/**
 * Route a file to the appropriate chunking strategy.
 *
 * @param {string} content
 * @param {string} fileType
 * @returns {{ content: string, heading: string|null }[]}
 */
export function chunkDocument(content, fileType) {
  switch (fileType) {
    case 'Markdown':   return chunkMarkdown(content);
    case 'JavaScript':
    case 'TypeScript': return chunkJavaScript(content);
    case 'JSON':       return chunkJSON(content);
    default:           return chunkByParagraph(content);
  }
}

// ---------------------------------------------------------------------------
// Directory scanner
// ---------------------------------------------------------------------------

/**
 * Recursively list all indexable files under rootDir.
 *
 * @param {string} rootDir
 * @returns {Promise<string[]>} absolute file paths
 */
export async function scanFiles(rootDir) {
  const results = [];

  async function walk(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return; // Unreadable directory — skip
    }

    for (const entry of entries) {
      const absPath = join(dir, entry.name);
      if (isExcluded(absPath, rootDir)) continue;

      if (entry.isDirectory()) {
        await walk(absPath);
      } else if (entry.isFile()) {
        const ft = detectFileType(absPath);
        if (ft) results.push(absPath);
      }
    }
  }

  await walk(rootDir);
  return results;
}

// ---------------------------------------------------------------------------
// Core indexing logic
// ---------------------------------------------------------------------------

/**
 * Index a single file: read → checksum → chunk → embed → upsert.
 *
 * @param {string} absPath
 * @param {string} rootDir
 * @param {boolean} forceReindex — skip checksum comparison
 */
async function indexFile(absPath, rootDir, forceReindex = false) {
  const relPath  = relative(rootDir, absPath);
  const fileType = detectFileType(absPath);
  const dept     = classifyDepartment(relPath);

  let content;
  try {
    content = await readFile(absPath, 'utf8');
  } catch (err) {
    log.warn(`[AI/RepositoryIndexer] Could not read "${relPath}": ${err.message}`);
    return { status: 'error', relPath };
  }

  const checksum = sha256(content);

  if (!forceReindex) {
    const stored = await getChecksum(relPath);
    if (stored === checksum) {
      return { status: 'skipped', relPath };
    }
  }

  const rawChunks = chunkDocument(content, fileType);
  if (rawChunks.length === 0) {
    log.debug(`[AI/RepositoryIndexer] No chunks produced for "${relPath}" — skipping.`);
    return { status: 'empty', relPath };
  }

  const points = [];
  for (let i = 0; i < rawChunks.length; i++) {
    const { content: chunkContent, heading } = rawChunks[i];
    let vector;
    try {
      vector = await embed(chunkContent);
    } catch (err) {
      // Quota exhaustion is permanent — propagate so the caller aborts the run.
      if (err.isQuotaExhausted) throw err;
      log.warn(`[AI/RepositoryIndexer] Embedding failed for "${relPath}" chunk ${i}: ${err.message}`);
      continue; // Transient error — log and skip this chunk, keep going.
    }

    points.push({
      id:      deriveChunkId(relPath, i),
      vector,
      payload: {
        filePath:   relPath,
        chunkIndex: i,
        heading:    heading ?? null,
        department: dept,
        fileType,
        content:    chunkContent,
        tokenCount: Math.ceil(chunkContent.length / 4),
        checksum,
        indexedAt:  new Date().toISOString(),
      },
    });
  }

  if (points.length > 0) {
    await upsert(points);
    log.info(`[AI/RepositoryIndexer] Indexed "${relPath}" — ${points.length} chunk(s).`);
  }

  return { status: 'indexed', relPath, chunks: points.length };
}

// ---------------------------------------------------------------------------
// Public index runners
// ---------------------------------------------------------------------------

/**
 * Full index — embed and upsert every eligible file regardless of checksum.
 * Also cleans up embeddings for files that no longer exist.
 *
 * @param {string} rootDir — absolute path to the repository root
 * @returns {Promise<{ total: number, indexed: number, skipped: number, errors: number, durationMs: number }>}
 */
export async function fullIndex(rootDir) {
  const start = Date.now();
  log.info('[AI/RepositoryIndexer] Full index started.');

  const files   = await scanFiles(rootDir);
  const relPaths = new Set(files.map(f => relative(rootDir, f)));

  // Clean up stale embeddings for deleted files
  const indexed = await listAllFilePaths();
  for (const fp of indexed) {
    if (!relPaths.has(fp)) {
      await deleteByFile(fp);
      log.info(`[AI/RepositoryIndexer] Removed stale embeddings for deleted file: "${fp}".`);
    }
  }

  let indexedCount = 0, skippedCount = 0, errorCount = 0;

  // Process with concurrency limit
  await withConcurrency(files, config.indexerEmbedConcurrency, async (absPath) => {
    const result = await indexFile(absPath, rootDir, true);
    if (result.status === 'indexed') indexedCount++;
    else if (result.status === 'skipped' || result.status === 'empty') skippedCount++;
    else errorCount++;
  });

  const durationMs = Date.now() - start;
  log.info(
    `[AI/RepositoryIndexer] Full index complete — ` +
    `${indexedCount} indexed, ${skippedCount} skipped, ${errorCount} errors, ` +
    `duration=${(durationMs / 1000).toFixed(1)}s`
  );

  return { total: files.length, indexed: indexedCount, skipped: skippedCount, errors: errorCount, durationMs };
}

/**
 * Incremental index — only re-embed files whose checksum has changed.
 *
 * @param {string} rootDir
 * @returns {Promise<{ total: number, indexed: number, skipped: number, errors: number, durationMs: number }>}
 */
export async function incrementalIndex(rootDir) {
  const start = Date.now();
  log.info('[AI/RepositoryIndexer] Incremental index started.');

  const files = await scanFiles(rootDir);
  const relPaths = new Set(files.map(f => relative(rootDir, f)));

  // Clean up stale embeddings
  const already = await listAllFilePaths();
  for (const fp of already) {
    if (!relPaths.has(fp)) {
      await deleteByFile(fp);
      log.info(`[AI/RepositoryIndexer] Removed stale embeddings for deleted file: "${fp}".`);
    }
  }

  let indexedCount = 0, skippedCount = 0, errorCount = 0;
  const abort = { triggered: false };

  try {
    await withConcurrency(files, config.indexerEmbedConcurrency, async (absPath) => {
      if (abort.triggered) return;
      const result = await indexFile(absPath, rootDir, false); // checksum comparison enabled
      if (result.status === 'indexed') indexedCount++;
      else if (result.status === 'skipped' || result.status === 'empty') skippedCount++;
      else errorCount++;
    }, abort);
  } catch (err) {
    if (err.isQuotaExhausted) {
      abort.triggered = true;
      log.warn(
        '[AI/RepositoryIndexer] Indexing aborted — OpenAI quota exhausted. ' +
        'Add billing credits to restore vector search at next startup.'
      );
      return { total: files.length, indexed: indexedCount, skipped: skippedCount, errors: -1, durationMs: Date.now() - start };
    }
    throw err;
  }

  const durationMs = Date.now() - start;
  log.info(
    `[AI/RepositoryIndexer] Incremental index complete — ` +
    `${indexedCount} changed, ${skippedCount} unchanged, ${errorCount} errors, ` +
    `duration=${(durationMs / 1000).toFixed(1)}s`
  );

  return { total: files.length, indexed: indexedCount, skipped: skippedCount, errors: errorCount, durationMs };
}

// ---------------------------------------------------------------------------
// Concurrency helper
// ---------------------------------------------------------------------------

/**
 * Process an array with a max concurrency limit.
 *
 * @template T
 * @param {T[]} items
 * @param {number} concurrency
 * @param {(item: T) => Promise<void>} fn
 */
async function withConcurrency(items, concurrency, fn, abort = null) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (queue.length > 0) {
      if (abort?.triggered) return;
      const item = queue.shift();
      await fn(item);
    }
  });
  await Promise.all(workers);
}
