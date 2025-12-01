import { useRef, useEffect, useCallback } from 'react';
import { useProjectStore } from '../stores/projectStore';

interface CanvasProps {
  width?: number;
  height?: number;
}

export function Canvas({ width = 800, height = 600 }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { project, viewport, selection, toolMode } = useProjectStore();
  const scene = useProjectStore(state => state.getActiveScene());

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
    ctx.lineWidth = 1;
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

    // Draw placed tiles
    for (const placement of scene.placements) {
      const tile = project?.tiles.find(t => t.id === placement.tileId);
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

      // Draw lock indicator
      if (placement.locked) {
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#666';
        ctx.fillRect(x, y, tileSize, tileSize);
        ctx.globalAlpha = 1;
      }

      // Draw selection highlight
      if (selection.tileIds.has(placement.id)) {
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2;
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
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + tileSize, y);
        ctx.stroke();
      } else {
        const x = edge.x * tileSize;
        const y = edge.y * tileSize;

        ctx.strokeStyle = edge.locked ? '#ff8800' : '#666';
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + tileSize);
        ctx.stroke();
      }
    }

    ctx.restore();
  }, [scene, project, viewport, selection, width, height]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // TODO: Implement mouse interaction based on toolMode
  }, [toolMode]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // TODO: Implement mouse move handling
  }, []);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // TODO: Implement mouse up handling
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
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
  }, [viewport]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      style={{
        border: '1px solid #333',
        cursor: toolMode === 'pan' ? 'grab' : 'crosshair',
      }}
    />
  );
}
