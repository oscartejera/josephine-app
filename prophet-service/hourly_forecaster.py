"""
Josephine Hourly Forecast Engine v1.0
Champion/Challenger per bucket (DOW × HOUR) per location.

Architecture:
  - ONE global LightGBM model per location (DOW + HOUR as features)
  - Seasonal Naive baseline (lag_168h, fallback lag_24h, fallback hourly mean)
  - Evaluation per bucket (DOW × HOUR): pick winner per bucket
  - Inference: for each future hour, use the winning model from the registry

Models:
  A) LightGBM Regressor — global model with lag/rolling/calendar features
  B) Seasonal Naive     — lag_168 (same DOW+hour last week)

Metrics (restaurant-specific):
  - WMAPE (Weighted Mean Absolute Percentage Error)
  - MASE  (Mean Absolute Scaled Error vs seasonal naive)
  - Bias  (systematic over/under forecast)
  - Directional Accuracy
  - Calibration (% actuals within prediction interval)
"""

import logging
from datetime import date as ddate, datetime, timedelta
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger("hourly-forecaster")

# ─── Constants ───────────────────────────────────────────────────────────────

SPANISH_HOLIDAYS = {
    "2024-01-01", "2024-01-06", "2024-03-29", "2024-04-01",
    "2024-05-01", "2024-08-15", "2024-10-12", "2024-11-01",
    "2024-12-06", "2024-12-08", "2024-12-25",
    "2025-01-01", "2025-01-06", "2025-04-18", "2025-04-21",
    "2025-05-01", "2025-08-15", "2025-10-12", "2025-11-01",
    "2025-12-06", "2025-12-08", "2025-12-25",
    "2026-01-01", "2026-01-06", "2026-04-03", "2026-04-06",
    "2026-05-01", "2026-08-15", "2026-10-12", "2026-11-01",
    "2026-12-06", "2026-12-08", "2026-12-25",
    "2027-01-01", "2027-01-06", "2027-03-26", "2027-03-29",
    "2027-05-01", "2027-08-15", "2027-10-12", "2027-11-01",
    "2027-12-06", "2027-12-08", "2027-12-25",
}

FEATURE_COLS = [
    "hour_of_day", "day_of_week", "is_weekend", "month", "week_of_year",
    "day_of_month", "is_holiday", "is_payday",
    "lag_1", "lag_24", "lag_168", "lag_336",
    "rolling_mean_7d", "rolling_std_7d",
]

MIN_DAYS_LGBM = 28   # 4 weeks minimum for LightGBM (need lags + train/test)
MIN_DAYS_NAIVE = 7    # 1 week minimum for seasonal naive
HOLDOUT_DAYS = 14     # last 2 weeks as test set
CHAMPION_WMAPE_TOLERANCE = 0.02  # prefer simpler model if WMAPE diff < 2%

# ─── Data Availability Gating thresholds ─────────────────────────────────────
GATING_LOW_MAX_DAYS = 14       # < 14 days => LOW (baseline only)
GATING_MID_MAX_DAYS = 56       # 14..55 days => MID (blend)
GATING_MID_BLEND_RATIO = 0.3   # LightGBM weight in MID tier
MIN_BUCKET_SAMPLES_FOR_ML = 6  # per (DOW, HOUR) bucket


# ─── Data Preparation ────────────────────────────────────────────────────────

def aggregate_to_hourly(sales_15m: list[dict]) -> pd.DataFrame:
    """Aggregate 15-min facts_sales_15m rows to hourly buckets."""
    if not sales_15m:
        return pd.DataFrame()

    df = pd.DataFrame(sales_15m)
    df["ts_bucket"] = pd.to_datetime(df["ts_bucket"])
    df["sale_date"] = df["ts_bucket"].dt.date
    df["hour_of_day"] = df["ts_bucket"].dt.hour
    df["sales_net"] = pd.to_numeric(df.get("sales_net", 0), errors="coerce").fillna(0)
    df["tickets"] = pd.to_numeric(df.get("tickets", 0), errors="coerce").fillna(0).astype(int)

    hourly = (
        df.groupby(["sale_date", "hour_of_day"])
        .agg(sales_net=("sales_net", "sum"), tickets=("tickets", "sum"))
        .reset_index()
    )
    hourly["day_of_week"] = pd.to_datetime(hourly["sale_date"]).dt.dayofweek
    return hourly.sort_values(["sale_date", "hour_of_day"]).reset_index(drop=True)


