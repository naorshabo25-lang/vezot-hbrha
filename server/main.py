import os
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Request, Form, HTTPException, Query
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

from database import init_db, get_db
from whatsapp import send_whatsapp_message, send_quantity_list, send_area_list, send_time_list, send_date_list
from scheduler import start_scheduler, reschedule, reschedule_admin

AREA_DISPLAY = {
    "area_jerusalem":    "ירושלים והסביבה",
    "area_modiin":       "מודיעין",
    "area_maale_adumim": "מעלה אדומים",
    "area_beit_shemesh": "בית שמש",
}
AREA_DRIVER_KEY = {
    "area_jerusalem":    "ירושלים",
    "area_modiin":       "מודיעין",
    "area_maale_adumim": "מעלה אדומים",
    "area_beit_shemesh": "בית שמש",
}
QUANTITY_MAP = {
    "qty_0_100":     "0–100",
    "qty_100_400":   "100–400",
    "qty_400_1000":  "400–1,000",
    "qty_1000_2000": "1,000–2,000",
}
TIME_MAP = {
    "time_07_09": "07:00–09:00",
    "time_09_11": "09:00–11:00",
    "time_11_13": "11:00–13:00",
    "time_13_15": "13:00–15:00",
}

def _parse_quantity_lower(quantity_str: str) -> int:
    """מחזיר את הגבול התחתון של הכמות כמספר שלם."""
    try:
        return int(quantity_str.split("–")[0].replace(",", "").strip())
    except Exception:
        return 0


def _tanker_vol(driver) -> int:
    try:
        return int(str(driver["tanker_volume"]).replace(",", ""))
    except Exception:
        return 0


def assign_driver(conn, area: str, quantity_str: str):
    """
    מחזיר נהג מתאים לפי אזור וכמות.
    כלל מיוחד: ירושלים + מעל 400 ליטר → מעדיף את 'ישראל מזרחי'.
    """
    qty_lower = _parse_quantity_lower(quantity_str)
    drivers   = conn.execute("SELECT * FROM drivers").fetchall()

    # סנן נהגים שפועלים באזור הנדרש
    def serves_area(d):
        return any(area.strip() in a.strip() for a in d["area"].split(","))

    candidates = [d for d in drivers if serves_area(d)]
    if not candidates:
        candidates = drivers  # fallback: כל הנהגים

    # כלל מיוחד: ירושלים + מעל 400 ליטר → ישראל מזרחי
    if "ירושלים" in area and qty_lower >= 400:
        israel = next((d for d in candidates if "ישראל מזרחי" in d["name"]), None)
        if israel:
            return israel

    # העדף נהג שמיכליתו מספיקה לכמות — הקטנה שמתאימה (יעילות)
    fitting = [d for d in candidates if _tanker_vol(d) >= qty_lower]
    if fitting:
        return min(fitting, key=_tanker_vol)

    # אם אין — קח בעל המיכלית הגדולה ביותר
    return max(candidates, key=_tanker_vol) if candidates else None


from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="מערכת הזמנות סולר")
_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/static", StaticFiles(directory="static"), name="static")

BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")
VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN", "secret")


# ── Startup ──────────────────────────────────────────────────────────────────

@app.on_event("startup")
def startup():
    init_db()
    with get_db() as conn:
        settings = {r["key"]: r["value"] for r in conn.execute("SELECT key, value FROM settings").fetchall()}
    hour   = int(settings.get("daily_hour", 14))
    minute = int(settings.get("daily_minute", 0))
    admin_hour   = int(settings["admin_schedule_hour"])   if settings.get("admin_schedule_hour")   else None
    admin_minute = int(settings.get("admin_schedule_minute", 0))
    start_scheduler(hour, minute, admin_hour, admin_minute)


# ── WhatsApp Webhook ──────────────────────────────────────────────────────────

@app.get("/webhook")
def verify_webhook(request: Request):
    params = dict(request.query_params)
    if params.get("hub.verify_token") == VERIFY_TOKEN:
        return int(params.get("hub.challenge", 0))
    raise HTTPException(status_code=403, detail="Forbidden")


