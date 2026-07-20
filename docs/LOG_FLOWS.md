# UmaKraft Bot — Command & Task Log Flows

Every slash command and scheduled task in this repository, one by one.
Each entry shows: cron/trigger, what it does, the exact log lines it emits, and the execution flow step-by-step.

---

## SLASH COMMANDS

---

### `/admin_backfill`
**What it does:** Spawns a child process to seed historical fan data from uma.moe for selected circles.

**Log lines:**
```
[INFO]  admin_backfill: triggered by {user.tag} — circles: {names}, from: {fromLabel}
[INFO]  [admin_backfill] {stdout line}
[WARN]  [admin_backfill] {stderr line}
[ERROR] [admin_backfill] Failed to spawn backfill script: {err.message}
[INFO]  [admin_backfill] {exitStatus} — circles: {circleNames}
```

**Flow:**
1. `deferReply` (ephemeral)
2. Check `_running` guard — reject if already in progress
3. Validate `from` date format
4. `spawn('node', ['scripts/backfillHistory.js', ...])` child process
5. Pipe `stdout`/`stderr` to `log.info`/`log.warn`
6. On `close` → `editReply` with exit embed "Backfill Complete / Failed"

---

### `/admin_setjoindate`
**What it does:** Manually overrides a member's join date in a specific circle.

**Log lines:**
```
[INFO] admin_setjoindate: {trainerName} ({trainerId}) circle={circleId} joinedAt → {date} (set by {user.tag})
[WARN] admin_setjoindate: snapshot rebuild failed (non-fatal): {err.message}
```

**Flow:**
1. `deferReply` (ephemeral)
2. Validate date string
3. `getConfiguredCircles()` → loop circles
4. `getCircleSnapshot(circleId)` → match member by name/id
5. `store.upsertMemberForCircle(...)` — write new join date
6. `buildSnapshot(circleId)` — rebuild cache (non-fatal)
7. `editReply` → embed "Join Date Updated"

---

### `/admin_sync`
**What it does:** Triggers an immediate manual fan data sync across all configured circles.

**Log lines:**
```
[INFO]  admin_sync: manual sync triggered by {user.tag} — {n} circle(s)
[ERROR] admin_sync: sync failed for circle {id}: {err}
```

**Flow:**
1. `deferReply` (ephemeral)
2. `getConfiguredCircles()` → loop
3. `syncCircleData(circle.id)` for each
4. Collect success/error per circle
5. `editReply` → embed "Sync Complete" with per-circle status

---

### `/admin-sync-cards`
**What it does:** Scrapes trainer card data from Gametora and updates the card cache.

**Log lines:**
```
[ERROR] admin-sync-cards: sync failed: {err}
[INFO]  admin-sync-cards: card cache reloaded
[WARN]  admin-sync-cards: cache reload failed: {err.message}
[INFO]  admin-sync-cards: done — {total} cards, +{added} new, ~{updated} updated, {errors} errors in {elapsed}s
```

**Flow:**
1. `deferReply` (ephemeral)
2. `editReply` → embed "Sync Starting…"
3. `setInterval` for live progress updates
4. `syncCards()` — scrapes Gametora
5. `reloadCardCache()` — hot-reload in memory
6. `clearInterval`
7. `editReply` → embed "Card Sync Complete"

---

### `/circle_master`
**What it does:** Renders a day-by-day top-3 contributor chart for the current month.

**Log lines:** None — all failures bubble to the global interaction error handler.

**Flow:**
1. `deferReply`
2. (Admin) `trigger_milestones` → `checkMilestones(client, circleId)`
3. (Admin) `rebuild_history` → `regeneratePastHistoryMd()` + `reloadPastHistory()`
4. `getCircleSnapshot(circleId)`
5. `renderCircleMaster()` or `renderCircleMasterDay()` → PNG buffer
6. `editReply` → attachment

---

### `/circle_status`
**What it does:** Shows live sync health per configured circle (last sync, failures, errors).

**Log lines:** None.

**Flow:**
1. `deferReply` (ephemeral)
2. Read `syncStatus` Map (from `Refinery/Compiler/dataSync.js`)
3. Format per-circle status string
4. `editReply` → text block

---

### `/fan_gain`
**What it does:** Shows a member's daily, weekly, and monthly fan gain card with rank.

**Log lines:** None.

**Flow:**
1. `deferReply`
2. `getCircleSnapshot(circleId)` — find caller/target member
3. `store.getLinkedViewerId(userId)` — resolve Discord → trainer
4. `getMemberGainForDate(...)` — calc gains + rank + rivals
5. `renderFanGain(...)` → PNG buffer
6. `editReply` → attachment

---

### `/help`
**What it does:** Renders a visual help card listing all available commands.

**Log lines:** None.

**Flow:**
1. `deferReply`
2. Dynamic `import('./deploy-commands.js')` → command list
3. `renderHelpCard(commands)` → PNG buffer
4. `editReply` → attachment "BotCommands"

