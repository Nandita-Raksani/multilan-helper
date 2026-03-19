// Translation service - handles all translation-related operations
// Note: buildTranslationMap and buildMetadataMap have been moved to adapters layer

import {
  TranslationMap,
  TranslationEntry,
  SearchResult,
  Language,
  SUPPORTED_LANGUAGES,
  MetadataMap,
  MultilanMetadata,
  MatchDetectionResult,
} from "../../shared/types";

/**
 * Get metadata for a multilanId
 */
export function getMetadata(
  metadataMap: MetadataMap,
  multilanId: string
): MultilanMetadata | null {
  return metadataMap[multilanId] || null;
}

/**
 * Get translation for a specific multilanId and language
 */
export function getTranslation(
  translationData: TranslationMap,
  multilanId: string,
  lang: Language
): string | null {
  const entry = translationData[multilanId];
  if (!entry) return null;
  return entry[lang] || null;
}

/**
 * Get all translations for a multilanId
 */
export function getAllTranslations(
  translationData: TranslationMap,
  multilanId: string
): TranslationEntry | null {
  return translationData[multilanId] || null;
}

/**
 * Check if a language is supported
 */
export function isLanguage(lang: string | undefined): lang is Language {
  return lang !== undefined && SUPPORTED_LANGUAGES.includes(lang as Language);
}

/**
 * Replace placeholders in text with values
 */
export function replacePlaceholders(
  text: string,
  placeholders: Record<string, string>
): string {
  return text.replace(/\{(\w+)\}/g, (match, key) => {
    return placeholders[key] || match;
  });
}

/**
 * Extract ###variable### values from text by matching against a template.
 * E.g., template "Hello, ###name###!" + text "Hello, John!" → { name: "John" }
 */
export function extractVariableValues(
  template: string,
  text: string
): Record<string, string> | null {
  const varPattern = /###([^#]+)###/g;
  const variables: string[] = [];
  let match;
  while ((match = varPattern.exec(template)) !== null) {
    variables.push(match[1]);
  }
  if (variables.length === 0) return null;

  // Split template by variable patterns into alternating [literal, varName, literal, ...]
  const parts = template.split(/###[^#]+###/);

  // Build regex: escape literals, insert capture groups between them
  let regexStr = '';
  for (let i = 0; i < parts.length; i++) {
    regexStr += parts[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (i < variables.length) {
      regexStr += '(.+?)';
    }
  }

  const textMatch = text.match(new RegExp('^' + regexStr + '$'));
  if (!textMatch) return null;

  const result: Record<string, string> = {};
  for (let i = 0; i < variables.length; i++) {
    result[variables[i]] = textMatch[i + 1];
  }
  return result;
}

/**
 * Replace ###variable### placeholders in a template with actual values.
 */
export function applyVariables(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/###([^#]+)###/g, (_match, name) => {
    return variables[name] !== undefined ? variables[name] : `###${name}###`;
  });
}

/**
 * Levenshtein edit distance between two strings.
 * Uses 2-row approach (O(n) space) with optional early termination.
 */
