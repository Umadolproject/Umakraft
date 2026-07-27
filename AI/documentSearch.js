// AI/documentSearch.js
// Text-based document search over the repository tree.
// No embeddings or vector database required — purely lexical scoring so
// this works with zero API keys.
//
// Searches: docs/, *.md, *.js, *.json, *.yaml, *.toml
// Skips:    node_modules/, .git/, .data/

import { readdir, readFile } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';
import log from '../core/log.js';
import config from './Configuration.js';

const TOPIC_KEYWORDS = new Set([
  'umamusume', 'uma musume', 'umacraft', 'umakraft', 'circle', 'trainer',
  'fan', 'fans', 'leaderboard', 'command', 'bot', 'profile', 'milestone',
  'timeline', 'discord', 'gacha', 'card', 'link', 'unlink', 'join',
  'member', 'warningsettings', 'set_fans', 'set_timezone', 'status',
  'help', 'search_trainer', 'admin', 'store', 'keep', 'intercircle',
  'total_fan', 'total_circlefan', 'fan_gain', 'uma', 'score',
]);

export function isOnTopic(query) {
  const lower = query.toLowerCase();
  for (const kw of TOPIC_KEYWORDS) {
    if (lower.includes(kw)) return true;
  }
  // If web search is configured (SearXNG or paid APIs), accept the query.
  // Explicitly off-topic queries are still caught by TopicFilter separately.
  if (config.searxngUrl || config.tavilyApiKey || config.braveSearchApiKey ||
      config.serpapiApiKey || config.serperApiKey) {
    return true;
  }
  return false;
}

/** @type {{ file: string, content: string, tokens: Set<string> }[] | null} */
let _index = null;
const REPO_ROOT = join(new URL('.', import.meta.url).pathname, '..');

const SEARCHABLE_EXTENSIONS = new Set(['.md', '.js', '.mjs', '.json', '.yaml', '.yml', '.toml', '.txt', '.csv']);
const SKIP_DIRS = new Set(['node_modules', '.git', '.data', '.nexus', 'attached_assets']);
const MAX_FILE_BYTES = 50_000;

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
      if (SKIP_DIRS.has(entry.name)) continue;
      results.push(...await collectFiles(full));
    } else if (SEARCHABLE_EXTENSIONS.has(extname(entry.name))) {
      results.push(full);
    }
  }
  return results;
}

function tokenise(text) {
  return new Set(
    text.toLowerCase()
      .split(/[^a-z0-9_/]+/)
      .filter(token => token.length >= 2)
  );
}

export async function initialize() {
  if (_index) return;

  const startedAt = Date.now();
  const files = await collectFiles(REPO_ROOT);
  _index = [];

  for (const absPath of files) {
    try {
      const content = await readFile(absPath, 'utf8');
      _index.push({
        file: relative(process.cwd(), absPath),
        content: content.slice(0, MAX_FILE_BYTES),
        tokens: tokenise(content),
      });
    } catch {
      // skip unreadable files
    }
  }

  log.info(`[AI/DocumentSearch] Indexed ${_index.length} doc file(s) in ${Date.now() - startedAt}ms.`);
}

const EXCERPT_MAX = 800;
const MAX_RESULTS = 4;

function bestExcerpt(content, queryTokens) {
  const paragraphs = content.split(/\n{2,}/).filter(paragraph => paragraph.trim().length > 20);
  if (paragraphs.length === 0) return content.slice(0, EXCERPT_MAX);

  let best = paragraphs[0];
  let bestScore = 0;

  for (const para of paragraphs) {
    const paraTokens = tokenise(para);
    let hits = 0;
    for (const qt of queryTokens) {
      if (paraTokens.has(qt)) hits += 1;
    }
    const score = hits / Math.max(queryTokens.size, 1);
    if (score > bestScore) {
      bestScore = score;
      best = para;
    }
  }

  return best.length > EXCERPT_MAX ? `${best.slice(0, EXCERPT_MAX)}…` : best;
}

export async function search(query) {
  await initialize();

  if (!isOnTopic(query)) {
    return { relevant: false, docs: [] };
  }

  const queryTokens = tokenise(query);
  if (queryTokens.size === 0) {
    return { relevant: true, docs: [] };
  }

  const startedAt = Date.now();

  const scored = _index.map(doc => {
    let hits = 0;
    for (const qt of queryTokens) {
      if (doc.tokens.has(qt)) hits += 1;
    }

    const queryCoverage = hits / queryTokens.size;
    const docCoverage = hits / doc.tokens.size;
    const score = (queryCoverage * 0.8) + (docCoverage * 0.2);
    return { doc, score };
  });

  const top = scored
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS);

  const docs = top.map(({ doc, score }) => ({
    file: doc.file,
    excerpt: bestExcerpt(doc.content, queryTokens),
    score,
  }));

  log.info(`[AI/DocumentSearch] Search completed in ${Date.now() - startedAt}ms with ${docs.length} result(s).`);
  return { relevant: true, docs };
}

export function stats() {
  return {
    indexed: Array.isArray(_index),
    documentCount: _index?.length ?? 0,
    repoRoot: REPO_ROOT,
  };
}