---

### `/intercircleleaderboard`
**What it does:** Renders a cross-circle ranking combining all configured circles.

**Log lines:** None.

**Flow:**
1. `deferReply`
2. `getCircleSnapshot(id)` for each circle
3. Aggregate + rank members across all circles
4. `renderInterCircleLeaderboard(...)` → PNG buffer
5. `editReply` → attachment

---

### `/joindate`
**What it does:** Shows when a member joined the circle.

**Log lines:** None.

**Flow:**
1. `deferReply` (ephemeral)
2. `getCircleSnapshot(circleId)` → find member
3. Format join date using member's stored `joinedAt`
4. `editReply` → embed

---

### `/keep`
**What it does:** Marks a trainer card as permanently kept in the database.

**Log lines:**
```
[ERROR] keep: DB error: {err}
[INFO]  keep: trainer {trainerId} marked permanent by {user.tag}
```

**Flow:**
1. `deferReply` (ephemeral)
2. `store.getStoredTrainerId(userId)` — verify trainer exists
3. `store.markKept(trainerId)` — set `is_protected = 1`
4. `editReply` → confirmation embed

---

### `/leaderboard`
**What it does:** Shows the circle leaderboard — daily, weekly, or monthly, live or from a snapshot.

**Log lines:** None.

**Flow:**
1. `deferReply`
2. (Historical) `store.getLeaderboardSnapshot(month)` — use cached snapshot
3. (Live) `getCircleSnapshot(circleId)` + `store.getLinks()` — compute live
4. `renderLeaderboard(...)` → PNG buffer
5. `editReply` → attachment

---

### `/link`
**What it does:** Links a Discord account to a uma.moe trainer name.

**Log lines:**
```
[ERROR] link: failed to save link: {err}
```

**Flow:**
1. `deferReply` (ephemeral)
2. Search trainer by name via uma.moe API
3. Confirm circle membership
4. `store.setLink(discordId, viewerId)` — save link
5. `editReply` → embed "Linked as {trainerName}"

---

### `/unlink`
**What it does:** Removes the Discord ↔ uma.moe trainer link for the caller.

**Log lines:** None.

**Flow:**
1. `deferReply` (ephemeral)
2. `store.getLinkedViewerId(userId)` — confirm link exists
3. `store.removeLink(userId)` — delete record
4. `editReply` → confirmation embed

---

### `/search_trainer`
**What it does:** Looks up a trainer by name or ID in the bot database.

**Log lines:** None.

**Flow:**
1. `deferReply` (ephemeral)
2. `store.findTrainer(query)` — search by name or ID
3. Format trainer card details
4. `editReply` → embed with trainer info

---

### `/set_fans`
**What it does:** Sets or views the fan requirement thresholds (daily/weekly/monthly) per circle.

**Log lines:**
```
[WARN] set_fans impact check failed for {id}: {err}
```

**Flow:**
1. `deferReply` (ephemeral)
2. `store.getGuildConfig(guildId)` — read existing config
3. `store.setGuildConfig(guildId, { fanRequirements })` — write
4. `getCircleSnapshot(circleId)` — impact check (non-fatal)
5. `editReply` → embed confirmation

---

### `/set_quota`
**What it does:** Sets fan quota targets for the server (admin only).

**Log lines:** None.

**Flow:**
1. `deferReply` (ephemeral)
2. `store.setGuildConfig(guildId, { quota })` — write quota
3. `editReply` → embed confirmation

---

### `/set_timezone`
**What it does:** Sets the caller's personal timezone for greeting messages.

**Log lines:** None.

**Flow:**
1. `deferReply` (ephemeral)
2. Validate timezone string against `LOCALE_TO_TZ` map
3. `store.setTimezone(userId, tz)` — persist
4. `editReply` → confirmation embed

---

### `/store`
**What it does:** Saves or retrieves your trainer ID in the bot database.

**Log lines:**
```
[WARN]  store: skill scrape failed for {trainerId}: {err.message}
[ERROR] store: DB error: {err}
[INFO]  store: {user.tag} stored trainer {trainerId} ({name}) in {guild}
[WARN]  store: leaderboard rebuild error: {err.message}
```

**Flow:**
1. `deferReply` (ephemeral)
2. (Save) Validate trainer ID → `store.saveTrainerId(userId, trainerId)` → scrape skills (non-fatal)
3. (Retrieve) `store.getStoredTrainerId(userId)`
4. Rebuild leaderboard cache (non-fatal)
5. `editReply` → embed

---

### `/test_milestone`
**What it does:** Fires a preview milestone announcement without recording it (admin only).

**Log lines:**
```
[WARN] test_milestone: guild error: {err}
```

**Flow:**
1. `deferReply` (ephemeral)
2. `getCircleSnapshot(circleId)` — fetch member stats
3. `ensureGuildChannels(guild)` — verify channels exist
4. Build test payload → `announcement.send(...)` to channel
5. `editReply` → confirmation

