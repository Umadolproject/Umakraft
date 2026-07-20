# /profile

Purpose
- Render a trainer profile card (image or embed) using the profile renderer and uma.moe profile data.

Options
- trainer_id (required)
- mode (image|embed)

Behavior
- Fetches via umamoe.fetchTrainerProfile
- Renderer uses fantracking/reports/profile.js to produce PNG (data-URI embedded images)
- Falls back to a text embed when renderer or Playwright unavailable
