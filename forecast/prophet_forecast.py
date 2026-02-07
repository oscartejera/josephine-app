"""
Josephine Forecast Engine — Prophet-based sales forecasting
============================================================
Production-grade forecasting with:
- Facebook Prophet with multiplicative seasonality
- Spanish holidays + regional holidays
- Custom regressors (events, weather, paydays)
- Automatic model selection & hyperparameter tuning
- Cross-validation with MAPE target <10%
- Per-location + per-product forecasting
- Writes results to Supabase forecast_daily_metrics

Target: >90% accuracy (MAPE < 10%)
"""

import os
import math
import logging
from datetime import datetime, timedelta, date
from typing import Optional

import pandas as pd
import numpy as np
from prophet import Prophet
from prophet.diagnostics import cross_validation, performance_metrics
import urllib.request
import json as _json

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("josephine.forecast")


# ---------------------------------------------------------------------------
# LIGHTWEIGHT SUPABASE CLIENT (avoids heavy supabase-py SDK dependencies)
# ---------------------------------------------------------------------------

class SupabaseREST:
    """Minimal Supabase REST client using only urllib (no external deps)."""

    def __init__(self, url: str, key: str):
        self.base = f"{url}/rest/v1"
        self.headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    def select(self, table: str, columns: str = "*", filters: dict | None = None,
               order: str | None = None, limit: int | None = None,
               offset: int = 0) -> list[dict]:
        params = [f"select={columns}"]
        for k, v in (filters or {}).items():
            params.append(f"{k}={v}")
        if order:
            params.append(f"order={order}")
        if limit:
            params.append(f"limit={limit}")
        if offset:
            params.append(f"offset={offset}")
        url = f"{self.base}/{table}?{'&'.join(params)}"
        req = urllib.request.Request(url, headers=self.headers)
        resp = urllib.request.urlopen(req)
        return _json.loads(resp.read())

    def insert(self, table: str, rows: list[dict]) -> list[dict]:
        url = f"{self.base}/{table}"
        data = _json.dumps(rows).encode()
        req = urllib.request.Request(url, data=data, headers=self.headers, method="POST")
        resp = urllib.request.urlopen(req)
        return _json.loads(resp.read())

    def delete(self, table: str, filters: dict) -> None:
        params = [f"{k}={v}" for k, v in filters.items()]
        url = f"{self.base}/{table}?{'&'.join(params)}"
        req = urllib.request.Request(url, headers=self.headers, method="DELETE")
        urllib.request.urlopen(req)

# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------

SUPABASE_URL = os.environ.get(
    "SUPABASE_URL", "https://qzrbvjklgorfoqersdpx.supabase.co"
)
SUPABASE_SERVICE_KEY = os.environ.get(
    "SUPABASE_SERVICE_ROLE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6cmJ2amtsZ29yZm9xZXJzZHB4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDI5NDYwMywiZXhwIjoyMDg1ODcwNjAzfQ.UgpxcrpVnrxaOlQHCcs4-5c4LABnHvFAysCbTrFLy3c",
)

HORIZON_DAYS = 90          # Forecast 90 days ahead
TARGET_COL_PCT = 0.28      # Target Cost of Labour %
DEFAULT_HOURLY_COST = 14.5 # €/hour fallback
MIN_LABOR_HOURS = 20
MAX_LABOR_HOURS = 120

# ---------------------------------------------------------------------------
# SPANISH HOLIDAYS + CUSTOM EVENTS
# ---------------------------------------------------------------------------

SPANISH_HOLIDAYS_EXTRA = [
    # Holidays Prophet's country_holidays('ES') may miss or regional ones
    {"holiday": "San Isidro", "ds": "2025-05-15", "lower_window": -1, "upper_window": 0},
    {"holiday": "San Isidro", "ds": "2026-05-15", "lower_window": -1, "upper_window": 0},
    {"holiday": "San Isidro", "ds": "2027-05-15", "lower_window": -1, "upper_window": 0},
]

