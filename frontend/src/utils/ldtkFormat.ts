/**
 * LDtk format import/export
 * https://ldtk.io/json/
 */

import type { Tile, Scene, Project, TilePlacement } from '../types';
import { imageDataToBase64 } from './fileUtils';
import { downloadText } from './fileUtils';

/** LDtk project format (simplified) */
export interface LDtkProject {
  jsonVersion: string;
  appBuildId: number;
  worldLayout: 'Free' | 'GridVania' | 'LinearHorizontal' | 'LinearVertical';
  worldGridWidth: number;
  worldGridHeight: number;
  defaultPivotX: number;
  defaultPivotY: number;
  defaultGridSize: number;
  defs: LDtkDefinitions;
  levels: LDtkLevel[];
}

export interface LDtkDefinitions {
  layers: LDtkLayerDef[];
  tilesets: LDtkTilesetDef[];
}

export interface LDtkLayerDef {
  identifier: string;
  type: 'IntGrid' | 'Entities' | 'Tiles' | 'AutoLayer';
  uid: number;
  gridSize: number;
  tilesetDefUid?: number;
}

export interface LDtkTilesetDef {
  identifier: string;
  uid: number;
  relPath: string;
  pxWid: number;
  pxHei: number;
  tileGridSize: number;
  spacing: number;
  padding: number;
}

export interface LDtkLevel {
  identifier: string;
  uid: number;
  pxWid: number;
  pxHei: number;
  worldX: number;
  worldY: number;
  layerInstances: LDtkLayerInstance[];
}

export interface LDtkLayerInstance {
  __identifier: string;
  __type: string;
  __cWid: number;
  __cHei: number;
  __gridSize: number;
  __tilesetDefUid?: number;
  __tilesetRelPath?: string;
  layerDefUid: number;
  pxOffsetX: number;
  pxOffsetY: number;
  gridTiles: LDtkGridTile[];
  autoLayerTiles: LDtkGridTile[];
}

export interface LDtkGridTile {
  px: [number, number];
  src: [number, number];
  f: number; // flip flags
  t: number; // tile ID
}

export interface LDtkImportResult {
  tiles: Tile[];
  scenes: Scene[];
  tileSize: number;
}

/**
 * Import an LDtk project
 */
export async function importLDtk(
  json: LDtkProject,
  loadImage: (path: string) => Promise<HTMLImageElement>
): Promise<LDtkImportResult> {
  const tileSize = json.defaultGridSize;
  const tiles: Tile[] = [];
  const tileIdMap = new Map<string, string>(); // "tilesetUid:tileId" -> our tile ID

  // Process tilesets
  for (const tilesetDef of json.defs.tilesets) {
    try {
      const img = await loadImage(tilesetDef.relPath);
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      const gridSize = tilesetDef.tileGridSize;
      const spacing = tilesetDef.spacing;
      const padding = tilesetDef.padding;

      const columns = Math.floor((tilesetDef.pxWid - 2 * padding + spacing) / (gridSize + spacing));
      const rows = Math.floor((tilesetDef.pxHei - 2 * padding + spacing) / (gridSize + spacing));

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
          const tileId = row * columns + col;
          const x = padding + col * (gridSize + spacing);
          const y = padding + row * (gridSize + spacing);

          const imageData = ctx.getImageData(x, y, gridSize, gridSize);

          const tile: Tile = {
            id: crypto.randomUUID(),
            imageData,
            imageBase64: imageDataToBase64(imageData),
            labels: [],
            width: gridSize,
            height: gridSize,
          };

          tiles.push(tile);
          tileIdMap.set(`${tilesetDef.uid}:${tileId}`, tile.id);
        }
      }
    } catch (e) {
      console.warn(`Failed to load LDtk tileset: ${tilesetDef.relPath}`, e);
    }
  }

  // Process levels into scenes
  const scenes: Scene[] = [];

  for (const level of json.levels) {
    for (const layer of level.layerInstances ?? []) {
      if (layer.__type !== 'Tiles' && layer.__type !== 'AutoLayer') continue;

      const allTiles = [...(layer.gridTiles ?? []), ...(layer.autoLayerTiles ?? [])];
      if (allTiles.length === 0) continue;

      const placements: TilePlacement[] = [];

      for (const gridTile of allTiles) {
        const tilesetUid = layer.__tilesetDefUid;
        if (tilesetUid === undefined) continue;

        const key = `${tilesetUid}:${gridTile.t}`;
        const tileId = tileIdMap.get(key);

        if (tileId) {
          const gridX = Math.floor(gridTile.px[0] / layer.__gridSize);
          const gridY = Math.floor(gridTile.px[1] / layer.__gridSize);

          placements.push({
            id: crypto.randomUUID(),
            tileId,
            gridX,
            gridY,
            locked: true,
          });
        }
      }

      const scene: Scene = {
        id: crypto.randomUUID(),
        name: `${level.identifier}_${layer.__identifier}`,
        gridWidth: layer.__cWid,
        gridHeight: layer.__cHei,
        tileSize: layer.__gridSize,
        placements,
        edges: [],
        transparentColor: '#ff00ff',
      };

      scenes.push(scene);
    }
  }

  return { tiles, scenes, tileSize };
}

