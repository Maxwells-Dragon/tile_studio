/**
 * PNG tileset import - slice an image into tiles
 */

import type { Tile } from '../types';
import { imageDataToBase64 } from './fileUtils';

export interface TilesetImportOptions {
  /** Tile width in pixels */
  tileWidth: number;
  /** Tile height in pixels */
  tileHeight: number;
  /** Spacing between tiles in pixels */
  spacing?: number;
  /** Margin around the tileset in pixels */
  margin?: number;
}

export interface TilesetImportResult {
  tiles: Tile[];
  /** Number of columns in the source image */
  columns: number;
  /** Number of rows in the source image */
  rows: number;
}

/**
 * Slice an image into tiles based on grid settings
 */
export function sliceImageIntoTiles(
  image: HTMLImageElement,
  options: TilesetImportOptions
): TilesetImportResult {
  const { tileWidth, tileHeight, spacing = 0, margin = 0 } = options;

  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0);

  const tiles: Tile[] = [];

  // Calculate how many tiles fit
  const usableWidth = image.width - 2 * margin;
  const usableHeight = image.height - 2 * margin;
  const columns = Math.floor((usableWidth + spacing) / (tileWidth + spacing));
  const rows = Math.floor((usableHeight + spacing) / (tileHeight + spacing));

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const x = margin + col * (tileWidth + spacing);
      const y = margin + row * (tileHeight + spacing);

      const imageData = ctx.getImageData(x, y, tileWidth, tileHeight);

      // Skip fully transparent tiles
      if (isFullyTransparent(imageData)) {
        continue;
      }

      const tile: Tile = {
        id: crypto.randomUUID(),
        imageData,
        imageBase64: imageDataToBase64(imageData),
        labels: [],
        width: tileWidth,
        height: tileHeight,
      };

      tiles.push(tile);
    }
  }

  return { tiles, columns, rows };
}

/**
 * Check if an ImageData is fully transparent
 */
function isFullyTransparent(imageData: ImageData): boolean {
  const data = imageData.data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 0) {
      return false;
    }
  }
  return true;
}

/**
 * Detect potential tile size from an image by looking for repeating patterns
 * Returns common tile sizes that divide evenly into the image dimensions
 */
export function suggestTileSizes(width: number, height: number): number[] {
  const commonSizes = [8, 16, 24, 32, 48, 64];
  const suggestions: number[] = [];

  for (const size of commonSizes) {
    if (width % size === 0 && height % size === 0) {
      suggestions.push(size);
    }
  }

  // If no common sizes work, suggest sizes that at least divide one dimension
  if (suggestions.length === 0) {
    for (const size of commonSizes) {
      if (width % size === 0 || height % size === 0) {
        suggestions.push(size);
      }
    }
  }

  return suggestions.length > 0 ? suggestions : [16]; // Default to 16 if nothing matches
}