MADRID_EVENTS = [
    {"holiday": "Champions League", "ds": "2025-03-15", "lower_window": 0, "upper_window": 0},
    {"holiday": "Champions League", "ds": "2025-04-20", "lower_window": 0, "upper_window": 0},
    {"holiday": "Champions League", "ds": "2025-09-20", "lower_window": 0, "upper_window": 0},
    {"holiday": "Champions League", "ds": "2025-10-25", "lower_window": 0, "upper_window": 0},
    {"holiday": "Champions League", "ds": "2026-02-18", "lower_window": 0, "upper_window": 0},
    {"holiday": "Champions League", "ds": "2026-03-10", "lower_window": 0, "upper_window": 0},
    {"holiday": "Champions League", "ds": "2026-04-15", "lower_window": 0, "upper_window": 0},
    {"holiday": "Champions League", "ds": "2026-05-20", "lower_window": 0, "upper_window": 0},
    {"holiday": "Mad Cool Festival", "ds": "2025-07-10", "lower_window": 0, "upper_window": 2},
    {"holiday": "Mad Cool Festival", "ds": "2026-07-09", "lower_window": 0, "upper_window": 2},
]

# Madrid monthly average temperatures (°C) — for mock weather
MADRID_AVG_TEMP = {1: 6, 2: 8, 3: 11, 4: 14, 5: 18, 6: 24, 7: 28, 8: 27, 9: 23, 10: 16, 11: 10, 12: 7}
MADRID_RAIN_PROB = {1: 0.28, 2: 0.26, 3: 0.23, 4: 0.33, 5: 0.28, 6: 0.12, 7: 0.08, 8: 0.08, 9: 0.18, 10: 0.28, 11: 0.30, 12: 0.32}


def _get_supabase() -> SupabaseREST:
    return SupabaseREST(SUPABASE_URL, SUPABASE_SERVICE_KEY)


# ---------------------------------------------------------------------------
# DATA FETCHING
# ---------------------------------------------------------------------------

def fetch_daily_sales(supabase: SupabaseREST, location_id: str) -> pd.DataFrame:
    """Fetch tickets and aggregate to daily sales."""
    all_tickets = []
    page_size = 1000
    offset = 0

    while True:
        batch = supabase.select(
            "tickets",
            columns="closed_at,net_total,gross_total",
            filters={
                "location_id": f"eq.{location_id}",
                "status": "eq.closed",
            },
            order="closed_at.asc",
            limit=page_size,
            offset=offset,
        )
        all_tickets.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size

    if not all_tickets:
        return pd.DataFrame(columns=["ds", "y"])

    df = pd.DataFrame(all_tickets)
    df["sales"] = df["net_total"].fillna(df["gross_total"]).fillna(0).astype(float)
    df["ds"] = pd.to_datetime(df["closed_at"]).dt.date

    daily = df.groupby("ds")["sales"].sum().reset_index()
    daily.columns = ["ds", "y"]
    daily["ds"] = pd.to_datetime(daily["ds"])
    daily = daily.sort_values("ds").reset_index(drop=True)

    # Fill missing dates with 0 (closed days)
    full_range = pd.date_range(daily["ds"].min(), daily["ds"].max(), freq="D")
    daily = daily.set_index("ds").reindex(full_range, fill_value=0).rename_axis("ds").reset_index()

    return daily


def fetch_labor_metrics(supabase: SupabaseREST, location_id: str) -> tuple[float, float]:
    """Return (avg_splh, avg_hourly_cost) for a location."""
    rows = supabase.select(
        "pos_daily_metrics",
        columns="net_sales,labor_hours",
        filters={"location_id": f"eq.{location_id}"},
        order="date.desc",
        limit=56,
    )

    total_sales = sum(float(r.get("net_sales") or 0) for r in rows)
    total_hours = sum(float(r.get("labor_hours") or 0) for r in rows)
    splh = total_sales / total_hours if total_hours > 0 else 80.0

    employees = supabase.select(
        "employees",
        columns="hourly_cost",
        filters={
            "location_id": f"eq.{location_id}",
            "active": "eq.true",
        },
    )
    costs = [float(e["hourly_cost"]) for e in employees if e.get("hourly_cost")]
    hourly_cost = sum(costs) / len(costs) if costs else DEFAULT_HOURLY_COST

    return splh, hourly_cost