function levenshteinDistance(a: string, b: string, maxDistance?: number): number {
  const m = a.length;
  const n = b.length;

  // Quick rejection by length difference
  if (maxDistance !== undefined && Math.abs(m - n) > maxDistance) return maxDistance + 1;

  // Ensure a is the shorter string for optimal space usage
  if (m > n) return levenshteinDistance(b, a, maxDistance);

  let prev = new Uint16Array(m + 1);
  let curr = new Uint16Array(m + 1);
  for (let j = 0; j <= m; j++) prev[j] = j;

  for (let i = 1; i <= n; i++) {
    curr[0] = i;
    let rowMin = i;
    for (let j = 1; j <= m; j++) {
      curr[j] = a[j - 1] === b[i - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (maxDistance !== undefined && rowMin > maxDistance) return maxDistance + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[m];
}

/**
 * Calculate match score between query and text
 */
export function calculateMatchScore(query: string, text: string): number {
  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();

  if (lowerText === lowerQuery) return 1;

  const maxLen = Math.max(lowerQuery.length, lowerText.length);
  if (maxLen === 0) return 0;

  // Levenshtein with early termination at similarity < 0.4
  const maxDistance = Math.floor(0.6 * maxLen);
  const distance = levenshteinDistance(lowerQuery, lowerText, maxDistance);

  if (distance > maxDistance) {
    // Levenshtein too far — still check substring containment as fallback
    if (lowerText.includes(lowerQuery)) return 0.7;
    if (lowerQuery.includes(lowerText)) return 0.5;
    return 0;
  }

  const similarity = 1 - distance / maxLen;

  // Boost for substring matches (preserves original behavior)
  if (lowerText.includes(lowerQuery)) return Math.max(similarity, 0.7);
  if (lowerQuery.includes(lowerText)) return Math.max(similarity, 0.5);

  return similarity >= 0.4 ? similarity : 0;
}

/**
 * Search translations by text content
 */
export function searchTranslations(
  translationData: TranslationMap,
  query: string,
  limit: number = 20
): SearchResult[] {
  const results: Array<SearchResult & { score: number }> = [];
  const lowerQuery = query.toLowerCase();

  for (const [multilanId, langs] of Object.entries(translationData)) {
    let bestScore = 0;

    // Check multilanId match
    if (multilanId.toLowerCase().includes(lowerQuery)) {
      bestScore = Math.max(bestScore, 0.8);
    }

    // Check translation text match in any language
    for (const text of Object.values(langs)) {
      const score = calculateMatchScore(query, text);
      bestScore = Math.max(bestScore, score);
    }

    if (bestScore > 0) {
      results.push({ multilanId, translations: langs, score: bestScore });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, limit).map(({ multilanId, translations }) => ({
    multilanId,
    translations,
  }));
}

/**
 * Search translations with scores included (for fuzzy matching)
 */
export function searchTranslationsWithScore(
  translationData: TranslationMap,
  query: string,
  limit: number = 10
): Array<SearchResult & { score: number }> {
  const results: Array<SearchResult & { score: number }> = [];
  const lowerQuery = query.toLowerCase();

  for (const [multilanId, langs] of Object.entries(translationData)) {
    let bestScore = 0;

    // Check multilanId match
    if (multilanId.toLowerCase().includes(lowerQuery)) {
      bestScore = Math.max(bestScore, 0.8);
    }

    // Check translation text match in any language
    for (const text of Object.values(langs)) {
      const score = calculateMatchScore(query, text);
      bestScore = Math.max(bestScore, score);
    }

    if (bestScore > 0) {
      results.push({ multilanId, translations: langs, score: bestScore });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

/**
 * Global search - search by multilanId OR text content
 */
export function globalSearchTranslations(
  translationData: TranslationMap,
  query: string,
  limit: number = 30,
  metadataMap?: MetadataMap
): SearchResult[] {
  const results: Array<SearchResult & { score: number }> = [];

  for (const [multilanId, langs] of Object.entries(translationData)) {
    let bestScore = 0;

    // Check if query matches multilanId (exact or partial)
    if (multilanId === query) {
      bestScore = 1; // Exact ID match
    } else if (multilanId.includes(query)) {
      bestScore = Math.max(bestScore, 0.9); // Partial ID match
    }

    // Check translation text match in any language
    for (const text of Object.values(langs)) {
      const score = calculateMatchScore(query, text);
      bestScore = Math.max(bestScore, score);
    }

    if (bestScore > 0) {
      // Get metadata if available
      const metadata = metadataMap ? metadataMap[multilanId] : undefined;

      results.push({
        multilanId,
        translations: langs,
        score: bestScore,
        metadata,
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit).map(({ multilanId, translations, metadata }) => ({
    multilanId,
    translations,
    metadata,
  }));
}

/**
 * Chunked async search — processes entries in batches to avoid blocking the main thread.
 * Yields to the event loop between chunks via setTimeout(0).
 */
const CHUNK_SIZE = 10000;

function yieldToEventLoop(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

export async function searchTranslationsWithScoreAsync(
  translationData: TranslationMap,
  query: string,
  limit: number = 10
): Promise<Array<SearchResult & { score: number }>> {
  const results: Array<SearchResult & { score: number }> = [];
  const lowerQuery = query.toLowerCase();
  const entries = Object.entries(translationData);

  for (let i = 0; i < entries.length; i++) {
    const [multilanId, langs] = entries[i];
    let bestScore = 0;

    if (multilanId.toLowerCase().includes(lowerQuery)) {
      bestScore = Math.max(bestScore, 0.8);
    }

    for (const text of Object.values(langs)) {
      const score = calculateMatchScore(query, text);
      bestScore = Math.max(bestScore, score);
    }

    if (bestScore > 0) {
      results.push({ multilanId, translations: langs, score: bestScore });
    }

    // Yield every CHUNK_SIZE entries
    if ((i + 1) % CHUNK_SIZE === 0) {
      await yieldToEventLoop();
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

/**
 * Async version of detectMatch — uses chunked fuzzy search.
 */
export async function detectMatchAsync(
  translationData: TranslationMap,
  text: string,
  metadataMap?: MetadataMap
): Promise<MatchDetectionResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { status: 'none' };
  }

  // Pass 1: Exact match (cached, O(1))
  const textToIdMap = getTextToIdMap(translationData);
  const exactId = textToIdMap.get(trimmed.toLowerCase());
  if (exactId) {
    const translations = translationData[exactId];
    const metadata = metadataMap ? metadataMap[exactId] : undefined;
    return { status: 'exact', multilanId: exactId, translations, metadata };
  }

  // Pass 2: Chunked fuzzy match (yields between chunks)
  const fuzzyResults = await searchTranslationsWithScoreAsync(translationData, trimmed, 5);
  const filtered = fuzzyResults.filter(r => r.score >= 0.8);

  if (filtered.length > 0) {
    const suggestions = filtered.map(r => ({
      ...r,
      metadata: metadataMap ? metadataMap[r.multilanId] : undefined,
    }));
    return { status: 'close', suggestions };
  }

  return { status: 'none' };
}

/**
 * Async version of globalSearchTranslations — uses chunked iteration.
 */
export async function globalSearchTranslationsAsync(
  translationData: TranslationMap,
  query: string,
  limit: number = 30,
  metadataMap?: MetadataMap
): Promise<SearchResult[]> {
  const results: Array<SearchResult & { score: number }> = [];
  const entries = Object.entries(translationData);

  for (let i = 0; i < entries.length; i++) {
    const [multilanId, langs] = entries[i];
    let bestScore = 0;

    if (multilanId === query) {
      bestScore = 1;
    } else if (multilanId.includes(query)) {
      bestScore = Math.max(bestScore, 0.9);
    }

    for (const text of Object.values(langs)) {
      const score = calculateMatchScore(query, text);
      bestScore = Math.max(bestScore, score);
    }

    if (bestScore > 0) {
      const metadata = metadataMap ? metadataMap[multilanId] : undefined;
      results.push({ multilanId, translations: langs, score: bestScore, metadata });
    }

    if ((i + 1) % CHUNK_SIZE === 0) {
      await yieldToEventLoop();
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit).map(({ multilanId, translations, metadata }) => ({
    multilanId, translations, metadata,
  }));
}

/**
 * Build reverse lookup map: text -> multilanId for exact matching
 */
export function buildTextToIdMap(translationData: TranslationMap): Map<string, string> {
  const textToMultilanId = new Map<string, string>();

  for (const [multilanId, langs] of Object.entries(translationData)) {
    for (const text of Object.values(langs)) {
      const lower = text.toLowerCase();
      if (!textToMultilanId.has(lower)) {
        textToMultilanId.set(lower, multilanId);
      }
    }
  }

  return textToMultilanId;
}

// Cached textToIdMap — built once, invalidated on folder switch
let cachedTextToIdMap: Map<string, string> | null = null;
let cachedTextToIdMapSource: TranslationMap | null = null;

/**
 * Get or build the cached text-to-ID map.
 * O(1) after first call for the same translationData reference.
 */
export function getTextToIdMap(translationData: TranslationMap): Map<string, string> {
  if (cachedTextToIdMap && cachedTextToIdMapSource === translationData) {
    return cachedTextToIdMap;
  }
  cachedTextToIdMap = buildTextToIdMap(translationData);
  cachedTextToIdMapSource = translationData;
  return cachedTextToIdMap;
}

/**
 * Invalidate the cached text-to-ID map (call on folder switch / data reload).
 */
export function invalidateTextToIdMapCache(): void {
  cachedTextToIdMap = null;
  cachedTextToIdMapSource = null;
}

/**
 * Fast exact-match lookup using the cached map. Returns multilanId or null.
 */
export function exactMatchLookup(
  translationData: TranslationMap,
  text: string
): string | null {
  const trimmed = text.trim().toLowerCase();
  if (!trimmed) return null;
  return getTextToIdMap(translationData).get(trimmed) || null;
}

/**
 * Detect current language by comparing linked nodes' text with translations
 * Returns the language that matches the most nodes
 */
export function detectLanguage(
  translationData: TranslationMap,
  linkedNodes: Array<{ multilanId: string; characters: string }>
): Language {
  const languageCounts: Record<Language, number> = {
    en: 0,
    fr: 0,
    nl: 0,
    de: 0,
  };

  for (const node of linkedNodes) {
    const translations = translationData[node.multilanId];
    if (!translations) continue;

    // Check which language matches the current text
    for (const lang of SUPPORTED_LANGUAGES) {
      if (translations[lang] === node.characters) {
        languageCounts[lang]++;
        break; // Found a match, no need to check other languages
      }
    }
  }

  // Find the language with the most matches
  let bestLang: Language = "en";
  let bestCount = 0;

  for (const lang of SUPPORTED_LANGUAGES) {
    if (languageCounts[lang] > bestCount) {
      bestCount = languageCounts[lang];
      bestLang = lang;
    }
  }

  return bestLang;
}

/**
 * Detect match for a single text string against translation data.
 * Pass 1: Exact match via buildTextToIdMap (O(1) lookup)
 * Pass 2: Fuzzy match via searchTranslationsWithScore (limit=5, threshold≥0.3)
 */
export function detectMatch(
  translationData: TranslationMap,
  text: string,
  metadataMap?: MetadataMap
): MatchDetectionResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { status: 'none' };
  }

  // Pass 1: Exact match (case-insensitive) — uses cached map
  const textToIdMap = getTextToIdMap(translationData);
  const exactId = textToIdMap.get(trimmed.toLowerCase());
  if (exactId) {
    const translations = translationData[exactId];
    const metadata = metadataMap ? metadataMap[exactId] : undefined;
    return {
      status: 'exact',
      multilanId: exactId,
      translations,
      metadata,
    };
  }

  // Pass 2: Fuzzy match
  const fuzzyResults = searchTranslationsWithScore(translationData, trimmed, 5);
  const filtered = fuzzyResults.filter(r => r.score >= 0.8);

  if (filtered.length > 0) {
    // Attach metadata to suggestions
    const suggestions = filtered.map(r => ({
      ...r,
      metadata: metadataMap ? metadataMap[r.multilanId] : undefined,
    }));
    return {
      status: 'close',
      suggestions,
    };
  }

  return { status: 'none' };
}
