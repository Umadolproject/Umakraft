# /circle

Purpose
- Render or inspect a circle (group) summary using uma.moe circle endpoints and cached snapshots.

Options
- circle_id (required)
- year/month (optional)

Behavior
- Uses umamoe.fetchCircle(...) to obtain raw data
- Refinery/Renderer produce the final artifact (JSON summary or image)