---

### `/timeline_post`
**What it does:** Manually triggers a timeline event fetch and post.

**Log lines:**
```
[INFO] timeline_post: manual fetch triggered by {user.tag} → {url}
```

**Flow:**
1. `deferReply` (ephemeral)
2. `store.getGuildConfig(guildId)` — read timeline URL
3. `runTimelineUpdate(client, url)` — fetch + post
4. `editReply` → confirmation

---

### `/timeline_setup`
**What it does:** Configures which channel and URL receives Uma Musume event timeline updates.

**Log lines:**
```
[INFO] timeline_setup: URL set to {url} by {user.tag}
```

**Flow:**
1. `deferReply` (ephemeral)
2. `store.setGuildConfig(guildId, { timelineUrl, timelineChannel })` — persist
3. `editReply` → confirmation embed

---

### `/total_circlefan_gain`
**What it does:** Shows the total accumulated fan gain of the entire circle.

**Log lines:** None.

**Flow:**
1. `deferReply`
2. `getCircleSnapshot(circleId)` — sum all member gains
3. Format total circle gain (daily / monthly cumulative)
4. `editReply` → embed

---

### `/total_fan`
**What it does:** Shows a member's lifetime total fan count and circle rank.

**Log lines:** None.

**Flow:**
1. `deferReply`
2. `getCircleSnapshot(circleId)` → find member
3. Read `totalFans` from snapshot
4. `editReply` → embed with rank

---

### `/warningsettings`
**What it does:** Configures fan-gain warning thresholds and notification channels.

**Log lines:**
```
[INFO] warningsettings: {type} {action} by {user.tag} in {guild.name}
```

**Flow:**
1. `deferReply` (ephemeral)
2. `store.getGuildConfig(guildId)` — read config
3. Apply threshold/channel changes
4. `store.setGuildConfig(guildId, config)` — persist
5. `editReply` → embed confirmation

---

---

## SCHEDULED TASKS

---

### `dataSync` — `0 * * * *` (Asia/Tokyo)
**What it does:** Fetches daily fan data from uma.moe for every configured circle and writes gain records to SQLite.

**Log lines:**
```
[ERROR] dataSync({circleId}): failed to fetch uma.moe data: {err.message}
[DEBUG] dataSync({circleId}): {trainerId} historical join → {joinDate}
[WARN]  dataSync({circleId}): could not get previous month finals: {err.message}
[DEBUG] dataSync({circleId}): API hasn't updated today's fan data yet (latestIdx={n} < {todayIdx}) — skipping daily gain writes to avoid stale carry-over
[WARN]  dataSync({circleId}): trainer color status sync failed: {err.message}
[WARN]  dataSync({circleId}): snapshot capture failed (non-fatal): {err.message}
[WARN]  dataSync({circleId}): aggregation save failed (non-fatal): {err.message}
[WARN]  dataSync({circleId}): velocity save failed (non-fatal): {err.message}
[INFO]  dataSync({circleId}): {summary}, saved {n} daily records
[DEBUG] dataSync({circleId}): snapshot saved — {n} ranked trainer(s) for {date}
```

**Flow:**
1. `runSyncQueue(getConfiguredCircles())` → queue per-circle syncs
2. Per circle: fetch `/api/v4/circles?circle_id={id}` via `umaClient`
3. Compute per-member daily gain deltas from `daily_fans` array
4. Zero join-day delta for new members
5. Detect left-members (stale `daily_fans`)
6. Write gain rows to SQLite → update `syncStatus` map
7. Rebuild daily snapshot → save velocity + aggregation (non-fatal)
8. Update `trainerColorDb` status per member (non-fatal)

---

### `milestones` — `5 * * * *` (Asia/Tokyo)
**What it does:** Checks each circle member against fan milestone tiers and fires channel + DM announcements for newly reached tiers.

**Log lines:**
```
[INFO]  milestones: skipped — notification lock held
[INFO]  milestones({circleId}): skipped — last sync was {n}s ago (>10 min), data may be stale
[WARN]  milestones: pruneOldMilestoneMonths failed: {err.message}
[INFO]  milestones({circleId}): {memberCount} members, {tierCount} tier(s) checked
[WARN]  milestones: failed to fetch circle snapshot: {err.message}
[WARN]  milestones: failed to fetch guilds: {err.message}
[WARN]  milestones: failed to record achievement for {trainerName}:{tier.key}: {err.message}
[INFO]  milestones: {trainerName} — {tier.key} already claimed (dedup) — skipping
[INFO]  milestones: NEW — {trainerName} hit {tier.key} (position {n})
[ERROR] milestones: announcement failed for {trainerName}:{tier.key}: {err.message}
[INFO]  milestones({circleId}): done — {checked} checked, {fired} fired
```