@app.post("/webhook")
async def receive_message(request: Request):
    data = await request.json()

    # סטטוס קריאה
    try:
        for s in data["entry"][0]["changes"][0]["value"].get("statuses", []):
            if s.get("status") == "read":
                with get_db() as conn:
                    conn.execute("UPDATE customers SET msg_read=1 WHERE last_msg_id=?", (s["id"],))
    except Exception:
        pass

    try:
        entry   = data["entry"][0]["changes"][0]["value"]
        message = entry["messages"][0]
        phone   = message["from"]
        msg_type = message.get("type", "text")

        # כפתור ביצוע מנהג — לפני כל בדיקה אחרת
        if msg_type == "interactive":
            inter = message["interactive"]
            if inter.get("type") == "button_reply":
                btn_id = inter["button_reply"]["id"]
                if btn_id.startswith("done_"):
                    order_id = int(btn_id.split("_")[1])
                    with get_db() as conn:
                        conn.execute("UPDATE orders SET status='הושלם' WHERE id=?", (order_id,))
                    send_whatsapp_message(phone, f"✅ הזמנה #{order_id} סומנה כהושלם!")
                    return JSONResponse({"status": "ok"})

        if msg_type == "text":
            text     = message["text"]["body"].strip()
            reply_id = None
        elif msg_type == "interactive":
            inter = message["interactive"]
            if inter["type"] == "list_reply":
                reply_id = inter["list_reply"]["id"]
                text     = inter["list_reply"]["title"]
            elif inter["type"] == "button_reply":
                reply_id = inter["button_reply"]["id"]
                text     = inter["button_reply"]["title"]
            else:
                return JSONResponse({"status": "ok"})
        else:
            return JSONResponse({"status": "ok"})
    except (KeyError, IndexError):
        return JSONResponse({"status": "ok"})

    # מצא לקוח (תומך 0XXXXXXXX ו-972XXXXXXXX)
    phone_alt = ("0" + phone[3:]) if phone.startswith("972") else ("972" + phone[1:])
    with get_db() as conn:
        customer = conn.execute(
            "SELECT * FROM customers WHERE (phone=? OR phone=?) AND active=1",
            (phone, phone_alt)
        ).fetchone()
        state = conn.execute(
            "SELECT * FROM conversation_state WHERE phone=?", (phone,)
        ).fetchone()

    if not customer:
        send_whatsapp_message(phone, "מספר זה אינו רשום במערכת. אנא פנה למנהל.")
        return JSONResponse({"status": "ok"})

    step = state["step"] if state else None

    # זיהוי כוונת הזמנה עצמאית ("אפשר לבצע הזמנה?" וכד')
    ORDER_KEYWORDS = ["הזמנה", "להזמין", "לבצע", "אפשר", "רוצה להזמין", "סולר", "דלק"]
    text_lower = text.strip().lower()
    is_order_intent = (
        step is None
        and any(kw in text_lower for kw in ORDER_KEYWORDS)
        and text_lower not in {"כן", "yes", "1", "כן!", "כן.", "כן,", "אישור"}
    )
    if is_order_intent:
        with get_db() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO conversation_state (phone, step, customer_id) VALUES (?,?,?)",
                (phone, "awaiting_date", customer["id"])
            )
        send_date_list(phone)
        return JSONResponse({"status": "ok"})

    # שלב awaiting_date — לקוח בחר תאריך
    if step == "awaiting_date":
        from datetime import date as dt, timedelta
        if reply_id and reply_id.startswith("date_"):
            order_date = reply_id[5:]  # "date_2026-05-30" → "2026-05-30"
        else:
            order_date = (dt.today() + timedelta(days=1)).isoformat()
        with get_db() as conn:
            conn.execute(
                "UPDATE conversation_state SET step=?, order_date=?, updated_at=datetime('now','localtime') WHERE phone=?",
                ("awaiting_quantity", order_date, phone)
            )
        from datetime import datetime
        d = datetime.strptime(order_date, "%Y-%m-%d")
        date_label = f"{d.day}/{d.month}/{d.year}"
        send_whatsapp_message(phone, f"מצוין! תאריך אספקה: {date_label} 📅")
        send_quantity_list(phone)
        return JSONResponse({"status": "ok"})

    # שלב 0 — לקוח ענה "כן" להודעה היומית
    positive = {"כן", "yes", "1", "כן!", "כן.", "כן,", "אישור"}
    if step is None and text_lower in {r.lower() for r in positive}:
        from datetime import date as dt, timedelta
        tomorrow = (dt.today() + timedelta(days=1)).isoformat()
        with get_db() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO conversation_state (phone, step, customer_id, order_date) VALUES (?,?,?,?)",
                (phone, "awaiting_quantity", customer["id"], tomorrow)
            )
        send_quantity_list(phone)
        return JSONResponse({"status": "ok"})

    # שלב 1 — בחירת כמות
    if step == "awaiting_quantity":
        if reply_id not in QUANTITY_MAP:
            send_whatsapp_message(phone, "אנא בחר כמות מהרשימה 👇")
            send_quantity_list(phone)
            return JSONResponse({"status": "ok"})
        quantity = QUANTITY_MAP[reply_id]
        with get_db() as conn:
            conn.execute(
                "UPDATE conversation_state SET step=?, quantity=?, updated_at=datetime('now','localtime') WHERE phone=?",
                ("awaiting_area", quantity, phone)
            )
        send_whatsapp_message(phone, f"מצוין! {quantity} ליטר.")
        send_area_list(phone)
        return JSONResponse({"status": "ok"})

    # שלב 2 — בחירת אזור
    if step == "awaiting_area":
        if reply_id not in AREA_DISPLAY:
            send_whatsapp_message(phone, "אנא בחר אזור מהרשימה 👇")
            send_area_list(phone)
            return JSONResponse({"status": "ok"})
        city       = AREA_DISPLAY[reply_id]
        driver_key = AREA_DRIVER_KEY[reply_id]
        with get_db() as conn:
            conn.execute(
                "UPDATE conversation_state SET step=?, city=?, updated_at=datetime('now','localtime') WHERE phone=?",
                ("awaiting_address", driver_key, phone)
            )
        send_whatsapp_message(phone, f"מה הכתובת המדויקת ב{city}?")
        return JSONResponse({"status": "ok"})

    # שלב 3 — כתובת מדויקת
    if step == "awaiting_address":
        with get_db() as conn:
            conn.execute(
                "UPDATE conversation_state SET step=?, address=?, updated_at=datetime('now','localtime') WHERE phone=?",
                ("awaiting_time", text, phone)
            )
        send_time_list(phone)
        return JSONResponse({"status": "ok"})

    # שלב 4 — בחירת שעה → יצירת הזמנה
    if step == "awaiting_time":
        from datetime import date as dt, timedelta
        delivery_time = TIME_MAP.get(reply_id, text) if reply_id else text
        with get_db() as conn:
            row       = conn.execute("SELECT * FROM conversation_state WHERE phone=?", (phone,)).fetchone()
            quantity      = row["quantity"]
            city          = row["city"]
            address       = row["address"]
            contact_name  = customer["contact_name"]
            contact_phone = customer["contact_phone"]
            order_date    = row["order_date"] or (dt.today() + timedelta(days=1)).isoformat()
            driver    = assign_driver(conn, city, quantity)
            driver_id = driver["id"] if driver else None
            conn.execute(
                """INSERT INTO orders
                   (customer_id, customer_name, site_address, contact_name, contact_phone,
                    quantity, driver_id, order_date, delivery_time)
                   VALUES (?,?,?,?,?,?,?,?,?)""",
                (customer["id"], customer["name"], f"{city}, {address}",
                 contact_name, contact_phone,
                 quantity, driver_id, order_date, delivery_time)
            )
            conn.execute("DELETE FROM conversation_state WHERE phone=?", (phone,))
        from datetime import datetime
        d = datetime.strptime(order_date, "%Y-%m-%d")
        date_label = f"{d.day}/{d.month}/{d.year}"
        send_whatsapp_message(
            phone,
            f"ההזמנה התקבלה! ✅\n\n"
            f"תאריך אספקה: {date_label}\n"
            f"כמות: {quantity} ליטר\n"
            f"כתובת: {city}, {address}\n"
            f"איש קשר: {contact_name}\n"
            f"טלפון נייד: {contact_phone}\n"
            f"שעת אספקה: {delivery_time}\n\n"
            f"נשתדל לעמוד בטווחי הזמנים.\n"
            f"נדאג לאספקה. תודה! 🙏\n\n"
            f"לכל בעיה נא לפנות לנאור - 0506877866"
        )
        return JSONResponse({"status": "ok"})

    return JSONResponse({"status": "ok"})


