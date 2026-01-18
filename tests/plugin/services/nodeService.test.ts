import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockTextNode, setupFigmaMock } from "../../setup";
import {
  getMultilanId,
  setMultilanId,
  clearMultilanId,
  isPlaceholder,
  setPlaceholderStatus,
  buildTextNodeInfo,
} from "../../../src/plugin/services/nodeService";
import { PLUGIN_DATA_KEY, PLACEHOLDER_KEY } from "../../../src/shared/types";

describe("nodeService", () => {
  beforeEach(() => {
    setupFigmaMock();
  });

  describe("getMultilanId", () => {
    it("should return multilanId when set", () => {
      const node = createMockTextNode();
      node.setPluginData(PLUGIN_DATA_KEY, "10001");

      const result = getMultilanId(node);
      expect(result).toBe("10001");
    });

    it("should return null when not set", () => {
      const node = createMockTextNode();

      const result = getMultilanId(node);
      expect(result).toBeNull();
    });

    it("should return null for empty string", () => {
      const node = createMockTextNode();
      node.setPluginData(PLUGIN_DATA_KEY, "");

      const result = getMultilanId(node);
      expect(result).toBeNull();
    });
  });

  describe("setMultilanId", () => {
    it("should set multilanId on node", () => {
      const node = createMockTextNode();

      setMultilanId(node, "10001");

      expect(node.setPluginData).toHaveBeenCalledWith(PLUGIN_DATA_KEY, "10001");
    });
  });

  describe("clearMultilanId", () => {
    it("should clear multilanId from node", () => {
      const node = createMockTextNode();

      clearMultilanId(node);

      expect(node.setPluginData).toHaveBeenCalledWith(PLUGIN_DATA_KEY, "");
    });
  });

  describe("isPlaceholder", () => {
    it("should return true when marked as placeholder", () => {
      const node = createMockTextNode();
      node.setPluginData(PLACEHOLDER_KEY, "true");

      const result = isPlaceholder(node);
      expect(result).toBe(true);
    });

    it("should return false when not marked", () => {
      const node = createMockTextNode();

      const result = isPlaceholder(node);
      expect(result).toBe(false);
    });

    it("should return false for empty string", () => {
      const node = createMockTextNode();
      node.setPluginData(PLACEHOLDER_KEY, "");

      const result = isPlaceholder(node);
      expect(result).toBe(false);
    });
  });

  describe("setPlaceholderStatus", () => {
    it("should set placeholder status to true", () => {
      const node = createMockTextNode();

      setPlaceholderStatus(node, true);

      expect(node.setPluginData).toHaveBeenCalledWith(PLACEHOLDER_KEY, "true");
    });

    it("should set placeholder status to false", () => {
      const node = createMockTextNode();

      setPlaceholderStatus(node, false);

      expect(node.setPluginData).toHaveBeenCalledWith(PLACEHOLDER_KEY, "");
    });
  });

  describe("buildTextNodeInfo", () => {
    it("should build info for linked node", () => {
      const node = createMockTextNode({
        id: "node-123",
        name: "Button Label",
        characters: "Submit",
      });
      node.setPluginData(PLUGIN_DATA_KEY, "10001");

      const mockGetTranslations = vi.fn().mockReturnValue({
        en: "Submit",
        fr: "Soumettre",
      });

      const result = buildTextNodeInfo(node, mockGetTranslations);

      expect(result).toEqual({
        id: "node-123",
        name: "Button Label",
        characters: "Submit",
        multilanId: "10001",
        translations: { en: "Submit", fr: "Soumettre" },
        hasOverflow: false,
        isPlaceholder: false,
      });
    });

    it("should build info for unlinked node", () => {
      const node = createMockTextNode({
        id: "node-456",
        name: "Some Text",
        characters: "Hello World",
      });

      const mockGetTranslations = vi.fn().mockReturnValue(null);

      const result = buildTextNodeInfo(node, mockGetTranslations);

      expect(result).toEqual({
        id: "node-456",
        name: "Some Text",
        characters: "Hello World",
        multilanId: null,
        translations: null,
        hasOverflow: false,
        isPlaceholder: false,
      });
      expect(mockGetTranslations).not.toHaveBeenCalled();
    });

    it("should identify placeholder nodes", () => {
      const node = createMockTextNode();
      node.setPluginData(PLUGIN_DATA_KEY, "10001");
      node.setPluginData(PLACEHOLDER_KEY, "true");

      const mockGetTranslations = vi.fn().mockReturnValue(null);

      const result = buildTextNodeInfo(node, mockGetTranslations);

      expect(result.isPlaceholder).toBe(true);
    });
  });
});
