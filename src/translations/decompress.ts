// Decompression utility for compressed .tra bundle data.
// Uses fflate (inflateSync) which adds ~3KB to the plugin bundle.
// All helpers are pure JS — no dependency on atob or TextDecoder
// which may not be available in Figma's plugin sandbox.

import { inflateSync } from 'fflate';

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP = new Uint8Array(128);
for (let i = 0; i < B64_CHARS.length; i++) {
  B64_LOOKUP[B64_CHARS.charCodeAt(i)] = i;
}

/**
 * Decode a base64 string to Uint8Array (pure JS, no atob needed).
 */
function base64ToBytes(b64: string): Uint8Array {
  // Strip padding
  let len = b64.length;
  while (len > 0 && b64[len - 1] === '=') len--;

  const out = new Uint8Array((len * 3) >>> 2);
  let j = 0;
  for (let i = 0; i < len; i += 4) {
    const a = B64_LOOKUP[b64.charCodeAt(i)];
    const b = B64_LOOKUP[b64.charCodeAt(i + 1)];
    const c = B64_LOOKUP[b64.charCodeAt(i + 2)];
    const d = B64_LOOKUP[b64.charCodeAt(i + 3)];
    out[j++] = (a << 2) | (b >> 4);
    if (i + 2 < len) out[j++] = ((b & 0xF) << 4) | (c >> 2);
    if (i + 3 < len) out[j++] = ((c & 0x3) << 6) | d;
  }
  return out;
}

/**
 * Decode a UTF-8 Uint8Array to a string (pure JS, no TextDecoder needed).
 */
function utf8Decode(bytes: Uint8Array): string {
  let result = '';
  let i = 0;
  while (i < bytes.length) {
    const byte = bytes[i];
    if (byte < 0x80) {
      result += String.fromCharCode(byte);
      i++;
    } else if ((byte & 0xE0) === 0xC0) {
      result += String.fromCharCode(((byte & 0x1F) << 6) | (bytes[i + 1] & 0x3F));
      i += 2;
    } else if ((byte & 0xF0) === 0xE0) {
      result += String.fromCharCode(
        ((byte & 0x0F) << 12) | ((bytes[i + 1] & 0x3F) << 6) | (bytes[i + 2] & 0x3F)
      );
      i += 3;
    } else if ((byte & 0xF8) === 0xF0) {
      const cp = ((byte & 0x07) << 18) | ((bytes[i + 1] & 0x3F) << 12) |
                 ((bytes[i + 2] & 0x3F) << 6) | (bytes[i + 3] & 0x3F);
      // Encode as surrogate pair
      result += String.fromCharCode(0xD800 + ((cp - 0x10000) >> 10), 0xDC00 + ((cp - 0x10000) & 0x3FF));
      i += 4;
    } else {
      i++; // skip invalid byte
    }
  }
  return result;
}

/**
 * Decompress a base64-encoded deflate-raw string back to UTF-8 text.
 */
export function decompressBase64(b64: string): string {
  if (!b64) return '';
  const compressed = base64ToBytes(b64);
  const decompressed = inflateSync(compressed);
  return utf8Decode(decompressed);
}