# ── Order Form ────────────────────────────────────────────────────────────────

@app.get("/order-form/{customer_id}", response_class=HTMLResponse)
def order_form(customer_id: int):
    return FileResponse("static/order_form.html")


@app.post("/submit-order")
def submit_order(
    customer_id: int = Form(...),
    customer_name: str = Form(...),
    site_address: str = Form(...),
    contact_name: str = Form(...),
    contact_phone: str = Form(...),
    quantity: str = Form(...),
):
    with get_db() as conn:
        customer = conn.execute(
            "SELECT * FROM customers WHERE id = ?", (customer_id,)
        ).fetchone()
        if not customer:
            raise HTTPException(status_code=404, detail="לקוח לא נמצא")

        driver = conn.execute(
            "SELECT * FROM drivers WHERE area = ? LIMIT 1", (customer["area"],)
        ).fetchone()
        driver_id = driver["id"] if driver else None

        conn.execute(
            """INSERT INTO orders
               (customer_id, customer_name, site_address, contact_name, contact_phone, quantity, driver_id)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (customer_id, customer_name, site_address, contact_name, contact_phone, quantity, driver_id),
        )

    return HTMLResponse("""
    <!DOCTYPE html><html dir="rtl" lang="he">
    <head><meta charset="UTF-8"><title>תודה</title>
    <style>body{font-family:Arial;text-align:center;padding:60px;background:#f0f9f0;}
    h1{color:#2e7d32;}p{font-size:1.2em;}</style></head>
    <body><h1>ההזמנה התקבלה!</h1>
    <p>תודה, ההזמנה שלך נקלטה במערכת ותטופל בהקדם.</p></body></html>
    """)


# ── Admin API ─────────────────────────────────────────────────────────────────

NO_CACHE = {"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache"}

@app.get("/dashboard", response_class=HTMLResponse)
def dashboard():
    return FileResponse("static/dashboard.html", headers=NO_CACHE)


@app.get("/api/orders")
def get_orders(date: str = Query(default=None)):
    with get_db() as conn:
        if date:
            rows = conn.execute("""
                SELECT o.*, d.name as driver_name
                FROM orders o LEFT JOIN drivers d ON o.driver_id = d.id
                WHERE o.order_date = ?
                ORDER BY o.created_at DESC
            """, (date,)).fetchall()
        else:
            rows = conn.execute("""
                SELECT o.*, d.name as driver_name
                FROM orders o LEFT JOIN drivers d ON o.driver_id = d.id
                ORDER BY o.created_at DESC
            """).fetchall()
    return [dict(r) for r in rows]


@app.get("/api/orders/dates")
def get_order_dates():
    with get_db() as conn:
        rows = conn.execute("SELECT DISTINCT order_date FROM orders WHERE order_date IS NOT NULL").fetchall()
    return [r["order_date"] for r in rows]


@app.post("/api/orders")
async def add_order_manual(request: Request):
    body = await request.json()
    with get_db() as conn:
        customer_id = body.get("customer_id")
        area = body.get("area", "")
        if not area and customer_id:
            c = conn.execute("SELECT * FROM customers WHERE id = ?", (customer_id,)).fetchone()
            if c:
                area = c["area"]
        driver = conn.execute("SELECT * FROM drivers WHERE area = ? LIMIT 1", (area,)).fetchone()
        driver_id = driver["id"] if driver else None
        from datetime import date as dt
        order_date = body.get("order_date") or dt.today().isoformat()
        conn.execute(
            """INSERT INTO orders
               (customer_id, customer_name, site_address, contact_name, contact_phone, quantity, driver_id, order_date)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (customer_id, body["customer_name"], body["site_address"],
             body["contact_name"], body["contact_phone"], body["quantity"], driver_id, order_date),
        )
    return {"ok": True}


@app.delete("/api/orders/{order_id}")
def delete_order(order_id: int):
    with get_db() as conn:
        conn.execute("DELETE FROM orders WHERE id = ?", (order_id,))
    return {"ok": True}


@app.put("/api/orders/{order_id}/status")
async def update_order_status(order_id: int, request: Request):
    body = await request.json()
    status = body.get("status")
    with get_db() as conn:
        conn.execute("UPDATE orders SET status = ? WHERE id = ?", (status, order_id))
    return {"ok": True}


@app.get("/api/customers")
def get_customers():
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM customers WHERE active=1 ORDER BY name").fetchall()
    return [dict(r) for r in rows]


@app.post("/api/customers")
async def add_customer(request: Request):
    body = await request.json()
    with get_db() as conn:
        conn.execute(
            "INSERT INTO customers (name, phone, area, site_address, contact_name, contact_phone, email, order_contact_name, order_contact_phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (body["name"], body.get("phone", ""), body.get("area", ""),
             body.get("site_address", ""), body.get("contact_name", ""), body.get("contact_phone", ""),
             body.get("email", ""), body.get("order_contact_name", ""), body.get("order_contact_phone", "")),
        )
    return {"ok": True}


@app.put("/api/customers/{cid}")
async def update_customer(cid: int, request: Request):
    body = await request.json()
    with get_db() as conn:
        conn.execute(
            "UPDATE customers SET name=?, phone=?, area=?, site_address=?, contact_name=?, contact_phone=?, email=?, order_contact_name=?, order_contact_phone=? WHERE id=?",
            (body["name"], body.get("phone", ""), body.get("area", ""),
             body.get("site_address", ""), body.get("contact_name", ""),
             body.get("contact_phone", ""), body.get("email", ""),
             body.get("order_contact_name", ""), body.get("order_contact_phone", ""), cid),
        )
    return {"ok": True}


@app.delete("/api/customers/{cid}")
def delete_customer(cid: int):
    with get_db() as conn:
        conn.execute("UPDATE customers SET active = 0 WHERE id = ?", (cid,))
    return {"ok": True}


@app.get("/api/drivers")
def get_drivers():
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM drivers ORDER BY name").fetchall()
    return [dict(r) for r in rows]


@app.post("/api/drivers")
async def add_driver(request: Request):
    body = await request.json()
    with get_db() as conn:
        conn.execute(
            "INSERT INTO drivers (name, phone, area, tanker_volume, truck_number) VALUES (?, ?, ?, ?, ?)",
            (body["name"], body["phone"], body["area"],
             body.get("tanker_volume", ""), body.get("truck_number", "")),
        )
    return {"ok": True}


@app.get("/api/drivers/{did}/orders")
def get_driver_orders(did: int, date: str = Query(default=None)):
    from datetime import date as dt
    target = date or dt.today().isoformat()
    with get_db() as conn:
        rows = conn.execute("""
            SELECT * FROM orders
            WHERE driver_id = ? AND order_date = ?
            ORDER BY created_at
        """, (did, target)).fetchall()
    return [dict(r) for r in rows]


@app.put("/api/drivers/{did}")
async def update_driver(did: int, request: Request):
    body = await request.json()
    with get_db() as conn:
        conn.execute(
            "UPDATE drivers SET name=?, phone=?, area=?, truck_number=?, tanker_volume=? WHERE id=?",
            (body["name"], body["phone"], body["area"],
             body.get("truck_number", ""), body.get("tanker_volume", ""), did),
        )
    return {"ok": True}


@app.delete("/api/drivers/{did}")
def delete_driver(did: int):
    with get_db() as conn:
        conn.execute("DELETE FROM drivers WHERE id = ?", (did,))
    return {"ok": True}


@app.get("/api/settings")
def get_settings():
    with get_db() as conn:
        rows = conn.execute("SELECT key, value FROM settings").fetchall()
    return {r["key"]: r["value"] for r in rows}


@app.post("/api/settings")
async def update_settings(request: Request):
    body = await request.json()
    with get_db() as conn:
        for key, value in body.items():
            conn.execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
                (key, str(value)),
            )
    if "daily_hour" in body or "daily_minute" in body:
        with get_db() as conn:
            s = {r["key"]: r["value"] for r in conn.execute("SELECT key, value FROM settings").fetchall()}
        reschedule(int(s["daily_hour"]), int(s["daily_minute"]))
    if "admin_schedule_hour" in body or "admin_schedule_minute" in body:
        with get_db() as conn:
            s = {r["key"]: r["value"] for r in conn.execute("SELECT key, value FROM settings").fetchall()}
        reschedule_admin(int(s["admin_schedule_hour"]), int(s.get("admin_schedule_minute", 0)))
    return {"ok": True}


