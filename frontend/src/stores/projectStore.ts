import { create } from 'zustand';
import type { Project, Scene, Tile, TilePlacement, Selection, Viewport, ToolMode } from '../types';

// Tracks uncommitted tile movements/placements
interface UncommittedMove {
  // IDs of newly placed/moved placements
  placementIds: Set<string>;
  // Placements that are currently being covered (at same position as uncommitted placements)
  replacedPlacements: TilePlacement[];
  // Original positions of moved placements (for restoration on cancel)
  originalPositions: Map<string, { gridX: number; gridY: number }>;
}

// History entry for undo/redo - stores scene placements snapshot
interface HistoryEntry {
  sceneId: string;
  placements: TilePlacement[];
  description: string; // For debugging/display
  // Optional: store uncommitted move info so redo can restore it
  uncommittedMove?: UncommittedMove | null;
}

// History state
interface HistoryState {
  past: HistoryEntry[];
  future: HistoryEntry[];
}

const MAX_HISTORY_SIZE = 50;

interface ProjectState {
  // Project data
  project: Project | null;

  // UI state
  selection: Selection;
  viewport: Viewport;
  sceneViewports: Map<string, Viewport>; // Per-scene viewport storage
  needsViewportReset: boolean; // Signal to Canvas to reset viewport to default
  toolMode: ToolMode;
  selectedTileId: string | null; // Tile selected in library for placement
  uncommittedMove: UncommittedMove | null; // Tracks pending tile placement/move

  // History for undo/redo
  history: HistoryState;

  // Actions - Project
  createProject: (name: string, defaultTileSize?: number) => void;
  loadProject: (project: Project) => void;
  renameProject: (name: string) => void;

  // Actions - Scene
  createScene: (name: string, gridWidth: number, gridHeight: number) => void;
  createSceneWithPlacements: (name: string, gridWidth: number, gridHeight: number, placements: TilePlacement[]) => void;
  setActiveScene: (sceneId: string) => void;
  getActiveScene: () => Scene | null;
  renameScene: (sceneId: string, name: string) => void;
  deleteScene: (sceneId: string) => void;

  // Actions - Tiles
  addTile: (tile: Tile) => void;
  addTiles: (tiles: Tile[]) => void;
  removeTile: (tileId: string) => void;
  updateTileLabels: (tileId: string, labels: string[]) => void;
  setSelectedTileId: (tileId: string | null) => void;

  // Actions - Placements
  placeTile: (tileId: string, gridX: number, gridY: number) => void;
  removePlacement: (placementId: string) => void;
  removePlacements: (placementIds: string[]) => void;
  deleteSelectedPlacements: () => void;
  duplicateSelectedPlacements: () => void;
  movePlacement: (placementId: string, gridX: number, gridY: number) => void;
  movePlacements: (placementIds: string[], dx: number, dy: number) => void;
  setPlacementLocked: (placementId: string, locked: boolean) => void;

  // Actions - Edges
  setEdgeLocked: (edgeId: string, locked: boolean) => void;

  // Actions - Selection
  selectTile: (placementId: string, additive?: boolean) => void;
  deselectTile: (placementId: string) => void;
  selectTilesByType: (tileId: string, additive?: boolean) => void;
  selectAllTiles: () => void;
  selectEdge: (edgeId: string, additive?: boolean) => void;
  selectArea: (minX: number, minY: number, maxX: number, maxY: number, additive?: boolean) => void;
  deselectArea: (minX: number, minY: number, maxX: number, maxY: number) => void;
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
  clearNeedsViewportReset: () => void;

  // Actions - Keywords
  addKeyword: (keyword: string) => void;
  removeKeyword: (keyword: string) => void;

  // Actions - Import scenes from other formats
  importScenes: (scenes: Scene[]) => void;

  // Actions - Uncommitted moves
  commitMove: () => void;
  cancelMove: () => void;

  // Actions - History (undo/redo)
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  pushHistory: (description: string) => void;
  clearHistory: () => void;
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

  sceneViewports: new Map(),
  needsViewportReset: false,

  uncommittedMove: null,

  history: {
    past: [],
    future: [],
  },

  toolMode: 'select',
  selectedTileId: null,

