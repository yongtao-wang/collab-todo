from marshmallow import Schema, ValidationError, fields, validates


class RegisterSchema(Schema):
    """
    Schema for validating user registration requests.

    Validates and deserializes JSON input for creating new user accounts.
    Enforces email format, password requirements, and provides optional name field.

    Attributes:
        email (fields.Email): User's email address (required, must be valid email format).
        password (fields.Str): User's password (required, min 6 characters).
        name (fields.Str): User's display name (optional, defaults to empty string).

    Raises:
        ValidationError: If validation fails for any field.

    Example:
        >>> schema = RegisterSchema()
        >>> data = schema.load({"email": "user@example.com", "password": "secret123", "name": "John"})
        >>> print(data)
        {'email': 'user@example.com', 'password': 'secret123', 'name': 'John'}
    """

    email = fields.Email(
        required=True, error_messages={'required': 'Email is required'}
    )
    password = fields.Str(required=True)
    name = fields.Str(load_default='')

    @validates('password')
    def validate_password(self, value, **kwargs):
        """
        Validate password meets minimum security requirements.

        Currently enforces a minimum length of 6 characters. Additional
        complexity requirements (uppercase, lowercase, numbers) are disabled
        for simplification but can be re-enabled.

        Args:
            value (str): The password to validate.
            **kwargs: Additional keyword arguments (unused).

        Raises:
            ValidationError: If password is less than 6 characters.

        Note:
            Bcrypt has a maximum password length of 72 bytes. Frontend
            validation should enforce this limit.
        """
        if len(value) < 6:
            raise ValidationError('Password must be at least 6 characters')
        # -- disabled for simplification --
        # if not re.search(r'[A-Z]', value):
        #     raise ValidationError('Password must contain an uppercase letter')
        # if not re.search(r'[a-z]', value):
        #     raise ValidationError('Password must contain a lowercase letter')
        # if not re.search(r'\d', value):
        #     raise ValidationError('Password must contain a number')


class LoginSchema(Schema):
    """
    Schema for validating user login requests.

    Validates and deserializes JSON input for user authentication.
    Enforces required email and password fields.

    Attributes:
        email (fields.Email): User's email address (required, must be valid email format).
        password (fields.Str): User's password (required).

    Raises:
        ValidationError: If validation fails for any field.

    Example:
        >>> schema = LoginSchema()
        >>> data = schema.load({"email": "user@example.com", "password": "secret123"})
        >>> print(data)
        {'email': 'user@example.com', 'password': 'secret123'}
    """

    email = fields.Email(required=True)
    password = fields.Str(required=True)
