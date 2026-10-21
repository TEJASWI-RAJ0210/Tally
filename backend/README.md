# Tally — Backend (Next.js)

## Setup

1. `npm install`
2. Create a Neon project and database, then copy `backend/.env.example` to `backend/.env` and fill in:
   - `DATABASE_URL` — Neon **pooled** connection string (hostname contains `-pooler`), used by the app
   - `DIRECT_URL` — Neon **direct** connection string (remove `-pooler` from the hostname), used for Prisma migrations
   - `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — generate with `openssl rand -base64 48`
3. `npm run prisma:migrate` — applies the checked-in migration and creates the tables
4. `npm run dev` — starts on `http://localhost:3000`

For Neon, select the same project, branch, and database for both connection strings. Keep the `sslmode=require` query parameter. The pooled URL is for application queries; migrations use the direct URL.

## Auth

This uses your own email/password system (no Google/third-party OAuth):
- `POST /api/auth/signup` — `{ name, username, email, password }` → creates user, returns tokens
- `POST /api/auth/login` — `{ identifier, password }` where `identifier` is either email or username → returns tokens
- `POST /api/auth/refresh` — `{ refreshToken }` → returns a new access + refresh token pair

Passwords are hashed with bcrypt (`src/lib/password.ts`), never stored or returned in plaintext. Every other route strips `passwordHash` out of any `User` object before sending it back — double-check this if you add new routes that return user objects.

## What's implemented

- Auth: signup, login, refresh (above)
- `GET/PATCH /api/users/me`, `GET /api/users/check-username`, `PATCH /api/users/me/push-token`
- `GET /api/friends`, `GET /api/friends/search`, `POST /api/friends/request`, `POST /api/friends/[id]/accept`
- `GET/POST /api/groups`, `GET /api/groups/[id]`, `POST /api/groups/[id]/members`
- `GET/POST /api/expenses`, `GET/DELETE /api/expenses/[id]`
- `GET /api/balances`, `GET /api/balances/friend/[id]`, `GET /api/balances/group/[id]` (includes the simplified settlement plan)
- `GET/POST /api/settlements`
- `GET /api/activity`

## What's stubbed / left for you

- **Push notifications**: `// TODO` comments mark where a call to the Expo Push API should go — see [Expo's push docs](https://docs.expo.dev/push-notifications/sending-notifications/).
- **Password reset / "forgot password"** flow — not implemented. Would need an email-sending service (Resend, SendGrid free tier) plus a short-lived reset-token table.
- **Rate limiting on `/api/auth/login`** — worth adding before any real deployment, to slow down brute-force attempts. A simple in-memory or Redis-backed limiter is enough for a personal project.
- **DELETE /api/groups/[id]/members/[userId]**, **PATCH /api/expenses/[id]** — same pattern as existing routes, not written out yet.

## Key files to understand first

- `prisma/schema.prisma` — the whole data model
- `src/lib/balances.ts` — the balance math (core logic of the app)
- `src/lib/simplifyDebts.ts` — the greedy debt-simplification algorithm
- `src/lib/password.ts` + `src/app/api/auth/*` — the auth system
