/**
 * Core types for Tile Studio
 */

/** A tile is just an image with optional labels */
export interface Tile {
  id: string;
  imageData: ImageData | null;
  /** Base64 encoded image for serialization */
  imageBase64?: string;
  /** Optional keyword labels for prompt building */
  labels: string[];
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
}

/** A placed tile instance in the scene */
export interface TilePlacement {
  id: string;
  tileId: string;
  /** Grid position (not pixel position) */
  gridX: number;
  gridY: number;
  /** Whether this tile is locked (won't be regenerated) */
  locked: boolean;
}

/** An edge between two grid cells */
export interface Edge {
  id: string;
  /** Grid position of the edge */
  x: number;
  y: number;
  /** Whether this is a horizontal or vertical edge */
  orientation: 'horizontal' | 'vertical';
  /** Whether this edge is locked (pixels will be preserved) */
  locked: boolean;
  /** Width of the edge in pixels (for constraint matching) */
  width: number;
}

/** The scene contains tile placements and edges */
export interface Scene {
  id: string;
  name: string;
  /** Grid dimensions */
  gridWidth: number;
  gridHeight: number;
  /** Tile size in pixels */
  tileSize: number;
  /** All placed tiles */
  placements: TilePlacement[];
  /** All edges with lock states */
  edges: Edge[];
  /** Background/transparent color (hex) */
  transparentColor: string;
}

/** A project contains scenes and a tile library */
export interface Project {
  id: string;
  name: string;
  /** All tiles in the library */
  tiles: Tile[];
  /** All scenes */
  scenes: Scene[];
  /** Active scene ID */
  activeSceneId: string | null;
  /** Global keyword bank */
  keywords: string[];
  /** Default tile size for new scenes */
  defaultTileSize: number;
}

/** Selection state */
export interface Selection {
  /** Selected tile placement IDs */
  tileIds: Set<string>;
  /** Selected edge IDs */
  edgeIds: Set<string>;
  /** Current selection mode */
  mode: 'tiles' | 'edges' | 'both';
}

/** Generation request sent to backend */
export interface GenerationRequest {
  /** The composed scene image as base64 */
  sceneImage: string;
  /** Mask indicating areas to regenerate (white = regenerate) */
  mask: string;
  /** Locked edge pixel strips for constraint matching */
  lockedEdges: EdgeConstraint[];
  /** The generation prompt */
  prompt: string;
  /** Selected keywords to prepend */
  keywords: string[];
  /** Tile size in pixels */
  tileSize: number;
  /** Grid bounds of the generation area */
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

/** Edge constraint for generation */
export interface EdgeConstraint {
  /** Position in pixels */
  x: number;
  y: number;
  /** Size of the edge strip */
  width: number;
  height: number;
  /** The pixel data to match */
  pixels: string;
}

/** Generation response from backend */
export interface GenerationResponse {
  /** Generated tiles as base64 images */
  tiles: {
    gridX: number;
    gridY: number;
    imageBase64: string;
  }[];
  /** Whether generation was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/** Tool modes for the editor */
export type ToolMode = 'select' | 'place' | 'pan' | 'lasso';

/** Viewport state */
export interface Viewport {
  /** Pan offset in pixels */
  offsetX: number;
  offsetY: number;
  /** Zoom level (1 = 100%) */
  zoom: number;
}