  createProject: (name, tileSize = 16) => {
    const project: Project = {
      id: generateId(),
      name,
      tiles: [],
      scenes: [],
      activeSceneId: null,
      keywords: [],
      tileSize,
    };
    set({ project });
  },

  loadProject: (project) => {
    set({
      project,
      // Clear per-scene viewports and signal reset for new project
      sceneViewports: new Map(),
      needsViewportReset: true,
    });
  },

  renameProject: (name) => {
    const { project } = get();
    if (!project) return;
    set({ project: { ...project, name } });
  },

  createScene: (name, gridWidth, gridHeight) => {
    const { project } = get();
    if (!project) return;

    const scene: Scene = {
      id: generateId(),
      name,
      gridWidth,
      gridHeight,
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
      // New scene - signal Canvas to reset viewport to default
      needsViewportReset: true,
    });
  },

  createSceneWithPlacements: (name, gridWidth, gridHeight, placements) => {
    const { project } = get();
    if (!project) return;

    const scene: Scene = {
      id: generateId(),
      name,
      gridWidth,
      gridHeight,
      placements,
      edges: [],
      transparentColor: '#ff00ff',
    };

    set({
      project: {
        ...project,
        scenes: [...project.scenes, scene],
        activeSceneId: scene.id,
      },
      // New scene - signal Canvas to reset viewport to default
      needsViewportReset: true,
    });
  },

  setActiveScene: (sceneId) => {
    const { project, sceneViewports, uncommittedMove } = get();
    if (!project) return;

    // Don't switch if already on this scene
    if (project.activeSceneId === sceneId) return;

    // Commit any uncommitted move before switching scenes
    if (uncommittedMove) {
      get().commitMove();
    }

    // Check if we have a saved viewport for this scene
    const savedViewport = sceneViewports.get(sceneId);

    if (savedViewport) {
      // Restore saved viewport
      set({
        project: { ...project, activeSceneId: sceneId },
        selection: { tileIds: new Set(), edgeIds: new Set(), mode: 'tiles' },
        viewport: savedViewport,
      });
    } else {
      // No saved viewport - signal Canvas to reset to default
      set({
        project: { ...project, activeSceneId: sceneId },
        selection: { tileIds: new Set(), edgeIds: new Set(), mode: 'tiles' },
        needsViewportReset: true,
      });
    }
  },

  renameScene: (sceneId, name) => {
    const { project } = get();
    if (!project) return;

    set({
      project: {
        ...project,
        scenes: project.scenes.map(s =>
          s.id === sceneId ? { ...s, name } : s
        ),
      },
    });
  },

  deleteScene: (sceneId) => {
    const { project } = get();
    if (!project) return;

    const newScenes = project.scenes.filter(s => s.id !== sceneId);
    const newActiveId = project.activeSceneId === sceneId
      ? (newScenes.length > 0 ? newScenes[0].id : null)
      : project.activeSceneId;

    set({
      project: {
        ...project,
        scenes: newScenes,
        activeSceneId: newActiveId,
      },
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
    const { project, uncommittedMove } = get();
    if (!project || !project.activeSceneId) return;

    // Commit any existing uncommitted move first
    if (uncommittedMove) {
      get().commitMove();
    }

    const scene = project.scenes.find(s => s.id === project.activeSceneId);
    if (!scene) return;

    // Find any existing placement at this position
    const existingPlacement = scene.placements.find(
      p => p.gridX === gridX && p.gridY === gridY
    );

    const placement: TilePlacement = {
      id: generateId(),
      tileId,
      gridX,
      gridY,
      locked: false, // Not locked - it's uncommitted
    };

    set({
      project: {
        ...project,
        scenes: project.scenes.map(s =>
          s.id === project.activeSceneId
            ? { ...s, placements: [...s.placements, placement] }
            : s
        ),
      },
      // Track as uncommitted - new placements have no original position (empty map)
      // so they will be deleted on cancel
      uncommittedMove: {
        placementIds: new Set([placement.id]),
        replacedPlacements: existingPlacement ? [existingPlacement] : [],
        originalPositions: new Map(), // Empty - this is a new placement, not a move
      },
      // Select the newly placed tile
      selection: {
        ...get().selection,
        tileIds: new Set([placement.id]),
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

  removePlacements: (placementIds) => {
    const { project } = get();
    if (!project || !project.activeSceneId) return;

    const idsToRemove = new Set(placementIds);

    set({
      project: {
        ...project,
        scenes: project.scenes.map(scene =>
          scene.id === project.activeSceneId
            ? { ...scene, placements: scene.placements.filter(p => !idsToRemove.has(p.id)) }
            : scene
        ),
      },
    });
  },

  deleteSelectedPlacements: () => {
    const { project, selection, history } = get();
    if (!project || !project.activeSceneId || selection.tileIds.size === 0) return;

    const scene = project.scenes.find(s => s.id === project.activeSceneId);
    if (!scene) return;

    // Push history before deleting
    const entry: HistoryEntry = {
      sceneId: scene.id,
      placements: scene.placements.map(p => ({ ...p })),
      description: 'delete tiles',
    };

    const newPast = [...history.past, entry];
    while (newPast.length > MAX_HISTORY_SIZE) {
      newPast.shift();
    }

    // Delete selected placements and clear uncommitted move state
    const idsToRemove = new Set(selection.tileIds);

    set({
      project: {
        ...project,
        scenes: project.scenes.map(s =>
          s.id === project.activeSceneId
            ? { ...s, placements: s.placements.filter(p => !idsToRemove.has(p.id)) }
            : s
        ),
      },
      selection: {
        ...selection,
        tileIds: new Set(),
      },
      uncommittedMove: null,
      history: {
        past: newPast,
        future: [], // Clear redo stack
      },
    });
  },

  duplicateSelectedPlacements: () => {
    const { project, selection, history, uncommittedMove } = get();
    if (!project || !project.activeSceneId || selection.tileIds.size === 0) return;

    // Commit any uncommitted move first
    if (uncommittedMove) {
      get().commitMove();
    }

    const scene = project.scenes.find(s => s.id === project.activeSceneId);
    if (!scene) return;

    // Push history before duplicating
    const entry: HistoryEntry = {
      sceneId: scene.id,
      placements: scene.placements.map(p => ({ ...p })),
      description: 'duplicate tiles',
    };

    const newPast = [...history.past, entry];
    while (newPast.length > MAX_HISTORY_SIZE) {
      newPast.shift();
    }

    // Get selected placements
    const selectedPlacements = scene.placements.filter(p => selection.tileIds.has(p.id));
    if (selectedPlacements.length === 0) return;

    // Calculate bounding box of selection
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of selectedPlacements) {
      minX = Math.min(minX, p.gridX);
      minY = Math.min(minY, p.gridY);
      maxX = Math.max(maxX, p.gridX);
      maxY = Math.max(maxY, p.gridY);
    }

    // Offset for duplicates: try to place adjacent to selection (right side first, then below)
    const selectionWidth = maxX - minX + 1;
    const selectionHeight = maxY - minY + 1;

    // Check if we can place to the right
    let offsetX = selectionWidth;
    let offsetY = 0;
    if (maxX + selectionWidth >= scene.gridWidth) {
      // Can't fit to the right, try below
      offsetX = 0;
      offsetY = selectionHeight;
      if (maxY + selectionHeight >= scene.gridHeight) {
        // Can't fit below either, just offset by 1 in both directions
        offsetX = 1;
        offsetY = 1;
      }
    }

    // Create duplicated placements with new IDs and offset positions
    const newPlacements: TilePlacement[] = selectedPlacements.map(p => ({
      id: generateId(),
      tileId: p.tileId,
      gridX: p.gridX + offsetX,
      gridY: p.gridY + offsetY,
      locked: false,
    }));

    // Create new selection from duplicated tiles
    const newSelectionIds = new Set(newPlacements.map(p => p.id));

    // Track original positions for the new placements (empty map since these are new)
    const originalPositions = new Map<string, { gridX: number; gridY: number }>();

    set({
      project: {
        ...project,
        scenes: project.scenes.map(s =>
          s.id === project.activeSceneId
            ? { ...s, placements: [...s.placements, ...newPlacements] }
            : s
        ),
      },
      selection: {
        ...selection,
        tileIds: newSelectionIds,
      },
      // Mark as uncommitted move so user can immediately drag them
      uncommittedMove: {
        placementIds: newSelectionIds,
        replacedPlacements: [],
        originalPositions,
      },
      history: {
        past: newPast,
        future: [], // Clear redo stack
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

  movePlacements: (placementIds, dx, dy) => {
    const { project, uncommittedMove } = get();
    if (!project || !project.activeSceneId) return;

    const scene = project.scenes.find(s => s.id === project.activeSceneId);
    if (!scene) return;

    const idsSet = new Set(placementIds);

    // Track original positions if this is the first move or we're moving new tiles
    // Only record positions for tiles we don't already have original positions for
    const originalPositions = new Map(uncommittedMove?.originalPositions ?? []);
    for (const p of scene.placements) {
      if (idsSet.has(p.id) && !originalPositions.has(p.id)) {
        originalPositions.set(p.id, { gridX: p.gridX, gridY: p.gridY });
      }
    }

    // Update positions of moved placements
    const updatedPlacements = scene.placements.map(p =>
      idsSet.has(p.id) ? { ...p, gridX: p.gridX + dx, gridY: p.gridY + dy } : p
    );

    // Calculate the NEW positions for moved placements (after the move)
    const newPositions = new Set(
      updatedPlacements
        .filter(p => idsSet.has(p.id))
        .map(p => `${p.gridX},${p.gridY}`)
    );

    // Find placements that are NOW being covered by the moved placements
    // These are tiles at the new positions that are not themselves part of the move
    const replacedPlacements = updatedPlacements.filter(p => {
      if (idsSet.has(p.id)) return false; // Not ourselves
      const posKey = `${p.gridX},${p.gridY}`;
      return newPositions.has(posKey);
    });

    set({
      project: {
        ...project,
        scenes: project.scenes.map(s =>
          s.id === project.activeSceneId
            ? { ...s, placements: updatedPlacements }
            : s
        ),
      },
      uncommittedMove: {
        placementIds: idsSet,
        replacedPlacements,
        originalPositions,
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
    const { selection, uncommittedMove } = get();

    // If selecting something outside the uncommitted move, commit it first
    if (uncommittedMove && !uncommittedMove.placementIds.has(placementId)) {
      get().commitMove();
    }

    const newTileIds = new Set(additive ? selection.tileIds : []);
    newTileIds.add(placementId);

    set({
      selection: { ...selection, tileIds: newTileIds },
    });
  },

  deselectTile: (placementId) => {
    const { selection } = get();
    const newTileIds = new Set(selection.tileIds);
    newTileIds.delete(placementId);

    set({
      selection: { ...selection, tileIds: newTileIds },
    });
  },

  selectTilesByType: (tileId, additive = false) => {
    const { selection } = get();
    const scene = get().getActiveScene();
    if (!scene) return;

    const newTileIds = new Set(additive ? selection.tileIds : []);

    // Find all placements that use this tileId
    for (const placement of scene.placements) {
      if (placement.tileId === tileId) {
        newTileIds.add(placement.id);
      }
    }

    set({
      selection: { ...selection, tileIds: newTileIds },
    });
  },

  selectAllTiles: () => {
    const { selection } = get();
    const scene = get().getActiveScene();
    if (!scene) return;

    const newTileIds = new Set(scene.placements.map(p => p.id));

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

  selectArea: (minX, minY, maxX, maxY, additive = false) => {
    const { selection, uncommittedMove } = get();
    const scene = get().getActiveScene();
    if (!scene) return;

    // Commit any uncommitted move when doing area selection
    if (uncommittedMove) {
      get().commitMove();
    }

    const newTileIds = new Set<string>(additive ? selection.tileIds : []);
    const newEdgeIds = new Set<string>(additive ? selection.edgeIds : []);

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

  deselectArea: (minX, minY, maxX, maxY) => {
    const { selection } = get();
    const scene = get().getActiveScene();
    if (!scene) return;

    const newTileIds = new Set(selection.tileIds);
    const newEdgeIds = new Set(selection.edgeIds);

    // Remove tiles in the area from selection
    if (selection.mode === 'tiles' || selection.mode === 'both') {
      for (const placement of scene.placements) {
        if (
          placement.gridX >= minX &&
          placement.gridX <= maxX &&
          placement.gridY >= minY &&
          placement.gridY <= maxY
        ) {
          newTileIds.delete(placement.id);
        }
      }
    }

    // Remove edges in the area from selection
    if (selection.mode === 'edges' || selection.mode === 'both') {
      for (const edge of scene.edges) {
        if (
          edge.x >= minX &&
          edge.x <= maxX + 1 &&
          edge.y >= minY &&
          edge.y <= maxY + 1
        ) {
          newEdgeIds.delete(edge.id);
        }
      }
    }

    set({
      selection: { ...selection, tileIds: newTileIds, edgeIds: newEdgeIds },
    });
  },

  clearSelection: () => {
    const { uncommittedMove } = get();

    // Commit any uncommitted move when clearing selection
    if (uncommittedMove) {
      get().commitMove();
    }

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
    const { project, sceneViewports } = get();
    const newViewport = { ...get().viewport, ...viewport };

    // Also save to per-scene storage if we have an active scene
    if (project?.activeSceneId) {
      const newSceneViewports = new Map(sceneViewports);
      newSceneViewports.set(project.activeSceneId, newViewport);
      set({
        viewport: newViewport,
        sceneViewports: newSceneViewports,
      });
    } else {
      set({ viewport: newViewport });
    }
  },

  setToolMode: (mode) => {
    set({ toolMode: mode });
  },

  clearNeedsViewportReset: () => {
    set({ needsViewportReset: false });
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

  commitMove: () => {
    const { project, uncommittedMove } = get();
    if (!project || !project.activeSceneId || !uncommittedMove) {
      set({ uncommittedMove: null });
      return;
    }

    // Push history BEFORE committing (save the state before the uncommitted changes were applied)
    // We need to reconstruct what the scene looked like before the uncommitted move
    const scene = project.scenes.find(s => s.id === project.activeSceneId);
    if (scene) {
      // Reconstruct previous state:
      // - Remove uncommitted placements that are new (not in originalPositions)
      // - Restore original positions for moved placements
      // - Add back any replaced placements
      const previousPlacements: TilePlacement[] = [];

      for (const p of scene.placements) {
        if (uncommittedMove.placementIds.has(p.id)) {
          const original = uncommittedMove.originalPositions.get(p.id);
          if (original) {
            // This was a moved placement - restore original position
            previousPlacements.push({ ...p, gridX: original.gridX, gridY: original.gridY });
          }
          // If no original position, it was a new placement - don't include it
        } else {
          // Not part of uncommitted move - keep as is
          previousPlacements.push({ ...p });
        }
      }

      // Add back replaced placements
      for (const replaced of uncommittedMove.replacedPlacements) {
        previousPlacements.push({ ...replaced });
      }

      // Determine description
      const isNewPlacement = uncommittedMove.originalPositions.size === 0;
      const description = isNewPlacement ? 'place tile' : 'move tiles';

      // Push the previous state to history
      const entry: HistoryEntry = {
        sceneId: scene.id,
        placements: previousPlacements,
        description,
      };

      const newPast = [...get().history.past, entry];
      while (newPast.length > MAX_HISTORY_SIZE) {
        newPast.shift();
      }

      // Now actually remove the replaced placements from the scene
      const replacedIds = new Set(uncommittedMove.replacedPlacements.map(p => p.id));

      set({
        project: {
          ...project,
          scenes: project.scenes.map(s => {
            if (s.id !== project.activeSceneId) return s;
            return {
              ...s,
              placements: s.placements.filter(p => !replacedIds.has(p.id)),
            };
          }),
        },
        uncommittedMove: null,
        history: {
          past: newPast,
          future: [], // Clear redo stack on new action
        },
      });
    } else {
      set({ uncommittedMove: null });
    }
  },

  cancelMove: () => {
    const { project, uncommittedMove } = get();
    if (!project || !project.activeSceneId || !uncommittedMove) return;

    set({
      project: {
        ...project,
        scenes: project.scenes.map(scene => {
          if (scene.id !== project.activeSceneId) return scene;

          // Process placements:
          // - Tiles with original positions: restore to those positions
          // - Tiles without original positions (new placements): remove them
          const processedPlacements = scene.placements
            .filter(p => {
              // Keep if not part of uncommitted move
              if (!uncommittedMove.placementIds.has(p.id)) return true;
              // Keep only if we have an original position to restore to
              return uncommittedMove.originalPositions.has(p.id);
            })
            .map(p => {
              // Restore original position if applicable
              if (uncommittedMove.placementIds.has(p.id)) {
                const original = uncommittedMove.originalPositions.get(p.id);
                if (original) {
                  return { ...p, gridX: original.gridX, gridY: original.gridY };
                }
              }
              return p;
            });

          return {
            ...scene,
            placements: processedPlacements,
          };
        }),
      },
      uncommittedMove: null,
      selection: {
        ...get().selection,
        tileIds: new Set(),
      },
    });
  },

  // Push current scene state to history (call BEFORE making changes)
  pushHistory: (description) => {
    const { project, history } = get();
    if (!project || !project.activeSceneId) return;

    const scene = project.scenes.find(s => s.id === project.activeSceneId);
    if (!scene) return;

    // Create a snapshot of current placements
    const entry: HistoryEntry = {
      sceneId: scene.id,
      placements: scene.placements.map(p => ({ ...p })), // Deep copy
      description,
    };

    // Add to past, clear future (new action invalidates redo stack)
    const newPast = [...history.past, entry];

    // Limit history size
    while (newPast.length > MAX_HISTORY_SIZE) {
      newPast.shift();
    }

    set({
      history: {
        past: newPast,
        future: [],
      },
    });
  },

  undo: () => {
    const { project, history, uncommittedMove } = get();
    if (!project || !project.activeSceneId) return;

    const scene = project.scenes.find(s => s.id === project.activeSceneId);
    if (!scene) return;

    // If there's an uncommitted move, undo it but keep tiles selected and uncommitted
    if (uncommittedMove) {
      // Check if this uncommitted move has actual moves (originalPositions not empty)
      // vs being purely new placements (originalPositions empty)
      const hasMoves = uncommittedMove.originalPositions.size > 0;

      if (hasMoves) {
        // This was a move operation - restore to original positions but keep uncommitted
        // Save current state to future for redo
        const currentEntry: HistoryEntry = {
          sceneId: scene.id,
          placements: scene.placements.map(p => ({ ...p })),
          description: 'uncommitted move',
          uncommittedMove: {
            placementIds: new Set(uncommittedMove.placementIds),
            replacedPlacements: uncommittedMove.replacedPlacements.map(p => ({ ...p })),
            originalPositions: new Map(uncommittedMove.originalPositions),
          },
        };

        // Restore placements to their original positions
        const restoredPlacements = scene.placements.map(p => {
          if (uncommittedMove.placementIds.has(p.id)) {
            const original = uncommittedMove.originalPositions.get(p.id);
            if (original) {
              return { ...p, gridX: original.gridX, gridY: original.gridY };
            }
          }
          return p;
        });

        // Add back any replaced placements
        for (const replaced of uncommittedMove.replacedPlacements) {
          restoredPlacements.push({ ...replaced });
        }

        // Keep tiles selected and uncommitted (but now with empty originalPositions
        // since they're back at their "initial" uncommitted position)
        set({
          project: {
            ...project,
            scenes: project.scenes.map(s =>
              s.id === scene.id
                ? { ...s, placements: restoredPlacements }
                : s
            ),
          },
          // Keep uncommitted but clear originalPositions (they're at initial position now)
          uncommittedMove: {
            placementIds: uncommittedMove.placementIds,
            replacedPlacements: [], // No longer covering anything
            originalPositions: new Map(), // Back to initial position
          },
          history: {
            past: history.past,
            future: [currentEntry, ...history.future],
          },
          // Keep selection
          selection: get().selection,
        });
        return;
      } else {
        // This was purely new placements (like duplicate) with no subsequent moves
        // Cancel it completely - remove the placements
        const currentEntry: HistoryEntry = {
          sceneId: scene.id,
          placements: scene.placements.map(p => ({ ...p })),
          description: 'uncommitted move',
          uncommittedMove: {
            placementIds: new Set(uncommittedMove.placementIds),
            replacedPlacements: uncommittedMove.replacedPlacements.map(p => ({ ...p })),
            originalPositions: new Map(uncommittedMove.originalPositions),
          },
        };

        // Remove uncommitted placements entirely
        const previousPlacements = scene.placements.filter(
          p => !uncommittedMove.placementIds.has(p.id)
        );

        // Add back replaced placements
        for (const replaced of uncommittedMove.replacedPlacements) {
          previousPlacements.push({ ...replaced });
        }

        set({
          project: {
            ...project,
            scenes: project.scenes.map(s =>
              s.id === scene.id
                ? { ...s, placements: previousPlacements }
                : s
            ),
          },
          uncommittedMove: null,
          history: {
            past: history.past,
            future: [currentEntry, ...history.future],
          },
          selection: {
            ...get().selection,
            tileIds: new Set(),
          },
        });
        return;
      }
    }

    if (history.past.length === 0) return;

    // Get the last history entry
    const lastEntry = history.past[history.past.length - 1];

    // Find the scene this entry belongs to
    const targetScene = project.scenes.find(s => s.id === lastEntry.sceneId);
    if (!targetScene) return;

    // Save current state of the TARGET scene to future (for redo)
    const currentEntry: HistoryEntry = {
      sceneId: targetScene.id,
      placements: targetScene.placements.map(p => ({ ...p })),
      description: 'redo point',
    };

    // Restore the previous state and switch to the target scene if needed
    set({
      project: {
        ...project,
        activeSceneId: targetScene.id,
        scenes: project.scenes.map(s =>
          s.id === targetScene.id
            ? { ...s, placements: lastEntry.placements.map(p => ({ ...p })) }
            : s
        ),
      },
      history: {
        past: history.past.slice(0, -1),
        future: [currentEntry, ...history.future],
      },
      selection: {
        ...get().selection,
        tileIds: new Set(),
      },
    });
  },

  redo: () => {
    const { project, history, uncommittedMove } = get();
    if (!project || history.future.length === 0) return;

    // Cancel any uncommitted move first
    if (uncommittedMove) {
      get().cancelMove();
    }

    // Get the first future entry
    const nextEntry = history.future[0];

    // Find the scene this entry belongs to
    const targetScene = project.scenes.find(s => s.id === nextEntry.sceneId);
    if (!targetScene) return;

    // Save current state of the TARGET scene to past (for undo)
    const currentEntry: HistoryEntry = {
      sceneId: targetScene.id,
      placements: targetScene.placements.map(p => ({ ...p })),
      description: 'undo point',
    };

    // If the entry has uncommitted move info, restore it along with selection
    const restoredUncommittedMove = nextEntry.uncommittedMove ? {
      placementIds: new Set(nextEntry.uncommittedMove.placementIds),
      replacedPlacements: nextEntry.uncommittedMove.replacedPlacements.map(p => ({ ...p })),
      originalPositions: new Map(nextEntry.uncommittedMove.originalPositions),
    } : null;

    // Apply the future state and switch to the target scene if needed
    set({
      project: {
        ...project,
        activeSceneId: targetScene.id,
        scenes: project.scenes.map(s =>
          s.id === targetScene.id
            ? { ...s, placements: nextEntry.placements.map(p => ({ ...p })) }
            : s
        ),
      },
      history: {
        past: [...history.past, currentEntry],
        future: history.future.slice(1),
      },
      uncommittedMove: restoredUncommittedMove,
      selection: {
        ...get().selection,
        // If restoring uncommitted move, select those tiles
        tileIds: restoredUncommittedMove ? new Set(restoredUncommittedMove.placementIds) : new Set(),
      },
    });
  },

  canUndo: () => {
    const { history, project, uncommittedMove } = get();
    if (!project) return false;
    // Can undo if there's an uncommitted move OR history entries exist
    return uncommittedMove !== null || history.past.length > 0;
  },

  canRedo: () => {
    const { history, project } = get();
    if (!project) return false;
    return history.future.length > 0;
  },

  clearHistory: () => {
    set({
      history: {
        past: [],
        future: [],
      },
    });
  },
}));
