# Commands (Slash Command Definitions)

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 4 — Distribution
**Department:** Discord → Commands (Definitions)
**Version:** v1.0.0
**Last Updated:** 2026-07-21

---

## Purpose

The **commands/** directory contains the slash command definitions for all 26 UmaKraft bot commands.

Each file documents a single slash command — its governance header, permissions, options, output type, pipeline route, behavior, error responses, and usage examples. These are the authoritative specifications for every command registered with the Discord API.

---

## Responsibilities

- Document every slash command's interface, permissions, and expected behavior.
- Define the pipeline route each command travels through.
- Specify error responses for every known failure condition.
- Serve as the source of truth for command authors and pipeline implementers.

---

## Does Not Do

- Contain handler or implementation logic — that belongs to `Distribution/Commands/`.
- Validate user input at runtime — that belongs to `Distribution/Commands/`.
- Call pipeline stages — that belongs to `Distribution/Coordinator/`.
- Deliver responses to Discord — that belongs to `Distribution/Dispatcher/`.

---

## Member Commands

Available to all members.

| Command | File | Output | Description |
|---------|------|--------|-------------|
| `/fan_gain` | [fan_gain.md](fan_gain.md) | Image | Daily, weekly, and monthly fan gain + daily ranking |
| `/leaderboard` | [leaderboard.md](leaderboard.md) | Image | Circle fan-gain leaderboard — daily / weekly / monthly |
| `/total_fan` | [total_fan.md](total_fan.md) | Image | Lifetime total fan count and circle rank |
| `/total_circlefan_gain` | [total_circlefan_gain.md](total_circlefan_gain.md) | Image | Total accumulated fan gain for the entire circle |
| `/circle_master` | [circle_master.md](circle_master.md) | Image | Day-by-day Top 3 contributors for the current month |
| `/intercircleleaderboard` | [intercircleleaderboard.md](intercircleleaderboard.md) | Image | Unified cross-circle fan-gain rankings |
| `/profile` | [profile.md](profile.md) | Image | Full profile dashboard — gains, records, monthly history |
| `/joindate` | [joindate.md](joindate.md) | Embed / Image | Show when you joined the circle |
| `/memberlist` | [memberlist.md](memberlist.md) | Embed / Image | Full roster — active members + former members |
| `/search_trainer` | [search_trainer.md](search_trainer.md) | Image | Search the trainer card database by name, rank, or skills |
| `/store` | [store.md](store.md) | Ephemeral embed | Save your trainer card to the database |
| `/keep` | [keep.md](keep.md) | Ephemeral embed | Mark your trainer card as permanently kept |
| `/set_timezone` | [set_timezone.md](set_timezone.md) | Ephemeral embed | Set your personal timezone for greeting messages |
| `/status` | [status.md](status.md) | Ephemeral embed | Live bot health, sync status, and uptime |
| `/circle_status` | [circle_status.md](circle_status.md) | Ephemeral embed | Live sync status for all configured circles |
| `/help` | [help.md](help.md) | Image | List all bot commands |

---

## Admin Commands

Require elevated Discord permissions.

| Command | File | Permission | Output | Description |
|---------|------|------------|--------|-------------|
| `/link` | [link.md](link.md) | Manage Guild | Ephemeral embed | Link a Discord account to an Uma.moe trainer |
| `/unlink` | [unlink.md](unlink.md) | Manage Guild | Ephemeral embed | Remove a Discord ↔ Uma.moe link |
| `/link_list` | [link_list.md](link_list.md) | Manage Guild | Image | Paginated list of all linked members |
| `/set_fans` | [set_fans.md](set_fans.md) | Manage Guild | Ephemeral + Image | Set fan quota targets — daily / weekly / monthly |
| `/admin_sync` | [admin_sync.md](admin_sync.md) | Manage Guild | Ephemeral embed | Force an immediate data sync from Uma.moe |
| `/admin_setjoindate` | [admin_setjoindate.md](admin_setjoindate.md) | Manage Guild | Ephemeral embed | Manually override a member's join date |
| `/test_milestone` | [test_milestone.md](test_milestone.md) | Manage Guild | Ephemeral image | Preview a milestone announcement without posting it |
| `/timeline_setup` | [timeline_setup.md](timeline_setup.md) | Manage Guild | Ephemeral embed | Configure the event timeline channel |
| `/timeline_post` | [timeline_post.md](timeline_post.md) | Manage Guild | Public + Ephemeral | Manually trigger a timeline post |
| `/admin_syncCards` | [admin_syncCards.md](admin_syncCards.md) | Administrator | Ephemeral embed | Trigger a support card image sync from GameTora |
| `/warningsettings` | [warningsettings.md](warningsettings.md) | Administrator | Ephemeral embed | View or update the warning engine configuration |

---

## Design Principle

Definitions are **declarations, not implementations**.

A command definition specifies what a command looks like and how it behaves. It does not know how that behavior is achieved. Keeping definitions here and handlers in `Distribution/Commands/` ensures Discord's registration requirements never bleed into pipeline logic.
