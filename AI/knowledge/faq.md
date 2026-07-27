# UmaKraft Bot — Frequently Asked Questions (100 Q&A)

> **Indexed by AI document search.** When a member @mentions the bot, the AI retrieves and synthesizes answers from this file. Covering everything: bot features, commands, fan tracking, linking, leaderboards, game tips, AI Q&A, settings, and troubleshooting.

---

## 🤖 About the Bot (1–8)

### 1. What is UmaKraft?
UmaKraft is a Discord bot that manages Uma Musume Pretty Derby circles on uma.moe. It automatically syncs fan data, posts leaderboards, tracks attendance, sends milestone celebrations, fires fan-deficit warnings, and provides an AI assistant for Q&A — all running 24/7 with zero manual spreadsheet work required.

### 2. What can this bot do?
Fan tracking (auto-sync every 30 min), daily/weekly/monthly leaderboards, per-trainer achievement milestones, daily fan-deficit warnings with escalation, attendance tracking (6 AM JST), Discord onboarding, trainer linking, timeline/news-feed scraping, AI-powered Q&A, image card generation, and cross-circle comparison.

### 3. Who created UmaKraft?
UmaKraft was built by the circle leader to eliminate manual spreadsheet tracking. The bot account is `UmadolProject#4037`, running on Railway with SQLite databases.

### 4. Why "UmaKraft"?
The name is a play on "Uma Musume" + "craft" — crafting a better circle experience. The bot manages two circles: UmaKraft (ID: 974470619) and UmaKraft 2 (ID: 325938032).

### 5. Is the bot always online?
Yes — it runs as a single always-on Discord bot process on Railway. If it restarts, it auto-recovers within seconds. The health server runs on port 3000.

### 6. What's the difference between slash commands and @mentions?
**Slash commands** (`/fan_gain`, `/leaderboard`, etc.) generate image cards and embeds using the Workshop pipeline. **@mentions** in #bot-chat route to the AI for conversational Q&A, or trigger live database lookups for personal stats and comparisons.

### 7. How does the AI work?
The bot uses a local AI model (no external API keys needed for Q&A). It searches the repo's documentation files, retrieves relevant excerpts, and generates answers. Answers are validated by a topic filter and response validator to prevent off-topic or incorrect replies.

### 8. Can the bot be invited to other servers?
The bot is currently guild-scoped to the UmaKraft server. Multi-guild support is on the roadmap but not yet implemented.

---

## 🔗 Account & Linking (9–16)

### 9. How do I link my account?
Use `/link [trainer_id]` or `/link trainer:YourName`. The bot verifies the trainer exists on uma.moe and creates a Discord ↔ trainer mapping. After linking, the bot can track your fan gains and send personalized notifications.

### 10. Where do I find my trainer ID?
Go to uma.moe → find your profile → check the URL: `https://uma.moe/profile/12345678`. The number is your trainer ID. You can also use the `/link` autocomplete to search by name.

### 11. Can I link using my trainer name instead of ID?
Yes! Use `/link trainer:YourTrainerName` and the bot will search uma.moe for exact matches. If the autocomplete dropdown appears, selecting it will use the numeric ID automatically.

### 12. What if I can't find my trainer ID?
Try `/search_trainer [name]` to search the local trainer database. If you still can't find it, ask a circle officer for help or check that you're spelling your trainer name exactly as it appears on uma.moe.

### 13. How do I unlink?
Use `/unlink` to remove your Discord ↔ trainer connection. If you need to switch trainers, unlink first before linking the new one.

### 14. Can I have multiple accounts linked?
No — each Discord user can link to one trainer ID per guild. The mapping is 1:1. If you need to switch, unlink first.

### 15. How do I see who's linked?
Use `/link_list` — shows a paginated list of all Discord members and their linked trainer names/IDs.

### 16. What happens if I join mid-month?
Your initial fan count is zeroed on join day to prevent inflated `todayGain`. Only fans gained after your join date count toward milestones and goals. This ensures fairness.

---

