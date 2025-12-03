import { useEffect, useState, useCallback, useRef } from 'react';
import { Canvas, Sidebar, MenuBar, IconToolbar } from './components';
import { useProjectStore } from './stores/projectStore';
import type { Project, Tile, Scene, TilePlacement } from './types';
import './App.css';

function App() {
  const { project, createProject, loadProject, renameProject, addTiles, createSceneWithPlacements } = useProjectStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tilesetInputRef = useRef<HTMLInputElement>(null);
  const sceneInputRef = useRef<HTMLInputElement>(null);

  // Modal states
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showNewSceneModal, setShowNewSceneModal] = useState(false);
  const [showRenameSceneModal, setShowRenameSceneModal] = useState(false);
  const [showProjectSettingsModal, setShowProjectSettingsModal] = useState(false);
  const [showExportSceneModal, setShowExportSceneModal] = useState(false);
  const [showExportTilesetModal, setShowExportTilesetModal] = useState(false);
  const [showImportSceneModal, setShowImportSceneModal] = useState(false);
  const [showImportTilesetModal, setShowImportTilesetModal] = useState(false);

  // Form states
  const [newProjectName, setNewProjectName] = useState('Untitled Project');
  const [newProjectTileSize, setNewProjectTileSize] = useState(16);
  const [newSceneName, setNewSceneName] = useState('New Scene');
  const [newSceneWidth, setNewSceneWidth] = useState(10);
  const [newSceneHeight, setNewSceneHeight] = useState(10);
  const [renameSceneValue, setRenameSceneValue] = useState('');
  const [projectSettingsName, setProjectSettingsName] = useState('');
  const [exportSceneFormat, setExportSceneFormat] = useState<'png' | 'json'>('png');
  const [exportTilesetFormat, setExportTilesetFormat] = useState<'png' | 'json'>('png');

  // Import tileset modal state
  const [importTilesetFile, setImportTilesetFile] = useState<File | null>(null);
  const [importTilesetPreview, setImportTilesetPreview] = useState<string | null>(null);
  const [importTilesetCreateScene, setImportTilesetCreateScene] = useState(false);
  const [importTilesetDimensions, setImportTilesetDimensions] = useState<{ width: number; height: number } | null>(null);

  // Import scene modal state
  const [importSceneFile, setImportSceneFile] = useState<File | null>(null);
  const [importScenePreview, setImportScenePreview] = useState<string | null>(null);
  const [importSceneDimensions, setImportSceneDimensions] = useState<{ width: number; height: number } | null>(null);

  // Export filename states
  const [exportSceneFilename, setExportSceneFilename] = useState('');
  const [exportTilesetFilename, setExportTilesetFilename] = useState('');

  useEffect(() => {
    // Create a default project on first load
    if (!project) {
      createProject('Untitled Project', 16);
    }
  }, [project, createProject]);

  // Viewport controls - will be connected to Canvas
  const [viewportActions, setViewportActions] = useState<{
    zoomIn: () => void;
    zoomOut: () => void;
    resetView: () => void;
  } | null>(null);

  // Get active scene
  const activeScene = project?.scenes.find(s => s.id === project.activeSceneId);

  // File handlers
  const handleNewProject = useCallback(() => {
    setNewProjectName('Untitled Project');
    setNewProjectTileSize(16);
    setShowNewProjectModal(true);
  }, []);

  const handleCreateProject = useCallback(() => {
    createProject(newProjectName, newProjectTileSize);
    setShowNewProjectModal(false);
  }, [createProject, newProjectName, newProjectTileSize]);

  const handleOpenProject = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const projectData = JSON.parse(event.target?.result as string) as Project;
        loadProject(projectData);
      } catch (error) {
        console.error('Failed to load project:', error);
        alert('Failed to load project file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [loadProject]);

  const handleSaveProject = useCallback(() => {
    if (!project) return;
    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/[^a-z0-9]/gi, '_')}.tilestudio.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [project]);

  // Global keyboard shortcuts for file operations
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if focus is in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Ctrl+Shift+N: New Project
      if (e.key === 'N' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
        e.preventDefault();
        handleNewProject();
      }

      // Ctrl+Shift+O: Open Project
      if (e.key === 'O' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
        e.preventDefault();
        handleOpenProject();
      }

      // Ctrl+Shift+S: Save Project
      if (e.key === 'S' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
        e.preventDefault();
        handleSaveProject();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNewProject, handleOpenProject, handleSaveProject]);

  // Scene handlers
  const { createScene, renameScene, deleteScene } = useProjectStore.getState();

  const handleNewScene = useCallback(() => {
    setNewSceneName('New Scene');
    setNewSceneWidth(10);
    setNewSceneHeight(10);
    setShowNewSceneModal(true);
  }, []);

  const handleCreateScene = useCallback(() => {
    createScene(newSceneName, newSceneWidth, newSceneHeight);
    setShowNewSceneModal(false);
  }, [createScene, newSceneName, newSceneWidth, newSceneHeight]);

  const handleRenameScene = useCallback(() => {
    if (!activeScene) return;
    setRenameSceneValue(activeScene.name);
    setShowRenameSceneModal(true);
  }, [activeScene]);

  const handleConfirmRenameScene = useCallback(() => {
    if (!activeScene) return;
    renameScene(activeScene.id, renameSceneValue);
    setShowRenameSceneModal(false);
  }, [activeScene, renameScene, renameSceneValue]);

  const handleDeleteScene = useCallback(() => {
    if (!activeScene) return;
    if (confirm(`Delete scene "${activeScene.name}"?`)) {
      deleteScene(activeScene.id);
    }
  }, [activeScene, deleteScene]);

  // Project settings
  const handleProjectSettings = useCallback(() => {
    if (!project) return;
    setProjectSettingsName(project.name);
    setShowProjectSettingsModal(true);
  }, [project]);

  const handleSaveProjectSettings = useCallback(() => {
    renameProject(projectSettingsName);
    setShowProjectSettingsModal(false);
  }, [renameProject, projectSettingsName]);

  // Import/Export handlers
  const handleImportScene = useCallback(() => {
    // Reset import scene state
    setImportSceneFile(null);
    setImportScenePreview(null);
    setImportSceneDimensions(null);
    setShowImportSceneModal(true);
  }, []);

  // Handle file selection for import scene (from drag-drop or file picker)
  const handleImportSceneFileSelect = useCallback((file: File) => {
    setImportSceneFile(file);

    if (file.type === 'application/json' || file.name.endsWith('.json')) {
      // JSON file - no preview
      setImportScenePreview(null);
      setImportSceneDimensions(null);
    } else if (file.type.startsWith('image/')) {
      // Image file - create preview
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setImportScenePreview(dataUrl);

        // Get image dimensions
        const img = new Image();
        img.onload = () => {
          setImportSceneDimensions({ width: img.width, height: img.height });
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    }
  }, []);

  // Process import scene
  const handleProcessImportScene = useCallback(() => {
    if (!importSceneFile || !project) return;

    const tileSize = project.tileSize;

    if (importSceneFile.type === 'application/json' || importSceneFile.name.endsWith('.json')) {
      // Import JSON scene
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const sceneData = JSON.parse(event.target?.result as string) as Scene;
          // Create scene with placements
          createSceneWithPlacements(
            sceneData.name || 'Imported Scene',
            sceneData.gridWidth,
            sceneData.gridHeight,
            sceneData.placements
          );
          setShowImportSceneModal(false);
        } catch (error) {
          console.error('Failed to parse scene JSON:', error);
          alert('Failed to import scene: Invalid JSON format');
        }
      };
      reader.readAsText(importSceneFile);
    } else if (importSceneFile.type.startsWith('image/') && importScenePreview) {
      // Import PNG scene - detect and extract tiles, create scene
      const img = new Image();
      img.onload = () => {
        const cols = Math.floor(img.width / tileSize);
        const rows = Math.floor(img.height / tileSize);

        // Create a canvas to extract each tile
        const canvas = document.createElement('canvas');
        canvas.width = tileSize;
        canvas.height = tileSize;
        const ctx = canvas.getContext('2d')!;

        // Map to deduplicate tiles by their image data
        const tileMap = new Map<string, string>(); // imageBase64 -> tileId
        const newTiles: Tile[] = [];
        const placements: TilePlacement[] = [];

        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            ctx.clearRect(0, 0, tileSize, tileSize);
            ctx.drawImage(
              img,
              col * tileSize, row * tileSize, tileSize, tileSize,
              0, 0, tileSize, tileSize
            );

            // Check if tile is not completely transparent
            const imageData = ctx.getImageData(0, 0, tileSize, tileSize);
            let hasContent = false;
            for (let i = 3; i < imageData.data.length; i += 4) {
              if (imageData.data[i] > 0) {
                hasContent = true;
                break;
              }
            }

            if (hasContent) {
              const imageBase64 = canvas.toDataURL('image/png');

              // Check if we already have this tile (deduplication)
              let tileId = tileMap.get(imageBase64);
              if (!tileId) {
                // New unique tile
                tileId = crypto.randomUUID();
                tileMap.set(imageBase64, tileId);
                newTiles.push({
                  id: tileId,
                  imageBase64,
                  imageData: null,
                  labels: [],
                  width: tileSize,
                  height: tileSize,
                });
              }

              // Create placement
              placements.push({
                id: crypto.randomUUID(),
                tileId,
                gridX: col,
                gridY: row,
                locked: false,
              });
            }
          }
        }

        // Add new tiles to project
        if (newTiles.length > 0) {
          addTiles(newTiles);
        }

        // Create the scene with placements
        const sceneName = importSceneFile.name.replace(/\.[^/.]+$/, '') || 'Imported Scene';
        createSceneWithPlacements(sceneName, cols, rows, placements);

        setShowImportSceneModal(false);
      };
      img.src = importScenePreview;
    }
  }, [importSceneFile, importScenePreview, project, addTiles, createSceneWithPlacements]);

  const handleImportTileset = useCallback(() => {
    // Reset import tileset state
    setImportTilesetFile(null);
    setImportTilesetPreview(null);
    setImportTilesetCreateScene(false);
    setImportTilesetDimensions(null);
    setShowImportTilesetModal(true);
  }, []);

  // Handle file selection for import tileset (from drag-drop or file picker)
  const handleImportTilesetFileSelect = useCallback((file: File) => {
    setImportTilesetFile(file);

    if (file.type === 'application/json' || file.name.endsWith('.json')) {
      // JSON file - no preview, just show filename
      setImportTilesetPreview(null);
      setImportTilesetDimensions(null);
    } else if (file.type.startsWith('image/')) {
      // Image file - create preview
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setImportTilesetPreview(dataUrl);

        // Get image dimensions
        const img = new Image();
        img.onload = () => {
          setImportTilesetDimensions({ width: img.width, height: img.height });
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    }
  }, []);

  // Generate unique scene name
  const generateUniqueSceneName = useCallback((baseName: string) => {
    if (!project) return baseName;
    const existingNames = new Set(project.scenes.map(s => s.name));
    if (!existingNames.has(baseName)) return baseName;

    let counter = 2;
    while (existingNames.has(`${baseName} ${counter}`)) {
      counter++;
    }
    return `${baseName} ${counter}`;
  }, [project]);

  // Process import tileset
  const handleProcessImportTileset = useCallback(() => {
    if (!importTilesetFile || !project) return;

    const tileSize = project.tileSize;

    if (importTilesetFile.type === 'application/json' || importTilesetFile.name.endsWith('.json')) {
      // Import JSON tileset
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          const tiles: Tile[] = data.tiles || [];
          if (tiles.length > 0) {
            addTiles(tiles);
          }
          setShowImportTilesetModal(false);
        } catch (error) {
          console.error('Failed to parse tileset JSON:', error);
          alert('Failed to import tileset: Invalid JSON format');
        }
      };
      reader.readAsText(importTilesetFile);
    } else if (importTilesetFile.type.startsWith('image/') && importTilesetPreview) {
      // Import PNG tileset (spritesheet)
      const img = new Image();
      img.onload = () => {
        const cols = Math.floor(img.width / tileSize);
        const rows = Math.floor(img.height / tileSize);

        // Create a canvas to extract each tile
        const canvas = document.createElement('canvas');
        canvas.width = tileSize;
        canvas.height = tileSize;
        const ctx = canvas.getContext('2d')!;

        // Map to deduplicate tiles by their image data
        const tileMap = new Map<string, string>(); // imageBase64 -> tileId
        const newTiles: Tile[] = [];
        const placements: TilePlacement[] = [];

        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            ctx.clearRect(0, 0, tileSize, tileSize);
            ctx.drawImage(
              img,
              col * tileSize, row * tileSize, tileSize, tileSize,
              0, 0, tileSize, tileSize
            );

            // Check if tile is not completely transparent
            const imageData = ctx.getImageData(0, 0, tileSize, tileSize);
            let hasContent = false;
            for (let i = 3; i < imageData.data.length; i += 4) {
              if (imageData.data[i] > 0) {
                hasContent = true;
                break;
              }
            }

            if (hasContent) {
              const imageBase64 = canvas.toDataURL('image/png');

              // Check if we already have this tile (deduplication)
              let tileId = tileMap.get(imageBase64);
              if (!tileId) {
                // New unique tile
                tileId = crypto.randomUUID();
                tileMap.set(imageBase64, tileId);
                newTiles.push({
                  id: tileId,
                  imageBase64,
                  imageData: null,
                  labels: [],
                  width: tileSize,
                  height: tileSize,
                });
              }

              // Track placement for potential scene creation
              placements.push({
                id: crypto.randomUUID(),
                tileId,
                gridX: col,
                gridY: row,
                locked: false,
              });
            }
          }
        }

        // Add new tiles to project
        if (newTiles.length > 0) {
          addTiles(newTiles);
        }

        // Optionally create scene
        if (importTilesetCreateScene && placements.length > 0) {
          const baseName = importTilesetFile.name.replace(/\.[^/.]+$/, '') || 'Imported';
          const sceneName = generateUniqueSceneName(baseName);
          createSceneWithPlacements(sceneName, cols, rows, placements);
        }

        setShowImportTilesetModal(false);
      };
      img.src = importTilesetPreview;
    }
  }, [importTilesetFile, importTilesetPreview, importTilesetCreateScene, project, addTiles, createSceneWithPlacements, generateUniqueSceneName]);

  const handleExportScene = useCallback(() => {
    setExportSceneFormat('png');
    setExportSceneFilename(activeScene?.name.replace(/[^a-z0-9]/gi, '_') || 'scene');
    setShowExportSceneModal(true);
  }, [activeScene?.name]);

  const handleExportTileset = useCallback(() => {
    setExportTilesetFormat('png');
    setExportTilesetFilename(project?.name.replace(/[^a-z0-9]/gi, '_') + '_tileset' || 'tileset');
    setShowExportTilesetModal(true);
  }, [project?.name]);

  // Export scene as PNG
  const handleExportSceneAsPng = useCallback(() => {
    if (!activeScene || !project) return;

    const { gridWidth, gridHeight, placements } = activeScene;
    const tileSize = project.tileSize;
    const canvas = document.createElement('canvas');
    canvas.width = gridWidth * tileSize;
    canvas.height = gridHeight * tileSize;
    const ctx = canvas.getContext('2d')!;

    // Draw placements
    const imagePromises = placements.map(p => {
      const tile = project.tiles.find(t => t.id === p.tileId);
      if (!tile) return Promise.resolve();

      return new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, p.gridX * tileSize, p.gridY * tileSize, tileSize, tileSize);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = tile.imageBase64 || '';
      });
    });

    Promise.all(imagePromises).then(() => {
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${exportSceneFilename || activeScene.name.replace(/[^a-z0-9]/gi, '_')}.png`;
        a.click();
        URL.revokeObjectURL(url);
      });
    });

    setShowExportSceneModal(false);
  }, [activeScene, project, exportSceneFilename]);

  // Export scene as JSON
  const handleExportSceneAsJson = useCallback(() => {
    if (!activeScene) return;
    const json = JSON.stringify(activeScene, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportSceneFilename || activeScene.name.replace(/[^a-z0-9]/gi, '_')}.scene.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportSceneModal(false);
  }, [activeScene, exportSceneFilename]);

  // Export tileset as PNG
  const handleExportTilesetAsPng = useCallback(() => {
    if (!project || project.tiles.length === 0) return;

    const tileSize = project.tileSize;
    const cols = Math.ceil(Math.sqrt(project.tiles.length));
    const rows = Math.ceil(project.tiles.length / cols);

    const canvas = document.createElement('canvas');
    canvas.width = cols * tileSize;
    canvas.height = rows * tileSize;
    const ctx = canvas.getContext('2d')!;

    const imagePromises = project.tiles.map((tile, index) => {
      const x = (index % cols) * tileSize;
      const y = Math.floor(index / cols) * tileSize;

      return new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, x, y, tileSize, tileSize);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = tile.imageBase64 || '';
      });
    });

    Promise.all(imagePromises).then(() => {
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${exportTilesetFilename || project.name.replace(/[^a-z0-9]/gi, '_') + '_tileset'}.png`;
        a.click();
        URL.revokeObjectURL(url);
      });
    });

    setShowExportTilesetModal(false);
  }, [project, exportTilesetFilename]);

  // Export tileset as JSON
  const handleExportTilesetAsJson = useCallback(() => {
    if (!project) return;
    const json = JSON.stringify({ tiles: project.tiles }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportTilesetFilename || project.name.replace(/[^a-z0-9]/gi, '_') + '_tileset'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportTilesetModal(false);
  }, [project, exportTilesetFilename]);

  // Viewport handlers (to be connected to Canvas)
  const handleZoomIn = useCallback(() => {
    viewportActions?.zoomIn();
  }, [viewportActions]);

  const handleZoomOut = useCallback(() => {
    viewportActions?.zoomOut();
  }, [viewportActions]);

  const handleResetView = useCallback(() => {
    viewportActions?.resetView();
  }, [viewportActions]);

  // Duplicate handler
  const handleDuplicate = useCallback(() => {
    const { duplicateSelectedPlacements } = useProjectStore.getState();
    duplicateSelectedPlacements();
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Tile Studio</h1>
        <span className="tagline">AI-Assisted Tileset Generation</span>
      </header>

      <MenuBar
        onNewProject={handleNewProject}
        onOpenProject={handleOpenProject}
        onSaveProject={handleSaveProject}
        onImportScene={handleImportScene}
        onImportTileset={handleImportTileset}
        onExportScene={handleExportScene}
        onExportTileset={handleExportTileset}
        onProjectSettings={handleProjectSettings}
        onNewScene={handleNewScene}
        onRenameScene={handleRenameScene}
        onDeleteScene={handleDeleteScene}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
      />

      <IconToolbar
        onNewProject={handleNewProject}
        onOpenProject={handleOpenProject}
        onSaveProject={handleSaveProject}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
        onDuplicate={handleDuplicate}
      />

      <div className="app-main">
        <Sidebar />
        <div className="canvas-container">
          <Canvas onViewportActions={setViewportActions} />
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.tilestudio.json"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
      <input
        ref={tilesetInputRef}
        type="file"
        accept="image/png,image/*,.json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImportTilesetFileSelect(file);
          e.target.value = '';
        }}
      />
      <input
        ref={sceneInputRef}
        type="file"
        accept="image/png,image/*,.json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImportSceneFileSelect(file);
          e.target.value = '';
        }}
      />

      {/* New Project Modal */}
      {showNewProjectModal && (
        <div className="modal-overlay" onClick={() => setShowNewProjectModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>New Project</h3>
            <div className="form-group">
              <label>Project Name</label>
              <input
                type="text"
                value={newProjectName}
                onChange={e => setNewProjectName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Tile Size</label>
              <select
                value={newProjectTileSize}
                onChange={e => setNewProjectTileSize(parseInt(e.target.value))}
              >
                <option value={8}>8x8</option>
                <option value={16}>16x16</option>
                <option value={24}>24x24</option>
                <option value={32}>32x32</option>
                <option value={48}>48x48</option>
                <option value={64}>64x64</option>
              </select>
            </div>
            <div className="modal-buttons">
              <button onClick={() => setShowNewProjectModal(false)}>Cancel</button>
              <button className="primary" onClick={handleCreateProject}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* New Scene Modal */}
      {showNewSceneModal && (
        <div className="modal-overlay" onClick={() => setShowNewSceneModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>New Scene</h3>
            <div className="form-group">
              <label>Scene Name</label>
              <input
                type="text"
                value={newSceneName}
                onChange={e => setNewSceneName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Width (tiles)</label>
                <input
                  type="number"
                  value={newSceneWidth}
                  onChange={e => setNewSceneWidth(parseInt(e.target.value) || 10)}
                  min={1}
                  max={100}
                />
              </div>
              <div className="form-group">
                <label>Height (tiles)</label>
                <input
                  type="number"
                  value={newSceneHeight}
                  onChange={e => setNewSceneHeight(parseInt(e.target.value) || 10)}
                  min={1}
                  max={100}
                />
              </div>
            </div>
            <div className="modal-buttons">
              <button onClick={() => setShowNewSceneModal(false)}>Cancel</button>
              <button className="primary" onClick={handleCreateScene}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Scene Modal */}
      {showRenameSceneModal && (
        <div className="modal-overlay" onClick={() => setShowRenameSceneModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Rename Scene</h3>
            <div className="form-group">
              <label>Scene Name</label>
              <input
                type="text"
                value={renameSceneValue}
                onChange={e => setRenameSceneValue(e.target.value)}
                autoFocus
              />
            </div>
            <div className="modal-buttons">
              <button onClick={() => setShowRenameSceneModal(false)}>Cancel</button>
              <button className="primary" onClick={handleConfirmRenameScene}>Rename</button>
            </div>
          </div>
        </div>
      )}

      {/* Project Settings Modal */}
      {showProjectSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowProjectSettingsModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Project Settings</h3>
            <div className="form-group">
              <label>Project Name</label>
              <input
                type="text"
                value={projectSettingsName}
                onChange={e => setProjectSettingsName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Tile Size</label>
              <input
                type="number"
                value={project?.tileSize || 16}
                disabled
              />
              <span className="form-hint">Cannot change tile size after project creation</span>
            </div>
            <div className="modal-buttons">
              <button onClick={() => setShowProjectSettingsModal(false)}>Cancel</button>
              <button className="primary" onClick={handleSaveProjectSettings}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Export Scene Modal */}
      {showExportSceneModal && (
        <div className="modal-overlay" onClick={() => setShowExportSceneModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Export Scene</h3>
            <div className="form-group">
              <label>Filename</label>
              <div className="filename-input-row">
                <input
                  type="text"
                  value={exportSceneFilename}
                  onChange={e => setExportSceneFilename(e.target.value)}
                  placeholder="scene"
                />
                <span className="filename-ext">.{exportSceneFormat === 'png' ? 'png' : 'scene.json'}</span>
              </div>
            </div>
            <div className="export-options">
              <label className="radio-option">
                <input
                  type="radio"
                  name="exportSceneFormat"
                  checked={exportSceneFormat === 'png'}
                  onChange={() => setExportSceneFormat('png')}
                />
                <span>PNG Image</span>
                <span className="option-desc">Rendered scene as a single image</span>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="exportSceneFormat"
                  checked={exportSceneFormat === 'json'}
                  onChange={() => setExportSceneFormat('json')}
                />
                <span>JSON Data</span>
                <span className="option-desc">Scene structure with tile placements</span>
              </label>
            </div>
            <div className="modal-buttons">
              <button onClick={() => setShowExportSceneModal(false)}>Cancel</button>
              <button
                className="primary"
                onClick={exportSceneFormat === 'png' ? handleExportSceneAsPng : handleExportSceneAsJson}
              >
                Export
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Tileset Modal */}
      {showExportTilesetModal && (
        <div className="modal-overlay" onClick={() => setShowExportTilesetModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Export Tileset</h3>
            <p>Export tileset ({project?.tiles.length} tiles)</p>
            <div className="form-group">
              <label>Filename</label>
              <div className="filename-input-row">
                <input
                  type="text"
                  value={exportTilesetFilename}
                  onChange={e => setExportTilesetFilename(e.target.value)}
                  placeholder="tileset"
                />
                <span className="filename-ext">.{exportTilesetFormat === 'png' ? 'png' : 'json'}</span>
              </div>
            </div>
            <div className="export-options">
              <label className="radio-option">
                <input
                  type="radio"
                  name="exportTilesetFormat"
                  checked={exportTilesetFormat === 'png'}
                  onChange={() => setExportTilesetFormat('png')}
                />
                <span>PNG Spritesheet</span>
                <span className="option-desc">All tiles arranged in a grid</span>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="exportTilesetFormat"
                  checked={exportTilesetFormat === 'json'}
                  onChange={() => setExportTilesetFormat('json')}
                />
                <span>JSON Data</span>
                <span className="option-desc">Tile data with embedded images</span>
              </label>
            </div>
            <div className="modal-buttons">
              <button onClick={() => setShowExportTilesetModal(false)}>Cancel</button>
              <button
                className="primary"
                onClick={exportTilesetFormat === 'png' ? handleExportTilesetAsPng : handleExportTilesetAsJson}
              >
                Export
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Scene Modal */}
      {showImportSceneModal && (
        <div className="modal-overlay" onClick={() => setShowImportSceneModal(false)}>
          <div className="modal import-tileset-modal" onClick={e => e.stopPropagation()}>
            <h3>Import Scene</h3>

            {/* Drop zone / Preview area */}
            <div
              className={`import-drop-zone ${importSceneFile ? 'has-file' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.classList.add('drag-over');
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.classList.remove('drag-over');
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.classList.remove('drag-over');
                const file = e.dataTransfer.files[0];
                if (file) handleImportSceneFileSelect(file);
              }}
              onClick={() => !importSceneFile && sceneInputRef.current?.click()}
            >
              {!importSceneFile ? (
                <div className="drop-zone-placeholder">
                  <span className="drop-zone-icon">📁</span>
                  <span>Drop image or JSON file here</span>
                  <span className="drop-zone-hint">or click to browse</span>
                </div>
              ) : importScenePreview ? (
                <div className="import-preview-container">
                  <div
                    className="import-preview"
                    style={{
                      backgroundImage: `url(${importScenePreview})`,
                      backgroundSize: 'contain',
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'center',
                    }}
                  >
                    {/* Grid overlay */}
                    {importSceneDimensions && project && (
                      <svg
                        className="import-grid-overlay"
                        viewBox={`0 0 ${importSceneDimensions.width} ${importSceneDimensions.height}`}
                        preserveAspectRatio="xMidYMid meet"
                      >
                        {/* Vertical lines */}
                        {Array.from({ length: Math.floor(importSceneDimensions.width / project.tileSize) + 1 }).map((_, i) => (
                          <line
                            key={`v${i}`}
                            x1={i * project.tileSize}
                            y1={0}
                            x2={i * project.tileSize}
                            y2={importSceneDimensions.height}
                            stroke="rgba(0, 255, 136, 0.5)"
                            strokeWidth={1}
                          />
                        ))}
                        {/* Horizontal lines */}
                        {Array.from({ length: Math.floor(importSceneDimensions.height / project.tileSize) + 1 }).map((_, i) => (
                          <line
                            key={`h${i}`}
                            x1={0}
                            y1={i * project.tileSize}
                            x2={importSceneDimensions.width}
                            y2={i * project.tileSize}
                            stroke="rgba(0, 255, 136, 0.5)"
                            strokeWidth={1}
                          />
                        ))}
                      </svg>
                    )}
                  </div>
                  <button
                    className="change-file-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      sceneInputRef.current?.click();
                    }}
                  >
                    Change file
                  </button>
                </div>
              ) : (
                <div className="drop-zone-placeholder">
                  <span className="drop-zone-icon">📄</span>
                  <span>{importSceneFile.name}</span>
                  <span className="drop-zone-hint">JSON scene file</span>
                  <button
                    className="change-file-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      sceneInputRef.current?.click();
                    }}
                  >
                    Change file
                  </button>
                </div>
              )}
            </div>

            {/* Info for image files */}
            {importSceneFile && importScenePreview && importSceneDimensions && project && (
              <div className="import-tileset-options">
                <div className="form-group">
                  <label>Tile Size</label>
                  <span className="form-value">{project.tileSize}x{project.tileSize}</span>
                  <span className="form-hint">
                    {Math.floor(importSceneDimensions.width / project.tileSize)} x {Math.floor(importSceneDimensions.height / project.tileSize)} tiles
                  </span>
                </div>
              </div>
            )}

            <div className="modal-buttons">
              <button onClick={() => setShowImportSceneModal(false)}>Cancel</button>
              <button
                className="primary"
                disabled={!importSceneFile}
                onClick={handleProcessImportScene}
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Tileset Modal */}
      {showImportTilesetModal && (
        <div className="modal-overlay" onClick={() => setShowImportTilesetModal(false)}>
          <div className="modal import-tileset-modal" onClick={e => e.stopPropagation()}>
            <h3>Import Tileset</h3>

            {/* Drop zone / Preview area */}
            <div
              className={`import-drop-zone ${importTilesetFile ? 'has-file' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.classList.add('drag-over');
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.classList.remove('drag-over');
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.classList.remove('drag-over');
                const file = e.dataTransfer.files[0];
                if (file) handleImportTilesetFileSelect(file);
              }}
              onClick={() => !importTilesetFile && tilesetInputRef.current?.click()}
            >
              {!importTilesetFile ? (
                <div className="drop-zone-placeholder">
                  <span className="drop-zone-icon">📁</span>
                  <span>Drop image or JSON file here</span>
                  <span className="drop-zone-hint">or click to browse</span>
                </div>
              ) : importTilesetPreview ? (
                <div className="import-preview-container">
                  <div
                    className="import-preview"
                    style={{
                      backgroundImage: `url(${importTilesetPreview})`,
                      backgroundSize: 'contain',
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'center',
                    }}
                  >
                    {/* Grid overlay */}
                    {importTilesetDimensions && project && (
                      <svg
                        className="import-grid-overlay"
                        viewBox={`0 0 ${importTilesetDimensions.width} ${importTilesetDimensions.height}`}
                        preserveAspectRatio="xMidYMid meet"
                      >
                        {/* Vertical lines */}
                        {Array.from({ length: Math.floor(importTilesetDimensions.width / project.tileSize) + 1 }).map((_, i) => (
                          <line
                            key={`v${i}`}
                            x1={i * project.tileSize}
                            y1={0}
                            x2={i * project.tileSize}
                            y2={importTilesetDimensions.height}
                            stroke="rgba(0, 255, 136, 0.5)"
                            strokeWidth={1}
                          />
                        ))}
                        {/* Horizontal lines */}
                        {Array.from({ length: Math.floor(importTilesetDimensions.height / project.tileSize) + 1 }).map((_, i) => (
                          <line
                            key={`h${i}`}
                            x1={0}
                            y1={i * project.tileSize}
                            x2={importTilesetDimensions.width}
                            y2={i * project.tileSize}
                            stroke="rgba(0, 255, 136, 0.5)"
                            strokeWidth={1}
                          />
                        ))}
                      </svg>
                    )}
                  </div>
                  <button
                    className="change-file-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      tilesetInputRef.current?.click();
                    }}
                  >
                    Change file
                  </button>
                </div>
              ) : (
                <div className="drop-zone-placeholder">
                  <span className="drop-zone-icon">📄</span>
                  <span>{importTilesetFile.name}</span>
                  <span className="drop-zone-hint">JSON tileset file</span>
                  <button
                    className="change-file-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      tilesetInputRef.current?.click();
                    }}
                  >
                    Change file
                  </button>
                </div>
              )}
            </div>

            {/* Options (only show for image files) */}
            {importTilesetFile && importTilesetPreview && (
              <div className="import-tileset-options">
                <div className="form-group">
                  <label>Tile Size</label>
                  <span className="form-value">{project?.tileSize || 16}x{project?.tileSize || 16}</span>
                  {importTilesetDimensions && (
                    <span className="form-hint">
                      {Math.floor(importTilesetDimensions.width / (project?.tileSize || 16))} x {Math.floor(importTilesetDimensions.height / (project?.tileSize || 16))} tiles
                    </span>
                  )}
                </div>

                <label className="checkbox-option">
                  <input
                    type="checkbox"
                    checked={importTilesetCreateScene}
                    onChange={(e) => setImportTilesetCreateScene(e.target.checked)}
                  />
                  <span>Also create scene from this image</span>
                </label>
              </div>
            )}

            <div className="modal-buttons">
              <button onClick={() => setShowImportTilesetModal(false)}>Cancel</button>
              <button
                className="primary"
                disabled={!importTilesetFile}
                onClick={handleProcessImportTileset}
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
