import json
import os
import re
import shutil
import subprocess
import tempfile
from datetime import datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path
from zoneinfo import ZoneInfo

from docx import Document

from database import get_db

_TEMPLATE_PATH = Path(
    os.getenv("QUOTE_TEMPLATE_PATH", str(Path(__file__).with_name("quote_template.docx")))
).expanduser()
_VAT_RATE = Decimal("0.18")
_MONEY_QUANTUM = Decimal("0.001")
_ISRAEL_TZ = ZoneInfo("Asia/Jerusalem")


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


def _read_price(value: str) -> Decimal:
    cleaned = value.replace("₪", "").replace(",", "").strip()
    try:
        price = Decimal(cleaned)
    except InvalidOperation as exc:
        raise ValueError("שלח מחיר מספרי בש״ח לליטר, למשל 8.623.") from exc
    if not price.is_finite() or price <= 0 or price > Decimal("100000"):
        raise ValueError("המחיר צריך להיות מספר חיובי וסביר בש״ח לליטר.")
    return price.quantize(_MONEY_QUANTUM, rounding=ROUND_HALF_UP)


def _read_cell_decimal(cell) -> Decimal:
    value = cell.text.replace("₪", "").replace(",", "").strip()
    try:
        return Decimal(value)
    except InvalidOperation as exc:
        raise ValueError("לא הצלחתי לקרוא את ערך המחיר בתבנית.") from exc


def _set_paragraph_text(paragraph, value: str) -> None:
    if paragraph.runs:
        paragraph.runs[0].text = value
        for run in paragraph.runs[1:]:
            run.text = ""
    else:
        paragraph.add_run(value)


def _set_cell_text(cell, value: str) -> None:
    paragraph = cell.paragraphs[0]
    _set_paragraph_text(paragraph, value)
    for extra_paragraph in cell.paragraphs[1:]:
        _set_paragraph_text(extra_paragraph, "")


def _find_quote_rows(table):
    price_row = vat_row = total_row = None
    for row in table.rows:
        labels = [cell.text.strip() for cell in row.cells]
        if "מחיר כולל" in labels:
            price_row = row
        elif any(label.startswith("מע\"מ") for label in labels):
            vat_row = row
        elif "סה\"כ מחיר" in labels:
            total_row = row
    if not all((price_row, vat_row, total_row)):
        raise ValueError("לא מצאתי בתבנית את שורות המחיר, המע״מ והסכום הכולל.")
    return price_row, vat_row, total_row


DISTRIBUTION = Decimal("0.350")
INFRASTRUCTURE = Decimal("0.050")
CREDIT_PER_30_DAYS = Decimal("0.150")
RATE_KEYS = {"base_rate": "quote_base_rate", "excise": "quote_excise"}
_COMPONENT_HEADERS = {
    "שער בסיס": ("base_rate", "{:.5f}"),
    "מס בלו": ("excise", "{:.5f}"),
    "אשראי": ("credit", "{:.3f}"),
    "הפצה": ("distribution", "{:.3f}"),
    "תשתית": ("infrastructure", "{:.3f}"),
    "מרווח": ("margin", "{:.3f}"),
}


def _template_default_rates() -> dict:
    document = Document(str(_TEMPLATE_PATH))
    table = document.tables[0]
    headers = [cell.text.strip() for cell in table.rows[0].cells]
    return {
        key: _read_cell_decimal(table.rows[1].cells[headers.index(name)])
        for name, key in (("שער בסיס", "base_rate"), ("מס בלו", "excise"))
    }


def get_rates() -> dict:
    with get_db() as conn:
        stored = {r["key"]: r["value"] for r in conn.execute(
            "SELECT key, value FROM settings WHERE key IN (?, ?)", tuple(RATE_KEYS.values())
        ).fetchall()}
    rates = {}
    defaults = None
    for key, setting in RATE_KEYS.items():
        try:
            rates[key] = Decimal(stored[setting])
        except (KeyError, InvalidOperation):
            defaults = defaults or _template_default_rates()
            rates[key] = defaults[key]
    return rates