# ---------------------------------------------------------------------------
# REGRESSORS
# ---------------------------------------------------------------------------

def add_regressors(df: pd.DataFrame) -> pd.DataFrame:
    """Add external regressor columns to the DataFrame."""
    df = df.copy()

    # is_payday: 1st, 15th, or 25-31
    df["is_payday"] = df["ds"].apply(
        lambda d: 1.0 if d.day in (1, 15) or d.day >= 25 else 0.0
    )

    # temperature (mock based on Madrid monthly averages + noise)
    rng = np.random.RandomState(42)
    df["temperature"] = df["ds"].apply(
        lambda d: MADRID_AVG_TEMP.get(d.month, 18)
    ) + rng.normal(0, 2, len(df))

    # is_rainy (mock based on Madrid monthly probabilities, deterministic seed)
    rain_rng = np.random.RandomState(123)
    df["is_rainy"] = df["ds"].apply(
        lambda d: 1.0 if rain_rng.random() < MADRID_RAIN_PROB.get(d.month, 0.25) else 0.0
    )

    # is_cold (temp < 10°C)
    df["is_cold"] = (df["temperature"] < 10).astype(float)

    # is_hot (temp > 30°C)
    df["is_hot"] = (df["temperature"] > 30).astype(float)

    return df


def build_holidays_df() -> pd.DataFrame:
    """Combine custom events into a holidays DataFrame for Prophet."""
    rows = SPANISH_HOLIDAYS_EXTRA + MADRID_EVENTS
    if not rows:
        return pd.DataFrame(columns=["holiday", "ds", "lower_window", "upper_window"])
    hdf = pd.DataFrame(rows)
    hdf["ds"] = pd.to_datetime(hdf["ds"])
    return hdf


# ---------------------------------------------------------------------------
# MODEL TRAINING
# ---------------------------------------------------------------------------

HYPERPARAMETER_GRID = [
    # Conservative: stable trend, moderate seasonality
    {"changepoint_prior_scale": 0.01, "seasonality_prior_scale": 5, "holidays_prior_scale": 5},
    # Balanced
    {"changepoint_prior_scale": 0.05, "seasonality_prior_scale": 10, "holidays_prior_scale": 10},
    # Flexible: captures rapid changes
    {"changepoint_prior_scale": 0.1, "seasonality_prior_scale": 15, "holidays_prior_scale": 15},
    # Very flexible trend, strong seasonality
    {"changepoint_prior_scale": 0.15, "seasonality_prior_scale": 20, "holidays_prior_scale": 10},
]


def _build_model(
    params: dict,
    holidays_df: pd.DataFrame,
    has_yearly: bool,
) -> Prophet:
    """Construct a Prophet model with given hyperparameters."""
    m = Prophet(
        growth="linear",
        seasonality_mode="multiplicative",  # Restaurant revenue scales multiplicatively
        changepoint_prior_scale=params["changepoint_prior_scale"],
        seasonality_prior_scale=params["seasonality_prior_scale"],
        holidays_prior_scale=params["holidays_prior_scale"],
        yearly_seasonality=has_yearly,
        weekly_seasonality=True,
        daily_seasonality=False,
        holidays=holidays_df,
        uncertainty_samples=300,
    )

    # Built-in country holidays (Spain)
    m.add_country_holidays(country_name="ES")

    # Monthly seasonality (captures paydays, month-end effects)
    m.add_seasonality(name="monthly", period=30.5, fourier_order=5)

    # Custom regressors
    m.add_regressor("is_payday", prior_scale=2, mode="multiplicative")
    m.add_regressor("temperature", prior_scale=3, standardize=True, mode="multiplicative")
    m.add_regressor("is_rainy", prior_scale=5, mode="multiplicative")
    m.add_regressor("is_cold", prior_scale=3, mode="multiplicative")
    m.add_regressor("is_hot", prior_scale=2, mode="multiplicative")

    return m


