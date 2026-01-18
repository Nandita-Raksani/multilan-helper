import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  escapeHtml,
  copyToClipboard,
  getElementById,
  querySelector,
  querySelectorAll,
  createElement,
  setInnerHTML,
  addEvent,
  debounce,
  showButtonFeedback,
} from "../../../src/ui/utils/dom";

describe("dom utilities", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("escapeHtml", () => {
    it("should escape HTML special characters", () => {
      expect(escapeHtml("<script>alert('xss')</script>")).toBe(
        "&lt;script&gt;alert('xss')&lt;/script&gt;"
      );
    });

    it("should escape ampersands", () => {
      expect(escapeHtml("Tom & Jerry")).toBe("Tom &amp; Jerry");
    });

    it("should preserve quotes (textContent only escapes < > &)", () => {
      // Note: textContent doesn't escape quotes - they're safe in HTML text nodes
      expect(escapeHtml('"quoted"')).toBe('"quoted"');
    });

    it("should handle empty string", () => {
      expect(escapeHtml("")).toBe("");
    });

    it("should handle text without special characters", () => {
      expect(escapeHtml("Hello World")).toBe("Hello World");
    });
  });

  describe("copyToClipboard", () => {
    it("should copy text to clipboard", () => {
      const execCommandMock = vi.fn().mockReturnValue(true);
      document.execCommand = execCommandMock;

      const result = copyToClipboard("test text");

      expect(result).toBe(true);
      expect(execCommandMock).toHaveBeenCalledWith("copy");
    });

    it("should return false if copy fails", () => {
      document.execCommand = vi.fn().mockImplementation(() => {
        throw new Error("Copy failed");
      });

      const result = copyToClipboard("test text");

      expect(result).toBe(false);
    });

    it("should clean up textarea after copying", () => {
      document.execCommand = vi.fn().mockReturnValue(true);

      copyToClipboard("test text");

      // No textarea should remain in the document
      expect(document.querySelector("textarea")).toBeNull();
    });
  });

  describe("getElementById", () => {
    it("should return element by ID", () => {
      document.body.innerHTML = '<div id="test-element">Test</div>';

      const element = getElementById("test-element");

      expect(element).toBeDefined();
      expect(element.textContent).toBe("Test");
    });

    it("should throw error for non-existent element", () => {
      expect(() => getElementById("non-existent")).toThrow(
        'Element with id "non-existent" not found'
      );
    });
  });

  describe("querySelector", () => {
    it("should find element by selector", () => {
      document.body.innerHTML = '<div class="test-class">Test</div>';

      const element = querySelector(".test-class");

      expect(element).not.toBeNull();
      expect(element!.textContent).toBe("Test");
    });

    it("should return null for non-existent element", () => {
      const element = querySelector(".non-existent");

      expect(element).toBeNull();
    });

    it("should search within parent element", () => {
      document.body.innerHTML = `
        <div id="parent">
          <span class="child">Child</span>
        </div>
        <span class="child">Outside</span>
      `;

      const parent = document.getElementById("parent")!;
      const element = querySelector(".child", parent);

      expect(element!.textContent).toBe("Child");
    });
  });

  describe("querySelectorAll", () => {
    it("should find all matching elements", () => {
      document.body.innerHTML = `
        <div class="item">One</div>
        <div class="item">Two</div>
        <div class="item">Three</div>
      `;

      const elements = querySelectorAll(".item");

      expect(elements.length).toBe(3);
    });

    it("should return empty list for no matches", () => {
      const elements = querySelectorAll(".non-existent");

      expect(elements.length).toBe(0);
    });
  });

  describe("createElement", () => {
    it("should create element with tag", () => {
      const element = createElement("div");

      expect(element.tagName).toBe("DIV");
    });

    it("should create element with attributes", () => {
      const element = createElement("button", {
        id: "test-btn",
        class: "btn primary",
        "data-action": "submit",
      });

      expect(element.id).toBe("test-btn");
      expect(element.className).toBe("btn primary");
      expect(element.getAttribute("data-action")).toBe("submit");
    });

    it("should create element with text children", () => {
      const element = createElement("p", {}, ["Hello ", "World"]);

      expect(element.textContent).toBe("Hello World");
    });

    it("should create element with node children", () => {
      const child = document.createElement("span");
      child.textContent = "Child";

      const element = createElement("div", {}, [child]);

      expect(element.querySelector("span")!.textContent).toBe("Child");
    });
  });

  describe("setInnerHTML", () => {
    it("should set innerHTML of element", () => {
      const element = document.createElement("div");

      setInnerHTML(element, "<strong>Bold</strong>");

      expect(element.innerHTML).toBe("<strong>Bold</strong>");
    });
  });

  describe("addEvent", () => {
    it("should add event listener", () => {
      const button = document.createElement("button");
      const handler = vi.fn();

      addEvent(button, "click", handler);
      button.click();

      expect(handler).toHaveBeenCalled();
    });

    it("should return cleanup function", () => {
      const button = document.createElement("button");
      const handler = vi.fn();

      const cleanup = addEvent(button, "click", handler);
      cleanup();
      button.click();

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("debounce", () => {
    it("should debounce function calls", async () => {
      vi.useFakeTimers();
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced();
      debounced();
      debounced();

      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });

    it("should pass arguments to debounced function", async () => {
      vi.useFakeTimers();
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced("arg1", "arg2");

      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledWith("arg1", "arg2");
      vi.useRealTimers();
    });
  });

  describe("showButtonFeedback", () => {
    it("should show feedback text temporarily", () => {
      vi.useFakeTimers();
      const button = document.createElement("button");
      button.textContent = "Copy";

      showButtonFeedback(button, "Copy", "Copied!", 1000);

      expect(button.textContent).toBe("Copied!");

      vi.advanceTimersByTime(1000);

      expect(button.textContent).toBe("Copy");
      vi.useRealTimers();
    });
  });
});
