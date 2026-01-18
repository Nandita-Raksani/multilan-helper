import { describe, it, expect } from "vitest";
import { CurrentApiAdapter } from "../../src/adapters/implementations/currentApiAdapter";
import { createAdapter, detectAdapterType, hasAdapter, getRegisteredAdapterTypes } from "../../src/adapters";
import { isCurrentApiFormat } from "../../src/adapters/types/currentApi.types";
import { TranslationDataPort } from "../../src/ports/translationPort";
import { sampleApiData } from "../setup";

describe("CurrentApiAdapter", () => {
  describe("constructor", () => {
    it("should construct with valid API data", () => {
      const adapter = new CurrentApiAdapter(sampleApiData);
      expect(adapter).toBeInstanceOf(CurrentApiAdapter);
    });

    it("should throw error for invalid data format", () => {
      expect(() => new CurrentApiAdapter({ invalid: "data" })).toThrow(
        "Invalid data format"
      );
    });

    it("should throw error for null data", () => {
      expect(() => new CurrentApiAdapter(null)).toThrow("Invalid data format");
    });

    it("should throw error for non-array data", () => {
      expect(() => new CurrentApiAdapter("string")).toThrow(
        "Invalid data format"
      );
    });

    it("should accept empty array", () => {
      const adapter = new CurrentApiAdapter([]);
      expect(adapter.getTranslationCount()).toBe(0);
    });
  });

  describe("getTranslationMap", () => {
    it("should return correct translation map structure", () => {
      const adapter = new CurrentApiAdapter(sampleApiData);
      const map = adapter.getTranslationMap();

      expect(map["10001"]).toEqual({
        en: "Submit",
        fr: "Soumettre",
        nl: "Indienen",
        de: "Einreichen",
      });
    });

    it("should convert numeric IDs to strings", () => {
      const adapter = new CurrentApiAdapter(sampleApiData);
      const map = adapter.getTranslationMap();

      expect(Object.keys(map)).toContain("10001");
      expect(Object.keys(map)).toContain("10002");
    });

    it("should include all language translations", () => {
      const adapter = new CurrentApiAdapter(sampleApiData);
      const map = adapter.getTranslationMap();

      expect(map["10001"].en).toBe("Submit");
      expect(map["10001"].fr).toBe("Soumettre");
      expect(map["10001"].nl).toBe("Indienen");
      expect(map["10001"].de).toBe("Einreichen");
    });

    it("should handle partial translations", () => {
      const adapter = new CurrentApiAdapter(sampleApiData);
      const map = adapter.getTranslationMap();

      // Item 10003 only has en and fr
      expect(map["10003"].en).toBe("Hello ###username###");
      expect(map["10003"].fr).toBe("Bonjour ###username###");
      expect(map["10003"].nl).toBeUndefined();
    });
  });

  describe("getMetadataMap", () => {
    it("should return correct metadata structure", () => {
      const adapter = new CurrentApiAdapter(sampleApiData);
      const map = adapter.getMetadataMap();

      expect(map["10001"]).toEqual({
        status: "FINAL",
        createdAt: "2024-01-15T10:30:00Z",
        modifiedAt: "2024-01-20T14:45:00Z",
        modifiedBy: "john.doe",
        sourceLanguageId: "en",
      });
    });

    it("should include status field", () => {
      const adapter = new CurrentApiAdapter(sampleApiData);
      const map = adapter.getMetadataMap();

      expect(map["10001"].status).toBe("FINAL");
      expect(map["10002"].status).toBe("DRAFT");
      expect(map["10003"].status).toBe("IN_TRANSLATION");
    });

    it("should handle missing optional fields", () => {
      const dataWithMissingFields = [
        {
          id: 99999,
          multilanTextList: [{ languageId: "en", wording: "Test", id: 1 }],
        },
      ];
      const adapter = new CurrentApiAdapter(dataWithMissingFields);
      const map = adapter.getMetadataMap();

      expect(map["99999"].status).toBeUndefined();
      expect(map["99999"].createdAt).toBeUndefined();
      expect(map["99999"].sourceLanguageId).toBeUndefined();
    });
  });

  describe("getTranslationCount", () => {
    it("should return correct count", () => {
      const adapter = new CurrentApiAdapter(sampleApiData);
      expect(adapter.getTranslationCount()).toBe(3);
    });

    it("should return 0 for empty data", () => {
      const adapter = new CurrentApiAdapter([]);
      expect(adapter.getTranslationCount()).toBe(0);
    });
  });

  describe("getSourceIdentifier", () => {
    it("should return current-api identifier", () => {
      const adapter = new CurrentApiAdapter(sampleApiData);
      expect(adapter.getSourceIdentifier()).toBe("current-api");
    });
  });

  describe("TranslationDataPort interface compliance", () => {
    it("should implement all port methods", () => {
      const adapter: TranslationDataPort = new CurrentApiAdapter(sampleApiData);

      expect(typeof adapter.getTranslationMap).toBe("function");
      expect(typeof adapter.getMetadataMap).toBe("function");
      expect(typeof adapter.getTranslationCount).toBe("function");
      expect(typeof adapter.getSourceIdentifier).toBe("function");
    });
  });
});

