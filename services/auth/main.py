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
    get_jwt_identity,
    jwt_required,
    set_refresh_cookies,
    unset_jwt_cookies,
)
from supabase import Client, create_client

load_dotenv()

ENV = os.getenv('ENV')

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)

app = Flask(__name__)
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'dev-secret')
app.config["JWT_TOKEN_LOCATION"] = ["headers", "cookies"]
app.config["JWT_COOKIE_SECURE"] = True if ENV == 'production' else False
app.config["JWT_COOKIE_SAMESITE"] = "None"
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(minutes=20)  # TTL 20 min
app.config["JWT_REFRESH_TOKEN_EXPIRES"] = timedelta(days=10)  # TTL 10 days
CORS(app, supports_credentials=True)

jwt = JWTManager(app)


# Create a blueprint with /auth prefix
auth_bp = Blueprint('auth', __name__, url_prefix='/auth')


@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    name = data.get('name', '')

    hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    user = {'email': email, 'encrypted_password': hashed, 'name': name}

    res = supabase.table('users').insert(user).execute()
    return jsonify({'message': 'User registered', 'id': res.data[0]['id']}), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')

    res = supabase.table('users').select('*').eq('email', email).execute()
    if not res.data:
        return jsonify({'error': 'Email Not Found'}), 404

    user = res.data[0]
    if not bcrypt.checkpw(
        password.encode('utf-8'), user['encrypted_password'].encode('utf-8')
    ):
        return jsonify({'error': 'Invalid password'}), 401

    access_token = create_access_token(identity=user['id'])
    refresh_token = create_refresh_token(identity=user['id'])

    response = make_response(
        jsonify({'access_token': access_token, 'user_id': user['id']})
    )
    set_refresh_cookies(response, refresh_token)
    return response


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    user_id = get_jwt_identity()
    access_token = create_access_token(identity=user_id)
    return jsonify({'access_token': access_token})


@auth_bp.route('/logout', methods=['POST'])
def logout():
    response = jsonify({"message": "Logout successfully, token unset."})
    unset_jwt_cookies(response)
    return response


@auth_bp.route('/me')
@jwt_required()
def me():
    user_id = get_jwt_identity()
    return jsonify({'user_id': user_id})


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
