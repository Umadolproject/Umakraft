# Sequence Diagram

**Department:** Knowledge — AI
**Version:** 1.0.0
**Last Updated:** 2026-07-22

---

## Full Request Sequence — Repository Question

```mermaid
sequenceDiagram
    actor User
    participant GW as Command Gateway
    participant TF as Topic Filter
    participant RE as Repository Engine
    participant RAG as RAG Engine
    participant VDB as Vector Database
    participant CB as Context Builder
    participant CA as Cache
    participant PS as Prompt System
    participant AP as API Provider
    participant RV as Response Validator
    participant DC as Discord

    User->>GW: /ask "How does the Vault work?"
    GW->>TF: classify(query)
    TF-->>RE: classification=repository

    RE->>CA: checkResponseCache(query)
    CA-->>RE: miss

    RE->>RAG: retrieve(query)
    RAG->>AP: embed(query)
    AP-->>RAG: queryVector

    RAG->>VDB: similaritySearch(queryVector, topK=8)
    VDB-->>RAG: rankedChunks

    RAG-->>CB: rankedChunks
    CB->>CB: deduplicate()
    CB->>CB: enforceTokenBudget()
    CB-->>PS: contextBlock

    PS->>PS: loadTemplate(repository)
    PS->>PS: injectSystemConstraint()
    PS->>PS: injectContext(contextBlock)
    PS-->>AP: assembledPrompt

    AP->>AP: checkRateLimit()
    AP->>AP: callProvider(gpt-4o-mini)
    AP-->>RV: rawResponse

    RV->>RV: scopeCheck()
    RV->>RV: prohibitedContentCheck()
    RV->>RV: secretPatternCheck()
    RV->>RV: citationCheck()
    RV->>RV: hallucinationCheck()
    RV-->>CA: storeResponse(query, validatedResponse)
    RV-->>DC: validatedResponse

    DC-->>User: Response with citations
```

---

## Full Request Sequence — Message Generation

```mermaid
sequenceDiagram
    actor User
    participant GW as Command Gateway
    participant TF as Topic Filter
    participant MS as Message System
    participant CG as Content Generator
    participant PS as Prompt System
    participant AP as API Provider
    participant RV as Response Validator
    participant DC as Discord

    User->>GW: /ai message milestone trainerName=Akira milestone=500000
    GW->>TF: classify(command=message)
    TF-->>MS: classification=message, type=milestone

    MS->>CG: generate(type=milestone, variables)
    CG->>CG: validateVariables()
    CG->>PS: loadTemplate(prompts/Milestone.md)
    PS->>PS: injectSystemConstraint()
    PS->>PS: injectVariables(trainerName, milestoneValue)
    PS-->>AP: assembledPrompt

    AP->>AP: callProvider(gpt-4o-mini)
    AP-->>RV: rawMessage

    RV->>RV: wordCount() → 67 words (FAIL — under 100)
    RV-->>AP: regenerate("Please expand to at least 100 words.")

    AP->>AP: callProvider(gpt-4o-mini)
    AP-->>RV: rawMessage v2

    RV->>RV: wordCount() → 128 words (PASS)
    RV->>RV: prohibitedContentCheck() → PASS
    RV->>RV: secretPatternCheck() → PASS
    RV-->>DC: validatedMessage

    DC-->>User: Milestone announcement (128 words)
```

---

## Off-Topic Sequence (No AI Call)

```mermaid
sequenceDiagram
    actor User
    participant GW as Command Gateway
    participant TF as Topic Filter
    participant DC as Discord

    User->>GW: /ask "What is the stock price of Nintendo?"
    GW->>TF: classify(query)
    TF->>TF: keywordClassifier() → off-topic (confidence=0.92)
    TF-->>DC: rejectionMessage
    DC-->>User: "I'm the Umakraft AI Knowledge Service..."

    Note over TF,DC: No RAG, no prompt, no API call
```

---

## Related Documents

- `AI/ARCHITECTURE.md` — component descriptions
- `AI/diagrams/AI Pipeline.md` — simplified pipeline view
- `AI/diagrams/Message Flow.md` — message generation flow
- `AI/TOPIC_FILTER.md` — classification logic
- `AI/RESPONSE_VALIDATOR.md` — validation checks