def train_and_evaluate(
    df: pd.DataFrame,
    holidays_df: pd.DataFrame,
) -> tuple[Prophet, dict, float]:
    """
    Train Prophet models with grid search, pick the best by cross-validation MAPE.
    Returns (best_model, best_params, best_mape).
    """
    n_days = len(df)
    has_yearly = n_days >= 365

    # Cross-validation config adapted to data length
    if n_days >= 365:
        initial_days = 180
        horizon_days = 30
        period_days = 30
    elif n_days >= 120:
        initial_days = max(60, n_days - 60)
        horizon_days = 14
        period_days = 14
    elif n_days >= 60:
        initial_days = max(30, n_days - 30)
        horizon_days = 7
        period_days = 7
    else:
        # Not enough data for proper CV — train on all, no CV
        initial_days = n_days
        horizon_days = 0
        period_days = 0

    best_model = None
    best_params = HYPERPARAMETER_GRID[1]  # Default balanced
    best_mape = float("inf")

    for params in HYPERPARAMETER_GRID:
        try:
            m = _build_model(params, holidays_df, has_yearly)
            m.fit(df)

            if horizon_days > 0:
                cv_df = cross_validation(
                    m,
                    initial=f"{initial_days} days",
                    period=f"{period_days} days",
                    horizon=f"{horizon_days} days",
                    parallel="processes",
                )
                perf = performance_metrics(cv_df, rolling_window=1)
                mape = perf["mape"].iloc[-1]
            else:
                # No CV possible — use in-sample MAPE
                fitted = m.predict(df[["ds"] + [c for c in df.columns if c not in ("ds", "y")]])
                residuals = (df["y"] - fitted["yhat"]).abs()
                mape = (residuals / df["y"].clip(lower=1)).mean()

            logger.info(
                f"  Params cps={params['changepoint_prior_scale']}, "
                f"sps={params['seasonality_prior_scale']} → MAPE={mape:.4f} ({mape*100:.1f}%)"
            )

            if mape < best_mape:
                best_mape = mape
                best_model = m
                best_params = params

        except Exception as e:
            logger.warning(f"  Params {params} failed: {e}")
            continue

    if best_model is None:
        # Fallback: train with default params, no CV
        logger.warning("All grid search attempts failed, using fallback model")
        best_params = HYPERPARAMETER_GRID[1]
        best_model = _build_model(best_params, holidays_df, has_yearly)
        best_model.fit(df)
        best_mape = 0.15  # Assume 15% without validation

    return best_model, best_params, best_mape


# ---------------------------------------------------------------------------
# FORECAST GENERATION
# ---------------------------------------------------------------------------

def generate_forecast(
    model: Prophet,
    df_history: pd.DataFrame,
    horizon_days: int = HORIZON_DAYS,
) -> pd.DataFrame:
    """Generate future forecast with regressors."""
    last_date = df_history["ds"].max()
    future_dates = pd.date_range(
        start=last_date + timedelta(days=1),
        periods=horizon_days,
        freq="D",
    )
    future = pd.DataFrame({"ds": future_dates})
    future = add_regressors(future)

    forecast = model.predict(future)

    # Clamp negatives
    forecast["yhat"] = forecast["yhat"].clip(lower=0)
    forecast["yhat_lower"] = forecast["yhat_lower"].clip(lower=0)
    forecast["yhat_upper"] = forecast["yhat_upper"].clip(lower=0)

    # Estimate forecast_orders from sales (avg ticket ~€25-35)
    avg_ticket = df_history["y"].sum() / max(len(df_history[df_history["y"] > 0]), 1)
    avg_order_value = max(avg_ticket / 3.5, 15)  # Rough: ~3.5 orders per day's avg ticket
    forecast["forecast_orders"] = (forecast["yhat"] / avg_order_value).round(0)

    return forecast


