#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "=========================================="
echo "  REBCO Render Build & Deployment Script  "
echo "=========================================="

# 1. Install Python Backend Dependencies
echo "--> Installing Python backend requirements..."
python -m pip install --upgrade pip
python -m pip install -r backend/requirements.txt

# 2. Build Frontend Production SPA
echo "--> Building frontend Vite distribution..."
if command -v npm >/dev/null 2>&1; then
    cd frontend
    npm install
    npm run build
    cd ..
    echo "--> Frontend build complete: frontend/dist ready"
else
    echo "--> npm not found in path, using pre-built frontend/dist if present"
fi

# 3. Initialize Database Tables & Official Plans
echo "--> Running database schema migrations and seeding default plans..."
cd backend
python -m app.init_db
cd ..

echo "=========================================="
echo "  Build successfully prepared for Render! "
echo "=========================================="

