# Command Reference

> **Note:** Command definitions have moved to `Distribution/Discord/commands/`.
> Each file there is the governance-standard authoritative spec for its command,
> including permissions, options, pipeline route, error responses, and examples.
> This directory is retained as a quick-reference index only.

All 26 slash commands for the UmaKraft Circle Bot.

---

## 👤 Member Commands

Available to all members.

| Command | Description | Spec |
|---------|-------------|------|
| [/fan_gain](fan_gain.md) | Daily, weekly, and monthly fan gain + daily ranking | [→](../Distribution/Discord/commands/fan_gain.md) |
| [/leaderboard](leaderboard.md) | Circle fan-gain leaderboard — daily / weekly / monthly | [→](../Distribution/Discord/commands/leaderboard.md) |
| [/total_fan](total_fan.md) | Lifetime total fan count and circle rank | [→](../Distribution/Discord/commands/total_fan.md) |
| [/total_circlefan_gain](total_circlefan_gain.md) | Total accumulated fan gain for the entire circle | [→](../Distribution/Discord/commands/total_circlefan_gain.md) |
| [/circle_master](circle_master.md) | Day-by-day Top 3 contributors for the current month | [→](../Distribution/Discord/commands/circle_master.md) |
| [/intercircleleaderboard](intercircleleaderboard.md) | Unified cross-circle fan-gain rankings | [→](../Distribution/Discord/commands/intercircleleaderboard.md) |
| [/profile](profile.md) | Full profile dashboard — gains, records, monthly history | [→](../Distribution/Discord/commands/profile.md) |
| [/joindate](joindate.md) | Show when you joined the circle | [→](../Distribution/Discord/commands/joindate.md) |
| [/memberlist](memberlist.md) | Full roster — active members + former members | [→](../Distribution/Discord/commands/memberlist.md) |
| [/search_trainer](search_trainer.md) | Search the trainer card database by name, rank, or skills | [→](../Distribution/Discord/commands/search_trainer.md) |
| [/store](store.md) | Save your trainer card to the database | [→](../Distribution/Discord/commands/store.md) |
| [/keep](keep.md) | Mark your trainer card as permanently kept | [→](../Distribution/Discord/commands/keep.md) |
| [/set_timezone](set_timezone.md) | Set your personal timezone for greeting messages | [→](../Distribution/Discord/commands/set_timezone.md) |
| [/status](status.md) | Live bot health, sync status, and uptime | [→](../Distribution/Discord/commands/status.md) |
| [/circle_status](circle_status.md) | Live sync status for all configured circles | [→](../Distribution/Discord/commands/circle_status.md) |
| [/help](help.md) | List all bot commands | [→](../Distribution/Discord/commands/help.md) |

---

## 🔒 Admin Commands

Require **Manage Guild** or **Administrator** permission.

| Command | Permission | Description | Spec |
|---------|------------|-------------|------|
| [/link](link.md) | Manage Guild | Link a Discord account to an Uma.moe trainer | [→](../Distribution/Discord/commands/link.md) |
| [/unlink](unlink.md) | Manage Guild | Remove a Discord ↔ Uma.moe link | [→](../Distribution/Discord/commands/unlink.md) |
| [/link_list](link_list.md) | Manage Guild | Paginated list of all linked members | [→](../Distribution/Discord/commands/link_list.md) |
| [/set_fans](set_fans.md) | Manage Guild | Set fan quota targets — daily / weekly / monthly | [→](../Distribution/Discord/commands/set_fans.md) |
| [/admin_sync](admin_sync.md) | Manage Guild | Force an immediate data sync from Uma.moe | [→](../Distribution/Discord/commands/admin_sync.md) |
| [/admin_setjoindate](admin_setjoindate.md) | Manage Guild | Manually override a member's join date | [→](../Distribution/Discord/commands/admin_setjoindate.md) |
| [/test_milestone](test_milestone.md) | Manage Guild | Preview a milestone announcement without posting it | [→](../Distribution/Discord/commands/test_milestone.md) |
| [/timeline_setup](timeline_setup.md) | Manage Guild | Configure the event timeline channel | [→](../Distribution/Discord/commands/timeline_setup.md) |
| [/timeline_post](timeline_post.md) | Manage Guild | Manually trigger a timeline post | [→](../Distribution/Discord/commands/timeline_post.md) |
| [/admin_syncCards](admin_syncCards.md) | Administrator | Trigger a support card image sync from GameTora | [→](../Distribution/Discord/commands/admin_syncCards.md) |
| [/warningsettings](warningsettings.md) | Administrator | View or update the warning engine configuration | [→](../Distribution/Discord/commands/warningsettings.md) |
