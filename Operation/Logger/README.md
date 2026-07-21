# Logger

**Department:** Operation/Logger
**Responsibility:** Format investigation records into structured operational log entries
**Version:** 2.0.0

---

## Purpose

The Logger is the formatter of Operation. It receives raw `InvestigationRecord` objects from the Investigator and converts them into structured `OperationalLogEntry` objects that the Manager can evaluate.

The Logger **never** determines severity or makes decisions. It maps observation facts to log status codes and formats them consistently. All judgment belongs to the Manager.

---

## Responsibilities

- Receive one or more `InvestigationRecord` objects from the Investigator
- Map investigation facts to a `status` code (`ok` / `warn` / `error` / `stale` / `unknown`)
- Produce one `OperationalLogEntry` per investigation record
- Follow the same timestamp and prefix format as `core/log.js`
- Emit structured entries to `core/log.js` at the appropriate log level
- Forward all entries to the Manager

---

## Must Not

- Determine severity beyond status code mapping
- Decide whether to alert or escalate
- Modify investigation records
- Call Discord or Broadcast
- Write to any database other than the operation log

---

## Status Mapping

| Condition | Status |
|---|---|
| `lastSuccess === true` and `consecutiveFailures === 0` | `ok` |
| `consecutiveFailures === 1` | `warn` |
| `consecutiveFailures >= 2` | `error` |
| `staleSince !== null` and no recent failure | `stale` |
| `lastSuccess === null` (never run) | `unknown` |

---

## See Also

- `Logger.md` — full input/output contracts and sample code
- `../Investigator/Investigator.md` — investigation record schema
- `../Manager/Manager.md` — how log entries are consumed
