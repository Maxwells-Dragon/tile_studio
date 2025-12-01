# Tile Studio Architecture

## Overview

Tile Studio is a tool for iteratively developing pixel art tilesets using AI-assisted generation. The core insight is that generation should target "a scene that decomposes into tiles" rather than "tiles that compose into a scene."

## Core Concepts

### Tiles Are Simple
A tile is just an image with optional labels. Tiles don't know about their edges or adjacency rules. They're reusable across scenes without carrying baggage.

### Edges Live in the Scene
An edge is a location on the grid (between two cells), a width, and a lock state. Edges aren't attached to tiles—they exist in the scene to define constraints during regeneration.

### Locked by Default
Tiles default to locked. The typical workflow is selecting small regions to unlock and regenerate while everything else stays fixed.

### Context-Aware Fill
When regenerating a region, locked tiles and locked edges are visible to the AI as context. The generation continues visual features from the surroundings.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│                   (React + TypeScript)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Canvas    │  │   Sidebar   │  │      Toolbar        │  │
│  │   Editor    │  │  - Scenes   │  │  - Tool modes       │  │
│  │  - Tiles    │  │  - Tiles    │  │  - Lock/Unlock      │  │
│  │  - Edges    │  │  - Keywords │  │  - Selection        │  │
│  │  - Select   │  │             │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                           │                                  │
│                    ┌──────┴──────┐                          │
│                    │   Zustand   │                          │
│                    │    Store    │                          │
│                    └──────┬──────┘                          │
└───────────────────────────┼─────────────────────────────────┘
                            │ HTTP/REST
┌───────────────────────────┼─────────────────────────────────┐
│                    ┌──────┴──────┐                          │
│                    │   FastAPI   │                          │
│                    │     API     │                          │
│                    └──────┬──────┘                          │
│                           │                                  │
│  ┌────────────────────────┼────────────────────────────┐    │
│  │              Generation Pipeline                     │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │    │
│  │  │   Compose   │→ │  Inpaint    │→ │   Edge      │  │    │
│  │  │   Scene     │  │  (SD)       │  │   Cleanup   │  │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  │    │
│  └─────────────────────────────────────────────────────┘    │
│                        Backend                               │
│                       (Python)                               │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### Generation Flow

1. **User selects region** to regenerate in the frontend
2. **Frontend composes request**:
   - Scene image with locked tiles rendered
   - Mask indicating unlocked areas
   - Edge constraints for locked boundaries
   - Prompt from keywords + description
3. **Backend receives request** via REST API
4. **Generation pipeline runs**:
   - Main inpainting pass (SD) for semantic content
   - Edge cleanup pass for pixel-level matching
5. **Result sliced into tiles** and returned
6. **Frontend shows preview**, user accepts/rejects

### State Management

The frontend uses Zustand for state:
- **Project**: tiles, scenes, keywords
- **Scene**: placements, edges, grid config
- **Selection**: selected tiles and edges
- **Viewport**: pan, zoom
- **Tool mode**: select, place, pan, lasso

## Key Design Decisions

### Why Region-Based Inpainting?
Per-tile generation produces tiles that technically fit but lack coherence. Region-based inpainting preserves semantic continuity—a cave formation spans tiles naturally.

### Why Edges in Scene, Not Tiles?
Adjacency is contextual. The same tile might border grass in one scene and water in another. Storing edges in the scene keeps tiles reusable.

### Why Two-Pass Generation?
The main inpainting pass produces semantically coherent results but won't pixel-match locked edges. The edge cleanup pass specifically handles boundary matching.

### Why Locked by Default?
You're usually refining, not generating from scratch. Locking by default protects existing work.

## File Formats

### Project Format (JSON)
```json
{
  "id": "uuid",
  "name": "Project Name",
  "tiles": [...],
  "scenes": [...],
  "keywords": [...],
  "defaultTileSize": 16
}
```

### Import/Export Support
- **Tiled** (.tmx/.json): Industry standard, supports layers
- **LDtk**: Modern alternative, good for pixel art
- **PNG**: Raw tileset images with grid slicing

## Future Considerations

- **Multi-layer scenes**: Overlay/decoration layers
- **Tile variations**: Multiple tiles that are logically equivalent
- **History/versioning**: Named snapshots beyond undo
- **Procedural generation**: WFC or constraint solvers (separate feature)