## 📊 Commands Reference (17–35)

### 17. /fan_gain — Personal fan gain card
Shows your daily, weekly, and monthly fan gains plus circle rank as a PNG image card. Options: `member`, `trainer`, `circle`. Defaults to yourself in the primary circle.

### 18. /leaderboard — Circle-wide rankings
Shows top trainers ranked by fan gain for a selected period. Options: `scope` (daily/weekly/monthly), `circle`. Auto-posts daily/weekly/monthly on a schedule.

### 19. /total_fan — Total lifetime fans
Shows a trainer's total lifetime fan count and circle rank. Options: `member`, `trainer`, `circle`.

### 20. /total_circlefan_gain — Circle fan gain summary
Shows aggregated fan gain stats for the entire circle over a period.

### 21. /profile — Trainer profile view
Displays detailed trainer profile including stats, skills, and support cards. Options: `member`, `trainer`.

### 22. /link — Connect to uma.moe
Links your Discord account to a uma.moe trainer. Options: `trainer` (name with autocomplete), `trainer_id` (numeric), `member` (for officers linking others), `circle`.

### 23. /unlink — Disconnect
Removes the Discord ↔ trainer link for yourself or (officers only) another member.

### 24. /link_list — View all links
Shows a paginated list of linked members with their trainer names and IDs.

### 25. /search_trainer — Find trainers
Queries the trainer database with name or ID filters. Supports autocomplete.

### 26. /circle_status — Circle overview
Shows live sync status, member counts, and fan totals for all configured circles.

### 27. /circle_master — Circle administration
Leader-only tools for managing circle settings. Requires Discord role permissions.

### 28. /memberlist — List circle members
Shows all circle members with their trainer details and status.

### 29. /intercircleleaderboard — Cross-circle rankings
Compares leaderboard rankings across both UmaKraft circles.

### 30. /set_fans — Override fan count
Admin: manually set or override a trainer's fan count in the database.

### 31. /set_timezone — Set your timezone
Configures your personal timezone for warning and notification timing.

### 32. /warningsettings — Configure warnings
Customize when and how you receive fan-deficit warning notifications.

### 33. /help — Interactive command guide
Shows all available commands with descriptions and usage examples.

