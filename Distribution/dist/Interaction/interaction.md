# Interaction

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Version:** v2.0.0
**Stage:** 4 — Distribution (Coordinate User-Facing Application Flow)
**Last Updated:** 2026-07-21

---

## Purpose

Describe how the bot's interaction layer maps Discord slash commands to Workshop blueprints and the Umamoe pipeline. The interaction layer is the entry point of the Distribution stage for all user-triggered commands.

---

## Must Not

Interaction handlers must **never**:

* Contain business logic — computation belongs in Refinery or dedicated modules
* Fetch directly from uma.moe API — all data acquisition goes through Umamoe (Miner → Vault)
* Render cards or build embeds — rendering belongs in Workshop/Fabricator
* Call Broadcast or trigger automated notifications
* Store data — persistence belongs in Vault or Depot

---

## Flow

```text
User issues slash command or text command
        │
        ▼
Discord interaction event (interactionCreate)
        │
        ▼
handlers/interactionCreate.js
  └─ normalize input
  └─ map command → Blueprint via Workshop/Draftsman/Blueprint/
        │
        ▼
commands/<command>.js handler
  └─ thin orchestration only:
     1. validate input
     2. call Umamoe module (fetchTrainerProfile, callMiner)
     3. optionally call Refinery for computed values
     4. pass data to Workshop/Fabricator or renderer
     5. return Discord reply
```

---

## Handler Pattern

```js
// commands/fan_gain.js

export async function execute(interaction) {
  await interaction.deferReply();

  // 1. Validate input
  const trainerId = interaction.options.getString('trainer_id', true);

  // 2. Fetch from Umamoe (not directly from API)
  const profile = await fetchTrainerProfile(trainerId);
  if (!profile.success) {
    return interaction.editReply({ content: 'Trainer not found.' });
  }

  // 3. Retrieve compiled product from Depot
  const product = await depot.get(trainerId);

  // 4. Delegate rendering to Workshop/Fabricator
  const blueprint = await draftsman.getBlueprint('fanGainCard');
  const deliverable = await fabricator.render(blueprint, product);

  // 5. Reply
  return interaction.editReply({
    embeds: [deliverable.embed],
    files: [deliverable.attachment]
  });
}
```

---

## Command → Blueprint Mapping

Command handlers reference `Workshop/Draftsman/Blueprint/` for layout and presentation specs. The handler selects the correct blueprint for its output type and passes it to Fabricator.

```js
// Workshop/Draftsman/Blueprint/command-blueprints.json
{
  "fanGainCard": "blueprints/fan-gain-card.json",
  "profileCard": "blueprints/profile-card.json",
  "leaderboard": "blueprints/leaderboard.json"
}
```

---

## Design Principle

Keep interaction handlers **thin**: validation, blueprint selection, and orchestration only. Business logic belongs in Refinery. Rendering belongs in Workshop/Fabricator.

---

## See Also

- `Workshop/Draftsman/Draftsman.md` — Blueprint specs
- `Workshop/Fabricator/Fabricator.md` — Rendering
- `umamoe/Miner/Miner.md` — Data acquisition
- `Distribution/dist/Contracts/contract.md` — Envelope schemas
