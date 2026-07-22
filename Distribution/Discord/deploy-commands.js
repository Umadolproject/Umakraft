// Distribution/Discord/deploy-commands.js
// Registers all 28 slash commands with the Discord API.
//
// Usage:
//   node Distribution/Discord/deploy-commands.js          — guild commands (instant, dev)
//   node Distribution/Discord/deploy-commands.js --global — global commands (up to 1 hour)
//
// Required secrets: DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID (guild mode only)

import { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

const global = process.argv.includes('--global');

// ─── Member Commands ───────────────────────────────────────────────────────────

const fanGain = new SlashCommandBuilder()
  .setName('fan_gain')
  .setDescription('Show daily, weekly, and monthly fan gain + current daily ranking')
  .addUserOption(o => o.setName('member').setDescription('Discord member to look up (defaults to yourself)'))
  .addStringOption(o => o.setName('trainer').setDescription('Uma.moe trainer name — supports autocomplete'))
  .addStringOption(o => o.setName('circle').setDescription('Which circle to check (defaults to primary)'));

const profile = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('Full profile dashboard — gains, personal records, milestone badges, monthly history')
  .addUserOption(o => o.setName('member').setDescription('Discord member to look up (defaults to yourself)'))
  .addStringOption(o => o.setName('trainer').setDescription('Uma.moe trainer name — includes past members'))
  .addStringOption(o => o.setName('circle').setDescription('Which circle to check (defaults to primary)'));

const leaderboard = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('Circle fan-gain leaderboard — daily, weekly, or monthly with rank movement')
  .addStringOption(o => o
    .setName('scope')
    .setDescription('Leaderboard period (defaults to daily)')
    .addChoices(
      { name: 'Daily',   value: 'daily'   },
      { name: 'Weekly',  value: 'weekly'  },
      { name: 'Monthly', value: 'monthly' },
    ))
  .addIntegerOption(o => o.setName('top').setDescription('Number of members to show (10–30)').setMinValue(10).setMaxValue(30))
  .addStringOption(o => o.setName('circle').setDescription('Which circle to check (defaults to primary)'))
  .addStringOption(o => o.setName('date').setDescription('Historical date — YYYY-MM-DD'));

const totalFan = new SlashCommandBuilder()
  .setName('total_fan')
  .setDescription('Show lifetime total fan count and circle rank')
  .addUserOption(o => o.setName('member').setDescription('Discord member to look up (defaults to yourself)'))
  .addStringOption(o => o.setName('trainer').setDescription('Uma.moe trainer name — supports autocomplete'))
  .addStringOption(o => o.setName('circle').setDescription('Which circle to check (defaults to primary)'));

const totalCircleFanGain = new SlashCommandBuilder()
  .setName('total_circlefan_gain')
  .setDescription('Total accumulated fan gain for the entire circle this month')
  .addStringOption(o => o.setName('circle').setDescription('Which circle to check (defaults to primary)'));

const circleMaster = new SlashCommandBuilder()
  .setName('circle_master')
  .setDescription('Day-by-day Top 3 fan-gain contributors for the current month')
  .addIntegerOption(o => o.setName('day').setDescription('Specific day to view (1–31, defaults to today)').setMinValue(1).setMaxValue(31))
  .addStringOption(o => o.setName('circle').setDescription('Which circle to check (defaults to primary)'))
  .addBooleanOption(o => o.setName('trigger_milestones').setDescription('Trigger milestone checks (requires Manage Guild)'));

const interCircleLeaderboard = new SlashCommandBuilder()
  .setName('intercircleleaderboard')
  .setDescription('Unified cross-circle fan-gain rankings')
  .addStringOption(o => o
    .setName('scope')
    .setDescription('Leaderboard period (defaults to daily)')
    .addChoices(
      { name: 'Daily',   value: 'daily'   },
      { name: 'Weekly',  value: 'weekly'  },
      { name: 'Monthly', value: 'monthly' },
    ))
  .addIntegerOption(o => o.setName('top').setDescription('Number of members to show (10–30)').setMinValue(10).setMaxValue(30));

const clubGain = new SlashCommandBuilder()
  .setName('club_gain')
  .setDescription('30-day club gain history — daily progress, running totals, and summary stats')
  .addStringOption(o => o.setName('club').setDescription('Club name to view (requires Administrator for other clubs)'))
  .addIntegerOption(o => o.setName('days').setDescription('Number of days to show (1–30, defaults to 30)').setMinValue(1).setMaxValue(30));

const joinDate = new SlashCommandBuilder()
  .setName('joindate')
  .setDescription('Show when you (or another member) joined the circle')
  .addUserOption(o => o.setName('member').setDescription('Discord member to look up (defaults to yourself)'))
  .addStringOption(o => o.setName('trainer').setDescription('Uma.moe trainer name'));

const memberList = new SlashCommandBuilder()
  .setName('memberlist')
  .setDescription('Full circle roster — active members and former members')
  .addBooleanOption(o => o.setName('include_former').setDescription('Include former members in the list (defaults to false)'))
  .addStringOption(o => o.setName('circle').setDescription('Which circle to check (defaults to primary)'));

const searchTrainer = new SlashCommandBuilder()
  .setName('search_trainer')
  .setDescription('Search the trainer card database by name, rank, or skill count')
  .addStringOption(o => o.setName('trainer').setDescription('Trainer name to search for — supports partial match'))
  .addIntegerOption(o => o.setName('rank').setDescription('Filter by trainer rank'))
  .addIntegerOption(o => o.setName('whiteskills').setDescription('Filter by number of white skills (0–5)').setMinValue(0).setMaxValue(5));

const store = new SlashCommandBuilder()
  .setName('store')
  .setDescription('Save your trainer card to the bot database')
  .addStringOption(o => o.setName('trainer_id').setDescription('Your Uma.moe trainer ID (numeric)').setRequired(true));

const keep = new SlashCommandBuilder()
  .setName('keep')
  .setDescription('Mark a trainer card as permanently kept — prevents 72-hour auto-expiry')
  .addStringOption(o => o.setName('trainer_id').setDescription('Uma.moe trainer ID to mark as permanent').setRequired(true));

const setTimezone = new SlashCommandBuilder()
  .setName('set_timezone')
  .setDescription('Set your personal timezone for greeting messages')
  .addStringOption(o => o.setName('timezone').setDescription('IANA timezone (e.g. Asia/Tokyo, America/New_York)').setRequired(true));

const status = new SlashCommandBuilder()
  .setName('status')
  .setDescription('Show live bot health, sync status, and uptime');

const circleStatus = new SlashCommandBuilder()
  .setName('circle_status')
  .setDescription('Show live sync status for all configured circles');

const help = new SlashCommandBuilder()
  .setName('help')
  .setDescription('List all bot commands with descriptions');

// ─── Admin Commands (Manage Guild) ────────────────────────────────────────────

const link = new SlashCommandBuilder()
  .setName('link')
  .setDescription('Link a Discord account to an Uma.moe trainer')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addStringOption(o => o.setName('trainer').setDescription('Uma.moe trainer name — supports autocomplete'))
  .addStringOption(o => o.setName('trainer_id').setDescription('Uma.moe trainer ID (overrides trainer name if both given)'))
  .addUserOption(o => o.setName('member').setDescription('Discord member to link (defaults to yourself)'))
  .addStringOption(o => o.setName('circle').setDescription('Which circle to link in (defaults to primary)'));

const unlink = new SlashCommandBuilder()
  .setName('unlink')
  .setDescription('Remove a Discord ↔ Uma.moe link')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addUserOption(o => o.setName('member').setDescription('Discord member to unlink').setRequired(true));

const linkList = new SlashCommandBuilder()
  .setName('link_list')
  .setDescription('Paginated list of all linked members')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addIntegerOption(o => o.setName('page').setDescription('Page number (defaults to 1)').setMinValue(1));

const setFans = new SlashCommandBuilder()
  .setName('set_fans')
  .setDescription('View or set fan gain quota targets — daily, weekly, or monthly')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addBooleanOption(o => o.setName('status').setDescription('Show current quota settings'))
  .addStringOption(o => o.setName('circle').setDescription('Which circle to configure (defaults to primary)'))
  .addStringOption(o => o
    .setName('scope')
    .setDescription('Quota period to set')
    .addChoices(
      { name: 'Daily',   value: 'daily'   },
      { name: 'Weekly',  value: 'weekly'  },
      { name: 'Monthly', value: 'monthly' },
    ))
  .addStringOption(o => o
    .setName('amount')
    .setDescription('Quota amount')
    .addChoices(
      { name: '1,000',     value: '1000'     },
      { name: '5,000',     value: '5000'     },
      { name: '10,000',    value: '10000'    },
      { name: '50,000',    value: '50000'    },
      { name: '100,000',   value: '100000'   },
      { name: '500,000',   value: '500000'   },
      { name: '1,000,000', value: '1000000'  },
      { name: 'Custom',    value: 'custom'   },
    ))
  .addIntegerOption(o => o.setName('custom_amount').setDescription('Custom quota amount (used when amount is Custom)').setMinValue(1));

const adminSync = new SlashCommandBuilder()
  .setName('admin_sync')
  .setDescription('Force an immediate data sync from Uma.moe, bypassing the hourly schedule')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

const adminSetJoinDate = new SlashCommandBuilder()
  .setName('admin_setjoindate')
  .setDescription('Manually override a member\'s circle join date')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addStringOption(o => o.setName('date').setDescription('New join date — YYYY-MM-DD').setRequired(true))
  .addUserOption(o => o.setName('member').setDescription('Discord member to update'))
  .addStringOption(o => o.setName('trainer').setDescription('Uma.moe trainer name'));

const testMilestone = new SlashCommandBuilder()
  .setName('test_milestone')
  .setDescription('Preview a milestone announcement image without posting it (ephemeral)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addStringOption(o => o
    .setName('milestone')
    .setDescription('Milestone type to preview')
    .setRequired(true)
    .addChoices(
      { name: '1M fans',   value: '1000000'    },
      { name: '5M fans',   value: '5000000'    },
      { name: '10M fans',  value: '10000000'   },
      { name: '50M fans',  value: '50000000'   },
      { name: '100M fans', value: '100000000'  },
    ))
  .addUserOption(o => o.setName('member').setDescription('Discord member to preview for'))
  .addStringOption(o => o.setName('trainer').setDescription('Uma.moe trainer name'));

const timelineSetup = new SlashCommandBuilder()
  .setName('timeline_setup')
  .setDescription('Configure the event timeline channel')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addStringOption(o => o.setName('channel_name').setDescription('Channel name or #channel-mention to post timelines in').setRequired(true));

const timelinePost = new SlashCommandBuilder()
  .setName('timeline_post')
  .setDescription('Manually trigger a timeline post to the configured timeline channel')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addStringOption(o => o.setName('date').setDescription('Date for the timeline — YYYY-MM-DD (defaults to today)'));

// ─── Admin Commands (Administrator) ───────────────────────────────────────────

const adminSyncCards = new SlashCommandBuilder()
  .setName('admin_synccards')
  .setDescription('Trigger a support card image sync from GameTora')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const warningSettings = new SlashCommandBuilder()
  .setName('warningsettings')
  .setDescription('View or update the warning engine configuration')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(sub => sub
    .setName('view')
    .setDescription('Show the current warning system settings'))
  .addSubcommand(sub => sub
    .setName('set')
    .setDescription('Update a single warning system setting')
    .addStringOption(o => o
      .setName('key')
      .setDescription('Which setting to update')
      .setRequired(true)
      .addChoices(
        { name: 'enabled',              value: 'enabled'              },
        { name: 'reminder_threshold',   value: 'reminder_threshold'   },
        { name: 'warning_threshold',    value: 'warning_threshold'    },
        { name: 'critical_threshold',   value: 'critical_threshold'   },
      ))
    .addStringOption(o => o.setName('value').setDescription('New value — true/false for toggles, a number for thresholds').setRequired(true)));

// ─── AI Commands ──────────────────────────────────────────────────────────────

const ask = new SlashCommandBuilder()
  .setName('ask')
  .setDescription('Ask the AI Knowledge Service a question about the repository or Umamusume game mechanics')
  .addStringOption(o => o
    .setName('question')
    .setDescription('Your question')
    .setRequired(true));

const ai = new SlashCommandBuilder()
  .setName('ai')
  .setDescription('Umakraft AI Knowledge Service')
  .addSubcommand(sub => sub
    .setName('explain')
    .setDescription('Get a structured explanation of a repository concept or game mechanic')
    .addStringOption(o => o
      .setName('topic')
      .setDescription('Topic or concept to explain')
      .setRequired(true)))
  .addSubcommand(sub => sub
    .setName('search')
    .setDescription('Similarity search across the Umakraft repository codebase')
    .addStringOption(o => o
      .setName('query')
      .setDescription('Search query')
      .setRequired(true)))
  .addSubcommand(sub => sub
    .setName('docs')
    .setDescription('Get a technical summary of a specific file or component')
    .addStringOption(o => o
      .setName('file')
      .setDescription('File path or component name (e.g. Refinery/Refiner/refiner.js)')
      .setRequired(true)))
  .addSubcommand(sub => sub
    .setName('glossary')
    .setDescription('Look up an Umamusume or Umakraft term in the knowledge base')
    .addStringOption(o => o
      .setName('term')
      .setDescription('Term to look up (e.g. MANT, Fan Deficit, Trend Tier)')
      .setRequired(true)))
  .addSubcommand(sub => sub
    .setName('message')
    .setDescription('Generate a community message (greeting, milestone, warning, etc.)')
    .addStringOption(o => o
      .setName('type')
      .setDescription('Message type')
      .setRequired(true)
      .addChoices(
        { name: 'Greeting',      value: 'greeting'      },
        { name: 'Milestone',     value: 'milestone'     },
        { name: 'Achievement',   value: 'achievement'   },
        { name: 'Leaderboard',   value: 'leaderboard'   },
        { name: 'Warning',       value: 'warning'       },
        { name: 'Reminder',      value: 'reminder'      },
        { name: 'Documentation', value: 'documentation' },
      ))
    .addStringOption(o => o
      .setName('trainer_name')
      .setDescription('Trainer name — required for milestone, achievement, and warning messages'))
    .addIntegerOption(o => o
      .setName('milestone_value')
      .setDescription('Fan count milestone (e.g. 1000000) — required for milestone messages')
      .setMinValue(1))
    .addStringOption(o => o
      .setName('achievement_name')
      .setDescription('Achievement name — required for achievement messages'))
    .addStringOption(o => o
      .setName('event_name')
      .setDescription('Event name — required for reminder messages'))
    .addStringOption(o => o
      .setName('event_date')
      .setDescription('Event date — YYYY-MM-DD, used for reminder messages')))
  .addSubcommand(sub => sub
    .setName('live')
    .setDescription('Search live uma.moe data and current rankings via web')
    .addStringOption(o => o
      .setName('query')
      .setDescription('Your question about current live data')
      .setRequired(true)));

// ─── Command Array ─────────────────────────────────────────────────────────────

const commands = [
  fanGain, profile, leaderboard, totalFan, totalCircleFanGain, circleMaster,
  interCircleLeaderboard, clubGain, joinDate, memberList, searchTrainer, store,
  keep, setTimezone, status, circleStatus, help,
  link, unlink, linkList, setFans, adminSync, adminSetJoinDate,
  testMilestone, timelineSetup, timelinePost, adminSyncCards, warningSettings,
  ask, ai,
].map(c => c.toJSON());

// ─── Deploy ────────────────────────────────────────────────────────────────────

const { DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID } = process.env;

if (!DISCORD_TOKEN)     throw new Error('Missing DISCORD_TOKEN secret');
if (!DISCORD_CLIENT_ID) throw new Error('Missing DISCORD_CLIENT_ID secret');
if (!global && !DISCORD_GUILD_ID) throw new Error('Missing DISCORD_GUILD_ID secret (or pass --global)');

const rest = new REST().setToken(DISCORD_TOKEN);

const route = global
  ? Routes.applicationCommands(DISCORD_CLIENT_ID)
  : Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID);

const mode = global ? 'global' : `guild ${DISCORD_GUILD_ID}`;
console.log(`Registering ${commands.length} slash commands (${mode})...`);

const data = await rest.put(route, { body: commands });
console.log(`Successfully registered ${data.length} commands (${mode}).`);
