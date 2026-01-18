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

  describe("bulkAutoLink", () => {
    it("should find exact matches", async () => {
      const { bulkAutoLink } = await import("../../../src/plugin/services/linkingService");

      const mockNode = createMockTextNode({
        id: "node-1",
        name: "Button",
        characters: "Submit",
      });

      mockFigma.currentPage.findAll.mockReturnValue([mockNode]);

      const result = bulkAutoLink(sampleTranslationMap, "page");

      expect(result.exactMatches.length).toBe(1);
      expect(result.exactMatches[0]).toEqual({
        nodeId: "node-1",
        nodeName: "Button",
        text: "Submit",
        multilanId: "10001",
      });
    });

    it("should skip already linked nodes", async () => {
      const { bulkAutoLink } = await import("../../../src/plugin/services/linkingService");

      const mockNode = createMockTextNode({
        id: "node-1",
        name: "Button",
        characters: "Submit",
      });
      mockNode.setPluginData(PLUGIN_DATA_KEY, "10001");

      mockFigma.currentPage.findAll.mockReturnValue([mockNode]);

      const result = bulkAutoLink(sampleTranslationMap, "page");

      expect(result.exactMatches.length).toBe(0);
      expect(result.fuzzyMatches.length).toBe(0);
      expect(result.unmatched.length).toBe(0);
    });

    it("should find fuzzy matches", async () => {
      const { bulkAutoLink } = await import("../../../src/plugin/services/linkingService");

      const mockNode = createMockTextNode({
        id: "node-1",
        name: "Button",
        characters: "Submit Now", // Partial match
      });

      mockFigma.currentPage.findAll.mockReturnValue([mockNode]);

      const result = bulkAutoLink(sampleTranslationMap, "page");

      expect(result.exactMatches.length).toBe(0);
      expect(result.fuzzyMatches.length).toBe(1);
      expect(result.fuzzyMatches[0].suggestions.length).toBeGreaterThan(0);
    });

    it("should identify unmatched nodes", async () => {
      const { bulkAutoLink } = await import("../../../src/plugin/services/linkingService");

      const mockNode = createMockTextNode({
        id: "node-1",
        name: "Random",
        characters: "xyz123abc",
      });

      mockFigma.currentPage.findAll.mockReturnValue([mockNode]);

      const result = bulkAutoLink(sampleTranslationMap, "page");

      expect(result.exactMatches.length).toBe(0);
      expect(result.fuzzyMatches.length).toBe(0);
      expect(result.unmatched.length).toBe(1);
    });
  });

  describe("applyExactMatches", () => {
    it("should apply multiple matches", async () => {
      const { applyExactMatches } = await import("../../../src/plugin/services/linkingService");

      const mockNode1 = createMockTextNode({ id: "node-1" });
      const mockNode2 = createMockTextNode({ id: "node-2" });

      mockFigma.getNodeByIdAsync.mockImplementation((id: string) => {
        if (id === "node-1") return Promise.resolve(mockNode1);
        if (id === "node-2") return Promise.resolve(mockNode2);
        return Promise.resolve(null);
      });

      const matches = [
        { nodeId: "node-1", multilanId: "10001" },
        { nodeId: "node-2", multilanId: "10002" },
      ];

      const count = await applyExactMatches(matches);

      expect(count).toBe(2);
      expect(mockNode1.setPluginData).toHaveBeenCalledWith(PLUGIN_DATA_KEY, "10001");
      expect(mockNode2.setPluginData).toHaveBeenCalledWith(PLUGIN_DATA_KEY, "10002");
    });

    it("should handle failed links", async () => {
      const { applyExactMatches } = await import("../../../src/plugin/services/linkingService");

      mockFigma.getNodeByIdAsync.mockResolvedValue(null);

      const matches = [
        { nodeId: "node-1", multilanId: "10001" },
        { nodeId: "node-2", multilanId: "10002" },
      ];

      const count = await applyExactMatches(matches);

      expect(count).toBe(0);
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
    it("should mark node as placeholder with styling", async () => {
      const { markAsPlaceholder } = await import("../../../src/plugin/services/linkingService");

      const mockNode = createMockTextNode({ id: "node-1" });
      (mockNode as unknown as { fills: unknown[] }).fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];

      await markAsPlaceholder(mockNode, "placeholder_123", "Placeholder text");

      expect(mockNode.setPluginData).toHaveBeenCalledWith(PLUGIN_DATA_KEY, "placeholder_123");
      expect(mockNode.setPluginData).toHaveBeenCalledWith(PLACEHOLDER_KEY, "true");
      expect(mockNode.characters).toBe("Placeholder text");
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

      const result = await switchLanguage(sampleTranslationMap, "fr", "page", {});

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

      const result = await switchLanguage(sampleTranslationMap, "fr", "page", {});

      expect(result.success).toBe(0);
    });

    it("should fallback to English and report missing", async () => {
      const { switchLanguage } = await import("../../../src/plugin/services/linkingService");

      // Use a translation that only has English
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

      const result = await switchLanguage(limitedTranslations, "fr", "page", {});

      expect(result.success).toBe(1);
      expect(result.missing).toContain("node-1");
      expect(mockNode.characters).toBe("English only");
    });

    it("should replace placeholders in translations", async () => {
      const { switchLanguage } = await import("../../../src/plugin/services/linkingService");

      const mockNode = createMockTextNode({
        id: "node-1",
        characters: "Hello {username}",
      });
      mockNode.setPluginData(PLUGIN_DATA_KEY, "10003");
      (mockNode as unknown as { width: number }).width = 100;

      mockFigma.currentPage.findAll.mockReturnValue([mockNode]);

      const result = await switchLanguage(sampleTranslationMap, "en", "page", { username: "Alice" });

      expect(result.success).toBe(1);
      expect(mockNode.characters).toBe("Hello Alice");
    });

    it("should handle font loading errors gracefully", async () => {
      const { switchLanguage } = await import("../../../src/plugin/services/linkingService");

      const mockNode = createMockTextNode({
        id: "node-1",
        characters: "Submit",
      });
      mockNode.setPluginData(PLUGIN_DATA_KEY, "10001");

      mockFigma.currentPage.findAll.mockReturnValue([mockNode]);
      mockFigma.loadFontAsync.mockRejectedValue(new Error("Font not found"));

      const result = await switchLanguage(sampleTranslationMap, "fr", "page", {});

      // Should skip node with font error
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

  describe("bulkAutoLink edge cases", () => {
    it("should skip empty text nodes", async () => {
      const { bulkAutoLink } = await import("../../../src/plugin/services/linkingService");

      const mockNode = createMockTextNode({
        id: "node-1",
        name: "Empty",
        characters: "   ",
      });

      mockFigma.currentPage.findAll.mockReturnValue([mockNode]);

      const result = bulkAutoLink(sampleTranslationMap, "page");

      expect(result.exactMatches.length).toBe(0);
      expect(result.fuzzyMatches.length).toBe(0);
      expect(result.unmatched.length).toBe(0);
    });

    it("should include placeholder nodes for relinking", async () => {
      const { bulkAutoLink } = await import("../../../src/plugin/services/linkingService");

      const mockNode = createMockTextNode({
        id: "node-1",
        name: "Button",
        characters: "Submit",
      });
      mockNode.setPluginData(PLUGIN_DATA_KEY, "old-id");
      mockNode.setPluginData(PLACEHOLDER_KEY, "true");

      mockFigma.currentPage.findAll.mockReturnValue([mockNode]);

      const result = bulkAutoLink(sampleTranslationMap, "page");

      expect(result.exactMatches.length).toBe(1);
    });

    it("should use selection scope when specified", async () => {
      const { bulkAutoLink } = await import("../../../src/plugin/services/linkingService");

      const mockNode = createMockTextNode({
        id: "selected-node",
        name: "Button",
        characters: "Submit",
      });

      (mockFigma.currentPage.selection as unknown) = [mockNode];

      const result = bulkAutoLink(sampleTranslationMap, "selection");

      expect(result.exactMatches.length).toBe(1);
      expect(result.exactMatches[0].nodeId).toBe("selected-node");
    });
  });
});
