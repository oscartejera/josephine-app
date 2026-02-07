#!/usr/bin/env python3
"""Seed Josephine database via Supabase REST API using service_role key."""

import json
import hashlib
import requests
from datetime import datetime, timedelta, date, time
import sys

BASE = "https://qzrbvjklgorfoqersdpx.supabase.co"
KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6cmJ2amtsZ29yZm9xZXJzZHB4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDI5NDYwMywiZXhwIjoyMDg1ODcwNjAzfQ.UgpxcrpVnrxaOlQHCcs4-5c4LABnHvFAysCbTrFLy3c"

HEADERS = {
    "apikey": KEY,
    "Authorization": f"Bearer {KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

HEADERS_MINIMAL = {
    "apikey": KEY,
    "Authorization": f"Bearer {KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

def api_get(table, params=""):
    r = requests.get(f"{BASE}/rest/v1/{table}?{params}", headers=HEADERS)
    r.raise_for_status()
    return r.json()

def api_post(table, data):
    r = requests.post(f"{BASE}/rest/v1/{table}", headers=HEADERS, json=data)
    if r.status_code >= 400:
        print(f"  ERROR POST {table}: {r.status_code} {r.text[:200]}")
    r.raise_for_status()
    return r.json()

def api_post_minimal(table, data):
    r = requests.post(f"{BASE}/rest/v1/{table}", headers=HEADERS_MINIMAL, json=data)
    if r.status_code >= 400:
        print(f"  ERROR POST {table}: {r.status_code} {r.text[:200]}")
    r.raise_for_status()

def api_delete(table, params):
    h = {**HEADERS_MINIMAL}
    r = requests.delete(f"{BASE}/rest/v1/{table}?{params}", headers=h)
    if r.status_code >= 400:
        print(f"  WARN DELETE {table}: {r.status_code} {r.text[:200]}")
    return r.status_code < 400

def api_patch(table, params, data):
    r = requests.patch(f"{BASE}/rest/v1/{table}?{params}", headers=HEADERS_MINIMAL, json=data)
    if r.status_code >= 400:
        print(f"  WARN PATCH {table}: {r.status_code} {r.text[:200]}")
    return r.status_code < 400

def api_upsert(table, data, on_conflict="id"):
    h = {**HEADERS_MINIMAL, "Prefer": "resolution=merge-duplicates"}
    r = requests.post(f"{BASE}/rest/v1/{table}", headers=h, json=data)
    if r.status_code >= 400:
        print(f"  WARN UPSERT {table}: {r.status_code} {r.text[:200]}")
    return r.status_code < 400

def hashtext(s):
    return int(hashlib.md5(s.encode()).hexdigest(), 16)


def main():
    print("=" * 60)
    print("JOSEPHINE SEED - Starting...")
    print("=" * 60)

    # ==============================
    # STEP 1: Get or create group
    # ==============================
    print("\n[1/9] Groups...")
    groups = api_get("groups", "limit=1")
    if groups:
        group_id = groups[0]["id"]
        print(f"  Existing group: {group_id}")
    else:
        result = api_post("groups", {"name": "La Taberna"})
        group_id = result[0]["id"]
        print(f"  Created group: {group_id}")

    # ==============================
    # STEP 2: Delete old locations (cascade deletes employees, shifts, clock records)
    # ==============================
    print("\n[2/9] Cleaning old locations...")
    api_delete("locations", "name=in.(La Taberna Centro,Chamberí,Malasaña)")
    print("  Old demo locations deleted (cascade)")

    # ==============================
    # STEP 3: Create 3 locations
    # ==============================
    print("\n[3/9] Creating locations...")
    locs = api_post("locations", [
        {"group_id": group_id, "name": "La Taberna Centro", "city": "Madrid", "timezone": "Europe/Madrid", "currency": "EUR"},
        {"group_id": group_id, "name": "Chamberí", "city": "Madrid", "timezone": "Europe/Madrid", "currency": "EUR"},
        {"group_id": group_id, "name": "Malasaña", "city": "Madrid", "timezone": "Europe/Madrid", "currency": "EUR"},
    ])
    loc_map = {l["name"]: l["id"] for l in locs}
    loc_centro = loc_map["La Taberna Centro"]
    loc_chamberi = loc_map["Chamberí"]
    loc_malasana = loc_map["Malasaña"]
    print(f"  Created: Centro={loc_centro[:8]}... Chamberí={loc_chamberi[:8]}... Malasaña={loc_malasana[:8]}...")

    # ==============================
    # STEP 4: Create employees (30 per location = 90)
    # ==============================
    print("\n[4/9] Creating employees...")
    centro_employees = [
        # Chefs
        ("Carlos García", "Chef", 18.00), ("María López", "Chef", 18.00),
        ("Juan Martínez", "Chef", 18.00), ("Ana Torres", "Chef", 18.00),
        ("Pedro Sánchez", "Chef", 18.00), ("Laura Fernández", "Chef", 18.00),
        ("Miguel Ruiz", "Chef", 18.00), ("Carmen Díaz", "Chef", 18.00),
        # Servers
        ("David Rodríguez", "Server", 12.00), ("Sara Gómez", "Server", 12.00),
        ("Pablo Jiménez", "Server", 12.00), ("Elena Moreno", "Server", 12.00),
        ("Jorge Álvarez", "Server", 12.00), ("Lucía Romero", "Server", 12.00),
        ("Alberto Navarro", "Server", 12.00), ("Isabel Gil", "Server", 12.00),
        ("Francisco Serrano", "Server", 12.00), ("Patricia Molina", "Server", 12.00),
        ("Antonio Castro", "Server", 12.00), ("Rosa Ortiz", "Server", 12.00),
        # Bartenders
        ("Manuel Rubio", "Bartender", 14.00), ("Teresa Vega", "Bartender", 14.00),
        ("Luis Ramos", "Bartender", 14.00), ("Cristina Herrera", "Bartender", 14.00),
        ("Javier Mendoza", "Bartender", 14.00),
        # Hosts
        ("Beatriz Cruz", "Host", 11.00), ("Raúl Delgado", "Host", 11.00),
        ("Sofía Vargas", "Host", 11.00),
        # Managers
        ("Fernando Iglesias", "Manager", 25.00), ("Marta Cortés", "Manager", 25.00),
    ]

    all_employees = []
    for name, role, cost in centro_employees:
        all_employees.append({"location_id": loc_centro, "full_name": name, "role_name": role, "hourly_cost": cost, "active": True})
    for name, role, cost in centro_employees:
        all_employees.append({"location_id": loc_chamberi, "full_name": f"{name} B.", "role_name": role, "hourly_cost": cost, "active": True})
    for name, role, cost in centro_employees:
        all_employees.append({"location_id": loc_malasana, "full_name": f"{name} M.", "role_name": role, "hourly_cost": cost, "active": True})

    # Insert in batches of 30
    created_employees = []
    for i in range(0, len(all_employees), 30):
        batch = all_employees[i:i+30]
        result = api_post("employees", batch)
        created_employees.extend(result)
    print(f"  Created {len(created_employees)} employees")

    # ==============================
    # STEP 5: Get auth users and link to employees
    # ==============================
    print("\n[5/9] Linking auth users to employees...")

    # Get auth users
    demo_emails = ["employee.centro@demo.com", "manager.centro@demo.com", "manager.salamanca@demo.com", "owner@demo.com"]
    auth_users = {}
    for email in demo_emails:
        r = requests.get(f"{BASE}/auth/v1/admin/users", headers=HEADERS)
        if r.status_code == 200:
            users_data = r.json()
            users_list = users_data.get("users", users_data) if isinstance(users_data, dict) else users_data
            for u in users_list:
                if u.get("email") in demo_emails:
                    auth_users[u["email"]] = u["id"]
        break  # Only need to call once

    print(f"  Found auth users: {list(auth_users.keys())}")

    # Link employee.centro@demo.com → first Server at Centro
    emp_user_id = auth_users.get("employee.centro@demo.com")
    if emp_user_id:
        server = next((e for e in created_employees if e["location_id"] == loc_centro and e["role_name"] == "Server"), None)
        if server:
            api_patch("employees", f"id=eq.{server['id']}", {"user_id": emp_user_id})
            print(f"  Linked employee.centro → {server['full_name']} ({server['id'][:8]}...)")

    # Link manager.centro@demo.com → first Manager at Centro
    mgr_centro_id = auth_users.get("manager.centro@demo.com")
    if mgr_centro_id:
        mgr = next((e for e in created_employees if e["location_id"] == loc_centro and e["role_name"] == "Manager"), None)
        if mgr:
            api_patch("employees", f"id=eq.{mgr['id']}", {"user_id": mgr_centro_id})
            print(f"  Linked manager.centro → {mgr['full_name']} ({mgr['id'][:8]}...)")

    # Link manager.salamanca@demo.com → first Manager at Chamberí
    mgr_sala_id = auth_users.get("manager.salamanca@demo.com")
    if mgr_sala_id:
        mgr = next((e for e in created_employees if e["location_id"] == loc_chamberi and e["role_name"] == "Manager"), None)
        if mgr:
            api_patch("employees", f"id=eq.{mgr['id']}", {"user_id": mgr_sala_id})
            print(f"  Linked manager.salamanca → {mgr['full_name']} ({mgr['id'][:8]}...)")

    # ==============================
    # STEP 6: Fix profiles + user_locations + user_roles
    # ==============================
    print("\n[6/9] Fixing profiles, user_locations, user_roles...")

    # Update all profiles with correct group_id
    api_patch("profiles", "id=neq.00000000-0000-0000-0000-000000000000", {"group_id": group_id})
    print(f"  Updated profiles.group_id → {group_id[:8]}...")

    # Create user_locations entries
    for email, uid in auth_users.items():
        if "employee.centro" in email or "manager.centro" in email:
            loc = loc_centro
        elif "manager.salamanca" in email:
            loc = loc_chamberi
        elif "owner" in email:
            # Owner gets all locations
            for lid in [loc_centro, loc_chamberi, loc_malasana]:
                api_upsert("user_locations", [{"user_id": uid, "location_id": lid}])
            print(f"  user_locations: {email} → all locations")
            continue
        else:
            continue
        api_upsert("user_locations", [{"user_id": uid, "location_id": loc}])
        print(f"  user_locations: {email} → {loc[:8]}...")

    # Fix user_roles location_id for employee roles
    if emp_user_id:
        # Get employee role_id
        roles = api_get("roles", "name=eq.employee&limit=1")
        if roles:
            emp_role_id = roles[0]["id"]
            # Get existing user_role for this user
            user_roles = api_get("user_roles", f"user_id=eq.{emp_user_id}&role_id=eq.{emp_role_id}")
            if user_roles:
                api_patch("user_roles", f"id=eq.{user_roles[0]['id']}", {"location_id": loc_centro})
                print(f"  Fixed user_roles.location_id for employee → Centro")
            else:
                # Create user_role entry
                try:
                    api_post_minimal("user_roles", {"user_id": emp_user_id, "role_id": emp_role_id, "location_id": loc_centro})
                    print(f"  Created user_role for employee → Centro")
                except:
                    print(f"  WARN: Could not create user_role for employee")

    # Fix store_manager roles location_id
    if mgr_centro_id:
        roles = api_get("roles", "name=eq.store_manager&limit=1")
        if roles:
            mgr_role_id = roles[0]["id"]
            user_roles = api_get("user_roles", f"user_id=eq.{mgr_centro_id}&role_id=eq.{mgr_role_id}")
            if user_roles:
                api_patch("user_roles", f"id=eq.{user_roles[0]['id']}", {"location_id": loc_centro})
                print(f"  Fixed user_roles.location_id for manager.centro → Centro")

    if mgr_sala_id:
        roles = api_get("roles", "name=eq.store_manager&limit=1")
        if roles:
            mgr_role_id = roles[0]["id"]
            user_roles = api_get("user_roles", f"user_id=eq.{mgr_sala_id}&role_id=eq.{mgr_role_id}")
            if user_roles:
                api_patch("user_roles", f"id=eq.{user_roles[0]['id']}", {"location_id": loc_chamberi})
                print(f"  Fixed user_roles.location_id for manager.sala → Chamberí")

    # ==============================
    # STEP 7: Generate planned shifts (28 days)
    # ==============================
    print("\n[7/9] Generating planned shifts...")

    today = date.today()
    shifts = []

    shift_patterns = {
        "Chef": [("08:00", "16:00"), ("15:00", "23:00"), ("09:00", "17:00")],
        "Manager": [("10:00", "18:00"), ("14:00", "22:00"), ("11:00", "19:00")],
        "Server": [("12:00", "20:00"), ("15:00", "23:00"), ("10:00", "18:00")],
        "Bartender": [("15:00", "23:00"), ("12:00", "20:00"), ("16:00", "00:00")],
        "Host": [("12:00", "20:00"), ("15:00", "23:00"), ("10:00", "18:00")],
    }

    for emp in created_employees:
        for day_offset in range(-14, 15):
            d = today + timedelta(days=day_offset)
            key = f"{emp['id']}{d.isoformat()}"

            # Skip ~2 days per week
            if hashtext(key) % 7 < 2:
                continue

            role = emp.get("role_name", "Server")
            patterns = shift_patterns.get(role, shift_patterns["Server"])
            pattern_idx = hashtext(key + "shift") % len(patterns)
            start, end = patterns[pattern_idx]

            shifts.append({
                "employee_id": emp["id"],
                "location_id": emp["location_id"],
                "shift_date": d.isoformat(),
                "start_time": start,
                "end_time": end,
                "planned_hours": 8,
                "planned_cost": 8 * (emp.get("hourly_cost") or 14),
                "role": role,
                "status": "published",
            })

    print(f"  Generated {len(shifts)} shifts, inserting in batches...")

    inserted = 0
    batch_size = 200
    for i in range(0, len(shifts), batch_size):
        batch = shifts[i:i+batch_size]
        try:
            api_post_minimal("planned_shifts", batch)
            inserted += len(batch)
            if (i // batch_size) % 5 == 0:
                print(f"  ... {inserted}/{len(shifts)}")
        except Exception as e:
            print(f"  ERROR at batch {i}: {e}")
            # Try smaller batches
            for shift in batch:
                try:
                    api_post_minimal("planned_shifts", shift)
                    inserted += 1
                except:
                    pass

    print(f"  Inserted {inserted} planned shifts")

    # ==============================
    # STEP 8: Generate clock records (past 14 days)
    # ==============================
    print("\n[8/9] Generating clock records...")

    clock_records = []
    for s in shifts:
        shift_date = date.fromisoformat(s["shift_date"])
        if shift_date >= today or shift_date < today - timedelta(days=14):
            continue

        key = f"{s['employee_id']}{s['shift_date']}"
        variance_in = hashtext(key + "in") % 8
        variance_out = hashtext(key + "out") % 12

        start_h, start_m = map(int, s["start_time"].split(":"))
        end_h, end_m = map(int, s["end_time"].split(":"))

        clock_in = datetime(shift_date.year, shift_date.month, shift_date.day, start_h, start_m) - timedelta(minutes=variance_in)

        if end_h == 0:  # midnight
            clock_out = datetime(shift_date.year, shift_date.month, shift_date.day, 0, 0) + timedelta(days=1, minutes=variance_out)
        elif end_h < start_h:
            clock_out = datetime(shift_date.year, shift_date.month, shift_date.day, end_h, end_m) + timedelta(days=1, minutes=variance_out)
        else:
            clock_out = datetime(shift_date.year, shift_date.month, shift_date.day, end_h, end_m) + timedelta(minutes=variance_out)

        source = "geo" if hashtext(key) % 3 == 0 else "manual"

        clock_records.append({
            "employee_id": s["employee_id"],
            "location_id": s["location_id"],
            "clock_in": clock_in.isoformat() + "+01:00",
            "clock_out": clock_out.isoformat() + "+01:00",
            "source": source,
        })

    print(f"  Generated {len(clock_records)} clock records, inserting...")

    inserted_cr = 0
    for i in range(0, len(clock_records), 200):
        batch = clock_records[i:i+200]
        try:
            api_post_minimal("employee_clock_records", batch)
            inserted_cr += len(batch)
            if (i // 200) % 5 == 0:
                print(f"  ... {inserted_cr}/{len(clock_records)}")
        except Exception as e:
            print(f"  ERROR at batch {i}: {e}")

    print(f"  Inserted {inserted_cr} clock records")

    # ==============================
    # STEP 9: Announcements
    # ==============================
    print("\n[9/9] Creating announcements...")

    # Delete existing announcements
    api_delete("announcements", "id=neq.00000000-0000-0000-0000-000000000000")

    now = datetime.now()
    announcements = [
        {"title": "Horario especial San Valentín", "body": "El 14 de febrero abrimos de 12:00 a 01:00. Se necesita personal extra para el turno de noche.", "type": "schedule", "pinned": True, "author": "Dirección", "location_id": loc_centro, "created_at": now.isoformat()},
        {"title": "Formación de alérgenos obligatoria", "body": "Recordatorio: la formación sobre alérgenos del día 20 es obligatoria para todo el personal de sala y cocina.", "type": "important", "pinned": True, "author": "Gerencia", "created_at": (now - timedelta(days=1)).isoformat()},
        {"title": "Nuevo menú de temporada", "body": "A partir del lunes se incorporan 3 nuevos platos al menú. Formación el domingo a las 11:00.", "type": "info", "pinned": True, "author": "Chef ejecutivo", "created_at": (now - timedelta(days=1)).isoformat()},
        {"title": "Empleado del mes: María López", "body": "Felicidades a María por su excelente trabajo este mes.", "type": "celebration", "pinned": False, "author": "Dirección", "location_id": loc_centro, "created_at": (now - timedelta(days=2)).isoformat()},
        {"title": "Recordatorio: Higiene y seguridad", "body": "Recordad usar siempre el EPI correspondiente en cocina.", "type": "important", "pinned": False, "author": "Gerencia", "created_at": (now - timedelta(days=3)).isoformat()},
        {"title": "Cambio de turno disponible", "body": "Carlos busca cambio de turno para el viernes. Turno de tarde por turno de mañana.", "type": "schedule", "pinned": False, "author": "Carlos García", "location_id": loc_centro, "created_at": (now - timedelta(days=4)).isoformat()},
        {"title": "Cena de equipo", "body": "El próximo martes después del cierre haremos una cena de equipo. ¡Estáis todos invitados!", "type": "celebration", "pinned": False, "author": "Dirección", "created_at": (now - timedelta(days=5)).isoformat()},
        {"title": "Nuevos uniformes disponibles", "body": "Ya están disponibles los nuevos uniformes. Pasad por el almacén para recoger vuestra talla.", "type": "info", "pinned": False, "author": "RRHH", "created_at": (now - timedelta(days=6)).isoformat()},
        {"title": "Objetivo mensual superado", "body": "Este mes hemos superado el objetivo de ventas en un 12%. ¡Seguid así!", "type": "celebration", "pinned": False, "author": "Dirección", "created_at": (now - timedelta(days=8)).isoformat()},
        {"title": "Actualización del protocolo", "body": "Se actualizan las medidas de prevención. Consultar el tablón de la cocina.", "type": "important", "pinned": False, "author": "Gerencia", "created_at": (now - timedelta(days=10)).isoformat()},
    ]

    try:
        api_post_minimal("announcements", announcements)
        print(f"  Inserted {len(announcements)} announcements")
    except Exception as e:
        print(f"  ERROR announcements: {e}")
        # Try one by one
        for a in announcements:
            try:
                api_post_minimal("announcements", a)
            except Exception as e2:
                print(f"  Skip: {a['title'][:30]}: {e2}")

    # ==============================
    # DONE
    # ==============================
    print("\n" + "=" * 60)
    print("SEED COMPLETE!")
    print(f"  Group: {group_id[:8]}...")
    print(f"  Locations: 3 (Centro, Chamberí, Malasaña)")
    print(f"  Employees: {len(created_employees)}")
    print(f"  Planned Shifts: {inserted}")
    print(f"  Clock Records: {inserted_cr}")
    print(f"  Announcements: {len(announcements)}")
    print(f"  Auth users linked: {list(auth_users.keys())}")
    print("=" * 60)


if __name__ == "__main__":
    main()
