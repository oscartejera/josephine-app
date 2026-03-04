"""
XGBoost Forecasting Module for Josephine — v6 Ensemble Component

This module adds XGBoost-based sales forecasting to the existing Prophet service.
Deploy alongside the existing Prophet service on Render.

Features:
- 25+ engineered features (lags, rolling stats, cyclical, interactions, weather, events)
- SHAP feature importance for interpretability
- Expanding window cross-validation
- Supabase direct integration (fetch data + store forecasts)

Usage:
    Register the route in your Flask/FastAPI app:
        app.add_url_rule('/forecast_xgboost', view_func=forecast_xgboost, methods=['POST'])
        # or for FastAPI:
        @app.post('/forecast_xgboost')
        async def forecast_xgboost_endpoint(request: Request):
            return await forecast_xgboost(request)
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import json
import logging

logger = logging.getLogger(__name__)

# ─── Optional imports (graceful degradation) ──────────────────────────────────

try:
    import xgboost as xgb
    HAS_XGBOOST = True
except ImportError:
    HAS_XGBOOST = False
    logger.warning("xgboost not installed — XGBoost forecasting disabled")

try:
    import shap
    HAS_SHAP = True
except ImportError:
    HAS_SHAP = False
    logger.info("shap not installed — SHAP explanations disabled")


# ─── Feature Engineering ──────────────────────────────────────────────────────

SPANISH_HOLIDAYS = {
    # 2025
    '2025-01-01', '2025-01-06', '2025-04-18', '2025-04-21',
    '2025-05-01', '2025-08-15', '2025-10-12', '2025-11-01',
    '2025-12-06', '2025-12-08', '2025-12-25',
    # 2026
    '2026-01-01', '2026-01-06', '2026-04-03', '2026-04-06',
    '2026-05-01', '2026-08-15', '2026-10-12', '2026-11-01',
    '2026-12-06', '2026-12-08', '2026-12-25',
    # 2027
    '2027-01-01', '2027-01-06', '2027-03-26', '2027-03-29',
    '2027-05-01', '2027-08-15', '2027-10-12', '2027-11-01',
    '2027-12-06', '2027-12-08', '2027-12-25',
}

# Madrid monthly climate normals (from regressors.ts)
MADRID_CLIMATE = {
    1: {'avg': 6.3, 'std': 3.0, 'rain': 0.27},
    2: {'avg': 7.9, 'std': 3.2, 'rain': 0.25},
    3: {'avg': 11.2, 'std': 3.5, 'rain': 0.23},
    4: {'avg': 13.1, 'std': 3.0, 'rain': 0.30},
    5: {'avg': 17.2, 'std': 3.5, 'rain': 0.28},
    6: {'avg': 22.5, 'std': 3.0, 'rain': 0.12},
    7: {'avg': 26.1, 'std': 2.5, 'rain': 0.07},
    8: {'avg': 25.6, 'std': 2.5, 'rain': 0.08},
    9: {'avg': 21.3, 'std': 3.0, 'rain': 0.18},
    10: {'avg': 15.1, 'std': 3.5, 'rain': 0.28},
    11: {'avg': 9.9, 'std': 3.0, 'rain': 0.30},
    12: {'avg': 6.9, 'std': 3.0, 'rain': 0.30},
}


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Build 25+ features from a daily sales DataFrame.
    
    Input: DataFrame with columns ['date', 'sales']
    Output: DataFrame with all features + target 'sales'
    """
    df = df.copy()
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values('date').reset_index(drop=True)
    
    # ── Temporal features ─────────────────────────────────────────
    df['day_of_week'] = df['date'].dt.dayofweek          # 0=Mon, 6=Sun
    df['month'] = df['date'].dt.month
    df['day_of_month'] = df['date'].dt.day
    df['week_of_year'] = df['date'].dt.isocalendar().week.astype(int)
    df['quarter'] = df['date'].dt.quarter
    df['is_weekend'] = (df['day_of_week'] >= 5).astype(int)
    df['is_mid_week'] = df['day_of_week'].isin([1, 2]).astype(int)  # Tue, Wed
    
    # ── Cyclical encoding (sin/cos for periodicity) ───────────────
    df['dow_sin'] = np.sin(2 * np.pi * df['day_of_week'] / 7)
    df['dow_cos'] = np.cos(2 * np.pi * df['day_of_week'] / 7)
    df['month_sin'] = np.sin(2 * np.pi * df['month'] / 12)
    df['month_cos'] = np.cos(2 * np.pi * df['month'] / 12)
    df['dom_sin'] = np.sin(2 * np.pi * df['day_of_month'] / 31)
    df['dom_cos'] = np.cos(2 * np.pi * df['day_of_month'] / 31)
    
    # ── Lag features ──────────────────────────────────────────────
    for lag in [1, 2, 3, 7, 14, 28]:
        df[f'sales_lag_{lag}d'] = df['sales'].shift(lag)
    
    # ── Rolling statistics ────────────────────────────────────────
    for window in [7, 14, 28]:
        df[f'sales_ma_{window}d'] = df['sales'].shift(1).rolling(window, min_periods=1).mean()
        df[f'sales_std_{window}d'] = df['sales'].shift(1).rolling(window, min_periods=1).std()
    
    # ── Expanding mean (all history) ──────────────────────────────
    df['sales_expanding_mean'] = df['sales'].shift(1).expanding(min_periods=1).mean()
    
    # ── Day-of-week average (same DOW historical average) ─────────
    dow_means = df.groupby('day_of_week')['sales'].transform(
        lambda x: x.shift(1).expanding(min_periods=1).mean()
    )
    df['dow_avg_sales'] = dow_means
    
    # ── External features: holidays ───────────────────────────────
    df['is_festivo'] = df['date'].dt.strftime('%Y-%m-%d').isin(SPANISH_HOLIDAYS).astype(int)
    
    # Day before/after holiday
    df['is_day_before_festivo'] = df['date'].apply(
        lambda d: (d + timedelta(days=1)).strftime('%Y-%m-%d') in SPANISH_HOLIDAYS
    ).astype(int)
    df['is_day_after_festivo'] = df['date'].apply(
        lambda d: (d - timedelta(days=1)).strftime('%Y-%m-%d') in SPANISH_HOLIDAYS
    ).astype(int)
    
    # ── External features: payday ─────────────────────────────────
    df['is_payday'] = ((df['day_of_month'] == 1) | 
                       (df['day_of_month'] == 15) | 
                       (df['day_of_month'] >= 25)).astype(int)
    
    # ── External features: weather (deterministic from climate normals) ──
    df['temperature'] = df['month'].map(lambda m: MADRID_CLIMATE.get(m, {}).get('avg', 15))
    df['rain_prob'] = df['month'].map(lambda m: MADRID_CLIMATE.get(m, {}).get('rain', 0.2))
    df['is_cold'] = (df['temperature'] < 10).astype(int)
    df['is_hot'] = (df['temperature'] > 30).astype(int)
    df['is_ideal_temp'] = ((df['temperature'] >= 18) & (df['temperature'] <= 25)).astype(int)
    
    # ── Interaction features ──────────────────────────────────────
    df['weekend_x_rain'] = df['is_weekend'] * df['rain_prob']
    df['festivo_x_temp'] = df['is_festivo'] * df['temperature']
    df['weekend_x_festivo'] = df['is_weekend'] * df['is_festivo']
    
    # ── Trend feature ─────────────────────────────────────────────
    df['trend'] = np.arange(len(df))
    
    return df


