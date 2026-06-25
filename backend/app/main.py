from fastapi import FastAPI

from backend.app.api import matches, model_configs, predictions, prematch, teams


def create_app() -> FastAPI:
    app = FastAPI(title="Football Analysis Agent API", version="0.1.0")
    app.include_router(matches.router, prefix="/api", tags=["matches"])
    app.include_router(predictions.router, prefix="/api", tags=["predictions"])
    app.include_router(prematch.router, prefix="/api", tags=["prematch"])
    app.include_router(teams.router, prefix="/api", tags=["teams"])
    app.include_router(model_configs.router, prefix="/api", tags=["model-configs"])

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"ok": "true", "service": "fastapi"}

    return app


app = create_app()

