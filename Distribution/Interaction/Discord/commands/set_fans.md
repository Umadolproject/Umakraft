# /set_fans

Purpose
- Admin command to set or adjust a trainer's fan count (for testing or manual correction).

Options
- trainer_id
- fans (integer)

Behavior
- Requires elevated role/permission
- Persists change to Vault or to an audit store depending on configuration
- Use cautiously; record audit metadata
