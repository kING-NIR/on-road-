# ⛽ RoadAssist — On-Road Fuel & Breakdown Assistance System

> AI-powered, real-time roadside assistance platform for fuel delivery, towing, mechanics, and emergency SOS — built for Indian highways.

[![Frontend: Vercel](https://img.shields.io/badge/Frontend-Vercel-black)](https://vercel.com)
[![Backend: Railway](https://img.shields.io/badge/Backend-Railway-purple)](https://railway.app)
[![ML: Render](https://img.shields.io/badge/ML_Service-Render-blue)](https://render.com)
[![DB: MySQL](https://img.shields.io/badge/DB-MySQL-orange)](https://mysql.com)

---

## ✨ Features

| Category | Feature |
|----------|---------|
| 🆘 Emergency | SOS button, multi-step request form, instant dispatch |
| 🗺️ Map | Google Maps integration, live provider tracking, route optimization |
| 🤖 ML | Breakdown risk prediction, smart provider recommendation, fuel demand forecasting |
| ⚡ Real-Time | Socket.IO live location updates, push notifications, status tracking |
| 🔐 Auth | JWT authentication, role-based access (user/provider/admin) |
| 🌙 UI | Dark/Light mode, fully responsive, industrial design system |
| 👑 Admin | Dashboard, request management, provider verification |

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, Vanilla JS, Google Maps API |
| Backend | Node.js, Express.js, Socket.IO |
| Database | MySQL + Sequelize ORM |
| ML Service | Python, FastAPI, scikit-learn |
| Real-time | Socket.IO (WebSockets) |
| Auth | JWT + bcrypt |
| Notifications | Firebase Cloud Messaging (free) |
| Deployment | Vercel + Railway + Render |

---

## 🚀 Quick Start

```bash
# Clone / extract the project
cd roadassist

# 1. Start MySQL (Docker)
docker run --name ra-db -e MYSQL_ROOT_PASSWORD=pass -e MYSQL_DATABASE=roadassist_db -p 3306:3306 -d mysql:8

# 2. Backend
cd backend && npm install
cp .env.example .env   # fill in your values
npm run dev            # http://localhost:5001

# 3. ML Service
cd ../ml-service
pip install -r requirements.txt
python train_models.py   # trains + saves models
uvicorn main:app --reload --port 8000

# 4. Frontend
cd ../frontend
npx live-server --port=3000
# Open: http://localhost:3000/pages/index.html
```

---

## 📸 Pages

| Page | Path | Description |
|------|------|-------------|
| Home Dashboard | `/pages/index.html` | Services, live feed, AI insights |
| Emergency Request | `/pages/emergency.html` | 3-step form + map + provider card |
| Live Map | `/pages/map.html` | Real-time provider map + sidebar |
| Profile | `/pages/profile.html` | Auth, history, settings |
| Admin | `/pages/admin.html` | Stats, requests, provider mgmt |

---

## 📡 ML Models

1. **Breakdown Risk Predictor** — RandomForestClassifier trained on road/weather features → outputs `low/medium/high/critical` risk
2. **Fuel Demand Forecaster** — GradientBoostingRegressor → outputs 0-100 demand score
3. **Provider Recommender** — Rule-based weighted scoring (distance 50% + rating 30% + experience 20%)

Train models: `cd ml-service && python train_models.py`

---

## 📝 Deployment

See [deployment/DEPLOYMENT.md](deployment/DEPLOYMENT.md) for full cloud deployment steps.

**TL;DR:**
- Frontend → Vercel (free)
- Backend → Railway (free $5 credit/month)
- Database → Railway MySQL (free)
- ML Service → Render (free 750hr/month)

---

## 🔑 Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill:
- `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS` — MySQL connection
- `JWT_SECRET` — min 32 char random string
- `GOOGLE_MAPS_API_KEY` — Google Cloud Console
- `ML_SERVICE_URL` — FastAPI URL (localhost:8000 or Render URL)
- `FIREBASE_*` — optional, for push notifications

---

## 📄 License

MIT — Built for educational / project purposes.

Made with ❤️ for Indian roads 🇮🇳
