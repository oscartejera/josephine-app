#!/usr/bin/env python3
"""Seed 1 YEAR of data for all Josephine dashboard tables.

Based on the proven seed_dashboard.py patterns, extended to 365 days
with seasonal patterns, monthly trends, and all aggregate tables.

Correct column names verified against Supabase OpenAPI spec 2026-02-07.
"""

import requests, random, json, sys
from datetime import datetime, date, timedelta
from collections import defaultdict

BASE = "https://qzrbvjklgorfoqersdpx.supabase.co"
KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6cmJ2amtsZ29yZm9xZXJzZHB4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDI5NDYwMywiZXhwIjoyMDg1ODcwNjAzfQ.UgpxcrpVnrxaOlQHCcs4-5c4LABnHvFAysCbTrFLy3c"

H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json", "Prefer": "return=representation"}
HM = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json", "Prefer": "return=minimal"}

random.seed(42)

DAYS = 365

# ── Helpers ──────────────────────────────────────────────────────────
def get(table, params=""):
    r = requests.get(f"{BASE}/rest/v1/{table}?{params}", headers=H)
    r.raise_for_status(); return r.json()

def post(table, data):
    r = requests.post(f"{BASE}/rest/v1/{table}", headers=H, json=data)
    if r.status_code >= 400:
        print(f"  ERR {table}: {r.text[:300]}")
    r.raise_for_status(); return r.json()

def post_min(table, data):
    r = requests.post(f"{BASE}/rest/v1/{table}", headers=HM, json=data)
    if r.status_code >= 400:
        print(f"  ERR {table}: {r.text[:300]}")
    r.raise_for_status()

def delete(table, params):
    r = requests.delete(f"{BASE}/rest/v1/{table}?{params}", headers=HM)
    return r

def batch_insert(table, records, size=300):
    inserted = 0
    for i in range(0, len(records), size):
        batch = records[i:i+size]
        try:
            post_min(table, batch)
            inserted += len(batch)
        except Exception as e:
            print(f"  ERR batch {i}: {e}")
    return inserted

def progress(msg, current, total):
    pct = int(current / total * 100)
    sys.stdout.write(f"\r  {msg}: {current}/{total} ({pct}%)")
    sys.stdout.flush()
    if current >= total:
        print()


# ── Seasonal multiplier ─────────────────────────────────────────────
def seasonal_mult(d):
    """Returns a multiplier based on smooth seasonal patterns for Madrid restaurants.

    Uses sinusoidal curves instead of step functions so Prophet can learn the
    patterns from Fourier terms in yearly seasonality.
    """
    import math

    month = d.month
    day = d.day
    dow = d.weekday()
    day_of_year = d.timetuple().tm_yday

    # Smooth annual seasonality using a sinusoidal curve
    # Peak in June (day ~170), trough in Jan (day ~15) and Aug (day ~225)
    # Combination of two sinusoids to capture the double-dip pattern
    annual = (
        1.0
        + 0.08 * math.sin(2 * math.pi * (day_of_year - 50) / 365)    # Main cycle: peak May/Jun
        - 0.06 * math.sin(2 * math.pi * (day_of_year - 225) / 182.5)  # August dip
        + 0.04 * math.sin(4 * math.pi * (day_of_year - 340) / 365)    # December holiday bump
    )

    # Day of week — consistent weekly pattern
    dow_mult = {
        0: 1.00,  # Monday
        1: 0.85,  # Tuesday
        2: 0.85,  # Wednesday
        3: 1.00,  # Thursday
        4: 1.25,  # Friday
        5: 1.30,  # Saturday
        6: 1.10,  # Sunday
    }
    weekly = dow_mult.get(dow, 1.0)

    return annual * weekly


