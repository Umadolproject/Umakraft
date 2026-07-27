// Distribution/Coordinator/actions/help.js
// Renders the help embed — uses Fabricator when available, falls back to text.

import { produce, claimDeliverable } from '../../../Workshop/pipeline.js';

const PUPPETEER_DISABLED = process.env.PUPPETEER_DISABLED === 'true';

const HELP_COMMAND_LIST = [
  { name: '📊 Fan & Stats', commands: ['/fan_gain', '/profile', '/leaderboard', '/total_fan', '/total_circlefan_gain', '/circle_master', '/intercircleleaderboard', '/club_gain'] },
  { name: '🔗 Accounts',   commands: ['/link', '/unlink', '/link_list', '/store', '/keep', '/joindate'] },
  { name: '🔍 Search',     commands: ['/search_trainer', '/memberlist'] },
  { name: '⚙️ Settings',   commands: ['/set_timezone', '/set_fans', '/warningsettings'] },
  { name: '🛠️ Admin',       commands: ['/admin_sync', '/admin_synccards', '/admin_setjoindate', '/timeline_setup', '/timeline_post', '/test_milestone'] },
  { name: '🤖 AI',          commands: ['/ask', '/ai', '/admin-greet'] },
  { name: '📋 Info',       commands: ['/status', '/circle_status', '/help'] },
];

function buildHelpEmbed(interaction) {
  const fields = HELP_COMMAND_LIST.map(cat => ({
    name: cat.name,
    value: cat.commands.map(c => `\`${c}\``).join('  '),
    inline: false,
  }));

  return {
    success:   true,
    type:      'embed',
    ephemeral: false,
    result: {
      title:       '📖 UmaKraft Commands',
      description: 'All available slash commands:',
      fields,
      footer:      { text: 'UmaKraft Bot · Use /<command> to get started' },
      timestamp:   new Date().toISOString(),
    },
    interaction,
  };
}

export async function help(payload) {
  const { interaction } = payload;

  // Text-only mode — skip Puppeteer entirely.
  if (PUPPETEER_DISABLED) return buildHelpEmbed(interaction);

  const fabricatorInput = {
    blueprintKey: 'help',
    meta: {
      generatedAt: new Date().toISOString(),
    },
  };

  const produced = await produce(fabricatorInput);
  if (!produced.success) {
    // Fabricator failed — fall back to text embed.
    console.warn(
      `[help] Fabricator failed — falling back to text embed. Error: ${produced.message}`
    );
    return buildHelpEmbed(interaction);
  }

  const claimed = await claimDeliverable(produced.terminalId);
  if (!claimed.success) {
    console.warn(
      `[help] Terminal claim failed — falling back to text embed. Error: ${claimed.message}`
    );
    return buildHelpEmbed(interaction);
  }

  return {
    success:      true,
    terminalId:   produced.terminalId,
    blueprintKey: 'help',
    png:          claimed.deliverable.png,
    meta:         claimed.deliverable.meta,
    interaction,
  };
}
