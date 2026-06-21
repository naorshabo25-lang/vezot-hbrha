import sqlite3
from contextlib import contextmanager

DB_PATH = "fuel_orders.db"


@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS drivers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                phone TEXT NOT NULL,
                area TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS customers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                phone TEXT NOT NULL,
                area TEXT NOT NULL,
                site_address TEXT DEFAULT '',
                contact_name TEXT DEFAULT '',
                contact_phone TEXT DEFAULT '',
                active INTEGER DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_id INTEGER,
                customer_name TEXT NOT NULL,
                site_address TEXT NOT NULL,
                contact_name TEXT NOT NULL,
                contact_phone TEXT NOT NULL,
                quantity TEXT NOT NULL,
                status TEXT DEFAULT 'ממתין',
                driver_id INTEGER,
                created_at TEXT DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY (customer_id) REFERENCES customers(id),
                FOREIGN KEY (driver_id) REFERENCES drivers(id)
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            INSERT OR IGNORE INTO settings (key, value) VALUES ('daily_hour', '14');
            INSERT OR IGNORE INTO settings (key, value) VALUES ('daily_minute', '0');
            INSERT OR IGNORE INTO settings (key, value) VALUES ('message_template',
                'שלום {name}, האם תצטרך הזמנת דלק סולר למחר?');
        """)
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS potential_customers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                phone TEXT DEFAULT '',
                area TEXT DEFAULT '',
                site_address TEXT DEFAULT '',
                contact_name TEXT DEFAULT '',
                contact_phone TEXT DEFAULT '',
                email TEXT DEFAULT '',
                active INTEGER DEFAULT 1
            );
        """)
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS conversation_state (
                phone        TEXT PRIMARY KEY,
                step         TEXT NOT NULL,
                customer_id  INTEGER,
                quantity     TEXT,
                city         TEXT,
                address      TEXT,
                order_date   TEXT,
                updated_at   TEXT DEFAULT (datetime('now','localtime'))
            );
        """)
        try:
            conn.execute("ALTER TABLE conversation_state ADD COLUMN order_date TEXT")
        except Exception:
            pass
        try:
            conn.execute("ALTER TABLE conversation_state ADD COLUMN contact_name TEXT")
        except Exception:
            pass
        try:
            conn.execute("ALTER TABLE conversation_state ADD COLUMN contact_phone TEXT")
        except Exception:
            pass
        try:
            conn.execute("ALTER TABLE conversation_state ADD COLUMN pending_order_json TEXT DEFAULT NULL")
        except Exception:
            pass
        for col in ['site_address', 'contact_name', 'contact_phone', 'email',
                    'order_contact_name', 'order_contact_phone']:
            try:
                conn.execute(f"ALTER TABLE customers ADD COLUMN {col} TEXT DEFAULT ''")
            except Exception:
                pass
        try:
            conn.execute("ALTER TABLE potential_customers ADD COLUMN notes TEXT DEFAULT ''")
        except Exception:
            pass
        for col in ['last_msg_id TEXT DEFAULT ""', 'msg_read INTEGER DEFAULT 0']:
            try:
                conn.execute(f"ALTER TABLE customers ADD COLUMN {col}")
            except Exception:
                pass
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS customer_sites (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_id INTEGER NOT NULL,
                name        TEXT NOT NULL,
                city        TEXT NOT NULL,
                address     TEXT NOT NULL,
                active      INTEGER DEFAULT 1,
                FOREIGN KEY (customer_id) REFERENCES customers(id)
            );
        """)
        try:
            conn.execute("ALTER TABLE orders ADD COLUMN order_date TEXT DEFAULT (date('now', 'localtime'))")
        except Exception:
            pass
        try:
            conn.execute("ALTER TABLE orders ADD COLUMN delivery_time TEXT DEFAULT ''")
        except Exception:
            pass
        try:
            conn.execute("ALTER TABLE orders ADD COLUMN extras TEXT DEFAULT ''")
        except Exception:
            pass
        try:
            conn.execute("ALTER TABLE orders ADD COLUMN sort_order INTEGER DEFAULT 0")
        except Exception:
            pass
        for col in ['tanker_volume TEXT DEFAULT ""', 'truck_number TEXT DEFAULT ""']:
            try:
                conn.execute(f"ALTER TABLE drivers ADD COLUMN {col}")
            except Exception:
                pass
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS recurring_orders (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_id   INTEGER,
                customer_name TEXT NOT NULL,
                site_address  TEXT NOT NULL,
                contact_name  TEXT DEFAULT '',
                contact_phone TEXT DEFAULT '',
                quantity      TEXT NOT NULL,
                area          TEXT DEFAULT '',
                days_of_week  TEXT NOT NULL DEFAULT '0,1,2,3,4',
                start_date    TEXT DEFAULT '',
                end_date      TEXT DEFAULT '',
                active        INTEGER DEFAULT 1,
                created_at    TEXT DEFAULT (datetime('now', 'localtime'))
            );
        """)
