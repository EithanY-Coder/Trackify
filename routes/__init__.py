from .auth import bp as auth_bp
from .categories import bp as categories_bp
from .transactions import bp as transactions_bp
from .goals import bp as goals_bp
from .advisor import bp as advisor_bp
from .ai import bp as ai_bp
from .settings import bp as settings_bp
from .jobs import bp as jobs_bp


def register_blueprints(app):
    app.register_blueprint(auth_bp)
    app.register_blueprint(categories_bp)
    app.register_blueprint(transactions_bp)
    app.register_blueprint(goals_bp)
    app.register_blueprint(advisor_bp)
    app.register_blueprint(ai_bp)
    app.register_blueprint(settings_bp)
    app.register_blueprint(jobs_bp)