**Flow:**
1. Check busy lock → skip if held
2. Check `syncStatus.lastSyncAt` → skip if stale (>10 min)
3. `pruneOldMilestoneMonths()` — clean old records (non-fatal)
4. `getCircleSnapshot(circleId)` → iterate members
5. `meetsThreshold(member, tier)` for each `TIERS` entry
6. `claimMilestone(...)` — atomic DB claim (dedup)
7. `buildMilestonePayload(...)` → PNG image + embed body
8. `sendChannelAnnouncement(guilds, tier, buffer, ...)` — post to channel
9. `buildMemberDmText(...)` + DM member
10. `buildLeaderDmText(...)` + DM circle leader
11. Mark flags: `markChannelSent`, `markDmMemberSent`, `markDmLeaderSent`

---

### `dailyAchievement` — `10 7 * * *` (UTC)
**What it does:** Checks whether the circle's total daily fan gain crossed a milestone tier (1M–10M) and posts to channel + all member DMs.

**Log lines:**
```
[INFO]  dailyAchievement: circle {id} — total={total} — no tier crossed
[INFO]  dailyAchievement: circle {id} — {tier} crossed! firing announcement
[WARN]  dailyAchievement: circle {id} failed: {err.message}
```

**Flow:**
1. `getConfiguredCircles()` → loop
2. `getCircleSnapshot(circleId)` → sum total daily gains
3. Check against tier thresholds → dedup via SQLite (JST calendar day)
4. Fire channel embed + bulk member DMs if threshold crossed

---

### `milestoneCleanup` — `10,40 * * * *` (Asia/Tokyo)
**What it does:** Deletes temporary milestone announcement messages that have exceeded their TTL.

**Log lines:**
```
[DEBUG] milestoneCleanup: deleted {messageId} in {guildId}
[WARN]  milestoneCleanup: failed to delete {messageId}: {err.message}
[INFO]  milestoneCleanup: done — {n} message(s) removed
```

**Flow:**
1. Query `milestoneDb` for messages past TTL
2. Per record: `guild.channels.cache.get(channelId)` → `channel.messages.delete(messageId)`
3. Remove DB record on success

---

### `onboardingReminder` — `*/10 * * * *` (Asia/Tokyo)
**What it does:** DMs new members who joined >24h ago and haven't submitted a trainer card.

**Log lines:**
```
[INFO]  onboardingReminder: sent reminder to {userId}
[DEBUG] onboardingReminder: could not DM {userId}: {err.message}
[INFO]  onboardingReminder: done — {sent} sent, {skipped} skipped
```

**Flow:**
1. `getOnboardingRows()` — all pending rows
2. Filter: `joined_at` > 24h ago, `verification_status = null`, no card provided
3. Per member: `user.send(reminderText)` — DM
4. Update `last_reminded_at` in DB

---

### `greetings` — `0 7 * * *` (Asia/Tokyo)
**What it does:** Posts the daily greeting report card to the circle channel.

**Log lines:**
```
[INFO]  greetings: posted to {guildName}
[WARN]  greetings: failed for {guildName}: {err.message}
```

**Flow:**
1. `getConfiguredCircles()` → loop
2. `getCircleSnapshot(circleId)` → build stats
3. `renderDailyGreetingReport(...)` → PNG buffer
4. `getUpdateChannel(guild)` → post embed + attachment

---

### `perUserGreetings` — `5 * * * *` (Asia/Tokyo)
**What it does:** DMs each linked member at 07:xx in their own timezone (dedup per local date).

**Log lines:**
```
[INFO]  perUserGreetings: sent to {userId} ({tz})
[DEBUG] perUserGreetings: skipped {userId} — already sent today in {tz}
[WARN]  perUserGreetings: DM failed for {userId}: {err.message}
[INFO]  perUserGreetings: done — {sent} sent, {skipped} skipped
```

**Flow:**
1. `store.getAllTimezones()` → map discordId → tz
2. Per user: check if local time is 07:xx AND not already sent today (SQLite dedup per user + local date)
3. `user.send(greetingText)` — DM
4. Record send in DB

---

### `attendanceCheck` — `0 6 * * *` (Asia/Tokyo)
**What it does:** Verifies circle membership status for all linked members and updates presence flags.

**Log lines:**
```
[INFO]  attendanceCheck({circleId}): {n} member(s) checked
[WARN]  attendanceCheck({circleId}): {userId} not found in guild
[INFO]  attendanceCheck({circleId}): done — {active} active, {missing} missing
```

**Flow:**
1. `getCircleSnapshot(circleId)` → member list
2. `store.getLinks()` → Discord ID map
3. Per member: `guild.members.fetch(discordId)` — verify still in server
4. `updateAttendance(discordId, circleId, present)` → write to `attendanceDb`

---

### `warningEngine` — `30 * * * *` (Asia/Tokyo)
**What it does:** Checks all members against fan-gain quotas and DMs those who are behind their daily/weekly/monthly targets.

