"""
Josephine Prophet Service - Real Facebook Prophet Forecasting API

Deploys on: Google Cloud Run, AWS Lambda, Modal Labs, or any Docker host.
Called by: Supabase Edge Function generate_forecast_v5
"""

import os
import logging
from datetime import datetime, timedelta
from typing import Optional

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from prophet import Prophet

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("prophet-service")

app = FastAPI(title="Josephine Prophet Service", version="5.0.0")

ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "https://*.supabase.co,https://*.josephine.app,http://localhost:*"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)

API_KEY = os.getenv("PROPHET_API_KEY", "")


# ─── Request / Response Models ────────────────────────────────────────────────

class RegressorRow(BaseModel):
    ds: str
    festivo: float = 0
    day_before_festivo: float = 0
    evento_impact: float = 1.0
    payday: float = 0
    temperatura: float = 18.0
    rain: float = 0
    cold_day: float = 0
    weekend: float = 0
    mid_week: float = 0


class ForecastRequest(BaseModel):
    historical: list[dict]          # [{ds, y, ...regressors}]
    horizon_days: int = 90
    future_regressors: list[dict]   # [{ds, ...regressors}] for forecast period
    location_id: str = ""
    location_name: str = ""
    freq: str = "D"
    yearly_seasonality: bool = True
    weekly_seasonality: bool = True
    daily_seasonality: bool = False
    seasonality_mode: str = "multiplicative"
    changepoint_prior_scale: float = 0.05
    seasonality_prior_scale: float = 10.0
    include_regressors: bool = True


class ForecastPoint(BaseModel):
    ds: str
    yhat: float
    yhat_lower: float
    yhat_upper: float
    trend: float
    weekly: Optional[float] = None
    yearly: Optional[float] = None
    regressor_total: float = 0.0
    explanation: str = ""


class ModelMetrics(BaseModel):
    mape: float
    rmse: float
    mae: float
    r_squared: float
    data_points: int
    changepoints: int
    trend_slope_avg: float


class ForecastResponse(BaseModel):
    success: bool
    model_version: str
    location_id: str
    location_name: str
    metrics: ModelMetrics
    forecast: list[ForecastPoint]
    components: dict


# ─── Regressor Names ──────────────────────────────────────────────────────────

REGRESSOR_NAMES = [
    "festivo", "day_before_festivo", "evento_impact",
    "payday", "temperatura", "rain", "cold_day",
    "weekend", "mid_week",
]


# ─── Helpers ──────────────────────────────────────────────────────────────────

def build_explanation(row: pd.Series, base_forecast: float) -> str:
    """Generate a human-readable explanation of what factors are affecting
    the forecast for a given day."""
    parts: list[str] = []

    if row.get("rain", 0) == 1:
        parts.append("lluvia (-25%)")
    if row.get("festivo", 0) == 1:
        parts.append("festivo (-20%)")
    if row.get("evento_impact", 1.0) > 1.1:
        pct = (row["evento_impact"] - 1) * 100
        parts.append(f"evento (+{pct:.0f}%)")
    if row.get("day_before_festivo", 0) == 1:
        parts.append("pre-festivo (+10%)")
    if row.get("payday", 0) == 1:
        parts.append("dia de pago (+5%)")
    if row.get("temperatura", 18) < 10:
        parts.append("frio (-15%)")
    if row.get("temperatura", 18) > 30:
        parts.append("mucho calor (-10%)")

    yhat = row.get("yhat", base_forecast)
    if not parts:
        return f"Base forecast: EUR{base_forecast:.0f}"

    delta = ((yhat / base_forecast) - 1) * 100 if base_forecast > 0 else 0
    sign = "+" if delta >= 0 else ""
    return (
        f"Base EUR{base_forecast:.0f} {sign}{delta:.1f}% "
        f"({', '.join(parts)}) = EUR{yhat:.0f}"
    )


