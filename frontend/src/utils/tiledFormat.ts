/**
 * Tiled JSON format import/export
 * https://doc.mapeditor.org/en/stable/reference/json-map-format/
 */

import type { Tile, Scene, Project, TilePlacement } from '../types';
import { imageDataToBase64 } from './fileUtils';
import { downloadText } from './fileUtils';

/** Tiled JSON map format */
export interface TiledMap {
  version: string;
  tiledversion?: string;
  type: 'map';
  orientation: 'orthogonal' | 'isometric' | 'staggered' | 'hexagonal';
  renderorder: 'right-down' | 'right-up' | 'left-down' | 'left-up';
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  infinite: boolean;
  layers: TiledLayer[];
  tilesets: TiledTileset[];
  properties?: TiledProperty[];
  nextlayerid?: number;
  nextobjectid?: number;
}

export interface TiledLayer {
  id: number;
  name: string;
  type: 'tilelayer' | 'objectgroup' | 'imagelayer' | 'group';
  visible: boolean;
  opacity: number;
  x: number;
  y: number;
  width: number;
  height: number;
  data?: number[];
  encoding?: 'base64' | 'csv';
  compression?: 'gzip' | 'zlib' | 'zstd';
}

export interface TiledTileset {
  firstgid: number;
  name: string;
  tilewidth: number;
  tileheight: number;
  tilecount: number;
  columns: number;
  image?: string;
  imagewidth?: number;
  imageheight?: number;
  spacing?: number;
  margin?: number;
  tiles?: TiledTile[];
}

export interface TiledTile {
  id: number;
  image?: string;
  imagewidth?: number;
  imageheight?: number;
  properties?: TiledProperty[];
}

export interface TiledProperty {
  name: string;
  type: 'string' | 'int' | 'float' | 'bool' | 'color' | 'file';
  value: string | number | boolean;
}

export interface TiledImportResult {
  tiles: Tile[];
  scenes: Scene[];
  tileSize: number;
}

/**
 * Import a Tiled JSON map
 */
export async function importTiledJSON(
  json: TiledMap,
  loadImage: (path: string) => Promise<HTMLImageElement>
): Promise<TiledImportResult> {
  const tileSize = json.tilewidth;
  const tiles: Tile[] = [];
  const tileIdMap = new Map<number, string>(); // Tiled GID -> our tile ID

  // Process tilesets
  for (const tileset of json.tilesets) {
    const firstGid = tileset.firstgid;

    if (tileset.tiles) {
      // Collection of images tileset
      for (const tiledTile of tileset.tiles) {
        if (tiledTile.image) {
          try {
            const img = await loadImage(tiledTile.image);
            const canvas = document.createElement('canvas');
            canvas.width = tiledTile.imagewidth ?? tileset.tilewidth;
            canvas.height = tiledTile.imageheight ?? tileset.tileheight;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            const tile: Tile = {
              id: crypto.randomUUID(),
              imageData,
              imageBase64: imageDataToBase64(imageData),
              labels: extractLabelsFromProperties(tiledTile.properties),
              width: canvas.width,
              height: canvas.height,
            };

            tiles.push(tile);
            tileIdMap.set(firstGid + tiledTile.id, tile.id);
          } catch (e) {
            console.warn(`Failed to load tile image: ${tiledTile.image}`, e);
          }
        }
      }
    } else if (tileset.image) {
      // Single image tileset - slice it
      try {
        const img = await loadImage(tileset.image);
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);

        const spacing = tileset.spacing ?? 0;
        const margin = tileset.margin ?? 0;

        for (let i = 0; i < tileset.tilecount; i++) {
          const col = i % tileset.columns;
          const row = Math.floor(i / tileset.columns);
          const x = margin + col * (tileset.tilewidth + spacing);
          const y = margin + row * (tileset.tileheight + spacing);

          const imageData = ctx.getImageData(x, y, tileset.tilewidth, tileset.tileheight);

          const tile: Tile = {
            id: crypto.randomUUID(),
            imageData,
            imageBase64: imageDataToBase64(imageData),
            labels: [],
            width: tileset.tilewidth,
            height: tileset.tileheight,
          };

          tiles.push(tile);
          tileIdMap.set(firstGid + i, tile.id);
        }
      } catch (e) {
        console.warn(`Failed to load tileset image: ${tileset.image}`, e);
      }
    }
  }

  // Process layers into scenes
  const scenes: Scene[] = [];

  for (const layer of json.layers) {
    if (layer.type !== 'tilelayer' || !layer.data) continue;

    const placements: TilePlacement[] = [];

    for (let i = 0; i < layer.data.length; i++) {
      const gid = layer.data[i];
      if (gid === 0) continue; // Empty tile

      // Clear flip flags (top 3 bits)
      const tileGid = gid & 0x1FFFFFFF;
      const tileId = tileIdMap.get(tileGid);

      if (tileId) {
        const col = i % layer.width;
        const row = Math.floor(i / layer.width);

        placements.push({
          id: crypto.randomUUID(),
          tileId,
          gridX: col,
          gridY: row,
          locked: true,
        });
      }
    }

    const scene: Scene = {
      id: crypto.randomUUID(),
      name: layer.name,
      gridWidth: layer.width,
      gridHeight: layer.height,
      tileSize,
      placements,
      edges: [],
      transparentColor: '#ff00ff',
    };

    scenes.push(scene);
  }

  return { tiles, scenes, tileSize };
}

