# Complete Step-by-Step Render.com Deployment Guide

This guide walks you through deploying the complete **REBCO Corporate Enrollment & Admin Portal** to **[Render.com](https://render.com/)**.

---

## Architecture on Render

Render hosts this full-stack application as either:
- **Unified Full-Stack Deployment (Recommended):** A single Render Web Service running FastAPI that automatically serves both the backend REST API and the compiled React SPA frontend. This allows you to host the entire system on Render's free or starter plan with **zero CORS configuration** and **one single domain**.
- **Separate Microservices (Optional):** Backend Web Service + Frontend Static Site + Managed PostgreSQL Database.

---

## Method 1: Instant 1-Click Blueprint (Recommended)

Render Blueprints allow you to provision your database, web services, environment variables, and build scripts in one click.

### Step 1: Push Code to GitHub / GitLab
Make sure your REBCO project is in a GitHub or GitLab repository.

### Step 2: Open Render Dashboard
1. Go to [https://dashboard.render.com/](https://dashboard.render.com/).
2. Click the blue **"New +"** button at the top right.
3. Select **"Blueprint"**.

### Step 3: Connect Repository
1. Select your REBCO repository.
2. Render will parse `render.yaml` and display the resources to be created:
   - `rebco-database` (PostgreSQL 16 Database)
   - `rebco-portal` (Unified Web Service)
3. Click **"Apply"**.

### Step 4: Access Your Live Application
Once Render completes the build (~2–3 minutes):
- **Customer Enrollment:** `https://your-app-name.onrender.com/enroll`
- **Admin Portal:** `https://your-app-name.onrender.com/`
- **API Documentation:** `https://your-app-name.onrender.com/docs`
- **Health Check:** `https://your-app-name.onrender.com/health`

Log in using the pre-configured admin credentials:
- **Email:** `admin@rebco.com`
- **Password:** `Admin@REBCO1234`

---

## Method 2: Manual Web Service Setup (Step-by-Step)

If you prefer configuring services manually in the Render UI:

### Step 1: Create a PostgreSQL Database on Render
1. In the Render Dashboard, click **New +** $\rightarrow$ **PostgreSQL**.
2. **Name:** `rebco-db`
3. **Database:** `rebco`
4. **User:** `rebco_user`
5. **Plan:** Free or Starter
6. Click **Create Database**.
7. Once created, copy the **Internal Database URL** (e.g. `postgres://rebco_user:pass@dpg-xxxx:5432/rebco`).

### Step 2: Create the Web Service
1. In the Render Dashboard, click **New +** $\rightarrow$ **Web Service**.
2. Connect your repository.
3. Configure the following fields:
   - **Name:** `rebco-portal`
   - **Language:** `Python`
   - **Branch:** `main` (or your active branch)
   - **Region:** Same region as your database (e.g. Oregon, Frankfurt)
   - **Build Command:** `./render-build.sh`
   - **Start Command:** `cd backend && python -m app.init_db && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Plan:** Free or Starter

### Step 3: Set Environment Variables
Under the **Environment Variables** section, add:

| Key | Value | Notes |
| :--- | :--- | :--- |
| `PYTHON_VERSION` | `3.11.9` | Matches Python runtime |
| `NODE_VERSION` | `20.18.0` | Required for building the React frontend |
| `DATABASE_URL` | *Paste Internal Database URL* | Render `postgres://` URLs are automatically handled |
| `JWT_SECRET` | *Click "Generate" or enter 32+ characters* | Secure token signing key |
| `JWT_EXPIRE_MINUTES`| `60` | Token expiration time |
| `FIELD_ENCRYPTION_KEY` | *Click "Generate" or any random string* | Used for AES-GCM encryption of PAN/Aadhaar |
| `UPLOAD_DIR` | `./private_uploads` | Local storage directory for documents |
| `MAX_UPLOAD_MB` | `10` | Maximum file upload size |
| `CORS_ORIGINS` | `*` | Or specify exact domains |
| `SERVE_FRONTEND` | `true` | Enables unified React SPA serving |

4. Click **Create Web Service**.

---

## Persistent Document Storage on Render

On Render's Free tier, the filesystem is ephemeral (uploaded documents are wiped if the instance sleeps or restarts). 

If you upgrade to Render's **Starter** plan ($7/mo) and want customer document uploads (PDF/JPEG) to persist forever:
1. Go to your Web Service settings on Render.
2. Under **Disks**, click **Add Disk**.
3. **Name:** `rebco-uploads`
4. **Mount Path:** `/var/data/private_uploads`
5. **Size:** 1 GB (or more).
6. Update your environment variable `UPLOAD_DIR` to `/var/data/private_uploads`.

---

## Common Render Pitfalls & How REBCO Solves Them

| Common Issue | Cause | How This Project Solves It |
| :--- | :--- | :--- |
| **`NoSuchModuleError: postgres`** | Render supplies `postgres://...`, but SQLAlchemy 2.0 requires `postgresql+psycopg://` | `backend/app/db.py` automatically detects and translates `postgres://` into `postgresql+psycopg://`. |
| **Port Binding Failure** | Render dynamically assigns `$PORT` (e.g. 10000). Hardcoding 8000 fails. | Start command and Dockerfile explicitly bind to `--port ${PORT:-8000}`. |
| **CORS Errors** | Frontend on one domain calling API on another | Unified deployment serves frontend and API on the exact same domain, bypassing CORS completely. |
| **SPA 404 on `/enroll`** | Reloading `/enroll` directly on a web server returns 404 if not routed to `index.html` | FastAPI includes an intelligent SPA fallback handler that serves `index.html` for all client-side routes while preserving API endpoints. |
| **Base64 Key Errors** | User enters plain text for `FIELD_ENCRYPTION_KEY` | `backend/app/config.py` automatically checks length and falls back to SHA-256 derivation so any random string works safely. |

