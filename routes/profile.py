from flask import Blueprint, jsonify, request, g

from helpers import require_auth, get_db, limiter, get_user_profile, parse_profile_payload

bp = Blueprint('profile', __name__)


@bp.route('/api/profile', methods=['GET'])
@require_auth
def get_profile():
    return jsonify({'profile': get_user_profile(g.user_id)})


@bp.route('/api/profile', methods=['PUT'])
@require_auth
@limiter.limit("10 per minute")
def update_profile():
    data = request.get_json(silent=True) or {}
    parsed, err = parse_profile_payload(data)
    if err:
        return jsonify({'error': err[0]}), err[1]

    conn = get_db()
    conn.execute(
        '''
        INSERT INTO user_profiles (user_id, first_name, last_name, life_stage, savings_goal, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id)
        DO UPDATE SET first_name = excluded.first_name,
                      last_name = excluded.last_name,
                      life_stage = excluded.life_stage,
                      savings_goal = excluded.savings_goal,
                      updated_at = CURRENT_TIMESTAMP
        ''',
        (g.user_id, parsed['first_name'], parsed['last_name'], parsed['life_stage'], parsed['savings_goal'])
    )
    conn.commit()
    return jsonify({'profile': get_user_profile(g.user_id)})
