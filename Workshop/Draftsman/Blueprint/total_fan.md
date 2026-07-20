# Total Fan Blueprint

Purpose:
- Produce a /total_fan summary card showing cumulative fans across a circle or trainer set.

Inputs:
- circle_id or list of trainer_ids
- period (optional)

Outputs:
- Numeric summary and trend sparkline (PNG)

Acceptance criteria:
- Handles large numbers with human-friendly formatting

Implementation notes:
- Aggregate from Vault or cached snapshots
