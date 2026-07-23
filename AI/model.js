// AI/model.js
// Local model abstraction layer.
//
// Wraps @huggingface/transformers so the underlying model can be swapped
// (SmolLM2 → Qwen → Gemma etc.) by changing AI_LOCAL_MODEL without touching
// any other file.
//
// Public API:
//   loadModel()   — pre-warm; safe to call multiple times
//   generate(messages, options) → { text: string }
//
// The messages array follows the OpenAI chat format:
//   [{ role: 'system', content: '...' }, { role: 'user', content: '...' }]
// The transformers.js pipeline applies the model's own chat template.

import log from '../core/log.js';

const DEFAULT_MODEL_ID = 'HuggingFaceTB/SmolLM2-360M-Instruct';

// ---------------------------------------------------------------------------
// HuggingFaceModel — wraps transformers.js text-generation pipeline
// ---------------------------------------------------------------------------

class HuggingFaceModel {
  constructor(modelId) {
    this._modelId   = modelId;
    this._pipeline  = null;
    this._loading   = false;
    this._ready     = false;
    this._loadError = null;
  }

  /**
   * Load the model into memory. Idempotent — safe to call multiple times.
   * Downloads on first run (~200 MB quantized); subsequent runs use cache.
   * @returns {Promise<void>}
   */
  async load() {
    if (this._ready)   return;
    if (this._loading) {
      // Wait for the in-flight load to finish
      await new Promise((resolve, reject) => {
        const poll = setInterval(() => {
          if (this._ready)   { clearInterval(poll); resolve();         }
          if (this._loadError) { clearInterval(poll); reject(this._loadError); }
        }, 200);
      });
      return;
    }

    this._loading = true;
    try {
      log.info(`[AI/LocalModel] Loading "${this._modelId}" (q4 quantised)…`);
      const { pipeline, env } = await import('@huggingface/transformers');

      this._pipeline = await pipeline('text-generation', this._modelId, {
        dtype:  'q4',
        device: 'cpu',
      });

      this._ready = true;
      log.info(`[AI/LocalModel] Model ready: ${this._modelId}`);
    } catch (err) {
      this._loadError = err;
      this._loading   = false;
      log.error(`[AI/LocalModel] Failed to load model: ${err.message}`);
      throw err;
    }
    this._loading = false;
  }

  get ready() { return this._ready; }

  /**
   * Generate a response.
   *
   * @param {Array<{role: string, content: string}>} messages
   * @param {{ maxNewTokens?: number, temperature?: number }} [options]
   * @returns {Promise<{ text: string }>}
   */
  async generate(messages, { maxNewTokens = 300, temperature = 0.2 } = {}) {
    await this.load();

    const output = await this._pipeline(messages, {
      max_new_tokens: maxNewTokens,
      temperature,
      do_sample:      temperature > 0,
    });

    // When the pipeline receives a messages array, generated_text is also
    // an array of message objects; the last entry is the assistant reply.
    const generated = output[0]?.generated_text;
    const text = Array.isArray(generated)
      ? (generated.at(-1)?.content ?? '')
      : String(generated ?? '');

    return { text: text.trim() };
  }
}

// ---------------------------------------------------------------------------
// Singleton — swappable via AI_LOCAL_MODEL env var
// ---------------------------------------------------------------------------

let _model = null;

/** @returns {HuggingFaceModel} */
function getModel() {
  if (!_model) {
    _model = new HuggingFaceModel(DEFAULT_MODEL_ID);
  }
  return _model;
}

/**
 * Pre-warm the model. Call once on startup so the first user query doesn't wait.
 * Errors are caught and logged — the bot keeps running even if the model fails.
 */
export async function loadModel() {
  try {
    await getModel().load();
  } catch (err) {
    log.error(`[AI/LocalModel] Pre-warm failed: ${err.message}`);
  }
}

/** @returns {boolean} */
export function isModelReady() {
  return getModel().ready;
}

/**
 * Generate a response from a messages array.
 * @param {Array<{role: string, content: string}>} messages
 * @param {object} [options]
 * @returns {Promise<{ text: string }>}
 */
export async function generate(messages, options = {}) {
  return getModel().generate(messages, options);
}
