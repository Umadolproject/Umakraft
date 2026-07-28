// AI/providers/embeddings/localEmbeddingProvider.js
// Local embedding provider — runs entirely in-process with zero API cost.
//
// Uses @huggingface/transformers (already in package.json) with
// Xenova/all-MiniLM-L6-v2 — a 384-dim sentence transformer that delivers
// excellent semantic similarity for FAQ matching and knowledge retrieval.
//
// Model: ~23 MB download on first run, cached on disk thereafter.
// No API key, no rate limits, no quota — works offline.

import { pipeline, env } from '@huggingface/transformers';
import log from '../../../core/log.js';
import config from '../../Configuration.js';

// Force cache to the writable Railway volume — the Dockerfile sets
// HF_HOME=/data/.cache/huggingface but the library doesn't always
// respect it, so we hardwire it here before any model is loaded.
const CACHE_DIR = process.env.HF_HOME || '/data/.cache/huggingface';
env.cacheDir = CACHE_DIR;
env.localModelPath = CACHE_DIR;
log.info(`[LocalEmbedding] Cache directory set to: ${CACHE_DIR}`);

let _extractor = null;
let _modelName = null;

async function getExtractor() {
  if (_extractor) return _extractor;

  const model = config.localEmbedModel || 'Xenova/all-MiniLM-L6-v2';
  _modelName = model;

  log.info(`[LocalEmbedding] Loading model "${model}" — first run downloads ~23 MB...`);
  const start = Date.now();

  _extractor = await pipeline('feature-extraction', model, {
    // Use ONNX runtime with WASM backend — no native deps needed
    device: 'cpu',
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  log.info(`[LocalEmbedding] Model "${model}" loaded in ${elapsed}s`);
  return _extractor;
}

/**
 * Generate an embedding vector for the given text.
 *
 * @param {string} text
 * @returns {Promise<import('../../interfaces.js').EmbeddingVector>}
 */
export async function embed(text) {
  const input = text.trim().slice(0, 512); // MiniLM max context window
  if (!input) throw new Error('[LocalEmbedding] Text is empty after trim');

  const extractor = await getExtractor();

  const output = await extractor(input, {
    pooling: 'mean',
    normalize: true,
  });

  // output is a Tensor — convert to plain number[]
  const vector = Array.from(output.data);

  return {
    vector,
    model:  _modelName || 'Xenova/all-MiniLM-L6-v2',
    tokens: input.split(/\s+/).length,
  };
}
