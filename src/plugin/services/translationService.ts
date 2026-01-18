// Translation service - handles all translation-related operations

import {
  ApiMultilan,
  TranslationMap,
  TranslationEntry,
  SearchResult,
  Language,
  SUPPORTED_LANGUAGES,
  VariableOccurrence,
  MetadataMap,
  MultilanMetadata,
} from "../../shared/types";

/**
 * Build a translation map from API format
 */
export function buildTranslationMap(data: ApiMultilan[]): TranslationMap {
  const map: TranslationMap = {};

  for (const item of data) {
    const multilanId = String(item.id);
    map[multilanId] = {};

    for (const text of item.multilanTextList) {
      map[multilanId][text.languageId] = text.wording;
    }
  }

  return map;
}

/**
 * Build a metadata map from API format
 */
export function buildMetadataMap(data: ApiMultilan[]): MetadataMap {
  const map: MetadataMap = {};

  for (const item of data) {
    const multilanId = String(item.id);
    // Get source language from first text entry (they all have the same source)
    const sourceLanguageId = item.multilanTextList[0]?.sourceLanguageId;

    map[multilanId] = {
      status: item.status,
      createdAt: item.createdAt,
      modifiedAt: item.modifiedAt,
      modifiedBy: item.modifiedBy,
      sourceLanguageId,
    };
  }

  return map;
}

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
 * Extract variable names from text with ###variable### format (unique only)
 */
export function extractVariables(text: string): string[] {
  const regex = /###(\w+)###/g;
  const variables: string[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }
  return variables;
}

/**
 * Extract all variable occurrences with indices for duplicate handling
 */
export function extractVariableOccurrences(text: string): VariableOccurrence[] {
  const regex = /###(\w+)###/g;
  const occurrences: VariableOccurrence[] = [];
  const countMap: Record<string, number> = {};
  let match;

  // First pass: count occurrences of each variable
  const tempRegex = /###(\w+)###/g;
  while ((match = tempRegex.exec(text)) !== null) {
    const name = match[1];
    countMap[name] = (countMap[name] || 0) + 1;
  }

  // Second pass: build occurrences with indices
  const indexMap: Record<string, number> = {};
  while ((match = regex.exec(text)) !== null) {
    const name = match[1];
    indexMap[name] = (indexMap[name] || 0) + 1;
    const index = indexMap[name];
    const isIndexed = countMap[name] > 1;
    const key = isIndexed ? `${name}_${index}` : name;

    occurrences.push({ name, key, index, isIndexed });
  }

  return occurrences;
}

/**
 * Replace ###variable### patterns with values (supports indexed keys)
 */
export function replaceVariables(
  text: string,
  values: Record<string, string>
): string {
  const indexMap: Record<string, number> = {};

  return text.replace(/###(\w+)###/g, (match, name) => {
    indexMap[name] = (indexMap[name] || 0) + 1;
    const index = indexMap[name];

    // Try indexed key first (e.g., "amount_2"), then fall back to base name
    const indexedKey = `${name}_${index}`;
    if (values[indexedKey] !== undefined) {
      return values[indexedKey] || match;
    }
    // Fall back to non-indexed key for backward compatibility
    return values[name] || match;
  });
}

/**
 * Calculate match score between query and text
 */
export function calculateMatchScore(query: string, text: string): number {
  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();

  if (lowerText === lowerQuery) return 1;
  if (lowerText.includes(lowerQuery)) return 0.7;
  if (lowerQuery.includes(lowerText)) return 0.5;
  if (lowerQuery.split(" ").some((word) => word.length > 2 && lowerText.includes(word))) {
    return 0.3;
  }
  return 0;
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
      const lowerText = text.toLowerCase();
      if (lowerText === lowerQuery) {
        bestScore = 1;
      } else if (lowerText.includes(lowerQuery)) {
        bestScore = Math.max(bestScore, 0.6);
      } else if (lowerQuery.includes(lowerText)) {
        bestScore = Math.max(bestScore, 0.5);
      } else if (lowerQuery.split(" ").some((word) => word.length > 2 && lowerText.includes(word))) {
        bestScore = Math.max(bestScore, 0.3);
      }
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
      // Extract variable occurrences from all translations
      // Find max occurrence count for each variable name across all languages
      const maxCountMap: Record<string, number> = {};
      for (const text of Object.values(langs)) {
        const countMap: Record<string, number> = {};
        const regex = /###(\w+)###/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
          const name = match[1];
          countMap[name] = (countMap[name] || 0) + 1;
        }
        for (const [name, count] of Object.entries(countMap)) {
          maxCountMap[name] = Math.max(maxCountMap[name] || 0, count);
        }
      }

      // Build variable occurrences based on max counts
      const variableOccurrences: VariableOccurrence[] = [];
      for (const [name, maxCount] of Object.entries(maxCountMap)) {
        for (let i = 1; i <= maxCount; i++) {
          const isIndexed = maxCount > 1;
          const key = isIndexed ? `${name}_${i}` : name;
          variableOccurrences.push({ name, key, index: i, isIndexed });
        }
      }

      // Get metadata if available
      const metadata = metadataMap ? metadataMap[multilanId] : undefined;

      results.push({
        multilanId,
        translations: langs,
        score: bestScore,
        variableOccurrences: variableOccurrences.length > 0 ? variableOccurrences : undefined,
        metadata,
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit).map(({ multilanId, translations, variableOccurrences, metadata }) => ({
    multilanId,
    translations,
    variableOccurrences,
    metadata,
  }));
}

/**
 * Build reverse lookup map: text -> multilanId for exact matching
 */
export function buildTextToIdMap(translationData: TranslationMap): Map<string, string> {
  const textToMultilanId = new Map<string, string>();

  for (const [multilanId, langs] of Object.entries(translationData)) {
    for (const text of Object.values(langs)) {
      if (!textToMultilanId.has(text)) {
        textToMultilanId.set(text, multilanId);
      }
    }
  }

  return textToMultilanId;
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
