import { describe, it, expect } from "vitest";
import {
  getMetadata,
  getTranslation,
  getAllTranslations,
  isLanguage,
  replacePlaceholders,
  calculateMatchScore,
  searchTranslations,
  searchTranslationsWithScore,
  globalSearchTranslations,
  buildTextToIdMap,
  detectLanguage,
} from "../../../src/plugin/services/translationService";
import { CurrentApiAdapter } from "../../../src/adapters/implementations/currentApiAdapter";
import { sampleApiData, sampleTranslationMap } from "../../setup";

// Note: buildTranslationMap and buildMetadataMap tests have been moved to
// tests/adapters/currentApiAdapter.test.ts as part of the hexagonal architecture

describe("translationService", () => {
  describe("getMetadata", () => {
    it("should return metadata for valid multilanId", () => {
      const adapter = new CurrentApiAdapter(sampleApiData);
      const metadataMap = adapter.getMetadataMap();
      const result = getMetadata(metadataMap, "10001");
      expect(result).not.toBeNull();
      expect(result?.status).toBe("FINAL");
    });

    it("should return null for non-existent multilanId", () => {
      const adapter = new CurrentApiAdapter(sampleApiData);
      const metadataMap = adapter.getMetadataMap();
      const result = getMetadata(metadataMap, "99999");
      expect(result).toBeNull();
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

    it("should include metadata when provided", () => {
      const adapter = new CurrentApiAdapter(sampleApiData);
      const metadataMap = adapter.getMetadataMap();
      const results = globalSearchTranslations(sampleTranslationMap, "10001", 30, metadataMap);
      expect(results[0].metadata).toBeDefined();
      expect(results[0].metadata?.status).toBe("FINAL");
    });

    it("should not include metadata when not provided", () => {
      const results = globalSearchTranslations(sampleTranslationMap, "10001");
      expect(results[0].metadata).toBeUndefined();
    });

    it("should limit results", () => {
      const results = globalSearchTranslations(sampleTranslationMap, "a", 1);
      expect(results.length).toBeLessThanOrEqual(1);
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

  describe("detectLanguage", () => {
    it("should detect English when nodes have English text", () => {
      const linkedNodes = [
        { multilanId: "10001", characters: "Submit" },
        { multilanId: "10002", characters: "Cancel" },
      ];
      const result = detectLanguage(sampleTranslationMap, linkedNodes);
      expect(result).toBe("en");
    });

    it("should detect French when nodes have French text", () => {
      const linkedNodes = [
        { multilanId: "10001", characters: "Soumettre" },
        { multilanId: "10002", characters: "Annuler" },
      ];
      const result = detectLanguage(sampleTranslationMap, linkedNodes);
      expect(result).toBe("fr");
    });

    it("should detect Dutch when nodes have Dutch text", () => {
      const linkedNodes = [
        { multilanId: "10001", characters: "Indienen" },
        { multilanId: "10002", characters: "Annuleren" },
      ];
      const result = detectLanguage(sampleTranslationMap, linkedNodes);
      expect(result).toBe("nl");
    });

    it("should detect German when nodes have German text", () => {
      const linkedNodes = [
        { multilanId: "10001", characters: "Einreichen" },
        { multilanId: "10002", characters: "Abbrechen" },
      ];
      const result = detectLanguage(sampleTranslationMap, linkedNodes);
      expect(result).toBe("de");
    });

    it("should return majority language when mixed", () => {
      const linkedNodes = [
        { multilanId: "10001", characters: "Soumettre" }, // French
        { multilanId: "10002", characters: "Annuler" }, // French
        { multilanId: "10003", characters: "OK" }, // English
      ];
      const result = detectLanguage(sampleTranslationMap, linkedNodes);
      expect(result).toBe("fr");
    });

    it("should default to English when no linked nodes", () => {
      const result = detectLanguage(sampleTranslationMap, []);
      expect(result).toBe("en");
    });

    it("should default to English when no matches found", () => {
      const linkedNodes = [
        { multilanId: "10001", characters: "Unknown text" },
        { multilanId: "10002", characters: "Another unknown" },
      ];
      const result = detectLanguage(sampleTranslationMap, linkedNodes);
      expect(result).toBe("en");
    });

    it("should handle invalid multilanIds gracefully", () => {
      const linkedNodes = [
        { multilanId: "invalid", characters: "Submit" },
        { multilanId: "10001", characters: "Submit" },
      ];
      const result = detectLanguage(sampleTranslationMap, linkedNodes);
      expect(result).toBe("en");
    });
  });
});
