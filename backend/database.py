import sqlite3
import os
import sys

# ─────────────────────────────────────────────────────────────
#  Where to store the database
#  - Development (npm start)  → backend/expenses.db  (as before)
#  - Production  (installed)  → C:\Users\You\AppData\Roaming\ExpenseTrack\expenses.db
#    This means data survives app updates and reinstalls!
# ─────────────────────────────────────────────────────────────

if getattr(sys, 'frozen', False):
    # Running as a PyInstaller bundle (production)
    data_dir = os.path.join(
        os.environ.get('APPDATA', os.path.expanduser('~')),
        'NeoWallet'
    )
    os.makedirs(data_dir, exist_ok=True)
    BASE_DIR = data_dir
else:
    # Running normally in development
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DB_PATH = os.path.join(BASE_DIR, 'expenses.db')


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    c = conn.cursor()

    c.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            title       TEXT    NOT NULL,
            amount      REAL    NOT NULL,
            category    TEXT    NOT NULL,
            date        TEXT    NOT NULL,
            note        TEXT    DEFAULT '',
            created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS budgets (
            id     INTEGER PRIMARY KEY AUTOINCREMENT,
            month  TEXT    NOT NULL,
            year   INTEGER NOT NULL,
            amount REAL    NOT NULL,
            UNIQUE(month, year)
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS categories (
            id    INTEGER PRIMARY KEY AUTOINCREMENT,
            name  TEXT NOT NULL UNIQUE,
            icon  TEXT DEFAULT '📦',
            color TEXT DEFAULT '#9ca3af'
        )
    ''')

    default_categories = [
        ('Groceries',     '🛒', '#10b981'),
        ('Utilities',     '⚡', '#3b82f6'),
        ('Transport',     '🚌', '#f59e0b'),
        ('Dining',        '☕', '#ec4899'),
        ('Shopping',      '🛍️', '#06b6d4'),
        ('Healthcare',    '🏥', '#ef4444'),
        ('Entertainment', '🎮', '#f97316'),
        ('Other',         '📦', '#8b5cf6'),
    ]

    for cat in default_categories:
        c.execute('INSERT OR IGNORE INTO categories (name, icon, color) VALUES (?,?,?)', cat)

    conn.commit()
    conn.close()
    print(f'[DB] Ready. Database at: {DB_PATH}')