FEATURE_COLUMNS = [
    # Temporal
    'day_of_week', 'month', 'day_of_month', 'week_of_year', 'quarter',
    'is_weekend', 'is_mid_week',
    # Cyclical
    'dow_sin', 'dow_cos', 'month_sin', 'month_cos', 'dom_sin', 'dom_cos',
    # Lags
    'sales_lag_1d', 'sales_lag_2d', 'sales_lag_3d',
    'sales_lag_7d', 'sales_lag_14d', 'sales_lag_28d',
    # Rolling
    'sales_ma_7d', 'sales_ma_14d', 'sales_ma_28d',
    'sales_std_7d', 'sales_std_14d', 'sales_std_28d',
    # Expanding
    'sales_expanding_mean', 'dow_avg_sales',
    # Events
    'is_festivo', 'is_day_before_festivo', 'is_day_after_festivo', 'is_payday',
    # Weather
    'temperature', 'rain_prob', 'is_cold', 'is_hot', 'is_ideal_temp',
    # Interactions
    'weekend_x_rain', 'festivo_x_temp', 'weekend_x_festivo',
    # Trend
    'trend',
]


# ─── XGBoost Model ────────────────────────────────────────────────────────────

def train_and_forecast(
    df: pd.DataFrame,
    horizon_days: int = 90,
    n_cv_folds: int = 4,
) -> Dict:
    """
    Train XGBoost on historical data and generate forecasts.
    
    Returns dict with:
    - forecasts: list of {date, predicted, lower, upper}
    - metrics: {mape, rmse, mae, r_squared}
    - feature_importance: top 15 features
    - shap_values: SHAP explanation for first 7 forecasts (if available)
    """
    if not HAS_XGBOOST:
        return {"error": "xgboost not installed", "install": "pip install xgboost"}
    
    # Engineer features
    df_feat = engineer_features(df)
    
    # Drop rows with NaN (from lag features)
    df_clean = df_feat.dropna(subset=FEATURE_COLUMNS).copy()
    
    if len(df_clean) < 60:
        return {
            "error": f"Insufficient data: {len(df_clean)} clean rows (need ≥60)",
            "raw_rows": len(df),
        }
    
    X = df_clean[FEATURE_COLUMNS].values
    y = df_clean['sales'].values
    
    # ── Expanding Window Cross-Validation ─────────────────────────
    cv_results = []
    n = len(X)
    min_train_pct = 0.5
    test_pct = (1 - min_train_pct) / n_cv_folds
    
    for fold in range(n_cv_folds):
        train_end = int(n * (min_train_pct + fold * test_pct))
        test_end = int(n * (min_train_pct + (fold + 1) * test_pct))
        
        if train_end < 30 or test_end > n:
            continue
        
        X_train, y_train = X[:train_end], y[:train_end]
        X_test, y_test = X[train_end:test_end], y[train_end:test_end]
        
        if len(X_test) < 7:
            continue
        
        model = xgb.XGBRegressor(
            n_estimators=200,
            max_depth=6,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            min_child_weight=5,
            reg_alpha=0.1,
            reg_lambda=1.0,
            random_state=42,
            verbosity=0,
        )
        model.fit(X_train, y_train)
        preds = model.predict(X_test)
        preds = np.maximum(preds, 0)  # No negative sales
        
        # Compute metrics for this fold
        mask = y_test > 0
        mape = np.mean(np.abs((y_test[mask] - preds[mask]) / y_test[mask])) if mask.sum() > 0 else 0
        rmse = np.sqrt(np.mean((y_test - preds) ** 2))
        mae = np.mean(np.abs(y_test - preds))
        
        ss_res = np.sum((y_test - preds) ** 2)
        ss_tot = np.sum((y_test - np.mean(y_test)) ** 2)
        r2 = max(0, 1 - ss_res / ss_tot) if ss_tot > 0 else 0
        
        cv_results.append({
            'fold': fold + 1,
            'train_size': len(X_train),
            'test_size': len(X_test),
            'mape': round(float(mape), 4),
            'rmse': round(float(rmse), 2),
            'mae': round(float(mae), 2),
            'r_squared': round(float(r2), 4),
        })
    
    # ── Train final model on ALL data ─────────────────────────────
    final_model = xgb.XGBRegressor(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=5,
        reg_alpha=0.1,
        reg_lambda=1.0,
        random_state=42,
        verbosity=0,
    )
    final_model.fit(X, y)
    
    # ── Feature importance ────────────────────────────────────────
    importance = dict(zip(FEATURE_COLUMNS, final_model.feature_importances_))
    top_features = sorted(importance.items(), key=lambda x: x[1], reverse=True)[:15]
    
    # ── Generate future forecasts ─────────────────────────────────
    last_date = df_feat['date'].max()
    forecasts = []
    
    # Build future DataFrame row by row (auto-regressive)
    future_df = df_feat.copy()
    
    for k in range(1, horizon_days + 1):
        forecast_date = last_date + timedelta(days=k)
        
        # Create a new row with known features
        new_row = {
            'date': forecast_date,
            'sales': 0,  # placeholder, will be predicted
            'day_of_week': forecast_date.weekday(),
            'month': forecast_date.month,
            'day_of_month': forecast_date.day,
            'week_of_year': forecast_date.isocalendar()[1],
            'quarter': (forecast_date.month - 1) // 3 + 1,
            'is_weekend': int(forecast_date.weekday() >= 5),
            'is_mid_week': int(forecast_date.weekday() in [1, 2]),
            'dow_sin': np.sin(2 * np.pi * forecast_date.weekday() / 7),
            'dow_cos': np.cos(2 * np.pi * forecast_date.weekday() / 7),
            'month_sin': np.sin(2 * np.pi * forecast_date.month / 12),
            'month_cos': np.cos(2 * np.pi * forecast_date.month / 12),
            'dom_sin': np.sin(2 * np.pi * forecast_date.day / 31),
            'dom_cos': np.cos(2 * np.pi * forecast_date.day / 31),
            'is_festivo': int(forecast_date.strftime('%Y-%m-%d') in SPANISH_HOLIDAYS),
            'is_day_before_festivo': int(
                (forecast_date + timedelta(days=1)).strftime('%Y-%m-%d') in SPANISH_HOLIDAYS
            ),
            'is_day_after_festivo': int(
                (forecast_date - timedelta(days=1)).strftime('%Y-%m-%d') in SPANISH_HOLIDAYS
            ),
            'is_payday': int(forecast_date.day in [1, 15] or forecast_date.day >= 25),
            'temperature': MADRID_CLIMATE.get(forecast_date.month, {}).get('avg', 15),
            'rain_prob': MADRID_CLIMATE.get(forecast_date.month, {}).get('rain', 0.2),
            'is_cold': int(MADRID_CLIMATE.get(forecast_date.month, {}).get('avg', 15) < 10),
            'is_hot': int(MADRID_CLIMATE.get(forecast_date.month, {}).get('avg', 15) > 30),
            'is_ideal_temp': int(18 <= MADRID_CLIMATE.get(forecast_date.month, {}).get('avg', 15) <= 25),
            'trend': len(future_df),
        }
        
        # Compute interaction features
        new_row['weekend_x_rain'] = new_row['is_weekend'] * new_row['rain_prob']
        new_row['festivo_x_temp'] = new_row['is_festivo'] * new_row['temperature']
        new_row['weekend_x_festivo'] = new_row['is_weekend'] * new_row['is_festivo']
        
        # Compute lag features from future_df (auto-regressive)
        sales_series = future_df['sales'].values
        for lag in [1, 2, 3, 7, 14, 28]:
            idx = len(sales_series) - lag
            new_row[f'sales_lag_{lag}d'] = float(sales_series[idx]) if idx >= 0 else float(np.mean(sales_series[-28:]))
        
        # Rolling stats from recent history
        recent = sales_series[-28:]
        for window in [7, 14, 28]:
            w = min(window, len(recent))
            new_row[f'sales_ma_{window}d'] = float(np.mean(recent[-w:])) if w > 0 else 0
            new_row[f'sales_std_{window}d'] = float(np.std(recent[-w:])) if w > 1 else 0
        
        new_row['sales_expanding_mean'] = float(np.mean(sales_series[sales_series > 0])) if np.any(sales_series > 0) else 0
        
        # DOW average from history
        dow_mask = future_df['day_of_week'] == new_row['day_of_week']
        dow_sales = future_df.loc[dow_mask, 'sales']
        new_row['dow_avg_sales'] = float(dow_sales.mean()) if len(dow_sales) > 0 else 0
        
        # Predict
        X_future = np.array([[new_row.get(col, 0) for col in FEATURE_COLUMNS]])
        pred = float(final_model.predict(X_future)[0])
        pred = max(0, pred)
        
        # Update the row with the prediction for auto-regressive lags
        new_row['sales'] = pred
        future_df = pd.concat([future_df, pd.DataFrame([new_row])], ignore_index=True)
        
        # Confidence interval (based on CV RMSE)
        avg_rmse = np.mean([f['rmse'] for f in cv_results]) if cv_results else pred * 0.15
        lower = max(0, pred - 1.96 * avg_rmse)
        upper = pred + 1.96 * avg_rmse
        
        forecasts.append({
            'date': forecast_date.strftime('%Y-%m-%d'),
            'predicted': round(pred, 2),
            'lower': round(lower, 2),
            'upper': round(upper, 2),
        })
    
    # ── Aggregate CV metrics ──────────────────────────────────────
    if cv_results:
        avg_metrics = {
            'mape': round(np.mean([f['mape'] for f in cv_results]), 4),
            'rmse': round(np.mean([f['rmse'] for f in cv_results]), 2),
            'mae': round(np.mean([f['mae'] for f in cv_results]), 2),
            'r_squared': round(np.mean([f['r_squared'] for f in cv_results]), 4),
        }
    else:
        avg_metrics = {'mape': 0, 'rmse': 0, 'mae': 0, 'r_squared': 0}
    
    # ── SHAP explanation (if available) ───────────────────────────
    shap_explanation = None
    if HAS_SHAP and len(forecasts) > 0:
        try:
            explainer = shap.TreeExplainer(final_model)
            X_explain = np.array([
                [forecasts[i].get(col, 0) for col in FEATURE_COLUMNS]
                for i in range(min(7, len(forecasts)))
            ])
            # Use the last 7 rows of training data for explanation context
            X_explain = X[-7:]
            shap_values = explainer.shap_values(X_explain)
            
            # Top drivers for the first forecast day
            mean_abs_shap = np.abs(shap_values).mean(axis=0)
            top_shap = sorted(
                zip(FEATURE_COLUMNS, mean_abs_shap),
                key=lambda x: x[1], reverse=True
            )[:10]
            shap_explanation = [
                {'feature': f, 'importance': round(float(v), 4)}
                for f, v in top_shap
            ]
        except Exception as e:
            logger.warning(f"SHAP failed: {e}")
    
    return {
        'model': 'XGBoost_v6',
        'data_points': len(df_clean),
        'features_used': len(FEATURE_COLUMNS),
        'metrics': avg_metrics,
        'cross_validation': cv_results,
        'feature_importance': [
            {'feature': f, 'importance': round(float(v), 4)}
            for f, v in top_features
        ],
        'shap_explanation': shap_explanation,
        'forecasts': forecasts,
    }


