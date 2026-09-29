from flask import Blueprint, request, jsonify, g

from helpers import require_auth, get_db, MAX_CATEGORY_NAME_LEN

bp = Blueprint('categories', __name__)


@bp.route('/api/categories', methods=['GET'])
@require_auth
def get_categories():
    conn = get_db()
    categories = conn.execute(
        'SELECT * FROM categories WHERE user_id IS NULL OR user_id = ? ORDER BY name ASC',
        (g.user_id,)
    ).fetchall()
    return jsonify([dict(c) for c in categories])


@bp.route('/api/categories', methods=['POST'])
@require_auth
def add_category():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    icon = data.get('icon', '📦').strip()
    color = data.get('color', '#ADB5BD').strip()

    if not name:
        return jsonify({'error': 'Category name is required.'}), 400
    if len(name) > MAX_CATEGORY_NAME_LEN:
        return jsonify({'error': f'Category name must be {MAX_CATEGORY_NAME_LEN} characters or fewer.'}), 400

    conn = get_db()
    # Check if already exists for this user or globally
    exists = conn.execute(
        'SELECT id FROM categories WHERE (user_id IS NULL OR user_id = ?) AND name = ?',
        (g.user_id, name)
    ).fetchone()
    if exists:
        return jsonify({'error': f'Category "{name}" already exists.'}), 400

    cursor = conn.execute(
        'INSERT INTO categories (name, icon, color, user_id) VALUES (?, ?, ?, ?)',
        (name, icon, color, g.user_id)
    )
    conn.commit()
    new_id = cursor.lastrowid
    return jsonify({'id': new_id, 'name': name, 'icon': icon, 'color': color}), 201


@bp.route('/api/categories/<int:c_id>', methods=['PUT'])
@require_auth
def update_category(c_id):
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    icon = data.get('icon', '📦').strip()
    color = data.get('color', '#ADB5BD').strip()

    if not name:
        return jsonify({'error': 'Category name is required.'}), 400
    if len(name) > MAX_CATEGORY_NAME_LEN:
        return jsonify({'error': f'Category name must be {MAX_CATEGORY_NAME_LEN} characters or fewer.'}), 400

    conn = get_db()
    old_cat = conn.execute('SELECT user_id, name FROM categories WHERE id = ?', (c_id,)).fetchone()
    if not old_cat:
        return jsonify({'error': 'Category not found.'}), 404

    if old_cat['user_id'] is None:
        return jsonify({'error': 'Default categories cannot be modified.'}), 403

    if old_cat['user_id'] != g.user_id:
        return jsonify({'error': 'Unauthorized.'}), 401

    old_name = old_cat['name']

    if old_name != name:
        exists = conn.execute(
            'SELECT id FROM categories WHERE (user_id IS NULL OR user_id = ?) AND name = ? AND id != ?',
            (g.user_id, name, c_id)
        ).fetchone()
        if exists:
            return jsonify({'error': f'Category "{name}" already exists.'}), 400

    conn.execute("PRAGMA foreign_keys = OFF;")
    try:
        conn.execute('''
            UPDATE categories
            SET name = ?, icon = ?, color = ?
            WHERE id = ? AND user_id = ?
        ''', (name, icon, color, c_id, g.user_id))

        if old_name != name:
            conn.execute('''
                UPDATE transactions
                SET category_name = ?
                WHERE category_name = ? AND user_id = ?
            ''', (name, old_name, g.user_id))

        conn.commit()
    finally:
        conn.execute("PRAGMA foreign_keys = ON;")

    return jsonify({'id': c_id, 'name': name, 'icon': icon, 'color': color})


@bp.route('/api/categories/<int:c_id>', methods=['DELETE'])
@require_auth
def delete_category(c_id):
    conn = get_db()
    cat = conn.execute('SELECT user_id, name FROM categories WHERE id = ?', (c_id,)).fetchone()
    if not cat:
        return jsonify({'error': 'Category not found.'}), 404

    if cat['user_id'] is None:
        return jsonify({'error': 'Default categories cannot be deleted.'}), 403

    if cat['user_id'] != g.user_id:
        return jsonify({'error': 'Unauthorized.'}), 401

    cat_name = cat['name']
    if cat_name == 'Miscellaneous':
        return jsonify({'error': 'The "Miscellaneous" category cannot be deleted.'}), 400

    misc_exists = conn.execute('SELECT id FROM categories WHERE name = "Miscellaneous" AND user_id IS NULL').fetchone()
    if not misc_exists:
        # Recreate global miscellaneous if needed
        conn.execute('INSERT INTO categories (name, icon, color, user_id) VALUES ("Miscellaneous", "📦", "#ADB5BD", NULL)')

    conn.execute("PRAGMA foreign_keys = OFF;")
    try:
        conn.execute('''
            UPDATE transactions
            SET category_name = "Miscellaneous"
            WHERE category_name = ? AND user_id = ?
        ''', (cat_name, g.user_id))

        conn.execute('DELETE FROM categories WHERE id = ? AND user_id = ?', (c_id, g.user_id))
        conn.commit()
    finally:
        conn.execute("PRAGMA foreign_keys = ON;")

    return jsonify({'success': True, 'message': f'Category "{cat_name}" deleted. Transactions reassigned to Miscellaneous.'})
