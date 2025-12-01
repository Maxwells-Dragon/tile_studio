"""Image utility functions."""

import base64
from io import BytesIO

import numpy as np
from PIL import Image


def image_to_base64(image: Image.Image, format: str = "PNG") -> str:
    """Convert a PIL Image to a base64 data URL."""
    buffer = BytesIO()
    image.save(buffer, format=format)
    b64_data = base64.b64encode(buffer.getvalue()).decode("utf-8")
    mime_type = f"image/{format.lower()}"
    return f"data:{mime_type};base64,{b64_data}"


def base64_to_image(data_url: str) -> Image.Image:
    """Convert a base64 data URL to a PIL Image."""
    # Handle data URL format
    if "," in data_url:
        data_url = data_url.split(",", 1)[1]
    image_data = base64.b64decode(data_url)
    return Image.open(BytesIO(image_data))


def create_mask(
    width: int,
    height: int,
    unlocked_regions: list[tuple[int, int, int, int]],
) -> Image.Image:
    """
    Create a mask image for inpainting.

    Args:
        width: Image width in pixels
        height: Image height in pixels
        unlocked_regions: List of (x, y, w, h) regions to mask (white)

    Returns:
        Grayscale mask image (white = regenerate, black = preserve)
    """
    mask = Image.new("L", (width, height), 0)
    mask_array = np.array(mask)

    for x, y, w, h in unlocked_regions:
        mask_array[y : y + h, x : x + w] = 255

    return Image.fromarray(mask_array)


def extract_edge_pixels(
    image: Image.Image,
    edge_x: int,
    edge_y: int,
    edge_width: int,
    edge_height: int,
) -> np.ndarray:
    """
    Extract pixel data from an edge region.

    Args:
        image: Source image
        edge_x: X position of edge
        edge_y: Y position of edge
        edge_width: Width of edge strip
        edge_height: Height of edge strip

    Returns:
        NumPy array of pixel data
    """
    image_array = np.array(image)
    return image_array[edge_y : edge_y + edge_height, edge_x : edge_x + edge_width].copy()


def replace_transparent_color(
    image: Image.Image,
    transparent_color: tuple[int, int, int] = (255, 0, 255),
) -> Image.Image:
    """
    Replace a transparent color convention with actual alpha transparency.

    Args:
        image: Source image (RGB or RGBA)
        transparent_color: The color to treat as transparent (default: magenta)

    Returns:
        RGBA image with transparency applied
    """
    # Convert to RGBA if needed
    if image.mode != "RGBA":
        image = image.convert("RGBA")

    image_array = np.array(image)

    # Find pixels matching the transparent color
    matches = (
        (image_array[:, :, 0] == transparent_color[0])
        & (image_array[:, :, 1] == transparent_color[1])
        & (image_array[:, :, 2] == transparent_color[2])
    )

    # Set alpha to 0 for matching pixels
    image_array[matches, 3] = 0

    return Image.fromarray(image_array)