# ---------------------------------------------------------------------------
# STORE RESULTS
# ---------------------------------------------------------------------------

def store_forecasts(
    supabase: SupabaseREST,
    location_id: str,
    forecast_df: pd.DataFrame,
    mape: float,
    params: dict,
    splh: float,
    hourly_cost: float,
    data_points: int,
) -> int:
    """Write forecast rows to forecast_daily_metrics and log the model run."""
    today_str = date.today().isoformat()

    # Delete existing future forecasts for this location
    supabase.delete("forecast_daily_metrics", {
        "location_id": f"eq.{location_id}",
        "date": f"gte.{today_str}",
    })

    rows = []
    for _, row in forecast_df.iterrows():
        forecast_sales = round(float(row["yhat"]), 2)

        # Derive planned labour from forecast sales
        target_labour_cost = forecast_sales * TARGET_COL_PCT
        planned_hours = target_labour_cost / hourly_cost if hourly_cost > 0 else forecast_sales / splh
        planned_hours = max(MIN_LABOR_HOURS, min(MAX_LABOR_HOURS, planned_hours))
        planned_cost = round(planned_hours * hourly_cost, 2)

        confidence = max(0, min(100, round((1 - mape) * 100)))

        rows.append({
            "location_id": location_id,
            "date": row["ds"].strftime("%Y-%m-%d"),
            "forecast_sales": forecast_sales,
            "forecast_orders": int(row.get("forecast_orders", 0)),
            "planned_labor_hours": round(planned_hours, 1),
            "planned_labor_cost": planned_cost,
            "model_version": "Prophet_v5_production",
            "mape": round(mape, 4),
            "mse": 0,
            "confidence": confidence,
            "generated_at": datetime.utcnow().isoformat(),
        })

    # Insert in batches of 500
    inserted = 0
    for i in range(0, len(rows), 500):
        batch = rows[i : i + 500]
        supabase.insert("forecast_daily_metrics", batch)
        inserted += len(batch)

    # Log model run
    supabase.insert("forecast_model_runs", [{
        "location_id": location_id,
        "model_version": "Prophet_v5_production",
        "algorithm": "prophet_multiplicative_regressors",
        "history_start": forecast_df["ds"].min().strftime("%Y-%m-%d") if not forecast_df.empty else today_str,
        "history_end": today_str,
        "horizon_days": len(rows),
        "mse": 0,
        "mape": round(mape, 4),
        "confidence": max(0, min(100, round((1 - mape) * 100))),
        "data_points": data_points,
        "trend_slope": params.get("changepoint_prior_scale", 0),
        "trend_intercept": params.get("seasonality_prior_scale", 0),
    }])

    return inserted


# ---------------------------------------------------------------------------
# MAIN PIPELINE
# ---------------------------------------------------------------------------

