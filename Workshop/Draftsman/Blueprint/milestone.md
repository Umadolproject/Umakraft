# Milestone Blueprint

Purpose:
- Summarize when a trainer or circle reaches a milestone (fans, rank, achievements).

Inputs:
- trainer_id or circle_id
- milestone type (fans | rank)
- threshold value

Outputs:
- Discord notification message template
- Optional image card celebrating milestone

Acceptance criteria:
- Detects milestone crossings and avoids duplicate notifications

Implementation notes:
- Use Vault history or stored snapshots to detect changes
- Debounce notifications for 24h windows