def calculate_cv_metrics(model: Prophet, df: pd.DataFrame) -> dict:
    """Calculate cross-validation metrics using the last 20% of data as
    a hold-out set instead of running full Prophet cross-validation
    (which is slow for an API call)."""
    n = len(df)
    split = max(int(n * 0.8), n - 90)  # last 20% or up to 90 days
    train = df.iloc[:split].copy()
    test = df.iloc[split:].copy()

    if len(test) < 7:
        return {"mape": 0, "rmse": 0, "mae": 0, "r_squared": 0}

    m = Prophet(
        yearly_seasonality=model.yearly_seasonality,
        weekly_seasonality=model.weekly_seasonality,
        daily_seasonality=model.daily_seasonality,
        seasonality_mode=model.seasonality_mode,
        changepoint_prior_scale=model.changepoint_prior_scale,
        seasonality_prior_scale=model.seasonality_prior_scale,
    )

    for reg in REGRESSOR_NAMES:
        if reg in train.columns:
            m.add_regressor(reg, mode="multiplicative" if reg == "evento_impact" else "additive")

    m.fit(train)

    future = test[["ds"] + [r for r in REGRESSOR_NAMES if r in test.columns]].copy()
    pred = m.predict(future)

    actual = test["y"].values
    predicted = pred["yhat"].values

    mask = actual > 0
    if mask.sum() == 0:
        return {"mape": 0, "rmse": 0, "mae": 0, "r_squared": 0}

    mape = float(np.mean(np.abs((actual[mask] - predicted[mask]) / actual[mask])))
    rmse = float(np.sqrt(np.mean((actual - predicted) ** 2)))
    mae = float(np.mean(np.abs(actual - predicted)))

    ss_res = np.sum((actual - predicted) ** 2)
    ss_tot = np.sum((actual - np.mean(actual)) ** 2)
    r_squared = float(1 - (ss_res / ss_tot)) if ss_tot > 0 else 0

    return {"mape": mape, "rmse": rmse, "mae": mae, "r_squared": max(0, r_squared)}


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "version": "5.0.0", "engine": "prophet"}


