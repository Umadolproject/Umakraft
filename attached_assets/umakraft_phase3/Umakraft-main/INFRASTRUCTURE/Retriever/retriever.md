# Retriever

Purpose
- Describe components responsible for acquiring supplemental resources (historical data, past-history files, external scrapers).

Responsibilities
- Archive raw responses used for backfills (profileBackfill.js)
- Normalize legacy formats into the canonical Data Format (umamoe/DATA_FORMAT.md)
- Expose helpers for the Refinery to read archived snapshots

Implementation notes
- Use umaQueue to space heavy scraping jobs
- Store archival copies separately from Vault (use a distinct adapter or prefix)