def set_rate(key: str, value: str) -> Decimal:
    try:
        rate = Decimal(str(value).replace(",", "").strip())
    except InvalidOperation as exc:
        raise ValueError("שלח מספר, למשל 3.29242") from exc
    if not rate.is_finite() or rate <= 0 or rate > 100:
        raise ValueError("הערך צריך להיות מספר חיובי וסביר בש״ח לליטר.")
    with get_db() as conn:
        conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (RATE_KEYS[key], str(rate)))
    return rate


def credit_days(payment_terms: str) -> int:
    match = re.search(r"\+\s*(\d+)", payment_terms or "")
    return int(match.group(1)) if match else 0


def quote_breakdown(price: Decimal, payment_terms: str) -> dict:
    rates = get_rates()
    days = credit_days(payment_terms)
    credit = (CREDIT_PER_30_DAYS * days / 30).quantize(_MONEY_QUANTUM, rounding=ROUND_HALF_UP)
    fixed = rates["base_rate"] + rates["excise"] + DISTRIBUTION + INFRASTRUCTURE + credit
    margin = (price - fixed).quantize(_MONEY_QUANTUM, rounding=ROUND_HALF_UP)
    if margin < 0:
        raise ValueError(
            f"המחיר נמוך מסכום הרכיבים ({fixed:.3f} ₪ לליטר), ולכן המרווח יוצא שלילי. "
            "שלח מחיר גבוה יותר."
        )
    vat = (price * _VAT_RATE).quantize(_MONEY_QUANTUM, rounding=ROUND_HALF_UP)
    return {
        **rates,
        "credit": credit,
        "credit_days": days,
        "distribution": DISTRIBUTION,
        "infrastructure": INFRASTRUCTURE,
        "margin": margin,
        "price": price,
        "vat": vat,
        "total": price + vat,
    }


def find_company_id(customer: str) -> str:
    with get_db() as conn:
        row = conn.execute(
            "SELECT id_number FROM customers WHERE TRIM(name)=? AND COALESCE(id_number,'')<>'' LIMIT 1",
            (customer.strip(),),
        ).fetchone()
    return row["id_number"] if row else ""


SERVICE_TYPES = ("צובר", "שטח")


def parse_service_type(text: str) -> str:
    text = (text or "").strip()
    if text in {"1", "צובר"} or "צובר" in text:
        return "צובר"
    if text in {"2", "שטח"} or "שטח" in text:
        return "שטח"
    return ""


def _replace_quote_details(document, customer: str, company_id: str, payment_terms: str,
                           service_type: str = "צובר") -> None:
    paragraphs = document.paragraphs
    for paragraph in paragraphs:
        if paragraph.text.strip().startswith("הצעת מחיר עבור"):
            _set_paragraph_text(paragraph, f"הצעת מחיר עבור שירותי תדלוק {service_type}")
            break
    for index, paragraph in enumerate(paragraphs):
        if paragraph.text.strip().startswith("לכבוד"):
            _set_paragraph_text(paragraph, f"לכבוד: {customer}")
            if index + 1 < len(paragraphs):
                _set_paragraph_text(paragraphs[index + 1], f"ח.פ: {company_id}" if company_id else "")
            break
    else:
        raise ValueError("לא מצאתי בתבנית את שדה שם הלקוח.")

    date_prefix = "תאריך ההצעה:"
    date_value = datetime.now(_ISRAEL_TZ).strftime("%d/%m/%Y")
    for paragraph in paragraphs:
        if paragraph.text.strip().startswith(date_prefix):
            _set_paragraph_text(paragraph, f"{date_prefix} {date_value}")
            break

    payment_prefix = "*תנאי תשלום:"
    for paragraph in paragraphs:
        if paragraph.text.strip().startswith(payment_prefix):
            _set_paragraph_text(
                paragraph,
                f"{payment_prefix} {payment_terms.rstrip('. ')}.",
            )
            break
    else:
        raise ValueError("לא מצאתי בתבנית את שדה תנאי התשלום.")


def _format_money(value: Decimal) -> str:
    return f"{value.quantize(_MONEY_QUANTUM, rounding=ROUND_HALF_UP):.3f} ₪"


def _replace_numeric_cells(row, value: Decimal) -> None:
    replacement = _format_money(value)
    for cell in row.cells:
        if re.fullmatch(r"\s*[\d,.]+\s*₪\s*", cell.text):
            _set_cell_text(cell, replacement)


