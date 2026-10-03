# pyrefly: ignore [missing-import] - Trackify Flask Server
import os
import ssl
import certifi
from flask import Flask, render_template
from dotenv import load_dotenv

# Point Python's default SSL context at certifi's CA bundle. Some Python
# installs (common on macOS) don't wire up the system trust store, which
# makes every outgoing HTTPS call (the Supabase JWKS fetch during login,
# Gemini API calls) fail with "unable to get local issuer certificate".
# This fixes that properly - unlike disabling verification, it keeps
# certificate checking on.
os.environ.setdefault('SSL_CERT_FILE', certifi.where())

# Load environment variables from .env BEFORE importing helpers/routes -
# helpers.py reads SUPABASE_URL/SUPABASE_ANON_KEY at import time, so this
# must run first or auth silently breaks (empty SUPABASE_URL -> no JWKS
# client -> every request looks unauthenticated).
load_dotenv()

import database
import helpers
import weekly_summary
from routes import register_blueprints

# Last-resort local-dev TLS verification bypass, for certificate issues the
# certifi fix above doesn't cover. Opt-in via DISABLE_SSL_VERIFY=true -
# never enable this in production, it disables certificate verification for
# every outgoing HTTPS call in the process.
if os.environ.get('DISABLE_SSL_VERIFY', '').strip().lower() == 'true':
    ssl._create_default_https_context = ssl._create_unverified_context

# Static files live in public/static so Vercel serves them from its CDN at the
# same /static/... URLs Flask uses locally.
app = Flask(__name__, static_folder='public/static', static_url_path='/static')

# Initialize database
database.init_db()

# Wire up rate limiting, DB teardown, and centralized error handling
helpers.register_error_handlers(app)

# Register all API blueprints (auth, categories, transactions, advisor, ai,
# settings, jobs)
register_blueprints(app)

# Expose `flask --app app send-weekly-emails` for the scheduler. Registering a
# CLI command (rather than starting an in-process scheduler thread) keeps the
# job out of the request-serving processes, so running multiple workers can't
# fan out into multiple sends.
weekly_summary.register_weekly_email_cli(app)


@app.route('/')
def index():
    return render_template('index.html')


if __name__ == '__main__':
    debug_mode = os.environ.get('FLASK_DEBUG', '').strip().lower() == 'true'
    app.run(debug=debug_mode, port=5001)
