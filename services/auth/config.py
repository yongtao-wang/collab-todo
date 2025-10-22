import os
from dataclasses import dataclass
from datetime import timedelta


@dataclass
class Config:
    """Application configuration with validation."""

    # Environment
    ENV: str
    DEBUG: bool
    PORT: int

    # Security
    JWT_SECRET_KEY: str
    JWT_COOKIE_SECURE: bool
    JWT_ACCESS_TOKEN_EXPIRES: timedelta
    JWT_REFRESH_TOKEN_EXPIRES: timedelta

    # Database
    SUPABASE_URL: str
    SUPABASE_SECRET_KEY: str

    # Logging
    LOG_LEVEL: str

    @classmethod
    def from_env(cls) -> 'Config':
        """Load configuration from environment variables."""
        env = os.getenv('ENV', 'development')

        return cls(
            ENV=env,
            DEBUG=(env != 'production'),
            PORT=int(os.getenv('PORT', 5566)),
            JWT_SECRET_KEY=os.getenv('JWT_SECRET_KEY', 'dev-secret'),
            JWT_COOKIE_SECURE=(env == 'production'),
            JWT_ACCESS_TOKEN_EXPIRES=timedelta(minutes=15),
            JWT_REFRESH_TOKEN_EXPIRES=timedelta(days=30),
            SUPABASE_URL=os.getenv('SUPABASE_URL'),
            SUPABASE_SECRET_KEY=os.getenv('SUPABASE_SECRET_KEY'),
            LOG_LEVEL=os.getenv(
                'LOG_LEVEL', 'INFO' if env == 'production' else 'DEBUG'
            ),
        )

    def validate(self) -> None:
        """Validate required configuration."""
        if self.ENV == 'production' and self.JWT_SECRET_KEY == 'dev-secret':
            raise ValueError('JWT_SECRET_KEY must be set in production')

        if not self.SUPABASE_URL or not self.SUPABASE_SECRET_KEY:
            raise ValueError('Supabase configuration is required')

    def configure_flask(self, app):
        """Apply configuration to Flask app."""
        app.config['JWT_SECRET_KEY'] = self.JWT_SECRET_KEY
        app.config['JWT_COOKIE_CSRF_PROTECT'] = True
        app.config['JWT_TOKEN_LOCATION'] = ["headers", "cookies"]
        app.config['JWT_COOKIE_SECURE'] = self.JWT_COOKIE_SECURE
        app.config['JWT_COOKIE_SAMESITE'] = "Lax"
        app.config['JWT_ACCESS_TOKEN_EXPIRES'] = self.JWT_ACCESS_TOKEN_EXPIRES
        app.config['JWT_REFRESH_TOKEN_EXPIRES'] = self.JWT_REFRESH_TOKEN_EXPIRES
        app.config['DEBUG'] = self.DEBUG
