#!/usr/bin/env python3
"""Seed ALL dashboard tables for Josephine - correct POS-ready data model."""

import requests, random, json, hashlib
from datetime import datetime, date, timedelta
from collections import defaultdict

BASE = "https://qzrbvjklgorfoqersdpx.supabase.co"
KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6cmJ2amtsZ29yZm9xZXJzZHB4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDI5NDYwMywiZXhwIjoyMDg1ODcwNjAzfQ.UgpxcrpVnrxaOlQHCcs4-5c4LABnHvFAysCbTrFLy3c"

H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json", "Prefer": "return=representation"}
HM = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json", "Prefer": "return=minimal"}

random.seed(42)

def get(table, params=""):
    r = requests.get(f"{BASE}/rest/v1/{table}?{params}", headers=H)
    r.raise_for_status(); return r.json()

def post(table, data):
    r = requests.post(f"{BASE}/rest/v1/{table}", headers=H, json=data)
    if r.status_code >= 400: print(f"  ERR {table}: {r.text[:200]}")
    r.raise_for_status(); return r.json()

def post_min(table, data):
    r = requests.post(f"{BASE}/rest/v1/{table}", headers=HM, json=data)
    if r.status_code >= 400: print(f"  ERR {table}: {r.text[:200]}")
    r.raise_for_status()

def delete(table, params):
    requests.delete(f"{BASE}/rest/v1/{table}?{params}", headers=HM)

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


