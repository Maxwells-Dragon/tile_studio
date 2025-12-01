import { create } from 'zustand';
import type { Project, Scene, Tile, TilePlacement, Selection, Viewport, ToolMode } from '../types';

interface ProjectState {
  // Project data
  project: Project | null;

  // UI state
  selection: Selection;
  viewport: Viewport;
  toolMode: ToolMode;
  selectedTileId: string | null; // Tile selected in library for placement

  // Actions - Project
  createProject: (name: string, defaultTileSize?: number) => void;
  loadProject: (project: Project) => void;

  // Actions - Scene
  createScene: (name: string, gridWidth: number, gridHeight: number, tileSize?: number) => void;
  setActiveScene: (sceneId: string) => void;
  getActiveScene: () => Scene | null;

  // Actions - Tiles
  addTile: (tile: Tile) => void;
  addTiles: (tiles: Tile[]) => void;
  removeTile: (tileId: string) => void;
  updateTileLabels: (tileId: string, labels: string[]) => void;
  setSelectedTileId: (tileId: string | null) => void;

  // Actions - Placements
  placeTile: (tileId: string, gridX: number, gridY: number) => void;
  removePlacement: (placementId: string) => void;
  movePlacement: (placementId: string, gridX: number, gridY: number) => void;
  setPlacementLocked: (placementId: string, locked: boolean) => void;

  // Actions - Edges
  setEdgeLocked: (edgeId: string, locked: boolean) => void;

  // Actions - Selection
  selectTile: (placementId: string, additive?: boolean) => void;
  selectEdge: (edgeId: string, additive?: boolean) => void;
  selectArea: (minX: number, minY: number, maxX: number, maxY: number) => void;
  clearSelection: () => void;
  setSelectionMode: (mode: 'tiles' | 'edges' | 'both') => void;

  // Actions - Selection Helpers
  selectAdjacentEdges: () => void;
  selectInternalEdges: () => void;
  lockSelection: () => void;
  unlockSelection: () => void;

  // Actions - Viewport
  setViewport: (viewport: Partial<Viewport>) => void;
  setToolMode: (mode: ToolMode) => void;

  // Actions - Keywords
  addKeyword: (keyword: string) => void;
  removeKeyword: (keyword: string) => void;

  // Actions - Import scenes from other formats
  importScenes: (scenes: Scene[]) => void;
}

