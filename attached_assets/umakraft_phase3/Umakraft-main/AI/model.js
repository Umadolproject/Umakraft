// AI/model.js
// Local model abstraction layer.

import log from '../core/log.js';
import config from './Configuration.js';

const DEFAULT_MODEL_ID = 'HuggingFaceTB/SmolLM2-135M-Instruct';

class HuggingFaceModel {
  constructor(modelId) {
    this._modelId = modelId;
    this._pipeline = null;
    this._loadingPromise = null;
    this._ready = false;
    this._idleTimer = null;
    this._activeGenerations = 0;
    this._waiters = [];
    this._lastUsedAt = null;
    this._device = config.localModelDevice || 'cpu';
    this._idleTimeoutMs = config.localModelIdleTimeoutMs;
    this._maxConcurrency = Math.max(1, config.localModelMaxConcurrency || 1);
  }

  async load() {
    if (this._ready) {
      this._touch();
      return;
    }

    if (this._loadingPromise) {
      await this._loadingPromise;
      this._touch();
      return;
    }

    this._loadingPromise = (async () => {
      const startedAt = Date.now();
      log.info(`[AI] Loading model ${this._modelId} on device=${this._device}`);
      const { pipeline, env } = await import('@huggingface/transformers');

      env.cacheDir = process.env.HF_HOME || `${process.cwd()}/.cache/huggingface`;
      env.useFSCache = true;
      log.info(`[AI] Using model cache: ${env.cacheDir}`);

      this._pipeline = await pipeline('text-generation', this._modelId, {
        dtype: 'q4',
        device: this._device,
      });

      this._ready = true;
      this._lastUsedAt = Date.now();
      this._scheduleIdleUnload();
      log.info(`[AI] Model loaded in ${Date.now() - startedAt}ms`);
    })();

    try {
      await this._loadingPromise;
    } finally {
      this._loadingPromise = null;
    }
  }

  get ready() {
    return this._ready;
  }

  get status() {
    return {
      ready: this._ready,
      activeGenerations: this._activeGenerations,
      lastUsedAt: this._lastUsedAt,
      idleTimeoutMs: this._idleTimeoutMs,
      maxConcurrency: this._maxConcurrency,
      modelId: this._modelId,
    };
  }

  async unload(reason = 'idle-timeout') {
    if (!this._pipeline) return;
    if (this._activeGenerations > 0) return;

    clearTimeout(this._idleTimer);
    this._idleTimer = null;
    this._pipeline = null;
    this._ready = false;
    this._lastUsedAt = null;

    log.info(`[AI] Model unloaded (${reason})`);

    if (global.gc) {
      try {
        global.gc();
      } catch {
        // ignore — GC is optional
      }
    }
  }

  _touch() {
    this._lastUsedAt = Date.now();
    this._scheduleIdleUnload();
  }

  _scheduleIdleUnload() {
    clearTimeout(this._idleTimer);
    if (!this._idleTimeoutMs || this._idleTimeoutMs <= 0) return;

    this._idleTimer = setTimeout(() => {
      this.unload().catch((err) => {
        log.error(`[AI] Idle unload failed: ${err.message}`);
      });
    }, this._idleTimeoutMs);

    this._idleTimer.unref?.();
  }

  async _acquireSlot() {
    if (this._activeGenerations < this._maxConcurrency) {
      this._activeGenerations += 1;
      return;
    }

    await new Promise(resolve => this._waiters.push(resolve));
    this._activeGenerations += 1;
  }

  _releaseSlot() {
    this._activeGenerations = Math.max(0, this._activeGenerations - 1);
    const next = this._waiters.shift();
    if (next) next();
    this._touch();
  }

  async generate(messages, { maxNewTokens = 300, temperature = 0.2 } = {}) {
    await this.load();
    await this._acquireSlot();

    const startedAt = Date.now();
    try {
      log.info('[AI] Generating response...');
      const output = await this._pipeline(messages, {
        max_new_tokens: maxNewTokens,
        temperature,
        do_sample: temperature > 0,
      });

      const generated = output[0]?.generated_text;
      const text = Array.isArray(generated)
        ? (generated.at(-1)?.content ?? '')
        : String(generated ?? '');

      log.info(`[AI] Response completed in ${Date.now() - startedAt}ms`);
      return { text: text.trim() };
    } finally {
      this._releaseSlot();
    }
  }
}

let _model = null;

function getModel() {
  if (!_model) {
    const modelId = process.env.AI_LOCAL_MODEL || config.localModelId || DEFAULT_MODEL_ID;
    _model = new HuggingFaceModel(modelId);
  }
  return _model;
}

export async function loadModel() {
  await getModel().load();
}

export async function unloadModel(reason) {
  await getModel().unload(reason);
}

export function isModelReady() {
  return getModel().ready;
}

export function getModelStatus() {
  return getModel().status;
}

export async function generate(messages, options = {}) {
  return getModel().generate(messages, options);
}
