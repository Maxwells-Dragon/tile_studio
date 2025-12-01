# Tile Studio

A studio for iteratively developing pixel art tilesets using AI-assisted generation.

## Core Concept

Generate coherent pixel art scenes that decompose into tiles, rather than generating individual tiles that compose into scenes. This uses region-based inpainting with context awareness.

## The Problem

Per-tile AI generation doesn't work well for tilesets. Even with edge enforcement, generating tiles individually produces sets that technically fit together but lack coherence. A cave entrance on one tile doesn't continue naturally into the next.

## The Solution

The generation target is "generate a pixel art scene that decomposes into tiles" rather than "generate tiles that compose into a scene." This means using inpainting at the region level, not the tile level.

## Core Workflow

1. Arrange tiles in a scene (or import an existing scene/tileset)
2. Select a region to regenerate
3. Configure which edges should be preserved vs. regenerated freely
4. Describe what should appear there
5. Generate, review, accept or retry
6. Repeat until the tileset is complete

## Project Structure

```
tile_studio/
├── frontend/          # React + TypeScript canvas editor
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── stores/        # State management
│   │   ├── types/         # TypeScript types
│   │   └── utils/         # Utility functions
│   └── package.json
├── backend/           # Python generation service
│   ├── src/
│   │   ├── api/          # API endpoints
│   │   ├── generation/   # SD inpainting pipeline
│   │   └── utils/        # Utility functions
│   ├── requirements.txt
│   └── pyproject.toml
└── docs/              # Documentation
```

## Key Design Principles

- **Tiles are simple**: Just images with optional labels, no edge/adjacency data
- **Edges live in the scene**: Constraints are contextual, not tile properties
- **Locked by default**: Protect existing work, select what to change
- **Two-pass generation**: Main inpainting for semantics, edge cleanup for pixel matching

## Tech Stack

- **Frontend**: React, TypeScript, Canvas API
- **Backend**: Python, FastAPI, Stable Diffusion
- **Format Support**: Tiled (.tmx/.json), LDtk, PNG

## Development

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
pip install -e .
python -m uvicorn src.api.main:app --reload
```

## License

MIT
