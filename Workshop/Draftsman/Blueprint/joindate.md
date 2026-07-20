# Join Date Blueprint

Purpose:
- Blueprint to report a trainer's earliest join date and historical presence in a circle.

Inputs:
- trainer_id
- circle_id (optional)

Outputs:
- Formatted date and duration (e.g., "Joined: 2022-03-01 — 4y 3m")

Acceptance criteria:
- Uses historical snapshots when available

Implementation notes:
- Derive from Vault records or past-history parser
