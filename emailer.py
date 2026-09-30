# pyrefly: ignore [missing-import] - Transactional email delivery for Trackify
"""Backend-only transactional email sending.

Supports Resend (default) and SendGrid behind one `send_email()` call, so the
provider can be swapped with an env var instead of a code change. Credentials
are read lazily from the environment on every send - never hardcoded, never
exposed to the browser.

Uses `requests` directly (already a project dependency, same as routes/ai.py)
rather than pulling in a provider SDK.
"""
import os
import requests

# Providers occasionally hang; without a timeout a stalled connection would
# block the whole weekly job. Tuple is (connect, read) seconds.
_HTTP_TIMEOUT = (10, 20)

_RESEND_ENDPOINT = 'https://api.resend.com/emails'
_SENDGRID_ENDPOINT = 'https://api.sendgrid.com/v3/mail/send'


class EmailError(Exception):
    """Raised when an email could not be handed off to the provider.

    The message is safe to log but is never returned to an end user - it can
    contain provider diagnostics.
    """


class EmailNotConfigured(EmailError):
    """Raised when the provider credentials/sender are missing entirely."""


def _env(name, default=''):
    # Mirrors routes/ai.py's key handling: users commonly paste keys into .env
    # wrapped in quotes, which would otherwise be sent verbatim and 401.
    return os.environ.get(name, default).strip().strip('"').strip("'")


def get_provider():
    return (_env('EMAIL_PROVIDER') or 'resend').lower()


def get_from_address():
    return _env('WEEKLY_EMAIL_FROM')


def is_configured():
    """True when this process has everything it needs to actually send.

    Checked before the weekly job starts so a misconfigured deploy fails loudly
    once, instead of marking every user as a failed send.
    """
    if not get_from_address():
        return False
    provider = get_provider()
    if provider == 'resend':
        return bool(_env('RESEND_API_KEY'))
    if provider == 'sendgrid':
        return bool(_env('SENDGRID_API_KEY'))
    return False


def _post(url, api_key, payload):
    try:
        return requests.post(
            url,
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json',
            },
            json=payload,
            timeout=_HTTP_TIMEOUT,
        )
    except requests.RequestException as e:
        # Deliberately not including the exception's repr, which can echo the
        # request headers (and therefore the API key) on some urllib3 versions.
        raise EmailError(f'Email provider request failed: {type(e).__name__}') from None


def _send_resend(to_email, subject, html_body, text_body, headers):
    api_key = _env('RESEND_API_KEY')
    if not api_key:
        raise EmailNotConfigured('RESEND_API_KEY is not configured.')

    payload = {
        'from': get_from_address(),
        'to': [to_email],
        'subject': subject,
        'html': html_body,
        'text': text_body,
    }
    if headers:
        payload['headers'] = headers

    response = _post(_RESEND_ENDPOINT, api_key, payload)
    if response.status_code >= 400:
        raise EmailError(f'Resend rejected the message ({response.status_code}): {response.text[:300]}')

    try:
        return (response.json() or {}).get('id')
    except ValueError:
        return None


def _send_sendgrid(to_email, subject, html_body, text_body, headers):
    api_key = _env('SENDGRID_API_KEY')
    if not api_key:
        raise EmailNotConfigured('SENDGRID_API_KEY is not configured.')

    payload = {
        'personalizations': [{'to': [{'email': to_email}]}],
        'from': {'email': get_from_address()},
        'subject': subject,
        # SendGrid requires text/plain to come before text/html.
        'content': [
            {'type': 'text/plain', 'value': text_body},
            {'type': 'text/html', 'value': html_body},
        ],
    }
    if headers:
        payload['headers'] = headers

    response = _post(_SENDGRID_ENDPOINT, api_key, payload)
    if response.status_code >= 400:
        raise EmailError(f'SendGrid rejected the message ({response.status_code}): {response.text[:300]}')

    return response.headers.get('X-Message-Id')


def send_email(to_email, subject, html_body, text_body, headers=None):
    """Sends one transactional email. Returns the provider message id (or None).

    Raises EmailError / EmailNotConfigured on failure - callers are expected to
    catch it so one bad recipient can't abort a batch.
    """
    to_email = (to_email or '').strip()
    if not to_email:
        raise EmailError('Recipient address is empty.')
    if not get_from_address():
        raise EmailNotConfigured('WEEKLY_EMAIL_FROM is not configured.')

    provider = get_provider()
    if provider == 'resend':
        return _send_resend(to_email, subject, html_body, text_body, headers)
    if provider == 'sendgrid':
        return _send_sendgrid(to_email, subject, html_body, text_body, headers)
    raise EmailNotConfigured(f"Unknown EMAIL_PROVIDER '{provider}'. Use 'resend' or 'sendgrid'.")
