/**
 * PNG tileset and scene export
 */

import type { Tile, Scene } from '../types';
import { canvasToBlob, downloadBlob } from './fileUtils';

export interface TilesetExportOptions {
  /** Number of columns in the output tileset */
  columns?: number;
  /** Spacing between tiles in pixels */
  spacing?: number;
  /** Margin around the tileset in pixels */
  margin?: number;
  /** Background color (for non-transparent areas) */
  backgroundColor?: string;
}

/**
 * Export tiles to a PNG tileset image
 */
export async function exportTilesetPNG(
  tiles: Tile[],
  options: TilesetExportOptions = {}
): Promise<Blob> {
  if (tiles.length === 0) {
    throw new Error('No tiles to export');
  }

  const { spacing = 0, margin = 0, backgroundColor } = options;
  const tileWidth = tiles[0].width;
  const tileHeight = tiles[0].height;

  // Calculate columns - default to a roughly square layout
  const columns = options.columns ?? Math.ceil(Math.sqrt(tiles.length));
  const rows = Math.ceil(tiles.length / columns);

  // Calculate canvas size
  const canvasWidth = margin * 2 + columns * tileWidth + (columns - 1) * spacing;
  const canvasHeight = margin * 2 + rows * tileHeight + (rows - 1) * spacing;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d')!;

  // Fill background if specified
  if (backgroundColor) {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  // Draw tiles
  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    const col = i % columns;
    const row = Math.floor(i / columns);
    const x = margin + col * (tileWidth + spacing);
    const y = margin + row * (tileHeight + spacing);

    if (tile.imageData) {
      ctx.putImageData(tile.imageData, x, y);
    }
  }

  return canvasToBlob(canvas);
}

/**
 * Export a scene to a PNG image
 */
export async function exportScenePNG(
  scene: Scene,
  tiles: Tile[],
  tileSize: number,
  options: { backgroundColor?: string } = {}
): Promise<Blob> {
  const { gridWidth, gridHeight, placements } = scene;
  const { backgroundColor } = options;

  const canvas = document.createElement('canvas');
  canvas.width = gridWidth * tileSize;
  canvas.height = gridHeight * tileSize;
  const ctx = canvas.getContext('2d')!;

  // Fill background if specified
  if (backgroundColor) {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Create a map of tile IDs to tiles for fast lookup
  const tileMap = new Map(tiles.map(t => [t.id, t]));

  // Draw placed tiles
  for (const placement of placements) {
    const tile = tileMap.get(placement.tileId);
    if (!tile?.imageData) continue;

    const x = placement.gridX * tileSize;
    const y = placement.gridY * tileSize;
    ctx.putImageData(tile.imageData, x, y);
  }

  return canvasToBlob(canvas);
}

/**
 * Download a tileset as PNG
 */
export async function downloadTilesetPNG(
  tiles: Tile[],
  filename = 'tileset.png',
  options: TilesetExportOptions = {}
): Promise<void> {
  const blob = await exportTilesetPNG(tiles, options);
  downloadBlob(blob, filename);
}

/**
 * Download a scene as PNG
 */
export async function downloadScenePNG(
  scene: Scene,
  tiles: Tile[],
  tileSize: number,
  filename = 'scene.png',
  options: { backgroundColor?: string } = {}
): Promise<void> {
  const blob = await exportScenePNG(scene, tiles, tileSize, options);
  downloadBlob(blob, filename);
}

/**
 * Get unique tiles from a project (deduplicated by content)
 */
export function getUniqueTiles(tiles: Tile[]): Tile[] {
  // For now, just return all tiles
  // TODO: Could add content-based deduplication by comparing imageData
  return tiles;
}
