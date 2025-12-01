/**
 * Native project format save/load
 */

import type { Project, Tile, Scene, TilePlacement, Edge } from '../types';
import { downloadText } from './fileUtils';

/** File format version for compatibility checking */
const FORMAT_VERSION = 1;

/** Serialized project format */
export interface SerializedProject {
  formatVersion: number;
  project: {
    id: string;
    name: string;
    tiles: SerializedTile[];
    scenes: SerializedScene[];
    activeSceneId: string | null;
    keywords: string[];
    defaultTileSize: number;
  };
}

export interface SerializedTile {
  id: string;
  imageBase64: string;
  labels: string[];
  width: number;
  height: number;
}

export interface SerializedScene {
  id: string;
  name: string;
  gridWidth: number;
  gridHeight: number;
  tileSize: number;
  placements: TilePlacement[];
  edges: Edge[];
  transparentColor: string;
}

/**
 * Serialize a project for saving
 */
export function serializeProject(project: Project): SerializedProject {
  const serializedTiles: SerializedTile[] = project.tiles.map(tile => ({
    id: tile.id,
    imageBase64: tile.imageBase64 ?? '',
    labels: tile.labels,
    width: tile.width,
    height: tile.height,
  }));

  const serializedScenes: SerializedScene[] = project.scenes.map(scene => ({
    id: scene.id,
    name: scene.name,
    gridWidth: scene.gridWidth,
    gridHeight: scene.gridHeight,
    tileSize: scene.tileSize,
    placements: scene.placements,
    edges: scene.edges,
    transparentColor: scene.transparentColor,
  }));

  return {
    formatVersion: FORMAT_VERSION,
    project: {
      id: project.id,
      name: project.name,
      tiles: serializedTiles,
      scenes: serializedScenes,
      activeSceneId: project.activeSceneId,
      keywords: project.keywords,
      defaultTileSize: project.defaultTileSize,
    },
  };
}

/**
 * Deserialize a project from saved format
 */
export async function deserializeProject(data: SerializedProject): Promise<Project> {
  if (data.formatVersion > FORMAT_VERSION) {
    throw new Error(`Project format version ${data.formatVersion} is newer than supported version ${FORMAT_VERSION}`);
  }

  // Convert serialized tiles back to full Tile objects
  const tiles: Tile[] = await Promise.all(
    data.project.tiles.map(async (serialized): Promise<Tile> => {
      let imageData: ImageData | null = null;

      if (serialized.imageBase64) {
        imageData = await base64ToImageData(serialized.imageBase64);
      }

      return {
        id: serialized.id,
        imageData,
        imageBase64: serialized.imageBase64,
        labels: serialized.labels,
        width: serialized.width,
        height: serialized.height,
      };
    })
  );

  const scenes: Scene[] = data.project.scenes.map(serialized => ({
    id: serialized.id,
    name: serialized.name,
    gridWidth: serialized.gridWidth,
    gridHeight: serialized.gridHeight,
    tileSize: serialized.tileSize,
    placements: serialized.placements,
    edges: serialized.edges,
    transparentColor: serialized.transparentColor,
  }));

  return {
    id: data.project.id,
    name: data.project.name,
    tiles,
    scenes,
    activeSceneId: data.project.activeSceneId,
    keywords: data.project.keywords,
    defaultTileSize: data.project.defaultTileSize,
  };
}

/**
 * Convert base64 to ImageData
 */
async function base64ToImageData(base64: string): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, img.width, img.height));
    };
    img.onerror = () => reject(new Error('Failed to load image from base64'));
    img.src = base64;
  });
}

/**
 * Save a project to a JSON file
 */
export function saveProject(project: Project, filename?: string): void {
  const serialized = serializeProject(project);
  const json = JSON.stringify(serialized, null, 2);
  const name = filename ?? `${project.name.replace(/[^a-z0-9]/gi, '_')}.tilestudio`;
  downloadText(json, name, 'application/json');
}

/**
 * Load a project from JSON string
 */
export async function loadProject(json: string): Promise<Project> {
  const data = JSON.parse(json) as SerializedProject;
  return deserializeProject(data);
}