**Log lines:**
```
[INFO]  warningEngine({circleId}): {n} member(s) below threshold — DMs sent
[WARN]  warningEngine({circleId}): DM failed for {userId}: {err.message}
[INFO]  warningEngine({circleId}): done — {warned} warned, {ok} ok
```

**Flow:**
1. `store.getGuildConfig(guildId)` → read thresholds
2. `getCircleSnapshot(circleId)` → member gains
3. Compare gain vs. quota (daily/weekly/monthly)
4. `user.send(warningText)` — DM members below threshold (dedup by day)
5. `runOfficerSummary` path: post officer-channel summary

---

### `officerSummary` — `30 22 * * *` (Asia/Tokyo)
**What it does:** Posts a circle health summary to the officer channel 60 minutes before tally.

**Log lines:**
```
[INFO]  officerSummary({circleId}): posted to {guildName}
[WARN]  officerSummary({circleId}): failed: {err.message}
```

**Flow:**
1. `getCircleSnapshot(circleId)` → build stats
2. Render embed (members at risk, totals, top gainers)
3. `getUpdateChannel(guild)` → post

---

### `dailyTop3` — `10 7 * * *` (Asia/Tokyo)
**What it does:** Announces the top 3 daily fan gainers to the circle channel.

**Log lines:**
```
[INFO]  dailyTop3({circleId}): posted — {1st}, {2nd}, {3rd}
[WARN]  dailyTop3({circleId}): failed: {err.message}
```

**Flow:**
1. `getCircleSnapshot(circleId)` → sort by `dailyGain` desc
2. Take top 3
3. Render embed → post to leaderboard channel

---

### `interCircleDaily` — `20 7 * * *` (Asia/Tokyo)
**What it does:** Posts a combined cross-circle daily gain summary.

**Log lines:**
```
[INFO]  interCircleDaily: posted
[WARN]  interCircleDaily: failed: {err.message}
```

**Flow:**
1. `getCircleSnapshot(id)` for all circles
2. Merge + rank members across circles
3. Post combined embed to update channel

---

### `monthlyWarning` — `0 8 * * *` (Asia/Tokyo)
**What it does:** DMs members who are below their monthly fan target with a reminder.

**Log lines:**
```
[INFO]  monthlyWarning({circleId}): {n} DMs sent
[WARN]  monthlyWarning({circleId}): DM failed for {userId}: {err.message}
```

**Flow:**
1. `store.getGuildConfig(guildId)` → monthly threshold
2. `getCircleSnapshot(circleId)` → monthly gains
3. DM members below threshold (dedup by month)

---

### `weeklyWarning` — `15 8 * * *` (Asia/Tokyo)
**What it does:** DMs members who are below their weekly fan target.

**Log lines:**
```
[INFO]  weeklyWarning({circleId}): {n} DMs sent
[WARN]  weeklyWarning({circleId}): DM failed for {userId}: {err.message}
```

**Flow:** Same as `monthlyWarning` but uses weekly gain and weekly dedup.

---

### `fanDeficitImageReport` — `35 8 * * *` (Asia/Tokyo)
**What it does:** Posts a visual PNG report showing each member's fan deficit vs. their quota.

**Log lines:**
```
[INFO]  fanDeficitImageReport({circleId}): posted to {guildName}
[WARN]  fanDeficitImageReport({circleId}): render failed: {err.message}
```

**Flow:**
1. `getCircleSnapshot(circleId)` → gains + quotas
2. `renderFanDeficitReport(...)` → PNG buffer
3. Post to results channel

---

### `offlineCheck` — `0 10 * * *` (Asia/Tokyo)
**What it does:** Alerts when linked members have been offline (no Discord presence) for an extended period.

**Log lines:**
```
[INFO]  offlineCheck: {n} member(s) flagged offline
[WARN]  offlineCheck: presence fetch failed for {userId}: {err.message}
```

**Flow:**
1. `store.getLinks()` → all linked Discord IDs
2. `guild.members.fetch(userId)` → read `.presence.status`
3. Flag members offline > threshold
4. Post alert embed to officer channel

---

### `weeklyLeaderboard` — `0 9 * * 1` (Asia/Tokyo, Monday)
**What it does:** Posts the full weekly leaderboard every Monday.

**Log lines:**
```
[INFO]  weeklyLeaderboard({circleId}): posted to {guildName}
[WARN]  weeklyLeaderboard({circleId}): failed: {err.message}
```

**Flow:**
1. `getCircleSnapshot(circleId)` → sort by `weeklyGain` desc
2. `renderLeaderboard(...)` → PNG
3. Post to leaderboard channel + save snapshot to `leaderboardSnapshotDb`

---

### `weeklyTop3` — `5 9 * * 1` (Asia/Tokyo, Monday)
**What it does:** Announces the top 3 weekly gainers every Monday.

**Flow:** Same pattern as `dailyTop3` but uses `weeklyGain`.

