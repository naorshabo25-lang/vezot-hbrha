import re

from database import get_db


def _normalize_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone or "")
    if digits.startswith("0"):
        return "972" + digits[1:]
    return digits


def _get_admin_phone() -> str:
    with get_db() as conn:
        row = conn.execute(
            "SELECT value FROM settings WHERE key='admin_phone'"
        ).fetchone()
    return _normalize_phone(row["value"]) if row else ""


def _format_tasks() -> str:
    with get_db() as conn:
        tasks = conn.execute(
            "SELECT id, description FROM personal_tasks "
            "WHERE completed=0 ORDER BY id"
        ).fetchall()
    if not tasks:
        return "🎉 אין לך כרגע משימות פתוחות."
    lines = ["📋 *המשימות הפתוחות שלך:*"]
    lines.extend(f"{task['id']}. {task['description']}" for task in tasks)
    lines.append("\nלסיום משימה: *בוצע <מספר>*")
    return "\n".join(lines)


def _format_notes() -> str:
    with get_db() as conn:
        notes = conn.execute(
            "SELECT id, content, created_at FROM personal_notes "
            "ORDER BY id DESC LIMIT 10"
        ).fetchall()
    if not notes:
        return "📝 עדיין לא שמרת הערות."
    lines = ["📝 *ההערות האחרונות שלך:*"]
    lines.extend(
        f"{note['id']}. {note['content']} ({note['created_at']})"
        for note in notes
    )
    return "\n".join(lines)


def _save_task(description: str) -> str:
    with get_db() as conn:
        cursor = conn.execute(
            "INSERT INTO personal_tasks (description) VALUES (?)",
            (description,),
        )
        task_id = cursor.lastrowid
    return f"✅ המשימה נשמרה (מספר {task_id}): {description}"


def _save_note(content: str) -> str:
    with get_db() as conn:
        cursor = conn.execute(
            "INSERT INTO personal_notes (content) VALUES (?)",
            (content,),
        )
        note_id = cursor.lastrowid
    return f"📝 ההערה נשמרה (מספר {note_id}): {content}"


def _complete_task(task_id: int) -> str:
    with get_db() as conn:
        cursor = conn.execute(
            "UPDATE personal_tasks SET completed=1, "
            "completed_at=datetime('now', 'localtime') "
            "WHERE id=? AND completed=0",
            (task_id,),
        )
    if cursor.rowcount:
        return f"✅ משימה {task_id} סומנה כהושלמה."
    return f"לא מצאתי משימה פתוחה מספר {task_id}."


def handle_personal_assistant_message(phone: str, text: str) -> str | None:
    """Handle private task and note messages sent by the configured admin."""
    admin_phone = _get_admin_phone()
    if not admin_phone or _normalize_phone(phone) != admin_phone:
        return None

    message = text.strip()
    if not message:
        return None

    command = message.casefold()
    if command in {"עוזר", "עזרה", "תפריט", "היי עוזר", "שלום עוזר"}:
        return (
            "שלום! אני העוזר האישי שלך 👋\n\n"
            "• משימה: להתקשר לספק\n"
            "• לרשום תזכורת להתקשר לספק\n"
            "• הערה: לדבר עם יוסי על ההצעה\n"
            "• משימות — הצגת משימות פתוחות\n"
            "• תזכורות — הצגת משימות פתוחות\n"
            "• הערות — הצגת 10 ההערות האחרונות\n"
            "• בוצע 3 — סימון משימה כהושלמה\n"
            "• הצעת מחיר — יצירת PDF ושליחתו אליך בלבד"
        )

    if command in {
        "משימות",
        "המשימות שלי",
        "הצג משימות",
        "תזכורות",
        "התזכורות שלי",
        "הצג תזכורות",
    }:
        return _format_tasks()
    if command in {"הערות", "ההערות שלי", "הצג הערות"}:
        return _format_notes()

    completion = re.fullmatch(r"(?:בוצע|סיימתי|השלם)\s+#?(\d+)", message)
    if completion:
        return _complete_task(int(completion.group(1)))

    task = re.match(
        r"^(?:משימה(?:\s+חדשה)?|(?:הוסף|תוסיף|תרשום)\s+משימה|"
        r"(?:לרשום|תרשום|תכתוב|תוסיף|הוסף)\s+(?:לי\s+)?תזכורת(?:\s+ל)?|"
        r"תזכורת(?:\s+חדשה)?|תזכיר לי|אל תשכח(?:י)?|צריך לעשות|"
        r"אני צריך|אני צריכה)"
        r"\s*[:\-]?\s*(.+)$",
        message,
        re.IGNORECASE,
    )
    if task:
        return _save_task(task.group(1).strip())

    note = re.match(
        r"^(?:הערה|פתק|לרשום|(?:תרשום|תכתוב|שמור)\s+(?:לי\s+)?הערה|"
        r"(?:תרשום|תכתוב)\s+לי)\s*[:\-]?\s*(.+)$",
        message,
        re.IGNORECASE,
    )
    if note:
        return _save_note(note.group(1).strip())

    return None
