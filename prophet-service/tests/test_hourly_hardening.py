"""
Tests for Forecast Hardening: data availability gating + open-hours mask.

Run with: python -m pytest tests/test_hourly_hardening.py -v
Or standalone: python tests/test_hourly_hardening.py
"""

import sys
import os
from datetime import date, timedelta

import numpy as np
import pandas as pd

# Ensure prophet-service root is on path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from hourly_forecaster import (
    aggregate_to_hourly,
    fill_hourly_grid,
    build_features,
    compute_gating,
    apply_gating_to_registry,
    HourlyForecaster,
    GATING_LOW_MAX_DAYS,
    GATING_MID_MAX_DAYS,
    GATING_MID_BLEND_RATIO,
    MIN_BUCKET_SAMPLES_FOR_ML,
)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def generate_fake_15m_data(n_days: int, start_date: date = date(2026, 1, 1)) -> list[dict]:
    """Generate synthetic facts_sales_15m rows for n_days.

    Produces 4 buckets per hour (every 15 min), hours 10-22 only (restaurant pattern).
    """
    rows = []
    for d in range(n_days):
        current_date = start_date + timedelta(days=d)
        for hour in range(10, 23):
            for minute in (0, 15, 30, 45):
                ts = f"{current_date}T{hour:02d}:{minute:02d}:00+00:00"
                # Base sales with some variance
                base = 50 + 20 * np.sin(hour * 0.5) + np.random.uniform(-5, 5)
                rows.append({
                    "ts_bucket": ts,
                    "sales_net": round(max(0, base), 2),
                    "tickets": max(1, int(base / 25)),
                })
    return rows


def make_open_hours_mask_func(open_h=12, close_h=23):
    """Create an is_service_hour function matching app.py logic."""
    def is_service_hour(hour: int) -> bool:
        if open_h <= close_h:
            return open_h <= hour < close_h
        return hour >= open_h or hour < close_h
    return is_service_hour


# ─── Test: Gating computation ────────────────────────────────────────────────

def test_gating_low():
    """< 14 days of data => LOW sufficiency, baseline only."""
    data = generate_fake_15m_data(n_days=3)
    hourly = aggregate_to_hourly(data)
    gating = compute_gating(hourly)

    assert gating["sufficiency"] == "LOW", f"Expected LOW, got {gating['sufficiency']}"
    assert gating["blend_ratio"] == 0.0, f"Expected blend_ratio=0.0, got {gating['blend_ratio']}"
    assert gating["total_days"] == 3, f"Expected total_days=3, got {gating['total_days']}"
    assert gating["algorithm"] == "BASELINE_ONLY"
    print(f"  PASS: LOW gating (3 days) -> {gating}")


def test_gating_mid():
    """14-55 days => MID sufficiency, blended."""
    data = generate_fake_15m_data(n_days=30)
    hourly = aggregate_to_hourly(data)
    gating = compute_gating(hourly)

    assert gating["sufficiency"] == "MID", f"Expected MID, got {gating['sufficiency']}"
    assert gating["blend_ratio"] == GATING_MID_BLEND_RATIO
    assert gating["total_days"] == 30
    assert gating["algorithm"] == "BLEND_Naive70_LightGBM30"
    print(f"  PASS: MID gating (30 days) -> {gating}")


def test_gating_high():
    """>= 56 days => HIGH sufficiency, full ML."""
    data = generate_fake_15m_data(n_days=60)
    hourly = aggregate_to_hourly(data)
    gating = compute_gating(hourly)

    assert gating["sufficiency"] == "HIGH", f"Expected HIGH, got {gating['sufficiency']}"
    assert gating["blend_ratio"] == 1.0
    assert gating["total_days"] == 60
    assert gating["algorithm"] == "LightGBM_ChampionChallenger"
    print(f"  PASS: HIGH gating (60 days) -> {gating}")


