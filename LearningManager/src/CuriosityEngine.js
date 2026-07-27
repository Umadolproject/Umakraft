// CuriosityEngine.js — Proactive investigation of knowledge gaps

export class CuriosityEngine {
  constructor(config = {}) {
    this.config = config;
    this.gaps = new Map();
  }

  registerGap(topic, { question = null, urgency = 0.5 } = {}) {
    const id = `gap_${Date.now()}`;
    this.gaps.set(id, {
      id,
      topic,
      question: question ?? `What is ${topic}?`,
      urgency,
      status: 'open',
      createdAt: new Date().toISOString(),
    });
    return id;
  }

  async explore() {
    const openGaps = [...this.gaps.values()]
      .filter(g => g.status === 'open')
      .sort((a, b) => b.urgency - a.urgency)
      .slice(0, 3);

    for (const gap of openGaps) {
      gap.status = 'investigating';
      
      try {
        // Form hypothesis from related knowledge
        const hypothesis = this._formHypothesis(gap);
        
        // In production: trigger web search, query knowledge bases, etc.
        // For now, log the investigation
        console.log(`[Curiosity] Investigating: ${gap.topic}`);
        console.log(`[Curiosity] Hypothesis: ${hypothesis}`);
        
        // Mark as resolved with placeholder findings
        gap.status = 'resolved';
        gap.findings = `Investigated: ${gap.topic}. Hypothesis: ${hypothesis}`;
        gap.resolvedAt = new Date().toISOString();
      } catch (err) {
        gap.status = 'open';
        console.error(`[Curiosity] Investigation failed for ${gap.topic}:`, err.message);
      }
    }

    return openGaps.length;
  }

  _formHypothesis(gap) {
    const patterns = [
      `Based on related knowledge, ${gap.topic} is likely related to the current domain.`,
      `${gap.topic} appears to be a user-requested topic that needs investigation.`,
      `${gap.topic} may be a sub-topic of a previously learned concept.`,
    ];
    return patterns[Math.floor(Math.random() * patterns.length)];
  }

  getStats() {
    const all = [...this.gaps.values()];
    return {
      total: all.length,
      open: all.filter(g => g.status === 'open').length,
      investigating: all.filter(g => g.status === 'investigating').length,
      resolved: all.filter(g => g.status === 'resolved').length,
    };
  }
}
