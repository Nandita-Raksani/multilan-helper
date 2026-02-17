import { describe, it, expect } from "vitest";
import { TraFileAdapter } from "../../src/adapters/implementations/traFileAdapter";
import { parseTraLine, parseTraFile, isTraFileData } from "../../src/adapters/types/traFile.types";

describe("traFile.types", () => {
  describe("parseTraLine", () => {
    it("should parse standard .tra line format", () => {
      const result = parseTraLine('10001,"Submit","All"');
      expect(result).toEqual({ id: "10001", text: "Submit" });
    });

    it("should parse line with escaped quotes", () => {
      const result = parseTraLine('10002,"Say ""Hello""","All"');
      expect(result).toEqual({ id: "10002", text: 'Say "Hello"' });
    });

    it("should parse line without quotes", () => {
      const result = parseTraLine("10003,SimpleText,All");
      expect(result).toEqual({ id: "10003", text: "SimpleText" });
    });

    it("should return null for empty line", () => {
      const result = parseTraLine("");
      expect(result).toBeNull();
    });

    it("should return null for whitespace only", () => {
      const result = parseTraLine("   ");
      expect(result).toBeNull();
    });

    it("should handle line with only id and text", () => {
      const result = parseTraLine('10004,"Just text"');
      expect(result).toEqual({ id: "10004", text: "Just text" });
    });
  });

  describe("parseTraFile", () => {
    it("should parse multi-line .tra file content", () => {
      const content = `10001,"Submit","All"
10002,"Cancel","All"
10003,"OK","All"`;

      const result = parseTraFile(content);

      expect(result.get("10001")).toBe("Submit");
      expect(result.get("10002")).toBe("Cancel");
      expect(result.get("10003")).toBe("OK");
      expect(result.size).toBe(3);
    });

    it("should skip empty lines", () => {
      const content = `10001,"Submit","All"

10002,"Cancel","All"`;

      const result = parseTraFile(content);
      expect(result.size).toBe(2);
    });

    it("should handle Windows line endings", () => {
      const content = "10001,\"Submit\",\"All\"\r\n10002,\"Cancel\",\"All\"";
      const result = parseTraFile(content);
      expect(result.size).toBe(2);
    });
  });

  describe("isTraFileData", () => {
    it("should return true for valid TraFileData", () => {
      const data = {
        en: "content",
        fr: "contenu",
        nl: "inhoud",
        de: "inhalt",
      };
      expect(isTraFileData(data)).toBe(true);
    });

    it("should return false for missing language", () => {
      const data = {
        en: "content",
        fr: "contenu",
        nl: "inhoud",
        // de is missing
      };
      expect(isTraFileData(data)).toBe(false);
    });

    it("should return false for non-string values", () => {
      const data = {
        en: 123,
        fr: "contenu",
        nl: "inhoud",
        de: "inhalt",
      };
      expect(isTraFileData(data)).toBe(false);
    });

    it("should return false for null", () => {
      expect(isTraFileData(null)).toBe(false);
    });

    it("should return false for non-object", () => {
      expect(isTraFileData("string")).toBe(false);
    });
  });
});

describe("TraFileAdapter", () => {
  const sampleTraData = {
    en: `10001,"Submit","All"
10002,"Cancel","All"
10003,"Welcome","All"`,
    fr: `10001,"Soumettre","All"
10002,"Annuler","All"
10003,"Bienvenue","All"`,
    nl: `10001,"Indienen","All"
10002,"Annuleren","All"
10003,"Welkom","All"`,
    de: `10001,"Einreichen","All"
10002,"Abbrechen","All"
10003,"Willkommen","All"`,
  };

  describe("constructor", () => {
    it("should create adapter with valid .tra file data", () => {
      const adapter = new TraFileAdapter(sampleTraData);
      expect(adapter).toBeInstanceOf(TraFileAdapter);
    });

    it("should throw error for invalid data", () => {
      expect(() => new TraFileAdapter({ invalid: "data" })).toThrow();
    });
  });

  describe("getTranslationMap", () => {
    it("should return translation map with all languages", () => {
      const adapter = new TraFileAdapter(sampleTraData);
      const map = adapter.getTranslationMap();

      expect(map["10001"]).toEqual({
        en: "Submit",
        fr: "Soumettre",
        nl: "Indienen",
        de: "Einreichen",
      });

      expect(map["10002"]).toEqual({
        en: "Cancel",
        fr: "Annuler",
        nl: "Annuleren",
        de: "Abbrechen",
      });
    });

    it("should handle missing translations in some languages", () => {
      const partialData = {
        en: `10001,"Submit","All"`,
        fr: `10001,"Soumettre","All"`,
        nl: "",
        de: "",
      };

      const adapter = new TraFileAdapter(partialData);
      const map = adapter.getTranslationMap();

      expect(map["10001"]).toEqual({
        en: "Submit",
        fr: "Soumettre",
      });
    });
  });

  describe("getMetadataMap", () => {
    it("should return empty metadata map", () => {
      const adapter = new TraFileAdapter(sampleTraData);
      const metadata = adapter.getMetadataMap();
      expect(metadata).toEqual({});
    });
  });

  describe("getTranslationCount", () => {
    it("should return correct count of translations", () => {
      const adapter = new TraFileAdapter(sampleTraData);
      expect(adapter.getTranslationCount()).toBe(3);
    });
  });

  describe("getSourceIdentifier", () => {
    it("should return tra-files identifier", () => {
      const adapter = new TraFileAdapter(sampleTraData);
      expect(adapter.getSourceIdentifier()).toBe("tra-files");
    });
  });
});
