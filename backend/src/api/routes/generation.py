"""Generation endpoints for tile inpainting."""

import base64
from io import BytesIO
from typing import Any

from fastapi import APIRouter, HTTPException
from PIL import Image
from pydantic import BaseModel, Field

router = APIRouter()


class EdgeConstraint(BaseModel):
    """An edge constraint for generation."""

    x: int = Field(description="X position in pixels")
    y: int = Field(description="Y position in pixels")
    width: int = Field(description="Width of the edge strip")
    height: int = Field(description="Height of the edge strip")
    pixels: str = Field(description="Base64 encoded pixel data")


class GenerationBounds(BaseModel):
    """Bounds of the generation area in grid coordinates."""

    min_x: int = Field(alias="minX")
    min_y: int = Field(alias="minY")
    max_x: int = Field(alias="maxX")
    max_y: int = Field(alias="maxY")


class GenerationRequest(BaseModel):
    """Request to generate tiles via inpainting."""

    scene_image: str = Field(alias="sceneImage", description="Base64 encoded scene image")
    mask: str = Field(description="Base64 encoded mask (white = regenerate)")
    locked_edges: list[EdgeConstraint] = Field(
        alias="lockedEdges", default_factory=list, description="Edge constraints to preserve"
    )
    prompt: str = Field(description="Generation prompt")
    keywords: list[str] = Field(default_factory=list, description="Keywords to prepend to prompt")
    tile_size: int = Field(alias="tileSize", default=16, description="Tile size in pixels")
    bounds: GenerationBounds = Field(description="Grid bounds of generation area")


class GeneratedTile(BaseModel):
    """A single generated tile."""

    grid_x: int = Field(alias="gridX")
    grid_y: int = Field(alias="gridY")
    image_base64: str = Field(alias="imageBase64")


class GenerationResponse(BaseModel):
    """Response from tile generation."""

    tiles: list[GeneratedTile]
    success: bool
    error: str | None = None


@router.post("/generate", response_model=GenerationResponse)
async def generate_tiles(request: GenerationRequest) -> GenerationResponse:
    """
    Generate tiles using inpainting.

    This endpoint receives:
    - A composed scene image with locked tiles rendered
    - A mask indicating which areas to regenerate
    - Edge constraints that must be pixel-matched
    - A prompt describing what to generate

    It returns:
    - Generated tiles sliced from the result
    """
    try:
        # Build the full prompt from keywords + description
        full_prompt = " ".join(request.keywords + [request.prompt])

        # Decode the scene image
        scene_data = base64.b64decode(request.scene_image.split(",")[-1])
        scene_image = Image.open(BytesIO(scene_data))

        # Decode the mask
        mask_data = base64.b64decode(request.mask.split(",")[-1])
        mask_image = Image.open(BytesIO(mask_data))

        # TODO: Implement actual SD inpainting
        # For now, return a placeholder response
        generated_tiles: list[GeneratedTile] = []

        for grid_x in range(request.bounds.min_x, request.bounds.max_x + 1):
            for grid_y in range(request.bounds.min_y, request.bounds.max_y + 1):
                # Create a placeholder tile (magenta for visibility)
                tile = Image.new("RGBA", (request.tile_size, request.tile_size), (255, 0, 255, 255))

                # Convert to base64
                buffer = BytesIO()
                tile.save(buffer, format="PNG")
                tile_base64 = f"data:image/png;base64,{base64.b64encode(buffer.getvalue()).decode()}"

                generated_tiles.append(
                    GeneratedTile(
                        grid_x=grid_x,
                        grid_y=grid_y,
                        image_base64=tile_base64,
                    )
                )

        return GenerationResponse(
            tiles=generated_tiles,
            success=True,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/models")
async def list_models() -> dict[str, Any]:
    """List available generation models."""
    # TODO: Implement model listing
    return {
        "models": [
            {
                "id": "placeholder",
                "name": "Placeholder (No GPU)",
                "description": "Returns magenta placeholder tiles",
            }
        ],
        "active": "placeholder",
    }
