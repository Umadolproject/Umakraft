// Distribution/Discord/events/guildMemberAdd.js
// Fires when a new member joins a guild.
// Forwards to the Commands greeting handler so the pipeline can render a
// personalised welcome image via Workshop (using the 'greeting' blueprint).

export const name = 'guildMemberAdd';
export const once = false;

export async function execute(member, client) {
  console.log(`[guildMemberAdd] ${member.user.tag} joined ${member.guild.name}`);

  // TODO: Wire to the greeting pipeline action (Commands → Coordinator → Workshop/greeting blueprint).
  // The greeting blueprint is registered in Workshop/Draftsman/Blueprint/blueprint.js.
}
