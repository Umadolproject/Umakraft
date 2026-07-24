// Distribution/test/interaction.test.js
// Regression coverage for the Discord interaction boundary.
//
// Every slash command must be acknowledged before handler code runs. This is
// intentionally tested with small interaction doubles so it does not require
// a Discord token or a live gateway connection.

import { execute } from '../Discord/events/interactionCreate.js';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

function makeInteraction(commandName) {
  const calls = [];
  const interaction = {
    id: `test-${commandName}`,
    commandName,
    deferred: false,
    replied: false,
    user: { tag: 'test-user', id: 'test-user-id' },
    isAutocomplete: () => false,
    isChatInputCommand: () => true,
    deferReply: async payload => {
      calls.push({ method: 'deferReply', payload });
      interaction.deferred = true;
    },
    reply: async payload => {
      calls.push({ method: 'reply', payload });
      interaction.replied = true;
    },
    editReply: async payload => {
      calls.push({ method: 'editReply', payload });
      return payload;
    },
  };
  return { interaction, calls };
}

function clientWith(commandName, handler) {
  return { commands: new Map([[commandName, handler]]) };
}

console.log('\n[Distribution] Interaction boundary tests\n');

console.log('1. Deferred envelope response');
{
  const { interaction, calls } = makeInteraction('profile');
  await execute(interaction, clientWith('profile', {
    name: 'profile',
    defer: false,
    ephemeral: false,
    execute: async currentInteraction => ({
      success: true,
      content: 'profile result',
      interaction: currentInteraction,
    }),
  }));

  assert(calls[0]?.method === 'deferReply', 'boundary acknowledges before handler execution');
  assert(calls[1]?.method === 'editReply', 'dispatcher edits the deferred reply');
  assert(calls[1]?.payload.content === 'profile result', 'response content reaches Discord');
}

console.log('\n2. Legacy inline handler response');
{
  const { interaction, calls } = makeInteraction('admin_sync');
  await execute(interaction, clientWith('admin_sync', {
    name: 'admin_sync',
    defer: false,
    ephemeral: true,
    execute: async currentInteraction => currentInteraction.reply({
      content: 'permission denied',
      ephemeral: true,
    }),
  }));

  assert(calls[0]?.method === 'deferReply', 'legacy handler cannot skip acknowledgement');
  assert(calls[0]?.payload.ephemeral === true, 'handler visibility metadata is preserved');
  assert(calls[1]?.method === 'editReply', 'legacy reply is converted to an edit');
  assert(calls[1]?.payload.ephemeral === undefined, 'ephemeral is not resent after defer');
}

console.log('\n3. Unknown command response');
{
  const { interaction, calls } = makeInteraction('removed_command');
  await execute(interaction, { commands: new Map() });

  assert(calls[0]?.method === 'deferReply', 'unknown commands are acknowledged centrally');
  assert(calls[1]?.method === 'editReply', 'unknown command message edits the deferred reply');
  assert(calls[1]?.payload.content.includes('not available'), 'unknown command message is user-facing');
}

console.log(`\n[Distribution] Results: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);