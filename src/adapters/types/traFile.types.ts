// Types for .tra file format
// Format: multilanId,"text","ignored"

export interface TraFileData {
  en: string;
  fr: string;
  nl: string;
  de: string;
}

/**
 * Parse a single line from a .tra file
 * Format: id,"text","ignored"
 */
export function parseTraLine(line: string): { id: string; text: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Match: id,"text",anything or id,"text"
  // Handle escaped quotes within the text
  const match = trimmed.match(/^(\d+),"((?:[^"\\]|\\.|"")*)"/);
  if (!match) {
    // Try without quotes for simple values
    const simpleMatch = trimmed.match(/^(\d+),([^,]*)/);
    if (simpleMatch) {
      return { id: simpleMatch[1], text: simpleMatch[2] };
    }
    return null;
  }

  // Unescape double quotes
  const text = match[2].replace(/""/g, '"');
  return { id: match[1], text };
}

/**
 * Parse a complete .tra file content
 * Returns a map of multilanId -> text
 */
export function parseTraFile(content: string): Map<string, string> {
  const result = new Map<string, string>();
  const lines = content.split('\n');

  for (const line of lines) {
    const parsed = parseTraLine(line);
    if (parsed) {
      result.set(parsed.id, parsed.text);
    }
  }

  return result;
}

/**
 * Check if the data looks like .tra file data (object with en, fr, nl, de string properties)
 */
export function isTraFileData(data: unknown): data is TraFileData {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.en === 'string' &&
    typeof obj.fr === 'string' &&
    typeof obj.nl === 'string' &&
    typeof obj.de === 'string'
  );
}
