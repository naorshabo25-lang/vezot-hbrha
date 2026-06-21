import os
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from database import get_db
from whatsapp import send_daily_question, send_whatsapp_message, send_order_card

scheduler = BackgroundScheduler(timezone="Asia/Jerusalem")


def send_daily_messages():
    print("[Scheduler] שולח הודעות יומיות ללקוחות...")
    with get_db() as conn:
        settings  = {r["key"]: r["value"] for r in conn.execute("SELECT key, value FROM settings").fetchall()}
        template  = settings.get("message_template", "שלום {name}, האם תצטרך הזמנת דלק סולר למחר?")
        customers = conn.execute("SELECT * FROM customers WHERE active = 1").fetchall()
    for customer in customers:
        send_daily_question(customer["phone"], customer["name"], template)
        print(f"[Scheduler] נשלחה הודעה ל{customer['name']} ({customer['phone']})")


def materialize_tomorrow():
    from datetime import date as dt, timedelta
    from recurring import materialize_recurring_orders
    target_date = (dt.today() + timedelta(days=1)).isoformat()
    created = materialize_recurring_orders(target_date)
    print(f"[Scheduler] נוצרו {created} הזמנות קבועות ל-{target_date}")


def send_admin_schedule():
    from datetime import date as dt, timedelta
    print("[Scheduler] שולח סידור יומי למנהל...")
    with get_db() as conn:
        settings    = {r["key"]: r["value"] for r in conn.execute("SELECT key, value FROM settings").fetchall()}
        admin_phone = settings.get("admin_phone", "").strip().replace(" ", "").replace("-", "")
        if not admin_phone:
            print("[Scheduler] לא הוגדר טלפון מנהל — מדלג")
            return
        if admin_phone.startswith("0"):
            admin_phone = "972" + admin_phone[1:]
        target_date = (dt.today() + timedelta(days=1)).isoformat()
        orders = conn.execute("""
            SELECT o.*, d.name as driver_name, d.phone as driver_phone
            FROM orders o LEFT JOIN drivers d ON o.driver_id = d.id
            WHERE o.order_date = ?
            ORDER BY d.name, o.sort_order, o.delivery_time
        """, (target_date,)).fetchall()

    orders = [dict(o) for o in orders]

    if not orders:
        send_whatsapp_message(admin_phone, f"📋 סידור יומי — {target_date}\n\nאין הזמנות למחר.")
        return

    by_driver = {}
    for o in orders:
        name = o["driver_name"] or "ללא נהג"
        by_driver.setdefault(name, []).append(o)

    send_whatsapp_message(admin_phone, f"📋 *סידור יומי — {target_date}*\nסה\"כ: {len(orders)} הזמנות")
    for driver_name, driver_orders in by_driver.items():
        send_whatsapp_message(admin_phone, f"🚛 *{driver_name}* — {len(driver_orders)} הזמנות")
        for i, o in enumerate(driver_orders, 1):
            send_order_card(admin_phone, o, i, len(driver_orders))

    for driver_name, driver_orders in by_driver.items():
        raw_phone = (driver_orders[0].get("driver_phone") or "").strip().replace(" ", "").replace("-", "")
        if not raw_phone:
            continue
        if raw_phone.startswith("0"):
            raw_phone = "972" + raw_phone[1:]
        send_whatsapp_message(raw_phone, f"📋 *סידור יומי — {target_date}*\nיש לך {len(driver_orders)} הזמנות:")
        for i, o in enumerate(driver_orders, 1):
            send_order_card(raw_phone, o, i, len(driver_orders))

    print(f"[Scheduler] סידור נשלח למנהל ול-{len(by_driver)} נהגים — {len(orders)} הזמנות")


def start_scheduler(hour: int = 14, minute: int = 0,
                    admin_hour: int = None, admin_minute: int = 0):
    scheduler.add_job(
        send_daily_messages,
        CronTrigger(hour=hour, minute=minute, timezone="Asia/Jerusalem"),
        id="daily_messages", replace_existing=True,
    )
    scheduler.add_job(
        materialize_tomorrow,
        CronTrigger(hour=0, minute=10, timezone="Asia/Jerusalem"),
        id="materialize_tomorrow", replace_existing=True,
    )
    if admin_hour is not None:
        scheduler.add_job(
            send_admin_schedule,
            CronTrigger(hour=admin_hour, minute=admin_minute, timezone="Asia/Jerusalem"),
            id="admin_schedule", replace_existing=True,
        )
    scheduler.start()
    print(f"[Scheduler] הודעות ללקוחות: {hour:02d}:{minute:02d}")
    print(f"[Scheduler] יצירת הזמנות קבועות: 00:10")
    if admin_hour is not None:
        print(f"[Scheduler] סידור למנהל: {admin_hour:02d}:{admin_minute:02d}")


def reschedule(hour: int, minute: int):
    scheduler.reschedule_job(
        "daily_messages",
        trigger=CronTrigger(hour=hour, minute=minute, timezone="Asia/Jerusalem"),
    )
    print(f"[Scheduler] עודכן — הודעות ללקוחות: {hour:02d}:{minute:02d}")


def reschedule_admin(hour: int, minute: int):
    scheduler.add_job(
        send_admin_schedule,
        CronTrigger(hour=hour, minute=minute, timezone="Asia/Jerusalem"),
        id="admin_schedule", replace_existing=True,
    )
    print(f"[Scheduler] עודכן — סידור למנהל: {hour:02d}:{minute:02d}")


def stop_scheduler():
    scheduler.shutdown()
