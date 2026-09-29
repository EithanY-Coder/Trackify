from flask import Blueprint, request, jsonify, g

from helpers import require_auth, get_db, MAX_TITLE_LEN

bp = Blueprint('goals', __name__)


@bp.route('/api/goals', methods=['GET'])
@require_auth
def get_goals():
    conn = get_db()
    goals = conn.execute(
        'SELECT * FROM goals WHERE user_id = ? ORDER BY id DESC',
        (g.user_id,)
    ).fetchall()
    return jsonify([dict(goal) for goal in goals])


@bp.route('/api/goals', methods=['POST'])
@require_auth
def add_goal():
    data = request.get_json() or {}
    title = data.get('title', '').strip()
    target_amount_raw = data.get('target_amount')
    deadline = data.get('deadline', '').strip()

    if not title:
        return jsonify({'error': 'Goal title is required.'}), 400
    if len(title) > MAX_TITLE_LEN:
        return jsonify({'error': f'Goal title must be {MAX_TITLE_LEN} characters or fewer.'}), 400
    if not deadline:
        return jsonify({'error': 'Deadline is required.'}), 400

    try:
        target_amount = float(target_amount_raw)
        if target_amount <= 0:
            return jsonify({'error': 'Target amount must be greater than zero.'}), 400
    except (ValueError, TypeError):
        return jsonify({'error': 'Target amount must be a number.'}), 400

    conn = get_db()
    cursor = conn.execute('''
        INSERT INTO goals (user_id, title, target_amount, saved_amount, deadline)
        VALUES (?, ?, ?, 0.0, ?)
    ''', (g.user_id, title, target_amount, deadline))
    conn.commit()
    new_id = cursor.lastrowid
    return jsonify({
        'id': new_id,
        'user_id': g.user_id,
        'title': title,
        'target_amount': target_amount,
        'saved_amount': 0.0,
        'deadline': deadline
    }), 201


@bp.route('/api/goals/<int:g_id>', methods=['PATCH'])
@require_auth
def update_goal(g_id):
    data = request.get_json() or {}

    conn = get_db()
    goal = conn.execute('SELECT * FROM goals WHERE id = ? AND user_id = ?', (g_id, g.user_id)).fetchone()
    if not goal:
        return jsonify({'error': 'Goal not found.'}), 404

    update_fields = []
    params = []

    if 'title' in data:
        title = data['title'].strip()
        if not title:
            return jsonify({'error': 'Goal title cannot be empty.'}), 400
        if len(title) > MAX_TITLE_LEN:
            return jsonify({'error': f'Goal title must be {MAX_TITLE_LEN} characters or fewer.'}), 400
        update_fields.append('title = ?')
        params.append(title)

    if 'target_amount' in data:
        try:
            target_val = float(data['target_amount'])
            if target_val <= 0:
                return jsonify({'error': 'Target amount must be greater than zero.'}), 400
            update_fields.append('target_amount = ?')
            params.append(target_val)
        except ValueError:
            return jsonify({'error': 'Target amount must be a number.'}), 400

    if 'saved_amount' in data:
        try:
            saved_val = float(data['saved_amount'])
            if saved_val < 0:
                return jsonify({'error': 'Saved amount cannot be negative.'}), 400
            update_fields.append('saved_amount = ?')
            params.append(saved_val)
        except ValueError:
            return jsonify({'error': 'Saved amount must be a number.'}), 400

    if 'deadline' in data:
        deadline = data['deadline'].strip()
        if not deadline:
            return jsonify({'error': 'Deadline cannot be empty.'}), 400
        update_fields.append('deadline = ?')
        params.append(deadline)

    if not update_fields:
        return jsonify({'error': 'No fields provided for update.'}), 400

    params.extend([g_id, g.user_id])
    query = f"UPDATE goals SET {', '.join(update_fields)} WHERE id = ? AND user_id = ?"
    conn.execute(query, params)
    conn.commit()

    updated_goal = conn.execute('SELECT * FROM goals WHERE id = ? AND user_id = ?', (g_id, g.user_id)).fetchone()
    return jsonify(dict(updated_goal))
