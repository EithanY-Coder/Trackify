from flask import Blueprint, request, jsonify, g

from helpers import require_auth, get_db, parse_transaction_payload, ensure_category

bp = Blueprint('transactions', __name__)


@bp.route('/api/transactions', methods=['GET'])
@require_auth
def get_transactions():
    conn = get_db()
    transactions = conn.execute(
        'SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, id DESC',
        (g.user_id,)
    ).fetchall()
    return jsonify([dict(t) for t in transactions])


@bp.route('/api/transactions', methods=['POST'])
@require_auth
def add_transaction():
    data = request.get_json() or {}
    parsed, error = parse_transaction_payload(data)
    if error:
        message, status = error
        return jsonify({'error': message}), status

    conn = get_db()
    # Check if category exists for this user or globally; create it if not
    canonical_name = ensure_category(
        conn, g.user_id, parsed['category_name'], parsed['category_icon'], parsed['category_color']
    )

    cursor = conn.execute('''
        INSERT INTO transactions (user_id, type, amount, description, category_name, date, hours_worked, hourly_wage, tax_rate, gross_amount)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        g.user_id, parsed['type'], parsed['amount'], parsed['description'], canonical_name, parsed['date'],
        parsed['hours_worked'], parsed['hourly_wage'], parsed['tax_rate'], parsed['gross_amount']
    ))
    conn.commit()
    new_id = cursor.lastrowid

    return jsonify({
        'id': new_id,
        'type': parsed['type'],
        'amount': parsed['amount'],
        'description': parsed['description'],
        'category_name': canonical_name,
        'date': parsed['date'],
        'hours_worked': parsed['hours_worked'],
        'hourly_wage': parsed['hourly_wage'],
        'tax_rate': parsed['tax_rate'],
        'gross_amount': parsed['gross_amount']
    }), 201


@bp.route('/api/transactions/<int:t_id>', methods=['DELETE'])
@require_auth
def delete_transaction(t_id):
    conn = get_db()
    exists = conn.execute('SELECT id FROM transactions WHERE id = ? AND user_id = ?', (t_id, g.user_id)).fetchone()
    if not exists:
        return jsonify({'error': 'Transaction not found.'}), 404

    conn.execute('DELETE FROM transactions WHERE id = ? AND user_id = ?', (t_id, g.user_id))
    conn.commit()
    return jsonify({'success': True, 'message': 'Transaction deleted.'})


@bp.route('/api/transactions/<int:t_id>', methods=['PUT'])
@require_auth
def update_transaction(t_id):
    data = request.get_json() or {}
    parsed, error = parse_transaction_payload(data)
    if error:
        message, status = error
        return jsonify({'error': message}), status

    conn = get_db()
    exists = conn.execute('SELECT id FROM transactions WHERE id = ? AND user_id = ?', (t_id, g.user_id)).fetchone()
    if not exists:
        return jsonify({'error': 'Transaction not found.'}), 404

    canonical_name = ensure_category(
        conn, g.user_id, parsed['category_name'], parsed['category_icon'], parsed['category_color']
    )

    conn.execute('''
        UPDATE transactions
        SET type = ?, amount = ?, description = ?, category_name = ?, date = ?,
            hours_worked = ?, hourly_wage = ?, tax_rate = ?, gross_amount = ?
        WHERE id = ? AND user_id = ?
    ''', (
        parsed['type'], parsed['amount'], parsed['description'], canonical_name, parsed['date'],
        parsed['hours_worked'], parsed['hourly_wage'], parsed['tax_rate'], parsed['gross_amount'],
        t_id, g.user_id
    ))
    conn.commit()

    return jsonify({
        'id': t_id,
        'type': parsed['type'],
        'amount': parsed['amount'],
        'description': parsed['description'],
        'category_name': canonical_name,
        'date': parsed['date'],
        'hours_worked': parsed['hours_worked'],
        'hourly_wage': parsed['hourly_wage'],
        'tax_rate': parsed['tax_rate'],
        'gross_amount': parsed['gross_amount']
    })