### 34. /store — Manual trainer registration
Registers a trainer ID manually (restricted to the #uma-store channel). Used for trainers not yet in the system.

### 35. Admin commands summary
`/admin_sync` (trigger data sync), `/admin_syncCards` (resync support cards), `/admin_setjoindate` (set join date), `/test_milestone` (test-fire a milestone). All require officer permissions.

---

## 🎯 Fan System (36–50)

### 36. What's the daily fan goal?
Each trainer is expected to gain at least **1,000,000 fans per day**. The bot tracks this individually — not as a circle-wide sum.

### 37. How does fan tracking work?
The bot polls uma.moe every 30 minutes, fetches circle member data, computes each trainer's daily/weekly/monthly gain by comparing current fans to previous baselines, and writes results to SQLite.

### 38. What are fan milestones?
When a trainer hits certain fan gain thresholds in a day, the bot celebrates with a notification and/or image card. Standard tiers: 1M, 2M, 3M, 4M, 5M, 10M, 20M, 30M, 40M. Special tiers (top 3 per circle per month): 60M, 80M, 100M.

### 39. What happens if I don't hit the daily goal?
The warning engine tracks it. If your `todayGain` is below 1M, you'll get escalating warnings: reminder → warning → critical → final. Each level has anti-spam gating (one notification per level per trainer per period).

### 40. What's fan deficit?
Fan deficit = your `todayGain` is below the 1,000,000 daily goal. The warning engine monitors this independently for every trainer every 30 minutes.

### 41. How is my daily gain calculated?
Your current fan count minus yesterday's baseline. Join-day carry-over is zeroed so mid-month joiners aren't penalized unfairly.

### 42. What's weekly and monthly gain?
Weekly = current fans minus the count from 7 days ago. Monthly = current fans minus the count from the start of the calendar month (or join date if joined mid-month).

### 43. What's lifetime fans?
Your total fan count from the beginning — the raw number displayed on your uma.moe profile. Not a gain calculation, just your current total.

### 44. How often does data update?
Every 30 minutes. The bot syncs circle data from uma.moe, recomputes gains, and updates the store. If you just gained a lot of fans, wait up to 30 minutes for it to show.

### 45. Why are my fan gains showing zero?
Possible reasons: you just linked (wait for next sync), you joined mid-month (carry-over zeroed), the sync hasn't run yet (up to 30 min), or there's a temporary uma.moe issue.

### 46. How does ranking work?
Rank is determined by daily fan gain within your circle. The trainer with the highest `todayGain` is #1. Weekly and monthly rankings use the same logic over their respective periods.

### 47. Why is there a monthly lifetime fan goal?
Required lifetime fans = Months Since Join × 30,000,000. This ensures trainers maintain a consistent pace. Green if you're meeting it, red if you're behind.

### 48. How are ties resolved?
For milestone tiers with limited slots (60M/80M/100M — top 3 per circle), ties beyond the 3-slot pool are resolved by random draw. Both circles have independent pools.

### 49. Are there separate fan goals per circle?
Yes — UmaKraft and UmaKraft 2 are tracked independently. Your stats, rankings, and milestones are per-circle.

### 50. Can I check another trainer's stats?
Yes! Use `/fan_gain member:@Trainer` or `/total_fan member:@Trainer`. You can also @mention the bot like "how many fans does @Trainer have?"

---

## 🏆 Leaderboards & Rankings (51–58)

### 51. How do I see the leaderboard?
Use `/leaderboard` — it generates a PNG image card of the top trainers ranked by fan gain. Options: daily, weekly, or monthly scope.

### 52. When do leaderboards auto-post?
**Daily**: end of each JST day. **Weekly**: end of each JST week (Sunday). **Monthly**: end of each JST month. All times are Asia/Tokyo (JST).

### 53. What periods do leaderboards cover?
Daily (since midnight JST), weekly (since Monday JST), and monthly (since 1st of month JST). You can also manually request any period via `/leaderboard scope:daily|weekly|monthly`.

### 54. How do I compare with another trainer?
@mention the bot: "compare my fans with @Trainer" or "difference between me and @Trainer". The bot queries live depot data and shows both fan counts with the gap. For 3+ people: "compare @A @B @C fans".

### 55. Can I compare the whole circle?
Yes! @mention "compare all fans @everyone" and the bot will fetch every linked member's data and produce a ranked leaderboard.

### 56. What does the leaderboard image show?
Trainer names, fan gains (formatted with +/-), circle rank, highest/average/lowest gain for the period, and generation timestamp.

### 57. Why isn't my name on the leaderboard?
Possible reasons: you're not linked (use `/link`), no depot data yet (run `/fan_gain` once), your gain is below the display threshold, or the auto-post hasn't run yet.

### 58. How is cross-circle comparison different?
`/intercircleleaderboard` shows rankings across both UmaKraft and UmaKraft 2 simultaneously, letting you see how trainers compare across circles.

---

## ⚠️ Warnings & Milestones (59–67)

### 59. How do warnings work?
The warning engine runs every 30 minutes. For each trainer whose `todayGain` is below 1M, it escalates through levels: reminder → warning → critical → final. Each level has per-trainer anti-spam gating.

### 60. Will I get spammed with warnings?
No — the anti-spam gating ensures you only get one notification per warning level. The engine won't re-fire the same level for the same trainer within a cooldown window.

### 61. How are warning messages delivered?
Channel post naming/pinging the trainer (with `allowedMentions` safety) plus an individual DM with retry on failure. The message includes a personalized PNG card.

### 62. Can I customize my warning settings?
Yes! Use `/warningsettings` to configure when and how you receive warnings. Options include enabling/disabling DMs and setting thresholds.

### 63. What happens when I hit a milestone?
The bot posts a celebration message in the designated channel, optionally with a special milestone image card. Standard tiers (1M–40M) get 7 random message variants. Special tiers (60M/80M/100M) get unique images from the Falco/FalcoA pools.

### 64. Are milestones shared or individual?
**Per-trainer** — each trainer's gain is checked independently. The bot no longer sums circle-wide gains. This was a major bug fix (ADR-001).

### 65. What's the milestone dedup system?
Each milestone has a dedup key scoped to `circle+trainer+tier+day`, stored in the milestones database with exactly-once delivery semantics.

### 66. Who gets special milestone tiers (60M/80M/100M)?
Top 3 trainers per circle per month. Both circles have independent 3-slot pools — up to 6 recipients per tier per month total.

### 67. How does the daily fan warning check work?
Fires once per trainer per JST day if `todayGain` ends below 1M. Uses 50 flavor-text variants (5 tones × 10), personalized card, channel post, and DM. Wording is trainer-centric ("you", "your") not circle-centric.

---

## 🎮 Uma Musume Game (68–78)

### 68. Best Uma Musume to start with?
**Special Week** — balanced stats, forgiving training, great for learning mechanics. Other solid starters: Silence Suzuka (speed-focused), Tokai Teio (well-rounded), Oguri Cap (powerful).

### 69. What stats should I prioritize?
**Speed** and **Stamina** are the most important for racing success. Power helps with acceleration, Guts with last-spurt endurance, and Intelligence with skill activation. Focus on Speed + Stamina first.

### 70. How do support cards work?
Support cards (サポートカード) boost stats during training turns and trigger events that give bonus stats and skills. A strong SSR deck at level 30+ can make any Uma competitive. Cards matter more than which girl you choose.

### 71. Best support cards for beginners?
SSR cards that boost Speed and Stamina. Level them up to at least 30. Mix card types — don't go all Speed or all Stamina. A balanced deck of 2 Speed, 2 Stamina, 1 Power, 1 Intelligence works well.

### 72. How does training work?
You go through weekly turns choosing training actions (Speed/Stamina/Power/Guts/Intelligence). Each action raises the corresponding stat and may trigger support card events. Your goal is to build a strong Uma before her final race.

### 73. What are the best skills?
**Speed skills**: Straight-line boosts, corner acceleration. **Stamina skills**: Recovery for longer races. **Strategy skills**: Position-based (leader/betweener/chaser). Skill priority depends on race distance and running style.

### 74. What's the difference between running styles?
**Leader** (逃げ): Stay in front, need speed + stamina. **Betweener** (先行): Mid-pack position, balanced stats. **Chaser** (差し): Come from behind, need stamina + acceleration. Your support cards determine viable styles.

### 75. How do I get better training results?
1) Level your support cards to 30+, 2) Inherit good stats from parent Umas, 3) Choose the right scenario (UAF, Arc, Aoharu), 4) Manage your energy — don't train when fatigued, 5) Prioritize friendship training events.

