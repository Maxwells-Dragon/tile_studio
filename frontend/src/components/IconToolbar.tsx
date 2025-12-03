import {
  File,
  FolderOpen,
  Save,
  Undo2,
  Redo2,
  MousePointer2,
  ZoomIn,
  ZoomOut,
  Home,
  Trash2,
  Copy,
} from 'lucide-react';
import { useProjectStore } from '../stores/projectStore';

interface ToolbarButtonProps {
  icon: React.ReactNode;
  tooltip: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}

function ToolbarButton({ icon, tooltip, onClick, disabled, active }: ToolbarButtonProps) {
  return (
    <button
      className={`toolbar-icon-button ${active ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
    >
      {icon}
    </button>
  );
}

function ToolbarSeparator() {
  return <div className="toolbar-separator" />;
}

interface IconToolbarProps {
  onNewProject: () => void;
  onOpenProject: () => void;
  onSaveProject: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onDuplicate: () => void;
}

export function IconToolbar({
  onNewProject,
  onOpenProject,
  onSaveProject,
  onZoomIn,
  onZoomOut,
  onResetView,
  onDuplicate,
}: IconToolbarProps) {
  const {
    project,
    undo,
    redo,
    canUndo,
    canRedo,
    deleteSelectedPlacements,
    selection,
    toolMode,
    setToolMode,
  } = useProjectStore();

  const hasSelection = selection.tileIds.size > 0;
  const activeScene = project?.scenes.find(s => s.id === project.activeSceneId);

  return (
    <div className="icon-toolbar">
      <ToolbarButton
        icon={<File size={16} />}
        tooltip="New Project (Ctrl+N)"
        onClick={onNewProject}
      />
      <ToolbarButton
        icon={<FolderOpen size={16} />}
        tooltip="Open Project (Ctrl+O)"
        onClick={onOpenProject}
      />
      <ToolbarButton
        icon={<Save size={16} />}
        tooltip="Save Project (Ctrl+S)"
        onClick={onSaveProject}
        disabled={!project}
      />

      <ToolbarSeparator />

      <ToolbarButton
        icon={<Undo2 size={16} />}
        tooltip="Undo (Ctrl+Z)"
        onClick={undo}
        disabled={!canUndo()}
      />
      <ToolbarButton
        icon={<Redo2 size={16} />}
        tooltip="Redo (Ctrl+Y)"
        onClick={redo}
        disabled={!canRedo()}
      />

      <ToolbarSeparator />

      <ToolbarButton
        icon={<MousePointer2 size={16} />}
        tooltip="Select Tool"
        onClick={() => setToolMode('select')}
        active={toolMode === 'select'}
      />

      <ToolbarSeparator />

      <ToolbarButton
        icon={<ZoomIn size={16} />}
        tooltip="Zoom In (Ctrl+=)"
        onClick={onZoomIn}
        disabled={!activeScene}
      />
      <ToolbarButton
        icon={<ZoomOut size={16} />}
        tooltip="Zoom Out (Ctrl+-)"
        onClick={onZoomOut}
        disabled={!activeScene}
      />
      <ToolbarButton
        icon={<Home size={16} />}
        tooltip="Reset View (Home)"
        onClick={onResetView}
        disabled={!activeScene}
      />

      <ToolbarSeparator />

      <ToolbarButton
        icon={<Copy size={16} />}
        tooltip="Duplicate Selection (Ctrl+D)"
        onClick={onDuplicate}
        disabled={!hasSelection}
      />
      <ToolbarButton
        icon={<Trash2 size={16} />}
        tooltip="Delete Selection (Del)"
        onClick={deleteSelectedPlacements}
        disabled={!hasSelection}
      />
    </div>
  );
}
