import hmac
import os

from flask import Blueprint, jsonify, request, current_app

from helpers import limiter
from weekly_summary import run_weekly_email_job

bp = Blueprint('jobs', __name__)


@bp.route('/api/jobs/weekly-emails', methods=['POST'])
@limiter.limit("12 per hour")
def trigger_weekly_emails():
    """Scheduler entry point for the weekly recap.

    Not a user-facing route: it's called by an external scheduler (system cron,
    Render/Railway cron, GitHub Actions) and authenticated with a shared secret
    header rather than a Supabase JWT, since no user is involved.

    Triggering this more than once a week is harmless - the send log dedupes.
    """
    expected = os.environ.get('CRON_SECRET', '').strip()
    if not expected:
        current_app.logger.error('Weekly email job triggered but CRON_SECRET is not configured.')
        return jsonify({'error': 'Job endpoint is not configured.'}), 503

    provided = (request.headers.get('X-Cron-Secret') or '').strip()
    # Constant-time compare so the secret can't be recovered by timing.
    if not provided or not hmac.compare_digest(expected, provided):
        current_app.logger.warning('Weekly email job rejected: bad or missing X-Cron-Secret.')
        return jsonify({'error': 'Unauthorized.'}), 401

    dry_run = (request.args.get('dry_run', '').strip().lower() == 'true')

    try:
        stats = run_weekly_email_job(logger=current_app.logger, dry_run=dry_run)
    except RuntimeError as e:
        # Configuration problems (missing provider key, unreachable Supabase
        # admin API) - surfaced to the caller so a failing cron run is visible.
        current_app.logger.error(f'Weekly email job aborted: {e}')
        return jsonify({'error': str(e)}), 500

    return jsonify(stats)
