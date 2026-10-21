# Tally — Mobile (Expo SDK 57 / React Native)

## Setup

1. `npm install`
2. `npx expo install --fix` — aligns Expo native modules with SDK 57. The SDK, React, and React Native versions are pinned in `package.json`.
3. In `app.json`, set `extra.apiUrl` to your computer's current Wi-Fi IPv4 address and backend port (for example, `http://192.168.1.5:3000/api` for a physical device — not `localhost`). Update it if your router changes the computer's address.
4. `npx expo start -c`, scan the QR with Expo Go, or run `npm run ios` / `npm run android`.

**A note on `localhost`:** if testing on a physical phone via Expo Go, `localhost` refers to the phone itself, not your computer. Use your computer's LAN IP instead, and make sure both devices are on the same wifi network.

## Auth

Own email/password system, no third-party OAuth:
- **Signup**: name, username (checked live for availability), email, password (min. 8 characters)
- **Login**: email *or* username, plus password
- Tokens (access + refresh) stored via `expo-secure-store`; the API client (`src/api/client.ts`) auto-refreshes the access token on a 401 and retries the original request

## What's implemented

- **Auth**: `src/screens/auth/Login.tsx`, `Signup.tsx`, wired to `src/api/hooks/useAuth.ts`
- **Theme**: light/dark/system toggle (`src/theme/`, `src/store/themeStore.ts`) via plain `StyleSheet` + a shared `createCommonStyles()` helper — no Tailwind/NativeWind, deliberately, to avoid dependency-chain fragility on newer Expo SDKs
- **Offline mode**: outbox queue pattern for creating expenses/settlements while offline, replayed on reconnect (`src/sync/`)
- **Push notifications**: permission request + token registration, triggered once the user is logged in (`App.tsx`)
- **Screens**: Home (balance summary), Friends (list + add by username), Friend Detail, Groups (list + detail with simplified settlement plan), Add Expense (equal split), Settle Up, Profile (theme toggle, logout)

## What's stubbed / left for you

- **Add Expense only implements EQUAL split** — calculators for EXACT/PERCENTAGE/SHARES already exist in `src/utils/splitCalculations.ts`, need a segmented-control UI and per-person input rows.
- **Group member picker** for Add Expense when `groupId` is set — currently only handles the 1:1 friend case.
- **Create Group screen** — referenced in navigation but not built yet; pattern mirrors `AddExpenseScreen` (`useCreateGroup()` already exists).
- **"Forgot password" flow** — no screen or backend route for this yet; needs an email-sending service, see backend README.
- **Receipt photos** — not wired up; per the no-cloud-storage constraint, this stays device-local via `expo-file-system`.
- **Activity feed screen** — backend route (`/api/activity`) exists, no screen consumes it yet.
- **Incoming friend request list / accept UI** — backend route exists (`POST /friends/[id]/accept`), no screen shows pending requests yet.

## Key files to understand first

- `App.tsx` — how providers (theme, query cache persistence, sync engine, notifications) wire together
- `src/api/client.ts` — token attach + refresh-on-401 interceptor
- `src/sync/outboxQueue.ts` + `useSyncEngine.ts` — the offline pattern
- `src/utils/splitCalculations.ts` — split-type math, pure functions
- `src/theme/` — token-based light/dark theming via `StyleSheet`
