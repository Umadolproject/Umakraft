// ImportanceEngine.js — Scores extracted knowledge for retention priority
// Placeholder: delegates to LearningManager's inline scoring
export class ImportanceEngine {
  constructor(weights = {}) {
    this.weights = { novelty: 0.3, relevance: 0.3, emotion: 0.2, utility: 0.2, ...weights };
  }
  async score(item, context) {
    const N = 0.5; // novelty placeholder
    const R = 0.7; // relevance placeholder
    const E = 0.5; // emotion placeholder
    const U = item.type === 'correction' ? 0.95 : 0.5;
    const raw = this.weights.novelty * N + this.weights.relevance * R + this.weights.emotion * E + this.weights.utility * U;
    return Math.max(0, Math.min(1, raw));
  }
}