@app.get("/api/tasks/week")
def get_weekly_tasks():
    from datetime import date as dt, timedelta
    today = dt.today()
    week_dates = [(today + timedelta(days=i)).isoformat() for i in range(7)]
    with get_db() as conn:
        drivers = conn.execute("SELECT * FROM drivers ORDER BY name").fetchall()
        result = []
        for d in drivers:
            orders_by_date = {}
            for date_str in week_dates:
                rows = conn.execute("""
                    SELECT * FROM orders WHERE driver_id = ? AND order_date = ?
                    ORDER BY created_at
                """, (d["id"], date_str)).fetchall()
                if rows:
                    orders_by_date[date_str] = [dict(r) for r in rows]
            result.append({**dict(d), "orders_by_date": orders_by_date})
    return result


@app.post("/api/customers/import-excel")
async def import_excel(request: Request):
    import openpyxl, io
    body = await request.body()
    try:
        wb = openpyxl.load_workbook(io.BytesIO(body))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"לא ניתן לפתוח את הקובץ: {e}")

    ws = wb.active
    headers = [str(c.value).strip() if c.value else "" for c in next(ws.iter_rows(min_row=1, max_row=1))]

    COL_MAP = {
        "name":          ["שם","שם לקוח","name","company","שם עסק","לקוח"],
        "phone":         ["טלפון","phone","mobile","נייד","טל","טל'"],
        "area":          ["אזור","area","region","אזור חלוקה"],
        "email":         ["מייל","email","e-mail","אימייל","דואר אלקטרוני"],
        "site_address":  ["כתובת","כתובת אתר","address","site","כתובת האתר"],
        "contact_name":  ["איש קשר","contact","contact name","שם איש קשר"],
        "contact_phone": ["טלפון איש קשר","contact phone","נייד איש קשר"],
    }

    col_idx = {}
    for field, aliases in COL_MAP.items():
        for i, h in enumerate(headers):
            if h.strip().lower() in [a.lower() for a in aliases]:
                col_idx[field] = i
                break

    if "name" not in col_idx:
        raise HTTPException(
            status_code=400,
            detail=f"לא נמצאה עמודת שם לקוח. כותרות שנמצאו בקובץ: {', '.join(h for h in headers if h)}"
        )

    imported = 0
    skipped = 0
    with get_db() as conn:
        for row in ws.iter_rows(min_row=2, values_only=True):
            def g(field):
                idx = col_idx.get(field)
                return str(row[idx]).strip() if idx is not None and row[idx] is not None else ""
            name = g("name")
            if not name or name == "None":
                skipped += 1
                continue
            conn.execute(
                "INSERT INTO customers (name, phone, area, email, site_address, contact_name, contact_phone) VALUES (?,?,?,?,?,?,?)",
                (name, g("phone"), g("area"), g("email"), g("site_address"), g("contact_name"), g("contact_phone"))
            )
            imported += 1

    return {"ok": True, "imported": imported, "skipped": skipped,
            "mapped_columns": list(col_idx.keys())}


