# pyrefly: ignore [missing-import] - Weekly recap generation + send job for Trackify
"""Builds and sends the weekly spending/goal recap email.

Design notes:

* Every function here takes an explicit sqlite3 connection instead of calling
  helpers.get_db(). The send job runs from cron - outside any request - where
  flask.g does not exist, so a request-scoped connection would blow up.
* Summary generation is kept separate from sending so it can be previewed and
  tested without touching the email provider.
* All user-supplied strings (category names, goal titles) are HTML-escaped
  before they reach the email body.
"""
import datetime
import html
from urllib.parse import urlencode

try:
    from zoneinfo import ZoneInfo  # Python 3.9+
except ImportError:  # pragma: no cover - very old runtimes
    ZoneInfo = None

import database
import emailer
import helpers

# Cap on how many times a failed send is retried on later runs, so a permanently
# bad address doesn't get retried forever.
MAX_SEND_ATTEMPTS = 3

TOP_CATEGORY_COUNT = 3


# ----------------- WEEK BOUNDS -----------------

def _resolve_timezone(tz_name):
    if ZoneInfo is None or not tz_name:
        return datetime.timezone.utc
    try:
        return ZoneInfo(tz_name)
    except Exception:
        # A user could have stored a timezone that this host's tz database
        # doesn't know. Falling back to UTC is better than skipping their email.
        return datetime.timezone.utc


def previous_week_bounds(tz_name='UTC', reference=None):
    """Returns (monday, sunday) date objects for the most recently *completed*
    week, evaluated in the user's own timezone.

    The job is meant to run on a Monday and summarize the week that just ended,
    so a run on Monday 2026-09-14 reports 2026-09-07 .. 2026-09-13.
    """
    tz = _resolve_timezone(tz_name)
    today = reference or datetime.datetime.now(tz).date()
    this_monday = today - datetime.timedelta(days=today.weekday())
    week_start = this_monday - datetime.timedelta(days=7)
    week_end = this_monday - datetime.timedelta(days=1)
    return week_start, week_end


# ----------------- SUMMARY GENERATION -----------------

def build_weekly_summary(conn, user_id, week_start, week_end):
    """Aggregates one user's week from the existing transactions/goals tables.

    Returns a plain dict. `has_content` is False when there is genuinely
    nothing to report - the caller uses that to avoid sending an empty email.
    """
    start_str = week_start.isoformat()
    end_str = week_end.isoformat()

    # `date` is stored as a YYYY-MM-DD string, which sorts lexicographically,
    # so a plain BETWEEN is both correct and index-friendly here.
    totals = conn.execute('''
        SELECT
            COALESCE(SUM(CASE WHEN type = 'expense' THEN amount END), 0) AS total_spent,
            COALESCE(SUM(CASE WHEN type = 'income' THEN amount END), 0) AS total_income,
            COUNT(*) AS transaction_count
        FROM transactions
        WHERE user_id = ? AND date BETWEEN ? AND ?
    ''', (user_id, start_str, end_str)).fetchone()

    total_spent = float(totals['total_spent'] or 0.0)
    total_income = float(totals['total_income'] or 0.0)
    transaction_count = int(totals['transaction_count'] or 0)

    category_rows = conn.execute('''
        SELECT category_name, SUM(amount) AS amount, COUNT(*) AS count
        FROM transactions
        WHERE user_id = ? AND type = 'expense' AND date BETWEEN ? AND ?
        GROUP BY category_name
        ORDER BY amount DESC
    ''', (user_id, start_str, end_str)).fetchall()

    categories = []
    for row in category_rows:
        amount = float(row['amount'] or 0.0)
        categories.append({
            'name': row['category_name'],
            'amount': amount,
            'count': int(row['count'] or 0),
            'percent': round((amount / total_spent) * 100, 1) if total_spent > 0 else 0.0,
        })

    # Active goal = not yet reached. Finished goals are dropped so the email
    # stays about what still needs work.
    goal_rows = conn.execute('''
        SELECT title, target_amount, saved_amount, deadline
        FROM goals
        WHERE user_id = ? AND saved_amount < target_amount
        ORDER BY deadline ASC
    ''', (user_id,)).fetchall()

    goals = []
    for row in goal_rows:
        target = float(row['target_amount'] or 0.0)
        saved = float(row['saved_amount'] or 0.0)
        remaining = max(target - saved, 0.0)
        percent = round((saved / target) * 100, 1) if target > 0 else 0.0
        goals.append({
            'title': row['title'],
            'target_amount': target,
            'saved_amount': saved,
            'remaining': remaining,
            'percent': min(percent, 100.0),
            'deadline': row['deadline'],
        })

    return {
        'week_start': start_str,
        'week_end': end_str,
        'total_spent': total_spent,
        'total_income': total_income,
        'net': total_income - total_spent,
        'transaction_count': transaction_count,
        'categories': categories,
        'top_categories': categories[:TOP_CATEGORY_COUNT],
        'goals': goals,
        'has_content': transaction_count > 0 or bool(goals),
    }