---

### `interCircleWeekly` — `15 9 * * 1` (Asia/Tokyo, Monday)
**What it does:** Posts combined cross-circle weekly ranking.

**Flow:** Same as `interCircleDaily` but weekly scope.

---

### `monthlyTop3` — `0 23 * * *` (Asia/Tokyo, last day of month)
**What it does:** Announces top 3 monthly gainers on the last day of the month.

**Log lines:**
```
[INFO]  monthlyTop3({circleId}): posted — {1st}, {2nd}, {3rd}
```

**Flow:**
1. `isLastDayOfMonthJST()` guard
2. `getCircleSnapshot(circleId)` → sort by `monthlyGain` desc
3. Post embed to leaderboard channel

---

### `monthEndExport` — `58 23 * * *` (Asia/Tokyo, last day of month)
**What it does:** Exports the month's fan data to CSV and regenerates historical Markdown files.

**Log lines:**
```
[INFO]  monthlyHistoryExport: {filename} already exists — skipping write
[INFO]  monthlyHistoryExport: fetching {monthStr} data for circle {circleId}…
[INFO]  monthlyHistoryExport: wrote {filename} ({n} trainers, {d} day columns)
[INFO]  monthlyHistoryExport: {monthStr} already exported — skipping
[ERROR] monthlyHistoryExport: CSV write failed for circle {id}: {err.message}
[INFO]  monthlyHistoryExport: monthlyHistory rebuilt
[ERROR] monthlyHistoryExport: rebuildMonthlyHistory failed: {err.message}
[INFO]  monthlyHistoryExport: PastHistoryTrainer.md regenerated
[INFO]  monthlyHistoryExport: {monthStr} complete
[INFO]  monthlyHistoryExport: last day of month — exporting {monthStr}
```

**Flow:**
1. `isLastDayOfMonthJST()` guard
2. Per circle: fetch final monthly data → write CSV to `data/`
3. `rebuildMonthlyHistory()` — regenerate in-memory history
4. `regeneratePastHistoryMd()` — rewrite `PastHistoryTrainer.md`

---

### `monthStartCatchUp` — `30 0 1 * *` (Asia/Tokyo, 1st of month)
**What it does:** Retries the month-end export if it was missed (bot offline, API down).

**Log lines:**
```
[DEBUG] monthlyHistoryExport: catch-up skipped — {monthStr} already exported
[INFO]  monthlyHistoryExport: catch-up — exporting missed month {monthStr}
```

**Flow:** Checks if previous month CSV exists → runs full export if missing.

---

### `monthEndFinalSync` — `55 23 * * *` (Asia/Tokyo, last day of month)
**What it does:** Runs a final data sync 5 minutes before uma.moe resets monthly counts.

**Log lines:**
```
[INFO] monthEndFinalSync: last day of month (JST) — running final sync before reset
[INFO] monthEndFinalSync: done
```

**Flow:**
1. `isLastDayOfMonthJST()` guard
2. `runSyncQueue(getConfiguredCircles())` — full sync
3. Log done

---

### `interCircleMonthly` — `55 22 * * *` (Asia/Tokyo, last day of month)
**What it does:** Posts combined cross-circle monthly ranking before the reset.

**Flow:** Same as `interCircleWeekly` but monthly scope + `isLastDayOfMonthJST()` guard.

---

### `weeklyHelp` — `0 6 * * 1` (Asia/Tokyo, Monday)
**What it does:** Posts helpful tips and command reminders every Monday morning.

**Log lines:**
```
[INFO]  weeklyHelp: posted to {guildName}
[WARN]  weeklyHelp: failed: {err.message}
```

**Flow:**
1. Build help embed (tips, commands)
2. Post to update channel

---

### `timezoneNotice` — `0 9 * * 1` (Asia/Tokyo, Monday)
**What it does:** DMs every linked member weekly to remind them to set their timezone.

**Log lines:**
```
[WARN]  timezoneNotice: could not load links — {err.message}
[INFO]  timezoneNotice: sent to {discordId} (week {week})
[DEBUG] timezoneNotice: could not DM {discordId}: {err.message}
[INFO]  timezoneNotice: done — week={week} sent={sent} skipped={skipped}
```

**Flow:**
1. `store.getLinks()` → all linked Discord IDs
2. Compute ISO week number for dedup
3. Per member: skip if already sent this week (SQLite) → `user.send(noticeText)`
4. Record send

---

### `tallyResults` — `30 23 * * *` (Asia/Tokyo)
**What it does:** Finalizes and posts daily contribution results.

**Log lines:**
```
[INFO]  tallyResults: skipped — notification lock held
[INFO]  tallyResults({circleId}): already posted today — skipping
[WARN]  tallyResults: failed to fetch data: {err.message}
[DEBUG] tallyResults: tally not started yet, skipping
[WARN]  tallyResults: {circleId}: {err.message}
[INFO]  tallyResults: posted {ordinal} week results
```

