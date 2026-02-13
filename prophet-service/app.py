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
    mase: float = 0.0
    r_squared: float
    directional_accuracy: float = 0.0
    forecast_bias: float = 0.0
    data_points: int
    changepoints: int
    trend_slope_avg: float
    cv_stability: float = 0.0


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
    """Expanding window cross-validation with comprehensive time series metrics.

    Instead of a single holdout, uses 3 expanding windows to assess stability:
      Fold 1: train[0..60%] → test[60%..73%]
      Fold 2: train[0..73%] → test[73%..87%]
      Fold 3: train[0..87%] → test[87%..100%]

    Returns aggregated metrics including MASE, directional accuracy, and bias.
    """
    import logging as _logging
    _logging.getLogger('cmdstanpy').setLevel(_logging.WARNING)

    n = len(df)
    if n < 30:
        return {
            "mape": 0, "rmse": 0, "mae": 0, "mase": 0, "r_squared": 0,
            "directional_accuracy": 0, "forecast_bias": 0, "cv_stability": 0,
        }

    fold_results = []
    n_folds = 3
    min_train_pct = 0.5
    test_pct = (1.0 - min_train_pct) / n_folds

    for i in range(n_folds):
        train_end = max(30, int(n * (min_train_pct + i * test_pct)))
        test_end = min(n, int(n * (min_train_pct + (i + 1) * test_pct)))

        if train_end >= n or test_end - train_end < 7:
            continue

        train = df.iloc[:train_end].copy()
        test = df.iloc[train_end:test_end].copy()

        try:
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

            if mask.sum() < 3:
                continue

            fold_mape = float(np.mean(np.abs((actual[mask] - predicted[mask]) / actual[mask])))
            fold_rmse = float(np.sqrt(np.mean((actual - predicted) ** 2)))
            fold_mae = float(np.mean(np.abs(actual - predicted)))
            fold_bias = float(np.mean(actual - predicted))

            # MASE: compare MAE to naive forecast MAE (y_{t-1})
            naive_errors = np.abs(np.diff(train["y"].values))
            naive_mae = float(np.mean(naive_errors)) if len(naive_errors) > 0 else 1.0
            fold_mase = fold_mae / naive_mae if naive_mae > 0 else 0.0

            # Directional accuracy
            if len(actual) > 1:
                actual_dir = np.diff(actual)
                pred_dir = np.diff(predicted)
                correct = np.sum((actual_dir >= 0) == (pred_dir >= 0))
                fold_dir_acc = float(correct / len(actual_dir))
            else:
                fold_dir_acc = 0.0

            # R-squared
            ss_res = np.sum((actual - predicted) ** 2)
            ss_tot = np.sum((actual - np.mean(actual)) ** 2)
            fold_r2 = max(0.0, float(1 - ss_res / ss_tot)) if ss_tot > 0 else 0.0

            fold_results.append({
                "mape": fold_mape, "rmse": fold_rmse, "mae": fold_mae,
                "mase": fold_mase, "r_squared": fold_r2,
                "directional_accuracy": fold_dir_acc,
                "forecast_bias": fold_bias,
            })
        except Exception as e:
            logger.warning("CV fold %d failed: %s", i + 1, str(e))
            continue

    if not fold_results:
        return {
            "mape": 0, "rmse": 0, "mae": 0, "mase": 0, "r_squared": 0,
            "directional_accuracy": 0, "forecast_bias": 0, "cv_stability": 0,
        }

    # Aggregate across folds
    agg = {}
    for key in fold_results[0]:
        values = [f[key] for f in fold_results]
        agg[key] = float(np.mean(values))

    # CV stability: coefficient of variation of MAPE across folds
    mapes = [f["mape"] for f in fold_results]
    mape_mean = np.mean(mapes)
    mape_std = np.std(mapes)
    agg["cv_stability"] = float(mape_std / mape_mean) if mape_mean > 0 else 0.0

    logger.info(
        "CV (%d folds): MAPE=%.1f%% MASE=%.3f DirAcc=%.0f%% Bias=%.0f Stability=%.3f",
        len(fold_results), agg["mape"] * 100, agg["mase"],
        agg["directional_accuracy"] * 100, agg["forecast_bias"], agg["cv_stability"],
    )

    return agg


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
    logger.info(
        "CV metrics: MAPE=%.1f%% MASE=%.3f DirAcc=%.0f%% R²=%.3f Bias=%.0f Stability=%.3f",
        cv_metrics["mape"] * 100, cv_metrics.get("mase", 0),
        cv_metrics.get("directional_accuracy", 0) * 100,
        cv_metrics["r_squared"], cv_metrics.get("forecast_bias", 0),
        cv_metrics.get("cv_stability", 0),
    )

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
        mase=round(cv_metrics.get("mase", 0), 4),
        r_squared=round(cv_metrics["r_squared"], 4),
        directional_accuracy=round(cv_metrics.get("directional_accuracy", 0), 4),
        forecast_bias=round(cv_metrics.get("forecast_bias", 0), 2),
        data_points=len(df),
        changepoints=len(model.changepoints) if hasattr(model, "changepoints") else 0,
        trend_slope_avg=round(trend_slope_avg, 4),
        cv_stability=round(cv_metrics.get("cv_stability", 0), 4),
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


