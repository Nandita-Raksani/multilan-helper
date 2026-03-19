// Decompression utility for compressed .tra bundle data.
// Uses fflate (inflateSync) which adds ~3KB to the plugin bundle.

import { inflateSync } from 'fflate';

/**
 * Decode a base64 string to Uint8Array.
 * Works in Figma's plugin sandbox (has atob).
 */
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decompress a base64-encoded deflate-raw string back to UTF-8 text.
 */
export function decompressBase64(b64: string): string {
  if (!b64) return '';
  const compressed = base64ToBytes(b64);
  const decompressed = inflateSync(compressed);
  // Decode UTF-8 bytes to string
  const decoder = new TextDecoder();
  return decoder.decode(decompressed);
}
