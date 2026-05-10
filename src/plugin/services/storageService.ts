// Storage service - LRU-aware writes to figma.clientStorage.
//
// Figma enforces a 5 MB total quota across all keys for a given plugin/user.
// When a write would exceed it, evict the least-recently-used *other* folder
// and retry, repeating until the write succeeds or no more folders can be freed.

const TRA_DATA_PREFIX = "traData_";
const TRA_METADATA_PREFIX = "traMetadata_";
const TRA_LAST_USED_PREFIX = "traLastUsed_";

export interface SetFolderResult {
  evictedFolders: string[];
}

/**
 * Identify Figma's clientStorage quota errors.
 * Figma surfaces messages like "in clientStorage" with "5 MB" or "quota".
 * Match loosely on either signal so we don't miss future wording tweaks.
 */
export function isQuotaError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return msg.includes("quota") || msg.includes("5 mb") || msg.includes("5mb");
}

export async function clearFolderCache(folder: string): Promise<void> {
  await Promise.all([
    figma.clientStorage.deleteAsync(TRA_DATA_PREFIX + folder).catch(() => undefined),
    figma.clientStorage.deleteAsync(TRA_METADATA_PREFIX + folder).catch(() => undefined),
    figma.clientStorage.deleteAsync(TRA_LAST_USED_PREFIX + folder).catch(() => undefined),
  ]);
}

export async function touchFolder(folder: string): Promise<void> {
  try {
    await figma.clientStorage.setAsync(TRA_LAST_USED_PREFIX + folder, Date.now());
  } catch {
    // best-effort; a missing timestamp just means the folder evicts first
  }
}

/**
 * Find the LRU folder among `allFolders`, excluding `excludeFolder`,
 * considering only folders that actually have cached data right now.
 * Folders without a recorded timestamp are treated as oldest (evict first).
 */
export async function findLruFolder(
  allFolders: readonly string[],
  excludeFolder: string
): Promise<string | null> {
  let oldest: { folder: string; ts: number } | null = null;
  for (const folder of allFolders) {
    if (folder === excludeFolder) continue;
    const hasData = await figma.clientStorage
      .getAsync(TRA_DATA_PREFIX + folder)
      .catch(() => null);
    if (!hasData) continue;
    const tsRaw = await figma.clientStorage
      .getAsync(TRA_LAST_USED_PREFIX + folder)
      .catch(() => null);
    const ts = typeof tsRaw === "number" ? tsRaw : 0;
    if (!oldest || ts < oldest.ts) {
      oldest = { folder, ts };
    }
  }
  return oldest?.folder ?? null;
}

/**
 * Persist a folder's tra data + metadata. On quota errors, evict LRU folders
 * one at a time and retry, until either the write succeeds or there are no
 * more folders to evict.
 */
export async function setFolderTraData(
  folder: string,
  compressedData: unknown,
  metadata: unknown | undefined,
  allFolders: readonly string[]
): Promise<SetFolderResult> {
  const evictedFolders: string[] = [];

  // Bound retries to allFolders.length so we can never loop forever.
  for (let attempt = 0; attempt <= allFolders.length; attempt++) {
    try {
      await figma.clientStorage.setAsync(TRA_DATA_PREFIX + folder, compressedData);
      if (metadata !== undefined) {
        await figma.clientStorage.setAsync(TRA_METADATA_PREFIX + folder, metadata);
      }
      await figma.clientStorage.setAsync(TRA_LAST_USED_PREFIX + folder, Date.now());
      return { evictedFolders };
    } catch (err) {
      if (!isQuotaError(err)) throw err;
      const victim = await findLruFolder(allFolders, folder);
      if (!victim) throw err;
      await clearFolderCache(victim);
      evictedFolders.push(victim);
    }
  }

  throw new Error(
    `clientStorage quota exceeded for "${folder}" after evicting ${evictedFolders.join(", ")}`
  );
}