/**
 * Export a project to LDtk format
 */
export function exportLDtk(
  project: Project,
  scene: Scene,
  tilesetImagePath = 'tileset.png'
): LDtkProject {
  const { tiles } = project;
  const { gridWidth, gridHeight, tileSize, placements, name } = scene;

  // Calculate tileset dimensions
  const columns = Math.ceil(Math.sqrt(tiles.length));
  const rows = Math.ceil(tiles.length / columns);
  const tilesetWidth = columns * tileSize;
  const tilesetHeight = rows * tileSize;

  // Create tile ID to index mapping
  const tileIndexMap = new Map<string, number>();
  tiles.forEach((tile, index) => {
    tileIndexMap.set(tile.id, index);
  });

  // Create grid tiles
  const gridTiles: LDtkGridTile[] = [];
  for (const placement of placements) {
    const tileIndex = tileIndexMap.get(placement.tileId);
    if (tileIndex === undefined) continue;

    const srcCol = tileIndex % columns;
    const srcRow = Math.floor(tileIndex / columns);

    gridTiles.push({
      px: [placement.gridX * tileSize, placement.gridY * tileSize],
      src: [srcCol * tileSize, srcRow * tileSize],
      f: 0,
      t: tileIndex,
    });
  }

  const ldtkProject: LDtkProject = {
    jsonVersion: '1.5.3',
    appBuildId: 0,
    worldLayout: 'Free',
    worldGridWidth: gridWidth * tileSize,
    worldGridHeight: gridHeight * tileSize,
    defaultPivotX: 0,
    defaultPivotY: 0,
    defaultGridSize: tileSize,
    defs: {
      layers: [
        {
          identifier: 'Tiles',
          type: 'Tiles',
          uid: 1,
          gridSize: tileSize,
          tilesetDefUid: 1,
        },
      ],
      tilesets: [
        {
          identifier: 'Tileset',
          uid: 1,
          relPath: tilesetImagePath,
          pxWid: tilesetWidth,
          pxHei: tilesetHeight,
          tileGridSize: tileSize,
          spacing: 0,
          padding: 0,
        },
      ],
    },
    levels: [
      {
        identifier: name || 'Level_0',
        uid: 0,
        pxWid: gridWidth * tileSize,
        pxHei: gridHeight * tileSize,
        worldX: 0,
        worldY: 0,
        layerInstances: [
          {
            __identifier: 'Tiles',
            __type: 'Tiles',
            __cWid: gridWidth,
            __cHei: gridHeight,
            __gridSize: tileSize,
            __tilesetDefUid: 1,
            __tilesetRelPath: tilesetImagePath,
            layerDefUid: 1,
            pxOffsetX: 0,
            pxOffsetY: 0,
            gridTiles,
            autoLayerTiles: [],
          },
        ],
      },
    ],
  };

  return ldtkProject;
}

/**
 * Download a project as LDtk JSON
 */
export function downloadLDtk(
  project: Project,
  scene: Scene,
  filename = 'project.ldtk'
): void {
  const ldtk = exportLDtk(project, scene);
  downloadText(JSON.stringify(ldtk, null, 2), filename);
}
