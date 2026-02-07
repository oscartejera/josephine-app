"""
Josephine Forecast API Server
==============================
FastAPI service that exposes Prophet forecasting via HTTP.

Endpoints:
  POST /forecast              — Run forecast for one or all locations
  POST /forecast/{location_id} — Run forecast for a specific location
  GET  /health                — Health check
  GET  /status                — Last forecast run status per location

Deploy on Railway, Fly.io, Render, or any Docker host.
The Supabase Edge Function calls this service to trigger forecasts.
"""

import os
import logging
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from prophet_forecast import run_forecast

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("josephine.api")

app = FastAPI(
    title="Josephine Forecast Service",
    description="Prophet-based sales forecasting for restaurant management",
    version="5.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# State — track running forecasts
# ---------------------------------------------------------------------------

_running: dict[str, bool] = {}  # location_id → is_running
_last_results: dict[str, dict] = {}  # location_id → last result


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class ForecastRequest(BaseModel):
    location_id: Optional[str] = None
    horizon_days: int = 90


class ForecastResponse(BaseModel):
    status: str
    message: str
    results: Optional[list] = None


# ---------------------------------------------------------------------------
# Background task runner
# ---------------------------------------------------------------------------

def _run_forecast_bg(location_id: Optional[str], horizon_days: int):
    """Run forecast in background thread."""
    import prophet_forecast
    prophet_forecast.HORIZON_DAYS = horizon_days

    key = location_id or "all"
    _running[key] = True

    try:
        results = run_forecast(location_id=location_id)
        for r in results:
            _last_results[r["location_id"]] = {
                **r,
                "completed_at": datetime.utcnow().isoformat(),
            }
        _running[key] = False
        logger.info(f"Forecast completed: {len(results)} locations processed")
    except Exception as e:
        logger.error(f"Forecast failed: {e}")
        _running[key] = False
        raise


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok", "service": "josephine-forecast", "version": "5.0.0"}


@app.get("/status")
def status():
    """Return last forecast run status for all locations."""
    return {
        "running": {k: v for k, v in _running.items() if v},
        "last_results": _last_results,
    }


@app.post("/forecast", response_model=ForecastResponse)
def trigger_forecast(req: ForecastRequest, background_tasks: BackgroundTasks):
    """
    Trigger forecast generation.
    Runs in background to avoid HTTP timeout (Prophet training takes time).
    """
    key = req.location_id or "all"

    if _running.get(key):
        return ForecastResponse(
            status="already_running",
            message=f"Forecast for '{key}' is already in progress",
        )

    background_tasks.add_task(_run_forecast_bg, req.location_id, req.horizon_days)

    return ForecastResponse(
        status="started",
        message=f"Forecast started for {'location ' + req.location_id if req.location_id else 'all locations'}. "
                f"Horizon: {req.horizon_days} days. Check /status for progress.",
    )


@app.post("/forecast/sync", response_model=ForecastResponse)
def trigger_forecast_sync(req: ForecastRequest):
    """
    Trigger forecast generation synchronously (blocks until complete).
    Use for cron jobs or when you need immediate results.
    """
    import prophet_forecast
    prophet_forecast.HORIZON_DAYS = req.horizon_days

    try:
        results = run_forecast(location_id=req.location_id)
        for r in results:
            _last_results[r["location_id"]] = {
                **r,
                "completed_at": datetime.utcnow().isoformat(),
            }
        return ForecastResponse(
            status="completed",
            message=f"Forecast completed for {len(results)} locations",
            results=results,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/forecast/{location_id}")
def trigger_location_forecast(location_id: str, background_tasks: BackgroundTasks):
    """Trigger forecast for a specific location (background)."""
    if _running.get(location_id):
        return {"status": "already_running", "location_id": location_id}

    background_tasks.add_task(_run_forecast_bg, location_id, 90)
    return {"status": "started", "location_id": location_id}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
