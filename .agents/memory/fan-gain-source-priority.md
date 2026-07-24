---
name: Fan gain source priority
description: Durable rule for preserving authoritative uma.moe fan-gain values through the image pipeline
---

The `/fan_gain` path treats a matched circle-member API value as authoritative. Historical snapshot deltas are the second fallback, and rank-based estimates are the last fallback.

**Why:** The trainer profile can omit gain fields even when the circle response includes the real per-member values; estimating first produces inaccurate reports.

**How to apply:** Keep circle enrichment in the Umamoe pipeline wire, normalize the member data before Inspector/Vault, and keep the Refiner responsible only for source priority and fallback selection. Preserve the fan-gain renderer’s rank under its metadata contract.