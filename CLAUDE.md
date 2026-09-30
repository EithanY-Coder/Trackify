# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
source .venv/bin/activate && pip install -r requirements.txt   # setup (Python 3.14 venv exists at .venv)
.venv/bin/python app.py                                        # dev server on http://127.0.0.1:5001 (FLASK_DEBUG=true for debugger)
.venv/bin/python database.py                                   # init/migrate trackify.db standalone
.venv/bin/flask --app app send-weekly-emails --dry-run         # preview weekly recap job (drop --dry-run to send)
```

There is no test suite, linter, or build step. Frontend is plain static files served by Flask, so reload the browser after edits. To exercise authed routes without Supabase, set `app.config['TESTING'] = True` and send an `X-Test-User-Id: <uuid>` header (honored only in TESTING mode, see `helpers.get_auth_user`). When scripting against the DB, repoint `database.DB_PATH` at a temp file so `trackify.db` isn't touched.

## Architecture

Flask + SQLite backend, single-page vanilla JS frontend, Supabase for auth only.

**Import order in `app.py` matters.** It sets `SSL_CERT_FILE` to certifi and calls `load_dotenv()` *before* importing `database`/`helpers`/`routes`. Anything reading `os.environ` should read lazily (as `helpers._get_jwks_client` and `emailer` do), not at module import.

**Auth.** The browser signs up/logs in directly with Supabase JS (CDN script in `templates/index.html`, URL and publishable key hardcoded in `static/app.js`). Signup uses Supabase's standard email-verification link. Every API call goes through `apiCall()` in `app.js`, which attaches the Supabase access token. The backend never issues sessions: `helpers.require_auth` verifies the JWT against Supabase's JWKS endpoint and puts the Supabase user UUID on `g.user_id`. That UUID (TEXT) is the `user_id` in every table; there is no local users table and **SQLite stores no email addresses**.

**Route pattern** (`routes/*.py`, one blueprint per resource, registered in `routes/__init__.py`): `@bp.route` → `@require_auth` → optional `@limiter.limit(...)`; get a connection with `helpers.get_db()` (request-scoped on `flask.g`, closed on teardown); scope every query with `WHERE ... AND user_id = ?`; return `jsonify({'error': ...}), status` for validation failures. Unhandled exceptions become a generic 500 via `helpers.register_error_handlers`. Shared validation/business logic lives in `helpers.py` (e.g. `parse_transaction_payload`, `ensure_category`, `get_user_financial_profile`).

**Schema/migrations** live entirely in `database.init_db()`, which runs on every app start. It uses `CREATE TABLE/INDEX IF NOT EXISTS` plus `PRAGMA table_info` checks for `ALTER TABLE ADD COLUMN`. Add schema changes there in the same idempotent style. Notable details: categories with `user_id IS NULL` are global defaults seeded on first run; transactions reference categories by `category_name` (not FK); dates are `YYYY-MM-DD` strings, so range filters use string `BETWEEN`/`LIKE`.

**AI features** (Gemini, `GEMINI_API_KEY`):
- `routes/ai.py`: natural-language → transaction JSON via raw `requests` to the Gemini REST API.
- `routes/advisor.py`: multi-session chat via the `google-genai` SDK. Each turn injects `get_user_financial_profile()` into the system prompt, sends the last 15 messages of the session, strips markdown from the reply, persists both messages to `chat_messages`, and auto-titles a session still named "New Chat" from the first message.

**Weekly recap emails** (runs outside request context):
- `weekly_summary.py` builds the summary, renders HTML/text, and runs the job. Its functions take an explicit sqlite3 connection (`database.get_db_connection()`), **not** `get_db()`, because `flask.g` doesn't exist under cron.
- Recipients come from `helpers.fetch_verified_users()` (Supabase Admin API with `SUPABASE_SERVICE_ROLE_KEY`, backend only), filtered by `user_settings.weekly_email_enabled` (missing row = enabled).
- Duplicate protection: `weekly_email_log` has `UNIQUE(user_id, week_start)`; `_claim_send` reserves the slot via upsert before sending, and failed sends retry up to `MAX_SEND_ATTEMPTS`.
- `emailer.py` sends through Resend or SendGrid (`EMAIL_PROVIDER`) using `requests`.
- Triggered by the `send-weekly-emails` CLI command or `POST /api/jobs/weekly-emails` with an `X-Cron-Secret` header (`routes/jobs.py`). There is deliberately no in-process scheduler.
- Unsubscribe (`routes/settings.py`) is public and authorized by an HMAC token (`helpers.make_unsubscribe_token`, `WEEKLY_EMAIL_SECRET`). GET only shows a confirmation page and POST performs the opt-out, which also serves RFC 8058 one-click.

**Frontend** (`static/app.js`, ~3k lines, no framework or bundler): a global `state` object plus an `elements` map of DOM refs, bootstrapped on `DOMContentLoaded` by a series of `init*()` functions; the file is organized by `// ====` section banners. Tabs are `<section class="tab-content">` elements in `index.html`, switched by `.nav-btn[data-tab]`. Charts are hand-drawn SVG. User-supplied strings must go through `escapeHtml()` before being put into `innerHTML`.

## Environment

`.env` (gitignored; annotated template in `.env.example`). Required: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GEMINI_API_KEY`. Weekly email feature: `SUPABASE_SERVICE_ROLE_KEY`, `EMAIL_PROVIDER`, `RESEND_API_KEY`/`SENDGRID_API_KEY`, `WEEKLY_EMAIL_FROM`, `APP_BASE_URL`, `WEEKLY_EMAIL_SECRET`, `CRON_SECRET`. Local-dev only: `FLASK_DEBUG=true`, `DISABLE_SSL_VERIFY=true`. `SUPABASE_JWT_SECRET` is unused.

The rate limiter uses in-memory storage, so limits are per-process; production needs a shared backend such as Redis.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
