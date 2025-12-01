import { useEffect } from 'react';
import { Canvas, Toolbar, Sidebar } from './components';
import { useProjectStore } from './stores/projectStore';
import './App.css';

function App() {
  const { project, createProject } = useProjectStore();

  useEffect(() => {
    // Create a default project on first load
    if (!project) {
      createProject('Untitled Project', 16);
    }
  }, [project, createProject]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Tile Studio</h1>
        <span className="tagline">AI-Assisted Tileset Generation</span>
      </header>

      <Toolbar />

      <div className="app-main">
        <Sidebar />
        <div className="canvas-container">
          <Canvas />
        </div>
      </div>
    </div>
  );
}

export default App;
