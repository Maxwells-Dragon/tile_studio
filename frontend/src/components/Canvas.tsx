import { useRef, useEffect, useCallback, useState } from 'react';
import { useProjectStore } from '../stores/projectStore';

interface CanvasProps {
  // Props no longer needed - canvas auto-sizes to container
}

// Drag state types
type DragMode = 'none' | 'pan' | 'joystick' | 'boxSelect' | 'moveTiles';

interface DragState {
  mode: DragMode;
  startX: number;
  startY: number;
  startOffsetX: number;
  startOffsetY: number;
  // For box selection: grid coordinates
  startGridX?: number;
  startGridY?: number;
  // Modifier keys held at start of drag
  shiftKey?: boolean;
  ctrlKey?: boolean;
}

// Cache for converting ImageData to drawable ImageBitmap
const imageBitmapCache = new Map<string, ImageBitmap>();

async function getImageBitmap(tileId: string, imageData: ImageData): Promise<ImageBitmap> {
  const cached = imageBitmapCache.get(tileId);
  if (cached) return cached;

  const bitmap = await createImageBitmap(imageData);
  imageBitmapCache.set(tileId, bitmap);
  return bitmap;
}

// Clear cache when tiles change
export function clearImageBitmapCache() {
  imageBitmapCache.clear();
}

