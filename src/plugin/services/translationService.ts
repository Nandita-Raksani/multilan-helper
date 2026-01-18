// Translation service - handles all translation-related operations

import {
  ApiMultilan,
  TranslationMap,
  TranslationEntry,
  SearchResult,
  Language,
  SUPPORTED_LANGUAGES,
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
  limit: number = 30
): SearchResult[] {
  const results: Array<SearchResult & { score: number }> = [];
  const lowerQuery = query.toLowerCase();

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
      results.push({ multilanId, translations: langs, score: bestScore });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit).map(({ multilanId, translations }) => ({
    multilanId,
    translations,
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