@app.get("/api/potential-customers")
def get_potential_customers():
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM potential_customers WHERE active=1 ORDER BY name").fetchall()
    return [dict(r) for r in rows]


@app.post("/api/potential-customers")
async def add_potential_customer(request: Request):
    body = await request.json()
    with get_db() as conn:
        conn.execute(
            "INSERT INTO potential_customers (name, phone, area, site_address, contact_name, contact_phone, email) VALUES (?,?,?,?,?,?,?)",
            (body["name"], body.get("phone",""), body.get("area",""),
             body.get("site_address",""), body.get("contact_name",""),
             body.get("contact_phone",""), body.get("email","")),
        )
    return {"ok": True}


@app.delete("/api/potential-customers/{cid}")
def delete_potential_customer(cid: int):
    with get_db() as conn:
        conn.execute("UPDATE potential_customers SET active = 0 WHERE id = ?", (cid,))
    return {"ok": True}


@app.post("/api/potential-customers/import-excel")
async def import_potential_excel(request: Request):
    import openpyxl, io
    body = await request.body()
    try:
        wb = openpyxl.load_workbook(io.BytesIO(body))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"לא ניתן לפתוח את הקובץ: {e}")

    ws = wb.active
    headers = [str(c.value).strip() if c.value else "" for c in next(ws.iter_rows(min_row=1, max_row=1))]

    COL_MAP = {
        "name":          ["שם","שם לקוח","name","company","שם עסק","לקוח"],
        "phone":         ["טלפון","phone","mobile","נייד","טל","טל'","טלפון ראשי"],
        "area":          ["אזור","area","region","אזור חלוקה"],
        "email":         ["מייל","email","e-mail","אימייל","דואר אלקטרוני"],
        "site_address":  ["כתובת","כתובת אתר","address","site","כתובת האתר"],
        "contact_name":  ["איש קשר","contact","contact name","שם איש קשר"],
        "contact_phone": ["טלפון איש קשר","contact phone","נייד איש קשר"],
    }

    col_idx = {}
    for field, aliases in COL_MAP.items():
        for i, h in enumerate(headers):
            if h.strip().lower() in [a.lower() for a in aliases]:
                col_idx[field] = i
                break

    if "name" not in col_idx:
        raise HTTPException(
            status_code=400,
            detail=f"לא נמצאה עמודת שם לקוח. כותרות שנמצאו: {', '.join(h for h in headers if h)}"
        )

    imported = 0
    skipped = 0
    with get_db() as conn:
        for row in ws.iter_rows(min_row=2, values_only=True):
            def g(field):
                idx = col_idx.get(field)
                return str(row[idx]).strip() if idx is not None and row[idx] is not None else ""
            name = g("name")
            if not name or name == "None":
                skipped += 1
                continue
            conn.execute(
                "INSERT INTO potential_customers (name, phone, area, email, site_address, contact_name, contact_phone) VALUES (?,?,?,?,?,?,?)",
                (name, g("phone"), g("area"), g("email"), g("site_address"), g("contact_name"), g("contact_phone"))
            )
            imported += 1

    return {"ok": True, "imported": imported, "skipped": skipped,
            "mapped_columns": list(col_idx.keys())}


