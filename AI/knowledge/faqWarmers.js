// AI/knowledge/faqWarmers.js
// Pre-written personality-rich answers for the most common @mention questions.
// These get seeded into the response cache on startup — instant replies, zero AI cost.
//
// Each entry has:
//   query          — the lowercased, trimmed user question
//   commandMode    — 'ask' (used by @mention handler via answer())
//   retrievalMode  — 'local_docs'
//   text           — the pre-written response in bot personality

const FAQ_WARMERS = [
  {
    query: "what's the best girl to raise?",
    commandMode: 'ask',
    retrievalMode: 'local_docs',
    text: `Ehe~ that's the question everyone asks! 💕

All Uma Musume are wonderful, but here's what I think:

🏇 **For beginners**: Special Week is super balanced — great for learning the ropes!
⚡ **For speed lovers**: Silence Suzuka melts the track with raw speed
✨ **For all-rounders**: Tokai Teio is well-rounded and absolutely sparkles

Honestly? Pick the girl you love most — the game's more fun that way! 💖

But if you want a meta pick: **support cards matter more than the girl** — a strong deck can make anyone shine~! 🐴

Need help picking support cards too? Just ask! 🦋`,
  },
  {
    query: 'how do i use this bot?',
    commandMode: 'ask',
    retrievalMode: 'local_docs',
    text: `Ohhh, welcome, Trainer~! 🦋 Let me show you around!

Here's what you can do:

📊 \`/fan_gain\` — See YOUR daily/weekly/monthly fan gains with a fancy card!
🏆 \`/leaderboard\` — Check who's topping the circle rankings
🔗 \`/link [your_id]\` — Connect your Discord to your uma.moe account
❓ \`/help\` — Full interactive command guide

💬 And of course, just **@mention me** in #bot-chat anytime you have a question — I'm always here to help! 💕

First step: use \`/link\` to connect your trainer ID, then try \`/fan_gain\` to see your stats~! 🐴`,
  },
  {
    query: 'what commands are available?',
    commandMode: 'ask',
    retrievalMode: 'local_docs',
    text: `Here's everything I can do, Trainer! ✨

**📊 Your Stats**
\`/fan_gain\` — Your fan gain card (daily/weekly/monthly)
\`/leaderboard\` — Circle rankings
\`/profile\` — Trainer profile view
\`/total_fan\` — Total fan count

**🔗 Account**
\`/link\` — Connect to uma.moe
\`/unlink\` — Disconnect
\`/link_list\` — See all links

**🎯 Circle**
\`/circle_status\` — Circle overview
\`/memberlist\` — Member list
\`/intercircleleaderboard\` — Cross-circle rankings

**🔍 Search & Info**
\`/search_trainer\` — Find trainers
\`/help\` — Full interactive guide

**⚙️ Settings**
\`/set_timezone\` — Your timezone
\`/warningsettings\` — Warning preferences

That's most of them! Use \`/help\` for the complete interactive list~! 🦋`,
  },
  {
    query: 'how does fan deficit work?',
    commandMode: 'ask',
    retrievalMode: 'local_docs',
    text: `Great question! Let me explain fan deficit~ 📉

**The Goal**: Every trainer should gain **1,000,000 fans per day** 🎯

**What's "deficit"?** — It's when your \`todayGain\` falls below that 1M goal. The bot tracks EVERY trainer individually (not the whole circle together!).

**How it escalates**:
💡 Reminder → ⚠️ Warning → 🔥 Critical → 🚨 Final

Each level comes with a personalized card and ping. The engine checks every 30 minutes and won't spam you — it has anti-spam gating per trainer.

**How to avoid it**: Keep grinding those fans daily! Even a little progress counts~ 🏇💕

Want to check your current gain? Use \`/fan_gain\`!`,
  },
  {
    query: 'what can you do?',
    commandMode: 'ask',
    retrievalMode: 'local_docs',
    text: `Hai hai~! Let me introduce myself! 🦋

I'm **UmaKraft-chan**, your circle's AI assistant~! Here's what I can do for you:

📊 **Track your stats** — Fan gains, leaderboards, milestones
🔔 **Keep you accountable** — Daily goal warnings, attendance tracking
🎉 **Celebrate wins** — Achievement notifications when you hit milestones
💬 **Answer questions** — Ask me about Uma Musume, circle mechanics, or the bot!

Just **@mention me** in #bot-chat with any question about:
🐴 Uma Musume training & strategy
📈 Circle fan mechanics
🤖 How the bot works
🆘 Troubleshooting

I'm powered by a local AI model and the UmaKraft knowledge base — so I actually know what I'm talking about (most of the time, ehe~) 💕

Try asking me something! 🏇✨`,
  },
  {
    query: 'what is umakraft?',
    commandMode: 'ask',
    retrievalMode: 'local_docs',
    text: `UmaKraft is our Discord bot that manages Uma Musume circles on uma.moe! 🐴✨

It was built to replace those painful spreadsheets and manual screenshot checks. Now everything is automatic:

🔄 **Data Sync** — Pulls fan data from uma.moe every 30 minutes
📊 **Leaderboards** — Daily, weekly, monthly rankings as PNG cards
🎯 **Milestones** — Celebrates when trainers hit fan gain thresholds
⚠️ **Warnings** — Gently reminds trainers falling below the 1M daily goal
📋 **Attendance** — Tracks who's active in Discord
💬 **AI Q&A** — That's me! Ask anything~

We manage two circles: **UmaKraft** and **UmaKraft 2**. Both fully automated~! 💕

Want to get started? Use \`/link\` to connect your account! 🏇`,
  },
  {
    query: 'tips for new players',
    commandMode: 'ask',
    retrievalMode: 'local_docs',
    text: `Welcome to Uma Musume, new Trainer~! 🎉 Here are my top tips:

1️⃣ **Start with Special Week** — She's balanced and forgiving for beginners
2️⃣ **Speed & Stamina first** — These stats matter most in early races
3️⃣ **LEVEL YOUR SUPPORT CARDS** — Seriously, good cards > good girl! SSR cards at level 30+ make a HUGE difference
4️⃣ **Don't rush** — Learn training mechanics before chasing perfect runs
5️⃣ **Join events** — Great rewards and the community is super helpful!
6️⃣ **Use the circle** — Check \`/leaderboard\` to stay motivated!

The most important thing? **Have fun!** 🐴💕 You don't need to be #1 to enjoy raising your favorite horse girls~!

Need help with something specific? Just ask! 🦋`,
  },
  {
    query: 'how do i link my account?',
    commandMode: 'ask',
    retrievalMode: 'local_docs',
    text: `Let's get you linked up, Trainer~! 🔗

1️⃣ Go to **uma.moe** and find your profile
2️⃣ Look at the URL — it'll be like \`https://uma.moe/profile/12345678\`
3️⃣ That number at the end is your **trainer ID**
4️⃣ In Discord, type: \`/link 12345678\` (replace with YOUR number)

That's it! Once linked, you'll get:
📊 Personalized fan gain cards
🎉 Your own milestone celebrations
⚠️ Friendly warnings if you're falling behind

Can't find your ID? Try \`/search_trainer\` with your name~! 🦋

If you ever need to switch accounts, just \`/unlink\` first! 💕`,
  },
  {
    query: 'what are support cards?',
    commandMode: 'ask',
    retrievalMode: 'local_docs',
    text: `Support cards (サポートカード) are the REAL power behind your Uma! 💪✨

Think of them like this: your Uma is the athlete, but **support cards are the coaching staff**!

**What they do**:
📈 Boost your stats during training turns
🎯 Trigger special events that give bonus stats
💡 Provide skills your Uma can learn

**Why they matter**: A strong support card deck at SSR level 30+ can make ANY Uma Musume competitive. Many veteran trainers say cards matter MORE than which girl you pick!

**Tips**:
- Focus on Speed and Stamina support cards early
- Level your SSRs — the stat bonuses scale hard
- Mix card types (not all Speed!) for balanced training

Want card recommendations? Tell me which Uma you're raising~! 🐴💕`,
  },
];

export default FAQ_WARMERS;
