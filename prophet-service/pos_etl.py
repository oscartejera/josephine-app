"""
Josephine POS ETL - Convert POS export to Prophet-ready format

Supports:
  - CSV exports from Revel, Square, Toast, Lightspeed, Aloha, etc.
  - Auto-detects date and revenue columns
  - Aggregates to daily totals
  - Adds all 9 regressors (festivos, clima, eventos, etc.)
  - Outputs JSON ready for Prophet API or uploads to Supabase

Usage:
  python pos_etl.py --input ventas.csv --output prophet_data.json
  python pos_etl.py --input ventas.csv --upload --supabase-url URL --supabase-key KEY
"""

import argparse
import csv
import json
import os
import sys
from datetime import datetime, timedelta
from collections import defaultdict
from typing import Optional

# ─── Spanish Holidays 2024-2027 ─────────────────────────────────────────────

SPANISH_HOLIDAYS = {
    # 2024
    "2024-01-01", "2024-01-06", "2024-03-29", "2024-04-01",
    "2024-05-01", "2024-08-15", "2024-10-12", "2024-11-01",
    "2024-12-06", "2024-12-08", "2024-12-25",
    # 2025
    "2025-01-01", "2025-01-06", "2025-04-18", "2025-04-21",
    "2025-05-01", "2025-08-15", "2025-10-12", "2025-11-01",
    "2025-12-06", "2025-12-08", "2025-12-25",
    # 2026
    "2026-01-01", "2026-01-06", "2026-04-03", "2026-04-06",
    "2026-05-01", "2026-08-15", "2026-10-12", "2026-11-01",
    "2026-12-06", "2026-12-08", "2026-12-25",
    # 2027
    "2027-01-01", "2027-01-06", "2027-03-26", "2027-03-29",
    "2027-05-01", "2027-08-15", "2027-10-12", "2027-11-01",
    "2027-12-06", "2027-12-08", "2027-12-25",
}

MADRID_EVENTS = {
    "2025-07-10": 1.4, "2025-07-11": 1.4, "2025-07-12": 1.4,  # Mad Cool
    "2025-05-15": 1.2,  # San Isidro
    "2026-07-09": 1.4, "2026-07-10": 1.4, "2026-07-11": 1.4,
    "2026-05-15": 1.2,
}

# Average temperature by month in Madrid
AVG_TEMP_MADRID = {
    1: 8, 2: 10, 3: 13, 4: 15, 5: 19, 6: 24,
    7: 28, 8: 28, 9: 24, 10: 18, 11: 12, 12: 9,
}

# Rain probability by month in Madrid
RAIN_PROB_MADRID = {
    1: 0.30, 2: 0.28, 3: 0.25, 4: 0.35, 5: 0.30, 6: 0.15,
    7: 0.10, 8: 0.10, 9: 0.20, 10: 0.30, 11: 0.32, 12: 0.35,
}


# ─── Column Detection ───────────────────────────────────────────────────────

DATE_COLUMNS = [
    "date", "fecha", "transaction_date", "order_date", "business_date",
    "sale_date", "day", "dia", "created_at", "timestamp", "ts",
    "report_date", "closing_date", "fecha_cierre",
]

REVENUE_COLUMNS = [
    "sales_net", "net_sales", "total_sales", "revenue", "total",
    "amount", "ventas", "venta_neta", "importe", "gross_sales",
    "net_revenue", "total_revenue", "sales", "ingresos",
    "total_net", "subtotal", "venta_total",
]


def detect_column(headers: list[str], candidates: list[str]) -> Optional[str]:
    """Find the best matching column name from a list of candidates."""
    headers_lower = [h.lower().strip() for h in headers]
    for candidate in candidates:
        for i, h in enumerate(headers_lower):
            if h == candidate:
                return headers[i]
    # Partial match
    for candidate in candidates:
        for i, h in enumerate(headers_lower):
            if candidate in h:
                return headers[i]
    return None