def fill_hourly_grid(hourly_df: pd.DataFrame) -> pd.DataFrame:
    """Expand to full 24h grid per day (needed for correct lag indexing)."""
    if len(hourly_df) == 0:
        return hourly_df

    min_date = hourly_df["sale_date"].min()
    max_date = hourly_df["sale_date"].max()

    all_dates = pd.date_range(min_date, max_date, freq="D")
    grid = pd.MultiIndex.from_product(
        [all_dates.date, range(24)], names=["sale_date", "hour_of_day"]
    )
    grid_df = pd.DataFrame(index=grid).reset_index()
    grid_df["day_of_week"] = pd.to_datetime(grid_df["sale_date"]).dt.dayofweek

    result = grid_df.merge(
        hourly_df[["sale_date", "hour_of_day", "sales_net", "tickets"]],
        on=["sale_date", "hour_of_day"],
        how="left",
    )
    result["sales_net"] = result["sales_net"].fillna(0)
    result["tickets"] = result["tickets"].fillna(0).astype(int)
    return result.sort_values(["sale_date", "hour_of_day"]).reset_index(drop=True)


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """Build LightGBM features from the full hourly grid."""
    df = df.copy()

    # Lags (shift is correct because grid is 24h/day, sorted chronologically)
    df["lag_1"] = df["sales_net"].shift(1)
    df["lag_24"] = df["sales_net"].shift(24)
    df["lag_168"] = df["sales_net"].shift(168)   # same DOW+hour, 1 week ago
    df["lag_336"] = df["sales_net"].shift(336)   # same DOW+hour, 2 weeks ago

    # Rolling stats: same hour over last 7 occurrences (= 7 days)
    for hour in range(24):
        mask = df["hour_of_day"] == hour
        hourly_vals = df.loc[mask, "sales_net"]
        df.loc[mask, "rolling_mean_7d"] = hourly_vals.rolling(7, min_periods=1).mean()
        df.loc[mask, "rolling_std_7d"] = hourly_vals.rolling(7, min_periods=1).std().fillna(0)

    # Calendar features
    sale_dt = pd.to_datetime(df["sale_date"])
    df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)
    df["month"] = sale_dt.dt.month
    df["week_of_year"] = sale_dt.dt.isocalendar().week.astype(int)
    df["day_of_month"] = sale_dt.dt.day
    df["is_holiday"] = df["sale_date"].astype(str).isin(SPANISH_HOLIDAYS).astype(int)
    df["is_payday"] = (
        (df["day_of_month"] == 1) | (df["day_of_month"] == 15) | (df["day_of_month"] >= 25)
    ).astype(int)

    return df


# ─── Models ──────────────────────────────────────────────────────────────────

def train_lgbm(df_train: pd.DataFrame) -> "LGBMRegressor":
    """Train a global LightGBM model on hourly data."""
    import lightgbm as lgb

    feature_df = df_train.dropna(subset=["lag_1", "lag_24"])
    X = feature_df[FEATURE_COLS].values
    y = feature_df["sales_net"].values

    model = lgb.LGBMRegressor(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        min_child_samples=10,
        subsample=0.8,
        colsample_bytree=0.8,
        reg_alpha=0.1,
        reg_lambda=0.1,
        random_state=42,
        verbose=-1,
    )
    model.fit(X, y)
    logger.info("LightGBM trained on %d samples, features=%d", len(X), len(FEATURE_COLS))
    return model


def predict_lgbm(model, df: pd.DataFrame) -> np.ndarray:
    """Predict with LightGBM on a DataFrame that has FEATURE_COLS."""
    valid = df.dropna(subset=["lag_1", "lag_24"])
    preds = np.full(len(df), np.nan)
    if len(valid) > 0:
        raw = model.predict(valid[FEATURE_COLS].values)
        preds[valid.index.values - df.index[0]] = np.maximum(0, raw)
    return preds


