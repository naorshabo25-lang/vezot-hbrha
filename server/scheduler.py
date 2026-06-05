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


def send_admin_schedule():
    from datetime import date as dt
    print("[Scheduler] שולח סידור יומי למנהל...")
    with get_db() as conn:
        settings    = {r["key"]: r["value"] for r in conn.execute("SELECT key, value FROM settings").fetchall()}
        admin_phone = settings.get("admin_phone", "").strip().replace(" ", "").replace("-", "")
        if not admin_phone:
            print("[Scheduler] לא הוגדר טלפון מנהל — מדלג")
            return
        if admin_phone.startswith("0"):
            admin_phone = "972" + admin_phone[1:]
        today  = dt.today().isoformat()
        orders = conn.execute("""
            SELECT o.*, d.name as driver_name
            FROM orders o LEFT JOIN drivers d ON o.driver_id = d.id
            WHERE o.order_date = ?
            ORDER BY d.name, o.delivery_time
        """, (today,)).fetchall()

    orders = [dict(o) for o in orders]

    if not orders:
        send_whatsapp_message(admin_phone, f"📋 סידור יומי — {today}\n\nאין הזמנות להיום.")
        return

    by_driver = {}
    for o in orders:
        name = o["driver_name"] or "ללא נהג"
        by_driver.setdefault(name, []).append(o)

    send_whatsapp_message(admin_phone, f"📋 *סידור יומי — {today}*\nסה\"כ: {len(orders)} הזמנות")
    for driver_name, driver_orders in by_driver.items():
        send_whatsapp_message(admin_phone, f"🚛 *{driver_name}* — {len(driver_orders)} הזמנות")
        for o in driver_orders:
            send_order_card(admin_phone, o)
    print(f"[Scheduler] סידור נשלח למנהל — {len(orders)} הזמנות")


def start_scheduler(hour: int = 14, minute: int = 0,
                    admin_hour: int = None, admin_minute: int = 0):
    scheduler.add_job(
        send_daily_messages,
        CronTrigger(hour=hour, minute=minute, timezone="Asia/Jerusalem"),
        id="daily_messages", replace_existing=True,
    )
    if admin_hour is not None:
        scheduler.add_job(
            send_admin_schedule,
            CronTrigger(hour=admin_hour, minute=admin_minute, timezone="Asia/Jerusalem"),
            id="admin_schedule", replace_existing=True,
        )
    scheduler.start()
    print(f"[Scheduler] הודעות ללקוחות: {hour:02d}:{minute:02d}")
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