# ── Menu data ────────────────────────────────────────────────────────
MENU_ITEMS = [
    # (name, category, price, cogs_ratio)
    ("Paella Valenciana", "Food", 24.50, 0.33),
    ("Jamon Iberico", "Food", 18.90, 0.60),
    ("Chuleton de Buey", "Food", 38.50, 0.42),
    ("Pulpo a la Gallega", "Food", 22.80, 0.38),
    ("Bacalao Pil-Pil", "Food", 26.50, 0.35),
    ("Tortilla Espanola", "Food", 12.50, 0.22),
    ("Croquetas de Jamon", "Food", 9.80, 0.28),
    ("Ensalada Mixta", "Food", 11.50, 0.25),
    ("Patatas Bravas", "Food", 8.50, 0.20),
    ("Gazpacho Andaluz", "Food", 9.00, 0.18),
    ("Rioja Reserva", "Beverage", 28.00, 0.34),
    ("Cerveza Alhambra", "Beverage", 4.50, 0.27),
    ("Sangria Jarra", "Beverage", 12.00, 0.22),
    ("Tinto de Verano", "Beverage", 6.50, 0.20),
    ("Cafe Solo", "Beverage", 2.50, 0.15),
    ("Agua Mineral", "Beverage", 3.00, 0.10),
    ("Crema Catalana", "Dessert", 8.50, 0.25),
    ("Tarta de Santiago", "Dessert", 9.50, 0.30),
    ("Flan Casero", "Dessert", 7.00, 0.22),
]

POPULARITY = {
    "Cerveza Alhambra": 5.0, "Patatas Bravas": 4.0, "Tortilla Espanola": 3.5,
    "Croquetas de Jamon": 3.5, "Agua Mineral": 3.0, "Cafe Solo": 3.0,
    "Tinto de Verano": 2.5, "Ensalada Mixta": 2.5, "Sangria Jarra": 2.0,
    "Gazpacho Andaluz": 2.0, "Paella Valenciana": 1.8, "Pulpo a la Gallega": 1.5,
    "Bacalao Pil-Pil": 1.3, "Rioja Reserva": 1.2, "Flan Casero": 1.5,
    "Crema Catalana": 1.2, "Tarta de Santiago": 1.0, "Jamon Iberico": 1.0,
    "Chuleton de Buey": 0.8,
}

INGREDIENTS = [
    # (name, unit, cost_per_unit, category, par_level)
    ("Arroz Bomba", "kg", 3.50, "food", 20),
    ("Aceite de Oliva Virgen", "L", 8.00, "food", 15),
    ("Cebolla", "kg", 1.50, "food", 25),
    ("Tomate", "kg", 2.50, "food", 20),
    ("Pimiento Rojo", "kg", 3.00, "food", 10),
    ("Patata", "kg", 1.20, "food", 30),
    ("Ajo", "kg", 8.00, "food", 3),
    ("Perejil", "kg", 4.00, "food", 2),
    ("Lechuga", "ud", 1.80, "food", 15),
    ("Pollo", "kg", 8.50, "food", 15),
    ("Ternera", "kg", 22.00, "food", 8),
    ("Cerdo (Jamon)", "kg", 65.00, "food", 3),
    ("Pulpo", "kg", 28.00, "food", 5),
    ("Bacalao", "kg", 18.00, "food", 5),
    ("Gambas", "kg", 25.00, "food", 4),
    ("Huevos", "doc", 3.00, "food", 20),
    ("Leche", "L", 1.20, "dairy", 20),
    ("Nata", "L", 3.50, "dairy", 8),
    ("Queso Manchego", "kg", 14.00, "dairy", 5),
    ("Harina", "kg", 1.00, "food", 15),
    ("Azucar", "kg", 1.50, "food", 10),
    ("Pan", "kg", 2.00, "food", 15),
    ("Cerveza Alhambra", "ud", 0.80, "beverage", 200),
    ("Vino Rioja (botella)", "btl", 6.00, "beverage", 50),
    ("Cafe Molido", "kg", 12.00, "beverage", 5),
    ("Agua Mineral", "ud", 0.30, "beverage", 200),
    ("Limon", "kg", 2.50, "food", 8),
    ("Azafran", "g", 0.45, "food", 50),
]

