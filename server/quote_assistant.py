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


def _quote_table_fields(document):
    if not document.tables:
        raise ValueError("לא מצאתי טבלת מחירון בתבנית.")
    table = document.tables[0]
    if len(table.rows) < 2:
        raise ValueError("טבלת המחירון בתבנית אינה מלאה.")
    headers = [cell.text.strip() for cell in table.rows[0].cells]
    try:
        margin_index = next(i for i, header in enumerate(headers) if header == "מרווח")
    except StopIteration as exc:
        raise ValueError("לא מצאתי את שדה המרווח בטבלת המחירון.") from exc
    price_row, vat_row, total_row = _find_quote_rows(table)
    base_components = Decimal("0")
    seen_components = set()
    try:
        for index, header in enumerate(headers):
            if header in {"תשתית", "הפצה", "אשראי", "מס בלו", "שער בסיס"}:
                if header not in seen_components:
                    base_components += _read_cell_decimal(table.rows[1].cells[index])
                    seen_components.add(header)
    except IndexError as exc:
        raise ValueError("טבלת המחירון אינה כוללת את כל הרכיבים הנדרשים.") from exc
    expected_components = {"תשתית", "הפצה", "אשראי", "מס בלו", "שער בסיס"}
    if seen_components != expected_components:
        raise ValueError("לא הצלחתי לזהות את כל רכיבי המחיר בתבנית.")
    return table, margin_index, price_row, vat_row, total_row, base_components


def _margin_for_price(price: Decimal) -> Decimal:
    if not _TEMPLATE_PATH.is_file():
        raise FileNotFoundError(f"קובץ התבנית לא נמצא: {_TEMPLATE_PATH}")
    document = Document(str(_TEMPLATE_PATH))
    fields = _quote_table_fields(document)
    new_margin = price - fields[5]
    if new_margin < 0:
        raise ValueError(
            "המחיר נמוך מסכום רכיבי הבסיס בתבנית, גם כשהמרווח הוא אפס. "
            "שלח מחיר גבוה יותר או עדכן את רכיבי הבסיס בתבנית."
        )
    return new_margin.quantize(_MONEY_QUANTUM, rounding=ROUND_HALF_UP)


def _replace_quote_details(document, customer: str, payment_terms: str) -> None:
    paragraphs = document.paragraphs
    for index, paragraph in enumerate(paragraphs):
        if paragraph.text.strip() == "לכבוד:":
            for following in paragraphs[index + 1:]:
                if following.text.strip():
                    _set_paragraph_text(following, customer)
                    break
            else:
                _set_paragraph_text(paragraph, f"לכבוד: {customer}")
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
        converter = shutil.which("libreoffice") or shutil.which("soffice")
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


def create_quote_pdf(customer: str, price: Decimal, payment_terms: str) -> Path:
    if not _TEMPLATE_PATH.is_file():
        raise FileNotFoundError(f"קובץ התבנית לא נמצא: {_TEMPLATE_PATH}")
    document = Document(str(_TEMPLATE_PATH))
    (
        table,
        margin_index,
        price_row,
        vat_row,
        total_row,
        base_components,
    ) = _quote_table_fields(document)
    margin = (price - base_components).quantize(
        _MONEY_QUANTUM, rounding=ROUND_HALF_UP
    )
    if margin < 0:
        raise ValueError(
            "המחיר נמוך מסכום רכיבי הבסיס בתבנית, גם כשהמרווח הוא אפס. "
            "שלח מחיר גבוה יותר או עדכן את רכיבי הבסיס בתבנית."
        )

    _replace_quote_details(document, customer, payment_terms)
    _set_cell_text(table.rows[1].cells[margin_index], f"{margin:.3f}")

    vat = (price * _VAT_RATE).quantize(_MONEY_QUANTUM, rounding=ROUND_HALF_UP)
    total = price + vat
    _replace_numeric_cells(price_row, price)
    _replace_numeric_cells(vat_row, vat)
    _replace_numeric_cells(total_row, total)

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


def create_archived_quote(customer: str, price: Decimal, payment_terms: str) -> tuple[Path, int]:
    pdf_path = create_quote_pdf(customer, price, payment_terms)
    return pdf_path, _archive_quote(pdf_path, customer, price, payment_terms)


def _archive_quote(pdf_path: Path, customer: str, price: Decimal, payment_terms: str) -> int:
    QUOTES_DIR.mkdir(exist_ok=True)
    with get_db() as conn:
        quote_id = conn.execute(
            "INSERT INTO quotes (customer, price, payment_terms, file_name) VALUES (?, ?, ?, '')",
            (customer, str(price), payment_terms),
        ).lastrowid
        file_name = f"{quote_id}.pdf"
        shutil.copyfile(pdf_path, QUOTES_DIR / file_name)
        conn.execute("UPDATE quotes SET file_name=? WHERE id=?", (file_name, quote_id))
    return quote_id


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

    data = json.loads(state["data_json"] or "{}")
    if state["step"] == "customer":
        if len(message) > 160:
            return "שם הלקוח ארוך מדי. שלח שם קצר יותר או כתוב *ביטול*.", None
        data["customer"] = message
        _save_quote_session(phone, "price", data)
        return (
            "מה המחיר הכולל לרכיבי ההצעה לפני מע״מ, בש״ח לליטר? "
            "לדוגמה: *8.623*",
            None,
        )

    if state["step"] == "price":
        try:
            price = _read_price(message)
            margin = _margin_for_price(price)
        except ValueError as exc:
            return f"{exc}\nשלח מחיר אחר או כתוב *ביטול*.", None
        except FileNotFoundError:
            _delete_quote_session(phone)
            return "קובץ תבנית הצעת המחיר לא נמצא בשרת.", None
        data["price"] = str(price)
        data["margin"] = str(margin)
        _save_quote_session(phone, "payment", data)
        return "מה תנאי התשלום שיופיעו בהצעה? למשל: *שוטף + 30 בהעברה*.", None

    if state["step"] == "payment":
        if len(message) > 160:
            return "תנאי התשלום ארוכים מדי. שלח ניסוח קצר יותר או כתוב *ביטול*.", None
        data["payment_terms"] = message
        _save_quote_session(phone, "confirm", data)
        price = Decimal(data["price"])
        vat = (price * _VAT_RATE).quantize(
            _MONEY_QUANTUM, rounding=ROUND_HALF_UP
        )
        return (
            "נא לבדוק לפני יצירת ה-PDF:\n"
            f"לקוח: *{data['customer']}*\n"
            f"מחיר לליטר לפני מע״מ: *{_format_money(price)}*\n"
            f"מע״מ 18%: *{_format_money(vat)}*\n"
            f"סה״כ לליטר: *{_format_money(price + vat)}*\n"
            f"מרווח מעודכן: *{_format_money(Decimal(data['margin']))}*\n"
            f"תנאי תשלום: *{data['payment_terms']}*\n\n"
            "שלח *אשר הצעה* כדי ליצור ולשלוח את ה-PDF אליך בלבד, או *ביטול*.",
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
            )
        except (FileNotFoundError, RuntimeError, ValueError) as exc:
            return f"לא הצלחתי ליצור את ההצעה: {exc}", None
        _delete_quote_session(phone)
        return None, pdf_path

    _delete_quote_session(phone)
    return "תהליך הצעת המחיר אופס. שלח *הצעת מחיר* כדי להתחיל מחדש.", None