def _convert_docx_to_pdf(docx_path: Path, pdf_path: Path) -> None:
    if os.name == "nt":
        import pythoncom
        import win32com.client

        pythoncom.CoInitialize()
        word = None
        document = None
        try:
            word = win32com.client.DispatchEx("Word.Application")
            word.Visible = False
            document = word.Documents.Open(str(docx_path.resolve()), ReadOnly=True)
            document.SaveAs(str(pdf_path.resolve()), FileFormat=17)
            document.Close(SaveChanges=0)
            document = None
        finally:
            if document is not None:
                document.Close(SaveChanges=0)
            if word is not None:
                word.Quit()
            pythoncom.CoUninitialize()
    else:
        converter = shutil.which("libreoffice") or shutil.which("soffice") or next(
            (p for p in ("/usr/bin/soffice", "/usr/bin/libreoffice",
                         "/usr/lib/libreoffice/program/soffice", "/snap/bin/libreoffice",
                         "/opt/libreoffice/program/soffice")
             if os.path.isfile(p)),
            None,
        )
        if not converter:
            raise RuntimeError(
                "לא מצאתי LibreOffice להמרת Word ל-PDF. "
                "יש להתקין libreoffice-writer בשרת."
            )
        profile = Path(tempfile.mkdtemp(prefix="quote-lo-profile-"))
        try:
            subprocess.run(
                [
                    converter,
                    "--headless",
                    f"-env:UserInstallation={profile.as_uri()}",
                    "--convert-to",
                    "pdf",
                    "--outdir",
                    str(pdf_path.parent),
                    str(docx_path),
                ],
                check=True,
                capture_output=True,
                text=True,
                timeout=90,
            )
        except subprocess.CalledProcessError as exc:
            detail = (exc.stderr or exc.stdout or "").strip()
            raise RuntimeError(f"המרת ההצעה ל-PDF נכשלה: {detail}") from exc
        except subprocess.TimeoutExpired as exc:
            raise RuntimeError("המרת ההצעה ל-PDF ארכה יותר מדי זמן.") from exc
        finally:
            shutil.rmtree(profile, ignore_errors=True)

    if not pdf_path.is_file() or pdf_path.stat().st_size == 0:
        raise RuntimeError("תהליך ההמרה לא יצר קובץ PDF תקין.")


def create_quote_pdf(customer: str, price: Decimal, payment_terms: str, company_id: str = "",
                     service_type: str = "צובר") -> Path:
    if not _TEMPLATE_PATH.is_file():
        raise FileNotFoundError(f"קובץ התבנית לא נמצא: {_TEMPLATE_PATH}")
    breakdown = quote_breakdown(price, payment_terms)
    document = Document(str(_TEMPLATE_PATH))
    if not document.tables:
        raise ValueError("לא מצאתי טבלת מחירון בתבנית.")
    table = document.tables[0]
    headers = [cell.text.strip() for cell in table.rows[0].cells]
    done = set()
    for index, header in enumerate(headers):
        if header in _COMPONENT_HEADERS and header not in done:
            key, fmt = _COMPONENT_HEADERS[header]
            _set_cell_text(table.rows[1].cells[index], fmt.format(breakdown[key]))
            done.add(header)
    if done != set(_COMPONENT_HEADERS):
        raise ValueError("לא הצלחתי לזהות את כל רכיבי המחיר בתבנית.")

    _replace_quote_details(document, customer, company_id, payment_terms, service_type)
    price_row, vat_row, total_row = _find_quote_rows(table)
    _replace_numeric_cells(price_row, breakdown["price"])
    _replace_numeric_cells(vat_row, breakdown["vat"])
    _replace_numeric_cells(total_row, breakdown["total"])

    output_dir = Path(tempfile.mkdtemp(prefix="quote-"))
    docx_path = output_dir / "quote.docx"
    pdf_path = output_dir / "quote.pdf"
    success = False
    try:
        document.save(str(docx_path))
        _convert_docx_to_pdf(docx_path, pdf_path)
        success = True
    finally:
        if not success:
            shutil.rmtree(output_dir, ignore_errors=True)
    docx_path.unlink(missing_ok=True)
    return pdf_path