@app.post("/api/send-email")
async def send_mass_email(request: Request):
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    body = await request.json()
    subject    = body.get("subject", "")
    content    = body.get("content", "")
    recipients = body.get("recipients", [])

    GMAIL_USER = os.getenv("GMAIL_USER", "")
    GMAIL_PASS = os.getenv("GMAIL_APP_PASSWORD", "")

    if not GMAIL_USER or not GMAIL_PASS:
        raise HTTPException(status_code=500, detail="חסרים פרטי Gmail ב-.env")

    if not recipients:
        raise HTTPException(status_code=400, detail="אין לקוחות עם כתובת מייל")

    sent, failed = 0, 0
    try:
        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.starttls()
        server.login(GMAIL_USER, GMAIL_PASS)

        for r in recipients:
            try:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"]    = GMAIL_USER
                msg["To"]      = r["email"]
                personal = content.replace("{name}", r.get("name", ""))
                msg.attach(MIMEText(personal, "plain", "utf-8"))
                server.sendmail(GMAIL_USER, r["email"], msg.as_string())
                sent += 1
            except Exception:
                failed += 1

        server.quit()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"שגיאת Gmail: {e}")

    return {"ok": True, "sent": sent, "failed": failed}


@app.post("/api/test-message")
async def send_test_message(request: Request):
    body = await request.json()
    phone = body.get("phone", "").strip().replace(" ", "").replace("-", "")
    if not phone:
        raise HTTPException(status_code=400, detail="חסר מספר טלפון")
    if phone.startswith("0"):
        phone = "972" + phone[1:]
    with get_db() as conn:
        settings = {r["key"]: r["value"] for r in conn.execute("SELECT key, value FROM settings").fetchall()}
    template = settings.get("message_template", "שלום {name}, האם תצטרך הזמנת דלק סולר למחר?")
    text = template.replace("{name}", "לקוח לדוגמה")
    from whatsapp import send_whatsapp_message
    success = send_whatsapp_message(phone, text)
    return {"ok": success, "message": text}


