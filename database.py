import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'trackify.db')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    # Enable foreign keys
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create categories table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            icon TEXT NOT NULL,
            color TEXT NOT NULL
        )
    ''')
    
    # Create transactions table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL, -- 'income' or 'expense'
            amount REAL NOT NULL,
            description TEXT NOT NULL,
            category_name TEXT NOT NULL, -- Denormalized for convenience and fallback if category deleted, or references name
            date TEXT NOT NULL, -- YYYY-MM-DD
            hours_worked REAL,
            hourly_wage REAL,
            tax_rate REAL,
            gross_amount REAL,
            FOREIGN KEY (category_name) REFERENCES categories (name) ON DELETE RESTRICT
        )
    ''')
    
    # Try adding tax_rate and gross_amount columns if they don't exist
    try:
        cursor.execute('ALTER TABLE transactions ADD COLUMN tax_rate REAL')
    except sqlite3.OperationalError:
        pass
    try:
        cursor.execute('ALTER TABLE transactions ADD COLUMN gross_amount REAL')
    except sqlite3.OperationalError:
        pass
    
    # Pre-seed categories if empty
    cursor.execute('SELECT COUNT(*) FROM categories')
    if cursor.fetchone()[0] == 0:
        default_categories = [
            ("Fast Food", "•", "#FF6B6B"),
            ("Clothes", "•", "#4DABF7"),
            ("Technology", "•", "#BE4BDB"),
            ("Flowers/Gifts", "•", "#FF8787"),
            ("Education", "•", "#15AABF"),
            ("Entertainment", "•", "#748FFC"),
            ("Miscellaneous", "•", "#ADB5BD")
        ]
        cursor.executemany(
            'INSERT INTO categories (name, icon, color) VALUES (?, ?, ?)',
            default_categories
        )
    
    conn.commit()
    conn.close()

if __name__ == '__main__':
    init_db()
    print("Database initialized successfully.")
