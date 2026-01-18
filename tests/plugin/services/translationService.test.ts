import { describe, it, expect } from "vitest";
import {
  buildTranslationMap,
  buildMetadataMap,
  getMetadata,
  getTranslation,
  getAllTranslations,
  isLanguage,
  replacePlaceholders,
  extractVariables,
  extractVariableOccurrences,
  replaceVariables,
  calculateMatchScore,
  searchTranslations,
  searchTranslationsWithScore,
  globalSearchTranslations,
  buildTextToIdMap,
  detectLanguage,
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

  describe("buildMetadataMap", () => {
    it("should build metadata map from API data", () => {
      const result = buildMetadataMap(sampleApiData);
      expect(result["10001"]).toEqual({
        status: "FINAL",
        createdAt: "2024-01-15T10:30:00Z",
        modifiedAt: "2024-01-20T14:45:00Z",
        modifiedBy: "john.doe",
        sourceLanguageId: "en",
      });
    });

    it("should handle empty array", () => {
      const result = buildMetadataMap([]);
      expect(result).toEqual({});
    });

    it("should handle missing sourceLanguageId", () => {
      const dataWithNoSource = [{
        id: 99999,
        status: "DRAFT" as const,
        multilanTextList: [{ languageId: "en", wording: "Test" }],
      }];
      const result = buildMetadataMap(dataWithNoSource);
      expect(result["99999"].sourceLanguageId).toBeUndefined();
    });
  });

  describe("getMetadata", () => {
    it("should return metadata for valid multilanId", () => {
      const metadataMap = buildMetadataMap(sampleApiData);
      const result = getMetadata(metadataMap, "10001");
      expect(result).not.toBeNull();
      expect(result?.status).toBe("FINAL");
    });

    it("should return null for non-existent multilanId", () => {
      const metadataMap = buildMetadataMap(sampleApiData);
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

  describe("extractVariables", () => {
    it("should extract single variable", () => {
      const result = extractVariables("Hello ###username###!");
      expect(result).toEqual(["username"]);
    });

    it("should extract multiple variables", () => {
      const result = extractVariables("Hello ###username###, you have ###count### messages");
      expect(result).toEqual(["username", "count"]);
    });

    it("should return unique variables only", () => {
      const result = extractVariables("###name### and ###name### again");
      expect(result).toEqual(["name"]);
    });

    it("should return empty array for text without variables", () => {
      const result = extractVariables("Hello World");
      expect(result).toEqual([]);
    });
  });

  describe("extractVariableOccurrences", () => {
    it("should extract single variable occurrence", () => {
      const result = extractVariableOccurrences("Hello ###username###!");
      expect(result).toEqual([
        { name: "username", key: "username", index: 1, isIndexed: false },
      ]);
    });

    it("should index duplicate variables", () => {
      const result = extractVariableOccurrences("###amount### + ###amount### = total");
      expect(result).toEqual([
        { name: "amount", key: "amount_1", index: 1, isIndexed: true },
        { name: "amount", key: "amount_2", index: 2, isIndexed: true },
      ]);
    });

    it("should handle mixed unique and duplicate variables", () => {
      const result = extractVariableOccurrences("###name###: ###val### to ###val###");
      expect(result).toEqual([
        { name: "name", key: "name", index: 1, isIndexed: false },
        { name: "val", key: "val_1", index: 1, isIndexed: true },
        { name: "val", key: "val_2", index: 2, isIndexed: true },
      ]);
    });

    it("should return empty array for text without variables", () => {
      const result = extractVariableOccurrences("Hello World");
      expect(result).toEqual([]);
    });
  });

  describe("replaceVariables", () => {
    it("should replace single variable", () => {
      const result = replaceVariables("Hello ###username###!", { username: "John" });
      expect(result).toBe("Hello John!");
    });

    it("should replace multiple different variables", () => {
      const result = replaceVariables("###greeting### ###name###!", {
        greeting: "Hello",
        name: "World",
      });
      expect(result).toBe("Hello World!");
    });

    it("should replace indexed duplicate variables", () => {
      const result = replaceVariables("###amount### + ###amount### = total", {
        amount_1: "10",
        amount_2: "20",
      });
      expect(result).toBe("10 + 20 = total");
    });

    it("should fall back to base name for non-indexed values", () => {
      const result = replaceVariables("Hello ###name###!", { name: "World" });
      expect(result).toBe("Hello World!");
    });

    it("should keep unmatched variables as-is", () => {
      const result = replaceVariables("Hello ###unknown###!", {});
      expect(result).toBe("Hello ###unknown###!");
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

    it("should include variable occurrences for translations with variables", () => {
      const dataWithVariables = {
        "20001": {
          en: "Hello ###username###!",
          fr: "Bonjour ###username###!",
        },
      };
      const results = globalSearchTranslations(dataWithVariables, "Hello");
      expect(results[0].variableOccurrences).toEqual([
        { name: "username", key: "username", index: 1, isIndexed: false },
      ]);
    });

    it("should handle indexed variables across languages", () => {
      const dataWithDuplicates = {
        "20002": {
          en: "###amount### + ###amount### = ###total###",
          fr: "###amount### + ###amount### = ###total###",
        },
      };
      const results = globalSearchTranslations(dataWithDuplicates, "20002");
      expect(results[0].variableOccurrences).toContainEqual(
        { name: "amount", key: "amount_1", index: 1, isIndexed: true }
      );
      expect(results[0].variableOccurrences).toContainEqual(
        { name: "amount", key: "amount_2", index: 2, isIndexed: true }
      );
      expect(results[0].variableOccurrences).toContainEqual(
        { name: "total", key: "total", index: 1, isIndexed: false }
      );
    });

    it("should use max variable count across languages", () => {
      const dataWithDifferentCounts = {
        "20003": {
          en: "###item### only",
          fr: "###item### et ###item###", // 2 occurrences in French
        },
      };
      const results = globalSearchTranslations(dataWithDifferentCounts, "20003");
      // Should use max count (2 from French)
      expect(results[0].variableOccurrences).toContainEqual(
        { name: "item", key: "item_1", index: 1, isIndexed: true }
      );
      expect(results[0].variableOccurrences).toContainEqual(
        { name: "item", key: "item_2", index: 2, isIndexed: true }
      );
    });

    it("should include metadata when provided", () => {
      const metadataMap = buildMetadataMap(sampleApiData);
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

    it("should return empty variableOccurrences for translations without variables", () => {
      const results = globalSearchTranslations(sampleTranslationMap, "10001");
      expect(results[0].variableOccurrences).toBeUndefined();
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
