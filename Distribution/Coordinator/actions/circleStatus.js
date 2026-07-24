// Distribution/Coordinator/actions/circleStatus.js
// Returns live sync status for all circles configured in this guild.

import { getConfiguredCircles } from '../../../Broadcast/Broker/broker.js';
import { retrieve }             from '../../../Refinery/Depot/depot.js';

export async function circleStatus(payload) {
  const { interaction } = payload;
  const circles = getConfiguredCircles();

  if (circles.length === 0) {
    return {
      success:  true,
      type:     'embed',
      ephemeral: true,
      result: {
        title:       '📡 Circle Status',
        description: 'No circles are configured. Set the `CONFIGURED_CIRCLES` environment variable to register circle IDs.',
      },
      interaction,
    };
  }

  const fields = await Promise.all(circles.map(async (circleId) => {
    const { product } = await retrieve(circleId);
    let value;
    if (product) {
      const ts = product.storedAt ?? product.provenance?.refinedAt ?? null;
      value = ts
        ? `✅ Last sync: \`${ts.slice(0, 16).replace('T', ' ')} UTC\``
        : '✅ Data present (timestamp unavailable)';
    } else {
      value = '⏳ No data yet — run `/admin_sync` or wait for the scheduled miner cycle';
    }
    return { name: `Circle \`${circleId}\``, value, inline: false };
  }));

  return {
    success:  true,
    type:     'embed',
    ephemeral: true,
    result: {
      title:       '📡 Circle Status',
      description: `Showing status for **${circles.length}** configured circle${circles.length !== 1 ? 's' : ''}.`,
      fields,
    },
    interaction,
  };
}