@app.post("/forecast", response_model=ForecastResponse)
async def forecast(req: ForecastRequest, authorization: str = Header(default="")):
    # Auth check
    if API_KEY and not authorization.endswith(API_KEY):
        raise HTTPException(status_code=401, detail="Invalid API key")

    if len(req.historical) < 14:
        raise HTTPException(
            status_code=400,
            detail=f"Need at least 14 days of history, got {len(req.historical)}",
        )

    logger.info(
        "Forecast request: location=%s, history=%d days, horizon=%d days, regressors=%s",
        req.location_name or req.location_id,
        len(req.historical),
        req.horizon_days,
        req.include_regressors,
    )

    # ── Build historical DataFrame ────────────────────────────────────────
    df = pd.DataFrame(req.historical)
    df["ds"] = pd.to_datetime(df["ds"])
    df["y"] = pd.to_numeric(df["y"], errors="coerce").fillna(0)

    # Ensure non-negative sales
    df["y"] = df["y"].clip(lower=0)

    # Sort and deduplicate
    df = df.sort_values("ds").drop_duplicates(subset="ds", keep="last").reset_index(drop=True)

    # ── Configure Prophet ─────────────────────────────────────────────────
    model = Prophet(
        yearly_seasonality=req.yearly_seasonality,
        weekly_seasonality=req.weekly_seasonality,
        daily_seasonality=req.daily_seasonality,
        seasonality_mode=req.seasonality_mode,
        changepoint_prior_scale=req.changepoint_prior_scale,
        seasonality_prior_scale=req.seasonality_prior_scale,
        interval_width=0.95,
    )

    # Add custom Spanish seasonality
    model.add_seasonality(
        name="monthly",
        period=30.5,
        fourier_order=5,
    )

    # Add regressors
    if req.include_regressors:
        for reg_name in REGRESSOR_NAMES:
            if reg_name in df.columns:
                mode = "multiplicative" if reg_name == "evento_impact" else "additive"
                model.add_regressor(reg_name, mode=mode)

    # ── Fit model ─────────────────────────────────────────────────────────
    logger.info("Fitting Prophet model with %d data points...", len(df))
    import logging as _logging
    _logging.getLogger('cmdstanpy').setLevel(_logging.WARNING)
    model.fit(df)
    logger.info("Model fitted successfully")

    # ── Build future DataFrame ────────────────────────────────────────────
    future = model.make_future_dataframe(periods=req.horizon_days, freq=req.freq)

    # Merge regressors into future
    if req.include_regressors and req.future_regressors:
        future_reg_df = pd.DataFrame(req.future_regressors)
        future_reg_df["ds"] = pd.to_datetime(future_reg_df["ds"])

        for reg_name in REGRESSOR_NAMES:
            if reg_name in df.columns:
                # Build a combined regressor series from history + future
                hist_reg = df[["ds", reg_name]].copy()
                fut_reg = future_reg_df[["ds", reg_name]].copy() if reg_name in future_reg_df.columns else pd.DataFrame()

                combined = pd.concat([hist_reg, fut_reg]).drop_duplicates(subset="ds", keep="last")
                future = future.merge(combined, on="ds", how="left")

                # Fill any gaps
                if reg_name == "evento_impact":
                    future[reg_name] = future[reg_name].fillna(1.0)
                elif reg_name == "temperatura":
                    future[reg_name] = future[reg_name].fillna(18.0)
                else:
                    future[reg_name] = future[reg_name].fillna(0)

    # ── Predict ───────────────────────────────────────────────────────────
    logger.info("Generating predictions for %d total periods...", len(future))
    pred = model.predict(future)

    # ── Cross-validation metrics ──────────────────────────────────────────
    cv_metrics = calculate_cv_metrics(model, df)
    logger.info("CV metrics: MAPE=%.2f%%, R²=%.3f", cv_metrics["mape"] * 100, cv_metrics["r_squared"])

    # ── Build trend slope ─────────────────────────────────────────────────
    trend_vals = pred["trend"].values
    trend_slope_avg = float(np.mean(np.diff(trend_vals))) if len(trend_vals) > 1 else 0

    # ── Extract forecast-only rows ────────────────────────────────────────
    last_historical_date = df["ds"].max()
    forecast_mask = pred["ds"] > last_historical_date
    forecast_df = pred[forecast_mask].copy()

    # Merge future regressors for explanations
    if req.include_regressors and req.future_regressors:
        future_reg_df2 = pd.DataFrame(req.future_regressors)
        future_reg_df2["ds"] = pd.to_datetime(future_reg_df2["ds"])
        forecast_df = forecast_df.merge(future_reg_df2, on="ds", how="left", suffixes=("", "_reg"))

    # Compute trend-only baseline for explanations
    trend_only = forecast_df["trend"].values if "trend" in forecast_df.columns else forecast_df["yhat"].values

    forecast_points: list[ForecastPoint] = []
    for i, (_, row) in enumerate(forecast_df.iterrows()):
        base = float(trend_only[i]) if i < len(trend_only) else float(row["yhat"])

        # Compute total regressor effect
        reg_total = 0.0
        for reg_name in REGRESSOR_NAMES:
            col = f"{reg_name}" if f"{reg_name}" in row.index else None
            extra_col = f"extra_regressors_{reg_name}" in str(row.index)
            if col and not pd.isna(row.get(col, np.nan)):
                pass  # regressor value exists
            reg_effect_col = reg_name
            if reg_effect_col in row.index:
                val = row[reg_effect_col]
                if isinstance(val, (int, float)) and not pd.isna(val):
                    reg_total += val

        explanation = build_explanation(row, base)

        forecast_points.append(
            ForecastPoint(
                ds=row["ds"].strftime("%Y-%m-%d"),
                yhat=max(0, round(float(row["yhat"]), 2)),
                yhat_lower=max(0, round(float(row["yhat_lower"]), 2)),
                yhat_upper=max(0, round(float(row["yhat_upper"]), 2)),
                trend=round(float(row.get("trend", 0)), 2),
                weekly=round(float(row.get("weekly", 0)), 2) if "weekly" in row.index else None,
                yearly=round(float(row.get("yearly", 0)), 2) if "yearly" in row.index else None,
                regressor_total=round(reg_total, 4),
                explanation=explanation,
            )
        )

    # ── Components summary ────────────────────────────────────────────────
    components = {
        "trend": "linear" if trend_slope_avg > 0 else "declining",
        "trend_slope_per_day": round(trend_slope_avg, 2),
        "seasonalities": [],
        "regressors": [],
    }
    if req.yearly_seasonality:
        components["seasonalities"].append("yearly")
    if req.weekly_seasonality:
        components["seasonalities"].append("weekly")
    components["seasonalities"].append("monthly (custom, period=30.5)")
    if req.include_regressors:
        components["regressors"] = [r for r in REGRESSOR_NAMES if r in df.columns]

    metrics = ModelMetrics(
        mape=round(cv_metrics["mape"], 4),
        rmse=round(cv_metrics["rmse"], 2),
        mae=round(cv_metrics["mae"], 2),
        r_squared=round(cv_metrics["r_squared"], 4),
        data_points=len(df),
        changepoints=len(model.changepoints) if hasattr(model, "changepoints") else 0,
        trend_slope_avg=round(trend_slope_avg, 4),
    )

    logger.info(
        "Forecast complete: %d points, MAPE=%.1f%%, R²=%.3f",
        len(forecast_points),
        metrics.mape * 100,
        metrics.r_squared,
    )

    return ForecastResponse(
        success=True,
        model_version="Prophet_v5_Real_ML",
        location_id=req.location_id,
        location_name=req.location_name,
        metrics=metrics,
        forecast=forecast_points,
        components=components,
    )


@app.post("/batch_forecast")
async def batch_forecast(
    locations: list[ForecastRequest],
    authorization: str = Header(default=""),
):
    """Forecast multiple locations in a single request."""
    if API_KEY and not authorization.endswith(API_KEY):
        raise HTTPException(status_code=401, detail="Invalid API key")

    results = []
    for loc_req in locations:
        try:
            result = await forecast(loc_req, authorization=authorization)
            results.append(result.model_dump())
        except HTTPException as e:
            results.append({
                "success": False,
                "location_id": loc_req.location_id,
                "location_name": loc_req.location_name,
                "error": e.detail,
            })
        except Exception as e:
            results.append({
                "success": False,
                "location_id": loc_req.location_id,
                "location_name": loc_req.location_name,
                "error": str(e),
            })

    return {
        "success": True,
        "total": len(results),
        "successful": sum(1 for r in results if r.get("success")),
        "results": results,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8080")))
