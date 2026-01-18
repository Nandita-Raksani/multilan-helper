// External type definitions for the current API format
// These types represent the structure of data coming from the backend API
// and are isolated from internal plugin types

import { MultilanStatus } from "../../shared/types";

/**
 * Language text entry from the current API format
 */
export interface CurrentApiMultilanText {
  languageId: string;
  wording: string;
  id: number;
  sourceLanguageId?: string;
}

/**
 * Full translation entry from the current API format
 */
export interface CurrentApiMultilan {
  id: number;
  multilanTextList: CurrentApiMultilanText[];
  status?: MultilanStatus;
  createdAt?: string;
  modifiedAt?: string;
  modifiedBy?: string;
}

/**
 * Type guard to check if data is in the current API format
 */
export function isCurrentApiFormat(data: unknown): data is CurrentApiMultilan[] {
  if (!Array.isArray(data)) {
    return false;
  }
  if (data.length === 0) {
    return true; // Empty array is valid
  }
  // Check first item has required structure
  const firstItem = data[0];
  return (
    typeof firstItem === "object" &&
    firstItem !== null &&
    "id" in firstItem &&
    typeof firstItem.id === "number" &&
    "multilanTextList" in firstItem &&
    Array.isArray(firstItem.multilanTextList)
  );
}

/**
 * Type guard to validate a single API entry
 */
export function isValidCurrentApiEntry(entry: unknown): entry is CurrentApiMultilan {
  if (typeof entry !== "object" || entry === null) {
    return false;
  }
  const obj = entry as Record<string, unknown>;
  return (
    typeof obj.id === "number" &&
    Array.isArray(obj.multilanTextList) &&
    obj.multilanTextList.every(isValidMultilanText)
  );
}

/**
 * Type guard to validate a multilanText entry
 */
function isValidMultilanText(text: unknown): text is CurrentApiMultilanText {
  if (typeof text !== "object" || text === null) {
    return false;
  }
  const obj = text as Record<string, unknown>;
  return (
    typeof obj.languageId === "string" &&
    typeof obj.wording === "string" &&
    typeof obj.id === "number"
  );
}
