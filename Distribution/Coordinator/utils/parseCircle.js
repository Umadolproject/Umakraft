// Distribution/Coordinator/utils/parseCircle.js
// Parses a circle option value into a clean circle ID string.
//
// Accepts any of:
//   - Plain numeric ID:              "974470619"
//   - Full URL:  "https://uma.moe/circles/974470619"
//   - Partial URL: "uma.moe/circles/974470619"
//
// Returns the numeric ID string, or the raw input if no URL pattern is found.
// Returns null for null/undefined/empty input.

const CIRCLE_URL_RE = /uma\.moe\/circles\/(\d+)/i;

/**
 * @param {string|null|undefined} input
 * @returns {string|null}
 */
export function parseCircleId(input) {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;
  const urlMatch = s.match(CIRCLE_URL_RE);
  if (urlMatch) return urlMatch[1];
  return s; // numeric ID or any other value — pass through unchanged
}
