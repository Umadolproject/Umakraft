---
name: Chrome/Puppeteer on Replit NixOS
description: How to get Puppeteer working on Replit — bundled Chrome fails due to missing libgbm; use Nix chromium instead.
---

## Rule
Do NOT use Puppeteer's bundled Chrome on Replit NixOS. Install `chromium` via `installSystemDependencies` and set `executablePath` in `puppeteer.launch()` to the Nix binary path.

**Why:** Puppeteer's bundled Chrome (linux-127.x) links against `libgbm.so.1` (Mesa GBM), which is not exported to the dynamic linker path by any Nix package. `installSystemDependencies(["mesa"])` installs it but doesn't add it to `LD_LIBRARY_PATH`, so Chrome still fails to start. The Nix-wrapped `chromium` package is fully self-contained and resolves all its own deps.

**How to apply:**
1. `installSystemDependencies({ packages: ["chromium"] })`
2. Find the binary: `which chromium` → `/nix/store/<hash>-chromium-<version>/bin/chromium`
3. In fabricator / puppeteer launch code, hardcode that path as `executablePath` (with an `existsSync` guard so it falls back gracefully if the hash changes after a Nix update).
4. Keep `--no-sandbox`, `--disable-setuid-sandbox`, `--disable-dev-shm-usage`, `--disable-gpu` in args.

**Current binary (as of 2026-07-23):**
`/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium`

Note: the Nix store hash will change if chromium is upgraded. The `existsSync` guard in `CHROMIUM_CANDIDATES` falls back to `PUPPETEER_EXECUTABLE_PATH` env var, then to undefined (Puppeteer default).
