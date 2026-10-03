# pyrefly: ignore [missing-import] - Shared helpers for the Trackify Flask app
import os
import functools
import datetime
import hmac
import hashlib
import jwt
import requests
from flask import request, g, jsonify, current_app
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_limiter.errors import RateLimitExceeded
from werkzeug.exceptions import HTTPException

import database

# ----------------- CONFIG -----------------

# Built lazily (on first auth check) rather than at import time: this module
# gets imported before app.py's load_dotenv() call has necessarily run in
# every import order, and reading os.environ too early would silently give
# an empty SUPABASE_URL - making every request look unauthenticated with no
# obvious cause. Reading lazily means it only matters that load_dotenv() ran
# before the first real request, which it always has.
_jwks_client = None
_jwks_client_built = False


def _get_jwks_client():
    global _jwks_client, _jwks_client_built
    if not _jwks_client_built:
        supabase_url = os.environ.get('SUPABASE_URL', '').rstrip('/')
        supabase_anon_key = os.environ.get('SUPABASE_ANON_KEY', '')
        if supabase_url:
            jwks_url = f"{supabase_url}/auth/v1/.well-known/jwks.json"
            headers = {
                'apikey': supabase_anon_key,
                'Authorization': f'Bearer {supabase_anon_key}'
            }
            _jwks_client = jwt.PyJWKClient(jwks_url, headers=headers)
        _jwks_client_built = True
    return _jwks_client


MAX_DESCRIPTION_LEN = 200
MAX_TITLE_LEN = 100
MAX_CATEGORY_NAME_LEN = 50

# Created without an app so blueprints can import and decorate with it;
# bound to the real app via register_error_handlers() -> limiter.init_app().
limiter = Limiter(key_func=get_remote_address, default_limits=["300 per minute"])


# ----------------- AUTH -----------------

def get_auth_user():
    if current_app.config.get('TESTING') and request.headers.get('X-Test-User-Id'):
        return request.headers.get('X-Test-User-Id')

    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    token = auth_header.split(' ', 1)[1]

    jwks_client = _get_jwks_client()
    if jwks_client is None:
        current_app.logger.warning('Auth attempted but SUPABASE_URL is not configured.')
        return None

    try:
        header = jwt.get_unverified_header(token)
        alg = header.get('alg', 'ES256')

        # Retrieve public signing key dynamically from JWKS
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        # Decode and verify
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=[alg],
            options={"verify_aud": False}
        )
        return payload.get('sub')
    except jwt.ExpiredSignatureError:
        current_app.logger.info('JWT expired.')
        return None
    except jwt.InvalidTokenError as e:
        current_app.logger.warning(f'JWT invalid: {e}')
        return None
    except Exception as e:
        current_app.logger.warning(f'JWT verification failed: {e}')
        return None


def require_auth(view_func):
    """Runs get_auth_user() once, 401s if missing, and stashes the id on
    flask.g.user_id for the view (and anything else in the request)."""
    @functools.wraps(view_func)
    def wrapper(*args, **kwargs):
        user_id = get_auth_user()
        if not user_id:
            return jsonify({'error': 'Unauthorized. Please log in.'}), 401
        g.user_id = user_id
        return view_func(*args, **kwargs)
    return wrapper


# ----------------- DATABASE -----------------

def get_db():
    """Returns a database connection cached on flask.g for the life of the
    request; closed automatically by the teardown handler below."""
    if 'db' not in g:
        g.db = database.get_db_connection()
    return g.db


# ----------------- APP WIRING -----------------

def register_error_handlers(app):
    limiter.init_app(app)

    @app.teardown_appcontext
    def _close_db(exception=None):
        db = g.pop('db', None)
        if db is not None:
            db.close()

    @app.errorhandler(RateLimitExceeded)
    def _rate_limit_exceeded(e):
        detail = getattr(e, 'description', None) or 'please slow down.'
        return jsonify({'error': f'Rate limit exceeded: {detail}'}), 429

    @app.errorhandler(Exception)
    def _handle_unexpected_error(e):
        # Let normal HTTP errors (404, 405, the RateLimitExceeded handler
        # above, etc.) pass through unchanged - only swallow genuinely
        # unexpected exceptions so we don't leak internals to the client.
        if isinstance(e, HTTPException):
            return e
        app.logger.exception('Unhandled exception while processing request')
        return jsonify({'error': 'An unexpected error occurred.'}), 500


# ----------------- SHARED BUSINESS LOGIC -----------------

