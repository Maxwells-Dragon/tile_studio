import { useRef, useEffect, useCallback, useState } from 'react';
import { useProjectStore } from '../stores/projectStore';

interface CanvasProps {
  width?: number;
  height?: number;
}

export function Canvas({ width = 800, height = 600 }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { project, viewport, selection, toolMode, selectedTileId } = useProjectStore();
  const scene = useProjectStore(state => state.getActiveScene());

  // Track mouse position for hover preview
  const [hoverPos, setHoverPos] = useState<{ gridX: number; gridY: number } | null>(null);

  // Convert screen coordinates to grid coordinates
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

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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

    // Draw placed tiles
    for (const placement of scene.placements) {
      const tile = tileMap.get(placement.tileId);
      if (!tile) continue;

      const x = placement.gridX * tileSize;
      const y = placement.gridY * tileSize;

      // Draw tile image if available
      if (tile.imageData) {
        ctx.putImageData(tile.imageData, x, y);
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
      const tile = tileMap.get(selectedTileId);
      if (tile?.imageData) {
        const x = hoverPos.gridX * tileSize;
        const y = hoverPos.gridY * tileSize;

        // Draw semi-transparent preview
        ctx.globalAlpha = 0.5;
        ctx.putImageData(tile.imageData, x, y);
        ctx.globalAlpha = 1;

        // Draw outline
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2 / viewport.zoom;
        ctx.strokeRect(x, y, tileSize, tileSize);
      }
    }

    ctx.restore();
  }, [scene, project, viewport, selection, width, height, toolMode, selectedTileId, hoverPos]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const gridPos = screenToGrid(e.clientX, e.clientY);
      if (!gridPos) return;

      const { placeTile, selectTile, clearSelection } = useProjectStore.getState();

      if (toolMode === 'place' && selectedTileId) {
        // Place the selected tile
        placeTile(selectedTileId, gridPos.gridX, gridPos.gridY);
      } else if (toolMode === 'select') {
        // Find placement at this position
        const placement = scene?.placements.find(
          p => p.gridX === gridPos.gridX && p.gridY === gridPos.gridY
        );

        if (placement) {
          const additive = e.shiftKey || e.ctrlKey;
          selectTile(placement.id, additive);
        } else if (!e.shiftKey && !e.ctrlKey) {
          clearSelection();
        }
      }
    },
    [toolMode, selectedTileId, scene, screenToGrid]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const gridPos = screenToGrid(e.clientX, e.clientY);
      setHoverPos(gridPos);
    },
    [screenToGrid]
  );

  const handleMouseUp = useCallback((_e: React.MouseEvent<HTMLCanvasElement>) => {
    // TODO: Implement drag selection end
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoverPos(null);
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const { setViewport } = useProjectStore.getState();

      if (e.ctrlKey) {
        // Zoom
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setViewport({ zoom: Math.max(0.25, Math.min(4, viewport.zoom * delta)) });
      } else {
        // Pan
        setViewport({
          offsetX: viewport.offsetX - e.deltaX,
          offsetY: viewport.offsetY - e.deltaY,
        });
      }
    },
    [viewport]
  );

  // Determine cursor based on tool mode
  const getCursor = () => {
    if (toolMode === 'pan') return 'grab';
    if (toolMode === 'place' && selectedTileId) return 'copy';
    if (toolMode === 'select') return 'default';
    return 'crosshair';
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
      style={{
        border: '1px solid #333',
        cursor: getCursor(),
      }}
    />
  );
}
