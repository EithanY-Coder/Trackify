import os

from flask import Blueprint, request, jsonify, g
from google import genai
from google.genai import types

from helpers import require_auth, get_db, limiter, get_user_financial_profile

bp = Blueprint('advisor', __name__)


# ---- Session Management ----

@bp.route('/api/advisor/sessions', methods=['GET'])
@require_auth
def list_advisor_sessions():
    conn = get_db()
    sessions = conn.execute('''
        SELECT s.id, s.title, s.created_at, s.updated_at,
               COUNT(m.id) as message_count
        FROM chat_sessions s
        LEFT JOIN chat_messages m ON m.session_id = s.id
        WHERE s.user_id = ?
        GROUP BY s.id
        ORDER BY s.updated_at DESC
    ''', (g.user_id,)).fetchall()
    return jsonify([dict(s) for s in sessions])


@bp.route('/api/advisor/sessions', methods=['POST'])
@require_auth
def create_advisor_session():
    data = request.get_json() or {}
    title = data.get('title', 'New Chat').strip() or 'New Chat'
    conn = get_db()
    cursor = conn.execute(
        "INSERT INTO chat_sessions (user_id, title) VALUES (?, ?)",
        (g.user_id, title)
    )
    conn.commit()
    session_id = cursor.lastrowid
    session = conn.execute('SELECT * FROM chat_sessions WHERE id = ?', (session_id,)).fetchone()
    return jsonify(dict(session)), 201


@bp.route('/api/advisor/sessions/<int:session_id>', methods=['PATCH'])
@require_auth
def rename_advisor_session(session_id):
    data = request.get_json() or {}
    title = data.get('title', '').strip()
    if not title:
        return jsonify({'error': 'Title is required.'}), 400
    conn = get_db()
    result = conn.execute(
        "UPDATE chat_sessions SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
        (title, session_id, g.user_id)
    )
    conn.commit()
    if result.rowcount == 0:
        return jsonify({'error': 'Session not found.'}), 404
    return jsonify({'success': True, 'title': title})


@bp.route('/api/advisor/sessions/<int:session_id>', methods=['DELETE'])
@require_auth
def delete_advisor_session(session_id):
    conn = get_db()
    # Cascade delete handled by FK; also delete messages explicitly for safety
    conn.execute('DELETE FROM chat_messages WHERE session_id = ? AND user_id = ?', (session_id, g.user_id))
    result = conn.execute('DELETE FROM chat_sessions WHERE id = ? AND user_id = ?', (session_id, g.user_id))
    conn.commit()
    if result.rowcount == 0:
        return jsonify({'error': 'Session not found.'}), 404
    return jsonify({'success': True})


# ---- Chat (session-scoped) ----

