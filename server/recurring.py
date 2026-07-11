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
            driver = conn.execute("SELECT * FROM drivers WHERE area = ?", (t["area"],)).fetchone()
            driver_id = driver["id"] if driver else None
            max_sort = conn.execute(
                "SELECT COALESCE(MAX(sort_order), -1) FROM orders WHERE driver_id IS ? AND order_date = ?",
                (driver_id, target_date)
            ).fetchone()[0]
            conn.execute(
                """INSERT INTO orders
                   (customer_id, customer_name, site_address, contact_name, contact_phone,
                    quantity, driver_id, order_date, sort_order)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (t["customer_id"], t["customer_name"], t["site_address"], t["contact_name"],
                 t["contact_phone"], t["quantity"], driver_id, target_date, max_sort + 1),
            )
            created += 1
    return created