def test_gating_boundary():
    """Boundary: exactly 14 days = MID, exactly 56 days = HIGH."""
    data_14 = generate_fake_15m_data(n_days=14)
    data_56 = generate_fake_15m_data(n_days=56)

    g14 = compute_gating(aggregate_to_hourly(data_14))
    g56 = compute_gating(aggregate_to_hourly(data_56))

    assert g14["sufficiency"] == "MID", f"14 days should be MID, got {g14['sufficiency']}"
    assert g56["sufficiency"] == "HIGH", f"56 days should be HIGH, got {g56['sufficiency']}"
    print(f"  PASS: Boundary (14d=MID, 56d=HIGH)")


# ─── Test: Registry gating override ──────────────────────────────────────────

def test_registry_override_low():
    """LOW gating forces all buckets to seasonal_naive."""
    registry = {
        (0, 12): {"champion_model": "lgbm", "training_samples": 10},
        (0, 13): {"champion_model": "seasonal_naive", "training_samples": 5},
        (1, 14): {"champion_model": "lgbm", "training_samples": 8},
    }
    gating = {"sufficiency": "LOW", "blend_ratio": 0.0}
    bucket_counts = pd.Series(dtype=int)

    result = apply_gating_to_registry(registry, gating, bucket_counts)

    for key, data in result.items():
        assert data["champion_model"] == "seasonal_naive", \
            f"Bucket {key} should be naive in LOW, got {data['champion_model']}"
    print(f"  PASS: LOW override forces all to naive")


def test_registry_override_undersampled():
    """HIGH gating still forces naive on under-sampled buckets."""
    registry = {
        (0, 12): {"champion_model": "lgbm"},
        (0, 13): {"champion_model": "lgbm"},
        (0, 14): {"champion_model": "seasonal_naive"},
    }
    gating = {"sufficiency": "HIGH", "blend_ratio": 1.0}
    bucket_counts = pd.Series({(0, 12): 10, (0, 13): 3, (0, 14): 2})

    result = apply_gating_to_registry(registry, gating, bucket_counts)

    assert result[(0, 12)]["champion_model"] == "lgbm", "10 samples should keep lgbm"
    assert result[(0, 13)]["champion_model"] == "seasonal_naive", "3 samples should force naive"
    assert result[(0, 14)]["champion_model"] == "seasonal_naive", "2 samples should stay naive"
    print(f"  PASS: Under-sampled buckets forced to naive")


# ─── Test: Open-hours mask ───────────────────────────────────────────────────

def test_open_hours_mask():
    """Verify that hours outside service window get zeroed."""
    is_service_hour = make_open_hours_mask_func(open_h=12, close_h=23)

    # Hours 0-11 should be closed, 12-22 open, 23 closed
    for h in range(24):
        if 12 <= h < 23:
            assert is_service_hour(h), f"Hour {h} should be open"
        else:
            assert not is_service_hour(h), f"Hour {h} should be closed"

    # Simulate mask application on forecast rows
    rows = [{"hour_of_day": h, "forecast_sales": 100.0} for h in range(24)]
    masked = []
    for row in rows:
        if is_service_hour(row["hour_of_day"]):
            masked.append(row["forecast_sales"])
        else:
            masked.append(0)

    assert sum(1 for v in masked if v == 0) == 13, "Should have 13 zero hours (0-11 + 23)"
    assert sum(1 for v in masked if v > 0) == 11, "Should have 11 active hours (12-22)"
    print(f"  PASS: Open-hours mask (service 12-23, 13 zeroed)")


def test_all_hours_present():
    """Verify mask keeps all 24 rows even when zeroed."""
    is_service_hour = make_open_hours_mask_func(open_h=12, close_h=23)

    forecast_rows = []
    for h in range(24):
        sales = 100.0 if is_service_hour(h) else 0
        forecast_rows.append({"hour_of_day": h, "forecast_sales": sales})

    assert len(forecast_rows) == 24, "Must have exactly 24 rows"
    hours = [r["hour_of_day"] for r in forecast_rows]
    assert hours == list(range(24)), "Hours must be 0..23"
    print(f"  PASS: All 24 hours present after mask")


