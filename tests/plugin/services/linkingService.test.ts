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
});
