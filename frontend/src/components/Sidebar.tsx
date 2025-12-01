import { useState } from 'react';
import { useProjectStore } from '../stores/projectStore';
import {
  openFile,
  readFileAsText,
  readFileAsImage,
  sliceImageIntoTiles,
  suggestTileSizes,
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

export function Sidebar() {
  const {
    project,
    createScene,
    setActiveScene,
    addTiles,
    importScenes,
    loadProject: setProject,
    selectedTileId,
    setSelectedTileId,
    setToolMode,
  } = useProjectStore();
  const scene = useProjectStore(state => state.getActiveScene());

  const [showNewScene, setShowNewScene] = useState(false);
  const [sceneName, setSceneName] = useState('');
  const [gridWidth, setGridWidth] = useState(16);
  const [gridHeight, setGridHeight] = useState(16);

  // Import dialog state
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importImage, setImportImage] = useState<HTMLImageElement | null>(null);
  const [importTileSize, setImportTileSize] = useState(16);
  const [suggestedSizes, setSuggestedSizes] = useState<number[]>([16]);

  const handleCreateScene = () => {
    if (sceneName.trim()) {
      createScene(sceneName.trim(), gridWidth, gridHeight);
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

    const result = sliceImageIntoTiles(importImage, {
      tileWidth: importTileSize,
      tileHeight: importTileSize,
    });

    addTiles(result.tiles);
    setShowImportDialog(false);
    setImportImage(null);
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
        addTiles(result.tiles);
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
        addTiles(result.tiles);
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

  // Export tileset PNG
  const handleExportTilesetPNG = async () => {
    if (!project || project.tiles.length === 0) return;
    await downloadTilesetPNG(project.tiles);
  };

  // Export scene PNG
  const handleExportScenePNG = async () => {
    if (!project || !scene) return;
    await downloadScenePNG(scene, project.tiles, `${scene.name}.png`);
  };

  // Export Tiled JSON
  const handleExportTiled = () => {
    if (!project || !scene) return;
    downloadTiledJSON(project, scene, `${scene.name}.json`);
  };

  // Export LDtk
  const handleExportLDtk = () => {
    if (!project || !scene) return;
    downloadLDtk(project, scene, `${project.name}.ldtk`);
  };

  // Handle tile click in library
  const handleTileClick = (tileId: string) => {
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
              Will create ~{Math.floor(importImage.width / importTileSize) * Math.floor(importImage.height / importTileSize)} tiles
            </p>
            <div className="modal-buttons">
              <button onClick={() => setShowImportDialog(false)}>Cancel</button>
              <button onClick={handleConfirmImport} className="primary">
                Import
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="sidebar-section">
        <h3>Project</h3>
        {project ? (
          <div className="project-info">
            <span className="project-name">{project.name}</span>
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

      <div className="sidebar-section">
        <h3>Import</h3>
        <div className="button-column">
          <button onClick={handleImportPNG}>PNG Tileset</button>
          <button onClick={handleImportTiled}>Tiled JSON</button>
          <button onClick={handleImportLDtk}>LDtk</button>
        </div>
      </div>

      <div className="sidebar-section">
        <h3>Export</h3>
        <div className="button-column">
          <button onClick={handleExportTilesetPNG} disabled={!project || project.tiles.length === 0}>
            Tileset PNG
          </button>
          <button onClick={handleExportScenePNG} disabled={!scene}>
            Scene PNG
          </button>
          <button onClick={handleExportTiled} disabled={!scene}>
            Tiled JSON
          </button>
          <button onClick={handleExportLDtk} disabled={!scene}>
            LDtk
          </button>
        </div>
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
                Width:
                <input
                  type="number"
                  value={gridWidth}
                  onChange={e => setGridWidth(parseInt(e.target.value) || 16)}
                  min={1}
                  max={256}
                />
              </label>
              <label>
                Height:
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
          {project?.scenes.map(scene => (
            <div
              key={scene.id}
              className={`scene-item ${scene.id === project.activeSceneId ? 'active' : ''}`}
              onClick={() => setActiveScene(scene.id)}
            >
              <span className="scene-name">{scene.name}</span>
              <span className="scene-size">
                {scene.gridWidth}x{scene.gridHeight}
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
                  title={tile.labels.length > 0 ? tile.labels.join(', ') : 'Click to select for placement'}
                  onClick={() => handleTileClick(tile.id)}
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