**Flow:**
1. Check busy lock → skip if held
2. `getCircleSnapshot(circleId)` → daily totals
3. Dedup check (already posted today)
4. Render results embed → post to channel
5. Log ordinal week number

---

### `dailyFanWarning` — `15 7 * * *` (UTC)
**What it does:** Alerts members with zero fan gain for the day, after the uma.moe daily reset.

**Log lines:**
```
[INFO]  dailyFanWarning({circleId}): {n} zero-gain member(s) DM'd
[WARN]  dailyFanWarning({circleId}): DM failed for {userId}: {err.message}
```

**Flow:**
1. `getCircleSnapshot(circleId)` → filter members with `dailyGain === 0`
2. Exclude members in grace period or exempted
3. `user.send(warningText)` — DM each (dedup by JST date)

---

### `purgeAnnouncement` — `0 */6 * * *` (Asia/Tokyo)
**What it does:** Bulk-deletes non-pinned bot messages from the announcement channel older than the TTL.

**Log lines:**
```
[INFO]  purgeAnnouncement: scanning #{channel.name} in {guild.name}
[WARN]  purgeAnnouncement: fetch failed in {guild.name}: {err.message}
[WARN]  purgeAnnouncement: bulkDelete error: {err.message}
[WARN]  purgeAnnouncement: ancient delete error: {err.message}
[WARN]  purgeAnnouncement: ancient fetch error: {err.message}
[INFO]  purgeAnnouncement: removed {n} message(s) in {guild.name} ({human} human, {recentBot} recent bot, {ancientBot} ancient bot)
[ERROR] purgeAnnouncement: unexpected error: {err.message}
```

**Flow:**
1. Per guild: `getAnnouncementChannel(guild)`
2. Fetch message batch → classify (human / recent-bot / ancient-bot)
3. `channel.bulkDelete(recent)` (≤14 days)
4. Single-delete loop for ancient messages (>14 days)

---

### `messageCleanup` — `15 4 * * *` (Asia/Tokyo)
**What it does:** Deletes aged bot command reply messages tracked in the cleanup DB.

**Log lines:**
```
[DEBUG] messageCleanup: skipped {messageId}: {err.message}
[INFO]  messageCleanup: deleted {deleted} of {due.length} aged bot replies
```

**Flow:**
1. Query cleanup DB for messages past TTL
2. Per record: `channel.messages.delete(messageId)` (skip if already gone)
3. Remove DB record

---

### `sqliteBackup` — `30 3 * * *` (Asia/Tokyo)
**What it does:** Copies all `*.db` files to a backup directory, keeping the last 7 days.

**Log lines:**
```
[INFO]  sqliteBackup: backed up {n} file(s) to {dir}
[INFO]  sqliteBackup: pruned {n} old backup(s)
[WARN]  sqliteBackup: failed: {err.message}
```

**Flow:**
1. Glob `*.db` in project root
2. Copy each to `data/backups/{date}/`
3. Prune backup directories older than 7 days

---

### `historicalMonthSync` — `0 6 2 * *` (Asia/Tokyo, 2nd of month)
**What it does:** Fetches finalized previous-month data from uma.moe once results are confirmed.

**Log lines:**
```
[DEBUG] historicalSync: {label} already completed — skipping
[INFO]  historicalSync: starting sync for {label}…
[INFO]  historicalSync: {label} completed — {n} gain rows written
[ERROR] historicalSync: {label} failed: {err.message}
[ERROR] historicalSync: circle {id} errored — continuing with next: {err.message}
[INFO]  historicalSync: resuming {n} pending month(s) from previous run…
[INFO]  historicalSync: resuming {label}…
[INFO]  historicalSync: {label} resumed + completed — {n} rows
[ERROR] historicalSync: {label} resume failed: {err.message}
```

**Flow:**
1. `runAllCirclesHistoricalSync()` → per circle per month
2. Check completion flag in `bot_state` → skip if done
3. Fetch uma.moe monthly data → write gain rows
4. Mark complete
5. `runPendingMonths()` on startup — resume interrupted syncs

---

### `updateGameData` — `0 3 * * *` (Asia/Tokyo)
**What it does:** Refreshes Uma Musume character metadata from Gametora.

**Log lines:**
```
[INFO]  updateGameData: starting character refresh
[WARN]  updateGameData: could not get gametora buildId — skipping
[DEBUG] updateGameData: skip {slug}: {err.message}
[INFO]  updateGameData: updated {n} character(s)
[INFO]  updateGameData: character data already up to date
```

**Flow:**
1. Fetch Gametora build ID
2. Compare with cached version → skip if unchanged
3. Scrape character list → diff against local `characters.json`
4. Write updated file

---

### `memberArchiveSync` — `30 8 * * *` (Asia/Tokyo)
**What it does:** Regenerates Markdown profile files for every active and inactive member.

