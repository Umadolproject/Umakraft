// Distribution/Discord/events/ready.js
// Fires once when the bot connects to the Discord gateway and is ready.
// Logs connection info and registers any startup tasks (e.g. cron triggers).

export const name = 'ready';
export const once = true;

export async function execute(client) {
  console.log(`[ready] Logged in as ${client.user.tag} (${client.user.id})`);
  console.log(`[ready] Serving ${client.guilds.cache.size} guild(s)`);

  // TODO: Register Broadcast cron triggers here (warning engine, milestone checks).
  // These are owned by Broadcast — they are started from this event handler
  // but implemented in Broadcast/Broker/.
}