def main():
    print("=" * 60)
    print("JOSEPHINE DASHBOARD SEED - Complete")
    print("=" * 60)

    # Get context
    locs = get("locations", "select=id,name")
    loc_map = {l["name"]: l["id"] for l in locs}
    group_id = get("groups", "select=id&limit=1")[0]["id"]
    today = date.today()

    print(f"Group: {group_id[:8]}...")
    print(f"Locations: {list(loc_map.keys())}")

    # ============================================================
    # PHASE 1: PRODUCTS (Menu Items)
    # ============================================================
    print("\n[1/8] Products (menu items)...")
    delete("product_sales_daily", f"location_id=in.({','.join(loc_map.values())})")
    delete("products", f"group_id=eq.{group_id}")

    menu_items = [
        # (name, category, price, cogs_ratio)
        ("Paella Valenciana", "Food", 24.50, 0.33),
        ("Jamón Ibérico", "Food", 18.90, 0.60),
        ("Chuletón de Buey", "Food", 38.50, 0.42),
        ("Pulpo a la Gallega", "Food", 22.80, 0.38),
        ("Bacalao Pil-Pil", "Food", 26.50, 0.35),
        ("Tortilla Española", "Food", 12.50, 0.22),
        ("Croquetas de Jamón", "Food", 9.80, 0.28),
        ("Ensalada Mixta", "Food", 11.50, 0.25),
        ("Patatas Bravas", "Food", 8.50, 0.20),
        ("Gazpacho Andaluz", "Food", 9.00, 0.18),
        ("Rioja Reserva", "Beverage", 28.00, 0.34),
        ("Cerveza Alhambra", "Beverage", 4.50, 0.27),
        ("Sangría Jarra", "Beverage", 12.00, 0.22),
        ("Tinto de Verano", "Beverage", 6.50, 0.20),
        ("Café Solo", "Beverage", 2.50, 0.15),
        ("Agua Mineral", "Beverage", 3.00, 0.10),
        ("Crema Catalana", "Dessert", 8.50, 0.25),
        ("Tarta de Santiago", "Dessert", 9.50, 0.30),
        ("Flan Casero", "Dessert", 7.00, 0.22),
    ]

    products_data = [
        {"group_id": group_id, "name": name, "category": cat, "is_active": True}
        for name, cat, price, _ in menu_items
    ]
    products = post("products", products_data)
    prod_map = {p["name"]: p["id"] for p in products}
    print(f"  Created {len(products)} products")

    # ============================================================
    # PHASE 2: PRODUCT SALES DAILY (Menu Engineering source)
    # ============================================================
    print("\n[2/8] Product sales daily (30 days)...")

    # Popularity weights (some items sell more than others)
    popularity = {
        "Cerveza Alhambra": 5.0, "Patatas Bravas": 4.0, "Tortilla Española": 3.5,
        "Croquetas de Jamón": 3.5, "Agua Mineral": 3.0, "Café Solo": 3.0,
        "Tinto de Verano": 2.5, "Ensalada Mixta": 2.5, "Sangría Jarra": 2.0,
        "Gazpacho Andaluz": 2.0, "Paella Valenciana": 1.8, "Pulpo a la Gallega": 1.5,
        "Bacalao Pil-Pil": 1.3, "Rioja Reserva": 1.2, "Flan Casero": 1.5,
        "Crema Catalana": 1.2, "Tarta de Santiago": 1.0, "Jamón Ibérico": 1.0,
        "Chuletón de Buey": 0.8,
    }

    psd_records = []
    for day_offset in range(-30, 0):
        d = today + timedelta(days=day_offset)
        dow = d.weekday()
        day_mult = 1.3 if dow in (4, 5) else 0.8 if dow in (1, 2) else 1.0

        for loc_name, loc_id in loc_map.items():
            loc_mult = {"La Taberna Centro": 1.1, "Chamberí": 1.0, "Malasaña": 0.9}.get(loc_name, 1.0)

            for name, cat, price, cogs_ratio in menu_items:
                pop = popularity.get(name, 1.0)
                base_units = pop * 8 * day_mult * loc_mult
                units = max(1, int(base_units * (0.7 + random.random() * 0.6)))
                net_sales = round(units * price * (0.95 + random.random() * 0.10), 2)
                cogs = round(net_sales * cogs_ratio * (0.90 + random.random() * 0.20), 2)

                psd_records.append({
                    "date": d.isoformat(), "location_id": loc_id,
                    "product_id": prod_map[name],
                    "units_sold": units, "net_sales": net_sales, "cogs": cogs,
                })

    n = batch_insert("product_sales_daily", psd_records)
    print(f"  Inserted {n} product_sales_daily records")

    # ============================================================
    # PHASE 3: INVENTORY ITEMS (Ingredients)
    # ============================================================
    print("\n[3/8] Inventory items (ingredients)...")
    delete("waste_events", f"location_id=in.({','.join(loc_map.values())})")
    delete("recipe_ingredients", f"recipe_id=neq.00000000-0000-0000-0000-000000000000")
    delete("recipes", f"group_id=eq.{group_id}")
    delete("inventory_items", f"group_id=eq.{group_id}")

    ingredients = [
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
        ("Cerdo (Jamón)", "kg", 65.00, "food", 3),
        ("Pulpo", "kg", 28.00, "food", 5),
        ("Bacalao", "kg", 18.00, "food", 5),
        ("Gambas", "kg", 25.00, "food", 4),
        ("Huevos", "doc", 3.00, "food", 20),
        ("Leche", "L", 1.20, "dairy", 20),
        ("Nata", "L", 3.50, "dairy", 8),
        ("Queso Manchego", "kg", 14.00, "dairy", 5),
        ("Harina", "kg", 1.00, "food", 15),
        ("Azúcar", "kg", 1.50, "food", 10),
        ("Pan", "kg", 2.00, "food", 15),
        ("Cerveza Alhambra", "ud", 0.80, "beverage", 200),
        ("Vino Rioja (botella)", "btl", 6.00, "beverage", 50),
        ("Café Molido", "kg", 12.00, "beverage", 5),
        ("Agua Mineral", "ud", 0.30, "beverage", 200),
        ("Limón", "kg", 2.50, "food", 8),
        ("Azafrán", "g", 0.45, "food", 50),
    ]

    inv_data = [
        {"group_id": group_id, "name": name, "unit": unit, "last_cost": cost,
         "category": cat, "par_level": par, "current_stock": round(par * (0.3 + random.random() * 1.0), 1)}
        for name, unit, cost, cat, par in ingredients
    ]
    inv_items = post("inventory_items", inv_data)
    inv_map = {i["name"]: i["id"] for i in inv_items}
    print(f"  Created {len(inv_items)} inventory items")

    # ============================================================
    # PHASE 4: RECIPES (link menu items to ingredients)
    # ============================================================
    print("\n[4/8] Recipes + ingredients...")

    recipe_defs = {
        "Paella Valenciana": [("Arroz Bomba", 0.15), ("Pollo", 0.12), ("Gambas", 0.08), ("Pimiento Rojo", 0.05), ("Aceite de Oliva Virgen", 0.03), ("Azafrán", 0.5)],
        "Jamón Ibérico": [("Cerdo (Jamón)", 0.10), ("Pan", 0.05)],
        "Chuletón de Buey": [("Ternera", 0.45), ("Patata", 0.15), ("Aceite de Oliva Virgen", 0.02)],
        "Pulpo a la Gallega": [("Pulpo", 0.25), ("Patata", 0.10), ("Aceite de Oliva Virgen", 0.03), ("Pimiento Rojo", 0.01)],
        "Bacalao Pil-Pil": [("Bacalao", 0.20), ("Aceite de Oliva Virgen", 0.05), ("Ajo", 0.01)],
        "Tortilla Española": [("Huevos", 0.25), ("Patata", 0.20), ("Cebolla", 0.05), ("Aceite de Oliva Virgen", 0.04)],
        "Croquetas de Jamón": [("Cerdo (Jamón)", 0.03), ("Harina", 0.04), ("Leche", 0.08), ("Huevos", 0.08), ("Aceite de Oliva Virgen", 0.05)],
        "Ensalada Mixta": [("Lechuga", 0.5), ("Tomate", 0.10), ("Cebolla", 0.03), ("Aceite de Oliva Virgen", 0.02)],
        "Patatas Bravas": [("Patata", 0.25), ("Tomate", 0.05), ("Aceite de Oliva Virgen", 0.05), ("Ajo", 0.005)],
        "Gazpacho Andaluz": [("Tomate", 0.20), ("Pimiento Rojo", 0.05), ("Aceite de Oliva Virgen", 0.03), ("Ajo", 0.005), ("Pan", 0.02)],
        "Crema Catalana": [("Huevos", 0.17), ("Leche", 0.15), ("Azúcar", 0.04), ("Limón", 0.02)],
        "Tarta de Santiago": [("Harina", 0.08), ("Huevos", 0.17), ("Azúcar", 0.06), ("Nata", 0.05)],
        "Flan Casero": [("Huevos", 0.17), ("Leche", 0.20), ("Azúcar", 0.05)],
    }

    # Find price for each menu item
    price_map = {name: price for name, cat, price, _ in menu_items}

    recipes_data = [
        {"group_id": group_id, "menu_item_name": name, "selling_price": price_map.get(name, 0)}
        for name in recipe_defs.keys()
    ]
    recipes = post("recipes", recipes_data)
    recipe_map = {r["menu_item_name"]: r["id"] for r in recipes}

    ri_data = []
    for recipe_name, ingr_list in recipe_defs.items():
        recipe_id = recipe_map.get(recipe_name)
        if not recipe_id: continue
        for ingr_name, qty in ingr_list:
            inv_id = inv_map.get(ingr_name)
            if not inv_id: continue
            ri_data.append({"recipe_id": recipe_id, "inventory_item_id": inv_id, "quantity": qty})

    post_min("recipe_ingredients", ri_data)
    print(f"  Created {len(recipes)} recipes with {len(ri_data)} ingredients")

    # ============================================================
    # PHASE 5: TICKETS + TICKET LINES (POS data - 30 days)
    # ============================================================
    print("\n[5/8] Tickets + ticket lines (POS data)...")
    delete("ticket_lines", f"ticket_id=neq.00000000-0000-0000-0000-000000000000")
    delete("tickets", f"location_id=in.({','.join(loc_map.values())})")

    # Get employee IDs for server assignment
    employees = get("employees", f"location_id=in.({','.join(loc_map.values())})&role_name=eq.Server&limit=30&select=id,location_id")
    emp_by_loc = defaultdict(list)
    for e in employees:
        emp_by_loc[e["location_id"]].append(e["id"])

    channels = ["dinein", "dinein", "dinein", "dinein", "takeaway", "delivery"]

    all_tickets = []
    all_lines = []

    for day_offset in range(-30, 0):
        d = today + timedelta(days=day_offset)
        dow = d.weekday()
        tickets_per_loc = 15 if dow in (4, 5) else 8 if dow in (1, 2) else 12

        for loc_name, loc_id in loc_map.items():
            loc_mult = {"La Taberna Centro": 1.1, "Chamberí": 1.0, "Malasaña": 0.9}.get(loc_name, 1.0)
            n_tickets = int(tickets_per_loc * loc_mult)
            servers = emp_by_loc.get(loc_id, [None])

            for t_idx in range(n_tickets):
                # Distribute across lunch (12-15) and dinner (19-22)
                if t_idx < n_tickets * 0.45:
                    hour = random.randint(12, 15)
                elif t_idx < n_tickets * 0.9:
                    hour = random.randint(19, 22)
                else:
                    hour = random.choice([11, 16, 17, 23])
                minute = random.randint(0, 59)

                opened = datetime(d.year, d.month, d.day, hour, minute)
                duration = timedelta(minutes=random.randint(25, 90))
                closed = opened + duration
                covers = random.randint(1, 6)
                channel = random.choice(channels)
                server_id = random.choice(servers) if servers else None

                # Generate 2-5 line items
                n_items = random.randint(2, 5)
                selected_items = random.sample(menu_items, min(n_items, len(menu_items)))

                gross = 0
                ticket_lines = []
                for item_name, cat, price, cogs_r in selected_items:
                    qty = random.randint(1, covers) if covers <= 3 else random.randint(1, 3)
                    line_total = round(qty * price, 2)
                    gross += line_total
                    ticket_lines.append({
                        "item_name": item_name, "category_name": cat,
                        "quantity": qty, "unit_price": price,
                        "gross_line_total": line_total,
                        "product_id": prod_map.get(item_name),
                    })

                tax = round(gross * 0.10, 2)
                discount = round(random.random() * 5, 2) if random.random() < 0.15 else 0
                net = round(gross - discount, 2)

                ticket = {
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
                    "_lines": ticket_lines,  # temp - will be processed after insert
                }
                all_tickets.append(ticket)

    # Insert tickets in batches and collect IDs
    print(f"  Generated {len(all_tickets)} tickets, inserting...")
    inserted_tickets = 0
    for i in range(0, len(all_tickets), 100):
        batch = all_tickets[i:i+100]
        clean_batch = [{k: v for k, v in t.items() if k != "_lines"} for t in batch]
        try:
            result = post("tickets", clean_batch)
            for j, ticket_result in enumerate(result):
                tid = ticket_result["id"]
                for line in batch[j]["_lines"]:
                    line["ticket_id"] = tid
                    all_lines.append(line)
            inserted_tickets += len(result)
        except Exception as e:
            print(f"  ERR tickets batch {i}: {e}")
        if (i // 100) % 5 == 0:
            print(f"  ... tickets: {inserted_tickets}/{len(all_tickets)}")

    print(f"  Inserted {inserted_tickets} tickets")

    # Insert ticket lines
    print(f"  Inserting {len(all_lines)} ticket lines...")
    n_lines = batch_insert("ticket_lines", all_lines, size=200)
    print(f"  Inserted {n_lines} ticket lines")

    # ============================================================
    # PHASE 6: WASTE EVENTS
    # ============================================================
    print("\n[6/8] Waste events...")

    waste_reasons = ["end_of_day", "expired", "broken", "overproduction", "theft"]
    waste_items = [
        ("Pollo", 0.3), ("Tomate", 0.5), ("Lechuga", 0.3), ("Pan", 0.4),
        ("Bacalao", 0.15), ("Patata", 0.3), ("Pimiento Rojo", 0.2),
        ("Leche", 0.2), ("Nata", 0.1), ("Gambas", 0.1),
    ]

    waste_records = []
    for day_offset in range(-30, 0):
        d = today + timedelta(days=day_offset)
        for loc_name, loc_id in loc_map.items():
            # 3-6 waste events per day per location
            n_events = random.randint(3, 6)
            for _ in range(n_events):
                item_name, base_qty = random.choice(waste_items)
                inv_id = inv_map.get(item_name)
                if not inv_id: continue

                qty = round(base_qty * (0.5 + random.random()), 3)
                cost = next((c for n, u, c, cat, p in ingredients if n == item_name), 5.0)
                value = round(qty * cost, 2)

                waste_records.append({
                    "location_id": loc_id,
                    "inventory_item_id": inv_id,
                    "quantity": qty,
                    "reason": random.choice(waste_reasons),
                    "waste_value": value,
                    "created_at": datetime(d.year, d.month, d.day, random.randint(15, 23), random.randint(0, 59)).isoformat(),
                })

    n = batch_insert("waste_events", waste_records)
    print(f"  Inserted {n} waste events")

    # ============================================================
    # PHASE 7: STOCK COUNTS
    # ============================================================
    print("\n[7/8] Stock counts...")
    delete("stock_count_lines", f"stock_count_id=neq.00000000-0000-0000-0000-000000000000")
    delete("stock_counts", f"group_id=eq.{group_id}")

    sc_records = []
    for loc_name, loc_id in loc_map.items():
        for week in range(4):
            start = today - timedelta(days=(4-week)*7)
            end = start + timedelta(days=6)
            sc_records.append({
                "group_id": group_id, "location_id": loc_id,
                "start_date": start.isoformat(), "end_date": end.isoformat(),
                "status": "counted" if week < 3 else "in_progress",
            })

    stock_counts = post("stock_counts", sc_records)
    print(f"  Created {len(stock_counts)} stock counts")

    # Stock count lines for each count
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
                "used_qty": sales + waste,
                "sales_qty": sales,
                "variance_qty": variance,
            })

    n = batch_insert("stock_count_lines", scl_records)
    print(f"  Inserted {n} stock count lines")

    # ============================================================
    # PHASE 8: VERIFY TOTALS
    # ============================================================
    print("\n[8/8] Verification...")
    tables_to_check = [
        "products", "product_sales_daily", "inventory_items", "recipes",
        "recipe_ingredients", "tickets", "ticket_lines", "waste_events",
        "stock_counts", "stock_count_lines",
        "pos_daily_finance", "cash_counts_daily", "budgets_daily",
        "labour_daily", "cogs_daily", "pos_daily_metrics", "forecast_daily_metrics",
    ]
    for tbl in tables_to_check:
        r = requests.get(f"{BASE}/rest/v1/{tbl}?select=id&limit=1", headers={**H, "Prefer": "count=exact"})
        count = r.headers.get("content-range", "?").split("/")[-1]
        print(f"  {tbl:30s} {count:>6}")

    print("\n" + "=" * 60)
    print("COMPLETE! All dashboard tables seeded.")
    print("=" * 60)


if __name__ == "__main__":
    main()
