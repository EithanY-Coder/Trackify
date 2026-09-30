<div align="center">

# 📊 Trackify
### *Smart, AI-Powered Budget Tracking for Students*

[![Python](https://img.shields.io/badge/Python-3.9+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Gemini](https://img.shields.io/badge/Google%20Gemini-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white)](https://aistudio.google.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

<p align="center">
  <b>Log expenses with natural language. Calculate net pay automatically. Ditch manual spreadsheets.</b>
</p>

---

</div>

**Trackify** is a smart, interactive Student Budget Tracker built with a Flask backend, SQLite database, Supabase auth, and a vanilla JS/CSS frontend. It uses **Gemini AI** to parse transactions from plain-English descriptions and can send a **weekly recap email** of your spending.

Instead of entering amounts into rigid form inputs, you can write plain conversational entries like *"spent $14 on lunch at Subway"* or *"worked 6 hours at $17/hr"* — Trackify extracts the amount, category, date, and any hourly/tax calculations, and updates your ledger in real time.

---

## ✨ Features

- **Double-Entry Ledger:** Easily log income and expenses.
- **Hourly Income Calculator:** Automatically calculate net/gross pay and tax deductions based on hours worked and hourly wage.
- **Smart Category Management:** Group transactions with custom icons (emojis) and hex colors.
- **AI Transaction Parser (Gemini Beta):** Simply type in natural language (e.g., *"worked 5 hours at $15/hr"* or *"spent $12.50 on a burger today"*) and let the AI extract all details, calculate amounts, and assign categories automatically.
- **Weekly Recap Emails:** Verified users can opt in (Settings tab) to a Monday email summarizing last week's spending, category breakdown, and top categories.
- **Clean Interactive UI:** View analytics, log logs, and interact with a premium, responsive dashboard.

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend** | Python 3.9+, Flask |
| **Database** | SQLite3 |
| **Auth** | Supabase (JWT, verified via JWKS) |
| **Frontend** | Vanilla HTML5, Modern CSS3, JavaScript (ES6+) |
| **AI Integration** | Google Gemini API (`gemini-3.1-flash-lite`, `gemini-3.6-flash`) |
| **Email** | Resend or SendGrid |

---

## ⚙️ Getting Started

### 1. Prerequisites
Make sure you have Python 3.9+ installed on your machine.

### 2. Installation
Clone this repository (or navigate to your local copy) and set up a virtual environment:

```bash
git clone https://github.com/EithanY-Coder/Trackify.git
cd Trackify

# Create and activate a virtual environment
python3 -m venv .venv
source .venv/bin/activate      # macOS / Linux
# .venv\Scripts\activate       # Windows

# Install dependencies
pip install -r requirements.txt
```

### 3. Setup Environment Variables
Create a file named `.env` in the root directory (do not commit this file to Git):

```env
GEMINI_API_KEY="your_actual_gemini_api_key_here"
SUPABASE_URL="https://your-project-ref.supabase.co"
SUPABASE_ANON_KEY="your_supabase_publishable_or_anon_key"

# --- Weekly recap emails (see .env.example for the annotated version) ---
SUPABASE_SERVICE_ROLE_KEY=""   # BACKEND ONLY - bypasses RLS, never expose to the browser
EMAIL_PROVIDER="resend"        # 'resend' or 'sendgrid'
RESEND_API_KEY=""
WEEKLY_EMAIL_FROM="Trackify <recap@yourdomain.com>"
APP_BASE_URL="http://localhost:5001"
WEEKLY_EMAIL_SECRET=""         # signs unsubscribe links
CRON_SECRET=""                 # protects the scheduler endpoint

# Optional (both default to off/secure):
# FLASK_DEBUG=true          # enables Flask's interactive debugger - local dev only, never in production
# DISABLE_SSL_VERIFY=true   # works around a local macOS certificate issue - local dev only
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are required — the app verifies logged-in users' tokens against your Supabase project's JWKS endpoint. (`SUPABASE_JWT_SECRET`, if present from an older setup, isn't used by the app.)

Generate the two secrets with:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

*Note: `.env` is already configured in `.gitignore` to protect your API keys from leaking online.*

### 4. Running the Application
Launch the Flask development server:

```bash
python3 app.py
```

The application will start running at `http://127.0.0.1:5001/` (or your configured port). Open this address in your web browser.

---

## Weekly Recap Emails

### How it works

1. Users sign up with Supabase's standard email verification link. Only accounts
   with a confirmed email are ever emailed.
2. The **Settings** tab toggles `weekly_email_enabled` in the `user_settings`
   table (on by default).
3. A scheduled job builds each user's Mon-Sun recap from the existing
   `transactions` table and sends it via Resend or SendGrid.
4. Every send is recorded in `weekly_email_log`, which has a
   `UNIQUE(user_id, week_start)` constraint - so the job is safe to run more
   than once. No user can receive two recaps for the same week.

All sending happens on the backend. No key or email logic exists in `app.js`.

### Provider setup

1. Create a Resend (or SendGrid) account and verify your sending domain -
   an unverified domain will land every email in spam.
2. Create an API key with send-only permission and put it in `.env`.
3. Set `WEEKLY_EMAIL_FROM` to an address on that verified domain.

### Running the job

Preview without sending anything:

```bash
.venv/bin/flask --app app send-weekly-emails --dry-run
```

Send for real:

```bash
.venv/bin/flask --app app send-weekly-emails
```

Schedule it for Monday 8am with `crontab -e`:

```cron
0 8 * * 1 cd "/path/to/Trackify V1" && .venv/bin/flask --app app send-weekly-emails >> /tmp/trackify-weekly.log 2>&1
```

On a host without cron access (Render, Railway, GitHub Actions), hit the
endpoint instead:

```bash
curl -X POST https://yourdomain.com/api/jobs/weekly-emails \
  -H "X-Cron-Secret: $CRON_SECRET"
```

### Unsubscribing

Every email carries an unsubscribe link signed with `WEEKLY_EMAIL_SECRET`, plus
RFC 8058 `List-Unsubscribe` headers for one-click unsubscribe in Gmail and Apple
Mail. The link opens a confirmation page and only opts out on POST, so mail
scanners that prefetch links can't unsubscribe someone by accident.

---

## 📁 Project Structure

```
├── app.py              # App factory: config, blueprint registration, entrypoint
├── helpers.py          # Shared auth/DB/error-handling helpers used by every route
├── routes/             # API blueprints, one module per resource
│   ├── auth.py          #   /api/auth/status
│   ├── categories.py     #   /api/categories
│   ├── transactions.py   #   /api/transactions
│   ├── advisor.py         #   /api/advisor/* (AI chat sessions)
│   ├── ai.py               #   /api/ai/parse-transaction
│   ├── settings.py         #   /api/settings, /api/settings/unsubscribe
│   └── jobs.py              #   /api/jobs/weekly-emails
├── database.py         # Database initialization and connection helpers
├── requirements.txt    # Pinned Python dependencies
├── trackify.db         # SQLite Database (generated locally)
├── .env                # Local secrets/keys (ignored by Git)
├── .gitignore          # File specifying ignored items in Git
├── static/
│   ├── app.js          # Core frontend application logic
│   └── style.css       # Premium responsive design system
└── templates/
    └── index.html      # Dashboard layout and controls
```

---

## 🔒 Security & Privacy Reminder
Never commit or upload your `.env` file or local databases (`trackify.db`) to GitHub. These files are listed in `.gitignore` to keep your credentials and personal information private.
