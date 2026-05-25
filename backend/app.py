from flask import Flask
from flask_cors import CORS

from config import Config
from extensions import db, socketio
from routes import api
 

def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)

    CORS(app, resources={r"/api/*": {"origins": Config.CORS_ORIGINS}})

    db.init_app(app)
    socketio.init_app(app, cors_allowed_origins=Config.CORS_ORIGINS)

    app.register_blueprint(api)

    # register socket handlers
    import sockets  # noqa: F401

    with app.app_context():
        db.create_all()

    return app


app = create_app()


if __name__ == "__main__":
    socketio.run(
        app,
        host="0.0.0.0",
        port=Config.PORT,
        debug=True,
        allow_unsafe_werkzeug=True,
    )
