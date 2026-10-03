"""One-time copy of a local trackify.db (SQLite) into the Postgres database at
DATABASE_URL, keeping every row's original id.

    .venv/bin/python scripts/migrate_sqlite_to_postgres.py [path/to/trackify.db]

Refuses to run if the target already holds user data, so it can't clobber
production. Runs in a single transaction: either everything copies or nothing.
"""
import os
import sqlite3
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv()

import database  # noqa: E402 - must come after load_dotenv()

# Parents before children (chat_messages references chat_sessions).
COPY_ORDER = ('categories', 'chat_sessions', 'chat_messages', 'transactions',
              'user_settings', 'user_profiles', 'weekly_email_log')


def main():
    sqlite_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'trackify.db')
    if not os.path.exists(sqlite_path):
        sys.exit(f'SQLite file not found: {sqlite_path}')

    src = sqlite3.connect(sqlite_path)
    src.row_factory = sqlite3.Row
    src_tables = {r['name'] for r in src.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}

    database.init_db()
    dst = database.get_db_connection()
    try:
        user_rows = dst.execute('''
            SELECT (SELECT COUNT(*) FROM transactions)
                 + (SELECT COUNT(*) FROM chat_sessions)
                 + (SELECT COUNT(*) FROM categories WHERE user_id IS NOT NULL) AS n
        ''').fetchone()['n']
        if user_rows:
            sys.exit('Target database already contains user data - refusing to overwrite it.')

        # Replaces the default categories init_db() just seeded with the exact
        # rows (and ids) from SQLite.
        dst.execute(f'TRUNCATE {", ".join(COPY_ORDER)} RESTART IDENTITY CASCADE')

        for table in COPY_ORDER:
            if table not in src_tables:
                print(f'{table:18} not in SQLite, skipped')
                continue
            dst_cols = [r['column_name'] for r in dst.execute(
                'SELECT column_name FROM information_schema.columns '
                'WHERE table_schema = current_schema() AND table_name = %s ORDER BY ordinal_position',
                (table,))]
            src_cols = [r[1] for r in src.execute(f'PRAGMA table_info({table})')]
            cols = [c for c in dst_cols if c in src_cols]

            rows = [tuple(r[c] for c in cols) for r in src.execute(f'SELECT {", ".join(cols)} FROM {table}')]
            if rows:
                placeholders = ', '.join(['%s'] * len(cols))
                with dst.cursor() as cur:
                    cur.executemany(
                        f'INSERT INTO {table} ({", ".join(cols)}) VALUES ({placeholders})', rows)

            if 'id' in dst_cols:
                # Next generated id continues after the copied ones.
                dst.execute(f'''
                    SELECT setval(pg_get_serial_sequence('{table}', 'id'),
                                  COALESCE((SELECT MAX(id) FROM {table}), 0) + 1, false)
                ''')

            copied = dst.execute(f'SELECT COUNT(*) AS n FROM {table}').fetchone()['n']
            status = 'OK' if copied == len(rows) else 'MISMATCH'
            print(f'{table:18} sqlite={len(rows):<5} postgres={copied:<5} {status}')
            if copied != len(rows):
                raise RuntimeError(f'Row count mismatch in {table}; rolling back.')

        dst.commit()
        print('Migration complete.')
    finally:
        dst.close()
        src.close()


if __name__ == '__main__':
    main()