const generateId = () => crypto.randomUUID();

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,

  selection: {
    tileIds: new Set(),
    edgeIds: new Set(),
    mode: 'tiles',
  },

  viewport: {
    offsetX: 0,
    offsetY: 0,
    zoom: 1,
  },

  toolMode: 'select',
  selectedTileId: null,

  createProject: (name, defaultTileSize = 16) => {
    const project: Project = {
      id: generateId(),
      name,
      tiles: [],
      scenes: [],
      activeSceneId: null,
      keywords: [],
      defaultTileSize,
    };
    set({ project });
  },

  loadProject: (project) => {
    set({ project });
  },

  createScene: (name, gridWidth, gridHeight, tileSize) => {
    const { project } = get();
    if (!project) return;

    const scene: Scene = {
      id: generateId(),
      name,
      gridWidth,
      gridHeight,
      tileSize: tileSize ?? project.defaultTileSize,
      placements: [],
      edges: [],
      transparentColor: '#ff00ff',
    };

    set({
      project: {
        ...project,
        scenes: [...project.scenes, scene],
        activeSceneId: scene.id,
      },
    });
  },

  setActiveScene: (sceneId) => {
    const { project } = get();
    if (!project) return;

    set({
      project: { ...project, activeSceneId: sceneId },
      selection: { tileIds: new Set(), edgeIds: new Set(), mode: 'tiles' },
    });
  },

  getActiveScene: () => {
    const { project } = get();
    if (!project || !project.activeSceneId) return null;
    return project.scenes.find(s => s.id === project.activeSceneId) ?? null;
  },

  addTile: (tile) => {
    const { project } = get();
    if (!project) return;

    set({
      project: {
        ...project,
        tiles: [...project.tiles, tile],
      },
    });
  },

  addTiles: (tiles) => {
    const { project } = get();
    if (!project) return;

    set({
      project: {
        ...project,
        tiles: [...project.tiles, ...tiles],
      },
    });
  },

  removeTile: (tileId) => {
    const { project } = get();
    if (!project) return;

    set({
      project: {
        ...project,
        tiles: project.tiles.filter(t => t.id !== tileId),
        scenes: project.scenes.map(scene => ({
          ...scene,
          placements: scene.placements.filter(p => p.tileId !== tileId),
        })),
      },
    });
  },

  updateTileLabels: (tileId, labels) => {
    const { project } = get();
    if (!project) return;

    set({
      project: {
        ...project,
        tiles: project.tiles.map(t =>
          t.id === tileId ? { ...t, labels } : t
        ),
      },
    });
  },

  setSelectedTileId: (tileId) => {
    set({ selectedTileId: tileId });
  },

  placeTile: (tileId, gridX, gridY) => {
    const { project } = get();
    if (!project || !project.activeSceneId) return;

    const placement: TilePlacement = {
      id: generateId(),
      tileId,
      gridX,
      gridY,
      locked: true, // Locked by default
    };

    set({
      project: {
        ...project,
        scenes: project.scenes.map(scene =>
          scene.id === project.activeSceneId
            ? { ...scene, placements: [...scene.placements, placement] }
            : scene
        ),
      },
    });
  },

  removePlacement: (placementId) => {
    const { project } = get();
    if (!project || !project.activeSceneId) return;

    set({
      project: {
        ...project,
        scenes: project.scenes.map(scene =>
          scene.id === project.activeSceneId
            ? { ...scene, placements: scene.placements.filter(p => p.id !== placementId) }
            : scene
        ),
      },
    });
  },

  movePlacement: (placementId, gridX, gridY) => {
    const { project } = get();
    if (!project || !project.activeSceneId) return;

    set({
      project: {
        ...project,
        scenes: project.scenes.map(scene =>
          scene.id === project.activeSceneId
            ? {
                ...scene,
                placements: scene.placements.map(p =>
                  p.id === placementId ? { ...p, gridX, gridY } : p
                ),
              }
            : scene
        ),
      },
    });
  },

  setPlacementLocked: (placementId, locked) => {
    const { project } = get();
    if (!project || !project.activeSceneId) return;

    set({
      project: {
        ...project,
        scenes: project.scenes.map(scene =>
          scene.id === project.activeSceneId
            ? {
                ...scene,
                placements: scene.placements.map(p =>
                  p.id === placementId ? { ...p, locked } : p
                ),
              }
            : scene
        ),
      },
    });
  },

  setEdgeLocked: (edgeId, locked) => {
    const { project } = get();
    if (!project || !project.activeSceneId) return;

    set({
      project: {
        ...project,
        scenes: project.scenes.map(scene =>
          scene.id === project.activeSceneId
            ? {
                ...scene,
                edges: scene.edges.map(e =>
                  e.id === edgeId ? { ...e, locked } : e
                ),
              }
            : scene
        ),
      },
    });
  },

  selectTile: (placementId, additive = false) => {
    const { selection } = get();
    const newTileIds = new Set(additive ? selection.tileIds : []);

    if (newTileIds.has(placementId)) {
      newTileIds.delete(placementId);
    } else {
      newTileIds.add(placementId);
    }

    set({
      selection: { ...selection, tileIds: newTileIds },
    });
  },

  selectEdge: (edgeId, additive = false) => {
    const { selection } = get();
    const newEdgeIds = new Set(additive ? selection.edgeIds : []);

    if (newEdgeIds.has(edgeId)) {
      newEdgeIds.delete(edgeId);
    } else {
      newEdgeIds.add(edgeId);
    }

    set({
      selection: { ...selection, edgeIds: newEdgeIds },
    });
  },

  selectArea: (minX, minY, maxX, maxY) => {
    const { selection } = get();
    const scene = get().getActiveScene();
    if (!scene) return;

    const newTileIds = new Set<string>();
    const newEdgeIds = new Set<string>();

    if (selection.mode === 'tiles' || selection.mode === 'both') {
      for (const placement of scene.placements) {
        if (
          placement.gridX >= minX &&
          placement.gridX <= maxX &&
          placement.gridY >= minY &&
          placement.gridY <= maxY
        ) {
          newTileIds.add(placement.id);
        }
      }
    }

    if (selection.mode === 'edges' || selection.mode === 'both') {
      for (const edge of scene.edges) {
        if (
          edge.x >= minX &&
          edge.x <= maxX + 1 &&
          edge.y >= minY &&
          edge.y <= maxY + 1
        ) {
          newEdgeIds.add(edge.id);
        }
      }
    }

    set({
      selection: { ...selection, tileIds: newTileIds, edgeIds: newEdgeIds },
    });
  },

  clearSelection: () => {
    set({
      selection: { ...get().selection, tileIds: new Set(), edgeIds: new Set() },
    });
  },

  setSelectionMode: (mode) => {
    set({
      selection: { ...get().selection, mode },
    });
  },

  selectAdjacentEdges: () => {
    // TODO: Implement - select edges between selected and non-selected tiles
  },

  selectInternalEdges: () => {
    // TODO: Implement - select edges between two selected tiles
  },

  lockSelection: () => {
    const { project, selection } = get();
    if (!project || !project.activeSceneId) return;

    set({
      project: {
        ...project,
        scenes: project.scenes.map(scene =>
          scene.id === project.activeSceneId
            ? {
                ...scene,
                placements: scene.placements.map(p =>
                  selection.tileIds.has(p.id) ? { ...p, locked: true } : p
                ),
                edges: scene.edges.map(e =>
                  selection.edgeIds.has(e.id) ? { ...e, locked: true } : e
                ),
              }
            : scene
        ),
      },
    });
  },

  unlockSelection: () => {
    const { project, selection } = get();
    if (!project || !project.activeSceneId) return;

    set({
      project: {
        ...project,
        scenes: project.scenes.map(scene =>
          scene.id === project.activeSceneId
            ? {
                ...scene,
                placements: scene.placements.map(p =>
                  selection.tileIds.has(p.id) ? { ...p, locked: false } : p
                ),
                edges: scene.edges.map(e =>
                  selection.edgeIds.has(e.id) ? { ...e, locked: false } : e
                ),
              }
            : scene
        ),
      },
    });
  },

  setViewport: (viewport) => {
    set({
      viewport: { ...get().viewport, ...viewport },
    });
  },

  setToolMode: (mode) => {
    set({ toolMode: mode });
  },

  addKeyword: (keyword) => {
    const { project } = get();
    if (!project || project.keywords.includes(keyword)) return;

    set({
      project: {
        ...project,
        keywords: [...project.keywords, keyword],
      },
    });
  },

  removeKeyword: (keyword) => {
    const { project } = get();
    if (!project) return;

    set({
      project: {
        ...project,
        keywords: project.keywords.filter(k => k !== keyword),
      },
    });
  },

  importScenes: (scenes) => {
    const { project } = get();
    if (!project) return;

    set({
      project: {
        ...project,
        scenes: [...project.scenes, ...scenes],
        activeSceneId: scenes.length > 0 ? scenes[0].id : project.activeSceneId,
      },
    });
  },
}));
