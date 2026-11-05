import re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from database import get_db

ISRAEL_TZ = ZoneInfo("Asia/Jerusalem")
DEFAULT_HOUR = 9
WEEKDAYS = {"ראשון": 6, "שני": 0, "שלישי": 1, "רביעי": 2, "חמישי": 3, "שישי": 4, "שבת": 5}
HEB_DAY_NAMES = ["שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת", "ראשון"]
REMINDER_TEMPLATE = "reminder"


def now_il() -> datetime:
    return datetime.now(ISRAEL_TZ).replace(tzinfo=None, second=0, microsecond=0)


def _cut(text: str, match) -> str:
    return (text[:match.start()] + " " + text[match.end():]).strip()


def parse_reminder(text: str, now: datetime | None = None):
    """Return (clean text, datetime or None) from free Hebrew text like 'מחר ב-9 פגישה עם כהן'."""
    now = now or now_il()
    text = " ".join(text.split())

    rel = re.search(r"בעוד\s+(חצי שעה|שעה|שעתיים|רבע שעה|(\d+)\s*(דקות|דק'|שעות|ימים))", text)
    if rel:
        word, num, unit = rel.group(1), rel.group(2), rel.group(3)
        if word == "חצי שעה":
            delta = timedelta(minutes=30)
        elif word == "רבע שעה":
            delta = timedelta(minutes=15)
        elif word == "שעה":
            delta = timedelta(hours=1)
        elif word == "שעתיים":
            delta = timedelta(hours=2)
        elif unit.startswith("דק"):
            delta = timedelta(minutes=int(num))
        elif unit == "שעות":
            delta = timedelta(hours=int(num))
        else:
            delta = timedelta(days=int(num))
        return _clean(_cut(text, rel)), now + delta

    day = None
    m = re.search(r"(?:ב-?|ביום\s+)?(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?", text)
    if m:
        d, mo = int(m.group(1)), int(m.group(2))
        y = int(m.group(3)) if m.group(3) else now.year
        if y < 100:
            y += 2000
        try:
            day = datetime(y, mo, d).date()
        except ValueError:
            day = None
        if day:
            if not m.group(3) and day < now.date():
                day = day.replace(year=y + 1)
            text = _cut(text, m)
    if day is None:
        m = re.search(r"מחרתיים|מחר|היום", text)
        if m:
            day = now.date() + timedelta(days={"היום": 0, "מחר": 1, "מחרתיים": 2}[m.group(0)])
            text = _cut(text, m)
    if day is None:
        m = re.search(r"(?:ב)?יום\s+(ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)", text)
        if m:
            target = WEEKDAYS[m.group(1)]
            ahead = (target - now.weekday()) % 7 or 7
            day = now.date() + timedelta(days=ahead)
            text = _cut(text, m)

    hour = minute = None
    m = (re.search(r"(?:בשעה|ב-?|ב\s)\s*(\d{1,2})(?::(\d{2}))?(?!\s*[./\d])", text)
         or re.search(r"(?<![\d.:/])(\d{1,2}):(\d{2})(?![\d.:/])", text))
    if m and int(m.group(1)) <= 23 and int(m.group(2) or 0) <= 59:
        hour, minute = int(m.group(1)), int(m.group(2) or 0)
        text = _cut(text, m)
        part = re.search(r"בבוקר|בערב|אחר הצהריים|אחה\"צ|אחה״צ|בצהריים|בלילה", text)
        if part:
            if part.group(0) != "בבוקר" and hour < 12:
                hour += 12
            text = _cut(text, part)
        elif 1 <= hour <= 6:
            hour += 12

    if day is None and hour is None:
        return _clean(text), None
    if hour is None:
        hour, minute = DEFAULT_HOUR, 0
    when = datetime.combine(day or now.date(), datetime.min.time()).replace(hour=hour, minute=minute)
    if day is None and when <= now:
        when += timedelta(days=1)
    return _clean(text), when


def _clean(text: str) -> str:
    return " ".join(text.split()).strip(" -:,")


def format_when(when: datetime) -> str:
    today = now_il().date()
    if when.date() == today:
        day = "היום"
    elif when.date() == today + timedelta(days=1):
        day = "מחר"
    else:
        day = f"ביום {HEB_DAY_NAMES[when.weekday()]} {when:%d/%m}"
    return f"{day} בשעה {when:%H:%M}"


def note_admin_message() -> None:
    with get_db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('admin_last_inbound', ?)",
            (now_il().strftime("%Y-%m-%d %H:%M"),),
        )


def _admin_in_window() -> bool:
    with get_db() as conn:
        row = conn.execute("SELECT value FROM settings WHERE key='admin_last_inbound'").fetchone()
    if not row:
        return False
    try:
        last = datetime.strptime(row["value"], "%Y-%m-%d %H:%M")
    except ValueError:
        return False
    return now_il() - last < timedelta(hours=23, minutes=50)


def send_due_reminders() -> None:
    from whatsapp import send_whatsapp_message, send_template_message
    from personal_assistant import _get_admin_phone

    due_before = now_il().strftime("%Y-%m-%d %H:%M")
    with get_db() as conn:
        due = conn.execute(
            "SELECT id, description FROM personal_tasks "
            "WHERE completed=0 AND reminded=0 AND remind_at IS NOT NULL AND remind_at<>'' AND remind_at<=? "
            "ORDER BY remind_at",
            (due_before,),
        ).fetchall()
    if not due:
        return
    admin = _get_admin_phone()
    if not admin:
        print("[Reminders] לא הוגדר טלפון מנהל — לא נשלחו תזכורות")
        return
    in_window = _admin_in_window()
    for task in due:
        text = f"⏰ *תזכורת:* {task['description']}\n\nלסימון כבוצע: *בוצע {task['id']}*"
        if in_window:
            ok = send_whatsapp_message(admin, text)
        else:
            ok = send_template_message(admin, REMINDER_TEMPLATE, [task["description"]])
            if not ok:
                ok = send_whatsapp_message(admin, text)
        with get_db() as conn:
            conn.execute("UPDATE personal_tasks SET reminded=? WHERE id=?", (1 if ok else 2, task["id"]))
        print(f"[Reminders] תזכורת #{task['id']} {'נשלחה' if ok else 'נכשלה'} ({'הודעה רגילה' if in_window else 'תבנית'})")
