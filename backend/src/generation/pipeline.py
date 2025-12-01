"""Inpainting pipeline for tile generation."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from io import BytesIO
from typing import Protocol

import numpy as np
from PIL import Image


@dataclass
class EdgeConstraint:
    """An edge that must be pixel-matched."""

    x: int
    y: int
    width: int
    height: int
    pixels: np.ndarray


@dataclass
class GenerationConfig:
    """Configuration for generation."""

    prompt: str
    negative_prompt: str = ""
    steps: int = 20
    guidance_scale: float = 7.5
    seed: int | None = None


@dataclass
class GenerationResult:
    """Result of inpainting generation."""

    image: Image.Image
    success: bool
    error: str | None = None


class InpaintingBackend(ABC):
    """Abstract base class for inpainting backends."""

    @abstractmethod
    def generate(
        self,
        image: Image.Image,
        mask: Image.Image,
        config: GenerationConfig,
    ) -> GenerationResult:
        """
        Run inpainting on the given image.

        Args:
            image: The source image with context
            mask: White pixels indicate areas to regenerate
            config: Generation configuration

        Returns:
            GenerationResult with the inpainted image
        """
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """Check if this backend is available (e.g., GPU present)."""
        pass


class PlaceholderBackend(InpaintingBackend):
    """Placeholder backend that returns solid colors (for testing without GPU)."""

    def generate(
        self,
        image: Image.Image,
        mask: Image.Image,
        config: GenerationConfig,
    ) -> GenerationResult:
        """Generate a placeholder result."""
        # Create result as copy of input
        result = image.copy()

        # Fill masked areas with magenta
        mask_array = np.array(mask.convert("L"))
        result_array = np.array(result)

        # Where mask is white (255), fill with magenta
        masked_pixels = mask_array > 128
        result_array[masked_pixels] = [255, 0, 255, 255]

        return GenerationResult(
            image=Image.fromarray(result_array),
            success=True,
        )

    def is_available(self) -> bool:
        """Placeholder is always available."""
        return True


class GenerationPipeline:
    """
    Main pipeline for tile generation.

    Handles:
    1. Composing scene with locked tiles
    2. Creating mask for unlocked region
    3. Running inpainting
    4. Edge cleanup pass
    5. Slicing result back into tiles
    """

    def __init__(self, backend: InpaintingBackend | None = None):
        """Initialize the pipeline with an inpainting backend."""
        self.backend = backend or PlaceholderBackend()

    def generate(
        self,
        scene_image: Image.Image,
        mask: Image.Image,
        config: GenerationConfig,
        locked_edges: list[EdgeConstraint] | None = None,
        tile_size: int = 16,
    ) -> GenerationResult:
        """
        Run the full generation pipeline.

        Args:
            scene_image: Composed scene with locked tiles
            mask: Mask for areas to regenerate
            config: Generation configuration
            locked_edges: Edges that must be pixel-matched
            tile_size: Size of tiles in pixels

        Returns:
            GenerationResult with the generated image
        """
        locked_edges = locked_edges or []

        # Step 1: Main inpainting pass
        result = self.backend.generate(scene_image, mask, config)
        if not result.success:
            return result

        # Step 2: Edge cleanup pass
        if locked_edges:
            result = self._cleanup_edges(result.image, locked_edges, config)

        return result

    def _cleanup_edges(
        self,
        image: Image.Image,
        edges: list[EdgeConstraint],
        config: GenerationConfig,
    ) -> GenerationResult:
        """
        Run edge cleanup to ensure pixel-level matching.

        This does targeted inpainting on just the edge regions to ensure
        they match the locked edge pixels.
        """
        # TODO: Implement proper edge cleanup
        # For now, just copy the locked edge pixels directly
        result_array = np.array(image)

        for edge in edges:
            result_array[
                edge.y : edge.y + edge.height,
                edge.x : edge.x + edge.width,
            ] = edge.pixels

        return GenerationResult(
            image=Image.fromarray(result_array),
            success=True,
        )

    def slice_tiles(
        self,
        image: Image.Image,
        bounds: tuple[int, int, int, int],
        tile_size: int,
    ) -> list[tuple[int, int, Image.Image]]:
        """
        Slice an image into tiles.

        Args:
            image: The source image
            bounds: (min_x, min_y, max_x, max_y) in grid coordinates
            tile_size: Size of tiles in pixels

        Returns:
            List of (grid_x, grid_y, tile_image) tuples
        """
        min_x, min_y, max_x, max_y = bounds
        tiles = []

        for grid_y in range(min_y, max_y + 1):
            for grid_x in range(min_x, max_x + 1):
                px_x = grid_x * tile_size
                px_y = grid_y * tile_size
                tile = image.crop((px_x, px_y, px_x + tile_size, px_y + tile_size))
                tiles.append((grid_x, grid_y, tile))

        return tiles