def get_user_financial_profile(user_id):
    conn = get_db()
    current_month_prefix = datetime.date.today().strftime('%Y-%m-')

    row_spent = conn.execute('''
        SELECT SUM(amount) AS total FROM transactions
        WHERE user_id = %s AND type = 'expense' AND date LIKE %s
    ''', (user_id, current_month_prefix + '%')).fetchone()
    mtd_spent = row_spent['total'] if row_spent and row_spent['total'] is not None else 0.0

    cat_rows = conn.execute('''
        SELECT category_name, SUM(amount) AS total FROM transactions
        WHERE user_id = %s AND type = 'expense' AND date LIKE %s
        GROUP BY category_name
        ORDER BY category_name
    ''', (user_id, current_month_prefix + '%')).fetchall()
    category_breakdown = {r['category_name']: r['total'] for r in cat_rows}

    cat_str = ", ".join([f"{k}: ${v:.2f}" for k, v in category_breakdown.items()]) if category_breakdown else "No spending recorded this month."

    return f"""--- CURRENT USER FINANCIAL PROFILE ---
Month-to-Date Spend: ${mtd_spent:.2f}
Spending by Category: {cat_str}
-------------------------------------"""


def parse_transaction_payload(data):
    """Validates and normalizes a transaction payload. Shared by the
    add/update transaction routes, which used to duplicate this logic.

    Returns (parsed_dict, None) on success, or (None, (message, status))
    on the first validation failure.
    """
    t_type = data.get('type')  # 'income' or 'expense'
    description = data.get('description', '').strip()
    category_name = data.get('category_name', 'Miscellaneous').strip()
    date_str = data.get('date', '')

    if t_type not in ('income', 'expense'):
        return None, ('Invalid transaction type.', 400)
    if not date_str:
        return None, ('Date is required.', 400)
    try:
        datetime.date.fromisoformat(date_str)
    except ValueError:
        return None, ('Date must be in YYYY-MM-DD format.', 400)
    if len(description) > MAX_DESCRIPTION_LEN:
        return None, (f'Description must be {MAX_DESCRIPTION_LEN} characters or fewer.', 400)
    if len(category_name) > MAX_CATEGORY_NAME_LEN:
        return None, (f'Category name must be {MAX_CATEGORY_NAME_LEN} characters or fewer.', 400)

    hours_worked = None
    hourly_wage = None
    tax_rate = None
    gross_amount = None

    if t_type == 'income':
        hours_worked_raw = data.get('hours_worked')
        hourly_wage_raw = data.get('hourly_wage')

        if hours_worked_raw not in (None, '') and hourly_wage_raw not in (None, ''):
            try:
                hours_worked = float(hours_worked_raw)
                hourly_wage = float(hourly_wage_raw)
            except ValueError:
                return None, ('Hours worked and hourly wage must be numbers.', 400)

        try:
            amount = float(data.get('amount', 0))
        except ValueError:
            return None, ('Amount must be a number.', 400)

        tax_rate_raw = data.get('tax_rate')
        if tax_rate_raw not in (None, ''):
            try:
                tax_rate = float(tax_rate_raw)
            except ValueError:
                return None, ('Tax rate must be a number.', 400)

        gross_amount_raw = data.get('gross_amount')
        if gross_amount_raw not in (None, ''):
            try:
                gross_amount = float(gross_amount_raw)
            except ValueError:
                return None, ('Gross amount must be a number.', 400)
    else:
        try:
            amount = float(data.get('amount', 0))
        except ValueError:
            return None, ('Amount must be a number.', 400)

    if amount <= 0:
        return None, ('Amount must be greater than zero.', 400)

    return {
        'type': t_type,
        'amount': amount,
        'description': description,
        'category_name': category_name,
        'date': date_str,
        'hours_worked': hours_worked,
        'hourly_wage': hourly_wage,
        'tax_rate': tax_rate,
        'gross_amount': gross_amount,
        'category_icon': data.get('category_icon', '📦').strip(),
        'category_color': data.get('category_color', '#ADB5BD').strip(),
    }, None


def ensure_category(conn, user_id, category_name, icon, color):
    """Makes sure a category row exists for category_name (global or
    user-owned), creating one if needed. Returns the canonical name that
    should be stored on the transaction.

    Fixes a case-mismatch bug: previously, an 'income'/'Income'/'INCOME'
    typed by a caller would match the 'income' branch below but the
    transaction kept whatever casing was sent, so it silently stopped
    matching the actual 'Income' category row (broke icon/color lookup).
    """
    cat = conn.execute(
        'SELECT name FROM categories WHERE (user_id IS NULL OR user_id = %s) AND name = %s',
        (user_id, category_name)
    ).fetchone()
    if cat:
        return cat['name']

    if category_name.lower() == 'income':
        conn.execute(
            'INSERT INTO categories (name, icon, color, user_id) VALUES (%s, %s, %s, NULL) ON CONFLICT DO NOTHING',
            ('Income', '💵', '#2B8A3E')
        )
        conn.commit()
        return 'Income'

    conn.execute(
        'INSERT INTO categories (name, icon, color, user_id) VALUES (%s, %s, %s, %s) ON CONFLICT DO NOTHING',
        (category_name, icon, color, user_id)
    )
    conn.commit()
    return category_name