### 76. What's the best scenario?
**UAF** is the current meta for most builds. **Arc** is strong for speed-oriented builds. **Aoharu** is beginner-friendly. The meta shifts with updates — check the latest community tier lists.

### 77. How does inheritance work?
You breed two parent Umas together. The child inherits stats, skills, and factors from both parents. Good parents → stronger child. Inheritance is key to competitive scoring.

### 78. Tips for scoring high in events?
Build for the event's specific race conditions (distance, surface, weather). Prioritize scenario-appropriate skills. Use the best support cards you have. Don't neglect Intelligence — it affects skill activation rates.

---

## 💬 AI Q&A Bot (79–87)

### 79. How do I talk to the AI?
**@mention** the bot in #bot-chat. Example: `@UmaKraft what's the best support card for Special Week?` The bot replies with an AI-generated answer in character.

### 80. What can I ask the AI?
Anything about UmaKraft, Uma Musume characters (personality, racing style, real-horse history, rivalries), circle mechanics, bot commands, fan tracking, game modes, scouting, skills, support cards, or the game! It draws from the documentation, character profiles (40+ girls), new player guide, and skills reference.

### 81. Can the AI check my live stats?
Yes! Try "how many fans do I have?", "my fan count", "what's my rank?" — these bypass the AI and query the live database. You can also compare: "difference between me and @Trainer" or "compare @A @B @C".