# ----------------- RENDERING -----------------

def _money(value):
    return f'${value:,.2f}'


def _pretty_date(date_str):
    try:
        parsed = datetime.date.fromisoformat(date_str)
        # Built by hand rather than with %-d, which isn't portable off glibc/BSD.
        return f'{parsed.strftime("%b")} {parsed.day}, {parsed.year}'
    except (ValueError, TypeError):
        return date_str


def build_unsubscribe_url(user_id):
    token = helpers.make_unsubscribe_token(user_id)
    query = urlencode({'uid': user_id, 'token': token})
    return f'{helpers.get_app_base_url()}/api/settings/unsubscribe?{query}'


def render_weekly_email_html(summary, unsubscribe_url):
    """Renders the recap as email-safe HTML (inline styles, table layout).

    Category names and goal titles are user-authored, so every interpolation of
    them goes through html.escape().
    """
    app_url = helpers.get_app_base_url()
    period = f"{_pretty_date(summary['week_start'])} - {_pretty_date(summary['week_end'])}"

    if summary['categories']:
        category_rows = ''.join(
            f'''<tr>
                  <td style="padding:10px 0;border-bottom:1px solid #eceff3;color:#1f2937;font-size:14px;">{html.escape(c['name'])}</td>
                  <td style="padding:10px 0;border-bottom:1px solid #eceff3;color:#6b7280;font-size:13px;text-align:right;">{c['percent']}%</td>
                  <td style="padding:10px 0 10px 16px;border-bottom:1px solid #eceff3;color:#1f2937;font-size:14px;font-weight:600;text-align:right;">{_money(c['amount'])}</td>
                </tr>'''
            for c in summary['categories']
        )
        category_block = f'''
          <h2 style="margin:32px 0 12px;font-size:16px;color:#111827;">Spending by category</h2>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">{category_rows}</table>'''
    else:
        category_block = '<p style="margin:32px 0 0;color:#6b7280;font-size:14px;">No expenses logged this week.</p>'

    if summary['top_categories']:
        top_items = ''.join(
            f'<li style="margin-bottom:6px;color:#374151;font-size:14px;">'
            f'<strong>{html.escape(c["name"])}</strong> - {_money(c["amount"])} ({c["percent"]}%)</li>'
            for c in summary['top_categories']
        )
        top_block = f'''
          <h2 style="margin:32px 0 12px;font-size:16px;color:#111827;">Top spending categories</h2>
          <ol style="margin:0;padding-left:20px;">{top_items}</ol>'''
    else:
        top_block = ''

    if summary['goals']:
        goal_cards = ''
        for goal in summary['goals']:
            bar_width = min(max(goal['percent'], 0), 100)
            goal_cards += f'''
              <div style="border:1px solid #e5e7eb;border-radius:10px;padding:16px;margin-bottom:12px;">
                <div style="font-size:15px;font-weight:600;color:#111827;margin-bottom:4px;">{html.escape(goal['title'])}</div>
                <div style="font-size:13px;color:#6b7280;margin-bottom:10px;">Due {html.escape(_pretty_date(goal['deadline']))}</div>
                <div style="background:#eef1f5;border-radius:999px;height:8px;overflow:hidden;margin-bottom:10px;">
                  <div style="background:#4f46e5;height:8px;width:{bar_width}%;"></div>
                </div>
                <div style="font-size:13px;color:#374151;">
                  {_money(goal['saved_amount'])} of {_money(goal['target_amount'])}
                  &nbsp;&middot;&nbsp; <strong>{goal['percent']}% complete</strong>
                  &nbsp;&middot;&nbsp; {_money(goal['remaining'])} to go
                </div>
              </div>'''
        goals_block = f'''
          <h2 style="margin:32px 0 12px;font-size:16px;color:#111827;">Your savings goals</h2>
          {goal_cards}'''
    else:
        goals_block = '<p style="margin:24px 0 0;color:#6b7280;font-size:14px;">You have no active savings goals right now.</p>'

    return f'''<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f8;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;padding:32px;">
        <tr><td>
          <div style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#6366f1;font-weight:700;">Trackify</div>
          <h1 style="margin:8px 0 4px;font-size:22px;color:#111827;">Your weekly recap</h1>
          <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">{html.escape(period)}</p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;padding:18px;">
            <tr>
              <td style="padding:6px 0;color:#6b7280;font-size:13px;">Total spent</td>
              <td style="padding:6px 0;color:#111827;font-size:18px;font-weight:700;text-align:right;">{_money(summary['total_spent'])}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;font-size:13px;">Total income</td>
              <td style="padding:6px 0;color:#111827;font-size:14px;text-align:right;">{_money(summary['total_income'])}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;font-size:13px;">Transactions logged</td>
              <td style="padding:6px 0;color:#111827;font-size:14px;text-align:right;">{summary['transaction_count']}</td>
            </tr>
          </table>

          {category_block}
          {top_block}
          {goals_block}

          <div style="margin-top:32px;text-align:center;">
            <a href="{html.escape(app_url)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:10px;">Open Trackify</a>
          </div>

          <hr style="border:none;border-top:1px solid #eceff3;margin:32px 0 16px;">
          <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
            You're getting this because weekly recap emails are on for your Trackify account.<br>
            <a href="{html.escape(unsubscribe_url)}" style="color:#6b7280;">Unsubscribe from weekly emails</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>'''


