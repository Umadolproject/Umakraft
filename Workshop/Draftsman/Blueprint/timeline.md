# Timeline Blueprint

Purpose:
- Blueprint for timeline scraping and scheduling (events, countdowns, match results).

Inputs:
- source (uma.moe timeline or manual)
- range (start/end)

Outputs:
- Timeline JSON snapshots
- Optional weekly summary card

Acceptance criteria:
- Idempotent scraping and clear error handling for partial failures

Implementation notes:
- Use timelineScheduler and timelineScraper modules
