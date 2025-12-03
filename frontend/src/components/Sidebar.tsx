import { useState, useRef, useEffect } from 'react';
import { useProjectStore } from '../stores/projectStore';

export function Sidebar() {
  const {
    project,
    viewport,
    createScene,
    setActiveScene,
    renameProject,
    renameScene,
    deleteScene,
    selectedTileId,
    setSelectedTileId,
    setToolMode,
    clearSelection,
  } = useProjectStore();

  const [showNewScene, setShowNewScene] = useState(false);
  const [sceneName, setSceneName] = useState('');
  const [gridWidth, setGridWidth] = useState(16);
  const [gridHeight, setGridHeight] = useState(16);

  // Scene context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; sceneId: string } | null>(null);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameSceneId, setRenameSceneId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Project rename dialog
  const [showProjectRenameDialog, setShowProjectRenameDialog] = useState(false);
  const [projectRenameValue, setProjectRenameValue] = useState('');

  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreateScene = () => {
    if (sceneName.trim()) {
      createScene(sceneName.trim(), gridWidth, gridHeight);
      setSceneName('');
      setShowNewScene(false);
    }
  };

  // Scene context menu handlers
  const handleSceneContextMenu = (e: React.MouseEvent, sceneId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, sceneId });
  };

  const handleRenameScene = () => {
    if (!contextMenu) return;
    const sceneToRename = project?.scenes.find(s => s.id === contextMenu.sceneId);
    if (sceneToRename) {
      setRenameSceneId(contextMenu.sceneId);
      setRenameValue(sceneToRename.name);
      setShowRenameDialog(true);
    }
    setContextMenu(null);
  };

  const handleConfirmRename = () => {
    if (renameSceneId && renameValue.trim()) {
      renameScene(renameSceneId, renameValue.trim());
    }
    setShowRenameDialog(false);
    setRenameSceneId(null);
    setRenameValue('');
  };

  const handleDeleteScene = () => {
    if (!contextMenu) return;
    const sceneToDelete = project?.scenes.find(s => s.id === contextMenu.sceneId);
    if (sceneToDelete && confirm(`Delete scene "${sceneToDelete.name}"?`)) {
      deleteScene(contextMenu.sceneId);
    }
    setContextMenu(null);
  };

  // Project handlers
  const handleShowProjectRename = () => {
    if (project) {
      setProjectRenameValue(project.name);
      setShowProjectRenameDialog(true);
    }
  };

  const handleConfirmProjectRename = () => {
    if (projectRenameValue.trim()) {
      renameProject(projectRenameValue.trim());
    }
    setShowProjectRenameDialog(false);
    setProjectRenameValue('');
  };

  // Handle tile click in library
  const handleTileClick = (tileId: string) => {
    // Clear scene selection when clicking a library tile (commits any uncommitted move)
    clearSelection();

    if (selectedTileId === tileId) {
      setSelectedTileId(null);
      setToolMode('select');
    } else {
      setSelectedTileId(tileId);
      setToolMode('place');
    }
  };

  return (
    <div className="sidebar">
      {/* Scene Rename Dialog */}
      {showRenameDialog && (
        <div className="modal-overlay" onClick={() => setShowRenameDialog(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Rename Scene</h3>
            <input
              type="text"
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              style={{ width: '100%', padding: '0.4rem', background: '#1a1a2e', border: '1px solid #3a3a5e', borderRadius: '4px', color: '#fff', fontSize: '0.85rem' }}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleConfirmRename()}
            />
            <div className="modal-buttons">
              <button onClick={() => setShowRenameDialog(false)}>Cancel</button>
              <button onClick={handleConfirmRename} className="primary">
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Project Rename Dialog */}
      {showProjectRenameDialog && (
        <div className="modal-overlay" onClick={() => setShowProjectRenameDialog(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Rename Project</h3>
            <input
              type="text"
              value={projectRenameValue}
              onChange={e => setProjectRenameValue(e.target.value)}
              style={{ width: '100%', padding: '0.4rem', background: '#1a1a2e', border: '1px solid #3a3a5e', borderRadius: '4px', color: '#fff', fontSize: '0.85rem' }}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleConfirmProjectRename()}
            />
            <div className="modal-buttons">
              <button onClick={() => setShowProjectRenameDialog(false)}>Cancel</button>
              <button onClick={handleConfirmProjectRename} className="primary">
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scene Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="context-menu"
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
          }}
        >
          <button onClick={handleRenameScene}>Rename</button>
          <button onClick={handleDeleteScene} className="danger">Delete</button>
        </div>
      )}

      <div className="sidebar-section">
        <h3>Project</h3>
        {project ? (
          <div className="project-info">
            <span
              className="project-name clickable"
              onClick={handleShowProjectRename}
              title="Click to rename"
            >
              {project.name}
            </span>
            <span className="project-stats">
              {project.tiles.length} tiles, {project.scenes.length} scenes
            </span>
          </div>
        ) : (
          <div className="no-project">No project loaded</div>
        )}
      </div>

      <div className="sidebar-section">
        <div className="section-header">
          <h3>Scenes</h3>
          <button
            className="icon-button"
            onClick={() => setShowNewScene(!showNewScene)}
            title="New scene"
          >
            +
          </button>
        </div>

        {showNewScene && (
          <div className="new-scene-form">
            <input
              type="text"
              placeholder="Scene name"
              value={sceneName}
              onChange={e => setSceneName(e.target.value)}
            />
            <div className="form-row">
              <label>
                W:
                <input
                  type="number"
                  value={gridWidth}
                  onChange={e => setGridWidth(parseInt(e.target.value) || 16)}
                  min={1}
                  max={256}
                />
              </label>
              <label>
                H:
                <input
                  type="number"
                  value={gridHeight}
                  onChange={e => setGridHeight(parseInt(e.target.value) || 16)}
                  min={1}
                  max={256}
                />
              </label>
            </div>
            <button onClick={handleCreateScene}>Create</button>
          </div>
        )}

        <div className="scene-list">
          {project?.scenes.map(s => (
            <div
              key={s.id}
              className={`scene-item ${s.id === project.activeSceneId ? 'active' : ''}`}
              onClick={() => setActiveScene(s.id)}
              onContextMenu={e => handleSceneContextMenu(e, s.id)}
            >
              <span className="scene-name">{s.name}</span>
              <span className="scene-size">
                {s.gridWidth}x{s.gridHeight}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="sidebar-section">
        <h3>Tile Library</h3>
        <div className="tile-library">
          {project?.tiles.length === 0 ? (
            <div className="empty-library">
              No tiles yet. Use File → Import to add tiles.
            </div>
          ) : (
            <div className="tile-grid">
              {project?.tiles.map(tile => (
                <div
                  key={tile.id}
                  className={`tile-item ${selectedTileId === tile.id ? 'selected' : ''}`}
                  title={tile.labels.length > 0 ? tile.labels.join(', ') : 'Click to select, drag to canvas'}
                  onClick={() => handleTileClick(tile.id)}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/tile-id', tile.id);
                    e.dataTransfer.effectAllowed = 'copy';

                    // Create a scaled drag image matching the scene's zoom level
                    const target = e.currentTarget as HTMLElement;
                    const imgElement = target.querySelector('img');
                    if (imgElement && project) {
                      const tileSize = project.tileSize;
                      const scaledSize = Math.round(tileSize * viewport.zoom);

                      // Create an offscreen canvas, draw scaled image, convert to img
                      const canvas = document.createElement('canvas');
                      canvas.width = scaledSize;
                      canvas.height = scaledSize;
                      const ctx = canvas.getContext('2d');
                      if (ctx) {
                        ctx.imageSmoothingEnabled = false;
                        ctx.drawImage(imgElement, 0, 0, scaledSize, scaledSize);

                        // Create a temporary img element from the canvas and add to DOM
                        // (setDragImage requires the element to be in DOM in some browsers)
                        const dragImg = new Image();
                        dragImg.src = canvas.toDataURL();
                        dragImg.style.position = 'absolute';
                        dragImg.style.top = '-9999px';
                        dragImg.style.left = '-9999px';
                        document.body.appendChild(dragImg);

                        e.dataTransfer.setDragImage(dragImg, scaledSize / 2, scaledSize / 2);

                        // Clean up after drag starts
                        setTimeout(() => document.body.removeChild(dragImg), 0);
                      }
                    }
                  }}
                >
                  {tile.imageBase64 ? (
                    <img src={tile.imageBase64} alt="" draggable={false} />
                  ) : (
                    <div className="tile-placeholder" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="sidebar-section">
        <h3>Keywords</h3>
        <div className="keyword-list">
          {project?.keywords.map(keyword => (
            <span key={keyword} className="keyword-tag">
              {keyword}
            </span>
          ))}
          {project?.keywords.length === 0 && (
            <div className="empty-keywords">No keywords yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
