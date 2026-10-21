# Tally

Personal expense-splitting app — React Native (Expo SDK 57) + Next.js + Postgres, with its own email/password authentication (no third-party OAuth).

This is a **starter scaffold**, not a finished app: it implements the core data model, auth flow, balance math, and the main screens end-to-end, with clearly marked TODOs for the remaining UI work.

## Structure

```
tally/
  backend/    Next.js API (Route Handlers) + Prisma + Postgres
  mobile/     Expo React Native app (SDK 57)
```

## Getting it running, in order

1. **Database**: create a free Postgres instance ([neon.tech](https://neon.tech) is quick) and grab the connection string.
2. **Backend**: see `backend/README.md` — install, fill `.env` (database URL + two JWT secrets), run migrations, `npm run dev`.
3. **Mobile**: see `mobile/README.md` — install, run `npx expo install --fix`, set `app.json`'s `extra.apiUrl` to your backend's LAN address, and run `npx expo start -c`.

## Auth, in short

Signup takes a name, username, email, and password. Login accepts either email or username. Both return a JWT access token (15 min) and refresh token (30 days); the mobile app stores the refresh token securely and silently refreshes the access token when it expires.

## What to build next, roughly in priority order

1. Finish the Add Expense screen: exact/percentage/shares split UI (calculators already exist)
2. Create Group screen
3. Wire push-notification *sending* on the backend (TODOs marked in the relevant routes)
4. Activity feed screen
5. Incoming friend request list + accept UI
6. "Forgot password" flow
7. Receipt photo capture (device-local, per the no-cloud-storage constraint)
