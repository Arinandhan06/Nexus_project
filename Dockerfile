# ==========================================
# Stage 1: Build React Frontend
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ==========================================
# Stage 2: Python Backend Runtime
# ==========================================
FROM python:3.11-slim AS runner
WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    DEMO_MODE=true \
    MOCK_EXTERNALS=true

# System dependencies for SQLite and networking
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy Backend Code
COPY backend/ ./backend/

# Copy Built Frontend static assets into backend
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

EXPOSE 8000

WORKDIR /app/backend
CMD ["python", "run_server.py"]
