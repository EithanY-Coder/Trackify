import html

from flask import Blueprint, jsonify, request, g

from database import NOW_SQL
from helpers import require_auth, get_db, limiter, verify_unsubscribe_token

bp = Blueprint('settings', __name__)


@bp.route('/api/settings', methods=['GET'])
@require_auth
def get_settings():
    conn = get_db()
    row = conn.execute(
        'SELECT weekly_email_enabled, weekly_email_timezone FROM user_settings WHERE user_id = %s',
        (g.user_id,)
    ).fetchone()

    if row is None:
        conn.execute(
            'INSERT INTO user_settings (user_id, weekly_email_enabled, weekly_email_timezone) VALUES (%s, %s, %s)',
            (g.user_id, 1, 'UTC')
        )
        conn.commit()
        row = conn.execute(
            'SELECT weekly_email_enabled, weekly_email_timezone FROM user_settings WHERE user_id = %s',
            (g.user_id,)
        ).fetchone()

    return jsonify({
        'user_id': g.user_id,
        'weekly_email_enabled': bool(row['weekly_email_enabled']),
        'weekly_email_timezone': row['weekly_email_timezone']
    })


@bp.route('/api/settings', methods=['PUT'])
@require_auth
def update_settings():
    data = request.get_json(silent=True) or {}
    enabled = data.get('weekly_email_enabled', True)
    timezone_name = (data.get('weekly_email_timezone') or 'UTC').strip() or 'UTC'

    if not isinstance(enabled, bool):
        return jsonify({'error': 'weekly_email_enabled must be a boolean.'}), 400

    conn = get_db()
    conn.execute(
        f'''
        INSERT INTO user_settings (user_id, weekly_email_enabled, weekly_email_timezone, updated_at)
        VALUES (%s, %s, %s, {NOW_SQL})
        ON CONFLICT(user_id)
        DO UPDATE SET weekly_email_enabled = excluded.weekly_email_enabled,
                      weekly_email_timezone = excluded.weekly_email_timezone,
                      updated_at = {NOW_SQL}
        ''',
        (g.user_id, int(enabled), timezone_name)
    )
    conn.commit()

    return jsonify({
        'user_id': g.user_id,
        'weekly_email_enabled': enabled,
        'weekly_email_timezone': timezone_name
    })


# ----------------- UNSUBSCRIBE (public, token-authenticated) -----------------

# These two routes are deliberately NOT behind @require_auth: they're opened
# from an email client, where there is no Supabase session. Authorization comes
# from the HMAC token in the link instead (see helpers.make_unsubscribe_token).

_PAGE_TEMPLATE = """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Trackify - Weekly emails</title>
</head>
<body style="margin:0;background:#f5f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:460px;margin:12vh auto;background:#fff;border-radius:14px;padding:32px;text-align:center;">
    <div style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#6366f1;font-weight:700;">Trackify</div>
    <h1 style="margin:10px 0 8px;font-size:20px;color:#111827;">{heading}</h1>
    <p style="margin:0 0 22px;color:#6b7280;font-size:14px;line-height:1.6;">{body}</p>
    {action}
  </div>
</body>
</html>"""


def _render_page(heading, body, action='', status=200):
    page = _PAGE_TEMPLATE.format(heading=html.escape(heading), body=html.escape(body), action=action)
    return page, status, {'Content-Type': 'text/html; charset=utf-8'}


def _set_weekly_email_enabled(user_id, enabled):
    conn = get_db()
    conn.execute(
        f'''
        INSERT INTO user_settings (user_id, weekly_email_enabled, updated_at)
        VALUES (%s, %s, {NOW_SQL})
        ON CONFLICT(user_id)
        DO UPDATE SET weekly_email_enabled = excluded.weekly_email_enabled,
                      updated_at = {NOW_SQL}
        ''',
        (user_id, int(enabled))
    )
    conn.commit()


@bp.route('/api/settings/unsubscribe', methods=['GET'])
@limiter.limit("30 per hour")
def unsubscribe_confirm():
    """Shows a confirmation page with a POST button.

    This intentionally does NOT unsubscribe on GET. Mail scanners and link
    previewers routinely fetch every URL in a message, which would silently
    opt people out of emails they never chose to leave.
    """
    user_id = (request.args.get('uid') or '').strip()
    token = (request.args.get('token') or '').strip()

    if not verify_unsubscribe_token(user_id, token):
        return _render_page(
            'Link not valid',
            'This unsubscribe link is invalid or has expired. You can turn weekly '
            'emails off any time from the Settings tab in Trackify.',
            status=400
        )

    action = (
        '<form method="POST" action="/api/settings/unsubscribe">'
        f'<input type="hidden" name="uid" value="{html.escape(user_id)}">'
        f'<input type="hidden" name="token" value="{html.escape(token)}">'
        '<button type="submit" style="background:#4f46e5;color:#fff;border:none;font-size:14px;'
        'font-weight:600;padding:12px 28px;border-radius:10px;cursor:pointer;">'
        'Turn off weekly emails</button></form>'
    )
    return _render_page(
        'Unsubscribe from weekly emails?',
        'You will stop receiving the weekly spending recap. Your account and data are not affected.',
        action=action
    )


@bp.route('/api/settings/unsubscribe', methods=['POST'])
@limiter.limit("30 per hour")
def unsubscribe_submit():
    """Performs the opt-out.

    Handles both the confirmation form above (form-encoded body) and RFC 8058
    one-click unsubscribe from Gmail/Apple Mail, which POSTs to the
    List-Unsubscribe URL with the ids still in the query string.
    """
    user_id = (request.form.get('uid') or request.args.get('uid') or '').strip()
    token = (request.form.get('token') or request.args.get('token') or '').strip()

    if not verify_unsubscribe_token(user_id, token):
        return _render_page(
            'Link not valid',
            'This unsubscribe link is invalid or has expired. You can turn weekly '
            'emails off any time from the Settings tab in Trackify.',
            status=400
        )

    _set_weekly_email_enabled(user_id, False)
    return _render_page(
        'You are unsubscribed',
        'You will no longer receive weekly recap emails. You can turn them back on '
        'from the Settings tab in Trackify whenever you like.'
    )
