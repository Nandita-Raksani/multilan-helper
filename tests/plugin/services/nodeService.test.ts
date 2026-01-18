import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockTextNode, setupFigmaMock } from "../../setup";
import {
  getMultilanId,
  setMultilanId,
  clearMultilanId,
  isPlaceholder,
  setPlaceholderStatus,
  buildTextNodeInfo,
  wrapWithStars,
  clearPlaceholderStatus,
  getTextNodesInScope,
  getAllTextNodesInfo,
  getSelectedTextNodeInfo,
  getTextNodeById,
  selectNode,
  loadNodeFont,
  updateNodeText,
  createTextNode,
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

  describe("wrapWithStars", () => {
    it("should wrap text with stars", () => {
      const result = wrapWithStars("Hello");
      expect(result).toBe("*Hello*");
    });

    it("should handle empty string", () => {
      const result = wrapWithStars("");
      expect(result).toBe("**");
    });

    it("should handle text with special characters", () => {
      const result = wrapWithStars("Hello World!");
      expect(result).toBe("*Hello World!*");
    });
  });

  describe("clearPlaceholderStatus", () => {
    it("should clear placeholder flag", () => {
      const node = createMockTextNode();
      node.setPluginData(PLACEHOLDER_KEY, "true");

      clearPlaceholderStatus(node);

      expect(node.setPluginData).toHaveBeenCalledWith(PLACEHOLDER_KEY, "");
    });
  });

  describe("getTextNodesInScope", () => {
    it("should return all text nodes from page", () => {
      const mockNode1 = createMockTextNode({ id: "node-1" });
      const mockNode2 = createMockTextNode({ id: "node-2" });

      (figma.currentPage.findAll as ReturnType<typeof vi.fn>).mockReturnValue([mockNode1, mockNode2]);

      const result = getTextNodesInScope("page");

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("node-1");
      expect(result[1].id).toBe("node-2");
    });

    it("should return text nodes from selection when scope is selection", () => {
      const mockNode = createMockTextNode({ id: "selected-node" });
      (figma.currentPage.selection as unknown) = [mockNode];

      const result = getTextNodesInScope("selection");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("selected-node");
    });

    it("should find text nodes within frame selection", () => {
      const mockTextNode = createMockTextNode({ id: "nested-text" });
      const mockFrame = {
        type: "FRAME",
        findAll: vi.fn().mockReturnValue([mockTextNode]),
      };
      (figma.currentPage.selection as unknown) = [mockFrame];

      const result = getTextNodesInScope("selection");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("nested-text");
    });
  });

  describe("getAllTextNodesInfo", () => {
    it("should return info for all text nodes", () => {
      const mockNode1 = createMockTextNode({ id: "node-1", characters: "Text 1" });
      const mockNode2 = createMockTextNode({ id: "node-2", characters: "Text 2" });

      (figma.currentPage.findAll as ReturnType<typeof vi.fn>).mockReturnValue([mockNode1, mockNode2]);

      const mockGetTranslations = vi.fn().mockReturnValue(null);
      const result = getAllTextNodesInfo("page", mockGetTranslations);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("node-1");
      expect(result[1].id).toBe("node-2");
    });
  });

  describe("getSelectedTextNodeInfo", () => {
    it("should return info for selected text node", () => {
      const mockNode = createMockTextNode({ id: "selected", name: "Selected", characters: "Hello" });
      mockNode.setPluginData(PLUGIN_DATA_KEY, "10001");
      (figma.currentPage.selection as unknown) = [mockNode];

      const mockGetTranslations = vi.fn().mockReturnValue({ en: "Hello" });
      const result = getSelectedTextNodeInfo(mockGetTranslations);

      expect(result).not.toBeNull();
      expect(result!.id).toBe("selected");
      expect(result!.multilanId).toBe("10001");
    });

    it("should return null if no selection", () => {
      (figma.currentPage.selection as unknown) = [];

      const mockGetTranslations = vi.fn();
      const result = getSelectedTextNodeInfo(mockGetTranslations);

      expect(result).toBeNull();
    });

    it("should return null if selection is not a text node", () => {
      const mockFrame = { type: "FRAME", id: "frame-1" };
      (figma.currentPage.selection as unknown) = [mockFrame];

      const mockGetTranslations = vi.fn();
      const result = getSelectedTextNodeInfo(mockGetTranslations);

      expect(result).toBeNull();
    });

    it("should return null if multiple nodes selected", () => {
      const mockNode1 = createMockTextNode({ id: "node-1" });
      const mockNode2 = createMockTextNode({ id: "node-2" });
      (figma.currentPage.selection as unknown) = [mockNode1, mockNode2];

      const mockGetTranslations = vi.fn();
      const result = getSelectedTextNodeInfo(mockGetTranslations);

      expect(result).toBeNull();
    });
  });

  describe("getTextNodeById", () => {
    it("should return text node by ID", async () => {
      const mockNode = createMockTextNode({ id: "node-123" });
      (figma.getNodeByIdAsync as ReturnType<typeof vi.fn>).mockResolvedValue(mockNode);

      const result = await getTextNodeById("node-123");

      expect(result).toBe(mockNode);
    });

    it("should return null for non-existent node", async () => {
      (figma.getNodeByIdAsync as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await getTextNodeById("non-existent");

      expect(result).toBeNull();
    });

    it("should return null for non-text node", async () => {
      const mockFrame = { type: "FRAME", id: "frame-1" };
      (figma.getNodeByIdAsync as ReturnType<typeof vi.fn>).mockResolvedValue(mockFrame);

      const result = await getTextNodeById("frame-1");

      expect(result).toBeNull();
    });
  });

  describe("selectNode", () => {
    it("should select node and scroll into view", async () => {
      const mockNode = createMockTextNode({ id: "node-123" });
      (figma.getNodeByIdAsync as ReturnType<typeof vi.fn>).mockResolvedValue(mockNode);

      await selectNode("node-123");

      expect(figma.currentPage.selection).toContain(mockNode);
      expect(figma.viewport.scrollAndZoomIntoView).toHaveBeenCalledWith([mockNode]);
    });

    it("should handle non-existent node gracefully", async () => {
      (figma.getNodeByIdAsync as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(selectNode("non-existent")).resolves.not.toThrow();
    });
  });

  describe("loadNodeFont", () => {
    it("should load single font", async () => {
      const mockNode = createMockTextNode();
      (mockNode as unknown as { fontName: FontName }).fontName = { family: "Roboto", style: "Bold" };

      await loadNodeFont(mockNode);

      expect(figma.loadFontAsync).toHaveBeenCalledWith({ family: "Roboto", style: "Bold" });
    });

    it("should load mixed fonts", async () => {
      const mockNode = createMockTextNode({ characters: "AB" });
      (mockNode as unknown as { fontName: symbol }).fontName = figma.mixed;
      (mockNode.getRangeFontName as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce({ family: "Inter", style: "Regular" })
        .mockReturnValueOnce({ family: "Roboto", style: "Bold" });

      await loadNodeFont(mockNode);

      expect(figma.loadFontAsync).toHaveBeenCalledTimes(2);
    });
  });

  describe("updateNodeText", () => {
    it("should load font and update text", async () => {
      const mockNode = createMockTextNode();

      await updateNodeText(mockNode, "New text");

      expect(figma.loadFontAsync).toHaveBeenCalled();
      expect(mockNode.characters).toBe("New text");
    });
  });

  describe("createTextNode", () => {
    it("should create text node with given text", async () => {
      const result = await createTextNode("Hello World");

      expect(figma.createText).toHaveBeenCalled();
      expect(figma.loadFontAsync).toHaveBeenCalledWith({ family: "Inter", style: "Regular" });
      expect(result.characters).toBe("Hello World");
    });

    it("should position at given coordinates", async () => {
      const result = await createTextNode("Hello", { x: 100, y: 200 });

      expect(result.x).toBe(100);
      expect(result.y).toBe(200);
    });

    it("should position relative to selection if no position given", async () => {
      const mockSelection = { x: 50, y: 50, width: 100, height: 20 };
      (figma.currentPage.selection as unknown) = [mockSelection];

      const result = await createTextNode("Hello");

      expect(result.x).toBe(170); // 50 + 100 + 20
      expect(result.y).toBe(50);
    });
  });
});
