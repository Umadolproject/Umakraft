// Distribution/Commands/handlers/link.js
import { PermissionFlagsBits } from 'discord.js';

export const name     = 'link';
export const defer    = true;
export const ephemeral = true;

export async function execute(interaction, coordinator) {
  // Permission check — must have Manage Guild
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({
      content:   'You need the **Manage Guild** permission to link members.',
      ephemeral: true,
    });
  }

  // `trainer` may be a free-text name OR the trainer ID resolved by autocomplete.
  // When selected from the autocomplete list the value is always the numeric trainer ID.
  const trainerRaw = interaction.options.getString('trainer')    ?? null;
  const trainerId  = interaction.options.getString('trainer_id') ?? null;

  if (!trainerRaw && !trainerId) {
    return interaction.reply({
      content:   'Please provide a trainer name (use the autocomplete suggestions) or a `trainer_id`.',
      ephemeral: true,
    });
  }

  // Detect whether the trainer field holds an ID (selected from autocomplete)
  // or a plain name typed manually.
  const trainerIsId = trainerRaw != null && /^\d+$/.test(trainerRaw.trim());

  return coordinator.link({
    commandName: name,
    interaction,
    options: {
      trainer:          trainerIsId ? null : trainerRaw,  // plain text name, if any
      trainerId:        trainerId ?? (trainerIsId ? trainerRaw.trim() : null),
      member:           interaction.options.getMember('member') ?? null,
      circle:           interaction.options.getString('circle')  ?? null,
    },
    guildId:   interaction.guildId,
    userId:    interaction.user.id,
    channelId: interaction.channelId,
  });
}