@app.post("/forecast_supabase")
async def forecast_supabase(req: dict, authorization: str = Header(default="")):
    """Full pipeline: fetch from Supabase, run Prophet, store results.
    Designed to be called by Edge Functions that can't handle 60s timeout."""
    import httpx

    if API_KEY and not authorization.endswith(API_KEY):
        raise HTTPException(status_code=401, detail="Invalid API key")

    supabase_url = req.get("supabase_url")
    supabase_key = req.get("supabase_key")
    location_id = req.get("location_id", "")
    location_name = req.get("location_name", "")
    horizon_days = req.get("horizon_days", 90)
    seasonality_mode = req.get("seasonality_mode", "multiplicative")
    changepoint_prior_scale = req.get("changepoint_prior_scale", 0.05)

    if not supabase_url or not supabase_key:
        raise HTTPException(status_code=400, detail="supabase_url and supabase_key required")

    logger.info("forecast_supabase: location=%s, horizon=%d", location_name or location_id, horizon_days)

    # ── Fetch sales data (paginated at 1000 rows) ────────────────────
    headers_sb = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
    }
    sales_data = []
    page = 0
    async with httpx.AsyncClient(timeout=30) as client:
        while True:
            url = (
                f"{supabase_url}/rest/v1/facts_sales_15m"
                f"?location_id=eq.{location_id}"
                f"&select=ts_bucket,sales_net"
                f"&order=ts_bucket.asc"
            )
            resp = await client.get(
                url,
                headers={**headers_sb, "Range": f"{page*1000}-{(page+1)*1000-1}"},
            )
            resp.raise_for_status()
            rows = resp.json()
            if not rows:
                break
            sales_data.extend(rows)
            page += 1
            if len(rows) < 1000:
                break

    logger.info("Fetched %d sales records in %d pages", len(sales_data), page)

    if len(sales_data) == 0:
        raise HTTPException(status_code=400, detail="No sales data found for this location")

    # ── Aggregate to daily ────────────────────────────────────────────
    daily: dict[str, float] = {}
    for s in sales_data:
        date_str = s["ts_bucket"][:10]
        daily[date_str] = daily.get(date_str, 0) + float(s.get("sales_net") or 0)

    dates = sorted(daily.keys())
    logger.info("Aggregated to %d days: %s to %s", len(dates), dates[0], dates[-1])

    if len(dates) < 14:
        raise HTTPException(status_code=400, detail=f"Need 14+ days, got {len(dates)}")

    # ── Build regressors ──────────────────────────────────────────────
    HOLIDAYS = {
        "2025-01-01","2025-01-06","2025-04-18","2025-04-21","2025-05-01",
        "2025-05-02","2025-05-15","2025-08-15","2025-10-12","2025-11-01",
        "2025-11-09","2025-12-06","2025-12-08","2025-12-25","2025-12-26",
        "2026-01-01","2026-01-06","2026-02-09","2026-04-03","2026-04-06",
        "2026-05-01","2026-08-15","2026-10-12","2026-11-01","2026-12-06",
        "2026-12-08","2026-12-25",
    }
    EVENTS = {
        "2025-03-15":0.3,"2025-04-20":0.3,"2025-05-15":0.25,
        "2025-07-10":0.4,"2025-07-11":0.4,"2025-07-12":0.4,
        "2025-09-20":0.3,"2025-10-25":0.3,"2025-12-31":0.35,
    }
    MONTH_TEMPS = {1:6,2:8,3:12,4:14,5:19,6:25,7:30,8:29,9:23,10:16,11:10,12:7}

    def build_regs(ds: str) -> dict:
        from datetime import date as ddate
        d = ddate.fromisoformat(ds)
        dow = d.weekday()  # 0=Mon
        m = d.month
        dy = d.day
        nd = (d + timedelta(days=1)).isoformat()
        temp = MONTH_TEMPS.get(m, 15)
        return {
            "festivo": int(ds in HOLIDAYS),
            "day_before_festivo": int(nd in HOLIDAYS),
            "evento_impact": EVENTS.get(ds, 0),
            "payday": int(dy == 1 or dy == 15 or dy >= 25),
            "temperatura": temp,
            "rain": int(m in (3, 4, 10, 11)),
            "cold_day": int(temp < 10),
            "weekend": int(dow >= 5),
            "mid_week": int(dow in (1, 2)),
        }

    historical = [{"ds": d, "y": round(daily[d], 2), **build_regs(d)} for d in dates]
    today = datetime.utcnow().date()
    future_regressors = [
        {"ds": (today + timedelta(days=k)).isoformat(), **build_regs((today + timedelta(days=k)).isoformat())}
        for k in range(1, horizon_days + 1)
    ]

    # ── Call the existing forecast logic ──────────────────────────────
    forecast_req = ForecastRequest(
        historical=historical,
        horizon_days=horizon_days,
        future_regressors=future_regressors,
        location_id=location_id,
        location_name=location_name,
        freq="D",
        yearly_seasonality=len(dates) >= 365,
        weekly_seasonality=True,
        daily_seasonality=False,
        seasonality_mode=seasonality_mode,
        changepoint_prior_scale=changepoint_prior_scale,
        include_regressors=True,
    )

    result = await forecast(forecast_req, authorization=authorization)

    # ── Store forecasts in Supabase ───────────────────────────────────
    TARGET_COL_PERCENT = 28
    AVG_HOURLY_RATE = 14.5
    today_str = today.isoformat()

    forecasts_to_store = []
    for f in result.forecast:
        target_labour = f.yhat * (TARGET_COL_PERCENT / 100)
        planned_hours = max(20, min(120, target_labour / AVG_HOURLY_RATE))
        forecasts_to_store.append({
            "location_id": location_id,
            "date": f.ds,
            "forecast_sales": f.yhat,
            "forecast_sales_lower": f.yhat_lower,
            "forecast_sales_upper": f.yhat_upper,
            "planned_labor_hours": round(planned_hours, 1),
            "planned_labor_cost": round(target_labour, 2),
            "model_version": "Prophet_v5_Real_ML",
            "confidence": round(result.metrics.r_squared * 100),
            "mape": result.metrics.mape,
            "mse": result.metrics.rmse ** 2,
            "explanation": f.explanation,
            "generated_at": datetime.utcnow().isoformat(),
        })

    async with httpx.AsyncClient(timeout=30) as client:
        # Delete old forecasts
        await client.delete(
            f"{supabase_url}/rest/v1/forecast_daily_metrics"
            f"?location_id=eq.{location_id}&date=gte.{today_str}",
            headers={**headers_sb, "Prefer": "return=minimal"},
        )

        # Insert in batches
        for i in range(0, len(forecasts_to_store), 500):
            batch = forecasts_to_store[i:i + 500]
            resp = await client.post(
                f"{supabase_url}/rest/v1/forecast_daily_metrics",
                headers={**headers_sb, "Content-Type": "application/json", "Prefer": "return=minimal"},
                json=batch,
            )
            if resp.status_code >= 400:
                logger.error("Insert error: %s", resp.text[:200])

        # Log model run
        await client.post(
            f"{supabase_url}/rest/v1/forecast_model_runs",
            headers={**headers_sb, "Content-Type": "application/json", "Prefer": "return=minimal"},
            json={
                "location_id": location_id,
                "model_version": "Prophet_v5_Real_ML",
                "algorithm": "Facebook_Prophet_ML",
                "history_start": dates[0],
                "history_end": dates[-1],
                "horizon_days": horizon_days,
                "mse": result.metrics.rmse ** 2,
                "mape": result.metrics.mape,
                "confidence": round(result.metrics.r_squared * 100),
                "data_points": len(dates),
                "trend_slope": result.metrics.trend_slope_avg,
            },
        )

    logger.info("Stored %d forecasts for %s", len(forecasts_to_store), location_name)

    return {
        "success": True,
        "location_id": location_id,
        "location_name": location_name,
        "data_points": len(dates),
        "forecasts_stored": len(forecasts_to_store),
        "metrics": {
            "mape": f"{result.metrics.mape * 100:.1f}%",
            "rmse": f"EUR {result.metrics.rmse:.0f}",
            "mae": f"EUR {result.metrics.mae:.0f}",
            "mase": f"{result.metrics.mase:.3f}",
            "r_squared": f"{result.metrics.r_squared:.3f}",
            "directional_accuracy": f"{result.metrics.directional_accuracy * 100:.0f}%",
            "forecast_bias": f"EUR {result.metrics.forecast_bias:.0f}",
            "cv_stability": f"{result.metrics.cv_stability:.3f}",
        },
        "sample_forecast": [
            {"date": f.ds, "forecast": f.yhat, "lower": f.yhat_lower, "upper": f.yhat_upper}
            for f in result.forecast[:7]
        ],
    }