QUOTES_DIR = Path(__file__).with_name("quotes")


def create_archived_quote(customer: str, price: Decimal, payment_terms: str, company_id: str = "",
                          service_type: str = "צובר") -> tuple[Path, int]:
    company_id = company_id.strip() or find_company_id(customer)
    pdf_path = create_quote_pdf(customer, price, payment_terms, company_id, service_type)
    QUOTES_DIR.mkdir(exist_ok=True)
    with get_db() as conn:
        quote_id = conn.execute(
            "INSERT INTO quotes (customer, company_id, service_type, price, payment_terms, file_name) "
            "VALUES (?, ?, ?, ?, ?, '')",
            (customer, company_id, service_type, str(price), payment_terms),
        ).lastrowid
        file_name = f"{quote_id}.pdf"
        shutil.copyfile(pdf_path, QUOTES_DIR / file_name)
        conn.execute("UPDATE quotes SET file_name=? WHERE id=?", (file_name, quote_id))
    return pdf_path, quote_id


def cleanup_quote_pdf(pdf_path: Path) -> None:
    output_dir = pdf_path.parent
    if output_dir.name.startswith("quote-"):
        shutil.rmtree(output_dir, ignore_errors=True)


def _get_quote_session(phone: str):
    with get_db() as conn:
        return conn.execute(
            "SELECT * FROM personal_quote_sessions WHERE phone=?",
            (phone,),
        ).fetchone()


def _save_quote_session(phone: str, step: str, data: dict) -> None:
    with get_db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO personal_quote_sessions "
            "(phone, step, data_json, updated_at) "
            "VALUES (?, ?, ?, datetime('now', 'localtime'))",
            (phone, step, json.dumps(data, ensure_ascii=False)),
        )


def _delete_quote_session(phone: str) -> None:
    with get_db() as conn:
        conn.execute(
            "DELETE FROM personal_quote_sessions WHERE phone=?",
            (phone,),
        )