def seasonal_naive_predictions(df: pd.DataFrame) -> np.ndarray:
    """Seasonal Naive: lag_168 (same DOW+hour last week), fallback lag_24."""
    preds = df["lag_168"].copy().values.astype(float)
    # Fallback 1: lag_24 where lag_168 is NaN
    nan_mask = np.isnan(preds)
    if nan_mask.any():
        preds[nan_mask] = df.loc[df.index[nan_mask], "lag_24"].values.astype(float)
    # Fallback 2: hourly mean where still NaN
    still_nan = np.isnan(preds)
    if still_nan.any():
        hourly_means = df.groupby("hour_of_day")["sales_net"].transform("mean").values
        preds[still_nan] = hourly_means[still_nan]
    return np.maximum(0, np.nan_to_num(preds, nan=0))


# ─── Metrics ─────────────────────────────────────────────────────────────────

def wmape(actual: np.ndarray, predicted: np.ndarray) -> float:
    """Weighted Mean Absolute Percentage Error."""
    total = np.sum(np.abs(actual))
    if total == 0:
        return 0.0
    return float(np.sum(np.abs(actual - predicted)) / total)


def mase(actual: np.ndarray, predicted: np.ndarray, seasonal_actual: np.ndarray) -> float:
    """Mean Absolute Scaled Error (vs seasonal naive lag_168)."""
    mae_model = np.mean(np.abs(actual - predicted))
    mae_naive = np.mean(np.abs(actual - seasonal_actual))
    if mae_naive == 0:
        return 0.0
    return float(mae_model / mae_naive)


def forecast_bias(actual: np.ndarray, predicted: np.ndarray) -> float:
    """Systematic bias: mean(pred - actual) / mean(actual). + = over-forecast."""
    mean_actual = np.mean(actual)
    if mean_actual == 0:
        return 0.0
    return float(np.mean(predicted - actual) / mean_actual)


def directional_accuracy(actual: np.ndarray, predicted: np.ndarray) -> float:
    """% of direction changes predicted correctly."""
    if len(actual) < 2:
        return 0.0
    actual_dir = np.diff(actual)
    pred_dir = np.diff(predicted)
    correct = np.sum((actual_dir >= 0) == (pred_dir >= 0))
    return float(correct / len(actual_dir))


def calibration_score(
    actual: np.ndarray, lower: np.ndarray, upper: np.ndarray
) -> float:
    """% of actuals within prediction interval."""
    if len(actual) == 0:
        return 0.0
    within = np.sum((actual >= lower) & (actual <= upper))
    return float(within / len(actual))


# ─── Champion/Challenger Evaluation ──────────────────────────────────────────

def evaluate_per_bucket(
    df_test: pd.DataFrame,
    lgbm_preds: np.ndarray,
    naive_preds: np.ndarray,
) -> dict:
    """
    Evaluate both models per (DOW, HOUR) bucket.
    Returns a dict: {(dow, hour): {champion_model, metrics...}}
    """
    registry = {}

    for dow in range(7):
        for hour in range(24):
            mask = (df_test["day_of_week"] == dow) & (df_test["hour_of_day"] == hour)
            if mask.sum() == 0:
                # No test data for this bucket; default to naive
                registry[(dow, hour)] = {
                    "champion_model": "seasonal_naive",
                    "champion_wmape": None,
                    "champion_mase": None,
                    "champion_bias": None,
                    "champion_directional_acc": None,
                    "challenger_model": "lgbm",
                    "challenger_wmape": None,
                    "challenger_mase": None,
                    "training_samples": 0,
                }
                continue

            actual = df_test.loc[mask, "sales_net"].values
            lgbm_bucket = lgbm_preds[mask.values]
            naive_bucket = naive_preds[mask.values]

            # Skip evaluation for hours with near-zero sales (closed hours)
            if np.sum(np.abs(actual)) < 1.0:
                registry[(dow, hour)] = {
                    "champion_model": "seasonal_naive",
                    "champion_wmape": 0.0,
                    "champion_mase": 0.0,
                    "champion_bias": 0.0,
                    "champion_directional_acc": 0.0,
                    "challenger_model": "lgbm",
                    "challenger_wmape": 0.0,
                    "challenger_mase": 0.0,
                    "training_samples": int(mask.sum()),
                }
                continue

            # Compute metrics for both models
            lgbm_wmape = wmape(actual, lgbm_bucket)
            naive_wmape = wmape(actual, naive_bucket)

            seasonal_ref = df_test.loc[mask, "lag_168"].fillna(0).values
            lgbm_mase_val = mase(actual, lgbm_bucket, seasonal_ref)
            naive_mase_val = mase(actual, naive_bucket, seasonal_ref)

            lgbm_bias = forecast_bias(actual, lgbm_bucket)
            naive_bias = forecast_bias(actual, naive_bucket)

            lgbm_da = directional_accuracy(actual, lgbm_bucket)

            # Champion selection: prefer lower WMAPE, with tolerance for simplicity
            if naive_wmape - lgbm_wmape > CHAMPION_WMAPE_TOLERANCE:
                champion = "lgbm"
                challenger = "seasonal_naive"
            else:
                champion = "seasonal_naive"
                challenger = "lgbm"

            c_metrics = (lgbm_wmape, lgbm_mase_val, lgbm_bias, lgbm_da) if champion == "lgbm" else (naive_wmape, naive_mase_val, naive_bias, directional_accuracy(actual, naive_bucket))
            ch_metrics = (naive_wmape, naive_mase_val) if champion == "lgbm" else (lgbm_wmape, lgbm_mase_val)

            registry[(dow, hour)] = {
                "champion_model": champion,
                "champion_wmape": round(c_metrics[0], 4),
                "champion_mase": round(c_metrics[1], 4),
                "champion_bias": round(c_metrics[2], 4),
                "champion_directional_acc": round(c_metrics[3], 4),
                "challenger_model": challenger,
                "challenger_wmape": round(ch_metrics[0], 4),
                "challenger_mase": round(ch_metrics[1], 4),
                "training_samples": int(mask.sum()),
            }

    return registry


