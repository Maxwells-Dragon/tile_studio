import { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  File,
  FolderOpen,
  Save,
  Download,
  Upload,
  Undo2,
  Redo2,
  Trash2,
  Copy,
  MousePointer2,
  ZoomIn,
  ZoomOut,
  Home,
  Grid3X3,
  Plus,
  Pencil,
  SkipForward,
  SkipBack,
  Settings,
} from 'lucide-react';
import { useProjectStore } from '../stores/projectStore';

interface MenuItem {
  label: string;
  shortcut?: string;
  icon?: React.ReactNode;
  action?: () => void;
  disabled?: boolean;
  separator?: boolean;
  submenu?: MenuItem[];
}

interface MenuProps {
  label: string;
  items: MenuItem[];
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}

function Menu({ label, items, isOpen, onOpen, onClose }: MenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const handleItemClick = (item: MenuItem) => {
    if (item.action && !item.disabled) {
      item.action();
      onClose();
    }
  };

  return (
    <div className="menu" ref={menuRef}>
      <button
        className={`menu-trigger ${isOpen ? 'active' : ''}`}
        onClick={() => (isOpen ? onClose() : onOpen())}
        onMouseEnter={() => isOpen && onOpen()}
      >
        {label}
      </button>
      {isOpen && (
        <div className="menu-dropdown">
          {items.map((item, index) =>
            item.separator ? (
              <div key={index} className="menu-separator" />
            ) : (
              <button
                key={index}
                className={`menu-item ${item.disabled ? 'disabled' : ''}`}
                onClick={() => handleItemClick(item)}
                disabled={item.disabled}
              >
                <span className="menu-item-icon">{item.icon}</span>
                <span className="menu-item-label">{item.label}</span>
                {item.shortcut && (
                  <span className="menu-item-shortcut">{item.shortcut}</span>
                )}
                {item.submenu && <ChevronDown size={12} className="submenu-arrow" />}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

interface MenuBarProps {
  onNewProject: () => void;
  onOpenProject: () => void;
  onSaveProject: () => void;
  onImportScene: () => void;
  onImportTileset: () => void;
  onExportScene: () => void;
  onExportTileset: () => void;
  onProjectSettings: () => void;
  onNewScene: () => void;
  onRenameScene: () => void;
  onDeleteScene: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
}

export function MenuBar({
  onNewProject,
  onOpenProject,
  onSaveProject,
  onImportScene,
  onImportTileset,
  onExportScene,
  onExportTileset,
  onProjectSettings,
  onNewScene,
  onRenameScene,
  onDeleteScene,
  onZoomIn,
  onZoomOut,
  onResetView,
}: MenuBarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const {
    project,
    undo,
    redo,
    canUndo,
    canRedo,
    selectAllTiles,
    clearSelection,
    deleteSelectedPlacements,
    duplicateSelectedPlacements,
    selection,
    setActiveScene,
  } = useProjectStore();

  const hasSelection = selection.tileIds.size > 0;
  const hasScenes = project && project.scenes.length > 0;
  const activeScene = project?.scenes.find(s => s.id === project.activeSceneId);

  const handleNextScene = () => {
    if (!project || project.scenes.length <= 1) return;
    const currentIndex = project.scenes.findIndex(s => s.id === project.activeSceneId);
    const nextIndex = (currentIndex + 1) % project.scenes.length;
    setActiveScene(project.scenes[nextIndex].id);
  };

  const handlePrevScene = () => {
    if (!project || project.scenes.length <= 1) return;
    const currentIndex = project.scenes.findIndex(s => s.id === project.activeSceneId);
    const prevIndex = (currentIndex - 1 + project.scenes.length) % project.scenes.length;
    setActiveScene(project.scenes[prevIndex].id);
  };

  const fileMenu: MenuItem[] = [
    { label: 'New Project', shortcut: 'Ctrl+Shift+N', icon: <File size={14} />, action: onNewProject },
    { label: 'Open Project...', shortcut: 'Ctrl+Shift+O', icon: <FolderOpen size={14} />, action: onOpenProject },
    { label: 'Save Project', shortcut: 'Ctrl+Shift+S', icon: <Save size={14} />, action: onSaveProject, disabled: !project },
    { separator: true, label: '' },
    { label: 'Import Scene...', icon: <Upload size={14} />, action: onImportScene, disabled: !project },
    { label: 'Import Tileset...', icon: <Upload size={14} />, action: onImportTileset, disabled: !project },
    { separator: true, label: '' },
    { label: 'Export Scene...', icon: <Download size={14} />, action: onExportScene, disabled: !activeScene },
    { label: 'Export Tileset...', icon: <Download size={14} />, action: onExportTileset, disabled: !project || project.tiles.length === 0 },
    { separator: true, label: '' },
    { label: 'Project Settings...', icon: <Settings size={14} />, action: onProjectSettings, disabled: !project },
  ];

  const editMenu: MenuItem[] = [
    { label: 'Undo', shortcut: 'Ctrl+Z', icon: <Undo2 size={14} />, action: undo, disabled: !canUndo() },
    { label: 'Redo', shortcut: 'Ctrl+Y', icon: <Redo2 size={14} />, action: redo, disabled: !canRedo() },
    { separator: true, label: '' },
    { label: 'Select All', shortcut: 'Ctrl+A', icon: <MousePointer2 size={14} />, action: selectAllTiles, disabled: !activeScene },
    { label: 'Deselect', shortcut: 'Esc', action: clearSelection, disabled: !hasSelection },
    { separator: true, label: '' },
    { label: 'Duplicate', shortcut: 'Ctrl+Shift+D', icon: <Copy size={14} />, action: duplicateSelectedPlacements, disabled: !hasSelection },
    { label: 'Delete', shortcut: 'Del', icon: <Trash2 size={14} />, action: deleteSelectedPlacements, disabled: !hasSelection },
  ];

  const viewMenu: MenuItem[] = [
    { label: 'Zoom In', shortcut: 'Ctrl+Shift+=', icon: <ZoomIn size={14} />, action: onZoomIn },
    { label: 'Zoom Out', shortcut: 'Ctrl+Shift+-', icon: <ZoomOut size={14} />, action: onZoomOut },
    { label: 'Reset View', shortcut: 'Ctrl+Shift+0', icon: <Home size={14} />, action: onResetView },
    { separator: true, label: '' },
    { label: 'Show Grid', icon: <Grid3X3 size={14} />, action: () => {/* TODO */} },
  ];

  const sceneMenu: MenuItem[] = [
    { label: 'New Scene...', icon: <Plus size={14} />, action: onNewScene, disabled: !project },
    { label: 'Rename Scene...', icon: <Pencil size={14} />, action: onRenameScene, disabled: !activeScene },
    { label: 'Delete Scene', icon: <Trash2 size={14} />, action: onDeleteScene, disabled: !activeScene },
    { separator: true, label: '' },
    { label: 'Next Scene', shortcut: 'Tab', icon: <SkipForward size={14} />, action: handleNextScene, disabled: !hasScenes || project!.scenes.length <= 1 },
    { label: 'Previous Scene', shortcut: 'Shift+Tab', icon: <SkipBack size={14} />, action: handlePrevScene, disabled: !hasScenes || project!.scenes.length <= 1 },
  ];

  return (
    <div className="menu-bar">
      <Menu
        label="File"
        items={fileMenu}
        isOpen={openMenu === 'file'}
        onOpen={() => setOpenMenu('file')}
        onClose={() => setOpenMenu(null)}
      />
      <Menu
        label="Edit"
        items={editMenu}
        isOpen={openMenu === 'edit'}
        onOpen={() => setOpenMenu('edit')}
        onClose={() => setOpenMenu(null)}
      />
      <Menu
        label="View"
        items={viewMenu}
        isOpen={openMenu === 'view'}
        onOpen={() => setOpenMenu('view')}
        onClose={() => setOpenMenu(null)}
      />
      <Menu
        label="Scene"
        items={sceneMenu}
        isOpen={openMenu === 'scene'}
        onOpen={() => setOpenMenu('scene')}
        onClose={() => setOpenMenu(null)}
      />
    </div>
  );
}