def render_weekly_email_text(summary, unsubscribe_url):
    """Plain-text alternative. Improves deliverability and serves text-only clients."""
    lines = [
        'TRACKIFY - YOUR WEEKLY RECAP',
        f"{_pretty_date(summary['week_start'])} - {_pretty_date(summary['week_end'])}",
        '',
        f"Total spent: {_money(summary['total_spent'])}",
        f"Total income: {_money(summary['total_income'])}",
        f"Transactions logged: {summary['transaction_count']}",
        '',
    ]

    if summary['categories']:
        lines.append('SPENDING BY CATEGORY')
        for c in summary['categories']:
            lines.append(f"  - {c['name']}: {_money(c['amount'])} ({c['percent']}%)")
        lines.append('')

    if summary['top_categories']:
        lines.append('TOP SPENDING CATEGORIES')
        for i, c in enumerate(summary['top_categories'], start=1):
            lines.append(f"  {i}. {c['name']} - {_money(c['amount'])} ({c['percent']}%)")
        lines.append('')

    if summary['goals']:
        lines.append('SAVINGS GOALS')
        for goal in summary['goals']:
            lines.append(f"  - {goal['title']} (due {_pretty_date(goal['deadline'])})")
            lines.append(
                f"      {_money(goal['saved_amount'])} of {_money(goal['target_amount'])}"
                f" - {goal['percent']}% complete, {_money(goal['remaining'])} to go"
            )
        lines.append('')
    else:
        lines.append('You have no active savings goals right now.')
        lines.append('')

    lines.append(f'Open Trackify: {helpers.get_app_base_url()}')
    lines.append(f'Unsubscribe from weekly emails: {unsubscribe_url}')
    return '\n'.join(lines)


# ----------------- SEND JOB -----------------

def _claim_send(conn, user_id, week_start_str):
    """Atomically reserves the (user, week) slot. Returns True if this process
    owns the send.

    The UNIQUE(user_id, week_start) constraint means only one caller can win,
    which is what prevents duplicate weekly emails when cron double-fires or
    several workers run the job at once. A previously *failed* send is allowed
    to be re-claimed, up to MAX_SEND_ATTEMPTS.
    """
    cursor = conn.execute('''
        INSERT INTO weekly_email_log (user_id, week_start, status, attempts)
        VALUES (?, ?, 'sending', 1)
        ON CONFLICT(user_id, week_start) DO UPDATE SET
            status = 'sending',
            attempts = weekly_email_log.attempts + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE weekly_email_log.status = 'failed'
          AND weekly_email_log.attempts < ?
    ''', (user_id, week_start_str, MAX_SEND_ATTEMPTS))
    conn.commit()
    return cursor.rowcount > 0


def _finish_send(conn, user_id, week_start_str, status, message_id=None, error=None):
    conn.execute('''
        UPDATE weekly_email_log
        SET status = ?, provider_message_id = ?, error = ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND week_start = ?
    ''', (status, message_id, (error or '')[:500] or None, user_id, week_start_str))
    conn.commit()


def _load_settings_map(conn):
    rows = conn.execute(
        'SELECT user_id, weekly_email_enabled, weekly_email_timezone FROM user_settings'
    ).fetchall()
    return {r['user_id']: r for r in rows}