/**
 * Export a project to Tiled JSON format
 */
export function exportTiledJSON(
  project: Project,
  scene: Scene,
  tilesetImagePath = 'tileset.png'
): TiledMap {
  const { tiles, tileSize } = project;
  const { gridWidth, gridHeight, placements } = scene;

  // Create tile ID to index mapping
  const tileIndexMap = new Map<string, number>();
  tiles.forEach((tile, index) => {
    tileIndexMap.set(tile.id, index + 1); // Tiled GIDs start at 1
  });

  // Create layer data
  const data: number[] = new Array(gridWidth * gridHeight).fill(0);
  for (const placement of placements) {
    const index = placement.gridY * gridWidth + placement.gridX;
    const gid = tileIndexMap.get(placement.tileId) ?? 0;
    data[index] = gid;
  }

  // Calculate tileset dimensions
  const columns = Math.ceil(Math.sqrt(tiles.length));
  const rows = Math.ceil(tiles.length / columns);

  const map: TiledMap = {
    version: '1.10',
    type: 'map',
    orientation: 'orthogonal',
    renderorder: 'right-down',
    width: gridWidth,
    height: gridHeight,
    tilewidth: tileSize,
    tileheight: tileSize,
    infinite: false,
    nextlayerid: 2,
    nextobjectid: 1,
    layers: [
      {
        id: 1,
        name: scene.name,
        type: 'tilelayer',
        visible: true,
        opacity: 1,
        x: 0,
        y: 0,
        width: gridWidth,
        height: gridHeight,
        data,
      },
    ],
    tilesets: [
      {
        firstgid: 1,
        name: 'tileset',
        tilewidth: tileSize,
        tileheight: tileSize,
        tilecount: tiles.length,
        columns,
        image: tilesetImagePath,
        imagewidth: columns * tileSize,
        imageheight: rows * tileSize,
      },
    ],
  };

  return map;
}

/**
 * Download a project as Tiled JSON
 */
export function downloadTiledJSON(
  project: Project,
  scene: Scene,
  filename = 'map.json'
): void {
  const map = exportTiledJSON(project, scene);
  downloadText(JSON.stringify(map, null, 2), filename);
}

/**
 * Extract labels from Tiled properties
 */
function extractLabelsFromProperties(properties?: TiledProperty[]): string[] {
  if (!properties) return [];

  const labelsProp = properties.find(p => p.name === 'labels');
  if (labelsProp && typeof labelsProp.value === 'string') {
    return labelsProp.value.split(',').map(s => s.trim()).filter(Boolean);
  }

  return [];
}