# ─── Conformal Prediction Intervals ─────────────────────────────────────────

def compute_conformal_intervals(
    df_test: pd.DataFrame,
    lgbm_preds: np.ndarray,
) -> dict:
    """Compute residual-based prediction intervals per bucket for LightGBM."""
    intervals = {}
    for dow in range(7):
        for hour in range(24):
            mask = (df_test["day_of_week"] == dow) & (df_test["hour_of_day"] == hour)
            if mask.sum() < 3:
                intervals[(dow, hour)] = 0.0
                continue
            actual = df_test.loc[mask, "sales_net"].values
            preds = lgbm_preds[mask.values]
            residuals = np.abs(actual - preds)
            # 95th percentile of residuals for 90% coverage
            intervals[(dow, hour)] = float(np.percentile(residuals, 95))
    return intervals


# ─── Future Prediction ───────────────────────────────────────────────────────

def predict_future(
    df_history: pd.DataFrame,
    future_dates: list[ddate],
    registry: dict,
    lgbm_model,
    conformal_intervals: dict,
) -> list[dict]:
    """
    Generate hourly forecasts for future dates using registry winners.
    Uses recursive prediction for LightGBM (feeds predictions as lags).
    """
    # Build a mutable buffer from history for lag lookups
    # Use a dict keyed by (date, hour) for O(1) lookups
    sales_buffer: dict[tuple, float] = {}
    for _, row in df_history.iterrows():
        sales_buffer[(row["sale_date"], int(row["hour_of_day"]))] = float(row["sales_net"])

    # Pre-compute hourly means for fallback
    hourly_means = df_history.groupby("hour_of_day")["sales_net"].mean().to_dict()

    results = []

    for target_date in future_dates:
        for hour in range(24):
            dow = target_date.weekday()
            bucket_key = (dow, hour)
            winner = registry.get(bucket_key, {}).get("champion_model", "seasonal_naive")

            if winner == "lgbm" and lgbm_model is not None:
                # Build features for this single hour
                features = _build_single_features(
                    target_date, hour, dow, sales_buffer, hourly_means
                )
                pred = float(lgbm_model.predict([features])[0])
            else:
                # Seasonal naive
                pred = _seasonal_naive_single(target_date, hour, sales_buffer, hourly_means)

            pred = max(0, round(pred, 2))

            # Prediction intervals
            interval_width = conformal_intervals.get(bucket_key, 0.0)
            lower = max(0, round(pred - interval_width, 2))
            upper = round(pred + interval_width, 2)

            # Estimate orders from sales (avg ticket ~25€)
            orders_est = round(pred / 25, 1) if pred > 0 else 0

            bucket_info = registry.get(bucket_key, {})

            results.append({
                "forecast_date": target_date.isoformat(),
                "hour_of_day": hour,
                "forecast_sales": pred,
                "forecast_sales_lower": lower,
                "forecast_sales_upper": upper,
                "forecast_orders": orders_est,
                "forecast_covers": orders_est,
                "model_type": winner,
                "bucket_wmape": bucket_info.get("champion_wmape"),
                "bucket_mase": bucket_info.get("champion_mase"),
            })

            # Feed prediction back to buffer for recursive lags
            sales_buffer[(target_date, hour)] = pred

    return results


