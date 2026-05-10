import { describe, it, expect, beforeEach, vi } from "vitest";
import { setupFigmaMock } from "../../setup";
import {
  isQuotaError,
  clearFolderCache,
  touchFolder,
  findLruFolder,
  setFolderTraData,
} from "../../../src/plugin/services/storageService";

const FOLDERS = ["EB", "EBB", "PCB"] as const;

describe("storageService", () => {
  beforeEach(() => {
    setupFigmaMock();
  });

  describe("isQuotaError", () => {
    it("matches messages mentioning 'quota'", () => {
      expect(isQuotaError(new Error("clientStorage quota exceeded"))).toBe(true);
    });

    it("matches messages mentioning '5MB' or '5 MB'", () => {
      expect(isQuotaError(new Error("Cannot save data exceeding the 5MB limit"))).toBe(true);
      expect(isQuotaError(new Error("data exceeds 5 MB clientStorage cap"))).toBe(true);
    });

    it("does not match unrelated errors", () => {
      expect(isQuotaError(new Error("network down"))).toBe(false);
      expect(isQuotaError(new TypeError("undefined is not a function"))).toBe(false);
    });

    it("returns false for non-Error throws", () => {
      expect(isQuotaError("quota")).toBe(false);
      expect(isQuotaError(null)).toBe(false);
    });
  });

  describe("clearFolderCache", () => {
    it("removes data, metadata, and lastUsed for the folder", async () => {
      await figma.clientStorage.setAsync("traData_EB", "data");
      await figma.clientStorage.setAsync("traMetadata_EB", { foo: 1 });
      await figma.clientStorage.setAsync("traLastUsed_EB", 123);

      await clearFolderCache("EB");

      expect(await figma.clientStorage.getAsync("traData_EB")).toBeUndefined();
      expect(await figma.clientStorage.getAsync("traMetadata_EB")).toBeUndefined();
      expect(await figma.clientStorage.getAsync("traLastUsed_EB")).toBeUndefined();
    });

    it("leaves other folders untouched", async () => {
      await figma.clientStorage.setAsync("traData_EB", "data-eb");
      await figma.clientStorage.setAsync("traData_PCB", "data-pcb");

      await clearFolderCache("EB");

      expect(await figma.clientStorage.getAsync("traData_PCB")).toBe("data-pcb");
    });
  });

  describe("touchFolder", () => {
    it("writes a numeric timestamp to traLastUsed_<folder>", async () => {
      const before = Date.now();
      await touchFolder("EB");
      const stored = (await figma.clientStorage.getAsync("traLastUsed_EB")) as number;
      expect(typeof stored).toBe("number");
      expect(stored).toBeGreaterThanOrEqual(before);
    });
  });

  describe("findLruFolder", () => {
    it("returns null when no other folder has cached data", async () => {
      await figma.clientStorage.setAsync("traData_EB", "data");
      const result = await findLruFolder(FOLDERS, "EB");
      expect(result).toBeNull();
    });

    it("returns the folder with the oldest timestamp", async () => {
      await figma.clientStorage.setAsync("traData_EB", "data");
      await figma.clientStorage.setAsync("traData_EBB", "data");
      await figma.clientStorage.setAsync("traData_PCB", "data");
      await figma.clientStorage.setAsync("traLastUsed_EB", 1000);
      await figma.clientStorage.setAsync("traLastUsed_EBB", 3000);
      await figma.clientStorage.setAsync("traLastUsed_PCB", 2000);

      const result = await findLruFolder(FOLDERS, "EBB");
      expect(result).toBe("EB");
    });

    it("never returns the excluded folder even if it is the oldest", async () => {
      await figma.clientStorage.setAsync("traData_EB", "data");
      await figma.clientStorage.setAsync("traData_EBB", "data");
      await figma.clientStorage.setAsync("traLastUsed_EB", 1);
      await figma.clientStorage.setAsync("traLastUsed_EBB", 2);

      const result = await findLruFolder(FOLDERS, "EB");
      expect(result).toBe("EBB");
    });

    it("treats a folder with no timestamp as oldest (evicts first)", async () => {
      await figma.clientStorage.setAsync("traData_EB", "data");
      await figma.clientStorage.setAsync("traData_EBB", "data");
      // EB has no timestamp; EBB has a recent one
      await figma.clientStorage.setAsync("traLastUsed_EBB", Date.now());

      const result = await findLruFolder(FOLDERS, "PCB");
      expect(result).toBe("EB");
    });

    it("ignores folders that have a timestamp but no actual data", async () => {
      // Stale timestamp orphan — must not be a candidate
      await figma.clientStorage.setAsync("traLastUsed_EB", 1);
      await figma.clientStorage.setAsync("traData_EBB", "data");
      await figma.clientStorage.setAsync("traLastUsed_EBB", 2);

      const result = await findLruFolder(FOLDERS, "PCB");
      expect(result).toBe("EBB");
    });
  });

  describe("setFolderTraData", () => {
    it("writes data, metadata, and lastUsed without eviction when no quota error", async () => {
      const result = await setFolderTraData("EB", "compressed", { lang: "en" }, FOLDERS);

      expect(result.evictedFolders).toEqual([]);
      expect(await figma.clientStorage.getAsync("traData_EB")).toBe("compressed");
      expect(await figma.clientStorage.getAsync("traMetadata_EB")).toEqual({ lang: "en" });
      expect(typeof (await figma.clientStorage.getAsync("traLastUsed_EB"))).toBe("number");
    });

    it("skips metadata write when metadata is undefined", async () => {
      await setFolderTraData("EB", "compressed", undefined, FOLDERS);

      expect(await figma.clientStorage.getAsync("traData_EB")).toBe("compressed");
      expect(await figma.clientStorage.getAsync("traMetadata_EB")).toBeUndefined();
    });

    it("evicts the LRU folder and retries on quota error", async () => {
      // Pre-populate two folders with different lastUsed timestamps
      await figma.clientStorage.setAsync("traData_EB", "old");
      await figma.clientStorage.setAsync("traLastUsed_EB", 100);
      await figma.clientStorage.setAsync("traData_EBB", "newer");
      await figma.clientStorage.setAsync("traLastUsed_EBB", 500);

      // Make the first setAsync for traData_PCB throw a quota error, then succeed
      const setAsync = figma.clientStorage.setAsync as ReturnType<typeof vi.fn>;
      let calls = 0;
      setAsync.mockImplementation(async (key: string, value: unknown) => {
        if (key === "traData_PCB" && calls === 0) {
          calls++;
          throw new Error("clientStorage quota exceeded — 5MB");
        }
        figma.clientStorage.store.set(key, value);
      });

      const result = await setFolderTraData("PCB", "pcb-data", { lang: "en" }, FOLDERS);

      expect(result.evictedFolders).toEqual(["EB"]); // EB was older
      expect(await figma.clientStorage.getAsync("traData_EB")).toBeUndefined();
      expect(await figma.clientStorage.getAsync("traData_EBB")).toBe("newer"); // untouched
      expect(figma.clientStorage.store.get("traData_PCB")).toBe("pcb-data");
    });

    it("evicts multiple folders if one eviction is not enough", async () => {
      await figma.clientStorage.setAsync("traData_EB", "data");
      await figma.clientStorage.setAsync("traLastUsed_EB", 100);
      await figma.clientStorage.setAsync("traData_EBB", "data");
      await figma.clientStorage.setAsync("traLastUsed_EBB", 200);

      const setAsync = figma.clientStorage.setAsync as ReturnType<typeof vi.fn>;
      let failures = 0;
      setAsync.mockImplementation(async (key: string, value: unknown) => {
        if (key === "traData_PCB" && failures < 2) {
          failures++;
          throw new Error("quota exceeded");
        }
        figma.clientStorage.store.set(key, value);
      });

      const result = await setFolderTraData("PCB", "pcb-data", undefined, FOLDERS);

      // EB is older → evicted first; EBB next
      expect(result.evictedFolders).toEqual(["EB", "EBB"]);
      expect(figma.clientStorage.store.get("traData_PCB")).toBe("pcb-data");
    });

    it("throws when no other folder is left to evict", async () => {
      const setAsync = figma.clientStorage.setAsync as ReturnType<typeof vi.fn>;
      setAsync.mockImplementation(async () => {
        throw new Error("clientStorage quota exceeded");
      });

      await expect(
        setFolderTraData("EB", "huge", undefined, FOLDERS)
      ).rejects.toThrow(/quota/i);
    });

    it("re-throws non-quota errors without evicting", async () => {
      await figma.clientStorage.setAsync("traData_EBB", "data");
      await figma.clientStorage.setAsync("traLastUsed_EBB", 1);

      const setAsync = figma.clientStorage.setAsync as ReturnType<typeof vi.fn>;
      setAsync.mockImplementation(async () => {
        throw new Error("network is down");
      });

      await expect(
        setFolderTraData("EB", "data", undefined, FOLDERS)
      ).rejects.toThrow("network is down");

      // EBB must NOT be evicted on non-quota errors
      expect(figma.clientStorage.store.get("traData_EBB")).toBe("data");
    });
  });
});
