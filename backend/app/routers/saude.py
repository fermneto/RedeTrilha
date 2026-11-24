from fastapi import APIRouter

router = APIRouter(tags=["saúde"])


@router.get("/saude")
def saude() -> dict:
    """Health check do Render (render.yaml): responde sem tocar no banco."""
    return {"ok": True}
