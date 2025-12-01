# Tile Studio Backend

Python backend service for AI-assisted tileset generation.

## Setup

### Basic Setup (CPU only)

```bash
# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (Linux/Mac)
source venv/bin/activate

# Install dependencies
pip install -e .
```

### GPU Setup (for actual generation)

```bash
pip install -e ".[gpu]"
```

## Running

```bash
# Development server with hot reload
python -m uvicorn src.api.main:app --reload

# Or use the CLI
tile-studio
```

The API will be available at `http://localhost:8000`.

## API Documentation

Once running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Project Structure

```
backend/
├── src/
│   ├── api/           # FastAPI application
│   │   ├── main.py    # Application entry point
│   │   └── routes/    # API endpoints
│   ├── generation/    # Inpainting pipeline
│   │   └── pipeline.py
│   └── utils/         # Utility functions
│       └── image.py
├── tests/             # Test files
├── pyproject.toml     # Project configuration
└── requirements.txt   # Dependencies
```

## Endpoints

### Health
- `GET /health` - Health check
- `GET /` - Service info

### Generation
- `POST /api/generate` - Generate tiles via inpainting
- `GET /api/models` - List available models

## Development

```bash
# Install dev dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Format code
black src tests
ruff check src tests

# Type checking
mypy src
```
