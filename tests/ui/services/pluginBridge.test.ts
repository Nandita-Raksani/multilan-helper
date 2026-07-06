import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { pluginBridge } from "../../../src/ui/services/pluginBridge";

describe("pluginBridge", () => {
  let postMessageMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    postMessageMock = vi.fn();
    // Mock parent.postMessage
    vi.stubGlobal("parent", { postMessage: postMessageMock });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("send", () => {
    it("should send message to parent", () => {
      pluginBridge.send({ type: "init" });

      expect(postMessageMock).toHaveBeenCalledWith(
        { pluginMessage: { type: "init" } },
        "*"
      );
    });
  });

  describe("init", () => {
    it("should send init message", () => {
      pluginBridge.init();

      expect(postMessageMock).toHaveBeenCalledWith(
        { pluginMessage: { type: "init" } },
        "*"
      );
    });
  });

  describe("refresh", () => {
    it("should send refresh message with scope", () => {
      pluginBridge.refresh("page");

      expect(postMessageMock).toHaveBeenCalledWith(
        { pluginMessage: { type: "refresh", scope: "page" } },
        "*"
      );
    });

    it("should send refresh message with selection scope", () => {
      pluginBridge.refresh("selection");

      expect(postMessageMock).toHaveBeenCalledWith(
        { pluginMessage: { type: "refresh", scope: "selection" } },
        "*"
      );
    });
  });

  describe("switchLanguage", () => {
    it("should send switch-language message", () => {
      pluginBridge.switchLanguage("fr", "page");

      expect(postMessageMock).toHaveBeenCalledWith(
        {
          pluginMessage: {
            type: "switch-language",
            language: "fr",
            scope: "page",
          },
        },
        "*"
      );
    });
  });

  describe("globalSearch", () => {
    it("should send global-search message", () => {
      pluginBridge.globalSearch("Submit");

      expect(postMessageMock).toHaveBeenCalledWith(
        { pluginMessage: { type: "global-search", searchQuery: "Submit" } },
        "*"
      );
    });
  });

  describe("linkNode", () => {
    it("should send link-node message with language", () => {
      pluginBridge.linkNode("node-123", "10001", "fr");

      expect(postMessageMock).toHaveBeenCalledWith(
        {
          pluginMessage: {
            type: "link-node",
            nodeId: "node-123",
            multilanId: "10001",
            language: "fr",
          },
        },
        "*"
      );
    });
  });

  describe("unlinkNode", () => {
    it("should send unlink-node message", () => {
      pluginBridge.unlinkNode("node-123");

      expect(postMessageMock).toHaveBeenCalledWith(
        { pluginMessage: { type: "unlink-node", nodeId: "node-123" } },
        "*"
      );
    });
  });

  describe("selectNode", () => {
    it("should send select-node message", () => {
      pluginBridge.selectNode("node-456");

      expect(postMessageMock).toHaveBeenCalledWith(
        { pluginMessage: { type: "select-node", nodeId: "node-456" } },
        "*"
      );
    });
  });

  describe("createLinkedText", () => {
    it("should send create-linked-text message", () => {
      pluginBridge.createLinkedText("10001", "Submit", "en");

      expect(postMessageMock).toHaveBeenCalledWith(
        {
          pluginMessage: {
            type: "create-linked-text",
            multilanId: "10001",
            text: "Submit",
            language: "en",
          },
        },
        "*"
      );
    });
  });

  describe("markAsPlaceholder", () => {
    it("should send mark-as-placeholder message", () => {
      pluginBridge.markAsPlaceholder("Placeholder text");

      expect(postMessageMock).toHaveBeenCalledWith(
        {
          pluginMessage: {
            type: "mark-as-placeholder",
            text: "Placeholder text",
          },
        },
        "*"
      );
    });
  });

  describe("verifyMultilanId", () => {
    it("should send verify-multilan-id message", () => {
      pluginBridge.verifyMultilanId("node-123", "10001");

      expect(postMessageMock).toHaveBeenCalledWith(
        {
          pluginMessage: {
            type: "verify-multilan-id",
            nodeId: "node-123",
            multilanId: "10001",
          },
        },
        "*"
      );
    });
  });

  describe("detectMatch", () => {
    it("should send detect-match message", () => {
      pluginBridge.detectMatch("Submit");

      expect(postMessageMock).toHaveBeenCalledWith(
        { pluginMessage: { type: "detect-match", text: "Submit" } },
        "*"
      );
    });
  });

  describe("getUnlinkedQueue", () => {
    it("should send get-unlinked-queue message with scope", () => {
      pluginBridge.getUnlinkedQueue("selection");

      expect(postMessageMock).toHaveBeenCalledWith(
        { pluginMessage: { type: "get-unlinked-queue", scope: "selection" } },
        "*"
      );
    });
  });

  describe("highlightUnlinked", () => {
    it("should send highlight-unlinked message", () => {
      pluginBridge.highlightUnlinked(true, "page");

      expect(postMessageMock).toHaveBeenCalledWith(
        {
          pluginMessage: {
            type: "highlight-unlinked",
            highlight: true,
            scope: "page",
          },
        },
        "*"
      );
    });
  });

  describe("switchFolder", () => {
    it("should send switch-folder message", () => {
      pluginBridge.switchFolder("Marketing");

      expect(postMessageMock).toHaveBeenCalledWith(
        { pluginMessage: { type: "switch-folder", folderName: "Marketing" } },
        "*"
      );
    });
  });

  describe("findCloseMatches", () => {
    it("should send find-close-matches message", () => {
      pluginBridge.findCloseMatches("node-123", "Submit");

      expect(postMessageMock).toHaveBeenCalledWith(
        {
          pluginMessage: {
            type: "find-close-matches",
            nodeId: "node-123",
            text: "Submit",
          },
        },
        "*"
      );
    });
  });

  describe("clearSelection", () => {
    it("should send clear-selection message", () => {
      pluginBridge.clearSelection();

      expect(postMessageMock).toHaveBeenCalledWith(
        { pluginMessage: { type: "clear-selection" } },
        "*"
      );
    });
  });

  describe("resizeUi", () => {
    it("should send resize-ui message with dimensions (not collapsed by default)", () => {
      pluginBridge.resizeUi(400, 600);

      expect(postMessageMock).toHaveBeenCalledWith(
        { pluginMessage: { type: "resize-ui", width: 400, height: 600, collapsed: false } },
        "*"
      );
    });

    it("should mark the message collapsed when requested", () => {
      pluginBridge.resizeUi(400, 33, true);

      expect(postMessageMock).toHaveBeenCalledWith(
        { pluginMessage: { type: "resize-ui", width: 400, height: 33, collapsed: true } },
        "*"
      );
    });
  });

  describe("subscribe", () => {
    it("should call handler when message is received", () => {
      const handler = vi.fn();
      pluginBridge.subscribe(handler);

      // Simulate receiving a message
      const event = new MessageEvent("message", {
        data: { pluginMessage: { type: "init", canEdit: true } },
      });
      window.dispatchEvent(event);

      expect(handler).toHaveBeenCalledWith({ type: "init", canEdit: true });
    });

    it("should ignore messages without pluginMessage", () => {
      const handler = vi.fn();
      pluginBridge.subscribe(handler);

      const event = new MessageEvent("message", {
        data: { someOtherData: true },
      });
      window.dispatchEvent(event);

      expect(handler).not.toHaveBeenCalled();
    });

    it("should return unsubscribe function", () => {
      const handler = vi.fn();
      const unsubscribe = pluginBridge.subscribe(handler);

      unsubscribe();

      const event = new MessageEvent("message", {
        data: { pluginMessage: { type: "init" } },
      });
      window.dispatchEvent(event);

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