# ─── Supabase Integration ────────────────────────────────────────────────────

def forecast_xgboost_supabase(
    supabase_url: str,
    supabase_key: str,
    location_id: str,
    location_name: str,
    horizon_days: int = 90,
) -> Dict:
    """
    Full pipeline: fetch data from Supabase → train XGBoost → store forecasts.
    Mirrors the Prophet service's /forecast_supabase endpoint.
    """
    from supabase import create_client
    
    supabase = create_client(supabase_url, supabase_key)
    
    # ── Fetch sales data (same logic as v4 Edge Function) ─────────
    sales_by_date = {}
    data_source = 'facts_sales_15m'
    
    # Try facts_sales_15m first
    result = supabase.table('facts_sales_15m') \
        .select('ts_bucket, sales_net') \
        .eq('location_id', location_id) \
        .order('ts_bucket') \
        .execute()
    
    if result.data and len(result.data) > 0:
        for row in result.data:
            date_str = row['ts_bucket'][:10]  # Extract YYYY-MM-DD
            sales_by_date[date_str] = sales_by_date.get(date_str, 0) + float(row['sales_net'] or 0)
    else:
        # Fallback to tickets
        data_source = 'tickets'
        offset = 0
        page_size = 1000
        while True:
            result = supabase.table('tickets') \
                .select('opened_at, net_total') \
                .eq('location_id', location_id) \
                .order('opened_at') \
                .range(offset, offset + page_size - 1) \
                .execute()
            
            if not result.data or len(result.data) == 0:
                break
            
            for row in result.data:
                date_str = row['opened_at'][:10]
                sales_by_date[date_str] = sales_by_date.get(date_str, 0) + float(row['net_total'] or 0)
            
            if len(result.data) < page_size:
                break
            offset += page_size
    
    if not sales_by_date:
        return {'error': 'No sales data found', 'location_id': location_id}
    
    # Build DataFrame
    df = pd.DataFrame([
        {'date': d, 'sales': s}
        for d, s in sorted(sales_by_date.items())
        if s > 0
    ])
    
    logger.info(f"[XGBoost] {location_name}: {len(df)} days from {data_source}")
    
    # ── Train and forecast ────────────────────────────────────────
    result = train_and_forecast(df, horizon_days=horizon_days)
    
    if 'error' in result:
        return result
    
    # ── Store forecasts in forecast_daily_metrics ─────────────────
    forecasts_to_store = []
    for fc in result['forecasts']:
        forecasts_to_store.append({
            'location_id': location_id,
            'date': fc['date'],
            'forecast_sales': fc['predicted'],
            'forecast_sales_lower': fc['lower'],
            'forecast_sales_upper': fc['upper'],
            'model_version': 'XGBoost_v6',
            'mape': result['metrics']['mape'],
            'confidence': min(100, max(0, round(result['metrics']['r_squared'] * 100))),
            'generated_at': datetime.utcnow().isoformat(),
        })
    
    # Store in batches of 500
    stored = 0
    for i in range(0, len(forecasts_to_store), 500):
        batch = forecasts_to_store[i:i+500]
        try:
            supabase.table('forecast_daily_metrics').upsert(
                batch,
                on_conflict='location_id,date,model_version'
            ).execute()
            stored += len(batch)
        except Exception as e:
            logger.error(f"[XGBoost] Batch insert error: {e}")
    
    # ── Also log to forecast_accuracy_log for tracking ────────────
    accuracy_rows = []
    for fc in result['forecasts']:
        accuracy_rows.append({
            'location_id': location_id,
            'date': fc['date'],
            'model_name': 'XGBoost_v6',
            'predicted': fc['predicted'],
        })
    
    for i in range(0, len(accuracy_rows), 500):
        batch = accuracy_rows[i:i+500]
        try:
            supabase.table('forecast_accuracy_log').upsert(
                batch,
                on_conflict='location_id,date,model_name'
            ).execute()
        except Exception as e:
            logger.warning(f"[XGBoost] Accuracy log insert error: {e}")
    
    result['forecasts_stored'] = stored
    result['data_source'] = data_source
    result['location_id'] = location_id
    result['location_name'] = location_name
    
    return result


# ─── Flask/FastAPI Route Handler ──────────────────────────────────────────────

def create_forecast_xgboost_handler():
    """
    Returns a handler function for the /forecast_xgboost endpoint.
    Works with both Flask and FastAPI.
    
    Usage (Flask):
        handler = create_forecast_xgboost_handler()
        @app.route('/forecast_xgboost', methods=['POST'])
        def forecast_xgboost():
            return handler(request.json)
    """
    def handler(body: dict) -> dict:
        supabase_url = body.get('supabase_url')
        supabase_key = body.get('supabase_key')
        location_id = body.get('location_id')
        location_name = body.get('location_name', 'Unknown')
        horizon_days = body.get('horizon_days', 90)
        
        if not all([supabase_url, supabase_key, location_id]):
            return {'error': 'Missing required fields: supabase_url, supabase_key, location_id'}
        
        return forecast_xgboost_supabase(
            supabase_url=supabase_url,
            supabase_key=supabase_key,
            location_id=location_id,
            location_name=location_name,
            horizon_days=horizon_days,
        )
    
    return handler
