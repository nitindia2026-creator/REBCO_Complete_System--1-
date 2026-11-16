# REBCO — Real Estate Banking & Financial Solutions
### Corporate Customer Enrollment & Administrative Portal

Official implementation matching the brand, corporate identity, and commercial standards of [REBCO Ventures](https://www.rebcoindia.com/).

---

## Stack & Architecture
- **Backend:** Python 3.11+, FastAPI, SQLAlchemy 2.0, Pydantic v2
- **Database:** PostgreSQL (Render / Production) or SQLite (Local zero-config)
- **Security:** AES-GCM 256-bit encryption for sensitive KYC (PAN/Aadhaar), Argon2 password hashing, JWT bearer tokens, and granular server-side RBAC
- **Frontend:** React 18, Vite, Lucide Icons, responsive corporate CSS
- **Design System:** Institutional finance palette (`#17324D` Corporate Navy, `#C9A646` Warm Gold, `#F7F4EC` Sand), `Noto Serif` & `Inter` typography, authentic SVG logo, and responsive layout across desktop, tablet, and mobile (360px–1440px)

---

## Deploy to Render.com (1-Click Blueprint)

Deploying to [Render.com](https://render.com/) is fully automated via the included `render.yaml` blueprint:

### Method 1: Render Blueprint (Recommended)
1. Push this repository to your GitHub or GitLab account.
2. Log in to [Render Dashboard](https://dashboard.render.com/).
3. Click **New +** $\rightarrow$ **Blueprint**.
4. Select your REBCO repository.
5. Render will automatically detect `render.yaml`, set up the managed PostgreSQL database (`rebco-database`), and configure the unified web service (`rebco-portal`).
6. Click **Apply**. Your app will build and deploy in ~2–3 minutes!

### Method 2: Manual Web Service on Render
If deploying without Blueprint:
- **Build Command:** `./render-build.sh`
- **Start Command:** `cd backend && python -m app.init_db && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Environment Variables:**
  - `DATABASE_URL`: Your Render PostgreSQL Internal Database URL
  - `JWT_SECRET`: Random 32+ character string
  - `FIELD_ENCRYPTION_KEY`: Base64 32-byte key (or any random string)
  - `UPLOAD_DIR`: `./private_uploads` (or mount a persistent disk at `/var/data/private_uploads`)
  - `SERVE_FRONTEND`: `true`

---

## Local Development & Testing

### 1. Run with Local Python & Node
```bash
# Backend setup
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate | Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
python -m app.init_db
uvicorn app.main:app --reload --port 8000

# Frontend setup (in a separate terminal)
cd frontend
npm install
npm run dev
```

### 2. Run with Docker Compose
```bash
docker compose up --build
```

---

## Default Administrator Credentials
- **Portal URL:** `http://localhost:5173/` (or `https://your-app.onrender.com/`)
- **Enrollment URL:** `http://localhost:5173/enroll` (or `https://your-app.onrender.com/enroll`)
- **Email:** `admin@rebco.com`
- **Password:** `Admin@REBCO1234`
- **Role:** `super_admin`

---

## Verification & Test Suite
Run the automated test suite anytime:
```bash
cd backend
pytest tests
```
Run comprehensive end-to-end integration test:
```bash
python test_full_system.py
```
