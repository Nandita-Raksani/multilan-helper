import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { setupUIFixture, mockParentPostMessage, sampleTextNodes } from "../setup";
import { store } from "../../../src/ui/state/store";
import { initLinksPanel, renderTextList } from "../../../src/ui/components/LinksPanel";

describe("LinksPanel", () => {
  let postMessageMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setupUIFixture();
    postMessageMock = mockParentPostMessage();
    store.setState({
      canEdit: true,
      currentLang: "en",
      scope: "page",
      textNodes: [],
      selectedNode: null,
      placeholders: { username: "John", count: "5" },
      bulkLinkResults: null,
      globalSearchResults: [],
      allTranslations: [],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("initLinksPanel", () => {
    it("should set up scope toggle handlers", () => {
      initLinksPanel();

      const selectionBtn = document.querySelector('[data-scope="selection"]') as HTMLButtonElement;
      selectionBtn.click();

      expect(store.getState().scope).toBe("selection");
      expect(selectionBtn.classList.contains("active")).toBe(true);
    });

    it("should send refresh message on scope change", () => {
      initLinksPanel();

      const selectionBtn = document.querySelector('[data-scope="selection"]') as HTMLButtonElement;
      selectionBtn.click();

      expect(postMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginMessage: expect.objectContaining({
            type: "refresh",
            scope: "selection",
          }),
        }),
        "*"
      );
    });

    it("should trigger auto-link when scope button is clicked", () => {
      initLinksPanel();

      const pageBtn = document.querySelector('[data-scope="page"]') as HTMLButtonElement;
      pageBtn.click();

      expect(postMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginMessage: expect.objectContaining({
            type: "bulk-auto-link",
            scope: "page",
          }),
        }),
        "*"
      );
    });

    it("should prevent scope click in view mode", () => {
      store.setState({ canEdit: false });
      initLinksPanel();

      // Mock alert
      const alertMock = vi.fn();
      vi.stubGlobal("alert", alertMock);

      const pageBtn = document.querySelector('[data-scope="page"]') as HTMLButtonElement;
      pageBtn.click();

      expect(alertMock).toHaveBeenCalledWith("You do not have edit permissions");
    });

    it("should filter text list on search input", () => {
      store.setState({ textNodes: sampleTextNodes });
      initLinksPanel();
      renderTextList();

      const searchInput = document.getElementById("textSearch") as HTMLInputElement;
      searchInput.value = "Submit";
      searchInput.dispatchEvent(new Event("input"));

      const textList = document.getElementById("textList");
      expect(textList?.querySelectorAll(".text-item").length).toBe(1);
    });
  });

  describe("renderTextList", () => {
    it("should render text nodes", () => {
      store.setState({ textNodes: sampleTextNodes });
      renderTextList();

      const textList = document.getElementById("textList");
      const items = textList?.querySelectorAll(".text-item");

      expect(items?.length).toBe(3);
    });

    it("should show empty state when no nodes", () => {
      store.setState({ textNodes: [] });
      renderTextList();

      const textList = document.getElementById("textList");
      expect(textList?.textContent).toContain("No text layers found");
    });

    it("should apply linked class to linked nodes", () => {
      store.setState({ textNodes: sampleTextNodes });
      renderTextList();

      const linkedItem = document.querySelector('[data-id="node-1"]');
      expect(linkedItem?.classList.contains("linked")).toBe(true);
    });

    it("should apply unlinked class to unlinked nodes", () => {
      store.setState({ textNodes: sampleTextNodes });
      renderTextList();

      const unlinkedItem = document.querySelector('[data-id="node-2"]');
      expect(unlinkedItem?.classList.contains("unlinked")).toBe(true);
    });

    it("should show link button for unlinked nodes", () => {
      store.setState({ textNodes: sampleTextNodes });
      renderTextList();

      const unlinkedItem = document.querySelector('[data-id="node-2"]');
      expect(unlinkedItem?.querySelector(".btn-link-node")).not.toBeNull();
    });

    it("should show unlink button for linked nodes", () => {
      store.setState({ textNodes: sampleTextNodes });
      renderTextList();

      const linkedItem = document.querySelector('[data-id="node-1"]');
      expect(linkedItem?.querySelector(".btn-unlink-node")).not.toBeNull();
    });

    it("should handle unlink button click", () => {
      store.setState({ textNodes: sampleTextNodes });
      initLinksPanel();
      renderTextList();

      const unlinkBtn = document.querySelector('[data-id="node-1"] .btn-unlink-node') as HTMLButtonElement;
      unlinkBtn.click();

      expect(postMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginMessage: expect.objectContaining({
            type: "unlink-node",
            nodeId: "node-1",
          }),
        }),
        "*"
      );
    });

    it("should filter by name", () => {
      store.setState({ textNodes: sampleTextNodes });
      initLinksPanel();
      renderTextList();

      const searchInput = document.getElementById("textSearch") as HTMLInputElement;
      searchInput.value = "Button";
      searchInput.dispatchEvent(new Event("input"));

      const items = document.querySelectorAll(".text-item");
      expect(items.length).toBe(2); // Submit Button, Cancel Button
    });

    it("should filter by multilanId", () => {
      store.setState({ textNodes: sampleTextNodes });
      initLinksPanel();
      renderTextList();

      const searchInput = document.getElementById("textSearch") as HTMLInputElement;
      searchInput.value = "10001";
      searchInput.dispatchEvent(new Event("input"));

      const items = document.querySelectorAll(".text-item");
      expect(items.length).toBe(1);
    });

    it("should show translation text for current language", () => {
      store.setState({ textNodes: sampleTextNodes, currentLang: "fr" });
      renderTextList();

      const linkedItem = document.querySelector('[data-id="node-1"]');
      expect(linkedItem?.querySelector(".text-item-content")?.textContent).toBe("Soumettre");
    });

    it("should select node and trigger search when text item clicked", async () => {
      vi.useFakeTimers();
      store.setState({ textNodes: sampleTextNodes });
      initLinksPanel();
      renderTextList();

      const textItem = document.querySelector('[data-id="node-1"]') as HTMLDivElement;
      textItem.click();

      // Should send select-node message
      expect(postMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginMessage: expect.objectContaining({
            type: "select-node",
            nodeId: "node-1",
          }),
        }),
        "*"
      );

      // Advance timers for the setTimeout
      vi.advanceTimersByTime(60);

      // Should send global-search message
      expect(postMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginMessage: expect.objectContaining({
            type: "global-search",
          }),
        }),
        "*"
      );

      vi.useRealTimers();
    });

    it("should select node and search when link button clicked", async () => {
      vi.useFakeTimers();
      store.setState({ textNodes: sampleTextNodes });
      initLinksPanel();
      renderTextList();

      const linkBtn = document.querySelector('[data-id="node-2"] .btn-link-node') as HTMLButtonElement;
      linkBtn.click();

      // Should send select-node message
      expect(postMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginMessage: expect.objectContaining({
            type: "select-node",
            nodeId: "node-2",
          }),
        }),
        "*"
      );

      // Advance timers for the setTimeout
      vi.advanceTimersByTime(60);

      // Should send global-search message
      expect(postMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginMessage: expect.objectContaining({
            type: "global-search",
          }),
        }),
        "*"
      );

      vi.useRealTimers();
    });

    it("should not trigger text item click handler when button is clicked", () => {
      store.setState({ textNodes: sampleTextNodes });
      initLinksPanel();
      renderTextList();

      postMessageMock.mockClear();

      const unlinkBtn = document.querySelector('[data-id="node-1"] .btn-unlink-node') as HTMLButtonElement;
      unlinkBtn.click();

      // Should only send unlink-node message, not select-node
      const calls = postMessageMock.mock.calls;
      const messageTypes = calls.map(call => call[0]?.pluginMessage?.type);
      expect(messageTypes).toContain("unlink-node");
      expect(messageTypes).not.toContain("select-node");
    });
  });
});
