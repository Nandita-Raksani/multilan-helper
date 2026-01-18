import { describe, it, expect } from "vitest";
import {
  buildTranslationMap,
  getTranslation,
  getAllTranslations,
  isLanguage,
  replacePlaceholders,
  calculateMatchScore,
  searchTranslations,
  searchTranslationsWithScore,
  globalSearchTranslations,
  buildTextToIdMap,
} from "../../../src/plugin/services/translationService";
import { sampleApiData, sampleTranslationMap } from "../../setup";

describe("translationService", () => {
  describe("buildTranslationMap", () => {
    it("should convert API format to internal format", () => {
      const result = buildTranslationMap(sampleApiData);

      expect(result["10001"]).toEqual({
        en: "Submit",
        fr: "Soumettre",
        nl: "Indienen",
        de: "Einreichen",
      });
      expect(result["10002"]).toEqual({
        en: "Cancel",
        fr: "Annuler",
        nl: "Annuleren",
        de: "Abbrechen",
      });
    });

    it("should handle empty array", () => {
      const result = buildTranslationMap([]);
      expect(result).toEqual({});
    });

    it("should convert numeric IDs to strings", () => {
      const result = buildTranslationMap(sampleApiData);
      expect(Object.keys(result)).toContain("10001");
      expect(Object.keys(result)).not.toContain(10001);
    });
  });

  describe("getTranslation", () => {
    it("should return translation for valid multilanId and language", () => {
      const result = getTranslation(sampleTranslationMap, "10001", "en");
      expect(result).toBe("Submit");
    });

    it("should return translation for different languages", () => {
      expect(getTranslation(sampleTranslationMap, "10001", "fr")).toBe("Soumettre");
      expect(getTranslation(sampleTranslationMap, "10001", "nl")).toBe("Indienen");
      expect(getTranslation(sampleTranslationMap, "10001", "de")).toBe("Einreichen");
    });

    it("should return null for non-existent multilanId", () => {
      const result = getTranslation(sampleTranslationMap, "99999", "en");
      expect(result).toBeNull();
    });

    it("should return null for non-existent language", () => {
      const result = getTranslation(sampleTranslationMap, "10003", "de");
      expect(result).toBeNull();
    });
  });

  describe("getAllTranslations", () => {
    it("should return all translations for valid multilanId", () => {
      const result = getAllTranslations(sampleTranslationMap, "10001");
      expect(result).toEqual({
        en: "Submit",
        fr: "Soumettre",
        nl: "Indienen",
        de: "Einreichen",
      });
    });

    it("should return null for non-existent multilanId", () => {
      const result = getAllTranslations(sampleTranslationMap, "99999");
      expect(result).toBeNull();
    });
  });

  describe("isLanguage", () => {
    it("should return true for supported languages", () => {
      expect(isLanguage("en")).toBe(true);
      expect(isLanguage("fr")).toBe(true);
      expect(isLanguage("nl")).toBe(true);
      expect(isLanguage("de")).toBe(true);
    });

    it("should return false for unsupported languages", () => {
      expect(isLanguage("es")).toBe(false);
      expect(isLanguage("it")).toBe(false);
      expect(isLanguage("")).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isLanguage(undefined)).toBe(false);
    });
  });

  describe("replacePlaceholders", () => {
    it("should replace single placeholder", () => {
      const result = replacePlaceholders("Hello {username}", { username: "John" });
      expect(result).toBe("Hello John");
    });

    it("should replace multiple placeholders", () => {
      const result = replacePlaceholders("Hello {username}, you have {count} messages", {
        username: "John",
        count: "5",
      });
      expect(result).toBe("Hello John, you have 5 messages");
    });

    it("should keep unmatched placeholders as-is", () => {
      const result = replacePlaceholders("Hello {username}", {});
      expect(result).toBe("Hello {username}");
    });

    it("should handle text without placeholders", () => {
      const result = replacePlaceholders("Hello World", { username: "John" });
      expect(result).toBe("Hello World");
    });
  });

  describe("calculateMatchScore", () => {
    it("should return 1 for exact match", () => {
      expect(calculateMatchScore("Submit", "Submit")).toBe(1);
      expect(calculateMatchScore("submit", "Submit")).toBe(1); // case insensitive
    });

    it("should return 0.7 for text containing query", () => {
      expect(calculateMatchScore("Sub", "Submit")).toBe(0.7);
    });

    it("should return 0.5 for query containing text", () => {
      expect(calculateMatchScore("Submit button", "Submit")).toBe(0.5);
    });

    it("should return 0.5 for query containing text", () => {
      // "form" is contained in "Submit form now", so query contains text
      expect(calculateMatchScore("Submit form now", "form")).toBe(0.5);
    });

    it("should return 0.3 for word match only", () => {
      // Test case where only word matching applies
      expect(calculateMatchScore("form submission", "xyzform")).toBe(0.3);
    });

    it("should return 0 for no match", () => {
      expect(calculateMatchScore("xyz", "Submit")).toBe(0);
    });
  });

  describe("searchTranslations", () => {
    it("should find translations by text content", () => {
      const results = searchTranslations(sampleTranslationMap, "Submit");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].multilanId).toBe("10001");
    });

    it("should find translations by partial match", () => {
      const results = searchTranslations(sampleTranslationMap, "Sub");
      expect(results.length).toBeGreaterThan(0);
    });

    it("should find translations by multilanId", () => {
      const results = searchTranslations(sampleTranslationMap, "10001");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].multilanId).toBe("10001");
    });

    it("should return empty array for no matches", () => {
      const results = searchTranslations(sampleTranslationMap, "xyz123");
      expect(results).toEqual([]);
    });

    it("should limit results", () => {
      const results = searchTranslations(sampleTranslationMap, "a", 1);
      expect(results.length).toBeLessThanOrEqual(1);
    });

    it("should sort results by score", () => {
      const results = searchTranslationsWithScore(sampleTranslationMap, "Cancel");
      expect(results[0].score).toBeGreaterThanOrEqual(results[results.length - 1].score);
    });
  });

  describe("globalSearchTranslations", () => {
    it("should prioritize exact ID match", () => {
      const results = globalSearchTranslations(sampleTranslationMap, "10001");
      expect(results[0].multilanId).toBe("10001");
    });

    it("should find by text content", () => {
      const results = globalSearchTranslations(sampleTranslationMap, "Annuler");
      expect(results.some((r) => r.multilanId === "10002")).toBe(true);
    });

    it("should search across all languages", () => {
      const results = globalSearchTranslations(sampleTranslationMap, "Soumettre");
      expect(results.some((r) => r.multilanId === "10001")).toBe(true);
    });
  });

  describe("buildTextToIdMap", () => {
    it("should create reverse lookup map", () => {
      const map = buildTextToIdMap(sampleTranslationMap);

      expect(map.get("Submit")).toBe("10001");
      expect(map.get("Cancel")).toBe("10002");
      expect(map.get("Soumettre")).toBe("10001");
    });

    it("should handle first occurrence for duplicate texts", () => {
      const dataWithDuplicates = {
        "1": { en: "Test" },
        "2": { en: "Test" },
      };
      const map = buildTextToIdMap(dataWithDuplicates);
      expect(map.get("Test")).toBe("1"); // First occurrence
    });
  });
});
