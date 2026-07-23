// AI/documentSearch.js
// Text-based document search over the docs/ directory tree.
//
// No embeddings or vector database required — purely lexical scoring so
// this works with zero API keys.
//
// Public API:
//   search(query) → { relevant: boolean, docs: DocResult[] }
//   initialize()  → void (pre-loads the doc index)
//
// DocResult: { file: string, excerpt: string, score: number }

import { readdir, readFile } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';
import { createHash } from 'node:crypto';
import log from '../core/log.js';

// ---------------------------------------------------------------------------
// Topic guard — only answer Umacraft / Umamusume questions
// ---------------------------------------------------------------------------

const TOPIC_KEYWORDS = new Set([
  'umamusume', 'uma musume', 'umacraft', 'umakraft', 'circle', 'trainer',
  'fan', 'fans', 'leaderboard', 'command', 'bot', 'profile', 'milestone',
  'timeline', 'discord', 'gacha', 'card', 'link', 'unlink', 'join',
  'member', 'warningsettings', 'set_fans', 'set_timezone', 'status',
  'help', 'search_trainer', 'admin', 'store', 'keep', 'intercircle',
  'total_fan', 'total_circlefan', 'fan_gain', 'uma', 'score',
]);

/**
 * Returns true if the query is plausibly Umacraft / Umamusume related.
 * @param {string} query
 * @returns {boolean}
 */
export function isOnTopic(query) {
  const lower = query.toLowerCase();
  for (const kw of TOPIC_KEYWORDS) {
    if (lower.includes(kw)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Document index — loaded once, kept in memory
// ---------------------------------------------------------------------------

/** @type {{ file: string, content: string, tokens: Set<string> }[] | null} */
let _index = null;

const DOCS_ROOT = join(new URL('.', import.meta.url).pathname, '..', 'docs');

/** Recursively collect all .md and .json files under a directory. */
async function collectFiles(dir) {
  const results = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await collectFiles(full));
    } else if (['.md', '.json'].includes(extname(entry.name))) {
      results.push(full);
    }
  }
  return results;
}

/** Tokenise text into a Set of lowercase alpha-numeric words (≥ 2 chars). */
function tokenise(text) {
  return new Set(
    text.toLowerCase()
      .split(/[^a-z0-9_/]+/)
      .filter(t => t.length >= 2)
  );
}

/**
 * Build the in-memory document index.
 * Called once on startup; subsequent calls are no-ops.
 */
export async function initialize() {
  if (_index) return;
  const files = await collectFiles(DOCS_ROOT);
  _index = [];
  for (const absPath of files) {
    try {
      const content = await readFile(absPath, 'utf8');
      _index.push({
        file:    relative(process.cwd(), absPath),
        content: content.slice(0, 8000), // cap per-file to limit memory
        tokens:  tokenise(content),
      });
    } catch {
      // skip unreadable files
    }
  }
  log.info(`[AI/DocumentSearch] Indexed ${_index.length} doc file(s).`);
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

const EXCERPT_MAX  = 800;   // chars per returned excerpt
const MAX_RESULTS  = 4;     // docs returned per query

/**
 * Extract the most relevant excerpt from a document for a given set of query tokens.
 * Splits by paragraph, finds the highest-scoring paragraph, returns ≤ EXCERPT_MAX chars.
 *
 * @param {string} content
 * @param {Set<string>} queryTokens
 * @returns {string}
 */
function bestExcerpt(content, queryTokens) {
  const paragraphs = content.split(/\n{2,}/).filter(p => p.trim().length > 20);
  if (paragraphs.length === 0) return content.slice(0, EXCERPT_MAX);

  let best = paragraphs[0];
  let bestScore = 0;

  for (const para of paragraphs) {
    const paraTokens = tokenise(para);
    let hits = 0;
    for (const qt of queryTokens) {
      if (paraTokens.has(qt)) hits++;
    }
    const score = hits / Math.max(queryTokens.size, 1);
    if (score > bestScore) {
      bestScore = score;
      best = para;
    }
  }

  return best.length > EXCERPT_MAX ? best.slice(0, EXCERPT_MAX) + '…' : best;
}

// ---------------------------------------------------------------------------
// Public search
// ---------------------------------------------------------------------------

/**
 * Search indexed docs for content relevant to the query.
 *
 * @param {string} query
 * @returns {Promise<{ relevant: boolean, docs: Array<{ file: string, excerpt: string, score: number }> }>}
 */
export async function search(query) {
  await initialize();

  if (!isOnTopic(query)) {
    return { relevant: false, docs: [] };
  }

  const queryTokens = tokenise(query);
  if (queryTokens.size === 0) {
    return { relevant: true, docs: [] };
  }

  const scored = _index.map(doc => {
    let hits = 0;
    for (const qt of queryTokens) {
      if (doc.tokens.has(qt)) hits++;
    }
    // Jaccard-like score: hits / union size, boosted by query coverage
    const queryCoverage = hits / queryTokens.size;
    const docCoverage   = hits / doc.tokens.size;
    const score = (queryCoverage * 0.8) + (docCoverage * 0.2);
    return { doc, score };
  });

  const top = scored
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS);

  const docs = top.map(({ doc, score }) => ({
    file:    doc.file,
    excerpt: bestExcerpt(doc.content, queryTokens),
    score,
  }));

  return { relevant: true, docs };
}
