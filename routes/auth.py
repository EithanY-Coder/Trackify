from flask import Blueprint, jsonify

from helpers import get_auth_user

bp = Blueprint('auth', __name__)


@bp.route('/api/auth/status', methods=['GET'])
def auth_status():
    user_id = get_auth_user()
    if user_id:
        return jsonify({
            'authenticated': True,
            'user': {'id': user_id}
        })
    return jsonify({'authenticated': False})