### 82. Can the AI compare multiple trainers?
Yes! Binary: "who has more fans, me or @Trainer?" Multi: "compare @A @B @C fans" (up to 30). Even "compare all @everyone" works for full-circle comparison.

### 83. Why doesn't the AI know everything?
The AI uses a local model and document search — it can only answer from what's in the documentation and knowledge base. It has no internet access and no game data beyond what's indexed.

### 84. Is the AI always available?
Yes — it runs locally on the same Railway instance as the bot, with no external API dependencies for Q&A. In degraded mode, it falls back to documentation-only answers.

### 85. Does the AI have a personality?
Yes! In #bot-chat, the AI adopts the UmaKraft-chan persona — cheerful, playful, warm. It uses emoji, casual language, and encourages trainers with "Ganbatte~!" energy.

### 86. How fast are AI responses?
Pre-warmed cache answers (top FAQ questions) return instantly (<1ms). Live database queries (fan stats, comparisons) take 1-3 seconds. Full AI generation takes 3-15 seconds depending on question complexity.

### 87. Can the AI go off-topic?
The TopicFilter screens every question. Off-topic questions get a gentle, in-character decline: "um... I'm here for Uma Musume, fan tracking, and bot features~!"

---

## ⚙️ Settings & Configuration (88–93)

### 88. How do I set my timezone?
Use `/set_timezone` — sets your personal timezone for warning and notification timing. The bot defaults to JST (Asia/Tokyo) for all scheduled tasks.

### 89. What timezone does the bot use?
All automated tasks (sync, leaderboard posts, warnings, attendance) run on **Asia/Tokyo (JST)**. Daily resets happen at JST midnight.

### 90. Can I disable DM notifications?
Yes — use `/warningsettings` to toggle DM delivery on/off. You can also configure warning thresholds and escalation levels.

### 91. How do I configure the timeline/news feed?
Use `/timeline_setup` — configures which channel receives scraped uma.moe timeline posts. Manually trigger with `/timeline_post`.

### 92. How do I set my join date?
Officers can use `/admin_setjoindate` for any member. Members can view their join date with `/joindate`. Join date affects milestone calculations and lifetime fan goals.

### 93. Where are images and data stored?
SQLite databases (volume-mounted on Railway). Static image pools are committed to the repo (`milestone_images/`, `attached_assets/`). No external CDN or object storage used.

---

## 🆘 Troubleshooting (94–100)

### 94. Bot not responding to slash commands?
- Discord may be propagating (up to 1 hour for global commands)
- Check you have the right permissions in the channel
- If `GUILD_ID` is set, commands are guild-scoped (instant)

### 95. @mention not working?
- Make sure you're in #bot-chat
- You must @mention the bot directly
- The Message Content Intent must be enabled on the bot

### 96. My fan counts look wrong?
- Data syncs every 30 minutes — wait for the next sync
- Mid-month joiners have carry-over zeroed
- Try running `/admin_sync` (officers only) to force a sync

### 97. AI giving wrong answers?
The AI only knows what's in the documentation. If something's missing, it says "That information is not documented." If it gives wrong info, the documentation may need updating.

### 98. Bot restarted and lost data?
SQLite databases are volume-mounted on Railway — data persists across restarts. The in-memory AI cache resets on restart but repopulates automatically.

### 99. How do I report a bug?
Message the bot developer. For AI issues, mention it in #bot-chat — feedback helps improve the bot. Known bugs are tracked in the KNOWLEDGE_BASE.md file.

### 100. Where can I learn more about the bot?
The full documentation lives in the repository: `/docs/KNOWLEDGE_BASE.md`, `/docs/KNOWLEDGE_ENGINE.md`, and `/docs/commands/`. The AI assistant can answer most questions — just @mention it!
