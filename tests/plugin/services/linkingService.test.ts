import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockTextNode, setupFigmaMock, sampleTranslationMap } from "../../setup";
import { PLUGIN_DATA_KEY, PLACEHOLDER_KEY } from "../../../src/shared/types";

// We need to mock the figma global before importing the service
let mockFigma: ReturnType<typeof setupFigmaMock>;

beforeEach(() => {
  mockFigma = setupFigmaMock();
});

describe("linkingService", () => {
  describe("linkTextNode", () => {
    it("should link a text node to a multilanId", async () => {
      const { linkTextNode } = await import("../../../src/plugin/services/linkingService");

      const mockNode = createMockTextNode({ id: "node-1" });
      mockFigma.getNodeByIdAsync.mockResolvedValue(mockNode);

      const result = await linkTextNode("node-1", "10001");

      expect(result).toBe(true);
      expect(mockNode.setPluginData).toHaveBeenCalledWith(PLUGIN_DATA_KEY, "10001");
    });

    it("should return false for non-existent node", async () => {
      const { linkTextNode } = await import("../../../src/plugin/services/linkingService");

      mockFigma.getNodeByIdAsync.mockResolvedValue(null);

      const result = await linkTextNode("non-existent", "10001");

      expect(result).toBe(false);
    });

    it("should clear placeholder status when linking", async () => {
      const { linkTextNode } = await import("../../../src/plugin/services/linkingService");

      const mockNode = createMockTextNode({ id: "node-1" });
      mockNode.setPluginData(PLACEHOLDER_KEY, "true");
      mockFigma.getNodeByIdAsync.mockResolvedValue(mockNode);

      await linkTextNode("node-1", "10001");

      // Should clear placeholder status
      expect(mockNode.setPluginData).toHaveBeenCalledWith(PLACEHOLDER_KEY, "");
    });
  });

  describe("unlinkTextNode", () => {
    it("should unlink a text node", async () => {
      const { unlinkTextNode } = await import("../../../src/plugin/services/linkingService");

      const mockNode = createMockTextNode({ id: "node-1" });
      mockNode.setPluginData(PLUGIN_DATA_KEY, "10001");
      mockFigma.getNodeByIdAsync.mockResolvedValue(mockNode);

      const result = await unlinkTextNode("node-1");

      expect(result).toBe(true);
      expect(mockNode.setPluginData).toHaveBeenCalledWith(PLUGIN_DATA_KEY, "");
    });

    it("should return false for non-existent node", async () => {
      const { unlinkTextNode } = await import("../../../src/plugin/services/linkingService");

      mockFigma.getNodeByIdAsync.mockResolvedValue(null);

      const result = await unlinkTextNode("non-existent");

      expect(result).toBe(false);
    });
  });

  describe("unlinkTextNode with placeholder", () => {
    it("should clear placeholder status when unlinking placeholder node", async () => {
      const { unlinkTextNode } = await import("../../../src/plugin/services/linkingService");

      const mockNode = createMockTextNode({ id: "node-1" });
      mockNode.setPluginData(PLUGIN_DATA_KEY, "10001");
      mockNode.setPluginData(PLACEHOLDER_KEY, "true");
      mockFigma.getNodeByIdAsync.mockResolvedValue(mockNode);

      await unlinkTextNode("node-1");

      expect(mockNode.setPluginData).toHaveBeenCalledWith(PLACEHOLDER_KEY, "");
      expect(mockNode.setPluginData).toHaveBeenCalledWith(PLUGIN_DATA_KEY, "");
    });
  });

  describe("markAsPlaceholder", () => {
    it("should mark node as placeholder with stars around text", async () => {
      const { markAsPlaceholder } = await import("../../../src/plugin/services/linkingService");

      const mockNode = createMockTextNode({ id: "node-1" });

      await markAsPlaceholder(mockNode, "Placeholder text");

      expect(mockNode.setPluginData).toHaveBeenCalledWith(PLUGIN_DATA_KEY, ""); // unlinked
      expect(mockNode.setPluginData).toHaveBeenCalledWith(PLACEHOLDER_KEY, "true");
      expect(mockNode.characters).toBe("*Placeholder text*");
    });

    it("should unlink existing linked node when marking as placeholder", async () => {
      const { markAsPlaceholder } = await import("../../../src/plugin/services/linkingService");

      const mockNode = createMockTextNode({ id: "node-1" });
      mockNode.setPluginData(PLUGIN_DATA_KEY, "10001"); // already linked

      await markAsPlaceholder(mockNode, "New placeholder");

      expect(mockNode.setPluginData).toHaveBeenCalledWith(PLUGIN_DATA_KEY, ""); // unlinked
      expect(mockNode.characters).toBe("*New placeholder*");
    });
  });

  describe("switchLanguage", () => {
    it("should update linked nodes with translations", async () => {
      const { switchLanguage } = await import("../../../src/plugin/services/linkingService");

      const mockNode = createMockTextNode({
        id: "node-1",
        characters: "Submit",
      });
      mockNode.setPluginData(PLUGIN_DATA_KEY, "10001");
      (mockNode as unknown as { width: number }).width = 100;

      mockFigma.currentPage.findAll.mockReturnValue([mockNode]);

      const result = await switchLanguage(sampleTranslationMap, "fr", "page");

      expect(result.success).toBe(1);
      expect(mockNode.characters).toBe("Soumettre");
    });

    it("should skip unlinked nodes", async () => {
      const { switchLanguage } = await import("../../../src/plugin/services/linkingService");

      const mockNode = createMockTextNode({
        id: "node-1",
        characters: "Some text",
      });

      mockFigma.currentPage.findAll.mockReturnValue([mockNode]);

      const result = await switchLanguage(sampleTranslationMap, "fr", "page");

      expect(result.success).toBe(0);
    });

    it("should report missing and show placeholder when translation unavailable", async () => {
      const { switchLanguage } = await import("../../../src/plugin/services/linkingService");

      // Use a translation that only has English (no French)
      const limitedTranslations = {
        "99999": { en: "English only" },
      };

      const mockNode = createMockTextNode({
        id: "node-1",
        characters: "Test",
      });
      mockNode.setPluginData(PLUGIN_DATA_KEY, "99999");
      (mockNode as unknown as { width: number }).width = 100;

      mockFigma.currentPage.findAll.mockReturnValue([mockNode]);

      const result = await switchLanguage(limitedTranslations, "fr", "page");

      expect(result.success).toBe(1);
      expect(result.missing).toContain("node-1");
      expect(mockNode.characters).toBe("*Multilan not available*");
    });

    it("should skip nodes that fail to update and not count them", async () => {
      const { switchLanguage } = await import("../../../src/plugin/services/linkingService");

      const mockNode = createMockTextNode({
        id: "node-1",
        characters: "Submit",
      });
      mockNode.setPluginData(PLUGIN_DATA_KEY, "10001");

      // Simulate a failed text update (e.g. font not loaded) by making the
      // characters assignment throw — switchLanguage should catch and skip it.
      Object.defineProperty(mockNode, "characters", {
        get: () => "Submit",
        set: () => {
          throw new Error("cannot set characters");
        },
        configurable: true,
      });

      mockFigma.currentPage.findAll.mockReturnValue([mockNode]);

      const result = await switchLanguage(sampleTranslationMap, "fr", "page");

      // Should skip node whose update threw
      expect(result.success).toBe(0);
    });
  });

  describe("createLinkedTextNode", () => {
    it("should create a text node linked to multilanId", async () => {
      const { createLinkedTextNode } = await import("../../../src/plugin/services/linkingService");

      const result = await createLinkedTextNode(sampleTranslationMap, "10001", "Submit", "en");

      expect(figma.createText).toHaveBeenCalled();
      expect(result.characters).toBe("Submit");
      expect(result.setPluginData).toHaveBeenCalledWith(PLUGIN_DATA_KEY, "10001");
    });

    it("should use translation for specified language", async () => {
      const { createLinkedTextNode } = await import("../../../src/plugin/services/linkingService");

      const result = await createLinkedTextNode(sampleTranslationMap, "10001", "Submit", "fr");

      expect(result.characters).toBe("Soumettre");
    });

    it("should position near selection if present", async () => {
      const { createLinkedTextNode } = await import("../../../src/plugin/services/linkingService");

      const mockSelection = { x: 100, y: 50, width: 80, height: 20 };
      (mockFigma.currentPage.selection as unknown) = [mockSelection];

      const result = await createLinkedTextNode(sampleTranslationMap, "10001", "Submit", "en");

      expect(result.x).toBe(200); // 100 + 80 + 20
      expect(result.y).toBe(50);
    });

    it("should position at viewport center if no selection", async () => {
      const { createLinkedTextNode } = await import("../../../src/plugin/services/linkingService");

      (mockFigma.currentPage.selection as unknown) = [];

      const result = await createLinkedTextNode(sampleTranslationMap, "10001", "Submit", "en");

      expect(result.x).toBe(0); // viewport.center.x
      expect(result.y).toBe(0); // viewport.center.y
    });

    it("should select and scroll to the new node", async () => {
      const { createLinkedTextNode } = await import("../../../src/plugin/services/linkingService");

      const result = await createLinkedTextNode(sampleTranslationMap, "10001", "Submit", "en");

      expect(mockFigma.currentPage.selection).toContain(result);
      expect(mockFigma.viewport.scrollAndZoomIntoView).toHaveBeenCalledWith([result]);
    });
  });
});
