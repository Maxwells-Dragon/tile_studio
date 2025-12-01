"""Health check endpoints."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check() -> dict[str, str]:
    """Check if the service is healthy."""
    return {"status": "healthy"}


@router.get("/")
async def root() -> dict[str, str]:
    """Root endpoint."""
    return {
        "service": "Tile Studio API",
        "version": "0.1.0",
        "docs": "/docs",
    }
