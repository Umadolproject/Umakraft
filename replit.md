# UmaKraft Pipeline Architecture

A documentation repository for the **UmaKraft** Uma Musume circle bot pipeline architecture.

## About This Repository

This repository contains the architectural documentation, department specifications, and design decisions for the UmaKraft pipeline system. It is a pure documentation project — no runnable code is present.

## Documentation Structure

Start here:

- `GOVERNANCE/ARCHITECTURE_AUTHORITY.md` — constitutional rules for the entire pipeline
- `GOVERNANCE/PIPELINE_REGISTRY.md` — registry of all departments
- `docs/PIPELINE_DESIGN.md` — full 5-stage pipeline design
- `docs/RoleArchitecture.md` — directory roles and boundary rules
- `docs/KNOWLEDGE_BASE.md` — comprehensive project knowledge base

## Pipeline Overview

The UmaKraft pipeline has 5 stages:

1. **Umamoe** — Extract raw data from uma.moe API (Miner → Courier → Inspector → Vault)
2. **Refinery** — Transform and compile data (Refiner → Compiler → Depot)
3. **Workshop** — Manufacture deliverables (Draftsman → Fabricator → Validator → Terminal)
4. **Distribution** — Route command responses to Discord
5. **Broadcast** — Deliver notifications to Discord (Broker → Inspector → Archive → Announcer)

## User preferences
