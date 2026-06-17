import sqlite3
import os

# Database will be saved in the backend folder as expenses.db
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'expenses.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # This lets us access columns by name
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
    print('[DB] Database ready.')