@app.post("/forecast_hourly")
async def forecast_hourly(req: dict, authorization: str = Header(default="")):
    """Hourly forecast pipeline with champion/challenger per bucket.

    1. Fetch facts_sales_15m → aggregate to hourly
    2. Train LightGBM (global) + Seasonal Naive (baseline)
    3. Evaluate per bucket (DOW × HOUR) → model registry
    4. Predict future hours using registry winners
    5. Store: forecast_hourly_metrics + forecast_daily_metrics (backwards compat)
    6. Store: forecast_model_registry + forecast_model_runs (audit)
    """
    import httpx
    from hourly_forecaster import HourlyForecaster

    if API_KEY and not authorization.endswith(API_KEY):
        raise HTTPException(status_code=401, detail="Invalid API key")

    supabase_url = req.get("supabase_url")
    supabase_key = req.get("supabase_key")
    location_id = req.get("location_id", "")
    location_name = req.get("location_name", "")
    horizon_days = req.get("horizon_days", 14)
    req_data_source = req.get("data_source")  # 'demo' | 'pos' | None
    req_org_id = req.get("org_id")            # uuid string | None

    if not supabase_url or not supabase_key:
        raise HTTPException(status_code=400, detail="supabase_url and supabase_key required")

    logger.info(
        "forecast_hourly: location=%s, horizon=%d days, ds=%s",
        location_name or location_id, horizon_days, req_data_source,
    )

    # ── Resolve data_source ──────────────────────────────────────────
    headers_sb = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
    }
    ds = req_data_source  # may be None
    if not ds and req_org_id:
        # Call resolve_data_source RPC
        try:
            import httpx as _httpx
            async with _httpx.AsyncClient(timeout=10) as _client:
                rpc_resp = await _client.post(
                    f"{supabase_url}/rest/v1/rpc/resolve_data_source",
                    headers={**headers_sb, "Content-Type": "application/json"},
                    json={"p_org_id": req_org_id},
                )
                if rpc_resp.status_code == 200:
                    ds = rpc_resp.json().get("data_source", "demo")
                else:
                    logger.warning("resolve_data_source RPC failed: %s", rpc_resp.text[:200])
                    ds = "demo"
        except Exception as e:
            logger.warning("resolve_data_source failed, defaulting to demo: %s", e)
            ds = "demo"
    if not ds:
        ds = "demo"
    logger.info("Resolved data_source=%s for location=%s", ds, location_name or location_id)

    # ── Fetch location_hours (open/close/prep) ────────────────────
    location_hours = {
        "tz": "Europe/Madrid",
        "open_time": "12:00",
        "close_time": "23:00",
        "prep_start": "09:00",
        "prep_end": "12:00",
    }
    try:
        import httpx as _httpx
        async with _httpx.AsyncClient(timeout=10) as _client:
            lh_resp = await _client.get(
                f"{supabase_url}/rest/v1/location_hours"
                f"?location_id=eq.{location_id}"
                f"&select=tz,open_time,close_time,prep_start,prep_end",
                headers=headers_sb,
            )
            if lh_resp.status_code == 200:
                rows = lh_resp.json()
                if rows:
                    location_hours = rows[0]
                    logger.info("Fetched location_hours: %s", location_hours)
    except Exception as e:
        logger.warning("Failed to fetch location_hours, using defaults: %s", e)

    # Parse hours as integers for mask
    def _parse_time_hour(t: str) -> int:
        """Extract hour from 'HH:MM' or 'HH:MM:SS' string."""
        return int(t.split(":")[0])

    open_hour = _parse_time_hour(location_hours.get("open_time", "12:00"))
    close_hour = _parse_time_hour(location_hours.get("close_time", "23:00"))
    prep_start_hour = _parse_time_hour(location_hours.get("prep_start", "09:00"))
    prep_end_hour = _parse_time_hour(location_hours.get("prep_end", "12:00"))

    def is_service_hour(hour: int) -> bool:
        """True if hour is within open service window [open, close)."""
        if open_hour <= close_hour:
            return open_hour <= hour < close_hour
        # Wraps midnight (e.g. 20:00 - 02:00)
        return hour >= open_hour or hour < close_hour

    def is_prep_hour(hour: int) -> bool:
        """True if hour is within prep window [prep_start, prep_end)."""
        return prep_start_hour <= hour < prep_end_hour

    logger.info(
        "Open hours mask: service=[%d,%d), prep=[%d,%d)",
        open_hour, close_hour, prep_start_hour, prep_end_hour,
    )

    # ── Fetch facts_sales_15m (paginated) ────────────────────────────
    sales_data = []
    page = 0
    async with httpx.AsyncClient(timeout=30) as client:
        while True:
            url = (
                f"{supabase_url}/rest/v1/facts_sales_15m"
                f"?location_id=eq.{location_id}"
                f"&select=ts_bucket,sales_net,tickets"
                f"&order=ts_bucket.asc"
            )
            resp = await client.get(
                url,
                headers={**headers_sb, "Range": f"{page*1000}-{(page+1)*1000-1}"},
            )
            resp.raise_for_status()
            rows = resp.json()
            if not rows:
                break
            sales_data.extend(rows)
            page += 1
            if len(rows) < 1000:
                break

    logger.info("Fetched %d 15-min records in %d pages", len(sales_data), page)

    if len(sales_data) < 24 * 7:  # minimum ~1 week of hourly data
        raise HTTPException(
            status_code=400,
            detail=f"Need at least 1 week of 15-min data, got {len(sales_data)} records",
        )

    # ── Run hourly forecaster (with data-availability gating) ───────
    forecaster = HourlyForecaster(location_id=location_id, location_name=location_name)
    result = forecaster.run(sales_data, horizon_days=horizon_days, enable_gating=True)

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Forecast failed"))

    # ── Store results in Supabase ────────────────────────────────────
    today_str = datetime.utcnow().date().isoformat()
    TARGET_COL_PERCENT = 28
    AVG_HOURLY_RATE = 14.5

    async with httpx.AsyncClient(timeout=30) as client:
        # 1) Delete old hourly forecasts for this location
        await client.delete(
            f"{supabase_url}/rest/v1/forecast_hourly_metrics"
            f"?location_id=eq.{location_id}&forecast_date=gte.{today_str}",
            headers={**headers_sb, "Prefer": "return=minimal"},
        )

        # 2) Insert hourly forecasts in batches (with open-hours mask)
        hourly_rows = []
        masked_count = 0
        for hf in result["hourly_forecasts"]:
            h = hf["hour_of_day"]
            # Apply open-hours mask: zero out outside service hours
            if is_service_hour(h):
                sales = hf["forecast_sales"]
                lower = hf["forecast_sales_lower"]
                upper = hf["forecast_sales_upper"]
                orders = hf["forecast_orders"]
                covers = hf["forecast_covers"]
            else:
                # Prep or closed — keep row but zero values
                sales = 0
                lower = 0
                upper = 0
                orders = 0
                covers = 0
                masked_count += 1

            hourly_rows.append({
                "location_id": location_id,
                "forecast_date": hf["forecast_date"],
                "hour_of_day": h,
                "forecast_sales": sales,
                "forecast_sales_lower": lower,
                "forecast_sales_upper": upper,
                "forecast_orders": orders,
                "forecast_covers": covers,
                "model_type": hf["model_type"],
                "model_version": "HourlyEngine_v1.0",
                "bucket_wmape": hf.get("bucket_wmape"),
                "bucket_mase": hf.get("bucket_mase"),
                "generated_at": datetime.utcnow().isoformat(),
                "data_source": ds,
            })

        logger.info("Open-hours mask zeroed %d/%d hourly rows", masked_count, len(hourly_rows))

        for i in range(0, len(hourly_rows), 500):
            batch = hourly_rows[i:i + 500]
            resp = await client.post(
                f"{supabase_url}/rest/v1/forecast_hourly_metrics",
                headers={**headers_sb, "Content-Type": "application/json", "Prefer": "return=minimal"},
                json=batch,
            )
            if resp.status_code >= 400:
                logger.error("Hourly insert error: %s", resp.text[:200])

        # 3) Upsert daily forecasts (backwards compat with forecast_daily_metrics)
        await client.delete(
            f"{supabase_url}/rest/v1/forecast_daily_metrics"
            f"?location_id=eq.{location_id}&date=gte.{today_str}",
            headers={**headers_sb, "Prefer": "return=minimal"},
        )

        daily_rows = []
        for df_row in result["daily_forecasts"]:
            sales = df_row["forecast_sales"]
            target_labour = sales * (TARGET_COL_PERCENT / 100)
            planned_hours = max(20, min(120, target_labour / AVG_HOURLY_RATE))
            daily_rows.append({
                "location_id": location_id,
                "date": df_row["date"],
                "forecast_sales": sales,
                "forecast_sales_lower": df_row["forecast_sales_lower"],
                "forecast_sales_upper": df_row["forecast_sales_upper"],
                "forecast_orders": df_row["forecast_orders"],
                "planned_labor_hours": round(planned_hours, 1),
                "planned_labor_cost": round(target_labour, 2),
                "model_version": "HourlyEngine_v1.0",
                "confidence": round(max(0, (1 - result["metrics"]["wmape"])) * 100),
                "mape": result["metrics"]["wmape"],
                "mse": 0,
                "explanation": f"Hourly forecast (WMAPE {result['metrics']['wmape']*100:.1f}%, "
                               f"MASE {result['metrics']['mase']:.3f})",
                "generated_at": datetime.utcnow().isoformat(),
                "data_source": ds,
            })

        for i in range(0, len(daily_rows), 500):
            batch = daily_rows[i:i + 500]
            resp = await client.post(
                f"{supabase_url}/rest/v1/forecast_daily_metrics",
                headers={**headers_sb, "Content-Type": "application/json", "Prefer": "return=minimal"},
                json=batch,
            )
            if resp.status_code >= 400:
                logger.error("Daily insert error: %s", resp.text[:200])

        # 4) Upsert model registry
        await client.delete(
            f"{supabase_url}/rest/v1/forecast_model_registry"
            f"?location_id=eq.{location_id}",
            headers={**headers_sb, "Prefer": "return=minimal"},
        )

        registry_rows = result["model_registry"]
        for i in range(0, len(registry_rows), 200):
            batch = registry_rows[i:i + 200]
            resp = await client.post(
                f"{supabase_url}/rest/v1/forecast_model_registry",
                headers={**headers_sb, "Content-Type": "application/json", "Prefer": "return=minimal"},
                json=batch,
            )
            if resp.status_code >= 400:
                logger.error("Registry insert error: %s", resp.text[:200])

        # 5) Log model run (audit) with gating metadata
        metrics = result["metrics"]
        gating = result.get("gating", {})
        await client.post(
            f"{supabase_url}/rest/v1/forecast_model_runs",
            headers={**headers_sb, "Content-Type": "application/json", "Prefer": "return=minimal"},
            json={
                "location_id": location_id,
                "model_version": "HourlyEngine_v1.0",
                "algorithm": gating.get("algorithm", "LightGBM_ChampionChallenger"),
                "history_start": sales_data[0]["ts_bucket"][:10],
                "history_end": sales_data[-1]["ts_bucket"][:10],
                "horizon_days": horizon_days,
                "mse": 0,
                "mape": metrics["wmape"],
                "confidence": round(max(0, (1 - metrics["wmape"])) * 100),
                "data_points": result["data_points"],
                "trend_slope": 0,
                "data_sufficiency_level": gating.get("sufficiency", "LOW"),
                "blend_ratio": gating.get("blend_ratio"),
                "total_days": gating.get("total_days", 0),
                "min_bucket_samples": gating.get("min_bucket_samples", 0),
            },
        )

    logger.info(
        "Stored %d hourly + %d daily forecasts for %s (ds=%s, masked=%d)",
        len(hourly_rows), len(daily_rows), location_name, ds, masked_count,
    )

    return {
        "success": True,
        "location_id": location_id,
        "location_name": location_name,
        "data_source": ds,
        "data_points": result["data_points"],
        "history_days": result["history_days"],
        "hourly_forecasts_stored": len(hourly_rows),
        "daily_forecasts_stored": len(daily_rows),
        "hours_masked": masked_count,
        "lgbm_used": result["lgbm_used"],
        "gating": result.get("gating", {}),
        "metrics": {
            "wmape": f"{metrics['wmape'] * 100:.1f}%",
            "mase": f"{metrics['mase']:.3f}",
            "bias": f"{metrics['bias'] * 100:.1f}%",
            "directional_accuracy": f"{metrics['directional_accuracy'] * 100:.0f}%",
        },
        "registry_summary": result["registry_summary"],
        "sample_hourly": hourly_rows[:24],  # first day (with mask applied)
        "sample_daily": result["daily_forecasts"][:7],
    }


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
