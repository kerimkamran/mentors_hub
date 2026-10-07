import { LOGO_MAX_BYTES } from "../../lib/constants-programmes";

export type LogoType = "image/png" | "image/jpeg" | "image/webp";
export type LogoCheck = { ok: true; contentType: LogoType } | { ok: false; code: "empty" | "too_large" | "not_an_image" };

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((x, i) => b[at + i] === x);

/**
 * Validates a logo BY CONTENT, never by file name or declared type (AC-TEN-05.5): PNG, JPEG or WebP raster images only.
 * SVG is refused on purpose (it can carry script). The structure checks below reject a renamed or truncated file.
 */
export function checkLogo(bytes: Uint8Array): LogoCheck {
  if (bytes.length === 0) return { ok: false, code: "empty" };
  if (bytes.length > LOGO_MAX_BYTES) return { ok: false, code: "too_large" };
  // PNG: signature, first chunk IHDR (13 bytes) and a closing IEND chunk.
  if (startsWith(bytes, PNG)) {
    const ihdr = String.fromCharCode(...bytes.slice(12, 16)) === "IHDR" && bytes.length > 33;
    const tail = String.fromCharCode(...bytes.slice(bytes.length - 8, bytes.length - 4)) === "IEND";
    return ihdr && tail ? { ok: true, contentType: "image/png" } : { ok: false, code: "not_an_image" };
  }
  // JPEG: SOI marker FFD8FF and EOI marker FFD9.
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9 ? { ok: true, contentType: "image/jpeg" } : { ok: false, code: "not_an_image" };
  }
  // WebP: RIFF <size> WEBP, and the declared RIFF size must match the file.
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8) && bytes.length >= 20) {
    const size = bytes[4]! | (bytes[5]! << 8) | (bytes[6]! << 16) | (bytes[7]! << 24);
    return size + 8 === bytes.length ? { ok: true, contentType: "image/webp" } : { ok: false, code: "not_an_image" };
  }
  return { ok: false, code: "not_an_image" };
}
