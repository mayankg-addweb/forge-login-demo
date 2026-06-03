# Forge Login Demo

A tiny end-to-end example:

- **Frontend** (`frontend/`): Vite + React + Tailwind, single login page
- **Backend** (`backend/`): Express + pg + scrypt password hashing + token auth
- **DB**: PostgreSQL (provisioned by Forge via DO Managed Databases)

Both halves are served from the same droplet at `https://<ip>.nip.io`:

- `GET /` → React SPA
- `POST /api/auth/login` → returns `{ token, user }`
- `GET /api/auth/me` → returns the current user (requires `Authorization: Bearer <token>`)
- `GET /api/health` → backend liveness probe

## Seeded credentials

The backend's startup script upserts one user on first boot:

- email: `mayank@addwebsolution.in`
- password: `123456`

That's hardcoded into `backend/src/server.js` and runs every container start (idempotent upsert).