describe("Adapter Registry", () => {
  describe("createAdapter", () => {
    it("should create adapter with auto-detection", () => {
      const adapter = createAdapter(sampleApiData);
      expect(adapter).toBeInstanceOf(CurrentApiAdapter);
    });

    it("should create adapter with explicit type", () => {
      const adapter = createAdapter(sampleApiData, "current-api");
      expect(adapter).toBeInstanceOf(CurrentApiAdapter);
    });

    it("should throw for undetectable format", () => {
      expect(() => createAdapter({ invalid: "format" })).toThrow(
        "Unable to detect adapter type"
      );
    });
  });

  describe("detectAdapterType", () => {
    it("should detect current-api format", () => {
      expect(detectAdapterType(sampleApiData)).toBe("current-api");
    });

    it("should return null for invalid format", () => {
      expect(detectAdapterType({ invalid: "data" })).toBeNull();
    });

    it("should return null for null", () => {
      expect(detectAdapterType(null)).toBeNull();
    });

    it("should detect empty array as current-api", () => {
      expect(detectAdapterType([])).toBe("current-api");
    });
  });

  describe("hasAdapter", () => {
    it("should return true for registered adapter", () => {
      expect(hasAdapter("current-api")).toBe(true);
    });

    it("should return false for unregistered adapter", () => {
      expect(hasAdapter("unknown-api")).toBe(false);
    });
  });

  describe("getRegisteredAdapterTypes", () => {
    it("should include current-api", () => {
      const types = getRegisteredAdapterTypes();
      expect(types).toContain("current-api");
    });
  });
});

describe("Type Guards", () => {
  describe("isCurrentApiFormat", () => {
    it("should return true for valid format", () => {
      expect(isCurrentApiFormat(sampleApiData)).toBe(true);
    });

    it("should return true for empty array", () => {
      expect(isCurrentApiFormat([])).toBe(true);
    });

    it("should return false for non-array", () => {
      expect(isCurrentApiFormat({ id: 1 })).toBe(false);
    });

    it("should return false for array without id field", () => {
      expect(isCurrentApiFormat([{ multilanTextList: [] }])).toBe(false);
    });

    it("should return false for array without multilanTextList", () => {
      expect(isCurrentApiFormat([{ id: 1 }])).toBe(false);
    });

    it("should return false for array with wrong id type", () => {
      expect(isCurrentApiFormat([{ id: "string", multilanTextList: [] }])).toBe(
        false
      );
    });

    it("should return false for null", () => {
      expect(isCurrentApiFormat(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isCurrentApiFormat(undefined)).toBe(false);
    });
  });
});
