# Interior Design AI App

Full-stack interior design assistant with:
- `frontend` (Next.js UI)
- `backend` (Express + MongoDB API)
- `segmentation_service` (FastAPI + PyTorch segmentation + AI suggestions)

## 1. Prerequisites

- Node.js 20+
- Python 3.10+
- MongoDB (local or hosted)

## 2. Environment Setup

Copy and fill these files:

- `backend/.env.example` -> `backend/.env`
- `frontend/.env.example` -> `frontend/.env.local`
- `segmentation_service/.env.example` -> `segmentation_service/.env`

## 3. Install Dependencies

### Backend
```bash
cd backend
npm install
```

### Frontend
```bash
cd frontend
npm install
```

### Segmentation Service
```bash
cd segmentation_service
python -m venv venv
venv\\Scripts\\activate
pip install -r requirements.txt
```

## 4. Run Locally

Start each service in a separate terminal.

### Segmentation service (port 8000)
```bash
cd segmentation_service
venv\\Scripts\\activate
uvicorn main:app --reload --port 8000
```

### Backend API (port 5000)
```bash
cd backend
npm start
```

### Frontend (port 3000)
```bash
cd frontend
npm run dev
```

## 5. Run With Docker

1. Create these files from examples:
   - `backend/.env`
   - `frontend/.env.local`
   - `segmentation_service/.env`
2. For Docker networking, set `backend/.env`:
   - `MONGO_URI=mongodb://mongo:27017/interior_design`
   - `SEGMENTATION_URL=http://segmentation_service:8000`
   - `SEGMENTATION_PUBLIC_BASE=http://localhost:8000`
3. Start stack:
```bash
docker compose up --build
```

## 6. Production Checklist

- Set a strong `JWT_SECRET`.
- Configure production `MONGO_URI`.
- Restrict `FRONTEND_ORIGIN` in backend CORS.
- Set `OPENROUTER_API_KEY` for AI suggestions.
- Set `UNSPLASH_ACCESS_KEY` for suggestion images (optional).
- Use HTTPS in production for camera and AR capabilities.

## 7. Health Endpoints

- Segmentation health: `GET http://localhost:8000/health`
- Backend API base: `http://localhost:5000/api`
