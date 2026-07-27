# UmaKraft Bot — Frequently Asked Questions

> This file is indexed by the AI document search. When a user asks a common question, the AI retrieves these answers and synthesizes them into a natural, personality-rich reply.

---

## 🤖 About the Bot

### What is UmaKraft?
UmaKraft is a Discord bot that manages Uma Musume Pretty Derby circles on uma.moe. It tracks fan gains, posts leaderboards, sends milestone notifications, monitors attendance, and keeps your circle organized — all automatically.

### What can this bot do?
- **Fan tracking**: Syncs fan data from uma.moe every 30 minutes
- **Leaderboards**: Daily, weekly, and monthly fan gain rankings
- **Milestones**: Celebrates when a trainer hits fan gain thresholds (1M–100M)
- **Warnings**: Alerts trainers falling below the daily 1M fan goal
- **Attendance**: Tracks who's active in Discord
- **AI Q&A**: Ask me anything about Uma Musume, circle mechanics, or the bot itself!

### Who made this bot?
UmaKraft was built by a dedicated circle leader who wanted to automate the tedious work of tracking fan gains on spreadsheets. The bot uses a local AI model for Q&A.

---

## 📊 Commands

### How do I see my fan gains?
Use `/fan_gain` — it generates a personal gain card showing your Daily, Weekly, and Monthly fan gains plus your circle rank.

### How do I see the leaderboard?
Use `/leaderboard` — shows the circle-wide top rankings as a PNG image card.

### How do I link my account?
Use `/link [trainer_id]` — connects your Discord account to your uma.moe trainer ID. Find your trainer ID in your uma.moe profile URL.

### How do I unlink?
Use `/unlink` — disconnects your linked trainer ID.

### What commands are available?
Use `/help` — shows an interactive guide of all available commands.

### Can I search for trainers?
Use `/search_trainer` — query the trainer database with filters.

### How do I see circle status?
Use `/circle_status` — shows a circle-wide overview including member counts and fan totals.

---

## 🎯 Fan System

### What's the daily fan goal?
Each trainer is expected to gain at least **1,000,000 fans per day**. If you fall below this, the bot sends a friendly warning.

### What are fan milestones?
When a trainer hits certain fan gain thresholds in a day, the bot celebrates it! Standard tiers: 1M, 2M, 3M, 4M, 5M, 10M, 20M, 30M, 40M. Top-tier: 60M, 80M, 100M (gated to top-3 per circle per month).

### How does fan tracking work?
The bot syncs data from uma.moe every 30 minutes. It computes each trainer's daily/weekly/monthly fan gain by comparing current counts to previous baselines. Join-day members have their carry-over zeroed so it doesn't inflate numbers.

### What's fan deficit?
Fan deficit is when a trainer's `todayGain` falls below the 1M daily goal. The warning engine tracks this and escalates through levels: reminder → warning → critical → final.

### Are there multiple circles?
Yes! UmaKraft manages two circles: UmaKraft (974470619) and UmaKraft 2 (325938032). Use `/intercircleleaderboard` to compare across both.

---

## 🕐 Timing & Timezone

### When does the daily reset happen?
The bot operates on **JST (Asia/Tokyo)** timezone. All daily resets, leaderboard posts, and warning checks run on JST midnight.

### When do leaderboards post?
- **Daily**: End of each JST day
- **Weekly**: End of each JST week (Sunday)
- **Monthly**: End of each JST month

### When is attendance checked?
Daily at 6:00 AM JST — the bot checks who has logged into Discord and tracks streaks.

---

## 🔗 Linking & Profiles

### How do I find my trainer ID?
Go to uma.moe, find your profile, and look at the URL. It should contain a numeric ID like `https://uma.moe/profile/12345678`. That number is your trainer ID.

### What if I can't find my trainer ID?
Use `/search_trainer` with your name to search the database. If you're still stuck, ask a circle officer for help.

### Can I have multiple accounts linked?
No — each Discord user can link to one trainer ID. If you need to switch, use `/unlink` first then `/link` again.

### How do I view a trainer's profile?
Use `/profile` — it shows trainer details, skills, and stats.

---

## 🎮 Uma Musume (Game Questions)

### What's the best girl to raise?
All Uma Musume are wonderful in their own way! 💕 The "best" depends on your playstyle:
- **For racing**: Focus on speed and stamina stats
- **For scoring**: Balance all stats with good support cards
- **For fun**: Pick your favorite character — the game is meant to be enjoyed!

Popular picks for beginners: Special Week (balanced), Silence Suzuka (speed), Tokai Teio (well-rounded).

### Tips for new players?
1. Start with a balanced Uma like Special Week
2. Focus on Speed and Stamina stats first
3. Level up your support cards — they matter more than the girl you raise
4. Don't stress about perfect runs — learn the training mechanics first
5. Join events for bonus rewards!

### What are support cards?
Support cards (サポートカード) are the cards you equip before a training run. They boost your stats during training and provide skills. A good support card deck is often more important than which Uma you pick!

### How does training work?
You go through turns (weeks) where you choose a training action (Speed, Stamina, Power, Guts, Intelligence). Each action raises the corresponding stat and triggers support card events. The goal is to build a strong Uma before the final race.

### Best skills to aim for?
- **Speed skills**: Straight-line speed boosts, corner acceleration
- **Stamina skills**: Recovery skills for longer races
- **Strategy skills**: Position-based skills depending on your running style (leader, betweener, etc.)

Skill priority depends on race distance and your Uma's running style.

---

## ⚙️ Bot Settings

### How do I set my timezone?
Use `/set_timezone` — sets your personal timezone for warnings and notifications.

### How do I configure warnings?
Use `/warningsettings` — customize when and how you receive fan deficit warnings.

### Who can use admin commands?
Admin commands (like `/admin_sync`, `/circle_master`) are restricted by Discord role permissions. Only circle leaders and officers can use them.

---

## 🆘 Troubleshooting

### Bot not responding?
- Make sure you're in the right channel
- The bot might be restarting — wait a moment
- If slash commands aren't showing, Discord may be propagating (up to 1 hour for global commands)
- If @mention isn't working, check Message Content Intent is enabled

### My fan gains look wrong?
The bot syncs every 30 minutes — wait for the next sync. If you joined mid-month, your initial fan count is zeroed for fairness. If it still looks wrong, ask an officer to run `/admin_sync`.

### How do I report a bug?
Message the bot developer or a circle officer. If it's about the AI Q&A, just mention the issue — it helps improve the bot!

---

## 💡 Pro Tips

- Link your account early with `/link` to get personalized notifications
- Check `/fan_gain` daily to track your progress toward the 1M goal
- Use `/leaderboard` to see how you stack up against the circle
- For game advice, just @mention me in #bot-chat!