RECIPE_DEFS = {
    "Paella Valenciana": [("Arroz Bomba", 0.15), ("Pollo", 0.12), ("Gambas", 0.08), ("Pimiento Rojo", 0.05), ("Aceite de Oliva Virgen", 0.03), ("Azafran", 0.5)],
    "Jamon Iberico": [("Cerdo (Jamon)", 0.10), ("Pan", 0.05)],
    "Chuleton de Buey": [("Ternera", 0.45), ("Patata", 0.15), ("Aceite de Oliva Virgen", 0.02)],
    "Pulpo a la Gallega": [("Pulpo", 0.25), ("Patata", 0.10), ("Aceite de Oliva Virgen", 0.03), ("Pimiento Rojo", 0.01)],
    "Bacalao Pil-Pil": [("Bacalao", 0.20), ("Aceite de Oliva Virgen", 0.05), ("Ajo", 0.01)],
    "Tortilla Espanola": [("Huevos", 0.25), ("Patata", 0.20), ("Cebolla", 0.05), ("Aceite de Oliva Virgen", 0.04)],
    "Croquetas de Jamon": [("Cerdo (Jamon)", 0.03), ("Harina", 0.04), ("Leche", 0.08), ("Huevos", 0.08), ("Aceite de Oliva Virgen", 0.05)],
    "Ensalada Mixta": [("Lechuga", 0.5), ("Tomate", 0.10), ("Cebolla", 0.03), ("Aceite de Oliva Virgen", 0.02)],
    "Patatas Bravas": [("Patata", 0.25), ("Tomate", 0.05), ("Aceite de Oliva Virgen", 0.05), ("Ajo", 0.005)],
    "Gazpacho Andaluz": [("Tomate", 0.20), ("Pimiento Rojo", 0.05), ("Aceite de Oliva Virgen", 0.03), ("Ajo", 0.005), ("Pan", 0.02)],
    "Crema Catalana": [("Huevos", 0.17), ("Leche", 0.15), ("Azucar", 0.04), ("Limon", 0.02)],
    "Tarta de Santiago": [("Harina", 0.08), ("Huevos", 0.17), ("Azucar", 0.06), ("Nata", 0.05)],
    "Flan Casero": [("Huevos", 0.17), ("Leche", 0.20), ("Azucar", 0.05)],
}

LOC_MULT = {"La Taberna Centro": 1.1, "Chamberi": 1.0, "Malasana": 0.9}