@bp.route('/api/advisor/chat', methods=['POST'])
@require_auth
@limiter.limit("5 per minute")
def advisor_chat():
    api_key = os.environ.get('GEMINI_API_KEY')
    if api_key:
        api_key = api_key.strip().strip('"').strip("'")
    if not api_key:
        return jsonify({
            'error': 'Gemini API key is not configured. Please add a `GEMINI_API_KEY=your_key` line to your `.env` file.'
        }), 400

    data = request.get_json() or {}
    message = data.get('message', '').strip()
    session_id = data.get('session_id')

    if not message:
        return jsonify({'error': 'Message content is required.'}), 400
    if not session_id:
        return jsonify({'error': 'session_id is required.'}), 400

    conn = get_db()
    # Verify session belongs to user
    session = conn.execute(
        'SELECT * FROM chat_sessions WHERE id = ? AND user_id = ?', (session_id, g.user_id)
    ).fetchone()
    if not session:
        return jsonify({'error': 'Session not found.'}), 404

    # 1. Fetch live financial snapshot
    financial_profile = get_user_financial_profile(g.user_id)

    # 2. Get last 15 messages for this session
    history_rows = conn.execute('''
        SELECT role, content FROM chat_messages
        WHERE user_id = ? AND session_id = ?
        ORDER BY created_at ASC, id ASC
        LIMIT 15
    ''', (g.user_id, session_id)).fetchall()

    # 3. Format history for Google GenAI SDK
    contents = []
    for row in history_rows:
        contents.append(
            types.Content(
                role=row['role'],
                parts=[types.Part.from_text(text=row['content'])]
            )
        )
    contents.append(
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=message)]
        )
    )

    # 4. System prompt
    system_instruction = f"""You are 'Trackify Advisor', a sharp, empathetic, and encouraging personal financial coach for teens and students.

CRITICAL FORMATTING RULES:
1. NEVER use markdown formatting. Do NOT output asterisks (such as '**' for bolding or '*' for lists), hashes, or markdown bullet symbols.
2. Use clean, plain text with double newlines between paragraphs for spacing.
3. Keep responses extremely concise (maximum 3-4 sentences total), organized, and highly practical.
4. For lists, use simple numbers (1., 2., 3.) or clean emojis (like 📌, 💡, 💵) with plain text spacing.

Base all your advice on the user's real-time financial profile provided below. Help them set realistic goals, break down weekly savings targets, celebrate progress, and politely highlight areas where they can cut back.

{financial_profile}"""

    config = types.GenerateContentConfig(system_instruction=system_instruction)

    # 5. Call Gemini (its own try/except: external-API failures get a
    # specific, non-leaky message instead of falling through to the
    # generic 500 handler)
    # http_options timeout is required here: this SDK call had no timeout at
    # all, found by observing a real chat request hang indefinitely with no
    # error, no rate-limit info, nothing - just a typing indicator stuck
    # forever. /api/ai/parse-transaction already sets one on its raw
    # requests.post call; this is the same fix for the SDK-based call.
    try:
        client = genai.Client(api_key=api_key, http_options=types.HttpOptions(timeout=30000))
        response = client.models.generate_content(
            model='gemini-3.6-flash',
            contents=contents,
            config=config
        )
        reply_text = response.text or ""
    except Exception as e:
        return jsonify({'error': f'Failed to process with AI: {str(e)}'}), 500

    reply_text = reply_text.replace('**', '').replace('###', '').replace('##', '')
    reply_text = reply_text.replace('\n* ', '\n• ').replace('\n- ', '\n• ')

    # 6. Save messages
    conn.execute(
        'INSERT INTO chat_messages (user_id, session_id, role, content) VALUES (?, ?, \'user\', ?)',
        (g.user_id, session_id, message)
    )
    conn.execute(
        'INSERT INTO chat_messages (user_id, session_id, role, content) VALUES (?, ?, \'model\', ?)',
        (g.user_id, session_id, reply_text)
    )

    # 7. Auto-name session on first message
    if session['title'] == 'New Chat':
        auto_title = message[:45] + ('…' if len(message) > 45 else '')
        conn.execute(
            'UPDATE chat_sessions SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            (auto_title, session_id)
        )
    else:
        conn.execute(
            'UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            (session_id,)
        )

    conn.commit()
    return jsonify({'reply': reply_text})


@bp.route('/api/advisor/history', methods=['GET'])
@require_auth
def get_advisor_history():
    session_id = request.args.get('session_id')
    conn = get_db()
    if session_id:
        history = conn.execute('''
            SELECT role, content, created_at FROM chat_messages
            WHERE user_id = ? AND session_id = ?
            ORDER BY created_at ASC, id ASC
        ''', (g.user_id, session_id)).fetchall()
    else:
        # Fallback: return empty (sessions are now mandatory)
        history = []
    return jsonify([dict(h) for h in history])


@bp.route('/api/advisor/history', methods=['DELETE'])
@require_auth
def delete_advisor_history():
    """Clear messages for a specific session (kept for backward compat with drawer)."""
    session_id = request.args.get('session_id')
    conn = get_db()
    if session_id:
        conn.execute('DELETE FROM chat_messages WHERE user_id = ? AND session_id = ?', (g.user_id, session_id))
    else:
        conn.execute('DELETE FROM chat_messages WHERE user_id = ?', (g.user_id,))
    conn.commit()
    return jsonify({'success': True, 'message': 'Conversation history cleared.'})
