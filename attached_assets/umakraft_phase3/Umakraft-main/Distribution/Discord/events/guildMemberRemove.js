// Distribution/Discord/events/guildMemberRemove.js
// Fires when a member leaves or is removed from a guild.
// Currently logs the departure; future: archive member data, clean up links.

export const name = 'guildMemberRemove';
export const once = false;

export async function execute(member, client) {
  console.log(`[guildMemberRemove] ${member.user.tag} left ${member.guild.name}`);

  // TODO: Mark the member's link record as inactive (soft-delete, not hard-delete).
  // Requires the database layer to be built.
}
