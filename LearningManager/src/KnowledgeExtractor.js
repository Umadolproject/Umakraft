// KnowledgeExtractor.js — Extracts facts, patterns, and corrections from interactions

export class KnowledgeExtractor {
  constructor({ llm } = {}) {
    this.llm = llm;
  }

  async extract({ query, response, userId }) {
    const items = [];

    // Detect correction/confirmation labels from integration code
    const isLabeledCorrection = query.startsWith('CORRECTION:');
    const isLabeledConfirmation = query.startsWith('CONFIRMED:');
    const cleanQuery = isLabeledCorrection || isLabeledConfirmation
      ? query.replace(/^(CORRECTION|CONFIRMED):\s*/, '') : query;

    // Extract from user query
    const userFacts = this._extractFacts(cleanQuery);
    items.push(...userFacts.map(f => ({ ...f, source: 'user_query' })));

    // Extract from system response (AI-confirmed knowledge)
    const responseFacts = this._extractFacts(response);
    for (const fact of responseFacts) {
      items.push({ ...fact, confidence: fact.confidence * 0.8, source: 'system_response' });
    }

    // Detect corrections (user said "no, actually...")
    if (isLabeledCorrection || this._isCorrection(cleanQuery)) {
      const correction = this._extractCorrection(cleanQuery, response);
      if (correction) {
        correction.type = 'correction';
        correction.importance = 0.95; // Corrections are always high priority
        items.push(correction);
      }
    }

    // Detect preference signals
    const preferences = this._detectPreferences(query);
    items.push(...preferences);

    // Detect explicit relationships ("X is a type of Y")
    const relationships = this._extractRelationships(query + ' ' + response);
    items.push(...relationships);

    return items;
  }

  _extractFacts(text) {
    const facts = [];
    
    // Pattern: "X is Y" / "X means Y" / "X stands for Y"
    const definitionPatterns = [
      /\b(\w+(?:\s+\w+){0,3})\s+(?:is|are|means|stands for|refers to|were|was)\s+(.+?)(?:\.|$)/gi,
      /\b(\w+(?:\s+\w+){0,3})\s*[:=]\s*(.+?)(?:\.|$)/gi,
    ];

    for (const pattern of definitionPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const subject = match[1].trim();
        const object = match[2].trim();
        facts.push({
          type: 'definition',
          content: `${subject} is ${object}`,
          subject,
          predicate: 'is',
          object,
          confidence: 0.7,
        });
      }
    }

    return facts;
  }

  _isCorrection(text) {
    const correctionPatterns = [
      /\b(no|nope|nah|wrong|incorrect|actually|not really)\b/i,
      /\b(it'?s not|that'?s not|you'?re wrong)\b/i,
      /\b(i meant|i mean)\b/i,
    ];
    return correctionPatterns.some(p => p.test(text));
  }

  _extractCorrection(query, response) {
    // Simple heuristic: if user corrected, the new info is in their query
    return {
      type: 'correction',
      content: `Correction: ${query}`,
      context: response,
      confidence: 0.85,
    };
  }

  _detectPreferences(text) {
    const preferences = [];
    const lower = text.toLowerCase();

    if (/\b(keep it brief|short|concise|quick)\b/i.test(lower)) {
      preferences.push({
        type: 'preference',
        content: 'User prefers brief answers',
        confidence: 0.8,
      });
    }
    if (/\b(more detail|explain more|elaborate|in depth)\b/i.test(lower)) {
      preferences.push({
        type: 'preference',
        content: 'User prefers detailed answers',
        confidence: 0.8,
      });
    }
    if (/\b(no emoji|stop with the emoji|too many emoji)\b/i.test(lower)) {
      preferences.push({
        type: 'preference',
        content: 'User dislikes emoji-heavy responses',
        confidence: 0.9,
      });
    }

    return preferences;
  }

  _extractRelationships(text) {
    const relationships = [];
    
    const relPattern = /\b(\w+(?:\s+\w+){0,3})\s+(?:is a (?:type|kind|form|part) of|belongs to|related to)\s+(\w+(?:\s+\w+){0,3})\b/gi;
    let match;
    while ((match = relPattern.exec(text)) !== null) {
      const subject = match[1].trim();
      const object = match[2].trim();
      relationships.push({
        type: 'relationship',
        content: `${subject} is a type of ${object}`,
        subject,
        relation: 'is_a',
        object,
        confidence: 0.75,
      });
    }

    return relationships;
  }
}
