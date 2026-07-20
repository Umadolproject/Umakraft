# Warning Blueprint

Purpose:
- Create a standardized warning/alert blueprint for abnormal conditions (API failures, quota exceeded, corrupted data).

Inputs:
- severity (info|warning|critical)
- context object

Outputs:
- Discord alert embed
- Optional log entry to monitoring channel

Acceptance criteria:
- Includes timestamps, error codes, and helpful remediation steps

Implementation notes:
- Integrate with existing ERROR_HANDLING.md classifications