# ----------------- SUPABASE ADMIN (backend only) -----------------

# Trackify's SQLite tables key off user_id and never store email addresses -
# Supabase Auth is the source of truth for both the address and whether it has
# been verified. Reaching it requires the service role key, which bypasses RLS
# and must therefore stay server-side: it is read from the environment here and
# is never sent to the browser or embedded in any template.

_SUPABASE_ADMIN_TIMEOUT = (10, 20)
_SUPABASE_ADMIN_PAGE_SIZE = 200


def fetch_verified_users():
    """Returns {user_id: email} for every Supabase user with a confirmed email.

    Unverified users are filtered out here, which is what enforces the
    "only email verified users" rule for the weekly recap job.

    Raises RuntimeError if the admin credentials are missing or the API call
    fails, so the caller can abort the batch instead of silently emailing nobody.
    """
    supabase_url = os.environ.get('SUPABASE_URL', '').strip().rstrip('/')
    service_key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '').strip().strip('"').strip("'")

    if not supabase_url:
        raise RuntimeError('SUPABASE_URL is not configured.')
    if not service_key:
        raise RuntimeError('SUPABASE_SERVICE_ROLE_KEY is not configured (required to look up verified emails).')

    verified = {}
    page = 1
    while True:
        try:
            response = requests.get(
                f'{supabase_url}/auth/v1/admin/users',
                headers={
                    'apikey': service_key,
                    'Authorization': f'Bearer {service_key}',
                },
                params={'page': page, 'per_page': _SUPABASE_ADMIN_PAGE_SIZE},
                timeout=_SUPABASE_ADMIN_TIMEOUT,
            )
        except requests.RequestException as e:
            raise RuntimeError(f'Supabase admin request failed: {type(e).__name__}') from None

        if response.status_code >= 400:
            raise RuntimeError(f'Supabase admin API returned {response.status_code}.')

        try:
            payload = response.json() or {}
        except ValueError:
            raise RuntimeError('Supabase admin API returned a malformed response.') from None

        users = payload.get('users', payload if isinstance(payload, list) else [])
        if not users:
            break

        for user in users:
            email = (user.get('email') or '').strip()
            user_id = user.get('id')
            # Supabase sets email_confirmed_at (and mirrors it onto confirmed_at)
            # only once the user clicks the verification link.
            confirmed = user.get('email_confirmed_at') or user.get('confirmed_at')
            if user_id and email and confirmed:
                verified[user_id] = email

        if len(users) < _SUPABASE_ADMIN_PAGE_SIZE:
            break
        page += 1

    return verified


# ----------------- UNSUBSCRIBE TOKENS -----------------

# Unsubscribe links are opened straight from an inbox, with no Supabase session
# and no Authorization header - so the link itself has to carry proof. A keyed
# HMAC of the user id does that without exposing anything guessable: knowing a
# user id is not enough to forge one, and the token reveals nothing about the
# user. Tokens are deliberately long-lived, because an unsubscribe link must
# still work in an email someone opens months later.


def _get_unsubscribe_secret():
    secret = os.environ.get('WEEKLY_EMAIL_SECRET', '').strip()
    if not secret:
        raise RuntimeError('WEEKLY_EMAIL_SECRET is not configured (required for unsubscribe links).')
    return secret


def ensure_unsubscribe_secret_configured():
    """Raises RuntimeError if unsubscribe links can't be signed.

    Called before a send batch starts so the job aborts up front rather than
    mailing out a run of emails with unusable unsubscribe links.
    """
    _get_unsubscribe_secret()


def make_unsubscribe_token(user_id):
    secret = _get_unsubscribe_secret()
    return hmac.new(
        secret.encode('utf-8'),
        f'weekly-unsubscribe:{user_id}'.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()


def verify_unsubscribe_token(user_id, token):
    """Constant-time check of an unsubscribe token. Never raises."""
    if not user_id or not token:
        return False
    try:
        expected = make_unsubscribe_token(user_id)
    except RuntimeError:
        return False
    return hmac.compare_digest(expected, token)


def get_app_base_url():
    """Public base URL used to build links inside emails."""
    return (os.environ.get('APP_BASE_URL', '').strip().rstrip('/') or 'http://localhost:5001')
