import os
import requests


def _post(to_phone: str, payload: dict) -> bool:
    access_token    = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
    phone_number_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
    if not access_token or not phone_number_id:
        print("[WhatsApp] חסר WHATSAPP_ACCESS_TOKEN או WHATSAPP_PHONE_NUMBER_ID ב-.env")
        return False
    api_url = f"https://graph.facebook.com/v25.0/{phone_number_id}/messages"
    try:
        resp = requests.post(
            api_url,
            headers={"Authorization": f"Bearer {access_token}"},
            json=payload,
            timeout=10,
        )
        if not resp.ok:
            print(f"[WhatsApp] שגיאה {resp.status_code}: {resp.text}")
            return False
        return True
    except Exception as e:
        print(f"[WhatsApp] שגיאה בשליחה ל-{to_phone}: {e}")
        return False


def send_whatsapp_message(to_phone: str, text: str) -> bool:
    to_phone = to_phone.replace("whatsapp:", "")
    return _post(to_phone, {
        "messaging_product": "whatsapp",
        "to": to_phone,
        "type": "text",
        "text": {"body": text},
    })


def send_quantity_list(to_phone: str) -> bool:
    return _post(to_phone, {
        "messaging_product": "whatsapp",
        "to": to_phone,
        "type": "interactive",
        "interactive": {
            "type": "list",
            "body": {"text": "מה כמות הליטרים שתרצה להזמין?"},
            "action": {
                "button": "בחר כמות",
                "sections": [{
                    "title": "כמויות סולר",
                    "rows": [
                        {"id": "qty_0_100",     "title": "0–100 ליטר"},
                        {"id": "qty_100_400",   "title": "100–400 ליטר"},
                        {"id": "qty_400_1000",  "title": "400–1,000 ליטר"},
                        {"id": "qty_1000_2000", "title": "1,000–2,000 ליטר"},
                    ],
                }],
            },
        },
    })


def send_area_list(to_phone: str) -> bool:
    return _post(to_phone, {
        "messaging_product": "whatsapp",
        "to": to_phone,
        "type": "interactive",
        "interactive": {
            "type": "list",
            "body": {"text": "באיזה אזור תרצה את האספקה?"},
            "action": {
                "button": "בחר אזור",
                "sections": [{
                    "title": "אזורי חלוקה",
                    "rows": [
                        {"id": "area_jerusalem",    "title": "ירושלים והסביבה"},
                        {"id": "area_modiin",       "title": "מודיעין"},
                        {"id": "area_maale_adumim", "title": "מעלה אדומים"},
                        {"id": "area_beit_shemesh", "title": "בית שמש"},
                        {"id": "area_other",        "title": "אחר"},
                    ],
                }],
            },
        },
    })


def send_time_list(to_phone: str) -> bool:
    return _post(to_phone, {
        "messaging_product": "whatsapp",
        "to": to_phone,
        "type": "interactive",
        "interactive": {
            "type": "list",
            "body": {"text": "באיזו שעה תרצה את האספקה?"},
            "action": {
                "button": "בחר שעה",
                "sections": [{
                    "title": "שעות אספקה",
                    "rows": [
                        {"id": "time_07_09", "title": "07:00–09:00"},
                        {"id": "time_09_11", "title": "09:00–11:00"},
                        {"id": "time_11_13", "title": "11:00–13:00"},
                        {"id": "time_13_15", "title": "13:00–15:00"},
                    ],
                }],
            },
        },
    })


def send_date_list(to_phone: str) -> bool:
    from datetime import date, timedelta
    DAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
    rows = []
    for i in range(1, 4):
        d = date.today() + timedelta(days=i)
        label = f"מחר — {d.day}/{d.month}" if i == 1 else f"יום {DAYS_HE[d.weekday() % 7 if False else d.isoweekday() % 7]} — {d.day}/{d.month}"
        rows.append({"id": f"date_{d.isoformat()}", "title": label})
    return _post(to_phone, {
        "messaging_product": "whatsapp",
        "to": to_phone,
        "type": "interactive",
        "interactive": {
            "type": "list",
            "body": {"text": "כן ודאי! לאיזה תאריך תרצה את האספקה?"},
            "action": {
                "button": "בחר תאריך",
                "sections": [{"title": "תאריכי אספקה", "rows": rows}],
            },
        },
    })


