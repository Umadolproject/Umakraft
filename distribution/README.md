Distribution directory

Purpose:
- Assemble a minimized distributable of the Uma.moe ingestion pipeline and related artifacts.

Contents:
- manifest.json — list of files to include in the dist bundle (repo-relative)
- build_dist.js — Node script that reads manifest.json and copies files into ./dist preserving paths

Usage:
- node distribution/build_dist.js
- The script creates ./distribution/dist containing the selected files and a minimal package.json.

Notes:
- The build script is intentionally simple for local packaging and CI usage. Adjust manifest.json to change included files.
- For production packaging, replace the file-copy adapter with your preferred bundler or packager.
