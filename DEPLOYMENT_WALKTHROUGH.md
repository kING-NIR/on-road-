# 🚀 RoadAssist — Deployment Walkthrough

This guide provides the exact steps to host your full-stack RoadAssist platform on GitHub, Vercel, and Render for a live, professional deployment.

---

## 🏗 Deployment Strategy
To maintain a high-performance, low-cost (Free) infrastructure, we use:
- **Frontend** (Static) → **Vercel**
- **Backend** (Node.js) → **Render** (as a "Web Service")
- **ML Service** (Python) → **Render** (as a "Web Service")
- **Database** → **Render PostgreSQL** (or skip and continue using **SQLite**)

---

## 🛠 Step 1: Initialize Git & Push to GitHub
As your AI assistant, I have already prepared your local files and committed them. Follow these steps to connect your local project to a remote repository:

1.  **Create a New Repository** on [GitHub](https://github.com/new).
2.  **Run these commands** in your terminal (`roadassist/` root):
    ```bash
    git add .
    git commit -m "chore: prepare for production deployment"
    git branch -M main
    git remote add origin https://github.com/YOUR_USERNAME/road-assist.git
    git push -u origin main
    ```

---

## 🌐 Step 2: Deploy Frontend to Vercel
1.  **Log in** to your [Vercel Dashboard](https://vercel.com).
2.  **Click "+ New Project"** and import your GitHub repository.
3.  **Configure the Deployment**:
    - **Framework Preset**: Other (Static)
    - **Build Command**: `n/a` (leave blank)
    - **Output Directory**: `frontend/`
4.  **Click "Deploy"**. Once finished, Vercel will provide a URL (e.g., `roadassist.vercel.app`).

---

## ⚙️ Step 3: Deploy Backend to Render
1.  **Log in** to your [Render Dashboard](https://dashboard.render.com).
2.  **New + Web Service** → Import your GitHub repository.
3.  **Configure the Service**:
    - **Name**: `roadassist-backend`
    - **Language**: Node
    - **Root Directory**: `backend/`
    - **Build Command**: `npm install`
    - **Start Command**: `node server.js`
4.  **Click "Advanced"** to set up **Environment Variables** (from your `.env` file):
    - `PORT`: `5000` (Render handles internal routing)
    - `DB_DIALECT`: `sqlite` (or use Render PostgreSQL)
    - `FRONTEND_URL`: `https://YOUR_VERCEL_URL`
    - `JWT_SECRET`: `[Your Random String]`
5.  **Click "Create Web Service"**.

---

## 🤖 Step 4: Deploy ML Service to Render
1.  **New + Web Service** → Import your GitHub repository again.
2.  **Configure the Service**:
    - **Name**: `roadassist-ml`
    - **Language**: Python
    - **Root Directory**: `ml-service/`
    - **Build Command**: `pip install -r requirements.txt`
    - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port 10000`
3.  **Click "Create Web Service"**.

---

## ✅ Deployment Checklist
> [!IMPORTANT]
> **Update Frontend URLs**: Once you have your new Render URLs (Backend and ML), you MUST update the `CONFIG` object inside `frontend/js/main.js` and re-deploy the frontend.

```javascript
/* Adaptive configuration for Local and Production */
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const CONFIG = {
  API_BASE: isLocal ? 'http://localhost:5001/api' : 'https://roadassist-backend.onrender.com/api',
  ML_BASE:  isLocal ? 'http://localhost:8000'     : 'https://roadassist-ml.onrender.com',
  SOCKET_URL: isLocal ? 'http://localhost:5001'   : 'https://roadassist-backend.onrender.com'
};
```

**Congratulations!** Your project is now live on the internet!