def handle_quote_message(phone: str, text: str):
    """Return (reply, PDF path) for quote messages from the configured admin."""
    admin_phone = _get_admin_phone()
    if not admin_phone or _normalize_phone(phone) != admin_phone:
        return None
    phone = _normalize_phone(phone)

    message = text.strip()
    if not message:
        return None

    command = message.casefold()
    start_commands = {"הצעת מחיר", "הצעה חדשה", "צור הצעה", "הפק הצעה"}
    state = _get_quote_session(phone)

    rate_match = re.fullmatch(r"(שער בסיס|בסיס|מס בלו|בלו)\s*[:=\-]?\s*([\d.,]+)", message)
    if rate_match and not state:
        key = "base_rate" if "בסיס" in rate_match.group(1) else "excise"
        try:
            value = set_rate(key, rate_match.group(2))
        except ValueError as exc:
            return str(exc), None
        label = "שער בסיס" if key == "base_rate" else "מס בלו"
        return f"✅ {label} עודכן ל-*{value}*. ישמש בכל ההצעות מעכשיו.", None

    if command in {"רכיבי מחיר", "מחירון הצעות", "שער בסיס", "מס בלו"} and not state:
        rates = get_rates()
        return (
            "רכיבי המחיר הנוכחיים להצעות:\n"
            f"שער בסיס: *{rates['base_rate']}*\n"
            f"מס בלו: *{rates['excise']}*\n"
            f"הפצה: *{DISTRIBUTION}* · תשתית: *{INFRASTRUCTURE}*\n"
            f"אשראי: *{CREDIT_PER_30_DAYS}* לכל 30 יום\n\n"
            "לעדכון שלח למשל: *שער בסיס 3.29242* או *מס בלו 3.50333*",
            None,
        )

    if command in start_commands:
        if not _TEMPLATE_PATH.is_file():
            return (
                "לא מצאתי את תבנית הצעת המחיר. "
                "בדוק שהקובץ quote_template.docx נמצא בתיקיית server.",
                None,
            )
        _save_quote_session(phone, "customer", {})
        return "מה שם הלקוח כפי שיופיע בהצעה?", None

    if not state:
        return None

    if command in {"ביטול", "בטל", "cancel"}:
        _delete_quote_session(phone)
        return "ביטלתי את הכנת הצעת המחיר.", None

    price_question = (
        "מה המחיר לליטר לפני מע״מ, בש״ח? לדוגמה: *8.623*",
        None,
    )
    service_question = "סוג השירות?\n1. צובר\n2. שטח"

    data = json.loads(state["data_json"] or "{}")
    if state["step"] == "customer":
        if len(message) > 160:
            return "שם הלקוח ארוך מדי. שלח שם קצר יותר או כתוב *ביטול*.", None
        data["customer"] = message
        known_id = find_company_id(message)
        if known_id:
            data["company_id"] = known_id
            _save_quote_session(phone, "service", data)
            return f"מצאתי ח.פ *{known_id}* בכרטיס הלקוח.\n{service_question}", None
        _save_quote_session(phone, "company_id", data)
        return "מה הח.פ של הלקוח? (או *דלג*)", None

    if state["step"] == "company_id":
        data["company_id"] = "" if command in {"דלג", "אין", "-"} else message[:40]
        _save_quote_session(phone, "service", data)
        return service_question, None

    if state["step"] == "service":
        service = parse_service_type(message)
        if not service:
            return f"לא הבנתי. {service_question}", None
        data["service_type"] = service
        _save_quote_session(phone, "price", data)
        return price_question

    if state["step"] == "price":
        try:
            price = _read_price(message)
        except ValueError as exc:
            return f"{exc}\nשלח מחיר אחר או כתוב *ביטול*.", None
        data["price"] = str(price)
        _save_quote_session(phone, "payment", data)
        return "מה תנאי התשלום? למשל: *שוטף+30* (האשראי מחושב לפי המספר שאחרי ה-+).", None

    if state["step"] == "payment":
        if len(message) > 160:
            return "תנאי התשלום ארוכים מדי. שלח ניסוח קצר יותר או כתוב *ביטול*.", None
        try:
            b = quote_breakdown(Decimal(data["price"]), message)
        except ValueError as exc:
            _save_quote_session(phone, "price", data)
            return f"{exc}\nשלח מחיר אחר או כתוב *ביטול*.", None
        except FileNotFoundError:
            _delete_quote_session(phone)
            return "קובץ תבנית הצעת המחיר לא נמצא בשרת.", None
        data["payment_terms"] = message
        _save_quote_session(phone, "confirm", data)
        return (
            "נא לבדוק לפני יצירת ה-PDF:\n"
            f"לקוח: *{data['customer']}*\n"
            f"ח.פ: *{data.get('company_id') or '—'}*\n"
            f"שירות: *תדלוק {data.get('service_type', 'צובר')}*\n"
            f"תנאי תשלום: *{message}* ({b['credit_days']} ימי אשראי)\n\n"
            f"שער בסיס: {b['base_rate']}\n"
            f"מס בלו: {b['excise']}\n"
            f"הפצה: {b['distribution']} · תשתית: {b['infrastructure']}\n"
            f"אשראי: {b['credit']}\n"
            f"מרווח: *{b['margin']}*\n\n"
            f"מחיר לליטר לפני מע״מ: *{_format_money(b['price'])}*\n"
            f"מע״מ 18%: *{_format_money(b['vat'])}*\n"
            f"סה״כ לליטר: *{_format_money(b['total'])}*\n\n"
            "שלח *אשר הצעה* כדי ליצור ולשלוח את ה-PDF, או *ביטול*.",
            None,
        )

    if state["step"] == "confirm":
        if command not in {"אשר הצעה", "מאשר הצעה", "אישור הצעה"}:
            return "שלח *אשר הצעה* ליצירת ההצעה או *ביטול* לעצירת התהליך.", None
        try:
            pdf_path, _ = create_archived_quote(
                data["customer"],
                Decimal(data["price"]),
                data["payment_terms"],
                data.get("company_id", ""),
                data.get("service_type", "צובר"),
            )
        except (FileNotFoundError, RuntimeError, ValueError) as exc:
            return f"לא הצלחתי ליצור את ההצעה: {exc}", None
        _delete_quote_session(phone)
        return None, pdf_path

    _delete_quote_session(phone)
    return "תהליך הצעת המחיר אופס. שלח *הצעת מחיר* כדי להתחיל מחדש.", None