export function Canvas(_props: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { project, viewport, selection, toolMode, selectedTileId, uncommittedMove, needsViewportReset } = useProjectStore();
  const scene = useProjectStore(state => state.getActiveScene());

  // Canvas dimensions (auto-sized to container)
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  // Track mouse position for hover preview and box selection
  const [hoverPos, setHoverPos] = useState<{ gridX: number; gridY: number } | null>(null);

  // Current box selection end position (grid coords)
  const [boxSelectEnd, setBoxSelectEnd] = useState<{ gridX: number; gridY: number } | null>(null);

  // Move tiles drag offset (grid delta from start position)
  const [moveOffset, setMoveOffset] = useState<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  // External drag (from library) state
  const [externalDrag, setExternalDrag] = useState<{ tileId: string; gridX: number; gridY: number } | null>(null);

  // Drag state for panning
  const [dragState, setDragState] = useState<DragState>({
    mode: 'none',
    startX: 0,
    startY: 0,
    startOffsetX: 0,
    startOffsetY: 0,
  });

  // Joystick panning state
  const joystickRef = useRef<{ velocityX: number; velocityY: number }>({ velocityX: 0, velocityY: 0 });
  const animationFrameRef = useRef<number | null>(null);

  // Tile bitmaps for rendering (async loaded)
  const [tileBitmaps, setTileBitmaps] = useState<Map<string, ImageBitmap>>(new Map());

  // Load tile bitmaps when tiles change
  useEffect(() => {
    if (!project?.tiles) return;

    const loadBitmaps = async () => {
      const newBitmaps = new Map<string, ImageBitmap>();
      for (const tile of project.tiles) {
        if (tile.imageData) {
          const bitmap = await getImageBitmap(tile.id, tile.imageData);
          newBitmaps.set(tile.id, bitmap);
        }
      }
      setTileBitmaps(newBitmaps);
    };

    loadBitmaps();
  }, [project?.tiles]);

  // Auto-size canvas to fill container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        // Use floor to avoid fractional pixels
        setCanvasSize({
          width: Math.floor(width),
          height: Math.floor(height),
        });
      }
    });

    resizeObserver.observe(container);

    // Initial size
    const rect = container.getBoundingClientRect();
    setCanvasSize({
      width: Math.floor(rect.width),
      height: Math.floor(rect.height),
    });

    return () => resizeObserver.disconnect();
  }, []);

  // Convert screen coordinates to grid coordinates (returns null if outside grid bounds)
  const screenToGrid = useCallback(
    (screenX: number, screenY: number): { gridX: number; gridY: number } | null => {
      if (!scene) return null;

      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      const canvasX = screenX - rect.left;
      const canvasY = screenY - rect.top;

      // Reverse viewport transform
      const worldX = (canvasX - viewport.offsetX) / viewport.zoom;
      const worldY = (canvasY - viewport.offsetY) / viewport.zoom;

      const gridX = Math.floor(worldX / scene.tileSize);
      const gridY = Math.floor(worldY / scene.tileSize);

      // Check bounds
      if (gridX < 0 || gridX >= scene.gridWidth || gridY < 0 || gridY >= scene.gridHeight) {
        return null;
      }

      return { gridX, gridY };
    },
    [scene, viewport]
  );

  // Convert screen coordinates to grid coordinates (unbounded - can return negative or beyond grid)
  const screenToGridUnbounded = useCallback(
    (screenX: number, screenY: number): { gridX: number; gridY: number } | null => {
      if (!scene) return null;

      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      const canvasX = screenX - rect.left;
      const canvasY = screenY - rect.top;

      // Reverse viewport transform
      const worldX = (canvasX - viewport.offsetX) / viewport.zoom;
      const worldY = (canvasY - viewport.offsetY) / viewport.zoom;

      const gridX = Math.floor(worldX / scene.tileSize);
      const gridY = Math.floor(worldY / scene.tileSize);

      return { gridX, gridY };
    },
    [scene, viewport]
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvasSize;

    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    if (!scene) {
      // Draw placeholder text
      ctx.fillStyle = '#666';
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('No scene active. Create a scene to get started.', width / 2, height / 2);
      return;
    }

    // Apply viewport transform
    ctx.save();
    ctx.translate(viewport.offsetX, viewport.offsetY);
    ctx.scale(viewport.zoom, viewport.zoom);

    const { tileSize, gridWidth, gridHeight } = scene;

    // Draw grid background
    ctx.fillStyle = '#2a2a3e';
    ctx.fillRect(0, 0, gridWidth * tileSize, gridHeight * tileSize);

    // Draw grid lines
    ctx.strokeStyle = '#3a3a4e';
    ctx.lineWidth = 1 / viewport.zoom; // Keep line width consistent regardless of zoom
    for (let x = 0; x <= gridWidth; x++) {
      ctx.beginPath();
      ctx.moveTo(x * tileSize, 0);
      ctx.lineTo(x * tileSize, gridHeight * tileSize);
      ctx.stroke();
    }
    for (let y = 0; y <= gridHeight; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * tileSize);
      ctx.lineTo(gridWidth * tileSize, y * tileSize);
      ctx.stroke();
    }

    // Create a map of tiles for faster lookup
    const tileMap = new Map(project?.tiles.map(t => [t.id, t]) ?? []);

    // Helper to draw a single placement
    const drawPlacement = (placement: typeof scene.placements[0]) => {
      const tile = tileMap.get(placement.tileId);
      if (!tile) return;

      const x = placement.gridX * tileSize;
      const y = placement.gridY * tileSize;

      // Draw tile image using bitmap (respects canvas transform)
      const bitmap = tileBitmaps.get(tile.id);
      if (bitmap) {
        ctx.drawImage(bitmap, x, y);
      } else {
        // Placeholder for tiles without images
        ctx.fillStyle = '#4a4a5e';
        ctx.fillRect(x + 1, y + 1, tileSize - 2, tileSize - 2);
      }

      // Draw lock indicator (dimmed overlay for locked tiles)
      if (placement.locked) {
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = '#000';
        ctx.fillRect(x, y, tileSize, tileSize);
        ctx.globalAlpha = 1;
      }

      // Draw selection highlight
      if (selection.tileIds.has(placement.id)) {
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2 / viewport.zoom;
        ctx.strokeRect(x + 1, y + 1, tileSize - 2, tileSize - 2);
      }
    };

    // Draw placed tiles in two passes:
    // 1. First draw non-uncommitted tiles (these may be "under" uncommitted ones)
    // 2. Then draw uncommitted tiles on top
    for (const placement of scene.placements) {
      if (!uncommittedMove?.placementIds.has(placement.id)) {
        drawPlacement(placement);
      }
    }
    for (const placement of scene.placements) {
      if (uncommittedMove?.placementIds.has(placement.id)) {
        drawPlacement(placement);
      }
    }

    // Draw edges
    for (const edge of scene.edges) {
      const isSelected = selection.edgeIds.has(edge.id);

      if (edge.orientation === 'horizontal') {
        const x = edge.x * tileSize;
        const y = edge.y * tileSize;

        ctx.strokeStyle = edge.locked ? '#ff8800' : '#666';
        ctx.lineWidth = (isSelected ? 3 : 2) / viewport.zoom;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + tileSize, y);
        ctx.stroke();
      } else {
        const x = edge.x * tileSize;
        const y = edge.y * tileSize;

        ctx.strokeStyle = edge.locked ? '#ff8800' : '#666';
        ctx.lineWidth = (isSelected ? 3 : 2) / viewport.zoom;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + tileSize);
        ctx.stroke();
      }
    }

    // Draw hover preview for tile placement
    if (toolMode === 'place' && selectedTileId && hoverPos) {
      const bitmap = tileBitmaps.get(selectedTileId);
      if (bitmap) {
        const x = hoverPos.gridX * tileSize;
        const y = hoverPos.gridY * tileSize;

        // Draw semi-transparent preview
        ctx.globalAlpha = 0.5;
        ctx.drawImage(bitmap, x, y);
        ctx.globalAlpha = 1;

        // Draw outline
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2 / viewport.zoom;
        ctx.strokeRect(x, y, tileSize, tileSize);
      }
    }

    // Draw external drag preview (from library)
    if (externalDrag) {
      const bitmap = tileBitmaps.get(externalDrag.tileId);
      if (bitmap) {
        const x = externalDrag.gridX * tileSize;
        const y = externalDrag.gridY * tileSize;

        // Draw semi-transparent preview
        ctx.globalAlpha = 0.5;
        ctx.drawImage(bitmap, x, y);
        ctx.globalAlpha = 1;

        // Draw outline (cyan for external drag)
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2 / viewport.zoom;
        ctx.strokeRect(x, y, tileSize, tileSize);
      }
    }

    // Draw ghost tiles during move drag
    if (dragState.mode === 'moveTiles' && (moveOffset.dx !== 0 || moveOffset.dy !== 0)) {
      ctx.globalAlpha = 0.5;
      for (const placement of scene.placements) {
        if (!selection.tileIds.has(placement.id)) continue;

        const tile = tileMap.get(placement.tileId);
        if (!tile) continue;

        const newGridX = placement.gridX + moveOffset.dx;
        const newGridY = placement.gridY + moveOffset.dy;
        const x = newGridX * tileSize;
        const y = newGridY * tileSize;

        const bitmap = tileBitmaps.get(tile.id);
        if (bitmap) {
          ctx.drawImage(bitmap, x, y);
        }

        // Draw outline
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2 / viewport.zoom;
        ctx.strokeRect(x, y, tileSize, tileSize);
      }
      ctx.globalAlpha = 1;
    }

    // Draw box selection rectangle
    if (dragState.mode === 'boxSelect' && boxSelectEnd !== null && dragState.startGridX !== undefined && dragState.startGridY !== undefined) {
      const startX = dragState.startGridX;
      const startY = dragState.startGridY;
      const endX = boxSelectEnd.gridX;
      const endY = boxSelectEnd.gridY;

      const minX = Math.min(startX, endX);
      const maxX = Math.max(startX, endX);
      const minY = Math.min(startY, endY);
      const maxY = Math.max(startY, endY);

      const rectX = minX * tileSize;
      const rectY = minY * tileSize;
      const rectW = (maxX - minX + 1) * tileSize;
      const rectH = (maxY - minY + 1) * tileSize;

      // Different colors for add vs remove selection
      if (dragState.ctrlKey) {
        // Ctrl+drag: red for deselection
        ctx.fillStyle = 'rgba(255, 100, 100, 0.2)';
        ctx.strokeStyle = '#ff6666';
      } else {
        // Normal/Shift drag: blue for selection
        ctx.fillStyle = 'rgba(100, 150, 255, 0.2)';
        ctx.strokeStyle = '#6699ff';
      }

      ctx.fillRect(rectX, rectY, rectW, rectH);
      ctx.lineWidth = 2 / viewport.zoom;
      ctx.setLineDash([5 / viewport.zoom, 5 / viewport.zoom]);
      ctx.strokeRect(rectX, rectY, rectW, rectH);
      ctx.setLineDash([]);
    }

    ctx.restore();
  }, [scene, project, viewport, selection, canvasSize, toolMode, selectedTileId, hoverPos, tileBitmaps, dragState, boxSelectEnd, moveOffset, externalDrag, uncommittedMove]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Calculate default viewport (grid centered, sized so width or height is half canvas - whichever is smaller)
  const calculateDefaultViewport = useCallback(() => {
    if (!scene) return null;

    const { gridWidth, gridHeight, tileSize } = scene;
    const gridPixelWidth = gridWidth * tileSize;
    const gridPixelHeight = gridHeight * tileSize;

    // Calculate zoom so that either grid width = canvas width / 2 OR grid height = canvas height / 2
    // Use whichever results in the smaller grid (smaller zoom)
    const zoomForWidth = (canvasSize.width / 2) / gridPixelWidth;
    const zoomForHeight = (canvasSize.height / 2) / gridPixelHeight;
    const zoom = Math.min(zoomForWidth, zoomForHeight);

    // Center the grid in the canvas
    const scaledGridWidth = gridPixelWidth * zoom;
    const scaledGridHeight = gridPixelHeight * zoom;
    const offsetX = (canvasSize.width - scaledGridWidth) / 2;
    const offsetY = (canvasSize.height - scaledGridHeight) / 2;

    return { zoom, offsetX, offsetY };
  }, [scene, canvasSize]);

  // Handle viewport reset signal (when loading project or creating new scene)
  useEffect(() => {
    if (needsViewportReset) {
      const { setViewport, clearNeedsViewportReset } = useProjectStore.getState();
      const defaultViewport = calculateDefaultViewport();
      if (defaultViewport) {
        setViewport(defaultViewport);
      }
      clearNeedsViewportReset();
    }
  }, [needsViewportReset, calculateDefaultViewport]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if focus is in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const {
        clearSelection,
        commitMove,
        selectAllTiles,
        deleteSelectedPlacements,
        cancelMove,
        setSelectedTileId,
        setToolMode,
        setViewport,
        setActiveScene,
        undo,
        redo,
        uncommittedMove,
        project
      } = useProjectStore.getState();

      // Escape: commit any uncommitted move and deselect, also exit placement mode
      if (e.key === 'Escape') {
        e.preventDefault();
        if (uncommittedMove) {
          commitMove();
        }
        clearSelection();
        // Also exit placement mode if active
        setSelectedTileId(null);
        setToolMode('select');
      }

      // Backspace: cancel uncommitted move and deselect
      if (e.key === 'Backspace') {
        e.preventDefault();
        if (uncommittedMove) {
          cancelMove();
        } else {
          clearSelection();
        }
        setSelectedTileId(null);
        setToolMode('select');
      }

      // Ctrl+A: select all tiles
      if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        selectAllTiles();
      }

      // Delete: delete selected tiles
      if (e.key === 'Delete') {
        e.preventDefault();
        deleteSelectedPlacements();
      }

      // Home: reset viewport to default (centered, appropriate zoom)
      if (e.key === 'Home') {
        e.preventDefault();
        const defaultViewport = calculateDefaultViewport();
        if (defaultViewport) {
          setViewport(defaultViewport);
        }
      }

      // Ctrl+Z: undo
      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        undo();
      }

      // Ctrl+Y or Ctrl+Shift+Z: redo
      if ((e.key === 'y' && (e.ctrlKey || e.metaKey)) ||
          (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey)) {
        e.preventDefault();
        redo();
      }

      // Tab / Shift+Tab: cycle through scenes
      if (e.key === 'Tab' && project && project.scenes.length > 1) {
        e.preventDefault();
        const currentIndex = project.scenes.findIndex(s => s.id === project.activeSceneId);
        if (currentIndex !== -1) {
          let nextIndex: number;
          if (e.shiftKey) {
            // Shift+Tab: go to previous scene (wrap around)
            nextIndex = (currentIndex - 1 + project.scenes.length) % project.scenes.length;
          } else {
            // Tab: go to next scene (wrap around)
            nextIndex = (currentIndex + 1) % project.scenes.length;
          }
          setActiveScene(project.scenes[nextIndex].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [calculateDefaultViewport]);

  // Global mouse event handlers for drag operations that continue outside canvas
  useEffect(() => {
    if (dragState.mode !== 'moveTiles' && dragState.mode !== 'pan') return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (dragState.mode === 'pan') {
        const dx = e.clientX - dragState.startX;
        const dy = e.clientY - dragState.startY;
        const { setViewport } = useProjectStore.getState();
        setViewport({
          offsetX: dragState.startOffsetX + dx,
          offsetY: dragState.startOffsetY + dy,
        });
      } else if (dragState.mode === 'moveTiles') {
        const gridPos = screenToGridUnbounded(e.clientX, e.clientY);
        if (gridPos && dragState.startGridX !== undefined && dragState.startGridY !== undefined) {
          const dx = gridPos.gridX - dragState.startGridX;
          const dy = gridPos.gridY - dragState.startGridY;
          setMoveOffset({ dx, dy });
        }
      }
    };

    const handleGlobalMouseUp = (_e: MouseEvent) => {
      if (dragState.mode === 'moveTiles' && (moveOffset.dx !== 0 || moveOffset.dy !== 0)) {
        const { movePlacements, deleteSelectedPlacements, selection } = useProjectStore.getState();
        const scene = useProjectStore.getState().getActiveScene();
        const placementIds = Array.from(selection.tileIds);

        // Check if any tile would be moved outside the grid bounds
        const wouldBeOffScene = scene?.placements.some(p => {
          if (!selection.tileIds.has(p.id)) return false;
          const newX = p.gridX + moveOffset.dx;
          const newY = p.gridY + moveOffset.dy;
          return newX < 0 || newX >= (scene?.gridWidth ?? 0) ||
                 newY < 0 || newY >= (scene?.gridHeight ?? 0);
        });

        if (wouldBeOffScene) {
          // Delete the tiles when dragged off-scene
          deleteSelectedPlacements();
        } else {
          // Proceed with the move
          movePlacements(placementIds, moveOffset.dx, moveOffset.dy);
        }
        setMoveOffset({ dx: 0, dy: 0 });
      }

      // Reset drag state
      setDragState({
        mode: 'none',
        startX: 0,
        startY: 0,
        startOffsetX: 0,
        startOffsetY: 0,
      });
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [dragState, moveOffset, screenToGridUnbounded]);

  // Joystick pan animation loop
  const startJoystickPan = useCallback(() => {
    const animate = () => {
      const { velocityX, velocityY } = joystickRef.current;
      if (velocityX !== 0 || velocityY !== 0) {
        const { setViewport, viewport } = useProjectStore.getState();
        setViewport({
          offsetX: viewport.offsetX + velocityX,
          offsetY: viewport.offsetY + velocityY,
        });
      }
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animationFrameRef.current = requestAnimationFrame(animate);
  }, []);

  const stopJoystickPan = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    joystickRef.current = { velocityX: 0, velocityY: 0 };
  }, []);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // Right-click starts drag panning
      if (e.button === 2) {
        e.preventDefault();
        setDragState({
          mode: 'pan',
          startX: e.clientX,
          startY: e.clientY,
          startOffsetX: viewport.offsetX,
          startOffsetY: viewport.offsetY,
        });
        return;
      }

      // Middle-click starts joystick panning
      if (e.button === 1) {
        e.preventDefault();
        setDragState({
          mode: 'joystick',
          startX: e.clientX,
          startY: e.clientY,
          startOffsetX: viewport.offsetX,
          startOffsetY: viewport.offsetY,
        });
        joystickRef.current = { velocityX: 0, velocityY: 0 };
        startJoystickPan();
        return;
      }

      // Left-click handling
      if (e.button === 0) {
        const gridPos = screenToGrid(e.clientX, e.clientY);

        const { placeTile, selectTile, clearSelection } = useProjectStore.getState();

        if (toolMode === 'place' && selectedTileId) {
          // Place the selected tile
          if (gridPos) {
            placeTile(selectedTileId, gridPos.gridX, gridPos.gridY);
          }
        } else if (toolMode === 'select') {
          // Find placement at this position
          // When multiple tiles are at the same position, prefer:
          // 1. Selected tiles (part of uncommitted move)
          // 2. Any tile at that position
          const placementsAtPos = gridPos ? scene?.placements.filter(
            p => p.gridX === gridPos.gridX && p.gridY === gridPos.gridY
          ) ?? [] : [];

          const placement = placementsAtPos.find(p => selection.tileIds.has(p.id))
            ?? placementsAtPos[0]
            ?? null;

          // Check if clicking on an already-selected tile
          const clickedOnSelected = placement && selection.tileIds.has(placement.id);

          if (placement && !e.shiftKey && !e.ctrlKey) {
            // Clicking on a tile without modifiers:
            // - If unselected: select it (deselecting others)
            // - Either way: start move drag immediately
            if (!clickedOnSelected) {
              selectTile(placement.id, false);
            }
            setDragState({
              mode: 'moveTiles',
              startX: e.clientX,
              startY: e.clientY,
              startOffsetX: viewport.offsetX,
              startOffsetY: viewport.offsetY,
              startGridX: gridPos!.gridX,
              startGridY: gridPos!.gridY,
            });
            setMoveOffset({ dx: 0, dy: 0 });
          } else {
            // Either:
            // - Clicked on empty space (with or without modifiers)
            // - Clicked on tile with Shift or Ctrl held
            // In both cases, start potential box selection
            const startGrid = gridPos ?? { gridX: 0, gridY: 0 };

            // If no modifier and clicking empty space, clear selection
            if (!e.shiftKey && !e.ctrlKey && !placement) {
              clearSelection();
            }

            setDragState({
              mode: 'boxSelect',
              startX: e.clientX,
              startY: e.clientY,
              startOffsetX: viewport.offsetX,
              startOffsetY: viewport.offsetY,
              startGridX: startGrid.gridX,
              startGridY: startGrid.gridY,
              shiftKey: e.shiftKey,
              ctrlKey: e.ctrlKey,
            });
            setBoxSelectEnd(startGrid);
          }
        }
      }
    },
    [toolMode, selectedTileId, scene, screenToGrid, viewport.offsetX, viewport.offsetY, startJoystickPan, selection.tileIds]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return; // Only handle left double-click

      const gridPos = screenToGrid(e.clientX, e.clientY);
      if (!gridPos) return;

      const { selectTilesByType } = useProjectStore.getState();

      // Find placement at this position (prefer selected tiles when overlapping)
      const placementsAtPos = scene?.placements.filter(
        p => p.gridX === gridPos.gridX && p.gridY === gridPos.gridY
      ) ?? [];

      const placement = placementsAtPos.find(p => selection.tileIds.has(p.id))
        ?? placementsAtPos[0]
        ?? null;

      if (placement) {
        // Double-click on a tile: select all tiles of the same type
        const additive = e.shiftKey; // Shift+double-click adds to selection
        selectTilesByType(placement.tileId, additive);
      }
    },
    [scene, screenToGrid, selection.tileIds]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // Handle drag panning (right-click)
      if (dragState.mode === 'pan') {
        const dx = e.clientX - dragState.startX;
        const dy = e.clientY - dragState.startY;
        const { setViewport } = useProjectStore.getState();
        setViewport({
          offsetX: dragState.startOffsetX + dx,
          offsetY: dragState.startOffsetY + dy,
        });
        return;
      }

      // Handle joystick panning (middle-click)
      if (dragState.mode === 'joystick') {
        const dx = e.clientX - dragState.startX;
        const dy = e.clientY - dragState.startY;
        // Velocity scales with distance from start point
        // Use a sensitivity factor to control speed
        const sensitivity = 0.1;
        joystickRef.current = {
          velocityX: dx * sensitivity,
          velocityY: dy * sensitivity,
        };
        return;
      }

      // Handle box selection drag
      if (dragState.mode === 'boxSelect') {
        const gridPos = screenToGrid(e.clientX, e.clientY);
        if (gridPos) {
          setBoxSelectEnd(gridPos);
        }
        return;
      }

      // Handle move tiles drag - use unbounded so we can track off-grid drags
      if (dragState.mode === 'moveTiles') {
        const gridPos = screenToGridUnbounded(e.clientX, e.clientY);
        if (gridPos && dragState.startGridX !== undefined && dragState.startGridY !== undefined) {
          const dx = gridPos.gridX - dragState.startGridX;
          const dy = gridPos.gridY - dragState.startGridY;
          setMoveOffset({ dx, dy });
        }
        return;
      }

      // Update hover position
      const gridPos = screenToGrid(e.clientX, e.clientY);
      setHoverPos(gridPos);
    },
    [screenToGrid, screenToGridUnbounded, dragState]
  );

  const handleMouseUp = useCallback(
    (_e: React.MouseEvent<HTMLCanvasElement>) => {
      // Complete move tiles
      if (dragState.mode === 'moveTiles' && (moveOffset.dx !== 0 || moveOffset.dy !== 0)) {
        const { movePlacements, deleteSelectedPlacements } = useProjectStore.getState();
        const placementIds = Array.from(selection.tileIds);

        // Check if any tile would be moved outside the grid bounds
        const wouldBeOffScene = scene?.placements.some(p => {
          if (!selection.tileIds.has(p.id)) return false;
          const newX = p.gridX + moveOffset.dx;
          const newY = p.gridY + moveOffset.dy;
          return newX < 0 || newX >= (scene?.gridWidth ?? 0) ||
                 newY < 0 || newY >= (scene?.gridHeight ?? 0);
        });

        if (wouldBeOffScene) {
          // Delete the tiles when dragged off-scene
          deleteSelectedPlacements();
        } else {
          // Proceed with the move
          movePlacements(placementIds, moveOffset.dx, moveOffset.dy);
        }
        setMoveOffset({ dx: 0, dy: 0 });
      }

      // Complete box selection
      if (dragState.mode === 'boxSelect' && boxSelectEnd !== null) {
        const startX = dragState.startGridX ?? 0;
        const startY = dragState.startGridY ?? 0;
        const endX = boxSelectEnd.gridX;
        const endY = boxSelectEnd.gridY;

        const minX = Math.min(startX, endX);
        const maxX = Math.max(startX, endX);
        const minY = Math.min(startY, endY);
        const maxY = Math.max(startY, endY);

        const { selectArea, deselectArea } = useProjectStore.getState();

        if (dragState.ctrlKey) {
          // Ctrl+drag: deselect area
          deselectArea(minX, minY, maxX, maxY);
        } else {
          // Normal or Shift+drag: select area (additive if shift was held)
          selectArea(minX, minY, maxX, maxY, dragState.shiftKey);
        }

        setBoxSelectEnd(null);
      }

      // End joystick panning
      if (dragState.mode === 'joystick') {
        stopJoystickPan();
      }

      // Reset drag state
      if (dragState.mode !== 'none') {
        setDragState({
          mode: 'none',
          startX: 0,
          startY: 0,
          startOffsetX: 0,
          startOffsetY: 0,
        });
      }
    },
    [dragState, boxSelectEnd, stopJoystickPan, moveOffset, selection.tileIds]
  );

  const handleMouseLeave = useCallback(() => {
    setHoverPos(null);
    // End some drag modes if mouse leaves canvas, but NOT moveTiles
    // moveTiles continues so user can drag off-screen to delete
    if (dragState.mode === 'joystick') {
      stopJoystickPan();
      setDragState({
        mode: 'none',
        startX: 0,
        startY: 0,
        startOffsetX: 0,
        startOffsetY: 0,
      });
    }
    if (dragState.mode === 'boxSelect') {
      setBoxSelectEnd(null);
      setDragState({
        mode: 'none',
        startX: 0,
        startY: 0,
        startOffsetX: 0,
        startOffsetY: 0,
      });
    }
    // Don't cancel moveTiles or pan mode - they can continue outside canvas
  }, [dragState.mode, stopJoystickPan]);

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const { setViewport } = useProjectStore.getState();

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Zoom centered on cursor
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.1, Math.min(8, viewport.zoom * zoomFactor));

      // Calculate new offset to keep the point under cursor fixed
      // The point in world space that's currently under the cursor
      const worldX = (mouseX - viewport.offsetX) / viewport.zoom;
      const worldY = (mouseY - viewport.offsetY) / viewport.zoom;

      // After zoom, that same world point should still be under the cursor
      const newOffsetX = mouseX - worldX * newZoom;
      const newOffsetY = mouseY - worldY * newZoom;

      setViewport({
        zoom: newZoom,
        offsetX: newOffsetX,
        offsetY: newOffsetY,
      });
    },
    [viewport]
  );

  // Determine cursor based on current state
  const getCursor = () => {
    if (dragState.mode === 'pan') return 'grabbing';
    if (dragState.mode === 'joystick') return 'move';
    if (dragState.mode === 'boxSelect') return 'crosshair';
    if (dragState.mode === 'moveTiles') return 'move';
    if (toolMode === 'pan') return 'grab';
    if (toolMode === 'place' && selectedTileId) return 'copy';
    if (toolMode === 'select') return 'default';
    return 'crosshair';
  };

  // Prevent default context menu on right-click
  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    // TODO: Show custom context menu if no drag occurred
  }, []);

  // Handle external drag over (from library)
  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLCanvasElement>) => {
      // Check if this is a tile drag
      if (!e.dataTransfer.types.includes('application/tile-id')) return;

      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';

      const gridPos = screenToGrid(e.clientX, e.clientY);
      if (!gridPos) {
        setExternalDrag(null);
        return;
      }

      // Get the tile ID from the drag data (we can't read it during dragover, so we track it separately)
      // For now, we'll show a generic preview position
      const tileId = e.dataTransfer.getData('application/tile-id') || externalDrag?.tileId || '';
      if (tileId || externalDrag) {
        setExternalDrag({
          tileId: tileId || externalDrag?.tileId || '',
          gridX: gridPos.gridX,
          gridY: gridPos.gridY,
        });
      }
    },
    [screenToGrid, externalDrag]
  );

  const handleDragLeave = useCallback(() => {
    setExternalDrag(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLCanvasElement>) => {
      e.preventDefault();

      const tileId = e.dataTransfer.getData('application/tile-id');
      if (!tileId) return;

      const gridPos = screenToGrid(e.clientX, e.clientY);
      if (!gridPos) {
        setExternalDrag(null);
        return;
      }

      // Place the tile
      const { placeTile, setSelectedTileId, setToolMode } = useProjectStore.getState();
      placeTile(tileId, gridPos.gridX, gridPos.gridY);

      // End placement mode - go back to select mode with the new tile selected
      setSelectedTileId(null);
      setToolMode('select');

      setExternalDrag(null);
    },
    [screenToGrid]
  );

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          cursor: getCursor(),
        }}
      />
    </div>
  );
}
