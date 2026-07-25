// Distribution/Commands/handlers/profile.js
// /profile — full profile dashboard (gains, PRs, milestones, monthly history).
//
// Handler-only responsibilities (per Slash Command Isolated Fix Plan):
//   1. Read every registered option with the correct getter.
//   2. Reject option combinations the coordinator cannot disambiguate.
//   3. Pass a complete, self-describing payload to `coordinator.profile`.
//   4. Never modify coordinator, dispatcher, or event code.
//
// Registered schema (deploy-commands.js):
//   .setName('profile')
//   .addUserOption('member')     — optional; defaults to the invoker
//   .addStringOption('trainer')  — optional; autocomplete
//   .addStringOption('circle')   — optional; autocomplete, defaults to primary
export const name = 'profile';
export const defer = true;
export const ephemeral = false;

// Discord option string hard cap; mirror it defensively so a pathological
// autocomplete payload cannot push oversized text into the pipeline.
const MAX_STRING_OPTION = 100;

export async function execute(interaction, coordinator) {
  // Option `member` is registered as USER. `getMember` returns the cached
  // GuildMember (nullable if uncached); `getUser` always resolves when the
  // option was supplied. Read both so the coordinator can pick whichever
  // it needs without a second Discord round-trip.
  const memberOpt = interaction.options.getMember('member');
  const userOpt   = interaction.options.getUser('member');

  const trainer = interaction.options.getString('trainer')?.trim() || null;
  const circle  = interaction.options.getString('circle')?.trim()  || null;

  // Mutual exclusivity: `member` and `trainer` are two distinct lookup
  // keys. Silently preferring one hides bugs; refuse the ambiguous call.
  if ((memberOpt || userOpt) && trainer) {
    return interaction.reply({
      content:  'Please provide either `member` or `trainer`, not both.',
      ephemeral: true,
    });
  }

  if (trainer && trainer.length > MAX_STRING_OPTION) {
    return interaction.reply({
      content:  `Trainer name is too long (max ${MAX_STRING_OPTION} characters).`,
      ephemeral: true,
    });
  }
  if (circle && circle.length > MAX_STRING_OPTION) {
    return interaction.reply({
      content:  `Circle name is too long (max ${MAX_STRING_OPTION} characters).`,
      ephemeral: true,
    });
  }

  // Explicit target user id: if a `member` option was supplied, that user
  // is the lookup target; otherwise the invoker is looking up themselves.
  // Kept alongside the existing `userId` (invoker) so the coordinator can
  // continue to fall back to the invoker exactly like `fanGain` does.
  const targetUserId = userOpt?.id ?? interaction.user.id;
  const isSelfLookup = !memberOpt && !userOpt && !trainer;

  return coordinator.profile({
    commandName: name,
    interaction,
    options: {
      member:       memberOpt ?? null,
      user:         userOpt   ?? null,
      targetUserId,
      trainer,
      circle,
      self:         isSelfLookup,
    },
    guildId:   interaction.guildId,
    userId:    interaction.user.id,     // invoker — coordinator fallback key
    channelId: interaction.channelId,
  });
}
