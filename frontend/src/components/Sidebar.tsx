import { useState } from 'react';
import { useProjectStore } from '../stores/projectStore';

export function Sidebar() {
  const { project, createScene, setActiveScene } = useProjectStore();
  const [showNewScene, setShowNewScene] = useState(false);
  const [sceneName, setSceneName] = useState('');
  const [gridWidth, setGridWidth] = useState(16);
  const [gridHeight, setGridHeight] = useState(16);

  const handleCreateScene = () => {
    if (sceneName.trim()) {
      createScene(sceneName.trim(), gridWidth, gridHeight);
      setSceneName('');
      setShowNewScene(false);
    }
  };

  return (
    <div className="sidebar">
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
                <div key={tile.id} className="tile-item" title={tile.labels.join(', ')}>
                  {tile.imageBase64 ? (
                    <img src={tile.imageBase64} alt="" />
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
