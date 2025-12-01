import { useProjectStore } from '../stores/projectStore';
import type { ToolMode } from '../types';

export function Toolbar() {
  const { toolMode, setToolMode, selection, lockSelection, unlockSelection, clearSelection } = useProjectStore();

  const tools: { mode: ToolMode; label: string; icon: string }[] = [
    { mode: 'select', label: 'Select', icon: '◻' },
    { mode: 'place', label: 'Place', icon: '⊞' },
    { mode: 'pan', label: 'Pan', icon: '✋' },
    { mode: 'lasso', label: 'Lasso', icon: '◯' },
  ];

  const hasSelection = selection.tileIds.size > 0 || selection.edgeIds.size > 0;

  return (
    <div className="toolbar">
      <div className="tool-group">
        {tools.map(tool => (
          <button
            key={tool.mode}
            className={`tool-button ${toolMode === tool.mode ? 'active' : ''}`}
            onClick={() => setToolMode(tool.mode)}
            title={tool.label}
          >
            <span className="tool-icon">{tool.icon}</span>
            <span className="tool-label">{tool.label}</span>
          </button>
        ))}
      </div>

      <div className="tool-separator" />

      <div className="tool-group">
        <button
          className="tool-button"
          onClick={lockSelection}
          disabled={!hasSelection}
          title="Lock selected tiles/edges"
        >
          🔒 Lock
        </button>
        <button
          className="tool-button"
          onClick={unlockSelection}
          disabled={!hasSelection}
          title="Unlock selected tiles/edges"
        >
          🔓 Unlock
        </button>
        <button
          className="tool-button"
          onClick={clearSelection}
          disabled={!hasSelection}
          title="Clear selection"
        >
          ✕ Clear
        </button>
      </div>

      <div className="tool-separator" />

      <div className="tool-group">
        <span className="selection-info">
          {selection.tileIds.size} tiles, {selection.edgeIds.size} edges selected
        </span>
      </div>
    </div>
  );
}
