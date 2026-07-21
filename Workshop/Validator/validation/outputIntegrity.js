/**
 * Validator — Validation Category 4: Output Integrity
 *
 * Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
 * Department: Validator — Stage 3, Workshop
 *
 * Confirms the PNG buffer is a valid, non-empty Buffer with a correct
 * PNG file signature.
 */

// PNG magic bytes: \x89PNG\r\n\x1a\n
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const MIN_PNG_BYTES = 1024;

/**
 * @param {object} deliverable
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validateOutputIntegrity(deliverable) {
  const { png } = deliverable;

  if (!Buffer.isBuffer(png)) {
    return { ok: false, reason: `png is not a Buffer, got ${typeof png}` };
  }

  if (png.length === 0) {
    return { ok: false, reason: 'png buffer is empty' };
  }

  if (png.length < MIN_PNG_BYTES) {
    return { ok: false, reason: `png buffer is suspiciously small (${png.length} bytes, minimum is ${MIN_PNG_BYTES})` };
  }

  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (png[i] !== PNG_SIGNATURE[i]) {
      return { ok: false, reason: 'png buffer does not have a valid PNG header' };
    }
  }

  return { ok: true };
}
