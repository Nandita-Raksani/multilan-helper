import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  escapeHtml,
  copyToClipboard,
  getElementById,
  querySelectorAll,
  debounce,
} from "../../../src/ui/utils/dom";

describe("dom utilities", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("escapeHtml", () => {
    it("should escape HTML special characters", () => {
      expect(escapeHtml("<script>alert('xss')</script>")).toBe(
        "&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;"
      );
    });

    it("should escape ampersands", () => {
      expect(escapeHtml("Tom & Jerry")).toBe("Tom &amp; Jerry");
    });

    it("should escape the ampersand first to avoid double-encoding", () => {
      // If '<' were escaped before '&', the resulting '&lt;' would be
      // re-escaped into '&amp;lt;'. The correct order yields a single entity.
      expect(escapeHtml("a & <b>")).toBe("a &amp; &lt;b&gt;");
    });

    it("should escape quotes for safe attribute use", () => {
      expect(escapeHtml('"quoted"')).toBe("&quot;quoted&quot;");
      expect(escapeHtml("it's")).toBe("it&#39;s");
    });

    it("should handle empty string", () => {
      expect(escapeHtml("")).toBe("");
    });

    it("should handle text without special characters", () => {
      expect(escapeHtml("Hello World")).toBe("Hello World");
    });
  });

  describe("copyToClipboard", () => {
    it("should copy text to clipboard via execCommand", () => {
      const execCommandMock = vi.fn().mockReturnValue(true);
      document.execCommand = execCommandMock;

      const result = copyToClipboard("test text");

      expect(result).toBe(true);
      expect(execCommandMock).toHaveBeenCalledWith("copy");
    });

    it("should return false if copy throws", () => {
      document.execCommand = vi.fn().mockImplementation(() => {
        throw new Error("Copy failed");
      });

      const result = copyToClipboard("test text");

      expect(result).toBe(false);
    });

    it("should not leave a textarea in the document afterwards", () => {
      document.execCommand = vi.fn().mockReturnValue(true);

      copyToClipboard("test text");

      expect(document.querySelector("textarea")).toBeNull();
    });

    it("should clean up the textarea even when copy fails", () => {
      document.execCommand = vi.fn().mockImplementation(() => {
        throw new Error("Copy failed");
      });

      copyToClipboard("test text");

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

    it("should throw a descriptive error for a non-existent element", () => {
      expect(() => getElementById("non-existent")).toThrow(
        'Element with id "non-existent" not found'
      );
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

    it("should return an empty list for no matches", () => {
      const elements = querySelectorAll(".non-existent");

      expect(elements.length).toBe(0);
    });

    it("should scope the search to the provided root", () => {
      document.body.innerHTML = `
        <div id="parent">
          <span class="child">Inside</span>
        </div>
        <span class="child">Outside</span>
      `;

      const parent = document.getElementById("parent")!;
      const elements = querySelectorAll<HTMLElement>(".child", parent);

      expect(elements.length).toBe(1);
      expect(elements[0].textContent).toBe("Inside");
    });
  });

  describe("debounce", () => {
    it("should coalesce rapid calls into a single invocation", () => {
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

    it("should not fire before the delay elapses", () => {
      vi.useFakeTimers();
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced();
      vi.advanceTimersByTime(99);
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(fn).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });

    it("should invoke with the arguments of the most recent call", () => {
      vi.useFakeTimers();
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced("first");
      debounced("second");

      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith("second");
      vi.useRealTimers();
    });
  });
});