@app.post("/api/send-daily-schedule")
async def send_daily_schedule():
    from datetime import date as dt
    from whatsapp import send_order_card
    target_date = dt.today().isoformat()

    with get_db() as conn:
        settings    = {r["key"]: r["value"] for r in conn.execute("SELECT key, value FROM settings").fetchall()}
        admin_phone = settings.get("admin_phone", "").strip().replace(" ", "").replace("-", "")
        if admin_phone.startswith("0"):
            admin_phone = "972" + admin_phone[1:]
        if not admin_phone:
            return {"ok": False, "error": "לא הוגדר טלפון מנהל"}

        orders = conn.execute("""
            SELECT o.*, d.name as driver_name, d.phone as driver_phone
            FROM orders o LEFT JOIN drivers d ON o.driver_id = d.id
            WHERE o.order_date = ?
            ORDER BY d.name, o.delivery_time
        """, (target_date,)).fetchall()
        orders = [dict(o) for o in orders]

    if not orders:
        send_whatsapp_message(admin_phone, f"📋 סידור יומי — {target_date}\n\nאין הזמנות להיום.")
        return {"ok": True, "orders_sent": 0}

    # קבץ לפי נהג
    by_driver = {}
    for o in orders:
        name = o["driver_name"] or "ללא נהג"
        by_driver.setdefault(name, []).append(o)

    # שלח למנהל — כותרת + כרטיס לכל הזמנה עם כפתור ביצוע
    send_whatsapp_message(admin_phone, f"📋 *סידור יומי — {target_date}*\nסה\"כ: {len(orders)} הזמנות")
    for driver_name, driver_orders in by_driver.items():
        send_whatsapp_message(admin_phone, f"🚛 *{driver_name}* — {len(driver_orders)} הזמנות")
        for o in driver_orders:
            send_order_card(admin_phone, o)

    # שלח לכל נהג את ההזמנות שלו
    for driver_name, driver_orders in by_driver.items():
        raw_phone = (driver_orders[0].get("driver_phone") or "").strip().replace(" ", "").replace("-", "")
        if not raw_phone:
            continue
        if raw_phone.startswith("0"):
            raw_phone = "972" + raw_phone[1:]
        send_whatsapp_message(raw_phone, f"📋 *סידור יומי — {target_date}*\nיש לך {len(driver_orders)} הזמנות:")
        for o in driver_orders:
            send_order_card(raw_phone, o)

    return {"ok": True, "orders_sent": len(orders)}


# ── Run ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
