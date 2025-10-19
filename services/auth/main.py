import logging
import os
from datetime import timedelta

import bcrypt
from dotenv import load_dotenv
from flask import Blueprint, Flask, jsonify, make_response, request
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    create_refresh_token,
    get_csrf_token,
    get_jwt_identity,
    jwt_required,
    set_refresh_cookies,
    unset_jwt_cookies,
)
from supabase import Client, create_client

load_dotenv()

ENV = os.getenv('ENV')

# Configure logging
logger = logging.getLogger(__name__)
log_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger.setLevel(logging.DEBUG if ENV != 'production' else logging.INFO)

stream_handler = logging.StreamHandler()
stream_handler.setFormatter(log_formatter)
file_handler = logging.FileHandler('log/auth_service.log')
file_handler.setFormatter(log_formatter)
logger.addHandler(stream_handler)
logger.addHandler(file_handler)

# Configure Supabase
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)

app = Flask(__name__)

# Configure JWT
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'dev-secret')
app.config["JWT_COOKIE_CSRF_PROTECT"] = True
app.config["JWT_TOKEN_LOCATION"] = ["headers", "cookies"]
app.config["JWT_COOKIE_SECURE"] = True if ENV == 'production' else False
app.config["JWT_COOKIE_SAMESITE"] = "Lax"
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(minutes=20)  # TTL 20 min
app.config["JWT_REFRESH_TOKEN_EXPIRES"] = timedelta(days=10)  # TTL 10 days

CORS(app, supports_credentials=True)
JWTManager(app)


# Create a blueprint with /auth prefix
auth_bp = Blueprint('auth', __name__, url_prefix='/auth')


@auth_bp.route('/register', methods=['POST'])
def register():
    try:
        data = request.json
        email = data.get('email')
        password = data.get('password')
        name = data.get('name', '')

        hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode(
            'utf-8'
        )

        user = {'email': email, 'encrypted_password': hashed, 'name': name}

        res = supabase.table('users').insert(user).execute()
        logger.info('Successfully registered new user %s with email %s', name, email)
        return jsonify({'message': 'User registered', 'id': res.data[0]['id']}), 201
    except Exception as e:
        logger.error(
            'Error during user registration for email %s: %s', email, str(e)
        )
        return jsonify({'error': 'Registration failed'}), 500


@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.json
        email = data.get('email')
        password = data.get('password')

        res = supabase.table('users').select('*').eq('email', email).execute()
        if not res.data:
            return jsonify({'error': 'Email Not Found'}), 404

        user = res.data[0]
        user_id = user['id']
        if not bcrypt.checkpw(
            password.encode('utf-8'), user['encrypted_password'].encode('utf-8')
        ):
            return jsonify({'error': 'Invalid password'}), 401

        access_token = create_access_token(identity=user_id)
        refresh_token = create_refresh_token(identity=user_id)

        response = make_response(
            jsonify(
                {
                    'access_token': access_token,
                    'user_id': user_id,
                }
            )
        )
        response.set_cookie(
            'csrf_refresh_token',
            get_csrf_token(refresh_token),
            httponly=False,
        )
        set_refresh_cookies(response, refresh_token)
        logger.info(f'User login successfully as {user_id} with email {email}')
        return response
    except Exception as e:
        logger.error('Exception during login for user id %s: %s', user_id, str(e))
        return jsonify({'error': 'Login failed'}), 500


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    try:
        user_id = get_jwt_identity()
        access_token = create_access_token(
            identity=user_id, expires_delta=timedelta(minutes=15)
        )
        logger.info(f'Token refresh for user id {user_id}')
        return jsonify({'access_token': access_token})
    except Exception as e:
        logger.error('Failed to refresh token for user id %s: %s', user_id, str(e))
        return jsonify({'error': 'Refresh token exception'}), 500


@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    try:
        user_id = get_jwt_identity()
        response = jsonify({"message": "Logout successfully, token unset."})
        unset_jwt_cookies(response)
        logger.info(f'User logout successfully as {user_id}')
        return response
    except Exception as e:
        logger.error('Failed to logout user id %s: %s', user_id, str(e))
        return jsonify({'error': 'Logout failed'}), 500


@auth_bp.route('/me')
@jwt_required()
def me():
    try:
        user_id = get_jwt_identity()
        logger.info(f'Validated user identity for user id: {user_id}')
        return jsonify({'user_id': user_id})
    except Exception as e:
        logger.error(
            'Failed to validate user identity for user id %s: %s', user_id, str(e)
        )


# Register the blueprint with the app
app.register_blueprint(auth_bp)


if __name__ == '__main__':
    PORT = os.getenv('PORT') or 5566
    DEBUG = False if ENV == 'production' else True
    app.run(
        host='0.0.0.0',
        port=PORT,
        load_dotenv=True,
        debug=DEBUG,
    )
