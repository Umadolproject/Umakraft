# Greeting Blueprint

Purpose:
- Render personalized greeting cards for a trainer or circle (e.g., welcome messages, anniversaries).

Inputs:
- target_id (trainer or circle)
- message template

Outputs:
- PNG greeting card
- Optional DM / embed

Acceptance criteria:
- Supports localized templates
- Respects image aspect ratios for common platforms

Implementation notes:
- Reuse profile renderer components for avatar and accent colors
