# This python image included uv by default
FROM ghcr.io/astral-sh/uv:python3.13-alpine

WORKDIR /app

# Enable bytecode compilation for better startup performance
ENV UV_COMPILE_BYTECODE=1

# Copy dependency files first (for layer caching)
COPY pyproject.toml uv.lock* ./

# Install dependencies using uv
# --frozen ensures reproducible builds
# --no-cache reduces image size
RUN uv sync --frozen --no-cache --no-dev

# Copy application code
COPY . .

# Expose port
EXPOSE 5566

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5566/health')" || exit 1

# Run the application
CMD ["uv", "run", "main.py"]