# ── Main ─────────────────────────────────────────────────────────────
def main():
    print("=" * 60)
    print(f"JOSEPHINE 1-YEAR SEED ({DAYS} days)")
    print("=" * 60)

    # ── Context ──────────────────────────────────────────────────
    locs = get("locations", "select=id,name")
    loc_map = {l["name"]: l["id"] for l in locs}
    group_id = get("groups", "select=id&limit=1")[0]["id"]
    today = date.today()

    print(f"Group: {group_id[:8]}...")
    print(f"Locations: {list(loc_map.keys())}")
    print(f"Date range: {today - timedelta(days=DAYS)} → {today - timedelta(days=1)}")

    # ── PHASE 1: CLEAN OLD DATA ─────────────────────────────────
    print("\n[1/12] Cleaning old data...")
    loc_csv = ",".join(loc_map.values())

    # Delete in dependency order
    delete("stock_count_lines", "stock_count_id=neq.00000000-0000-0000-0000-000000000000")
    delete("stock_counts", f"group_id=eq.{group_id}")
    delete("waste_events", f"location_id=in.({loc_csv})")
    delete("recipe_ingredients", "recipe_id=neq.00000000-0000-0000-0000-000000000000")
    delete("recipes", f"group_id=eq.{group_id}")
    delete("product_sales_daily", f"location_id=in.({loc_csv})")
    delete("ticket_lines", "ticket_id=neq.00000000-0000-0000-0000-000000000000")
    delete("tickets", f"location_id=in.({loc_csv})")
    delete("products", f"group_id=eq.{group_id}")
    delete("inventory_items", f"group_id=eq.{group_id}")

    # Aggregate tables
    for tbl in ["pos_daily_finance", "cash_counts_daily", "budgets_daily",
                "labour_daily", "cogs_daily", "pos_daily_metrics", "forecast_daily_metrics"]:
        delete(tbl, f"location_id=in.({loc_csv})")

    # Team portal tables
    delete("planned_shifts", f"location_id=in.({loc_csv})")
    delete("employee_clock_records", f"location_id=in.({loc_csv})")

    print("  Done")

    # ── PHASE 2: PRODUCTS ────────────────────────────────────────
    print("\n[2/12] Products...")
    products_data = [
        {"group_id": group_id, "name": name, "category": cat,
         "price": price, "is_active": True}
        for name, cat, price, _ in MENU_ITEMS
    ]
    products = post("products", products_data)
    prod_map = {p["name"]: p["id"] for p in products}
    price_map = {name: price for name, cat, price, _ in MENU_ITEMS}
    cogs_map = {name: cogs_r for name, cat, price, cogs_r in MENU_ITEMS}
    print(f"  Created {len(products)} products")

    # ── PHASE 3: INVENTORY ITEMS ─────────────────────────────────
    print("\n[3/12] Inventory items...")
    inv_data = [
        {"group_id": group_id, "name": name, "unit": unit, "last_cost": cost,
         "category": cat, "par_level": par,
         "current_stock": round(par * (0.3 + random.random() * 1.0), 1)}
        for name, unit, cost, cat, par in INGREDIENTS
    ]
    inv_items = post("inventory_items", inv_data)
    inv_map = {i["name"]: i["id"] for i in inv_items}
    print(f"  Created {len(inv_items)} inventory items")

    # ── PHASE 4: RECIPES ─────────────────────────────────────────
    print("\n[4/12] Recipes...")
    recipes_data = [
        {"group_id": group_id, "menu_item_name": name,
         "selling_price": price_map.get(name, 0)}
        for name in RECIPE_DEFS.keys()
    ]
    recipes = post("recipes", recipes_data)
    recipe_map = {r["menu_item_name"]: r["id"] for r in recipes}

    ri_data = []
    for recipe_name, ingr_list in RECIPE_DEFS.items():
        recipe_id = recipe_map.get(recipe_name)
        if not recipe_id: continue
        for ingr_name, qty in ingr_list:
            inv_id = inv_map.get(ingr_name)
            if not inv_id: continue
            ri_data.append({"recipe_id": recipe_id, "inventory_item_id": inv_id, "quantity": qty})

    post_min("recipe_ingredients", ri_data)
    print(f"  Created {len(recipes)} recipes with {len(ri_data)} ingredients")

    # ── PHASE 5: PRODUCT SALES DAILY (365 days) ─────────────────
    print(f"\n[5/12] Product sales daily ({DAYS} days)...")
    psd_records = []
    for day_offset in range(-DAYS, 0):
        d = today + timedelta(days=day_offset)
        s_mult = seasonal_mult(d)

        for loc_name, loc_id in loc_map.items():
            l_mult = LOC_MULT.get(loc_name, 1.0)

            for name, cat, price, cogs_ratio in MENU_ITEMS:
                pop = POPULARITY.get(name, 1.0)
                base_units = pop * 8 * s_mult * l_mult
                # Low noise: ±10% (real restaurants are fairly consistent)
                units = max(1, int(base_units * (0.90 + random.random() * 0.20)))
                net_sales = round(units * price * (0.97 + random.random() * 0.06), 2)
                cogs = round(net_sales * cogs_ratio * (0.95 + random.random() * 0.10), 2)

                psd_records.append({
                    "date": d.isoformat(), "location_id": loc_id,
                    "product_id": prod_map[name],
                    "units_sold": units, "net_sales": net_sales, "cogs": cogs,
                })

    n = batch_insert("product_sales_daily", psd_records, size=500)
    print(f"  Inserted {n} product_sales_daily records")

    # ── PHASE 6: TICKETS + TICKET LINES (365 days) ──────────────
    print(f"\n[6/12] Tickets + ticket lines ({DAYS} days)...")

    employees = get("employees", f"location_id=in.({loc_csv})&role_name=eq.Server&limit=30&select=id,location_id")
    emp_by_loc = defaultdict(list)
    for e in employees:
        emp_by_loc[e["location_id"]].append(e["id"])

    channels = ["dinein", "dinein", "dinein", "dinein", "takeaway", "delivery"]

    total_tickets = 0
    total_lines = 0

    # Process day by day to keep memory manageable
    for day_offset in range(-DAYS, 0):
        d = today + timedelta(days=day_offset)
        s_mult = seasonal_mult(d)
        base_tickets = int(12 * s_mult)

        day_tickets = []
        day_lines_pending = []  # list of (ticket_index, lines)

        for loc_name, loc_id in loc_map.items():
            l_mult = LOC_MULT.get(loc_name, 1.0)
            n_tickets = max(3, int(base_tickets * l_mult))
            servers = emp_by_loc.get(loc_id, [None])

            for t_idx in range(n_tickets):
                if t_idx < n_tickets * 0.45:
                    hour = random.randint(12, 15)
                elif t_idx < n_tickets * 0.9:
                    hour = random.randint(19, 22)
                else:
                    hour = random.choice([11, 16, 17, 23])

                opened = datetime(d.year, d.month, d.day, hour, random.randint(0, 59))
                closed = opened + timedelta(minutes=random.randint(25, 90))
                covers = random.randint(1, 6)
                channel = random.choice(channels)
                server_id = random.choice(servers) if servers else None

                n_items = random.randint(2, 5)
                selected = random.sample(MENU_ITEMS, min(n_items, len(MENU_ITEMS)))

                gross = 0
                lines = []
                for item_name, cat, price, _ in selected:
                    qty = random.randint(1, covers) if covers <= 3 else random.randint(1, 3)
                    line_total = round(qty * price, 2)
                    gross += line_total
                    lines.append({
                        "item_name": item_name, "category_name": cat,
                        "quantity": qty, "unit_price": price,
                        "gross_line_total": line_total,
                        "product_id": prod_map.get(item_name),
                    })

                tax = round(gross * 0.10, 2)
                discount = round(random.random() * 5, 2) if random.random() < 0.15 else 0
                net = round(gross - discount, 2)

                ticket_idx = len(day_tickets)
                day_tickets.append({
                    "location_id": loc_id,
                    "opened_at": opened.isoformat(),
                    "closed_at": closed.isoformat(),
                    "status": "closed",
                    "covers": covers,
                    "table_name": f"Mesa {random.randint(1, 20)}",
                    "channel": channel,
                    "gross_total": gross,
                    "net_total": net,
                    "tax_total": tax,
                    "discount_total": discount,
                    "server_id": server_id,
                    "service_type": "dine_in" if channel == "dinein" else channel,
                })
                day_lines_pending.append((ticket_idx, lines))

        # Insert this day's tickets with return=representation to get IDs
        if day_tickets:
            try:
                result = post("tickets", day_tickets)
                all_day_lines = []
                for ticket_idx, lines in day_lines_pending:
                    tid = result[ticket_idx]["id"]
                    for line in lines:
                        line["ticket_id"] = tid
                        all_day_lines.append(line)

                if all_day_lines:
                    batch_insert("ticket_lines", all_day_lines, size=500)
                    total_lines += len(all_day_lines)

                total_tickets += len(result)
            except Exception as e:
                print(f"\n  ERR day {d}: {e}")

        if day_offset % 30 == 0:
            progress("Tickets", DAYS + day_offset, DAYS)

    print(f"  Inserted {total_tickets} tickets, {total_lines} ticket lines")

    # ── PHASE 7: WASTE EVENTS ────────────────────────────────────
    print(f"\n[7/12] Waste events ({DAYS} days)...")
    waste_reasons = ["end_of_day", "expired", "broken", "overproduction", "theft"]
    waste_items = [
        ("Pollo", 0.3), ("Tomate", 0.5), ("Lechuga", 0.3), ("Pan", 0.4),
        ("Bacalao", 0.15), ("Patata", 0.3), ("Pimiento Rojo", 0.2),
        ("Leche", 0.2), ("Nata", 0.1), ("Gambas", 0.1),
    ]
    cost_map = {n: c for n, u, c, cat, p in INGREDIENTS}

    waste_records = []
    for day_offset in range(-DAYS, 0):
        d = today + timedelta(days=day_offset)
        s_mult = seasonal_mult(d)
        for loc_name, loc_id in loc_map.items():
            n_events = max(1, int(random.randint(3, 6) * s_mult * 0.8))
            for _ in range(n_events):
                item_name, base_qty = random.choice(waste_items)
                inv_id = inv_map.get(item_name)
                if not inv_id: continue
                qty = round(base_qty * (0.5 + random.random()), 3)
                value = round(qty * cost_map.get(item_name, 5.0), 2)
                waste_records.append({
                    "location_id": loc_id,
                    "inventory_item_id": inv_id,
                    "quantity": qty,
                    "reason": random.choice(waste_reasons),
                    "waste_value": value,
                    "created_at": datetime(d.year, d.month, d.day,
                                           random.randint(15, 23), random.randint(0, 59)).isoformat(),
                })

    n = batch_insert("waste_events", waste_records, size=500)
    print(f"  Inserted {n} waste events")

    # ── PHASE 8: STOCK COUNTS (52 weeks) ─────────────────────────
    print("\n[8/12] Stock counts (52 weeks)...")
    sc_records = []
    for loc_name, loc_id in loc_map.items():
        for week in range(52):
            start = today - timedelta(days=(52 - week) * 7)
            end = start + timedelta(days=6)
            sc_records.append({
                "group_id": group_id, "location_id": loc_id,
                "start_date": start.isoformat(), "end_date": end.isoformat(),
                "status": "counted" if week < 51 else "in_progress",
            })

    stock_counts = post("stock_counts", sc_records)
    print(f"  Created {len(stock_counts)} stock counts")

    # Stock count lines
    scl_records = []
    for sc in stock_counts:
        for item in inv_items:
            par = item.get("par_level") or 10
            opening = round(par * (0.3 + random.random() * 0.7), 1)
            deliveries = round(par * random.random() * 0.5, 1) if random.random() > 0.3 else 0
            sales = round(par * 0.2 * (0.5 + random.random()), 1)
            waste = round(sales * 0.05 * random.random(), 1)
            closing = round(max(0, opening + deliveries - sales - waste), 1)
            variance = round(closing - (opening + deliveries - sales), 1)

            scl_records.append({
                "stock_count_id": sc["id"],
                "inventory_item_id": item["id"],
                "opening_qty": opening,
                "deliveries_qty": deliveries,
                "closing_qty": closing,
                "used_qty": round(sales + waste, 1),
                "sales_qty": sales,
                "variance_qty": variance,
            })

    n = batch_insert("stock_count_lines", scl_records, size=500)
    print(f"  Inserted {n} stock count lines")

    # ── PHASE 9: DAILY AGGREGATES (365 days) ─────────────────────
    print(f"\n[9/12] Daily aggregates ({DAYS} days)...")

    pf_records = []   # pos_daily_finance
    cc_records = []   # cash_counts_daily
    bd_records = []   # budgets_daily
    ld_records = []   # labour_daily
    cd_records = []   # cogs_daily
    pm_records = []   # pos_daily_metrics

    for day_offset in range(-DAYS, 0):
        d = today + timedelta(days=day_offset)
        s_mult = seasonal_mult(d)

        for loc_name, loc_id in loc_map.items():
            l_mult = LOC_MULT.get(loc_name, 1.0)
            combined = s_mult * l_mult

            # Daily revenue
            base_net = 3200 * combined
            net_sales = round(base_net * (0.92 + random.random() * 0.16), 2)
            gross_sales = round(net_sales * 1.10, 2)  # +10% IVA
            orders = max(5, int(12 * combined * (0.8 + random.random() * 0.4)))

            # Payment split
            card_pct = 0.65 + random.random() * 0.15
            cash_pct = 1.0 - card_pct - 0.05
            payments_card = round(net_sales * card_pct, 2)
            payments_cash = round(net_sales * cash_pct, 2)
            payments_other = round(net_sales * 0.05, 2)

            # Discounts, refunds, etc.
            discounts = round(net_sales * 0.02 * random.random(), 2)
            refunds = round(net_sales * 0.005 * random.random(), 2) if random.random() < 0.1 else 0
            refunds_count = 1 if refunds > 0 else 0
            comps = round(random.random() * 15, 2) if random.random() < 0.05 else 0
            voids = round(random.random() * 10, 2) if random.random() < 0.03 else 0

            # pos_daily_finance
            pf_records.append({
                "date": d.isoformat(), "location_id": loc_id,
                "net_sales": net_sales, "gross_sales": gross_sales,
                "orders_count": orders,
                "payments_cash": payments_cash, "payments_card": payments_card,
                "payments_other": payments_other,
                "refunds_amount": refunds, "refunds_count": refunds_count,
                "discounts_amount": discounts, "comps_amount": comps,
                "voids_amount": voids,
            })

            # cash_counts_daily
            expected_cash = payments_cash
            variance = round((random.random() - 0.5) * 10, 2)
            cc_records.append({
                "date": d.isoformat(), "location_id": loc_id,
                "cash_counted": round(expected_cash + variance, 2),
            })

            # Labour
            labor_hours = round(combined * 42 * (0.9 + random.random() * 0.2), 1)
            avg_hourly = 14.0 + random.random() * 4.0
            labor_cost = round(labor_hours * avg_hourly, 2)

            ld_records.append({
                "date": d.isoformat(), "location_id": loc_id,
                "labour_cost": labor_cost, "labour_hours": labor_hours,
            })

            # COGS
            cogs_pct = 0.28 + random.random() * 0.06
            cogs_amount = round(net_sales * cogs_pct, 2)
            cd_records.append({
                "date": d.isoformat(), "location_id": loc_id,
                "cogs_amount": cogs_amount,
            })

            # Budgets (target vs slightly different from actual)
            budget_mult = 0.95 + random.random() * 0.10
            bd_records.append({
                "date": d.isoformat(), "location_id": loc_id,
                "budget_sales": round(net_sales * budget_mult, 2),
                "budget_labour": round(labor_cost * (0.93 + random.random() * 0.14), 2),
                "budget_cogs": round(cogs_amount * (0.93 + random.random() * 0.14), 2),
            })

            # pos_daily_metrics (for Labour page)
            pm_records.append({
                "date": d.isoformat(), "location_id": loc_id,
                "net_sales": net_sales, "orders": orders,
                "labor_hours": labor_hours, "labor_cost": labor_cost,
            })

    print("  Inserting pos_daily_finance...")
    batch_insert("pos_daily_finance", pf_records, size=500)
    print("  Inserting cash_counts_daily...")
    batch_insert("cash_counts_daily", cc_records, size=500)
    print("  Inserting budgets_daily...")
    batch_insert("budgets_daily", bd_records, size=500)
    print("  Inserting labour_daily...")
    batch_insert("labour_daily", ld_records, size=500)
    print("  Inserting cogs_daily...")
    batch_insert("cogs_daily", cd_records, size=500)
    print("  Inserting pos_daily_metrics...")
    batch_insert("pos_daily_metrics", pm_records, size=500)
    print(f"  Done ({len(pf_records)} rows each)")

    # ── PHASE 10: FORECAST DAILY METRICS ─────────────────────────
    print(f"\n[10/12] Forecast daily metrics ({DAYS} days)...")
    fm_records = []
    for day_offset in range(-DAYS, 0):
        d = today + timedelta(days=day_offset)
        s_mult = seasonal_mult(d)

        for loc_name, loc_id in loc_map.items():
            l_mult = LOC_MULT.get(loc_name, 1.0)
            combined = s_mult * l_mult

            # Forecast is actual + some error (simulates prediction)
            base_sales = 3200 * combined
            error = 0.92 + random.random() * 0.16
            forecast_sales = round(base_sales * error, 2)
            forecast_orders = max(5, int(12 * combined * (0.8 + random.random() * 0.4)))

            labor_hours = round(combined * 42 * (0.9 + random.random() * 0.2), 1)
            avg_hourly = 14.0 + random.random() * 4.0

            fm_records.append({
                "date": d.isoformat(), "location_id": loc_id,
                "forecast_sales": forecast_sales,
                "forecast_orders": forecast_orders,
                "planned_labor_hours": labor_hours,
                "planned_labor_cost": round(labor_hours * avg_hourly, 2),
                "model_version": "seed_v1",
                "confidence": round(85 + random.random() * 12, 1),
                "mape": round(5 + random.random() * 10, 2),
            })

    n = batch_insert("forecast_daily_metrics", fm_records, size=500)
    print(f"  Inserted {n} forecast records")

    # ── PHASE 11: PLANNED SHIFTS + CLOCK RECORDS ─────────────────
    print(f"\n[11/12] Planned shifts + clock records ({DAYS} days)...")

    all_employees = get("employees", f"location_id=in.({loc_csv})&select=id,location_id,role_name,hourly_cost")

    shift_records = []
    clock_records = []

    for day_offset in range(-DAYS, 0):
        d = today + timedelta(days=day_offset)
        s_mult = seasonal_mult(d)

        for emp in all_employees:
            # Not everyone works every day (70% chance)
            if random.random() > 0.70:
                continue

            loc_id = emp["location_id"]
            role = emp.get("role_name", "Staff")
            hourly_cost = emp.get("hourly_cost") or 14.0

            # Morning or evening shift (must be exactly 8 hours per DB constraint)
            if random.random() < 0.5:
                start_h, end_h = 10, 18   # 8 hours
            else:
                start_h, end_h = 15, 23   # 8 hours

            planned_hours = 8
            planned_cost = round(planned_hours * hourly_cost, 2)

            shift_records.append({
                "employee_id": emp["id"], "location_id": loc_id,
                "shift_date": d.isoformat(),
                "start_time": f"{start_h:02d}:00",
                "end_time": f"{end_h:02d}:00",
                "planned_hours": planned_hours,
                "planned_cost": planned_cost,
                "role": role,
                "status": "completed" if day_offset < -1 else "scheduled",
            })

            # Clock records (actual hours, slight variance from planned)
            if day_offset < -1:  # Only past days
                actual_start_m = random.randint(-10, 10)
                actual_end_m = random.randint(-15, 15)
                clock_in = datetime(d.year, d.month, d.day, start_h, 0) + timedelta(minutes=actual_start_m)
                clock_out = datetime(d.year, d.month, d.day, end_h, 0) + timedelta(minutes=actual_end_m)

                clock_records.append({
                    "employee_id": emp["id"], "location_id": loc_id,
                    "clock_in": clock_in.isoformat(),
                    "clock_out": clock_out.isoformat(),
                    "source": "manual",
                })

    print(f"  Inserting {len(shift_records)} shifts...")
    batch_insert("planned_shifts", shift_records, size=500)
    print(f"  Inserting {len(clock_records)} clock records...")
    batch_insert("employee_clock_records", clock_records, size=500)
    print("  Done")

    # ── PHASE 12: VERIFICATION ───────────────────────────────────
    print("\n[12/12] Verification...")
    tables_to_check = [
        "products", "product_sales_daily", "inventory_items", "recipes",
        "recipe_ingredients", "tickets", "ticket_lines", "waste_events",
        "stock_counts", "stock_count_lines",
        "pos_daily_finance", "cash_counts_daily", "budgets_daily",
        "labour_daily", "cogs_daily", "pos_daily_metrics", "forecast_daily_metrics",
        "planned_shifts", "employee_clock_records",
    ]
    for tbl in tables_to_check:
        r = requests.get(f"{BASE}/rest/v1/{tbl}?select=id&limit=1",
                         headers={**H, "Prefer": "count=exact"})
        count = r.headers.get("content-range", "?").split("/")[-1]
        print(f"  {tbl:30s} {count:>8}")

    print("\n" + "=" * 60)
    print("COMPLETE! 1 year of data seeded.")
    print("=" * 60)


if __name__ == "__main__":
    main()
