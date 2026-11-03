# easyGenerator

Monorepo for the easyGenerator auth project.

## Live demo

- Frontend app: `https://easy-generator-auth.vercel.app/login`
- Backend base URL: `https://easygenerator-auth-api.onrender.com/`
- API docs (Swagger): `https://easygenerator-auth-api.onrender.com/api/docs`

## Project structure

- `backend/` — NestJS API (auth, users, sessions, tokens)
- `frontend/` — React + Vite web app
- `docs/architecture/` — C2/C3/auth-flow/database design docs

## Prerequisites

- Node.js 20+
- npm 10+
- MongoDB 8+ and `mongosh`

## Quick start (local)

### 1) Clone and install

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 2) Start MongoDB locally as replica set (`rs0`)

A replica set is required because backend auth flows use transactions.

#### macOS (Homebrew)

```bash
brew tap mongodb/brew
brew install mongodb-community@8.0 mongosh

mkdir -p .mongo-data
mongod --replSet rs0 --dbpath .mongo-data --bind_ip 127.0.0.1 --port 27017 --fork --logpath .mongo-data/mongod.log
mongosh --quiet --eval "try { rs.status().ok; print('ALREADY_INIT'); } catch (e) { rs.initiate({_id:'rs0',members:[{_id:0,host:'127.0.0.1:27017'}]}); print('INITIATED'); }"
mongosh --quiet --eval "printjson(rs.status().ok)"
```

#### Windows (PowerShell)

```powershell
winget install MongoDB.Server
winget install MongoDB.Shell

New-Item -ItemType Directory -Force .\.mongo-data | Out-Null
mongod --replSet rs0 --dbpath .\.mongo-data --bind_ip 127.0.0.1 --port 27017 --logpath .\.mongo-data\mongod.log
# Keep this terminal open
```

In a second terminal:

```powershell
mongosh --quiet --eval "try { rs.status().ok; print('ALREADY_INIT'); } catch (e) { rs.initiate({_id:'rs0',members:[{_id:0,host:'127.0.0.1:27017'}]}); print('INITIATED'); }"
mongosh --quiet --eval "printjson(rs.status().ok)"
```

Expected health output: `1`

### 3) Configure backend env

Create `backend/.env` from `backend/.env.example` and ensure these values are set for local run:

```env
MONGODB_URI=mongodb://localhost:27017/easygenerator?replicaSet=rs0
FRONTEND_ORIGIN=http://localhost:5173
RATE_LIMIT_STORE=memory
COOKIE_SECURE=false
JWT_SECRET=<your-secret>
```

### 4) Run backend

```bash
cd backend
npm run start:dev
```

Backend URLs:
- API base: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/api/docs`

### 5) Configure and run frontend

Create `frontend/.env` from `frontend/.env.example` (if needed) and run:

```bash
cd frontend
npm run dev
```

Frontend URL:
- App: `http://localhost:5173`

## Useful commands

### Backend

```bash
cd backend
npm test
npm run build
```

### Frontend

```bash
cd frontend
npm test
npm run build
```

## Notes

- `.mongo-data/` is local-only and should not be pushed.
- For deeper backend setup details, see `backend/README.md`.
- Architecture references:
  - `docs/architecture/c2-container.md`
  - `docs/architecture/c3-component.md`
  - `docs/architecture/auth-flow.md`
  - `docs/architecture/database-design.md`
