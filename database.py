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
    
    # Create categories table (user_id can be NULL for default categories, or TEXT for Supabase UUIDs)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            name TEXT NOT NULL,
            icon TEXT NOT NULL,
            color TEXT NOT NULL
        )
    ''')
    
    # Create a unique index for categories per user
    cursor.execute('''
        CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_user_name 
        ON categories(COALESCE(user_id, 'global'), name);
    ''')
    
    # Create transactions table linked to user_id (TEXT for Supabase UUIDs)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            type TEXT NOT NULL, -- 'income' or 'expense'
            amount REAL NOT NULL,
            description TEXT NOT NULL,
            category_name TEXT NOT NULL,
            date TEXT NOT NULL, -- YYYY-MM-DD
            hours_worked REAL,
            hourly_wage REAL,
            tax_rate REAL,
            gross_amount REAL
        )
    ''')
    
    # Create indexes for performance
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);')
    
    # Create goals table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            title TEXT NOT NULL,
            target_amount REAL NOT NULL,
            saved_amount REAL NOT NULL DEFAULT 0.0,
            deadline TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);')

    # Create chat_messages table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);')
    
    # Pre-seed categories if empty
    cursor.execute('SELECT COUNT(*) FROM categories WHERE user_id IS NULL')
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
            'INSERT INTO categories (name, icon, color, user_id) VALUES (?, ?, ?, NULL)',
            default_categories
        )
    
    conn.commit()
    conn.close()

if __name__ == '__main__':
    init_db()
    print("Database initialized successfully.")
