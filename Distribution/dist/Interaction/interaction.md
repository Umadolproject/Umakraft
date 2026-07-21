# Interaction

Purpose
- Describe how the bot's interaction layer maps user commands to Workshop blueprints and the umamoe pipeline.

Flow
- User issues slash command or text command
- Interaction layer normalizes input and maps the command to a blueprint via Workshop/Draftsman/Blueprint/command-blueprints.json
- Interaction invokes the appropriate handler which uses umamoe modules (fetchTrainerProfile, callMiner) and renderer or refinery as needed

Notes
- Keep interaction handlers thin: validation, blueprint selection, and orchestration. Business logic belongs in the pipeline/Refinery or in dedicated modules.
- See Workshop/Draftsman/Blueprint for command templates.
