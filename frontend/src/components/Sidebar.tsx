import { useState, useRef, useEffect } from 'react';
import { useProjectStore } from '../stores/projectStore';
import {
  openFile,
  readFileAsText,
  readFileAsImage,
  sliceImageIntoTiles,
  suggestTileSizes,
  deduplicateTiles,
  saveProject,
  loadProject,
  downloadTilesetPNG,
  downloadScenePNG,
  downloadTiledJSON,
  downloadLDtk,
  importTiledJSON,
  importLDtk,
  type TiledMap,
  type LDtkProject,
} from '../utils';

type ExportType = 'tileset' | 'scene' | 'tiled' | 'ldtk';

export function Sidebar() {
  const {
    project,
    viewport,
    createProject,
    createScene,
    createSceneWithPlacements,
    setActiveScene,
    addTiles,
    importScenes,
    loadProject: setProject,
    renameProject,
    renameScene,
    deleteScene,
    selectedTileId,
    setSelectedTileId,
    setToolMode,
    clearSelection,
  } = useProjectStore();
  const scene = useProjectStore(state => state.getActiveScene());

  const [showNewScene, setShowNewScene] = useState(false);
  const [sceneName, setSceneName] = useState('');
  const [gridWidth, setGridWidth] = useState(16);
  const [gridHeight, setGridHeight] = useState(16);
  const [sceneTileSize, setSceneTileSize] = useState(16);

  // Collapsible sections
  const [importExpanded, setImportExpanded] = useState(false);
  const [exportExpanded, setExportExpanded] = useState(false);

  // Import dialog state
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importImage, setImportImage] = useState<HTMLImageElement | null>(null);
  const [importTileSize, setImportTileSize] = useState(16);
  const [suggestedSizes, setSuggestedSizes] = useState<number[]>([16]);
  const [createSceneOnImport, setCreateSceneOnImport] = useState(false);
  const [importSceneName, setImportSceneName] = useState('');

  // Export dialog state
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportType, setExportType] = useState<ExportType>('tileset');
  const [exportFilename, setExportFilename] = useState('');

  // Scene context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; sceneId: string } | null>(null);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameSceneId, setRenameSceneId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Project rename dialog
  const [showProjectRenameDialog, setShowProjectRenameDialog] = useState(false);
  const [projectRenameValue, setProjectRenameValue] = useState('');

  // New project dialog
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectTileSize, setNewProjectTileSize] = useState(16);

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
      createScene(sceneName.trim(), gridWidth, gridHeight, sceneTileSize);
      setSceneName('');
      setShowNewScene(false);
    }
  };

  // Import PNG tileset
  const handleImportPNG = async () => {
    const file = await openFile('.png,.jpg,.jpeg,.gif');
    if (!file) return;

    try {
      const image = await readFileAsImage(file);
      const sizes = suggestTileSizes(image.width, image.height);
      setImportImage(image);
      setSuggestedSizes(sizes);
      setImportTileSize(sizes[0] ?? 16);
      setShowImportDialog(true);
    } catch (e) {
      console.error('Failed to load image:', e);
      alert('Failed to load image');
    }
  };

  const handleConfirmImport = () => {
    if (!importImage) return;

    const cols = Math.floor(importImage.width / importTileSize);
    const rows = Math.floor(importImage.height / importTileSize);

    const result = sliceImageIntoTiles(importImage, {
      tileWidth: importTileSize,
      tileHeight: importTileSize,
    });

    // Deduplicate tiles before adding
    const existingTiles = project?.tiles ?? [];
    const { uniqueTiles, duplicateCount, duplicateMap } = deduplicateTiles(result.tiles, existingTiles);

    addTiles(uniqueTiles);

    // Optionally create a scene with the imported tiles placed in grid positions
    if (createSceneOnImport && importSceneName.trim()) {
      // Create placements for each grid position
      // Map original tile IDs to their deduplicated equivalents
      const placements = result.tiles.map((tile, index) => {
        const gridX = index % cols;
        const gridY = Math.floor(index / cols);
        // Use the deduplicated tile ID if this tile was a duplicate
        const tileId = duplicateMap.get(tile.id) ?? tile.id;
        return {
          id: crypto.randomUUID(),
          tileId,
          gridX,
          gridY,
          locked: true,
        };
      });

      createSceneWithPlacements(importSceneName.trim(), cols, rows, importTileSize, placements);
    }

    setShowImportDialog(false);
    setImportImage(null);
    setCreateSceneOnImport(false);
    setImportSceneName('');

    if (duplicateCount > 0) {
      console.log(`Skipped ${duplicateCount} duplicate tiles`);
    }
  };

  // Import Tiled JSON
  const handleImportTiled = async () => {
    const file = await openFile('.json,.tmj');
    if (!file) return;

    try {
      const text = await readFileAsText(file);
      const json = JSON.parse(text) as TiledMap;

      // For now, skip loading external images - tiles would need to be in the JSON
      const result = await importTiledJSON(json, async (path) => {
        // In a real implementation, we'd need to handle relative paths
        // For now, just throw to skip
        throw new Error(`External image loading not implemented: ${path}`);
      });

      if (result.tiles.length > 0) {
        const existingTiles = project?.tiles ?? [];
        const { uniqueTiles } = deduplicateTiles(result.tiles, existingTiles);
        addTiles(uniqueTiles);
      }
      if (result.scenes.length > 0) {
        importScenes(result.scenes);
      }
    } catch (e) {
      console.error('Failed to import Tiled file:', e);
      alert('Failed to import Tiled file. Make sure the tileset image is embedded or load it separately.');
    }
  };

  // Import LDtk
  const handleImportLDtk = async () => {
    const file = await openFile('.ldtk');
    if (!file) return;

    try {
      const text = await readFileAsText(file);
      const json = JSON.parse(text) as LDtkProject;

      const result = await importLDtk(json, async (path) => {
        throw new Error(`External image loading not implemented: ${path}`);
      });

      if (result.tiles.length > 0) {
        const existingTiles = project?.tiles ?? [];
        const { uniqueTiles } = deduplicateTiles(result.tiles, existingTiles);
        addTiles(uniqueTiles);
      }
      if (result.scenes.length > 0) {
        importScenes(result.scenes);
      }
    } catch (e) {
      console.error('Failed to import LDtk file:', e);
      alert('Failed to import LDtk file. Make sure the tileset image is loaded separately.');
    }
  };

  // Load project
  const handleLoadProject = async () => {
    const file = await openFile('.tilestudio,.json');
    if (!file) return;

    try {
      const text = await readFileAsText(file);
      const loadedProject = await loadProject(text);
      setProject(loadedProject);
    } catch (e) {
      console.error('Failed to load project:', e);
      alert('Failed to load project');
    }
  };

  // Save project
  const handleSaveProject = () => {
    if (!project) return;
    saveProject(project);
  };

  // Show export dialog for each type
  const showExportDialogFor = (type: ExportType) => {
    let defaultName = '';
    switch (type) {
      case 'tileset':
        defaultName = 'tileset.png';
        break;
      case 'scene':
        defaultName = scene ? `${scene.name}.png` : 'scene.png';
        break;
      case 'tiled':
        defaultName = scene ? `${scene.name}.json` : 'scene.json';
        break;
      case 'ldtk':
        defaultName = project ? `${project.name}.ldtk` : 'project.ldtk';
        break;
    }
    setExportType(type);
    setExportFilename(defaultName);
    setShowExportDialog(true);
  };

  // Perform actual export
  const handleConfirmExport = async () => {
    if (!exportFilename.trim()) return;

    switch (exportType) {
      case 'tileset':
        if (project && project.tiles.length > 0) {
          await downloadTilesetPNG(project.tiles, exportFilename);
        }
        break;
      case 'scene':
        if (project && scene) {
          await downloadScenePNG(scene, project.tiles, exportFilename);
        }
        break;
      case 'tiled':
        if (project && scene) {
          downloadTiledJSON(project, scene, exportFilename);
        }
        break;
      case 'ldtk':
        if (project && scene) {
          downloadLDtk(project, scene, exportFilename);
        }
        break;
    }

    setShowExportDialog(false);
    setExportFilename('');
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

  const handleNewProject = () => {
    setNewProjectName('New Project');
    setNewProjectTileSize(16);
    setShowNewProjectDialog(true);
  };

  const handleConfirmNewProject = () => {
    if (newProjectName.trim()) {
      createProject(newProjectName.trim(), newProjectTileSize);
    }
    setShowNewProjectDialog(false);
    setNewProjectName('');
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
      {/* Import Dialog Modal */}
      {showImportDialog && importImage && (
        <div className="modal-overlay" onClick={() => setShowImportDialog(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Import Tileset</h3>
            <div className="import-preview">
              <img
                src={importImage.src}
                alt="Preview"
                style={{ maxWidth: '200px', maxHeight: '200px', imageRendering: 'pixelated' }}
              />
            </div>
            <p>
              Image size: {importImage.width} x {importImage.height}
            </p>
            <div className="form-row">
              <label>
                Tile size:
                <select
                  value={importTileSize}
                  onChange={e => setImportTileSize(parseInt(e.target.value))}
                >
                  {suggestedSizes.map(size => (
                    <option key={size} value={size}>
                      {size}x{size}
                    </option>
                  ))}
                  <option value={8}>8x8</option>
                  <option value={16}>16x16</option>
                  <option value={24}>24x24</option>
                  <option value={32}>32x32</option>
                  <option value={48}>48x48</option>
                  <option value={64}>64x64</option>
                </select>
              </label>
            </div>
            <p className="import-info">
              Will create ~{Math.floor(importImage.width / importTileSize) * Math.floor(importImage.height / importTileSize)} tiles (duplicates auto-removed)
            </p>
            <div className="form-row" style={{ marginTop: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={createSceneOnImport}
                  onChange={e => setCreateSceneOnImport(e.target.checked)}
                />
                Create scene from tiles
              </label>
            </div>
            {createSceneOnImport && (
              <input
                type="text"
                placeholder="Scene name"
                value={importSceneName}
                onChange={e => setImportSceneName(e.target.value)}
                style={{ marginTop: '0.5rem', width: '100%', padding: '0.4rem', background: '#1a1a2e', border: '1px solid #3a3a5e', borderRadius: '4px', color: '#fff', fontSize: '0.85rem' }}
              />
            )}
            <div className="modal-buttons">
              <button onClick={() => setShowImportDialog(false)}>Cancel</button>
              <button onClick={handleConfirmImport} className="primary">
                Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Dialog Modal */}
      {showExportDialog && (
        <div className="modal-overlay" onClick={() => setShowExportDialog(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Export {exportType === 'tileset' ? 'Tileset PNG' : exportType === 'scene' ? 'Scene PNG' : exportType === 'tiled' ? 'Tiled JSON' : 'LDtk'}</h3>
            <div className="form-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                Filename:
                <input
                  type="text"
                  value={exportFilename}
                  onChange={e => setExportFilename(e.target.value)}
                  style={{ padding: '0.4rem', background: '#1a1a2e', border: '1px solid #3a3a5e', borderRadius: '4px', color: '#fff', fontSize: '0.85rem' }}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleConfirmExport()}
                />
              </label>
            </div>
            <div className="modal-buttons">
              <button onClick={() => setShowExportDialog(false)}>Cancel</button>
              <button onClick={handleConfirmExport} className="primary">
                Export
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* New Project Dialog */}
      {showNewProjectDialog && (
        <div className="modal-overlay" onClick={() => setShowNewProjectDialog(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>New Project</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem', color: '#aaa' }}>
                Project Name:
                <input
                  type="text"
                  value={newProjectName}
                  onChange={e => setNewProjectName(e.target.value)}
                  style={{ padding: '0.4rem', background: '#1a1a2e', border: '1px solid #3a3a5e', borderRadius: '4px', color: '#fff', fontSize: '0.85rem' }}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleConfirmNewProject()}
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#aaa' }}>
                Default Tile Size:
                <select
                  value={newProjectTileSize}
                  onChange={e => setNewProjectTileSize(parseInt(e.target.value))}
                  style={{ padding: '0.4rem', background: '#2a2a4e', border: '1px solid #3a3a5e', borderRadius: '4px', color: '#fff', fontSize: '0.85rem' }}
                >
                  <option value={8}>8x8</option>
                  <option value={16}>16x16</option>
                  <option value={24}>24x24</option>
                  <option value={32}>32x32</option>
                  <option value={48}>48x48</option>
                  <option value={64}>64x64</option>
                </select>
              </label>
            </div>
            <div className="modal-buttons">
              <button onClick={() => setShowNewProjectDialog(false)}>Cancel</button>
              <button onClick={handleConfirmNewProject} className="primary">
                Create
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
        <div className="section-header">
          <h3>Project</h3>
          <button
            className="icon-button"
            onClick={handleNewProject}
            title="New project"
          >
            +
          </button>
        </div>
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
        <div className="button-row">
          <button onClick={handleSaveProject} disabled={!project} title="Save project">
            Save
          </button>
          <button onClick={handleLoadProject} title="Load project">
            Load
          </button>
        </div>
      </div>

      <div className="sidebar-section collapsible">
        <div className="section-header clickable" onClick={() => setImportExpanded(!importExpanded)}>
          <h3>Import</h3>
          <span className="collapse-icon">{importExpanded ? '−' : '+'}</span>
        </div>
        {importExpanded && (
          <div className="button-column">
            <button onClick={handleImportPNG}>PNG Tileset</button>
            <button onClick={handleImportTiled}>Tiled JSON</button>
            <button onClick={handleImportLDtk}>LDtk</button>
          </div>
        )}
      </div>

      <div className="sidebar-section collapsible">
        <div className="section-header clickable" onClick={() => setExportExpanded(!exportExpanded)}>
          <h3>Export</h3>
          <span className="collapse-icon">{exportExpanded ? '−' : '+'}</span>
        </div>
        {exportExpanded && (
          <div className="button-column">
            <button onClick={() => showExportDialogFor('tileset')} disabled={!project || project.tiles.length === 0}>
              Tileset PNG
            </button>
            <button onClick={() => showExportDialogFor('scene')} disabled={!scene}>
              Scene PNG
            </button>
            <button onClick={() => showExportDialogFor('tiled')} disabled={!scene}>
              Tiled JSON
            </button>
            <button onClick={() => showExportDialogFor('ldtk')} disabled={!scene}>
              LDtk
            </button>
          </div>
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
              <label>
                Tile:
                <select
                  value={sceneTileSize}
                  onChange={e => setSceneTileSize(parseInt(e.target.value))}
                >
                  <option value={8}>8</option>
                  <option value={16}>16</option>
                  <option value={24}>24</option>
                  <option value={32}>32</option>
                  <option value={48}>48</option>
                  <option value={64}>64</option>
                </select>
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
                {s.gridWidth}x{s.gridHeight} @{s.tileSize}px
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
              No tiles yet. Import a tileset or generate some!
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
                    if (imgElement && scene) {
                      const scaledSize = Math.round(scene.tileSize * viewport.zoom);

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