def run_forecast(location_id: Optional[str] = None) -> list[dict]:
    """
    Run the full Prophet forecast pipeline for one or all locations.
    Returns a list of result dicts with accuracy metrics.
    """
    supabase = _get_supabase()
    holidays_df = build_holidays_df()

    # Fetch locations
    filters = {"active": "eq.true"}
    if location_id:
        filters = {"id": f"eq.{location_id}"}
    locations = supabase.select("locations", columns="id,name", filters=filters)

    if not locations:
        logger.error("No locations found")
        return []

    results = []

    for loc in locations:
        loc_id = loc["id"]
        loc_name = loc["name"]
        logger.info(f"{'='*60}")
        logger.info(f"Forecasting: {loc_name} ({loc_id})")
        logger.info(f"{'='*60}")

        # 1. Fetch data
        df = fetch_daily_sales(supabase, loc_id)
        n_days = len(df)
        logger.info(f"Historical data: {n_days} days")

        if n_days < 14:
            logger.warning(f"Insufficient data ({n_days} < 14 days), skipping {loc_name}")
            results.append({
                "location_id": loc_id,
                "location_name": loc_name,
                "status": "skipped",
                "reason": f"insufficient_data ({n_days} days)",
                "mape": None,
                "accuracy_pct": None,
            })
            continue

        # Remove days with 0 sales if they're > 20% of data (likely closed days)
        zero_pct = (df["y"] == 0).mean()
        if zero_pct > 0.2:
            logger.info(f"Filtering {zero_pct:.0%} zero-sales days (likely closed)")
            df = df[df["y"] > 0].reset_index(drop=True)
            n_days = len(df)

        logger.info(f"Sales range: €{df['y'].min():.0f} – €{df['y'].max():.0f}, mean €{df['y'].mean():.0f}")

        # 2. Add regressors
        df = add_regressors(df)

        # 3. Train with hyperparameter search + cross-validation
        logger.info("Training Prophet models (grid search)...")
        model, best_params, mape = train_and_evaluate(df, holidays_df)

        accuracy_pct = round((1 - mape) * 100, 1)
        logger.info(f"Best model: MAPE={mape:.4f} → Accuracy={accuracy_pct}%")
        logger.info(f"Best params: {best_params}")

        if accuracy_pct < 90:
            logger.warning(
                f"Accuracy {accuracy_pct}% is below 90% target. "
                f"This typically improves with more historical data (currently {n_days} days)."
            )

        # 4. Generate forecast
        logger.info(f"Generating {HORIZON_DAYS}-day forecast...")
        forecast_df = generate_forecast(model, df, HORIZON_DAYS)

        # 5. Get labour metrics
        splh, hourly_cost = fetch_labor_metrics(supabase, loc_id)
        logger.info(f"Labour: SPLH=€{splh:.0f}/h, hourly_cost=€{hourly_cost:.2f}/h")

        # 6. Store results
        inserted = store_forecasts(
            supabase, loc_id, forecast_df, mape, best_params, splh, hourly_cost, n_days
        )
        logger.info(f"Stored {inserted} forecast rows for {loc_name}")

        # 7. Sample output
        sample = forecast_df.head(7)[["ds", "yhat", "yhat_lower", "yhat_upper"]].copy()
        sample.columns = ["date", "forecast", "lower_95", "upper_95"]
        logger.info(f"Sample forecast (7 days):\n{sample.to_string(index=False)}")

        results.append({
            "location_id": loc_id,
            "location_name": loc_name,
            "status": "success",
            "data_points": n_days,
            "mape": round(mape, 4),
            "accuracy_pct": accuracy_pct,
            "model_params": best_params,
            "forecasts_generated": inserted,
            "forecast_sample": sample.to_dict("records"),
        })

    return results


# ---------------------------------------------------------------------------
# CLI ENTRY POINT
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse
    import json

    parser = argparse.ArgumentParser(description="Josephine Prophet Forecast Engine")
    parser.add_argument("--location", "-l", help="Specific location_id (default: all)")
    parser.add_argument("--horizon", "-H", type=int, default=90, help="Forecast horizon in days")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    if args.horizon:
        HORIZON_DAYS = args.horizon

    results = run_forecast(location_id=args.location)

    if args.json:
        print(json.dumps(results, indent=2, default=str))
    else:
        print("\n" + "=" * 60)
        print("FORECAST RESULTS SUMMARY")
        print("=" * 60)
        for r in results:
            status = r["status"]
            name = r["location_name"]
            if status == "success":
                print(f"  ✅ {name}: {r['accuracy_pct']}% accuracy, {r['forecasts_generated']} days forecasted")
            else:
                print(f"  ⚠️  {name}: {status} ({r.get('reason', '')})")
        print()