def parse_date(value: str) -> Optional[str]:
    """Try multiple date formats and return YYYY-MM-DD."""
    formats = [
        "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y",
        "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S",
        "%d-%m-%Y", "%d.%m.%Y", "%Y/%m/%d",
        "%d/%m/%y", "%m/%d/%y",
    ]
    value = value.strip().split("T")[0] if "T" in value else value.strip()
    # Handle datetime with space
    value = value.split(" ")[0] if " " in value else value

    for fmt in formats:
        try:
            return datetime.strptime(value, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def parse_number(value: str) -> float:
    """Parse a number that might use comma as decimal separator."""
    value = value.strip().replace("€", "").replace("$", "").replace(" ", "")
    # Handle European format: 1.234,56 -> 1234.56
    if "," in value and "." in value:
        if value.index(",") > value.index("."):
            value = value.replace(".", "").replace(",", ".")
        else:
            value = value.replace(",", "")
    elif "," in value:
        value = value.replace(",", ".")
    try:
        return float(value)
    except ValueError:
        return 0.0


# ─── Regressor Calculation ───────────────────────────────────────────────────

def compute_regressors(date_str: str) -> dict:
    """Compute all 9 regressors for a given date."""
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    dow = dt.weekday()  # 0=Mon, 6=Sun
    month = dt.month

    # Day before festivo
    next_day = (dt + timedelta(days=1)).strftime("%Y-%m-%d")

    # Temperature (mock based on Madrid averages)
    temp = AVG_TEMP_MADRID.get(month, 18)

    # Rain (deterministic based on month + day for consistency)
    rain_threshold = RAIN_PROB_MADRID.get(month, 0.25)
    # Use day of year as pseudo-random seed for reproducibility
    day_of_year = dt.timetuple().tm_yday
    rain = 1 if (day_of_year * 7 % 100) / 100 < rain_threshold else 0

    return {
        "festivo": 1 if date_str in SPANISH_HOLIDAYS else 0,
        "day_before_festivo": 1 if next_day in SPANISH_HOLIDAYS else 0,
        "evento_impact": MADRID_EVENTS.get(date_str, 1.0),
        "payday": 1 if dt.day in (1, 15) or dt.day >= 25 else 0,
        "temperatura": temp,
        "rain": rain,
        "cold_day": 1 if temp < 10 else 0,
        "weekend": 1 if dow >= 4 else 0,  # Fri, Sat, Sun
        "mid_week": 1 if dow in (1, 2) else 0,  # Tue, Wed
    }


# ─── Main ETL ───────────────────────────────────────────────────────────────

def process_csv(input_path: str) -> list[dict]:
    """Read CSV, detect columns, aggregate to daily, add regressors."""

    # Detect encoding
    with open(input_path, "rb") as f:
        raw = f.read(4096)
    encoding = "utf-8"
    try:
        raw.decode("utf-8")
    except UnicodeDecodeError:
        encoding = "latin-1"

    # Read CSV
    with open(input_path, "r", encoding=encoding) as f:
        # Detect delimiter
        sample = f.read(2048)
        f.seek(0)
        sniffer = csv.Sniffer()
        try:
            dialect = sniffer.sniff(sample)
        except csv.Error:
            dialect = csv.excel

        reader = csv.DictReader(f, dialect=dialect)
        headers = reader.fieldnames or []

        print(f"Columnas detectadas: {headers}")

        # Detect date and revenue columns
        date_col = detect_column(headers, DATE_COLUMNS)
        revenue_col = detect_column(headers, REVENUE_COLUMNS)

        if not date_col:
            print(f"ERROR: No se encontro columna de fecha.")
            print(f"  Columnas disponibles: {headers}")
            print(f"  Nombres esperados: {DATE_COLUMNS}")
            sys.exit(1)

        if not revenue_col:
            print(f"ERROR: No se encontro columna de ventas/revenue.")
            print(f"  Columnas disponibles: {headers}")
            print(f"  Nombres esperados: {REVENUE_COLUMNS}")
            sys.exit(1)

        print(f"Columna fecha: '{date_col}'")
        print(f"Columna ventas: '{revenue_col}'")

        # Aggregate by date
        daily_sales: dict[str, float] = defaultdict(float)
        rows_read = 0
        rows_skipped = 0

        for row in reader:
            rows_read += 1
            date_val = row.get(date_col, "")
            revenue_val = row.get(revenue_col, "0")

            date_str = parse_date(date_val)
            if not date_str:
                rows_skipped += 1
                continue

            amount = parse_number(revenue_val)
            if amount > 0:
                daily_sales[date_str] += amount

    print(f"\nFilas leidas: {rows_read}")
    print(f"Filas saltadas: {rows_skipped}")
    print(f"Dias unicos: {len(daily_sales)}")

    if not daily_sales:
        print("ERROR: No se encontraron datos de ventas validos.")
        sys.exit(1)

    # Sort by date and build output
    dates_sorted = sorted(daily_sales.keys())
    print(f"Rango: {dates_sorted[0]} a {dates_sorted[-1]}")
    print(f"Total ventas: EUR {sum(daily_sales.values()):,.2f}")
    print(f"Media diaria: EUR {sum(daily_sales.values()) / len(daily_sales):,.2f}")

    # Build historical data with regressors
    historical = []
    for date_str in dates_sorted:
        regs = compute_regressors(date_str)
        historical.append({
            "ds": date_str,
            "y": round(daily_sales[date_str], 2),
            **regs,
        })

    return historical


def build_future_regressors(last_date: str, horizon_days: int) -> list[dict]:
    """Build future regressor values for forecast period."""
    dt = datetime.strptime(last_date, "%Y-%m-%d")
    future = []
    for i in range(1, horizon_days + 1):
        future_date = (dt + timedelta(days=i)).strftime("%Y-%m-%d")
        regs = compute_regressors(future_date)
        future.append({"ds": future_date, **regs})
    return future


def main():
    parser = argparse.ArgumentParser(description="Josephine POS ETL - CSV to Prophet")
    parser.add_argument("--input", "-i", required=True, help="CSV file from POS export")
    parser.add_argument("--output", "-o", default="prophet_data.json", help="Output JSON file")
    parser.add_argument("--horizon", type=int, default=90, help="Forecast horizon in days (default: 90)")
    parser.add_argument("--location-id", default="loc-001", help="Location ID")
    parser.add_argument("--location-name", default="Mi Restaurante", help="Location name")

    # Direct API call
    parser.add_argument("--forecast", action="store_true", help="Call Prophet API directly")
    parser.add_argument("--prophet-url", default="http://localhost:8080", help="Prophet service URL")
    parser.add_argument("--prophet-key", default="", help="Prophet API key")

    args = parser.parse_args()

    print("=" * 60)
    print("  Josephine POS ETL - Conversor de datos POS")
    print("=" * 60)
    print()

    # Process CSV
    historical = process_csv(args.input)

    # Build future regressors
    last_date = historical[-1]["ds"]
    future_regressors = build_future_regressors(last_date, args.horizon)

    # Build payload
    payload = {
        "historical": historical,
        "horizon_days": args.horizon,
        "future_regressors": future_regressors,
        "location_id": args.location_id,
        "location_name": args.location_name,
        "yearly_seasonality": len(historical) >= 365,
        "weekly_seasonality": True,
        "seasonality_mode": "multiplicative",
        "include_regressors": True,
    }

    # Save JSON
    with open(args.output, "w") as f:
        json.dump(payload, f, indent=2)
    print(f"\nGuardado: {args.output} ({len(historical)} dias historicos + {len(future_regressors)} dias futuros)")

    # Optionally call Prophet API
    if args.forecast:
        try:
            import requests
        except ImportError:
            print("\nInstala requests: pip install requests")
            sys.exit(1)

        print(f"\nLlamando Prophet API en {args.prophet_url}...")
        headers = {"Content-Type": "application/json"}
        if args.prophet_key:
            headers["Authorization"] = f"Bearer {args.prophet_key}"

        resp = requests.post(
            f"{args.prophet_url}/forecast",
            json=payload,
            headers=headers,
            timeout=300,
        )

        if resp.status_code == 200:
            data = resp.json()
            m = data["metrics"]
            print(f"\n{'='*60}")
            print(f"  RESULTADO PROPHET v5")
            print(f"{'='*60}")
            print(f"  MAPE:  {m['mape']*100:.1f}%")
            print(f"  RMSE:  EUR {m['rmse']:.0f}")
            print(f"  MAE:   EUR {m['mae']:.0f}")
            print(f"  R2:    {m['r_squared']:.3f}")
            print(f"  Changepoints: {m['changepoints']}")
            print(f"\n  Primeros 7 dias de forecast:")
            for f_point in data["forecast"][:7]:
                print(f"    {f_point['ds']}: EUR {f_point['yhat']:.0f}  "
                      f"[{f_point['yhat_lower']:.0f} - {f_point['yhat_upper']:.0f}]")

            # Save forecast result
            forecast_file = args.output.replace(".json", "_forecast.json")
            with open(forecast_file, "w") as f:
                json.dump(data, f, indent=2)
            print(f"\n  Forecast guardado: {forecast_file}")
        else:
            print(f"Error {resp.status_code}: {resp.text[:500]}")

    print("\nListo.")


if __name__ == "__main__":
    main()