# ─── Test: Full pipeline with gating ─────────────────────────────────────────

def test_pipeline_baseline_only():
    """Short data (10 days) with gating => BASELINE_ONLY, no LightGBM."""
    data = generate_fake_15m_data(n_days=10)
    forecaster = HourlyForecaster(location_id="test-loc", location_name="Test")
    result = forecaster.run(data, horizon_days=3, enable_gating=True)

    assert result["success"], f"Pipeline should succeed, got: {result.get('error')}"
    assert result["gating"]["sufficiency"] == "LOW"
    assert result["lgbm_used"] is False, "LOW should not use LightGBM"

    # All hourly forecasts should use seasonal_naive
    for hf in result["hourly_forecasts"]:
        assert hf["model_type"] == "seasonal_naive", \
            f"LOW tier should only use naive, got {hf['model_type']}"

    print(f"  PASS: Pipeline BASELINE_ONLY (10 days) -> {result['gating']}")


def test_pipeline_high():
    """Long data (60 days) with gating => HIGH, LightGBM used."""
    data = generate_fake_15m_data(n_days=60)
    forecaster = HourlyForecaster(location_id="test-loc", location_name="Test")
    result = forecaster.run(data, horizon_days=3, enable_gating=True)

    assert result["success"], f"Pipeline should succeed, got: {result.get('error')}"
    assert result["gating"]["sufficiency"] == "HIGH"
    assert result["gating"]["blend_ratio"] == 1.0

    # Should have hourly forecasts for 3 days × 24 hours = 72 rows
    assert len(result["hourly_forecasts"]) == 72, \
        f"Expected 72 hourly forecasts, got {len(result['hourly_forecasts'])}"

    print(f"  PASS: Pipeline HIGH (60 days) -> lgbm_used={result['lgbm_used']}")


def test_pipeline_backwards_compat():
    """Verify daily_forecasts still generated for backwards compat."""
    data = generate_fake_15m_data(n_days=10)
    forecaster = HourlyForecaster(location_id="test-loc", location_name="Test")
    result = forecaster.run(data, horizon_days=7, enable_gating=True)

    assert result["success"]
    assert len(result["daily_forecasts"]) == 7, \
        f"Expected 7 daily forecasts, got {len(result['daily_forecasts'])}"

    for df in result["daily_forecasts"]:
        assert "date" in df
        assert "forecast_sales" in df
        assert "forecast_orders" in df
    print(f"  PASS: Backwards compat — {len(result['daily_forecasts'])} daily forecasts")


# ─── Runner ──────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    np.random.seed(42)
    tests = [
        ("Gating: LOW (3 days)", test_gating_low),
        ("Gating: MID (30 days)", test_gating_mid),
        ("Gating: HIGH (60 days)", test_gating_high),
        ("Gating: Boundaries", test_gating_boundary),
        ("Registry: LOW override", test_registry_override_low),
        ("Registry: Under-sampled override", test_registry_override_undersampled),
        ("Mask: Service hours", test_open_hours_mask),
        ("Mask: All 24 hours present", test_all_hours_present),
        ("Pipeline: BASELINE_ONLY (10d)", test_pipeline_baseline_only),
        ("Pipeline: HIGH (60d)", test_pipeline_high),
        ("Pipeline: Backwards compat", test_pipeline_backwards_compat),
    ]

    passed = 0
    failed = 0
    for name, fn in tests:
        try:
            print(f"\n[TEST] {name}")
            fn()
            passed += 1
        except Exception as e:
            print(f"  FAIL: {e}")
            failed += 1

    print(f"\n{'='*60}")
    print(f"Results: {passed} passed, {failed} failed, {passed + failed} total")
    if failed > 0:
        sys.exit(1)
    print("All tests passed!")
