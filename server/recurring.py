from datetime import date as _date
from database import get_db


def _weekday_index(date_str: str) -> int:
    """ראשון=0 ... שבת=6 (תואם לסדר השבוע הישראלי)"""
    d = _date.fromisoformat(date_str)
    return d.isoweekday() % 7


def materialize_recurring_orders(target_date: str) -> int:
    """יוצר הזמנות בפועל מתבניות קבועות שחלות על target_date, אם עוד לא נוצרו."""
    weekday = _weekday_index(target_date)
    created = 0
    with get_db() as conn:
        templates = conn.execute(
            """SELECT * FROM recurring_orders
               WHERE active = 1
                 AND (',' || days_of_week || ',') LIKE ('%,' || ? || ',%')
                 AND (start_date = '' OR start_date <= ?)
                 AND (end_date = '' OR end_date >= ?)""",
            (str(weekday), target_date, target_date),
        ).fetchall()

        for t in templates:
            exists = conn.execute(
                "SELECT 1 FROM orders WHERE order_date = ? AND customer_name = ? AND site_address = ?",
                (target_date, t["customer_name"], t["site_address"]),
            ).fetchone()
            if exists:
                continue

            # ירש פרטים מההזמנה האחרונה של אותו לקוח+כתובת
            prev = conn.execute(
                """SELECT driver_id, delivery_time, extras, contact_name, contact_phone
                   FROM orders
                   WHERE customer_name = ? AND site_address = ? AND order_date < ?
                   ORDER BY order_date DESC, created_at DESC
                   LIMIT 1""",
                (t["customer_name"], t["site_address"], target_date),
            ).fetchone()

            if prev and prev["driver_id"]:
                driver_id    = prev["driver_id"]
                delivery_time = prev["delivery_time"] or ""
                extras        = prev["extras"] or ""
            else:
                # fallback: שייך לפי אזור
                driver = conn.execute("SELECT * FROM drivers WHERE area = ?", (t["area"],)).fetchone()
                driver_id     = driver["id"] if driver else None
                delivery_time = ""
                extras        = ""

            contact_name  = t["contact_name"]  or (prev["contact_name"]  if prev else "") or ""
            contact_phone = t["contact_phone"] or (prev["contact_phone"] if prev else "") or ""

            max_sort = conn.execute(
                "SELECT COALESCE(MAX(sort_order), -1) FROM orders WHERE driver_id IS ? AND order_date = ?",
                (driver_id, target_date)
            ).fetchone()[0]
            conn.execute(
                """INSERT INTO orders
                   (customer_id, customer_name, site_address, contact_name, contact_phone,
                    quantity, driver_id, order_date, sort_order, delivery_time, extras)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (t["customer_id"], t["customer_name"], t["site_address"], contact_name, contact_phone,
                 t["quantity"], driver_id, target_date, max_sort + 1, delivery_time, extras),
            )
            created += 1
    return created
