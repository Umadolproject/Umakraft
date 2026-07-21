# Discord Interaction

Purpose
- Describe Discord-specific integration patterns and command layout.

Structure
- commands/ — per-command handlers and command metadata
- member/ — membership-related helper handlers

Handler responsibilities
- Validate Discord command options
- Map to blueprint name with Draftsman
- Call umamoe APIs or pipeline (e.g., fetchTrainerProfile, callMiner)
- Render or reply with an embed or image attachment

Permissions
- Use Discord role checks where actions alter persistent state (e.g., set_fans, circle_master actions)

Notes
- Example command mappings live in Workshop/Draftsman/Blueprint/command-blueprints.json
- Implement tests by mocking umamoe module exports used by handlers