**Log lines:**
```
[INFO]  memberArchive: DB members empty — reading active members from Joindate.md
[INFO]  memberArchive: loaded {n} member(s) from Joindate.md
[WARN]  memberArchive: snapshot unavailable for circle {id} ({err.message}) — rolling gains will be 0
[INFO]  memberArchive: {trainerName} returned — moved to active/
[INFO]  memberArchive: {trainerName} (was {oldFile}) returned — moved to active/
[DEBUG] memberArchive: wrote active/{filename}
[INFO]  memberArchive: {name} no longer active — moved to inactive/
[INFO]  memberArchive: {name} is alumni — moved to inactive/
[DEBUG] memberArchive: wrote inactive/{filename}
[INFO]  memberArchive: done — {active} active, {inactive} inactive
```

**Flow:**
1. Load member list from DB (fallback: `Joindate.md`)
2. `getCircleSnapshot(circleId)` per circle → rolling gains
3. Render `.md` profile per member → write to `Member-Archive/active/`
4. Move departed members to `Member-Archive/inactive/`

---

### `stadiumSync` — `30 4 * * *` (Asia/Tokyo)
**What it does:** Syncs Uma Musume stadium team data for all linked trainers.

**Log lines:**
```
[INFO]  [stadiumSync] No active members — nothing to sync.
[INFO]  [stadiumSync] All caches fresh — skipping.
[INFO]  [stadiumSync] Syncing {n} / {total} members…
[DEBUG] [stadiumSync] ✓ {viewerId} — {n} horse(s)
[WARN]  [stadiumSync] ✗ {viewerId} — scrape returned null
[WARN]  [stadiumSync] ✗ {viewerId} — {err.message}
[INFO]  [stadiumSync] Done — {ok} updated, {fail} failed.
[INFO]  [stadiumSync] Startup: {n} member(s) have no stadium cache — syncing.
[WARN]  [stadiumSync] Startup sync failed (non-fatal): {err.message}
```

**Flow:**
1. `store.getLinks()` → all viewer IDs
2. Filter stale caches (>24h)
3. Per member: scrape stadium page → `stadiumDb.upsert(...)`
4. Startup variant: `maybeStartupStadiumSync()` — sync members with no cache entry at all

---

### `chatArchiver` — `*/5 * * * *` (Asia/Tokyo)
**What it does:** Archives messages from designated channels to persistent storage.

**Log lines:**
```
[INFO]  chatArchiver: archived {n} message(s) from #{channel.name}
[WARN]  chatArchiver: failed for #{channel.name}: {err.message}
```

**Flow:**
1. Read configured archive channels from guild config
2. Fetch new messages since last cursor
3. Upsert to `imageArchiveDb` / message store
4. Advance cursor

---

### `imageArchive` — `*/2 * * * *` (Asia/Tokyo)
**What it does:** Saves images posted in tracked channels to the image archive DB.

**Log lines:**
```
[WARN]  imageArchive: failed to post to #image-archive — Missing Permissions
[INFO]  imageArchive: archived {n} image(s)
```

**Flow:**
1. Poll tracked channels for new image attachments
2. Download + store URL in `imageArchiveDb`
3. Post to `#image-archive` channel (requires Manage Messages permission)

---

### `broadcastBroker` — `*/5 * * * *` (Asia/Tokyo)
**What it does:** Polls the Broadcast pipeline for pending products and delivers them to Discord.

**Log lines:** Managed by `Broadcast/Broker/broker.js` internally.

**Flow:**
1. `_broker.runOnce()` → `Archive.getPending()` → `ArchiveInspector.validate()`
2. `ArchiveTransporter.deliver()` → `Announcer.send()`
3. Mark delivered in archive

---

### `operationCheck` — `*/5 * * * *` (Asia/Tokyo)
**What it does:** Evaluates overall bot health across all tasks and posts Discord alerts for Critical/Failed states.

**Log lines:**
```
[WARN]  [Operation/Logger] {subject} — consecutive failure #{n}: {err}
[ERROR] [Operation/Logger] {subject} — {n} consecutive failures: {err}
[ERROR] [Operation/Logger] {subject} — stale for {duration}: {err}
[DEBUG] [Operation/Logger] {subject} — never run
[INFO]  [Operation/Manager] {summary}
[WARN]  [Operation/Manager] failed to post Discord alert: {err.message}
```

**Flow:**
1. `investigate()` → reads `taskRegistry`, `syncStatus`, `timelineStatus`, `process.memoryUsage()`
2. `createLogEntries(records)` → maps to `ok/warn/error/stale/unknown`, emits via `log`
3. `evaluate(entries, client)` → picks worst decision across all entries
4. Routes to `postUpdate(client, emoji, title, body)` for `Critical` / `Failed` / `Investigation Required`
5. `Healthy` and `Warning` are log-only

---

*Generated from source — last updated 2026-07-20.*
