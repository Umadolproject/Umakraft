/**
 * Workshop / Draftsman / Blueprint Registry
 *
 * Authority : GOVERNANCE/ARCHITECTURE_AUTHORITY.md
 * Registry  : GOVERNANCE/PIPELINE_REGISTRY.md
 * Stage     : 3 — Workshop
 * Department: Draftsman
 *
 * This file is the single source of truth for every blueprint layout in the
 * pipeline.  Each export is a blueprint descriptor object containing:
 *
 *   name     — human-readable blueprint name
 *   trigger  — slash command or pipeline event that produces this deliverable
 *   type     — "command" | "broadcast"
 *   layout   — ASCII art card layout as defined in the corresponding .md file
 *
 * The Fabricator reads these descriptors at render time to verify that the
 * compiled product it received matches the expected visual structure before
 * rendering begins.
 *
 * Governance: Do not add, remove, or rename layouts without updating
 * GOVERNANCE/PIPELINE_REGISTRY.md and recording an ADR in
 * GOVERNANCE/ARCHITECTURE_DECISIONS.md.
 */

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT: Fan Gain  (/fan_gain)
// ─────────────────────────────────────────────────────────────────────────────
export const fanGainLayout = {
  name: 'Fan Gain',
  trigger: '/fan_gain',
  type: 'command',
  layout: `
┌──────────────────────────────────────────────────────────────────────────────┐
│                            🏇 Fangain Statistics                             │
├──────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  Username#0000                                             │
│  │              │  @username                                                 │
│  │   Avatar     │                                                            │
│  │   160×160    │  ┌──────────────────────────────────────────────────────┐  │
│  │              │  │             Lifetime Fangain                         │  │
│  └──────────────┘  │             12,458,224                               │  │
│                    └──────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐             │
│  │ Daily Fangain    │ │ Weekly Fangain   │ │ Monthly Fangain  │             │
│  │                  │ │                  │ │                  │             │
│  │ +125,000         │ │ +870,000         │ │ +3,240,000       │             │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘             │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ Last Updated: Today 14:21                                       Rank #152    │
└──────────────────────────────────────────────────────────────────────────────┘
`.trim(),
};

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT: Profile  (/profile)
// ─────────────────────────────────────────────────────────────────────────────
export const profileLayout = {
  name: 'Profile',
  trigger: '/profile',
  type: 'command',
  layout: `
┌──────────────────────────────────────────────────────────────┐
│                      UMAKRAFT PROFILE                        │
├──────────────────────────────────────────────────────────────┤
│ ┌──────────────┐  Trainer Name                              │
│ │              │  @Discord Username                         │
│ │ Discord      │─────────────────────────────────────────── │
│ │ Avatar       │ Trainer ID : XXXXXXXX                      │
│ │ 180×180      │ Discord ID: XXXXXXXXXXXXX                  │
│ │              │ Circle     : Aoharu                        │
│ └──────────────┘ Joined     : 2025-04-01                    │
├──────────────────────────────────────────────────────────────┤
│                      FAN GAIN SUMMARY                        │
│                                                              │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐                │
│ │ Daily      │ │ Weekly     │ │ Monthly    │                │
│ │ +145,221   │ │ +892,500   │ │ +3,250,000 │                │
│ └────────────┘ └────────────┘ └────────────┘                │
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │              Lifetime Fan Gain                           │ │
│ │                18,532,456                               │ │
│ └──────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────┤
│ Best Performance : Team Stadium Rank #15                    │
│ Rolling Gain     : +3.2M / Month                            │
├──────────────────────────────────────────────────────────────┤
│                    ALL-TIME STATS          YEARLY PERF 📈   │
│──────────────────────────────────────────────────────────────│
│ Total Fans        18,532,456   2025 ████████████ 4.2M       │
│ Total Gain        12,831,112   2026 ██████████████████ 9.1M │
│ Active Days       274          2027 ███ 1.5M                │
│ Average Daily     145,211                                   │
│ Average Weekly    915,422                                   │
│ Average Monthly   3,942,221                                 │
├──────────────────────────────────────────────────────────────┤
│ Recent Fan History                                          │
│──────────────────────────────────────────────────────────────│
│ Yesterday              +82,500                              │
│ Last Week              +903,000                             │
│ Last Month             +3,150,000                           │
│ 10M Fans               2025-08-02                           │
│ Joined Circle          2025-05-18                           │
├──────────────────────────────────────────────────────────────┤
│                  TEAM STADIUM                               │
├────────────┬────────────┬────────────┬────────────┬──────────┤
│ Sprint     │ Mile       │ Medium     │ Long       │ Dirt     │
│────────────│────────────│────────────│────────────│──────────│
│ Team Score │ Team Score │ Team Score │ Team Score │TeamScore │
│ 58,210     │ 60,331     │ 59,888     │ 61,422     │ 52,155   │
│            │            │            │            │          │
│ Avg Rank   │ Avg Rank   │ Avg Rank   │ Avg Rank   │ Avg Rank │
│ UG7        │ UG8        │ UG7        │ SS9        │ SS6      │
│            │            │            │            │          │
│ Top Horse  │ Top Horse  │ Top Horse  │ Top Horse  │ TopHorse │
│ Curren     │ Taiki      │ Dober      │ Top Gun    │ Falcon   │
│ Chan       │ Shuttle    │            │            │          │
├────────────┴────────────┴────────────┴────────────┴──────────┤
│ Commentary / Inheritance                                    │
│──────────────────────────────────────────────────────────────│
│ "Currently averaging 145k fan gain/day. Long-distance team  │
│ is strongest this season."                                  │
└──────────────────────────────────────────────────────────────┘
`.trim(),
};

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT: Leaderboard  (/leaderboard)
// ─────────────────────────────────────────────────────────────────────────────
export const leaderboardLayout = {
  name: 'Leaderboard',
  trigger: '/leaderboard',
  type: 'command',
  layout: `
┌──────────────────────────────────────────────────────────────┐
│                    UMAKRAFT LEADERBOARD                      │
│                                                              │
│ Circle : Aoharu Academy                                      │
│ Period : Weekly                                              │
│ Top 10 Trainers                                              │
└──────────────────────────────────────────────────────────────┘
┌──────────────┬──────────────┬──────────────┐
│ Total Gain   │ Active Users │ Last Updated │
│ 18,421,322   │      30      │ 2 min ago    │
└──────────────┴──────────────┴──────────────┘
┌────┬────────────────────┬──────────────┬──────────────┐
│ #  │ Trainer            │ Circle       │ Fan Gain     │
├────┼────────────────────┼──────────────┼──────────────┤
│🥇1 │ Umakraft           │ Aoharu       │ 1,542,991    │
│🥈2 │ Trainer B          │ MANT         │ 1,320,421    │
│🥉3 │ Trainer C          │ Arc          │ 1,219,332    │
│ 4  │ Trainer D          │ UAF          │ 1,145,112    │
│ 5  │ Trainer E          │ Aoharu       │ 1,091,002    │
│ 6  │ Trainer F          │ MANT         │   981,122    │
│ 7  │ Trainer G          │ Arc          │   952,321    │
│ 8  │ Trainer H          │ UAF          │   911,441    │
│ 9  │ Trainer I          │ Aoharu       │   882,113    │
│10  │ Trainer J          │ Arc          │   801,900    │
└────┴────────────────────┴──────────────┴──────────────┘
┌──────────────────────────────────────────────────────────────┐
│ Highest Gain : 1,542,991                                     │
│ Average Gain :   992,411                                     │
│ Lowest Gain  :   801,900                                     │
└──────────────────────────────────────────────────────────────┘
Generated by Umakraft • Cached 10 minutes • uma.moe data
`.trim(),
};

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT: Club Gain  (/club_gain)
// ─────────────────────────────────────────────────────────────────────────────
export const clubGainLayout = {
  name: 'Club Gain',
  trigger: '/club_gain',
  type: 'command',
  layout: `
┌──────────────────────────────────────────────────────────────┐
│ 📈 Club Gain Report                                          │
│                                                              │
│ Club      : Aoharu Academy                                   │
│ Period    : Last 30 Days                                     │
│ Generated : YYYY-MM-DD HH:mm                                 │
└──────────────────────────────────────────────────────────────┘
┌────────────┬──────────────┬──────────────────┐
│ Date       │ Daily Gain   │ Running Total    │
├────────────┼──────────────┼──────────────────┤
│ Jul 01     │    +1,250    │         1,250    │
│ Jul 02     │      +850    │         2,100    │
│ Jul 03     │      +940    │         3,040    │
│ Jul 04     │    +1,120    │         4,160    │
│ Jul 05     │      +700    │         4,860    │
│ ...        │ ...          │ ...              │
│ Jul 30     │      +980    │        26,780    │
└────────────┴──────────────┴──────────────────┘
┌──────────────────────────────────────────────────────────────┐
│ Total Gain    : 26,780                                       │
│ Average / Day :    892                                       │
│ Highest Day   :  1,420                                       │
│ Lowest Day    :    430                                       │
└──────────────────────────────────────────────────────────────┘
Generated by Umakraft • Cached 10 minutes • uma.moe data
`.trim(),
};

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT: Total Fan  (/total_fan)
// ─────────────────────────────────────────────────────────────────────────────
export const totalFanLayout = {
  name: 'Total Fan',
  trigger: '/total_fan',
  type: 'command',
  layout: `
┌──────────────────────────────────────────────────────────────────────────────┐
│                           🏆 Total Fan Count                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  Username#0000                                             │
│  │              │  @username                                                 │
│  │   Avatar     │                                                            │
│  │   160×160    │  ┌──────────────────────────────────────────────────────┐  │
│  │              │  │             Lifetime Total Fans                      │  │
│  └──────────────┘  │             12,458,224                               │  │
│                    └──────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────┐  ┌──────────────────────────┐  │
│  │ Circle Rank                              │  │ Circle                   │  │
│  │ #12                                      │  │ Aoharu Academy           │  │
│  └──────────────────────────────────────────┘  └──────────────────────────┘  │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ Last Updated: Today 14:21                                                    │
└──────────────────────────────────────────────────────────────────────────────┘
`.trim(),
};

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT: Total Circle Fan Gain  (/total_circlefan_gain)
// ─────────────────────────────────────────────────────────────────────────────
export const totalCircleFanGainLayout = {
  name: 'Total Circle Fan Gain',
  trigger: '/total_circlefan_gain',
  type: 'command',
  layout: `
┌──────────────────────────────────────────────────────────────┐
│ 🌸 Circle Fan Gain                                           │
│                                                              │
│ Circle  : Aoharu Academy                                     │
│ Period  : July 2026                                          │
│ Members : 20 active                                          │
└──────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────┐
│             Total Circle Gain This Month                     │
│                                                              │
│                      48,921,445                              │
└──────────────────────────────────────────────────────────────┘
┌────┬──────────────────────────┬──────────────┬──────────────┐
│ #  │ Trainer                  │ Monthly Gain │ Share        │
├────┼──────────────────────────┼──────────────┼──────────────┤
│🥇1 │ SmartFalcon              │  8,421,332   │  17.2 %      │
│🥈2 │ Trainer B                │  7,320,110   │  15.0 %      │
│🥉3 │ Trainer C                │  5,219,002   │  10.7 %      │
│  4 │ Trainer D                │  4,145,321   │   8.5 %      │
│  5 │ Trainer E                │  3,991,880   │   8.2 %      │
│ .. │ ...                      │  ...         │  ...         │
└────┴──────────────────────────┴──────────────┴──────────────┘
Generated by Umakraft • Cached 10 minutes • uma.moe data
`.trim(),
};

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT: Search Trainer  (/search_trainer)
// ─────────────────────────────────────────────────────────────────────────────
export const searchTrainerLayout = {
  name: 'Search Trainer',
  trigger: '/search_trainer',
  type: 'command',
  layout: `
┌──────────────────────────────────────────────────────────────────────────────┐
│                            🔍 Trainer Search Result                          │
├──────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  TrainerName                                               │
│  │              │  Rank #42                                                  │
│  │   Avatar /   │                                                            │
│  │   Card Art   │  ┌────────────────────────────────────────────────────┐   │
│  │   160×160    │  │ Linked Discord : @username                         │   │
│  │              │  │ Stored Since   : 2026-01-15                        │   │
│  └──────────────┘  └────────────────────────────────────────────────────┘   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐             │
│  │ Total Fans       │ │ Monthly Gain     │ │ Daily Gain       │             │
│  │ 12,458,224       │ │ +1,240,000       │ │ +125,000         │             │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘             │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                          Support Card Data                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ Card Name : Speed SSR Card A                                         │   │
│  │ Skill 1   : Speed Up (L)        Skill 2 : Recovery Boost (M)        │   │
│  │ Skill 3   : Final Sprint (L)    Skill 4 : Stamina Guard (S)         │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
├──────────────────────────────────────────────────────────────────────────────┤
│ Last Updated: Today 14:21                                                    │
└──────────────────────────────────────────────────────────────────────────────┘
`.trim(),
};

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT: Circle  (/circle)
// ─────────────────────────────────────────────────────────────────────────────
export const circleLayout = {
  name: 'Circle',
  trigger: '/circle',
  type: 'command',
  layout: `
┌──────────────────────────────────────────────────────────────┐
│ Circle Name                                                  │
│ Circle ID: XXXXX                                             │
│ Trainer: Umakraft                                            │
│ Generated: YYYY-MM-DD HH:mm                                  │
└──────────────────────────────────────────────────────────────┘
┌──────────────┬──────────────┬──────────────┐
│ Members      │ Total Gain   │ Active       │
│              │              │ Members      │
│     30       │ 21,534,221   │     28       │
└──────────────┴──────────────┴──────────────┘
┌──────────────────────────────────────────────────────────────┐
│ Membership                                                   │
│                                                              │
│ Role        : Leader                                         │
│ Joined Date : 2025-02-18                                     │
└──────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────┐
│ Recent Circle Activity                                       │
├──────────────────────────────────────────────────────────────┤
│ • New member joined                                          │
│ • Circle reached 20M fan gain                                │
│ • Trainer promoted                                           │
│ • Monthly ranking updated                                    │
│ • Member left                                                │
│ • Weekly fan gain record                                     │
│ • New milestone unlocked                                     │
└──────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────┐
│ Notes                                                        │
│                                                              │
│ Current summary or important flags for the trainer's circle. │
└──────────────────────────────────────────────────────────────┘
`.trim(),
};

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT: Circle Master  (/circle_master)
// ─────────────────────────────────────────────────────────────────────────────
export const circleMasterLayout = {
  name: 'Circle Master',
  trigger: '/circle_master',
  type: 'command',
  layout: `
┌──────────────────────────────────────────────────────────────┐
│ 👑 Circle Master                                             │
│                                                              │
│ Circle  : Aoharu Academy                                     │
│ Month   : July 2026                                          │
│ Viewing : Day 21                                             │
└──────────────────────────────────────────────────────────────┘
┌────────┬──────────────────────┬──────────────────────┬──────────────────────┐
│ Day    │ 🥇 SmartFalcon       │ 🥈 Trainer B         │ 🥉 Trainer C         │
│ Jul 01 │    +1,542,991        │    +1,320,421        │    +1,219,332        │
├────────┼──────────────────────┼──────────────────────┼──────────────────────┤
│ Jul 02 │ 🥇 Trainer D         │ 🥈 SmartFalcon       │ 🥉 Trainer E         │
│        │    +1,410,002        │    +1,380,110        │    +1,201,445        │
├────────┼──────────────────────┼──────────────────────┼──────────────────────┤
│ Jul 03 │ 🥇 Trainer E         │ 🥈 Trainer C         │ 🥉 Trainer D         │
│        │    +1,390,550        │    +1,210,330        │    +1,190,005        │
│ ...    │ ...                  │ ...                  │ ...                  │
└────────┴──────────────────────┴──────────────────────┴──────────────────────┘
Generated by Umakraft • Cached 10 minutes • uma.moe data
`.trim(),
};

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT: Link  (/link)
// ─────────────────────────────────────────────────────────────────────────────
export const linkLayout = {
  name: 'Link',
  trigger: '/link',
  type: 'command',
  layout: `
┌──────────────────────────────────────────────────────────────────────────────┐
│ 🔗 ACCOUNT LINKED                                           YYYY-MM-DD HH:MM │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                        ✓ TRAINER ACCOUNT LINKED SUCCESSFULLY                 │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ DISCORD                                                                      │
│                                                                              │
│ Username          @username                                                  │
│ Discord ID        938472938472938                                            │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ TRAINER                                                                      │
│                                                                              │
│ Trainer Name      SMART Falcon                                               │
│ Trainer ID        123456789                                                  │
│ Status            Linked                                                     │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ NOTES                                                                        │
│                                                                              │
│ Your Discord account is now linked to this trainer profile.                  │
│ Commands that require a linked account are now available.                    │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ Source : Distribution → Coordinator                                          │
│ Generated : YYYY-MM-DD HH:MM UTC                                             │
│ Delivery  : Ephemeral Response                                               │
└──────────────────────────────────────────────────────────────────────────────┘
`.trim(),
};

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT: Link List  (/link_list)
// ─────────────────────────────────────────────────────────────────────────────
export const linkListLayout = {
  name: 'Link List',
  trigger: '/link_list',
  type: 'command',
  layout: `
┌──────────────────────────────────────────────────────────────┐
│ 🔗 Linked Members                                            │
│                                                              │
│ Total : 24 linked          Page 1 of 3                       │
└──────────────────────────────────────────────────────────────┘
┌────┬──────────────────────────┬──────────────────────────┬──────────────┐
│ #  │ Discord                  │ Uma.moe Trainer          │ Trainer ID   │
├────┼──────────────────────────┼──────────────────────────┼──────────────┤
│  1 │ @smartfalcon             │ SmartFalcon              │ 10042        │
│  2 │ @trainerb                │ Trainer B                │ 10103        │
│  3 │ @trainerc                │ Trainer C                │ 10211        │
│  4 │ @trainerd                │ Trainer D                │ 10334        │
│  5 │ @trainere                │ Trainer E                │ 10408        │
│ .. │ ...                      │ ...                      │ ...          │
│ 25 │ @trainerz                │ Trainer Z                │ 10999        │
└────┴──────────────────────────┴──────────────────────────┴──────────────┘
Generated by Umakraft • Page 1 of 3 • Manage Guild only
`.trim(),
};

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT: Help  (/help)  — Mode A: general  |  Mode B: specific command
// ─────────────────────────────────────────────────────────────────────────────
export const helpLayout = {
  name: 'Help',
  trigger: '/help',
  type: 'command',
  layout: `
MODE A — General (no command specified)
┌──────────────────────────────────────────────────────────────────────────────┐
│ 📖 Umakraft Commands                                        YYYY-MM-DD HH:MM │
├──────────────────────────────────────────────────────────────────────────────┤
│ /fan_gain          View a trainer's daily, weekly, and monthly fan gains     │
│ /profile           Full trainer profile card with stats and history          │
│ /total_fan         Trainer lifetime fan count and circle rank                │
│ /leaderboard       Top-N fan gain ranking for a period                       │
│ /total_circlefan_gain  Circle combined monthly fan gain                      │
│ /club_gain         30-day club fan gain history                              │
│ /circle_master     Daily Top 3 contributors calendar for the month           │
│ /circle            Circle summary card                                       │
│ /search_trainer    Look up a trainer's card data and stats                   │
│ /memberlist        Circle active members and alumni roster                   │
│ /joindate          Trainer circle join date and membership duration          │
│ /set_fans          Manually set a trainer's fan count (Admin)                │
│ /link              Link a Discord account to a trainer profile               │
│ /link_list         List all linked accounts (Admin)                          │
│ /greeting          Send a personalized greeting card                         │
│ /help              Show this help card                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│ Use /help command:<name> for detailed usage on any command.                  │
└──────────────────────────────────────────────────────────────────────────────┘

MODE B — Specific command
┌──────────────────────────────────────────────────────────────────────────────┐
│ 📖 /fan_gain                                                                 │
│ View a trainer's daily, weekly, and monthly fan gains.                       │
├──────────────────────────────────────────────────────────────────────────────┤
│ PARAMETERS                                                                   │
│                                                                              │
│ trainer_id   String   Required   —        Target trainer ID                  │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ EXAMPLES                                                                     │
│                                                                              │
│ /fan_gain trainer_id:123456789                                               │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ Source : Umakraft Command Registry                                           │
└──────────────────────────────────────────────────────────────────────────────┘
`.trim(),
};

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT: Member List  (/memberlist list:true)
// ─────────────────────────────────────────────────────────────────────────────
export const memberListLayout = {
  name: 'Member List',
  trigger: '/memberlist list:true',
  type: 'command',
  layout: `
IMAGE 1 — Active Members
┌──────────────────────────────────────────────────────────────┐
│ 👥 Active Members                                            │
│                                                              │
│ Circle : Aoharu Academy         Total : 20 members           │
└──────────────────────────────────────────────────────────────┘
┌────┬──────────────────────────┬──────────────────┬──────────────────┐
│ #  │ Trainer                  │ Discord          │ Joined           │
├────┼──────────────────────────┼──────────────────┼──────────────────┤
│  1 │ SmartFalcon              │ @smartfalcon     │ 2025-03-15       │
│  2 │ Trainer B                │ @trainerb        │ 2025-04-02       │
│  3 │ Trainer C                │ @trainerc        │ 2025-04-10       │
│ .. │ ...                      │ ...              │ ...              │
└────┴──────────────────────────┴──────────────────┴──────────────────┘
Generated by Umakraft • uma.moe data

IMAGE 2 — Alumni
┌──────────────────────────────────────────────────────────────┐
│ 📋 Alumni                                                    │
│                                                              │
│ Circle : Aoharu Academy         Total : 8 former members     │
└──────────────────────────────────────────────────────────────┘
┌────┬──────────────────────────┬──────────────────┬──────────────────┬──────────────────┐
│ #  │ Trainer                  │ Discord          │ Joined           │ Last Active      │
├────┼──────────────────────────┼──────────────────┼──────────────────┼──────────────────┤
│  1 │ Former Trainer A         │ @formera         │ 2024-11-01       │ 2025-02-28       │
│  2 │ Former Trainer B         │ @formerb         │ 2024-12-15       │ 2025-01-20       │
│ .. │ ...                      │ ...              │ ...              │ ...              │
└────┴──────────────────────────┴──────────────────┴──────────────────┴──────────────────┘
Generated by Umakraft • uma.moe data
`.trim(),
};

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT: Join Date  (/joindate)
// ─────────────────────────────────────────────────────────────────────────────
export const joinDateLayout = {
  name: 'Join Date',
  trigger: '/joindate',
  type: 'command',
  layout: `
┌──────────────────────────────────────────────────────────────────────────────┐
│ 📅 TRAINER JOIN DATE                                    YYYY-MM-DD  HH:MM   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ╭──────╮   Trainer Name                                                    │
│   │      │   Circle : <circleName>                                           │
│   ╰──────╯                                                                   │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Joined          YYYY-MM-DD                                                 │
│   Membership      Xy Xm                                                      │
│   Days Active     N                                                          │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ PRESENCE FLAGS                                                               │
│                                                                              │
│  • <label>        <description>                                              │
│  • <label>        <description>                                              │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ Source : Vault Historical Records                              uma.moe       │
└──────────────────────────────────────────────────────────────────────────────┘
`.trim(),
};

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT: Set Fans  (/set_fans)  — Admin command
// ─────────────────────────────────────────────────────────────────────────────
export const setFansLayout = {
  name: 'Set Fans',
  trigger: '/set_fans',
  type: 'command',
  layout: `
┌──────────────────────────────────────────────────────────────────────────────┐
│                           SET FANS CONFIRMATION                              │
│────────────────────────────────────────────────────────── YYYY-MM-DD HH:MM  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                        ✓ FAN COUNT UPDATED SUCCESSFULLY                      │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ TARGET TRAINER                                                               │
│                                                                              │
│ Trainer Name      <trainerName>                                              │
│ Trainer ID        <trainerId>                                                │
│ Circle            <circleName>                                               │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ FAN COUNT UPDATE                                                             │
│                                                                              │
│ Previous Fans    <previousFans>                                              │
│ New Fans         <newFans>                                                   │
│ Change           <delta>                                                     │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ ADMINISTRATOR                                                                │
│                                                                              │
│ Updated By       <administratorName>                                         │
│ Discord ID       <administratorDiscordId>                                    │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ NOTES                                                                        │
│                                                                              │
│ ✓ <statusLine>                                                               │
│ <warningLine>                                                                │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ Source    : <source>                                                         │
│ Generated : <generatedAt> UTC                                                │
│ Delivery  : Ephemeral Response                                               │
└──────────────────────────────────────────────────────────────────────────────┘
`.trim(),
};

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT: Greeting  (/greeting)
// ─────────────────────────────────────────────────────────────────────────────
export const greetingLayout = {
  name: 'Greeting',
  trigger: '/greeting',
  type: 'command',
  layout: `
┌────────────────────────────────────────────────────────────────────────────┐
│ 🌸 WELCOME TO UMAKRAFT!                                 YYYY-MM-DD HH:MM  │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│                              ○ Discord Avatar                              │
│                                                                            │
│                           <trainerName>                                    │
│                          <circleName> Circle                               │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│                           PERSONAL MESSAGE                                 │
│                                                                            │
│ <message.body>                                                             │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ TEMPLATE                                                                   │
│ <meta.template>                                                            │
│                                                                            │
│ TARGET TYPE                                                                │
│ <meta.targetType>                                                          │
│                                                                            │
│ GENERATED                                                                  │
│ <meta.generatedAt> UTC                                                     │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│ <branding.footer>                                                          │
└────────────────────────────────────────────────────────────────────────────┘
`.trim(),
};

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT: Warning  (Broadcast — automatic)
// ─────────────────────────────────────────────────────────────────────────────
export const warningLayout = {
  name: 'Warning',
  trigger: 'Broadcast Pipeline — warning engine',
  type: 'broadcast',
  layout: `
┌──────────────────────────────────────────────────────────────────────────────┐
│ ⚠ WARNING SYSTEM                                                   HH:MM UTC │
│──────────────────────────────────────────────────────────────────────────────│
│  ● CRITICAL                                                        #FF5AA5   │
│  ALERT TITLE                                                        ALERT ID │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ ERROR CODE                                                                   │
│ <errorCode>                                                                  │
│                                                                              │
│ DESCRIPTION                                                                  │
│ <description>                                                                │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ AFFECTED TARGET                                                              │
│                                                                              │
│ Trainer   : <trainerName>                                                    │
│ Circle    : <circleName>                                                     │
│ Target ID : <targetId>                                                       │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ CONTEXT                                                                      │
│──────────────────────────────────────────────────────────────────────────────│
│ <label>                   <value>                                            │
│ <label>                   <value>                                            │
│ …                                                                            │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ RECOMMENDED ACTIONS                                                          │
│                                                                              │
│ • <action>                                                                   │
│ • <action>                                                                   │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ Source : <source>                                                            │
│ Delivered via <pipeline>                                                     │
│ Monitoring Channel: <channel>                                                │
└──────────────────────────────────────────────────────────────────────────────┘
`.trim(),
};

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT: Milestone  (Broadcast — automatic)
// ─────────────────────────────────────────────────────────────────────────────
export const milestoneLayout = {
  name: 'Milestone',
  trigger: 'Broadcast Pipeline — threshold detection',
  type: 'broadcast',
  layout: `
┌────────────────────────────────────────────────────────────────────────────┐
│ 🏆 MILESTONE REACHED!                                      YYYY-MM-DD      │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│                              ○ Discord Avatar                              │
│                                                                            │
│                           <trainerName>                                    │
│                          Circle: <circleName>                              │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│                        ACHIEVEMENT                                         │
│                                                                            │
│                     <milestone.title>                                      │
│                                                                            │
│                 Milestone Type: <milestone.type>                           │
│                 Crossed: <milestone.crossedAt>                             │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ "<message.body>"                                                           │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│ <branding.footer>                                                          │
└────────────────────────────────────────────────────────────────────────────┘
`.trim(),
};

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRY — all blueprints indexed by key
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The complete blueprint registry.
 *
 * Key naming convention: camelCase, matching the command or broadcast name
 * without slashes or special characters.
 *
 * The Fabricator uses this registry to resolve the expected layout for a given
 * compiled product before rendering begins.
 */
const blueprints = {
  fanGain:              fanGainLayout,
  profile:              profileLayout,
  leaderboard:          leaderboardLayout,
  clubGain:             clubGainLayout,
  totalFan:             totalFanLayout,
  totalCircleFanGain:   totalCircleFanGainLayout,
  searchTrainer:        searchTrainerLayout,
  circle:               circleLayout,
  circleMaster:         circleMasterLayout,
  link:                 linkLayout,
  linkList:             linkListLayout,
  help:                 helpLayout,
  memberList:           memberListLayout,
  joinDate:             joinDateLayout,
  setFans:              setFansLayout,
  greeting:             greetingLayout,
  warning:              warningLayout,
  milestone:            milestoneLayout,
};

export default blueprints;