def send_site_list(to_phone: str, sites: list) -> bool:
    rows = [
        {
            "id": f"site_{s['id']}",
            "title": s["name"][:24],
            "description": f"{s['city']}, {s['address']}"[:72],
        }
        for s in sites[:9]
    ]
    rows.append({"id": "site_other", "title": "כתובת אחרת..."})
    return _post(to_phone, {
        "messaging_product": "whatsapp",
        "to": to_phone,
        "type": "interactive",
        "interactive": {
            "type": "list",
            "body": {"text": "לאיזה אתר תרצה את האספקה?"},
            "action": {
                "button": "בחר אתר",
                "sections": [{"title": "אתרי אספקה", "rows": rows}],
            },
        },
    })


def send_order_card(to_phone: str, order: dict) -> bool:
    """שולח פרטי הזמנה עם כפתור ביצוע לנהג."""
    o = order
    time_str    = f" | {o['delivery_time']}" if o.get('delivery_time') or o['delivery_time'] else ""
    contact_str = ""
    if o.get('contact_name') or o['contact_name']:
        contact_str += f"\n👤 איש קשר: {o['contact_name']}"
    if o.get('contact_phone') or o['contact_phone']:
        contact_str += f"\n📞 טלפון: {o['contact_phone']}"

    body = (
        f"📦 הזמנה #{o['id']}\n"
        f"👥 לקוח: {o['customer_name']}\n"
        f"📍 כתובת: {o['site_address']}"
        f"{contact_str}\n"
        f"⛽ כמות: {o['quantity']} ליטר\n"
        f"🕐 שעה: {o.get('delivery_time') or o['delivery_time'] or '—'}"
    )
    return _post(to_phone, {
        "messaging_product": "whatsapp",
        "to": to_phone,
        "type": "interactive",
        "interactive": {
            "type": "button",
            "body": {"text": body},
            "action": {
                "buttons": [
                    {"type": "reply", "reply": {"id": f"done_{o['id']}", "title": "✅ ביצוע"}},
                ]
            },
        },
    })


def download_whatsapp_media(media_id: str):
    """Returns (bytes, mime_type) or raises"""
    access_token = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
    phone_number_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
    resp = requests.get(
        f"https://graph.facebook.com/v25.0/{media_id}",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    media_url = data["url"]
    mime_type = data.get("mime_type", "application/octet-stream")
    resp2 = requests.get(media_url, headers={"Authorization": f"Bearer {access_token}"}, timeout=30)
    resp2.raise_for_status()
    return resp2.content, mime_type


def send_order_confirmation_card(to_phone: str, info: dict) -> bool:
    qty   = info.get("quantity") or "?"
    addr  = info.get("address") or "לא זוהה"
    cname = info.get("contact_name") or ""
    cphone = info.get("contact_phone") or ""
    raw_date = info.get("delivery_date")
    if raw_date:
        try:
            from datetime import datetime as _dt
            d = _dt.strptime(raw_date, "%Y-%m-%d")
            date_str = f"{d.day}/{d.month}/{d.year}"
        except Exception:
            date_str = raw_date
    else:
        date_str = "לא זוהה"

    body = f"📋 *פרטי ההזמנה שחולצו:*\n\n🛢️ כמות: {qty} ליטר\n📅 תאריך: {date_str}\n📍 כתובת: {addr}"
    if cname:  body += f"\n👤 {cname}"
    if cphone: body += f"\n📞 {cphone}"
    body += "\n\nהאם לאשר את ההזמנה?"

    return _post(to_phone, {
        "messaging_product": "whatsapp",
        "to": to_phone,
        "type": "interactive",
        "interactive": {
            "type": "button",
            "body": {"text": body},
            "action": {"buttons": [
                {"type": "reply", "reply": {"id": "confirm_order", "title": "✅ אשר הזמנה"}},
                {"type": "reply", "reply": {"id": "cancel_order",  "title": "❌ בטל"}},
            ]},
        },
    })


def send_daily_question(phone: str, customer_name: str, template: str) -> bool:
    text = template.replace("{name}", customer_name)
    return send_whatsapp_message(phone, text)