def _build_single_features(
    target_date: ddate,
    hour: int,
    dow: int,
    sales_buffer: dict,
    hourly_means: dict,
) -> list[float]:
    """Build FEATURE_COLS for a single (date, hour) prediction."""
    def lookup(d: ddate, h: int) -> float:
        val = sales_buffer.get((d, h))
        if val is not None:
            return val
        return hourly_means.get(h, 0.0)

    prev_date = target_date - timedelta(days=1)
    week_ago = target_date - timedelta(days=7)
    two_weeks_ago = target_date - timedelta(days=14)

    lag_1 = lookup(target_date, hour - 1) if hour > 0 else lookup(prev_date, 23)
    lag_24 = lookup(prev_date, hour)
    lag_168 = lookup(week_ago, hour)
    lag_336 = lookup(two_weeks_ago, hour)

    # Rolling mean/std for same hour over last 7 days
    recent_vals = []
    for d_offset in range(1, 8):
        d = target_date - timedelta(days=d_offset)
        val = sales_buffer.get((d, hour))
        if val is not None:
            recent_vals.append(val)
    rolling_mean = float(np.mean(recent_vals)) if recent_vals else hourly_means.get(hour, 0.0)
    rolling_std = float(np.std(recent_vals)) if len(recent_vals) > 1 else 0.0

    is_weekend = 1 if dow >= 5 else 0
    month = target_date.month
    week_of_year = target_date.isocalendar()[1]
    day_of_month = target_date.day
    is_holiday = 1 if target_date.isoformat() in SPANISH_HOLIDAYS else 0
    is_payday = 1 if (day_of_month in (1, 15) or day_of_month >= 25) else 0

    # Must match FEATURE_COLS order exactly
    return [
        hour, dow, is_weekend, month, week_of_year,
        day_of_month, is_holiday, is_payday,
        lag_1, lag_24, lag_168, lag_336,
        rolling_mean, rolling_std,
    ]


def _seasonal_naive_single(
    target_date: ddate,
    hour: int,
    sales_buffer: dict,
    hourly_means: dict,
) -> float:
    """Seasonal naive for a single hour: lag_168 → lag_24 → hourly mean."""
    # Try same DOW+hour last week
    week_ago = target_date - timedelta(days=7)
    val = sales_buffer.get((week_ago, hour))
    if val is not None:
        return val
    # Fallback: same hour yesterday
    yesterday = target_date - timedelta(days=1)
    val = sales_buffer.get((yesterday, hour))
    if val is not None:
        return val
    # Fallback: historical mean for this hour
    return hourly_means.get(hour, 0.0)


# ─── Data Availability Gating ─────────────────────────────────────────────────

def compute_gating(hourly_df: pd.DataFrame) -> dict:
    """
    Assess data sufficiency for a location.

    Returns dict with:
      - sufficiency: 'LOW' | 'MID' | 'HIGH'
      - blend_ratio: float (0.0 = baseline only, 1.0 = full ML)
      - total_days: int
      - min_bucket_samples: int (minimum across all DOW×HOUR buckets with data)
      - algorithm: str (descriptive label for model_runs)
    """
    total_days = int(hourly_df["sale_date"].nunique())

    # Compute samples per (dow, hour) bucket — only where sales > 0
    active = hourly_df[hourly_df["sales_net"] > 0]
    if len(active) == 0:
        bucket_counts = pd.Series(dtype=int)
    else:
        bucket_counts = active.groupby(["day_of_week", "hour_of_day"]).size()

    # Min across populated buckets (ignore empty buckets)
    min_bucket = int(bucket_counts.min()) if len(bucket_counts) > 0 else 0

    if total_days < GATING_LOW_MAX_DAYS:
        return {
            "sufficiency": "LOW",
            "blend_ratio": 0.0,
            "total_days": total_days,
            "min_bucket_samples": min_bucket,
            "algorithm": "BASELINE_ONLY",
        }
    elif total_days < GATING_MID_MAX_DAYS:
        return {
            "sufficiency": "MID",
            "blend_ratio": GATING_MID_BLEND_RATIO,
            "total_days": total_days,
            "min_bucket_samples": min_bucket,
            "algorithm": "BLEND_Naive70_LightGBM30",
        }
    else:
        return {
            "sufficiency": "HIGH",
            "blend_ratio": 1.0,
            "total_days": total_days,
            "min_bucket_samples": min_bucket,
            "algorithm": "LightGBM_ChampionChallenger",
        }


