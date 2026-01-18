import { describe, it, expect, beforeEach } from "vitest";
import { setupUIFixture } from "../setup";
import { setStatus, setBuildTimestamp, setViewMode } from "../../../src/ui/components/StatusBar";

describe("StatusBar", () => {
  beforeEach(() => {
    setupUIFixture();
  });

  describe("setStatus", () => {
    it("should update status text", () => {
      setStatus("Loading...");

      const statusText = document.getElementById("statusText");
      expect(statusText?.textContent).toBe("Loading...");
    });

    it("should update to translation count", () => {
      setStatus("150 translations loaded");

      const statusText = document.getElementById("statusText");
      expect(statusText?.textContent).toBe("150 translations loaded");
    });
  });

  describe("setBuildTimestamp", () => {
    it("should update build timestamp", () => {
      setBuildTimestamp("2024-01-15 10:30");

      const timestamp = document.getElementById("buildTimestamp");
      expect(timestamp?.textContent).toBe("Updated: 2024-01-15 10:30");
    });
  });

  describe("setViewMode", () => {
    it("should show view mode banner when true", () => {
      setViewMode(true);

      const banner = document.getElementById("viewModeBanner");
      expect(banner?.style.display).toBe("block");
    });

    it("should hide view mode banner when false", () => {
      setViewMode(false);

      const banner = document.getElementById("viewModeBanner");
      expect(banner?.style.display).toBe("none");
    });
  });
});