def run_weekly_email_job(logger=None, dry_run=False, reference_date=None):
    """Sends the weekly recap to every eligible user. Safe to run repeatedly.

    Eligibility: email verified in Supabase, weekly emails enabled, not already
    sent for that week, and something worth reporting.

    Returns a stats dict; never raises for a single user's failure.
    """
    def log(level, message):
        if logger is not None:
            getattr(logger, level)(message)

    stats = {'considered': 0, 'sent': 0, 'skipped_disabled': 0, 'skipped_duplicate': 0,
             'skipped_empty': 0, 'failed': 0, 'dry_run': bool(dry_run)}

    if not dry_run and not emailer.is_configured():
        raise RuntimeError(
            'Email provider is not configured. Set WEEKLY_EMAIL_FROM and the API key '
            'for EMAIL_PROVIDER (RESEND_API_KEY or SENDGRID_API_KEY).'
        )
    # Fail fast rather than sending a batch of emails with broken unsubscribe links.
    helpers.ensure_unsubscribe_secret_configured()

    verified_users = helpers.fetch_verified_users()
    conn = database.get_db_connection()
    try:
        settings_map = _load_settings_map(conn)

        for user_id, email in verified_users.items():
            stats['considered'] += 1
            settings_row = settings_map.get(user_id)

            # No settings row means the user has never opened Settings. The
            # schema default (and the UI's default-checked toggle) is ON, so
            # treat absence as enabled to stay consistent with what the app shows.
            if settings_row is not None and not settings_row['weekly_email_enabled']:
                stats['skipped_disabled'] += 1
                continue

            tz_name = settings_row['weekly_email_timezone'] if settings_row is not None else 'UTC'
            week_start, week_end = previous_week_bounds(tz_name, reference=reference_date)
            week_start_str = week_start.isoformat()

            try:
                summary = build_weekly_summary(conn, user_id, week_start, week_end)
            except Exception as e:
                stats['failed'] += 1
                log('exception', f'Failed to build weekly summary for {user_id}: {type(e).__name__}')
                continue

            # Don't email someone with no transactions and no goals - there is
            # nothing to say, and it reads as spam.
            if not summary['has_content']:
                stats['skipped_empty'] += 1
                continue

            if dry_run:
                stats['sent'] += 1
                log('info', f'[dry-run] Would email {user_id} for week {week_start_str}.')
                continue

            if not _claim_send(conn, user_id, week_start_str):
                stats['skipped_duplicate'] += 1
                continue

            try:
                unsubscribe_url = build_unsubscribe_url(user_id)
                message_id = emailer.send_email(
                    to_email=email,
                    subject=f'Your Trackify weekly recap ({_pretty_date(week_start_str)} - {_pretty_date(week_end.isoformat())})',
                    html_body=render_weekly_email_html(summary, unsubscribe_url),
                    text_body=render_weekly_email_text(summary, unsubscribe_url),
                    # RFC 8058: lets Gmail/Apple Mail show a native one-click
                    # unsubscribe, which markedly improves inbox placement.
                    headers={
                        'List-Unsubscribe': f'<{unsubscribe_url}>',
                        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
                    },
                )
            except Exception as e:
                stats['failed'] += 1
                _finish_send(conn, user_id, week_start_str, 'failed', error=str(e))
                log('warning', f'Weekly email failed for {user_id}: {type(e).__name__}')
                continue

            _finish_send(conn, user_id, week_start_str, 'sent', message_id=message_id)
            stats['sent'] += 1
    finally:
        conn.close()

    log('info', f'Weekly email job finished: {stats}')
    return stats


def register_weekly_email_cli(app):
    """Exposes `flask --app app send-weekly-emails`, the entry point system cron
    and hosted schedulers call."""
    import click

    @app.cli.command('send-weekly-emails')
    @click.option('--dry-run', is_flag=True, help='Report who would be emailed without sending or logging anything.')
    def send_weekly_emails(dry_run):
        """Send the weekly spending recap to all eligible verified users."""
        try:
            stats = run_weekly_email_job(logger=app.logger, dry_run=dry_run)
        except Exception as e:
            raise SystemExit(f'Weekly email job aborted: {e}')
        click.echo(
            f"considered={stats['considered']} sent={stats['sent']} "
            f"disabled={stats['skipped_disabled']} duplicate={stats['skipped_duplicate']} "
            f"empty={stats['skipped_empty']} failed={stats['failed']}"
        )
