# ==============================================================================
# Multi-stage Production Dockerfile for REBCO Full-Stack Application
# Optimized for Render.com, Cloud Run, AWS ECS, or local Docker Compose
# ==============================================================================

# STAGE 1: Build React + Vite Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci || npm install
COPY frontend/ ./
RUN npm run build

# STAGE 2: Python Backend & Unified Production Runtime
FROM python:3.11-slim AS runtime
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Python backend dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY backend/app ./app
COPY backend/tests ./tests

# Copy compiled frontend from Stage 1 into /app/frontend/dist
COPY --from=frontend-builder /build/dist ./frontend/dist

# Create storage directory for private document uploads
RUN mkdir -p /app/private_uploads

EXPOSE 8000

# Execute schema migration and launch Uvicorn respecting $PORT from Render
CMD ["sh", "-c", "python -m app.init_db && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]

