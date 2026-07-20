# Leaderboard Blueprint

Purpose:
- Define a /leaderboard command that renders top-N trainers for a given timeframe and circle.

Inputs:
- circle_id (optional)
- period (daily|weekly|monthly)
- limit (default 10)

Outputs:
- HTML/PNG leaderboard card
- Optional Discord embed summary with top 3

Acceptance criteria:
- Handles empty circle (returns friendly message)
- Respects rate limits and caches queries for 10m

Implementation notes:
- Use uma.moe rankings endpoints when available
- Provide offline mock data for renderer tests
