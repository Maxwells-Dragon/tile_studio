/**
 * Tile deduplication utilities
 */

import type { Tile } from '../types';

/**
 * Generate a hash for an ImageData based on pixel content
 */
function hashImageData(imageData: ImageData): string {
  const data = imageData.data;
  let hash = 0;

  // Sample pixels for faster hashing (every 4th pixel)
  for (let i = 0; i < data.length; i += 16) {
    const value = data[i] | (data[i + 1] << 8) | (data[i + 2] << 16) | (data[i + 3] << 24);
    hash = ((hash << 5) - hash + value) | 0;
  }

  // Also include dimensions in hash
  hash = ((hash << 5) - hash + imageData.width) | 0;
  hash = ((hash << 5) - hash + imageData.height) | 0;

  return hash.toString(36);
}

/**
 * Compare two ImageData objects for exact equality
 */
function imageDataEquals(a: ImageData, b: ImageData): boolean {
  if (a.width !== b.width || a.height !== b.height) {
    return false;
  }

  const dataA = a.data;
  const dataB = b.data;

  if (dataA.length !== dataB.length) {
    return false;
  }

  for (let i = 0; i < dataA.length; i++) {
    if (dataA[i] !== dataB[i]) {
      return false;
    }
  }

  return true;
}

export interface DeduplicationResult {
  /** Tiles that are unique (not duplicates) */
  uniqueTiles: Tile[];
  /** Number of duplicates that were removed */
  duplicateCount: number;
  /** Map from original tile ID to the ID of the tile it duplicates (if any) */
  duplicateMap: Map<string, string>;
}

/**
 * Deduplicate tiles based on pixel content
 *
 * @param newTiles - Tiles to add
 * @param existingTiles - Tiles that already exist in the project
 * @returns Result with unique tiles and deduplication info
 */
export function deduplicateTiles(
  newTiles: Tile[],
  existingTiles: Tile[] = []
): DeduplicationResult {
  const uniqueTiles: Tile[] = [];
  const duplicateMap = new Map<string, string>();
  let duplicateCount = 0;

  // Build hash map of existing tiles for fast lookup
  const existingHashMap = new Map<string, Tile[]>();
  for (const tile of existingTiles) {
    if (!tile.imageData) continue;
    const hash = hashImageData(tile.imageData);
    const bucket = existingHashMap.get(hash) ?? [];
    bucket.push(tile);
    existingHashMap.set(hash, bucket);
  }

  // Track tiles we're adding in this batch too
  const newHashMap = new Map<string, Tile[]>();

  for (const tile of newTiles) {
    if (!tile.imageData) {
      // Keep tiles without image data (shouldn't happen, but just in case)
      uniqueTiles.push(tile);
      continue;
    }

    const hash = hashImageData(tile.imageData);

    // Check against existing tiles
    let isDuplicate = false;
    const existingBucket = existingHashMap.get(hash);
    if (existingBucket) {
      for (const existing of existingBucket) {
        if (existing.imageData && imageDataEquals(tile.imageData, existing.imageData)) {
          duplicateMap.set(tile.id, existing.id);
          duplicateCount++;
          isDuplicate = true;
          break;
        }
      }
    }

    // Check against tiles we're adding in this batch
    if (!isDuplicate) {
      const newBucket = newHashMap.get(hash);
      if (newBucket) {
        for (const added of newBucket) {
          if (added.imageData && imageDataEquals(tile.imageData, added.imageData)) {
            duplicateMap.set(tile.id, added.id);
            duplicateCount++;
            isDuplicate = true;
            break;
          }
        }
      }
    }

    if (!isDuplicate) {
      uniqueTiles.push(tile);
      const bucket = newHashMap.get(hash) ?? [];
      bucket.push(tile);
      newHashMap.set(hash, bucket);
    }
  }

  return {
    uniqueTiles,
    duplicateCount,
    duplicateMap,
  };
}