def apply_gating_to_registry(
    registry: dict,
    gating: dict,
    bucket_counts: pd.Series,
) -> dict:
    """
    Override registry champion based on gating rules:
    - LOW  => force all buckets to seasonal_naive
    - MID  => keep registry but blend predictions later
    - HIGH => use registry as-is, but force naive for buckets with < MIN_BUCKET_SAMPLES_FOR_ML
    """
    if gating["sufficiency"] == "LOW":
        for key in registry:
            registry[key]["champion_model"] = "seasonal_naive"
        return registry

    # For MID and HIGH: force naive on under-sampled buckets
    for (dow, hour), data in registry.items():
        samples = bucket_counts.get((dow, hour), 0)
        if samples < MIN_BUCKET_SAMPLES_FOR_ML and data["champion_model"] == "lgbm":
            data["champion_model"] = "seasonal_naive"
            logger.info(
                "Gating override: bucket (%d,%d) forced to naive (samples=%d < %d)",
                dow, hour, samples, MIN_BUCKET_SAMPLES_FOR_ML,
            )

    return registry


# ─── Main Pipeline ───────────────────────────────────────────────────────────

class HourlyForecaster:
    """
    Full hourly forecast pipeline for one location.

    Usage:
        forecaster = HourlyForecaster(location_id="abc", location_name="Test")
        result = forecaster.run(sales_15m_rows, horizon_days=14, enable_gating=True)
    """

    def __init__(self, location_id: str, location_name: str = ""):
        self.location_id = location_id
        self.location_name = location_name

    def run(self, sales_15m: list[dict], horizon_days: int = 14, enable_gating: bool = False) -> dict:
        """
        Execute the full pipeline:
          1. Aggregate 15-min → hourly
          2. Fill grid (24h/day)
          3. Build features
          3b. Data availability gating (if enabled)
          4. Train/test split
          5. Train LightGBM + Seasonal Naive
          6. Evaluate per bucket → registry (with gating overrides)
          7. Predict future (with optional blending)
          8. Aggregate to daily for backwards compat
        """
        logger.info(
            "Starting hourly forecast: location=%s, records=%d, horizon=%d days, gating=%s",
            self.location_name or self.location_id, len(sales_15m), horizon_days, enable_gating,
        )

        # Step 1-2: Aggregate and fill grid
        hourly = aggregate_to_hourly(sales_15m)
        if len(hourly) == 0:
            return self._empty_result("No hourly data after aggregation")

        n_days = hourly["sale_date"].nunique()
        logger.info("Aggregated to %d hourly rows across %d days", len(hourly), n_days)

        df = fill_hourly_grid(hourly)
        logger.info("Full grid: %d rows (%d days × 24h)", len(df), n_days)

        # Step 3: Build features
        df = build_features(df)

        # Step 3b: Data availability gating
        if enable_gating:
            gating = compute_gating(hourly)
            logger.info(
                "Gating: sufficiency=%s, blend_ratio=%.2f, total_days=%d, min_bucket_samples=%d",
                gating["sufficiency"], gating["blend_ratio"],
                gating["total_days"], gating["min_bucket_samples"],
            )
        else:
            gating = {
                "sufficiency": "HIGH",
                "blend_ratio": 1.0,
                "total_days": n_days,
                "min_bucket_samples": 0,
                "algorithm": "LightGBM_ChampionChallenger",
            }

        # Step 4: Train/test split
        all_dates = sorted(df["sale_date"].unique())
        if n_days < MIN_DAYS_NAIVE:
            result = self._empty_result(f"Need {MIN_DAYS_NAIVE}+ days, got {n_days}")
            result["gating"] = gating
            return result

        holdout_days = min(HOLDOUT_DAYS, max(7, n_days // 4))
        split_date = all_dates[-(holdout_days + 1)]
        df_train = df[df["sale_date"] <= split_date].copy()
        df_test = df[df["sale_date"] > split_date].copy()

        logger.info(
            "Split: train=%d rows (up to %s), test=%d rows (%d days)",
            len(df_train), split_date, len(df_test), holdout_days,
        )

        # Step 5: Train models — gating controls whether LightGBM trains
        lgbm_model = None
        use_lgbm = n_days >= MIN_DAYS_LGBM and gating["sufficiency"] != "LOW"

        if use_lgbm:
            try:
                lgbm_model = train_lgbm(df_train)
            except Exception as e:
                logger.warning("LightGBM training failed, using naive only: %s", e)
                use_lgbm = False

        # Step 5b: Generate predictions on test set
        if use_lgbm and lgbm_model is not None:
            lgbm_test_preds = predict_lgbm(lgbm_model, df_test)
            # Fill NaN predictions with naive
            nan_mask = np.isnan(lgbm_test_preds)
            if nan_mask.any():
                naive_fallback = seasonal_naive_predictions(df_test)
                lgbm_test_preds[nan_mask] = naive_fallback[nan_mask]
        else:
            lgbm_test_preds = seasonal_naive_predictions(df_test)

        naive_test_preds = seasonal_naive_predictions(df_test)

        # Step 6: Evaluate per bucket
        registry = evaluate_per_bucket(df_test, lgbm_test_preds, naive_test_preds)

        # Apply gating overrides to registry
        if enable_gating:
            active = hourly[hourly["sales_net"] > 0]
            bucket_counts = active.groupby(["day_of_week", "hour_of_day"]).size() if len(active) > 0 else pd.Series(dtype=int)
            registry = apply_gating_to_registry(registry, gating, bucket_counts)

        # Conformal intervals for LightGBM
        conformal = compute_conformal_intervals(df_test, lgbm_test_preds)

        # Log registry summary
        lgbm_wins = sum(1 for v in registry.values() if v["champion_model"] == "lgbm")
        naive_wins = sum(1 for v in registry.values() if v["champion_model"] == "seasonal_naive")
        logger.info("Registry: LightGBM wins %d buckets, Naive wins %d buckets", lgbm_wins, naive_wins)

        # Step 7: Predict future
        today = datetime.utcnow().date()
        future_dates = [today + timedelta(days=d) for d in range(1, horizon_days + 1)]

        hourly_forecasts = predict_future(
            df_history=df,
            future_dates=future_dates,
            registry=registry,
            lgbm_model=lgbm_model if use_lgbm else None,
            conformal_intervals=conformal,
        )

        # Step 7b: Apply blending for MID tier
        if enable_gating and gating["sufficiency"] == "MID" and use_lgbm and lgbm_model is not None:
            blend_w = gating["blend_ratio"]  # 0.3 for LightGBM
            naive_w = 1.0 - blend_w
            # Re-generate naive-only forecasts for blending
            naive_only_forecasts = predict_future(
                df_history=df,
                future_dates=future_dates,
                registry={k: {**v, "champion_model": "seasonal_naive"} for k, v in registry.items()},
                lgbm_model=None,
                conformal_intervals=conformal,
            )
            for i, (hf, nf) in enumerate(zip(hourly_forecasts, naive_only_forecasts)):
                hourly_forecasts[i] = {
                    **hf,
                    "forecast_sales": round(hf["forecast_sales"] * blend_w + nf["forecast_sales"] * naive_w, 2),
                    "forecast_sales_lower": round(hf["forecast_sales_lower"] * blend_w + nf["forecast_sales_lower"] * naive_w, 2),
                    "forecast_sales_upper": round(hf["forecast_sales_upper"] * blend_w + nf["forecast_sales_upper"] * naive_w, 2),
                    "forecast_orders": round(hf["forecast_orders"] * blend_w + nf["forecast_orders"] * naive_w, 1),
                    "forecast_covers": round(hf["forecast_covers"] * blend_w + nf["forecast_covers"] * naive_w, 1),
                    "model_type": "blend_naive70_lgbm30",
                }
            logger.info("Applied MID blending: naive=%.0f%%, lgbm=%.0f%%", naive_w * 100, blend_w * 100)

        # Step 8: Aggregate to daily for backwards compat
        daily_forecasts = self._aggregate_to_daily(hourly_forecasts)

        # Compute global metrics on test set
        actual_test = df_test["sales_net"].values
        best_preds = np.where(
            np.array([
                registry.get((int(row["day_of_week"]), int(row["hour_of_day"])), {}).get("champion_model") == "lgbm"
                for _, row in df_test.iterrows()
            ]),
            lgbm_test_preds,
            naive_test_preds,
        )
        global_wmape = wmape(actual_test, best_preds)
        seasonal_ref = df_test["lag_168"].fillna(0).values
        global_mase = mase(actual_test, best_preds, seasonal_ref)
        global_bias = forecast_bias(actual_test, best_preds)
        global_da = directional_accuracy(actual_test, best_preds)

        logger.info(
            "Global metrics: WMAPE=%.1f%% MASE=%.3f Bias=%.1f%% DirAcc=%.0f%%",
            global_wmape * 100, global_mase, global_bias * 100, global_da * 100,
        )

        return {
            "success": True,
            "location_id": self.location_id,
            "location_name": self.location_name,
            "model_version": "HourlyEngine_v1.0",
            "data_points": len(df),
            "history_days": n_days,
            "horizon_days": horizon_days,
            "lgbm_used": use_lgbm,
            "gating": gating,
            "metrics": {
                "wmape": round(global_wmape, 4),
                "mase": round(global_mase, 4),
                "bias": round(global_bias, 4),
                "directional_accuracy": round(global_da, 4),
            },
            "registry_summary": {
                "lgbm_wins": lgbm_wins,
                "naive_wins": naive_wins,
                "total_buckets": len(registry),
            },
            "hourly_forecasts": hourly_forecasts,
            "daily_forecasts": daily_forecasts,
            "model_registry": self._registry_to_rows(registry),
        }

    def _aggregate_to_daily(self, hourly_forecasts: list[dict]) -> list[dict]:
        """SUM hourly forecasts → daily for backwards compat with forecast_daily_metrics."""
        daily: dict[str, dict] = {}
        for hf in hourly_forecasts:
            d = hf["forecast_date"]
            if d not in daily:
                daily[d] = {
                    "date": d,
                    "forecast_sales": 0,
                    "forecast_sales_lower": 0,
                    "forecast_sales_upper": 0,
                    "forecast_orders": 0,
                }
            daily[d]["forecast_sales"] += hf["forecast_sales"]
            daily[d]["forecast_sales_lower"] += hf["forecast_sales_lower"]
            daily[d]["forecast_sales_upper"] += hf["forecast_sales_upper"]
            daily[d]["forecast_orders"] += hf["forecast_orders"]

        # Round values
        for d_data in daily.values():
            d_data["forecast_sales"] = round(d_data["forecast_sales"], 2)
            d_data["forecast_sales_lower"] = round(d_data["forecast_sales_lower"], 2)
            d_data["forecast_sales_upper"] = round(d_data["forecast_sales_upper"], 2)
            d_data["forecast_orders"] = round(d_data["forecast_orders"], 1)

        return sorted(daily.values(), key=lambda x: x["date"])

    def _registry_to_rows(self, registry: dict) -> list[dict]:
        """Convert (dow, hour) → metrics dict to flat rows for DB storage."""
        rows = []
        for (dow, hour), data in registry.items():
            rows.append({
                "location_id": self.location_id,
                "day_of_week": dow,
                "hour_of_day": hour,
                **data,
                "last_evaluated_at": datetime.utcnow().isoformat(),
            })
        return rows

    def _empty_result(self, reason: str) -> dict:
        logger.warning("Hourly forecast skipped: %s", reason)
        return {
            "success": False,
            "location_id": self.location_id,
            "location_name": self.location_name,
            "error": reason,
            "hourly_forecasts": [],
            "daily_forecasts": [],
            "model_registry": [],
        }
